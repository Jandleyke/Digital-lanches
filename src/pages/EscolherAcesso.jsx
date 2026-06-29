import { useEffect } from 'react'
import { ArrowLeft, ArrowRight, BriefcaseBusiness, ChefHat, GraduationCap, ShieldCheck, ShoppingBag, UserRound } from 'lucide-react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useApp } from '../contexts/AppContext'
import { PERFIL_INFO, caminhoInicialPorPerfil, perfisParaExibicao } from '../utils/perfis'
import { useIsMobile } from '../utils/useIsMobile'

const ICONES = {
  aluno: UserRound,
  professor: GraduationCap,
  admin: ShieldCheck,
  gerente: BriefcaseBusiness,
  vendedor: ShoppingBag,
  cozinha: ChefHat,
}

const VISUAIS = {
  aluno: { cor: '#2563EB', fundo: '#EAF2FF' },
  professor: { cor: '#0F766E', fundo: '#E7F8F5' },
  admin: { cor: '#003D7C', fundo: '#E8F0FB' },
  gerente: { cor: '#6D28D9', fundo: '#F1EAFF' },
  vendedor: { cor: '#D95D0B', fundo: '#FFF0E5' },
  cozinha: { cor: '#15803D', fundo: '#EAF8EE' },
}

export default function EscolherAcesso() {
  const { usuarioLogado, trocarAcesso } = useApp()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [params] = useSearchParams()
  const trocaInterna = params.get('troca') === '1'
  const perfis = perfisParaExibicao(usuarioLogado?.acessosEntrada || usuarioLogado)
  const primeiroNome = String(usuarioLogado?.nome || '').trim().split(' ')[0] || 'Usuário'

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [])

  if (!usuarioLogado) return <Navigate to="/" replace />
  if (!trocaInterna && !usuarioLogado.selecaoAcessoPendente && perfis.length === 1) {
    return <Navigate to={caminhoInicialPorPerfil(usuarioLogado.perfil)} replace />
  }

  function escolher(perfil) {
    const resultado = trocarAcesso(perfil)
    if (resultado?.ok) navigate(caminhoInicialPorPerfil(perfil), { replace: true })
  }

  return (
    <main style={s.page}>
      <header style={{ ...s.hero, padding: isMobile ? '1.15rem 1rem 4.7rem' : '1.6rem 1.5rem 5.6rem' }}>
        <div style={s.heroInner}>
          <div style={s.topbar}>
            <div style={s.brand}>
              <img src="/pwa-192.png" alt="" style={{ ...s.logo, width: isMobile ? 42 : 50, height: isMobile ? 42 : 50 }} />
              <div>
                <strong style={{ ...s.brandName, fontSize: isMobile ? '1rem' : '1.14rem' }}>Senac <span style={s.brandAccent}>Lanches</span></strong>
                <span style={s.brandTagline}>Sua cantina digital</span>
              </div>
            </div>
            <div style={s.userChip}>
              <span style={s.avatar}>{primeiroNome.charAt(0).toUpperCase()}</span>
              {!isMobile && <span style={s.userText}>Olá, <strong>{primeiroNome}</strong></span>}
            </div>
          </div>

          <div style={{ ...s.header, textAlign: isMobile ? 'left' : 'center' }}>
            <span style={s.eyebrow}>{perfis.length} {perfis.length === 1 ? 'perfil disponível' : 'perfis disponíveis'}</span>
            <h1 style={{ ...s.title, fontSize: isMobile ? '1.65rem' : '2.15rem' }}>Escolha sua área de acesso</h1>
            <p style={{ ...s.subtitle, fontSize: isMobile ? '0.88rem' : '0.96rem' }}>Entre no ambiente que deseja usar agora.</p>
          </div>
        </div>
      </header>

      <section style={{ ...s.container, padding: isMobile ? '0 1rem 2rem' : '0 1.5rem 2.5rem', marginTop: isMobile ? -54 : -66 }}>
        <div style={{ ...s.grid, gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))' }}>
          {perfis.map(perfil => {
            const Icon = ICONES[perfil] || UserRound
            const info = PERFIL_INFO[perfil]
            const atual = perfil === usuarioLogado.perfil
            const visual = VISUAIS[perfil] || VISUAIS.aluno
            return (
              <button
                key={perfil}
                type="button"
                style={{ ...s.card, minHeight: isMobile ? 112 : 138, padding: isMobile ? 14 : 18, ...(atual ? s.cardAtual : {}) }}
                onClick={() => escolher(perfil)}
                aria-label={`${atual ? 'Continuar em' : 'Acessar'} ${info?.nome || perfil}`}
              >
                <span style={{ ...s.cardAccent, background: atual ? '#22C55E' : visual.cor }} />
                <span style={{ ...s.icon, background: visual.fundo, color: visual.cor, width: isMobile ? 46 : 54, height: isMobile ? 46 : 54 }}><Icon size={isMobile ? 22 : 25} strokeWidth={2} /></span>
                <span style={s.cardText}>
                  <span style={s.cardTitleRow}>
                    <strong style={{ ...s.cardTitle, fontSize: isMobile ? '0.98rem' : '1.08rem' }}>{info?.nome || perfil}</strong>
                    {atual && <span style={s.current}>Acesso atual</span>}
                  </span>
                  <span style={s.description}>{info?.descricao}</span>
                </span>
                <span style={{ ...s.action, color: atual ? '#15803D' : visual.cor }}>
                  {!isMobile && <span>{atual ? 'Continuar' : 'Acessar'}</span>}
                  <ArrowRight size={18} />
                </span>
              </button>
            )
          })}
        </div>
        {trocaInterna && <button type="button" style={s.back} onClick={() => navigate(-1)}><ArrowLeft size={17} /> Voltar</button>}
      </section>
    </main>
  )
}

const s = {
  page: { minHeight: '100dvh', background: '#EDF3FA', color: '#0F172A' },
  hero: { background: 'linear-gradient(135deg, #0B1E45 0%, #003D7C 62%, #0055AA 100%)', borderBottom: '4px solid #F47920', color: '#fff' },
  heroInner: { width: '100%', maxWidth: 940, margin: '0 auto' },
  topbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  brand: { display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 },
  logo: { display: 'block', flexShrink: 0, borderRadius: 12, objectFit: 'cover', boxShadow: '0 6px 18px rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.16)' },
  brandName: { display: 'block', color: '#fff', fontWeight: 900, lineHeight: 1.1 },
  brandAccent: { color: '#F47920' },
  brandTagline: { display: 'block', color: 'rgba(255,255,255,0.55)', fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 3 },
  userChip: { minHeight: 42, padding: '4px 9px 4px 5px', display: 'flex', alignItems: 'center', gap: 8, border: '1px solid rgba(255,255,255,0.16)', borderRadius: 999, background: 'rgba(255,255,255,0.08)' },
  avatar: { width: 32, height: 32, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: '#F47920', color: '#fff', fontSize: '0.82rem', fontWeight: 900 },
  userText: { color: 'rgba(255,255,255,0.75)', fontSize: '0.8rem', whiteSpace: 'nowrap' },
  header: { marginTop: 36 },
  eyebrow: { display: 'inline-flex', alignItems: 'center', minHeight: 28, padding: '0 10px', border: '1px solid rgba(255,255,255,0.16)', borderRadius: 999, background: 'rgba(255,255,255,0.08)', color: '#D9E8FA', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' },
  title: { color: '#fff', margin: '12px 0 7px', fontWeight: 900, lineHeight: 1.12, letterSpacing: 0 },
  subtitle: { color: 'rgba(255,255,255,0.68)', margin: 0, lineHeight: 1.45 },
  container: { width: '100%', maxWidth: 988, marginLeft: 'auto', marginRight: 'auto', position: 'relative' },
  grid: { display: 'grid', gap: 13 },
  card: { width: '100%', overflow: 'hidden', border: '1px solid #DCE5F0', borderRadius: 8, background: '#fff', display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left', cursor: 'pointer', boxShadow: '0 10px 28px rgba(15,23,42,0.09)', fontFamily: 'inherit', position: 'relative' },
  cardAtual: { borderColor: '#86D79E', boxShadow: '0 10px 28px rgba(21,128,61,0.12), inset 0 0 0 1px #86D79E' },
  cardAccent: { position: 'absolute', top: 0, left: 0, width: 4, height: '100%' },
  icon: { borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardText: { flex: 1, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 },
  cardTitleRow: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  cardTitle: { color: '#0F172A', lineHeight: 1.2 },
  description: { color: '#64748B', fontSize: '0.8rem', lineHeight: 1.45 },
  current: { background: '#DCFCE7', color: '#166534', borderRadius: 999, padding: '3px 8px', fontSize: '0.62rem', lineHeight: 1.2, fontWeight: 900, textTransform: 'uppercase' },
  action: { flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontSize: '0.75rem', fontWeight: 900 },
  back: { margin: '20px auto 0', border: '1px solid #CBD5E1', background: '#fff', color: '#334155', borderRadius: 8, minHeight: 44, padding: '0 18px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, boxShadow: '0 4px 14px rgba(15,23,42,0.06)' },
}
