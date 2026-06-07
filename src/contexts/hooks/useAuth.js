import { useState, useEffect, useRef, useCallback } from 'react'
import { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import { usuarios as usuariosIniciais } from '../../data/mockData'
import { carregarSessao, salvarSessao } from '../../utils/storage'

export function useAuth({ onLogout }) {
  const [usuarioLogado, setUsuarioLogado] = useState(() => carregarSessao())
  const [usuarios, setUsuarios] = useState([])
  const usuarioLogadoRef = useRef(usuarioLogado)

  useEffect(() => { usuarioLogadoRef.current = usuarioLogado }, [usuarioLogado])
  useEffect(() => { salvarSessao(usuarioLogado) }, [usuarioLogado])

  // Não dá para escopar esta coleção por perfil: o login é feito comparando
  // matrícula/senha no client (não usa Firebase Auth), então a lista completa
  // precisa estar disponível mesmo antes de alguém estar logado.
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'usuarios'), async (snap) => {
      if (snap.empty) {
        for (const u of usuariosIniciais) {
          await setDoc(doc(db, 'usuarios', String(u.matricula)), { ...u, bloqueado: false })
        }
        setUsuarios(usuariosIniciais.map(u => ({ ...u, bloqueado: false })))
      } else {
        const lista = snap.docs.map(d => d.data())
        // Garante que usuários de staff sempre existem no Firestore
        const staffPadrao = usuariosIniciais.filter(u => u.perfil !== 'aluno')
        for (const s of staffPadrao) {
          if (!lista.find(u => u.matricula === s.matricula)) {
            await setDoc(doc(db, 'usuarios', String(s.matricula)), { ...s, bloqueado: false })
          }
        }
        // Auto-logout se conta foi bloqueada pelo admin
        const logadoAtual = usuarioLogadoRef.current
        if (logadoAtual) {
          const meusDados = lista.find(u => u.matricula === logadoAtual.matricula)
          if (meusDados?.bloqueado) {
            setUsuarioLogado(null)
            onLogout?.()
          }
        }
        setUsuarios(lista)
      }
    }, err => console.error('[Firestore] usuarios:', err))
    return unsub
  }, [onLogout])

  const login = useCallback((matricula, senha) => {
    const u = usuarios.find(u => u.matricula === matricula && u.senha === senha)
    if (!u) return null
    if (u.bloqueado) return { bloqueado: true }
    setUsuarioLogado(u)
    return u
  }, [usuarios])

  const logout = useCallback(() => { setUsuarioLogado(null); onLogout?.() }, [onLogout])

  const cadastrar = useCallback(async ({ nome, matricula, senha, curso, telefone = '', email = '', alergias = [] }) => {
    if (usuarios.find(u => u.matricula === matricula)) return { erro: 'Matrícula já cadastrada.' }
    try {
      const novo = { id: Date.now(), nome, matricula, senha, perfil: 'aluno', curso, telefone: telefone || '', email: email || '', fotoPerfil: '', alergias: alergias || [], bloqueado: false }
      await setDoc(doc(db, 'usuarios', String(matricula)), novo)
      return { ok: true }
    } catch { return { erro: 'Erro ao cadastrar. Tente novamente.' } }
  }, [usuarios])

  const cadastrarUsuario = useCallback(async ({ nome, matricula, senha, perfil, curso = '', telefone = '', email = '' }) => {
    if (usuarios.find(u => u.matricula === matricula)) return { erro: 'Matrícula já cadastrada.' }
    try {
      const novo = { id: Date.now(), nome, matricula, senha, perfil, curso, telefone, email, fotoPerfil: '', alergias: [], bloqueado: false }
      await setDoc(doc(db, 'usuarios', String(matricula)), novo)
      return { ok: true }
    } catch { return { erro: 'Erro ao cadastrar. Tente novamente.' } }
  }, [usuarios])

  const redefinirSenhaTelefone = useCallback(async (matricula, telefone, novaSenha) => {
    const u = usuarios.find(u => u.matricula === matricula)
    if (!u) return { erro: 'Matrícula não encontrada.' }
    if (!u.telefone) return { erro: 'Esta conta não possui telefone cadastrado.' }
    const telLimpo = telefone.replace(/\D/g, '')
    const uTelLimpo = u.telefone.replace(/\D/g, '')
    if (telLimpo !== uTelLimpo) return { erro: 'Telefone não corresponde ao cadastro.' }
    try {
      await updateDoc(doc(db, 'usuarios', String(matricula)), { senha: novaSenha })
      return { ok: true }
    } catch { return { erro: 'Erro ao redefinir senha. Tente novamente.' } }
  }, [usuarios])

  // Chamado após o Firebase já ter verificado o telefone via SMS
  const redefinirSenhaVerificada = useCallback(async (matricula, novaSenha) => {
    const u = usuarios.find(u => u.matricula === matricula)
    if (!u) return { erro: 'Matrícula não encontrada.' }
    try {
      await updateDoc(doc(db, 'usuarios', String(matricula)), { senha: novaSenha })
      return { ok: true }
    } catch { return { erro: 'Erro ao redefinir senha. Tente novamente.' } }
  }, [usuarios])

  const alterarSenha = useCallback(async (matricula, senhaAtual, novaSenha) => {
    const u = usuarios.find(u => u.matricula === matricula)
    if (!u || u.senha !== senhaAtual) return { erro: 'Senha atual incorreta.' }
    try {
      await updateDoc(doc(db, 'usuarios', String(matricula)), { senha: novaSenha })
      setUsuarioLogado(prev => ({ ...prev, senha: novaSenha }))
      return { ok: true }
    } catch { return { erro: 'Erro ao alterar senha. Tente novamente.' } }
  }, [usuarios])

  const atualizarUsuario = useCallback(async (matricula, dados) => {
    try {
      await updateDoc(doc(db, 'usuarios', String(matricula)), dados)
      if (usuarioLogadoRef.current?.matricula === matricula) {
        setUsuarioLogado(prev => ({ ...prev, ...dados }))
      }
      return { ok: true }
    } catch (e) {
      console.error('atualizarUsuario:', e)
      return { erro: 'Não foi possível salvar seus dados. Tente novamente.' }
    }
  }, [])

  // ─── Gestão de usuários (admin) ───────────────────────────────────────────
  async function bloquearUsuario(matricula) {
    try { await updateDoc(doc(db, 'usuarios', String(matricula)), { bloqueado: true }) } catch (e) { console.error('bloquearUsuario:', e) }
  }
  async function desbloquearUsuario(matricula) {
    try { await updateDoc(doc(db, 'usuarios', String(matricula)), { bloqueado: false }) } catch (e) { console.error('desbloquearUsuario:', e) }
  }
  async function excluirUsuario(matricula) {
    try { await deleteDoc(doc(db, 'usuarios', String(matricula))) } catch (e) { console.error('excluirUsuario:', e) }
  }
  async function resetarSenhaAdmin(matricula, novaSenha) {
    try { await updateDoc(doc(db, 'usuarios', String(matricula)), { senha: novaSenha }) } catch (e) { console.error('resetarSenhaAdmin:', e) }
  }

  return {
    usuarioLogado, login, logout, cadastrar, cadastrarUsuario, alterarSenha, redefinirSenhaTelefone, redefinirSenhaVerificada,
    usuarios, bloquearUsuario, desbloquearUsuario, excluirUsuario, resetarSenhaAdmin, atualizarUsuario,
  }
}
