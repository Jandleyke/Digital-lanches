import { useState, useEffect, useMemo, useRef } from 'react'
import { collection, doc, onSnapshot, updateDoc, deleteDoc, query, where, runTransaction, writeBatch } from 'firebase/firestore'
import { db } from '../../firebase'
import { notificarPedidoPronto } from '../../utils/notifications'
import { notificarPush } from '../../utils/notificarPush'
import { ehStaff } from '../../utils/perfis'

const JANELA_CANCELAMENTO_MS = 10 * 60 * 1000

export function usePedidos({ usuarioLogado, produtos, carrinho, setCarrinho, onFbStatus }) {
  const [pedidos, setPedidos] = useState([])

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

    const itemSemEstoque = carrinho.find(item => {
      const prod = produtos.find(p => p.id === item.id)
      return !prod || prod.estoque < item.quantidade
    })
    if (itemSemEstoque) throw new Error(`O item ${itemSemEstoque.nome} acabou de esgotar.`)

    const firestoreId = `P${Date.now()}`
    const criadoEm = Date.now()
    const novoPedido = {
      id: firestoreId, uid: usuarioLogado.uid || usuarioLogado.matricula,
      aluno: usuarioLogado.nome, matricula: usuarioLogado.matricula,
      itens: carrinho.map(i => ({ produtoId: i.id, nome: i.nome, quantidade: i.quantidade, preco: i.preco })),
      total: carrinho.reduce((acc, i) => acc + i.preco * i.quantidade, 0),
      status: 'Recebido',
      statusKey: 'em_processo',
      horarioPedido: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      horarioRetirada, pagamento, pago: false, criadoEm,
      cancelavelAte: criadoEm + JANELA_CANCELAMENTO_MS,
    }

    try {
      await runTransaction(db, async transaction => {
        const pedidoRef = doc(db, 'pedidos', firestoreId)
        const itensComRefs = carrinho.map(item => ({
          item,
          ref: doc(db, 'produtos', String(item.id)),
        }))

        const snapshots = await Promise.all(itensComRefs.map(({ ref }) => transaction.get(ref)))
        snapshots.forEach((snap, index) => {
          const { item } = itensComRefs[index]
          if (!snap.exists()) throw new Error(`O item ${item.nome} não está mais disponível.`)
          const estoqueAtual = Number(snap.data().estoque || 0)
          if (estoqueAtual < item.quantidade) throw new Error(`O item ${item.nome} acabou de esgotar.`)
        })

        transaction.set(pedidoRef, novoPedido)
        snapshots.forEach((snap, index) => {
          const { item, ref } = itensComRefs[index]
          const estoqueAtual = Number(snap.data().estoque || 0)
          transaction.update(ref, { estoque: estoqueAtual - item.quantidade })
        })
      })
      setCarrinho([])
      notificarPush({
        destino: 'cozinha',
        titulo: 'Novo pedido recebido',
        mensagem: `${usuarioLogado.nome || 'Aluno'} fez um novo pedido.`,
        url: '/cozinha',
      })
      return novoPedido
    } catch (error) {
      console.error("Erro ao processar pedido:", error)
      throw new Error('Houve um erro de conexão ao processar seu pedido. Verifique sua internet.', { cause: error })
    }
  }

  async function atualizarStatusPedido(id, novoStatus) {
    try {
      const statusKey = novoStatus === 'Entregue' ? 'retirado'
        : novoStatus === 'Cancelado' ? 'cancelado'
          : 'em_processo'
      const updates = { status: novoStatus, statusKey }
      if (novoStatus === 'Pronto') updates.prontoEm = Date.now()
      if (novoStatus === 'Entregue') {
        updates.pago = true
        updates.retiradoEm = Date.now()
      }
      await updateDoc(doc(db, 'pedidos', id), updates)

      const pedido = pedidos.find(p => p.id === id)
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
    } catch (e) { console.error('atualizarStatusPedido:', e) }
  }

  async function editarPedido(id, updates, itensAntigos = null) {
    try {
      await updateDoc(doc(db, 'pedidos', id), updates)
      // Se itens foram alterados, ajusta estoque (devolve o que reduziu, desconta o que aumentou)
      if (itensAntigos && updates.itens) {
        const qtdAntes = {}
        itensAntigos.forEach(i => { qtdAntes[String(i.produtoId)] = (qtdAntes[String(i.produtoId)] || 0) + i.quantidade })
        const qtdDepois = {}
        updates.itens.forEach(i => { qtdDepois[String(i.produtoId)] = (qtdDepois[String(i.produtoId)] || 0) + i.quantidade })
        const todos = new Set([...Object.keys(qtdAntes), ...Object.keys(qtdDepois)])
        await Promise.all([...todos].map(async prodId => {
          const diff = (qtdAntes[prodId] || 0) - (qtdDepois[prodId] || 0)
          if (diff !== 0) {
            const prod = produtos.find(p => String(p.id) === prodId)
            if (prod) await updateDoc(doc(db, 'produtos', String(prod.id)), { estoque: Math.max(0, (prod.estoque || 0) + diff) })
          }
        }))
      }
    } catch (e) { console.error('editarPedido:', e) }
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

  async function marcarPedidoPago(id) {
    try { await updateDoc(doc(db, 'pedidos', id), { pago: true, pagamentoStatus: 'pago', pagoEm: Date.now() }) }
    catch (e) { console.error('marcarPedidoPago:', e) }
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

        transaction.update(pedidoRef, {
          status: 'Cancelado',
          statusKey: 'cancelado',
          motivoCancelamento: motivo,
          canceladoEm: Date.now(),
          canceladoPor: usuarioLogado?.nome || 'Sistema',
        })

        produtosSnap.forEach((snap, index) => {
          if (!snap.exists()) return
          const { item, ref } = itensComRefs[index]
          const estoqueAtual = Number(snap.data().estoque || 0)
          transaction.update(ref, { estoque: estoqueAtual + Number(item.quantidade || 0) })
        })

        pedidoCancelado = pedido
      })

      if (pedidoCancelado) {
        const mensagem = `Pedido de ${pedidoCancelado.aluno || 'um aluno'} foi cancelado${motivo ? `: ${motivo}` : '.'}`
        notificarPush({ destino: 'admin', titulo: 'Pedido cancelado', mensagem, url: '/admin/relatorios' })
        notificarPush({ destino: 'vendedor', titulo: 'Pedido cancelado', mensagem, url: '/vendedor' })
      }
    } catch (e) { console.error('cancelarPedido:', e) }
  }

  const pedidosNaFila = useMemo(() => pedidos.filter(p => p.status === 'Recebido' || p.status === 'Em preparo').length, [pedidos])
  const tempoEstimado = useMemo(() => {
    if (pedidosNaFila === 0) return 5
    if (pedidosNaFila <= 3) return 10
    if (pedidosNaFila <= 6) return 15
    return 20
  }, [pedidosNaFila])

  return {
    pedidos, fazerPedido, atualizarStatusPedido, cancelarPedido, editarPedido, limparEntregues, avaliarPedido, marcarPedidoPago,
    pedidosNaFila, tempoEstimado,
  }
}
