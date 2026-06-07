export const formatPrice = v => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`
export const formatDate = ts => new Date(ts).toLocaleDateString('pt-BR')
export const formatTime = ts => new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
