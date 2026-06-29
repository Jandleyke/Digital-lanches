import { CheckCircle2, ChevronRight, PlusCircle, Search, Utensils, X } from 'lucide-react'
import { normalizarStatusProducao } from '../../utils/producao'

export function AvisoPlanejamentoSalvo({ mensagem, onIrProducao, styles }) {
  if (!mensagem) return null
  return (
    <div style={styles.planejamentoSucesso} role="status">
      <div style={styles.planejamentoSucessoTexto}>
        <CheckCircle2 size={20} />
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <strong>Planejamento salvo</strong>
          <span>{mensagem}</span>
        </div>
      </div>
      <button type="button" style={styles.btnIrProducao} onClick={onIrProducao}>
        Ir para Produção <ChevronRight size={16} />
      </button>
    </div>
  )
}

export function AreaPlanejamento({
  isMobile,
  formProducao,
  setFormProducao,
  produtos,
  turnos,
  turnoSelecionado,
  adicionarItemLote,
  loteProducao,
  turnoLabels,
  removerItemLote,
  verTodosProdutos,
  setVerTodosProdutos,
  buscaProduto,
  setBuscaProduto,
  categorias,
  filtroCategoria,
  setFiltroCategoria,
  produtosFiltrados,
  produtosRapidos,
  producaoDoDiaTurno,
  qtdPorProduto,
  setQtdPorProduto,
  planejarProduto,
  styles,
}) {
  const produtosExibidos = verTodosProdutos ? produtosFiltrados : produtosRapidos

  return (
    <>
      <div id="cadastrar-planejamento" style={styles.sectionCard}>
        <h3 style={styles.sectionTitle}>Cadastrar planejamento</h3>
        <div data-testid="planejamento-grid" style={{ display: 'grid', gap: 10, gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', minWidth: 0 }}>
          <div style={{ minWidth: 0 }}>
            <label style={styles.campoLabel}>Produto</label>
            <select value={formProducao.produtoId} onChange={e => setFormProducao({ ...formProducao, produtoId: e.target.value })} style={styles.input}>
              <option value="">Selecione o produto</option>
              {produtos.map(produto => <option key={produto.id} value={produto.id}>{produto.nome}</option>)}
            </select>
          </div>
          <div style={{ minWidth: 0 }}>
            <label style={styles.campoLabel}>Quantidade</label>
            <div style={styles.qtyControl}>
              <button type="button" aria-label="Diminuir quantidade" style={styles.qtyBtn} onClick={() => setFormProducao(form => ({ ...form, quantidadePlanejada: String(Math.max(1, Number(form.quantidadePlanejada || 1) - 1)) }))}>−</button>
              <input aria-label="Quantidade planejada" type="number" min="1" value={formProducao.quantidadePlanejada} onChange={e => setFormProducao({ ...formProducao, quantidadePlanejada: e.target.value })} style={{ ...styles.input, width: 'auto', flex: 1, minWidth: 0, textAlign: 'center', padding: '0.6rem 0.3rem' }} />
              <button type="button" aria-label="Aumentar quantidade" style={styles.qtyBtn} onClick={() => setFormProducao(form => ({ ...form, quantidadePlanejada: String(Number(form.quantidadePlanejada || 1) + 1) }))}>+</button>
            </div>
          </div>
          <div style={{ minWidth: 0 }}>
            <label style={styles.campoLabel}>Turno</label>
            <select value={formProducao.turno || turnoSelecionado} onChange={e => setFormProducao({ ...formProducao, turno: e.target.value })} style={styles.input}>
              {turnos.map(turno => <option key={turno.id} value={turno.id}>{turno.label}</option>)}
            </select>
          </div>
          <div style={{ minWidth: 0 }}>
            <label style={styles.campoLabel}>Observação (opcional)</label>
            <input value={formProducao.observacao} onChange={e => setFormProducao({ ...formProducao, observacao: e.target.value })} placeholder="Ex.: sem cebola" style={styles.input} />
          </div>
        </div>
        <button type="button" style={{ ...styles.btnPrimario, width: '100%', justifyContent: 'center' }} onClick={adicionarItemLote}>
          <PlusCircle size={16} /> Adicionar ao planejamento
        </button>

        {loteProducao.length > 0 && (
          <div style={styles.loteBox}>
            <strong style={{ color: '#0F172A' }}>Itens no rascunho ({loteProducao.length})</strong>
            {loteProducao.map((item, index) => (
              <div key={`${item.produtoId}-${index}`} style={styles.linhaResumo}>
                <span>{item.produtoNome} — {item.quantidadePlanejada} un ({turnoLabels[item.turno] || item.turno})</span>
                <button type="button" aria-label={`Remover ${item.produtoNome}`} style={styles.iconBtnPerigo} onClick={() => removerItemLote(index)}><X size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={styles.sectionCard}>
        <div style={styles.sectionHeader}>
          <h3 style={styles.sectionTitle}>Planejamento rápido</h3>
          <button style={styles.linkBtn} onClick={() => setVerTodosProdutos(valor => !valor)}>
            {verTodosProdutos ? 'Ver menos' : 'Ver todos'} <ChevronRight size={14} />
          </button>
        </div>
        {verTodosProdutos && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <div style={{ ...styles.searchBox, ...(isMobile ? styles.searchBoxMobile : {}), flex: 1, minWidth: 160 }}>
              <Search size={16} color="#64748B" />
              <input value={buscaProduto} onChange={e => setBuscaProduto(e.target.value)} placeholder="Buscar produto..." style={styles.searchInput} />
            </div>
            {categorias && (
              <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)} style={{ ...styles.input, width: 'auto', minWidth: 130 }}>
                {categorias.map(categoria => <option key={categoria} value={categoria}>{categoria}</option>)}
              </select>
            )}
          </div>
        )}
        <div data-testid="produtos-grid" style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fill, minmax(155px, 1fr))', gap: isMobile ? 8 : 12, minWidth: 0 }}>
          {produtosExibidos.map(produto => {
            const planejado = producaoDoDiaTurno.find(item => String(item.produtoId) === String(produto.id) && normalizarStatusProducao(item.status) !== 'cancelado')
            const quantidade = qtdPorProduto[produto.id] ?? 1
            return (
              <div key={produto.id} style={{ ...styles.produtoCardGrid, ...(isMobile ? styles.produtoCardGridMobile : {}), border: planejado ? '2px solid #22C55E' : '2px solid #E5E7EB' }}>
                <div style={{ width: '100%', height: isMobile ? 64 : 76, borderRadius: 10, overflow: 'hidden', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 7, flexShrink: 0 }}>
                  {produto.foto
                    ? <img src={produto.foto} alt={produto.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : produto.emoji
                      ? <span style={{ fontSize: '2rem' }}>{produto.emoji}</span>
                      : <Utensils size={26} color="#94A3B8" strokeWidth={1.5} />
                  }
                </div>
                <strong style={{ fontSize: isMobile ? '0.76rem' : '0.8rem', color: '#0F172A', display: 'block', marginBottom: 4, overflow: 'hidden', overflowWrap: 'anywhere', lineHeight: 1.2, minHeight: '2.4em' }}>{produto.nome}</strong>
                {planejado
                  ? <div style={{ fontSize: '0.7rem', color: '#16A34A', fontWeight: 800, marginBottom: 6 }}>✓ {planejado.quantidadePlanejada} un planejadas</div>
                  : <div style={{ fontSize: '0.7rem', color: '#94A3B8', marginBottom: 6 }}>{produto.categoria || 'Produto'}</div>
                }
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 7, width: '100%', minWidth: 0 }}>
                  <button type="button" aria-label={`Diminuir ${produto.nome}`} style={styles.qtyBtn} onClick={() => setQtdPorProduto(atual => ({ ...atual, [produto.id]: Math.max(1, (atual[produto.id] ?? 1) - 1) }))}>−</button>
                  <input aria-label={`Quantidade de ${produto.nome}`} type="number" min="1" max="999" value={quantidade}
                    onChange={e => setQtdPorProduto(atual => ({ ...atual, [produto.id]: Math.max(1, Number(e.target.value) || 1) }))}
                    style={{ ...styles.inputMini, width: 'auto', flex: 1, maxWidth: 48, textAlign: 'center', padding: '0.3rem 0.15rem' }} />
                  <button type="button" aria-label={`Aumentar ${produto.nome}`} style={styles.qtyBtn} onClick={() => setQtdPorProduto(atual => ({ ...atual, [produto.id]: Math.min(999, (atual[produto.id] ?? 1) + 1) }))}>+</button>
                </div>
                <button type="button"
                  style={{ ...styles.btnPrimario, width: '100%', fontSize: '0.76rem', padding: '0.45rem 0.4rem', justifyContent: 'center', minHeight: 34, background: planejado ? '#16A34A' : '#003D7C' }}
                  onClick={() => planejarProduto(produto)}>
                  {planejado ? `+ Adicionar ${quantidade} un` : `Planejar ${quantidade} un`}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
