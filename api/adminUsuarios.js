import admin from 'firebase-admin'

const ROLES_VALIDOS = ['aluno', 'professor', 'admin', 'gerente', 'vendedor', 'cozinha']

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
  if (['administrador', 'adm', 'lanchonete'].includes(p)) return 'admin'
  if (['gerente', 'gestor'].includes(p)) return 'gerente'
  if (['vendedor', 'vendedora', 'atendente'].includes(p)) return 'vendedor'
  if (['cozinheiro', 'cozinha', 'producao', 'produção'].includes(p)) return 'cozinha'
  if (['prof', 'docente', 'professora'].includes(p)) return 'professor'
  return ROLES_VALIDOS.includes(p) ? p : 'aluno'
}

function normalizarPerfis(valor, fallback = 'aluno') {
  const lista = Array.isArray(valor) && valor.length ? valor : [fallback]
  return [...new Set(lista.map(normalizarPerfil).filter(role => ROLES_VALIDOS.includes(role)))]
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

function normalizarMatricula(matricula = '') {
  return String(matricula).trim()
}

function emailValido(email = '') {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())
}

function matriculaValida(matricula = '') {
  return /^[A-Za-z0-9._-]{4,20}$/.test(normalizarMatricula(matricula))
}

async function exigirAdmin(req) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) {
    const erro = new Error('Sessao nao enviada.')
    erro.status = 401
    throw erro
  }

  const app = appAdmin()
  const decoded = await admin.auth(app).verifyIdToken(token)
  const snap = await admin.firestore(app).doc(`usuarios/${decoded.uid}`).get()
  const dados = snap.data()
  const roles = normalizarPerfis(dados?.roles || dados?.perfis, dados?.role || dados?.perfil)
  if (!snap.exists || dados?.ativo === false || !roles.some(role => ['admin', 'gerente'].includes(role))) {
    const erro = new Error('Apenas administradores podem executar esta acao.')
    erro.status = 403
    throw erro
  }

  return { app, uid: decoded.uid, nome: dados?.nome || 'Admin' }
}

async function criarUsuario(app, payload) {
  const nome = String(payload.nome || '').trim()
  const email = String(payload.email || '').trim().toLowerCase()
  const matricula = normalizarMatricula(payload.matricula)
  const senha = String(payload.senha || '')
  const roles = normalizarPerfis(payload.roles, payload.role || payload.perfil)
  const role = roles[0]

  if (!nome) return { status: 400, body: { erro: 'Informe o nome.' } }
  if (!emailValido(email)) return { status: 400, body: { erro: 'Informe um e-mail valido.' } }
  if (senha.length < 6) return { status: 400, body: { erro: 'Senha precisa ter pelo menos 6 caracteres.' } }
  if (!matriculaValida(matricula)) return { status: 400, body: { erro: 'Use uma matricula com 4 a 20 caracteres validos.' } }
  if (!ROLES_VALIDOS.includes(role)) return { status: 400, body: { erro: 'Perfil invalido.' } }

  const db = admin.firestore(app)
  const existente = await db.collection('usuarios').where('matricula', '==', matricula).limit(1).get()
  if (!existente.empty) return { status: 409, body: { erro: 'Matricula ja cadastrada.' } }

  let user
  try {
    user = await admin.auth(app).createUser({
      email,
      password: senha,
      displayName: nome,
      disabled: false,
    })
  } catch (e) {
    if (e?.code === 'auth/email-already-exists') return { status: 409, body: { erro: 'E-mail ja cadastrado.' } }
    throw e
  }

  const novo = {
    uid: user.uid,
    nome,
    nomeVinculo: nomeParaVinculo(nome),
    email,
    matricula,
    role,
    perfil: role,
    roles,
    ativo: true,
    bloqueado: false,
    curso: String(payload.curso || '').trim(),
    telefone: String(payload.telefone || ''),
    fotoPerfil: '',
    alergias: [],
    criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
  }

  try {
    await db.doc(`usuarios/${user.uid}`).set(novo)
  } catch (e) {
    await admin.auth(app).deleteUser(user.uid).catch(() => {})
    throw e
  }

  return { status: 200, body: { ok: true, usuario: { ...novo, criadoEm: null, atualizadoEm: null } } }
}

async function excluirUsuario(app, adminUid, payload) {
  const uid = String(payload.uid || '').trim()
  if (!uid) return { status: 400, body: { erro: 'UID invalido.' } }
  if (uid === adminUid) return { status: 400, body: { erro: 'Voce nao pode excluir sua propria conta.' } }

  const db = admin.firestore(app)
  await admin.auth(app).deleteUser(uid).catch(e => {
    if (e?.code !== 'auth/user-not-found') throw e
  })
  await db.doc(`usuarios/${uid}`).delete()

  return { status: 200, body: { ok: true } }
}

async function atualizarUsuario(app, adminUid, adminNome, payload) {
  const uid = String(payload.uid || '').trim()
  if (!uid) return { status: 400, body: { erro: 'UID invalido.' } }

  const authUpdate = {}
  const firestoreUpdate = {
    atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
  }

  if (Object.hasOwn(payload, 'nome')) {
    const nome = String(payload.nome || '').trim()
    if (!nome) return { status: 400, body: { erro: 'Informe o nome.' } }
    authUpdate.displayName = nome
    firestoreUpdate.nome = nome
    firestoreUpdate.nomeVinculo = nomeParaVinculo(nome)
  }

  if (Object.hasOwn(payload, 'email')) {
    const email = String(payload.email || '').trim().toLowerCase()
    if (!emailValido(email)) return { status: 400, body: { erro: 'Informe um e-mail valido.' } }
    let emailAtual = ''
    try { emailAtual = (await admin.auth(app).getUser(uid)).email || '' } catch { /* usuario sem email no Auth */ }
    if (email !== emailAtual) authUpdate.email = email
    firestoreUpdate.email = email
  }

  if (Object.hasOwn(payload, 'roles') || Object.hasOwn(payload, 'perfis') || Object.hasOwn(payload, 'perfil') || Object.hasOwn(payload, 'role')) {
    const alvoRef = admin.firestore(app).doc(`usuarios/${uid}`)
    const alvoSnap = await alvoRef.get()
    if (!alvoSnap.exists) return { status: 404, body: { erro: 'Usuario nao encontrado.' } }
    const antigos = normalizarPerfis(alvoSnap.data()?.roles || alvoSnap.data()?.perfis, alvoSnap.data()?.role || alvoSnap.data()?.perfil)
    const roles = normalizarPerfis(payload.roles || payload.perfis, payload.role || payload.perfil)
    if (!roles.length) return { status: 400, body: { erro: 'Selecione pelo menos um perfil.' } }
    const role = roles[0]
    firestoreUpdate.role = role
    firestoreUpdate.perfil = role
    firestoreUpdate.roles = roles
    if (JSON.stringify(antigos) !== JSON.stringify(roles)) {
      firestoreUpdate.historicoPerfis = admin.firestore.FieldValue.arrayUnion({
        alteradoPor: adminUid,
        alteradoPorNome: adminNome,
        perfisAntigos: antigos,
        perfisNovos: roles,
        dataHora: new Date().toISOString(),
      })
    }
  }

  if (Object.hasOwn(payload, 'curso')) firestoreUpdate.curso = String(payload.curso || '').trim()
  if (Object.hasOwn(payload, 'telefone')) firestoreUpdate.telefone = String(payload.telefone || '')
  if (Object.hasOwn(payload, 'fotoPerfil')) firestoreUpdate.fotoPerfil = String(payload.fotoPerfil || '')
  if (Object.hasOwn(payload, 'alergias')) firestoreUpdate.alergias = Array.isArray(payload.alergias) ? payload.alergias : []
  if (Object.hasOwn(payload, 'ativo')) firestoreUpdate.ativo = payload.ativo !== false
  if (Object.hasOwn(payload, 'bloqueado')) firestoreUpdate.bloqueado = payload.bloqueado === true
  if (Object.hasOwn(payload, 'matricula')) {
    const novaMatricula = normalizarMatricula(payload.matricula)
    if (!matriculaValida(novaMatricula)) return { status: 400, body: { erro: 'Matricula invalida. Use entre 4 e 20 caracteres alfanumericos.' } }
    const existente = await admin.firestore(app).collection('usuarios').where('matricula', '==', novaMatricula).limit(1).get()
    if (!existente.empty && existente.docs[0].id !== uid) return { status: 409, body: { erro: 'Matricula ja cadastrada para outro usuario.' } }
    firestoreUpdate.matricula = novaMatricula
  }

  try {
    if (Object.keys(authUpdate).length) {
      await admin.auth(app).updateUser(uid, authUpdate)
    }
  } catch (e) {
    if (e?.code === 'auth/email-already-exists') return { status: 409, body: { erro: 'E-mail ja cadastrado.' } }
    if (e?.code === 'auth/user-not-found') return { status: 404, body: { erro: 'Usuario nao encontrado no Firebase Auth.' } }
    throw e
  }

  await admin.firestore(app).doc(`usuarios/${uid}`).update(firestoreUpdate)

  return { status: 200, body: { ok: true } }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ erro: 'Metodo nao permitido.' })
    return
  }

  try {
    const { app, uid, nome } = await exigirAdmin(req)
    const { acao, ...payload } = req.body || {}
    const resultado = acao === 'criar'
      ? await criarUsuario(app, payload)
      : acao === 'atualizar'
        ? await atualizarUsuario(app, uid, nome, payload)
      : acao === 'excluir'
        ? await excluirUsuario(app, uid, payload)
        : { status: 400, body: { erro: 'Acao invalida.' } }

    res.status(resultado.status).json(resultado.body)
  } catch (e) {
    console.error('adminUsuarios:', e)
    res.status(e.status || 500).json({ erro: e.message || 'Erro ao processar usuario.' })
  }
}
