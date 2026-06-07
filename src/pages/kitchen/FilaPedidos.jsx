import { useState, useEffect, useMemo } from 'react'
import Layout from '../../components/Layout'
import { useApp } from '../../contexts/AppContext'
import { useIsMobile } from '../../utils/useIsMobile'
import { Clock, AlertTriangle } from 'lucide-react'
import AvisosBanner from '../../components/AvisosBanner'

const COLUNAS = [
  { status: 'Recebido', cor: '#F59E0B', bg: '#FFFBEB', label: 'Recebido' },
  { status: 'Pronto',   cor: '#22C55E', bg: '#F0FDF4', label: 'Pronto' },
  { status: 'Entregue', cor: '#94A3B8', bg: '#F8FAFC', label: 'Entregue' },
]

const PROXIMO = {
  'Recebido': 'Pronto',
  'Pronto': 'Entregue',
}


function useTick() {
  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  return agora
}

function Cronometro({ criadoEm, status }) {
  const agora = useTick()
  if (!criadoEm || status === 'Entregue' || status === 'Cancelado') return null
  const segundos = Math.floor((agora - criadoEm) / 1000)
  const min = Math.floor(segundos / 60)
  const seg = segundos % 60
  const atrasado = min >= 15 && status !== 'Entregue' && status !== 'Cancelado'
  return (
    <span style={{
      fontSize: '0.7rem', fontWeight: 700,
      color: atrasado ? '#DC2626' : '#64748B',
      background: atrasado ? '#FEE2E2' : '#F1F5F9',
      padding: '0.15rem 0.5rem', borderRadius: 8, display: 'inline-block',
    }}>
      {atrasado && <AlertTriangle size={10} strokeWidth={2.5} style={{ marginRight: 3 }} />}
      {String(min).padStart(2, '0')}:{String(seg).padStart(2, '0')}
    </span>
  )
}

export default function FilaPedidos() {
  const { pedidos, produtos, usuarios, atualizarStatusPedido, cancelarPedido, editarPedido, limparEntregues, fbStatus, fbDebug, testarFirebase } = useApp()
  const isMobile = useIsMobile()
  const [avancar, setAvancar] = useState({})
  const [colunaMobile, setColunaMobile] = useState(0)
  const [detalhe, setDetalhe] = useState(null)
  const [editando, setEditando] = useState(false)
  const [editForm, setEditForm] = useState({ pagamento: '', horarioRetirada: '', itens: [] })
  const [adicionando, setAdicionando] = useState(false)
  const [buscaProduto, setBuscaProduto] = useState('')
  const [verAluno, setVerAluno] = useState(false)
  const [resumoAberto, setResumoAberto] = useState(true)
  const [verTodos, setVerTodos] = useState(false)
  const [buscaPedido, setBuscaPedido] = useState('')

  const resumoProducao = useMemo(() => {
    const pendentes = pedidos.filter(p => p.status === 'Recebido')
    const mapa = new Map()
    pendentes.forEach(pedido => {
      pedido.itens.forEach(item => {
        const atual = mapa.get(item.nome) || { quantidade: 0, pedidos: 0 }
        mapa.set(item.nome, { quantidade: atual.quantidade + item.quantidade, pedidos: atual.pedidos + 1 })
      })
    })
    return [...mapa.entries()]
      .map(([nome, dados]) => ({ nome, ...dados }))
      .sort((a, b) => b.quantidade - a.quantidade)
  }, [pedidos])

  const pedidosFiltrados = useMemo(() => {
    const b = buscaPedido.trim().toLowerCase()
    return [...pedidos]
      .sort((a, c) => (c.criadoEm || 0) - (a.criadoEm || 0))
      .filter(p => {
        if (!b) return true
        return p.aluno?.toLowerCase().includes(b) || p.id.slice(-6).toLowerCase().includes(b) || p.matricula?.toLowerCase().includes(b)
      })
  }, [pedidos, buscaPedido])

  async function handleAvancar(pedido) {
    const prox = PROXIMO[pedido.status]
    if (!prox) return
    setAvancar(prev => ({ ...prev, [pedido.id]: true }))
    await atualizarStatusPedido(pedido.id, prox)
    setAvancar(prev => ({ ...prev, [pedido.id]: false }))
  }

  async function handleCancelarCozinha(pedido) {
    if (!confirm(`Cancelar pedido #${pedido.id.slice(-6)} de ${pedido.aluno}?`)) return
    await cancelarPedido(pedido.id, 'Cancelado pela cozinha')
  }

  const agora = useTick()
  const total = pedidos.length
  const ativos = pedidos.filter(p => p.status !== 'Entregue' && p.status !== 'Cancelado').length
  const atrasados = pedidos.filter(p => p.status === 'Recebido' && p.criadoEm && Math.floor((agora - p.criadoEm) / 60000) >= 15).length

  const tempoMedioPreparo = useMemo(() => {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
    const comTempo = pedidos.filter(p => p.criadoEm && p.prontoEm && p.criadoEm >= hoje.getTime())
    if (comTempo.length === 0) return null
    const somaMin = comTempo.reduce((acc, p) => acc + (p.prontoEm - p.criadoEm), 0) / 60000
    return Math.round(somaMin / comTempo.length)
  }, [pedidos])

  const colunasExibidas = isMobile ? [COLUNAS[colunaMobile]] : COLUNAS

  return (
    <Layout titulo="Fila de Pedidos">
      <AvisosBanner perfil="cozinha" />
      <div style={{ ...s.topBar, flexWrap: 'nowrap', alignItems: 'center' }}>
        <div style={s.statsRow}>
          <button style={{ ...s.statChip, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => setVerTodos(true)}>
            🔍 <strong>{total}</strong> total
          </button>
          <div style={{ ...s.statChip, background: '#DBEAFE', color: '#1D4ED8' }}><strong>{ativos}</strong> ativos</div>
          {atrasados > 0 && (
            <div style={{ ...s.statChip, background: '#FEE2E2', color: '#DC2626', display: 'flex', alignItems: 'center', gap: 4 }}>
              <AlertTriangle size={12} strokeWidth={2.5} />
              <strong>{atrasados}</strong> atrasado{atrasados > 1 ? 's' : ''}
            </div>
          )}
          {tempoMedioPreparo !== null && (
            <div style={{ ...s.statChip, background: '#F0FDF4', color: '#15803D', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={12} strokeWidth={2.5} />
              tempo médio hoje: <strong>{tempoMedioPreparo} min</strong>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', flexShrink: 0 }}>
          {(!isMobile || fbStatus !== 'ok') && (
            <div style={{ ...s.fbBadge, background: fbStatus === 'ok' ? '#D1FAE5' : '#FEF3C7', color: fbStatus === 'ok' ? '#065F46' : '#92400E', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: fbStatus === 'ok' ? '#22C55E' : '#F59E0B', display: 'inline-block', flexShrink: 0 }} />
              {!isMobile && fbStatus}
            </div>
          )}
          {fbStatus !== 'ok' && (
            <button style={s.testeBtn} onClick={testarFirebase}>Testar</button>
          )}
        </div>
      </div>

      {fbDebug && fbStatus !== 'ok' && (
        <div style={s.debugMsg}>{fbDebug}</div>
      )}

      {/* Resumo de produção — agrega itens de todos os pedidos "Recebido" */}
      {resumoProducao.length > 0 && (
        <div style={s.resumo}>
          <button style={s.resumoHeader} onClick={() => setResumoAberto(v => !v)}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              📋 <strong>O que produzir agora</strong>
              <span style={{ ...s.colunaBadge, background: '#F59E0B' }}>{resumoProducao.reduce((a, i) => a + i.quantidade, 0)}</span>
            </span>
            <span style={{ fontSize: '0.8rem', color: '#94A3B8' }}>{resumoAberto ? '▲ ocultar' : '▼ mostrar'}</span>
          </button>
          {resumoAberto && (
            <div style={s.resumoLista}>
              {resumoProducao.map(item => (
                <div key={item.nome} style={s.resumoItem}>
                  <span style={s.resumoQtd}>{item.quantidade}×</span>
                  <span style={s.resumoNome}>{item.nome}</span>
                  <span style={s.resumoPedidos}>{item.pedidos} {item.pedidos === 1 ? 'pedido' : 'pedidos'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal: buscar / ver todos os pedidos */}
      {verTodos && (
        <div style={s.overlay} onClick={() => { setVerTodos(false); setBuscaPedido('') }}>
          <div style={{ ...s.modal, maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
              <strong style={{ fontSize: '1.1rem', color: '#003D7C' }}>Todos os pedidos ({pedidosFiltrados.length})</strong>
              <button onClick={() => { setVerTodos(false); setBuscaPedido('') }}
                style={{ background: '#F1F5F9', border: 'none', borderRadius: 8, width: 32, height: 32, fontSize: '1.1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>

            <input
              autoFocus
              type="text"
              placeholder="🔍 Buscar por aluno, matrícula ou código..."
              value={buscaPedido}
              onChange={e => setBuscaPedido(e.target.value)}
              style={{ width: '100%', padding: '0.65rem 0.9rem', border: '2px solid #E2E8F0', borderRadius: 8, fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box', marginBottom: '0.75rem' }}
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '60vh', overflowY: 'auto' }}>
              {pedidosFiltrados.length === 0 && (
                <div style={s.vazio}>Nenhum pedido encontrado</div>
              )}
              {pedidosFiltrados.map(pedido => {
                const col = COLUNAS.find(c => c.status === pedido.status)
                const cor = col?.cor || '#94A3B8'
                return (
                  <button key={pedido.id}
                    onClick={() => { setVerTodos(false); setBuscaPedido(''); setDetalhe(pedido) }}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#F8FAFC', border: 'none', borderLeft: `4px solid ${cor}`, borderRadius: 8, padding: '0.55rem 0.8rem', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <strong style={{ fontSize: '0.85rem', color: '#1A202C' }}>#{pedido.id.slice(-6).toUpperCase()}</strong>
                        <span style={{ fontSize: '0.78rem', color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pedido.aluno}</span>
                      </div>
                      <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>{pedido.horarioPedido} · Retirada {pedido.horarioRetirada}</span>
                    </div>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: cor, whiteSpace: 'nowrap' }}>{pedido.status}</span>
                    <strong style={{ fontSize: '0.85rem', color: '#003D7C', whiteSpace: 'nowrap' }}>R$ {pedido.total.toFixed(2).replace('.', ',')}</strong>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Seletor de coluna no mobile */}
      {isMobile && (
        <div style={s.tabsMobile}>
          {COLUNAS.map((col, i) => {
            const qtd = pedidos.filter(p => p.status === col.status).length
            return (
              <button key={col.status}
                style={{ ...s.tabMobile, ...(colunaMobile === i ? { borderBottom: `3px solid ${col.cor}`, color: col.cor, fontWeight: 700 } : {}) }}
                onClick={() => setColunaMobile(i)}>
                {col.status}
                {qtd > 0 && <span style={{ ...s.tabBadge, background: col.cor }}>{qtd}</span>}
              </button>
            )
          })}
        </div>
      )}

      {/* Modal de detalhes / edição do pedido */}
      {detalhe && (
        <div style={s.overlay} onClick={() => { setDetalhe(null); setEditando(false); setVerAluno(false); setBuscaProduto('') }}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>

            {/* Cabeçalho */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <p style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', margin: 0 }}>Código de retirada</p>
                <strong style={{ fontSize: '2rem', color: '#003D7C', letterSpacing: 2, fontVariantNumeric: 'tabular-nums' }}>
                  #{detalhe.id.slice(-6).toUpperCase()}
                </strong>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {!editando && detalhe.status !== 'Entregue' && detalhe.status !== 'Cancelado' && (
                  <button onClick={() => { setEditando(true); setAdicionando(false); setEditForm({ pagamento: detalhe.pagamento, horarioRetirada: detalhe.horarioRetirada, itens: detalhe.itens.map(i => ({ ...i })) }) }}
                    style={{ background: '#E8F0FB', color: '#003D7C', border: 'none', borderRadius: 8, padding: '0.3rem 0.75rem', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>
                    ✏️ Editar
                  </button>
                )}
                <button onClick={() => { setDetalhe(null); setEditando(false) }}
                  style={{ background: '#F1F5F9', border: 'none', borderRadius: 8, width: 32, height: 32, fontSize: '1.1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              </div>
            </div>

            {editando ? (
              /* ── Modo edição ── */
              (() => {
                const totalEdit = editForm.itens.reduce((a, i) => a + i.preco * i.quantidade, 0)
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                    <div style={s.modalSecao}>
                      <p style={s.modalLabel}>Aluno</p>
                      <p style={{ ...s.modalValor, margin: 0 }}>{detalhe.aluno}</p>
                      {detalhe.matricula && <span style={{ background: '#E8F0FB', color: '#003D7C', fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.7rem', borderRadius: 20 }}>Matrícula: {detalhe.matricula}</span>}
                    </div>

                    {/* Itens */}
                    <div>
                      <p style={s.modalLabel}>Itens do pedido</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                        {editForm.itens.map((item, idx) => (
                          <div key={item.produtoId} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F8FAFC', borderRadius: 8, padding: '0.4rem 0.7rem' }}>
                            <span style={{ flex: 1, fontSize: '0.85rem', color: '#1A202C' }}>{item.nome}</span>
                            <span style={{ fontSize: '0.78rem', color: '#64748B' }}>R$ {item.preco.toFixed(2).replace('.', ',')}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <button onClick={() => setEditForm(f => ({ ...f, itens: f.itens.map((i, j) => j === idx ? { ...i, quantidade: Math.max(1, i.quantidade - 1) } : i) }))}
                                style={s.qtdBtn}>−</button>
                              <strong style={{ minWidth: 18, textAlign: 'center', fontSize: '0.9rem' }}>{item.quantidade}</strong>
                              <button onClick={() => setEditForm(f => ({ ...f, itens: f.itens.map((i, j) => j === idx ? { ...i, quantidade: i.quantidade + 1 } : i) }))}
                                style={s.qtdBtn}>+</button>
                            </div>
                            <button onClick={() => setEditForm(f => ({ ...f, itens: f.itens.filter((_, j) => j !== idx) }))}
                              style={{ background: '#FEE2E2', color: '#DC2626', border: 'none', borderRadius: 6, width: 26, height: 26, cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}>✕</button>
                          </div>
                        ))}
                      </div>

                      {/* Adicionar produto */}
                      <button onClick={() => setAdicionando(v => !v)}
                        style={{ marginTop: 8, width: '100%', padding: '0.5rem', borderRadius: 8, border: '2px dashed #CBD5E1', background: 'none', color: '#64748B', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>
                        {adicionando ? '▲ Fechar lista' : '➕ Adicionar produto'}
                      </button>

                      {adicionando && (
                        <div style={{ marginTop: 6, border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden' }}>
                          <div style={{ padding: '0.4rem 0.6rem', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
                            <input
                              autoFocus
                              type="text"
                              placeholder="🔍 Buscar produto..."
                              value={buscaProduto}
                              onChange={e => setBuscaProduto(e.target.value)}
                              style={{ width: '100%', border: 'none', background: 'none', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }}
                            />
                          </div>
                          <div style={{ maxHeight: 160, overflowY: 'auto' }}>
                          {produtos.filter(p => (p.estoque > 0 || editForm.itens.find(i => i.produtoId === p.id)) && p.nome.toLowerCase().includes(buscaProduto.toLowerCase())).map(p => (
                            <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.45rem 0.75rem', borderBottom: '1px solid #F1F5F9' }}>
                              <span style={{ fontSize: '0.82rem', color: '#1A202C' }}>{p.emoji} {p.nome}</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: '0.78rem', color: '#64748B' }}>R$ {p.preco.toFixed(2).replace('.', ',')}</span>
                                <button onClick={() => setEditForm(f => {
                                  const existe = f.itens.findIndex(i => i.produtoId === p.id)
                                  if (existe >= 0) return { ...f, itens: f.itens.map((i, j) => j === existe ? { ...i, quantidade: i.quantidade + 1 } : i) }
                                  return { ...f, itens: [...f.itens, { produtoId: p.id, nome: p.nome, quantidade: 1, preco: p.preco }] }
                                })}
                                  style={{ background: '#003D7C', color: '#fff', border: 'none', borderRadius: 6, padding: '0.2rem 0.65rem', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem' }}>+ Adicionar</button>
                              </div>
                            </div>
                          ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Pagamento */}
                    <div>
                      <p style={s.modalLabel}>Forma de pagamento</p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 6 }}>
                        {['PIX', 'Crédito', 'Débito', 'Dinheiro'].map(op => (
                          <button key={op}
                            style={{ padding: '0.55rem', borderRadius: 8, fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit',
                              border: `2px solid ${editForm.pagamento === op ? '#003D7C' : '#E2E8F0'}`,
                              background: editForm.pagamento === op ? '#E8F0FB' : '#fff',
                              color: editForm.pagamento === op ? '#003D7C' : '#64748B' }}
                            onClick={() => setEditForm(f => ({ ...f, pagamento: op }))}>
                            {op}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Horário */}
                    <div>
                      <p style={s.modalLabel}>Horário de retirada</p>
                      <input type="time" value={editForm.horarioRetirada}
                        onChange={e => setEditForm(f => ({ ...f, horarioRetirada: e.target.value }))}
                        style={{ width: '100%', padding: '0.65rem 0.9rem', border: '2px solid #E2E8F0', borderRadius: 8, fontSize: '1rem', boxSizing: 'border-box', marginTop: 6 }} />
                    </div>

                    {/* Total */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '2px solid #F1F5F9', paddingTop: '0.6rem' }}>
                      <span style={{ fontWeight: 600, color: '#64748B', fontSize: '0.85rem' }}>Novo total</span>
                      <strong style={{ fontSize: '1.2rem', color: '#003D7C' }}>R$ {totalEdit.toFixed(2).replace('.', ',')}</strong>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button style={{ flex: 1, padding: '0.65rem', borderRadius: 8, border: '2px solid #E2E8F0', background: '#fff', fontWeight: 600, color: '#64748B', cursor: 'pointer' }}
                        onClick={() => { setEditando(false); setAdicionando(false) }}>Cancelar</button>
                      <button
                        disabled={editForm.itens.length === 0}
                        style={{ flex: 2, padding: '0.65rem', borderRadius: 8, border: 'none', background: editForm.itens.length === 0 ? '#CBD5E1' : '#003D7C', color: '#fff', fontWeight: 700, fontSize: '0.95rem', cursor: editForm.itens.length === 0 ? 'not-allowed' : 'pointer' }}
                        onClick={async () => {
                          const updates = { pagamento: editForm.pagamento, horarioRetirada: editForm.horarioRetirada, itens: editForm.itens, total: totalEdit }
                          await editarPedido(detalhe.id, updates, detalhe.itens)
                          setEditando(false); setAdicionando(false)
                          setDetalhe(prev => ({ ...prev, ...updates }))
                        }}>
                        💾 Salvar alterações
                      </button>
                    </div>
                  </div>
                )
              })()
            ) : (
              /* ── Modo visualização ── */
              <>
                {/* Aluno — clicável para ver perfil */}
                <div style={s.modalSecao}>
                  <p style={s.modalLabel}>Aluno</p>
                  <button
                    onClick={() => setVerAluno(v => !v)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    <p style={{ ...s.modalValor, margin: 0, textDecoration: 'underline dotted', color: '#003D7C' }}>{detalhe.aluno}</p>
                    <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>{verAluno ? '▲ fechar' : '▼ ver info'}</span>
                  </button>
                  {verAluno && (() => {
                    const u = usuarios.find(u => u.matricula === detalhe.matricula)
                    return u ? (
                      <div style={{ marginTop: 10, background: '#F8FAFC', borderRadius: 10, padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {[
                          ['Matrícula', u.matricula],
                          ['Curso', u.curso || '—'],
                          ['Telefone', u.telefone || '—'],
                          ['E-mail', u.email || '—'],
                          ['Alergias', u.alergias?.length ? u.alergias.join(', ') : 'Nenhuma'],
                        ].map(([label, val]) => (
                          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                            <span style={{ fontSize: '0.76rem', color: '#94A3B8', fontWeight: 600 }}>{label}</span>
                            <span style={{ fontSize: '0.78rem', color: '#1A202C', fontWeight: 500, textAlign: 'right' }}>{val}</span>
                          </div>
                        ))}
                      </div>
                    ) : <p style={{ fontSize: '0.78rem', color: '#94A3B8', marginTop: 6 }}>Dados não encontrados.</p>
                  })()}
                </div>

                <div style={s.modalSecao}>
                  <p style={s.modalLabel}>Pagamento</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <p style={{ ...s.modalValor, margin: 0 }}>{detalhe.pagamento}</p>
                    <span style={{ background: detalhe.pago ? '#D1FAE5' : '#FEF3C7', color: detalhe.pago ? '#065F46' : '#92400E', fontSize: '0.78rem', fontWeight: 700, padding: '0.2rem 0.7rem', borderRadius: 20 }}>
                      {detalhe.pago ? '✓ Pago' : 'Pendente'}
                    </span>
                  </div>
                </div>

                <div style={s.modalSecao}>
                  <p style={s.modalLabel}>Itens do pedido</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {detalhe.itens.map((item, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC', padding: '0.4rem 0.75rem', borderRadius: 8 }}>
                        <span style={{ fontSize: '0.9rem', color: '#1A202C' }}><strong>{item.quantidade}×</strong> {item.nome}</span>
                        <span style={{ fontSize: '0.85rem', color: '#64748B', fontWeight: 600 }}>R$ {(item.preco * item.quantidade).toFixed(2).replace('.', ',')}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '2px solid #F1F5F9', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                  <div>
                    <p style={{ ...s.modalLabel, marginBottom: 2 }}>Retirada hoje às</p>
                    <strong style={{ fontSize: '1.1rem', color: '#003D7C' }}>{detalhe.horarioRetirada}</strong>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ ...s.modalLabel, marginBottom: 2 }}>Total</p>
                    <strong style={{ fontSize: '1.3rem', color: '#003D7C' }}>R$ {detalhe.total.toFixed(2).replace('.', ',')}</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: '1rem' }}>
                  {detalhe.status === 'Recebido' && (
                    <button style={{ ...s.avancarBtn, background: '#FEE2E2', color: '#DC2626', padding: '0.6rem 1rem' }}
                      onClick={() => { handleCancelarCozinha(detalhe); setDetalhe(null) }}>
                      ✕ Cancelar
                    </button>
                  )}
                  {PROXIMO[detalhe.status] && (
                    <button
                      style={{ ...s.avancarBtn, flex: 1, padding: '0.65rem 1rem', fontSize: '0.9rem', background: COLUNAS.find(c => c.status === detalhe.status)?.cor || '#003D7C', opacity: avancar[detalhe.id] ? 0.6 : 1 }}
                      onClick={() => { handleAvancar(detalhe); setDetalhe(null) }}
                      disabled={avancar[detalhe.id]}>
                      {avancar[detalhe.id] ? '...' : `→ ${PROXIMO[detalhe.status]}`}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Kanban */}
      <div style={{ ...s.kanban, gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)' }}>
        {colunasExibidas.map(col => {
          const cards = pedidos
            .filter(p => p.status === col.status)
            .sort((a, b) => (a.criadoEm || 0) - (b.criadoEm || 0))
          return (
            <div key={col.status} style={s.coluna}>
              <div style={{ ...s.colunaHeader, borderBottom: `3px solid ${col.cor}`, background: col.bg }}>
                <span style={s.colunaLabel}>{col.label}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {col.status === 'Entregue' && cards.length > 0 && (
                    <button
                      style={{ background: '#FEE2E2', color: '#DC2626', border: 'none', borderRadius: 8, padding: '0.2rem 0.6rem', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}
                      onClick={() => { if (confirm(`Apagar ${cards.length} pedido(s) entregue(s)?`)) limparEntregues() }}>
                      🗑️ Limpar
                    </button>
                  )}
                  <span style={{ ...s.colunaBadge, background: col.cor }}>{cards.length}</span>
                </div>
              </div>

              <div style={s.cards}>
                {cards.length === 0 && (
                  <div style={s.vazio}>Nenhum pedido</div>
                )}
                {cards.map(pedido => (
                  <div key={pedido.id}
                    style={{ ...s.card, borderLeft: `4px solid ${col.cor}`, cursor: 'pointer' }}
                    onClick={() => setDetalhe(pedido)}
                  >
                    <div style={s.cardTop}>
                      <div>
                        <strong style={s.cardId}>#{pedido.id.slice(-6)}</strong>
                        <span style={s.cardAluno}>{pedido.aluno}</span>
                        <div style={{ marginTop: 3 }}>
                          <Cronometro criadoEm={pedido.criadoEm} status={pedido.status} />
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={s.cardHora}>{pedido.horarioPedido}</span>
                        <span style={s.cardRetirada}>Retirada: {pedido.horarioRetirada}</span>
                      </div>
                    </div>

                    <div style={s.itens}>
                      {pedido.itens.map((item, i) => (
                        <span key={i} style={s.itemPill}>
                          <strong style={{ color: col.cor }}>{item.quantidade}×</strong> {item.nome}
                        </span>
                      ))}
                    </div>

                    <div style={{ ...s.cardFooter, flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 8 : 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                        <span style={s.cardTotal}>R$ {pedido.total.toFixed(2).replace('.', ',')}</span>
                        <span style={{ ...s.pagPill, background: pedido.pago ? '#D1FAE5' : '#FEF3C7', color: pedido.pago ? '#065F46' : '#92400E' }}>
                          {pedido.pagamento} · {pedido.pago ? 'Pago' : 'Pendente'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 6, width: '100%' }} onClick={e => e.stopPropagation()}>
                        {pedido.status === 'Recebido' && (
                          <button style={{ ...s.avancarBtn, background: '#FEE2E2', color: '#DC2626', padding: isMobile ? '0.5rem 0.9rem' : '0.35rem 0.75rem' }}
                            onClick={() => handleCancelarCozinha(pedido)}>
                            ✕ Cancelar
                          </button>
                        )}
                        {PROXIMO[pedido.status] && (
                          <button
                            style={{ ...s.avancarBtn, background: col.cor, opacity: avancar[pedido.id] ? 0.6 : 1, flex: 1, padding: isMobile ? '0.55rem 0.9rem' : '0.35rem 0.75rem', fontSize: isMobile ? '0.82rem' : '0.75rem' }}
                            onClick={() => handleAvancar(pedido)}
                            disabled={avancar[pedido.id]}
                          >
                            {avancar[pedido.id] ? '...' : `→ ${PROXIMO[pedido.status]}`}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </Layout>
  )
}

const s = {
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: '0.75rem' },
  statsRow: { display: 'flex', gap: 8 },
  statChip: { padding: '0.3rem 0.9rem', borderRadius: 20, background: '#F1F5F9', color: '#475569', fontWeight: 700, fontSize: '0.82rem' },
  fbBadge: { padding: '0.3rem 0.8rem', borderRadius: 20, fontSize: '0.78rem', fontWeight: 600 },
  testeBtn: { padding: '0.3rem 0.8rem', borderRadius: 20, border: '1.5px solid #CBD5E1', background: '#fff', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' },
  debugMsg: { fontSize: '0.75rem', color: '#64748B', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '0.35rem 0.8rem', fontFamily: 'monospace', marginBottom: '0.75rem' },
  resumo: { background: '#fff', border: '2px solid #FEF3C7', borderRadius: 14, marginBottom: '0.75rem', overflow: 'hidden' },
  resumoHeader: { width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.7rem 1rem', background: '#FFFBEB', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.9rem', color: '#1A202C', boxSizing: 'border-box' },
  resumoLista: { display: 'flex', flexDirection: 'column', padding: '0.4rem 0.6rem' },
  resumoItem: { display: 'flex', alignItems: 'center', gap: 10, padding: '0.45rem 0.6rem', borderBottom: '1px solid #F1F5F9' },
  resumoQtd: { fontWeight: 800, color: '#F59E0B', fontSize: '1rem', minWidth: 36 },
  resumoNome: { flex: 1, fontSize: '0.86rem', color: '#1A202C', fontWeight: 600 },
  resumoPedidos: { fontSize: '0.72rem', color: '#94A3B8', fontWeight: 600, whiteSpace: 'nowrap' },
  tabsMobile: { display: 'flex', borderBottom: '2px solid #E2E8F0', marginBottom: '0.75rem', overflowX: 'auto' },
  tabMobile: { flex: 1, padding: '0.55rem 0.5rem', background: 'none', color: '#64748B', fontSize: '0.78rem', fontWeight: 500, borderBottom: '3px solid transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, whiteSpace: 'nowrap' },
  tabBadge: { color: '#fff', borderRadius: '50%', width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.68rem', fontWeight: 800 },
  kanban: { display: 'grid', gap: '0.75rem', minWidth: 0 },
  coluna: { minWidth: 0, display: 'flex', flexDirection: 'column', background: '#F8FAFC', borderRadius: 14, overflow: 'hidden' },
  colunaHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem' },
  colunaLabel: { fontWeight: 700, fontSize: '0.88rem', color: '#1A202C' },
  colunaBadge: { color: '#fff', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.78rem', flexShrink: 0 },
  cards: { padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 },
  vazio: { textAlign: 'center', padding: '1.5rem 0', color: '#CBD5E1', fontSize: '0.82rem' },
  card: { background: '#fff', borderRadius: 10, padding: '0.8rem', boxShadow: '0 1px 6px rgba(0,0,0,0.07)' },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  cardId: { display: 'block', fontSize: '0.88rem', color: '#1A202C' },
  cardAluno: { display: 'block', fontSize: '0.76rem', color: '#64748B', marginTop: 1 },
  cardHora: { display: 'block', fontSize: '0.72rem', color: '#94A3B8', textAlign: 'right' },
  cardRetirada: { display: 'block', fontSize: '0.72rem', color: '#64748B', textAlign: 'right' },
  itens: { display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 10 },
  itemPill: { fontSize: '0.78rem', color: '#475569', background: '#F1F5F9', padding: '0.2rem 0.6rem', borderRadius: 6 },
  cardFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  cardTotal: { fontWeight: 800, color: '#003D7C', fontSize: '0.88rem', display: 'block' },
  pagPill: { fontSize: '0.7rem', fontWeight: 600, padding: '0.15rem 0.5rem', borderRadius: 10 },
  avancarBtn: { color: '#fff', padding: '0.35rem 0.75rem', borderRadius: 8, fontWeight: 700, fontSize: '0.75rem', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' },
  qtdBtn: { width: 26, height: 26, borderRadius: 6, background: '#E2E8F0', border: 'none', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: '1rem' },
  modal: { background: '#fff', borderRadius: 16, padding: '1.5rem', width: '100%', maxWidth: 440, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.2)' },
  modalSecao: { marginBottom: '0.85rem', paddingBottom: '0.85rem', borderBottom: '1px solid #F1F5F9' },
  modalLabel: { fontSize: '0.72rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px' },
  modalValor: { fontSize: '1rem', color: '#1A202C', fontWeight: 700, margin: '0 0 4px' },
}
