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
import { ORDEM_PERFIS, ehGestao, ehStaff, normalizarPerfil, perfisDoUsuario, perfisPorTipoEntrada } from '../../utils/perfis'
import { nomeParaVinculo } from '../../utils/nomes'

const ROLES_VALIDOS = ORDEM_PERFIS
const chavePerfilAtivo = uid => `senac-perfil-ativo-${uid}`
const chaveAcessosEntrada = uid => `senac-acessos-entrada-${uid}`
const chaveSelecaoPendente = uid => `senac-selecao-pendente-${uid}`
const chaveTipoEntrada = uid => `senac-tipo-entrada-${uid}`

function tipoEntradaDoPerfil(perfil, roles = []) {
  return roles.includes('professor') || ehStaff(perfil) ? 'equipe' : 'aluno'
}

function perfilInicialAcesso(perfis = []) {
  return perfis.includes('professor') ? 'professor' : perfis[0]
}

function lerListaSessao(chave) {
  try {
    const valor = JSON.parse(sessionStorage.getItem(chave) || 'null')
    return Array.isArray(valor) ? valor : null
  } catch {
    return null
  }
}

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

function normalizarUsuario(user, dados, perfilAtivoPreferido = '') {
  if (!user || !dados) return null
  const seguro = removerCamposSensiveis({ uid: user.uid, ...dados })
  const roles = perfisDoUsuario(seguro)
  const principal = normalizarPerfil(seguro.role || seguro.perfil || seguro.tipo || roles[0])
  const preferido = perfilAtivoPreferido ? normalizarPerfil(perfilAtivoPreferido) : ''
  const perfilAtivo = roles.includes(preferido) ? preferido : roles.includes(principal) ? principal : roles[0]
  return {
    ...seguro,
    uid: user.uid,
    email: String(seguro.email || user.email || '').trim().toLowerCase(),
    roles,
    rolePrincipal: principal,
    role: perfilAtivo,
    perfil: perfilAtivo,
    ativo: seguro.ativo !== false && seguro.bloqueado !== true,
    bloqueado: seguro.ativo === false || seguro.bloqueado === true,
  }
}

function prepararAtualizacaoUsuario(dados = {}) {
  const atualizacao = { ...dados }
  if (Object.hasOwn(atualizacao, 'roles') || Object.hasOwn(atualizacao, 'perfis')) {
    const roles = perfisDoUsuario(atualizacao.roles || atualizacao.perfis)
    atualizacao.roles = roles
    delete atualizacao.perfis
    delete atualizacao.role
    delete atualizacao.perfil
  }
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

        const perfilSalvo = sessionStorage.getItem(chavePerfilAtivo(user.uid)) || ''
        const acessosSalvos = lerListaSessao(chaveAcessosEntrada(user.uid))
        const selecaoPendente = sessionStorage.getItem(chaveSelecaoPendente(user.uid)) === '1'
        const perfilPreferido = usuarioLogadoRef.current?.uid === user.uid ? usuarioLogadoRef.current.perfil : perfilSalvo
        const usuario = normalizarUsuario(user, snap.data(), perfilPreferido)
        if (!usuario.ativo) {
          sairDoFirebase(auth)
          setUsuarioLogado(null)
          setUsuarios([])
          setCarregandoAuth(false)
          onLogout?.()
          return
        }

        const tipoEntradaSalvo = sessionStorage.getItem(chaveTipoEntrada(user.uid))
        const tipoEntradaPreferido = ['aluno', 'equipe'].includes(tipoEntradaSalvo)
          ? tipoEntradaSalvo
          : tipoEntradaDoPerfil(usuario.perfil, usuario.roles)
        const tipoEntrada = usuario.roles.includes('professor') && tipoEntradaPreferido === 'aluno'
          ? 'equipe'
          : tipoEntradaPreferido
        const fonteAcessos = Array.isArray(acessosSalvos) ? acessosSalvos : usuario.roles
        const acessosEntrada = perfisPorTipoEntrada(fonteAcessos, tipoEntrada)
        const acessosValidos = acessosEntrada.length ? acessosEntrada : perfisPorTipoEntrada(usuario.roles, tipoEntrada)
        const perfilAtivoBase = acessosValidos.includes(usuario.perfil) ? usuario.perfil : (perfilInicialAcesso(acessosValidos) || usuario.perfil)
        const perfilAtivo = perfilAtivoBase === 'aluno' && acessosValidos.includes('professor') ? 'professor' : perfilAtivoBase
        sessionStorage.setItem(chaveTipoEntrada(user.uid), tipoEntrada)
        sessionStorage.setItem(chaveAcessosEntrada(user.uid), JSON.stringify(acessosValidos))
        sessionStorage.setItem(chavePerfilAtivo(user.uid), perfilAtivo)

        setUsuarioLogado(atual => ({
          ...usuario,
          role: perfilAtivo,
          perfil: perfilAtivo,
          acessosEntrada: acessosValidos,
          selecaoAcessoPendente: atual?.uid === user.uid ? atual.selecaoAcessoPendente : selecaoPendente,
        }))
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

  const login = useCallback(async (email, senha, tipoEntrada = 'aluno') => {
    try {
      const user = await entrarComEmail(auth, email, senha)
      const snap = await getDoc(doc(db, 'usuarios', user.uid))

      if (!snap.exists()) {
        await sairDoFirebase(auth)
        return { erro: 'Conta não configurada no banco de dados. Procure o suporte.' }
      }

      const usuarioBase = normalizarUsuario(user, snap.data())
      const tipoEntradaNormalizado = tipoEntrada === 'equipe' ? 'equipe' : 'aluno'
      const acessosPermitidos = perfisPorTipoEntrada(usuarioBase.roles, tipoEntradaNormalizado)

      if (usuarioBase.roles.some(role => !ROLES_VALIDOS.includes(role))) {
        await sairDoFirebase(auth)
        return { erro: 'Perfil de acesso inválido.' }
      }

      if (!usuarioBase.ativo) {
        await sairDoFirebase(auth)
        return { erro: 'Sua conta está desativada ou bloqueada.', bloqueado: true }
      }

      if (tipoEntradaNormalizado === 'aluno' && usuarioBase.roles.includes('professor')) {
        await sairDoFirebase(auth)
        return { erro: 'Professores devem entrar pelo Acesso da Equipe.' }
      }

      if (acessosPermitidos.length === 0) {
        await sairDoFirebase(auth)
        return { erro: tipoEntrada === 'equipe'
          ? 'Este acesso é exclusivo para a equipe. Use a opção Entrar como Aluno.'
          : 'Este acesso é exclusivo para alunos. Para entrar como equipe, use a opção Acesso da Equipe.' }
      }

      const precisaEscolher = acessosPermitidos.length > 1
      const usuario = {
        ...normalizarUsuario(user, snap.data(), perfilInicialAcesso(acessosPermitidos)),
        acessosEntrada: acessosPermitidos,
        selecaoAcessoPendente: precisaEscolher,
      }
      sessionStorage.setItem(chavePerfilAtivo(user.uid), perfilInicialAcesso(acessosPermitidos))
      sessionStorage.setItem(chaveAcessosEntrada(user.uid), JSON.stringify(acessosPermitidos))
      sessionStorage.setItem(chaveSelecaoPendente(user.uid), precisaEscolher ? '1' : '0')
      sessionStorage.setItem(chaveTipoEntrada(user.uid), tipoEntradaNormalizado)
      usuarioLogadoRef.current = usuario
      setUsuarioLogado(usuario)
      return { usuario, precisaEscolher, perfisDisponiveis: acessosPermitidos }
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
    const uid = usuarioLogadoRef.current?.uid
    if (uid) {
      sessionStorage.removeItem(chavePerfilAtivo(uid))
      sessionStorage.removeItem(chaveAcessosEntrada(uid))
      sessionStorage.removeItem(chaveSelecaoPendente(uid))
      sessionStorage.removeItem(chaveTipoEntrada(uid))
    }
    await sairDoFirebase(auth)
    setUsuarioLogado(null)
    setUsuarios([])
    onLogout?.()
  }, [onLogout])

  const trocarAcesso = useCallback((perfil) => {
    const perfilNormalizado = normalizarPerfil(perfil)
    const atual = usuarioLogadoRef.current
    const tipoEntradaSalvo = atual ? sessionStorage.getItem(chaveTipoEntrada(atual.uid)) : ''
    const tipoEntrada = ['aluno', 'equipe'].includes(tipoEntradaSalvo)
      ? tipoEntradaSalvo
      : tipoEntradaDoPerfil(atual?.perfil)
    const acessosEntrada = atual ? perfisPorTipoEntrada(atual.roles, tipoEntrada) : []
    if (!atual || !acessosEntrada.includes(perfilNormalizado)) {
      return { erro: 'Você não tem permissão para acessar esta área.' }
    }
    sessionStorage.setItem(chavePerfilAtivo(atual.uid), perfilNormalizado)
    sessionStorage.setItem(chaveAcessosEntrada(atual.uid), JSON.stringify(acessosEntrada))
    sessionStorage.setItem(chaveSelecaoPendente(atual.uid), '0')
    sessionStorage.setItem(chaveTipoEntrada(atual.uid), tipoEntrada)
    const atualizado = { ...atual, role: perfilNormalizado, perfil: perfilNormalizado, acessosEntrada, selecaoAcessoPendente: false }
    usuarioLogadoRef.current = atualizado
    setUsuarioLogado(atualizado)
    return { ok: true, perfil: perfilNormalizado }
  }, [])

  const cadastrar = useCallback(async ({ nome, matricula, senha, curso, telefone = '', email = '', alergias = [] }) => {
    const matriculaLimpa = normalizarMatricula(matricula)
    const emailLimpo = String(email || '').trim().toLowerCase()
    if (!nome?.trim()) return { erro: 'Informe seu nome.' }
    if (nomeParaVinculo(nome).split(' ').filter(Boolean).length < 2) return { erro: 'Informe seu nome completo, incluindo o sobrenome.' }
    if (!emailValida(emailLimpo)) return { erro: 'Informe um e-mail valido.' }
    if (!matriculaAlunoValida(matriculaLimpa)) return { erro: 'Use uma matricula numerica com 4 a 12 digitos.' }
    if (usuarios.find(u => u.matricula === matriculaLimpa)) return { erro: 'Matricula ja cadastrada.' }

    try {
      const user = await criarContaComEmail(auth, { email: emailLimpo, senha })
      const novo = {
        uid: user.uid,
        nome: nome.trim(),
        nomeVinculo: nomeParaVinculo(nome),
        email: emailLimpo,
        matricula: matriculaLimpa,
        role: 'aluno',
        perfil: 'aluno',
        roles: ['aluno'],
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

  const cadastrarUsuario = useCallback(async ({ nome, matricula, senha, perfil, role, roles, curso = '', telefone = '', email = '' }) => {
    const matriculaLimpa = normalizarMatricula(matricula)
    const emailLimpo = String(email || '').trim().toLowerCase()
    const rolesLimpos = perfisDoUsuario(Array.isArray(roles) && roles.length ? roles : [role || perfil || 'aluno'])
    const roleLimpo = rolesLimpos[0]
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
        roles: rolesLimpos,
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
      const atualizandoViaAdmin = ehGestao(usuarioAtual?.role || usuarioAtual?.perfil)

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
        }, usuarioLogadoRef.current.perfil)
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
    usuarioLogado, carregandoAuth, login, logout, trocarAcesso, cadastrar, cadastrarUsuario, alterarSenha, redefinirSenhaTelefone, redefinirSenhaVerificada,
    usuarios, bloquearUsuario, desbloquearUsuario, excluirUsuario, resetarSenhaAdmin, atualizarUsuario,
  }
}
