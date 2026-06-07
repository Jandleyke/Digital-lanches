import { useState } from 'react'
import Layout from '../../components/Layout'
import { useApp } from '../../contexts/AppContext'

const TIPOS = [
  { valor: 'info',      label: '📢 Comunicado', bg: '#DBEAFE', color: '#1D4ED8' },
  { valor: 'promo',     label: '🎉 Promoção',   bg: '#FEF3C7', color: '#D97706' },
  { valor: 'aviso',     label: '⚠️ Aviso',      bg: '#FEE2E2', color: '#DC2626' },
  { valor: 'novidade',  label: '✨ Novidade',   bg: '#F0FDF4', color: '#15803D' },
]

const DESTINATARIOS = [
  { valor: 'todos',    label: '🌐 Todos',    bg: '#F1F5F9', color: '#475569' },
  { valor: 'alunos',  label: '👩‍🎓 Alunos',  bg: '#DBEAFE', color: '#1D4ED8' },
  { valor: 'cozinha', label: '🍳 Cozinha',  bg: '#D1FAE5', color: '#065F46' },
  { valor: 'admin',   label: '👔 Admin',    bg: '#F3E8FF', color: '#6B21A8' },
]

function destLabel(d) {
  return DESTINATARIOS.find(x => x.valor === (d || 'todos')) || DESTINATARIOS[0]
}

const vazio = { titulo: '', texto: '', tipo: 'info', fixado: false, destinatario: 'todos' }

export default function Avisos() {
  const { avisos, criarAviso, editarAviso, excluirAviso } = useApp()
  const [modal, setModal]     = useState(null)
  const [form, setForm]       = useState(vazio)
  const [salvando, setSalvando] = useState(false)
  const [filtro, setFiltro]   = useState('todos')

  function abrirNovo() { setForm(vazio); setModal('novo') }
  function abrirEditar(av) {
    setForm({ titulo: av.titulo, texto: av.texto, tipo: av.tipo, fixado: av.fixado, destinatario: av.destinatario || 'todos' })
    setModal(av)
  }

  async function salvar() {
    if (!form.titulo.trim()) return
    setSalvando(true)
    try {
      if (modal === 'novo') await criarAviso(form)
      else await editarAviso(modal.id, form)
      setModal(null)
    } finally { setSalvando(false) }
  }

  async function handleExcluir(id) {
    if (!confirm('Excluir este aviso?')) return
    await excluirAviso(id)
  }

  async function toggleFixado(av) {
    await editarAviso(av.id, { fixado: !av.fixado })
  }

  const visiveis = filtro === 'todos'
    ? avisos
    : avisos.filter(av => (av.destinatario || 'todos') === filtro)

  return (
    <Layout titulo="Central de Avisos">
      <div style={s.toolbar}>
        <button style={s.btnNovo} onClick={abrirNovo}>+ Novo Aviso</button>
        <span style={{ color: '#64748B', fontSize: '0.85rem' }}>{avisos.length} aviso(s)</span>
      </div>

      {/* Filtro por público */}
      <div style={s.filtros}>
        {[['todos', '🌐 Todos'], ['alunos', '👩‍🎓 Alunos'], ['cozinha', '🍳 Cozinha'], ['admin', '👔 Admin']].map(([v, l]) => (
          <button key={v}
            style={{ ...s.filtroBtn, ...(filtro === v ? s.filtroBtnOn : {}) }}
            onClick={() => setFiltro(v)}>
            {l}
          </button>
        ))}
      </div>

      {visiveis.length === 0 ? (
        <div style={s.vazio}><p>📢</p><p>Nenhum aviso para este público.</p></div>
      ) : (
        <div style={s.lista}>
          {visiveis.map(av => {
            const tipo = TIPOS.find(t => t.valor === av.tipo) || TIPOS[0]
            const dest = destLabel(av.destinatario)
            return (
              <div key={av.id} style={{ ...s.card, borderLeft: `4px solid ${tipo.color}` }}>
                <div style={s.cardTop}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ ...s.tipoBadge, background: tipo.bg, color: tipo.color }}>{tipo.label}</span>
                    <span style={{ ...s.tipoBadge, background: dest.bg, color: dest.color }}>{dest.label}</span>
                    {av.fixado && <span style={s.fixadoBadge}>📌 Fixado</span>}
                  </div>
                  <div style={s.acoes}>
                    <button style={s.btnAcao} onClick={() => toggleFixado(av)} title={av.fixado ? 'Desafixar' : 'Fixar'}>
                      {av.fixado ? '📌' : '📍'}
                    </button>
                    <button style={s.btnAcao} onClick={() => abrirEditar(av)}>✏️</button>
                    <button style={{ ...s.btnAcao, background: '#FEE2E2' }} onClick={() => handleExcluir(av.id)}>🗑️</button>
                  </div>
                </div>
                <h3 style={s.cardTitulo}>{av.titulo}</h3>
                {av.texto && <p style={s.cardTexto}>{av.texto}</p>}
                <span style={s.cardInfo}>Por {av.autor} • {av.criadoEm ? new Date(av.criadoEm).toLocaleDateString('pt-BR') : ''}</span>
              </div>
            )
          })}
        </div>
      )}

      {modal && (
        <div style={s.overlay}>
          <div style={s.modalBox}>
            <h3 style={s.modalTitulo}>{modal === 'novo' ? 'Novo Aviso' : 'Editar Aviso'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>

              {/* Tipo */}
              <div>
                <label style={s.label}>Tipo</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {TIPOS.map(t => (
                    <button key={t.valor}
                      style={{ ...s.tipoBtnBase, ...(form.tipo === t.valor ? { border: `2px solid ${t.color}`, background: t.bg, color: t.color } : {}) }}
                      onClick={() => setForm(f => ({ ...f, tipo: t.valor }))}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Para quem */}
              <div>
                <label style={s.label}>Para quem?</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {DESTINATARIOS.map(d => (
                    <button key={d.valor}
                      style={{ ...s.tipoBtnBase, ...(form.destinatario === d.valor ? { border: `2px solid ${d.color}`, background: d.bg, color: d.color } : {}) }}
                      onClick={() => setForm(f => ({ ...f, destinatario: d.valor }))}>
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Título */}
              <div>
                <label style={s.label}>Título</label>
                <input style={s.input} value={form.titulo}
                  onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                  placeholder="Ex: Promoção de hoje!" />
              </div>

              {/* Mensagem */}
              <div>
                <label style={s.label}>Mensagem (opcional)</label>
                <textarea style={{ ...s.input, height: 80, resize: 'vertical' }} value={form.texto}
                  onChange={e => setForm(f => ({ ...f, texto: e.target.value }))}
                  placeholder="Descreva o aviso..." />
              </div>

              {/* Fixar */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.fixado} onChange={e => setForm(f => ({ ...f, fixado: e.target.checked }))} />
                <span style={s.label}>Fixar no topo</span>
              </label>
            </div>

            <div style={s.modalBtns}>
              <button style={s.btnCancelar} onClick={() => setModal(null)}>Cancelar</button>
              <button style={{ ...s.btnSalvar, opacity: salvando ? 0.7 : 1 }} onClick={salvar} disabled={salvando}>
                {salvando ? 'Publicando...' : 'Publicar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

const s = {
  toolbar:      { display: 'flex', alignItems: 'center', gap: 16, marginBottom: '0.75rem' },
  btnNovo:      { background: '#003D7C', color: '#fff', padding: '0.6rem 1.4rem', borderRadius: 10, fontWeight: 700, border: 'none', cursor: 'pointer' },
  filtros:      { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: '1rem' },
  filtroBtn:    { padding: '0.35rem 0.9rem', borderRadius: 20, border: '2px solid #E2E8F0', background: '#fff', color: '#64748B', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' },
  filtroBtnOn:  { background: '#003D7C', color: '#fff', borderColor: '#003D7C' },
  vazio:        { textAlign: 'center', padding: '3rem', color: '#94A3B8', fontSize: '1rem', display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' },
  lista:        { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  card:         { background: '#fff', borderRadius: 12, padding: '1rem 1.1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  cardTop:      { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 8 },
  tipoBadge:    { padding: '0.2rem 0.65rem', borderRadius: 20, fontWeight: 700, fontSize: '0.75rem', whiteSpace: 'nowrap' },
  fixadoBadge:  { padding: '0.2rem 0.6rem', borderRadius: 20, background: '#F5F3FF', color: '#7C3AED', fontWeight: 700, fontSize: '0.75rem' },
  acoes:        { display: 'flex', gap: 5, flexShrink: 0 },
  btnAcao:      { padding: '0.3rem 0.55rem', borderRadius: 8, background: '#F1F5F9', fontSize: '0.85rem', border: 'none', cursor: 'pointer' },
  cardTitulo:   { fontWeight: 800, color: '#1A202C', marginBottom: 4, fontSize: '0.95rem' },
  cardTexto:    { color: '#475569', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: 6 },
  cardInfo:     { fontSize: '0.73rem', color: '#94A3B8' },
  overlay:      { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem' },
  modalBox:     { background: '#fff', borderRadius: 16, padding: '1.75rem', width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' },
  modalTitulo:  { fontWeight: 800, marginBottom: '1.25rem', color: '#1A202C' },
  label:        { fontWeight: 600, fontSize: '0.82rem', color: '#64748B', display: 'block', marginBottom: 5 },
  input:        { width: '100%', padding: '0.65rem 0.9rem', border: '2px solid #E2E8F0', borderRadius: 8, fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' },
  tipoBtnBase:  { padding: '0.4rem 0.85rem', borderRadius: 20, border: '2px solid #E2E8F0', background: '#fff', color: '#64748B', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer' },
  modalBtns:    { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: '1.25rem' },
  btnCancelar:  { padding: '0.65rem 1.4rem', borderRadius: 8, background: '#F1F5F9', color: '#64748B', fontWeight: 600, border: 'none', cursor: 'pointer' },
  btnSalvar:    { padding: '0.65rem 1.4rem', borderRadius: 8, background: '#003D7C', color: '#fff', fontWeight: 700, border: 'none', cursor: 'pointer' },
}
