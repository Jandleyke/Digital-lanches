import admin from 'firebase-admin'
import { exigirEmailAutorizado } from '../src/server/access.js'

const ROLES_VALIDOS = ['aluno', 'professor', 'admin', 'gerente', 'vendedor', 'cozinha']

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
  if (!credenciais) throw new Error('Firebase Admin nao configurado no servidor.')
  return admin.initializeApp({
    credential: admin.credential.cert(credenciais),
    projectId: credenciais.projectId || process.env.FIREBASE_PROJECT_ID || 'senac-lanches',
  })
}

function normalizarPerfil(perfil = '') {
  const p = String(perfil).toLowerCase().trim()
  if (['administrador', 'adm', 'lanchonete'].includes(p)) return 'admin'
  if (['gerente', 'gestor'].includes(p)) return 'gerente'
  if (['vendedor', 'vendedora', 'atendente'].includes(p)) return 'vendedor'
  if (['cozinheiro', 'cozinha', 'producao', 'produção'].includes(p)) return 'cozinha'
  if (['prof', 'docente', 'professora'].includes(p)) return 'professor'
  return ROLES_VALIDOS.includes(p) ? p : 'aluno'
}

function perfisDoUsuario(dados = {}) {
  const fonte = [
    ...(Array.isArray(dados.roles) ? dados.roles : []),
    ...(Array.isArray(dados.perfis) ? dados.perfis : []),
    dados.role,
    dados.perfil,
    dados.tipo,
  ].filter(Boolean)
  const perfis = [...new Set(fonte.map(normalizarPerfil).filter(role => ROLES_VALIDOS.includes(role)))]
  return perfis.length ? perfis : ['aluno']
}

function emailValido(email = '') {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())
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

function mensagemDuplicado(campo) {
  const alvo = campo ? ` com este ${campo}` : ''
  return `Já existe um cadastro${alvo}. Se for você, use "Esqueci minha senha" na tela de login para recuperar o acesso.`
}

async function documentoDuplicado(db, campo, valor, uidAtual = '') {
  const snap = await db.collection('usuarios').where(campo, '==', valor).limit(2).get()
  return snap.docs.find(doc => doc.id !== uidAtual) || null
}

async function nomeDuplicado(db, nomeNormalizado, uidAtual = '') {
  const direto = await documentoDuplicado(db, 'nomeVinculo', nomeNormalizado, uidAtual)
  if (direto) return true

  const snap = await db.collection('usuarios').select('nome', 'nomeVinculo').get()
  return snap.docs.some(doc => doc.id !== uidAtual && nomeParaVinculo(doc.data()?.nomeVinculo || doc.data()?.nome) === nomeNormalizado)
}

async function campoDuplicado(app, { nomeNormalizado = '', email = '', uidAtual = '' }) {
  const db = admin.firestore(app)
  if (email && await documentoDuplicado(db, 'email', email, uidAtual)) return 'e-mail'
  if (nomeNormalizado && await nomeDuplicado(db, nomeNormalizado, uidAtual)) return 'nome'
  if (email) {
    try {
      const user = await admin.auth(app).getUserByEmail(email)
      if (user.uid !== uidAtual) return 'e-mail'
    } catch (e) {
      if (e?.code !== 'auth/user-not-found') throw e
    }
  }
  return ''
}

async function usuarioAutenticado(req, app) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) {
    const erro = new Error('Sessao nao enviada.')
    erro.status = 401
    throw erro
  }
  const decoded = await admin.auth(app).verifyIdToken(token)
  exigirEmailAutorizado(decoded.email)
  const authUser = await admin.auth(app).getUser(decoded.uid)
  return { uid: decoded.uid, authUser }
}

function dadosPermitidos(payload = {}, atual = {}) {
  const update = {}
  if (Object.hasOwn(payload, 'nome')) {
    const nome = String(payload.nome || '').trim()
    if (!nome) {
      const erro = new Error('Informe o nome.')
      erro.status = 400
      throw erro
    }
    update.nome = nome
    update.nomeVinculo = nomeParaVinculo(nome)
  }
  if (Object.hasOwn(payload, 'curso')) update.curso = String(payload.curso || '').trim()
  if (Object.hasOwn(payload, 'telefone')) update.telefone = String(payload.telefone || '')
  if (Object.hasOwn(payload, 'fotoPerfil')) update.fotoPerfil = String(payload.fotoPerfil || '')
  if (Object.hasOwn(payload, 'alergias')) update.alergias = Array.isArray(payload.alergias) ? payload.alergias : []
  if (Object.hasOwn(payload, 'email')) {
    const email = String(payload.email || '').trim().toLowerCase()
    if (!emailValido(email)) {
      const erro = new Error('Informe um e-mail valido.')
      erro.status = 400
      throw erro
    }
    update.email = email
  }
  if (!update.nome && atual.nome) update.nomeVinculo = atual.nomeVinculo || nomeParaVinculo(atual.nome)
  return update
}

async function normalizarCadastro(app, uid, authUser, extras = {}) {
  const ref = admin.firestore(app).doc(`usuarios/${uid}`)
  const snap = await ref.get()
  if (!snap.exists) {
    const erro = new Error('Cadastro do usuario nao encontrado no Firestore.')
    erro.status = 404
    throw erro
  }

  const atual = snap.data() || {}
  const roles = perfisDoUsuario(atual)
  const role = roles[0]
  const update = {
    uid,
    userId: uid,
    email: extras.email || String(atual.email || authUser.email || '').trim().toLowerCase(),
    role,
    perfil: role,
    roles,
    nomeVinculo: atual.nomeVinculo || nomeParaVinculo(atual.nome || authUser.displayName || ''),
    atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
  }

  if (!Object.hasOwn(atual, 'ativo')) update.ativo = true
  if (!Object.hasOwn(atual, 'bloqueado')) update.bloqueado = false

  await ref.set({ ...update, ...extras }, { merge: true })
  return { ...atual, ...update, ...extras, atualizadoEm: null }
}

async function atualizarPerfil(app, uid, authUser, payload) {
  const ref = admin.firestore(app).doc(`usuarios/${uid}`)
  const snap = await ref.get()
  if (!snap.exists) {
    const erro = new Error('Cadastro do usuario nao encontrado no Firestore.')
    erro.status = 404
    throw erro
  }
  const atual = snap.data() || {}
  const permitidos = dadosPermitidos(payload, atual)
  const duplicado = await campoDuplicado(app, {
    uidAtual: uid,
    email: permitidos.email || '',
    nomeNormalizado: permitidos.nome ? nomeParaVinculo(permitidos.nome) : '',
  })
  if (duplicado) {
    const erro = new Error(mensagemDuplicado(duplicado))
    erro.status = 409
    throw erro
  }

  if (permitidos.email && permitidos.email !== String(authUser.email || '').trim().toLowerCase()) {
    await admin.auth(app).updateUser(uid, { email: permitidos.email })
  }
  if (permitidos.nome && permitidos.nome !== authUser.displayName) {
    await admin.auth(app).updateUser(uid, { displayName: permitidos.nome })
  }

  return normalizarCadastro(app, uid, { ...authUser, email: permitidos.email || authUser.email }, permitidos)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ erro: 'Metodo nao permitido.' })
    return
  }

  try {
    const app = appAdmin()
    const { uid, authUser } = await usuarioAutenticado(req, app)
    const { acao = 'normalizar', ...payload } = req.body || {}
    const usuario = acao === 'atualizar'
      ? await atualizarPerfil(app, uid, authUser, payload)
      : await normalizarCadastro(app, uid, authUser)
    res.status(200).json({ ok: true, usuario })
  } catch (e) {
    console.error('usuarioAtual:', e)
    const status = e?.code === 'auth/email-already-exists' ? 409 : (e.status || 500)
    const mensagem = e?.code === 'auth/email-already-exists'
      ? 'E-mail ja cadastrado.'
      : (e.message || 'Erro ao processar usuario.')
    res.status(status).json({ erro: mensagem })
  }
}
