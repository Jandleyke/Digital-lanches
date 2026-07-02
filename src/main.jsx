import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

// Bloqueia pinch-to-zoom no iOS Safari (ignora user-scalable=no no viewport)
document.addEventListener('touchmove', (e) => {
  if (e.touches.length > 1) e.preventDefault()
}, { passive: false })
document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

// Cada carregamento "do zero" desta página renova a chance de recarregar
// automaticamente uma vez se algum chunk de rota falhar (ex.: nova versão
// publicada enquanto a aba estava aberta). Sem isso, a recarga automática
// só valeria uma vez por sessão inteira do navegador.
sessionStorage.removeItem('senac-chunk-reload')

if ('serviceWorker' in navigator) {
  let recarregouPorAtualizacao = false

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (recarregouPorAtualizacao) return
    recarregouPorAtualizacao = true
    window.location.reload()
  })

  window.addEventListener('load', () => {
    navigator.serviceWorker.getRegistrations()
      .then(registros => Promise.all(registros.map(registro => registro.update())))
      .catch(() => {})
  })
}
