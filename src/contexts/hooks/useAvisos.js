import { useState, useEffect } from 'react'
import { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../../firebase'

export function useAvisos(usuarioLogado) {
  const [avisos, setAvisos] = useState([])

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'avisos'), (snap) => {
      setAvisos(snap.docs.map(d => d.data())
        .sort((a, b) => {
          if (a.fixado && !b.fixado) return -1
          if (!a.fixado && b.fixado) return 1
          return (b.criadoEm || 0) - (a.criadoEm || 0)
        }))
    }, err => console.error('[Firestore] avisos:', err))
    return unsub
  }, [])

  async function criarAviso({ titulo, texto, tipo, fixado, destinatario }) {
    const id = `AV${Date.now()}`
    try {
      await setDoc(doc(db, 'avisos', id), {
        id, titulo, texto, tipo: tipo || 'info', fixado: !!fixado,
        destinatario: destinatario || 'todos',
        criadoEm: Date.now(), autor: usuarioLogado?.nome
      })
    } catch (e) { console.error(e) }
  }
  async function editarAviso(id, dados) {
    try { await updateDoc(doc(db, 'avisos', id), dados) } catch (e) { console.error(e) }
  }
  async function excluirAviso(id) {
    try { await deleteDoc(doc(db, 'avisos', id)) } catch (e) { console.error(e) }
  }

  return { avisos, criarAviso, editarAviso, excluirAviso }
}
