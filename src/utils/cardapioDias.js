export const DIAS_CARDAPIO = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo']

export const DIAS_LABEL = {
  segunda: 'Segunda',
  terca: 'Terca',
  quarta: 'Quarta',
  quinta: 'Quinta',
  sexta: 'Sexta',
  sabado: 'Sabado',
  domingo: 'Domingo',
}

const DIA_ATUAL = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado']

export function diaDaSemanaAtual() {
  return DIA_ATUAL[new Date().getDay()]
}

export function diasProduto(produto) {
  const dias = produto?.diasCardapio || produto?.diasProducao || produto?.dias || produto?.cardapioSemanal
  if (Array.isArray(dias)) return dias
  if (typeof dias === 'string') return dias.split(',').map(dia => dia.trim()).filter(Boolean)
  return []
}

export function produtoDisponivelNoDia(produto, dia = diaDaSemanaAtual()) {
  const dias = diasProduto(produto)
  return dias.length === 0 || dias.includes(dia)
}

export function resumoDiasProduto(produto) {
  const dias = diasProduto(produto)
  if (dias.length === 0) return 'Todos os dias'
  return dias.map(dia => DIAS_LABEL[dia] || dia).join(', ')
}
