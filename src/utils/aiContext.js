// Monta resumos compactos (poucos KB) dos dados já carregados via useApp()
// para enviar como contexto ao assistente de IA — mantém o prompt pequeno e
// barato dentro dos limites da camada gratuita do Gemini.
import { produtoDisponivelNoDia } from './cardapioDias'

function inicioDoDia() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function ordenarPedidosRecentes(a, b) {
  return (b.criadoEm || 0) - (a.criadoEm || 0)
}

function resumirProduto(p, favorito = false, avaliacao = null) {
  return {
    id: p.id,
    nome: p.nome,
    preco: p.preco,
    categoria: p.categoria,
    descricao: p.descricao || '',
    alergenios: p.alergenios || [],
    estoque: p.estoque ?? null,
    favorito,
    avaliacaoMedia: avaliacao?.media || null,
    totalAvaliacoes: avaliacao?.total || 0,
  }
}

export function buildContextoAluno(usuarioLogado, produtos, pedidos, extras = {}) {
  const { favoritos = [], carrinho = [], tela = null, resumoAvaliacoesPorProduto = {} } = extras

  const cardapio = produtos
    .filter(p => p.disponivel && p.estoque !== 0 && produtoDisponivelNoDia(p))
    .slice(0, 30)
    .map(p => resumirProduto(p, favoritos.includes(p.id), resumoAvaliacoesPorProduto[String(p.id)]))

  const alergiasAluno = usuarioLogado?.alergias || []
  const alertasAlergia = alergiasAluno.length
    ? cardapio
        .filter(p => p.alergenios.some(a => alergiasAluno.includes(a)))
        .map(p => ({ produto: p.nome, alergenios: p.alergenios.filter(a => alergiasAluno.includes(a)) }))
    : []

  const meusPedidos = pedidos
    .filter(p => p.matricula === usuarioLogado?.matricula)
    .sort(ordenarPedidosRecentes)
    .slice(0, 5)
    .map(p => ({
      id: p.id,
      status: p.status,
      total: p.total,
      horarioRetirada: p.horarioRetirada,
      pagamento: p.pagamento,
      pago: Boolean(p.pago),
      itens: (p.itens || []).map(i => ({ nome: i.nome, quantidade: i.quantidade })),
      podeCancelar: p.status === 'Recebido',
    }))

  const favoritosNomes = produtos
    .filter(p => favoritos.includes(p.id))
    .map(p => p.nome)

  const carrinhoResumo = carrinho.map(i => ({
    id: i.id,
    nome: i.nome,
    quantidade: i.quantidade,
    subtotal: (i.preco || 0) * (i.quantidade || 0),
  }))

  return {
    aluno: { nome: usuarioLogado?.nome, alergias: usuarioLogado?.alergias || [] },
    cardapio,
    meusPedidos,
    favoritos: favoritosNomes,
    carrinho: {
      itens: carrinhoResumo,
      total: carrinhoResumo.reduce((acc, i) => acc + i.subtotal, 0),
    },
    alertasAlergia,
    telaAtual: tela,
  }
}

export function buildContextoAdmin(produtos, pedidos) {
  const inicio = inicioDoDia()
  const pedidosHoje = pedidos.filter(p => (p.criadoEm || 0) >= inicio)
  const pagosHoje = pedidosHoje.filter(p => p.pago && p.status !== 'Cancelado')

  const vendasHoje = pagosHoje.reduce((acc, p) => acc + p.total, 0)
  const ticketMedio = pagosHoje.length ? vendasHoje / pagosHoje.length : 0

  const contagemItens = {}
  pagosHoje.forEach(p => p.itens?.forEach(i => {
    contagemItens[i.nome] = (contagemItens[i.nome] || 0) + i.quantidade
  }))
  const maisVendidos = Object.entries(contagemItens)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([nome, qtd]) => ({ nome, qtd }))

  const estoqueBaixo = produtos
    .filter(p => p.estoqueBaixo > 0 && p.estoque <= p.estoqueBaixo)
    .map(p => ({ nome: p.nome, estoque: p.estoque, limite: p.estoqueBaixo }))

  const indisponiveis = produtos
    .filter(p => !p.disponivel || p.estoque <= 0)
    .map(p => ({ nome: p.nome, estoque: p.estoque ?? 0, disponivel: Boolean(p.disponivel) }))

  const avaliados = pedidos.filter(p => p.avaliacao > 0)
  const notaMedia = avaliados.length
    ? avaliados.reduce((acc, p) => acc + p.avaliacao, 0) / avaliados.length
    : null

  const statusContagem = {}
  pedidosHoje.forEach(p => {
    const status = p.status || 'Recebido'
    statusContagem[status] = (statusContagem[status] || 0) + 1
  })

  return {
    vendasHoje,
    ticketMedio,
    totalPedidosHoje: pedidosHoje.length,
    totalPagosHoje: pagosHoje.length,
    maisVendidos,
    estoqueBaixo,
    indisponiveis,
    notaMedia,
    statusContagem,
    ultimosPedidos: pedidosHoje
      .sort(ordenarPedidosRecentes)
      .slice(0, 5)
      .map(p => ({ id: p.id, status: p.status, total: p.total, pago: Boolean(p.pago), itens: (p.itens || []).map(i => i.nome) })),
  }
}
