import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider, useApp } from './contexts/AppContext'
import Login from './pages/Login'
import Cadastro from './pages/Cadastro'
import { caminhoInicialPorPerfil, normalizarPerfil } from './utils/perfis'

// Carregadas sob demanda: cada perfil só baixa as telas que de fato usa
const Cardapio = lazy(() => import('./pages/student/Cardapio'))
const Carrinho = lazy(() => import('./pages/student/Carrinho'))
const Pedidos = lazy(() => import('./pages/student/Pedidos'))
const Favoritos = lazy(() => import('./pages/student/Favoritos'))
const Historico = lazy(() => import('./pages/student/Historico'))
const Perfil = lazy(() => import('./pages/student/Perfil'))
const Cozinha = lazy(() => import('./pages/kitchen/Cozinha'))
const Dashboard = lazy(() => import('./pages/admin/Dashboard'))
const Produtos = lazy(() => import('./pages/admin/Produtos'))
const Estoque = lazy(() => import('./pages/admin/Estoque'))
const Relatorios = lazy(() => import('./pages/admin/Relatorios'))
const Lanchonete = lazy(() => import('./pages/admin/Lanchonete'))
const Painel = lazy(() => import('./pages/Painel'))
const Vendedor = lazy(() => import('./pages/vendor/Vendedor'))
const Avisos = lazy(() => import('./pages/admin/Avisos'))
const Usuarios = lazy(() => import('./pages/admin/Usuarios'))
const PerfilStaff = lazy(() => import('./pages/PerfilStaff'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const NotFound = lazy(() => import('./pages/NotFound'))
const AvisosProfessor = lazy(() => import('./pages/professor/AvisosProfessor'))

function CarregandoRota() {
  return <div style={{ padding: '2rem', textAlign: 'center', color: '#64748B' }}>Carregando…</div>
}

function Protegida({ children, perfil }) {
  const { usuarioLogado, carregandoAuth } = useApp()
  if (carregandoAuth) return <CarregandoRota />
  if (!usuarioLogado) return <Navigate to="/login" />

  if (perfil) {
    const perfisPermitidos = Array.isArray(perfil) ? perfil : [perfil]
    const perfilAtual = normalizarPerfil(usuarioLogado.perfil)
    if (!perfisPermitidos.map(normalizarPerfil).includes(perfilAtual)) {
      return <Navigate to={caminhoInicialPorPerfil(usuarioLogado.role || usuarioLogado.perfil)} replace />
    }
  }

  return children
}

function AppRoutes() {
  const { usuarioLogado } = useApp()
  const caminhoInicial = usuarioLogado
    ? caminhoInicialPorPerfil(usuarioLogado.perfil)
    : '/login'

  return (
    <Suspense fallback={<CarregandoRota />}>
    <Routes>
      <Route path="/" element={<Navigate to={caminhoInicial} replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/login-gerencial" element={<Login gerencial />} />
      <Route path="/cadastro" element={<Cadastro />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route path="/aluno/cardapio"  element={<Protegida perfil={['aluno', 'professor']}><Cardapio /></Protegida>} />
      <Route path="/aluno/carrinho"  element={<Protegida perfil={['aluno', 'professor']}><Carrinho /></Protegida>} />
      <Route path="/aluno/pedidos"   element={<Protegida perfil={['aluno', 'professor']}><Pedidos /></Protegida>} />
      <Route path="/aluno/historico" element={<Protegida perfil={['aluno', 'professor']}><Historico /></Protegida>} />
      <Route path="/aluno/favoritos" element={<Protegida perfil={['aluno', 'professor']}><Favoritos /></Protegida>} />
      <Route path="/aluno/perfil"    element={<Protegida perfil={['aluno', 'professor']}><Perfil /></Protegida>} />
      <Route path="/professor/avisos" element={<Protegida perfil="professor"><AvisosProfessor /></Protegida>} />

      <Route path="/cozinha" element={<Protegida perfil="cozinha"><Cozinha /></Protegida>} />
      <Route path="/cozinha/pedidos" element={<Protegida perfil="cozinha"><Cozinha /></Protegida>} />
      <Route path="/cozinha/producao" element={<Protegida perfil="cozinha"><Cozinha /></Protegida>} />
      <Route path="/cozinha/cardapio" element={<Protegida perfil="cozinha"><Cozinha /></Protegida>} />
      <Route path="/cozinha/avisos" element={<Protegida perfil="cozinha"><Cozinha /></Protegida>} />
      <Route path="/cozinha/perfil" element={<Protegida perfil="cozinha"><PerfilStaff /></Protegida>} />
      <Route path="/vendedor" element={<Protegida perfil="vendedor"><Vendedor /></Protegida>} />
      <Route path="/vendedor/pedidos" element={<Protegida perfil="vendedor"><Vendedor /></Protegida>} />
      <Route path="/vendedor/produtos" element={<Protegida perfil="vendedor"><Produtos /></Protegida>} />
      <Route path="/vendedor/estoque" element={<Protegida perfil="vendedor"><Vendedor /></Protegida>} />
      <Route path="/vendedor/vendas" element={<Protegida perfil="vendedor"><Vendedor /></Protegida>} />
      <Route path="/vendedor/avisos" element={<Protegida perfil="vendedor"><Vendedor /></Protegida>} />
      <Route path="/vendedor/perfil" element={<Protegida perfil="vendedor"><PerfilStaff /></Protegida>} />
      <Route path="/painel" element={<Protegida perfil={['cozinha', 'vendedor']}><Painel /></Protegida>} />
      <Route path="/vendedora" element={<Navigate to="/vendedor" replace />} />
      <Route path="/vendedora/perfil" element={<Navigate to="/vendedor/perfil" replace />} />
      <Route path="/lanchonete" element={<Navigate to="/vendedor" replace />} />
      <Route path="/cozinheiro" element={<Navigate to="/cozinha" replace />} />
      <Route path="/producao" element={<Navigate to="/cozinha" replace />} />

      <Route path="/admin"            element={<Protegida perfil="admin"><Dashboard /></Protegida>} />
      <Route path="/admin/produtos"   element={<Protegida perfil="admin"><Produtos /></Protegida>} />
      <Route path="/admin/estoque"    element={<Protegida perfil="admin"><Estoque /></Protegida>} />
      <Route path="/admin/lanchonete" element={<Protegida perfil="admin"><Lanchonete /></Protegida>} />
      <Route path="/admin/relatorios" element={<Protegida perfil="admin"><Relatorios /></Protegida>} />
      <Route path="/admin/avisos"     element={<Protegida perfil="admin"><Avisos /></Protegida>} />
      <Route path="/admin/usuarios"   element={<Protegida perfil="admin"><Usuarios /></Protegida>} />
      <Route path="/admin/perfil"     element={<Protegida perfil="admin"><PerfilStaff /></Protegida>} />
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
