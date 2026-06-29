import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AreaPlanejamento, AvisoPlanejamentoSalvo } from './PlanejamentoProducao'

const formProducao = {
  produtoId: '',
  quantidadePlanejada: '1',
  turno: '',
  observacao: '',
}

function renderArea(isMobile) {
  const adicionarItemLote = vi.fn()
  render(
    <AreaPlanejamento
      isMobile={isMobile}
      formProducao={formProducao}
      setFormProducao={vi.fn()}
      produtos={[]}
      turnos={[{ id: 'manha', label: 'Manhã' }]}
      turnoSelecionado="manha"
      adicionarItemLote={adicionarItemLote}
      loteProducao={[]}
      turnoLabels={{ manha: 'Manhã' }}
      removerItemLote={vi.fn()}
      verTodosProdutos={false}
      setVerTodosProdutos={vi.fn()}
      buscaProduto=""
      setBuscaProduto={vi.fn()}
      produtosFiltrados={[]}
      produtosRapidos={[]}
      producaoDoDiaTurno={[]}
      qtdPorProduto={{}}
      setQtdPorProduto={vi.fn()}
      planejarProduto={vi.fn()}
      styles={{}}
    />
  )
  return { adicionarItemLote }
}

describe('responsividade do planejamento da cozinha', () => {
  it('usa uma coluna no formulário e duas colunas flexíveis nos produtos no celular', () => {
    renderArea(true)
    expect(screen.getByTestId('planejamento-grid').style.gridTemplateColumns).toBe('1fr')
    expect(screen.getByTestId('produtos-grid').style.gridTemplateColumns).toBe('repeat(2, minmax(0, 1fr))')
    expect(screen.getByLabelText('Quantidade planejada').style.width).toBe('auto')
    expect(screen.getByLabelText('Quantidade planejada').style.minWidth).toBe('0px')
  })

  it('permite que os campos se reorganizem conforme o espaço disponível no computador', () => {
    renderArea(false)
    expect(screen.getByTestId('planejamento-grid').style.gridTemplateColumns).toContain('auto-fit')
    expect(screen.getByTestId('planejamento-grid').style.gridTemplateColumns).toContain('minmax')
  })

  it('mantém a ação de adicionar ao planejamento', () => {
    const { adicionarItemLote } = renderArea(false)
    fireEvent.click(screen.getByRole('button', { name: /adicionar ao planejamento/i }))
    expect(adicionarItemLote).toHaveBeenCalledOnce()
  })
})

describe('direcionamento após salvar', () => {
  it('abre a produção pelo aviso de sucesso', () => {
    const onIrProducao = vi.fn()
    render(<AvisoPlanejamentoSalvo mensagem="1 produto foi adicionado." onIrProducao={onIrProducao} styles={{}} />)
    expect(screen.getByRole('status')).toHaveTextContent('Planejamento salvo')
    fireEvent.click(screen.getByRole('button', { name: /ir para produção/i }))
    expect(onIrProducao).toHaveBeenCalledOnce()
  })
})
