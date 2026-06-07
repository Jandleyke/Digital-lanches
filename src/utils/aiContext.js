// Monta resumos compactos (poucos KB) dos dados já carregados via useApp()
// para enviar como contexto ao assistente de IA — mantém o prompt pequeno e
// barato dentro dos limites da camada gratuita do Gemini.

function inicioDoDia() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function buildContextoAluno(usuarioLogado, produtos, pedidos, extras = {}) {
  const cardapio = produtos
    .filter(p => p.disponivel)
    .slice(0, 15)
    .map(p => ({ nome: p.nome, preco: p.preco, categoria: p.categoria, alergenios: p.alergenios || [] }))

  const meusPedidos = pedidos
    .filter(p => p.matricula === usuarioLogado?.matricula)
    .slice(0, 3)
    .map(p => ({
      id: p.id,
      status: p.status,
      total: p.total,
      horarioRetirada: p.horarioRetirada,
      itens: (p.itens || []).map(i => i.nome),
      podeCancelar: p.status === 'Recebido',
    }))

  const { favoritos = [], carrinho = [], tela = null } = extras

  const favoritosNomes = produtos
    .filter(p => favoritos.includes(p.id))
    .map(p => p.nome)

  const carrinhoResumo = carrinho.map(i => ({ nome: i.nome, quantidade: i.quantidade }))

  return {
    aluno: { nome: usuarioLogado?.nome, alergias: usuarioLogado?.alergias || [] },
    cardapio,
    meusPedidos,
    favoritos: favoritosNomes,
    carrinho: carrinhoResumo,
    telaAtual: tela,
  }
}

export function buildContextoAdmin(produtos, pedidos) {
  const inicio = inicioDoDia()
  const pedidosHoje = pedidos.filter(p => (p.criadoEm || 0) >= inicio)
  const pagosHoje = pedidosHoje.filter(p => p.pago)

  const vendasHoje = pagosHoje.reduce((acc, p) => acc + p.total, 0)
  const ticketMedio = pagosHoje.length ? vendasHoje / pagosHoje.length : 0

  const contagemItens = {}
  pedidosHoje.forEach(p => p.itens?.forEach(i => {
    contagemItens[i.nome] = (contagemItens[i.nome] || 0) + i.quantidade
  }))
  const maisVendidos = Object.entries(contagemItens)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([nome, qtd]) => ({ nome, qtd }))

  const estoqueBaixo = produtos
    .filter(p => p.estoqueBaixo > 0 && p.estoque <= p.estoqueBaixo)
    .map(p => ({ nome: p.nome, estoque: p.estoque }))

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
    maisVendidos,
    estoqueBaixo,
    notaMedia,
    statusContagem,
  }
}
