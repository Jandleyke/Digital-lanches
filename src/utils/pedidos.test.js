import { describe, expect, it } from 'vitest'
import {
  calcularEstoqueAposEdicao,
  chaveDiariaPedido,
  codigoPedido,
  compararPedidosFila,
  dadosPagamentoNaEntrega,
  dataIsoLocal,
  deveAtualizarEstoqueProdutoNoPedido,
  encontrarItemSemEstoque,
  encontrarPedidoPorQr,
  estoqueAposCancelamento,
  estoqueAposVenda,
  gerarCodigoPedidoAleatorio,
  horarioRetiradaParaTimestamp,
  inicioContagemPedido,
  idsCompradosEmPedidosConcluidos,
  matriculaParaRetirada,
  mensagemErroFinalizacaoPedido,
  pedidoCriadoPeloProprioAlunoSeguro,
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
  it('prioriza o código aleatório de 4 dígitos quando presente', () => {
    expect(codigoPedido({ codigoPedido: '8417', numero: 4 })).toBe('8417')
  })

  it('usa o número sequencial puro quando não há código aleatório', () => {
    expect(codigoPedido({ numero: 4 })).toBe('4')
    expect(codigoPedido({ numero: 42 })).toBe('42')
  })

  it('mantém compatibilidade com pedidos antigos', () => {
    expect(codigoPedido({ id: 'P1780000012345' })).toBe('2345')
  })
})

describe('gerarCodigoPedidoAleatorio', () => {
  it('sempre gera 4 dígitos', () => {
    for (let i = 0; i < 50; i++) {
      const codigo = gerarCodigoPedidoAleatorio()
      expect(codigo).toMatch(/^\d{4}$/)
    }
  })

  it('nunca repete um código já usado no dia', () => {
    const usados = ['1000', '1001', '1002']
    for (let i = 0; i < 20; i++) {
      expect(usados).not.toContain(gerarCodigoPedidoAleatorio(usados))
    }
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

  it('nao tenta atualizar produto com estoque zero quando a producao ja foi consumida', () => {
    expect(deveAtualizarEstoqueProdutoNoPedido(0, [{ id: 'PD1', quantidade: 2 }])).toBe(false)
    expect(deveAtualizarEstoqueProdutoNoPedido(5, [{ id: 'PD1', quantidade: 2 }])).toBe(true)
    expect(deveAtualizarEstoqueProdutoNoPedido(0, [])).toBe(true)
  })
})

describe('erros de finalizacao do pedido', () => {
  it('mantem erros de estoque e horario legiveis para o usuario', () => {
    expect(mensagemErroFinalizacaoPedido(new Error('Nao ha quantidade suficiente disponivel para Coxinha.')))
      .toBe('Nao ha quantidade suficiente disponivel para Coxinha.')
  })

  it('mostra erro real de permissao em vez de mensagem generica de conexao', () => {
    const erro = { code: 'permission-denied', message: 'Missing or insufficient permissions.' }
    expect(mensagemErroFinalizacaoPedido(erro))
      .toContain('Permissão negada pelo Firestore')
  })

  it('orienta novo login quando a sessao expira', () => {
    expect(mensagemErroFinalizacaoPedido({ code: 'unauthenticated' })).toContain('sessão expirou')
  })
})

describe('seguranca do pedido criado pelo app', () => {
  it('aceita aluno criando o proprio pedido com campos de dono consistentes', () => {
    const usuario = { uid: 'u1', perfil: 'aluno' }
    const pedido = { uid: 'u1', userId: 'u1', alunoId: 'u1', alunoPerfil: 'aluno', status: 'Recebido', origem: 'app' }
    expect(pedidoCriadoPeloProprioAlunoSeguro(pedido, usuario)).toBe(true)
  })

  it('aceita professor autenticado criando o proprio pedido pelo app', () => {
    const usuario = { uid: 'p1', perfil: 'professor' }
    const pedido = { uid: 'p1', userId: 'p1', alunoId: 'p1', alunoPerfil: 'professor', status: 'Recebido', origem: 'app' }
    expect(pedidoCriadoPeloProprioAlunoSeguro(pedido, usuario)).toBe(true)
  })

  it('rejeita pedido criado para outro usuario', () => {
    const usuario = { uid: 'u1', perfil: 'aluno' }
    const pedido = { uid: 'u2', userId: 'u2', alunoId: 'u2', alunoPerfil: 'aluno', status: 'Recebido', origem: 'app' }
    expect(pedidoCriadoPeloProprioAlunoSeguro(pedido, usuario)).toBe(false)
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
