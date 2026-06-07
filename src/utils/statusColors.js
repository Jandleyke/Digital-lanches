export const STATUS_COR = {
  'Recebido':  { bg: '#FEF3C7', color: '#D97706' },
  'Pronto':    { bg: '#D1FAE5', color: '#059669' },
  'Entregue':  { bg: '#F1F5F9', color: '#64748B' },
  'Cancelado': { bg: '#FEE2E2', color: '#DC2626' },
}

// limiteMin: threshold configurado por produto. Se não definido, usa 5 como padrão mínimo.
export const estoqueNivel = (estoque, limiteMin) => {
  if (estoque <= 0) return { label: 'Sem estoque', bg: '#FEE2E2', color: '#EF4444' }
  const lim = limiteMin > 0 ? limiteMin : null
  if (lim && estoque <= lim) return { label: 'Baixo', bg: '#FEF3C7', color: '#D97706' }
  return { label: 'Normal', bg: '#D1FAE5', color: '#059669' }
}
