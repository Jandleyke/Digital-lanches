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

export function useLanchoneteConfig(usuarioLogado) {
  const [lanchoneteConfig, setLanchoneteConfig] = useState(PADRAO)

  useEffect(() => {
    if (!usuarioLogado) return
    const ref = doc(db, 'configuracoes', 'lanchonete')
    return onSnapshot(ref, snap => {
      setLanchoneteConfig(snap.exists() ? { ...PADRAO, ...snap.data() } : PADRAO)
    }, err => console.error('[Firestore] configuracoes/lanchonete:', err))
  }, [usuarioLogado])

  async function salvarLanchoneteConfig(dados) {
    const ref = doc(db, 'configuracoes', 'lanchonete')
    await setDoc(ref, { ...PADRAO, ...dados, atualizadoEm: Date.now() }, { merge: true })
  }

  return { lanchoneteConfig, salvarLanchoneteConfig }
}
