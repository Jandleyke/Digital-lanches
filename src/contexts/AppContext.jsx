import { createContext, useContext, useState, useCallback } from 'react'
import { collection, doc, setDoc, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import { useCarrinho } from './hooks/useCarrinho'
import { useProdutos } from './hooks/useProdutos'
import { useAvisos } from './hooks/useAvisos'
import { usePedidos } from './hooks/usePedidos'
import { useAuth } from './hooks/useAuth'

const AppContext = createContext()

export function AppProvider({ children }) {
  const [fbStatus, setFbStatus] = useState('conectando')
  const [fbDebug, setFbDebug] = useState('')
  const carregando = fbStatus === 'conectando'

  const onFbStatus = useCallback((status, debug) => { setFbStatus(status); setFbDebug(debug) }, [])

  const { carrinho, setCarrinho, adicionarAoCarrinho, removerDoCarrinho, limparCarrinho, totalCarrinho, qtdCarrinho, favoritos, toggleFavorito } = useCarrinho()
  const { produtos, atualizarProduto, adicionarProduto, removerProduto, removerProdutos } = useProdutos()
  const {
    usuarioLogado, login, logout, cadastrar, cadastrarUsuario, alterarSenha, redefinirSenhaTelefone, redefinirSenhaVerificada,
    usuarios, bloquearUsuario, desbloquearUsuario, excluirUsuario, resetarSenhaAdmin, atualizarUsuario,
  } = useAuth({ onLogout: limparCarrinho })
  const { avisos, criarAviso, editarAviso, excluirAviso } = useAvisos(usuarioLogado)
  const {
    pedidos, fazerPedido, atualizarStatusPedido, cancelarPedido, editarPedido, limparEntregues, avaliarPedido, tempoEstimado,
  } = usePedidos({ usuarioLogado, produtos, carrinho, setCarrinho, onFbStatus })

  // ─── Debug ────────────────────────────────────────────────────────────────
  async function testarFirebase() {
    setFbDebug('testando...')
    try {
      await setDoc(doc(db, '_debug', 'ping'), { ts: Date.now() })
      const snap = await getDocs(collection(db, '_debug'))
      setFbDebug(`ESCRITA OK | LEITURA OK (${snap.size} docs)`)
      setFbStatus('ok')
    } catch (e) { setFbDebug('FALHA: ' + e.code + ' – ' + e.message); setFbStatus('erro') }
  }

  return (
    <AppContext.Provider value={{
      usuarioLogado, login, logout, cadastrar, cadastrarUsuario, alterarSenha, redefinirSenhaTelefone, redefinirSenhaVerificada,
      usuarios, bloquearUsuario, desbloquearUsuario, excluirUsuario, resetarSenhaAdmin,
      atualizarUsuario,
      produtos, atualizarProduto, adicionarProduto, removerProduto, removerProdutos,
      pedidos, fazerPedido, atualizarStatusPedido, cancelarPedido, editarPedido, limparEntregues, avaliarPedido,
      avisos, criarAviso, editarAviso, excluirAviso,
      fbStatus, fbDebug, testarFirebase, carregando,
      carrinho, adicionarAoCarrinho, removerDoCarrinho, limparCarrinho, totalCarrinho, qtdCarrinho,
      favoritos, toggleFavorito, tempoEstimado,
    }}>
      {children}
    </AppContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- hook do contexto fica junto do provider por convenção; só afeta o fast refresh em dev
export const useApp = () => useContext(AppContext)
