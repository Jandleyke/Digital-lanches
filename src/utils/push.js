// Inscrição em notificações push (segundo plano), usando a Push API + service worker.
import { doc, setDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

export function suportaPush() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window
}

export async function inscreverPush(usuarioLogado) {
  if (!suportaPush() || !usuarioLogado) return null
  const chavePublica = import.meta.env.VITE_VAPID_PUBLIC_KEY
  if (!chavePublica) return null

  const registration = await navigator.serviceWorker.ready
  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(chavePublica),
    })
  }

  const id = usuarioLogado.uid || usuarioLogado.matricula
  await setDoc(doc(db, 'pushSubscriptions', id), {
    uid: id,
    role: usuarioLogado.role || usuarioLogado.perfil || '',
    subscription: subscription.toJSON(),
    atualizadoEm: Date.now(),
  })
  return subscription
}

export async function desinscreverPush(usuarioLogado) {
  if (!suportaPush()) return
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (subscription) await subscription.unsubscribe()
  const id = usuarioLogado?.uid || usuarioLogado?.matricula
  if (id) await deleteDoc(doc(db, 'pushSubscriptions', id))
}
