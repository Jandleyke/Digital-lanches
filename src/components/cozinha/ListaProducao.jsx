import { CheckCircle2, Edit3, Flame, MoreVertical, Search, Send, Trash2, Utensils, X, XCircle } from 'lucide-react'
import { maxDesperdicio as maxDescarte, normalizarStatusProducao, visualStatusProducao } from '../../utils/producao'

export default function ListaProducao({
  isMobile,
  titulo,
  vazioTexto,
  modoSelecao,
  sairModoSelecao,
  selecionarTodos,
  todosSelecionados,
  itensSelecionados,
  itensDoTurno,
  itensFiltrados,
  busca,
  setBusca,
  iniciarSelecao,
  statusDisponiveis,
  filtro,
  setFiltro,
  contagemStatus,
  toggleSelecao,
  menuAbertoId,
  setMenuAbertoId,
  mudarStatus,
  editar,
  avisarVendedor,
  abrirDescarte,
  cancelar,
  tempoDesde,
  styles,
}) {
  return (
    <section id="producao-lista" style={styles.sectionCard}>
      {modoSelecao ? (
        <div style={styles.sectionHeader}>
          <button style={styles.linkBtn} onClick={sairModoSelecao}>← Cancelar seleção</button>
          <button style={styles.linkBtn} onClick={selecionarTodos}>
            {todosSelecionados ? 'Desmarcar todos' : 'Selecionar todos'}
          </button>
          <span style={{ color: '#1D4ED8', fontWeight: 800, fontSize: '0.85rem', marginLeft: 'auto' }}>
            {itensSelecionados.length === 0
              ? 'Selecione os produtos para realizar acoes em lote'
              : `${itensSelecionados.length} produto${itensSelecionados.length !== 1 ? 's' : ''} selecionado${itensSelecionados.length !== 1 ? 's' : ''}`}
          </span>
        </div>
      ) : (
        <div style={styles.sectionHeader}>
          <div><h3 style={styles.sectionTitle}>{titulo}</h3></div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ ...styles.searchBox, ...(isMobile ? styles.searchBoxMobile : {}) }}>
              <Search size={16} color="#64748B" />
              <input value={busca} onChange={event => setBusca(event.target.value)} placeholder="Buscar produto..." style={styles.searchInput} />
            </div>
            {itensDoTurno.some(item => normalizarStatusProducao(item.status) !== 'cancelado') && (
              <button type="button" style={styles.linkBtn} onClick={iniciarSelecao}>☑ Selecionar</button>
            )}
          </div>
        </div>
      )}

      <div style={styles.filtros}>
        {['todos', ...statusDisponiveis].map(status => {
          const ativo = filtro === status
          const visual = status === 'todos'
            ? { bg: '#E8F0FB', color: '#003D7C' }
            : visualStatusProducao(status)
          const label = status === 'todos' ? 'Todos' : visual.label
          return (
            <button key={status} onClick={() => setFiltro(status)}
              style={{
                ...styles.filtroBtn,
                background: ativo ? visual.color : visual.bg,
                color: ativo ? '#fff' : visual.color,
                boxShadow: ativo ? `0 4px 10px ${visual.color}55` : 'none',
              }}>
              {label}
              <span style={{ ...styles.filtroCount, background: ativo ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.08)' }}>
                {contagemStatus[status] ?? 0}
              </span>
            </button>
          )
        })}
      </div>

      <div style={styles.lista}>
        {itensFiltrados.length === 0
          ? <div style={styles.vazio}>{vazioTexto}</div>
          : itensFiltrados.map(item => {
            const visual = visualStatusProducao(item.status)
            const statusNormalizado = normalizarStatusProducao(item.status)
            const quantidade = statusNormalizado === 'planejado' ? item.quantidadePlanejada
              : statusNormalizado === 'em producao' ? item.quantidadeEmProducao
                : statusNormalizado === 'esgotado' ? 0
                  : item.quantidadePronta
            const menuAberto = menuAbertoId === item.id
            const selecionado = itensSelecionados.includes(item.id)
            const podeSelecionar = statusNormalizado !== 'cancelado'

            return (
              <article key={item.id} style={{ ...styles.prodRow, ...(selecionado ? styles.prodRowSelecionada : {}) }}>
                <div
                  style={{ ...styles.prodRowTop, ...(isMobile ? styles.prodRowTopMobile : {}), cursor: modoSelecao && podeSelecionar ? 'pointer' : 'default' }}
                  onClick={() => { if (modoSelecao && podeSelecionar) toggleSelecao(item.id) }}
                >
                  {modoSelecao && (
                    <div style={selecionado ? styles.checkOn : styles.checkOff}>
                      {selecionado && <span style={{ color: '#fff', fontSize: '0.7rem', fontWeight: 900 }}>✓</span>}
                    </div>
                  )}
                  <div style={{ ...styles.produtoMini, flex: '1 1 180px' }}>
                    <div style={styles.produtoMiniThumb}>
                      {item.produtoFoto
                        ? <img src={item.produtoFoto} alt={item.produtoNome} style={styles.produtoMiniImg} />
                        : <Utensils size={18} color="#94A3B8" />
                      }
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <strong style={styles.codigo}>{item.produtoNome}</strong>
                      <p style={styles.meta}>{item.produtoCategoria || 'Produto'}</p>
                    </div>
                  </div>
                  <div style={{ ...styles.prodRowInfo, ...(isMobile ? styles.prodRowInfoMobile : {}) }}>
                    <strong style={styles.prodRowQtd}>{quantidade || 0} un</strong>
                    <span style={{ ...styles.badge, background: visual.bg, color: visual.color }}>{visual.label}</span>
                    {!modoSelecao && (
                      <button aria-label={`Ações de ${item.produtoNome}`} style={styles.iconBtnMenu} onClick={event => { event.stopPropagation(); setMenuAbertoId(menuAberto ? null : item.id) }}><MoreVertical size={18} /></button>
                    )}
                  </div>
                </div>
                {item.observacao && <p style={styles.obs}>{item.observacao}</p>}
                {!modoSelecao && menuAberto && (
                  <div style={styles.menuAcoes}>
                    {statusNormalizado === 'planejado' && (
                      <button style={styles.btnPrimario} onClick={() => mudarStatus(item, 'Em producao')}><Flame size={15} /> Iniciar produção</button>
                    )}
                    {statusNormalizado === 'em producao' && (
                      <button style={styles.btnPrimario} onClick={() => mudarStatus(item, 'Pronto para venda')}><CheckCircle2 size={15} /> Marcar pronto</button>
                    )}
                    {['pronto para venda', 'parcialmente pronto'].includes(statusNormalizado) && (
                      <button style={styles.btnSecundario} onClick={() => mudarStatus(item, 'Esgotado')}><XCircle size={15} /> Marcar esgotado</button>
                    )}
                    <button style={styles.btnSecundario} onClick={() => editar(item)}><Edit3 size={15} /> Editar quantidade</button>
                    <button style={styles.btnSecundario} onClick={() => avisarVendedor(item)}><Send size={15} /> Avisar vendedor</button>
                    <button style={styles.btnPerigo} onClick={() => abrirDescarte(item)} disabled={maxDescarte(item) <= 0 || statusNormalizado === 'cancelado'}><Trash2 size={15} /> Registrar descarte</button>
                    {statusNormalizado !== 'cancelado' && (
                      <button style={styles.btnPerigo} onClick={() => cancelar(item)}><X size={15} /> Cancelar item</button>
                    )}
                    <p style={styles.meta}>Atualizado {tempoDesde(item.atualizadoEm)} por {item.atualizadoPor?.nome || item.criadoPor?.nome || 'Cozinha'}</p>
                  </div>
                )}
              </article>
            )
          })
        }
      </div>
    </section>
  )
}
