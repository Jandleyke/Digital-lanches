import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../contexts/AppContext'
import { caminhoInicialPorPerfil } from '../utils/perfis'
import { useIsMobile } from '../utils/useIsMobile'


export default function Welcome() {
  const { usuarioLogado, carregandoAuth } = useApp()
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  useEffect(() => {
    if (!carregandoAuth && usuarioLogado) {
      navigate(caminhoInicialPorPerfil(usuarioLogado.perfil), { replace: true })
    }
  }, [usuarioLogado, carregandoAuth, navigate])

  return (
    <div style={s.page}>

      {/* ── Hero ── */}
      <div style={{ ...s.hero, padding: isMobile ? '2.8rem 1.5rem 5.5rem' : '3.5rem 2rem 6rem' }}>

        {/* Logo */}
        <div style={{ ...s.logoWrap, width: isMobile ? 96 : 112, height: isMobile ? 96 : 112 }}>
          <img
            src="/pwa-192.png"
            alt="Senac Lanches"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: 22 }}
          />
        </div>

        <h1 style={{ ...s.brandName, fontSize: isMobile ? '2.1rem' : '2.5rem' }}>
          <span style={{ color: '#fff', animation: 'textGlow 2.8s ease-in-out 1s infinite' }}>
            Senac
          </span>{' '}
          <span style={{ color: '#F47920', animation: 'textGlow 2.8s ease-in-out 2.4s infinite' }}>
            Lanches
          </span>
        </h1>
        <p style={{ ...s.tagline, fontSize: isMobile ? '0.7rem' : '0.74rem' }}>
          A SUA CANTINA DIGITAL
        </p>

      </div>

      {/* ── Card branco ── */}
      <div style={s.body}>
        <div style={{ ...s.card, animation: 'fadeInUp 0.4s ease both', width: '100%', maxWidth: isMobile ? 'calc(100vw - 2rem)' : 430, padding: isMobile ? '1.65rem 1.2rem 1.4rem' : s.card.padding }}>

          <div style={s.cardHeader}>
            <h2 style={{ ...s.welcome, fontSize: isMobile ? '1.25rem' : '1.4rem' }}>
              Bem-vindo(a)! 👋
            </h2>
            <p style={{ ...s.sub, fontSize: isMobile ? '0.88rem' : '0.92rem' }}>
              Escolha como deseja entrar
            </p>
          </div>

          <div style={s.btns}>
            <button
              style={s.btnAluno}
              onClick={() => navigate('/login')}
              onTouchStart={e => { e.currentTarget.style.opacity = '0.85' }}
              onTouchEnd={e   => { e.currentTarget.style.opacity = '1' }}
            >
              Acesso Aluno
            </button>

            <button
              style={s.btnEquipe}
              onClick={() => navigate('/login-gerencial')}
              onTouchStart={e => { e.currentTarget.style.opacity = '0.85' }}
              onTouchEnd={e   => { e.currentTarget.style.opacity = '1' }}
            >
              Acesso Equipe
            </button>
          </div>

          <div style={s.footerRow}>
            <span style={s.footerText}>Novo por aqui?</span>
            <button style={s.footerLink} onClick={() => navigate('/cadastro')}>
              Cadastre-se
            </button>
          </div>
        </div>
      </div>

    </div>
  )
}

const s = {
  page: {
    minHeight: '100vh',
    display: 'flex', flexDirection: 'column',
    background: '#F0F4FA',
  },

  /* Hero */
  hero: {
    background: 'linear-gradient(135deg, #0B1E45 0%, #003D7C 55%, #004F9E 100%)',
    borderBottom: '4px solid #F47920',
    borderRadius: '0 0 40px 40px',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    textAlign: 'center', gap: '0.6rem',
    boxShadow: '0 8px 32px rgba(0,61,124,0.35)',
    position: 'relative',
  },
  logoWrap: {
    borderRadius: 24,
    overflow: 'hidden',
    boxShadow: '0 8px 28px rgba(0,0,0,0.45), 0 0 0 4px rgba(255,255,255,0.12)',
    marginBottom: 12,
    animation: 'scaleIn 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.1s both, logoFloat 3s ease-in-out 0.7s infinite',
    flexShrink: 0,
  },
  brandName: {
    fontWeight: 900, color: '#fff',
    letterSpacing: '-0.03em', lineHeight: 1.1, margin: 0,
  },
  tagline: {
    color: 'rgba(255,255,255,0.45)',
    fontWeight: 700, letterSpacing: '0.14em',
    textTransform: 'uppercase', margin: 0,
  },

  /* Body */
  body: {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', padding: '0 1rem 2.5rem',
    marginTop: -42, width: '100%', minWidth: 0,
  },
  card: {
    background: '#fff',
    borderRadius: 26,
    padding: '2rem 1.75rem 1.65rem',
    boxShadow: '0 12px 48px rgba(0,61,124,0.14)',
    display: 'flex', flexDirection: 'column', gap: '1.1rem',
    border: '1px solid #E4EBF5',
  },
  cardHeader: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: '0.3rem', textAlign: 'center',
  },
  welcome: {
    fontWeight: 800, color: '#1A202C', margin: 0, lineHeight: 1.2,
  },
  sub: {
    color: '#64748B', margin: 0,
  },
  btns: {
    display: 'flex', flexDirection: 'column', gap: 12,
  },
  btnAluno: {
    width: '100%', padding: '0.95rem 1rem',
    background: 'linear-gradient(135deg, #F47920 0%, #E8650A 100%)',
    color: '#fff', border: 'none', borderRadius: 14,
    fontWeight: 800, fontSize: '1rem', cursor: 'pointer',
    boxShadow: '0 6px 20px rgba(244,121,32,0.32)',
    fontFamily: 'inherit', letterSpacing: '0.01em',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    transition: 'opacity 0.15s',
  },
  btnEquipe: {
    width: '100%', padding: '0.93rem 1rem',
    background: '#EEF3FB',
    color: '#003D7C', border: '2px solid #C5D6F0',
    borderRadius: 14, fontWeight: 700, fontSize: '0.97rem',
    cursor: 'pointer', fontFamily: 'inherit',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    transition: 'opacity 0.15s',
  },
  footerRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderTop: '1px solid #EEF1F7', paddingTop: '0.9rem', marginTop: '0.1rem',
  },
  footerText: {
    color: '#94A3B8', fontSize: '0.85rem',
  },
  footerLink: {
    background: 'none', border: 'none', color: '#003D7C',
    fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
    fontFamily: 'inherit', textDecoration: 'underline', padding: 0,
  },
}
