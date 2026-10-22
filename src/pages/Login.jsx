﻿import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../contexts/AppContext'
import { useIsMobile } from '../utils/useIsMobile'
import { ArrowLeft, ArrowRight, Clock3, Eye, EyeOff, Heart, Lock, Mail, ShoppingBag, UsersRound } from 'lucide-react'
import { caminhoInicialPorPerfil } from '../utils/perfis'

function ModalRedefinirSenha({ onFechar, redefinirSenhaVerificada }) {
  const [email, setEmail] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [sucesso, setSucesso] = useState(false)

  async function handleEnviarCodigo() {
    setErro('')
    const emailTrim = email.trim()
    if (!emailTrim) { setErro('Informe seu e-mail.'); return }

    setCarregando(true)
    const res = await redefinirSenhaVerificada(emailTrim)
    setCarregando(false)

    if (res?.erro) {
      setErro(res.erro)
      return
    }

    setSucesso(true)
  }

  return (
    <div style={ms.overlay} onClick={e => e.target === e.currentTarget && onFechar()}>
      <div style={ms.box}>
        <div style={ms.header}>
          <div>
            <h3 style={ms.titulo}>Redefinir senha</h3>
            <p style={ms.subtitulo}>Envie um link de recuperação por e-mail</p>
          </div>
          <button style={ms.fecharBtn} onClick={onFechar} aria-label="Fechar redefinição de senha">✕</button>
        </div>

        {sucesso ? (
          <div style={ms.sucesso}>
            <Mail size={52} color="#22C55E" />
            <p style={ms.sucessoTitulo}>E-mail enviado!</p>
            <p style={ms.sucessoSub}>Verifique sua caixa de entrada e clique no link para continuar.</p>
          </div>
        ) : (
          <div style={ms.corpo}>
            <p style={ms.instrucao}>Informe o e-mail da conta para receber o link de redefinicao.</p>
            <div style={ms.campo}>
              <label style={ms.label}>E-mail</label>
              <div style={ms.inputRow}>
                <Mail size={16} color="#94A3B8" style={ms.inputIconStyle} />
                <input
                  style={ms.input}
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setErro('') }}
                  placeholder="seunome@email.com"
                  autoComplete="email"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleEnviarCodigo()} />
              </div>
            </div>
            {erro && <div style={ms.erro}>{erro}</div>}
            <button
              style={{ ...ms.btnPrimario, opacity: carregando ? 0.7 : 1 }}
              onClick={handleEnviarCodigo}
              disabled={carregando}
            >
              {carregando ? 'Enviando...' : 'Enviar e-mail de redefinição'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

const ms = {
  overlay:       { position: 'fixed', inset: 0, background: 'rgba(11,30,69,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: '1rem', backdropFilter: 'blur(3px)' },
  box:           { background: '#fff', borderRadius: 22, width: '100%', maxWidth: 420, boxShadow: '0 30px 80px rgba(0,0,0,0.35)', overflow: 'hidden' },
  header:        { background: 'linear-gradient(135deg, #0B1E45 0%, #003D7C 100%)', color: '#fff', padding: '1.4rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  titulo:        { margin: 0, fontWeight: 800, fontSize: '1.1rem' },
  subtitulo:     { margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'rgba(255,255,255,0.55)' },
  fecharBtn:     { background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  steps:         { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.1rem 1.5rem 0', gap: 0 },
  stepItem:      { display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', flex: 1 },
  stepDot:       { width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700, zIndex: 1 },
  stepLabel:     { fontSize: '0.7rem', marginTop: 5, textAlign: 'center' },
  stepLine:      { position: 'absolute', top: 14, left: '50%', width: '100%', height: 2, zIndex: 0 },
  corpo:         { padding: '1.25rem 1.5rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' },
  instrucao:     { margin: 0, color: '#475569', fontSize: '0.9rem', lineHeight: 1.5 },
  dica:          { display: 'flex', alignItems: 'center', gap: 8, background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: '0.6rem 0.9rem', fontSize: '0.83rem', color: '#1D4ED8' },
  campo:         { display: 'flex', flexDirection: 'column', gap: 6 },
  label:         { fontWeight: 600, fontSize: '0.82rem', color: '#374151' },
  inputRow:      { position: 'relative', display: 'flex', alignItems: 'center' },
  inputIconStyle:{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' },
  input:         { width: '100%', paddingLeft: '2.5rem', paddingRight: '1rem', paddingTop: '0.78rem', paddingBottom: '0.78rem', borderRadius: 12, border: '2px solid #E5E7EB', fontSize: '0.95rem', outline: 'none', background: '#F8FAFC', fontFamily: 'inherit', boxSizing: 'border-box' },
  inputCodigo:   { width: '100%', padding: '0.85rem 1rem', borderRadius: 12, border: '2px solid #E5E7EB', fontSize: '1.8rem', letterSpacing: '0.5em', textAlign: 'center', outline: 'none', background: '#F8FAFC', fontFamily: 'monospace', fontWeight: 700, boxSizing: 'border-box' },
  erro:          { background: '#FEF2F2', color: '#DC2626', fontSize: '0.83rem', padding: '0.55rem 0.9rem', borderRadius: 10, border: '1px solid #FECACA' },
  botoes:        { display: 'flex', gap: 10 },
  btnPrimario:   { flex: 1, padding: '0.8rem', borderRadius: 12, background: 'linear-gradient(135deg, #F47920, #E8650A)', color: '#fff', fontWeight: 800, fontSize: '0.92rem', border: 'none', cursor: 'pointer', fontFamily: 'inherit' },
  btnSecundario: { padding: '0.8rem 1rem', borderRadius: 12, background: '#F1F5F9', color: '#475569', fontWeight: 600, fontSize: '0.88rem', border: 'none', cursor: 'pointer', fontFamily: 'inherit' },
  sucesso:       { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '2.5rem 1.5rem', textAlign: 'center' },
  sucessoTitulo: { margin: 0, fontWeight: 800, fontSize: '1.2rem', color: '#059669' },
  sucessoSub:    { margin: 0, color: '#64748B', fontSize: '0.88rem' },
}

export default function Login({ gerencial = false }) {
  const { login, redefinirSenhaVerificada } = useApp()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [modalSenha, setModalSenha] = useState(false)


  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [erro, setErro] = useState('')
  const [entrando, setEntrando] = useState(false)
  const recursos = [
    { icon: ShoppingBag, texto: 'Cardápio digital completo' },
    { icon: Clock3, texto: 'Acompanhamento ao vivo' },
    { icon: Heart, texto: 'Favoritos e histórico' },
  ]

  async function handleLogin(e) {
    e.preventDefault()
    setErro('')
    setEntrando(true)
    
    const res = await login(email, senha, gerencial ? 'equipe' : 'aluno')
    
    if (res?.erro) {
      setEntrando(false)
      setErro(res.erro)
      return
    }

    setEntrando(false)
    navigate(res.precisaEscolher ? '/escolher-acesso' : caminhoInicialPorPerfil(res.usuario.perfil))
  }

  return (
    <div style={{ ...s.page, alignItems: isMobile ? 'stretch' : 'center' }}>
      {modalSenha && (
        <ModalRedefinirSenha
          onFechar={() => setModalSenha(false)}
          redefinirSenhaVerificada={redefinirSenhaVerificada}
        />
      )}
      <div style={{ ...s.card, gridTemplateColumns: isMobile ? '1fr' : '0.95fr 1.05fr', minHeight: isMobile ? 'auto' : 560, maxWidth: isMobile ? 'calc(100vw - 1.5rem)' : 920 }}>

        <div style={{ ...s.brandPanel, padding: isMobile ? '1.35rem 1.35rem 1.25rem' : '2.6rem 2.45rem' }}>
          <div style={s.brandMark}>
            <div>
              <div style={{ ...s.brandName, fontSize: isMobile ? '1.1rem' : '1.45rem' }}>
                Digital <span style={{ color: '#F47920' }}>Lanche</span>
              </div>
              <div style={s.brandSub}>Sua cantina digital</div>
            </div>
          </div>

          {!isMobile && (
            <>
              <div style={s.brandHero}>
                <h1 style={s.brandTitle}>Pedido rápido, retirada simples.</h1>
                <p style={s.brandDesc}>
                  Escolha seus lanches, acompanhe o preparo e retire no balcão com mais praticidade.
                </p>
              </div>
              <div style={s.featureList}>
                {recursos.map(({ icon: Icon, texto }) => (
                  <div key={texto} style={s.featureItem}>
                    <span style={s.featureIcon}><Icon size={16} /></span>
                    <span>{texto}</span>
                  </div>
                ))}
              </div>
              <div style={s.brandFooter}>
                <span style={s.statusDot} />
                <span>Sistema online</span>
              </div>
            </>
          )}
        </div>

        <div style={{ ...s.formPanel, padding: isMobile ? '1.45rem 1.25rem 1.65rem' : '3rem 2.7rem' }}>
          <div style={s.formHeader}>
            <span style={s.formBadge}>
              <UsersRound size={15} />
              {gerencial ? 'Equipe' : 'Aluno'}
            </span>
            <h2 style={{ ...s.formTitle, fontSize: isMobile ? '1.35rem' : '1.65rem' }}>{gerencial ? 'Login gerencial' : 'Entrar na conta'}</h2>
            <p style={s.formSub}>{gerencial ? 'Acesso da administração, vendas, cozinha e professores' : 'Acesse com seu e-mail e senha'}</p>
          </div>

          <form onSubmit={handleLogin} style={s.form}>
            <div style={s.campo}>
              <label style={s.label}>E-mail</label>
              <div style={s.inputWrap}>
                <Mail size={18} style={s.inputIcon} />
                <input
                  style={s.input}
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setErro('') }}
                  placeholder="seunome@email.com"
                  autoComplete="username"
                />
              </div>
            </div>

            <div style={s.campo}>
              <label style={s.label}>Senha</label>
              <div style={s.inputWrap}>
                <Lock size={18} style={s.inputIcon} />
                <input
                  style={{ ...s.input, paddingRight: '3rem' }}
                  type={mostrarSenha ? 'text' : 'password'}
                  value={senha}
                  onChange={e => { setSenha(e.target.value); setErro('') }}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha(v => !v)}
                  style={s.olhoBtn}
                  aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {mostrarSenha ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {!gerencial && (
              <p style={s.cadastroLink}>
                Não tem conta?{' '}
                <button type="button" onClick={() => navigate('/cadastro')} style={s.cadastroBtn}>
                  Cadastre-se
                </button>
              </p>
            )}

            {erro && <div style={s.erroBox}>{erro}</div>}

            <button type="submit" style={{ ...s.btnEntrar, opacity: entrando ? 0.7 : 1 }} disabled={entrando}>
              <span>{entrando ? 'Entrando...' : 'Entrar'}</span>
              {!entrando && <ArrowRight size={18} />}
            </button>

            <button
              type="button"
              style={s.btnVoltar}
              onClick={() => navigate('/')}
            >
              <ArrowLeft size={16} />
              Voltar à tela inicial
            </button>

            <button type="button" style={s.esqueceuBtn} onClick={() => setModalSenha(true)}>
              Esqueceu sua senha?
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

const s = {
  page: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'linear-gradient(135deg, #071832 0%, #0B1E45 36%, #003D7C 72%, #004F9E 100%)',
    padding: '1.25rem', width: '100%', minWidth: 0,
  },
  card: {
    display: 'grid',
    borderRadius: 28, overflow: 'hidden',
    width: '100%', maxWidth: 920,
    background: '#fff',
    boxShadow: '0 32px 90px rgba(0,0,0,0.42)',
    border: '1px solid rgba(255,255,255,0.18)',
  },

  /* Brand panel */
  brandPanel: {
    background: 'linear-gradient(160deg, #0B1E45 0%, #003D7C 72%, #004F9E 100%)',
    display: 'flex', flexDirection: 'column', gap: '1.55rem', color: '#fff',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  brandMark: { display: 'flex', alignItems: 'center', gap: 12 },
  brandName: { fontWeight: 900, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.1 },
  brandSub: { fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, marginTop: 2 },
  brandHero: { marginTop: '1.1rem' },
  brandTitle: { margin: 0, color: '#fff', fontSize: '2rem', lineHeight: 1.12, fontWeight: 900, letterSpacing: 0 },
  brandDesc: { color: 'rgba(255,255,255,0.68)', fontSize: '0.93rem', lineHeight: 1.65, margin: '1rem 0 0' },
  featureList: { display: 'flex', flexDirection: 'column', gap: 10, marginTop: '0.2rem' },
  featureItem: { color: 'rgba(255,255,255,0.82)', fontSize: '0.88rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10 },
  featureIcon: { width: 32, height: 32, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.1)', color: '#F47920', border: '1px solid rgba(255,255,255,0.12)', flexShrink: 0 },
  brandFooter: { marginTop: 'auto', color: 'rgba(255,255,255,0.62)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 },
  statusDot: { width: 8, height: 8, borderRadius: '50%', background: '#22C55E', boxShadow: '0 0 0 4px rgba(34,197,94,0.14)' },

  /* Form panel */
  formPanel: { background: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'center' },
  formHeader: { marginBottom: '1.65rem' },
  formBadge: { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '0.42rem 0.72rem', borderRadius: 999, background: '#EFF6FF', color: '#003D7C', fontSize: '0.78rem', fontWeight: 800, marginBottom: '0.85rem' },
  formTitle: { fontWeight: 900, color: '#0F172A', margin: 0, letterSpacing: 0, lineHeight: 1.12 },
  formSub: { color: '#64748B', fontSize: '0.9rem', margin: '0.55rem 0 0', lineHeight: 1.45 },
  form: { display: 'flex', flexDirection: 'column', gap: '0.95rem' },
  campo: { display: 'flex', flexDirection: 'column', gap: 7 },
  label: { fontWeight: 700, fontSize: '0.82rem', color: '#334155' },
  inputWrap: { position: 'relative', display: 'flex', alignItems: 'center' },
  inputIcon: { position: 'absolute', left: 14, color: '#94A3B8', userSelect: 'none', pointerEvents: 'none' },
  olhoBtn: { position: 'absolute', right: 12, background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex', alignItems: 'center', padding: 4 },
  input: {
    width: '100%', paddingLeft: '2.75rem', paddingRight: '1rem',
    paddingTop: '0.88rem', paddingBottom: '0.88rem',
    borderRadius: 14, border: '2px solid #E2E8F0',
    fontSize: '0.95rem', outline: 'none',
    background: '#F8FAFC', color: '#0F172A', boxSizing: 'border-box',
    fontFamily: 'inherit', transition: 'border-color 0.2s, box-shadow 0.2s',
  },
  erroBox: {
    background: '#FEF2F2', color: '#DC2626', fontSize: '0.84rem',
    padding: '0.65rem 0.9rem', borderRadius: 10, textAlign: 'center',
    border: '1px solid #FECACA',
  },
  btnEntrar: {
    padding: '0.95rem 1rem', borderRadius: 14, border: 'none',
    background: 'linear-gradient(135deg, #F47920 0%, #E8650A 100%)',
    color: '#fff', fontWeight: 800, fontSize: '1rem', cursor: 'pointer',
    boxShadow: '0 12px 28px rgba(244,121,32,0.34)', marginTop: 4,
    fontFamily: 'inherit', letterSpacing: '0.01em',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  cadastroLink: { fontSize: '0.84rem', color: '#64748B', textAlign: 'center' },
  cadastroBtn: { background: 'none', color: '#F47920', fontWeight: 700, fontSize: '0.84rem', padding: 0, border: 'none', cursor: 'pointer', fontFamily: 'inherit' },
  btnAlternarAcesso: {
    padding: '0.82rem', borderRadius: 14,
    background: '#EFF6FF', color: '#003D7C',
    border: '1px solid #DBEAFE',
    fontWeight: 800, fontSize: '0.9rem',
    cursor: 'pointer', fontFamily: 'inherit',
  },
  esqueceuBtn: { background: 'none', border: 'none', color: '#64748B', fontSize: '0.83rem', cursor: 'pointer', textAlign: 'center', fontFamily: 'inherit', textDecoration: 'underline', padding: '0.2rem 0' },
  btnVoltar: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '0.82rem', borderRadius: 14, background: '#F1F5F9', color: '#475569', border: '1px solid #E2E8F0', fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer', fontFamily: 'inherit' },
}
