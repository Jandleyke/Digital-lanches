import { describe, expect, it } from 'vitest'
import {
  calcularEstoqueAposEdicao,
  chaveDiariaPedido,
  codigoPedido,
  compararPedidosFila,
  dadosPagamentoNaEntrega,
  dataIsoLocal,
  encontrarItemSemEstoque,
  encontrarPedidoPorQr,
  estoqueAposCancelamento,
  estoqueAposVenda,
  horarioRetiradaParaTimestamp,
  inicioContagemPedido,
  idsCompradosEmPedidosConcluidos,
  matriculaParaRetirada,
  pedidoIdDoQr,
  pedidoAntesDaRetirada,
  pedidoConcluido,
  pedidoNoFiltroStatus,
  quantidadesPorProduto,
  quantidadesVendidasPorProduto,
  validarHorarioRetirada,
} from './pedidos'

describe('pedido concluído', () => {
  it('aceita somente compra finalizada e rejeita cancelamento', () => {
    expect(pedidoConcluido({ status: 'Entregue' })).toBe(true)
    expect(pedidoConcluido({ status: 'Finalizado' })).toBe(true)
    expect(pedidoConcluido({ status: 'Cancelado', pago: true })).toBe(false)
    expect(pedidoConcluido({ status: 'Recebido', pago: true })).toBe(false)
  })

  it('ignora cancelados e pendentes em mais vendidos e compre novamente', () => {
    const pedidos = [
      { status: 'Cancelado', matricula: '10', itens: [{ produtoId: 1, quantidade: 20 }] },
      { status: 'Recebido', matricula: '10', itens: [{ produtoId: 2, quantidade: 10 }] },
      { status: 'Entregue', matricula: '10', itens: [{ produtoId: 3, quantidade: 2 }] },
      { status: 'Entregue', matricula: '20', itens: [{ produtoId: 4, quantidade: 1 }] },
    ]

    expect(quantidadesVendidasPorProduto(pedidos)).toEqual({ 3: 2, 4: 1 })
    expect(idsCompradosEmPedidosConcluidos(pedidos, '10')).toEqual([3])
  })
})

describe('filtros do vendedor', () => {
  it('mantém os filtros de status exclusivos', () => {
    const entreguePendente = { status: 'Entregue', formaPagamento: 'Conta do Professor', pago: false }
    expect(pedidoNoFiltroStatus(entreguePendente, 'pendentes')).toBe(false)
    expect(pedidoNoFiltroStatus(entreguePendente, 'entregues')).toBe(true)
    expect(pedidoNoFiltroStatus({ status: 'Recebido' }, 'pendentes')).toBe(true)
    expect(pedidoNoFiltroStatus({ status: 'Cancelado' }, 'cancelados')).toBe(true)
  })

  it('formata a data usando o dia local', () => {
    const data = new Date(2026, 5, 24, 23, 30)
    expect(dataIsoLocal(data)).toBe('2026-06-24')
  })
})

describe('QR Code do pedido', () => {
  it('extrai o identificador gerado pelo Senac Lanches', () => {
    expect(pedidoIdDoQr('SENAC-LANCHES:pedido-123')).toBe('pedido-123')
    expect(pedidoIdDoQr('senac-lanches:ABC')).toBe('ABC')
  })

  it('rejeita outro QR Code e localiza o pedido correto', () => {
    const pedidos = [{ id: 'pedido-123', numero: 1 }, { id: 'pedido-456', numero: 2 }]
    expect(pedidoIdDoQr('https://exemplo.com')).toBeNull()
    expect(encontrarPedidoPorQr('SENAC-LANCHES:pedido-456', pedidos)).toEqual(pedidos[1])
    expect(encontrarPedidoPorQr('SENAC-LANCHES:nao-existe', pedidos)).toBeNull()
  })
})

describe('codigoPedido', () => {
  it('formata a sequência com quatro dígitos', () => {
    expect(codigoPedido({ numero: 4 })).toBe('0004')
    expect(codigoPedido({ numero: 42 })).toBe('0042')
  })

  it('mantém compatibilidade com pedidos antigos', () => {
    expect(codigoPedido({ id: 'P1780000012345' })).toBe('2345')
  })
})

describe('fila e horário do pedido', () => {
  const referencia = new Date(2026, 5, 22, 9, 0, 0).getTime()

  it('gera chave diária e ordena pela sequência', () => {
    expect(chaveDiariaPedido(referencia)).toBe('20260622')
    const lista = [{ numero: 3, criadoEm: referencia + 2 }, { numero: 1, criadoEm: referencia + 1 }]
    expect(lista.sort(compararPedidosFila).map(p => p.numero)).toEqual([1, 3])
  })

  it('inicia a contagem apenas no horário de retirada', () => {
    const retiradaEm = horarioRetiradaParaTimestamp('10:00', referencia)
    const pedido = { criadoEm: referencia, horarioRetirada: '10:00', horarioRetiradaEm: retiradaEm }
    expect(inicioContagemPedido(pedido)).toBe(retiradaEm)
    expect(pedidoAntesDaRetirada(pedido, referencia)).toBe(true)
  })

  it('rejeita horário passado ou fora do funcionamento', () => {
    expect(validarHorarioRetirada('08:30', {}, referencia).valido).toBe(false)
    expect(validarHorarioRetirada('12:00', { horarioAbertura: '09:00', horarioFechamento: '11:00' }, referencia).valido).toBe(false)
    expect(validarHorarioRetirada('10:00', { horarioAbertura: '09:00', horarioFechamento: '11:00' }, referencia).valido).toBe(true)
  })
})

describe('fluxo de estoque do pedido', () => {
  const produtos = [{ id: 1, nome: 'Coxinha', estoque: 5, preco: 6 }]

  it('baixa e devolve o estoque sem alterar o total original', () => {
    const carrinho = [{ id: 1, nome: 'Coxinha', quantidade: 2, preco: 6 }]
    expect(encontrarItemSemEstoque(carrinho, produtos)).toBeNull()

    const aposVenda = estoqueAposVenda(produtos[0].estoque, carrinho[0].quantidade)
    expect(aposVenda).toBe(3)
    expect(estoqueAposCancelamento(aposVenda, carrinho[0].quantidade)).toBe(5)
  })

  it('identifica item sem quantidade suficiente e nunca produz estoque negativo', () => {
    const carrinho = [{ id: 1, nome: 'Coxinha', quantidade: 8, preco: 6 }]
    expect(encontrarItemSemEstoque(carrinho, produtos)?.nome).toBe('Coxinha')
    expect(estoqueAposVenda(5, 8)).toBe(0)
  })

  it('recalcula o estoque ao editar quantidades', () => {
    const antes = quantidadesPorProduto([{ produtoId: 1, quantidade: 1 }])
    const depois = quantidadesPorProduto([{ produtoId: 1, quantidade: 3 }])
    expect(calcularEstoqueAposEdicao(2, antes['1'], depois['1'])).toEqual({ valido: true, estoque: 0 })
    expect(calcularEstoqueAposEdicao(1, antes['1'], 4)).toEqual({ valido: false, estoque: 0 })
  })
})

describe('pagamento na entrega', () => {
  it('marca pagamento comum como pago junto com a entrega', () => {
    expect(dadosPagamentoNaEntrega({ pagamento: 'Pix' }, 123)).toEqual({
      pago: true,
      pagamentoStatus: 'pago',
      pagoEm: 123,
    })
  })

  it('mantém Conta do Professor pendente após a entrega', () => {
    expect(dadosPagamentoNaEntrega({ formaPagamento: 'Conta do Professor' }, 123)).toEqual({
      pago: false,
      pagamentoStatus: 'pendente',
      pagoEm: null,
    })
  })
})

describe('identificação para retirada', () => {
  it('usa a matrícula salva no pedido', () => {
    expect(matriculaParaRetirada({ matricula: '2024001' }, { matricula: '999' })).toBe('2024001')
  })

  it('usa a matrícula da conta em pedidos antigos', () => {
    expect(matriculaParaRetirada({}, { matricula: '2024001' })).toBe('2024001')
  })
})
