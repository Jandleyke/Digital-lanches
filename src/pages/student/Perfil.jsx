import { useState } from 'react'
import Layout from '../../components/Layout'
import { useApp } from '../../contexts/AppContext'
import { useIsMobile } from '../../utils/useIsMobile'
import { suportaNotificacao, permissaoNotificacao, solicitarPermissaoNotificacao } from '../../utils/notifications'

const ALERGIAS_PADRAO = ['gluten', 'lactose', 'amendoim', 'ovo', 'soja', 'frutos-do-mar']

export default function Perfil() {
  const { usuarioLogado, atualizarUsuario, alterarSenha, usuarios } = useApp()
  const isMobile = useIsMobile()
  const usuarioAtualizado = usuarios.find(u => u.matricula === usuarioLogado?.matricula) || usuarioLogado

  const [perfilForm, setPerfilForm] = useState({ nome: usuarioAtualizado?.nome || '', curso: usuarioAtualizado?.curso || '', telefone: usuarioAtualizado?.telefone || '', email: usuarioAtualizado?.email || '', fotoPerfil: usuarioAtualizado?.fotoPerfil || '', alergias: usuarioAtualizado?.alergias || [] })
  const [senhaForm, setSenhaForm] = useState({ atual: '', nova: '', confirmar: '' })
  const [msgPerfil, setMsgPerfil] = useState(null)
  const [msgSenha, setMsgSenha] = useState(null)
  const [novaAlergia, setNovaAlergia] = useState('')
  const [permissaoNotif, setPermissaoNotif] = useState(() => permissaoNotificacao())

  async function ativarNotificacoes() {
    const resultado = await solicitarPermissaoNotificacao()
    setPermissaoNotif(resultado)
  }

  // Repopula o formulário quando os dados do usuário mudam (ex.: sincronização do Firestore)
  const syncKeyAtual = `${usuarioAtualizado?.nome}|${usuarioAtualizado?.curso}|${usuarioAtualizado?.telefone}|${usuarioAtualizado?.email}|${usuarioAtualizado?.fotoPerfil}|${(usuarioAtualizado?.alergias || []).join(',')}`
  const [syncKey, setSyncKey] = useState(syncKeyAtual)
  if (syncKeyAtual !== syncKey) {
    setSyncKey(syncKeyAtual)
    setPerfilForm({
      nome: usuarioAtualizado?.nome || '',
      curso: usuarioAtualizado?.curso || '',
      telefone: usuarioAtualizado?.telefone || '',
      email: usuarioAtualizado?.email || '',
      fotoPerfil: usuarioAtualizado?.fotoPerfil || '',
      alergias: usuarioAtualizado?.alergias || []
    })
  }

  function handlePerfilChange(e) {
    if (e.target.name === 'telefone') {
      const nums = e.target.value.replace(/\D/g, '').slice(0, 11)
      let masked = nums
      if (nums.length > 7) masked = `(${nums.slice(0,2)}) ${nums.slice(2,7)}-${nums.slice(7)}`
      else if (nums.length > 2) masked = `(${nums.slice(0,2)}) ${nums.slice(2)}`
      else if (nums.length > 0) masked = `(${nums}`
      setPerfilForm(prev => ({ ...prev, telefone: masked }))
    } else {
      setPerfilForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    }
    setMsgPerfil(null)
  }

  function toggleAlergia(a) {
    setPerfilForm(prev => {
      const arr = prev.alergias || []
      return { ...prev, alergias: arr.includes(a) ? arr.filter(x => x !== a) : [...arr, a] }
    })
  }

  function adicionarAlergia() {
    const val = novaAlergia.trim().toLowerCase()
    if (!val) return
    setPerfilForm(prev => {
      const arr = prev.alergias || []
      if (arr.includes(val)) { setNovaAlergia(''); return prev }
      return { ...prev, alergias: [...arr, val] }
    })
    setNovaAlergia('')
  }

  function removerAlergia(a) {
    setPerfilForm(prev => ({ ...prev, alergias: (prev.alergias || []).filter(x => x !== a) }))
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
        setPerfilForm(prev => ({ ...prev, fotoPerfil: dataUrl }))
        const res = await atualizarUsuario(usuarioLogado.matricula, { fotoPerfil: dataUrl })
        setMsgPerfil(res.erro ? { erro: 'Erro ao salvar foto. Tente novamente.' } : { ok: 'Foto atualizada!' })
      } catch {
        setMsgPerfil({ erro: 'Erro ao processar imagem. Tente outro arquivo.' })
      }
      URL.revokeObjectURL(url)
    }
    img.onerror = () => {
      setMsgPerfil({ erro: 'Formato não suportado. Use JPEG ou PNG.' })
      URL.revokeObjectURL(url)
    }
    img.src = url
  }

  async function handleSalvarPerfil(e) {
    e.preventDefault()
    if (!perfilForm.nome.trim()) {
      setMsgPerfil({ erro: 'O nome é obrigatório.' })
      return
    }
    const dados = {
      nome: perfilForm.nome.trim(),
      curso: perfilForm.curso.trim(),
      telefone: perfilForm.telefone || '',
      email: perfilForm.email.trim().toLowerCase() || '',
      fotoPerfil: perfilForm.fotoPerfil || '',
      alergias: perfilForm.alergias || []
    }
    const res = await atualizarUsuario(usuarioLogado.matricula, dados)
    if (res.erro) {
      setMsgPerfil({ erro: res.erro })
      return
    }
    setMsgPerfil({ ok: 'Dados pessoais atualizados com sucesso!' })
  }

  function handleSenhaChange(e) {
    setSenhaForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setMsgSenha(null)
  }

  async function handleSenha(e) {
    e.preventDefault()
    if (!senhaForm.atual || !senhaForm.nova) {
      setMsgSenha({ erro: 'Preencha todos os campos.' })
      return
    }
    if (senhaForm.nova !== senhaForm.confirmar) {
      setMsgSenha({ erro: 'As senhas não conferem.' })
      return
    }
    if (senhaForm.nova.length < 4) {
      setMsgSenha({ erro: 'Nova senha deve ter pelo menos 4 caracteres.' })
      return
    }
    const res = await alterarSenha(usuarioLogado.matricula, senhaForm.atual, senhaForm.nova)
    if (res.erro) {
      setMsgSenha({ erro: res.erro })
      return
    }
    setMsgSenha({ ok: 'Senha alterada com sucesso!' })
    setSenhaForm({ atual: '', nova: '', confirmar: '' })
  }

  const avatarSrc = perfilForm.fotoPerfil || usuarioAtualizado?.fotoPerfil
  const avatarInitial = usuarioAtualizado?.nome?.[0]?.toUpperCase() || '?'

  return (
    <Layout titulo="">
      <div style={s.page}>
        <div style={{ ...s.heroCard, padding: isMobile ? '1rem 1rem' : '1.35rem 1.25rem', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <p style={{ ...s.heroLabel, fontSize: isMobile ? '0.78rem' : '0.85rem' }}>Olá, {usuarioAtualizado?.nome}</p>
            <h1 style={{ ...s.heroTitle, fontSize: isMobile ? '1.1rem' : '1.45rem' }}>Perfil do Aluno</h1>
            {!isMobile && <p style={s.heroText}>Gerencie suas informações de conta e segurança em um só lugar.</p>}
          </div>
          <div style={{ ...s.heroAvatar, flexShrink: 0, width: isMobile ? 52 : 72, height: isMobile ? 52 : 72 }}>
            {avatarSrc ? (
              <img src={avatarSrc} alt="Foto do perfil" style={s.heroAvatarImg} />
            ) : (
              <div style={{ ...s.heroAvatarInitial, width: isMobile ? 52 : 72, height: isMobile ? 52 : 72, fontSize: isMobile ? '1.3rem' : '1.85rem' }}>{avatarInitial}</div>
            )}
          </div>
        </div>

        <div style={{ ...s.sectionCard, padding: isMobile ? '0.9rem' : '1.25rem' }}>
          <div style={{ ...s.sectionHeader, marginBottom: isMobile ? '0.6rem' : '1rem' }}>
            <div>
              <h2 style={{ ...s.sectionTitle, fontSize: isMobile ? '0.97rem' : '1.1rem' }}>Dados Pessoais</h2>
              {!isMobile && <p style={s.sectionSubtitle}>Atualize nome, curso e foto de perfil.</p>}
            </div>
          </div>
          <form onSubmit={handleSalvarPerfil} style={{ ...s.form, gap: isMobile ? '0.65rem' : '1rem' }}>
            <div style={s.fieldRow}>
              <label style={s.label}>Nome</label>
              <input style={{ ...s.input, padding: isMobile ? '0.7rem 0.85rem' : '0.95rem 1rem' }} name="nome" value={perfilForm.nome} onChange={handlePerfilChange} placeholder="Digite seu nome" />
            </div>
            <div style={s.fieldRow}>
              <label style={s.label}>Curso</label>
              <input style={{ ...s.input, padding: isMobile ? '0.7rem 0.85rem' : '0.95rem 1rem' }} name="curso" value={perfilForm.curso} onChange={handlePerfilChange} placeholder="Digite seu curso" />
            </div>
            <div style={s.fieldRow}>
              <label style={s.label}>Telefone</label>
              <input style={{ ...s.input, padding: isMobile ? '0.7rem 0.85rem' : '0.95rem 1rem' }} name="telefone" value={perfilForm.telefone} onChange={handlePerfilChange} placeholder="(11) 99999-0001" inputMode="tel" />
            </div>
            <div style={s.fieldRow}>
              <label style={s.label}>E-mail</label>
              <input style={{ ...s.input, padding: isMobile ? '0.7rem 0.85rem' : '0.95rem 1rem' }} name="email" type="email" value={perfilForm.email} onChange={handlePerfilChange} placeholder="seunome@gmail.com" inputMode="email" />
              <p style={{ fontSize: '0.76rem', color: '#94A3B8', margin: 0 }}>Usado para redefinir sua senha se esquecer.</p>
            </div>
            <div style={s.fieldRow}>
              <label style={s.label}>Foto do perfil</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                {avatarSrc
                  ? <img src={avatarSrc} alt="Foto atual" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '3px solid #DBEAFE', flexShrink: 0 }} />
                  : <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#1D4ED8', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 800, flexShrink: 0 }}>{usuarioAtualizado?.nome?.[0]?.toUpperCase() || '?'}</div>
                }
                <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, cursor: 'pointer' }}>
                  <span style={{ padding: '0.6rem 1rem', borderRadius: 12, background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1D4ED8', fontWeight: 700, fontSize: '0.85rem', textAlign: 'center' }}>
                    {msgPerfil?.info ? '⏳ Processando...' : '📷 Escolher foto'}
                  </span>
                  <input type="file" accept="image/*" onChange={handleFotoChange} style={{ display: 'none' }} />
                  <span style={{ fontSize: '0.72rem', color: '#94A3B8', textAlign: 'center' }}>Foto salva automaticamente</span>
                </label>
              </div>
            </div>
            <div style={s.fieldRow}>
              <label style={s.label}>Alergias</label>
              <p style={{ fontSize: '0.75rem', color: '#94A3B8', margin: '0 0 5px' }}>Alergias comuns:</p>
              <div style={s.badgeGroup}>
                {ALERGIAS_PADRAO.map(a => (
                  <button type="button" key={a} onClick={() => toggleAlergia(a)} style={{ ...s.badgePill, ...(perfilForm.alergias || []).includes(a) ? s.badgePillActive : {} }}>{a.replace('-', ' ')}</button>
                ))}
              </div>
              <p style={{ fontSize: '0.75rem', color: '#94A3B8', margin: '10px 0 5px' }}>Outras alergias:</p>
              {(perfilForm.alergias || []).filter(a => !ALERGIAS_PADRAO.includes(a)).length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  {(perfilForm.alergias || []).filter(a => !ALERGIAS_PADRAO.includes(a)).map(a => (
                    <span key={a} style={{ ...s.badgePill, ...s.badgePillActive, display: 'flex', alignItems: 'center', gap: 5, paddingRight: '0.55rem' }}>
                      {a}
                      <button type="button" onClick={() => removerAlergia(a)} style={{ background: 'none', border: 'none', color: '#1D4ED8', cursor: 'pointer', padding: 0, fontSize: '1rem', fontWeight: 700, lineHeight: 1, display: 'flex', alignItems: 'center' }}>×</button>
                    </span>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  style={{ ...s.input, flex: 1, padding: isMobile ? '0.6rem 0.75rem' : '0.7rem 0.85rem', fontSize: '0.88rem' }}
                  value={novaAlergia}
                  onChange={e => setNovaAlergia(e.target.value)}
                  placeholder="Ex: castanha, corante..."
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); adicionarAlergia() } }}
                />
                <button type="button" onClick={adicionarAlergia} style={{ padding: '0.6rem 1rem', borderRadius: 12, background: '#1D4ED8', color: '#fff', fontWeight: 700, border: 'none', cursor: 'pointer', fontSize: '0.85rem', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  + Adicionar
                </button>
              </div>
              <p style={{ fontSize: '0.72rem', color: '#94A3B8', margin: '4px 0 0' }}>Pressione Enter ou clique "Adicionar" para incluir.</p>
            </div>
            {msgPerfil?.info && <p style={{ color: '#2563EB', fontSize: '0.85rem', margin: 0 }}>{msgPerfil.info}</p>}
            {msgPerfil?.erro && <p style={s.errorText}>{msgPerfil.erro}</p>}
            {msgPerfil?.ok && <p style={s.successText}>{msgPerfil.ok}</p>}
            <button type="submit" style={s.primaryBtn}>Salvar dados pessoais</button>
          </form>
        </div>

        {/* Notificações */}
        <div style={{ ...s.sectionCard, padding: isMobile ? '0.9rem' : '1.25rem' }}>
          <div style={{ ...s.sectionHeader, marginBottom: isMobile ? '0.75rem' : '1rem' }}>
            <h2 style={{ ...s.sectionTitle, fontSize: isMobile ? '0.97rem' : '1.1rem' }}>Notificações</h2>
            {!isMobile && <p style={s.sectionSubtitle}>Receba um aviso quando seu pedido ficar pronto.</p>}
          </div>

          {suportaNotificacao() ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0F172A', margin: 0 }}>Notificações do navegador</p>
                <p style={{ fontSize: '0.75rem', color: '#94A3B8', margin: '3px 0 0' }}>Avisa quando o pedido ficar Pronto, mesmo com a aba em segundo plano</p>
              </div>
              {permissaoNotif === 'granted' ? (
                <span style={{ padding: '0.4rem 1rem', borderRadius: 20, fontWeight: 700, fontSize: '0.82rem', background: '#D1FAE5', color: '#065F46' }}>🔔 Ativas</span>
              ) : permissaoNotif === 'denied' ? (
                <span style={{ padding: '0.4rem 1rem', borderRadius: 20, fontWeight: 700, fontSize: '0.82rem', background: '#FEE2E2', color: '#991B1B' }}>🔕 Bloqueadas</span>
              ) : (
                <button onClick={ativarNotificacoes} style={{
                  padding: '0.4rem 1rem', borderRadius: 20, border: 'none', cursor: 'pointer',
                  fontWeight: 700, fontSize: '0.82rem', background: '#E8F0FB', color: '#003D7C',
                }}>
                  Ativar
                </button>
              )}
            </div>
          ) : (
            <p style={{ color: '#94A3B8', fontSize: '0.85rem', margin: 0 }}>Seu navegador não suporta notificações.</p>
          )}
        </div>

        <div style={{ ...s.sectionCard, padding: isMobile ? '0.9rem' : '1.25rem' }}>
          <div style={{ ...s.sectionHeader, marginBottom: isMobile ? '0.6rem' : '1rem' }}>
            <div>
              <h2 style={{ ...s.sectionTitle, fontSize: isMobile ? '0.97rem' : '1.1rem' }}>Segurança da Conta</h2>
              {!isMobile && <p style={s.sectionSubtitle}>Altere sua senha de forma segura.</p>}
            </div>
          </div>
          <form onSubmit={handleSenha} style={{ ...s.form, gap: isMobile ? '0.65rem' : '1rem' }}>
            {[
              { name: 'atual', label: 'Senha atual', placeholder: '••••••' },
              { name: 'nova', label: 'Nova senha', placeholder: 'Mínimo 4 caracteres' },
              { name: 'confirmar', label: 'Confirmar nova senha', placeholder: 'Repita a nova senha' },
            ].map(({ name, label, placeholder }) => (
              <div key={name} style={s.fieldRow}>
                <label style={s.label}>{label}</label>
                <input style={{ ...s.input, padding: isMobile ? '0.7rem 0.85rem' : '0.95rem 1rem' }} type="password" name={name} value={senhaForm[name]} onChange={handleSenhaChange} placeholder={placeholder} />
              </div>
            ))}
            {msgSenha?.erro && <p style={s.errorText}>{msgSenha.erro}</p>}
            {msgSenha?.ok && <p style={s.successText}>{msgSenha.ok}</p>}
            <button type="submit" style={s.primaryBtn}>Salvar nova senha</button>
          </form>
        </div>
      </div>
    </Layout>
  )
}

const s = {
  page: { display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 540, margin: '0 auto', paddingBottom: '2rem' },
  heroCard: { background: '#0F172A', color: '#fff', borderRadius: 24, padding: '1.35rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, boxShadow: '0 20px 50px rgba(15,23,42,0.12)' },
  heroLabel: { margin: 0, fontSize: '0.85rem', color: '#93C5FD', fontWeight: 700 },
  heroTitle: { margin: '0.45rem 0 0', fontSize: '1.45rem', fontWeight: 800, lineHeight: 1.1 },
  heroText: { margin: '0.5rem 0 0', color: '#CBD5E1', fontSize: '0.96rem', maxWidth: 330 },
  heroAvatar: { width: 72, height: 72, borderRadius: 999, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  heroAvatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  heroAvatarInitial: { width: 72, height: 72, borderRadius: 999, background: '#1D4ED8', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.85rem', fontWeight: 800 },
  sectionCard: { background: '#fff', borderRadius: 20, padding: '1.25rem', boxShadow: '0 18px 40px rgba(15,23,42,0.06)' },
  sectionHeader: { marginBottom: '1rem' },
  sectionTitle: { margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0F172A' },
  sectionSubtitle: { margin: '0.5rem 0 0', color: '#64748B', fontSize: '0.9rem' },
  form: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  fieldRow: { display: 'flex', flexDirection: 'column', gap: 8 },
  label: { fontWeight: 700, fontSize: '0.85rem', color: '#334155' },
  input: { padding: '0.95rem 1rem', borderRadius: 16, border: '1px solid #D1D5DB', background: '#F8FAFC', fontSize: '0.95rem', color: '#0F172A', outline: 'none' },
  inputFile: { padding: '0.95rem 1rem', borderRadius: 16, border: '1px solid #D1D5DB', background: '#F8FAFC', fontSize: '0.95rem', color: '#0F172A' },
  badgeGroup: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  badgePill: { padding: '0.65rem 1rem', borderRadius: 999, background: '#F1F5F9', border: '1px solid #E2E8F0', color: '#334155', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' },
  badgePillActive: { background: '#DBEAFE', borderColor: '#BFDBFE', color: '#1D4ED8' },
  previewRow: { marginTop: 8 },
  preview: { width: 96, height: 96, borderRadius: 18, objectFit: 'cover', border: '1px solid #E5E7EB' },
  primaryBtn: { padding: '0.95rem 1rem', borderRadius: 16, background: '#1D4ED8', color: '#fff', fontWeight: 700, fontSize: '0.95rem', border: 'none', cursor: 'pointer', width: '100%' },
  errorText: { color: '#B91C1C', fontSize: '0.85rem', margin: 0 },
  successText: { color: '#059669', fontSize: '0.85rem', margin: 0 },
}
