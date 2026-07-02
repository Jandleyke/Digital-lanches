import { useState } from 'react'
import { Archive, ArchiveRestore, CheckCircle2, MessageSquare, Pin, Send, Trash2, X } from 'lucide-react'
import { useApp } from '../contexts/AppContext'
import RichTextEditor, { RichTextContent } from './RichTextEditor'
import { normalizarPerfil } from '../utils/perfis'
import { avisoArquivadoParaUsuario } from '../utils/avisos'
import { plainTextToRichText, richTextToPlainText } from '../utils/richText'
import { useIsMobile } from '../utils/useIsMobile'

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

const vazio = { titulo: '', mensagem: '', mensagemHtml: '', destino: 'todos', tipo: 'info', prioridade: 'media', status: 'ativo', produtoId: '' }

function destinosPermitidos(role) {
  if (role === 'admin' || role === 'gerente' || role === 'professor') return ['todos', 'aluno', 'vendedor', 'cozinha', 'admin']
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
  if (role === 'admin' || role === 'gerente' || role === 'professor') return true
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
  const { avisos, produtos, criarAviso, editarAviso, marcarAvisoLido, excluirAviso, responderAviso, arquivarAvisoParaUsuario, desarquivarAvisoParaUsuario, usuarioLogado } = useApp()
  const isMobile = useIsMobile()
  const role = normalizarPerfil(usuarioLogado?.perfil || setor)
  const escopoArquivo = role || setor || 'geral'
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
  const [visualizacao, setVisualizacao] = useState('ativos')
  const [detalheId, setDetalheId] = useState(null)
  const [focarResposta, setFocarResposta] = useState(false)

  const listaBase = avisos
    .filter(aviso => avisoVisivel(aviso, role))
    .filter(aviso => filtro === 'todos' || destinoAviso(aviso) === filtro)
  const totalAtivos = listaBase.filter(aviso => !avisoArquivadoParaUsuario(aviso, leitorId, escopoArquivo)).length
  const totalHistorico = listaBase.filter(aviso => avisoArquivadoParaUsuario(aviso, leitorId, escopoArquivo)).length
  const lista = listaBase.filter(aviso => visualizacao === 'historico' ? avisoArquivadoParaUsuario(aviso, leitorId, escopoArquivo) : !avisoArquivadoParaUsuario(aviso, leitorId, escopoArquivo))
  const tiposDisponiveis = tiposPermitidos(role)
  const detalheAviso = avisos.find(aviso => aviso.id === detalheId) || null

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
      mensagemHtml: aviso.mensagemHtml || plainTextToRichText(aviso.mensagem || aviso.texto || ''),
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
    const mensagemTexto = richTextToPlainText(form.mensagemHtml || plainTextToRichText(form.mensagem))
    if (!form.titulo.trim() || !mensagemTexto) {
      setErro('Preencha titulo e mensagem.')
      return
    }
    setSalvando(true)
    try {
      await criarAviso({
        titulo: form.titulo.trim(),
        mensagem: mensagemTexto,
        texto: mensagemTexto,
        mensagemHtml: form.mensagemHtml,
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
    const mensagemTexto = richTextToPlainText(form.mensagemHtml || plainTextToRichText(form.mensagem))
    if (!editando?.id || !form.titulo.trim() || !mensagemTexto) {
      setErro('Preencha titulo e mensagem.')
      return
    }
    setSalvando(true)
    try {
      const produtoPromocao = form.tipo === 'promo' ? produtos.find(p => String(p.id) === String(form.produtoId)) || null : null
      await editarAviso(editando.id, {
        titulo: form.titulo.trim(),
        mensagem: mensagemTexto,
        texto: mensagemTexto,
        mensagemHtml: form.mensagemHtml,
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

  async function toggleArquivado(aviso) {
    if (avisoArquivadoParaUsuario(aviso, leitorId, escopoArquivo)) await desarquivarAvisoParaUsuario(aviso.id, escopoArquivo)
    else await arquivarAvisoParaUsuario(aviso.id, escopoArquivo)
  }

  function abrirDetalhe(aviso, focar = false) {
    setDetalheId(aviso.id)
    setFocarResposta(focar)
  }

  function fecharDetalhe() {
    setDetalheId(null)
    setFocarResposta(false)
  }

  async function responder(e, aviso) {
    e.preventDefault()
    e.stopPropagation()
    const texto = String(respostas[aviso.id] || '').trim()
    if (!texto) return
    await responderAviso(aviso.id, texto)
    setRespostas(prev => ({ ...prev, [aviso.id]: '' }))
  }

  return (
    <>
      <div style={{ ...s.toolbar, ...(isMobile ? s.toolbarMobile : {}) }}>
        <div style={{ ...s.abasHistorico, ...(isMobile ? s.abasHistoricoMobile : {}) }}>
          <button type="button" style={{ ...s.abaBtn, ...(isMobile ? s.abaBtnMobile : {}), ...(visualizacao === 'ativos' ? s.abaBtnOn : {}) }} onClick={() => setVisualizacao('ativos')}>
            Avisos <span style={s.abaNumero}>{totalAtivos}</span>
          </button>
          <button type="button" style={{ ...s.abaBtn, ...(isMobile ? s.abaBtnMobile : {}), ...(visualizacao === 'historico' ? s.abaBtnOn : {}) }} onClick={() => setVisualizacao('historico')}>
            Historico <span style={s.abaNumero}>{totalHistorico}</span>
          </button>
        </div>
        {destinos.length > 0 && <button style={{ ...s.btnNovo, ...(isMobile ? s.btnNovoMobile : {}) }} onClick={abrirNovo}>+ Novo aviso</button>}
      </div>

      <div style={{ ...s.filtros, ...(isMobile ? s.filtrosMobile : {}) }}>
        {DESTINOS.filter(destino => destino.valor === 'todos' || destinos.includes(destino.valor) || role === 'admin' || role === 'gerente' || role === 'professor').map(destino => (
          <button key={destino.valor} style={{ ...s.filtroBtn, ...(isMobile ? s.filtroBtnMobile : {}), ...(filtro === destino.valor ? s.filtroBtnOn : {}) }} onClick={() => setFiltro(destino.valor)}>
            {destino.label}
          </button>
        ))}
      </div>

      {lista.length === 0 ? (
        <div style={s.vazio}>{visualizacao === 'historico' ? 'Nenhum aviso arquivado neste filtro.' : 'Nenhum aviso ativo para este filtro.'}</div>
      ) : (
        <div style={s.lista}>
          {lista.map(aviso => {
            const destino = meta(DESTINOS, destinoAviso(aviso))
            const tipo = meta(TIPOS, aviso.tipo || 'info')
            const prioridade = meta(PRIORIDADES, aviso.prioridade || 'media')
            const lido = Array.isArray(aviso.lidoPor) && aviso.lidoPor.includes(leitorId)
            const ehAutor = aviso.autorId === leitorId
            const podeExcluir = role === 'admin' || role === 'gerente' || role === 'professor' || aviso.autorId === leitorId || normalizarPerfil(aviso.autorRole) === role
            const podeGerenciar = destinos.length > 0
            const podeEditar = ehAutor
            const podeArquivar = podeGerenciar || ehAutor
            const respostasAviso = Array.isArray(aviso.respostas) ? aviso.respostas : []
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
                style={{ ...s.card, ...(isMobile ? s.cardMobile : {}), ...(arquivado ? s.cardArquivado : {}), borderLeft: `4px solid ${arquivado ? '#94A3B8' : tipo.color}` }}
              >
                <div style={{ ...s.cardTop, ...(isMobile ? s.cardTopMobile : {}) }}>
                  <div style={{ ...s.badges, ...(isMobile ? s.badgesMobile : {}) }}>
                    <span style={{ ...s.tipoBadge, ...(isMobile ? s.tipoBadgeMobile : {}), background: tipo.bg, color: tipo.color }}>{tipo.label}</span>
                    <span style={{ ...s.tipoBadge, ...(isMobile ? s.tipoBadgeMobile : {}), background: destino.bg, color: destino.color }}>{destino.label}</span>
                    <span style={{ ...s.tipoBadge, ...(isMobile ? s.tipoBadgeMobile : {}), background: prioridade.bg, color: prioridade.color }}>{prioridade.label}</span>
                    {aviso.fixado && <span style={s.fixadoBadge}>Fixado</span>}
                    {arquivado && <span style={s.arquivadoBadge}>Arquivado</span>}
                  </div>
                  <div style={{ ...s.acoes, ...(isMobile ? s.acoesMobile : {}) }} onClick={e => e.stopPropagation()}>
                    {podeGerenciar && !arquivado && (
                      <button style={{ ...s.btnAcao, ...(isMobile ? s.btnAcaoMobile : {}) }} onClick={() => toggleFixado(aviso)}>
                        <Pin size={14} /> {aviso.fixado ? 'Desafixar' : 'Fixar'}
                      </button>
                    )}
                    {!lido && !arquivado && (
                      <button style={{ ...s.btnAcao, ...(isMobile ? s.btnAcaoMobile : {}) }} onClick={() => marcarAvisoLido(aviso.id)}>
                        <CheckCircle2 size={14} /> Lido
                      </button>
                    )}
                    {podeEditar && !arquivado && (
                      <button style={{ ...s.btnAcao, ...(isMobile ? s.btnAcaoMobile : {}) }} onClick={() => abrirEditar(aviso)}>
                        Editar
                      </button>
                    )}
                    {podeArquivar && (
                      <button style={{ ...s.btnAcao, ...(isMobile ? s.btnAcaoMobile : {}) }} onClick={() => toggleArquivado(aviso)}>
                        {arquivado ? <ArchiveRestore size={14} /> : <Archive size={14} />} {arquivado ? 'Desarquivar' : 'Arquivar'}
                      </button>
                    )}
                    {podeExcluir && (
                      <button style={{ ...s.btnAcao, ...(isMobile ? s.btnAcaoMobile : {}), background: '#FEE2E2', color: '#DC2626' }} onClick={() => remover(aviso)}>
                        <Trash2 size={14} /> Excluir
                      </button>
                    )}
                  </div>
                </div>
                <h3 style={{ ...s.cardTitulo, ...(isMobile ? s.cardTituloMobile : {}) }}>{aviso.titulo}</h3>
                <RichTextContent html={aviso.mensagemHtml} text={aviso.mensagem || aviso.texto} style={{ ...s.cardTexto, ...(isMobile ? s.cardTextoMobile : {}) }} />
                <div style={{ ...s.cardFooterResumo, ...(isMobile ? s.cardFooterMobile : {}) }}>
                  <span>{aviso.autorNome || aviso.autor || 'Sistema'}</span>
                  <span>{formatarData(aviso.createdAt || aviso.criadoEm)}</span>
                </div>
                <div style={{ ...s.cardFooterAcoes, ...(isMobile ? s.cardFooterAcoesMobile : {}) }} onClick={e => e.stopPropagation()}>
                  {!arquivado && (
                    <button type="button" style={{ ...s.responderToggle, ...(isMobile ? s.responderToggleMobile : {}) }} onClick={() => abrirDetalhe(aviso, true)}>
                      <Send size={14} /> Responder
                    </button>
                  )}
                  <button type="button" style={{ ...s.verMaisBtn, ...(isMobile ? s.verMaisBtnMobile : {}) }} onClick={() => abrirDetalhe(aviso)}>
                    <MessageSquare size={14} /> {respostasAviso.length > 0 ? `${respostasAviso.length} resposta(s)` : 'Ver detalhes'}
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {detalheAviso && (() => {
        const destinoDet = meta(DESTINOS, destinoAviso(detalheAviso))
        const tipoDet = meta(TIPOS, detalheAviso.tipo || 'info')
        const prioridadeDet = meta(PRIORIDADES, detalheAviso.prioridade || 'media')
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
                  <span style={{ ...s.tipoBadge, background: prioridadeDet.bg, color: prioridadeDet.color }}>{prioridadeDet.label}</span>
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
                    <div style={{ ...s.conversa, ...(isMobile ? s.conversaMobile : {}) }}>
                      {respostasDet.map(resposta => {
                        const minhaResposta = String(resposta.autorId || '') === String(leitorId || '')
                        return (
                          <div key={resposta.id || `${resposta.autorId}-${resposta.criadoEm}`} style={{ ...s.balaoLinha, justifyContent: minhaResposta ? 'flex-end' : 'flex-start' }}>
                            <div style={{ ...s.balao, ...(isMobile ? s.balaoMobile : {}), ...(minhaResposta ? s.balaoMeu : s.balaoOutro) }}>
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
            <RichTextEditor
              value={form.mensagemHtml || plainTextToRichText(form.mensagem)}
              onChange={({ html, text }) => setForm(f => ({ ...f, mensagemHtml: html, mensagem: text }))}
              placeholder="Descreva o aviso..."
            />
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
  toolbar: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: '0.75rem', flexWrap: 'wrap' },
  toolbarMobile: { alignItems: 'center', gap: 8 },
  abasHistorico: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  abasHistoricoMobile: { width: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' },
  abaBtn: { border: '1px solid #D8E3F4', background: '#fff', color: '#475569', borderRadius: 999, padding: '0.42rem 0.75rem', fontWeight: 900, fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 },
  abaBtnMobile: { width: 'auto', justifyContent: 'center', padding: '0.42rem 0.68rem', fontSize: '0.74rem' },
  abaBtnOn: { background: '#003D7C', color: '#fff', borderColor: '#003D7C', boxShadow: '0 6px 14px rgba(0,61,124,0.14)' },
  abaNumero: { minWidth: 20, height: 20, padding: '0 0.35rem', borderRadius: 999, background: 'rgba(148,163,184,0.18)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' },
  btnNovo: { background: '#003D7C', color: '#fff', padding: '0.6rem 1.1rem', borderRadius: 8, fontWeight: 800, border: 'none', cursor: 'pointer', fontFamily: 'inherit' },
  btnNovoMobile: { width: 'auto', padding: '0.48rem 0.85rem', borderRadius: 10, fontSize: '0.76rem' },
  contador: { color: '#64748B', fontSize: '0.85rem' },
  filtros: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: '1rem' },
  filtrosMobile: { gap: 5, marginBottom: '0.75rem', overflowX: 'visible', flexWrap: 'wrap', paddingBottom: 0 },
  filtroBtn: { padding: '0.35rem 0.9rem', borderRadius: 20, border: '2px solid #E2E8F0', background: '#fff', color: '#64748B', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit' },
  filtroBtnMobile: { padding: '0.38rem 0.72rem', fontSize: '0.75rem', whiteSpace: 'nowrap', flexShrink: 0 },
  filtroBtnOn: { background: '#003D7C', color: '#fff', borderColor: '#003D7C' },
  vazio: { textAlign: 'center', padding: '3rem', color: '#94A3B8', background: '#fff', border: '1px dashed #CBD5E1', borderRadius: 8 },
  lista: { display: 'flex', flexDirection: 'column', gap: '0.65rem' },
  card: { background: '#fff', borderRadius: 8, padding: '0.9rem 1rem', border: '1px solid #E2E8F0', cursor: 'pointer', outline: 'none', boxShadow: '0 1px 3px rgba(15,23,42,0.03)' },
  cardMobile: { padding: '0.75rem 0.8rem', borderRadius: 10 },
  cardArquivado: { background: '#F8FAFC', borderColor: '#CBD5E1' },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 7, gap: 8, flexWrap: 'wrap' },
  cardTopMobile: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  badges: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  badgesMobile: { gap: 5 },
  tipoBadge: { padding: '0.2rem 0.65rem', borderRadius: 20, fontWeight: 800, fontSize: '0.75rem', whiteSpace: 'nowrap' },
  tipoBadgeMobile: { padding: '0.18rem 0.48rem', fontSize: '0.68rem' },
  fixadoBadge: { padding: '0.2rem 0.6rem', borderRadius: 20, background: '#F5F3FF', color: '#7C3AED', fontWeight: 800, fontSize: '0.75rem' },
  arquivadoBadge: { padding: '0.2rem 0.6rem', borderRadius: 20, background: '#E2E8F0', color: '#475569', fontWeight: 800, fontSize: '0.75rem' },
  respostasBadge: { padding: '0.2rem 0.6rem', borderRadius: 20, background: '#EAF2FF', color: '#003D7C', fontWeight: 800, fontSize: '0.75rem' },
  acoes: { display: 'flex', gap: 5, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' },
  acoesMobile: { width: 'auto', display: 'flex', gap: 5, justifyContent: 'flex-end', flexWrap: 'wrap' },
  btnAcao: { padding: '0.35rem 0.6rem', borderRadius: 8, background: '#F1F5F9', color: '#334155', fontSize: '0.78rem', border: 'none', cursor: 'pointer', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'inherit' },
  btnAcaoMobile: { width: 'auto', minHeight: 30, justifyContent: 'center', padding: '0.32rem 0.5rem', fontSize: '0.7rem' },
  cardTitulo: { fontWeight: 800, color: '#1A202C', margin: '0 0 4px', fontSize: '0.95rem', lineHeight: 1.25 },
  cardTituloMobile: { fontSize: '0.91rem', marginTop: 2 },
  cardTexto: { color: '#475569', fontSize: '0.85rem', lineHeight: 1.5, margin: '0 0 6px' },
  cardTextoMobile: { fontSize: '0.8rem', lineHeight: 1.42 },
  cardFooterResumo: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', color: '#64748B', fontSize: '0.72rem', fontWeight: 700, marginTop: 6 },
  cardFooterMobile: { gap: 6, fontSize: '0.68rem', lineHeight: 1.25 },
  cardFooterAcoes: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 9 },
  cardFooterAcoesMobile: { gap: 6, marginTop: 8 },
  verMaisBtn: { border: '1px solid #E2E8F0', background: '#F8FAFC', color: '#475569', borderRadius: 10, padding: '0.5rem 0.75rem', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'inherit' },
  verMaisBtnMobile: { minHeight: 36, padding: '0.42rem 0.6rem', fontSize: '0.72rem' },
  produtoPromo: { display: 'flex', alignItems: 'center', gap: 10, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: 10, margin: '8px 0', color: '#92400E', fontSize: '0.82rem' },
  produtoPromoImg: { width: 44, height: 44, borderRadius: 8, objectFit: 'cover', background: '#fff', flexShrink: 0 },
  cardInfo: { fontSize: '0.73rem', color: '#64748B', fontWeight: 700 },
  lidoInfo: { fontSize: '0.72rem', color: '#94A3B8', marginTop: 4 },
  historico: { marginTop: 12, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: 10 },
  historicoTitulo: { display: 'block', color: '#0F172A', fontSize: '0.78rem', marginBottom: 6 },
  semResposta: { color: '#94A3B8', fontSize: '0.78rem', fontWeight: 700 },
  conversa: { display: 'flex', flexDirection: 'column', gap: 8 },
  conversaMobile: { gap: 7 },
  balaoLinha: { display: 'flex', width: '100%' },
  balao: { maxWidth: 'min(82%, 520px)', borderRadius: 14, padding: '0.55rem 0.7rem', boxShadow: '0 1px 2px rgba(15,23,42,0.05)' },
  balaoMobile: { maxWidth: '92%', padding: '0.5rem 0.62rem' },
  balaoMeu: { background: '#DCFCE7', color: '#14532D', borderBottomRightRadius: 4 },
  balaoOutro: { background: '#fff', color: '#334155', border: '1px solid #E2E8F0', borderBottomLeftRadius: 4 },
  respostaMeta: { color: 'inherit', opacity: 0.82, fontSize: '0.72rem', fontWeight: 900, marginBottom: 2 },
  respostaTexto: { color: 'inherit', fontSize: '0.84rem', marginTop: 2, lineHeight: 1.4, whiteSpace: 'pre-wrap' },
  balaoHora: { marginTop: 4, fontSize: '0.67rem', opacity: 0.68, textAlign: 'right', fontWeight: 700 },
  responderToggle: { border: 'none', borderRadius: 10, background: '#003D7C', color: '#fff', padding: '0.5rem 0.8rem', fontWeight: 900, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'inherit', fontSize: '0.78rem' },
  responderToggleMobile: { minHeight: 36, padding: '0.42rem 0.65rem', fontSize: '0.72rem' },
  respostaInput: { flex: 1, minWidth: 0, border: '1px solid #CBD5E1', borderRadius: 10, padding: '0.6rem 0.75rem', fontFamily: 'inherit', outlineColor: '#003D7C' },
  respostaBtn: { border: 'none', borderRadius: 10, background: '#003D7C', color: '#fff', padding: '0.6rem 0.85rem', fontWeight: 900, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'inherit', flexShrink: 0 },
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
