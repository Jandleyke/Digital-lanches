import { useState, useEffect, useMemo, useRef } from 'react'
import { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, query, where } from 'firebase/firestore'
import { db } from '../../firebase'
import { notificarPedidoPronto } from '../../utils/notifications'

export function usePedidos({ usuarioLogado, produtos, carrinho, setCarrinho, onFbStatus }) {
  const [pedidos, setPedidos] = useState([])

  // Aluno só precisa dos próprios pedidos; staff acompanha a fila inteira.
  // Isso evita sincronizar (e cobrar leituras de) toda a coleção para cada aluno logado.
  useEffect(() => {
    if (!usuarioLogado) return
    const ehStaff = ['admin', 'gerente', 'cozinha'].includes(usuarioLogado.perfil)
    const consulta = ehStaff
      ? collection(db, 'pedidos')
      : query(collection(db, 'pedidos'), where('matricula', '==', usuarioLogado.matricula))
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
  }, [usuarioLogado?.perfil, usuarioLogado?.matricula])

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
    const novoPedido = {
      id: firestoreId, aluno: usuarioLogado.nome, matricula: usuarioLogado.matricula,
      itens: carrinho.map(i => ({ produtoId: i.id, nome: i.nome, quantidade: i.quantidade, preco: i.preco })),
      total: carrinho.reduce((acc, i) => acc + i.preco * i.quantidade, 0),
      status: 'Recebido',
      horarioPedido: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      horarioRetirada, pagamento, pago: false, criadoEm: Date.now(),
    }

    try {
      await setDoc(doc(db, 'pedidos', firestoreId), novoPedido)
      await Promise.all(carrinho.map(item => {
        const prod = produtos.find(p => p.id === item.id)
        if (!prod) return Promise.resolve()
        return updateDoc(doc(db, 'produtos', String(item.id)), { estoque: Math.max(0, prod.estoque - item.quantidade) })
      }))
      setCarrinho([])
      return novoPedido
    } catch (error) {
      console.error("Erro ao processar pedido:", error)
      throw new Error('Houve um erro de conexão ao processar seu pedido. Verifique sua internet.', { cause: error })
    }
  }

  async function atualizarStatusPedido(id, novoStatus) {
    try {
      const updates = { status: novoStatus }
      if (novoStatus === 'Pronto') updates.prontoEm = Date.now()
      if (novoStatus === 'Entregue') updates.pago = true
      await updateDoc(doc(db, 'pedidos', id), updates)
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

  async function avaliarPedido(id, nota) {
    try { await updateDoc(doc(db, 'pedidos', id), { avaliacao: nota }) }
    catch (e) { console.error('avaliarPedido:', e) }
  }

  async function limparEntregues() {
    const entregues = pedidos.filter(p => p.status === 'Entregue')
    try { await Promise.all(entregues.map(p => deleteDoc(doc(db, 'pedidos', p.id)))) } catch (e) { console.error('limparEntregues:', e) }
  }

  async function cancelarPedido(pedidoId, motivo = '') {
    const pedido = pedidos.find(p => p.id === pedidoId)
    if (!pedido) return
    try {
      await updateDoc(doc(db, 'pedidos', pedidoId), {
        status: 'Cancelado', motivoCancelamento: motivo,
        canceladoEm: Date.now(), canceladoPor: usuarioLogado?.nome || 'Sistema',
      })
      await Promise.all(pedido.itens.map(item => {
        const prod = produtos.find(p => p.id === item.produtoId)
        if (!prod) return Promise.resolve()
        return updateDoc(doc(db, 'produtos', String(item.produtoId)), { estoque: (prod.estoque || 0) + item.quantidade })
      }))
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
    pedidos, fazerPedido, atualizarStatusPedido, cancelarPedido, editarPedido, limparEntregues, avaliarPedido,
    pedidosNaFila, tempoEstimado,
  }
}
