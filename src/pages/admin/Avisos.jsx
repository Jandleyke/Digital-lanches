import { useState } from 'react'
import { Archive, ArchiveRestore, MessageSquare, Send, X } from 'lucide-react'
import Layout from '../../components/Layout'
import RichTextEditor, { RichTextContent } from '../../components/RichTextEditor'
import { useApp } from '../../contexts/AppContext'
import { avisoArquivadoParaUsuario, usuarioAvisoId } from '../../utils/avisos'
import { plainTextToRichText, richTextToPlainText } from '../../utils/richText'
import { useIsMobile } from '../../utils/useIsMobile'

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

const vazio = { titulo: '', mensagem: '', mensagemHtml: '', tipo: 'info', fixado: false, destino: 'todos', produtoId: '' }

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
  const { avisos, produtos, criarAviso, editarAviso, excluirAviso, responderAviso, arquivarAvisoParaUsuario, desarquivarAvisoParaUsuario, usuarioLogado } = useApp()
  const isMobile = useIsMobile()
  const escopoArquivo = 'admin'
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(vazio)
  const [respostas, setRespostas] = useState({})
  const [salvando, setSalvando] = useState(false)
  const [filtro, setFiltro] = useState('todos')
  const [erro, setErro] = useState('')
  const [tipoAberto, setTipoAberto] = useState(false)
  const [visualizacao, setVisualizacao] = useState('ativos')
  const [detalheId, setDetalheId] = useState(null)
  const [focarResposta, setFocarResposta] = useState(false)

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
      mensagemHtml: aviso.mensagemHtml || plainTextToRichText(aviso.mensagem || aviso.texto || ''),
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
    const mensagemTexto = richTextToPlainText(form.mensagemHtml || plainTextToRichText(form.mensagem))
    const dados = {
      ...form,
      mensagem: mensagemTexto,
      texto: mensagemTexto,
      mensagemHtml: form.mensagemHtml,
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

  async function toggleArquivado(aviso) {
    setErro('')
    try {
      if (avisoArquivadoParaUsuario(aviso, usuarioLogado, escopoArquivo)) await desarquivarAvisoParaUsuario(aviso.id, escopoArquivo)
      else await arquivarAvisoParaUsuario(aviso.id, escopoArquivo)
    } catch {
      setErro('Nao foi possivel arquivar o aviso.')
    }
  }

  async function responder(e, aviso) {
    e.preventDefault()
    e.stopPropagation()
    const texto = String(respostas[aviso.id] || '').trim()
    if (!texto) return
    await responderAviso(aviso.id, texto)
    setRespostas(prev => ({ ...prev, [aviso.id]: '' }))
  }

  function abrirDetalhe(aviso, focar = false) {
    setDetalheId(aviso.id)
    setFocarResposta(focar)
  }

  function fecharDetalhe() {
    setDetalheId(null)
    setFocarResposta(false)
  }

  const filtrados = filtro === 'todos'
    ? avisos
    : avisos.filter(aviso => destinoAviso(aviso) === filtro)
  const leitorId = usuarioAvisoId(usuarioLogado)
  const totalAtivos = filtrados.filter(aviso => !avisoArquivadoParaUsuario(aviso, leitorId, escopoArquivo)).length
  const totalHistorico = filtrados.filter(aviso => avisoArquivadoParaUsuario(aviso, leitorId, escopoArquivo)).length
  const visiveis = filtrados.filter(aviso => visualizacao === 'historico' ? avisoArquivadoParaUsuario(aviso, leitorId, escopoArquivo) : !avisoArquivadoParaUsuario(aviso, leitorId, escopoArquivo))
  const detalheAviso = avisos.find(aviso => aviso.id === detalheId) || null

  return (
    <Layout titulo="Central de Avisos">
      <div style={s.toolbar}>
        <div style={s.abasHistorico}>
          <button type="button" style={{ ...s.abaBtn, ...(visualizacao === 'ativos' ? s.abaBtnOn : {}) }} onClick={() => setVisualizacao('ativos')}>
            Avisos <span style={s.abaNumero}>{totalAtivos}</span>
          </button>
          <button type="button" style={{ ...s.abaBtn, ...(visualizacao === 'historico' ? s.abaBtnOn : {}) }} onClick={() => setVisualizacao('historico')}>
            Historico <span style={s.abaNumero}>{totalHistorico}</span>
          </button>
        </div>
        <button style={s.btnNovo} onClick={abrirNovo}>+ Novo aviso</button>
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
        <div style={s.vazio}>{visualizacao === 'historico' ? 'Nenhum aviso arquivado neste filtro.' : 'Nenhum aviso ativo para este filtro.'}</div>
      ) : (
        <div style={s.lista}>
          {visiveis.map(aviso => {
            const tipo = tipoMeta(aviso.tipo)
            const destino = destinoMeta(destinoAviso(aviso))
            const respostasAviso = Array.isArray(aviso.respostas) ? aviso.respostas : []
            const ehAutor = aviso.autorId === (usuarioLogado?.uid || usuarioLogado?.matricula)
            const arquivado = avisoArquivadoParaUsuario(aviso, leitorId, escopoArquivo)
            return (
              <article
                key={aviso.id}
                onClick={() => abrirDetalhe(aviso)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    abrirDetalhe(aviso)
                  }
                }}
                role="button"
                tabIndex={0}
                style={{ ...s.card, ...(arquivado ? s.cardArquivado : {}), borderLeft: `4px solid ${arquivado ? '#94A3B8' : tipo.color}` }}
              >
                <div style={s.cardTop}>
                  <div style={s.badges}>
                    <span style={{ ...s.tipoBadge, background: tipo.bg, color: tipo.color }}>{tipo.label}</span>
                    <span style={{ ...s.tipoBadge, background: destino.bg, color: destino.color }}>{destino.label}</span>
                    {aviso.fixado && <span style={s.fixadoBadge}>Fixado</span>}
                    {arquivado && <span style={s.arquivadoBadge}>Arquivado</span>}
                    {respostasAviso.length > 0 && <span style={s.respostasBadge}>{respostasAviso.length} resposta(s)</span>}
                  </div>
                  <div style={s.acoes} onClick={e => e.stopPropagation()}>
                    {!arquivado && <button style={s.btnAcao} onClick={() => toggleFixado(aviso)}>{aviso.fixado ? 'Desafixar' : 'Fixar'}</button>}
                    {ehAutor && !arquivado && <button style={s.btnAcao} onClick={() => abrirEditar(aviso)}>Editar</button>}
                    <button style={s.btnAcao} onClick={() => toggleArquivado(aviso)}>
                      {arquivado ? <ArchiveRestore size={14} /> : <Archive size={14} />} {arquivado ? 'Desarquivar' : 'Arquivar'}
                    </button>
                    <button style={{ ...s.btnAcao, background: '#FEE2E2', color: '#DC2626' }} onClick={() => handleExcluir(aviso.id)}>Excluir</button>
                  </div>
                </div>
                <h3 style={s.cardTitulo}>{aviso.titulo}</h3>
                <RichTextContent html={aviso.mensagemHtml} text={aviso.mensagem || aviso.texto} style={s.cardTexto} />
                <div style={s.cardFooterResumo}>
                  <span>{aviso.autorNome || aviso.autor || 'Sistema'}</span>
                  <span>{formatarData(aviso.createdAt || aviso.criadoEm)}</span>
                </div>
                <div style={s.cardFooterAcoes} onClick={e => e.stopPropagation()}>
                  {!arquivado && (
                    <button type="button" style={s.responderToggle} onClick={() => abrirDetalhe(aviso, true)}>
                      <Send size={14} /> Responder
                    </button>
                  )}
                  <button type="button" style={s.verMaisBtn} onClick={() => abrirDetalhe(aviso)}>
                    <MessageSquare size={14} /> {respostasAviso.length > 0 ? `${respostasAviso.length} resposta(s)` : 'Ver detalhes'}
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {detalheAviso && (() => {
        const tipoDet = tipoMeta(detalheAviso.tipo)
        const destinoDet = destinoMeta(destinoAviso(detalheAviso))
        const respostasDet = Array.isArray(detalheAviso.respostas) ? detalheAviso.respostas : []
        const produtoPromoDet = detalheAviso.produtoPromocao || detalheAviso.produtoPromo
        const arquivadoDet = avisoArquivadoParaUsuario(detalheAviso, leitorId, escopoArquivo)
        return (
          <div style={{ ...s.overlayDetalhe, ...(isMobile ? s.overlayDetalheMobile : {}) }} onClick={fecharDetalhe}>
            <div style={{ ...s.modalDetalhe, ...(isMobile ? s.modalDetalheMobile : {}) }} onClick={e => e.stopPropagation()}>
              <div style={s.modalDetalheHeader}>
                <div style={s.badges}>
                  <span style={{ ...s.tipoBadge, background: tipoDet.bg, color: tipoDet.color }}>{tipoDet.label}</span>
                  <span style={{ ...s.tipoBadge, background: destinoDet.bg, color: destinoDet.color }}>{destinoDet.label}</span>
                  {detalheAviso.fixado && <span style={s.fixadoBadge}>Fixado</span>}
                  {arquivadoDet && <span style={s.arquivadoBadge}>Arquivado</span>}
                </div>
                <button type="button" style={s.fecharDetalheBtn} onClick={fecharDetalhe} aria-label="Fechar">
                  <X size={20} />
                </button>
              </div>
              <div style={s.modalDetalheBody}>
                <h2 style={s.modalDetalheTitulo}>{detalheAviso.titulo}</h2>
                <RichTextContent html={detalheAviso.mensagemHtml} text={detalheAviso.mensagem || detalheAviso.texto} style={s.modalDetalheTexto} />
                {produtoPromoDet && (
                  <div style={s.produtoPromo}>
                    {produtoPromoDet.foto && <img src={produtoPromoDet.foto} alt={produtoPromoDet.nome} style={s.produtoPromoImg} />}
                    <div>
                      <strong>{produtoPromoDet.nome}</strong>
                      <span>{produtoPromoDet.categoria || 'Produto'} - R$ {Number(produtoPromoDet.preco || 0).toFixed(2).replace('.', ',')}</span>
                    </div>
                  </div>
                )}
                <div style={s.cardInfo}>Criado por {detalheAviso.autorNome || detalheAviso.autor || 'Sistema'} - {formatarData(detalheAviso.createdAt || detalheAviso.criadoEm)}</div>
                {arquivadoDet && <div style={s.cardInfo}>Arquivado por voce</div>}
                <div style={s.lidoInfo}>Lido por: {nomesLeitura(detalheAviso)}</div>
                <div style={s.historico}>
                  <strong style={s.historicoTitulo}>Respostas</strong>
                  {respostasDet.length === 0 ? (
                    <div style={s.semResposta}>Nenhuma resposta ainda.</div>
                  ) : (
                    <div style={s.conversa}>
                      {respostasDet.map(resposta => {
                        const minhaResposta = String(resposta.autorId || '') === String(leitorId || '')
                        return (
                          <div key={resposta.id || `${resposta.autorId}-${resposta.criadoEm}`} style={{ ...s.balaoLinha, justifyContent: minhaResposta ? 'flex-end' : 'flex-start' }}>
                            <div style={{ ...s.balao, ...(minhaResposta ? s.balaoMeu : s.balaoOutro) }}>
                              <div style={s.respostaMeta}>{resposta.autorNome || 'Usuario'}</div>
                              <div style={s.respostaTexto}>{resposta.texto}</div>
                              <div style={s.balaoHora}>{formatarData(resposta.criadoEm)}</div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
              {arquivadoDet ? (
                <div style={s.arquivadoInfo}>Este aviso esta no seu historico. Desarquive para responder ou editar.</div>
              ) : (
                <form onSubmit={e => responder(e, detalheAviso)} style={s.respostaFormFixa}>
                  <input
                    autoFocus={focarResposta}
                    value={respostas[detalheAviso.id] || ''}
                    onChange={e => setRespostas(prev => ({ ...prev, [detalheAviso.id]: e.target.value }))}
                    placeholder="Responder aviso..."
                    style={s.respostaInput}
                  />
                  <button type="submit" style={s.respostaBtn}><Send size={14} /> Enviar</button>
                </form>
              )}
            </div>
          </div>
        )
      })()}

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
                <RichTextEditor
                  value={form.mensagemHtml || plainTextToRichText(form.mensagem)}
                  onChange={({ html, text }) => setForm(f => ({ ...f, mensagemHtml: html, mensagem: text }))}
                  placeholder="Descreva o aviso..."
                />
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
  abasHistorico: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  abaBtn: { border: '1px solid #D8E3F4', background: '#fff', color: '#475569', borderRadius: 999, padding: '0.42rem 0.75rem', fontWeight: 900, fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 },
  abaBtnOn: { background: '#003D7C', color: '#fff', borderColor: '#003D7C', boxShadow: '0 6px 14px rgba(0,61,124,0.14)' },
  abaNumero: { minWidth: 20, height: 20, padding: '0 0.35rem', borderRadius: 999, background: 'rgba(148,163,184,0.18)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' },
  btnNovo: { background: '#003D7C', color: '#fff', padding: '0.6rem 1.4rem', borderRadius: 8, fontWeight: 800, border: 'none', cursor: 'pointer' },
  erro: { marginBottom: '0.75rem', background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', borderRadius: 10, padding: '0.6rem 0.85rem', fontWeight: 800, fontSize: '0.86rem' },
  filtros: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: '1rem' },
  filtroBtn: { padding: '0.35rem 0.9rem', borderRadius: 20, border: '2px solid #E2E8F0', background: '#fff', color: '#64748B', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' },
  filtroBtnOn: { background: '#003D7C', color: '#fff', borderColor: '#003D7C' },
  vazio: { textAlign: 'center', padding: '3rem', color: '#94A3B8', background: '#fff', border: '1px dashed #CBD5E1', borderRadius: 8 },
  lista: { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  card: { background: '#fff', borderRadius: 8, padding: '0.9rem 1rem', border: '1px solid #E2E8F0', cursor: 'pointer', outline: 'none', boxShadow: '0 1px 3px rgba(15,23,42,0.03)' },
  cardArquivado: { background: '#F8FAFC', borderColor: '#CBD5E1' },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 8 },
  badges: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  tipoBadge: { padding: '0.2rem 0.65rem', borderRadius: 20, fontWeight: 800, fontSize: '0.75rem', whiteSpace: 'nowrap' },
  fixadoBadge: { padding: '0.2rem 0.6rem', borderRadius: 20, background: '#F5F3FF', color: '#7C3AED', fontWeight: 800, fontSize: '0.75rem' },
  arquivadoBadge: { padding: '0.2rem 0.6rem', borderRadius: 20, background: '#E2E8F0', color: '#475569', fontWeight: 800, fontSize: '0.75rem' },
  respostasBadge: { padding: '0.2rem 0.6rem', borderRadius: 20, background: '#EAF2FF', color: '#003D7C', fontWeight: 800, fontSize: '0.75rem' },
  acoes: { display: 'flex', gap: 5, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' },
  btnAcao: { padding: '0.35rem 0.6rem', borderRadius: 8, background: '#F1F5F9', color: '#334155', fontSize: '0.78rem', border: 'none', cursor: 'pointer', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'inherit' },
  cardTitulo: { fontWeight: 800, color: '#1A202C', margin: '0 0 4px', fontSize: '0.95rem' },
  cardTexto: { color: '#475569', fontSize: '0.85rem', lineHeight: 1.5, margin: '0 0 6px' },
  cardFooterResumo: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', color: '#64748B', fontSize: '0.72rem', fontWeight: 700, marginTop: 6 },
  cardFooterAcoes: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 9 },
  verMaisBtn: { border: '1px solid #E2E8F0', background: '#F8FAFC', color: '#475569', borderRadius: 10, padding: '0.5rem 0.75rem', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'inherit' },
  produtoPromo: { display: 'flex', alignItems: 'center', gap: 10, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: 10, margin: '8px 0', color: '#92400E', fontSize: '0.82rem' },
  produtoPromoImg: { width: 44, height: 44, borderRadius: 8, objectFit: 'cover', background: '#fff', flexShrink: 0 },
  cardInfo: { fontSize: '0.73rem', color: '#94A3B8' },
  lidoInfo: { fontSize: '0.72rem', color: '#94A3B8', marginTop: 4 },
  historico: { marginTop: 12, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: 10 },
  historicoTitulo: { display: 'block', color: '#0F172A', fontSize: '0.78rem', marginBottom: 6 },
  semResposta: { color: '#94A3B8', fontSize: '0.78rem', fontWeight: 700 },
  conversa: { display: 'flex', flexDirection: 'column', gap: 8 },
  balaoLinha: { display: 'flex', width: '100%' },
  balao: { maxWidth: 'min(82%, 520px)', borderRadius: 14, padding: '0.55rem 0.7rem', boxShadow: '0 1px 2px rgba(15,23,42,0.05)' },
  balaoMeu: { background: '#DCFCE7', color: '#14532D', borderBottomRightRadius: 4 },
  balaoOutro: { background: '#fff', color: '#334155', border: '1px solid #E2E8F0', borderBottomLeftRadius: 4 },
  respostaMeta: { color: 'inherit', opacity: 0.82, fontSize: '0.72rem', fontWeight: 900, marginBottom: 2 },
  respostaTexto: { color: 'inherit', fontSize: '0.84rem', marginTop: 2, lineHeight: 1.4, whiteSpace: 'pre-wrap' },
  balaoHora: { marginTop: 4, fontSize: '0.67rem', opacity: 0.68, textAlign: 'right', fontWeight: 700 },
  responderToggle: { border: 'none', borderRadius: 10, background: '#003D7C', color: '#fff', padding: '0.5rem 0.8rem', fontWeight: 900, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'inherit', fontSize: '0.78rem' },
  respostaInput: { flex: 1, minWidth: 0, border: '1px solid #CBD5E1', borderRadius: 10, padding: '0.6rem 0.75rem', fontFamily: 'inherit', outlineColor: '#003D7C' },
  respostaBtn: { border: 'none', borderRadius: 10, background: '#003D7C', color: '#fff', padding: '0.6rem 0.85rem', fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 },
  arquivadoInfo: { margin: '0 1rem 1rem', background: '#EEF2F7', color: '#64748B', borderRadius: 10, padding: '0.65rem 0.8rem', fontWeight: 800, fontSize: '0.78rem' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem' },
  modalBox: { background: '#fff', borderRadius: 12, padding: '1.5rem', width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto' },
  modalTitulo: { fontWeight: 800, margin: '0 0 1.25rem', color: '#1A202C' },
  overlayDetalhe: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: '1.25rem' },
  overlayDetalheMobile: { padding: 0 },
  modalDetalhe: { background: '#fff', borderRadius: 16, width: '100%', maxWidth: 620, maxHeight: '86vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 50px rgba(15,23,42,0.25)' },
  modalDetalheMobile: { maxWidth: '100%', width: '100%', height: '100%', maxHeight: '100%', borderRadius: 0 },
  modalDetalheHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, padding: '1rem 1.1rem', borderBottom: '1px solid #E2E8F0' },
  fecharDetalheBtn: { border: 'none', background: '#F1F5F9', color: '#475569', borderRadius: 999, width: 34, height: 34, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 },
  modalDetalheBody: { flex: 1, overflowY: 'auto', padding: '1rem 1.1rem' },
  modalDetalheTitulo: { fontWeight: 800, fontSize: '1.15rem', margin: '0 0 10px', color: '#1A202C', lineHeight: 1.3 },
  modalDetalheTexto: { color: '#334155', fontSize: '0.92rem', lineHeight: 1.6, margin: '0 0 14px' },
  respostaFormFixa: { display: 'flex', gap: 8, padding: '0.75rem 1.1rem', borderTop: '1px solid #E2E8F0', background: '#fff' },
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
