import { useEffect, useState } from 'react'
import { MessageCircle, Send } from 'lucide-react'
import { useApp } from '../contexts/AppContext'
import { useToast } from '../contexts/hooks/useToast'

function hora(valor) {
  if (!valor) return ''
  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) return ''
  return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export default function AtendimentoPedido({ pedido, compacto = false }) {
  const {
    getAtendimentoPedido, enviarMensagemPedido, marcarLidoCliente,
  } = useApp()
  const toast = useToast()
  const atendimento = getAtendimentoPedido(pedido?.id)
  const [aberto, setAberto] = useState(false)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (aberto && atendimento?.novaParaCliente) marcarLidoCliente(atendimento).catch(() => {})
  }, [aberto, atendimento, marcarLidoCliente])

  async function enviar() {
    const mensagem = texto.trim()
    if (!mensagem || enviando) return
    setEnviando(true)
    try {
      await enviarMensagemPedido(pedido, mensagem)
      setTexto('')
      setAberto(true)
      toast('Mensagem enviada ao vendedor.', 'success')
    } catch (error) {
      toast(error.message || 'Não foi possível enviar a mensagem.', 'error')
    } finally {
      setEnviando(false)
    }
  }

  if (!pedido?.id) return null
  const mensagens = atendimento?.mensagens || []
  const encerrado = atendimento?.status === 'encerrada'

  return (
    <div style={{ ...s.box, ...(compacto ? s.boxCompacto : {}) }}>
      <button type="button" style={s.toggle} onClick={() => setAberto(v => !v)}>
        <span style={s.toggleLeft}>
          <MessageCircle size={16} />
          Falar com vendedor
          {atendimento?.novaParaCliente && <span style={s.dot}>nova resposta</span>}
        </span>
        <span style={s.toggleStatus}>{atendimento?.status || 'nova conversa'}</span>
      </button>

      {aberto && (
        <div style={s.painel}>
          {mensagens.length === 0 ? (
            <div style={s.vazio}>Envie uma mensagem sobre este pedido.</div>
          ) : (
            <div style={s.mensagens}>
              {mensagens.map(msg => {
                const meu = msg.tipo === 'cliente'
                return (
                  <div key={msg.id} style={{ ...s.msg, ...(meu ? s.msgMinha : s.msgVendedor) }}>
                    <strong>{meu ? 'Você' : 'Vendedor'}</strong>
                    <p>{msg.texto}</p>
                    <span>{hora(msg.criadoEm)}</span>
                  </div>
                )
              })}
            </div>
          )}

          {encerrado ? (
            <div style={s.encerrado}>Atendimento encerrado.</div>
          ) : (
            <div style={s.form}>
              <input
                value={texto}
                onChange={e => setTexto(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') enviar() }}
                placeholder="Digite sua mensagem..."
                style={s.input}
                maxLength={500}
              />
              <button type="button" style={s.enviar} onClick={enviar} disabled={enviando || !texto.trim()}>
                <Send size={15} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const s = {
  box: { marginTop: 12, border: '1px solid #DBEAFE', borderRadius: 12, background: '#F8FBFF', overflow: 'hidden' },
  boxCompacto: { marginTop: 0, flex: 1 },
  toggle: { width: '100%', minHeight: 42, border: 'none', background: '#EFF6FF', color: '#003D7C', padding: '0.55rem 0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 900 },
  toggleLeft: { display: 'inline-flex', alignItems: 'center', gap: 7, minWidth: 0, flexWrap: 'wrap' },
  toggleStatus: { color: '#64748B', fontSize: '0.72rem', fontWeight: 800, whiteSpace: 'nowrap' },
  dot: { background: '#F47920', color: '#fff', borderRadius: 999, padding: '0.12rem 0.45rem', fontSize: '0.66rem', fontWeight: 900 },
  painel: { padding: 10, display: 'flex', flexDirection: 'column', gap: 10 },
  vazio: { color: '#64748B', background: '#fff', borderRadius: 10, padding: '0.8rem', fontSize: '0.82rem', textAlign: 'center', fontWeight: 700 },
  mensagens: { display: 'flex', flexDirection: 'column', gap: 7, maxHeight: 260, overflowY: 'auto' },
  msg: { maxWidth: '88%', borderRadius: 10, padding: '0.55rem 0.7rem', fontSize: '0.8rem', lineHeight: 1.35 },
  msgMinha: { alignSelf: 'flex-end', background: '#003D7C', color: '#fff' },
  msgVendedor: { alignSelf: 'flex-start', background: '#fff', color: '#0F172A', border: '1px solid #E2E8F0' },
  form: { display: 'flex', gap: 7 },
  input: { flex: 1, minWidth: 0, minHeight: 40, border: '1px solid #CBD5E1', borderRadius: 10, padding: '0 0.75rem', fontFamily: 'inherit', fontWeight: 700, outlineColor: '#003D7C' },
  enviar: { width: 42, border: 'none', borderRadius: 10, background: '#F47920', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  encerrado: { background: '#F1F5F9', color: '#64748B', borderRadius: 10, padding: '0.65rem 0.8rem', fontSize: '0.8rem', fontWeight: 800, textAlign: 'center' },
}
