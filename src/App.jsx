import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider, useApp } from './contexts/AppContext'
import Login from './pages/Login'
import Cadastro from './pages/Cadastro'

// Carregadas sob demanda: cada perfil só baixa as telas que de fato usa
const Cardapio = lazy(() => import('./pages/student/Cardapio'))
const Carrinho = lazy(() => import('./pages/student/Carrinho'))
const Pedidos = lazy(() => import('./pages/student/Pedidos'))
const Favoritos = lazy(() => import('./pages/student/Favoritos'))
const Historico = lazy(() => import('./pages/student/Historico'))
const Perfil = lazy(() => import('./pages/student/Perfil'))
const FilaPedidos = lazy(() => import('./pages/kitchen/FilaPedidos'))
const Dashboard = lazy(() => import('./pages/admin/Dashboard'))
const Produtos = lazy(() => import('./pages/admin/Produtos'))
const Estoque = lazy(() => import('./pages/admin/Estoque'))
const Relatorios = lazy(() => import('./pages/admin/Relatorios'))
const Painel = lazy(() => import('./pages/Painel'))
const Avisos = lazy(() => import('./pages/admin/Avisos'))
const Usuarios = lazy(() => import('./pages/admin/Usuarios'))
const PerfilStaff = lazy(() => import('./pages/PerfilStaff'))
const NotFound = lazy(() => import('./pages/NotFound'))

function CarregandoRota() {
  return <div style={{ padding: '2rem', textAlign: 'center', color: '#64748B' }}>Carregando…</div>
}

function Protegida({ children, perfil }) {
  const { usuarioLogado } = useApp()
  if (!usuarioLogado) return <Navigate to="/login" />

  if (perfil) {
    const perfisPermitidos = Array.isArray(perfil) ? perfil : [perfil]
    if (!perfisPermitidos.includes(usuarioLogado.perfil)) return <Navigate to="/login" />
  }

  return children
}

function AppRoutes() {
  const { usuarioLogado } = useApp()
  const caminhoInicial = usuarioLogado
    ? usuarioLogado.perfil === 'aluno' ? '/aluno/cardapio'
      : usuarioLogado.perfil === 'cozinha' ? '/cozinha'
      : '/admin'  // admin e gerente
    : '/login'

  return (
    <Suspense fallback={<CarregandoRota />}>
    <Routes>
      <Route path="/" element={<Navigate to={caminhoInicial} replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/cadastro" element={<Cadastro />} />

      <Route path="/aluno/cardapio"  element={<Protegida perfil="aluno"><Cardapio /></Protegida>} />
      <Route path="/aluno/carrinho"  element={<Protegida perfil="aluno"><Carrinho /></Protegida>} />
      <Route path="/aluno/pedidos"   element={<Protegida perfil="aluno"><Pedidos /></Protegida>} />
      <Route path="/aluno/historico" element={<Protegida perfil="aluno"><Historico /></Protegida>} />
      <Route path="/aluno/favoritos" element={<Protegida perfil="aluno"><Favoritos /></Protegida>} />
      <Route path="/aluno/perfil"    element={<Protegida perfil="aluno"><Perfil /></Protegida>} />

      <Route path="/cozinha"        element={<Protegida perfil="cozinha"><FilaPedidos /></Protegida>} />
      <Route path="/cozinha/perfil" element={<Protegida perfil="cozinha"><PerfilStaff /></Protegida>} />
      <Route path="/painel" element={<Protegida perfil={['cozinha', 'admin', 'gerente']}><Painel /></Protegida>} />

      <Route path="/admin"            element={<Protegida perfil={['admin', 'gerente']}><Dashboard /></Protegida>} />
      <Route path="/admin/produtos"   element={<Protegida perfil="admin"><Produtos /></Protegida>} />
      <Route path="/admin/estoque"    element={<Protegida perfil="admin"><Estoque /></Protegida>} />
      <Route path="/admin/relatorios" element={<Protegida perfil={['admin', 'gerente']}><Relatorios /></Protegida>} />
      <Route path="/admin/avisos"     element={<Protegida perfil={['admin', 'gerente']}><Avisos /></Protegida>} />
      <Route path="/admin/usuarios"   element={<Protegida perfil={['admin', 'gerente']}><Usuarios /></Protegida>} />
      <Route path="/admin/perfil"     element={<Protegida perfil={['admin', 'gerente']}><PerfilStaff /></Protegida>} />
      <Route path="/404" element={<NotFound />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppProvider>
  )
}
