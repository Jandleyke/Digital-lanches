import { useState, useRef } from 'react'
import Layout from '../../components/Layout'
import { useApp } from '../../contexts/AppContext'
import { categorias } from '../../data/mockData'
import { estoqueNivel } from '../../utils/statusColors'
import { formatPrice } from '../../utils/formatters'
import { useIsMobile } from '../../utils/useIsMobile'

const vazioNutri = { calorias: '', proteinas: '', carboidratos: '', gorduras: '', sodio: '' }
const vazio = { nome: '', categoria: 'Lanches', preco: '', descricao: '', emoji: '🍔', estoque: '', estoqueBaixo: '', disponivel: true, foto: '', nutricional: { ...vazioNutri }, alergenios: [] }

const ALERGENOS_PADRAO = ['gluten', 'lactose', 'amendoim', 'ovo', 'soja', 'frutos-do-mar']

const GRADIENTS = [
  'linear-gradient(135deg,#FF6B35,#F7C59F)',
  'linear-gradient(135deg,#3B82F6,#93C5FD)',
  'linear-gradient(135deg,#22C55E,#86EFAC)',
  'linear-gradient(135deg,#A855F7,#DDD6FE)',
  'linear-gradient(135deg,#EF4444,#FCA5A5)',
  'linear-gradient(135deg,#F59E0B,#FDE68A)',
]

function comprimirImagem(base64, maxPx = 400, qualidade = 0.72) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      if (width > maxPx || height > maxPx) {
        if (width >= height) { height = Math.round(height * maxPx / width); width = maxPx }
        else { width = Math.round(width * maxPx / height); height = maxPx }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', qualidade))
    }
    img.src = base64
  })
}

export default function Produtos() {
  const { produtos, atualizarProduto, adicionarProduto, removerProduto, removerProdutos } = useApp()
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(vazio)
  const [confirmarExcluir, setConfirmarExcluir] = useState(null)
  const [erroExcluir, setErroExcluir] = useState('')
  const [excluindo, setExcluindo] = useState(false)
  const [detalhe, setDetalhe] = useState(null)
  const [modoSelecao, setModoSelecao] = useState(false)
  const [selecionados, setSelecionados] = useState([])
  const [confirmandoLote, setConfirmandoLote] = useState(false)
  const [abaModal, setAbaModal] = useState('geral')
  const [salvando, setSalvando] = useState(false)
  const [erroSalvar, setErroSalvar] = useState('')
  const [novaAlergenico, setNovaAlergenico] = useState('')
  const inputFotoRef = useRef()

  const isMobile = useIsMobile()
  const alertaEstoque = produtos.filter(p => p.estoqueBaixo > 0 && p.estoque <= p.estoqueBaixo)

  function abrirNovo() { setForm(vazio); setAbaModal('geral'); setModal('novo'); setErroSalvar('') }
  function abrirEditar(p) {
    setForm({ ...p, preco: String(p.preco), estoque: String(p.estoque), estoqueBaixo: String(p.estoqueBaixo || ''), nutricional: p.nutricional || { ...vazioNutri }, alergenios: p.alergenios || [] })
    setAbaModal('geral'); setModal('editar'); setErroSalvar('')
  }

  function toggleSelecao(id) {
    setSelecionados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }
  function selecionarTodos() {
    const ids = produtos.map(p => p.id)
    setSelecionados(prev => prev.length === ids.length ? [] : ids)
  }
  function cancelarSelecao() { setModoSelecao(false); setSelecionados([]) }

  async function excluirSelecionados() {
    setExcluindo(true); setErroExcluir('')
    try {
      await removerProdutos(selecionados)
      setSelecionados([])
      setModoSelecao(false)
      setConfirmandoLote(false)
    } catch (e) {
      setErroExcluir('Erro ao excluir: ' + (e.message || e.code || 'verifique as regras do Firestore'))
    } finally { setExcluindo(false) }
  }

  async function salvar() {
    if (salvando) return
    setSalvando(true); setErroSalvar('')
    try {
      const prod = { ...form, preco: parseFloat(form.preco) || 0, estoque: parseInt(form.estoque) || 0, estoqueBaixo: parseInt(form.estoqueBaixo) || 0 }
      if (modal === 'novo') await adicionarProduto(prod)
      else await atualizarProduto(prod)
      setModal(null)
    } catch (e) {
      setErroSalvar('Erro ao salvar: ' + (e.message || e.code))
    } finally { setSalvando(false) }
  }

  function handleFoto(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const comprimida = await comprimirImagem(ev.target.result)
      setForm(f => ({ ...f, foto: comprimida }))
    }
    reader.readAsDataURL(file)
  }

  function handleNutri(campo, valor) {
    setForm(f => ({ ...f, nutricional: { ...f.nutricional, [campo]: valor } }))
  }

  function toggleAlergenico(a) {
    setForm(f => {
      const arr = f.alergenios || []
      return { ...f, alergenios: arr.includes(a) ? arr.filter(x => x !== a) : [...arr, a] }
    })
  }

  function adicionarAlergenico() {
    const val = novaAlergenico.trim().toLowerCase()
    if (!val) return
    setForm(f => {
      const arr = f.alergenios || []
      if (arr.includes(val)) { setNovaAlergenico(''); return f }
      return { ...f, alergenios: [...arr, val] }
    })
    setNovaAlergenico('')
  }

  function removerAlergenico(a) {
    setForm(f => ({ ...f, alergenios: (f.alergenios || []).filter(x => x !== a) }))
  }

  return (
    <Layout titulo="Gerenciar Produtos">
      {/* Alertas de estoque */}
      {alertaEstoque.length > 0 && (
        <div style={s.alertas}>
          <div style={s.alertaAmarelo}>
            ⚠️ <strong>{alertaEstoque.length} produto(s)</strong> com estoque abaixo do mínimo configurado — veja em Estoque
          </div>
        </div>
      )}

      {modoSelecao ? (
            <div style={{ ...s.toolbar, background: '#EFF6FF', borderRadius: 12, padding: '0.65rem 0.85rem', marginBottom: '0.75rem' }}>
              <button style={{ ...s.btnCancelar, fontSize: '0.82rem', padding: '0.45rem 0.9rem' }} onClick={cancelarSelecao}>← Cancelar</button>
              <button style={{ padding: '0.45rem 0.9rem', borderRadius: 8, background: '#fff', border: '1.5px solid #CBD5E1', color: '#475569', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }} onClick={selecionarTodos}>
                {selecionados.length === produtos.length ? 'Desmarcar todos' : 'Selecionar todos'}
              </button>
              <span style={{ color: '#1D4ED8', fontWeight: 700, fontSize: '0.85rem', marginLeft: 'auto' }}>
                {selecionados.length} selecionado{selecionados.length !== 1 ? 's' : ''}
              </span>
            </div>
          ) : (
            <div style={s.toolbar}>
              <button style={s.btnNovo} onClick={abrirNovo}>+ Novo Produto</button>
              <button style={{ padding: '0.5rem 1rem', borderRadius: 8, background: '#F1F5F9', border: '1.5px solid #E2E8F0', color: '#475569', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }} onClick={() => setModoSelecao(true)}>
                ☑ Selecionar
              </button>
              <span style={{ color: '#64748B', fontSize: '0.85rem', marginLeft: 'auto' }}>{produtos.length} produto(s)</span>
            </div>
          )}

          {isMobile ? (
            <div style={s.tabela}>
              {produtos.map(p => {
                const nivel = estoqueNivel(p.estoque, p.estoqueBaixo)
                const sel = selecionados.includes(p.id)
                return (
                  <div key={p.id}
                    style={{ ...s.mCard, cursor: 'pointer', background: sel ? '#EFF6FF' : '#fff', borderLeft: sel ? '3px solid #3B82F6' : '3px solid transparent' }}
                    onClick={() => modoSelecao ? toggleSelecao(p.id) : setDetalhe(p)}>
                    {modoSelecao ? (
                      <div style={sel ? s.checkOn : s.checkOff}>
                        {sel && <span style={{ color: '#fff', fontSize: '0.75rem', fontWeight: 900 }}>✓</span>}
                      </div>
                    ) : (
                      <div style={s.mThumb}>
                        {p.foto
                          ? <img src={p.foto} alt={p.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <span style={{ fontSize: '1.5rem' }}>{p.emoji}</span>}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: '#1A202C', fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nome}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: 1 }}>{p.categoria}</div>
                      <div style={{ display: 'flex', gap: 5, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontWeight: 800, color: '#003D7C', fontSize: '0.85rem' }}>{formatPrice(p.preco)}</span>
                        <span style={{ ...s.badge, background: nivel.bg, color: nivel.color }}>{p.estoque} un</span>
                        {p.estoqueBaixo > 0 && p.estoque <= p.estoqueBaixo && p.estoque > 0 && (
                          <span style={{ background: '#FEF3C7', color: '#B45309', fontSize: '0.63rem', fontWeight: 800, padding: '0.1rem 0.45rem', borderRadius: 6 }}>⚡ Baixo</span>
                        )}
                        <span style={{ ...s.tagStatus, ...(p.disponivel ? s.disponivel : s.indisponivel) }}>{p.disponivel ? 'Ativo' : 'Inativo'}</span>
                        {p.alergenios && p.alergenios.length > 0 && (
                          <span style={s.alergenoBadge}>⚠️ {p.alergenios.length}</span>
                        )}
                      </div>
                    </div>
                    {!modoSelecao && <span style={{ color: '#CBD5E1', fontSize: '1.3rem', flexShrink: 0 }}>›</span>}
                  </div>
                )
              })}
              {produtos.length === 0 && <div style={{ textAlign: 'center', padding: '2rem', color: '#94A3B8' }}>Nenhum produto cadastrado.</div>}
            </div>
          ) : (
            <div style={{ ...s.tabela, overflowX: 'auto' }}>
              <div style={s.thead}>
                {modoSelecao ? (
                  <div onClick={selecionarTodos} style={selecionados.length === produtos.length ? s.checkOn : s.checkOff}>
                    {selecionados.length === produtos.length && <span style={{ color: '#fff', fontSize: '0.7rem', fontWeight: 900 }}>✓</span>}
                  </div>
                ) : (
                  <span style={{ width: 50 }}>Foto</span>
                )}
                <span style={{ flex: 2 }}>Produto</span>
                <span style={{ flex: 1 }}>Categoria</span>
                <span style={{ flex: 1 }}>Preço</span>
                <span style={{ flex: 1 }}>Estoque</span>
                <span style={{ flex: 1 }}>Status</span>
                <span style={{ width: 80 }}></span>
              </div>
              {produtos.map(p => {
                const nivel = estoqueNivel(p.estoque, p.estoqueBaixo)
                const sel = selecionados.includes(p.id)
                return (
                  <div key={p.id} style={{ ...s.trow, cursor: 'pointer', background: sel ? '#EFF6FF' : undefined }}
                    onClick={() => modoSelecao ? toggleSelecao(p.id) : setDetalhe(p)}>
                    {modoSelecao ? (
                      <div style={{ ...(sel ? s.checkOn : s.checkOff), marginRight: 8 }}>
                        {sel && <span style={{ color: '#fff', fontSize: '0.7rem', fontWeight: 900 }}>✓</span>}
                      </div>
                    ) : (
                      <div style={{ width: 50 }}>
                        {p.foto
                          ? <img src={p.foto} alt={p.nome} style={s.thumbFoto} />
                          : <span style={s.thumbEmoji}>{p.emoji}</span>}
                      </div>
                    )}
                    <span style={{ flex: 2, fontWeight: 600, display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {p.nome}
                      {p.alergenios && p.alergenios.length > 0 && (
                        <span style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                          {p.alergenios.map(a => <span key={a} style={s.alergenoTag}>{a}</span>)}
                        </span>
                      )}
                    </span>
                    <span style={{ flex: 1, color: '#64748B', fontSize: '0.85rem' }}>{p.categoria}</span>
                    <span style={{ flex: 1, fontWeight: 700, color: '#003D7C' }}>{formatPrice(p.preco)}</span>
                    <span style={{ flex: 1 }}>
                      <span style={{ ...s.badge, background: nivel.bg, color: nivel.color, fontSize: '0.78rem' }}>{p.estoque} un</span>
                    </span>
                    <span style={{ flex: 1 }}>
                      <span style={{ ...s.tagStatus, ...(p.disponivel ? s.disponivel : s.indisponivel) }}>{p.disponivel ? 'Ativo' : 'Inativo'}</span>
                    </span>
                    <span style={{ width: 80, color: '#94A3B8', fontSize: '0.82rem', fontWeight: 600, textAlign: 'right' }}>Ver →</span>
                  </div>
                )
              })}
            </div>
          )}

      {/* Modal detalhe */}
      {detalhe && (
        <div style={s.overlay} onClick={() => setDetalhe(null)}>
          <div style={{ ...s.modalBox, padding: 0, overflow: 'hidden', maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            {/* Header com imagem */}
            <div style={{ position: 'relative', height: 200, background: detalhe.foto ? 'transparent' : GRADIENTS[detalhe.id % GRADIENTS.length], display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {detalhe.foto
                ? <img src={detalhe.foto} alt={detalhe.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: '5rem', lineHeight: 1 }}>{detalhe.emoji}</span>
              }
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 55%)' }} />
              <div style={{ position: 'absolute', bottom: 14, left: 16 }}>
                <div style={{ fontWeight: 800, fontSize: '1.25rem', color: '#fff', lineHeight: 1.15 }}>{detalhe.nome}</div>
                <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)', marginTop: 3 }}>{detalhe.categoria}</div>
              </div>
              <button onClick={() => setDetalhe(null)} style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(0,0,0,0.4)', color: '#fff', border: 'none', borderRadius: '50%', width: 34, height: 34, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', backdropFilter: 'blur(4px)' }}>✕</button>
              <button onClick={() => { setDetalhe(null); abrirEditar(detalhe) }} style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(255,255,255,0.92)', color: '#003D7C', border: 'none', borderRadius: 20, padding: '0.35rem 0.9rem', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', backdropFilter: 'blur(4px)' }}>✏️ Editar</button>
            </div>

            {/* Conteúdo */}
            <div style={{ padding: '1.25rem 1.35rem', overflowY: 'auto', maxHeight: 'calc(90vh - 200px)' }}>
              {/* Preço + status */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.9rem' }}>
                <span style={{ fontSize: '1.7rem', fontWeight: 800, color: '#003D7C' }}>R$ {detalhe.preco?.toFixed(2).replace('.', ',')}</span>
                <span style={{ padding: '0.3rem 0.9rem', borderRadius: 20, fontWeight: 700, fontSize: '0.82rem', background: detalhe.disponivel ? '#D1FAE5' : '#FEE2E2', color: detalhe.disponivel ? '#059669' : '#DC2626' }}>
                  {detalhe.disponivel ? '● Disponível' : '● Indisponível'}
                </span>
              </div>

              {detalhe.descricao && (
                <p style={{ color: '#475569', fontSize: '0.9rem', lineHeight: 1.55, margin: '0 0 1rem' }}>{detalhe.descricao}</p>
              )}

              {/* Estoque */}
              <div style={s.detSecao}>
                <div style={s.detSecaoTitulo}>📦 Estoque</div>
                {(() => { const nv = estoqueNivel(detalhe.estoque, detalhe.estoqueBaixo); return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '1.4rem', fontWeight: 800, color: nv.color }}>{detalhe.estoque}</span>
                    <span style={{ color: '#64748B', fontSize: '0.85rem' }}>unidades</span>
                    <span style={{ ...s.badge, background: nv.bg, color: nv.color }}>{nv.label}</span>
                    {detalhe.estoqueBaixo > 0 && (
                      <span style={{ color: '#94A3B8', fontSize: '0.75rem' }}>— alerta abaixo de {detalhe.estoqueBaixo} un</span>
                    )}
                  </div>
                )})()}
              </div>

              {/* Nutricional */}
              {detalhe.nutricional && Object.values(detalhe.nutricional).some(v => v && v !== '') && (
                <div style={s.detSecao}>
                  <div style={s.detSecaoTitulo}>🥗 Informações Nutricionais</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {[['calorias','Kcal'],['proteinas','Prot'],['carboidratos','Carb'],['gorduras','Gord'],['sodio','Sódio']].map(([key, label]) =>
                      detalhe.nutricional[key] ? (
                        <div key={key} style={{ background: '#FFF7ED', borderRadius: 12, padding: '0.6rem 0.75rem', textAlign: 'center', minWidth: 54 }}>
                          <div style={{ fontWeight: 800, color: '#C2410C', fontSize: '1rem' }}>{detalhe.nutricional[key]}</div>
                          <div style={{ fontSize: '0.65rem', color: '#94A3B8', fontWeight: 600, marginTop: 2 }}>{label}</div>
                        </div>
                      ) : null
                    )}
                  </div>
                </div>
              )}

              {/* Alérgenos */}
              {detalhe.alergenios && detalhe.alergenios.length > 0 ? (
                <div style={s.detSecao}>
                  <div style={s.detSecaoTitulo}>⚠️ Alérgenos</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                    {detalhe.alergenios.map(a => (
                      <span key={a} style={{ background: '#FEE2E2', color: '#DC2626', padding: '0.3rem 0.8rem', borderRadius: 20, fontWeight: 700, fontSize: '0.8rem', textTransform: 'capitalize' }}>⚠️ {a}</span>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ ...s.detSecao, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: '0.85rem', color: '#15803D', fontWeight: 600 }}>✓ Sem alérgenos cadastrados</span>
                </div>
              )}

              {/* Ações */}
              <div style={{ display: 'flex', gap: 10, marginTop: '0.75rem' }}>
                <button onClick={() => { setConfirmarExcluir(detalhe); setDetalhe(null) }} style={{ flex: 1, padding: '0.8rem', borderRadius: 12, background: '#FEE2E2', color: '#DC2626', fontWeight: 700, border: 'none', cursor: 'pointer', fontSize: '0.88rem' }}>
                  🗑️ Excluir
                </button>
                <button onClick={() => { setDetalhe(null); abrirEditar(detalhe) }} style={{ flex: 2, padding: '0.8rem', borderRadius: 12, background: '#003D7C', color: '#fff', fontWeight: 700, border: 'none', cursor: 'pointer', fontSize: '0.88rem' }}>
                  ✏️ Editar produto
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal produto */}
      {modal && (
        <div style={s.overlay}>
          <div style={s.modalBox}>
            <h3 style={s.modalTitulo}>{modal === 'novo' ? 'Novo Produto' : 'Editar Produto'}</h3>

            <div style={s.abasMod}>
              {[['geral', '📋 Geral'], ['foto', '📷 Foto'], ['nutricional', '🥗 Nutricional'], ['alergenos', '⚠️ Alérgenos']].map(([id, label]) => (
                <button key={id} style={{
                  ...s.abaMod,
                  ...(abaModal === id ? s.abaModAtiva : {}),
                  ...(id === 'alergenos' && (form.alergenios || []).length > 0 ? { color: '#DC2626', background: abaModal === 'alergenos' ? '#FEE2E2' : undefined } : {}),
                }}
                  onClick={() => setAbaModal(id)}>{label}
                  {id === 'alergenos' && (form.alergenios || []).length > 0 && (
                    <span style={{ marginLeft: 4, background: '#DC2626', color: '#fff', borderRadius: '50%', width: 16, height: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 800 }}>
                      {(form.alergenios || []).length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {abaModal === 'geral' && (
              <div style={s.formGrid}>
                {[['nome','Nome','text'],['emoji','Emoji','text'],['preco','Preço (R$)','number'],['estoque','Estoque atual','number'],['estoqueBaixo','Alertar abaixo de (un)','number']].map(([key, label, tipo]) => (
                  <div key={key}>
                    <label style={s.label}>{label}</label>
                    <input style={s.input} type={tipo} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} placeholder={key === 'estoqueBaixo' ? 'Ex: 5' : ''} />
                  </div>
                ))}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={s.label}>Descrição</label>
                  <textarea style={{ ...s.input, height: 70, resize: 'vertical' }} value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} />
                </div>
                <div>
                  <label style={s.label}>Categoria</label>
                  <select style={s.input} value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}>
                    {categorias.filter(c => c !== 'Todos').map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 20 }}>
                  <input type="checkbox" id="disp" checked={form.disponivel} onChange={e => setForm({ ...form, disponivel: e.target.checked })} />
                  <label htmlFor="disp" style={s.label}>Disponível para venda</label>
                </div>
              </div>
            )}

            {abaModal === 'foto' && (
              <div style={s.fotoArea}>
                <div style={s.fotoPreview}>
                  {form.foto
                    ? <img src={form.foto} alt="preview" style={s.fotoImg} />
                    : <span style={{ fontSize: 48 }}>{form.emoji || '🍔'}</span>
                  }
                </div>
                <input ref={inputFotoRef} type="file" accept="image/*" onChange={handleFoto} style={{ display: 'none' }} />
                <button style={s.btnUpload} onClick={() => inputFotoRef.current.click()}>📷 Escolher foto</button>
                {form.foto && (
                  <button style={s.btnRemoverFoto} onClick={() => setForm(f => ({ ...f, foto: '' }))}>Remover foto</button>
                )}
                <p style={{ color: '#94A3B8', fontSize: '0.8rem', textAlign: 'center' }}>A foto é comprimida automaticamente.</p>
              </div>
            )}

            {abaModal === 'nutricional' && (
              <div style={s.formGrid}>
                {[
                  ['calorias','Calorias (kcal)'],['proteinas','Proteínas (g)'],
                  ['carboidratos','Carboidratos (g)'],['gorduras','Gorduras totais (g)'],['sodio','Sódio (mg)'],
                ].map(([key, label]) => (
                  <div key={key}>
                    <label style={s.label}>{label}</label>
                    <input style={s.input} type="number" value={form.nutricional?.[key] || ''} onChange={e => handleNutri(key, e.target.value)} placeholder="0" />
                  </div>
                ))}
              </div>
            )}

            {abaModal === 'alergenos' && (
              <div style={{ marginBottom: '1.25rem' }}>
                <p style={{ fontSize: '0.82rem', color: '#64748B', fontWeight: 600, marginBottom: 8 }}>Alérgenos comuns — clique para selecionar:</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: '1.1rem' }}>
                  {ALERGENOS_PADRAO.map(a => {
                    const ativo = (form.alergenios || []).includes(a)
                    return (
                      <button type="button" key={a} onClick={() => toggleAlergenico(a)} style={{
                        padding: '0.5rem 0.9rem', borderRadius: 20, cursor: 'pointer', fontSize: '0.83rem', fontWeight: ativo ? 700 : 600,
                        border: `2px solid ${ativo ? '#DC2626' : '#E2E8F0'}`,
                        background: ativo ? '#FEE2E2' : '#F8FAFC',
                        color: ativo ? '#DC2626' : '#64748B',
                      }}>
                        {ativo ? '⚠️ ' : ''}{a.replace('-', ' ')}
                      </button>
                    )
                  })}
                </div>

                <p style={{ fontSize: '0.82rem', color: '#64748B', fontWeight: 600, marginBottom: 6 }}>Outros alérgenos:</p>
                {(form.alergenios || []).filter(a => !ALERGENOS_PADRAO.includes(a)).length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                    {(form.alergenios || []).filter(a => !ALERGENOS_PADRAO.includes(a)).map(a => (
                      <span key={a} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '0.35rem 0.7rem', borderRadius: 20, background: '#FEE2E2', color: '#DC2626', fontWeight: 700, fontSize: '0.82rem', border: '2px solid #FCA5A5' }}>
                        {a}
                        <button type="button" onClick={() => removerAlergenico(a)} style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', padding: 0, fontSize: '1.1rem', fontWeight: 700, lineHeight: 1 }}>×</button>
                      </span>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    style={{ ...s.input, flex: 1, padding: '0.55rem 0.8rem', fontSize: '0.88rem', boxSizing: 'border-box' }}
                    value={novaAlergenico}
                    onChange={e => setNovaAlergenico(e.target.value)}
                    placeholder="Ex: corante, sulfito, mostarda..."
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); adicionarAlergenico() } }}
                  />
                  <button type="button" onClick={adicionarAlergenico} style={{ padding: '0.55rem 1rem', borderRadius: 8, background: '#DC2626', color: '#fff', fontWeight: 700, border: 'none', cursor: 'pointer', fontSize: '0.85rem', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    + Adicionar
                  </button>
                </div>
                <p style={{ fontSize: '0.73rem', color: '#94A3B8', marginTop: 6 }}>Pressione Enter ou clique "+ Adicionar". Os alérgenos aparecem como alerta no cardápio do aluno.</p>

                {(form.alergenios || []).length > 0 ? (
                  <div style={{ marginTop: '1rem', padding: '0.9rem 1rem', background: '#FFF7F7', borderRadius: 12, border: '1.5px solid #FCA5A5' }}>
                    <p style={{ fontSize: '0.78rem', fontWeight: 700, color: '#DC2626', marginBottom: 8 }}>Resumo — alérgenos neste produto:</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {(form.alergenios || []).map(a => (
                        <span key={a} style={{ background: '#FEE2E2', color: '#DC2626', padding: '0.25rem 0.65rem', borderRadius: 10, fontSize: '0.78rem', fontWeight: 700, textTransform: 'capitalize' }}>⚠️ {a}</span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ marginTop: '1rem', padding: '0.9rem 1rem', background: '#F0FDF4', borderRadius: 12, border: '1.5px solid #86EFAC', textAlign: 'center' }}>
                    <p style={{ fontSize: '0.82rem', color: '#15803D', fontWeight: 600 }}>✓ Nenhum alérgeno selecionado</p>
                  </div>
                )}
              </div>
            )}

            {erroSalvar && <p style={{ color: '#EF4444', fontSize: '0.82rem', marginBottom: 8 }}>{erroSalvar}</p>}
            <div style={s.modalBtns}>
              <button style={s.btnCancelar} onClick={() => setModal(null)}>Cancelar</button>
              <button style={{ ...s.btnSalvar, opacity: salvando ? 0.7 : 1 }} onClick={salvar} disabled={salvando}>
                {salvando ? 'Salvando...' : 'Salvar produto'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm excluir individual */}
      {confirmarExcluir && (
        <div style={s.overlay}>
          <div style={{ ...s.modalBox, maxWidth: 360, textAlign: 'center' }}>
            <p style={{ fontSize: '2.5rem', marginBottom: 8 }}>🗑️</p>
            <h3 style={{ marginBottom: 6, fontWeight: 800 }}>Excluir produto?</h3>
            <p style={{ color: '#64748B', marginBottom: 4, fontSize: '0.95rem' }}>{confirmarExcluir.nome}</p>
            <p style={{ color: '#94A3B8', fontSize: '0.82rem', marginBottom: 16 }}>Esta ação não pode ser desfeita.</p>
            {erroExcluir && <p style={{ color: '#EF4444', fontSize: '0.82rem', marginBottom: 10, background: '#FEE2E2', padding: '0.5rem', borderRadius: 8 }}>{erroExcluir}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={s.btnCancelar} onClick={() => { setConfirmarExcluir(null); setErroExcluir('') }} disabled={excluindo}>Cancelar</button>
              <button style={{ ...s.btnSalvar, background: '#EF4444', opacity: excluindo ? 0.6 : 1 }} disabled={excluindo}
                onClick={async () => {
                  setExcluindo(true); setErroExcluir('')
                  try {
                    await removerProduto(confirmarExcluir.id)
                    setConfirmarExcluir(null)
                  } catch (e) {
                    setErroExcluir('Erro: ' + (e.message || e.code || 'falha no Firestore'))
                  } finally { setExcluindo(false) }
                }}>
                {excluindo ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm excluir em lote */}
      {confirmandoLote && (
        <div style={s.overlay}>
          <div style={{ ...s.modalBox, maxWidth: 380, textAlign: 'center' }}>
            <p style={{ fontSize: '2.5rem', marginBottom: 8 }}>🗑️</p>
            <h3 style={{ fontWeight: 800, marginBottom: 6 }}>Excluir {selecionados.length} produto{selecionados.length !== 1 ? 's' : ''}?</h3>
            <p style={{ color: '#94A3B8', fontSize: '0.82rem', marginBottom: 16 }}>Esta ação não pode ser desfeita.</p>
            {erroExcluir && <p style={{ color: '#EF4444', fontSize: '0.82rem', marginBottom: 10, background: '#FEE2E2', padding: '0.5rem', borderRadius: 8 }}>{erroExcluir}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={s.btnCancelar} onClick={() => { setConfirmandoLote(false); setErroExcluir('') }} disabled={excluindo}>Cancelar</button>
              <button style={{ ...s.btnSalvar, background: '#EF4444', opacity: excluindo ? 0.6 : 1 }} disabled={excluindo} onClick={excluirSelecionados}>
                {excluindo ? 'Excluindo...' : `Excluir ${selecionados.length}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barra flutuante de seleção */}
      {modoSelecao && selecionados.length > 0 && !confirmandoLote && (
        <div style={{ position: 'fixed', bottom: isMobile ? 80 : 24, left: '50%', transform: 'translateX(-50%)', background: '#1A202C', color: '#fff', borderRadius: 16, padding: '0.8rem 1.25rem', display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.28)', zIndex: 250, whiteSpace: 'nowrap' }}>
          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{selecionados.length} selecionado{selecionados.length !== 1 ? 's' : ''}</span>
          <button onClick={() => { setErroExcluir(''); setConfirmandoLote(true) }} style={{ background: '#EF4444', color: '#fff', padding: '0.5rem 1.1rem', borderRadius: 10, fontWeight: 700, border: 'none', cursor: 'pointer', fontSize: '0.88rem' }}>
            🗑️ Excluir selecionados
          </button>
        </div>
      )}
    </Layout>
  )
}

const s = {
  alertas: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: '1rem' },
  alertaVermelho: { background: '#FEE2E2', color: '#DC2626', padding: '0.75rem 1rem', borderRadius: 10, fontSize: '0.88rem' },
  alertaAmarelo: { background: '#FEF3C7', color: '#D97706', padding: '0.75rem 1rem', borderRadius: 10, fontSize: '0.88rem' },
  abas: { display: 'flex', gap: 0, marginBottom: '1rem', borderBottom: '2px solid #E2E8F0' },
  aba: { padding: '0.6rem 1.4rem', background: 'none', color: '#64748B', fontWeight: 600, fontSize: '0.88rem', borderBottom: '2px solid transparent', marginBottom: -2, display: 'flex', alignItems: 'center' },
  abaAtiva: { color: '#003D7C', borderBottom: '2px solid #003D7C', fontWeight: 700 },
  toolbar: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: '0.75rem' },
  btnNovo: { background: '#F47920', color: '#fff', padding: '0.6rem 1.4rem', borderRadius: 10, fontWeight: 700 },
  tabela: { background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  mCard: { display: 'flex', alignItems: 'center', padding: '0.75rem', borderBottom: '1px solid #F1F5F9', gap: 10 },
  mThumb: { width: 44, height: 44, borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  thead: { display: 'flex', padding: '0.75rem 1.25rem', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', fontWeight: 700, fontSize: '0.82rem', color: '#64748B', gap: 8, alignItems: 'center', minWidth: 600 },
  trow: { display: 'flex', padding: '0.7rem 1.25rem', borderBottom: '1px solid #F1F5F9', alignItems: 'center', gap: 8, fontSize: '0.88rem', minWidth: 600 },
  thumbFoto: { width: 36, height: 36, borderRadius: 8, objectFit: 'cover' },
  thumbEmoji: { fontSize: '1.5rem', display: 'block', textAlign: 'center' },
  badge: { padding: '0.2rem 0.6rem', borderRadius: 20, fontWeight: 600, fontSize: '0.75rem' },
  tagStatus: { padding: '0.2rem 0.7rem', borderRadius: 20, fontWeight: 600, fontSize: '0.75rem' },
  disponivel: { background: '#D1FAE5', color: '#059669' },
  indisponivel: { background: '#FEE2E2', color: '#EF4444' },
  btnEdit: { background: '#E8F0FB', padding: '0.3rem 0.5rem', borderRadius: 6, fontSize: '0.85rem' },
  btnDel: { background: '#FEE2E2', padding: '0.3rem 0.5rem', borderRadius: 6, fontSize: '0.85rem' },
  inputEst: { width: 70, padding: '0.35rem 0.5rem', border: '2px solid #003D7C', borderRadius: 6, fontSize: '0.9rem' },
  btnEditarEst: { background: '#E8F0FB', color: '#003D7C', padding: '0.35rem 0.8rem', borderRadius: 8, fontWeight: 600, fontSize: '0.82rem' },
  btnSalvarEst: { background: '#D1FAE5', color: '#059669', padding: '0.35rem 0.6rem', borderRadius: 6, fontWeight: 700, fontSize: '0.8rem' },
  btnCancelarEst: { background: '#FEE2E2', color: '#EF4444', padding: '0.35rem 0.5rem', borderRadius: 6, fontWeight: 700 },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem' },
  modalBox: { background: '#fff', borderRadius: 16, padding: '1.75rem', width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto' },
  modalTitulo: { fontWeight: 800, marginBottom: '1rem', color: '#1A202C' },
  abasMod: { display: 'flex', gap: 6, marginBottom: '1.25rem', borderBottom: '2px solid #F1F5F9', paddingBottom: '0.75rem' },
  abaMod: { padding: '0.45rem 1rem', borderRadius: 8, background: 'none', color: '#64748B', fontWeight: 600, fontSize: '0.85rem' },
  abaModAtiva: { background: '#E8F0FB', color: '#003D7C' },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.9rem', marginBottom: '1.25rem' },
  label: { fontWeight: 600, fontSize: '0.82rem', color: '#64748B', display: 'block', marginBottom: 4 },
  input: { width: '100%', padding: '0.6rem 0.9rem', border: '2px solid #E2E8F0', borderRadius: 8, fontSize: '0.9rem', outline: 'none' },
  fotoArea: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: '1.25rem' },
  fotoPreview: { width: 120, height: 120, borderRadius: 16, background: '#F5F7FA', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '2px dashed #E2E8F0' },
  fotoImg: { width: '100%', height: '100%', objectFit: 'cover' },
  btnUpload: { background: '#003D7C', color: '#fff', padding: '0.6rem 1.4rem', borderRadius: 10, fontWeight: 700 },
  btnRemoverFoto: { background: 'none', color: '#EF4444', fontWeight: 600, fontSize: '0.85rem' },
  checkOn: { width: 22, height: 22, borderRadius: 6, border: '2px solid #3B82F6', background: '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer' },
  checkOff: { width: 22, height: 22, borderRadius: 6, border: '2px solid #CBD5E1', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer' },
  alergenoBadge: { background: '#FEE2E2', color: '#DC2626', fontSize: '0.65rem', fontWeight: 800, padding: '0.1rem 0.45rem', borderRadius: 8 },
  alergenoTag: { background: '#FEE2E2', color: '#DC2626', fontSize: '0.6rem', fontWeight: 700, padding: '0.08rem 0.35rem', borderRadius: 5, textTransform: 'capitalize' },
  detSecao: { marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid #F1F5F9' },
  detSecaoTitulo: { fontWeight: 700, fontSize: '0.82rem', color: '#374151', marginBottom: '0.6rem' },
  modalBtns: { display: 'flex', gap: 10, justifyContent: 'flex-end' },
  btnCancelar: { padding: '0.65rem 1.4rem', borderRadius: 8, background: '#F1F5F9', color: '#64748B', fontWeight: 600 },
  btnSalvar: { padding: '0.65rem 1.4rem', borderRadius: 8, background: '#003D7C', color: '#fff', fontWeight: 700 },
}
