import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../contexts/AppContext'
import { useIsMobile } from '../utils/useIsMobile'

export default function Cadastro() {
  const { cadastrar, usuarioLogado, logout, redefinirSenhaVerificada } = useApp()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [form, setForm] = useState({ nome: '', matricula: '', curso: '', telefone: '', email: '', senha: '', confirmar: '' })
  const alergOptions = ['gluten', 'lactose', 'amendoim', 'ovo', 'soja', 'frutos-do-mar']
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [cadastroExistente, setCadastroExistente] = useState(null)
  const [enviandoLink, setEnviandoLink] = useState(false)
  const [msgLink, setMsgLink] = useState('')

  const contaExistente = cadastroExistente || (usuarioLogado ? {
    nome: usuarioLogado.nome || 'usuário logado',
    email: usuarioLogado.email || '',
    matricula: usuarioLogado.matricula || '',
    logado: true,
  } : null)

  function handle(e) {
    if (e.target.name === 'telefone') {
      const nums = e.target.value.replace(/\D/g, '').slice(0, 11)
      let masked = nums
      if (nums.length > 7) masked = `(${nums.slice(0, 2)}) ${nums.slice(2, 7)}-${nums.slice(7)}`
      else if (nums.length > 2) masked = `(${nums.slice(0, 2)}) ${nums.slice(2)}`
      else if (nums.length > 0) masked = `(${nums}`
      setForm({ ...form, telefone: masked })
    } else {
      setForm({ ...form, [e.target.name]: e.target.value })
    }
    setErro('')
    setCadastroExistente(null)
    setMsgLink('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (salvando) return
    setCadastroExistente(null)
    setMsgLink('')
    if (!form.nome || !form.email || !form.matricula || !form.senha) {
      setErro('Preencha nome, e-mail, matrícula e senha.')
      return
    }
    if (form.senha !== form.confirmar) {
      setErro('As senhas não conferem.')
      return
    }
    if (form.senha.length < 6) {
      setErro('A senha deve ter pelo menos 6 caracteres.')
      return
    }
    setSalvando(true)
    try {
      const res = await cadastrar(form)
      if (res.erro) {
        if (res.duplicado || res.usuario) {
          setCadastroExistente(res.usuario || { nome: form.nome, email: form.email, matricula: form.matricula })
        }
        setErro(res.erro)
        return
      }
      setOk(true)
      setTimeout(() => navigate('/login'), 2000)
    } finally {
      setSalvando(false)
    }
  }

  async function enviarLinkSenha() {
    const email = contaExistente?.email || form.email
    if (!email) {
      setMsgLink('Não encontramos e-mail nesse cadastro. Procure a administração.')
      return
    }
    setEnviandoLink(true)
    setMsgLink('')
    try {
      const res = await redefinirSenhaVerificada(email)
      setMsgLink(res.erro || `Enviamos o link de redefinição para ${email}.`)
    } finally {
      setEnviandoLink(false)
    }
  }

  async function sairParaCadastrarOutro() {
    await logout?.()
    setCadastroExistente(null)
    setErro('')
    setMsgLink('')
  }

  return (
    <div style={{ ...s.page, alignItems: isMobile ? 'flex-start' : 'center', paddingTop: isMobile ? '1.5rem' : '1rem' }}>
      <div style={{ ...s.card, padding: isMobile ? '1.25rem 1rem' : '2rem' }}>
        <button type="button" onClick={() => navigate('/login')} style={s.voltar}>Voltar ao login</button>
        <div style={s.header}>
          <div style={s.logo}>Cadastro</div>
          <h1 style={s.titulo}>Criar conta</h1>
          <p style={s.sub}>Aluno do Senac</p>
        </div>

        {ok ? (
          <div style={s.sucesso}>
            <p style={{ fontWeight: 800, color: '#059669', margin: 0 }}>Cadastro realizado!</p>
            <p style={{ color: '#64748B', fontSize: '0.85rem', margin: 0 }}>Redirecionando para o login...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={s.form}>
            {[
              { name: 'nome', label: 'Nome completo', placeholder: 'Ex: João Silva' },
              { name: 'email', label: 'E-mail', placeholder: 'Ex: seunome@gmail.com' },
              { name: 'matricula', label: 'Matrícula', placeholder: 'Ex: 2024005' },
              { name: 'curso', label: 'Curso', placeholder: 'Ex: Desenvolvimento de Sistemas' },
              { name: 'telefone', label: 'Telefone', placeholder: 'Ex: (11) 99999-0001' },
            ].map(({ name, label, placeholder }) => (
              <div key={name} style={s.campo}>
                <label style={s.label}>{label}</label>
                <input style={s.input} name={name} value={form[name]} onChange={handle} placeholder={placeholder} />
              </div>
            ))}
            <div style={s.campo}>
              <label style={s.label}>Senha</label>
              <input style={s.input} type="password" name="senha" value={form.senha} onChange={handle} placeholder="Mínimo 6 caracteres" />
            </div>
            <div style={s.campo}>
              <label style={s.label}>Confirmar senha</label>
              <input style={s.input} type="password" name="confirmar" value={form.confirmar} onChange={handle} placeholder="Repita a senha" />
            </div>
            <div style={s.campo}>
              <label style={s.label}>Alergias (marque as que tiver)</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {alergOptions.map(a => (
                  <label key={a} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input type="checkbox" onChange={e => setForm(prev => ({ ...prev, alergias: (prev.alergias || []).filter(x => x !== a).concat(e.target.checked ? [a] : []) }))} />
                    <span style={{ textTransform: 'capitalize' }}>{a.replace('-', ' ')}</span>
                  </label>
                ))}
              </div>
            </div>

            {contaExistente && (
              <div style={s.infoConta}>
                <strong style={s.infoTitulo}>Conta já existente</strong>
                <span>Encontramos um cadastro para {contaExistente.nome || 'este aluno'}.</span>
                {contaExistente.matricula && <span>Matrícula: {contaExistente.matricula}</span>}
                {contaExistente.email && <span>E-mail: {contaExistente.email}</span>}
                <span>Para acessar, redefina a senha desta conta.</span>
                <button type="button" style={s.btnSecundario} onClick={enviarLinkSenha} disabled={enviandoLink}>
                  {enviandoLink ? 'Enviando...' : 'Enviar link para redefinir senha'}
                </button>
                {contaExistente.logado && (
                  <button type="button" style={s.linkSenha} onClick={sairParaCadastrarOutro}>
                    Sair desta conta
                  </button>
                )}
                {msgLink && <span style={s.msgLink}>{msgLink}</span>}
              </div>
            )}

            {erro && !contaExistente && <p style={s.erro}>{erro}</p>}
            <button type="submit" style={{ ...s.btn, opacity: salvando ? 0.7 : 1 }} disabled={salvando}>
              {salvando ? 'Criando...' : 'Criar conta'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

const s = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #003D7C 0%, #0055AA 50%, #F47920 100%)', padding: '1rem' },
  card: { background: '#fff', borderRadius: 20, padding: '2rem', width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
  voltar: { background: 'none', color: '#64748B', fontSize: '0.85rem', padding: 0, marginBottom: '1rem', display: 'block', border: 'none', cursor: 'pointer' },
  header: { textAlign: 'center', marginBottom: '1.5rem' },
  logo: { fontSize: '0.84rem', fontWeight: 800, color: '#F47920', marginBottom: 8 },
  titulo: { fontSize: '1.6rem', fontWeight: 800, color: '#003D7C', margin: 0 },
  sub: { color: '#64748B', fontSize: '0.85rem', marginTop: 2 },
  form: { display: 'flex', flexDirection: 'column', gap: '0.85rem' },
  campo: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: { fontWeight: 600, fontSize: '0.82rem', color: '#1A202C' },
  input: { padding: '0.7rem 0.9rem', borderRadius: 10, border: '2px solid #E2E8F0', fontSize: '0.92rem', outline: 'none', width: '100%', boxSizing: 'border-box' },
  infoConta: { display: 'flex', flexDirection: 'column', gap: 7, background: '#FFF7ED', border: '2px solid #FDBA74', borderRadius: 14, padding: '1rem', color: '#7C2D12', fontSize: '0.88rem', lineHeight: 1.35, boxShadow: '0 10px 25px rgba(124,45,18,0.08)' },
  infoTitulo: { fontSize: '1rem', color: '#9A3412' },
  erro: { color: '#EF4444', fontSize: '0.82rem', textAlign: 'center', margin: 0, lineHeight: 1.35 },
  msgLink: { color: '#166534', fontWeight: 700 },
  linkSenha: { background: 'none', border: 'none', color: '#003D7C', fontWeight: 800, padding: 0, cursor: 'pointer', textAlign: 'left' },
  btn: { padding: '0.85rem', borderRadius: 10, background: '#F47920', color: '#fff', border: 'none', fontWeight: 700, fontSize: '1rem', marginTop: 4, cursor: 'pointer' },
  btnSecundario: { padding: '0.72rem 0.85rem', borderRadius: 10, background: '#003D7C', color: '#fff', border: 'none', fontWeight: 800, cursor: 'pointer', marginTop: 4 },
  sucesso: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '1.5rem 0', textAlign: 'center' },
}
