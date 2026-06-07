import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useApp } from '../contexts/AppContext'
import { useIsMobile } from '../utils/useIsMobile'
import ChatAssistente from './ChatAssistente'
import {
  Utensils, ShoppingCart, Package, Heart,
  ClipboardList, Monitor, LayoutDashboard, ChefHat,
  ArchiveRestore, TrendingUp, Megaphone, Users,
  LogOut, ExternalLink, Download,
} from 'lucide-react'

export default function Layout({ children, titulo }) {
  const { usuarioLogado, logout, qtdCarrinho, carregando } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const isMobile = useIsMobile()
  const [installPrompt, setInstallPrompt] = useState(null)
  const [showInstall, setShowInstall] = useState(false)

  useEffect(() => {
    function handler(e) {
      e.preventDefault()
      setInstallPrompt(e)
      setShowInstall(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function handleInstall() {
    if (!installPrompt) return
    installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') setShowInstall(false)
    setInstallPrompt(null)
  }

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const navAluno = [
    { icon: Utensils,     labelFull: 'Cardápio',  path: '/aluno/cardapio' },
    { icon: ShoppingCart, labelFull: 'Carrinho',  path: '/aluno/carrinho', badge: qtdCarrinho },
    { icon: Package,      labelFull: 'Pedidos',   path: '/aluno/pedidos' },
    { icon: Heart,        labelFull: 'Favoritos', path: '/aluno/favoritos' },
  ]

  const navCozinha = [
    { icon: ClipboardList, labelFull: 'Fila',      path: '/cozinha' },
    { icon: Monitor,       labelFull: 'Painel TV', path: '/painel', externo: true },
  ]

  const navAdmin = [
    { icon: LayoutDashboard, labelFull: 'Dashboard',  path: '/admin' },
    { icon: ChefHat,         labelFull: 'Produtos',   path: '/admin/produtos' },
    { icon: ArchiveRestore,  labelFull: 'Estoque',    path: '/admin/estoque' },
    { icon: TrendingUp,      labelFull: 'Relatórios', path: '/admin/relatorios' },
    { icon: Megaphone,       labelFull: 'Avisos',     path: '/admin/avisos' },
    { icon: Users,           labelFull: 'Usuários',   path: '/admin/usuarios' },
  ]

  const navGerente = [
    { icon: LayoutDashboard, labelFull: 'Dashboard',  path: '/admin' },
    { icon: TrendingUp,      labelFull: 'Relatórios', path: '/admin/relatorios' },
    { icon: Megaphone,       labelFull: 'Avisos',     path: '/admin/avisos' },
    { icon: Users,           labelFull: 'Usuários',   path: '/admin/usuarios' },
  ]

  const navMap = { aluno: navAluno, cozinha: navCozinha, admin: navAdmin, gerente: navGerente }
  const navItems = navMap[usuarioLogado?.perfil] || []

  const avatarSize = isMobile ? 34 : 40
  const primeiroNome = usuarioLogado?.nome?.split(' ')[0] || ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {showInstall && (
        <div style={{ background: '#003D7C', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 1rem', gap: 12, zIndex: 999 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Download size={18} color="#F47920" />
            <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>Instale o app no seu celular para acesso rápido!</span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button onClick={handleInstall} style={{ background: '#F47920', color: '#fff', border: 'none', borderRadius: 8, padding: '0.4rem 0.9rem', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>Instalar</button>
            <button onClick={() => setShowInstall(false)} style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none', borderRadius: 8, padding: '0.4rem 0.7rem', cursor: 'pointer', fontSize: '0.82rem' }}>✕</button>
          </div>
        </div>
      )}
      <header style={{ ...s.header, padding: isMobile ? '0.75rem 1rem' : '1rem 1.75rem' }}>

        {/* ── Brand ── */}
        <div style={s.brand}>
          <div>
            <div style={{ ...s.brandName, fontSize: isMobile ? '1.25rem' : '1.6rem' }}>
              Senac <span style={s.brandOrange}>Lanches</span>
            </div>
            {!isMobile && <div style={s.brandTagline}>Sua cantina digital</div>}
          </div>
        </div>

        {/* ── User section ── */}
        {usuarioLogado && (
          <div style={s.userRow}>
            {!isMobile && (
              <div style={s.greeting}>
                Olá, <strong style={{ color: '#fff', fontWeight: 700 }}>{primeiroNome}</strong>
              </div>
            )}
            <button
              onClick={() => navigate(usuarioLogado.perfil === 'aluno' ? '/aluno/perfil' : usuarioLogado.perfil === 'cozinha' ? '/cozinha/perfil' : '/admin/perfil')}
              style={{ ...s.avatarBtn, width: avatarSize, height: avatarSize }}
              title="Meu perfil"
            >
              {usuarioLogado.fotoPerfil
                ? <img src={usuarioLogado.fotoPerfil} alt={usuarioLogado.nome} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                : <span style={{ fontWeight: 800, fontSize: isMobile ? '0.85rem' : '0.95rem', color: '#fff' }}>{usuarioLogado.nome?.[0]?.toUpperCase()}</span>
              }
            </button>
            <button onClick={handleLogout} style={{ ...s.sairBtn, padding: isMobile ? '6px 10px' : '7px 14px', fontSize: isMobile ? '0.78rem' : '0.83rem' }} title="Sair">
              {isMobile ? <LogOut size={15} /> : <><LogOut size={14} style={{ marginRight: 5 }} /> Sair</>}
            </button>
          </div>
        )}
      </header>

      <div style={{ display: 'flex', flex: 1 }}>
        {!isMobile && (
          <nav style={s.sidebar}>
            <div style={s.sidebarSection}>Menu</div>
            {navItems.map(item => {
              const ativo = location.pathname === item.path
              const Icon = item.icon
              return (
                <button key={item.path}
                  onClick={() => item.externo ? window.open(item.path, '_blank') : navigate(item.path)}
                  style={{ ...s.navItem, ...(ativo ? s.navItemAtivo : {}) }}>
                  <div style={s.navItemInner}>
                    <Icon size={16} strokeWidth={ativo ? 2.5 : 1.8} />
                    <span>{item.labelFull}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {item.badge > 0 && <span style={s.badge}>{item.badge}</span>}
                    {item.externo && <ExternalLink size={11} style={{ color: '#CBD5E1' }} />}
                  </div>
                </button>
              )
            })}
          </nav>
        )}

        <main style={{ ...s.main, padding: isMobile ? '0.6rem 0.65rem' : '1rem', paddingBottom: isMobile ? '5.2rem' : '1.5rem' }}>
          {titulo && <h2 style={{ ...s.paginaTitulo, fontSize: isMobile ? '1.15rem' : '1.4rem' }}>{titulo}</h2>}

          {carregando ? (
            <div style={s.spinner}>
              <div style={s.spinnerCircle} />
              <p style={{ color: '#94A3B8', fontSize: '0.88rem' }}>Conectando ao servidor...</p>
            </div>
          ) : children}
        </main>
      </div>

      {isMobile && (
        <nav style={s.bottomNav}>
          {navItems.map(item => {
            const ativo = location.pathname === item.path
            const Icon = item.icon
            const semLabel = navItems.length > 4
            return (
              <button key={item.path}
                onClick={() => item.externo ? window.open(item.path, '_blank') : navigate(item.path)}
                style={s.bottomItem}>
                <div style={{ ...s.bottomIconBox, ...(ativo ? s.bottomIconBoxAtivo : {}), height: semLabel ? 38 : 32, width: semLabel ? 38 : 46, borderRadius: semLabel ? '50%' : 10 }}>
                  <Icon size={semLabel ? 20 : 20} strokeWidth={ativo ? 2.5 : 1.7} color={ativo ? '#003D7C' : '#94A3B8'} />
                  {item.badge > 0 && <span style={s.bottomBadge}>{item.badge}</span>}
                </div>
                {!semLabel && (
                  <span style={{ ...s.bottomLabel, color: ativo ? '#003D7C' : '#94A3B8', fontWeight: ativo ? 700 : 400 }}>
                    {item.labelFull}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      )}

      {usuarioLogado && <ChatAssistente />}
    </div>
  )
}

const s = {
  /* ── Header ── */
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    background: 'linear-gradient(135deg, #0B1E45 0%, #003D7C 55%, #004F9E 100%)',
    borderBottom: '3px solid #F47920',
    boxShadow: '0 4px 24px rgba(0,0,0,0.28)',
    position: 'sticky', top: 0, zIndex: 100, color: '#fff',
  },
  brand: { display: 'flex', alignItems: 'center', gap: 12 },
  brandIconBox: {
    background: 'rgba(244,121,32,0.15)', border: '1px solid rgba(244,121,32,0.3)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  brandName: { fontWeight: 900, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1.1 },
  brandOrange: { color: '#F47920' },
  brandTagline: { fontSize: '0.68rem', color: 'rgba(255,255,255,0.45)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, marginTop: 1 },
  userRow: { display: 'flex', alignItems: 'center', gap: 10 },
  greeting: { color: 'rgba(255,255,255,0.75)', fontSize: '0.86rem', fontWeight: 500, whiteSpace: 'nowrap' },
  avatarBtn: {
    borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)',
    background: 'linear-gradient(135deg,#F47920,#FF9A4D)',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', flexShrink: 0, padding: 0,
    boxShadow: '0 0 0 3px rgba(244,121,32,0.25)',
  },
  sairBtn: {
    background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
    color: '#fff', borderRadius: 10, cursor: 'pointer', fontWeight: 600,
    display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
    fontFamily: 'inherit',
  },

  /* ── Sidebar (desktop) ── */
  sidebar: {
    width: 215, background: '#F8FAFF', borderRight: '1px solid #E4EAFF',
    display: 'flex', flexDirection: 'column', padding: '1rem 0.65rem', gap: 2, flexShrink: 0,
  },
  sidebarSection: {
    fontSize: '0.65rem', fontWeight: 700, color: '#CBD5E1',
    letterSpacing: '0.1em', textTransform: 'uppercase',
    padding: '0.5rem 0.75rem 0.75rem',
  },
  navItem: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0.68rem 0.85rem', borderRadius: 12,
    color: '#64748B', fontWeight: 500, fontSize: '0.88rem',
    textAlign: 'left', border: 'none', background: 'transparent',
    cursor: 'pointer', transition: 'background 0.15s, color 0.15s',
    fontFamily: 'inherit',
  },
  navItemAtivo: {
    background: '#EEF2FF', color: '#1D4ED8', fontWeight: 700,
    borderLeft: '3px solid #1D4ED8', paddingLeft: 'calc(0.85rem - 3px)',
  },
  navItemInner: { display: 'flex', alignItems: 'center', gap: 10 },
  badge: {
    background: '#003D7C', color: '#fff', borderRadius: 999,
    padding: '0.15rem 0.6rem', fontSize: '0.7rem', fontWeight: 700,
  },

  /* ── Main ── */
  main: { flex: 1, padding: '1rem', overflowY: 'auto', minWidth: 0 },
  paginaTitulo: { fontWeight: 800, color: '#1A202C', marginBottom: '1rem' },
  spinner: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 1rem', gap: 12 },
  spinnerCircle: { width: 36, height: 36, border: '4px solid #E2E8F0', borderTop: '4px solid #003D7C', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },

  /* ── Bottom nav (mobile) ── */
  bottomNav: {
    position: 'fixed', bottom: 0, left: 0, right: 0,
    background: '#fff', borderTop: '1px solid rgba(226,232,240,0.9)',
    display: 'flex', zIndex: 100,
    boxShadow: '0 -6px 30px rgba(15,23,42,0.09)',
    paddingBottom: 6, paddingTop: 4,
  },
  bottomItem: {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'flex-start', gap: 3,
    background: 'transparent', border: 'none', cursor: 'pointer',
    padding: '4px 2px 0', fontFamily: 'inherit',
  },
  bottomIconBox: {
    width: 46, height: 32, borderRadius: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    position: 'relative', transition: 'background 0.2s',
  },
  bottomIconBoxAtivo: {
    background: '#EEF2FF',
  },
  bottomLabel: { fontSize: '0.63rem', letterSpacing: '0.01em' },
  bottomBadge: {
    position: 'absolute', top: -5, right: -7,
    background: '#F47920', color: '#fff', borderRadius: 999,
    padding: '1px 5px', fontSize: '0.58rem', fontWeight: 700,
    border: '2px solid #fff', lineHeight: 1.4,
  },
}
