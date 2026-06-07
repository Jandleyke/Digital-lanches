import { useState } from 'react'
import { useApp } from '../contexts/AppContext'

const TIPO_ESTILO = {
  info:      { bg: '#DBEAFE', border: '#93C5FD', color: '#1D4ED8', icon: '📢' },
  promo:     { bg: '#FEF3C7', border: '#FCD34D', color: '#B45309', icon: '🎉' },
  aviso:     { bg: '#FEE2E2', border: '#FCA5A5', color: '#DC2626', icon: '⚠️' },
  novidade:  { bg: '#F0FDF4', border: '#86EFAC', color: '#15803D', icon: '✨' },
}

export default function AvisosBanner({ perfil }) {
  const { avisos } = useApp()
  const [fechados, setFechados] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('avisosFechados') || '[]') } catch { return [] }
  })

  const visiveis = avisos.filter(av => {
    if (fechados.includes(av.id)) return false
    const dest = av.destinatario || 'todos'
    return dest === 'todos' || dest === perfil
  })

  if (visiveis.length === 0) return null

  function fechar(id) {
    const novos = [...fechados, id]
    setFechados(novos)
    try { sessionStorage.setItem('avisosFechados', JSON.stringify(novos)) } catch { /* armazenamento indisponível */ }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: '0.75rem' }}>
      {visiveis.map(av => {
        const e = TIPO_ESTILO[av.tipo] || TIPO_ESTILO.info
        return (
          <div key={av.id} style={{
            background: e.bg, border: `1px solid ${e.border}`,
            borderRadius: 10, padding: '0.6rem 0.85rem',
            display: 'flex', alignItems: 'flex-start', gap: 10,
          }}>
            <span style={{ fontSize: '1rem', flexShrink: 0 }}>{e.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, color: e.color, fontSize: '0.85rem' }}>{av.titulo}</div>
              {av.texto && <div style={{ color: '#374151', fontSize: '0.78rem', marginTop: 2, lineHeight: 1.4 }}>{av.texto}</div>}
            </div>
            <button onClick={() => fechar(av.id)} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '0 2px', fontSize: '1rem', flexShrink: 0, lineHeight: 1 }}>✕</button>
          </div>
        )
      })}
    </div>
  )
}
