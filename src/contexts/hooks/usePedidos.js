import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { arrayUnion, collection, doc, getDoc, getDocs, onSnapshot, updateDoc, deleteDoc, query, where, runTransaction, writeBatch } from 'firebase/firestore'
import { auth, db } from '../../firebase'
import { notificarPedidoPronto } from '../../utils/notifications'
import { notificarPush } from '../../utils/notificarPush'
import { ehStaff, normalizarPerfil } from '../../utils/perfis'
import { nomeParaVinculo } from '../../utils/nomes'
import { producaoDisponivelParaVenda, produtoDisponivelParaCardapioDia } from '../../utils/producao'
import { useTempoAtual } from '../../utils/useTempoAtual'
import {
  calcularEstoqueAposEdicao,
  codigoPedido,
  dadosPagamentoNaEntrega,
  encontrarItemSemEstoque,
  estoqueAposCancelamento,
  horarioRetiradaParaTimestamp,
  mensagemErroFinalizacaoPedido,
  pedidoAntesDaRetirada,
  quantidadesPorProduto,
} from '../../utils/pedidos'

function refsProducaoDoItem(item, produtos, producaoHoje) {
  const produtoBase = produtos.find(produto => String(produto.id) === String(item.id || item.produtoId))
  const produtoDia = produtoDisponivelParaCardapioDia(produtoBase, producaoHoje)
  return produtoDia?.producaoDiaIds || []
}

export function usePedidos({ usuarioLogado, produtos, producaoHoje = [], carrinho, setCarrinho, onFbStatus }) {
  const [pedidos, setPedidos] = useState([])
  const vinculoTentadoRef = useRef('')

  // Início do dia atual. Muda de valor apenas na virada da meia-noite, então o
  // listener da equipe só re-inscreve uma vez por dia (e não a cada minuto).
  const tempoAtual = useTempoAtual(60000)
  const inicioDoDia = useMemo(() => {
    const d = new Date(tempoAtual)
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  }, [tempoAtual])

  // Busca pontual (getDocs, sem listener) de pedidos por período — usada pelos
  // relatórios/dashboard para consultar datas passadas sem manter a coleção inteira
  // sincronizada em tempo real. Passe null/undefined em um limite para ignorá-lo.
  const buscarPedidosPorPeriodo = useCallback(async (inicioTs, fimTs) => {
    const filtros = []
    if (inicioTs != null) filtros.push(where('criadoEm', '>=', Number(inicioTs)))
    if (fimTs != null) filtros.push(where('criadoEm', '<=', Number(fimTs)))
    const consulta = filtros.length
      ? query(collection(db, 'pedidos'), ...filtros)
      : collection(db, 'pedidos')
    const snap = await getDocs(consulta)
    return snap.docs.map(d => ({ ...d.data() }))
      .sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0))
  }, [])

  // Busca pontual de um pedido por id (o doc id é igual ao campo `id`). Usada como
  // fallback pela equipe quando o pedido não está na lista ao vivo — que cobre só o
  // dia — em operações que podem alcançar pedidos de outras datas: leitura de QR e
  // detalhe do atendimento vinculado a um pedido antigo.
  const buscarPedidoPorId = useCallback(async (id) => {
    if (!id) return null
    try {
      const snap = await getDoc(doc(db, 'pedidos', String(id)))
      return snap.exists() ? { ...snap.data() } : null
    } catch (e) {
      console.error('[Firestore] buscarPedidoPorId:', e)
      return null
    }
  }, [])

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

  // Aluno só precisa dos próprios pedidos; staff acompanha a fila do dia.
  // O listener da equipe é limitado aos pedidos de hoje (`criadoEm >= inicioDoDia`)
  // porque cozinha/vendedor só operam a fila do dia — sincronizar toda a coleção
  // histórica em tempo real relia milhares de documentos a cada sessão/reload e era
  // a maior fonte de consumo de leituras. Relatórios de datas passadas usam a busca
  // pontual `buscarPedidosPorPeriodo`.
  useEffect(() => {
    if (!usuarioLogado) return
    const usuarioEhStaff = ehStaff(usuarioLogado.perfil)
    const consulta = usuarioEhStaff
      ? query(collection(db, 'pedidos'), where('criadoEm', '>=', inicioDoDia))
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
    // Re-inscreve quando perfil/matrícula mudam (login/logout) ou na virada do dia
    // (inicioDoDia) — outros campos do usuário não afetam a consulta de pedidos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuarioLogado?.perfil, usuarioLogado?.matricula, usuarioLogado?.uid, inicioDoDia])

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
    if (!usuarioLogado.uid) throw new Error('Sua sessão não possui UID válido. Saia e entre novamente para finalizar o pedido.')
    const perfilAluno = normalizarPerfil(usuarioLogado.role || usuarioLogado.perfil)
    if (!['aluno', 'professor'].includes(perfilAluno)) {
      throw new Error('Seu perfil não tem permissão para finalizar pedidos pelo carrinho.')
    }
    if (pagamento === 'Conta do Professor' && perfilAluno !== 'professor') {
      throw new Error('Conta do Professor está disponível somente para professores.')
    }

    const produtosDoCardapio = produtos
      .map(produto => produtoDisponivelParaCardapioDia(produto, producaoHoje))
      .filter(Boolean)
    const itemSemEstoque = encontrarItemSemEstoque(carrinho, produtosDoCardapio)
    if (itemSemEstoque) throw new Error(`Não há quantidade suficiente disponível para ${itemSemEstoque.nome}.`)

    const criadoEm = Date.now()
    const horarioRetiradaEm = horarioRetiradaParaTimestamp(horarioRetirada, criadoEm)
    if (!horarioRetiradaEm) throw new Error('Selecione um horário válido para retirada.')
    if (horarioRetiradaEm < criadoEm - 60 * 1000) throw new Error('O horário selecionado para retirada já passou. Escolha um horário futuro.')
    try {
      const token = await auth.currentUser?.getIdToken()
      if (!token) throw new Error('Sua sessão expirou. Saia e entre novamente para finalizar o pedido.')
      const carrinhoSeguro = carrinho.map(item => ({
        produtoId: String(item.produtoId || item.id || ''),
        quantidade: Number(item.quantidade || 0),
        producaoDiaIds: refsProducaoDoItem(item, produtos, producaoHoje),
      }))
      const resposta = await fetch('/api/fazerPedido', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          carrinho: carrinhoSeguro,
          horarioRetirada,
          horarioRetiradaEm,
          pagamento,
        }),
      })
      const dados = await resposta.json().catch(() => ({}))
      if (!resposta.ok || !dados?.pedido) {
        const erro = new Error(dados?.erro || 'Não foi possível processar o pedido.')
        erro.code = dados?.codigo || `http-${resposta.status}`
        throw erro
      }
      const novoPedido = dados.pedido
      setCarrinho([])
      notificarPush({
        destino: 'cozinha',
        titulo: 'Novo pedido recebido',
        mensagem: `Pedido ${codigoPedido(novoPedido)} de ${usuarioLogado.nome || 'Aluno'} recebido.`,
        url: '/cozinha',
      })
      return novoPedido
    } catch (error) {
      const mensagem = mensagemErroFinalizacaoPedido(error)
      console.error('[Pedido] erro ao finalizar pedido:', {
        code: error?.code || '',
        message: error?.message || '',
        stack: error?.stack || '',
        usuario: {
          uid: usuarioLogado?.uid || '',
          matricula: usuarioLogado?.matricula || '',
          perfil: perfilAluno,
        },
        carrinho: carrinho.map(item => ({ id: item.id, nome: item.nome, quantidade: item.quantidade })),
        horarioRetirada,
        pagamento,
      }, error)
      throw new Error(mensagem, { cause: error })
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
        return { erro: 'Este pedido não pertence Ã  Conta do Professor.' }
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
    pedidosNaFila, tempoEstimado, buscarPedidosPorPeriodo, buscarPedidoPorId,
  }
}
