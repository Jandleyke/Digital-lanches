import { useEffect, useState } from 'react'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from '../../firebase'

const PADRAO = {
  nome: 'Senac Lanches',
  endereco: '',
  bairro: '',
  cidade: '',
  cep: '',
  telefone: '',
  email: '',
  responsavel: '',
  diasFuncionamento: [],
  horarioAbertura: '',
  horarioFechamento: '',
}

function normalizarDia(valor) {
  return String(valor || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function normalizarConfig(dados = {}) {
  const dias = Array.isArray(dados.diasFuncionamento)
    ? [...new Set(dados.diasFuncionamento.map(normalizarDia).filter(Boolean))]
    : []

  return {
    ...PADRAO,
    ...dados,
    diasFuncionamento: dias,
    horarioAbertura: String(dados.horarioAbertura || '').slice(0, 5),
    horarioFechamento: String(dados.horarioFechamento || '').slice(0, 5),
  }
}

export function useLanchoneteConfig(usuarioLogado) {
  const [lanchoneteConfig, setLanchoneteConfig] = useState(PADRAO)
  const idUsuario = usuarioLogado?.uid || usuarioLogado?.matricula || ''

  useEffect(() => {
    if (!idUsuario) return
    const ref = doc(db, 'configuracoes', 'lanchonete')
    return onSnapshot(ref, snap => {
      setLanchoneteConfig(snap.exists() ? normalizarConfig(snap.data()) : PADRAO)
    }, err => console.error('[Firestore] configuracoes/lanchonete:', err))
  }, [idUsuario])

  async function salvarLanchoneteConfig(dados) {
    const ref = doc(db, 'configuracoes', 'lanchonete')
    const anterior = lanchoneteConfig
    const atualizada = normalizarConfig({ ...dados, atualizadoEm: Date.now() })

    setLanchoneteConfig(atualizada)
    try {
      await setDoc(ref, atualizada, { merge: true })
      return atualizada
    } catch (erro) {
      setLanchoneteConfig(anterior)
      throw erro
    }
  }

  return { lanchoneteConfig, salvarLanchoneteConfig }
}
