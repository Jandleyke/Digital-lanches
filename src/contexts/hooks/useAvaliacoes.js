import { useEffect, useMemo, useState, useCallback } from 'react'
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore'
import { db } from '../../firebase'

export function useAvaliacoes(usuarioLogado) {
  const [avaliacoes, setAvaliacoes] = useState([])
  const idUsuario = usuarioLogado?.uid || usuarioLogado?.matricula || ''

  const buscarAvaliacoes = useCallback(async () => {
    if (!idUsuario) return
    try {
      const q = query(collection(db, 'avaliacoes'), orderBy('criadoEm', 'desc'), limit(300))
      const snap = await getDocs(q)
      setAvaliacoes(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (err) {
      console.error('[Firestore] avaliacoes:', err)
    }
  }, [idUsuario])

  useEffect(() => {
    const timer = window.setTimeout(buscarAvaliacoes, 0)
    return () => window.clearTimeout(timer)
  }, [buscarAvaliacoes])

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

  return { avaliacoes, resumoPorProduto, refetchAvaliacoes: buscarAvaliacoes }
}
