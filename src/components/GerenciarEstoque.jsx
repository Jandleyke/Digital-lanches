import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { AlertTriangle, Bell, Check, Edit3, Layers, Package, Save, Search, X, Zap } from 'lucide-react'
import { useApp } from '../contexts/AppContext'
import { estoqueNivel } from '../utils/statusColors'
import { useIsMobile } from '../utils/useIsMobile'
import { normalizarPerfil } from '../utils/perfis'

export default function GerenciarEstoque() {
  const { produtos, atualizarProduto, usuarioLogado } = useApp()
  const isMobile = useIsMobile()
  const location = useLocation()
  const perfil = normalizarPerfil(usuarioLogado?.role || usuarioLogado?.perfil)
  const [busca, setBusca] = useState('')
  const [categoria, setCategoria] = useState('todas')
  const [somenteAtencao, setSomenteAtencao] = useState(() => location.state?.filtroInicial === 'atencao')
  const [editandoEstoque, setEditandoEstoque] = useState(null)
  const [novoEstoque, setNovoEstoque] = useState('')
  const [editandoMin, setEditandoMin] = useState(null)
  const [novoMin, setNovoMin] = useState('')
  const [modoLote, setModoLote] = useState(false)
  const [valoresLote, setValoresLote] = useState({})
  const [salvandoLote, setSalvandoLote] = useState(false)

  const produtoEhBebida = produto => String(produto?.categoria || '').trim().toLowerCase() === 'bebidas'
  const podeEditarEstoque = produto => perfil === 'cozinha' || (perfil === 'vendedor' && produtoEhBebida(produto))
  const podeEditarMinimo = () => ['admin', 'gerente', 'cozinha', 'vendedor'].includes(perfil)
  const podeEditarEmLote = perfil === 'cozinha' || perfil === 'vendedor'

  async function salvarEstoque(produto) {
    if (!podeEditarEstoque(produto)) return
    try {
      await atualizarProduto({ ...produto, estoque: Math.max(0, parseInt(novoEstoque) || 0) })
      setEditandoEstoque(null)
    } catch (error) {
      alert(error.message || 'Não foi possível atualizar o estoque.')
    }
  }

  async function salvarMin(produto) {
    if (!podeEditarMinimo(produto)) return
    await atualizarProduto({ ...produto, estoqueBaixo: Math.max(0, parseInt(novoMin) || 0) })
    setEditandoMin(null)
  }

  function alterarValorLote(produtoId, valor) {
    setValoresLote(prev => ({ ...prev, [produtoId]: valor }))
  }

  function cancelarLote() {
    setModoLote(false)
    setValoresLote({})
  }

  async function salvarLote() {
    const alteracoes = Object.entries(valoresLote).filter(([, valor]) => valor !== '')
    if (alteracoes.length === 0) { setModoLote(false); return }
    setSalvandoLote(true)
    try {
      for (const [produtoId, valor] of alteracoes) {
        const produto = produtos.find(p => String(p.id) === String(produtoId))
        if (!produto || !podeEditarEstoque(produto)) continue
        const novo = Math.max(0, parseInt(valor) || 0)
        if (novo === Number(produto.estoque || 0)) continue
        await atualizarProduto({ ...produto, estoque: novo })
      }
    } finally {
      setSalvandoLote(false)
      setModoLote(false)
      setValoresLote({})
    }
  }

  const termo = busca.trim().toLowerCase()
  const categorias = Array.from(new Set(
    produtos.map(produto => String(produto.categoria || 'Sem categoria').trim()).filter(Boolean)
  )).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  const baseFiltrada = produtos.filter(p =>
    (categoria === 'todas' || String(p.categoria || 'Sem categoria').trim() === categoria)
    && (!termo || String(p.nome || '').toLowerCase().includes(termo) || String(p.categoria || '').toLowerCase().includes(termo))
  )
  const comAlertaTotal = baseFiltrada.filter(p => p.estoqueBaixo > 0 && p.estoque <= p.estoqueBaixo)
  const filtrados = somenteAtencao ? comAlertaTotal : baseFiltrada
  const ordenados = [
    ...filtrados.filter(p => p.estoqueBaixo > 0 && p.estoque <= p.estoqueBaixo).sort((a, b) => a.estoque - b.estoque),
    ...filtrados.filter(p => !(p.estoqueBaixo > 0 && p.estoque <= p.estoqueBaixo)).sort((a, b) => a.nome.localeCompare(b.nome)),
  ]
  const qtdAlteracoesLote = Object.values(valoresLote).filter(v => v !== '').length

  function Thumb({ produto, tamanho = 44 }) {
    return (
      <div style={{ ...s.thumb, width: tamanho, height: tamanho }}>
        {produto.foto
          ? <img src={produto.foto} alt={produto.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : produto.emoji
            ? <span style={{ fontSize: tamanho * 0.45 }}>{produto.emoji}</span>
            : <Package size={tamanho * 0.45} color="#94A3B8" />}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: modoLote && qtdAlteracoesLote > 0 ? (isMobile ? 150 : 76) : 0 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ ...s.searchBox, flex: 1, minWidth: 220 }}>
          <Search size={16} color="#64748B" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar produto por nome ou categoria..." style={s.searchInput} />
        </div>
        <select
          value={categoria}
          onChange={e => setCategoria(e.target.value)}
          style={s.selectCategoria}
          aria-label="Filtrar estoque por categoria"
        >
          <option value="todas">Todas as categorias</option>
          {categorias.map(item => <option key={item} value={item}>{item}</option>)}
        </select>
        <button
          type="button"
          style={{ ...s.chip, ...(somenteAtencao ? s.chipAtivo : {}) }}
          onClick={() => setSomenteAtencao(v => !v)}
        >
          <Zap size={14} /> Só com atenção
        </button>
        {podeEditarEmLote && (
          <button
            type="button"
            style={{ ...s.chip, ...(modoLote ? s.chipAtivo : {}) }}
            onClick={() => { if (modoLote) cancelarLote(); else setModoLote(true) }}
          >
            <Layers size={14} /> {modoLote ? 'Cancelar edição em lote' : 'Editar estoque em lote'}
          </button>
        )}
      </div>

      <div style={s.permissaoInfo}>
        {['admin', 'gerente'].includes(perfil) && 'Visualização de estoque: a quantidade atual é alterada somente pela operação.'}
        {perfil === 'vendedor' && 'O vendedor pode editar o estoque de Bebidas e ajustar o alerta mínimo de qualquer produto.'}
        {perfil === 'cozinha' && 'A cozinha pode atualizar o estoque operacional conforme a produção.'}
      </div>

      {comAlertaTotal.length > 0 && (
        <div style={s.alertaAmarelo}>
          <Zap size={16} /> <strong>{comAlertaTotal.length} produto(s)</strong> com estoque abaixo do mínimo configurado
        </div>
      )}

      {modoLote && (
        <p style={s.dicaLote}>Digite a nova quantidade direto no campo de cada produto e clique em "Salvar alterações" no final.</p>
      )}

      {isMobile ? (
        <div style={s.tabela}>
          {ordenados.map(p => {
            const nivel = estoqueNivel(p.estoque, p.estoqueBaixo)
            const isAlerta = p.estoqueBaixo > 0 && p.estoque <= p.estoqueBaixo
            return (
              <div key={p.id} style={{ ...s.mCard, borderLeft: `3px solid ${nivel.color}`, background: isAlerta ? '#FFFBEB' : '#fff' }}>
                <Thumb produto={p} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: '#1A202C', fontSize: '0.87rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nome}</div>
                  <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: 1 }}>{p.categoria || 'Sem categoria'}</div>

                  {/* Estoque atual */}
                  <div style={{ display: 'flex', gap: 5, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: 600 }}>Estoque:</span>
                    {modoLote && podeEditarEstoque(p) ? (
                      <input
                        style={{ ...s.inputEst, width: 64, borderColor: valoresLote[p.id] !== undefined && valoresLote[p.id] !== '' ? '#16A34A' : '#003D7C' }}
                        type="number" min="0" placeholder={String(p.estoque)}
                        value={valoresLote[p.id] ?? ''}
                        onChange={e => alterarValorLote(p.id, e.target.value)}
                      />
                    ) : editandoEstoque === p.id ? (
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <input style={{ ...s.inputEst, width: 50 }} type="number" min="0" value={novoEstoque} onChange={e => setNovoEstoque(e.target.value)} autoFocus />
                        <button style={s.btnIconSalvar} onClick={() => salvarEstoque(p)}><Check size={14} /></button>
                        <button style={s.btnIconCancelar} onClick={() => setEditandoEstoque(null)}><X size={14} /></button>
                      </div>
                    ) : (
                      <>
                        <span style={{ ...s.badge, background: nivel.bg, color: nivel.color, fontWeight: 800 }}>{p.estoque} un</span>
                        {podeEditarEstoque(p) && <button style={s.btnIconEditar} onClick={() => { setEditandoEstoque(p.id); setNovoEstoque(String(p.estoque)) }}><Edit3 size={13} /></button>}
                      </>
                    )}
                  </div>

                  {/* Alerta mínimo */}
                  {!modoLote && (
                    <div style={{ display: 'flex', gap: 5, marginTop: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: 600 }}>Alertar abaixo de:</span>
                      {editandoMin === p.id ? (
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <input style={{ ...s.inputEst, width: 50 }} type="number" min="0" value={novoMin} onChange={e => setNovoMin(e.target.value)} autoFocus placeholder="0" />
                          <button style={s.btnIconSalvar} onClick={() => salvarMin(p)}><Check size={14} /></button>
                          <button style={s.btnIconCancelar} onClick={() => setEditandoMin(null)}><X size={14} /></button>
                        </div>
                      ) : (
                        <>
                          <span style={{ ...s.minBadge, background: p.estoqueBaixo > 0 ? '#FEF3C7' : '#F1F5F9', color: p.estoqueBaixo > 0 ? '#B45309' : '#94A3B8' }}>
                            {p.estoqueBaixo > 0 ? <><Bell size={11} /> {p.estoqueBaixo} un</> : '— não definido'}
                          </span>
                          {podeEditarMinimo(p) && <button style={s.btnIconEditar} onClick={() => { setEditandoMin(p.id); setNovoMin(String(p.estoqueBaixo || '')) }}><Edit3 size={13} /></button>}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          {ordenados.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#94A3B8' }}>Nenhum produto encontrado.</div>
          )}
        </div>
      ) : (
        <div style={{ ...s.tabela, overflowX: 'auto' }}>
          <div style={s.thead}>
            <span style={{ flex: 2 }}>Produto</span>
            <span style={{ flex: 1 }}>Categoria</span>
            <span style={{ flex: 1, textAlign: 'center' }}>Estoque atual</span>
            <span style={{ flex: 1, textAlign: 'center' }}><Bell size={13} style={{ marginRight: 4 }} />Alertar abaixo de</span>
            <span style={{ flex: 1 }}>Situação</span>
          </div>
          {ordenados.map(p => {
            const nivel = estoqueNivel(p.estoque, p.estoqueBaixo)
            const isAlerta = p.estoqueBaixo > 0 && p.estoque <= p.estoqueBaixo
            return (
              <div key={p.id} style={{ ...s.trow, background: isAlerta ? '#FFFBEB' : '#fff' }}>
                <span style={{ flex: 2, display: 'flex', alignItems: 'center', gap: 10, fontWeight: 600, minWidth: 0 }}>
                  <Thumb produto={p} tamanho={38} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nome}</span>
                  {isAlerta && <span style={s.baixoTag}><AlertTriangle size={11} /> Baixo</span>}
                </span>
                <span style={{ flex: 1, color: '#64748B', fontSize: '0.85rem' }}>{p.categoria}</span>

                {/* Estoque atual */}
                <span style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  {modoLote && podeEditarEstoque(p) ? (
                    <input
                      style={{ ...s.inputEst, borderColor: valoresLote[p.id] !== undefined && valoresLote[p.id] !== '' ? '#16A34A' : '#003D7C' }}
                      type="number" min="0" placeholder={String(p.estoque)}
                      value={valoresLote[p.id] ?? ''}
                      onChange={e => alterarValorLote(p.id, e.target.value)}
                    />
                  ) : editandoEstoque === p.id ? (
                    <>
                      <input style={s.inputEst} type="number" min="0" value={novoEstoque} onChange={e => setNovoEstoque(e.target.value)} autoFocus />
                      <button style={s.btnIconSalvar} onClick={() => salvarEstoque(p)}><Check size={14} /></button>
                      <button style={s.btnIconCancelar} onClick={() => setEditandoEstoque(null)}><X size={14} /></button>
                    </>
                  ) : (
                    <>
                      <strong style={{ color: nivel.color, fontSize: '1rem' }}>{p.estoque}</strong>
                      <span style={{ ...s.badge, background: nivel.bg, color: nivel.color }}>{nivel.label}</span>
                      {podeEditarEstoque(p) && <button style={s.btnIconEditar} onClick={() => { setEditandoEstoque(p.id); setNovoEstoque(String(p.estoque)) }}><Edit3 size={14} /></button>}
                    </>
                  )}
                </span>

                {/* Threshold */}
                <span style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  {editandoMin === p.id ? (
                    <>
                      <input style={s.inputEst} type="number" min="0" value={novoMin} onChange={e => setNovoMin(e.target.value)} autoFocus placeholder="0" />
                      <button style={s.btnIconSalvar} onClick={() => salvarMin(p)}><Check size={14} /></button>
                      <button style={s.btnIconCancelar} onClick={() => setEditandoMin(null)}><X size={14} /></button>
                    </>
                  ) : (
                    <>
                      <span style={{ color: p.estoqueBaixo > 0 ? '#B45309' : '#CBD5E1', fontWeight: p.estoqueBaixo > 0 ? 700 : 400, fontSize: '0.88rem' }}>
                        {p.estoqueBaixo > 0 ? `${p.estoqueBaixo} un` : '—'}
                      </span>
                      {podeEditarMinimo(p) && <button style={s.btnIconEditar} onClick={() => { setEditandoMin(p.id); setNovoMin(String(p.estoqueBaixo || '')) }} disabled={modoLote}>
                        {p.estoqueBaixo > 0 ? <Edit3 size={14} /> : '+ Definir'}
                      </button>}
                    </>
                  )}
                </span>

                <span style={{ flex: 1 }}>
                  <span style={{ ...s.badge, background: nivel.bg, color: nivel.color }}>{nivel.label}</span>
                </span>
              </div>
            )
          })}
          {ordenados.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#94A3B8' }}>Nenhum produto encontrado.</div>
          )}
        </div>
      )}

      {modoLote && qtdAlteracoesLote > 0 && (
        <div style={{ ...s.barraLote, bottom: isMobile ? 'calc(64px + env(safe-area-inset-bottom, 0px))' : 0, padding: isMobile ? '0.6rem 0.65rem' : '0.7rem 1rem' }}>
          <button type="button" style={s.btnCancelarLote} onClick={cancelarLote}><X size={16} /> Cancelar</button>
          <button type="button" style={{ ...s.btnSalvarLote, minWidth: 0 }} onClick={salvarLote} disabled={salvandoLote}>
            <Save size={16} /> {salvandoLote ? 'Salvando...' : `Salvar alterações (${qtdAlteracoesLote})`}
          </button>
        </div>
      )}
    </div>
  )
}

const s = {
  searchBox: { display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #CBD5E1', borderRadius: 12, padding: '0 0.72rem', minHeight: 40, background: '#fff' },
  searchInput: { border: 'none', outline: 'none', fontFamily: 'inherit', flex: 1, minWidth: 0, fontWeight: 600, fontSize: '0.86rem' },
  selectCategoria: { border: '1.5px solid #CBD5E1', background: '#fff', color: '#334155', borderRadius: 12, padding: '0 2.25rem 0 0.85rem', minHeight: 46, fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'inherit', maxWidth: '100%' },
  chip: { display: 'inline-flex', alignItems: 'center', gap: 6, border: '1.5px solid #CBD5E1', background: '#fff', color: '#64748B', borderRadius: 12, padding: '0 0.9rem', minHeight: 46, fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  chipAtivo: { background: '#003D7C', borderColor: '#003D7C', color: '#fff' },
  dicaLote: { background: '#EFF6FF', color: '#1D4ED8', borderRadius: 10, padding: '0.6rem 0.9rem', fontSize: '0.85rem', fontWeight: 600, margin: 0 },
  alertaAmarelo: { background: '#FEF3C7', color: '#92400E', padding: '0.75rem 1rem', borderRadius: 12, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 },
  permissaoInfo: { background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', padding: '0.7rem 0.9rem', borderRadius: 12, fontSize: '0.84rem', fontWeight: 700 },
  tabela: { background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  mCard: { display: 'flex', alignItems: 'flex-start', padding: '0.85rem 0.75rem', borderBottom: '1px solid #F1F5F9', gap: 10 },
  thumb: { borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  thead: { display: 'flex', padding: '0.75rem 1.25rem', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', fontWeight: 700, fontSize: '0.82rem', color: '#64748B', gap: 8, minWidth: 640, alignItems: 'center' },
  trow: { display: 'flex', padding: '0.7rem 1.25rem', borderBottom: '1px solid #F1F5F9', alignItems: 'center', gap: 8, fontSize: '0.88rem', minWidth: 640 },
  badge: { padding: '0.2rem 0.7rem', borderRadius: 20, fontWeight: 600, fontSize: '0.75rem' },
  minBadge: { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '0.1rem 0.5rem', borderRadius: 6, fontWeight: 700, fontSize: '0.75rem' },
  baixoTag: { display: 'inline-flex', alignItems: 'center', gap: 3, background: '#FEF3C7', color: '#B45309', fontSize: '0.68rem', fontWeight: 800, padding: '0.1rem 0.5rem', borderRadius: 6, flexShrink: 0 },
  inputEst: { width: 64, padding: '0.35rem 0.5rem', border: '2px solid #003D7C', borderRadius: 6, fontSize: '0.9rem' },
  btnIconEditar: { background: '#E8F0FB', color: '#003D7C', padding: '0.32rem', borderRadius: 8, fontWeight: 600, fontSize: '0.82rem', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
  btnIconSalvar: { background: '#D1FAE5', color: '#059669', padding: '0.32rem', borderRadius: 8, border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
  btnIconCancelar: { background: '#FEE2E2', color: '#EF4444', padding: '0.32rem', borderRadius: 8, border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
  barraLote: { position: 'fixed', left: 0, right: 0, bottom: 0, padding: '0.7rem 1rem', background: '#fff', borderTop: '1px solid #E2E8F0', boxShadow: '0 -8px 20px rgba(15,23,42,0.12)', zIndex: 110, display: 'flex', justifyContent: 'center', gap: 8 },
  btnCancelarLote: { background: '#FEE2E2', color: '#DC2626', border: 'none', borderRadius: 10, padding: '0.78rem 0.85rem', minHeight: 46, fontWeight: 900, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'inherit', flexShrink: 0 },
  btnSalvarLote: { background: '#003D7C', color: '#fff', border: 'none', borderRadius: 10, padding: '0.78rem 0.9rem', minHeight: 46, fontWeight: 900, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontFamily: 'inherit', flex: 1, maxWidth: 400 },
}
