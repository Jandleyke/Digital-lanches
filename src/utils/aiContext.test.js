import { describe, it, expect } from 'vitest'
import { buildContextoAluno, buildContextoAdmin } from './aiContext'

const usuario = { matricula: '111', nome: 'Ana', alergias: ['amendoim'] }

const produtos = [
  { id: 1, nome: 'Coxinha', preco: 7, categoria: 'Salgados', alergenios: ['amendoim'], disponivel: true, estoque: 2, estoqueBaixo: 5 },
  { id: 2, nome: 'Suco de Laranja', preco: 5, categoria: 'Bebidas', alergenios: [], disponivel: true, estoque: 20, estoqueBaixo: 5 },
  { id: 3, nome: 'Esfirra Indisponível', preco: 6, categoria: 'Salgados', alergenios: [], disponivel: false, estoque: 0, estoqueBaixo: 5 },
]

const agora = Date.now()
const pedidos = [
  { id: 'P1', matricula: '111', status: 'Pronto', total: 12, horarioRetirada: '10:00', criadoEm: agora, pago: true, avaliacao: 5, itens: [{ nome: 'Coxinha', quantidade: 2 }] },
  { id: 'P2', matricula: '999', status: 'Recebido', total: 8, horarioRetirada: '11:00', criadoEm: agora, pago: true, avaliacao: 0, itens: [{ nome: 'Suco de Laranja', quantidade: 1 }] },
  { id: 'P3', matricula: '111', status: 'Entregue', total: 5, horarioRetirada: '09:00', criadoEm: agora - 26 * 60 * 60 * 1000, pago: true, avaliacao: 4, itens: [{ nome: 'Suco de Laranja', quantidade: 1 }] },
]

describe('buildContextoAluno', () => {
  it('inclui apenas produtos disponíveis', () => {
    const ctx = buildContextoAluno(usuario, produtos, pedidos)
    expect(ctx.cardapio.map(p => p.nome)).toEqual(['Coxinha', 'Suco de Laranja'])
  })

  it('limita o cardápio a 30 itens', () => {
    const muitos = Array.from({ length: 35 }, (_, i) => ({ id: i, nome: `Item ${i}`, preco: 1, categoria: 'X', alergenios: [], disponivel: true }))
    const ctx = buildContextoAluno(usuario, muitos, [])
    expect(ctx.cardapio.length).toBe(30)
  })

  it('inclui apenas os pedidos do próprio aluno, no máximo 5', () => {
    const ctx = buildContextoAluno(usuario, produtos, pedidos)
    expect(ctx.meusPedidos.length).toBe(2)
    expect(ctx.meusPedidos.every(p => p.itens)).toBe(true)
  })

  it('inclui dados básicos do aluno', () => {
    const ctx = buildContextoAluno(usuario, produtos, pedidos)
    expect(ctx.aluno).toEqual({ nome: 'Ana', alergias: ['amendoim'] })
  })

  it('marca quais pedidos podem ser cancelados e inclui o id', () => {
    const ctx = buildContextoAluno(usuario, produtos, pedidos)
    expect(ctx.meusPedidos[0]).toMatchObject({ id: 'P1', podeCancelar: false })
    expect(ctx.meusPedidos[1]).toMatchObject({ id: 'P3', podeCancelar: false })
  })

  it('resume favoritos, carrinho e tela atual a partir de extras', () => {
    const ctx = buildContextoAluno(usuario, produtos, pedidos, {
      favoritos: [1, 3],
      carrinho: [{ id: 2, nome: 'Suco de Laranja', quantidade: 2, preco: 5 }],
      tela: { pagina: 'Carrinho' },
    })
    expect(ctx.favoritos).toEqual(['Coxinha', 'Esfirra Indisponível'])
    expect(ctx.carrinho).toEqual({
      itens: [{ id: 2, nome: 'Suco de Laranja', quantidade: 2, subtotal: 10 }],
      total: 10,
    })
    expect(ctx.telaAtual).toEqual({ pagina: 'Carrinho' })
  })

  it('destaca produtos com alergias do aluno', () => {
    const ctx = buildContextoAluno(usuario, produtos, pedidos)
    expect(ctx.alertasAlergia).toEqual([{ produto: 'Coxinha', alergenios: ['amendoim'] }])
  })
})

describe('buildContextoAdmin', () => {
  it('soma vendas e calcula ticket médio do dia', () => {
    const ctx = buildContextoAdmin(produtos, pedidos)
    expect(ctx.vendasHoje).toBe(20)
    expect(ctx.ticketMedio).toBe(10)
    expect(ctx.totalPedidosHoje).toBe(2)
  })

  it('lista os produtos mais vendidos, no máximo 5', () => {
    const ctx = buildContextoAdmin(produtos, pedidos)
    expect(ctx.maisVendidos[0]).toEqual({ nome: 'Coxinha', qtd: 2 })
    expect(ctx.maisVendidos.length).toBeLessThanOrEqual(5)
  })

  it('identifica produtos com estoque baixo', () => {
    const ctx = buildContextoAdmin(produtos, pedidos)
    expect(ctx.estoqueBaixo).toEqual([
      { nome: 'Coxinha', estoque: 2, limite: 5 },
      { nome: 'Esfirra Indisponível', estoque: 0, limite: 5 },
    ])
    expect(ctx.indisponiveis).toEqual([{ nome: 'Esfirra Indisponível', estoque: 0, disponivel: false }])
  })

  it('calcula a nota média a partir dos pedidos avaliados', () => {
    const ctx = buildContextoAdmin(produtos, pedidos)
    expect(ctx.notaMedia).toBeCloseTo(4.5)
  })
})
