import { describe, expect, it } from 'vitest'
import {
  calcularAjusteProducao,
  calcularDesperdicio,
  dadosParaStatusProducao,
  maxDesperdicio,
  normalizarProducao,
  normalizarStatusProducao,
  produtoLiberadoManualHoje,
  produtoDisponivelParaCardapioDia,
} from './producao'

describe('ciclo da produção', () => {
  it('percorre planejamento, produção e liberação para venda', () => {
    const planejado = normalizarProducao({ quantidadePlanejada: 10, status: 'Planejado' })
    const emProducao = normalizarProducao({
      ...planejado,
      ...dadosParaStatusProducao(planejado, 'Em producao'),
    })
    const pronto = normalizarProducao({
      ...emProducao,
      ...dadosParaStatusProducao(emProducao, 'Pronto para venda', true),
    })

    expect(emProducao.quantidadeEmProducao).toBe(10)
    expect(pronto.quantidadePronta).toBe(10)
    expect(pronto.quantidadeRestante).toBe(10)
    expect(pronto.estoqueLiberado).toBe(true)
  })

  it('desconta vendas e desperdício sem permitir quantidade restante negativa', () => {
    const pronto = normalizarProducao({ quantidadePronta: 10, quantidadeVendida: 2, quantidadeDesperdicada: 3 })
    expect(pronto.quantidadeRestante).toBe(5)

    const desperdicio = calcularDesperdicio(pronto, 8)
    expect(desperdicio.quantidadeDesperdicada).toBe(11)
    expect(desperdicio.quantidadeRestante).toBe(0)
    expect(normalizarProducao({ quantidadePronta: 2, quantidadeVendida: 5 }).quantidadeRestante).toBe(0)
  })

  it('zera a quantidade pronta quando o produto é marcado como esgotado', () => {
    expect(dadosParaStatusProducao({ quantidadePronta: 7 }, 'Esgotado')).toEqual({
      status: 'Esgotado',
      quantidadePronta: 0,
    })
  })
})

describe('regras auxiliares da produção', () => {
  it('normaliza status com acentos', () => {
    expect(normalizarStatusProducao('  Em Produção ')).toBe('em producao')
  })

  it('limita desperdício ao que ainda pode ser registrado pela interface', () => {
    expect(maxDesperdicio({ quantidadeRestante: 4 })).toBe(4)
    expect(maxDesperdicio({ quantidadePlanejada: 10, quantidadeDesperdicada: 3 })).toBe(7)
  })

  it('recalcula quantidade pronta em ajustes do vendedor', () => {
    expect(calcularAjusteProducao({ quantidadeRestante: 5, quantidadeVendida: 2, quantidadeDesperdicada: 1, status: 'Pronto para venda' }, 8, 'Parcialmente pronto')).toEqual({
      quantidadeAnterior: 5,
      quantidadeNova: 8,
      quantidadePronta: 11,
      statusAnterior: 'Pronto para venda',
      statusNovo: 'Parcialmente pronto',
    })
  })

  it('libera produto no cardapio somente com producao pronta e quantidade restante', () => {
    const produto = { id: 'coxinha', nome: 'Coxinha', disponivel: true, estoque: 30 }
    const producaoHoje = [
      { id: 'pd1', produtoId: 'coxinha', status: 'Pronto para venda', estoqueLiberado: true, quantidadeRestante: 12 },
      { id: 'pd2', produtoId: 'suco', status: 'Pronto para venda', estoqueLiberado: true, quantidadeRestante: 8 },
    ]

    expect(produtoDisponivelParaCardapioDia(produto, producaoHoje)).toMatchObject({
      id: 'coxinha',
      estoque: 12,
      estoqueProducaoDia: 12,
      producaoDiaIds: ['pd1'],
    })
    expect(produtoDisponivelParaCardapioDia({ ...produto, disponivel: false }, producaoHoje)).toBeNull()
    expect(produtoDisponivelParaCardapioDia(produto, [{ ...producaoHoje[0], quantidadeRestante: 0 }])).toBeNull()
  })

  it('tambem libera produto no cardapio por acao manual em lote', () => {
    const hoje = new Date()
    const dataHoje = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`
    const produto = {
      id: 'agua',
      nome: 'Agua',
      disponivel: true,
      estoque: 7,
      cardapioManualHoje: true,
      cardapioManualData: dataHoje,
    }

    expect(produtoLiberadoManualHoje(produto)).toBe(true)
    expect(produtoDisponivelParaCardapioDia(produto, [])).toMatchObject({
      id: 'agua',
      estoque: 7,
      estoqueProducaoDia: 0,
      producaoDiaIds: [],
      cardapioManual: true,
    })
  })
})
