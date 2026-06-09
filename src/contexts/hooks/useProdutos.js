import { useState, useEffect } from 'react'
import { collection, doc, onSnapshot, setDoc, deleteDoc, writeBatch } from 'firebase/firestore'
import { db } from '../../firebase'

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
    try { await setDoc(doc(db, 'produtos', String(produto.id)), produto) } catch (e) { console.error(e) }
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
