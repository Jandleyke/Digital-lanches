export const VAZIO_NUTRICIONAL = { calorias: '', proteinas: '', carboidratos: '', gorduras: '', sodio: '' }
export const ALERGENOS_PADRAO = ['gluten', 'lactose', 'amendoim', 'ovo', 'soja', 'frutos-do-mar']

export const PRODUTO_FORM_VAZIO = {
  nome: '', categoria: 'Lanches', preco: '', estoque: '', estoqueBaixo: '',
  composicao: '', foto: '', emoji: '🍔', disponivel: true,
  nutricional: { ...VAZIO_NUTRICIONAL }, alergenios: [], diasProducao: [],
}

export function produtoParaForm(produto) {
  return {
    nome: produto.nome || '',
    categoria: produto.categoria || 'Lanches',
    preco: String(produto.preco ?? ''),
    estoque: String(produto.estoque ?? ''),
    estoqueBaixo: String(produto.estoqueBaixo ?? ''),
    composicao: produto.composicao || produto.descricao || '',
    foto: produto.foto || '',
    emoji: produto.emoji || '🍔',
    disponivel: produto.disponivel !== false,
    nutricional: produto.nutricional || { ...VAZIO_NUTRICIONAL },
    alergenios: produto.alergenios || [],
    diasProducao: produto.diasCardapio || produto.diasProducao || [],
  }
}

export function formParaProduto(form) {
  return {
    nome: form.nome.trim(),
    categoria: form.categoria || 'Lanches',
    preco: Number(form.preco || 0),
    estoque: Math.max(0, Number(form.estoque || 0)),
    estoqueBaixo: Math.max(0, Number(form.estoqueBaixo || 0)),
    disponivel: !!form.disponivel,
    composicao: (form.composicao || '').trim(),
    descricao: (form.composicao || '').trim(),
    foto: form.foto || '',
    emoji: form.emoji || '🍔',
    nutricional: form.nutricional || { ...VAZIO_NUTRICIONAL },
    alergenios: form.alergenios || [],
    diasProducao: form.diasProducao || [],
    diasCardapio: form.diasProducao || [],
  }
}
