import { useState, useEffect, useRef, useCallback } from 'react'
import { doc, getDoc, onSnapshot, updateDoc, collection } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { auth, db } from '../../firebase'
import { salvarSessao } from '../../utils/storage'
import {
  alterarSenhaAtual,
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

async function chamarUsuarioAtual(acao, payload = {}) {
  const token = await auth.currentUser?.getIdToken()
  if (!token) return { erro: 'Sessao expirada. Faca login novamente.' }

  const resposta = await fetch('/api/usuarioAtual', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ acao, ...payload }),
  })
  const dados = await resposta.json().catch(() => ({}))
  if (!resposta.ok) return { erro: dados.erro || 'Nao foi possivel atualizar seu cadastro.' }
  return dados
}

async function chamarCadastroAluno(payload = {}) {
  const resposta = await fetch('/api/cadastroAluno', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const dados = await resposta.json().catch(() => ({}))
  if (!resposta.ok) return { ...dados, erro: dados.erro || 'Não foi possível criar o cadastro.' }
  return dados
}

async function chamarRecuperarUsuarioAuth() {
  const token = await auth.currentUser?.getIdToken()
  if (!token) return { erro: 'Sessao expirada. Faca login novamente.' }
  const resposta = await fetch('/api/recuperarUsuarioAuth', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  })
  const dados = await resposta.json().catch(() => ({}))
  if (!resposta.ok) return { erro: dados.erro || 'Nao foi possivel recuperar seu cadastro.' }
  return dados
}

function cadastroPrecisaNormalizacao(dados = {}, user) {
  const roles = perfisDoUsuario(dados)
  return dados.uid !== user.uid
    || dados.userId !== user.uid
    || String(dados.email || '').trim().toLowerCase() !== String(user.email || '').trim().toLowerCase()
    || !dados.role
    || !dados.perfil
    || !Array.isArray(dados.roles)
    || dados.roles.length === 0
    || !roles.includes(normalizarPerfil(dados.role || dados.perfil || roles[0]))
    || !Object.hasOwn(dados, 'ativo')
    || !Object.hasOwn(dados, 'bloqueado')
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
  const normalizacaoTentadaRef = useRef(new Set())
  const usuarioAtualUid = usuarioLogado?.uid || ''
  const usuarioAtualRole = usuarioLogado?.role || ''

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

        const dadosUsuario = snap.data()
        const chaveNormalizacao = `${user.uid}:${snap.updateTime?.toMillis?.() || ''}`
        if (cadastroPrecisaNormalizacao(dadosUsuario, user) && !normalizacaoTentadaRef.current.has(chaveNormalizacao)) {
          normalizacaoTentadaRef.current.add(chaveNormalizacao)
          chamarUsuarioAtual('normalizar').then(res => {
            if (res.erro) console.error('[Auth] normalizar cadastro:', res.erro)
          })
        }

        const perfilSalvo = sessionStorage.getItem(chavePerfilAtivo(user.uid)) || ''
        const acessosSalvos = lerListaSessao(chaveAcessosEntrada(user.uid))
        const selecaoPendente = sessionStorage.getItem(chaveSelecaoPendente(user.uid)) === '1'
        const perfilPreferido = usuarioLogadoRef.current?.uid === user.uid ? usuarioLogadoRef.current.perfil : perfilSalvo
        const usuario = normalizarUsuario(user, dadosUsuario, perfilPreferido)
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
    if (!usuarioAtualUid || !ehStaff(usuarioAtualRole)) return
    const unsub = onSnapshot(collection(db, 'usuarios'), snap => {
      setUsuarios(snap.docs.map(d => normalizarUsuario({ uid: d.id, email: d.data().email }, d.data())))
    }, err => console.error('[Firestore] usuarios:', err))
    return unsub
  }, [usuarioAtualUid, usuarioAtualRole])

  const login = useCallback(async (email, senha, tipoEntrada = 'aluno') => {
    try {
      const user = await entrarComEmail(auth, email, senha)
      let snap = await getDoc(doc(db, 'usuarios', user.uid))

      if (!snap.exists()) {
        const recuperado = await chamarRecuperarUsuarioAuth()
        if (recuperado.erro) {
          await sairDoFirebase(auth)
          return { erro: recuperado.erro || 'Conta nao configurada no banco de dados. Procure o suporte.' }
        }
        snap = await getDoc(doc(db, 'usuarios', user.uid))
        if (!snap.exists()) {
          await sairDoFirebase(auth)
          return { erro: 'Conta recuperada no Auth, mas ainda nao apareceu no banco. Tente entrar novamente.' }
        }
      }

      const dadosLogin = snap.data()
      const emailCadastro = String(dadosLogin.email || '').trim().toLowerCase()
      if (emailValida(emailCadastro) && emailCadastro !== String(user.email || '').trim().toLowerCase()) {
        const resSyncEmail = await chamarUsuarioAtual('atualizar', { email: emailCadastro })
        if (resSyncEmail.erro) console.error('[Auth] sincronizar email no login:', resSyncEmail.erro)
        else await auth.currentUser?.reload()
      }

      const usuarioBase = normalizarUsuario(auth.currentUser || user, dadosLogin)
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
        ...normalizarUsuario(auth.currentUser || user, dadosLogin, perfilInicialAcesso(acessosPermitidos)),
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
    if (!emailValida(emailLimpo)) return { erro: 'Informe um e-mail válido.' }
    if (!matriculaAlunoValida(matriculaLimpa)) return { erro: 'Use uma matrícula numérica com 4 a 12 dígitos.' }

    try {
      const res = await chamarCadastroAluno({
        nome: nome.trim(),
        email: emailLimpo,
        matricula: matriculaLimpa,
        senha,
        curso,
        telefone: telefone || '',
        alergias: alergias || [],
      })
      if (res.erro) return res
      return { ok: true }
    } catch (e) {
      console.error('cadastrar:', e)
      return { erro: 'Erro ao cadastrar. Verifique os dados e tente novamente.' }
    }
  }, [])

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
      let dadosConfirmados = atualizacao

      if (usuarioAtual?.uid === uid) {
        const res = await chamarUsuarioAtual('atualizar', atualizacao)
        if (res.erro) return res
        dadosConfirmados = res.usuario || atualizacao
      } else if (atualizandoViaAdmin) {
        const res = await chamarAdminUsuarios('atualizar', { uid: String(uid), ...atualizacao })
        if (res.erro) return res
      } else {
        await updateDoc(doc(db, 'usuarios', String(uid)), atualizacao)
      }

      const aplicarLocal = usuario => ({ ...usuario, ...dadosConfirmados, uid: usuario.uid || uid })
      setUsuarios(lista => {
        const existe = lista.some(u => u.uid === uid)
        if (existe) return lista.map(u => u.uid === uid ? aplicarLocal(u) : u)
        return usuarioLogadoRef.current?.uid === uid ? [aplicarLocal(usuarioLogadoRef.current)] : lista
      })

      if (usuarioLogadoRef.current?.uid === uid) {
        const usuarioAtualizado = normalizarUsuario({ uid, email: usuarioLogadoRef.current.email }, {
          ...usuarioLogadoRef.current,
          ...dadosConfirmados,
        }, usuarioLogadoRef.current.perfil)
        usuarioLogadoRef.current = usuarioAtualizado
        setUsuarioLogado(usuarioAtualizado)
      }
      if (Object.hasOwn(atualizacao, 'email') && auth.currentUser?.uid === uid) {
        auth.currentUser.reload()
          .then(() => auth.currentUser?.getIdToken(true))
          .catch(e => console.error('refresh email auth:', e))
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
