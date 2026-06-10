import admin from 'firebase-admin'
import webpush from 'web-push'

const ROLES_VALIDOS = ['aluno', 'professor', 'admin', 'vendedor', 'cozinha']

function privateKey() {
  return process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
}

function serviceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
  }
  if (process.env.FIREBASE_CLIENT_EMAIL && privateKey()) {
    return {
      projectId: process.env.FIREBASE_PROJECT_ID || 'senac-lanches',
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey(),
    }
  }
  return null
}

function appAdmin() {
  if (admin.apps.length) return admin.app()
  const credenciais = serviceAccount()
  if (!credenciais) {
    throw new Error('Firebase Admin nao configurado no servidor.')
  }
  return admin.initializeApp({
    credential: admin.credential.cert(credenciais),
    projectId: credenciais.projectId || process.env.FIREBASE_PROJECT_ID || 'senac-lanches',
  })
}

function normalizarPerfil(perfil = '') {
  const p = String(perfil).toLowerCase().trim()
  if (['gerente', 'administrador', 'adm', 'gestor', 'lanchonete'].includes(p)) return 'admin'
  if (['vendedor', 'vendedora', 'atendente'].includes(p)) return 'vendedor'
  if (['cozinheiro', 'cozinha', 'producao', 'produção'].includes(p)) return 'cozinha'
  if (['prof', 'docente', 'professora'].includes(p)) return 'professor'
  return ROLES_VALIDOS.includes(p) ? p : 'aluno'
}

async function exigirAutorizado(req, app) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) {
    const erro = new Error('Sessao nao enviada.')
    erro.status = 401
    throw erro
  }

  const decoded = await admin.auth(app).verifyIdToken(token)
  const snap = await admin.firestore(app).doc(`usuarios/${decoded.uid}`).get()
  const dados = snap.data()
  const perfil = normalizarPerfil(dados?.role || dados?.perfil)
  const podeEnviar = ['admin', 'vendedor', 'cozinha', 'professor', 'aluno'].includes(perfil)
  if (!snap.exists || dados?.ativo === false || !podeEnviar) {
    const erro = new Error('Sem permissao para enviar notificacoes.')
    erro.status = 403
    throw erro
  }
  return perfil
}

function configurarWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || 'mailto:contato@senaclanches.com'
  if (!publicKey || !privateKey) {
    const erro = new Error('VAPID nao configurado no servidor.')
    erro.status = 500
    throw erro
  }
  webpush.setVapidDetails(subject, publicKey, privateKey)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ erro: 'Metodo nao permitido.' })
    return
  }

  try {
    const app = appAdmin()
    const perfil = await exigirAutorizado(req, app)
    configurarWebPush()

    const { destino, titulo, mensagem, url } = req.body || {}
    if (!titulo || !mensagem) {
      res.status(400).json({ erro: 'Informe titulo e mensagem.' })
      return
    }

    if (perfil === 'aluno' && !['cozinha', 'vendedor', 'admin'].includes(destino)) {
      res.status(403).json({ erro: 'Aluno so pode notificar a equipe da cantina.' })
      return
    }

    const db = admin.firestore(app)
    const snap = await db.collection('pushSubscriptions').get()
    const payload = JSON.stringify({ titulo, mensagem, url: url || '/', tag: 'senac-promo' })

    let enviados = 0
    await Promise.all(snap.docs.map(async (docSnap) => {
      const dados = docSnap.data()
      const role = normalizarPerfil(dados.role)
      const matchRole = !destino || destino === 'todos' || role === destino
      const matchUid = destino && docSnap.id === destino
      if (!matchRole && !matchUid) return
      try {
        await webpush.sendNotification(dados.subscription, payload)
        enviados++
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) {
          await docSnap.ref.delete()
        } else {
          console.error('sendPush:', docSnap.id, e.message)
        }
      }
    }))

    res.status(200).json({ ok: true, enviados })
  } catch (e) {
    console.error('sendPush:', e)
    res.status(e.status || 500).json({ erro: e.message || 'Erro ao enviar notificacoes.' })
  }
}
