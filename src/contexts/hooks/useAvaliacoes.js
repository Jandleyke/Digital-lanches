import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebase'

export function useAvaliacoes(usuarioLogado) {
  const [avaliacoes, setAvaliacoes] = useState([])

  useEffect(() => {
    if (!usuarioLogado) return
    return onSnapshot(collection(db, 'avaliacoes'), snap => {
      setAvaliacoes(snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0)))
    }, err => console.error('[Firestore] avaliacoes:', err))
  }, [usuarioLogado])

  const resumoPorProduto = useMemo(() => {
    const mapa = {}
    avaliacoes.forEach(avaliacao => {
      const id = String(avaliacao.produtoId || '')
      if (!id || !Number(avaliacao.nota)) return
      if (!mapa[id]) mapa[id] = { media: 0, total: 0, comentarios: [] }
      mapa[id].media += Number(avaliacao.nota)
      mapa[id].total += 1
      if (avaliacao.comentario) mapa[id].comentarios.push(avaliacao)
    })
    Object.values(mapa).forEach(item => {
      item.media = item.total ? item.media / item.total : 0
      item.comentarios = item.comentarios.slice(0, 6)
    })
    return mapa
  }, [avaliacoes])

  return { avaliacoes, resumoPorProduto }
}
