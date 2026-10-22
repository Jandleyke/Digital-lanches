import admin from 'firebase-admin'
import { exigirEmailAutorizado } from '../src/server/access.js'

const EMAIL_ADMIN_RECUPERACAO = 'menesesjan02@gmail.com'

function privateKey() {
  return process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
}

function serviceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
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
  if (!credenciais) throw new Error('Firebase Admin não configurado no servidor.')
  return admin.initializeApp({
    credential: admin.credential.cert(credenciais),
    projectId: credenciais.projectId || process.env.FIREBASE_PROJECT_ID || 'senac-lanches',
  })
}

function nomeParaVinculo(valor = '') {
  return String(valor)
    .trim()
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function usuarioAutenticado(req, app) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) {
    const erro = new Error('Sessão não enviada.')
    erro.status = 401
    throw erro
  }
  const decoded = await admin.auth(app).verifyIdToken(token)
  exigirEmailAutorizado(decoded.email)
  const authUser = await admin.auth(app).getUser(decoded.uid)
  return { uid: decoded.uid, authUser }
}

function rolesPadrao(email) {
  if (String(email || '').trim().toLowerCase() === EMAIL_ADMIN_RECUPERACAO) {
    return ['admin', 'gerente']
  }
  return ['aluno']
}

function montarUsuario(uid, authUser, base = {}) {
  const email = String(authUser.email || base.email || '').trim().toLowerCase()
  const roles = Array.isArray(base.roles) && base.roles.length ? base.roles : rolesPadrao(email)
  const role = roles[0]
  const nome = String(base.nome || authUser.displayName || email.split('@')[0] || 'Usuário').trim()
  return {
    ...base,
    uid,
    userId: uid,
    nome,
    nomeVinculo: base.nomeVinculo || nomeParaVinculo(nome),
    email,
    role,
    perfil: role,
    roles,
    matricula: String(base.matricula || ''),
    ativo: base.ativo !== false,
    bloqueado: base.bloqueado === true ? false : Boolean(base.bloqueado),
    fotoPerfil: base.fotoPerfil || '',
    curso: base.curso || '',
    telefone: base.telefone || '',
    alergias: Array.isArray(base.alergias) ? base.alergias : [],
    recuperadoEm: admin.firestore.FieldValue.serverTimestamp(),
    atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ erro: 'Método não permitido.' })
    return
  }

  try {
    const app = appAdmin()
    const db = admin.firestore(app)
    const { uid, authUser } = await usuarioAutenticado(req, app)
    const email = String(authUser.email || '').trim().toLowerCase()
    if (!email) {
      res.status(400).json({ erro: 'Conta sem e-mail no Firebase Auth.' })
      return
    }

    const refAtual = db.doc(`usuarios/${uid}`)
    const snapAtual = await refAtual.get()
    if (snapAtual.exists) {
      const usuario = montarUsuario(uid, authUser, snapAtual.data() || {})
      await refAtual.set(usuario, { merge: true })
      res.status(200).json({ ok: true, usuario, recuperado: false })
      return
    }

    const porEmail = await db.collection('usuarios').where('email', '==', email).limit(1).get()
    const docAntigo = porEmail.empty ? null : porEmail.docs[0]
    const base = docAntigo?.data() || {}
    const usuario = montarUsuario(uid, authUser, base)
    await refAtual.set({
      ...usuario,
      criadoEm: base.criadoEm || admin.firestore.FieldValue.serverTimestamp(),
      origemRecuperacao: 'auth-sem-doc-firestore',
      docAnteriorUid: docAntigo && docAntigo.id !== uid ? docAntigo.id : '',
    }, { merge: true })

    res.status(200).json({ ok: true, usuario, recuperado: true })
  } catch (e) {
    console.error('recuperarUsuarioAuth:', e)
    res.status(e.status || 500).json({ erro: e.message || 'Não foi possível recuperar o cadastro.' })
  }
}
