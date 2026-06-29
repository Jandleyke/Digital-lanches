import { useState, useCallback } from 'react'
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react'
import { ToastCtx } from './ToastContextValue'

const ESTILOS = {
  success: { bg: '#DCFCE7', border: '#86EFAC', cor: '#15803D', icone: '#16A34A', Icon: CheckCircle  },
  error:   { bg: '#FEE2E2', border: '#FCA5A5', cor: '#DC2626', icone: '#DC2626', Icon: AlertCircle  },
  warning: { bg: '#FEF3C7', border: '#FCD34D', cor: '#B45309', icone: '#D97706', Icon: AlertTriangle },
  info:    { bg: '#DBEAFE', border: '#93C5FD', cor: '#1D4ED8', icone: '#2563EB', Icon: Info          },
}

function ToastItem({ t, onClose }) {
  const e = ESTILOS[t.tipo] || ESTILOS.info
  const { Icon } = e
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      background: e.bg, border: `1px solid ${e.border}`,
      borderRadius: 12, padding: '0.75rem 0.9rem',
      boxShadow: '0 6px 24px rgba(0,0,0,0.13)',
      maxWidth: 340, width: '100%',
      animation: 'slideInRight 0.25s ease',
      pointerEvents: 'auto',
    }}>
      <Icon size={17} color={e.icone} style={{ flexShrink: 0, marginTop: 1 }} />
      <span style={{ flex: 1, color: e.cor, fontSize: '0.86rem', fontWeight: 600, lineHeight: 1.45 }}>
        {t.msg}
      </span>
      <button
        onClick={() => onClose(t.id)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: e.cor, opacity: 0.55, flexShrink: 0, display: 'flex', alignItems: 'center' }}
        aria-label="Fechar notificação"
      >
        <X size={13} />
      </button>
    </div>
  )
}

function ToastContainer({ toasts, onClose }) {
  if (!toasts.length) return null
  return (
    <div style={{
      position: 'fixed', top: 16, right: 16, zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: 8,
      pointerEvents: 'none',
      maxWidth: 340, width: 'calc(100vw - 32px)',
    }}>
      {toasts.map(t => <ToastItem key={t.id} t={t} onClose={onClose} />)}
    </div>
  )
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const fechar = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const toast = useCallback((msg, tipo = 'info', dur = 3500) => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev.slice(-4), { id, msg, tipo }])
    setTimeout(() => fechar(id), dur)
  }, [fechar])

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <ToastContainer toasts={toasts} onClose={fechar} />
    </ToastCtx.Provider>
  )
}
