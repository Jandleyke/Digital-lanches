import { useState, useEffect } from 'react'
import { useApp } from '../contexts/AppContext'
import { codigoPedido, compararPedidosFila } from '../utils/pedidos'
import { useIsMobile } from '../utils/useIsMobile'

export default function Painel() {
  const { pedidos } = useApp()
  const isMobile = useIsMobile()
  const [hora, setHora] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setHora(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const prontos = pedidos.filter(p => p.status === 'Pronto' && !p.retiradoEm).sort(compararPedidosFila)
  const recentes = pedidos.filter(p => p.status === 'Entregue').slice(0, 5)

  const horaStr = hora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const dataStr = hora.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={{ ...s.header, ...(isMobile ? s.headerMobile : {}) }}>
        <div style={s.logo}>🍔 Digital Lanche</div>
        <div style={s.relogio}>
          <div style={{ ...s.hora, ...(isMobile ? s.horaMobile : {}) }}>{horaStr}</div>
          <div style={s.data}>{dataStr}</div>
        </div>
      </div>

      <div style={{ ...s.corpo, ...(isMobile ? s.corpoMobile : {}) }}>
        {/* Coluna principal — prontos */}
        <div style={s.colPrincipal}>
          <div style={s.secaoTitulo}>
            <span style={s.tituloIcon}>🔔</span>
            <span>RETIRE SEU PEDIDO</span>
            <span style={s.contadorBadge}>{prontos.length}</span>
          </div>

          {prontos.length === 0 ? (
            <div style={s.vazio}>
              <div style={{ fontSize: '4rem', marginBottom: 12 }}>🍽️</div>
              <p style={{ color: '#475569', fontSize: '1.2rem' }}>Nenhum pedido pronto no momento</p>
            </div>
          ) : (
            <div style={{ ...s.cardsGrid, ...(isMobile ? s.cardsGridMobile : {}) }}>
              {prontos.map(p => (
                <div key={p.id} style={s.cardPronto}>
                  <div style={s.numeroGrande}>{codigoPedido(p)}</div>
                  <div style={s.alunoNome}>{p.aluno}</div>
                  <div style={s.retiradaInfo}>🕐 Retirada: {p.horarioRetirada}</div>
                  <div style={s.prontoBadge}>PRONTO ✓</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Coluna lateral — histórico recente */}
        <div style={{ ...s.colLateral, ...(isMobile ? s.colLateralMobile : {}) }}>
          <div style={{ ...s.secaoTitulo, fontSize: '1rem' }}>
            <span>📦</span>
            <span>Últimos entregues</span>
          </div>
          {recentes.length === 0 ? (
            <p style={{ color: '#475569', fontSize: '0.9rem', textAlign: 'center', marginTop: 16 }}>Nenhuma entrega ainda</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recentes.map(p => (
                <div key={p.id} style={s.cardEntregue}>
                  <span style={s.numEntregue}>{codigoPedido(p)}</span>
                  <span style={s.nomeEntregue}>{p.aluno}</span>
                  <span style={s.entregueTag}>✓</span>
                </div>
              ))}
            </div>
          )}

          <div style={s.infoBox}>
            <p style={{ fontWeight: 700, marginBottom: 4, color: '#94A3B8', fontSize: '0.8rem' }}>COMO RETIRAR</p>
            <p style={{ color: '#64748B', fontSize: '0.82rem', lineHeight: 1.6 }}>
              1. Aguarde seu número aparecer nesta tela<br/>
              2. Dirija-se ao balcão<br/>
              3. Informe sua matrícula no balcão
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

const s = {
  page: { minHeight: '100vh', background: '#0F172A', color: '#F1F5F9', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem 2rem', borderBottom: '1px solid #1E293B' },
  headerMobile: { padding: '1rem', flexWrap: 'wrap', gap: 8, paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))' },
  logo: { fontSize: '1.5rem', fontWeight: 800, color: '#F47920' },
  relogio: { textAlign: 'right' },
  hora: { fontSize: '2rem', fontWeight: 800, fontFamily: 'monospace', color: '#F1F5F9' },
  horaMobile: { fontSize: '1.3rem' },
  data: { fontSize: '0.85rem', color: '#64748B', textTransform: 'capitalize' },
  corpo: { display: 'flex', flex: 1, gap: '1.5rem', padding: '1.5rem 2rem' },
  corpoMobile: { flexDirection: 'column', gap: '1.25rem', padding: '1rem', paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))' },
  colPrincipal: { flex: 1, minWidth: 0 },
  colLateral: { width: 280, display: 'flex', flexDirection: 'column', gap: '1rem' },
  colLateralMobile: { width: '100%' },
  secaoTitulo: { display: 'flex', alignItems: 'center', gap: 10, fontSize: '1.3rem', fontWeight: 800, color: '#22C55E', marginBottom: '1.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' },
  tituloIcon: { fontSize: '1.5rem' },
  contadorBadge: { background: '#22C55E', color: '#fff', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.95rem', fontWeight: 800 },
  vazio: { textAlign: 'center', padding: '4rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  cardsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' },
  cardsGridMobile: { gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.75rem' },
  cardPronto: {
    background: 'linear-gradient(135deg, #064E3B, #065F46)',
    border: '2px solid #22C55E',
    borderRadius: 16, padding: '1.5rem',
    textAlign: 'center',
    boxShadow: '0 0 24px rgba(34,197,94,0.3)',
    animation: 'pulse 2s infinite',
  },
  numeroGrande: { fontSize: '2.5rem', fontWeight: 900, color: '#fff', letterSpacing: '0.05em', marginBottom: 8 },
  alunoNome: { fontSize: '1rem', fontWeight: 600, color: '#D1FAE5', marginBottom: 6 },
  retiradaInfo: { fontSize: '0.82rem', color: '#6EE7B7', marginBottom: 12 },
  prontoBadge: { background: '#22C55E', color: '#fff', padding: '0.4rem 1rem', borderRadius: 20, fontWeight: 800, fontSize: '0.88rem', display: 'inline-block' },
  cardEntregue: { display: 'flex', alignItems: 'center', gap: 10, background: '#1E293B', borderRadius: 10, padding: '0.65rem 1rem' },
  numEntregue: { fontWeight: 700, color: '#94A3B8', fontFamily: 'monospace', fontSize: '0.9rem' },
  nomeEntregue: { flex: 1, fontSize: '0.88rem', color: '#CBD5E1' },
  entregueTag: { color: '#22C55E', fontWeight: 700 },
  infoBox: { background: '#1E293B', borderRadius: 12, padding: '1rem', marginTop: 'auto' },
}
