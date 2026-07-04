import { useState, useEffect, useRef } from 'react'
import { AlertTriangle, Archive, ArchiveRestore, CheckCircle2, ChefHat, ChevronLeft, FileText, Flag, GraduationCap, Image as ImageIcon, Megaphone, MessageSquare, MoreVertical, Paperclip, Pin, Send, Shield, ShoppingBag, Sparkles, Tag, Trash2, Users, X } from 'lucide-react'
import Layout from '../../components/Layout'
import RichTextEditor, { RichTextContent } from '../../components/RichTextEditor'
import AnexoAviso from '../../components/AnexoAviso'
import { useApp } from '../../contexts/AppContext'
import { avisoArquivadoParaUsuario, avisoCriadoPorUsuario, avisoDestinadoAoUsuario, avisoFixadoParaUsuario, avisoHistoricoLimpoParaUsuario, destinoAvisoNormalizado, destinosAvisoNormalizados, usuarioAvisoId, usuarioAvisoIds } from '../../utils/avisos'
import { plainTextToRichText, richTextToPlainText } from '../../utils/richText'
import { useIsMobile } from '../../utils/useIsMobile'
import { ehGestao, normalizarPerfil, perfisDoUsuario } from '../../utils/perfis'
import { ACCEPT_ARQUIVO, ACCEPT_IMAGEM, anexoValido, ehImagem, formatarTamanho, uploadAnexoAviso } from '../../utils/anexosAviso'

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

const PRIORIDADES = [
  { valor: 'baixa', label: 'Baixa', bg: '#DCFCE7', color: '#166534' },
  { valor: 'media', label: 'Media', bg: '#FEF3C7', color: '#92400E' },
  { valor: 'alta', label: 'Alta', bg: '#FEE2E2', color: '#B91C1C' },
]

const TIPO_ICONE = { info: Megaphone, promo: Tag, aviso: AlertTriangle, novidade: Sparkles }
const DESTINO_ICONE = { todos: Users, aluno: GraduationCap, vendedor: ShoppingBag, cozinha: ChefHat, admin: Shield, especifico: Users }
const PRIORIDADE_ICONE = { baixa: Flag, media: Flag, alta: AlertTriangle }

const vazio = { titulo: '', mensagem: '', mensagemHtml: '', tipo: 'info', fixado: false, destino: '', destinos: [], produtoId: '', recipients: [] }

function destinoAviso(aviso) {
  return destinoAvisoNormalizado(aviso)
}

function destinoMeta(destino) {
  if (destino === 'especifico') return { valor: 'especifico', label: 'Pessoas', bg: '#E0F2FE', color: '#075985' }
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

function fotoAutor(usuarios, autorId) {
  if (!autorId) return ''
  const usuario = (usuarios || []).find(u => String(u.uid) === String(autorId) || String(u.matricula) === String(autorId))
  return usuario?.fotoPerfil || ''
}

function Avatar({ foto, nome, size = 24 }) {
  const estilo = { width: size, height: size, borderRadius: '50%', flexShrink: 0, border: '1px solid #E2E8F0' }
  if (foto) return <img src={foto} alt={nome || 'Usuario'} style={{ ...estilo, objectFit: 'cover' }} />
  return (
    <div style={{ ...estilo, background: '#EAF2FF', color: '#003D7C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: size * 0.42 }}>
      {(nome || '?').trim().charAt(0).toUpperCase()}
    </div>
  )
}

export default function Avisos() {
  const { avisos, produtos, usuarios, criarAviso, editarAviso, excluirAviso, fixarAviso, marcarAvisoLido, responderAviso, arquivarAvisoParaUsuario, desarquivarAvisoParaUsuario, limparHistoricoAvisos, usuarioLogado } = useApp()
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
  const [buscaUsuario, setBuscaUsuario] = useState('')
  const [menuAbertoId, setMenuAbertoId] = useState(null)
  const [pessoasAviso, setPessoasAviso] = useState(null)
  const [anexoMenuAberto, setAnexoMenuAberto] = useState(false)
  const [anexoPendente, setAnexoPendente] = useState(null)
  const [enviandoResposta, setEnviandoResposta] = useState(false)
  const inputImagemRef = useRef(null)
  const inputArquivoRef = useRef(null)

  function selecionarAnexo(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    setAnexoMenuAberto(false)
    if (!file) return
    const validacao = anexoValido(file)
    if (!validacao.ok) { setErro(validacao.erro); return }
    setErro('')
    const previewUrl = ehImagem(file.type) ? URL.createObjectURL(file) : null
    setAnexoPendente(prev => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl)
      return { file, previewUrl, nome: file.name, tamanho: file.size, tipo: file.type }
    })
  }

  function removerAnexoPendente() {
    setAnexoPendente(prev => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl)
      return null
    })
  }

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
      destinos: destinosAvisoNormalizados(aviso),
      produtoId: aviso.produtoPromocao?.id || '',
      recipients: Array.isArray(aviso.recipients) ? aviso.recipients.map(String) : [],
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
    const destinosSelecionados = Array.isArray(form.destinos) ? form.destinos.filter(destino => destino && destino !== 'especifico') : []
    const recipientsSelecionados = Array.isArray(form.recipients) ? form.recipients.filter(Boolean) : []
    if (destinosSelecionados.length === 0 && recipientsSelecionados.length === 0) {
      setErro('Selecione pelo menos um destino ou uma pessoa especifica.')
      return
    }
    setSalvando(true)
    const mensagemTexto = richTextToPlainText(form.mensagemHtml || plainTextToRichText(form.mensagem))
    const dados = {
      ...form,
      mensagem: mensagemTexto,
      texto: mensagemTexto,
      mensagemHtml: form.mensagemHtml,
      destino: destinosSelecionados[0] || '',
      destinatario: destinosSelecionados[0] || '',
      destinos: destinosSelecionados,
      recipients: recipientsSelecionados,
      recipientsDetalhes: (usuarios || []).filter(usuario => usuarioAvisoIds(usuario).some(id => recipientsSelecionados.includes(id))).map(usuario => ({
        id: usuario.uid || usuario.matricula || usuario.email || '',
        uid: usuario.uid || '',
        matricula: usuario.matricula || '',
        nome: usuario.nome || '',
        perfil: usuario.perfil || usuario.role || '',
        email: usuario.email || '',
      })),
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
    if (!confirm('Apagar este aviso para todos?')) return
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
      await fixarAviso(aviso.id, !avisoFixadoParaUsuario(aviso, leitorId, escopoArquivo), escopoArquivo)
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

  async function limparHistorico() {
    if (!confirm('Limpar seu historico de avisos? Isso nao apaga avisos para outras pessoas.')) return
    await limparHistoricoAvisos(escopoArquivo)
  }

  async function responder(e, aviso) {
    e.preventDefault()
    e.stopPropagation()
    if (enviandoResposta) return
    const texto = String(respostas[aviso.id] || '').trim()
    if (!texto && !anexoPendente) return
    setEnviandoResposta(true)
    setErro('')
    try {
      let anexo = null
      if (anexoPendente) anexo = await uploadAnexoAviso(anexoPendente.file, usuarioLogado)
      await responderAviso(aviso.id, texto, anexo)
      setRespostas(prev => ({ ...prev, [aviso.id]: '' }))
      removerAnexoPendente()
    } catch (err) {
      console.error(err)
      setErro(err?.message || 'Não foi possível enviar a resposta.')
    } finally {
      setEnviandoResposta(false)
    }
  }

  function abrirDetalhe(aviso, focar = false) {
    setDetalheId(aviso.id)
    setFocarResposta(focar)
  }

  function fecharDetalhe() {
    setDetalheId(null)
    setFocarResposta(false)
    setAnexoMenuAberto(false)
    removerAnexoPendente()
  }

  function toggleRecipient(usuario) {
    const ids = usuarioAvisoIds(usuario)
    const principal = ids[0]
    if (!principal) return
    setForm(f => {
      const selecionado = ids.some(id => f.recipients.includes(id))
      const vaiSelecionar = !selecionado
      return {
        ...f,
        destino: vaiSelecionar && (f.destinos || []).includes('todos') ? '' : f.destino,
        destinos: vaiSelecionar && (f.destinos || []).includes('todos') ? [] : f.destinos,
        recipients: selecionado
          ? f.recipients.filter(id => !ids.includes(id))
          : [...new Set([...f.recipients, principal])],
      }
    })
  }

  function toggleDestino(valor) {
    setForm(f => {
      if (valor === 'todos') return { ...f, destino: 'todos', destinos: ['todos'] }
      const atuais = (f.destinos?.length ? f.destinos : [f.destino || '']).filter(item => item && item !== 'todos')
      const proximos = atuais.includes(valor) ? atuais.filter(item => item !== valor) : [...atuais, valor]
      return { ...f, destino: proximos[0] || '', destinos: proximos }
    })
  }

  const avisoAtivo = aviso => aviso && !aviso.deletedAt && aviso.status !== 'excluido'
  const filtrados = filtro === 'todos'
    ? avisos.filter(avisoAtivo)
    : avisos.filter(aviso => avisoAtivo(aviso) && destinosAvisoNormalizados(aviso).includes(filtro))
  const leitorId = usuarioAvisoId(usuarioLogado)
  const totalAtivos = filtrados.filter(aviso => !avisoArquivadoParaUsuario(aviso, leitorId, escopoArquivo)).length
  const totalHistorico = filtrados.filter(aviso => avisoArquivadoParaUsuario(aviso, leitorId, escopoArquivo) && !avisoHistoricoLimpoParaUsuario(aviso, leitorId, escopoArquivo)).length
  const visiveis = filtrados.filter(aviso => {
    const arquivado = avisoArquivadoParaUsuario(aviso, leitorId, escopoArquivo)
    if (visualizacao === 'historico') return arquivado && !avisoHistoricoLimpoParaUsuario(aviso, leitorId, escopoArquivo)
    return !arquivado
  }).sort((a, b) => {
    const aFixado = avisoFixadoParaUsuario(a, leitorId, escopoArquivo)
    const bFixado = avisoFixadoParaUsuario(b, leitorId, escopoArquivo)
    if (aFixado && !bFixado) return -1
    if (!aFixado && bFixado) return 1
    return (b.createdAt || b.criadoEm || 0) - (a.createdAt || a.criadoEm || 0)
  })
  const detalheAviso = avisos.find(aviso => aviso.id === detalheId) || null

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('aviso-detalhe-toggle', { detail: Boolean(detalheId) }))
  }, [detalheId])
  useEffect(() => () => window.dispatchEvent(new CustomEvent('aviso-detalhe-toggle', { detail: false })), [])

  useEffect(() => {
    const tela = modal ? 'form' : detalheId ? 'detalhe' : 'lista'
    const contexto = {
      tela,
      rascunho: tela === 'form' ? { titulo: form.titulo, mensagem: form.mensagem, tipo: form.tipo, destino: form.destino } : null,
      aviso: tela === 'detalhe' && detalheAviso ? { titulo: detalheAviso.titulo, mensagem: detalheAviso.mensagem || detalheAviso.texto, tipo: detalheAviso.tipo, destino: destinoAviso(detalheAviso) } : null,
    }
    window.dispatchEvent(new CustomEvent('avisos-contexto-change', { detail: contexto }))
  }, [modal, detalheId, form.titulo, form.mensagem, form.tipo, form.destino, detalheAviso])
  useEffect(() => () => window.dispatchEvent(new CustomEvent('avisos-contexto-change', { detail: null })), [])

  useEffect(() => {
    function preencherAviso(e) {
      const patch = e.detail
      if (!patch) return
      if (!modal) setModal('novo')
      setForm(f => ({
        ...f,
        ...(patch.titulo !== undefined ? { titulo: patch.titulo } : {}),
        ...(patch.mensagem !== undefined ? { mensagem: patch.mensagem, mensagemHtml: plainTextToRichText(patch.mensagem) } : {}),
        ...(patch.tipo !== undefined ? { tipo: patch.tipo } : {}),
        ...(patch.destino !== undefined ? { destino: patch.destino, destinos: [patch.destino] } : {}),
      }))
    }
    function preencherResposta(e) {
      const texto = e.detail?.texto
      if (!texto || !detalheId) return
      setRespostas(prev => ({ ...prev, [detalheId]: texto }))
    }
    window.addEventListener('ia-preencher-aviso', preencherAviso)
    window.addEventListener('ia-preencher-resposta', preencherResposta)
    return () => {
      window.removeEventListener('ia-preencher-aviso', preencherAviso)
      window.removeEventListener('ia-preencher-resposta', preencherResposta)
    }
  }, [modal, detalheId])
  const usuariosSelecionaveis = (usuarios || []).filter(usuario => {
    const perfisUsuario = perfisDoUsuario(usuario)
    if (!perfisUsuario.some(perfil => perfil !== 'aluno')) return false
    const termo = buscaUsuario.trim().toLowerCase()
    if (!termo) return true
    return [usuario.nome, usuario.matricula, usuario.email, usuario.perfil, usuario.role, ...(usuario.roles || []), ...(usuario.perfis || [])].filter(Boolean).join(' ').toLowerCase().includes(termo)
  })
  const usuariosSelecionados = (usuarios || []).filter(usuario => usuarioAvisoIds(usuario).some(id => form.recipients.includes(id)))
  const menuAviso = menuAbertoId ? visiveis.find(aviso => aviso.id === menuAbertoId) : null

  return (
    <Layout titulo="Central de Avisos">
      <div style={{ ...s.intro, ...(isMobile ? s.introMobile : {}) }}>
        <p style={s.introTexto}>Fique por dentro de tudo que acontece</p>
      </div>

      <div style={{ ...s.toolbar, ...(isMobile ? s.toolbarMobile : {}) }}>
        <div style={s.abasHistorico}>
          <button type="button" style={{ ...s.abaBtn, ...(isMobile ? s.abaBtnMobile : {}), ...(visualizacao === 'ativos' ? s.abaBtnOn : {}) }} onClick={() => setVisualizacao('ativos')}>
            Avisos <span style={s.abaNumero}>{totalAtivos}</span>
          </button>
          <button type="button" style={{ ...s.abaBtn, ...(isMobile ? s.abaBtnMobile : {}), ...(visualizacao === 'historico' ? s.abaBtnOn : {}) }} onClick={() => setVisualizacao('historico')}>
            Historico <span style={s.abaNumero}>{totalHistorico}</span>
          </button>
        </div>
        <button style={{ ...s.btnNovo, ...(isMobile ? s.btnNovoMobile : {}) }} onClick={abrirNovo}>+ Novo aviso</button>
        {visualizacao === 'historico' && totalHistorico > 0 && (
          <button type="button" style={{ ...s.btnLimparHistorico, ...(isMobile ? s.btnLimparHistoricoMobile : {}) }} onClick={limparHistorico}>
            <Trash2 size={14} /> Limpar historico
          </button>
        )}
      </div>
      {visualizacao === 'historico' && <div style={s.historicoAjuda}>Limpa apenas o historico do seu dispositivo.</div>}
      {erro && <div style={s.erro}>{erro}</div>}

      <div style={{ ...s.filtros, ...(isMobile ? s.filtrosMobile : {}) }}>
        {DESTINOS.map(destino => (
          <button key={destino.valor}
            style={{ ...s.filtroBtn, ...(isMobile ? s.filtroBtnMobile : {}), ...(filtro === destino.valor ? s.filtroBtnOn : {}) }}
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
            const destinosDoAviso = destinosAvisoNormalizados(aviso).map(destino => destinoMeta(destino))
            const respostasAviso = Array.isArray(aviso.respostas) ? aviso.respostas : []
            const ehAutor = avisoCriadoPorUsuario(aviso, usuarioLogado)
            const podeExcluir = ehAutor
            const lido = Array.isArray(aviso.lidoPor) && aviso.lidoPor.includes(leitorId)
            const arquivado = avisoArquivadoParaUsuario(aviso, leitorId, escopoArquivo)
            const fixado = avisoFixadoParaUsuario(aviso, leitorId, escopoArquivo)
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
                    {destinosDoAviso.map(destino => (
                      destino.valor === 'especifico' ? (
                        <button key={destino.valor} type="button" style={{ ...s.tipoBadge, ...(isMobile ? s.tipoBadgeMobile : {}), background: destino.bg, color: destino.color, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }} onClick={e => { e.stopPropagation(); setPessoasAviso(aviso) }}>{destino.label}</button>
                      ) : (
                        <span key={destino.valor} style={{ ...s.tipoBadge, ...(isMobile ? s.tipoBadgeMobile : {}), background: destino.bg, color: destino.color }}>{destino.label}</span>
                      )
                    ))}
                    {fixado && <span style={s.fixadoBadge}>Fixado</span>}
                    {arquivado && <span style={s.arquivadoBadge}>Arquivado</span>}
                  </div>
                  <div style={s.acoes} onClick={e => e.stopPropagation()}>
                    <button type="button" style={s.menuBtn} onClick={() => setMenuAbertoId(menuAbertoId === aviso.id ? null : aviso.id)} aria-label="Acoes do aviso">
                      <MoreVertical size={18} />
                    </button>
                    {menuAbertoId === aviso.id && !isMobile && (
                      <div style={s.menuAcoes}>
                        {ehAutor && !arquivado && <button type="button" style={s.menuItem} onClick={() => { setMenuAbertoId(null); abrirEditar(aviso) }}>Editar aviso</button>}
                        {!arquivado && <button type="button" style={s.menuItem} onClick={() => { setMenuAbertoId(null); toggleFixado(aviso) }}><Pin size={14} /> {fixado ? 'Desafixar da minha tela' : 'Fixar na minha tela'}</button>}
                        <button type="button" style={s.menuItem} onClick={() => { setMenuAbertoId(null); toggleArquivado(aviso) }}>{arquivado ? <ArchiveRestore size={14} /> : <Archive size={14} />} {arquivado ? 'Desarquivar' : 'Apagar para mim'}</button>
                        {podeExcluir && <button type="button" style={{ ...s.menuItem, ...s.menuItemDanger }} onClick={() => { setMenuAbertoId(null); handleExcluir(aviso.id) }}><Trash2 size={14} /> Apagar para todos</button>}
                        {!arquivado && (lido
                          ? <span style={s.menuItemLido}><CheckCircle2 size={14} /> Lido</span>
                          : <button type="button" style={s.menuItem} onClick={() => { setMenuAbertoId(null); marcarAvisoLido(aviso.id) }}><CheckCircle2 size={14} /> Marcar como lido</button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <h3 style={{ ...s.cardTitulo, ...(isMobile ? s.cardTituloMobile : {}) }}>{aviso.titulo}</h3>
                <div style={s.resumoLinha}>
                  <span style={s.resumoDot} />
                  <RichTextContent html={aviso.mensagemHtml} text={aviso.mensagem || aviso.texto} style={{ ...s.cardTexto, ...(isMobile ? s.cardTextoMobile : {}) }} />
                </div>
                <div style={{ ...s.cardFooterResumo, ...(isMobile ? s.cardFooterMobile : {}) }}>
                  <span>{aviso.autorNome || aviso.autor || 'Sistema'}</span>
                  <span>{formatarData(aviso.createdAt || aviso.criadoEm)}</span>
                  <span style={s.respostasResumo}><MessageSquare size={14} /> {respostasAviso.length}</span>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {isMobile && menuAviso && (() => {
        const ehAutor = avisoCriadoPorUsuario(menuAviso, usuarioLogado)
        const podeExcluir = ehAutor
        const lido = Array.isArray(menuAviso.lidoPor) && menuAviso.lidoPor.includes(leitorId)
        const arquivado = avisoArquivadoParaUsuario(menuAviso, leitorId, escopoArquivo)
        const fixado = avisoFixadoParaUsuario(menuAviso, leitorId, escopoArquivo)
        return (
          <div style={s.menuOverlayMobile} onClick={() => setMenuAbertoId(null)}>
            <div style={s.menuSheetMobile} onClick={e => e.stopPropagation()}>
              {ehAutor && !arquivado && <button type="button" style={s.menuItemSheet} onClick={() => { setMenuAbertoId(null); abrirEditar(menuAviso) }}>Editar aviso</button>}
              {!arquivado && <button type="button" style={s.menuItemSheet} onClick={() => { setMenuAbertoId(null); toggleFixado(menuAviso) }}><Pin size={17} /> {fixado ? 'Desafixar da minha tela' : 'Fixar na minha tela'}</button>}
              <button type="button" style={{ ...s.menuItemSheet, ...s.menuItemDanger }} onClick={() => { setMenuAbertoId(null); toggleArquivado(menuAviso) }}>{arquivado ? <ArchiveRestore size={17} /> : <Archive size={17} />} {arquivado ? 'Desarquivar' : 'Apagar para mim'}</button>
              {podeExcluir && <button type="button" style={{ ...s.menuItemSheet, ...s.menuItemDanger }} onClick={() => { setMenuAbertoId(null); handleExcluir(menuAviso.id) }}><Trash2 size={17} /> Apagar para todos</button>}
              {!arquivado && (lido
                ? <span style={s.menuItemSheetLido}><CheckCircle2 size={17} /> Lido</span>
                : <button type="button" style={s.menuItemSheet} onClick={() => { setMenuAbertoId(null); marcarAvisoLido(menuAviso.id) }}><CheckCircle2 size={17} /> Marcar como lido</button>
              )}
              <button type="button" style={s.menuCancelarMobile} onClick={() => setMenuAbertoId(null)}>Cancelar</button>
            </div>
          </div>
        )
      })()}

      {detalheAviso && (() => {
        const tipoDet = tipoMeta(detalheAviso.tipo)
        const destinosDet = destinosAvisoNormalizados(detalheAviso).map(destino => destinoMeta(destino))
        const respostasDet = Array.isArray(detalheAviso.respostas) ? detalheAviso.respostas : []
        const produtoPromoDet = detalheAviso.produtoPromocao || detalheAviso.produtoPromo
        const arquivadoDet = avisoArquivadoParaUsuario(detalheAviso, leitorId, escopoArquivo)
        const fixadoDet = avisoFixadoParaUsuario(detalheAviso, leitorId, escopoArquivo)
        const perfilAtivoDet = normalizarPerfil(usuarioLogado?.role || usuarioLogado?.perfil)
        const podeFixarDet = ehGestao(perfilAtivoDet) || avisoDestinadoAoUsuario(detalheAviso, usuarioLogado, perfilAtivoDet)
        const prioridadeDet = PRIORIDADES.find(p => p.valor === detalheAviso.prioridade)
        const TipoIcone = TIPO_ICONE[tipoDet.valor] || Megaphone
        const PrioridadeIcone = prioridadeDet ? (PRIORIDADE_ICONE[prioridadeDet.valor] || Flag) : null
        const chipDet = isMobile ? s.tipoBadgeDetalhe : {}
        const badgesEl = (
          <div style={{ ...s.badges, ...(isMobile ? s.badgesDetalheMobile : {}) }}>
            <span style={{ ...s.tipoBadge, ...chipDet, background: tipoDet.bg, color: tipoDet.color }}>
              {isMobile && <TipoIcone size={14} />}{tipoDet.label}
            </span>
            {destinosDet.map(destino => {
              const DestinoIcone = DESTINO_ICONE[destino.valor] || Users
              if (destino.valor === 'especifico') {
                return (
                  <button key={destino.valor} type="button" style={{ ...s.tipoBadge, ...chipDet, background: destino.bg, color: destino.color, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => setPessoasAviso(detalheAviso)}>
                    {isMobile && <DestinoIcone size={14} />}{destino.label}
                  </button>
                )
              }
              return (
                <span key={destino.valor} style={{ ...s.tipoBadge, ...chipDet, background: destino.bg, color: destino.color }}>
                  {isMobile && <DestinoIcone size={14} />}{destino.label}
                </span>
              )
            })}
            {prioridadeDet && (
              <span style={{ ...s.tipoBadge, ...chipDet, background: prioridadeDet.bg, color: prioridadeDet.color }}>
                {isMobile && PrioridadeIcone && <PrioridadeIcone size={14} />}{prioridadeDet.label}
              </span>
            )}
            {fixadoDet && <span style={{ ...s.fixadoBadge, ...chipDet }}>{isMobile && <Pin size={14} />}Fixado</span>}
            {arquivadoDet && <span style={{ ...s.arquivadoBadge, ...chipDet }}>{isMobile && <Archive size={14} />}Arquivado</span>}
          </div>
        )
        return (
          <div style={{ ...s.overlayDetalhe, ...(isMobile ? s.overlayDetalheMobile : {}) }} onClick={fecharDetalhe}>
            <div style={{ ...s.modalDetalhe, ...(isMobile ? s.modalDetalheMobile : {}) }} onClick={e => e.stopPropagation()}>
              <div style={{ ...s.modalDetalheHeader, ...(isMobile ? s.modalDetalheHeaderMobile : {}) }}>
                {isMobile ? (
                  <>
                    <div style={s.detalheHeaderLinha1}>
                      <button type="button" style={s.voltarSetaBtn} onClick={fecharDetalhe} aria-label="Voltar">
                        <ChevronLeft size={24} />
                      </button>
                      <strong style={s.detalheHeaderTitulo}>Detalhes do aviso</strong>
                      {!arquivadoDet && podeFixarDet ? (
                        <button
                          type="button"
                          style={{ ...s.pinHeaderBtn, ...(fixadoDet ? s.pinHeaderBtnAtivo : {}) }}
                          onClick={() => toggleFixado(detalheAviso)}
                          aria-label={fixadoDet ? 'Desafixar aviso' : 'Fixar aviso'}
                        >
                          <Pin size={19} fill={fixadoDet ? 'currentColor' : 'none'} />
                        </button>
                      ) : (
                        <span style={{ width: 44, height: 44, flexShrink: 0 }} aria-hidden="true" />
                      )}
                    </div>
                    {badgesEl}
                  </>
                ) : (
                  <>
                    {badgesEl}
                    <button type="button" style={s.fecharDetalheBtn} onClick={fecharDetalhe} aria-label="Fechar">
                      <X size={20} />
                    </button>
                  </>
                )}
              </div>
              <div style={{ ...s.modalDetalheBody, ...(isMobile ? s.modalDetalheBodyMobile : {}) }}>
                <h2 style={{ ...s.modalDetalheTitulo, ...(isMobile ? s.modalDetalheTituloMobile : {}) }}>{detalheAviso.titulo}</h2>
                <RichTextContent html={detalheAviso.mensagemHtml} text={detalheAviso.mensagem || detalheAviso.texto} style={{ ...s.modalDetalheTexto, ...(isMobile ? s.modalDetalheTextoMobile : {}) }} />
                {produtoPromoDet && (
                  <div style={s.produtoPromo}>
                    {produtoPromoDet.foto && <img src={produtoPromoDet.foto} alt={produtoPromoDet.nome} style={s.produtoPromoImg} />}
                    <div>
                      <strong>{produtoPromoDet.nome}</strong>
                      <span>{produtoPromoDet.categoria || 'Produto'} - R$ {Number(produtoPromoDet.preco || 0).toFixed(2).replace('.', ',')}</span>
                    </div>
                  </div>
                )}
                <div style={s.cardInfoAutor}>
                  <Avatar foto={fotoAutor(usuarios, detalheAviso.autorId || detalheAviso.createdBy)} nome={detalheAviso.autorNome || detalheAviso.autor} size={26} />
                  <span>Criado por {detalheAviso.autorNome || detalheAviso.autor || 'Sistema'} - {formatarData(detalheAviso.createdAt || detalheAviso.criadoEm)}</span>
                </div>
                {detalheAviso.updatedAt && <div style={s.cardInfo}>Atualizado por {detalheAviso.updatedByNome || 'Usuario'} - {formatarData(detalheAviso.updatedAt)}</div>}
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
                            {!minhaResposta && <Avatar foto={fotoAutor(usuarios, resposta.autorId)} nome={resposta.autorNome} />}
                            <div style={{ ...s.balao, ...(minhaResposta ? s.balaoMeu : s.balaoOutro) }}>
                              <div style={s.respostaMeta}>{resposta.autorNome || 'Usuario'}</div>
                              {resposta.texto && <div style={s.respostaTexto}>{resposta.texto}</div>}
                              <AnexoAviso anexo={resposta.anexo} />
                              <div style={s.balaoHora}>{formatarData(resposta.criadoEm)}</div>
                            </div>
                            {minhaResposta && <Avatar foto={fotoAutor(usuarios, resposta.autorId)} nome={resposta.autorNome} />}
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
                <div style={s.respostaArea}>
                  {anexoPendente && (
                    <div style={s.anexoPreview}>
                      {anexoPendente.previewUrl
                        ? <img src={anexoPendente.previewUrl} alt={anexoPendente.nome} style={s.anexoPreviewImg} />
                        : <span style={s.anexoPreviewIcone}><FileText size={22} /></span>}
                      <div style={s.anexoPreviewInfo}>
                        <strong style={s.anexoPreviewNome}>{anexoPendente.nome}</strong>
                        <span style={s.anexoPreviewTamanho}>{formatarTamanho(anexoPendente.tamanho)}</span>
                      </div>
                      <button type="button" style={s.anexoPreviewRemover} onClick={removerAnexoPendente} aria-label="Remover anexo"><X size={15} /></button>
                    </div>
                  )}
                  {erro && <p style={s.respostaErro}>{erro}</p>}
                  <form onSubmit={e => responder(e, detalheAviso)} style={{ ...s.respostaLinha, ...(isMobile ? s.respostaLinhaMobile : {}) }}>
                    <button type="button" style={s.clipeBtn} onClick={() => setAnexoMenuAberto(true)} disabled={enviandoResposta} aria-label="Anexar foto ou arquivo">
                      <Paperclip size={20} />
                    </button>
                    <input
                      autoFocus={focarResposta}
                      value={respostas[detalheAviso.id] || ''}
                      onChange={e => setRespostas(prev => ({ ...prev, [detalheAviso.id]: e.target.value }))}
                      placeholder="Responder aviso..."
                      style={s.respostaInput}
                      disabled={enviandoResposta}
                    />
                    <button type="submit" style={{ ...s.respostaBtn, ...(isMobile ? s.respostaBtnMobile : {}), opacity: enviandoResposta ? 0.75 : 1 }} disabled={enviandoResposta} aria-label="Enviar resposta">
                      {enviandoResposta ? <span style={s.spinnerBtn} /> : (isMobile ? <Send size={18} /> : <><Send size={14} /> Enviar</>)}
                    </button>
                  </form>
                </div>
              )}
              {anexoMenuAberto && (
                <div style={s.menuOverlayMobile} onClick={() => setAnexoMenuAberto(false)}>
                  <div style={s.menuSheetMobile} onClick={e => e.stopPropagation()}>
                    <button type="button" style={s.menuItemSheet} onClick={() => inputImagemRef.current?.click()}><ImageIcon size={17} /> Foto/Imagem</button>
                    <button type="button" style={s.menuItemSheet} onClick={() => inputArquivoRef.current?.click()}><FileText size={17} /> Arquivo</button>
                    <button type="button" style={s.menuCancelarMobile} onClick={() => setAnexoMenuAberto(false)}>Cancelar</button>
                  </div>
                </div>
              )}
              <input ref={inputImagemRef} type="file" accept={ACCEPT_IMAGEM} onChange={selecionarAnexo} style={{ display: 'none' }} />
              <input ref={inputArquivoRef} type="file" accept={ACCEPT_ARQUIVO} onChange={selecionarAnexo} style={{ display: 'none' }} />
            </div>
          </div>
        )
      })()}

      {pessoasAviso && (
        <div style={s.pessoasOverlay} onClick={() => setPessoasAviso(null)}>
          <div style={s.pessoasCard} onClick={e => e.stopPropagation()}>
            <div style={s.pessoasHeader}>
              <strong>Destinatários específicos</strong>
              <button type="button" style={s.pessoasFechar} onClick={() => setPessoasAviso(null)} aria-label="Fechar"><X size={16} /></button>
            </div>
            <div style={s.pessoasLista}>
              {(pessoasAviso.recipientsDetalhes || []).length === 0 && <p style={s.pessoasVazio}>Nenhum nome salvo para este aviso.</p>}
              {(pessoasAviso.recipientsDetalhes || []).map(pessoa => (
                <div key={pessoa.id || pessoa.matricula || pessoa.email} style={s.pessoaItem}>
                  <span style={s.pessoaNome}>{pessoa.nome || pessoa.matricula || pessoa.email || 'Sem nome'}</span>
                  {pessoa.perfil && <span style={s.pessoaPerfil}>{pessoa.perfil}</span>}
                </div>
              ))}
            </div>
          </div>
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
                      style={{ ...s.tipoBtnBase, ...((form.destinos || []).includes(destino.valor) ? { border: `2px solid ${destino.color}`, background: destino.bg, color: destino.color } : {}) }}
                      onClick={() => toggleDestino(destino.valor)}>
                      {destino.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={s.label}>Pessoas especificas</label>
                <input
                  style={s.input}
                  value={buscaUsuario}
                  onChange={e => setBuscaUsuario(e.target.value)}
                  placeholder="Buscar por nome, matricula ou perfil"
                />
                {usuariosSelecionados.length > 0 && (
                  <div style={s.selecionados}>
                    {usuariosSelecionados.map(usuario => (
                      <button type="button" key={usuario.uid || usuario.matricula || usuario.email} style={s.selecionadoChip} onClick={() => toggleRecipient(usuario)}>
                        {usuario.nome || usuario.email || usuario.matricula} <X size={12} />
                      </button>
                    ))}
                  </div>
                )}
                <div style={s.listaUsuarios}>
                  {usuariosSelecionaveis.map(usuario => {
                    const ids = usuarioAvisoIds(usuario)
                    const marcado = ids.some(id => form.recipients.includes(id))
                    return (
                      <button type="button" key={usuario.uid || usuario.matricula || usuario.email} style={{ ...s.usuarioOpcao, ...(marcado ? s.usuarioOpcaoOn : {}) }} onClick={() => toggleRecipient(usuario)}>
                        <strong>{usuario.nome || 'Usuario'}</strong>
                        <span>{usuario.matricula || usuario.email || 'Sem matricula'} · {perfisDoUsuario(usuario).filter(perfil => perfil !== 'aluno').join(', ') || usuario.perfil || usuario.role || 'perfil'}</span>
                      </button>
                    )
                  })}
                </div>
                <div style={s.ajudaCampo}>Se selecionar pessoas, o aviso aparece somente para elas e para quem criou.</div>
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
              {modal !== 'novo' && avisoCriadoPorUsuario(modal, usuarioLogado) && <button style={{ ...s.btnSalvar, background: '#EF4444' }} onClick={() => handleExcluir(modal.id)}>Apagar para todos</button>}
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

const s = {
  intro: { marginBottom: '0.85rem' },
  introMobile: { marginBottom: '0.7rem' },
  introTitulo: { margin: 0, color: '#0F172A', fontSize: '1.05rem', fontWeight: 900, lineHeight: 1.2 },
  introTexto: { margin: '0.18rem 0 0', color: '#64748B', fontSize: '0.78rem' },
  toolbar: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: '0.75rem' },
  toolbarMobile: { alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  abasHistorico: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  abaBtn: { border: '1px solid #D8E3F4', background: '#fff', color: '#475569', borderRadius: 999, padding: '0.42rem 0.75rem', fontWeight: 900, fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 },
  abaBtnMobile: { padding: '0.42rem 0.68rem', fontSize: '0.74rem' },
  abaBtnOn: { background: '#003D7C', color: '#fff', borderColor: '#003D7C', boxShadow: '0 6px 14px rgba(0,61,124,0.14)' },
  abaNumero: { minWidth: 20, height: 20, padding: '0 0.35rem', borderRadius: 999, background: 'rgba(148,163,184,0.18)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' },
  btnNovo: { background: '#003D7C', color: '#fff', padding: '0.6rem 1.4rem', borderRadius: 8, fontWeight: 800, border: 'none', cursor: 'pointer' },
  btnNovoMobile: { width: '100%', padding: '0.55rem 0.85rem', borderRadius: 9, fontSize: '0.76rem' },
  btnLimparHistorico: { border: '1px solid #FECACA', background: '#fff', color: '#DC2626', borderRadius: 8, padding: '0.55rem 0.9rem', fontWeight: 900, fontSize: '0.78rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'inherit' },
  btnLimparHistoricoMobile: { width: '100%', justifyContent: 'center', padding: '0.48rem 0.75rem', fontSize: '0.72rem' },
  historicoAjuda: { color: '#94A3B8', fontSize: '0.7rem', fontWeight: 700, margin: '-0.25rem 0 0.75rem 0.2rem' },
  erro: { marginBottom: '0.75rem', background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', borderRadius: 10, padding: '0.6rem 0.85rem', fontWeight: 800, fontSize: '0.86rem' },
  filtros: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: '1rem' },
  filtrosMobile: { gap: 5, marginBottom: '0.75rem' },
  filtroBtn: { padding: '0.35rem 0.9rem', borderRadius: 20, border: '2px solid #E2E8F0', background: '#fff', color: '#64748B', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' },
  filtroBtnMobile: { padding: '0.38rem 0.72rem', fontSize: '0.75rem', whiteSpace: 'nowrap' },
  filtroBtnOn: { background: '#003D7C', color: '#fff', borderColor: '#003D7C' },
  vazio: { textAlign: 'center', padding: '3rem', color: '#94A3B8', background: '#fff', border: '1px dashed #CBD5E1', borderRadius: 8 },
  lista: { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  card: { position: 'relative', background: '#fff', borderRadius: 8, padding: '0.9rem 1rem', border: '1px solid #E2E8F0', cursor: 'pointer', outline: 'none', boxShadow: '0 1px 3px rgba(15,23,42,0.03)' },
  cardMobile: { padding: '0.75rem 0.8rem', borderRadius: 10 },
  cardArquivado: { background: '#F8FAFC', borderColor: '#CBD5E1' },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 8 },
  cardTopMobile: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  badges: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  badgesMobile: { gap: 5 },
  tipoBadge: { padding: '0.2rem 0.65rem', borderRadius: 20, fontWeight: 800, fontSize: '0.75rem', whiteSpace: 'nowrap' },
  tipoBadgeMobile: { padding: '0.18rem 0.48rem', fontSize: '0.68rem' },
  fixadoBadge: { padding: '0.2rem 0.6rem', borderRadius: 20, background: '#F5F3FF', color: '#7C3AED', fontWeight: 800, fontSize: '0.75rem' },
  arquivadoBadge: { padding: '0.2rem 0.6rem', borderRadius: 20, background: '#E2E8F0', color: '#475569', fontWeight: 800, fontSize: '0.75rem' },
  respostasBadge: { padding: '0.2rem 0.6rem', borderRadius: 20, background: '#EAF2FF', color: '#003D7C', fontWeight: 800, fontSize: '0.75rem' },
  acoes: { display: 'flex', gap: 5, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' },
  menuBtn: { width: 34, height: 34, borderRadius: 10, border: '1px solid #E2E8F0', background: '#F8FAFC', color: '#0F172A', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  menuAcoes: { position: 'absolute', right: 14, top: 48, zIndex: 20, minWidth: 220, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, boxShadow: '0 16px 35px rgba(15,23,42,0.18)', padding: 6, display: 'grid', gap: 4 },
  menuItem: { border: 'none', background: 'transparent', color: '#0F172A', borderRadius: 8, padding: '0.62rem 0.75rem', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-start', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' },
  menuItemLido: { border: 'none', background: 'transparent', color: '#94A3B8', borderRadius: 8, padding: '0.62rem 0.75rem', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-start', fontWeight: 700, fontSize: '0.78rem', fontFamily: 'inherit', textAlign: 'left' },
  menuItemDanger: { color: '#DC2626' },
  menuOverlayMobile: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.48)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' },
  menuSheetMobile: { width: 'min(86vw, 320px)', background: '#fff', borderRadius: 14, boxShadow: '0 24px 60px rgba(15,23,42,0.28)', padding: 10, display: 'grid', gap: 5 },
  menuItemSheet: { border: 'none', background: '#fff', color: '#0F172A', borderRadius: 10, padding: '0.8rem 1rem', display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'flex-start', fontWeight: 800, fontSize: '0.86rem', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' },
  menuItemSheetLido: { border: 'none', background: '#fff', color: '#94A3B8', borderRadius: 10, padding: '0.8rem 1rem', display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'flex-start', fontWeight: 700, fontSize: '0.86rem', fontFamily: 'inherit', textAlign: 'left' },
  menuCancelarMobile: { marginTop: 8, border: 'none', background: '#F8FAFC', color: '#0F172A', borderRadius: 10, padding: '0.8rem 1rem', fontWeight: 900, fontSize: '0.86rem', cursor: 'pointer', fontFamily: 'inherit' },
  btnAcao: { padding: '0.35rem 0.6rem', borderRadius: 8, background: '#F1F5F9', color: '#334155', fontSize: '0.78rem', border: 'none', cursor: 'pointer', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'inherit' },
  cardTitulo: { fontWeight: 800, color: '#1A202C', margin: '0 0 4px', fontSize: '0.95rem' },
  cardTituloMobile: { fontSize: '0.91rem', marginTop: 2 },
  cardTexto: { color: '#475569', fontSize: '0.85rem', lineHeight: 1.5, margin: '0 0 6px' },
  cardTextoMobile: { fontSize: '0.78rem', lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', margin: 0 },
  resumoLinha: { display: 'flex', alignItems: 'flex-start', gap: 7, minWidth: 0 },
  resumoDot: { width: 6, height: 6, borderRadius: 999, background: '#2563EB', flexShrink: 0, marginTop: 7 },
  cardFooterResumo: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', color: '#64748B', fontSize: '0.72rem', fontWeight: 700, marginTop: 6 },
  cardFooterMobile: { gap: 6, fontSize: '0.68rem', lineHeight: 1.25 },
  cardFooterAcoes: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 9 },
  respostasResumo: { border: '1px solid #E2E8F0', background: '#F8FAFC', color: '#475569', borderRadius: 999, padding: '0.28rem 0.55rem', fontWeight: 900, fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: 5 },
  verMaisBtn: { border: '1px solid #E2E8F0', background: '#F8FAFC', color: '#475569', borderRadius: 10, padding: '0.5rem 0.75rem', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'inherit' },
  produtoPromo: { display: 'flex', alignItems: 'center', gap: 10, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: 10, margin: '8px 0', color: '#92400E', fontSize: '0.82rem' },
  produtoPromoImg: { width: 44, height: 44, borderRadius: 8, objectFit: 'cover', background: '#fff', flexShrink: 0 },
  cardInfo: { fontSize: '0.73rem', color: '#94A3B8' },
  cardInfoAutor: { display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', color: '#94A3B8', fontWeight: 600, margin: '8px 0 4px' },
  lidoInfo: { fontSize: '0.72rem', color: '#94A3B8', marginTop: 4 },
  historico: { marginTop: 14, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 18, padding: 12 },
  historicoTitulo: { display: 'block', color: '#334155', fontSize: '0.8rem', fontWeight: 800, marginBottom: 6 },
  semResposta: { color: '#94A3B8', fontSize: '0.78rem', fontWeight: 500 },
  conversa: { display: 'flex', flexDirection: 'column', gap: 8 },
  balaoLinha: { display: 'flex', width: '100%', gap: 8, alignItems: 'flex-end' },
  balao: { maxWidth: 'min(82%, 520px)', borderRadius: 14, padding: '0.55rem 0.7rem', boxShadow: '0 1px 2px rgba(15,23,42,0.05)' },
  balaoMeu: { background: '#DCFCE7', color: '#14532D', borderBottomRightRadius: 4 },
  balaoOutro: { background: '#fff', color: '#334155', border: '1px solid #E2E8F0', borderBottomLeftRadius: 4 },
  respostaMeta: { color: 'inherit', opacity: 0.82, fontSize: '0.72rem', fontWeight: 900, marginBottom: 2 },
  respostaTexto: { color: 'inherit', fontSize: '0.84rem', marginTop: 2, lineHeight: 1.4, whiteSpace: 'pre-wrap' },
  balaoHora: { marginTop: 4, fontSize: '0.67rem', opacity: 0.68, textAlign: 'right', fontWeight: 700 },
  responderToggle: { border: 'none', borderRadius: 10, background: '#003D7C', color: '#fff', padding: '0.5rem 0.8rem', fontWeight: 900, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'inherit', fontSize: '0.78rem' },
  respostaInput: { flex: 1, minWidth: 0, border: '1px solid #CBD5E1', borderRadius: 16, padding: '0.78rem 0.9rem', fontFamily: 'inherit', outlineColor: '#003D7C', fontSize: '0.9rem', background: '#fff' },
  respostaBtn: { border: 'none', borderRadius: 12, background: '#003D7C', color: '#fff', padding: '0.6rem 0.85rem', fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, flexShrink: 0 },
  arquivadoInfo: { margin: '0 1rem 1rem', background: '#EEF2F7', color: '#64748B', borderRadius: 10, padding: '0.65rem 0.8rem', fontWeight: 800, fontSize: '0.78rem' },
  pessoasOverlay: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 10500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' },
  pessoasCard: { background: '#fff', borderRadius: 16, width: '100%', maxWidth: 360, maxHeight: '70vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 60px rgba(15,23,42,0.28)' },
  pessoasHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.9rem 1rem', borderBottom: '1px solid #E2E8F0', color: '#0F172A' },
  pessoasFechar: { border: 'none', background: '#F1F5F9', color: '#475569', borderRadius: 999, width: 30, height: 30, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 },
  pessoasLista: { padding: '0.6rem 1rem 1rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 },
  pessoasVazio: { color: '#94A3B8', fontSize: '0.82rem', fontWeight: 600, padding: '0.5rem 0' },
  pessoaItem: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '0.55rem 0.7rem', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10 },
  pessoaNome: { fontSize: '0.85rem', color: '#0F172A', fontWeight: 700 },
  pessoaPerfil: { fontSize: '0.68rem', color: '#075985', background: '#E0F2FE', borderRadius: 999, padding: '0.15rem 0.5rem', fontWeight: 800, textTransform: 'capitalize', flexShrink: 0 },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem' },
  modalBox: { background: '#fff', borderRadius: 12, padding: '1.5rem', width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto' },
  modalTitulo: { fontWeight: 800, margin: '0 0 1.25rem', color: '#1A202C' },
  overlayDetalhe: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9000, padding: '1.25rem' },
  overlayDetalheMobile: { padding: 0, zIndex: 9000 },
  modalDetalhe: { background: '#fff', borderRadius: 16, width: '100%', maxWidth: 620, maxHeight: '86vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 50px rgba(15,23,42,0.25)' },
  modalDetalheMobile: { position: 'fixed', inset: 0, maxWidth: '100%', width: '100%', height: '100dvh', maxHeight: '100dvh', borderRadius: 0, zIndex: 9001 },
  modalDetalheHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, padding: '1rem 1.1rem', borderBottom: '1px solid #E2E8F0' },
  modalDetalheHeaderMobile: { flexDirection: 'column', alignItems: 'stretch', background: 'linear-gradient(135deg, #0B1E45 0%, #003D7C 55%, #004F9E 100%)', color: '#fff', padding: 0, borderBottom: 'none', gap: 0, flexShrink: 0 },
  detalheHeaderLinha1: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%', padding: '0.6rem 0.9rem 1.15rem', paddingTop: 'max(0.7rem, env(safe-area-inset-top, 0px))' },
  detalheHeaderTitulo: { color: '#fff', fontSize: '1.12rem', fontWeight: 800, flex: 1, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  voltarSetaBtn: { border: 'none', background: 'transparent', color: '#fff', width: 38, height: 38, display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-start', cursor: 'pointer', flexShrink: 0, padding: 0 },
  pinHeaderBtn: { border: 'none', background: 'transparent', color: '#fff', width: 38, height: 38, display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', cursor: 'pointer', flexShrink: 0, padding: 0 },
  pinHeaderBtnAtivo: { color: '#F47920' },
  badgesDetalheMobile: { background: '#fff', borderRadius: '20px 20px 0 0', margin: 0, padding: '0.95rem 1rem 0.9rem', borderBottom: '3px solid #F47920', justifyContent: 'flex-start', gap: 8 },
  tipoBadgeDetalhe: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0.42rem 0.8rem', borderRadius: 999, fontWeight: 800, fontSize: '0.84rem' },
  fecharDetalheBtn: { border: '1px solid #D8E3F4', background: '#F8FAFC', color: '#003D7C', borderRadius: 999, width: 44, height: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 },
  modalDetalheBody: { flex: 1, overflowY: 'auto', padding: '1rem 1.1rem' },
  modalDetalheBodyMobile: { padding: '1.25rem', WebkitOverflowScrolling: 'touch' },
  modalDetalheTitulo: { fontWeight: 800, fontSize: '1.15rem', margin: '0 0 6px', color: '#1A202C', lineHeight: 1.3 },
  modalDetalheTituloMobile: { fontSize: '1.25rem' },
  modalDetalheTexto: { color: '#334155', fontSize: '0.92rem', lineHeight: 1.55, margin: '0 0 12px' },
  modalDetalheTextoMobile: { fontSize: '0.95rem' },
  respostaArea: { borderTop: '1px solid #E2E8F0', background: 'rgba(255,255,255,0.96)', padding: '0.65rem 1rem calc(0.75rem + env(safe-area-inset-bottom, 0px))', boxShadow: '0 -8px 22px rgba(15,23,42,0.06)', flexShrink: 0 },
  respostaLinha: { display: 'flex', gap: 10, alignItems: 'center' },
  respostaLinhaMobile: { gap: 10 },
  respostaBtnMobile: { border: 'none', borderRadius: '50%', width: 48, height: 48, background: '#003D7C', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 },
  clipeBtn: { border: 'none', background: 'transparent', color: '#003D7C', width: 42, height: 42, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 },
  anexoPreview: { display: 'flex', alignItems: 'center', gap: 10, border: '1px solid #E2E8F0', background: '#fff', borderRadius: 14, padding: '0.5rem 0.65rem', marginBottom: 8, boxShadow: '0 3px 10px rgba(15,23,42,0.04)' },
  anexoPreviewImg: { width: 48, height: 48, borderRadius: 10, objectFit: 'cover', flexShrink: 0, background: '#F1F5F9' },
  anexoPreviewIcone: { width: 48, height: 48, borderRadius: 10, background: '#EAF2FF', color: '#003D7C', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  anexoPreviewInfo: { flex: 1, minWidth: 0, display: 'grid', gap: 2 },
  anexoPreviewNome: { color: '#0F172A', fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  anexoPreviewTamanho: { color: '#94A3B8', fontSize: '0.7rem', fontWeight: 700 },
  anexoPreviewRemover: { border: 'none', background: '#FEE2E2', color: '#DC2626', width: 30, height: 30, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 },
  respostaErro: { margin: '0 0 0.45rem', color: '#B91C1C', fontSize: '0.76rem', fontWeight: 800 },
  spinnerBtn: { width: 17, height: 17, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  formGrid: { display: 'flex', flexDirection: 'column', gap: '0.85rem' },
  opcoes: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  selecionados: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  selecionadoChip: { border: 'none', borderRadius: 999, background: '#EAF2FF', color: '#003D7C', padding: '0.35rem 0.55rem', fontWeight: 900, fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontFamily: 'inherit' },
  listaUsuarios: { display: 'grid', gridTemplateColumns: '1fr', gap: 6, maxHeight: 180, overflowY: 'auto', marginTop: 8, border: '1px solid #E2E8F0', borderRadius: 10, padding: 6, background: '#F8FAFC' },
  usuarioOpcao: { border: '1px solid #E2E8F0', background: '#fff', borderRadius: 8, padding: '0.5rem 0.65rem', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', gap: 2, color: '#334155' },
  usuarioOpcaoOn: { borderColor: '#003D7C', background: '#EAF2FF', color: '#003D7C' },
  ajudaCampo: { color: '#64748B', fontSize: '0.72rem', fontWeight: 700, marginTop: 6 },
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
