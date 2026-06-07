import { useState, useEffect } from 'react'
import { collection, doc, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../../firebase'

export function useProdutos() {
  const [produtos, setProdutos] = useState([])

  useEffect(() => {
    let unsub = () => {}
    try {
      unsub = onSnapshot(collection(db, 'produtos'), (snap) => {
        setProdutos(snap.docs.map(d => d.data()).sort((a, b) => (a.id || 0) - (b.id || 0)))
      }, err => console.error('[Firestore] produtos:', err))
    } catch (e) {
      console.error('[Firestore] produtos init:', e)
    }
    return unsub
  }, [])

  async function atualizarProduto(produto) {
    try { await setDoc(doc(db, 'produtos', String(produto.id)), produto) } catch (e) { console.error(e) }
  }
  async function adicionarProduto(produto) {
    const id = Date.now()
    try { await setDoc(doc(db, 'produtos', String(id)), { ...produto, id }) } catch (e) { console.error(e) }
  }
  async function removerProduto(id) {
    await deleteDoc(doc(db, 'produtos', String(id)))
  }
  async function removerProdutos(ids) {
    await Promise.all(ids.map(id => deleteDoc(doc(db, 'produtos', String(id)))))
  }

  return { produtos, atualizarProduto, adicionarProduto, removerProduto, removerProdutos }
}
