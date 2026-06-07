import { useState, useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useApp } from '../contexts/AppContext'
import { useIsMobile } from '../utils/useIsMobile'
import { buildContextoAluno, buildContextoAdmin } from '../utils/aiContext'
import { MessageCircle, X, Send, Bot } from 'lucide-react'

const ERRO_REDE = 'Não consegui responder agora. Tente novamente em instantes.'
const ERRO_ACAO = '\n\n(Não consegui concluir essa ação — confira se o item ou pedido ainda está disponível.)'

function saudacaoInicial(perfil) {
  if (perfil === 'admin' || perfil === 'gerente') {
    return 'Olá! Posso te ajudar a entender vendas, estoque e avaliações da cantina. O que você quer saber?'
  }
  return 'Oi! Posso te ajudar com o cardápio, seus pedidos, favoritos, carrinho e horários de retirada — e também posso favoritar produtos, adicionar itens ao carrinho ou cancelar um pedido pra você. Pergunte ou peça o que quiser!'
}

function nomeDaTela(pathname) {
  if (pathname.includes('/carrinho')) return 'Carrinho'
  if (pathname.includes('/cardapio')) return 'Cardápio'
  if (pathname.includes('/pedidos')) return 'Pedidos'
  if (pathname.includes('/favoritos')) return 'Favoritos'
  if (pathname.includes('/perfil')) return 'Perfil'
  return 'outra'
}

export default function ChatAssistente() {
  const {
    usuarioLogado, produtos, pedidos,
    carrinho, totalCarrinho, favoritos, toggleFavorito, adicionarAoCarrinho, cancelarPedido,
  } = useApp()
  const location = useLocation()
  const isMobile = useIsMobile()
  const [aberto, setAberto] = useState(false)
  const [mensagens, setMensagens] = useState(null)
  const [input, setInput] = useState('')
  const [enviando, setEnviando] = useState(false)
  const fimRef = useRef(null)

  function alternar() {
    setAberto(estavaAberto => {
      if (!estavaAberto && mensagens === null && usuarioLogado) {
        setMensagens([{ autor: 'bot', texto: saudacaoInicial(usuarioLogado.perfil) }])
      }
      return !estavaAberto
    })
  }

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens, enviando])

  if (!usuarioLogado || usuarioLogado.perfil === 'cozinha') return null

  async function executarAcao(acao) {
    if (!acao?.tipo) return true

    if (acao.tipo === 'favoritar' || acao.tipo === 'desfavoritar') {
      const produto = produtos.find(p => p.nome?.toLowerCase() === acao.produto?.toLowerCase())
      if (!produto) return false
      const jaFavorito = favoritos.includes(produto.id)
      if (acao.tipo === 'favoritar' && !jaFavorito) toggleFavorito(produto.id)
      if (acao.tipo === 'desfavoritar' && jaFavorito) toggleFavorito(produto.id)
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

  async function enviar(e) {
    e.preventDefault()
    const texto = input.trim()
    if (!texto || enviando) return

    const ehAdmin = usuarioLogado.perfil === 'admin' || usuarioLogado.perfil === 'gerente'
    const contexto = ehAdmin
      ? buildContextoAdmin(produtos, pedidos)
      : buildContextoAluno(usuarioLogado, produtos, pedidos, {
          favoritos, carrinho,
          tela: { pagina: nomeDaTela(location.pathname), totalCarrinho },
        })
    const historico = (mensagens || []).slice(-6)
    const novasMensagens = [...(mensagens || []), { autor: 'user', texto }]
    setMensagens(novasMensagens)
    setInput('')
    setEnviando(true)

    try {
      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ perfil: usuarioLogado.perfil, contexto, historico, mensagem: texto }),
      })
      const dados = await resp.json()
      let textoResposta = dados?.resposta || ERRO_REDE
      if (dados?.acao) {
        const sucesso = await executarAcao(dados.acao)
        if (!sucesso) textoResposta += ERRO_ACAO
      }
      setMensagens(msgs => [...msgs, { autor: 'bot', texto: textoResposta }])
    } catch {
      setMensagens(msgs => [...msgs, { autor: 'bot', texto: ERRO_REDE }])
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      <button
        onClick={alternar}
        style={{ ...s.botaoFlutuante, bottom: isMobile ? 78 : 24 }}
        title="Assistente virtual"
      >
        {aberto ? <X size={24} color="#fff" /> : <MessageCircle size={24} color="#fff" />}
      </button>

      {aberto && (
        <div style={{ ...s.painel, ...(isMobile ? s.painelMobile : s.painelDesktop) }}>
          <div style={s.cabecalho}>
            <Bot size={18} color="#fff" />
            <span style={s.cabecalhoTitulo}>Assistente Senac Lanches</span>
          </div>

          <div style={s.mensagens}>
            {(mensagens || []).map((m, i) => (
              <div key={i} style={{ ...s.bolha, ...(m.autor === 'user' ? s.bolhaUser : s.bolhaBot) }}>
                {m.texto}
              </div>
            ))}
            {enviando && <div style={{ ...s.bolha, ...s.bolhaBot, color: '#94A3B8' }}>Digitando...</div>}
            <div ref={fimRef} />
          </div>

          <form onSubmit={enviar} style={s.form}>
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Digite sua pergunta..."
              style={s.input}
              disabled={enviando}
            />
            <button type="submit" style={s.botaoEnviar} disabled={enviando || !input.trim()}>
              <Send size={16} color="#fff" />
            </button>
          </form>
        </div>
      )}
    </>
  )
}

const s = {
  botaoFlutuante: {
    position: 'fixed', right: 18, zIndex: 150,
    width: 52, height: 52, borderRadius: '50%', border: 'none', cursor: 'pointer',
    background: '#F47920', boxShadow: '0 6px 20px rgba(244,121,32,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  painel: {
    position: 'fixed', right: 16, zIndex: 200,
    background: '#fff', borderRadius: 16, overflow: 'hidden',
    boxShadow: '0 12px 40px rgba(15,23,42,0.25)',
    display: 'flex', flexDirection: 'column',
  },
  painelDesktop: { bottom: 88, width: 360, height: 480 },
  painelMobile: { bottom: 140, left: 12, right: 12, height: '55vh' },
  cabecalho: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '0.85rem 1rem',
    background: 'linear-gradient(135deg, #0B1E45 0%, #003D7C 55%, #004F9E 100%)',
    borderBottom: '3px solid #F47920',
  },
  cabecalhoTitulo: { color: '#fff', fontWeight: 700, fontSize: '0.92rem' },
  mensagens: { flex: 1, overflowY: 'auto', padding: '0.9rem', display: 'flex', flexDirection: 'column', gap: 8 },
  bolha: { maxWidth: '80%', padding: '0.55rem 0.8rem', borderRadius: 14, fontSize: '0.85rem', lineHeight: 1.4, whiteSpace: 'pre-wrap' },
  bolhaUser: { alignSelf: 'flex-end', background: '#003D7C', color: '#fff', borderBottomRightRadius: 4 },
  bolhaBot: { alignSelf: 'flex-start', background: '#F1F5F9', color: '#1A202C', borderBottomLeftRadius: 4 },
  form: { display: 'flex', gap: 8, padding: '0.75rem', borderTop: '1px solid #E2E8F0' },
  input: {
    flex: 1, padding: '0.55rem 0.8rem', borderRadius: 20, border: '1px solid #E2E8F0',
    fontSize: '0.85rem', fontFamily: 'inherit', outline: 'none',
  },
  botaoEnviar: {
    width: 38, height: 38, borderRadius: '50%', border: 'none', cursor: 'pointer',
    background: '#F47920', display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
}
