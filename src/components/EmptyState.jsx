import { Package } from 'lucide-react'

export default function EmptyState({ icon: Icon = Package, mensagem = 'Nenhum item encontrado.', acao, onAcao }) {
  return (
    <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: '#94A3B8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <Icon size={56} strokeWidth={1.2} color="#CBD5E1" />
      <p style={{ fontSize: '0.95rem', maxWidth: 280 }}>{mensagem}</p>
      {acao && onAcao && (
        <button onClick={onAcao} style={{ marginTop: 6, background: '#003D7C', color: '#fff', padding: '0.55rem 1.4rem', borderRadius: 10, fontWeight: 700, fontSize: '0.88rem', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
          {acao}
        </button>
      )}
    </div>
  )
}
