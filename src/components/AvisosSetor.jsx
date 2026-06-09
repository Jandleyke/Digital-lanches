import { useState } from 'react'
import { CheckCircle2, Pin, Send, Trash2 } from 'lucide-react'
import { useApp } from '../contexts/AppContext'
import { normalizarPerfil } from '../utils/perfis'

const TIPOS = [
  { valor: 'info', label: 'Comunicado', bg: '#DBEAFE', color: '#1D4ED8' },
  { valor: 'promo', label: 'Promocao', bg: '#FEF3C7', color: '#D97706' },
  { valor: 'aviso', label: 'Aviso', bg: '#FEE2E2', color: '#DC2626' },
  { valor: 'novidade', label: 'Novidade', bg: '#F0FDF4', color: '#15803D' },
  { valor: 'produto_indisponivel', label: 'Produto', bg: '#FEF3C7', color: '#D97706' },
  { valor: 'pedido_atrasado', label: 'Pedido', bg: '#FEE2E2', color: '#DC2626' },
  { valor: 'producao_pausada', label: 'Producao', bg: '#F0FDF4', color: '#15803D' },
  { valor: 'lanche_pronto', label: 'Pronto', bg: '#F5F3FF', color: '#7C3AED' },
]

const DESTINOS = [
  { valor: 'todos', label: 'Todos', bg: '#F1F5F9', color: '#475569' },
  { valor: 'aluno', label: 'Alunos', bg: '#DBEAFE', color: '#1D4ED8' },
  { valor: 'vendedor', label: 'Vendedor', bg: '#E0F2FE', color: '#075985' },
  { valor: 'cozinha', label: 'Cozinha', bg: '#D1FAE5', color: '#065F46' },
  { valor: 'admin', label: 'Admin', bg: '#F3E8FF', color: '#6B21A8' },
]

const PRIORIDADES = [
  { valor: 'baixa', label: 'Baixa', bg: '#DCFCE7', color: '#166534' },
  { valor: 'media', label: 'Media', bg: '#FEF3C7', color: '#92400E' },
  { valor: 'alta', label: 'Alta', bg: '#FEE2E2', color: '#B91C1C' },
]

const vazio = { titulo: '', mensagem: '', destino: 'todos', tipo: 'info', prioridade: 'media', status: 'ativo', produtoId: '' }

function destinosPermitidos(role) {
  if (role === 'admin' || role === 'professor') return ['todos', 'aluno', 'vendedor', 'cozinha', 'admin']
  if (role === 'vendedor') return ['aluno', 'cozinha', 'admin']
  if (role === 'cozinha') return ['aluno', 'vendedor', 'admin']
  return []
}

function destinoAviso(aviso) {
  const destino = aviso.destino || aviso.destinatario || 'todos'
  if (destino === 'alunos') return 'aluno'
  if (destino === 'vendedora') return 'vendedor'
  return destino
}

function avisoVisivel(aviso, role) {
  const destino = destinoAviso(aviso)
  if (role === 'admin' || role === 'professor') return true
  if (role === 'aluno') return ['todos', 'aluno'].includes(destino)
  return destino === 'todos' || destino === role
}

function meta(lista, valor) {
  return lista.find(item => item.valor === valor) || lista[0]
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

function tiposPermitidos(role) {
  if (role === 'professor') return TIPOS.filter(tipo => ['info', 'aviso', 'novidade'].includes(tipo.valor))
  return TIPOS
}

export default function AvisosSetor({ setor }) {
  const { avisos, produtos, criarAviso, editarAviso, marcarAvisoLido, excluirAviso, responderAviso, usuarioLogado } = useApp()
  const role = normalizarPerfil(usuarioLogado?.perfil || setor)
  const destinos = destinosPermitidos(role)
  const leitorId = usuarioLogado?.uid || usuarioLogado?.matricula
  const [filtro, setFiltro] = useState('todos')
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState({ ...vazio, destino: destinos[0] || 'todos' })
  const [respostas, setRespostas] = useState({})
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [tipoAberto, setTipoAberto] = useState(false)

  const lista = avisos
    .filter(aviso => avisoVisivel(aviso, role))
    .filter(aviso => filtro === 'todos' || destinoAviso(aviso) === filtro)
  const tiposDisponiveis = tiposPermitidos(role)

  function abrirNovo() {
    setForm({ ...vazio, destino: destinos[0] || 'todos' })
    setEditando(null)
    setErro('')
    setTipoAberto(false)
    setModal(true)
  }

  function abrirEditar(aviso) {
    const tipoAtual = aviso.tipo || 'info'
    const tipoPodeUsar = tiposDisponiveis.some(tipo => tipo.valor === tipoAtual)
    setForm({
      titulo: aviso.titulo || '',
      mensagem: aviso.mensagem || aviso.texto || '',
      destino: destinoAviso(aviso),
      tipo: tipoPodeUsar ? tipoAtual : 'info',
      prioridade: aviso.prioridade || 'media',
      status: aviso.status || 'ativo',
      produtoId: aviso.produtoPromocao?.id || '',
    })
    setEditando(aviso)
    setErro('')
    setTipoAberto(false)
    setModal(true)
  }

  async function salvar(e) {
    e.preventDefault()
    setErro('')
    if (!form.titulo.trim() || !form.mensagem.trim()) {
      setErro('Preencha titulo e mensagem.')
      return
    }
    setSalvando(true)
    try {
      await criarAviso({
        titulo: form.titulo.trim(),
        mensagem: form.mensagem.trim(),
        destino: form.destino,
        tipo: form.tipo,
        prioridade: form.prioridade,
        status: form.status,
        produtoPromocao: form.tipo === 'promo' ? produtos.find(p => String(p.id) === String(form.produtoId)) || null : null,
      })
      setModal(false)
    } catch {
      setErro('Não foi possível publicar o aviso.')
    } finally {
      setSalvando(false)
    }
  }

  async function atualizar(e) {
    e.preventDefault()
    setErro('')
    if (!editando?.id || !form.titulo.trim() || !form.mensagem.trim()) {
      setErro('Preencha titulo e mensagem.')
      return
    }
    setSalvando(true)
    try {
      const produtoPromocao = form.tipo === 'promo' ? produtos.find(p => String(p.id) === String(form.produtoId)) || null : null
      await editarAviso(editando.id, {
        titulo: form.titulo.trim(),
        mensagem: form.mensagem.trim(),
        texto: form.mensagem.trim(),
        destino: form.destino,
        destinatario: form.destino,
        tipo: form.tipo,
        prioridade: form.prioridade,
        status: form.status,
        produtoPromocao: produtoPromocao ? {
          id: produtoPromocao.id,
          nome: produtoPromocao.nome || '',
          preco: Number(produtoPromocao.preco || 0),
          categoria: produtoPromocao.categoria || '',
          foto: produtoPromocao.foto || '',
        } : null,
      })
      setModal(false)
      setEditando(null)
    } catch {
      setErro('Não foi possível salvar o aviso.')
    } finally {
      setSalvando(false)
    }
  }

  async function remover(aviso) {
    if (!aviso?.id || !confirm('Excluir este aviso?')) return
    await excluirAviso(aviso.id)
  }

  async function toggleFixado(aviso) {
    await editarAviso(aviso.id, { fixado: !aviso.fixado })
  }

  async function responder(e, aviso) {
    e.preventDefault()
    const texto = String(respostas[aviso.id] || '').trim()
    if (!texto) return
    await responderAviso(aviso.id, texto)
    setRespostas(prev => ({ ...prev, [aviso.id]: '' }))
  }

  return (
    <>
      <div style={s.toolbar}>
        {destinos.length > 0 && <button style={s.btnNovo} onClick={abrirNovo}>+ Novo aviso</button>}
        <span style={s.contador}>{lista.length} aviso(s)</span>
      </div>

      <div style={s.filtros}>
        {DESTINOS.filter(destino => destino.valor === 'todos' || destinos.includes(destino.valor) || role === 'admin' || role === 'professor').map(destino => (
          <button key={destino.valor} style={{ ...s.filtroBtn, ...(filtro === destino.valor ? s.filtroBtnOn : {}) }} onClick={() => setFiltro(destino.valor)}>
            {destino.label}
          </button>
        ))}
      </div>

      {lista.length === 0 ? (
        <div style={s.vazio}>Nenhum aviso para este filtro.</div>
      ) : (
        <div style={s.lista}>
          {lista.map(aviso => {
            const destino = meta(DESTINOS, destinoAviso(aviso))
            const tipo = meta(TIPOS, aviso.tipo || 'info')
            const prioridade = meta(PRIORIDADES, aviso.prioridade || 'media')
            const lido = Array.isArray(aviso.lidoPor) && aviso.lidoPor.includes(leitorId)
            const ehAutor = aviso.autorId === leitorId
            const podeExcluir = role === 'admin' || role === 'professor' || aviso.autorId === leitorId || normalizarPerfil(aviso.autorRole) === role
            const podeGerenciar = destinos.length > 0
            const podeEditar = ehAutor
            const respostasAviso = Array.isArray(aviso.respostas) ? aviso.respostas : []
            const produtoPromocao = aviso.produtoPromocao || aviso.produtoPromo
            return (
              <article key={aviso.id} style={{ ...s.card, borderLeft: `4px solid ${tipo.color}` }}>
                <div style={s.cardTop}>
                  <div style={s.badges}>
                    <span style={{ ...s.tipoBadge, background: tipo.bg, color: tipo.color }}>{tipo.label}</span>
                    <span style={{ ...s.tipoBadge, background: destino.bg, color: destino.color }}>{destino.label}</span>
                    <span style={{ ...s.tipoBadge, background: prioridade.bg, color: prioridade.color }}>{prioridade.label}</span>
                    {aviso.fixado && <span style={s.fixadoBadge}>Fixado</span>}
                  </div>
                  <div style={s.acoes}>
                    {podeGerenciar && (
                      <button style={s.btnAcao} onClick={() => toggleFixado(aviso)}>
                        <Pin size={14} /> {aviso.fixado ? 'Desafixar' : 'Fixar'}
                      </button>
                    )}
                    {!lido && (
                      <button style={s.btnAcao} onClick={() => marcarAvisoLido(aviso.id)}>
                        <CheckCircle2 size={14} /> Lido
                      </button>
                    )}
                    {podeEditar && (
                      <button style={s.btnAcao} onClick={() => abrirEditar(aviso)}>
                        Editar
                      </button>
                    )}
                    {podeExcluir && (
                      <button style={{ ...s.btnAcao, background: '#FEE2E2', color: '#DC2626' }} onClick={() => remover(aviso)}>
                        <Trash2 size={14} /> Excluir
                      </button>
                    )}
                  </div>
                </div>
                <h3 style={s.cardTitulo}>{aviso.titulo}</h3>
                <p style={s.cardTexto}>{aviso.mensagem || aviso.texto}</p>
                {produtoPromocao && (
                  <div style={s.produtoPromo}>
                    {produtoPromocao.foto && <img src={produtoPromocao.foto} alt={produtoPromocao.nome} style={s.produtoPromoImg} />}
                    <div>
                      <strong>{produtoPromocao.nome}</strong>
                      <span>{produtoPromocao.categoria || 'Produto'} - R$ {Number(produtoPromocao.preco || 0).toFixed(2).replace('.', ',')}</span>
                    </div>
                  </div>
                )}
                <div style={s.cardInfo}>Criado por {aviso.autorNome || aviso.autor || 'Sistema'} - {formatarData(aviso.createdAt || aviso.criadoEm)}</div>
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
                  <button type="submit" style={s.respostaBtn}><Send size={14} /> Responder</button>
                </form>
              </article>
            )
          })}
        </div>
      )}

      {modal && (
        <div style={s.overlay}>
          <form onSubmit={editando ? atualizar : salvar} style={s.modalBox}>
            <h3 style={s.modalTitulo}>{editando ? 'Editar aviso' : 'Novo aviso'}</h3>
            <div style={s.labelRow}>
              <label style={{ ...s.label, margin: 0 }}>Tipo</label>
              {tiposDisponiveis.length > 1 && (
                <button type="button" style={s.editarTipoBtn} onClick={() => setTipoAberto(prev => !prev)}>
                  {tipoAberto ? 'Fechar tipos' : 'Editar tipo'}
                </button>
              )}
            </div>
            <div style={s.opcoes}>
              {(tipoAberto ? tiposDisponiveis : tiposDisponiveis.filter(tipo => tipo.valor === form.tipo)).map(tipo => (
                <button type="button" key={tipo.valor} style={{ ...s.tipoBtnBase, ...(form.tipo === tipo.valor ? { border: `2px solid ${tipo.color}`, background: tipo.bg, color: tipo.color } : {}) }} onClick={() => setForm(f => ({ ...f, tipo: tipo.valor, produtoId: tipo.valor === 'promo' ? f.produtoId : '' }))}>
                  {tipo.label}
                </button>
              ))}
            </div>

            {form.tipo === 'promo' && (
              <>
                <label style={s.label}>Produto em promocao</label>
                <select style={s.input} value={form.produtoId} onChange={e => setForm(f => ({ ...f, produtoId: e.target.value }))}>
                  <option value="">Selecione o produto</option>
                  {produtos.map(produto => (
                    <option key={produto.id} value={produto.id}>{produto.nome} - R$ {Number(produto.preco || 0).toFixed(2).replace('.', ',')}</option>
                  ))}
                </select>
              </>
            )}

            <label style={s.label}>Destino</label>
            <div style={s.opcoes}>
              {DESTINOS.filter(destino => destinos.includes(destino.valor)).map(destino => (
                <button type="button" key={destino.valor} style={{ ...s.tipoBtnBase, ...(form.destino === destino.valor ? { border: `2px solid ${destino.color}`, background: destino.bg, color: destino.color } : {}) }} onClick={() => setForm(f => ({ ...f, destino: destino.valor }))}>
                  {destino.label}
                </button>
              ))}
            </div>

            <label style={s.label}>Prioridade</label>
            <div style={s.opcoes}>
              {PRIORIDADES.map(prioridade => (
                <button type="button" key={prioridade.valor} style={{ ...s.tipoBtnBase, ...(form.prioridade === prioridade.valor ? { border: `2px solid ${prioridade.color}`, background: prioridade.bg, color: prioridade.color } : {}) }} onClick={() => setForm(f => ({ ...f, prioridade: prioridade.valor }))}>
                  {prioridade.label}
                </button>
              ))}
            </div>

            <label style={s.label}>Titulo</label>
            <input style={s.input} value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Cardápio especial de hoje" />
            <label style={s.label}>Mensagem</label>
            <textarea style={{ ...s.input, height: 90, resize: 'vertical' }} value={form.mensagem} onChange={e => setForm(f => ({ ...f, mensagem: e.target.value }))} placeholder="Descreva o aviso..." />
            {erro && <div style={s.erro}>{erro}</div>}
            <div style={s.modalBtns}>
              <button type="button" style={s.btnCancelar} onClick={() => { setModal(false); setEditando(null) }}>Cancelar</button>
              <button type="submit" style={{ ...s.btnSalvar, opacity: salvando ? 0.7 : 1 }} disabled={salvando}>
                <Send size={15} /> {salvando ? 'Salvando...' : editando ? 'Salvar' : 'Publicar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}

const s = {
  toolbar: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: '0.75rem' },
  btnNovo: { background: '#003D7C', color: '#fff', padding: '0.6rem 1.4rem', borderRadius: 8, fontWeight: 800, border: 'none', cursor: 'pointer', fontFamily: 'inherit' },
  contador: { color: '#64748B', fontSize: '0.85rem' },
  filtros: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: '1rem' },
  filtroBtn: { padding: '0.35rem 0.9rem', borderRadius: 20, border: '2px solid #E2E8F0', background: '#fff', color: '#64748B', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit' },
  filtroBtnOn: { background: '#003D7C', color: '#fff', borderColor: '#003D7C' },
  vazio: { textAlign: 'center', padding: '3rem', color: '#94A3B8', background: '#fff', border: '1px dashed #CBD5E1', borderRadius: 8 },
  lista: { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  card: { background: '#fff', borderRadius: 8, padding: '1rem 1.1rem', border: '1px solid #E2E8F0' },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 8 },
  badges: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  tipoBadge: { padding: '0.2rem 0.65rem', borderRadius: 20, fontWeight: 800, fontSize: '0.75rem', whiteSpace: 'nowrap' },
  fixadoBadge: { padding: '0.2rem 0.6rem', borderRadius: 20, background: '#F5F3FF', color: '#7C3AED', fontWeight: 800, fontSize: '0.75rem' },
  acoes: { display: 'flex', gap: 5, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' },
  btnAcao: { padding: '0.35rem 0.6rem', borderRadius: 8, background: '#F1F5F9', color: '#334155', fontSize: '0.78rem', border: 'none', cursor: 'pointer', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'inherit' },
  cardTitulo: { fontWeight: 800, color: '#1A202C', margin: '0 0 4px', fontSize: '0.95rem' },
  cardTexto: { color: '#475569', fontSize: '0.85rem', lineHeight: 1.5, margin: '0 0 6px' },
  produtoPromo: { display: 'flex', alignItems: 'center', gap: 10, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: 10, margin: '8px 0', color: '#92400E', fontSize: '0.82rem' },
  produtoPromoImg: { width: 44, height: 44, borderRadius: 8, objectFit: 'cover', background: '#fff', flexShrink: 0 },
  cardInfo: { fontSize: '0.73rem', color: '#64748B', fontWeight: 700 },
  lidoInfo: { fontSize: '0.72rem', color: '#94A3B8', marginTop: 4 },
  historico: { marginTop: 12, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: 10 },
  historicoTitulo: { display: 'block', color: '#0F172A', fontSize: '0.78rem', marginBottom: 6 },
  semResposta: { color: '#94A3B8', fontSize: '0.78rem', fontWeight: 700 },
  resposta: { borderTop: '1px solid #E2E8F0', paddingTop: 7, marginTop: 7 },
  respostaMeta: { color: '#64748B', fontSize: '0.72rem', fontWeight: 800 },
  respostaTexto: { color: '#334155', fontSize: '0.84rem', marginTop: 2, lineHeight: 1.4 },
  respostaForm: { display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  respostaInput: { flex: 1, minWidth: 180, border: '1px solid #CBD5E1', borderRadius: 10, padding: '0.6rem 0.75rem', fontFamily: 'inherit', outlineColor: '#003D7C' },
  respostaBtn: { border: 'none', borderRadius: 10, background: '#003D7C', color: '#fff', padding: '0.6rem 0.85rem', fontWeight: 900, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'inherit' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem' },
  modalBox: { background: '#fff', borderRadius: 12, padding: '1.5rem', width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto' },
  modalTitulo: { fontWeight: 800, margin: '0 0 1.25rem', color: '#1A202C' },
  label: { display: 'block', color: '#64748B', fontWeight: 800, margin: '0.85rem 0 0.35rem', fontSize: '0.83rem' },
  labelRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: '0.85rem' },
  editarTipoBtn: { border: 'none', background: '#EAF2FF', color: '#004A8D', borderRadius: 999, padding: '0.32rem 0.65rem', fontWeight: 900, fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'inherit' },
  opcoes: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  tipoBtnBase: { padding: '0.45rem 0.9rem', borderRadius: 999, border: '2px solid #E2E8F0', background: '#fff', color: '#64748B', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' },
  input: { width: '100%', boxSizing: 'border-box', border: '2px solid #E2E8F0', borderRadius: 10, padding: '0.75rem 0.9rem', fontFamily: 'inherit', outlineColor: '#003D7C' },
  erro: { marginTop: 10, background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', borderRadius: 10, padding: '0.6rem 0.85rem', fontWeight: 800, fontSize: '0.86rem' },
  modalBtns: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 },
  btnCancelar: { border: 'none', borderRadius: 8, background: '#F1F5F9', color: '#64748B', padding: '0.7rem 1.2rem', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' },
  btnSalvar: { border: 'none', borderRadius: 8, background: '#003D7C', color: '#fff', padding: '0.7rem 1.2rem', fontWeight: 900, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'inherit' },
}
