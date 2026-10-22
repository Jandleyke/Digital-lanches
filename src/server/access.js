import admin from 'firebase-admin'

export const EMAIL_AUTORIZADO = 'menesesjan02@gmail.com'

export function exigirEmailAutorizado(email) {
  if (String(email || '').trim().toLowerCase() === EMAIL_AUTORIZADO) return
  const erro = new Error('App desativado.')
  erro.status = 403
  throw erro
}

function appAdmin() {
  if (admin.apps.length) return admin.app()
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
    : process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY
      ? {
          projectId: process.env.FIREBASE_PROJECT_ID || 'senac-lanches',
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }
      : null

  if (!serviceAccount) throw new Error('Firebase Admin não configurado no servidor.')
  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.projectId || process.env.FIREBASE_PROJECT_ID || 'senac-lanches',
  })
}

export async function exigirAcessoResponsavel(req) {
  const authorization = req.headers.authorization || ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (!token) {
    const erro = new Error('Sessão não enviada.')
    erro.status = 401
    throw erro
  }
  const decoded = await admin.auth(appAdmin()).verifyIdToken(token)
  exigirEmailAutorizado(decoded.email)
  return decoded
}
