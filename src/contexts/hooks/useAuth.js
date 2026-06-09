import { useState, useEffect, useRef, useCallback } from 'react'
import { doc, getDoc, onSnapshot, setDoc, updateDoc, collection } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { auth, db } from '../../firebase'
import { salvarSessao } from '../../utils/storage'
import {
  alterarSenhaAtual,
  criarContaComEmail,
  entrarComEmail,
  enviarLinkRedefinicaoSenha,
  emailValida,
  matriculaAlunoValida,
  matriculaGeralValida,
  normalizarMatricula,
  removerCamposSensiveis,
  sairDoFirebase,
} from '../../services/authService'
import { PERFIS, ehStaff, normalizarPerfil } from '../../utils/perfis'

const ROLES_VALIDOS = [PERFIS.aluno, PERFIS.professor, PERFIS.admin, PERFIS.vendedor, PERFIS.cozinha]

async function chamarAdminUsuarios(acao, payload = {}) {
  const token = await auth.currentUser?.getIdToken()
  if (!token) return { erro: 'Sessao expirada. Faca login novamente.' }

  const resposta = await fetch('/api/adminUsuarios', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ acao, ...payload }),
  })
  const dados = await resposta.json().catch(() => ({}))
  if (!resposta.ok) return { erro: dados.erro || 'Nao foi possivel processar o usuario.' }
  return dados
}

function normalizarUsuario(user, dados) {
  if (!user || !dados) return null
  const seguro = removerCamposSensiveis({ uid: user.uid, ...dados })
  const roleCru = seguro.role || seguro.perfil || 'aluno'
  const perfilOficial = normalizarPerfil(roleCru)
  return {
    ...seguro,
    uid: user.uid,
    email: String(seguro.email || user.email || '').trim().toLowerCase(),
    role: perfilOficial,
    perfil: perfilOficial,
    ativo: seguro.ativo !== false && seguro.bloqueado !== true,
    bloqueado: seguro.ativo === false || seguro.bloqueado === true,
  }
}

function prepararAtualizacaoUsuario(dados = {}) {
  const atualizacao = { ...dados }
  if (Object.hasOwn(atualizacao, 'perfil') && !Object.hasOwn(atualizacao, 'role')) {
    atualizacao.role = normalizarPerfil(atualizacao.perfil)
    delete atualizacao.perfil
  }
  if (Object.hasOwn(atualizacao, 'bloqueado') && !Object.hasOwn(atualizacao, 'ativo')) {
    atualizacao.ativo = !atualizacao.bloqueado
    delete atualizacao.bloqueado
  }
  if (Object.hasOwn(atualizacao, 'email')) {
    atualizacao.email = String(atualizacao.email || '').trim().toLowerCase()
  }
  return atualizacao
}

export function useAuth({ onLogout }) {
  const [usuarioLogado, setUsuarioLogado] = useState(null)
  const [usuarios, setUsuarios] = useState([])
  const [carregandoAuth, setCarregandoAuth] = useState(true)
  const usuarioLogadoRef = useRef(null)

  useEffect(() => { usuarioLogadoRef.current = usuarioLogado }, [usuarioLogado])
  useEffect(() => { salvarSessao(usuarioLogado) }, [usuarioLogado])

  useEffect(() => {
    let unsubDoc = () => {}
    const unsubAuth = onAuthStateChanged(auth, user => {
      unsubDoc()
      if (!user) {
        setUsuarioLogado(null)
        setUsuarios([])
        setCarregandoAuth(false)
        return
      }

      unsubDoc = onSnapshot(doc(db, 'usuarios', user.uid), snap => {
        if (!snap.exists()) {
          setUsuarioLogado(null)
          setUsuarios([])
          setCarregandoAuth(false)
          return
        }

        const usuario = normalizarUsuario(user, snap.data())
        if (!usuario.ativo) {
          sairDoFirebase(auth)
          setUsuarioLogado(null)
          setUsuarios([])
          setCarregandoAuth(false)
          onLogout?.()
          return
        }

        setUsuarioLogado(usuario)
        if (!ehStaff(usuario.role)) setUsuarios([usuario])
        setCarregandoAuth(false)
      }, err => {
        console.error('[Firestore] usuario atual:', err)
        setUsuarioLogado(null)
        setCarregandoAuth(false)
      })
    })

    return () => {
      unsubDoc()
      unsubAuth()
    }
  }, [onLogout])

  useEffect(() => {
    if (!usuarioLogado || !ehStaff(usuarioLogado.role)) return
    const unsub = onSnapshot(collection(db, 'usuarios'), snap => {
      setUsuarios(snap.docs.map(d => normalizarUsuario({ uid: d.id, email: d.data().email }, d.data())))
    }, err => console.error('[Firestore] usuarios:', err))
    return unsub
  }, [usuarioLogado])

  const login = useCallback(async (email, senha) => {
    try {
      const user = await entrarComEmail(auth, email, senha)
      const snap = await getDoc(doc(db, 'usuarios', user.uid))

      if (!snap.exists()) {
        await sairDoFirebase(auth)
        return { erro: 'Conta não configurada no banco de dados. Procure o suporte.' }
      }

      const usuario = normalizarUsuario(user, snap.data())

      if (!ROLES_VALIDOS.includes(usuario.role)) {
        await sairDoFirebase(auth)
        return { erro: 'Perfil de acesso inválido.' }
      }

      if (!usuario.ativo) {
        await sairDoFirebase(auth)
        return { erro: 'Sua conta está desativada ou bloqueada.', bloqueado: true }
      }

      setUsuarioLogado(usuario)
      return { usuario }
    } catch (e) {
      console.error('login:', e)
      let mensagem = 'Erro ao realizar login.'
      if (e?.code === 'auth/user-not-found' || e?.code === 'auth/wrong-password' || e?.code === 'auth/invalid-credential') {
        mensagem = 'E-mail ou senha incorretos.'
      } else if (e?.code === 'auth/too-many-requests') {
        mensagem = 'Muitas tentativas. Tente novamente em alguns minutos.'
      }
      return { erro: mensagem }
    }
  }, [])

  const logout = useCallback(async () => {
    await sairDoFirebase(auth)
    setUsuarioLogado(null)
    setUsuarios([])
    onLogout?.()
  }, [onLogout])

  const cadastrar = useCallback(async ({ nome, matricula, senha, curso, telefone = '', email = '', alergias = [] }) => {
    const matriculaLimpa = normalizarMatricula(matricula)
    const emailLimpo = String(email || '').trim().toLowerCase()
    if (!nome?.trim()) return { erro: 'Informe seu nome.' }
    if (!emailValida(emailLimpo)) return { erro: 'Informe um e-mail valido.' }
    if (!matriculaAlunoValida(matriculaLimpa)) return { erro: 'Use uma matricula numerica com 4 a 12 digitos.' }
    if (usuarios.find(u => u.matricula === matriculaLimpa)) return { erro: 'Matricula ja cadastrada.' }

    try {
      const user = await criarContaComEmail(auth, { email: emailLimpo, senha })
      const novo = {
        uid: user.uid,
        nome: nome.trim(),
        email: emailLimpo,
        matricula: matriculaLimpa,
        role: 'aluno',
        ativo: true,
        curso,
        telefone: telefone || '',
        fotoPerfil: '',
        alergias: alergias || [],
      }
      await setDoc(doc(db, 'usuarios', user.uid), novo)
      await sairDoFirebase(auth)
      return { ok: true }
    } catch (e) {
      console.error('cadastrar:', e)
      if (e?.code === 'auth/email-already-in-use') return { erro: 'E-mail ja cadastrado.' }
      return { erro: 'Erro ao cadastrar. Verifique os dados e tente novamente.' }
    }
  }, [usuarios])

  const cadastrarUsuario = useCallback(async ({ nome, matricula, senha, perfil, role, curso = '', telefone = '', email = '' }) => {
    const matriculaLimpa = normalizarMatricula(matricula)
    const emailLimpo = String(email || '').trim().toLowerCase()
    const roleLimpo = normalizarPerfil(role || perfil || 'aluno')
    if (!nome?.trim()) return { erro: 'Informe o nome.' }
    if (!emailValida(emailLimpo)) return { erro: 'Informe um e-mail valido.' }
    if (!ROLES_VALIDOS.includes(roleLimpo)) return { erro: 'Perfil invalido.' }
    if (!matriculaGeralValida(matriculaLimpa)) return { erro: 'Use uma matricula com 4 a 20 caracteres validos.' }
    if (usuarios.find(u => u.matricula === matriculaLimpa)) return { erro: 'Matricula ja cadastrada.' }

    try {
      const res = await chamarAdminUsuarios('criar', {
        nome: nome.trim(),
        email: emailLimpo,
        matricula: matriculaLimpa,
        senha,
        role: roleLimpo,
        curso,
        telefone,
      })
      if (res.erro) return res
      return { ok: true, usuario: res.usuario }
    } catch (e) {
      console.error('cadastrarUsuario:', e)
      return { erro: 'Erro ao cadastrar. Verifique os dados e tente novamente.' }
    }
  }, [usuarios])

  const redefinirSenhaTelefone = useCallback(async () => (
    { erro: 'Redefinicao por telefone foi desativada. Use o fluxo de e-mail.' }
  ), [])

  const redefinirSenhaVerificada = useCallback(async (email) => {
    if (!emailValida(email)) return { erro: 'Informe o e-mail da conta.' }
    try {
      await enviarLinkRedefinicaoSenha(auth, email)
      return { ok: true }
    } catch (e) {
      console.error('redefinirSenhaVerificada:', e)
      if (e?.code === 'auth/user-not-found') return { erro: 'E-mail nao encontrado.' }
      if (e?.code === 'auth/unauthorized-domain') return { erro: 'Domínio não autorizado no Firebase Authentication.' }
      return { erro: e?.message || 'Nao foi possivel enviar o e-mail de redefinicao. Tente novamente.' }
    }
  }, [])

  const alterarSenha = useCallback(async (_uidOuMatricula, senhaAtual, novaSenha) => {
    try {
      await alterarSenhaAtual(auth, senhaAtual, novaSenha)
      return { ok: true }
    } catch {
      return { erro: 'Senha atual incorreta ou sessao expirada.' }
    }
  }, [])

  const atualizarUsuario = useCallback(async (uidOuMatricula, dados) => {
    const alvo = usuarios.find(u => u.uid === uidOuMatricula || u.matricula === uidOuMatricula)
    const uid = alvo?.uid || (usuarioLogadoRef.current?.matricula === uidOuMatricula ? usuarioLogadoRef.current.uid : uidOuMatricula)
    const atualizacao = prepararAtualizacaoUsuario(dados)
    try {
      const usuarioAtual = usuarioLogadoRef.current
      const atualizandoViaAdmin = normalizarPerfil(usuarioAtual?.role || usuarioAtual?.perfil) === PERFIS.admin

      if (atualizandoViaAdmin) {
        const res = await chamarAdminUsuarios('atualizar', { uid: String(uid), ...atualizacao })
        if (res.erro) return res
      } else {
        await updateDoc(doc(db, 'usuarios', String(uid)), atualizacao)
      }

      if (usuarioLogadoRef.current?.uid === uid) {
        const usuarioAtualizado = normalizarUsuario({ uid, email: usuarioLogadoRef.current.email }, {
          ...usuarioLogadoRef.current,
          ...atualizacao,
        })
        setUsuarioLogado(usuarioAtualizado)
      }
      return { ok: true }
    } catch (e) {
      console.error('atualizarUsuario:', e)
      return { erro: 'Nao foi possivel salvar seus dados. Tente novamente.' }
    }
  }, [usuarios])

  async function bloquearUsuario(uidOuMatricula) {
    const u = usuarios.find(u => u.uid === uidOuMatricula || u.matricula === uidOuMatricula)
    if (!u?.uid) return
    try { await updateDoc(doc(db, 'usuarios', u.uid), { ativo: false }) } catch (e) { console.error('bloquearUsuario:', e) }
  }

  async function desbloquearUsuario(uidOuMatricula) {
    const u = usuarios.find(u => u.uid === uidOuMatricula || u.matricula === uidOuMatricula)
    if (!u?.uid) return
    try { await updateDoc(doc(db, 'usuarios', u.uid), { ativo: true }) } catch (e) { console.error('desbloquearUsuario:', e) }
  }

  async function excluirUsuario(uidOuMatricula) {
    const u = usuarios.find(u => u.uid === uidOuMatricula || u.matricula === uidOuMatricula)
    if (!u?.uid) return { erro: 'Usuario nao encontrado.' }
    try {
      const res = await chamarAdminUsuarios('excluir', { uid: u.uid })
      if (res.erro) return res
      return { ok: true }
    } catch (e) {
      console.error('excluirUsuario:', e)
      return { erro: 'Nao foi possivel excluir o usuario.' }
    }
  }

  async function resetarSenhaAdmin(uidOuMatricula) {
    const u = usuarios.find(u => u.uid === uidOuMatricula || u.matricula === uidOuMatricula || u.email === uidOuMatricula)
    const email = u?.email || uidOuMatricula
    if (!emailValida(email)) return { erro: 'E-mail invalido.' }
    try {
      await enviarLinkRedefinicaoSenha(auth, email)
      return { ok: true }
    } catch (e) {
      console.error('resetarSenhaAdmin:', e)
      if (e?.code === 'auth/user-not-found') return { erro: 'E-mail nao encontrado.' }
      return { erro: e?.message || 'Nao foi possivel enviar o link de redefinicao. Tente novamente.' }
    }
  }

  return {
    usuarioLogado, carregandoAuth, login, logout, cadastrar, cadastrarUsuario, alterarSenha, redefinirSenhaTelefone, redefinirSenhaVerificada,
    usuarios, bloquearUsuario, desbloquearUsuario, excluirUsuario, resetarSenhaAdmin, atualizarUsuario,
  }
}
