import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../contexts/AppContext'
import { useIsMobile } from '../utils/useIsMobile'
import { CheckCircle2, Mail, User, Lock } from 'lucide-react'
import emailjs from '@emailjs/browser'

const EMAILJS_SERVICE_ID  = 'service_3it9k2c'
const EMAILJS_TEMPLATE_ID = 'template_6m7nm4t'
const EMAILJS_PUBLIC_KEY  = 'b4ZPNrCtOe_n4Q1jd'

function mascaraEmail(email) {
  if (!email) return '***@***.com'
  const parts = email.split('@')
  if (parts.length < 2) return email
  const user = parts[0]
  const domain = parts[1]
  return `${user.slice(0, Math.min(3, user.length))}***@${domain}`
}

function gerarOTP() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

function ModalRedefinirSenha({ onFechar, redefinirSenhaVerificada, usuarios }) {
  const [etapa, setEtapa]           = useState(1)
  const [matricula, setMatricula]   = useState('')
  const [codigo, setCodigo]         = useState('')
  const [novaSenha, setNovaSenha]   = useState('')
  const [confirmar, setConfirmar]   = useState('')
  const [erro, setErro]             = useState('')
  const [carregando, setCarregando] = useState(false)
  const [sucesso, setSucesso]       = useState(false)
  const [usuarioEncontrado, setUsuarioEncontrado] = useState(null)
  const [otpGerado, setOtpGerado]   = useState(null)
  const [otpExpiry, setOtpExpiry]   = useState(null)

  async function handleEnviarCodigo() {
    setErro('')
    const u = usuarios.find(u => u.matricula === matricula.trim())
    if (!u) { setErro('Matrícula não encontrada.'); return }
    if (!u.email) { setErro('Esta conta não tem e-mail cadastrado. Faça login, vá em Perfil e adicione seu e-mail.'); return }
    setCarregando(true)
    try {
      const otp = gerarOTP()
      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        { to_email: u.email, to_name: u.nome, otp_code: otp },
        { publicKey: EMAILJS_PUBLIC_KEY }
      )
      setOtpGerado(otp)
      setOtpExpiry(Date.now() + 10 * 60 * 1000)
      setUsuarioEncontrado(u)
      setEtapa(2)
    } catch (e) {
      console.error('[EmailJS]', e)
      setErro('Erro ao enviar e-mail. Verifique sua conexão e tente novamente.')
    }
    setCarregando(false)
  }

  function handleVerificarCodigo() {
    setErro('')
    if (!codigo || codigo.length < 6) { setErro('Digite o código de 6 dígitos.'); return }
    if (Date.now() > otpExpiry) { setErro('Código expirado. Clique em "Reenviar" para solicitar um novo.'); return }
    if (codigo !== otpGerado) { setErro('Código incorreto. Verifique o e-mail e tente novamente.'); return }
    setEtapa(3)
  }

  async function handleRedefinir() {
    setErro('')
    if (novaSenha.length < 4) { setErro('A senha deve ter pelo menos 4 caracteres.'); return }
    if (novaSenha !== confirmar) { setErro('As senhas não conferem.'); return }
    setCarregando(true)
    const res = await redefinirSenhaVerificada(matricula.trim(), novaSenha)
    setCarregando(false)
    if (res.erro) { setErro(res.erro); return }
    setSucesso(true)
    setTimeout(onFechar, 2500)
  }

  const passos = ['Matrícula', 'Código E-mail', 'Nova senha']

  return (
    <div style={ms.overlay} onClick={e => e.target === e.currentTarget && onFechar()}>
      <div style={ms.box}>
        <div style={ms.header}>
          <div>
            <h3 style={ms.titulo}>Redefinir senha</h3>
            <p style={ms.subtitulo}>Verificação por e-mail</p>
          </div>
          <button style={ms.fecharBtn} onClick={onFechar}>✕</button>
        </div>

        {!sucesso && (
          <div style={ms.steps}>
            {passos.map((p, i) => {
              const num = i + 1
              const ativo = num === etapa
              const feito = num < etapa
              return (
                <div key={p} style={ms.stepItem}>
                  <div style={{ ...ms.stepDot, background: feito ? '#22C55E' : ativo ? '#003D7C' : '#E2E8F0', color: feito || ativo ? '#fff' : '#94A3B8' }}>
                    {feito ? <CheckCircle2 size={13} /> : num}
                  </div>
                  <span style={{ ...ms.stepLabel, color: ativo ? '#003D7C' : feito ? '#22C55E' : '#94A3B8', fontWeight: ativo ? 700 : 400 }}>{p}</span>
                  {i < passos.length - 1 && <div style={{ ...ms.stepLine, background: feito ? '#22C55E' : '#E2E8F0' }} />}
                </div>
              )
            })}
          </div>
        )}

        {sucesso ? (
          <div style={ms.sucesso}>
            <CheckCircle2 size={52} color="#22C55E" strokeWidth={1.5} />
            <p style={ms.sucessoTitulo}>Senha redefinida!</p>
            <p style={ms.sucessoSub}>Você já pode fazer login com a nova senha.</p>
          </div>
        ) : etapa === 1 ? (
          <div style={ms.corpo}>
            <p style={ms.instrucao}>Informe sua matrícula. Enviaremos um código para o e-mail cadastrado na conta.</p>
            <div style={ms.campo}>
              <label style={ms.label}>Matrícula</label>
              <div style={ms.inputRow}>
                <User size={16} color="#94A3B8" style={ms.inputIconStyle} />
                <input style={ms.input} value={matricula}
                  onChange={e => { setMatricula(e.target.value); setErro('') }}
                  placeholder="Ex: 2024001" autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleEnviarCodigo()} />
              </div>
            </div>
            {erro && <div style={ms.erro}>{erro}</div>}
            <button style={{ ...ms.btnPrimario, opacity: carregando ? 0.7 : 1 }}
              onClick={handleEnviarCodigo} disabled={carregando}>
              {carregando ? 'Enviando e-mail...' : 'Enviar código por e-mail'}
            </button>
          </div>
        ) : etapa === 2 ? (
          <div style={ms.corpo}>
            <div style={ms.dica}>
              <Mail size={15} color="#003D7C" />
              <span>Código enviado para <strong>{mascaraEmail(usuarioEncontrado?.email)}</strong></span>
            </div>
            <p style={ms.instrucao}>Digite o código de 6 dígitos recebido no seu e-mail. Verifique a caixa de spam.</p>
            <div style={ms.campo}>
              <label style={ms.label}>Código do e-mail</label>
              <input style={ms.inputCodigo} value={codigo}
                onChange={e => { setCodigo(e.target.value.replace(/\D/g, '').slice(0,6)); setErro('') }}
                placeholder="000000" inputMode="numeric" maxLength={6} autoFocus
                onKeyDown={e => e.key === 'Enter' && handleVerificarCodigo()} />
            </div>
            {erro && <div style={ms.erro}>{erro}</div>}
            <div style={ms.botoes}>
              <button style={ms.btnSecundario} onClick={() => { setEtapa(1); setErro(''); setCodigo('') }}>← Reenviar</button>
              <button style={{ ...ms.btnPrimario, opacity: carregando ? 0.7 : 1 }}
                onClick={handleVerificarCodigo} disabled={carregando}>
                {carregando ? 'Verificando...' : 'Verificar →'}
              </button>
            </div>
          </div>
        ) : (
          <div style={ms.corpo}>
            <p style={ms.instrucao}>E-mail verificado. Crie uma nova senha para sua conta.</p>
            {[
              { val: novaSenha, set: setNovaSenha, placeholder: 'Mínimo 4 caracteres', label: 'Nova senha' },
              { val: confirmar, set: setConfirmar, placeholder: 'Repita a nova senha',   label: 'Confirmar senha' },
            ].map(({ val, set, placeholder, label }) => (
              <div key={label} style={ms.campo}>
                <label style={ms.label}>{label}</label>
                <div style={ms.inputRow}>
                  <Lock size={16} color="#94A3B8" style={ms.inputIconStyle} />
                  <input style={ms.input} type="password" value={val}
                    onChange={e => { set(e.target.value); setErro('') }}
                    placeholder={placeholder}
                    onKeyDown={e => e.key === 'Enter' && handleRedefinir()} />
                </div>
              </div>
            ))}
            {erro && <div style={ms.erro}>{erro}</div>}
            <button style={{ ...ms.btnPrimario, opacity: carregando ? 0.7 : 1 }}
              onClick={handleRedefinir} disabled={carregando}>
              {carregando ? 'Salvando...' : 'Redefinir senha'}
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

export default function Login() {
  const { login, usuarioLogado, usuarios, redefinirSenhaVerificada } = useApp()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [modalSenha, setModalSenha] = useState(false)

  useEffect(() => {
    if (!usuarioLogado) return
    if (usuarioLogado.perfil === 'aluno') navigate('/aluno/cardapio')
    else if (usuarioLogado.perfil === 'cozinha') navigate('/cozinha')
    else navigate('/admin')
  }, [usuarioLogado, navigate])

  const [matricula, setMatricula] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [selectedRole, setSelectedRole] = useState('')

  const hints = [
    { label: 'Aluno',   matricula: '2024001', senha: '1234',   role: 'aluno' },
    { label: 'Cozinha', matricula: 'COZ001',  senha: 'coz123', role: 'cozinha' },
    { label: 'Gerente', matricula: 'GER001',  senha: 'ger123', role: 'gerente' },
    { label: 'Admin',   matricula: 'ADM001',  senha: 'adm123', role: 'admin' },
  ]

  function handleLogin(e) {
    e.preventDefault()
    const usuario = login(matricula, senha)
    if (!usuario) { setErro('Matrícula ou senha incorretos.'); return }
    if (usuario.bloqueado) { setErro('Sua conta está bloqueada. Procure um administrador.'); return }
    if (usuario.perfil === 'aluno') navigate('/aluno/cardapio')
    else if (usuario.perfil === 'cozinha') navigate('/cozinha')
    else navigate('/admin')
  }

  const quickAccess = (
    <div style={s.quickWrap}>
      <p style={s.quickLabel}>Acesso rápido</p>
      <div style={s.quickBtns}>
        {hints.map(h => (
          <button key={h.label} style={s.quickBtn}
            onClick={() => { setMatricula(h.matricula); setSenha(h.senha); setErro(''); setSelectedRole(h.role) }}>
            {h.label}
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <div style={s.page}>
      {modalSenha && (
        <ModalRedefinirSenha
          onFechar={() => setModalSenha(false)}
          redefinirSenhaVerificada={redefinirSenhaVerificada}
          usuarios={usuarios}
        />
      )}
      <div style={{ ...s.card, gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr' }}>

        {/* ── Painel Brand ── */}
        <div style={{ ...s.brandPanel, padding: isMobile ? '1.4rem 1.5rem' : '2.75rem 2.25rem' }}>
          <div style={s.brandMark}>
            <div>
              <div style={{ ...s.brandName, fontSize: isMobile ? '1.1rem' : '1.45rem' }}>
                Senac <span style={{ color: '#F47920' }}>Lanches</span>
              </div>
              <div style={s.brandSub}>Sua cantina digital</div>
            </div>
          </div>

          {!isMobile && (
            <>
              <p style={s.brandDesc}>
                Faça seu pedido com facilidade, acompanhe o preparo em tempo real e retire no balcão com QR Code.
              </p>
              <div style={s.featureList}>
                {['🛒 Cardápio digital completo', '⏱️ Acompanhamento ao vivo', '❤️ Favoritos e histórico'].map(f => (
                  <div key={f} style={s.featureItem}>{f}</div>
                ))}
              </div>
              <div style={{ marginTop: 'auto' }}>
                {quickAccess}
              </div>
            </>
          )}
        </div>

        {/* ── Painel Formulário ── */}
        <div style={{ ...s.formPanel, padding: isMobile ? '1.5rem 1.5rem 2rem' : '2.75rem 2.25rem' }}>
          <h2 style={{ ...s.formTitle, fontSize: isMobile ? '1.25rem' : '1.45rem' }}>Entrar na conta</h2>
          <p style={s.formSub}>Acesse com sua matrícula e senha</p>

          <form onSubmit={handleLogin} style={s.form}>
            <div style={s.campo}>
              <label style={s.label}>Matrícula</label>
              <div style={s.inputWrap}>
                <span style={s.inputIcon}>🎓</span>
                <input
                  style={s.input}
                  value={matricula}
                  onChange={e => { setMatricula(e.target.value); setErro('') }}
                  placeholder="Ex: 2024001"
                  autoComplete="username"
                />
              </div>
            </div>

            <div style={s.campo}>
              <label style={s.label}>Senha</label>
              <div style={s.inputWrap}>
                <span style={s.inputIcon}>🔒</span>
                <input
                  style={s.input}
                  type="password"
                  value={senha}
                  onChange={e => { setSenha(e.target.value); setErro('') }}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>
            </div>

            {selectedRole === 'aluno' && !usuarioLogado && (
              <p style={s.cadastroLink}>
                Não tem conta?{' '}
                <button type="button" onClick={() => navigate('/cadastro')} style={s.cadastroBtn}>
                  Cadastre-se
                </button>
              </p>
            )}

            {erro && <div style={s.erroBox}>{erro}</div>}

            <button type="submit" style={s.btnEntrar}>
              Entrar →
            </button>

            <button type="button" style={s.esqueceuBtn} onClick={() => setModalSenha(true)}>
              Esqueceu sua senha?
            </button>
          </form>

          {isMobile && (
            <div style={{ marginTop: '1.5rem', borderTop: '1px solid #F1F5F9', paddingTop: '1.25rem' }}>
              <p style={{ fontSize: '0.72rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600, marginBottom: 10 }}>
                Acesso rápido
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {hints.map(h => (
                  <button key={h.label}
                    style={{ padding: '0.4rem 0.85rem', borderRadius: 20, background: '#EFF6FF', border: '1px solid #DBEAFE', color: '#003D7C', fontWeight: 600, fontSize: '0.79rem', cursor: 'pointer', fontFamily: 'inherit' }}
                    onClick={() => { setMatricula(h.matricula); setSenha(h.senha); setErro(''); setSelectedRole(h.role) }}>
                    {h.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const s = {
  page: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'linear-gradient(135deg, #0B1E45 0%, #003D7C 55%, #004F9E 100%)',
    padding: '1rem',
  },
  card: {
    display: 'grid',
    borderRadius: 24, overflow: 'hidden',
    width: '100%', maxWidth: 820,
    boxShadow: '0 30px 80px rgba(0,0,0,0.4)',
  },

  /* Brand panel */
  brandPanel: {
    background: 'linear-gradient(160deg, #0B1E45 0%, #003D7C 100%)',
    display: 'flex', flexDirection: 'column', gap: '1.25rem', color: '#fff',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  brandMark: { display: 'flex', alignItems: 'center', gap: 12 },
  brandIcon: {
    background: 'linear-gradient(135deg, #F47920 0%, #FF9A4D 100%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 6px 20px rgba(244,121,32,0.5)', flexShrink: 0,
  },
  brandName: { fontWeight: 900, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.1 },
  brandSub: { fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, marginTop: 2 },
  brandDesc: { color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', lineHeight: 1.65 },
  featureList: { display: 'flex', flexDirection: 'column', gap: 8 },
  featureItem: { color: 'rgba(255,255,255,0.75)', fontSize: '0.86rem', fontWeight: 500 },

  /* Quick access */
  quickWrap: {},
  quickLabel: { fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600, marginBottom: 10 },
  quickBtns: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  quickBtn: {
    padding: '0.45rem 1rem', borderRadius: 20,
    background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)',
    color: '#fff', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer',
    fontFamily: 'inherit',
  },

  /* Form panel */
  formPanel: { background: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'center' },
  formTitle: { fontWeight: 800, color: '#0F172A', marginBottom: 4 },
  formSub: { color: '#64748B', fontSize: '0.86rem', marginBottom: '1.5rem' },
  form: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  campo: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontWeight: 600, fontSize: '0.82rem', color: '#374151' },
  inputWrap: { position: 'relative', display: 'flex', alignItems: 'center' },
  inputIcon: { position: 'absolute', left: 13, fontSize: '1rem', userSelect: 'none', pointerEvents: 'none' },
  input: {
    width: '100%', paddingLeft: '2.5rem', paddingRight: '1rem',
    paddingTop: '0.78rem', paddingBottom: '0.78rem',
    borderRadius: 12, border: '2px solid #E5E7EB',
    fontSize: '0.95rem', outline: 'none',
    background: '#F8FAFC', color: '#0F172A',
    fontFamily: 'inherit', transition: 'border-color 0.2s',
  },
  erroBox: {
    background: '#FEF2F2', color: '#DC2626', fontSize: '0.84rem',
    padding: '0.65rem 0.9rem', borderRadius: 10, textAlign: 'center',
    border: '1px solid #FECACA',
  },
  btnEntrar: {
    padding: '0.9rem', borderRadius: 12, border: 'none',
    background: 'linear-gradient(135deg, #F47920 0%, #E8650A 100%)',
    color: '#fff', fontWeight: 800, fontSize: '1rem', cursor: 'pointer',
    boxShadow: '0 6px 20px rgba(244,121,32,0.4)', marginTop: 4,
    fontFamily: 'inherit', letterSpacing: '0.01em',
  },
  cadastroLink: { fontSize: '0.84rem', color: '#64748B', textAlign: 'center' },
  cadastroBtn: { background: 'none', color: '#F47920', fontWeight: 700, fontSize: '0.84rem', padding: 0, border: 'none', cursor: 'pointer', fontFamily: 'inherit' },
  esqueceuBtn: { background: 'none', border: 'none', color: '#64748B', fontSize: '0.83rem', cursor: 'pointer', textAlign: 'center', fontFamily: 'inherit', textDecoration: 'underline', padding: '0.2rem 0' },

  /* Mobile quick access inside form panel */
  quickLabelDark: { fontSize: '0.72rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600, marginBottom: 10 },
  quickBtnDark: { padding: '0.4rem 0.9rem', borderRadius: 20, background: '#EFF6FF', border: '1px solid #DBEAFE', color: '#003D7C', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit' },
}
