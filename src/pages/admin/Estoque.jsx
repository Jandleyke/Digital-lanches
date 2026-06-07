import { useState } from 'react'
import Layout from '../../components/Layout'
import { useApp } from '../../contexts/AppContext'
import { estoqueNivel } from '../../utils/statusColors'
import { useIsMobile } from '../../utils/useIsMobile'

export default function Estoque() {
  const { produtos, atualizarProduto } = useApp()
  const isMobile = useIsMobile()
  const [editandoEstoque, setEditandoEstoque] = useState(null)
  const [novoEstoque, setNovoEstoque] = useState('')
  const [editandoMin, setEditandoMin] = useState(null)
  const [novoMin, setNovoMin] = useState('')

  async function salvarEstoque(produto) {
    await atualizarProduto({ ...produto, estoque: parseInt(novoEstoque) || 0 })
    setEditandoEstoque(null)
  }

  async function salvarMin(produto) {
    await atualizarProduto({ ...produto, estoqueBaixo: parseInt(novoMin) || 0 })
    setEditandoMin(null)
  }

  const comAlerta = produtos.filter(p => p.estoqueBaixo > 0 && p.estoque <= p.estoqueBaixo)
  const ordenados = [
    ...comAlerta.sort((a, b) => a.estoque - b.estoque),
    ...produtos.filter(p => !(p.estoqueBaixo > 0 && p.estoque <= p.estoqueBaixo)).sort((a, b) => a.nome.localeCompare(b.nome)),
  ]

  return (
    <Layout titulo="Controle de Estoque">
      {comAlerta.length > 0 && (
        <div style={s.alertaAmarelo}>
          ⚡ <strong>{comAlerta.length} produto(s)</strong> com estoque abaixo do mínimo configurado
        </div>
      )}

      {isMobile ? (
        <div style={s.tabela}>
          {ordenados.map(p => {
            const nivel = estoqueNivel(p.estoque, p.estoqueBaixo)
            const isAlerta = p.estoqueBaixo > 0 && p.estoque <= p.estoqueBaixo
            return (
              <div key={p.id} style={{ ...s.mCard, borderLeft: `3px solid ${nivel.color}`, background: isAlerta ? '#FFFBEB' : '#fff' }}>
                <div style={s.mThumb}>
                  {p.foto
                    ? <img src={p.foto} alt={p.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: '1.4rem' }}>{p.emoji}</span>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: '#1A202C', fontSize: '0.87rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nome}</div>

                  {/* Estoque atual */}
                  <div style={{ display: 'flex', gap: 5, marginTop: 3, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: 600 }}>Estoque:</span>
                    {editandoEstoque === p.id ? (
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <input style={{ ...s.inputEst, width: 50 }} type="number" value={novoEstoque} onChange={e => setNovoEstoque(e.target.value)} autoFocus />
                        <button style={s.btnSalvar} onClick={() => salvarEstoque(p)}>✓</button>
                        <button style={s.btnCancelar} onClick={() => setEditandoEstoque(null)}>✕</button>
                      </div>
                    ) : (
                      <>
                        <span style={{ ...s.badge, background: nivel.bg, color: nivel.color, fontWeight: 800 }}>{p.estoque} un</span>
                        <button style={s.btnEditar} onClick={() => { setEditandoEstoque(p.id); setNovoEstoque(String(p.estoque)) }}>✏️</button>
                      </>
                    )}
                  </div>

                  {/* Alerta mínimo */}
                  <div style={{ display: 'flex', gap: 5, marginTop: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: 600 }}>Alertar abaixo de:</span>
                    {editandoMin === p.id ? (
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <input style={{ ...s.inputEst, width: 50 }} type="number" value={novoMin} onChange={e => setNovoMin(e.target.value)} autoFocus placeholder="0" />
                        <button style={s.btnSalvar} onClick={() => salvarMin(p)}>✓</button>
                        <button style={s.btnCancelar} onClick={() => setEditandoMin(null)}>✕</button>
                      </div>
                    ) : (
                      <>
                        <span style={{ background: p.estoqueBaixo > 0 ? '#FEF3C7' : '#F1F5F9', color: p.estoqueBaixo > 0 ? '#B45309' : '#94A3B8', padding: '0.1rem 0.5rem', borderRadius: 6, fontWeight: 700, fontSize: '0.75rem' }}>
                          {p.estoqueBaixo > 0 ? `🔔 ${p.estoqueBaixo} un` : '— não definido'}
                        </span>
                        <button style={s.btnEditar} onClick={() => { setEditandoMin(p.id); setNovoMin(String(p.estoqueBaixo || '')) }}>✏️</button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
          {ordenados.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#94A3B8' }}>Nenhum produto cadastrado.</div>
          )}
        </div>
      ) : (
        <div style={{ ...s.tabela, overflowX: 'auto' }}>
          <div style={s.thead}>
            <span style={{ flex: 2 }}>Produto</span>
            <span style={{ flex: 1 }}>Categoria</span>
            <span style={{ flex: 1, textAlign: 'center' }}>Estoque atual</span>
            <span style={{ flex: 1, textAlign: 'center' }}>🔔 Alertar abaixo de</span>
            <span style={{ flex: 1 }}>Situação</span>
          </div>
          {ordenados.map(p => {
            const nivel = estoqueNivel(p.estoque, p.estoqueBaixo)
            const isAlerta = p.estoqueBaixo > 0 && p.estoque <= p.estoqueBaixo
            return (
              <div key={p.id} style={{ ...s.trow, background: isAlerta ? '#FFFBEB' : '#fff' }}>
                <span style={{ flex: 2, display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                  {p.emoji} {p.nome}
                  {isAlerta && <span style={{ background: '#FEF3C7', color: '#B45309', fontSize: '0.68rem', fontWeight: 800, padding: '0.1rem 0.5rem', borderRadius: 6 }}>⚡ Baixo</span>}
                </span>
                <span style={{ flex: 1, color: '#64748B', fontSize: '0.85rem' }}>{p.categoria}</span>

                {/* Estoque atual */}
                <span style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  {editandoEstoque === p.id ? (
                    <>
                      <input style={s.inputEst} type="number" value={novoEstoque} onChange={e => setNovoEstoque(e.target.value)} autoFocus />
                      <button style={s.btnSalvar} onClick={() => salvarEstoque(p)}>✓</button>
                      <button style={s.btnCancelar} onClick={() => setEditandoEstoque(null)}>✕</button>
                    </>
                  ) : (
                    <>
                      <strong style={{ color: nivel.color, fontSize: '1rem' }}>{p.estoque}</strong>
                      <span style={{ ...s.badge, background: nivel.bg, color: nivel.color }}>{nivel.label}</span>
                      <button style={s.btnEditar} onClick={() => { setEditandoEstoque(p.id); setNovoEstoque(String(p.estoque)) }}>✏️</button>
                    </>
                  )}
                </span>

                {/* Threshold */}
                <span style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  {editandoMin === p.id ? (
                    <>
                      <input style={s.inputEst} type="number" value={novoMin} onChange={e => setNovoMin(e.target.value)} autoFocus placeholder="0" />
                      <button style={s.btnSalvar} onClick={() => salvarMin(p)}>✓</button>
                      <button style={s.btnCancelar} onClick={() => setEditandoMin(null)}>✕</button>
                    </>
                  ) : (
                    <>
                      <span style={{ color: p.estoqueBaixo > 0 ? '#B45309' : '#CBD5E1', fontWeight: p.estoqueBaixo > 0 ? 700 : 400, fontSize: '0.88rem' }}>
                        {p.estoqueBaixo > 0 ? `${p.estoqueBaixo} un` : '—'}
                      </span>
                      <button style={{ ...s.btnEditar, fontSize: '0.75rem', padding: '0.2rem 0.5rem' }} onClick={() => { setEditandoMin(p.id); setNovoMin(String(p.estoqueBaixo || '')) }}>
                        {p.estoqueBaixo > 0 ? '✏️' : '+ Definir'}
                      </button>
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
            <div style={{ textAlign: 'center', padding: '2rem', color: '#94A3B8' }}>Nenhum produto cadastrado.</div>
          )}
        </div>
      )}
    </Layout>
  )
}

const s = {
  alertaAmarelo: { background: '#FEF3C7', color: '#D97706', padding: '0.75rem 1rem', borderRadius: 10, fontSize: '0.9rem', marginBottom: '1.25rem' },
  tabela: { background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  mCard: { display: 'flex', alignItems: 'flex-start', padding: '0.85rem 0.75rem', borderBottom: '1px solid #F1F5F9', gap: 10 },
  mThumb: { width: 44, height: 44, borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  thead: { display: 'flex', padding: '0.75rem 1.25rem', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', fontWeight: 700, fontSize: '0.82rem', color: '#64748B', gap: 8, minWidth: 640 },
  trow: { display: 'flex', padding: '0.85rem 1.25rem', borderBottom: '1px solid #F1F5F9', alignItems: 'center', gap: 8, fontSize: '0.88rem', minWidth: 640 },
  badge: { padding: '0.2rem 0.7rem', borderRadius: 20, fontWeight: 600, fontSize: '0.75rem' },
  inputEst: { width: 64, padding: '0.35rem 0.5rem', border: '2px solid #003D7C', borderRadius: 6, fontSize: '0.9rem' },
  btnEditar: { background: '#E8F0FB', color: '#003D7C', padding: '0.25rem 0.55rem', borderRadius: 6, fontWeight: 600, fontSize: '0.82rem', border: 'none', cursor: 'pointer' },
  btnSalvar: { background: '#D1FAE5', color: '#059669', padding: '0.3rem 0.55rem', borderRadius: 6, fontWeight: 700, border: 'none', cursor: 'pointer' },
  btnCancelar: { background: '#FEE2E2', color: '#EF4444', padding: '0.3rem 0.5rem', borderRadius: 6, fontWeight: 700, border: 'none', cursor: 'pointer' },
}
