import { useState } from 'react'
import Layout from '../components/Layout'
import { useApp } from '../contexts/AppContext'
import { useIsMobile } from '../utils/useIsMobile'

export default function PerfilStaff() {
  const { usuarioLogado, atualizarUsuario, alterarSenha, usuarios } = useApp()
  const usuarioAtualizado = usuarios.find(u => u.matricula === usuarioLogado?.matricula) || usuarioLogado

  const [form, setForm] = useState({ nome: '', email: '', telefone: '', fotoPerfil: '' })
  const [senhaForm, setSenhaForm] = useState({ atual: '', nova: '', confirmar: '' })
  const [msgPerfil, setMsgPerfil] = useState(null)
  const [msgSenha, setMsgSenha] = useState(null)

  // Repopula o formulário quando o usuário logado muda (ex.: após login)
  const [formMatricula, setFormMatricula] = useState(null)
  if (usuarioAtualizado?.matricula !== formMatricula) {
    setFormMatricula(usuarioAtualizado?.matricula)
    setForm({
      nome: usuarioAtualizado?.nome || '',
      email: usuarioAtualizado?.email || '',
      telefone: usuarioAtualizado?.telefone || '',
      fotoPerfil: usuarioAtualizado?.fotoPerfil || '',
    })
  }

  function maskTel(val) {
    const n = val.replace(/\D/g, '').slice(0, 11)
    if (n.length > 7) return `(${n.slice(0,2)}) ${n.slice(2,7)}-${n.slice(7)}`
    if (n.length > 2) return `(${n.slice(0,2)}) ${n.slice(2)}`
    if (n.length > 0) return `(${n}`
    return n
  }

  function handleChange(e) {
    const { name, value } = e.target
    setForm(p => ({ ...p, [name]: name === 'telefone' ? maskTel(value) : value }))
    setMsgPerfil(null)
  }

  async function handleSalvar(e) {
    e.preventDefault()
    if (!form.nome.trim()) { setMsgPerfil({ erro: 'Nome é obrigatório.' }); return }
    const res = await atualizarUsuario(usuarioLogado.matricula, {
      nome: form.nome.trim(),
      email: form.email.trim().toLowerCase(),
      telefone: form.telefone,
    })
    setMsgPerfil(res.erro ? { erro: res.erro } : { ok: 'Dados atualizados com sucesso!' })
  }

  function handleFotoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setMsgPerfil({ info: 'Processando foto...' })
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = async () => {
      try {
        const MAX = 900
        const scale = Math.min(MAX / img.width, MAX / img.height, 1)
        const canvas = document.createElement('canvas')
        canvas.width  = Math.round(img.width  * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
        let quality = 0.85
        let dataUrl = canvas.toDataURL('image/jpeg', quality)
        while (dataUrl.length > 750_000 && quality > 0.1) {
          quality = Math.round((quality - 0.1) * 10) / 10
          dataUrl = canvas.toDataURL('image/jpeg', quality)
        }
        setForm(p => ({ ...p, fotoPerfil: dataUrl }))
        const res = await atualizarUsuario(usuarioLogado.matricula, { fotoPerfil: dataUrl })
        setMsgPerfil(res.erro ? { erro: 'Erro ao salvar foto.' } : { ok: 'Foto atualizada!' })
      } catch { setMsgPerfil({ erro: 'Erro ao processar imagem.' }) }
      URL.revokeObjectURL(url)
    }
    img.onerror = () => { setMsgPerfil({ erro: 'Formato não suportado.' }); URL.revokeObjectURL(url) }
    img.src = url
  }

  async function handleSenha(e) {
    e.preventDefault()
    if (!senhaForm.atual || !senhaForm.nova) { setMsgSenha({ erro: 'Preencha todos os campos.' }); return }
    if (senhaForm.nova !== senhaForm.confirmar) { setMsgSenha({ erro: 'As senhas não conferem.' }); return }
    if (senhaForm.nova.length < 4) { setMsgSenha({ erro: 'Mínimo 4 caracteres.' }); return }
    const res = await alterarSenha(usuarioLogado.matricula, senhaForm.atual, senhaForm.nova)
    if (res.erro) { setMsgSenha({ erro: res.erro }); return }
    setMsgSenha({ ok: 'Senha alterada com sucesso!' })
    setSenhaForm({ atual: '', nova: '', confirmar: '' })
  }

  const isMobile = useIsMobile()
  const avatarSrc = form.fotoPerfil
  const label = { aluno: 'Aluno', cozinha: 'Cozinha', gerente: 'Gerente', admin: 'Administrador' }[usuarioLogado?.perfil] || ''
  const inputPad = isMobile ? '0.65rem 0.85rem' : '0.78rem 1rem'
  const cardPad = isMobile ? '0.9rem' : '1.25rem'
  const formGap = isMobile ? '0.6rem' : '0.85rem'

  return (
    <Layout titulo="">
      <div style={{ ...s.page, gap: isMobile ? '0.65rem' : '1rem' }}>
        <div style={{ ...s.heroCard, padding: isMobile ? '0.9rem' : '1.4rem 1.25rem' }}>
          <div style={{ flex: 1 }}>
            <p style={s.heroLabel}>Meu perfil</p>
            <h1 style={{ ...s.heroTitle, fontSize: isMobile ? '1.1rem' : '1.3rem' }}>{usuarioAtualizado?.nome}</h1>
            <p style={{ ...s.heroSub, fontSize: isMobile ? '0.78rem' : '0.82rem' }}>{label} · {usuarioLogado?.matricula}</p>
          </div>
          <div style={{ ...s.heroAvatar, width: isMobile ? 50 : 60, height: isMobile ? 50 : 60 }}>
            {avatarSrc
              ? <img src={avatarSrc} alt="Foto" style={s.heroAvatarImg} />
              : <div style={{ ...s.heroAvatarLetra, width: isMobile ? 50 : 60, height: isMobile ? 50 : 60, fontSize: isMobile ? '1.2rem' : '1.4rem' }}>{usuarioAtualizado?.nome?.[0]?.toUpperCase() || '?'}</div>}
          </div>
        </div>

        <div style={{ ...s.card, padding: cardPad }}>
          <h2 style={{ ...s.cardTitle, fontSize: isMobile ? '0.95rem' : '1rem' }}>Dados pessoais</h2>
          <form onSubmit={handleSalvar} style={{ ...s.form, gap: formGap }}>
            <div style={s.fieldRow}>
              <label style={s.fieldLabel}>Foto</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {avatarSrc
                  ? <img src={avatarSrc} alt="Foto" style={{ width: isMobile ? 44 : 56, height: isMobile ? 44 : 56, borderRadius: '50%', objectFit: 'cover', border: '3px solid #DBEAFE' }} />
                  : <div style={{ width: isMobile ? 44 : 56, height: isMobile ? 44 : 56, borderRadius: '50%', background: '#1D4ED8', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 800 }}>{usuarioAtualizado?.nome?.[0]?.toUpperCase()}</div>}
                <label style={{ cursor: 'pointer' }}>
                  <span style={{ ...s.btnFoto, padding: isMobile ? '0.4rem 0.8rem' : '0.5rem 1rem', fontSize: isMobile ? '0.78rem' : '0.82rem' }}>{msgPerfil?.info ? '⏳ Processando...' : '📷 Alterar foto'}</span>
                  <input type="file" accept="image/*" onChange={handleFotoChange} style={{ display: 'none' }} />
                </label>
              </div>
            </div>
            {[
              { name: 'nome', label: 'Nome', type: 'text' },
              { name: 'email', label: 'E-mail', type: 'email' },
              { name: 'telefone', label: 'Telefone', type: 'tel' },
            ].map(({ name, label, type }) => (
              <div key={name} style={s.fieldRow}>
                <label style={s.fieldLabel}>{label}</label>
                <input style={{ ...s.input, padding: inputPad }} name={name} type={type} value={form[name]} onChange={handleChange} />
              </div>
            ))}
            {msgPerfil?.info && <p style={{ color: '#2563EB', fontSize: '0.85rem', margin: 0 }}>{msgPerfil.info}</p>}
            {msgPerfil?.erro && <p style={s.erro}>{msgPerfil.erro}</p>}
            {msgPerfil?.ok && <p style={s.ok}>{msgPerfil.ok}</p>}
            <button type="submit" style={{ ...s.btnPrimario, padding: isMobile ? '0.72rem' : '0.88rem' }}>Salvar dados</button>
          </form>
        </div>

        <div style={{ ...s.card, padding: cardPad }}>
          <h2 style={{ ...s.cardTitle, fontSize: isMobile ? '0.95rem' : '1rem' }}>Alterar senha</h2>
          <form onSubmit={handleSenha} style={{ ...s.form, gap: formGap }}>
            {[
              { name: 'atual', label: 'Senha atual', ph: '••••••' },
              { name: 'nova', label: 'Nova senha', ph: 'Mínimo 4 caracteres' },
              { name: 'confirmar', label: 'Confirmar nova senha', ph: 'Repita a nova senha' },
            ].map(({ name, label, ph }) => (
              <div key={name} style={s.fieldRow}>
                <label style={s.fieldLabel}>{label}</label>
                <input style={{ ...s.input, padding: inputPad }} type="password" name={name} value={senhaForm[name]}
                  onChange={e => { setSenhaForm(p => ({ ...p, [e.target.name]: e.target.value })); setMsgSenha(null) }}
                  placeholder={ph} />
              </div>
            ))}
            {msgSenha?.erro && <p style={s.erro}>{msgSenha.erro}</p>}
            {msgSenha?.ok && <p style={s.ok}>{msgSenha.ok}</p>}
            <button type="submit" style={{ ...s.btnPrimario, padding: isMobile ? '0.72rem' : '0.88rem' }}>Alterar senha</button>
          </form>
        </div>
      </div>
    </Layout>
  )
}

const s = {
  page: { display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 520, margin: '0 auto', paddingBottom: '2rem' },
  heroCard: { background: '#0F172A', color: '#fff', borderRadius: 22, padding: '1.4rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  heroLabel: { margin: 0, fontSize: '0.78rem', color: '#93C5FD', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' },
  heroTitle: { margin: '0.3rem 0 0', fontSize: '1.3rem', fontWeight: 800, lineHeight: 1.1 },
  heroSub: { margin: '0.3rem 0 0', fontSize: '0.82rem', color: '#CBD5E1' },
  heroAvatar: { width: 60, height: 60, borderRadius: 999, overflow: 'hidden', flexShrink: 0 },
  heroAvatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  heroAvatarLetra: { width: 60, height: 60, borderRadius: 999, background: '#1D4ED8', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', fontWeight: 800 },
  card: { background: '#fff', borderRadius: 18, padding: '1.25rem', boxShadow: '0 4px 20px rgba(15,23,42,0.07)' },
  cardTitle: { margin: '0 0 1rem', fontSize: '1rem', fontWeight: 800, color: '#0F172A' },
  form: { display: 'flex', flexDirection: 'column', gap: '0.85rem' },
  fieldRow: { display: 'flex', flexDirection: 'column', gap: 6 },
  fieldLabel: { fontWeight: 700, fontSize: '0.82rem', color: '#374151' },
  input: { padding: '0.78rem 1rem', borderRadius: 12, border: '1px solid #D1D5DB', background: '#F8FAFC', fontSize: '0.95rem', color: '#0F172A', outline: 'none', fontFamily: 'inherit' },
  btnFoto: { padding: '0.5rem 1rem', borderRadius: 10, background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1D4ED8', fontWeight: 700, fontSize: '0.82rem', display: 'inline-block' },
  btnPrimario: { padding: '0.88rem', borderRadius: 12, background: '#1D4ED8', color: '#fff', fontWeight: 700, fontSize: '0.95rem', border: 'none', cursor: 'pointer', fontFamily: 'inherit' },
  erro: { color: '#B91C1C', fontSize: '0.85rem', margin: 0 },
  ok: { color: '#059669', fontSize: '0.85rem', margin: 0 },
}
