import { createContext, useContext, useState, useCallback } from 'react'
import { collection, doc, setDoc, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import { useCarrinho } from './hooks/useCarrinho'
import { useProdutos } from './hooks/useProdutos'
import { useAvisos } from './hooks/useAvisos'
import { usePedidos } from './hooks/usePedidos'
import { useAuth } from './hooks/useAuth'
import { useLanchoneteConfig } from './hooks/useLanchoneteConfig'
import { useProducaoDiaria } from './hooks/useProducaoDiaria'
import { useAvaliacoes } from './hooks/useAvaliacoes'

const AppContext = createContext()

export function AppProvider({ children }) {
  const [fbStatus, setFbStatus] = useState('conectando')
  const [fbDebug, setFbDebug] = useState('')

  const onFbStatus = useCallback((status, debug) => { setFbStatus(status); setFbDebug(debug) }, [])

  const {
    usuarioLogado, carregandoAuth, login, logout: sair, cadastrar, cadastrarUsuario, alterarSenha, redefinirSenhaTelefone, redefinirSenhaVerificada,
    usuarios, bloquearUsuario, desbloquearUsuario, excluirUsuario, resetarSenhaAdmin, atualizarUsuario,
  } = useAuth({})
  const carregando = carregandoAuth || fbStatus === 'conectando'
  const { carrinho, setCarrinho, adicionarAoCarrinho, removerDoCarrinho, limparCarrinho, totalCarrinho, qtdCarrinho, favoritos, toggleFavorito } = useCarrinho(usuarioLogado)
  const { produtos, atualizarProduto, adicionarProduto, adicionarProdutos, removerProduto, removerProdutos } = useProdutos(usuarioLogado)
  const logout = useCallback(() => { limparCarrinho(); sair() }, [limparCarrinho, sair])
  const { avisos, criarAviso, editarAviso, excluirAviso, marcarAvisoLido, responderAviso } = useAvisos(usuarioLogado)
  const { avaliacoes, resumoPorProduto: resumoAvaliacoesPorProduto, refetchAvaliacoes } = useAvaliacoes(usuarioLogado)
  const { producaoDiaria, producaoHoje, salvarProducao, atualizarProducao, removerProducao, registrarDesperdicio, ajustarProducaoVendedor } = useProducaoDiaria(usuarioLogado)
  const { lanchoneteConfig, salvarLanchoneteConfig } = useLanchoneteConfig(usuarioLogado)
  const {
    pedidos, fazerPedido, atualizarStatusPedido, cancelarPedido, editarPedido, limparEntregues, avaliarPedido: _avaliarPedido, marcarPedidoPago, tempoEstimado,
  } = usePedidos({ usuarioLogado, produtos, carrinho, setCarrinho, onFbStatus })

  const avaliarPedido = useCallback(async (...args) => {
    const res = await _avaliarPedido(...args)
    if (res?.ok) refetchAvaliacoes()
    return res
  }, [_avaliarPedido, refetchAvaliacoes])

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
      carregandoAuth,
      usuarios, bloquearUsuario, desbloquearUsuario, excluirUsuario, resetarSenhaAdmin,
      atualizarUsuario,
      produtos, atualizarProduto, adicionarProduto, adicionarProdutos, removerProduto, removerProdutos,
      pedidos, fazerPedido, atualizarStatusPedido, cancelarPedido, editarPedido, limparEntregues, avaliarPedido, marcarPedidoPago,
      avisos, criarAviso, editarAviso, excluirAviso, marcarAvisoLido, responderAviso,
      avaliacoes, resumoAvaliacoesPorProduto,
      producaoDiaria, producaoHoje, salvarProducao, atualizarProducao, removerProducao, registrarDesperdicio, ajustarProducaoVendedor,
      lanchoneteConfig, salvarLanchoneteConfig,
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
