// Notificações do navegador (Notification API) — usadas para avisar o aluno
// quando o pedido fica Pronto, mesmo com a aba em segundo plano.
import { codigoPedido } from './pedidos'

export function suportaNotificacao() {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function permissaoNotificacao() {
  return suportaNotificacao() ? Notification.permission : 'unsupported'
}

export async function solicitarPermissaoNotificacao() {
  if (!suportaNotificacao()) return 'unsupported'
  if (Notification.permission !== 'default') return Notification.permission
  try { return await Notification.requestPermission() }
  catch { return Notification.permission }
}

export function notificarPedidoPronto(pedido) {
  if (!suportaNotificacao() || Notification.permission !== 'granted') return
  try {
    const n = new Notification('🎉 Seu pedido está pronto!', {
      body: `Pedido ${codigoPedido(pedido)} — retire no balcão no horário selecionado.`,
      tag: `pedido-pronto-${pedido.id}`,
      icon: '/pwa-192.png',
    })
    n.onclick = () => { window.focus(); n.close() }
  } catch { /* alguns navegadores bloqueiam a construção direta de Notification em PWAs instaladas */ }
}

export function suportaBadgeApp() {
  return typeof navigator !== 'undefined' && 'setAppBadge' in navigator
}

export function atualizarBadgeApp(quantidade) {
  if (!suportaBadgeApp()) return
  const total = Number(quantidade || 0)
  if (total > 0) navigator.setAppBadge(total).catch(() => {})
  else navigator.clearAppBadge().catch(() => {})
}
