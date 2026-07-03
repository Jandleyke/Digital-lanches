import { useRef, useState } from 'react'
import { ImagePlus } from 'lucide-react'
import { categorias } from '../data/mockData'
import { processarFotoPerfil } from '../utils/image'
import { DIAS_CARDAPIO, DIAS_LABEL } from '../utils/cardapioDias'
import { ALERGENOS_PADRAO } from '../utils/produtoForm'

export default function ProdutoFormModal({
  titulo, subtitulo, form, setForm, onSalvar, onFechar, salvando, erroSalvar,
  isMobile, precoDesabilitado, estoqueDesabilitado, minimoDesabilitado, categoriaDesabilitada,
}) {
  const [abaModal, setAbaModal] = useState('geral')
  const [novaAlergenico, setNovaAlergenico] = useState('')
  const [processandoFoto, setProcessandoFoto] = useState(false)
  const [erroFoto, setErroFoto] = useState('')
  const inputFotoRef = useRef()

  async function handleFoto(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setProcessandoFoto(true)
    setErroFoto('')
    try {
      const dataUrl = await processarFotoPerfil(file, 700, 450000)
      setForm(f => ({ ...f, foto: dataUrl }))
    } catch (error) {
      setErroFoto(error.message || 'Não foi possível processar a foto.')
    } finally {
      setProcessandoFoto(false)
      e.target.value = ''
    }
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
      if (arr.includes(val)) return f
      return { ...f, alergenios: [...arr, val] }
    })
    setNovaAlergenico('')
  }

  function removerAlergenico(a) {
    setForm(f => ({ ...f, alergenios: (f.alergenios || []).filter(x => x !== a) }))
  }

  function toggleDia(dia) {
    setForm(f => {
      const dias = f.diasProducao || []
      return { ...f, diasProducao: dias.includes(dia) ? dias.filter(d => d !== dia) : [...dias, dia] }
    })
  }

  return (
    <div style={s.overlay} role="dialog" aria-modal="true">
      <form onSubmit={onSalvar} style={{ ...s.modalBox, padding: isMobile ? 18 : 24 }}>
        <div style={s.modalHeader}>
          <div>
            <h3 style={s.modalTitulo}>{titulo}</h3>
            {subtitulo && <p style={s.meta}>{subtitulo}</p>}
          </div>
          <button type="button" style={s.closeBtn} onClick={onFechar}>Fechar</button>
        </div>

        <div style={s.abasMod}>
          {[['geral', '📋 Geral'], ['foto', '📷 Foto'], ['nutricional', '🥗 Nutricional'], ['alergenos', '⚠️ Alérgenos']].map(([id, label]) => (
            <button key={id} type="button" style={{
              ...s.abaMod,
              ...(abaModal === id ? s.abaModAtiva : {}),
              ...(id === 'alergenos' && (form.alergenios || []).length > 0 ? { color: '#DC2626', background: abaModal === 'alergenos' ? '#FEE2E2' : undefined } : {}),
            }}
              onClick={() => setAbaModal(id)}>{label}
              {id === 'alergenos' && (form.alergenios || []).length > 0 && (
                <span style={s.alergenoCount}>{(form.alergenios || []).length}</span>
              )}
            </button>
          ))}
        </div>

        {abaModal === 'geral' && (
          <div style={{ ...s.formGrid, gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr' }}>
            <div>
              <label style={s.label}>Nome</label>
              <input style={s.input} value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Nome do produto" required />
            </div>
            <div>
              <label style={s.label}>Categoria</label>
              <select style={s.input} value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} disabled={categoriaDesabilitada}>
                {categorias.filter(c => c !== 'Todos').map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={s.label}>Preço (R$)</label>
              <input
                style={s.input} type="number" step="0.01" value={form.preco}
                onChange={e => setForm({ ...form, preco: e.target.value })} placeholder="0,00"
                disabled={precoDesabilitado}
                title={precoDesabilitado ? 'Apenas administradores podem alterar o preço de um produto já cadastrado.' : undefined}
              />
              {precoDesabilitado && <p style={{ ...s.label, fontWeight: 500, marginTop: 4 }}>Apenas administradores podem alterar o preço.</p>}
            </div>
            <div>
              <label style={s.label}>Estoque</label>
              <input style={s.input} type="number" min="0" value={form.estoque} onChange={e => setForm({ ...form, estoque: e.target.value })} placeholder="0" disabled={estoqueDesabilitado} />
              {estoqueDesabilitado && <p style={{ ...s.label, fontWeight: 500, marginTop: 4 }}>O vendedor altera estoque somente para bebidas.</p>}
            </div>
            <div>
              <label style={s.label}>Alertar abaixo de (un)</label>
              <input style={s.input} type="number" min="0" value={form.estoqueBaixo} onChange={e => setForm({ ...form, estoqueBaixo: e.target.value })} placeholder="Ex: 5" disabled={minimoDesabilitado} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 20 }}>
              <input
                type="checkbox"
                id="prod-disp"
                checked={form.categoria === 'Bebidas' ? !!form.disponivel : form.visivelPlanejamento !== false}
                onChange={e => setForm(f => ({ ...f, [f.categoria === 'Bebidas' ? 'disponivel' : 'visivelPlanejamento']: e.target.checked }))}
              />
              <label htmlFor="prod-disp" style={s.label}>
                {form.categoria === 'Bebidas' ? 'Disponível para venda manual' : 'Visível para planejamento da cozinha'}
              </label>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={s.label}>Descrição / composição</label>
              <textarea style={{ ...s.input, height: 70, resize: 'vertical' }} value={form.composicao} onChange={e => setForm({ ...form, composicao: e.target.value })} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={s.label}>Dias de produção</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {DIAS_CARDAPIO.map(dia => {
                  const ativo = (form.diasProducao || []).includes(dia)
                  return (
                    <button key={dia} type="button" onClick={() => toggleDia(dia)} style={{ ...s.diaBtn, ...(ativo ? s.diaBtnAtivo : {}) }}>
                      {DIAS_LABEL[dia] || dia}
                    </button>
                  )
                })}
              </div>
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
            <button type="button" style={s.btnUpload} onClick={() => inputFotoRef.current.click()} disabled={processandoFoto}><ImagePlus size={15} /> {processandoFoto ? 'Processando foto...' : 'Escolher foto'}</button>
            {form.foto && (
              <button type="button" style={s.btnRemoverFoto} onClick={() => setForm(f => ({ ...f, foto: '' }))}>Remover foto</button>
            )}
            <p style={{ color: '#94A3B8', fontSize: '0.8rem', textAlign: 'center' }}>A foto é comprimida automaticamente.</p>
            {erroFoto && <p role="alert" style={{ color: '#B91C1C', fontSize: '0.8rem', margin: 0 }}>{erroFoto}</p>}
          </div>
        )}

        {abaModal === 'nutricional' && (
          <div style={{ ...s.formGrid, gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr' }}>
            {[
              ['calorias', 'Calorias (kcal)'], ['proteinas', 'Proteínas (g)'],
              ['carboidratos', 'Carboidratos (g)'], ['gorduras', 'Gorduras totais (g)'], ['sodio', 'Sódio (mg)'],
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
                style={{ ...s.input, flex: 1 }}
                value={novaAlergenico}
                onChange={e => setNovaAlergenico(e.target.value)}
                placeholder="Ex: corante, sulfito, mostarda..."
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); adicionarAlergenico() } }}
              />
              <button type="button" onClick={adicionarAlergenico} style={{ padding: '0 1rem', borderRadius: 8, background: '#DC2626', color: '#fff', fontWeight: 700, border: 'none', cursor: 'pointer', fontSize: '0.85rem', whiteSpace: 'nowrap', flexShrink: 0 }}>
                + Adicionar
              </button>
            </div>
            <p style={{ fontSize: '0.73rem', color: '#94A3B8', marginTop: 6 }}>Pressione Enter ou clique "+ Adicionar". Os alérgenos aparecem como alerta no cardápio do aluno.</p>
          </div>
        )}

        {erroSalvar && <p style={{ color: '#EF4444', fontSize: '0.82rem', marginBottom: 8 }}>{erroSalvar}</p>}
        <div style={s.modalBtns}>
          <button type="button" style={s.btnCancelar} onClick={onFechar}>Cancelar</button>
          <button type="submit" style={{ ...s.btnSalvar, opacity: salvando || processandoFoto ? 0.7 : 1 }} disabled={salvando || processandoFoto}>
            {processandoFoto ? 'Processando foto...' : salvando ? 'Salvando...' : 'Salvar produto'}
          </button>
        </div>
      </form>
    </div>
  )
}

const s = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modalBox: { width: '100%', maxWidth: 620, maxHeight: '90vh', overflowY: 'auto', background: '#fff', borderRadius: 18, boxShadow: '0 24px 80px rgba(15,23,42,0.25)' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, marginBottom: 16, position: 'sticky', top: 0, background: '#fff', paddingTop: 4, zIndex: 1 },
  modalTitulo: { margin: 0, color: '#0F172A', fontSize: '1.2rem', fontWeight: 900 },
  meta: { color: '#64748B', fontSize: '0.84rem', margin: '4px 0 0' },
  closeBtn: { border: 'none', background: '#003D7C', color: '#fff', borderRadius: 10, minHeight: 40, padding: '0 0.9rem', fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit' },
  abasMod: { display: 'flex', gap: 6, marginBottom: '1.25rem', borderBottom: '2px solid #F1F5F9', paddingBottom: '0.75rem', flexWrap: 'wrap' },
  abaMod: { padding: '0.45rem 1rem', borderRadius: 8, background: 'none', border: 'none', color: '#64748B', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center' },
  abaModAtiva: { background: '#E8F0FB', color: '#003D7C' },
  alergenoCount: { marginLeft: 4, background: '#DC2626', color: '#fff', borderRadius: '50%', width: 16, height: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 800 },
  formGrid: { display: 'grid', gap: '0.9rem', marginBottom: '1.25rem' },
  label: { fontWeight: 600, fontSize: '0.82rem', color: '#64748B', display: 'block', marginBottom: 4 },
  input: { width: '100%', padding: '0.6rem 0.9rem', border: '2px solid #E2E8F0', borderRadius: 8, fontSize: '0.9rem', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' },
  fotoArea: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: '1.25rem' },
  fotoPreview: { width: 120, height: 120, borderRadius: 16, background: '#F5F7FA', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '2px dashed #E2E8F0' },
  fotoImg: { width: '100%', height: '100%', objectFit: 'cover' },
  btnUpload: { background: '#003D7C', color: '#fff', padding: '0.6rem 1.4rem', borderRadius: 10, fontWeight: 700, border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: 'inherit' },
  btnRemoverFoto: { background: 'none', color: '#EF4444', fontWeight: 600, fontSize: '0.85rem', border: 'none', cursor: 'pointer', fontFamily: 'inherit' },
  diaBtn: { padding: '0.4rem 0.75rem', borderRadius: 20, border: '1.5px solid #CBD5E1', background: '#fff', color: '#64748B', fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize', fontFamily: 'inherit', fontSize: '0.82rem' },
  diaBtnAtivo: { borderColor: '#003D7C', background: '#E8F0FB', color: '#003D7C' },
  modalBtns: { display: 'flex', gap: 10, justifyContent: 'flex-end' },
  btnCancelar: { padding: '0.65rem 1.4rem', borderRadius: 8, background: '#F1F5F9', color: '#64748B', fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit' },
  btnSalvar: { padding: '0.65rem 1.4rem', borderRadius: 8, background: '#003D7C', color: '#fff', fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit' },
}
