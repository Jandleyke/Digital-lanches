import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ListaProducao from './ListaProducao'

const itemPlanejado = {
  id: 'p1',
  produtoNome: 'Coxinha',
  produtoCategoria: 'Salgados',
  quantidadePlanejada: 10,
  quantidadeEmProducao: 0,
  quantidadePronta: 0,
  quantidadeRestante: 0,
  status: 'Planejado',
}

function props(overrides = {}) {
  return {
    isMobile: false,
    titulo: 'Produção — Hoje (Manhã)',
    vazioTexto: 'Nenhuma produção planejada.',
    modoSelecao: false,
    sairModoSelecao: vi.fn(),
    selecionarTodos: vi.fn(),
    todosSelecionados: false,
    itensSelecionados: [],
    itensDoTurno: [itemPlanejado],
    itensFiltrados: [itemPlanejado],
    busca: '',
    setBusca: vi.fn(),
    iniciarSelecao: vi.fn(),
    statusDisponiveis: ['Planejado', 'Em producao'],
    filtro: 'todos',
    setFiltro: vi.fn(),
    contagemStatus: { todos: 1, Planejado: 1, 'Em producao': 0 },
    toggleSelecao: vi.fn(),
    menuAbertoId: null,
    setMenuAbertoId: vi.fn(),
    mudarStatus: vi.fn(),
    editar: vi.fn(),
    avisarVendedor: vi.fn(),
    abrirDesperdicio: vi.fn(),
    cancelar: vi.fn(),
    tempoDesde: () => 'agora',
    styles: {},
    ...overrides,
  }
}

describe('lista de produção', () => {
  it('mantém busca, filtros e entrada no modo de seleção', () => {
    const iniciarSelecao = vi.fn()
    const setFiltro = vi.fn()
    render(<ListaProducao {...props({ iniciarSelecao, setFiltro })} />)

    fireEvent.click(screen.getByRole('button', { name: /selecionar/i }))
    fireEvent.click(screen.getByRole('button', { name: /planejado/i }))
    expect(iniciarSelecao).toHaveBeenCalledOnce()
    expect(setFiltro).toHaveBeenCalledWith('Planejado')
  })

  it('preserva a ação de iniciar produção', () => {
    const mudarStatus = vi.fn()
    render(<ListaProducao {...props({ menuAbertoId: 'p1', mudarStatus })} />)

    fireEvent.click(screen.getByRole('button', { name: /iniciar produção/i }))
    expect(mudarStatus).toHaveBeenCalledWith(itemPlanejado, 'Em producao')
  })

  it('mostra o estado vazio sem criar ações indevidas', () => {
    render(<ListaProducao {...props({ itensDoTurno: [], itensFiltrados: [] })} />)
    expect(screen.getByText('Nenhuma produção planejada.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /selecionar/i })).not.toBeInTheDocument()
  })
})
