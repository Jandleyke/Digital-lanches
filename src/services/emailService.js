import { init, send } from '@emailjs/browser'

const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID || 'service_3it9k2c'
const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID || 'template_6m7nm4t'
const EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY || ''

if (EMAILJS_PUBLIC_KEY) {
  init(EMAILJS_PUBLIC_KEY)
}

export async function enviarEmailRedefinicaoEmailJs({ email, nome, link }) {
  if (!email) {
    throw new Error('E-mail de destino ausente para EmailJS.')
  }
  if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID) {
    throw new Error('EmailJS service ou template não configurados.')
  }

  const templateParams = {
    to_email: email,
    to_name: nome || email.split('@')[0],
    reset_link: link,
    email: email,
  }

  return send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams, EMAILJS_PUBLIC_KEY || undefined)
}
