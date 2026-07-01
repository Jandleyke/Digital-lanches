export function normalizarStatusProducao(status) {
  return String(status || '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function visualStatusProducao(status) {
  const normal = normalizarStatusProducao(status)
  if (normal === 'planejado') return { label: 'Planejado', bg: '#E0F2FE', color: '#075985', border: '#38BDF8' }
  if (normal === 'em producao') return { label: 'Em produção', bg: '#FEF3C7', color: '#92400E', border: '#F59E0B' }
  if (normal === 'pronto para venda') return { label: 'Pronto para venda', bg: '#DCFCE7', color: '#166534', border: '#22C55E' }
  if (normal === 'parcialmente pronto') return { label: 'Parcialmente pronto', bg: '#F5F3FF', color: '#6D28D9', border: '#8B5CF6' }
  if (normal === 'esgotado') return { label: 'Esgotado', bg: '#FEE2E2', color: '#B91C1C', border: '#EF4444' }
  if (normal === 'cancelado') return { label: 'Cancelado', bg: '#E2E8F0', color: '#475569', border: '#94A3B8' }
  return { label: status || 'Não informado', bg: '#F1F5F9', color: '#475569', border: '#CBD5E1' }
}

export function statusProducaoLiberaVenda(status) {
  return ['pronto para venda', 'parcialmente pronto'].includes(normalizarStatusProducao(status))
}

export function producaoDisponivelParaVenda(item = {}) {
  return statusProducaoLiberaVenda(item.status)
    && item.estoqueLiberado !== false
    && Number(item.quantidadeRestante || 0) > 0
}

export function produtoEhBebida(produto = {}) {
  return String(produto?.categoria || '').trim().toLowerCase() === 'bebidas'
}

export function produtoArquivado(produto = {}) {
  return produto?.arquivado === true || produto?.statusCadastro === 'arquivado'
}

export function producoesDisponiveisDoProduto(producaoHoje = [], produtoId) {
  return (producaoHoje || [])
    .filter(item => String(item.produtoId) === String(produtoId))
    .filter(producaoDisponivelParaVenda)
    .sort((a, b) => Number(b.quantidadeRestante || 0) - Number(a.quantidadeRestante || 0))
}

export function quantidadeDisponivelNoCardapio(producaoHoje = [], produtoId) {
  return producoesDisponiveisDoProduto(producaoHoje, produtoId)
    .reduce((total, item) => total + Math.max(0, Number(item.quantidadeRestante || 0)), 0)
}

function dataLocalISO(referencia = Date.now()) {
  const data = new Date(referencia)
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

export function produtoLiberadoManualHoje(produto, referencia = Date.now()) {
  if (!produto || produtoArquivado(produto) || !produtoEhBebida(produto)) return false
  if (produto.disponivel === false) return false
  if (produto.cardapioManualHoje !== true) return false
  return produto.cardapioManualData === dataLocalISO(referencia)
}

export function produtoDisponivelParaCardapioDia(produto, producaoHoje = []) {
  if (!produto || produtoArquivado(produto)) return null
  const estoqueProduto = Math.max(0, Number(produto.estoque || 0))
  const liberadoManual = produtoLiberadoManualHoje(produto)

  if (liberadoManual) {
    if (estoqueProduto <= 0) return null
    return {
      ...produto,
      disponivel: true,
      estoque: estoqueProduto,
      estoqueProducaoDia: 0,
      producaoDiaIds: [],
      cardapioManual: true,
    }
  }

  const producoes = producoesDisponiveisDoProduto(producaoHoje, produto.id)
  const quantidadeProducao = producoes.reduce((total, item) => total + Math.max(0, Number(item.quantidadeRestante || 0)), 0)
  if (quantidadeProducao <= 0) return null
  const estoque = Math.min(estoqueProduto || quantidadeProducao, quantidadeProducao)
  if (estoque <= 0) return null
  return {
    ...produto,
    disponivel: true,
    estoque,
    estoqueProducaoDia: quantidadeProducao,
    producaoDiaIds: producoes.map(item => item.id).filter(Boolean),
  }
}

export function normalizarProducao(item = {}) {
  const quantidadePronta = Number(item.quantidadePronta || 0)
  const quantidadeVendida = Number(item.quantidadeVendida || 0)
  const quantidadeDesperdicada = Number(item.quantidadeDesperdicada || 0)
  return {
    ...item,
    quantidadePlanejada: Number(item.quantidadePlanejada || 0),
    quantidadeEmProducao: Number(item.quantidadeEmProducao || 0),
    quantidadePronta,
    quantidadeVendida,
    quantidadeDesperdicada,
    historicoDesperdicio: Array.isArray(item.historicoDesperdicio) ? item.historicoDesperdicio : [],
    quantidadeRestante: Math.max(0, quantidadePronta - quantidadeVendida - quantidadeDesperdicada),
  }
}

export function maxDesperdicio(item) {
  if (!item) return 0
  const restante = Number(item.quantidadeRestante || 0)
  if (restante > 0) return restante
  const base = Math.max(Number(item.quantidadePlanejada || 0), Number(item.quantidadeEmProducao || 0))
  return Math.max(0, base - Number(item.quantidadeDesperdicada || 0))
}

export function dadosParaStatusProducao(item, status, ehHoje = false) {
  const dados = { status }
  if (status === 'Em producao') dados.quantidadeEmProducao = item.quantidadeEmProducao || item.quantidadePlanejada || 0
  if (status === 'Pronto para venda') dados.quantidadePronta = item.quantidadePronta || item.quantidadePlanejada || item.quantidadeEmProducao || 0
  if (status === 'Esgotado') dados.quantidadePronta = 0
  if (ehHoje && ['Pronto para venda', 'Parcialmente pronto'].includes(status)) dados.estoqueLiberado = true
  return dados
}

export function calcularDesperdicio(atual, quantidade) {
  const qtd = Math.max(0, Number(quantidade || 0))
  return {
    quantidade: qtd,
    quantidadeDesperdicada: Number(atual?.quantidadeDesperdicada || 0) + qtd,
    quantidadeRestante: Math.max(0, Number(atual?.quantidadeRestante || 0) - qtd),
  }
}

export function calcularAjusteProducao(atual, novaQuantidade, novoStatus) {
  const quantidadeAnterior = Number(atual?.quantidadeRestante || 0)
  const quantidadeNova = Math.max(0, Number(novaQuantidade ?? quantidadeAnterior))
  const statusAnterior = atual?.status || 'Planejado'
  const statusNovo = novoStatus || statusAnterior
  const quantidadePronta = quantidadeNova
    + Number(atual?.quantidadeVendida || 0)
    + Number(atual?.quantidadeDesperdicada || 0)
  return { quantidadeAnterior, quantidadeNova, quantidadePronta, statusAnterior, statusNovo }
}
