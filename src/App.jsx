import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AppProvider, useApp } from './contexts/AppContext'
import { auth } from './firebase'
import { ToastProvider } from './contexts/ToastContext'
import Login from './pages/Login'
import Cadastro from './pages/Cadastro'
import Welcome from './pages/Welcome'
import { caminhoInicialPorPerfil, normalizarPerfil } from './utils/perfis'

// Se um chunk falhar ao carregar (ex: aba ficou aberta entre dois deploys e o
// arquivo antigo não existe mais), recarrega a página uma vez em vez de travar.
function lazyComRecarga(importFn) {
  return lazy(() =>
    importFn().catch((erro) => {
      const chave = 'senac-chunk-reload'
      if (!sessionStorage.getItem(chave)) {
        sessionStorage.setItem(chave, '1')
        window.location.reload()
        return new Promise(() => {})
      }
      throw erro
    })
  )
}

// Carregadas sob demanda: cada perfil só baixa as telas que de fato usa
const Cardapio = lazyComRecarga(() => import('./pages/student/Cardapio'))
const Carrinho = lazyComRecarga(() => import('./pages/student/Carrinho'))
const Pedidos = lazyComRecarga(() => import('./pages/student/Pedidos'))
const Favoritos = lazyComRecarga(() => import('./pages/student/Favoritos'))
const Historico = lazyComRecarga(() => import('./pages/student/Historico'))
const Perfil = lazyComRecarga(() => import('./pages/student/Perfil'))
const Cozinha = lazyComRecarga(() => import('./pages/kitchen/Cozinha'))
const Dashboard = lazyComRecarga(() => import('./pages/admin/Dashboard'))
const Produtos = lazyComRecarga(() => import('./pages/admin/Produtos'))
const Estoque = lazyComRecarga(() => import('./pages/admin/Estoque'))
const Relatorios = lazyComRecarga(() => import('./pages/admin/Relatorios'))
const Painel = lazyComRecarga(() => import('./pages/Painel'))
const Vendedor = lazyComRecarga(() => import('./pages/vendor/Vendedor'))
const Avisos = lazyComRecarga(() => import('./pages/admin/Avisos'))
const Usuarios = lazyComRecarga(() => import('./pages/admin/Usuarios'))
const PerfilStaff = lazyComRecarga(() => import('./pages/PerfilStaff'))
const ResetPassword = lazyComRecarga(() => import('./pages/ResetPassword'))
const NotFound = lazyComRecarga(() => import('./pages/NotFound'))
const AvisosProfessor = lazyComRecarga(() => import('./pages/professor/AvisosProfessor'))
const EscolherAcesso = lazyComRecarga(() => import('./pages/EscolherAcesso'))
const EMAIL_AUTORIZADO = 'menesesjan02@gmail.com'

function CarregandoRota() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#071832' }}>
      <div style={{ width: 36, height: 36, border: '3px solid rgba(255,255,255,0.1)', borderTop: '3px solid #F47920', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )
}

function Protegida({ children, perfil, permitirSelecao = false }) {
  const { usuarioLogado, carregandoAuth } = useApp()
  if (carregandoAuth) return <CarregandoRota />
  if (!usuarioLogado) return <Navigate to="/" />
  if (usuarioLogado.selecaoAcessoPendente && !permitirSelecao) return <Navigate to="/escolher-acesso" replace />

  if (perfil) {
    const perfisPermitidos = Array.isArray(perfil) ? perfil : [perfil]
    const perfilAtual = normalizarPerfil(usuarioLogado.perfil)
    if (!perfisPermitidos.map(normalizarPerfil).includes(perfilAtual)) {
      return (
        <div style={{ minHeight: '100vh', background: '#F1F5F9', display: 'grid', placeItems: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 8, padding: 24, maxWidth: 420, textAlign: 'center', boxShadow: '0 12px 32px rgba(15,23,42,0.1)' }}>
            <h1 style={{ color: '#0F172A', fontSize: '1.15rem' }}>Acesso não permitido</h1>
            <p style={{ color: '#64748B' }}>Você não tem permissão para acessar esta área.</p>
            <a href={caminhoInicialPorPerfil(usuarioLogado.perfil)} style={{ color: '#fff', background: '#003D7C', borderRadius: 8, padding: '10px 14px', display: 'inline-block', textDecoration: 'none', fontWeight: 800 }}>Voltar ao meu painel</a>
          </div>
        </div>
      )
    }
  }

  return children
}

function WelcomeRoute() {
  const { usuarioLogado, carregandoAuth } = useApp()
  if (!carregandoAuth && usuarioLogado) return <Navigate to={usuarioLogado.selecaoAcessoPendente ? '/escolher-acesso' : caminhoInicialPorPerfil(usuarioLogado.perfil)} replace />
  return <Welcome />
}

function AppRoutes() {
  const { usuarioLogado, carregandoAuth, logout } = useApp()
  const location = useLocation()
  const rotaLogin = ['/login', '/login-gerencial'].includes(location.pathname)

  if (carregandoAuth) return <CarregandoRota />
  const emailAtual = String(auth.currentUser?.email || '').trim().toLowerCase()
  if (emailAtual !== EMAIL_AUTORIZADO && !(rotaLogin && !usuarioLogado)) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#071832', color: '#fff', textAlign: 'center' }}>
        <div>
          <h1 style={{ margin: '0 0 12px', fontSize: '1.6rem' }}>Acesso restrito</h1>
          <p style={{ margin: '0 auto 20px', maxWidth: 360, color: '#CBD5E1' }}>Este aplicativo está disponível somente para o proprietário.</p>
          {usuarioLogado
            ? <button onClick={logout} style={{ border: 0, borderRadius: 8, padding: '10px 16px', background: '#F47920', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Sair</button>
            : <a href="/login-gerencial" style={{ color: '#fff', fontWeight: 700 }}>Acesso do responsável</a>}
        </div>
      </div>
    )
  }

  return (
    <Suspense fallback={<CarregandoRota />}>
      <Routes>
        <Route path="/" element={<WelcomeRoute />} />
        <Route path="/login" element={<Login />} />
        <Route path="/login-gerencial" element={<Login gerencial />} />
        <Route path="/cadastro" element={<Cadastro />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/escolher-acesso" element={<Protegida permitirSelecao><EscolherAcesso /></Protegida>} />

        <Route path="/aluno/cardapio"  element={<Protegida perfil={['aluno', 'professor']}><Cardapio /></Protegida>} />
        <Route path="/aluno/carrinho"  element={<Protegida perfil={['aluno', 'professor']}><Carrinho /></Protegida>} />
        <Route path="/aluno/pedidos"   element={<Protegida perfil={['aluno', 'professor']}><Pedidos /></Protegida>} />
        <Route path="/aluno/historico" element={<Protegida perfil={['aluno', 'professor']}><Historico /></Protegida>} />
        <Route path="/aluno/favoritos" element={<Protegida perfil={['aluno', 'professor']}><Favoritos /></Protegida>} />
        <Route path="/aluno/perfil"    element={<Protegida perfil={['aluno', 'professor']}><Perfil /></Protegida>} />
        <Route path="/professor/avisos" element={<Protegida perfil="professor"><AvisosProfessor /></Protegida>} />

        <Route path="/cozinha"           element={<Protegida perfil="cozinha"><Cozinha /></Protegida>} />
        <Route path="/cozinha/pedidos"   element={<Navigate to="/cozinha" replace />} />
        <Route path="/cozinha/producao"  element={<Protegida perfil="cozinha"><Cozinha /></Protegida>} />
        <Route path="/cozinha/cardapio"  element={<Protegida perfil="cozinha"><Cozinha /></Protegida>} />
        <Route path="/cozinha/estoque"   element={<Protegida perfil="cozinha"><Cozinha /></Protegida>} />
        <Route path="/cozinha/avisos"    element={<Protegida perfil="cozinha"><Cozinha /></Protegida>} />
        <Route path="/cozinha/perfil"    element={<Protegida perfil="cozinha"><PerfilStaff /></Protegida>} />
        <Route path="/vendedor"          element={<Protegida perfil="vendedor"><Vendedor /></Protegida>} />
        <Route path="/vendedor/balcao"   element={<Protegida perfil="vendedor"><Vendedor /></Protegida>} />
        <Route path="/vendedor/pedidos"  element={<Protegida perfil="vendedor"><Vendedor /></Protegida>} />
        <Route path="/vendedor/atendimento" element={<Protegida perfil="vendedor"><Vendedor /></Protegida>} />
        <Route path="/vendedor/produtos" element={<Protegida perfil="vendedor"><Produtos /></Protegida>} />
        <Route path="/vendedor/estoque"  element={<Protegida perfil="vendedor"><Vendedor /></Protegida>} />
        <Route path="/vendedor/vendas"   element={<Protegida perfil="vendedor"><Vendedor /></Protegida>} />
        <Route path="/vendedor/avisos"   element={<Protegida perfil="vendedor"><Vendedor /></Protegida>} />
        <Route path="/vendedor/perfil"   element={<Protegida perfil="vendedor"><PerfilStaff /></Protegida>} />
        <Route path="/painel"            element={<Protegida perfil={['cozinha', 'vendedor']}><Painel /></Protegida>} />
        <Route path="/vendedora"         element={<Navigate to="/vendedor" replace />} />
        <Route path="/vendedora/perfil"  element={<Navigate to="/vendedor/perfil" replace />} />
        <Route path="/lanchonete"        element={<Navigate to="/vendedor" replace />} />
        <Route path="/cozinheiro"        element={<Navigate to="/cozinha" replace />} />
        <Route path="/producao"          element={<Navigate to="/cozinha" replace />} />

        <Route path="/admin"            element={<Protegida perfil={['admin', 'gerente']}><Dashboard /></Protegida>} />
        <Route path="/admin/produtos"   element={<Protegida perfil={['admin', 'gerente']}><Produtos /></Protegida>} />
        <Route path="/admin/estoque"    element={<Protegida perfil={['admin', 'gerente']}><Estoque /></Protegida>} />
        <Route path="/admin/lanchonete" element={<Navigate to="/admin/perfil" replace />} />
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
      <ToastProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </ToastProvider>
    </AppProvider>
  )
}
