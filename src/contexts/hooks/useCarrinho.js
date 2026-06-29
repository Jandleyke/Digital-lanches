import { useEffect, useMemo, useCallback, useRef, useReducer } from 'react'
import { carregarLS, salvarLS } from '../../utils/storage'

function ownerKey(usuarioLogado) {
  return usuarioLogado?.uid || usuarioLogado?.matricula || 'anon'
}

function storageKey(base, usuarioLogado) {
  return `${base}_${ownerKey(usuarioLogado)}`
}

export function useCarrinho(usuarioLogado) {
  const skipSaveRef = useRef(false)
  const [state, dispatch] = useReducer((atual, acao) => {
    if (acao.type === 'load') return { carrinho: acao.carrinho, favoritos: acao.favoritos }
    if (acao.type === 'setCarrinho') return { ...atual, carrinho: acao.valor }
    if (acao.type === 'setFavoritos') return { ...atual, favoritos: acao.valor }
    return atual
  }, usuarioLogado, usuario => ({
    carrinho: carregarLS(storageKey('senac_carrinho', usuario), []),
    favoritos: carregarLS(storageKey('senac_favoritos', usuario), []),
  }))

  const { carrinho, favoritos } = state
  const setCarrinho = useCallback(valor => dispatch({ type: 'setCarrinho', valor: typeof valor === 'function' ? valor(state.carrinho) : valor }), [state.carrinho])
  const setFavoritos = useCallback(valor => dispatch({ type: 'setFavoritos', valor: typeof valor === 'function' ? valor(state.favoritos) : valor }), [state.favoritos])

  useEffect(() => {
    skipSaveRef.current = true
    dispatch({
      type: 'load',
      carrinho: carregarLS(storageKey('senac_carrinho', usuarioLogado), []),
      favoritos: carregarLS(storageKey('senac_favoritos', usuarioLogado), []),
    })
  }, [usuarioLogado])

  useEffect(() => {
    if (skipSaveRef.current) {
      skipSaveRef.current = false
      return
    }
    salvarLS(storageKey('senac_favoritos', usuarioLogado), favoritos)
    salvarLS(storageKey('senac_carrinho', usuarioLogado), carrinho)
  }, [favoritos, carrinho, usuarioLogado])

  const adicionarAoCarrinho = useCallback((produto) => {
    setCarrinho(prev => {
      const estoqueDisponivel = Math.max(0, Number(produto?.estoque || 0))
      if (!produto?.disponivel || estoqueDisponivel <= 0) return prev
      const existe = prev.find(i => i.id === produto.id)
      if (existe?.quantidade >= estoqueDisponivel) return prev
      if (existe) return prev.map(i => i.id === produto.id ? { ...i, ...produto, quantidade: i.quantidade + 1 } : i)
      return [...prev, { ...produto, quantidade: 1 }]
    })
  }, [setCarrinho])

  const removerDoCarrinho = useCallback((id) => {
    setCarrinho(prev => {
      const item = prev.find(i => i.id === id)
      if (item?.quantidade > 1) return prev.map(i => i.id === id ? { ...i, quantidade: i.quantidade - 1 } : i)
      return prev.filter(i => i.id !== id)
    })
  }, [setCarrinho])

  const limparCarrinho = useCallback(() => setCarrinho([]), [setCarrinho])

  const toggleFavorito = useCallback((id) => {
    setFavoritos(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id])
  }, [setFavoritos])

  const totalCarrinho = useMemo(() => carrinho.reduce((acc, i) => acc + i.preco * i.quantidade, 0), [carrinho])
  const qtdCarrinho = useMemo(() => carrinho.reduce((acc, i) => acc + i.quantidade, 0), [carrinho])

  return {
    carrinho, setCarrinho, adicionarAoCarrinho, removerDoCarrinho, limparCarrinho, totalCarrinho, qtdCarrinho,
    favoritos, toggleFavorito,
  }
}
