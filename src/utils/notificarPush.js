// Envio de notificacoes push (segundo plano) via /api/sendPush.
// Reaproveita a sessao do usuario logado; falhas sao silenciosas (nao bloqueiam o fluxo principal).
import { auth } from '../firebase'

export async function notificarPush({ destino, titulo, mensagem, url }) {
  try {
    const token = await auth.currentUser?.getIdToken()
    if (!token || !titulo || !mensagem) return
    await fetch('/api/sendPush', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ destino, titulo, mensagem, url: url || '/' }),
    })
  } catch (e) {
    console.error('notificarPush:', e)
  }
}
