import { initializeApp, getApps } from 'firebase/app'
import {
  EmailAuthProvider,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
} from 'firebase/auth'
import { firebaseConfig } from '../firebase'

export function normalizarMatricula(matricula = '') {
  return String(matricula).trim()
}

export function emailValida(email = '') {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())
}

export function matriculaAlunoValida(matricula = '') {
  return /^[0-9]{4,12}$/.test(normalizarMatricula(matricula))
}

export function matriculaGeralValida(matricula = '') {
  return /^[A-Za-z0-9._-]{4,20}$/.test(normalizarMatricula(matricula))
}

export function removerCamposSensiveis(usuario) {
  if (!usuario) return usuario
  const seguro = { ...usuario }
  delete seguro.senha
  return seguro
}

export async function entrarComEmail(auth, email, senha) {
  const emailLimpo = String(email || '').trim().toLowerCase()
  if (!emailValida(emailLimpo) || !senha) throw new Error('Informe e-mail e senha.')
  await setPersistence(auth, browserSessionPersistence)
  const cred = await signInWithEmailAndPassword(auth, emailLimpo, senha)
  return cred.user
}

export async function enviarLinkRedefinicaoSenha(auth, email) {
  const emailLimpo = String(email || '').trim().toLowerCase()
  if (!emailValida(emailLimpo)) throw { code: 'auth/invalid-email', message: 'Informe um e-mail valido.' }

  await sendPasswordResetEmail(auth, emailLimpo, {
    url: `${window.location.origin}/reset-password`,
  })
}

export async function sairDoFirebase(auth) {
  await signOut(auth)
}

export async function criarContaComEmail(auth, { email, senha }) {
  const emailLimpo = String(email || '').trim().toLowerCase()
  if (!emailValida(emailLimpo) || !senha) throw new Error('Informe e-mail e senha.')
  await setPersistence(auth, browserSessionPersistence)
  const cred = await createUserWithEmailAndPassword(auth, emailLimpo, senha)
  return cred.user
}

function secondaryAuth() {
  const app = getApps().find(a => a.name === 'secondary-auth')
    || initializeApp(firebaseConfig, 'secondary-auth')
  return getAuth(app)
}

export async function criarContaSemTrocarSessao({ email, senha }) {
  const authSecundario = secondaryAuth()
  const user = await criarContaComEmail(authSecundario, { email, senha })
  await signOut(authSecundario)
  return user
}

export async function alterarSenhaAtual(auth, senhaAtual, novaSenha) {
  const user = auth.currentUser
  if (!user?.email) throw new Error('Sessao expirada. Faca login novamente.')
  const cred = EmailAuthProvider.credential(user.email, senhaAtual)
  await reauthenticateWithCredential(user, cred)
  await updatePassword(user, novaSenha)
}
