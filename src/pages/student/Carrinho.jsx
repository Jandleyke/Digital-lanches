import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout'
import AtendimentoPedido from '../../components/AtendimentoPedido'
import { useApp } from '../../contexts/AppContext'
import { useIsMobile } from '../../utils/useIsMobile'
import { ShoppingCart, CheckCircle, Utensils } from 'lucide-react'
import { codigoPedido as codigoPedidoBase, validarHorarioRetirada } from '../../utils/pedidos'
import { normalizarPerfil } from '../../utils/perfis'
import { produtoDisponivelParaCardapioDia } from '../../utils/producao'

const HORARIOS_SUGERIDOS = ['09:00','09:15','09:30','09:45','10:00','10:15','10:30','11:00','12:00','12:30','13:00','13:30']

const CORES_CONFETTI = ['#F47920','#003D7C','#22C55E','#F59E0B','#EF4444','#8B5CF6','#EC4899','#06B6D4']

function valorPseudoAleatorio(semente) {
  const valor = Math.sin(semente * 12.9898) * 43758.5453
  return valor - Math.floor(valor)
}

const PECAS_CONFETTI = Array.from({ length: 90 }, (_, i) => ({
  id: i,
  x: valorPseudoAleatorio(i + 1) * 100,
  color: CORES_CONFETTI[i % CORES_CONFETTI.length],
  delay: (valorPseudoAleatorio(i + 101) * 700).toFixed(0),
  duration: (1300 + valorPseudoAleatorio(i + 201) * 1200).toFixed(0),
  width: 6 + Math.floor(valorPseudoAleatorio(i + 301) * 8),
  height: 4 + Math.floor(valorPseudoAleatorio(i + 401) * 6),
  borderRadius: valorPseudoAleatorio(i + 501) > 0.4 ? 2 : '50%',
}))

function Confetti() {
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999, overflow: 'hidden' }}>
      {PECAS_CONFETTI.map(p => (
        <div key={p.id} style={{
          position: 'absolute',
          top: -20,
          left: `${p.x}%`,
          width: p.width,
          height: p.height,
          background: p.color,
          borderRadius: p.borderRadius,
          animation: `confettiFall ${p.duration}ms ${p.delay}ms ease-in forwards`,
        }} />
      ))}
    </div>
  )
}

export default function Carrinho() {
  const {
    carrinho, adicionarAoCarrinho, removerDoCarrinho, limparCarrinho,
    totalCarrinho, fazerPedido, produtos, producaoHoje, lanchoneteConfig, usuarioLogado,
  } = useApp()
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const [horario, setHorario] = useState('09:30')
  const [horarioCustom, setHorarioCustom] = useState(false)
  const [pagamento, setPagamento] = useState('PIX')
  const [pedidoFeito, setPedidoFeito] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [mostrarConfetti, setMostrarConfetti] = useState(false)
  const [erro, setErro] = useState('')
  const confettiTimerRef = useRef(null)
  const perfilProfessor = normalizarPerfil(usuarioLogado?.role || usuarioLogado?.perfil) === 'professor'

  useEffect(() => {
    return () => clearTimeout(confettiTimerRef.current)
  }, [])

  async function handleConfirmar() {
    if (carrinho.length === 0 || enviando) return
    const validacaoHorario = validarHorarioRetirada(horario, lanchoneteConfig)
    if (!validacaoHorario.valido) {
      setErro(validacaoHorario.mensagem)
      return
    }
    const itemSemEstoque = carrinho.find(item => {
      const atual = produtos.find(p => String(p.id) === String(item.id))
      const produtoDia = produtoDisponivelParaCardapioDia(atual, producaoHoje)
      return !produtoDia || Number(produtoDia.estoque || 0) < Number(item.quantidade || 0)
    })
    if (itemSemEstoque) {
      setErro(`Não há quantidade suficiente disponível para ${itemSemEstoque.nome}.`)
      return
    }
    setEnviando(true)
    setErro('')
    try {
      const pedido = await fazerPedido(horario, pagamento)
      setPedidoFeito(pedido)
      setMostrarConfetti(true)
      clearTimeout(confettiTimerRef.current)
      confettiTimerRef.current = setTimeout(() => setMostrarConfetti(false), 4000)
    } catch (error) {
      setErro(error.message || 'Erro ao enviar pedido. Tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  function adicionarUnidade(item) {
    const produtoAtual = produtos.find(p => String(p.id) === String(item.id))
    const produtoDia = produtoDisponivelParaCardapioDia(produtoAtual, producaoHoje)
    if (!produtoDia || Number(produtoDia.estoque || 0) <= 0) {
      setErro('Produto fora de estoque.')
      return
    }
    if (Number(item.quantidade || 0) >= Number(produtoDia.estoque || 0)) {
      setErro('Não há quantidade suficiente disponível para este item.')
      return
    }
    setErro('')
    adicionarAoCarrinho(produtoDia)
  }

  if (pedidoFeito) {
    return (
      <>
        {mostrarConfetti && <Confetti />}
        <Layout titulo="Pedido Confirmado!">
          <div style={s.sucesso}>
            <div style={s.sucessoIcon}><CheckCircle size={48} color="#22C55E" strokeWidth={1.5} /></div>
            <h2 style={s.sucessoTitulo}>Pedido {codigoPedidoBase(pedidoFeito)} realizado!</h2>
            <p style={s.sucessoSub}>
              Retire seu pedido hoje às <strong>{pedidoFeito.horarioRetirada}</strong>
            </p>
            <div style={s.pagInfoBox}>
              <p style={s.pagInfoTitulo}>Pagamento na retirada</p>
              <p style={s.pagInfoMetodo}>{pedidoFeito.pagamento}</p>
              <p style={s.pagInfoValor}>R$ {pedidoFeito.total.toFixed(2).replace('.', ',')}</p>
            </div>
            <div style={{ background: '#FEF3C7', borderRadius: 10, padding: '0.65rem 0.9rem', marginBottom: 16 }}>
              <p style={{ color: '#B45309', fontSize: '0.82rem', fontWeight: 700, margin: 0 }}>⏱️ A partir do horário de retirada, você tem <strong>10 minutos</strong> para retirar ou o pedido será cancelado automaticamente.</p>
            </div>
            <div style={s.sucessoBtns}>
              <AtendimentoPedido pedido={pedidoFeito} />
              <button style={s.btnPrimario} onClick={() => navigate('/aluno/pedidos')}>Ver meu pedido</button>
              <button style={s.btnSecundario} onClick={() => navigate('/aluno/cardapio')}>Voltar ao cardápio</button>
            </div>
          </div>
        </Layout>
      </>
    )
  }

  if (carrinho.length === 0) {
    return (
      <Layout titulo="Carrinho">
        <div style={s.vazio}>
          <ShoppingCart size={52} strokeWidth={1.2} color="#CBD5E1" />
          <p style={{ color: '#94A3B8', marginTop: 12 }}>Seu carrinho está vazio.</p>
          <button style={{ ...s.btnPrimario, marginTop: 16 }} onClick={() => navigate('/aluno/cardapio')}>Ver Cardápio</button>
        </div>
      </Layout>
    )
  }

  return (
    <Layout titulo="Meu Carrinho">
      <div style={{ ...s.layout, gridTemplateColumns: isMobile ? '1fr' : '1fr 340px' }}>
        <div style={s.itens}>
          {carrinho.map(item => (
            <div key={item.id} style={{ ...s.item, flexWrap: isMobile ? 'wrap' : 'nowrap', gap: isMobile ? 8 : 12 }}>
              {/* Foto ou ícone */}
              <div style={{ width: 48, height: 48, borderRadius: 10, background: '#F1F5F9', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {item.foto
                  ? <img src={item.foto} alt={item.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : item.emoji
                    ? <span style={{ fontSize: '1.6rem' }}>{item.emoji}</span>
                    : <Utensils size={18} color="#94A3B8" strokeWidth={1.8} />
                }
              </div>
              <div style={{ ...s.itemInfo, minWidth: 0 }}>
                <strong style={{ fontSize: isMobile ? '0.88rem' : '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.nome}</strong>
                <span style={s.itemPreco}>R$ {item.preco.toFixed(2).replace('.', ',')}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
                <div style={s.qtdControls}>
                  <button style={s.qtdBtn} onClick={() => removerDoCarrinho(item.id)}>−</button>
                  <span style={s.qtd}>{item.quantidade}</span>
                  <button style={s.qtdBtn} onClick={() => adicionarUnidade(item)}>+</button>
                </div>
                <span style={{ ...s.itemTotal, minWidth: isMobile ? 60 : 70, fontSize: isMobile ? '0.88rem' : '1rem' }}>R$ {(item.preco * item.quantidade).toFixed(2).replace('.', ',')}</span>
              </div>
            </div>
          ))}
          <button style={s.btnLimpar} onClick={limparCarrinho}>Limpar carrinho</button>
        </div>

        <div style={s.resumo}>
          <h3 style={s.resumoTitulo}>Resumo do Pedido</h3>

          {/* Horário */}
          <div style={s.campo}>
            <label style={s.label}>Horário de retirada</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: horarioCustom ? 8 : 0 }}>
              {HORARIOS_SUGERIDOS.map(h => {
                const ativo = !horarioCustom && horario === h
                return (
                  <button key={h} type="button"
                    style={{
                      padding: '0.38rem 0.72rem', borderRadius: 20, cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem', fontFamily: 'inherit',
                      border: `2px solid ${ativo ? '#003D7C' : '#E2E8F0'}`,
                      background: ativo ? '#003D7C' : '#fff',
                      color: ativo ? '#fff' : '#64748B',
                    }}
                    onClick={() => { setHorario(h); setHorarioCustom(false) }}>
                    {h}
                  </button>
                )
              })}
              <button type="button"
                style={{
                  padding: '0.38rem 0.72rem', borderRadius: 20, cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem', fontFamily: 'inherit',
                  border: `2px solid ${horarioCustom ? '#F47920' : '#E2E8F0'}`,
                  background: horarioCustom ? '#FFF7ED' : '#fff',
                  color: horarioCustom ? '#F47920' : '#64748B',
                }}
                onClick={() => { setHorarioCustom(true); setHorario('') }}>
                ✏️ Outro
              </button>
            </div>
            {horarioCustom && (
              <input
                type="time"
                style={{ ...s.select, marginTop: 4, width: '100%', boxSizing: 'border-box' }}
                value={horario}
                onChange={e => setHorario(e.target.value)}
                placeholder="HH:MM"
              />
            )}
            {horario && (
              <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ background: '#E8F0FB', color: '#003D7C', padding: '0.25rem 0.75rem', borderRadius: 20, fontWeight: 700, fontSize: '0.82rem' }}>
                  🕐 Retirada hoje às {horario}
                </span>
              </div>
            )}
          </div>

          {/* Pagamento */}
          <div style={s.campo}>
            <label style={s.label}>Forma de pagamento</label>
            <div style={s.pagGrid}>
              {[
                { id: 'PIX',      label: '💰 PIX' },
                { id: 'Crédito',  label: '💳 Crédito' },
                { id: 'Débito',   label: '💳 Débito' },
                { id: 'Dinheiro', label: '💵 Dinheiro' },
                ...(perfilProfessor ? [{ id: 'Conta do Professor', label: 'Conta do Professor' }] : []),
              ].map(op => (
                <button key={op.id}
                  style={{
                    ...s.pagBtn,
                    ...(op.id === 'Conta do Professor' ? s.pagBtnProfessor : {}),
                    ...(pagamento === op.id ? s.pagBtnAtivo : {}),
                  }}
                  onClick={() => setPagamento(op.id)}>
                  {op.label}
                </button>
              ))}
            </div>
            {pagamento === 'Conta do Professor' && (
              <p style={s.avisoContaProfessor}>O pagamento ficará pendente até a conta ser quitada na cantina.</p>
            )}
          </div>

          {/* Aviso dos 10 min */}
          <div style={{ background: '#FEF3C7', borderRadius: 10, padding: '0.6rem 0.85rem', display: 'flex', gap: 7, alignItems: 'flex-start' }}>
            <span style={{ fontSize: '1rem', flexShrink: 0 }}>⏱️</span>
            <p style={{ color: '#B45309', fontSize: '0.78rem', fontWeight: 600, margin: 0, lineHeight: 1.5 }}>
              A partir do <strong>horário de retirada</strong>, você tem <strong>10 minutos</strong> para retirar seu pedido ou ele será cancelado automaticamente.
            </p>
          </div>

          {horario && validarHorarioRetirada(horario, lanchoneteConfig).valido && (
            <div style={s.infoHorario}>
              O tempo do pedido começará a contar a partir do horário selecionado para retirada.
            </div>
          )}

          {erro && <div role="alert" style={s.erro}>{erro}</div>}

          <div style={s.totalLinha}>
            <span>Total</span>
            <strong style={s.totalValor}>R$ {totalCarrinho.toFixed(2).replace('.', ',')}</strong>
          </div>

          <button
            style={{ ...s.btnConfirmar, opacity: enviando || !horario ? 0.7 : 1 }}
            onClick={handleConfirmar}
            disabled={enviando || !horario}>
            {enviando ? 'Enviando...' : 'Confirmar Pedido'}
          </button>
        </div>
      </div>
    </Layout>
  )
}

const s = {
  layout: { display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem', alignItems: 'start' },
  itens: { background: '#fff', borderRadius: 14, padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  item: { display: 'flex', alignItems: 'center', gap: 12, padding: '0.9rem 0', borderBottom: '1px solid #F1F5F9' },
  itemInfo: { flex: 1, display: 'flex', flexDirection: 'column' },
  itemPreco: { color: '#64748B', fontSize: '0.85rem' },
  qtdControls: { display: 'flex', alignItems: 'center', gap: 8 },
  qtdBtn: { width: 28, height: 28, borderRadius: 8, background: '#F1F5F9', fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' },
  qtd: { fontWeight: 700, minWidth: 20, textAlign: 'center' },
  itemTotal: { fontWeight: 700, color: '#003D7C', minWidth: 70, textAlign: 'right' },
  btnLimpar: { marginTop: 12, background: 'none', color: '#EF4444', fontWeight: 600, fontSize: '0.85rem', padding: '0.4rem 0', border: 'none', cursor: 'pointer' },
  resumo: { background: '#fff', borderRadius: 14, padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: '1rem' },
  resumoTitulo: { fontWeight: 800, color: '#1A202C', fontSize: '1rem', margin: 0 },
  campo: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontWeight: 600, fontSize: '0.85rem', color: '#64748B' },
  select: { padding: '0.6rem 0.9rem', borderRadius: 8, border: '2px solid #E2E8F0', fontSize: '0.9rem', width: '100%', boxSizing: 'border-box' },
  pagGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  pagBtn: { padding: '0.65rem 0.5rem', borderRadius: 8, border: '2px solid #E2E8F0', background: '#fff', fontWeight: 600, fontSize: '0.85rem', color: '#64748B', cursor: 'pointer', fontFamily: 'inherit' },
  pagBtnProfessor: { gridColumn: '1 / -1' },
  pagBtnAtivo: { border: '2px solid #003D7C', color: '#003D7C', background: '#E8F0FB' },
  avisoContaProfessor: { margin: '2px 0 0', color: '#92400E', background: '#FEF3C7', borderRadius: 8, padding: '0.55rem 0.7rem', fontSize: '0.78rem', fontWeight: 700, lineHeight: 1.4 },
  totalLinha: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #F1F5F9', paddingTop: 12 },
  totalValor: { color: '#003D7C', fontSize: '1.2rem' },
  btnConfirmar: { background: '#F47920', color: '#fff', padding: '0.85rem', borderRadius: 10, fontWeight: 700, fontSize: '1rem', border: 'none', cursor: 'pointer' },
  infoHorario: { background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', borderRadius: 10, padding: '0.65rem 0.8rem', fontSize: '0.8rem', fontWeight: 700, lineHeight: 1.45 },
  erro: { background: '#FEE2E2', color: '#B91C1C', border: '1px solid #FCA5A5', borderRadius: 10, padding: '0.65rem 0.8rem', fontSize: '0.82rem', fontWeight: 700, lineHeight: 1.45 },
  vazio: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 0' },
  sucesso: { maxWidth: 420, margin: '2rem auto', background: '#fff', borderRadius: 16, padding: '2.5rem 2rem', textAlign: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' },
  sucessoIcon: { fontSize: 56, marginBottom: 12 },
  sucessoTitulo: { color: '#1A202C', fontWeight: 800, marginBottom: 8 },
  sucessoSub: { color: '#64748B', marginBottom: 16 },
  pagInfoBox: { background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 12, padding: '0.85rem 1rem', marginBottom: 16, textAlign: 'center' },
  pagInfoTitulo: { fontSize: '0.78rem', color: '#0369A1', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 },
  pagInfoMetodo: { fontSize: '1.1rem', fontWeight: 800, color: '#003D7C', margin: '0.3rem 0 0.1rem' },
  pagInfoValor: { fontSize: '0.9rem', color: '#64748B', margin: 0 },
  sucessoBtns: { display: 'flex', flexDirection: 'column', gap: 8 },
  btnPrimario: { padding: '0.8rem', borderRadius: 10, background: '#F47920', color: '#fff', fontWeight: 700, fontSize: '0.95rem', border: 'none', cursor: 'pointer' },
  btnSecundario: { padding: '0.8rem', borderRadius: 10, background: '#E8F0FB', color: '#003D7C', fontWeight: 700, fontSize: '0.95rem', border: 'none', cursor: 'pointer' },
}
