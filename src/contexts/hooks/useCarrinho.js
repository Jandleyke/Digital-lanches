import { useState, useEffect, useMemo, useCallback } from 'react'
import { carregarLS, salvarLS } from '../../utils/storage'

export function useCarrinho() {
  const [carrinho, setCarrinho] = useState(() => carregarLS('senac_carrinho', []))
  const [favoritos, setFavoritos] = useState(() => carregarLS('senac_favoritos', []))

  useEffect(() => { salvarLS('senac_favoritos', favoritos) }, [favoritos])
  useEffect(() => { salvarLS('senac_carrinho', carrinho) }, [carrinho])

  const adicionarAoCarrinho = useCallback((produto) => {
    setCarrinho(prev => {
      const existe = prev.find(i => i.id === produto.id)
      if (existe) return prev.map(i => i.id === produto.id ? { ...i, quantidade: i.quantidade + 1 } : i)
      return [...prev, { ...produto, quantidade: 1 }]
    })
  }, [])

  const removerDoCarrinho = useCallback((id) => {
    setCarrinho(prev => {
      const item = prev.find(i => i.id === id)
      if (item?.quantidade > 1) return prev.map(i => i.id === id ? { ...i, quantidade: i.quantidade - 1 } : i)
      return prev.filter(i => i.id !== id)
    })
  }, [])

  const limparCarrinho = useCallback(() => setCarrinho([]), [])

  const toggleFavorito = useCallback((id) => {
    setFavoritos(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id])
  }, [])

  const totalCarrinho = useMemo(() => carrinho.reduce((acc, i) => acc + i.preco * i.quantidade, 0), [carrinho])
  const qtdCarrinho = useMemo(() => carrinho.reduce((acc, i) => acc + i.quantidade, 0), [carrinho])

  return {
    carrinho, setCarrinho, adicionarAoCarrinho, removerDoCarrinho, limparCarrinho, totalCarrinho, qtdCarrinho,
    favoritos, toggleFavorito,
  }
}
