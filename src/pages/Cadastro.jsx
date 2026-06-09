import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../contexts/AppContext'
import { caminhoInicialPorPerfil } from '../utils/perfis'

export default function Cadastro() {
  const { cadastrar, usuarioLogado } = useApp()
  const navigate = useNavigate()

  useEffect(() => {
    if (!usuarioLogado) return
    navigate(caminhoInicialPorPerfil(usuarioLogado.perfil))
  }, [usuarioLogado, navigate])
  const [form, setForm] = useState({ nome: '', matricula: '', curso: '', telefone: '', email: '', senha: '', confirmar: '' })
  const alergOptions = ['gluten', 'lactose', 'amendoim', 'ovo', 'soja', 'frutos-do-mar']
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState(false)

  function handle(e) {
    if (e.target.name === 'telefone') {
      const nums = e.target.value.replace(/\D/g, '').slice(0, 11)
      let masked = nums
      if (nums.length > 7) masked = `(${nums.slice(0,2)}) ${nums.slice(2,7)}-${nums.slice(7)}`
      else if (nums.length > 2) masked = `(${nums.slice(0,2)}) ${nums.slice(2)}`
      else if (nums.length > 0) masked = `(${nums}`
      setForm({ ...form, telefone: masked })
    } else {
      setForm({ ...form, [e.target.name]: e.target.value })
    }
    setErro('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.nome || !form.email || !form.matricula || !form.senha) { setErro('Preencha nome, e-mail, matricula e senha.'); return }
    if (form.senha !== form.confirmar) { setErro('As senhas não conferem.'); return }
    if (form.senha.length < 6) { setErro('A senha deve ter pelo menos 6 caracteres.'); return }
    const res = await cadastrar(form)
    if (res.erro) { setErro(res.erro); return }
    setOk(true)
    setTimeout(() => navigate('/login'), 2000)
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <button onClick={() => navigate('/login')} style={s.voltar}>← Voltar ao login</button>
        <div style={s.header}>
          <div style={s.logo}>📝</div>
          <h1 style={s.titulo}>Criar conta</h1>
          <p style={s.sub}>Aluno do Senac</p>
        </div>

        {ok ? (
          <div style={s.sucesso}>
            <span style={{ fontSize: 40 }}>🎉</span>
            <p style={{ fontWeight: 700, color: '#059669' }}>Cadastro realizado!</p>
            <p style={{ color: '#64748B', fontSize: '0.85rem' }}>Redirecionando para o login...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={s.form}>
            {[
              { name: 'nome', label: 'Nome completo', placeholder: 'Ex: João Silva' },
              { name: 'email',    label: 'E-mail',    placeholder: 'Ex: seunome@gmail.com' },
              { name: 'matricula', label: 'Matrícula', placeholder: 'Ex: 2024005' },
              { name: 'curso',     label: 'Curso',     placeholder: 'Ex: Desenvolvimento de Sistemas' },
            { name: 'telefone', label: 'Telefone',  placeholder: 'Ex: (11) 99999-0001' },
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
            {erro && <p style={s.erro}>{erro}</p>}
            <button type="submit" style={s.btn}>Criar conta</button>
          </form>
        )}
      </div>
    </div>
  )
}

const s = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #003D7C 0%, #0055AA 50%, #F47920 100%)', padding: '1rem' },
  card: { background: '#fff', borderRadius: 20, padding: '2rem', width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
  voltar: { background: 'none', color: '#64748B', fontSize: '0.85rem', padding: 0, marginBottom: '1rem', display: 'block' },
  header: { textAlign: 'center', marginBottom: '1.5rem' },
  logo: { fontSize: 40, marginBottom: 8 },
  titulo: { fontSize: '1.6rem', fontWeight: 800, color: '#003D7C', margin: 0 },
  sub: { color: '#64748B', fontSize: '0.85rem', marginTop: 2 },
  form: { display: 'flex', flexDirection: 'column', gap: '0.85rem' },
  campo: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: { fontWeight: 600, fontSize: '0.82rem', color: '#1A202C' },
  input: { padding: '0.7rem 0.9rem', borderRadius: 10, border: '2px solid #E2E8F0', fontSize: '0.92rem', outline: 'none' },
  erro: { color: '#EF4444', fontSize: '0.82rem', textAlign: 'center' },
  btn: { padding: '0.85rem', borderRadius: 10, background: '#F47920', color: '#fff', fontWeight: 700, fontSize: '1rem', marginTop: 4 },
  sucesso: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '1.5rem 0', textAlign: 'center' },
}
