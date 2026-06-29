import { useState, useEffect, useMemo, useRef } from 'react'
import { arrayUnion, collection, doc, getDocs, onSnapshot, updateDoc, deleteDoc, query, where, runTransaction, writeBatch } from 'firebase/firestore'
import { db } from '../../firebase'
import { notificarPedidoPronto } from '../../utils/notifications'
import { notificarPush } from '../../utils/notificarPush'
import { ehStaff, normalizarPerfil } from '../../utils/perfis'
import { nomeParaVinculo } from '../../utils/nomes'
import { producaoDisponivelParaVenda, produtoDisponivelParaCardapioDia, produtoLiberadoManualHoje } from '../../utils/producao'
import {
  JANELA_PEDIDO_MS,
  calcularEstoqueAposEdicao,
  chaveDiariaPedido,
  codigoPedido,
  dadosPagamentoNaEntrega,
  gerarCodigoPedidoAleatorio,
  encontrarItemSemEstoque,
  estoqueAposCancelamento,
  estoqueAposVenda,
  horarioRetiradaParaTimestamp,
  pedidoAntesDaRetirada,
  quantidadesPorProduto,
} from '../../utils/pedidos'

function refsProducaoDoItem(item, produtos, producaoHoje) {
  const produtoBase = produtos.find(produto => String(produto.id) === String(item.id || item.produtoId))
  const produtoDia = produtoDisponivelParaCardapioDia(produtoBase, producaoHoje)
  return produtoDia?.producaoDiaIds || []
}

function consumirProducoesDaVenda(transaction, refs, snaps, quantidade) {
  let restante = Number(quantidade || 0)
  const consumos = []
  refs.forEach((ref, index) => {
    if (restante <= 0) return
    const snap = snaps[index]
    if (!snap.exists()) return
    const dados = snap.data()
    if (!producaoDisponivelParaVenda(dados)) return
    const disponivel = Math.max(0, Number(dados.quantidadeRestante || 0))
    const usado = Math.min(disponivel, restante)
    if (usado <= 0) return
    const novoRestante = Math.max(0, disponivel - usado)
    const update = {
      quantidadeVendida: Number(dados.quantidadeVendida || 0) + usado,
      quantidadeRestante: novoRestante,
      atualizadoEm: Date.now(),
    }
    if (novoRestante <= 0) update.status = 'Esgotado'
    transaction.update(ref, update)
    consumos.push({ id: ref.id, quantidade: usado })
    restante -= usado
  })
  if (restante > 0) throw new Error('Produto fora do cardapio do dia ou sem producao disponivel.')
  return consumos
}

export function usePedidos({ usuarioLogado, produtos, producaoHoje = [], carrinho, setCarrinho, onFbStatus }) {
  const [pedidos, setPedidos] = useState([])
  const vinculoTentadoRef = useRef('')

  useEffect(() => {
    if (!usuarioLogado?.uid || ehStaff(usuarioLogado.perfil)) return
    const nomeVinculo = usuarioLogado.nomeVinculo || nomeParaVinculo(usuarioLogado.nome)
    if (!nomeVinculo) return
    const chaveTentativa = `${usuarioLogado.uid}:${nomeVinculo}`
    if (vinculoTentadoRef.current === chaveTentativa) return
    vinculoTentadoRef.current = chaveTentativa

    async function vincularPedidosAvulsos() {
      try {
        const consultaNormalizada = query(
          collection(db, 'pedidos'),
          where('nomeVinculo', '==', nomeVinculo),
          where('alunoCadastrado', '==', false),
        )
        const consultaLegada = query(
          collection(db, 'pedidos'),
          where('aluno', '==', usuarioLogado.nome.trim()),
          where('alunoCadastrado', '==', false),
        )
        const [snapNormalizado, snapLegado] = await Promise.all([
          getDocs(consultaNormalizada),
          getDocs(consultaLegada),
        ])
        const documentos = new Map()
        ;[...snapNormalizado.docs, ...snapLegado.docs].forEach(pedidoDoc => documentos.set(pedidoDoc.id, pedidoDoc))
        if (documentos.size === 0) return

        const batch = writeBatch(db)
        const vinculadoEm = Date.now()
        documentos.forEach(pedidoDoc => {
          batch.update(pedidoDoc.ref, {
            uid: usuarioLogado.uid,
            matricula: usuarioLogado.matricula || '',
            nomeVinculo,
            alunoCadastrado: true,
            alunoPerfil: normalizarPerfil(usuarioLogado.role || usuarioLogado.perfil),
            vinculadoEm,
            vinculadoPor: usuarioLogado.uid,
          })
        })
        await batch.commit()
      } catch (e) {
        console.error('[Firestore] vinculo de pedidos avulsos:', e)
      }
    }

    vincularPedidosAvulsos()
  }, [usuarioLogado?.uid, usuarioLogado?.nome, usuarioLogado?.nomeVinculo, usuarioLogado?.matricula, usuarioLogado?.perfil, usuarioLogado?.role])

  // Aluno só precisa dos próprios pedidos; staff acompanha a fila inteira.
  // Isso evita sincronizar (e cobrar leituras de) toda a coleção para cada aluno logado.
  useEffect(() => {
    if (!usuarioLogado) return
    const usuarioEhStaff = ehStaff(usuarioLogado.perfil)
    const consulta = usuarioEhStaff
      ? collection(db, 'pedidos')
      : query(collection(db, 'pedidos'), where('uid', '==', usuarioLogado.uid))
    let unsub = () => {}
    try {
      unsub = onSnapshot(
        consulta,
        (snap) => {
          const lista = snap.docs.map(d => ({ ...d.data() }))
            .sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0))
          setPedidos(lista)
          onFbStatus?.('ok', `${snap.size} pedido(s)`)
        },
        (err) => onFbStatus?.('erro', err.code + ': ' + err.message)
      )
    } catch (e) {
      onFbStatus?.('erro', 'init: ' + e.message)
    }
    return unsub
    // Re-inscreve apenas quando perfil/matrícula mudam (ex.: login/logout) — outros
    // campos do usuário (nome, telefone...) não afetam a consulta de pedidos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuarioLogado?.perfil, usuarioLogado?.matricula, usuarioLogado?.uid])

  // Notifica o aluno assim que um pedido seu passa a "Pronto" — fica ativo em
  // qualquer tela do app (não só na página "Meus Pedidos"), pois o listener acima
  // já mantém `pedidos` sincronizado globalmente enquanto o usuário está logado.
  const prevStatusRef = useRef({})
  useEffect(() => {
    prevStatusRef.current = {}
  }, [usuarioLogado?.matricula])
  useEffect(() => {
    if (!usuarioLogado || usuarioLogado.perfil !== 'aluno') return
    pedidos.forEach(pedido => {
      const anterior = prevStatusRef.current[pedido.id]
      if (anterior && anterior !== 'Pronto' && pedido.status === 'Pronto') {
        notificarPedidoPronto(pedido)
      }
      prevStatusRef.current[pedido.id] = pedido.status
    })
  }, [pedidos, usuarioLogado])

  async function fazerPedido(horarioRetirada, pagamento) {
    if (!usuarioLogado) throw new Error('Ops! Você precisa estar logado para pedir.')
    if (carrinho.length === 0) throw new Error('Seu carrinho está vazio.')
    const perfilAluno = normalizarPerfil(usuarioLogado.role || usuarioLogado.perfil)
    if (pagamento === 'Conta do Professor' && perfilAluno !== 'professor') {
      throw new Error('Conta do Professor está disponível somente para professores.')
    }

    const itemSemEstoque = encontrarItemSemEstoque(carrinho, produtos)
    if (itemSemEstoque) throw new Error(`Não há quantidade suficiente disponível para ${itemSemEstoque.nome}.`)

    const criadoEm = Date.now()
    const horarioRetiradaEm = horarioRetiradaParaTimestamp(horarioRetirada, criadoEm)
    if (!horarioRetiradaEm) throw new Error('Selecione um horário válido para retirada.')
    if (horarioRetiradaEm < criadoEm - 60 * 1000) throw new Error('O horário selecionado para retirada já passou. Escolha um horário futuro.')
    const chaveDiaria = chaveDiariaPedido(criadoEm)
    const firestoreId = `P${chaveDiaria}-${criadoEm}`
    let novoPedido = null

    try {
      await runTransaction(db, async transaction => {
        const pedidoRef = doc(db, 'pedidos', firestoreId)
        const contadorRef = doc(db, 'contadoresPedidos', chaveDiaria)
        const itensComRefs = carrinho.map(item => ({
          item,
          ref: doc(db, 'produtos', String(item.id)),
          producaoRefs: refsProducaoDoItem(item, produtos, producaoHoje).map(id => doc(db, 'producaoDiaria', String(id))),
        }))

        const [contadorSnap, ...snapshots] = await Promise.all([
          transaction.get(contadorRef),
          ...itensComRefs.map(({ ref }) => transaction.get(ref)),
        ])
        const producaoSnapsPorItem = await Promise.all(
          itensComRefs.map(({ producaoRefs }) => Promise.all(producaoRefs.map(ref => transaction.get(ref))))
        )
        snapshots.forEach((snap, index) => {
          const { item } = itensComRefs[index]
          if (!snap.exists()) throw new Error(`O item ${item.nome} não está mais disponível.`)
          const estoqueAtual = Number(snap.data().estoque || 0)
          if (snap.data().disponivel === false) throw new Error(`${item.nome} nao esta disponivel no cardapio de hoje.`)
          if (estoqueAtual < item.quantidade) throw new Error(`Não há quantidade suficiente disponível para ${item.nome}.`)
          const quantidadeProducao = producaoSnapsPorItem[index]
            .filter(snapProducao => snapProducao.exists() && producaoDisponivelParaVenda(snapProducao.data()))
            .reduce((total, snapProducao) => total + Math.max(0, Number(snapProducao.data().quantidadeRestante || 0)), 0)
          if (!produtoLiberadoManualHoje(snap.data()) && quantidadeProducao < item.quantidade) throw new Error(`${item.nome} nao esta disponivel no cardapio do dia.`)
        })

        const numero = Number(contadorSnap.data()?.ultimoNumero || 0) + 1
        if (numero > 9999) throw new Error('O limite diário de pedidos foi atingido. Procure o atendimento.')
        const codigosUsados = contadorSnap.data()?.codigosUsados || []
        const codigoPedidoGerado = gerarCodigoPedidoAleatorio(codigosUsados)
        const inicioContagemEm = Math.max(criadoEm, horarioRetiradaEm)
        novoPedido = {
          id: firestoreId,
          numero,
          codigoPedido: codigoPedidoGerado,
          chaveDiaria,
          uid: usuarioLogado.uid || usuarioLogado.matricula,
          aluno: usuarioLogado.nome,
          matricula: usuarioLogado.matricula,
          alunoPerfil: perfilAluno,
          itens: carrinho.map((i, index) => ({
            produtoId: i.id,
            nome: i.nome,
            quantidade: i.quantidade,
            preco: i.preco,
            producaoDiaIds: itensComRefs[index].producaoRefs.map(ref => ref.id),
          })),
          total: carrinho.reduce((acc, i) => acc + i.preco * i.quantidade, 0),
          status: 'Recebido',
          statusKey: 'em_processo',
          origem: 'app',
          origemLabel: 'App',
          lancadoPorNome: usuarioLogado.nome,
          horarioPedido: new Date(criadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          horarioRetirada,
          horarioRetiradaEm,
          inicioContagemEm,
          pagamento,
          formaPagamento: pagamento,
          pagamentoStatus: pagamento === 'Conta do Professor' ? 'pendente' : 'aguardando_entrega',
          pago: false,
          criadoEm,
          cancelavelAte: inicioContagemEm + JANELA_PEDIDO_MS,
        }

        transaction.set(contadorRef, { ultimoNumero: numero, chaveDiaria, atualizadoEm: criadoEm, codigosUsados: [...codigosUsados, codigoPedidoGerado] })
        snapshots.forEach((snap, index) => {
          const { item, ref } = itensComRefs[index]
          const estoqueAtual = Number(snap.data().estoque || 0)
          const producaoConsumo = itensComRefs[index].producaoRefs.length
            ? consumirProducoesDaVenda(transaction, itensComRefs[index].producaoRefs, producaoSnapsPorItem[index], item.quantidade)
            : []
          novoPedido.itens[index].producaoConsumo = producaoConsumo
          transaction.update(ref, { estoque: estoqueAposVenda(estoqueAtual, item.quantidade) })
        })
        transaction.set(pedidoRef, novoPedido)
      })
      setCarrinho([])
      notificarPush({
        destino: 'cozinha',
        titulo: 'Novo pedido recebido',
        mensagem: `Pedido ${codigoPedido(novoPedido)} de ${usuarioLogado.nome || 'Aluno'} recebido.`,
        url: '/cozinha',
      })
      return novoPedido
    } catch (error) {
      console.error("Erro ao processar pedido:", error)
      const mensagem = String(error?.message || '')
      if (/estoque|quantidade suficiente|disponível|horário|limite diário/i.test(mensagem)) {
        throw new Error(mensagem, { cause: error })
      }
      throw new Error('Houve um erro de conexão ao processar seu pedido. Verifique sua internet.', { cause: error })
    }
  }

  async function atualizarStatusPedido(id, novoStatus, pedidoInformado = null) {
    try {
      const pedido = pedidos.find(p => p.id === id) || pedidoInformado
      if (novoStatus === 'Entregue' && pedidoAntesDaRetirada(pedido)) {
        throw new Error('O tempo do pedido começará a contar a partir do horário selecionado para retirada.')
      }
      const statusKey = novoStatus === 'Entregue' ? 'retirado'
        : novoStatus === 'Cancelado' ? 'cancelado'
          : 'em_processo'
      const updates = { status: novoStatus, statusKey }
      if (novoStatus === 'Pronto') updates.prontoEm = Date.now()
      if (novoStatus === 'Entregue') {
        const entregueEm = Date.now()
        updates.retiradoEm = entregueEm
        updates.entregueEm = entregueEm
        updates.entreguePor = usuarioLogado?.uid || ''
        updates.entreguePorNome = usuarioLogado?.nome || 'Vendedor'
        updates.historicoAlteracoes = arrayUnion({
          tipo: 'entrega',
          descricao: 'Pedido marcado como entregue.',
          usuarioId: usuarioLogado?.uid || '',
          usuarioNome: usuarioLogado?.nome || 'Vendedor',
          dataHora: entregueEm,
        })
        Object.assign(updates, dadosPagamentoNaEntrega(pedido, entregueEm))
      }
      await updateDoc(doc(db, 'pedidos', id), updates)

      if (pedido?.uid && novoStatus === 'Em preparo') {
        notificarPush({
          destino: pedido.uid,
          titulo: 'Pedido em preparo',
          mensagem: 'Seu pedido entrou em preparo na cantina.',
          url: '/aluno/pedidos',
        })
      }
      if (novoStatus === 'Pronto') {
        if (pedido?.uid) {
          notificarPush({
            destino: pedido.uid,
            titulo: 'Pedido pronto',
            mensagem: 'Seu pedido esta pronto para retirada!',
            url: '/aluno/pedidos',
          })
        }
        notificarPush({
          destino: 'vendedor',
          titulo: 'Pedido pronto',
          mensagem: `O pedido de ${pedido?.aluno || 'um aluno'} esta pronto para retirada.`,
          url: '/vendedor',
        })
      }
      return { ok: true }
    } catch (e) {
      console.error('atualizarStatusPedido:', e)
      return { erro: e.message || 'Não foi possível atualizar o pedido.' }
    }
  }

  async function darBaixaContaProfessor(id) {
    try {
      const pedido = pedidos.find(item => item.id === id)
      const formaPagamento = String(pedido?.formaPagamento || pedido?.pagamento || '').trim().toLocaleLowerCase('pt-BR')
      if (!pedido || formaPagamento !== 'conta do professor') {
        return { erro: 'Este pedido não pertence à Conta do Professor.' }
      }
      if (pedido.pago) return { ok: true }
      const pagoEm = Date.now()
      await updateDoc(doc(db, 'pedidos', id), {
        pago: true,
        pagamentoStatus: 'pago',
        pagoEm,
        pagamentoBaixadoPor: usuarioLogado?.uid || '',
        pagamentoBaixadoPorNome: usuarioLogado?.nome || 'Vendedor',
      })
      return { ok: true }
    } catch (e) {
      console.error('darBaixaContaProfessor:', e)
      return { erro: 'Não foi possível dar baixa no pagamento.' }
    }
  }

  async function editarPedido(id, updates, itensAntigos = null) {
    try {
      if (itensAntigos && updates.itens) {
        await runTransaction(db, async transaction => {
          const pedidoRef = doc(db, 'pedidos', id)
          const pedidoSnap = await transaction.get(pedidoRef)
          if (!pedidoSnap.exists()) throw new Error('Pedido não encontrado.')

          if (!Array.isArray(updates.itens) || updates.itens.length === 0) {
            throw new Error('O pedido precisa ter pelo menos um item.')
          }

          const pedidoAtual = pedidoSnap.data()
          if (['Entregue', 'Cancelado'].includes(pedidoAtual.status)) {
            throw new Error('Pedidos encerrados não podem ser editados pelo vendedor.')
          }
          const itensAtuais = pedidoAtual.itens || itensAntigos
          const qtdAntes = quantidadesPorProduto(itensAtuais)
          updates.itens.forEach(i => {
            const produtoId = i.produtoId || i.id
            if (!produtoId) throw new Error(`O produto ${i.nome || 'informado'} não possui identificação válida.`)
          })
          const qtdDepois = quantidadesPorProduto(updates.itens)

          const todos = new Set([...Object.keys(qtdAntes), ...Object.keys(qtdDepois)])
          const refs = [...todos].map(prodId => ({ prodId, ref: doc(db, 'produtos', prodId) }))
          const snaps = await Promise.all(refs.map(({ ref }) => transaction.get(ref)))
          snaps.forEach((snap, index) => {
            const { prodId, ref } = refs[index]
            const quantidadeAntes = qtdAntes[prodId] || 0
            const quantidadeDepois = qtdDepois[prodId] || 0
            if (quantidadeAntes === quantidadeDepois) return
            if (!snap.exists()) {
              if (quantidadeDepois > quantidadeAntes) throw new Error('Um produto adicionado ao pedido não está mais disponível.')
              return
            }
            const ajuste = calcularEstoqueAposEdicao(snap.data().estoque, quantidadeAntes, quantidadeDepois)
            if (!ajuste.valido) {
              throw new Error(`Não há quantidade suficiente disponível para ${snap.data().nome || 'este item'}.`)
            }
            transaction.update(ref, { estoque: ajuste.estoque })
          })
          const editadoEm = Date.now()
          transaction.update(pedidoRef, {
            ...updates,
            editadoEm,
            editadoPor: usuarioLogado?.uid || '',
            editadoPorNome: usuarioLogado?.nome || 'Vendedor',
            historicoAlteracoes: arrayUnion({
              tipo: 'edicao',
              descricao: 'Itens ou dados do pedido foram alterados.',
              usuarioId: usuarioLogado?.uid || '',
              usuarioNome: usuarioLogado?.nome || 'Vendedor',
              dataHora: editadoEm,
            }),
          })
        })
      } else {
        await updateDoc(doc(db, 'pedidos', id), updates)
      }
      return { ok: true }
    } catch (e) {
      console.error('editarPedido:', e)
      return { erro: e.message || 'Não foi possível editar o pedido.' }
    }
  }

  async function avaliarPedido(pedidoOuId, nota, comentario = '') {
    const pedido = typeof pedidoOuId === 'object'
      ? pedidoOuId
      : pedidos.find(p => p.id === pedidoOuId)
    if (!pedido?.id) return { erro: 'Pedido nao encontrado.' }
    const notaFinal = Math.min(5, Math.max(1, Number(nota || 0)))
    const comentarioFinal = String(comentario || '').trim().slice(0, 280)
    const agora = Date.now()
    const payloadPedido = {
      avaliacao: notaFinal,
      comentarioAvaliacao: comentarioFinal,
      avaliadoEm: agora,
      avaliadoPor: usuarioLogado?.uid || usuarioLogado?.matricula || '',
    }
    try {
      await updateDoc(doc(db, 'pedidos', pedido.id), payloadPedido)
      const batch = writeBatch(db)
      ;(pedido.itens || []).forEach(item => {
        const produtoId = item.produtoId || item.id
        if (!produtoId) return
        const ref = doc(db, 'avaliacoes', `${pedido.id}_${produtoId}`)
        batch.set(ref, {
          pedidoId: pedido.id,
          produtoId,
          produtoNome: item.nome || item.produtoNome || 'Produto',
          nota: notaFinal,
          comentario: comentarioFinal,
          alunoNome: usuarioLogado?.nome || pedido.aluno || 'Aluno',
          alunoId: usuarioLogado?.uid || usuarioLogado?.matricula || '',
          criadoEm: agora,
        }, { merge: true })
      })
      await batch.commit()
      return { ok: true }
    } catch (e) {
      console.error('avaliarPedido:', e)
      return { erro: 'Nao foi possivel salvar sua avaliacao agora.' }
    }
  }

  async function limparEntregues() {
    const entregues = pedidos.filter(p => p.status === 'Entregue')
    try { await Promise.all(entregues.map(p => deleteDoc(doc(db, 'pedidos', p.id)))) } catch (e) { console.error('limparEntregues:', e) }
  }

  async function cancelarPedido(pedidoId, motivo = '') {
    let pedidoCancelado = null
    try {
      await runTransaction(db, async transaction => {
        const pedidoRef = doc(db, 'pedidos', pedidoId)
        const pedidoSnap = await transaction.get(pedidoRef)
        if (!pedidoSnap.exists()) return

        const pedido = pedidoSnap.data()
        if (pedido.status === 'Cancelado' || pedido.status === 'Entregue') return

        const itens = Array.isArray(pedido.itens) ? pedido.itens : []
        const itensComRefs = itens
          .filter(item => item.produtoId)
          .map(item => ({ item, ref: doc(db, 'produtos', String(item.produtoId)) }))
        const produtosSnap = await Promise.all(itensComRefs.map(({ ref }) => transaction.get(ref)))
        const consumosProducao = itens.flatMap(item => Array.isArray(item.producaoConsumo) ? item.producaoConsumo : [])
        const producaoRefs = consumosProducao.map(consumo => doc(db, 'producaoDiaria', String(consumo.id)))
        const producaoSnaps = await Promise.all(producaoRefs.map(ref => transaction.get(ref)))

        transaction.update(pedidoRef, {
          status: 'Cancelado',
          statusKey: 'cancelado',
          motivoCancelamento: motivo,
          canceladoEm: Date.now(),
          canceladoPor: usuarioLogado?.nome || 'Sistema',
          canceladoPorId: usuarioLogado?.uid || '',
          historicoAlteracoes: arrayUnion({
            tipo: 'cancelamento',
            descricao: motivo || 'Pedido cancelado.',
            usuarioId: usuarioLogado?.uid || '',
            usuarioNome: usuarioLogado?.nome || 'Sistema',
            dataHora: Date.now(),
          }),
        })

        produtosSnap.forEach((snap, index) => {
          if (!snap.exists()) return
          const { item, ref } = itensComRefs[index]
          const estoqueAtual = Number(snap.data().estoque || 0)
          transaction.update(ref, { estoque: estoqueAposCancelamento(estoqueAtual, item.quantidade) })
        })
        producaoSnaps.forEach((snap, index) => {
          if (!snap.exists()) return
          const consumo = consumosProducao[index]
          const dados = snap.data()
          const quantidade = Math.max(0, Number(consumo.quantidade || 0))
          if (quantidade <= 0) return
          const quantidadeVendida = Math.max(0, Number(dados.quantidadeVendida || 0) - quantidade)
          const quantidadeRestante = Math.max(0, Number(dados.quantidadeRestante || 0) + quantidade)
          transaction.update(producaoRefs[index], {
            quantidadeVendida,
            quantidadeRestante,
            status: producaoDisponivelParaVenda({ ...dados, quantidadeRestante }) ? dados.status : 'Pronto para venda',
            atualizadoEm: Date.now(),
          })
        })

        pedidoCancelado = pedido
      })

      if (pedidoCancelado) {
        const mensagem = `Pedido de ${pedidoCancelado.aluno || 'um aluno'} foi cancelado${motivo ? `: ${motivo}` : '.'}`
        notificarPush({ destino: 'admin', titulo: 'Pedido cancelado', mensagem, url: '/admin/relatorios' })
        notificarPush({ destino: 'vendedor', titulo: 'Pedido cancelado', mensagem, url: '/vendedor' })
      }
      return { ok: true }
    } catch (e) {
      console.error('cancelarPedido:', e)
      return { erro: e.message || 'Não foi possível cancelar o pedido.' }
    }
  }

  const pedidosNaFila = useMemo(() => pedidos.filter(p => p.status === 'Recebido' || p.status === 'Em preparo').length, [pedidos])
  const tempoEstimado = useMemo(() => {
    if (pedidosNaFila === 0) return 5
    if (pedidosNaFila <= 3) return 10
    if (pedidosNaFila <= 6) return 15
    return 20
  }, [pedidosNaFila])

  return {
    pedidos, fazerPedido, atualizarStatusPedido, darBaixaContaProfessor, cancelarPedido, editarPedido, limparEntregues, avaliarPedido,
    pedidosNaFila, tempoEstimado,
  }
}
