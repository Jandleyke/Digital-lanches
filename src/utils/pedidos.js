const DIAS_SEMANA = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado']

export const JANELA_PEDIDO_MS = 10 * 60 * 1000

function statusNormalizadoPedido(pedido) {
  return String(pedido?.status || pedido?.statusKey || '').trim().toLocaleLowerCase('pt-BR')
}

export function pedidoNoFiltroStatus(pedido, filtro = 'todos') {
  const status = statusNormalizadoPedido(pedido)
  if (filtro === 'todos') return true
  if (filtro === 'pendentes') return !['entregue', 'cancelado', 'finalizado', 'concluído', 'concluido'].includes(status)
  if (filtro === 'entregues') return ['entregue', 'finalizado', 'concluído', 'concluido'].includes(status)
  if (filtro === 'cancelados') return status === 'cancelado'
  return true
}

export function dataIsoLocal(valor = Date.now()) {
  const data = valor?.toDate ? valor.toDate() : new Date(valor)
  if (Number.isNaN(data.getTime())) return null
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

export function pedidoConcluido(pedido) {
  const status = statusNormalizadoPedido(pedido)
  return ['entregue', 'finalizado', 'concluído', 'concluido'].includes(status)
}

export function quantidadesVendidasPorProduto(pedidos = []) {
  return pedidos.filter(pedidoConcluido).reduce((quantidades, pedido) => {
    const itens = pedido.itens || []
    itens.forEach(item => {
      const produtoId = item.produtoId || item.id
      if (!produtoId) return
      const chave = String(produtoId)
      quantidades[chave] = (quantidades[chave] || 0) + Number(item.quantidade || 1)
    })
    return quantidades
  }, {})
}

export function idsCompradosEmPedidosConcluidos(pedidos = [], matricula = '') {
  const matriculaNormalizada = String(matricula || '').trim()
  const ids = pedidos
    .filter(pedido => pedidoConcluido(pedido) && String(pedido.matricula || '').trim() === matriculaNormalizada)
    .flatMap(pedido => (pedido.itens || []).map(item => item.produtoId || item.id).filter(Boolean))
  return [...new Set(ids)]
}

export function pedidoIdDoQr(valor) {
  const resultado = /^SENAC-LANCHES:(.+)$/i.exec(String(valor || '').trim())
  return resultado?.[1]?.trim() || null
}

export function encontrarPedidoPorQr(valor, pedidos = []) {
  const pedidoId = pedidoIdDoQr(valor)
  if (!pedidoId) return null
  return pedidos.find(pedido => String(pedido?.id || '') === pedidoId) || null
}

export function matriculaParaRetirada(pedido, usuario) {
  return String(pedido?.matricula || usuario?.matricula || '').trim()
}

export function encontrarItemSemEstoque(carrinho = [], produtos = []) {
  return carrinho.find(item => {
    const produto = produtos.find(prod => prod.id === item.id)
    return !produto || Number(produto.estoque || 0) < Number(item.quantidade || 0)
  }) || null
}

export function estoqueAposVenda(estoqueAtual, quantidade) {
  return Math.max(0, Number(estoqueAtual || 0) - Number(quantidade || 0))
}

export function estoqueAposCancelamento(estoqueAtual, quantidade) {
  return Number(estoqueAtual || 0) + Number(quantidade || 0)
}

export function dadosPagamentoNaEntrega(pedido, entregueEm) {
  const formaPagamento = String(pedido?.formaPagamento || pedido?.pagamento || '').trim().toLocaleLowerCase('pt-BR')
  if (formaPagamento === 'conta do professor') {
    return { pago: false, pagamentoStatus: 'pendente', pagoEm: null }
  }
  return { pago: true, pagamentoStatus: 'pago', pagoEm: entregueEm }
}

export function quantidadesPorProduto(itens = []) {
  return itens.reduce((quantidades, item) => {
    const produtoId = item.produtoId || item.id
    if (!produtoId) return quantidades
    const chave = String(produtoId)
    quantidades[chave] = (quantidades[chave] || 0) + Number(item.quantidade || 0)
    return quantidades
  }, {})
}

export function calcularEstoqueAposEdicao(estoqueAtual, quantidadeAntes, quantidadeDepois) {
  const calculado = Number(estoqueAtual || 0) + Number(quantidadeAntes || 0) - Number(quantidadeDepois || 0)
  return { valido: calculado >= 0, estoque: Math.max(0, calculado) }
}

export function codigoPedido(pedido) {
  const numero = Number(
    pedido?.numero ||
    pedido?.numeroPedido ||
    pedido?.sequencia ||
    pedido?.ordem ||
    pedido?.codigo
  )
  if (Number.isInteger(numero) && numero > 0) {
    return String(numero).padStart(4, '0')
  }

  const codigoSalvo = String(pedido?.pedidoCodigo || '').replace(/\D/g, '')
  if (codigoSalvo.length >= 4) return codigoSalvo.slice(-4)

  const digitos = String(pedido?.id || pedido?.pedidoId || '').replace(/\D/g, '')
  if (digitos) return digitos.slice(-4).padStart(4, '0')

  return '0001'
}

export function codigoPedidoAntigo(pedido) {
  const numero = Number(pedido?.numero)
  if (Number.isInteger(numero) && numero > 0) {
    return String(numero).padStart(4, '0').slice(-4)
  }

  const digitos = String(pedido?.id || '').replace(/\D/g, '')
  return (digitos.slice(-4) || '0000').padStart(4, '0')
}

export function chaveDiariaPedido(timestamp = Date.now()) {
  const data = new Date(timestamp)
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${ano}${mes}${dia}`
}

export function horarioRetiradaParaTimestamp(horario, referencia = Date.now()) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(horario || ''))
  if (!match) return null
  const horas = Number(match[1])
  const minutos = Number(match[2])
  if (horas > 23 || minutos > 59) return null

  const data = new Date(referencia)
  data.setHours(horas, minutos, 0, 0)
  return data.getTime()
}

export function inicioContagemPedido(pedido) {
  const criadoEm = Number(pedido?.criadoEm || 0)
  const retiradaEm = Number(pedido?.horarioRetiradaEm)
    || horarioRetiradaParaTimestamp(pedido?.horarioRetirada, criadoEm || Date.now())
    || 0
  return Math.max(criadoEm, retiradaEm)
}

export function pedidoAntesDaRetirada(pedido, agora = Date.now()) {
  const inicio = inicioContagemPedido(pedido)
  return inicio > 0 && agora < inicio
}

export function compararPedidosFila(a, b) {
  const dataA = Number(a?.criadoEm || 0)
  const dataB = Number(b?.criadoEm || 0)
  const diaA = chaveDiariaPedido(dataA)
  const diaB = chaveDiariaPedido(dataB)
  if (diaA !== diaB) return dataA - dataB

  const numeroA = Number(a?.numero)
  const numeroB = Number(b?.numero)
  if (Number.isFinite(numeroA) && Number.isFinite(numeroB) && numeroA !== numeroB) return numeroA - numeroB
  return dataA - dataB
}

function horarioParaMinutos(horario) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(horario || ''))
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

export function validarHorarioRetirada(horario, configuracao = {}, agora = Date.now()) {
  const horarioEm = horarioRetiradaParaTimestamp(horario, agora)
  if (!horarioEm) return { valido: false, mensagem: 'Selecione um horário válido para retirada.' }
  if (horarioEm < agora - 60 * 1000) {
    return { valido: false, mensagem: 'O horário selecionado para retirada já passou. Escolha um horário futuro.' }
  }

  const dias = configuracao.diasFuncionamento || []
  const diaAtual = DIAS_SEMANA[new Date(agora).getDay()]
  if (dias.length > 0 && !dias.includes(diaAtual)) {
    return { valido: false, mensagem: 'A lanchonete não está aberta para retirada neste dia.' }
  }

  const selecionado = horarioParaMinutos(horario)
  const abertura = horarioParaMinutos(configuracao.horarioAbertura)
  const fechamento = horarioParaMinutos(configuracao.horarioFechamento)
  if ((abertura !== null && selecionado < abertura) || (fechamento !== null && selecionado > fechamento)) {
    const faixa = abertura !== null && fechamento !== null
      ? ` entre ${configuracao.horarioAbertura} e ${configuracao.horarioFechamento}`
      : ''
    return { valido: false, mensagem: `Escolha um horário de retirada dentro do funcionamento da lanchonete${faixa}.` }
  }

  return { valido: true, horarioEm }
}
