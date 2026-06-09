import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { auth } from '../firebase'
import { checkActionCode, confirmPasswordReset } from 'firebase/auth'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const oobCode = searchParams.get('oobCode') || ''
  const [email, setEmail] = useState(searchParams.get('email') || '')
  const [senha, setSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [validando, setValidando] = useState(Boolean(oobCode))

  useEffect(() => {
    if (!oobCode) return
    checkActionCode(auth, oobCode)
      .then(info => {
        setEmail(info.data.email || '')
      })
      .catch(e => {
        console.error('checkActionCode:', e)
        setErro(e.message || 'Código inválido ou expirado. Solicite um novo link.')
      })
      .finally(() => setValidando(false))
  }, [oobCode])

  async function handleConfirmarSenha(e) {
    e.preventDefault()
    setErro('')
    if (!oobCode) {
      setErro('Link de redefinição inválido ou código ausente. Solicite um novo e-mail.')
      return
    }
    if (!senha || senha.length < 6) {
      setErro('A senha deve ter pelo menos 6 caracteres.')
      return
    }
    if (senha !== confirmar) {
      setErro('As senhas não conferem.')
      return
    }
    setCarregando(true)
    try {
      await confirmPasswordReset(auth, oobCode, senha)
      setSucesso(true)
    } catch (e) {
      console.error('confirmPasswordReset:', e)
      setErro(e.message || 'Não foi possível redefinir a senha. Tente novamente.')
    } finally {
      setCarregando(false)
    }
  }

  const descricao = oobCode
    ? 'Informe a nova senha abaixo para concluir a redefinição.'
    : 'Acesse o link enviado para o seu e-mail para redefinir sua senha.'

  return (
    <div style={s.page}>
      <div style={s.card}>
        <h1 style={s.titulo}>Redefinir senha</h1>
        <p style={s.sub}>{descricao}</p>

        {sucesso ? (
          <div style={s.sucessoBox}>
            <p style={s.sucessoTitulo}>Senha alterada com sucesso!</p>
            <p style={s.sucessoTexto}>Agora você pode fazer login com sua nova senha.</p>
            <button style={s.btn} onClick={() => navigate('/login')}>Ir para o login</button>
          </div>
        ) : (
          <form onSubmit={handleConfirmarSenha} style={s.form}>
            {oobCode && (
              <div style={s.infoLinha}>
                <strong>E-mail:</strong> {email || 'Validando...'}
              </div>
            )}
            <div style={s.campo}>
              <label style={s.label}>Nova senha</label>
              <input
                style={s.input}
                type="password"
                value={senha}
                onChange={e => setSenha(e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div style={s.campo}>
              <label style={s.label}>Confirmar senha</label>
              <input
                style={s.input}
                type="password"
                value={confirmar}
                onChange={e => setConfirmar(e.target.value)}
                placeholder="Repita a nova senha"
              />
            </div>
            {erro && <div style={s.erro}>{erro}</div>}
            <button style={s.btn} type="submit" disabled={carregando || validando}>
              {carregando ? 'Alterando...' : 'Alterar senha'}
            </button>
            {!oobCode && (
              <p style={s.aux}>Sem link? Volte para <Link to="/login">login</Link> e solicite novo e-mail.</p>
            )}
          </form>
        )}
      </div>
    </div>
  )
}

const s = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #003D7C 0%, #0055AA 50%, #F47920 100%)', padding: '1rem' },
  card: { width: '100%', maxWidth: 420, background: '#fff', borderRadius: 20, padding: '2rem', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' },
  titulo: { margin: 0, fontSize: '1.6rem', color: '#0B1E45' },
  sub: { marginTop: 10, color: '#64748B', lineHeight: 1.6 },
  form: { display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.25rem' },
  campo: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: '0.85rem', fontWeight: 700, color: '#334155' },
  input: { padding: '0.9rem 1rem', borderRadius: 12, border: '2px solid #E2E8F0', fontSize: '0.95rem', outline: 'none' },
  btn: { padding: '0.95rem', borderRadius: 12, border: 'none', background: '#F47920', color: '#fff', fontWeight: 800, cursor: 'pointer' },
  erro: { background: '#FEF2F2', color: '#B91C1C', padding: '0.8rem 1rem', borderRadius: 12, border: '1px solid #FECACA' },
  sucessoBox: { textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 14 },
  sucessoTitulo: { margin: 0, color: '#059669', fontSize: '1.25rem', fontWeight: 800 },
  sucessoTexto: { margin: 0, color: '#475569' },
  aux: { margin: 0, color: '#475569', fontSize: '0.9rem' },
  infoLinha: { color: '#334155', fontSize: '0.92rem' },
}
