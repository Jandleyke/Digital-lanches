import { useState } from 'react'
import Layout from '../../components/Layout'
import { useApp } from '../../contexts/AppContext'

const TIPOS = [
  { valor: 'info', label: 'Comunicado', bg: '#DBEAFE', color: '#1D4ED8' },
  { valor: 'promo', label: 'Promocao', bg: '#FEF3C7', color: '#D97706' },
  { valor: 'aviso', label: 'Aviso', bg: '#FEE2E2', color: '#DC2626' },
  { valor: 'novidade', label: 'Novidade', bg: '#F0FDF4', color: '#15803D' },
]

const DESTINOS = [
  { valor: 'todos', label: 'Todos', bg: '#F1F5F9', color: '#475569' },
  { valor: 'aluno', label: 'Alunos', bg: '#DBEAFE', color: '#1D4ED8' },
  { valor: 'vendedor', label: 'Vendedor', bg: '#E0F2FE', color: '#075985' },
  { valor: 'cozinha', label: 'Cozinha', bg: '#D1FAE5', color: '#065F46' },
  { valor: 'admin', label: 'Admin', bg: '#F3E8FF', color: '#6B21A8' },
]

const vazio = { titulo: '', mensagem: '', tipo: 'info', fixado: false, destino: 'todos', produtoId: '' }

function destinoAviso(aviso) {
  const destino = aviso.destino || aviso.destinatario || 'todos'
  if (destino === 'alunos') return 'aluno'
  if (destino === 'vendedora') return 'vendedor'
  return destino
}

function destinoMeta(destino) {
  return DESTINOS.find(x => x.valor === destino) || DESTINOS[0]
}

function tipoMeta(tipo) {
  return TIPOS.find(x => x.valor === tipo) || TIPOS[0]
}

function formatarData(valor) {
  if (!valor) return ''
  return new Date(valor).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function nomesLeitura(aviso) {
  const detalhes = Array.isArray(aviso.lidoDetalhes) ? aviso.lidoDetalhes : []
  if (detalhes.length > 0) {
    return detalhes.map(item => `${item.nome || 'Usuario'} (${formatarData(item.data)})`).join(', ')
  }
  const lidos = Array.isArray(aviso.lidoPor) ? aviso.lidoPor : []
  return lidos.length ? lidos.join(', ') : 'Ninguem ainda'
}

export default function Avisos() {
  const { avisos, produtos, criarAviso, editarAviso, excluirAviso, responderAviso, usuarioLogado } = useApp()
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(vazio)
  const [respostas, setRespostas] = useState({})
  const [salvando, setSalvando] = useState(false)
  const [filtro, setFiltro] = useState('todos')
  const [erro, setErro] = useState('')
  const [tipoAberto, setTipoAberto] = useState(false)

  function abrirNovo() {
    setForm(vazio)
    setModal('novo')
    setErro('')
    setTipoAberto(false)
  }

  function abrirEditar(aviso) {
    setForm({
      titulo: aviso.titulo || '',
      mensagem: aviso.mensagem || aviso.texto || '',
      tipo: aviso.tipo || 'info',
      fixado: !!aviso.fixado,
      destino: destinoAviso(aviso),
      produtoId: aviso.produtoPromocao?.id || '',
    })
    setModal(aviso)
    setErro('')
    setTipoAberto(false)
  }

  async function salvar() {
    setErro('')
    if (!form.titulo.trim()) {
      setErro('Informe o titulo do aviso.')
      return
    }
    setSalvando(true)
    const dados = {
      ...form,
      texto: form.mensagem,
      destinatario: form.destino,
      produtoPromocao: form.tipo === 'promo' ? produtos.find(p => String(p.id) === String(form.produtoId)) || null : null,
    }
    try {
      if (modal === 'novo') await criarAviso(dados)
      else await editarAviso(modal.id, dados)
      setModal(null)
    } catch {
      setErro('Não foi possível salvar o aviso.')
    } finally {
      setSalvando(false)
    }
  }

  async function handleExcluir(id) {
    setErro('')
    if (!confirm('Excluir este aviso?')) return
    try {
      await excluirAviso(id)
      if (modal?.id === id) setModal(null)
    } catch {
      setErro('Não foi possível excluir o aviso.')
    }
  }

  async function toggleFixado(aviso) {
    setErro('')
    try {
      await editarAviso(aviso.id, { fixado: !aviso.fixado })
    } catch {
      setErro('Não foi possível atualizar o aviso.')
    }
  }

  async function responder(e, aviso) {
    e.preventDefault()
    const texto = String(respostas[aviso.id] || '').trim()
    if (!texto) return
    await responderAviso(aviso.id, texto)
    setRespostas(prev => ({ ...prev, [aviso.id]: '' }))
  }

  const visiveis = filtro === 'todos'
    ? avisos
    : avisos.filter(aviso => destinoAviso(aviso) === filtro)

  return (
    <Layout titulo="Central de Avisos">
      <div style={s.toolbar}>
        <button style={s.btnNovo} onClick={abrirNovo}>+ Novo aviso</button>
        <span style={s.contador}>{avisos.length} aviso(s)</span>
      </div>
      {erro && <div style={s.erro}>{erro}</div>}

      <div style={s.filtros}>
        {DESTINOS.map(destino => (
          <button key={destino.valor}
            style={{ ...s.filtroBtn, ...(filtro === destino.valor ? s.filtroBtnOn : {}) }}
            onClick={() => setFiltro(destino.valor)}>
            {destino.label}
          </button>
        ))}
      </div>

      {visiveis.length === 0 ? (
        <div style={s.vazio}>Nenhum aviso para este filtro.</div>
      ) : (
        <div style={s.lista}>
          {visiveis.map(aviso => {
            const tipo = tipoMeta(aviso.tipo)
            const destino = destinoMeta(destinoAviso(aviso))
            const respostasAviso = Array.isArray(aviso.respostas) ? aviso.respostas : []
            const produtoPromocao = aviso.produtoPromocao || aviso.produtoPromo
            const ehAutor = aviso.autorId === (usuarioLogado?.uid || usuarioLogado?.matricula)
            return (
              <div key={aviso.id} style={{ ...s.card, borderLeft: `4px solid ${tipo.color}` }}>
                <div style={s.cardTop}>
                  <div style={s.badges}>
                    <span style={{ ...s.tipoBadge, background: tipo.bg, color: tipo.color }}>{tipo.label}</span>
                    <span style={{ ...s.tipoBadge, background: destino.bg, color: destino.color }}>{destino.label}</span>
                    {aviso.fixado && <span style={s.fixadoBadge}>Fixado</span>}
                  </div>
                  <div style={s.acoes}>
                    <button style={s.btnAcao} onClick={() => toggleFixado(aviso)}>{aviso.fixado ? 'Desafixar' : 'Fixar'}</button>
                    {ehAutor && <button style={s.btnAcao} onClick={() => abrirEditar(aviso)}>Editar</button>}
                    <button style={{ ...s.btnAcao, background: '#FEE2E2', color: '#DC2626' }} onClick={() => handleExcluir(aviso.id)}>Excluir</button>
                  </div>
                </div>
                <h3 style={s.cardTitulo}>{aviso.titulo}</h3>
                {(aviso.mensagem || aviso.texto) && <p style={s.cardTexto}>{aviso.mensagem || aviso.texto}</p>}
                {produtoPromocao && (
                  <div style={s.produtoPromo}>
                    {produtoPromocao.foto && <img src={produtoPromocao.foto} alt={produtoPromocao.nome} style={s.produtoPromoImg} />}
                    <div>
                      <strong>{produtoPromocao.nome}</strong>
                      <span>{produtoPromocao.categoria || 'Produto'} - R$ {Number(produtoPromocao.preco || 0).toFixed(2).replace('.', ',')}</span>
                    </div>
                  </div>
                )}
                <span style={s.cardInfo}>
                  Criado por {aviso.autorNome || aviso.autor || 'Sistema'} - {formatarData(aviso.createdAt || aviso.criadoEm)}
                </span>
                <div style={s.lidoInfo}>Lido por: {nomesLeitura(aviso)}</div>
                <div style={s.historico}>
                  <strong style={s.historicoTitulo}>Historico de respostas</strong>
                  {respostasAviso.length === 0 ? (
                    <div style={s.semResposta}>Nenhuma resposta ainda.</div>
                  ) : respostasAviso.map(resposta => (
                    <div key={resposta.id || `${resposta.autorId}-${resposta.criadoEm}`} style={s.resposta}>
                      <div style={s.respostaMeta}>{resposta.autorNome || 'Usuario'} - {formatarData(resposta.criadoEm)}</div>
                      <div style={s.respostaTexto}>{resposta.texto}</div>
                    </div>
                  ))}
                </div>
                <form onSubmit={e => responder(e, aviso)} style={s.respostaForm}>
                  <input
                    value={respostas[aviso.id] || ''}
                    onChange={e => setRespostas(prev => ({ ...prev, [aviso.id]: e.target.value }))}
                    placeholder="Responder aviso..."
                    style={s.respostaInput}
                  />
                  <button type="submit" style={s.respostaBtn}>Responder</button>
                </form>
              </div>
            )
          })}
        </div>
      )}

      {modal && (
        <div style={s.overlay}>
          <div style={s.modalBox}>
            <h3 style={s.modalTitulo}>{modal === 'novo' ? 'Novo aviso' : 'Editar aviso'}</h3>
            <div style={s.formGrid}>
              <div>
                <div style={s.labelRow}>
                  <label style={{ ...s.label, margin: 0 }}>Tipo</label>
                  <button type="button" style={s.editarTipoBtn} onClick={() => setTipoAberto(prev => !prev)}>
                    {tipoAberto ? 'Fechar tipos' : 'Editar tipo'}
                  </button>
                </div>
                <div style={s.opcoes}>
                  {(tipoAberto ? TIPOS : TIPOS.filter(tipo => tipo.valor === form.tipo)).map(tipo => (
                    <button key={tipo.valor}
                      style={{ ...s.tipoBtnBase, ...(form.tipo === tipo.valor ? { border: `2px solid ${tipo.color}`, background: tipo.bg, color: tipo.color } : {}) }}
                      onClick={() => setForm(f => ({ ...f, tipo: tipo.valor, produtoId: tipo.valor === 'promo' ? f.produtoId : '' }))}>
                      {tipo.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={s.label}>Destino</label>
                <div style={s.opcoes}>
                  {DESTINOS.map(destino => (
                    <button key={destino.valor}
                      style={{ ...s.tipoBtnBase, ...(form.destino === destino.valor ? { border: `2px solid ${destino.color}`, background: destino.bg, color: destino.color } : {}) }}
                      onClick={() => setForm(f => ({ ...f, destino: destino.valor }))}>
                      {destino.label}
                    </button>
                  ))}
                </div>
              </div>

              {form.tipo === 'promo' && (
                <div>
                  <label style={s.label}>Produto em promocao</label>
                  <select style={s.input} value={form.produtoId} onChange={e => setForm(f => ({ ...f, produtoId: e.target.value }))}>
                    <option value="">Selecione o produto</option>
                    {produtos.map(produto => (
                      <option key={produto.id} value={produto.id}>{produto.nome} - R$ {Number(produto.preco || 0).toFixed(2).replace('.', ',')}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label style={s.label}>Titulo</label>
                <input style={s.input} value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Cardápio especial de hoje" />
              </div>

              <div>
                <label style={s.label}>Mensagem</label>
                <textarea style={{ ...s.input, height: 90, resize: 'vertical' }} value={form.mensagem} onChange={e => setForm(f => ({ ...f, mensagem: e.target.value }))} placeholder="Descreva o aviso..." />
              </div>

              <label style={s.check}>
                <input type="checkbox" checked={form.fixado} onChange={e => setForm(f => ({ ...f, fixado: e.target.checked }))} />
                Fixar no topo
              </label>
            </div>

            <div style={s.modalBtns}>
              <button style={s.btnCancelar} onClick={() => setModal(null)}>Cancelar</button>
              <button style={{ ...s.btnSalvar, opacity: salvando ? 0.7 : 1 }} onClick={salvar} disabled={salvando}>
                {salvando ? 'Publicando...' : 'Publicar'}
              </button>
              {modal !== 'novo' && <button style={{ ...s.btnSalvar, background: '#EF4444' }} onClick={() => handleExcluir(modal.id)}>Excluir</button>}
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

const s = {
  toolbar: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: '0.75rem' },
  btnNovo: { background: '#003D7C', color: '#fff', padding: '0.6rem 1.4rem', borderRadius: 8, fontWeight: 800, border: 'none', cursor: 'pointer' },
  contador: { color: '#64748B', fontSize: '0.85rem' },
  erro: { marginBottom: '0.75rem', background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', borderRadius: 10, padding: '0.6rem 0.85rem', fontWeight: 800, fontSize: '0.86rem' },
  filtros: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: '1rem' },
  filtroBtn: { padding: '0.35rem 0.9rem', borderRadius: 20, border: '2px solid #E2E8F0', background: '#fff', color: '#64748B', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' },
  filtroBtnOn: { background: '#003D7C', color: '#fff', borderColor: '#003D7C' },
  vazio: { textAlign: 'center', padding: '3rem', color: '#94A3B8', background: '#fff', border: '1px dashed #CBD5E1', borderRadius: 8 },
  lista: { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  card: { background: '#fff', borderRadius: 8, padding: '1rem 1.1rem', border: '1px solid #E2E8F0' },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 8 },
  badges: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  tipoBadge: { padding: '0.2rem 0.65rem', borderRadius: 20, fontWeight: 800, fontSize: '0.75rem', whiteSpace: 'nowrap' },
  fixadoBadge: { padding: '0.2rem 0.6rem', borderRadius: 20, background: '#F5F3FF', color: '#7C3AED', fontWeight: 800, fontSize: '0.75rem' },
  acoes: { display: 'flex', gap: 5, flexShrink: 0 },
  btnAcao: { padding: '0.35rem 0.6rem', borderRadius: 8, background: '#F1F5F9', color: '#334155', fontSize: '0.78rem', border: 'none', cursor: 'pointer', fontWeight: 800 },
  cardTitulo: { fontWeight: 800, color: '#1A202C', margin: '0 0 4px', fontSize: '0.95rem' },
  cardTexto: { color: '#475569', fontSize: '0.85rem', lineHeight: 1.5, margin: '0 0 6px' },
  produtoPromo: { display: 'flex', alignItems: 'center', gap: 10, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: 10, margin: '8px 0', color: '#92400E', fontSize: '0.82rem' },
  produtoPromoImg: { width: 44, height: 44, borderRadius: 8, objectFit: 'cover', background: '#fff', flexShrink: 0 },
  cardInfo: { fontSize: '0.73rem', color: '#94A3B8' },
  lidoInfo: { fontSize: '0.72rem', color: '#94A3B8', marginTop: 4 },
  historico: { marginTop: 12, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: 10 },
  historicoTitulo: { display: 'block', color: '#0F172A', fontSize: '0.78rem', marginBottom: 6 },
  semResposta: { color: '#94A3B8', fontSize: '0.78rem', fontWeight: 700 },
  resposta: { borderTop: '1px solid #E2E8F0', paddingTop: 7, marginTop: 7 },
  respostaMeta: { color: '#64748B', fontSize: '0.72rem', fontWeight: 800 },
  respostaTexto: { color: '#334155', fontSize: '0.84rem', marginTop: 2, lineHeight: 1.4 },
  respostaForm: { display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  respostaInput: { flex: 1, minWidth: 180, border: '1px solid #CBD5E1', borderRadius: 10, padding: '0.6rem 0.75rem', fontFamily: 'inherit', outlineColor: '#003D7C' },
  respostaBtn: { border: 'none', borderRadius: 10, background: '#003D7C', color: '#fff', padding: '0.6rem 0.85rem', fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem' },
  modalBox: { background: '#fff', borderRadius: 12, padding: '1.5rem', width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto' },
  modalTitulo: { fontWeight: 800, margin: '0 0 1.25rem', color: '#1A202C' },
  formGrid: { display: 'flex', flexDirection: 'column', gap: '0.85rem' },
  opcoes: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  label: { fontWeight: 700, fontSize: '0.82rem', color: '#64748B', display: 'block', marginBottom: 5 },
  labelRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 5 },
  editarTipoBtn: { border: 'none', background: '#EAF2FF', color: '#004A8D', borderRadius: 999, padding: '0.32rem 0.65rem', fontWeight: 900, fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'inherit' },
  input: { width: '100%', padding: '0.65rem 0.9rem', border: '2px solid #E2E8F0', borderRadius: 8, fontSize: '0.9rem', outlineColor: '#003D7C', boxSizing: 'border-box', fontFamily: 'inherit' },
  tipoBtnBase: { padding: '0.4rem 0.85rem', borderRadius: 20, border: '2px solid #E2E8F0', background: '#fff', color: '#64748B', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' },
  check: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: '#475569', fontWeight: 700, fontSize: '0.86rem' },
  modalBtns: { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: '1.25rem' },
  btnCancelar: { padding: '0.65rem 1.4rem', borderRadius: 8, background: '#F1F5F9', color: '#64748B', fontWeight: 700, border: 'none', cursor: 'pointer' },
  btnSalvar: { padding: '0.65rem 1.4rem', borderRadius: 8, background: '#003D7C', color: '#fff', fontWeight: 800, border: 'none', cursor: 'pointer' },
}
