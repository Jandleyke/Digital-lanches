import { useState, useEffect, useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout'
import EmptyState from '../../components/EmptyState'
import { useApp } from '../../contexts/AppContext'
import { STATUS_COR } from '../../utils/statusColors'
import { formatPrice } from '../../utils/formatters'
import { useIsMobile } from '../../utils/useIsMobile'
import { Package, ClipboardList, QrCode } from 'lucide-react'

const statusPasso = ['Recebido', 'Pronto', 'Entregue']
const LIMITE_MS = 10 * 60 * 1000
const JANELA_CANCELAMENTO_MS = 10 * 60 * 1000

function CancelamentoTimer({ pedido }) {
  const cancelavelAte = pedido.cancelavelAte || (pedido.criadoEm ? pedido.criadoEm + JANELA_CANCELAMENTO_MS : null)
  const [restante, setRestante] = useState(() => Math.max(0, Number(cancelavelAte || 0) - Date.now()))

  useEffect(() => {
    if (!cancelavelAte) return
    const id = setInterval(() => {
      setRestante(Math.max(0, Number(cancelavelAte) - Date.now()))
    }, 1000)
    return () => clearInterval(id)
  }, [cancelavelAte])

  if (!cancelavelAte || restante <= 0) return null
  const min = Math.floor(restante / 60000)
  const seg = Math.floor((restante % 60000) / 1000)
  const urgente = restante <= 60 * 1000

  return (
    <div style={{
      background: urgente ? '#FEE2E2' : '#EFF6FF',
      color: urgente ? '#B91C1C' : '#1D4ED8',
      border: `1.5px solid ${urgente ? '#FCA5A5' : '#BFDBFE'}`,
      padding: '0.5rem 0.85rem',
      borderRadius: 8,
      fontWeight: 700,
      fontSize: '0.82rem',
      marginBottom: '0.75rem',
      textAlign: 'center',
    }}>
      Pedido em processo: cancelamento disponivel por{' '}
      <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
        {min}:{String(seg).padStart(2, '0')}
      </strong>
    </div>
  )
}

function CountdownTimer({ prontoEm }) {
  const [restante, setRestante] = useState(() => Math.max(0, LIMITE_MS - (Date.now() - prontoEm)))

  useEffect(() => {
    const id = setInterval(() => {
      setRestante(Math.max(0, LIMITE_MS - (Date.now() - prontoEm)))
    }, 1000)
    return () => clearInterval(id)
  }, [prontoEm])

  if (restante <= 0) return null
  const min = Math.floor(restante / 60000)
  const seg = Math.floor((restante % 60000) / 1000)
  const urgente = restante < 2 * 60 * 1000

  return (
    <div style={{
      background: urgente ? '#FEE2E2' : '#FEF3C7',
      color: urgente ? '#DC2626' : '#B45309',
      border: `1.5px solid ${urgente ? '#FCA5A5' : '#FCD34D'}`,
      padding: '0.6rem 1rem', borderRadius: 8, fontWeight: 700,
      fontSize: '0.85rem', textAlign: 'center', marginBottom: '0.85rem',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
    }}>
      {urgente ? '🚨' : '⏱️'}
      {urgente ? 'CORRA! Retire em ' : 'Retire em '}
      <strong style={{ fontVariantNumeric: 'tabular-nums', fontSize: '1rem' }}>
        {min}:{String(seg).padStart(2, '0')}
      </strong>
      {urgente ? ' ou será cancelado!' : ' — cancelamento automático'}
    </div>
  )
}

function ModalCancelar({ pedido, onConfirmar, onFechar }) {
  const [motivo, setMotivo] = useState('')
  const [carregando, setCarregando] = useState(false)
  async function confirmar() {
    setCarregando(true)
    await onConfirmar(pedido.id, motivo)
    setCarregando(false)
    onFechar()
  }
  return (
    <div style={s.overlay}>
      <div style={s.overlayBox}>
        <h3 style={{ fontWeight: 800, color: '#1A202C', marginBottom: 8 }}>Cancelar pedido?</h3>
        <p style={{ color: '#64748B', fontSize: '0.88rem', marginBottom: '1rem' }}>
          Pedido #{pedido.id.slice(-8)} será cancelado e o estoque devolvido.
        </p>
        <label style={s.label}>Motivo (opcional)</label>
        <textarea
          style={{ ...s.input, minHeight: 72, resize: 'vertical' }}
          placeholder="Ex: desisti do pedido, errei o item..."
          value={motivo} onChange={e => setMotivo(e.target.value)}
        />
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button style={s.btnSecundario} onClick={onFechar}>Voltar</button>
          <button style={{ ...s.btnPerigo, opacity: carregando ? 0.7 : 1 }} onClick={confirmar} disabled={carregando}>
            {carregando ? 'Cancelando...' : 'Confirmar cancelamento'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Pedidos() {
  const { pedidos, usuarioLogado, cancelarPedido, produtos, carrinho, adicionarAoCarrinho, avaliarPedido } = useApp()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [aba, setAba] = useState('ativos')
  const [qrAberto, setQrAberto] = useState(null)
  const [cancelando, setCancelando] = useState(null)
  const [avaliando, setAvaliando] = useState({})
  const [msgAvaliacao, setMsgAvaliacao] = useState({})

  const meusPedidos = pedidos.filter(p => p.matricula === usuarioLogado?.matricula)
  const ativos = meusPedidos.filter(p => p.status !== 'Entregue' && p.status !== 'Cancelado')
  const historico = meusPedidos.filter(p => p.status === 'Entregue' || p.status === 'Cancelado')

  const lista = aba === 'ativos' ? ativos : historico

  // refs para que o interval acesse sempre os valores mais recentes sem re-criar
  const ativosRef = useRef(ativos)
  const cancelarRef = useRef(cancelarPedido)
  useEffect(() => {
    ativosRef.current = ativos
    cancelarRef.current = cancelarPedido
  })

  // auto-cancelamento a cada 5 segundos
  useEffect(() => {
    const id = setInterval(() => {
      ativosRef.current.forEach(pedido => {
        const cancelavelAte = pedido.cancelavelAte || (pedido.criadoEm ? pedido.criadoEm + JANELA_CANCELAMENTO_MS : null)
        if (pedido.status === 'Recebido' && cancelavelAte && Date.now() >= cancelavelAte) {
          cancelarRef.current(pedido.id, 'Tempo de cancelamento expirado - cancelamento automatico')
          return
        }
        if (pedido.status === 'Pronto' && pedido.prontoEm) {
          if (Date.now() - pedido.prontoEm >= LIMITE_MS) {
            cancelarRef.current(pedido.id, 'Não retirado em 10 minutos — cancelamento automático')
          }
        }
      })
    }, 5000)
    return () => clearInterval(id)
  }, [])

  function pedirNovamente(pedido) {
    const indisponiveis = []
    pedido.itens.forEach(item => {
      const prod = produtos.find(p => p.id === item.produtoId)
      if (!prod || !prod.disponivel || prod.estoque <= 0) { indisponiveis.push(item.nome); return }
      const jaNoCarrinho = carrinho.find(i => i.id === prod.id)?.quantidade || 0
      const podeAdicionar = Math.max(0, Math.min(item.quantidade, prod.estoque - jaNoCarrinho))
      for (let i = 0; i < podeAdicionar; i++) adicionarAoCarrinho(prod)
      if (podeAdicionar < item.quantidade) indisponiveis.push(item.nome)
    })
    if (indisponiveis.length) {
      alert(`Alguns itens não puderam ser adicionados por falta de estoque: ${indisponiveis.join(', ')}`)
    }
    navigate('/aluno/carrinho')
  }

  function setAvaliacaoCampo(pedidoId, campo, valor) {
    setAvaliando(prev => ({
      ...prev,
      [pedidoId]: { nota: 5, comentario: '', ...(prev[pedidoId] || {}), [campo]: valor },
    }))
    setMsgAvaliacao(prev => ({ ...prev, [pedidoId]: null }))
  }

  async function enviarAvaliacao(pedido) {
    const draft = avaliando[pedido.id] || {}
    if (!draft.nota) {
      setMsgAvaliacao(prev => ({ ...prev, [pedido.id]: 'Escolha uma nota.' }))
      return
    }
    const res = await avaliarPedido(pedido, draft.nota, draft.comentario || '')
    setMsgAvaliacao(prev => ({
      ...prev,
      [pedido.id]: res?.erro || 'Avaliacao salva. Obrigado!',
    }))
  }

  return (
    <Layout titulo="Meus Pedidos">
      {cancelando && (
        <ModalCancelar pedido={cancelando} onConfirmar={cancelarPedido} onFechar={() => setCancelando(null)} />
      )}

      {/* Abas */}
      <div style={s.abas}>
        <button style={{ ...s.aba, ...(aba === 'ativos' ? s.abaAtiva : {}) }} onClick={() => setAba('ativos')}>
          Ativos
          {ativos.length > 0 && <span style={s.abaBadge}>{ativos.length}</span>}
        </button>
        <button style={{ ...s.aba, ...(aba === 'historico' ? s.abaAtiva : {}) }} onClick={() => setAba('historico')}>
          Histórico
          {historico.length > 0 && <span style={{ ...s.abaBadge, background: '#94A3B8' }}>{historico.length}</span>}
        </button>
      </div>

      {lista.length === 0 && (
        <EmptyState
          icon={aba === 'ativos' ? Package : ClipboardList}
          mensagem={aba === 'ativos' ? 'Nenhum pedido ativo no momento.' : 'Nenhum pedido no histórico ainda.'}
          acao={aba === 'ativos' ? 'Ver Cardápio' : undefined}
          onAcao={() => navigate('/aluno/cardapio')}
        />
      )}

      <div style={{ ...s.lista, gap: isMobile ? '0.6rem' : '1rem' }}>
        {/* ── Pedidos ativos ─────────────────────────────────────────────── */}
        {aba === 'ativos' && ativos.map(pedido => {
          const passoAtual = statusPasso.indexOf(pedido.status)
          const pronto = pedido.status === 'Pronto'
          const sc = STATUS_COR[pedido.status] || {}
          return (
            <div key={pedido.id} style={{ ...s.card, ...(pronto ? s.cardPronto : {}), padding: isMobile ? '0.85rem' : '1.25rem' }}>
              {pronto && <div style={s.prontoAlert}>🎉 Seu pedido está PRONTO! Vá retirar no balcão!</div>}

              {/* Countdown de retirada */}
              {pronto && pedido.prontoEm && (
                <CountdownTimer prontoEm={pedido.prontoEm} />
              )}
              {pedido.status === 'Recebido' && <CancelamentoTimer pedido={pedido} />}

              <div style={s.cardTop}>
                <div>
                  <strong style={s.pedidoId}>Pedido #{pedido.id.slice(-8)}</strong>
                  <span style={s.horario}>Retirada: {pedido.horarioRetirada}</span>
                </div>
                <span style={{ ...s.badge, background: sc.bg, color: sc.color }}>{pedido.status}</span>
              </div>

              {/* Progresso */}
              <div style={s.steps}>
                {statusPasso.map((step, i) => (
                  <div key={step} style={s.stepItem}>
                    <div style={{ ...s.stepCircle, ...(i <= passoAtual ? s.stepAtivo : {}), width: isMobile ? 26 : 28, height: isMobile ? 26 : 28, fontSize: isMobile ? '0.72rem' : '0.8rem' }}>
                      {i < passoAtual ? '✓' : i + 1}
                    </div>
                    <span style={{ ...s.stepLabel, fontSize: isMobile ? '0.7rem' : '0.68rem', ...(i <= passoAtual ? { color: '#003D7C', fontWeight: 600 } : {}) }}>
                      {step}
                    </span>
                    {i < statusPasso.length - 1 && (
                      <div style={{ ...s.stepLinha, ...(i < passoAtual ? s.stepLinhaAtiva : {}) }} />
                    )}
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: '0.75rem' }}>
                {pedido.itens.map((item, i) => {
                  const prod = produtos.find(p => p.id === item.produtoId)
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#F8FAFC', borderRadius: 10, padding: '5px 10px 5px 5px', border: '1px solid #E2E8F0' }}>
                      <div style={{ width: 34, height: 34, borderRadius: 8, background: '#E8F0FB', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {prod?.foto
                          ? <img src={prod.foto} alt={item.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <span style={{ fontSize: '1.2rem' }}>{prod?.emoji || '🍴'}</span>
                        }
                      </div>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>{item.quantidade}× {item.nome}</span>
                    </div>
                  )
                })}
              </div>

              <div style={{ ...s.cardBottom, flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 10 : 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: isMobile ? '100%' : 'auto' }}>
                  <span style={s.pagamento}>{pedido.pagamento} · {pedido.pago ? 'Pago' : 'Pagar na retirada'}</span>
                  <strong style={s.total}>{formatPrice(pedido.total)}</strong>
                </div>
                <div style={{ display: 'flex', gap: 8, width: isMobile ? '100%' : 'auto' }}>
                  {pedido.status === 'Recebido' && (
                    <button style={{ ...s.cancelBtn, flex: isMobile ? 1 : 'none' }} onClick={() => setCancelando(pedido)}>✕ Cancelar</button>
                  )}
                  <button style={{ ...s.qrBtn, flex: isMobile ? 1 : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }} onClick={() => setQrAberto(qrAberto === pedido.id ? null : pedido.id)}>
                    <QrCode size={14} strokeWidth={2} />
                    {qrAberto === pedido.id ? 'Fechar' : 'QR Code'}
                  </button>
                </div>
              </div>

              {qrAberto === pedido.id && (
                <div style={s.qrBox}>
                  <p style={s.qrTitulo}>Mostre este código ao retirar</p>
                  <div style={s.qrWrap}>
                    <QRCodeSVG value={`SENAC-LANCHES:${pedido.id}`} size={160} bgColor="#fff" fgColor="#003D7C" level="M" />
                  </div>
                  <p style={s.qrId}>#{pedido.id.slice(-8)}</p>
                </div>
              )}
            </div>
          )
        })}

        {/* ── Histórico ──────────────────────────────────────────────────── */}
        {aba === 'historico' && historico.map(pedido => {
          const sc = STATUS_COR[pedido.status] || {}
          return (
            <div key={pedido.id} style={{ ...s.cardHist, padding: isMobile ? '0.75rem 0.85rem' : '1rem 1.25rem' }}>
              <div style={s.histTop}>
                <div>
                  <strong style={{ fontSize: '0.9rem', color: '#1A202C' }}>Pedido #{pedido.id.slice(-8)}</strong>
                  <span style={{ display: 'block', fontSize: '0.78rem', color: '#94A3B8', marginTop: 2 }}>
                    {pedido.horarioPedido}
                    {pedido.status === 'Cancelado' && pedido.motivoCancelamento
                      ? ` · ${pedido.motivoCancelamento}`
                      : ''}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ ...s.badge, background: sc.bg, color: sc.color }}>{pedido.status}</span>
                  <strong style={{ display: 'block', color: '#003D7C', marginTop: 4 }}>{formatPrice(pedido.total)}</strong>
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: '0.5rem' }}>
                {pedido.itens.map((item, i) => {
                  const prod = produtos.find(p => p.id === item.produtoId)
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#F8FAFC', borderRadius: 10, padding: '4px 8px 4px 4px', border: '1px solid #E2E8F0' }}>
                      <div style={{ width: 28, height: 28, borderRadius: 7, background: '#E8F0FB', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {prod?.foto
                          ? <img src={prod.foto} alt={item.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <span style={{ fontSize: '1rem' }}>{prod?.emoji || '🍴'}</span>
                        }
                      </div>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>{item.quantidade}× {item.nome}</span>
                    </div>
                  )
                })}
              </div>

              {pedido.status === 'Entregue' && (
                <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', gap: 10, marginTop: 10, paddingTop: 10, borderTop: '1px solid #F1F5F9' }}>
                  <div style={s.avaliacaoBox}>
                    {pedido.avaliacao ? (
                      <div style={s.avaliacaoSalva}>
                        <span>Sua avaliação: {'⭐'.repeat(pedido.avaliacao)}{'☆'.repeat(5 - pedido.avaliacao)}</span>
                        {pedido.comentarioAvaliacao && <p style={s.comentarioSalvo}>{pedido.comentarioAvaliacao}</p>}
                      </div>
                    ) : (
                      <>
                        <span style={s.avaliacaoTitulo}>Como foi seu lanche?</span>
                        <div style={s.estrelas}>
                          {[1, 2, 3, 4, 5].map(n => {
                            const nota = avaliando[pedido.id]?.nota || 0
                            return (
                              <button key={n} type="button" onClick={() => setAvaliacaoCampo(pedido.id, 'nota', n)}
                                style={{ ...s.estrelaBtn, color: n <= nota ? '#F59E0B' : '#CBD5E1' }}
                                title={`Avaliar com ${n} estrela${n > 1 ? 's' : ''}`}>
                                ★
                              </button>
                            )
                          })}
                        </div>
                        <textarea
                          style={s.comentarioInput}
                          value={avaliando[pedido.id]?.comentario || ''}
                          onChange={e => setAvaliacaoCampo(pedido.id, 'comentario', e.target.value)}
                          placeholder="Conte rapidinho: estava gostoso? chegou quente? vale a pena?"
                          maxLength={280}
                        />
                        {msgAvaliacao[pedido.id] && <span style={s.msgAvaliacao}>{msgAvaliacao[pedido.id]}</span>}
                        <button type="button" style={s.salvarAvaliacaoBtn} onClick={() => enviarAvaliacao(pedido)}>
                          Enviar avaliação
                        </button>
                      </>
                    )}
                  </div>
                  <button style={{ ...s.qrBtn, alignSelf: isMobile ? 'stretch' : 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                    onClick={() => pedirNovamente(pedido)}>
                    🔁 Pedir de novo
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Layout>
  )
}

const s = {
  abas: { display: 'flex', gap: 0, marginBottom: '1rem', borderBottom: '2px solid #E2E8F0' },
  aba: { padding: '0.6rem 1.4rem', background: 'none', color: '#64748B', fontWeight: 600, fontSize: '0.9rem', borderBottom: '2px solid transparent', marginBottom: -2, display: 'flex', alignItems: 'center', gap: 7, border: 'none', cursor: 'pointer' },
  abaAtiva: { color: '#003D7C', borderBottom: '2px solid #003D7C', fontWeight: 700 },
  abaBadge: { background: '#003D7C', color: '#fff', borderRadius: '50%', width: 20, height: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800 },
  lista: { display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 680 },
  card: { background: '#fff', borderRadius: 14, padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', overflow: 'hidden' },
  cardPronto: { border: '2px solid #22C55E', boxShadow: '0 4px 20px rgba(34,197,94,0.2)' },
  cardHist: { background: '#fff', borderRadius: 12, padding: '1rem 1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  prontoAlert: { background: '#D1FAE5', color: '#065F46', fontWeight: 700, fontSize: '0.88rem', padding: '0.6rem 1rem', borderRadius: 8, marginBottom: '0.75rem', textAlign: 'center' },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' },
  histTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.6rem' },
  pedidoId: { display: 'block', fontSize: '1rem', color: '#1A202C' },
  horario: { display: 'block', fontSize: '0.82rem', color: '#64748B', marginTop: 2 },
  badge: { padding: '0.3rem 0.9rem', borderRadius: 20, fontWeight: 700, fontSize: '0.8rem', whiteSpace: 'nowrap' },
  steps: { display: 'flex', alignItems: 'center', marginBottom: '1rem' },
  stepItem: { display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, position: 'relative' },
  stepCircle: { width: 28, height: 28, borderRadius: '50%', background: '#E2E8F0', color: '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem', zIndex: 1 },
  stepAtivo: { background: '#003D7C', color: '#fff' },
  stepLabel: { fontSize: '0.68rem', color: '#94A3B8', marginTop: 4, textAlign: 'center' },
  stepLinha: { position: 'absolute', top: 14, left: '50%', width: '100%', height: 2, background: '#E2E8F0', zIndex: 0 },
  stepLinhaAtiva: { background: '#003D7C' },
  itensList: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: '0.75rem' },
  itemTag: { background: '#F5F7FA', padding: '0.3rem 0.8rem', borderRadius: 20, fontSize: '0.8rem', color: '#475569' },
  cardBottom: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.75rem', borderTop: '1px solid #F1F5F9', flexWrap: 'wrap', gap: 8 },
  pagamento: { display: 'block', fontSize: '0.82rem', color: '#64748B', marginBottom: 2 },
  total: { color: '#003D7C', fontSize: '1rem' },
  cancelBtn: { background: '#FEE2E2', color: '#DC2626', padding: '0.5rem 1rem', borderRadius: 10, fontWeight: 700, fontSize: '0.82rem', border: 'none', cursor: 'pointer' },
  qrBtn: { background: '#E8F0FB', color: '#003D7C', padding: '0.5rem 1rem', borderRadius: 10, fontWeight: 700, fontSize: '0.82rem', border: 'none', cursor: 'pointer' },
  qrBox: { marginTop: '1rem', padding: '1rem', background: '#F8FAFC', borderRadius: 12, textAlign: 'center', borderTop: '1px solid #E2E8F0' },
  qrTitulo: { fontWeight: 600, color: '#475569', fontSize: '0.85rem', marginBottom: '0.75rem' },
  qrWrap: { display: 'inline-block', padding: 12, background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  qrId: { marginTop: 8, fontFamily: 'monospace', color: '#94A3B8', fontSize: '0.78rem' },
  avaliacaoBox: { display: 'flex', flexDirection: 'column', gap: 7, flex: 1, minWidth: 220 },
  avaliacaoTitulo: { fontSize: '0.82rem', color: '#475569', fontWeight: 800 },
  estrelas: { display: 'flex', gap: 3 },
  estrelaBtn: { background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.35rem', lineHeight: 1, padding: 0 },
  comentarioInput: { width: '100%', minHeight: 64, border: '1.5px solid #E2E8F0', borderRadius: 10, padding: '0.55rem 0.7rem', fontFamily: 'inherit', fontSize: '0.82rem', resize: 'vertical', boxSizing: 'border-box' },
  salvarAvaliacaoBtn: { alignSelf: 'flex-start', background: '#003D7C', color: '#fff', border: 'none', borderRadius: 10, padding: '0.5rem 0.85rem', fontWeight: 800, cursor: 'pointer', fontSize: '0.82rem' },
  avaliacaoSalva: { fontSize: '0.82rem', color: '#64748B', fontWeight: 700 },
  comentarioSalvo: { margin: '0.35rem 0 0', color: '#475569', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '0.55rem 0.7rem', lineHeight: 1.4 },
  msgAvaliacao: { color: '#1D4ED8', fontSize: '0.78rem', fontWeight: 700 },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem' },
  overlayBox: { background: '#fff', borderRadius: 16, padding: '1.5rem', width: '100%', maxWidth: 400 },
  label: { fontWeight: 600, fontSize: '0.82rem', color: '#64748B', display: 'block', marginBottom: 5 },
  input: { width: '100%', padding: '0.65rem 0.9rem', border: '2px solid #E2E8F0', borderRadius: 8, fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box' },
  btnSecundario: { padding: '0.6rem 1.2rem', borderRadius: 8, background: '#F1F5F9', color: '#64748B', fontWeight: 600, border: 'none', cursor: 'pointer' },
  btnPerigo: { padding: '0.6rem 1.2rem', borderRadius: 8, background: '#EF4444', color: '#fff', fontWeight: 700, border: 'none', cursor: 'pointer' },
}
