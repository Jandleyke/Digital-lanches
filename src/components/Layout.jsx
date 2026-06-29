import { useMemo, useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useApp } from '../contexts/AppContext'
import { useIsMobile } from '../utils/useIsMobile'
import ChatAssistente from './ChatAssistente'
import {
  Utensils, ShoppingCart, Package, Heart,
  ClipboardList, LayoutDashboard, ChefHat,
  ArchiveRestore, TrendingUp, Megaphone, Users,
  LogOut, ExternalLink, Download, PanelLeftClose, PanelLeftOpen, X, Bell, UserCircle, ShoppingBasket, MoreHorizontal, MessageCircle,
} from 'lucide-react'
import { ehOperacional, normalizarPerfil } from '../utils/perfis'
import { suportaNotificacao, permissaoNotificacao, solicitarPermissaoNotificacao } from '../utils/notifications'
import { suportaPush, inscreverPush } from '../utils/push'

export default function Layout({ children, titulo }) {
  const { usuarioLogado, logout, qtdCarrinho, totalCarrinho, carregando, avisos } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const isMobile = useIsMobile()
  const [installPrompt, setInstallPrompt] = useState(null)
  const [showInstall, setShowInstall] = useState(() => {
    const jaInstalado = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone
    const dispensado = localStorage.getItem('senac-install-banner-dismissed') === '1'
    return !jaInstalado && !dispensado
  })
  const [installInfo, setInstallInfo] = useState('')
  const [menuAberto, setMenuAberto] = useState(true)
  const [menuMobileAberto, setMenuMobileAberto] = useState(false)
  const [notifDismissed, setNotifDismissed] = useState(() => localStorage.getItem('senac-notif-banner-dismissed') === '1')

  useEffect(() => {
    if (!isMobile || !menuMobileAberto) return undefined
    const overflowAnterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = overflowAnterior }
  }, [isMobile, menuMobileAberto])

  useEffect(() => {
    function handler(e) {
      e.preventDefault()
      setInstallPrompt(e)
      setShowInstall(true)
    }
    function installedHandler() {
      localStorage.setItem('senac-install-banner-dismissed', '1')
      setShowInstall(false)
      setInstallPrompt(null)
    }
    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', installedHandler)
    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installedHandler)
    }
  }, [])

  useEffect(() => {
    if (!usuarioLogado || !suportaNotificacao() || !suportaPush()) return
    const perfil = normalizarPerfil(usuarioLogado.perfil)
    if (!['aluno', 'professor', 'admin', 'gerente', 'vendedor', 'cozinha'].includes(perfil)) return
    if (permissaoNotificacao() === 'granted') inscreverPush(usuarioLogado)
  }, [usuarioLogado])

  const podeMostrarNotifBanner = !notifDismissed && usuarioLogado && suportaNotificacao() && suportaPush()
    && ['aluno', 'professor', 'admin', 'gerente', 'vendedor', 'cozinha'].includes(normalizarPerfil(usuarioLogado.perfil))
    && permissaoNotificacao() === 'default'

  async function ativarNotificacoes() {
    const permissao = await solicitarPermissaoNotificacao()
    setNotifDismissed(true)
    localStorage.setItem('senac-notif-banner-dismissed', '1')
    if (permissao === 'granted') await inscreverPush(usuarioLogado)
  }

  function fecharNotifBanner() {
    localStorage.setItem('senac-notif-banner-dismissed', '1')
    setNotifDismissed(true)
  }

  async function handleInstall() {
    if (!installPrompt) {
      setInstallInfo('Use o menu do navegador e escolha Instalar app ou Adicionar a tela inicial.')
      return
    }
    installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') {
      localStorage.setItem('senac-install-banner-dismissed', '1')
      setShowInstall(false)
    }
    setInstallPrompt(null)
  }

  function fecharInstallBanner() {
    localStorage.setItem('senac-install-banner-dismissed', '1')
    setShowInstall(false)
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
    { icon: UserCircle,   labelFull: 'Perfil',    path: '/aluno/perfil' },
  ]

  const navProfessor = [
    { icon: Utensils, labelFull: 'Cardápio', path: '/aluno/cardapio' },
    { icon: ShoppingCart, labelFull: 'Carrinho', path: '/aluno/carrinho', badge: qtdCarrinho },
    { icon: Package, labelFull: 'Pedidos', path: '/aluno/pedidos' },
    { icon: Megaphone, labelFull: 'Avisos', path: '/professor/avisos' },
    { icon: Heart, labelFull: 'Favoritos', path: '/aluno/favoritos' },
    { icon: UserCircle, labelFull: 'Perfil', path: '/aluno/perfil' },
  ]

  const navCozinha = [
    { icon: LayoutDashboard, labelFull: 'Dashboard', path: '/cozinha' },
    { icon: Utensils, labelFull: 'Produção', path: '/cozinha/producao' },
    { icon: ChefHat, labelFull: 'Cardápio', path: '/cozinha/cardapio' },
    { icon: ArchiveRestore, labelFull: 'Estoque', path: '/cozinha/estoque' },
    { icon: Megaphone, labelFull: 'Avisos', path: '/cozinha/avisos' },
    { icon: Users, labelFull: 'Perfil', path: '/cozinha/perfil' },
  ]

  const navVendedor = [
    { icon: LayoutDashboard, labelFull: 'Dashboard', path: '/vendedor' },
    { icon: ShoppingBasket, labelFull: 'Pedido Balcão', path: '/vendedor/balcao' },
    { icon: ClipboardList, labelFull: 'Pedidos', path: '/vendedor/pedidos' },
    { icon: MessageCircle, labelFull: 'Atendimento', path: '/vendedor/atendimento' },
    { icon: ChefHat, labelFull: 'Produtos', path: '/vendedor/produtos' },
    { icon: ArchiveRestore, labelFull: 'Estoque', path: '/vendedor/estoque' },
    { icon: TrendingUp, labelFull: 'Vendas', path: '/vendedor/vendas' },
    { icon: Megaphone, labelFull: 'Avisos', path: '/vendedor/avisos' },
    { icon: Users, labelFull: 'Perfil', path: '/vendedor/perfil' },
  ]

  const navAdmin = [
    { icon: LayoutDashboard, labelFull: 'Dashboard',  path: '/admin' },
    { icon: ChefHat,         labelFull: 'Produtos',   path: '/admin/produtos' },
    { icon: ArchiveRestore,  labelFull: 'Estoque',    path: '/admin/estoque' },
    { icon: TrendingUp,      labelFull: 'Relatórios', path: '/admin/relatorios' },
    { icon: Megaphone,       labelFull: 'Avisos',     path: '/admin/avisos' },
    { icon: Users,           labelFull: 'Usuários',   path: '/admin/usuarios' },
    { icon: UserCircle,      labelFull: 'Perfil',     path: '/admin/perfil' },
  ]

  const navGerente = [
    { icon: LayoutDashboard, labelFull: 'Dashboard',  path: '/admin' },
    { icon: TrendingUp,      labelFull: 'Relatórios', path: '/admin/relatorios' },
    { icon: Megaphone,       labelFull: 'Avisos',     path: '/admin/avisos' },
    { icon: Users,           labelFull: 'Usuários',   path: '/admin/usuarios' },
    { icon: UserCircle,      labelFull: 'Perfil',     path: '/admin/perfil' },
  ]

  const perfilAtual = normalizarPerfil(usuarioLogado?.perfil)
  const leitorId = usuarioLogado?.uid || usuarioLogado?.matricula
  const avisosNaoLidos = useMemo(() => {
    function destinoAviso(aviso) {
      const destino = aviso.destino || aviso.destinatario || 'todos'
      if (destino === 'alunos') return 'aluno'
      if (destino === 'vendedora') return 'vendedor'
      return destino
    }
    function avisoVisivel(aviso) {
      const destino = destinoAviso(aviso)
      if (perfilAtual === 'admin' || perfilAtual === 'gerente' || perfilAtual === 'professor') return true
      if (perfilAtual === 'aluno') return ['todos', 'aluno'].includes(destino)
      return destino === 'todos' || destino === perfilAtual
    }
    if (!leitorId) return 0
    return (avisos || []).filter(aviso => {
      const lidoPor = Array.isArray(aviso.lidoPor) ? aviso.lidoPor : []
      return avisoVisivel(aviso) && aviso.status !== 'inativo' && !lidoPor.includes(leitorId)
    }).length
  }, [avisos, leitorId, perfilAtual])
  const navMap = { aluno: navAluno, professor: navProfessor, cozinha: navCozinha, vendedor: navVendedor, admin: navAdmin, gerente: navGerente }
  const navItems = (navMap[perfilAtual] || []).map(item => item.labelFull === 'Avisos' ? { ...item, badge: avisosNaoLidos, alertBadge: true } : item)
  const navPrincipal = navItems.length > 5 ? navItems.slice(0, 4) : navItems
  const navAdicional = navItems.length > 5 ? navItems.slice(4) : []
  const badgeMais = navAdicional.reduce((total, item) => total + Number(item.badge || 0), 0)

  function navegarPara(item) {
    setMenuMobileAberto(false)
    if (item.externo) window.open(item.path, '_blank', 'noopener,noreferrer')
    else navigate(item.path)
  }

  const mostrarCartBar = isMobile && qtdCarrinho > 0 && ['aluno', 'professor'].includes(perfilAtual)

  const avatarSize = isMobile ? 32 : 40
  const primeiroNome = usuarioLogado?.nome?.split(' ')[0] || ''

  return (
    <div style={s.appShell}>
      {podeMostrarNotifBanner && (
        <div style={{ background: '#0B1E45', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 1rem', gap: 12, zIndex: 999 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
            <Bell size={18} color="#F47920" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: isMobile ? '0.76rem' : '0.88rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: isMobile ? 'normal' : 'nowrap', lineHeight: 1.25 }}>Ativar notificacoes de promocoes e novidades?</span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button onClick={ativarNotificacoes} style={{ background: '#F47920', color: '#fff', border: 'none', borderRadius: 8, padding: '0.4rem 0.9rem', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>Ativar</button>
            <button aria-label="Fechar aviso de notificacoes" onClick={fecharNotifBanner} style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none', borderRadius: 8, padding: '0.4rem 0.7rem', cursor: 'pointer', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>
          </div>
        </div>
      )}
      {showInstall && (
        <div style={{ background: '#003D7C', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 1rem', gap: 12, zIndex: 999 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
            <Download size={18} color="#F47920" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: isMobile ? '0.76rem' : '0.88rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: isMobile ? 'normal' : 'nowrap', lineHeight: 1.25 }}>{installInfo || 'Instale o app para acesso rapido!'}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button onClick={handleInstall} style={{ background: '#F47920', color: '#fff', border: 'none', borderRadius: 8, padding: '0.4rem 0.9rem', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>Instalar</button>
            <button aria-label="Fechar aviso de instalacao" onClick={fecharInstallBanner} style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none', borderRadius: 8, padding: '0.4rem 0.7rem', cursor: 'pointer', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>
          </div>
        </div>
      )}
      <header style={{ ...s.header, padding: isMobile ? '0.62rem 0.75rem' : '1rem 1.75rem' }}>

        {/* ── Brand ── */}
        <div style={s.brand}>
          <div>
            <div style={{ ...s.brandName, fontSize: isMobile ? '1.12rem' : '1.6rem' }}>
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
              onClick={() => navigate(['aluno', 'professor'].includes(perfilAtual) ?'/aluno/perfil' : ehOperacional(usuarioLogado.perfil) ?`/${perfilAtual}/perfil` : '/admin/perfil')}
              style={{ ...s.avatarBtn, width: avatarSize, height: avatarSize }}
              aria-label="Abrir meu perfil"
              title="Meu perfil"
            >
              {usuarioLogado.fotoPerfil
                ?<img src={usuarioLogado.fotoPerfil} alt={usuarioLogado.nome} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                : <span style={{ fontWeight: 800, fontSize: isMobile ?'0.85rem' : '0.95rem', color: '#fff' }}>{usuarioLogado.nome?.[0]?.toUpperCase()}</span>
              }
            </button>
            <button onClick={handleLogout} style={{ ...s.sairBtn, padding: isMobile ? '5px 8px' : '7px 14px', fontSize: isMobile ? '0.74rem' : '0.83rem' }} aria-label="Sair da conta" title="Sair">
              {isMobile ? <LogOut size={14} /> : <><LogOut size={14} style={{ marginRight: 5 }} /> Sair</>}
            </button>
          </div>
        )}
      </header>

      <div style={s.appBody}>
        {!isMobile && (
          <nav style={{ ...s.sidebar, ...(menuAberto ?{} : s.sidebarFechada) }}>
            <div style={{ ...s.sidebarTop, justifyContent: menuAberto ?'space-between' : 'center' }}>
              {menuAberto && <div style={s.sidebarSection}>Menu</div>}
              <button
                type="button"
                style={s.menuToggle}
                onClick={() => setMenuAberto(v => !v)}
                aria-label={menuAberto ?'Fechar menu' : 'Abrir menu'}
                title={menuAberto ?'Fechar menu' : 'Abrir menu'}
              >
                {menuAberto ?<PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
              </button>
            </div>
            {navItems.map(item => {
              const ativo = location.pathname === item.path
              const Icon = item.icon
              return (
                <button key={item.path}
                  onClick={() => item.externo ?window.open(item.path, '_blank', 'noopener,noreferrer') : navigate(item.path)}
                  aria-label={item.labelFull}
                  title={menuAberto ?undefined : item.labelFull}
                  style={{ ...s.navItem, ...(menuAberto ?{} : s.navItemFechado), ...(ativo ?s.navItemAtivo : {}) }}>
                  <div style={{ ...s.navItemInner, justifyContent: menuAberto ?'flex-start' : 'center' }}>
                    <Icon size={16} strokeWidth={ativo ?2.5 : 1.8} />
                    {menuAberto && <span>{item.labelFull}</span>}
                  </div>
                  {menuAberto && <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {item.badge > 0 && <span style={item.alertBadge ? s.alertBadge : s.badge}>{item.badge}</span>}
                    {item.externo && <ExternalLink size={11} style={{ color: '#CBD5E1' }} />}
                  </div>}
                </button>
              )
            })}
          </nav>
        )}

        <main style={{ ...s.main, padding: isMobile ? '0.5rem 0.55rem' : '1rem', paddingBottom: isMobile ? (mostrarCartBar ? 'calc(9rem + env(safe-area-inset-bottom, 0px))' : 'calc(5.2rem + env(safe-area-inset-bottom, 0px))') : '1.5rem' }}>
          {titulo && <h2 style={{ ...s.paginaTitulo, fontSize: isMobile ? '1.05rem' : '1.4rem', marginBottom: isMobile ? '0.7rem' : '1rem' }}>{titulo}</h2>}

          {carregando ?(
            <div style={s.spinner}>
              <div style={s.spinnerCircle} />
              <p style={{ color: '#94A3B8', fontSize: '0.88rem' }}>Conectando ao servidor...</p>
            </div>
          ) : children}
        </main>
      </div>

      {mostrarCartBar && (
        <div style={s.cartBar}>
          <div style={s.cartBarLeft}>
            <ShoppingCart size={18} color="#fff" />
            <span style={s.cartBarCount}>{qtdCarrinho} {qtdCarrinho === 1 ? 'item' : 'itens'}</span>
            <span style={s.cartBarSep}>•</span>
            <span style={s.cartBarTotal}>R$ {totalCarrinho.toFixed(2).replace('.', ',')}</span>
          </div>
          <button style={s.cartBarBtn} onClick={() => navigate('/aluno/carrinho')}>
            Ver carrinho
          </button>
        </div>
      )}

      {isMobile && (
        <>
          {menuMobileAberto && (
            <>
              <button type="button" style={s.mobileMenuBackdrop} onClick={() => setMenuMobileAberto(false)} aria-label="Fechar mais opções" />
              <section style={s.mobileMenuSheet} role="dialog" aria-modal="true" aria-label="Mais opções do menu">
                <div style={s.mobileMenuHeader}>
                  <div>
                    <strong style={s.mobileMenuTitle}>Mais opções</strong>
                    <span style={s.mobileMenuSubtitle}>Acesse outras áreas do aplicativo</span>
                  </div>
                  <button type="button" style={s.mobileMenuClose} onClick={() => setMenuMobileAberto(false)} aria-label="Fechar menu"><X size={20} /></button>
                </div>
                <div style={s.mobileMenuGrid}>
                  {navAdicional.map(item => {
                    const ativo = location.pathname === item.path
                    const Icon = item.icon
                    return (
                      <button key={item.path} type="button" onClick={() => navegarPara(item)} style={{ ...s.mobileMenuItem, ...(ativo ? s.mobileMenuItemAtivo : {}) }}>
                        <span style={{ ...s.mobileMenuIcon, ...(ativo ? s.mobileMenuIconAtivo : {}) }}>
                          <Icon size={21} strokeWidth={ativo ? 2.5 : 1.9} />
                          {item.badge > 0 && <span style={item.alertBadge ? s.bottomAlertBadge : s.bottomBadge}>{item.badge}</span>}
                        </span>
                        <span>{item.labelFull}</span>
                      </button>
                    )
                  })}
                </div>
              </section>
            </>
          )}
          <nav style={s.bottomNav} aria-label="Navegação principal">
          {navPrincipal.map(item => {
            const ativo = location.pathname === item.path
            const Icon = item.icon
            return (
              <button key={item.path}
                onClick={() => navegarPara(item)}
                aria-label={item.labelFull}
                style={s.bottomItem}>
                <div style={{ ...s.bottomIconBox, ...(ativo ? s.bottomIconBoxAtivo : {}) }}>
                  {ativo && <span style={s.bottomIndicator} />}
                  <Icon size={19} strokeWidth={ativo ? 2.5 : 1.7} color={ativo ? '#003D7C' : '#94A3B8'} />
                  {item.badge > 0 && <span style={item.alertBadge ? s.bottomAlertBadge : s.bottomBadge}>{item.badge}</span>}
                </div>
                <span style={{ ...s.bottomLabel, color: ativo ? '#003D7C' : '#64748B', fontWeight: ativo ? 800 : 600 }}>
                  {item.labelFull}
                </span>
              </button>
            )
          })}
          {navAdicional.length > 0 && (() => {
            const ativo = navAdicional.some(item => location.pathname === item.path)
            return (
              <button type="button" onClick={() => setMenuMobileAberto(true)} aria-label="Abrir mais opções" aria-expanded={menuMobileAberto} style={s.bottomItem}>
                <div style={{ ...s.bottomIconBox, ...(ativo || menuMobileAberto ? s.bottomIconBoxAtivo : {}) }}>
                  {(ativo || menuMobileAberto) && <span style={s.bottomIndicator} />}
                  <MoreHorizontal size={20} strokeWidth={ativo ? 2.5 : 1.9} color={ativo || menuMobileAberto ? '#003D7C' : '#94A3B8'} />
                  {badgeMais > 0 && <span style={s.bottomAlertBadge}>{badgeMais}</span>}
                </div>
                <span style={{ ...s.bottomLabel, color: ativo || menuMobileAberto ? '#003D7C' : '#64748B', fontWeight: ativo || menuMobileAberto ? 800 : 600 }}>Mais</span>
              </button>
            )
          })()}
          </nav>
        </>
      )}

      {usuarioLogado && <ChatAssistente />}
    </div>
  )
}

const s = {
  /* ── Header ── */
  appShell: {
    display: 'flex', flexDirection: 'column',
    width: '100%', height: '100dvh',
    minHeight: 0, overflow: 'hidden',
  },
  appBody: {
    display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    background: 'linear-gradient(135deg, #0B1E45 0%, #003D7C 55%, #004F9E 100%)',
    borderBottom: '3px solid #F47920',
    boxShadow: '0 4px 24px rgba(0,0,0,0.28)',
    position: 'relative', zIndex: 100, color: '#fff', flexShrink: 0,
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
    transition: 'width 0.2s ease, padding 0.2s ease',
  },
  sidebarFechada: { width: 68, padding: '1rem 0.45rem' },
  sidebarTop: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 },
  sidebarSection: {
    fontSize: '0.65rem', fontWeight: 700, color: '#CBD5E1',
    letterSpacing: '0.1em', textTransform: 'uppercase',
    padding: '0.5rem 0.75rem 0.5rem',
  },
  menuToggle: {
    width: 36, height: 36, border: '1px solid #D8E0F2', borderRadius: 10,
    background: '#fff', color: '#003D7C', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'inherit',
  },
  navItem: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0.68rem 0.85rem', borderRadius: 12,
    color: '#64748B', fontWeight: 500, fontSize: '0.88rem',
    textAlign: 'left', border: 'none', background: 'transparent',
    cursor: 'pointer', transition: 'background 0.15s, color 0.15s',
    fontFamily: 'inherit',
  },
  navItemFechado: { justifyContent: 'center', padding: '0.72rem 0', minHeight: 44 },
  navItemAtivo: {
    background: '#EEF2FF', color: '#1D4ED8', fontWeight: 700,
    borderLeft: '3px solid #1D4ED8', paddingLeft: 'calc(0.85rem - 3px)',
  },
  navItemInner: { display: 'flex', alignItems: 'center', gap: 10 },
  badge: {
    background: '#003D7C', color: '#fff', borderRadius: 999,
    padding: '0.15rem 0.6rem', fontSize: '0.7rem', fontWeight: 700,
  },
  alertBadge: {
    background: '#DC2626', color: '#fff', borderRadius: 999,
    minWidth: 20, height: 20, padding: '0 0.4rem', fontSize: '0.68rem', fontWeight: 900,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 0 0 2px #fff',
  },

  /* ── Main ── */
  main: {
    flex: 1, padding: '1rem', minWidth: 0, minHeight: 0,
    overflowX: 'hidden', overflowY: 'auto',
    overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch',
  },
  paginaTitulo: { fontWeight: 800, color: '#1A202C', marginBottom: '1rem' },
  spinner: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 1rem', gap: 12 },
  spinnerCircle: { width: 36, height: 36, border: '4px solid #E2E8F0', borderTop: '4px solid #003D7C', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },

  /* ── Bottom nav (mobile) ── */
  bottomNav: {
    position: 'fixed', bottom: 0, left: 0, right: 0,
    background: '#fff', borderTop: '1px solid rgba(226,232,240,0.9)',
    display: 'flex', zIndex: 100,
    boxShadow: '0 -6px 30px rgba(15,23,42,0.09)',
    paddingBottom: 'calc(6px + env(safe-area-inset-bottom, 0px))', paddingTop: 4,
  },
  bottomItem: {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'flex-start', gap: 3,
    background: 'transparent', border: 'none', cursor: 'pointer',
    padding: '3px 2px 0', minWidth: 0, minHeight: 52, fontFamily: 'inherit',
  },
  bottomIconBox: {
    width: 44, height: 30, borderRadius: 9,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    position: 'relative', transition: 'background 0.2s',
  },
  bottomIconBoxAtivo: {
    background: 'linear-gradient(135deg, #E8F0FB, #D6E6FF)',
    boxShadow: '0 2px 8px rgba(0,61,124,0.12)',
  },
  bottomIndicator: {
    position: 'absolute', top: -4, left: '50%', transform: 'translateX(-50%)',
    width: 24, height: 3, borderRadius: 2,
    background: 'linear-gradient(90deg, #F47920, #FF9A4D)',
  },
  bottomLabel: { width: '100%', padding: '0 2px', fontSize: '0.62rem', letterSpacing: 0, lineHeight: 1.15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' },
  bottomBadge: {
    position: 'absolute', top: -5, right: -7,
    background: '#F47920', color: '#fff', borderRadius: 999,
    padding: '1px 5px', fontSize: '0.58rem', fontWeight: 700,
    border: '2px solid #fff', lineHeight: 1.4,
  },
  bottomAlertBadge: {
    position: 'absolute', top: -5, right: -7,
    minWidth: 18, height: 18, padding: '0 5px',
    background: '#DC2626', color: '#fff', borderRadius: 999,
    fontSize: '0.58rem', fontWeight: 900, border: '2px solid #fff',
    lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  },
  mobileMenuBackdrop: {
    position: 'fixed', inset: 0, zIndex: 190, border: 'none',
    background: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(2px)',
  },
  mobileMenuSheet: {
    position: 'fixed', left: 8, right: 8,
    bottom: 'calc(65px + env(safe-area-inset-bottom, 0px))', zIndex: 200,
    maxHeight: 'min(68vh, 520px)', overflowY: 'auto',
    background: '#fff', borderRadius: '14px 14px 10px 10px', padding: '12px',
    boxShadow: '0 -12px 40px rgba(15, 23, 42, 0.22)', border: '1px solid #E2E8F0',
  },
  mobileMenuHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, padding: '2px 2px 12px' },
  mobileMenuTitle: { display: 'block', color: '#0F172A', fontSize: '1rem', fontWeight: 900 },
  mobileMenuSubtitle: { display: 'block', color: '#64748B', fontSize: '0.75rem', marginTop: 2 },
  mobileMenuClose: { width: 40, height: 40, flexShrink: 0, borderRadius: 10, background: '#F1F5F9', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  mobileMenuGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 },
  mobileMenuItem: { minHeight: 54, minWidth: 0, padding: '7px 9px', border: '1px solid #E2E8F0', borderRadius: 10, background: '#fff', color: '#475569', display: 'flex', alignItems: 'center', gap: 9, textAlign: 'left', fontSize: '0.8rem', fontWeight: 800 },
  mobileMenuItemAtivo: { borderColor: '#9AB9E3', background: '#EEF5FF', color: '#003D7C' },
  mobileMenuIcon: { width: 38, height: 38, flexShrink: 0, position: 'relative', borderRadius: 9, background: '#F1F5F9', color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  mobileMenuIconAtivo: { background: '#DCEAFF', color: '#003D7C' },

  /* ── Cart bar (mobile, above bottom nav) ── */
  cartBar: {
    position: 'fixed',
    bottom: 'calc(62px + env(safe-area-inset-bottom, 0px))',
    left: 0, right: 0, zIndex: 99,
    background: 'linear-gradient(135deg, #003D7C 0%, #0055AA 100%)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0.65rem 1rem',
    boxShadow: '0 -4px 20px rgba(0,61,124,0.28)',
    animation: 'slideInUp 0.25s ease',
  },
  cartBarLeft: { display: 'flex', alignItems: 'center', gap: 8 },
  cartBarCount: { color: '#fff', fontWeight: 700, fontSize: '0.88rem' },
  cartBarSep: { color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' },
  cartBarTotal: { color: '#F47920', fontWeight: 800, fontSize: '0.95rem' },
  cartBarBtn: {
    background: '#F47920', color: '#fff', border: 'none',
    borderRadius: 10, padding: '0.5rem 1rem',
    fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer',
    fontFamily: 'inherit', whiteSpace: 'nowrap',
    boxShadow: '0 4px 12px rgba(244,121,32,0.35)',
  },
}
