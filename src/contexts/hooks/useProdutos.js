import { useState, useEffect } from 'react'
import { collection, doc, onSnapshot, setDoc, deleteDoc, writeBatch } from 'firebase/firestore'
import { db } from '../../firebase'
import { notificarPush } from '../../utils/notificarPush'

export function useProdutos(usuarioLogado) {
  const [produtos, setProdutos] = useState([])

  useEffect(() => {
    if (!usuarioLogado) return
    let unsub = () => {}
    try {
      unsub = onSnapshot(collection(db, 'produtos'), (snap) => {
        setProdutos(snap.docs.map(d => d.data()).sort((a, b) => (a.id || 0) - (b.id || 0)))
      }, err => console.error('[Firestore] produtos:', err))
    } catch (e) {
      console.error('[Firestore] produtos init:', e)
    }
    return unsub
  }, [usuarioLogado])

  async function atualizarProduto(produto) {
    const anterior = produtos.find(p => String(p.id) === String(produto.id))
    try {
      await setDoc(doc(db, 'produtos', String(produto.id)), produto)
      const limite = Number(produto.estoqueBaixo || 0)
      if (limite > 0 && Number(produto.estoque) <= limite && Number(anterior?.estoque ?? produto.estoque) > limite) {
        const mensagem = `${produto.nome}: ${produto.estoque} un restante(s).`
        notificarPush({ destino: 'admin', titulo: 'Estoque baixo', mensagem, url: '/admin/estoque' })
        notificarPush({ destino: 'vendedor', titulo: 'Estoque baixo', mensagem, url: '/vendedor' })
      }
    } catch (e) { console.error(e) }
  }
  async function adicionarProduto(produto) {
    const id = Date.now()
    try { await setDoc(doc(db, 'produtos', String(id)), { ...produto, id }) } catch (e) { console.error(e) }
  }
  async function adicionarProdutos(novosProdutos) {
    const batch = writeBatch(db)
    const base = Date.now()
    novosProdutos.forEach((produto, index) => {
      const id = produto.id || base + index
      batch.set(doc(db, 'produtos', String(id)), { ...produto, id })
    })
    await batch.commit()
  }
  async function removerProduto(id) {
    await deleteDoc(doc(db, 'produtos', String(id)))
  }
  async function removerProdutos(ids) {
    await Promise.all(ids.map(id => deleteDoc(doc(db, 'produtos', String(id)))))
  }

  return { produtos, atualizarProduto, adicionarProduto, adicionarProdutos, removerProduto, removerProdutos }
}
