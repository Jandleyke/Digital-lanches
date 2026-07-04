import { useState, useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useApp } from '../contexts/AppContext'
import { useIsMobile } from '../utils/useIsMobile'
import { buildContextoAluno, buildContextoAdmin } from '../utils/aiContext'
import { Send, Bot, RefreshCcw, MessageCircle, Sparkles, X } from 'lucide-react'
import { codigoPedido } from '../utils/pedidos'
import { calcularStatusLanchonete } from '../utils/lanchonete'
import { gerarRascunhoAvisoIA } from '../utils/rascunhoAvisoIA'

const ERRO_REDE = 'Não consegui responder agora. Tente novamente em instantes.'
const ERRO_ACAO = '\n\n(Não consegui concluir essa ação — confira se o item ou pedido ainda está disponível.)'

function responderLocalmente(texto, contexto, lanchoneteConfig, perfil) {
  const t = texto.toLowerCase()
  const cfg = lanchoneteConfig || {}

  if (/hor[aá]rio|que hora|abre|fecha|aberto|fechado|funciona|t[aá] abri/i.test(t)) {
    const { horarioAbertura: ha, horarioFechamento: hf, diasFuncionamento: dias = [] } = cfg
    const status = calcularStatusLanchonete(cfg, new Date())
    if (ha && hf) {
      return `Horário da cantina: ${ha} às ${hf}.\nAgora: ${status?.texto || 'horário não disponível'}.`
    }
    if (ha || hf) return `Horário: ${ha ? 'abre às ' + ha : ''}${hf ? ' fecha às ' + hf : ''}.`
    if (dias.length > 0 && status) return `Funcionamento de hoje: ${status.texto}.`
    return 'O horário ainda não foi cadastrado pelo administrador.'
  }

  if (perfil === 'aluno' && /meu pedido|como t[aá]|status do pedido|pedido ativo/i.test(t)) {
    const ativos = (contexto.meusPedidos || []).filter(p => p.status !== 'Entregue' && p.status !== 'Cancelado')
    if (!ativos.length) return 'Você não tem pedidos ativos no momento. Que tal pedir agora? 🍔'
    return ativos.map(p => `📦 Pedido ${codigoPedido(p)}\nStatus: ${p.status}\nRetirada: ${p.horarioRetirada}`).join('\n\n')
  }

  if (perfil === 'aluno' && /carrinho|o que t[eê]m no meu carrinho|meu carrinho/i.test(t)) {
    const { itens = [], total = 0 } = contexto.carrinho || {}
    if (!itens.length) return 'Seu carrinho está vazio. Que tal dar uma olhada no cardápio?'
    return `🛒 Carrinho:\n${itens.map(i => `• ${i.quantidade}× ${i.nome} — R$ ${i.subtotal.toFixed(2).replace('.', ',')}`).join('\n')}\n\nTotal: R$ ${total.toFixed(2).replace('.', ',')}`
  }

  if (perfil === 'aluno' && /card[aá]pio|tem hoje|o que tem|di[sz]pon[ií]vel/i.test(t)) {
    const itens = contexto.cardapio || []
    if (!itens.length) return 'Não há itens disponíveis hoje.'
    return `🍽️ Disponível hoje:\n${itens.slice(0, 10).map(p => `• ${p.nome} — R$ ${Number(p.preco).toFixed(2).replace('.', ',')}`).join('\n')}${itens.length > 10 ? `\n... e mais ${itens.length - 10} itens.` : ''}`
  }

  if (perfil === 'aluno' && /favorito/i.test(t)) {
    const favs = contexto.favoritos || []
    if (!favs.length) return 'Você ainda não tem favoritos. Toque no ❤️ em qualquer produto!'
    return `❤️ Seus favoritos:\n${favs.map(n => `• ${n}`).join('\n')}`
  }

  if (['admin', 'vendedor', 'cozinha'].includes(perfil) && /estoque|reposi[çc]/i.test(t)) {
    const baixo = contexto.estoqueBaixo || []
    if (!baixo.length) return 'Nenhum produto com estoque crítico. ✅'
    return `⚠️ Estoque baixo:\n${baixo.map(p => `• ${p.nome}: ${p.estoque} (mín. ${p.limite})`).join('\n')}`
  }

  if (['admin', 'vendedor'].includes(perfil) && /vendas? hoje|faturamento|quanto vendeu/i.test(t)) {
    const v = contexto.vendasHoje
    if (v == null) return 'Não consegui calcular as vendas.'
    return `💰 Vendas hoje: R$ ${Number(v).toFixed(2).replace('.', ',')}\n📦 Pedidos pagos: ${contexto.totalPagosHoje}`
  }

  return null
}

function statusCantina(cfg) {
  if (!cfg) return null
  const { horarioAbertura: ha, horarioFechamento: hf, diasFuncionamento: dias = [] } = cfg
  const status = calcularStatusLanchonete(cfg, new Date())
  if (!status || status.aberta) return status ? { aberta: true, msg: null } : null

  const horario = ha && hf ? `\nHorário cadastrado: ${ha} às ${hf}.` : ''
  const diasInfo = dias.length > 0 && status.texto === 'Fechada hoje'
    ? '\nHoje não está marcado como dia de funcionamento.'
    : ''
  return { aberta: false, msg: `⚠️ ${status.texto}.${diasInfo}${horario}` }
}

function limitarPosicao(posicao, reservaInferior = 0) {
  if (!posicao || typeof window === 'undefined') return null
  const x = Number(posicao.x)
  const y = Number(posicao.y)
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null

  const limiteX = Math.max(4, window.innerWidth - 56)
  const limiteY = Math.max(4, window.innerHeight - 56 - reservaInferior)
  return {
    x: Math.max(4, Math.min(limiteX, x)),
    y: Math.max(4, Math.min(limiteY, y)),
  }
}

function saudacaoInicial(usuario, cfg, emAvisos = false, telaAvisos = 'lista') {
  const perfil = usuario?.perfil
  const primeiroNome = usuario?.nome?.split(' ')[0] || 'você'
  const hora = new Date().getHours()

  if (emAvisos) {
    if (telaAvisos === 'detalhe') return `Oi, ${primeiroNome}! 📋 Quer que eu ajude a responder esse aviso? Posso confirmar recebimento, pedir mais informações ou deixar a resposta mais formal.`
    if (telaAvisos === 'form') return `Oi, ${primeiroNome}! ✍️ Posso melhorar o texto que você está escrevendo — mais curto, mais formal ou mais claro. É só pedir.`
    return `Oi, ${primeiroNome}! 📣 Posso criar um rascunho de aviso pra você — é só descrever o que precisa (ex: "avisar que não haverá aula dia 10/07 no turno da tarde"). Você revisa e publica quando quiser.`
  }

  if (perfil === 'admin' || perfil === 'gerente') {
    const frases = [
      `Fala, ${primeiroNome}! 👋 Tudo sob controle por aqui. Quer ver as vendas, estoque ou algum relatório?`,
      `Oi, ${primeiroNome}! 🚀 Pronto pra dominar o dia. O que você quer checar primeiro?`,
      `E aí, chefe ${primeiroNome}! 😎 Vendas, estoque, avaliações… só mandar!`,
    ]
    return frases[hora % frases.length]
  }

  if (['vendedor', 'cozinha'].includes(perfil)) {
    const frases = [
      `Olá, ${primeiroNome}! 🍳 Mãos à obra! Posso ajudar com pedidos, estoque ou resumo do dia.`,
      `Oi, ${primeiroNome}! 💪 Bora arrasar hoje! O que você precisa saber?`,
    ]
    return frases[hora % frases.length]
  }

  let cumprimento
  if (hora >= 5 && hora < 12)
    cumprimento = `Bom dia, ${primeiroNome}! ☀️`
  else if (hora >= 12 && hora < 18)
    cumprimento = `Boa tarde, ${primeiroNome}! 😄`
  else if (hora >= 18 && hora < 23)
    cumprimento = `Boa noite, ${primeiroNome}! 🌙`
  else
    cumprimento = `Ei, ${primeiroNome}! 🦉`

  const status = statusCantina(cfg)
  if (status && !status.aberta) {
    return `${cumprimento}\n\n${status.msg}\n\nMas pode perguntar o que quiser, tô aqui pra ajudar!`
  }

  if (hora >= 5 && hora < 12)
    return `${cumprimento} Tô aqui pra te ajudar a escolher o melhor lanche. O que você tá afim?`
  if (hora >= 12 && hora < 18)
    return `${cumprimento} Aquela fominha bateu, né? Me fala o que você quer e eu te ajudo!`
  if (hora >= 18 && hora < 23)
    return `${cumprimento} Tô aqui pra ajudar. Quer ver o cardápio, checar seu pedido ou tirar uma dúvida?`
  return `${cumprimento} De madrugada e com fome? Respeito. Me fala o que precisa!`
}

function nomeDaTela(pathname) {
  if (pathname.includes('/carrinho')) return 'Carrinho'
  if (pathname.includes('/cardapio')) return 'Cardápio'
  if (pathname.includes('/pedidos')) return 'Pedidos'
  if (pathname.includes('/favoritos')) return 'Favoritos'
  if (pathname.includes('/perfil')) return 'Perfil'
  return 'outra'
}

const SUGESTOES = {
  admin: ['Vendas de hoje', 'Estoque baixo', 'Mais vendido?'],
  vendedor: ['Pedidos pendentes', 'Estoque baixo', 'Resumo do dia'],
  cozinha: ['Pedidos pendentes', 'Estoque baixo', 'Resumo do dia'],
  aluno: ['Que horas abre?', 'Como está meu pedido?', 'O que tem hoje?'],
}

const SUGESTOES_AVISOS_DETALHE = ['Confirmar recebimento', 'Pedir mais informações', 'Responder formalmente', 'Resumir aviso', 'Gerar resposta curta']
const SUGESTOES_AVISOS_LISTA = ['Criar aviso', 'Melhorar texto', 'Comunicar ausência de aula', 'Confirmar turma', 'Avisar cozinha']

function padraoCriarAviso(texto) {
  return /\b(cria|criar|gera|gerar|monta|montar|escreve|escrever|redig[ei]r?)\b.*\b(aviso|comunicado)\b|^(avisar|comunicar|confirmar)\b/i.test(texto)
}

function padraoMelhorarTexto(texto) {
  return /\b(melhor|mais curt|mais claro|mais formal|profissional|corrig[ei]|revis[ae]r?)\b/i.test(texto)
}

const TAG_TIPO = { info: 'Comunicado', promo: 'Promoção', aviso: 'Aviso', novidade: 'Novidade' }
const TAG_DESTINO = { todos: 'Todos', aluno: 'Alunos', vendedor: 'Vendedor', cozinha: 'Cozinha', admin: 'Admin' }
const TAG_PRIORIDADE = { baixa: 'Baixa', media: 'Média', alta: 'Alta' }

export default function ChatAssistente({ cartBarAtiva = false }) {
  const {
    usuarioLogado, produtos, pedidos, lanchoneteConfig,
    carrinho, totalCarrinho, favoritos, toggleFavorito, adicionarAoCarrinho, cancelarPedido, resumoAvaliacoesPorProduto,
  } = useApp()
  const location = useLocation()
  const isMobile = useIsMobile()
  const reservaInferior = cartBarAtiva ? 144 : 0
  const emTelaAvisos = location.pathname.includes('/avisos')

  const [aberto, setAberto] = useState(false)
  const [mensagens, setMensagens] = useState(null)
  const [input, setInput] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [contextoAvisos, setContextoAvisos] = useState(null)
  const [visivel, setVisivel] = useState(() => localStorage.getItem('chat-btn-visible') !== 'false')
  const [pos, setPos] = useState(() => {
    try { const s = localStorage.getItem('chat-btn-pos'); if (s) return JSON.parse(s) } catch { return null }
    return null
  })

  const fimRef = useRef(null)
  const btnRef = useRef(null)
  const dragState = useRef(null)
  const posRef = useRef(pos)
  const abrirRef = useRef(null)
  const reservaRef = useRef(reservaInferior)

  useEffect(() => { posRef.current = pos }, [pos])
  useEffect(() => { reservaRef.current = reservaInferior }, [reservaInferior])
  useEffect(() => {
    abrirRef.current = () => {
      setAberto(v => {
        if (!v && mensagens === null && usuarioLogado) {
          setMensagens([{ autor: 'bot', texto: saudacaoInicial(usuarioLogado, lanchoneteConfig, emTelaAvisos, contextoAvisos?.tela) }])
        }
        return !v
      })
    }
  })

  // Ouve o contexto atual da tela de Avisos (lista, detalhe ou formulário aberto)
  useEffect(() => {
    function handler(e) { setContextoAvisos(e.detail || null) }
    window.addEventListener('avisos-contexto-change', handler)
    return () => window.removeEventListener('avisos-contexto-change', handler)
  }, [])

  // Ouve evento para mostrar/esconder (disparado pelo perfil)
  useEffect(() => {
    function handler(e) { setVisivel(Boolean(e.detail)) }
    function storage(e) {
      if (e.key === 'chat-btn-visible') setVisivel(e.newValue !== 'false')
    }
    window.addEventListener('chat-visivel-change', handler)
    window.addEventListener('storage', storage)
    return () => {
      window.removeEventListener('chat-visivel-change', handler)
      window.removeEventListener('storage', storage)
    }
  }, [])

  useEffect(() => {
    function ajustarPosicao() {
      setPos(atual => {
        if (!atual) return null
        const ajustada = limitarPosicao(atual, reservaRef.current)
        if (!ajustada) {
          localStorage.removeItem('chat-btn-pos')
          return null
        }
        if (ajustada.x !== atual.x || ajustada.y !== atual.y) {
          localStorage.setItem('chat-btn-pos', JSON.stringify(ajustada))
          return ajustada
        }
        return atual
      })
    }

    ajustarPosicao()
    window.addEventListener('resize', ajustarPosicao)
    return () => window.removeEventListener('resize', ajustarPosicao)
  }, [])

  // Drag global listeners
  useEffect(() => {
    function mm(e) {
      if (!dragState.current) return
      const dx = e.clientX - dragState.current.startX
      const dy = e.clientY - dragState.current.startY
      if (!dragState.current.moved && Math.abs(dx) < 6 && Math.abs(dy) < 6) return
      dragState.current.moved = true
      const nx = Math.max(4, Math.min(window.innerWidth - 56, dragState.current.elX + dx))
      const ny = Math.max(4, Math.min(window.innerHeight - 56 - reservaRef.current, dragState.current.elY + dy))
      const np = { x: nx, y: ny }
      setPos(np); posRef.current = np
    }
    function mu() {
      if (!dragState.current) return
      if (!dragState.current.moved) abrirRef.current?.()
      else localStorage.setItem('chat-btn-pos', JSON.stringify(posRef.current))
      dragState.current = null
    }
    function tm(e) {
      if (!dragState.current) return
      const t = e.touches[0]
      const dx = t.clientX - dragState.current.startX
      const dy = t.clientY - dragState.current.startY
      if (!dragState.current.moved && Math.abs(dx) < 6 && Math.abs(dy) < 6) return
      dragState.current.moved = true
      e.preventDefault()
      const nx = Math.max(4, Math.min(window.innerWidth - 56, dragState.current.elX + dx))
      const ny = Math.max(4, Math.min(window.innerHeight - 56 - reservaRef.current, dragState.current.elY + dy))
      const np = { x: nx, y: ny }
      setPos(np); posRef.current = np
    }
    function te() {
      if (!dragState.current) return
      if (!dragState.current.moved) abrirRef.current?.()
      else localStorage.setItem('chat-btn-pos', JSON.stringify(posRef.current))
      dragState.current = null
    }
    window.addEventListener('mousemove', mm)
    window.addEventListener('mouseup', mu)
    window.addEventListener('touchmove', tm, { passive: false })
    window.addEventListener('touchend', te)
    return () => {
      window.removeEventListener('mousemove', mm)
      window.removeEventListener('mouseup', mu)
      window.removeEventListener('touchmove', tm)
      window.removeEventListener('touchend', te)
    }
  }, [])

  useEffect(() => { fimRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [mensagens, enviando])

  if (!usuarioLogado || !visivel) return null

  async function executarAcao(acao) {
    if (!acao?.tipo) return true
    if (acao.tipo === 'favoritar' || acao.tipo === 'desfavoritar') {
      const produto = produtos.find(p => p.nome?.toLowerCase() === acao.produto?.toLowerCase())
      if (!produto) return false
      const jaFav = favoritos.includes(produto.id)
      if (acao.tipo === 'favoritar' && !jaFav) toggleFavorito(produto.id)
      if (acao.tipo === 'desfavoritar' && jaFav) toggleFavorito(produto.id)
      return true
    }
    if (acao.tipo === 'adicionar_carrinho') {
      const produto = produtos.find(p => p.nome?.toLowerCase() === acao.produto?.toLowerCase())
      if (!produto || !produto.disponivel) return false
      const vezes = Math.min(Math.max(Number(acao.quantidade) || 1, 1), 10)
      for (let i = 0; i < vezes; i++) adicionarAoCarrinho(produto)
      return true
    }
    if (acao.tipo === 'cancelar_pedido') {
      const pedido = pedidos.find(p => p.id === acao.pedidoId && p.matricula === usuarioLogado.matricula)
      if (!pedido || pedido.status !== 'Recebido') return false
      await cancelarPedido(pedido.id, 'Cancelado via assistente virtual')
      return true
    }
    return true
  }

  async function enviarTextoAvisos(texto) {
    setMensagens(prev => [...(prev || []), { autor: 'user', texto }])
    setInput('')

    const tela = contextoAvisos?.tela || 'lista'

    // Rascunho local instantâneo (sem custo de API) quando o pedido claramente é para criar um aviso novo
    if (tela !== 'detalhe' && padraoCriarAviso(texto) && !padraoMelhorarTexto(texto)) {
      try {
        const rascunho = gerarRascunhoAvisoIA(texto)
        if (rascunho.reconhecido) {
          setMensagens(prev => [...(prev || []), {
            autor: 'bot',
            texto: 'Preparei um rascunho com base no que você descreveu. Revise e clique em "Usar este aviso" se estiver bom.',
            rascunhoAviso: rascunho,
          }])
          return
        }
      } catch { /* cai para a IA abaixo */ }
    }

    setEnviando(true)
    const historico = (mensagens || []).slice(-6)
    const contexto = {
      tela,
      rascunhoAtual: tela === 'form' && contextoAvisos?.rascunho ? contextoAvisos.rascunho : null,
      avisoAtual: tela === 'detalhe' && contextoAvisos?.aviso ? contextoAvisos.aviso : null,
    }
    try {
      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modo: 'avisos', contexto, historico, mensagem: texto }),
      })
      const dados = await resp.json()
      setMensagens(prev => [...(prev || []), {
        autor: 'bot',
        texto: dados?.resposta || ERRO_REDE,
        rascunhoAviso: dados?.rascunhoAviso || null,
        textoMelhorado: dados?.textoMelhorado || null,
        rascunhoResposta: dados?.rascunhoResposta || null,
      }])
    } catch {
      setMensagens(prev => [...(prev || []), { autor: 'bot', texto: ERRO_REDE }])
    } finally { setEnviando(false) }
  }

  async function enviarTexto(textoOriginal) {
    const texto = textoOriginal.trim()
    if (!texto || enviando) return

    if (emTelaAvisos) { await enviarTextoAvisos(texto); return }

    const perfilAtual = usuarioLogado.perfil
    const ehGestao = ['admin', 'vendedor', 'cozinha'].includes(perfilAtual)
    const contexto = ehGestao
      ? buildContextoAdmin(produtos, pedidos)
      : buildContextoAluno(usuarioLogado, produtos, pedidos, {
          favoritos, carrinho, resumoAvaliacoesPorProduto,
          tela: { pagina: nomeDaTela(location.pathname), totalCarrinho },
        })
    setMensagens(prev => [...(prev || []), { autor: 'user', texto }])
    setInput('')

    const local = responderLocalmente(texto, contexto, lanchoneteConfig, perfilAtual)
    if (local) {
      setMensagens(prev => [...(prev || []), { autor: 'bot', texto: local }])
      return
    }

    setEnviando(true)
    const historico = (mensagens || []).slice(-6)
    try {
      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ perfil: perfilAtual, contexto, historico, mensagem: texto }),
      })
      const dados = await resp.json()
      let textoResp = dados?.resposta || ERRO_REDE
      if (dados?.acao) { const ok = await executarAcao(dados.acao); if (!ok) textoResp += ERRO_ACAO }
      setMensagens(prev => [...(prev || []), { autor: 'bot', texto: textoResp }])
    } catch {
      setMensagens(prev => [...(prev || []), { autor: 'bot', texto: ERRO_REDE }])
    } finally { setEnviando(false) }
  }

  function usarRascunhoAviso(indice, rascunho) {
    window.dispatchEvent(new CustomEvent('ia-preencher-aviso', { detail: rascunho }))
    setMensagens(prev => prev.map((m, i) => i === indice ? { ...m, usado: true } : m))
  }

  function usarTextoMelhorado(indice, texto) {
    window.dispatchEvent(new CustomEvent('ia-preencher-aviso', { detail: { mensagem: texto } }))
    setMensagens(prev => prev.map((m, i) => i === indice ? { ...m, usado: true } : m))
  }

  function usarRascunhoResposta(indice, texto) {
    window.dispatchEvent(new CustomEvent('ia-preencher-resposta', { detail: { texto } }))
    setMensagens(prev => prev.map((m, i) => i === indice ? { ...m, usado: true } : m))
  }

  const sugestoesAtuais = emTelaAvisos
    ? (contextoAvisos?.tela === 'detalhe' ? SUGESTOES_AVISOS_DETALHE : SUGESTOES_AVISOS_LISTA)
    : (SUGESTOES[usuarioLogado.perfil] || SUGESTOES.aluno)

  const btnStyle = {
    ...s.botaoFlutuante,
    cursor: 'grab',
    // Na tela de Avisos o detalhe abre em modal de tela cheia (zIndex 9001) — o botão
    // precisa ficar acima dele, senão fica inacessível enquanto o aviso está aberto.
    ...(emTelaAvisos ? { zIndex: 9100 } : {}),
    ...(pos
      ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' }
      : { right: 18, bottom: cartBarAtiva ? 'calc(9rem + env(safe-area-inset-bottom, 0px))' : (isMobile ? 'calc(80px + env(safe-area-inset-bottom, 0px))' : 24) }
    ),
  }

  return (
    <>
      {/* Botão flutuante + arrastável */}
      <button
        ref={btnRef}
        aria-label={aberto ? 'Fechar assistente' : 'Abrir assistente'}
        title="Assistente virtual (arraste para mover)"
        style={btnStyle}
        onMouseDown={e => {
          e.preventDefault()
          const r = btnRef.current.getBoundingClientRect()
          dragState.current = { moved: false, startX: e.clientX, startY: e.clientY, elX: r.left, elY: r.top }
        }}
        onTouchStart={e => {
          const t = e.touches[0]
          const r = btnRef.current.getBoundingClientRect()
          dragState.current = { moved: false, startX: t.clientX, startY: t.clientY, elX: r.left, elY: r.top }
        }}
      >
        {aberto ? <X size={22} color="#fff" /> : <MessageCircle size={22} color="#fff" />}
      </button>

      {/* Painel do chat */}
      {aberto && (
        <div style={{ ...s.painel, ...(isMobile ? s.painelMobile : s.painelDesktop), ...(emTelaAvisos ? { zIndex: 9110 } : {}) }}>
          <div style={s.cabecalho}>
            <Bot size={17} color="#fff" />
            <span style={s.cabecalhoTitulo}>Assistente Senac Lanches</span>
            <button type="button"
              onClick={() => setMensagens([{ autor: 'bot', texto: saudacaoInicial(usuarioLogado, lanchoneteConfig, emTelaAvisos, contextoAvisos?.tela) }])}
              style={s.btnCab} title="Limpar conversa">
              <RefreshCcw size={14} color="#fff" />
            </button>
            <button type="button" onClick={() => setAberto(false)} style={s.btnCab} title="Fechar">
              <X size={14} color="#fff" />
            </button>
          </div>

          <div style={s.mensagens}>
            {(mensagens || []).map((m, i) => (
              <div key={i} style={{ ...s.bolha, ...(m.autor === 'user' ? s.bolhaUser : s.bolhaBot) }}>
                {m.texto}
                {m.rascunhoAviso && (
                  <div style={s.rascunhoCard}>
                    <div style={s.rascunhoCabecalho}>
                      <span style={s.rascunhoTag}>{TAG_TIPO[m.rascunhoAviso.tipo] || 'Comunicado'}</span>
                      <span style={s.rascunhoTag}>{TAG_DESTINO[m.rascunhoAviso.destino] || 'Todos'}</span>
                      <span style={s.rascunhoTag}>{TAG_PRIORIDADE[m.rascunhoAviso.prioridade] || 'Média'}</span>
                    </div>
                    <strong style={s.rascunhoTitulo}>{m.rascunhoAviso.titulo}</strong>
                    <p style={s.rascunhoTexto}>{m.rascunhoAviso.mensagem}</p>
                    <button type="button" style={{ ...s.botaoUsar, ...(m.usado ? s.botaoUsarFeito : {}) }} onClick={() => usarRascunhoAviso(i, m.rascunhoAviso)} disabled={m.usado}>
                      <Sparkles size={13} /> {m.usado ? 'Preenchido no formulário ✓' : 'Usar este aviso'}
                    </button>
                  </div>
                )}
                {m.textoMelhorado && (
                  <div style={s.rascunhoCard}>
                    <p style={s.rascunhoTexto}>{m.textoMelhorado}</p>
                    <button type="button" style={{ ...s.botaoUsar, ...(m.usado ? s.botaoUsarFeito : {}) }} onClick={() => usarTextoMelhorado(i, m.textoMelhorado)} disabled={m.usado}>
                      <Sparkles size={13} /> {m.usado ? 'Texto atualizado ✓' : 'Usar texto melhorado'}
                    </button>
                  </div>
                )}
                {m.rascunhoResposta && (
                  <div style={s.rascunhoCard}>
                    <p style={s.rascunhoTexto}>{m.rascunhoResposta}</p>
                    <button type="button" style={{ ...s.botaoUsar, ...(m.usado ? s.botaoUsarFeito : {}) }} onClick={() => usarRascunhoResposta(i, m.rascunhoResposta)} disabled={m.usado}>
                      <Sparkles size={13} /> {m.usado ? 'Preenchido na resposta ✓' : 'Usar resposta'}
                    </button>
                  </div>
                )}
              </div>
            ))}
            {enviando && <div style={{ ...s.bolha, ...s.bolhaBot, color: '#94A3B8' }}>Digitando...</div>}
            <div ref={fimRef} />
          </div>

          <div style={s.sugestoes}>
            {sugestoesAtuais.map(sg => (
              <button key={sg} type="button" onClick={() => enviarTexto(sg)} style={s.sugestao} disabled={enviando}>
                {sg}
              </button>
            ))}
          </div>

          <form onSubmit={e => { e.preventDefault(); enviarTexto(input) }} style={s.form}>
            <input
              type="text" value={input} onChange={e => setInput(e.target.value)}
              placeholder="Digite sua pergunta..." style={s.input} disabled={enviando}
            />
            <button type="submit" style={s.botaoEnviar} disabled={enviando || !input.trim()}>
              <Send size={15} color="#fff" />
            </button>
          </form>
        </div>
      )}
    </>
  )
}

const s = {
  botaoFlutuante: {
    position: 'fixed', zIndex: 180,
    width: 52, height: 52, borderRadius: '50%', border: 'none',
    background: '#F47920', boxShadow: '0 6px 20px rgba(244,121,32,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'none',
  },
  painel: {
    position: 'fixed', right: 16, zIndex: 220,
    background: '#fff', borderRadius: 16, overflow: 'hidden',
    boxShadow: '0 12px 40px rgba(15,23,42,0.25)',
    display: 'flex', flexDirection: 'column',
  },
  painelDesktop: { bottom: 88, width: 360, height: 480 },
  painelMobile: { bottom: 'calc(72px + env(safe-area-inset-bottom, 0px))', top: 72, left: 12, right: 12 },
  cabecalho: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '0.85rem 1rem', flexShrink: 0,
    background: 'linear-gradient(135deg,#0B1E45 0%,#003D7C 55%,#004F9E 100%)',
    borderBottom: '3px solid #F47920',
  },
  cabecalhoTitulo: { color: '#fff', fontWeight: 700, fontSize: '0.9rem', flex: 1 },
  btnCab: {
    width: 28, height: 28, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.25)',
    background: 'rgba(255,255,255,0.12)', cursor: 'pointer', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  mensagens: { flex: 1, overflowY: 'auto', padding: '0.9rem', display: 'flex', flexDirection: 'column', gap: 8 },
  bolha: { maxWidth: '82%', padding: '0.55rem 0.8rem', borderRadius: 14, fontSize: '0.84rem', lineHeight: 1.45, whiteSpace: 'pre-wrap' },
  bolhaUser: { alignSelf: 'flex-end', background: '#003D7C', color: '#fff', borderBottomRightRadius: 4 },
  bolhaBot: { alignSelf: 'flex-start', background: '#F1F5F9', color: '#1A202C', borderBottomLeftRadius: 4 },
  sugestoes: { display: 'flex', gap: 6, overflowX: 'auto', padding: '0 0.75rem 0.65rem', borderTop: '1px solid #F1F5F9', flexShrink: 0 },
  sugestao: { border: '1px solid #D7E3F0', background: '#fff', color: '#003D7C', borderRadius: 999, padding: '0.38rem 0.65rem', fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap', cursor: 'pointer', flexShrink: 0 },
  form: { display: 'flex', gap: 8, padding: '0.75rem', borderTop: '1px solid #E2E8F0', flexShrink: 0 },
  input: { flex: 1, padding: '0.55rem 0.8rem', borderRadius: 20, border: '1px solid #E2E8F0', fontSize: '0.85rem', fontFamily: 'inherit', outline: 'none' },
  botaoEnviar: { width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: 'pointer', background: '#F47920', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  rascunhoCard: { marginTop: 8, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '0.6rem 0.7rem', display: 'flex', flexDirection: 'column', gap: 6 },
  rascunhoCabecalho: { display: 'flex', flexWrap: 'wrap', gap: 5 },
  rascunhoTag: { background: '#EAF2FF', color: '#003D7C', borderRadius: 999, padding: '0.15rem 0.5rem', fontSize: '0.66rem', fontWeight: 800 },
  rascunhoTitulo: { color: '#0F172A', fontSize: '0.85rem' },
  rascunhoTexto: { color: '#334155', fontSize: '0.8rem', lineHeight: 1.4, whiteSpace: 'pre-wrap', margin: 0 },
  botaoUsar: { alignSelf: 'flex-start', border: 'none', background: '#003D7C', color: '#fff', borderRadius: 999, padding: '0.4rem 0.75rem', fontSize: '0.74rem', fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'inherit' },
  botaoUsarFeito: { background: '#DCFCE7', color: '#166534', cursor: 'default' },
}
