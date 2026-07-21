import admin from 'firebase-admin'

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

function normalizarMatricula(matricula = '') {
  return String(matricula).trim()
}

function emailValido(email = '') {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())
}

function matriculaAlunoValida(matricula = '') {
  return /^[0-9]{4,12}$/.test(normalizarMatricula(matricula))
}

function usuarioDuplicado(usuario = {}) {
  return {
    nome: String(usuario.nome || usuario.displayName || 'aluno cadastrado'),
    email: String(usuario.email || ''),
    matricula: String(usuario.matricula || ''),
  }
}

function mensagemDuplicado(campo, usuario = {}) {
  const alvo = campo ? ` com este ${campo}` : ''
  const nome = usuario.nome ? ` para ${usuario.nome}` : ''
  return `Já existe um cadastro${alvo}${nome}. Se for você, use "Esqueci minha senha" para recuperar o acesso.`
}

async function buscarDocumento(db, campo, valor) {
  const snap = await db.collection('usuarios').where(campo, '==', valor).limit(1).get()
  if (snap.empty) return null
  const doc = snap.docs[0]
  return { id: doc.id, ...doc.data() }
}

async function buscarPorNome(db, nomeNormalizado) {
  const direto = await buscarDocumento(db, 'nomeVinculo', nomeNormalizado)
  if (direto) return direto

  const snap = await db.collection('usuarios').select('nome', 'nomeVinculo', 'email', 'matricula').get()
  const doc = snap.docs.find(doc => nomeParaVinculo(doc.data()?.nomeVinculo || doc.data()?.nome) === nomeNormalizado)
  return doc ? { id: doc.id, ...doc.data() } : null
}

async function validarDuplicidade(app, { nomeNormalizado, email, matricula }) {
  const db = admin.firestore(app)
  const porMatricula = await buscarDocumento(db, 'matricula', matricula)
  if (porMatricula) return { campo: 'matrícula', usuario: usuarioDuplicado(porMatricula) }

  const porEmail = await buscarDocumento(db, 'email', email)
  if (porEmail) return { campo: 'e-mail', usuario: usuarioDuplicado(porEmail) }

  const porNome = await buscarPorNome(db, nomeNormalizado)
  if (porNome) return { campo: 'nome', usuario: usuarioDuplicado(porNome) }

  try {
    const user = await admin.auth(app).getUserByEmail(email)
    return { campo: 'e-mail', usuario: usuarioDuplicado(user) }
  } catch (e) {
    if (e?.code !== 'auth/user-not-found') throw e
  }
  return null
}

function respostaDuplicada(res, duplicado) {
  res.status(409).json({
    erro: mensagemDuplicado(duplicado.campo, duplicado.usuario),
    campo: duplicado.campo,
    duplicado: true,
    usuario: duplicado.usuario,
  })
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
    const nome = String(req.body?.nome || '').trim()
    const nomeNormalizado = nomeParaVinculo(nome)
    const email = String(req.body?.email || '').trim().toLowerCase()
    const matricula = normalizarMatricula(req.body?.matricula)
    const senha = String(req.body?.senha || '')

    if (!nome) return res.status(400).json({ erro: 'Informe seu nome.' })
    if (nomeNormalizado.split(' ').filter(Boolean).length < 2) {
      return res.status(400).json({ erro: 'Informe seu nome completo, incluindo o sobrenome.' })
    }
    if (!emailValido(email)) return res.status(400).json({ erro: 'Informe um e-mail válido.' })
    if (!matriculaAlunoValida(matricula)) {
      return res.status(400).json({ erro: 'Use uma matrícula numérica com 4 a 12 dígitos.' })
    }
    if (senha.length < 6) return res.status(400).json({ erro: 'A senha deve ter pelo menos 6 caracteres.' })

    const duplicado = await validarDuplicidade(app, { nomeNormalizado, email, matricula })
    if (duplicado) return respostaDuplicada(res, duplicado)

    let user
    try {
      user = await admin.auth(app).createUser({
        email,
        password: senha,
        displayName: nome,
        disabled: false,
      })
    } catch (e) {
      if (e?.code === 'auth/email-already-exists') {
        return respostaDuplicada(res, { campo: 'e-mail', usuario: usuarioDuplicado({ nome, email }) })
      }
      throw e
    }

    const novo = {
      uid: user.uid,
      userId: user.uid,
      nome,
      nomeVinculo: nomeNormalizado,
      email,
      matricula,
      role: 'aluno',
      perfil: 'aluno',
      roles: ['aluno'],
      ativo: true,
      bloqueado: false,
      curso: String(req.body?.curso || '').trim(),
      telefone: String(req.body?.telefone || ''),
      fotoPerfil: '',
      alergias: Array.isArray(req.body?.alergias) ? req.body.alergias : [],
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
      atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
    }

    try {
      await db.doc(`usuarios/${user.uid}`).set(novo)
    } catch (e) {
      await admin.auth(app).deleteUser(user.uid).catch(() => {})
      throw e
    }

    res.status(200).json({ ok: true })
  } catch (e) {
    console.error('cadastroAluno:', e)
    res.status(e.status || 500).json({ erro: e.message || 'Não foi possível criar o cadastro.' })
  }
}
