import { useState } from 'react'
import Layout from '../../components/Layout'
import { useApp } from '../../contexts/AppContext'
import { useIsMobile } from '../../utils/useIsMobile'
import { processarFotoPerfil } from '../../utils/image.js'
import { normalizarPerfil } from '../../utils/perfis'

const PERFIS = ['aluno', 'professor', 'vendedor', 'cozinha', 'admin']
const perfilCor = {
  aluno:   { bg: '#DBEAFE', color: '#1D4ED8' },
  professor: { bg: '#EDE9FE', color: '#5B21B6' },
  cozinha: { bg: '#D1FAE5', color: '#065F46' },
  cozinheiro: { bg: '#D1FAE5', color: '#065F46' },
  vendedor: { bg: '#E0F2FE', color: '#075985' },
  vendedora: { bg: '#E0F2FE', color: '#075985' },
  gerente: { bg: '#FEF3C7', color: '#92400E' },
  admin:   { bg: '#F3E8FF', color: '#6B21A8' },
}

function campoVazio() {
  return { nome: '', matricula: '', senha: '', confirmar: '', perfil: 'aluno', curso: '', telefone: '', email: '' }
}

export default function Usuarios() {
  const { usuarios, pedidos, bloquearUsuario, desbloquearUsuario, excluirUsuario,
          resetarSenhaAdmin, atualizarUsuario, cadastrarUsuario, usuarioLogado } = useApp()

  const [busca, setBusca]       = useState('')
  const [filtro, setFiltro]     = useState('todos')
  const [detalhe, setDetalhe]   = useState(null)
  const [editando, setEditando] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [resetando, setResetando] = useState(false)
  const [salvando, setSalvando]   = useState(false)
  const [msgEdit, setMsgEdit]     = useState('')

  const [modalCad, setModalCad] = useState(false)
  const [cadForm, setCadForm]   = useState(campoVazio())
  const [cadErro, setCadErro]   = useState('')
  const [cadOk, setCadOk]       = useState(false)

  const isAdmin = usuarioLogado?.perfil === 'admin'
  const isMobile = useIsMobile()

  const filtrados = usuarios
    .filter(u => {
      if (filtro === 'alunos')    return u.perfil === 'aluno'
      if (filtro === 'staff')     return u.perfil !== 'aluno'
      if (filtro === 'bloqueados') return u.bloqueado
      return true
    })
    .filter(u => {
      const b = busca.toLowerCase()
      return u.nome?.toLowerCase().includes(b) || u.matricula?.toLowerCase().includes(b)
    })

  function pedidosDoUsuario(m) { return pedidos.filter(p => p.matricula === m) }
  function totalGasto(m) { return pedidos.filter(p => p.matricula === m && p.pago && p.status !== 'Cancelado').reduce((a, p) => a + p.total, 0) }

  function abrirDetalhe(u) {
    setDetalhe(u)
    setEditando(false)
    setEditForm({ nome: u.nome || '', email: u.email || '', telefone: u.telefone || '', curso: u.curso || '', perfil: normalizarPerfil(u.role || u.perfil || 'aluno'), fotoPerfil: u.fotoPerfil || '' })
    setMsgEdit('')
  }

  async function handleSalvarEdicao() {
    if (!editForm.nome.trim()) { setMsgEdit('Nome é obrigatório.'); return }
    setSalvando(true)
    const res = await atualizarUsuario(detalhe.matricula, {
      nome: editForm.nome.trim(),
      email: editForm.email.trim().toLowerCase(),
      telefone: editForm.telefone,
      curso: editForm.curso.trim(),
      perfil: editForm.perfil,
      fotoPerfil: editForm.fotoPerfil || '',
    })
    setSalvando(false)
    if (res.erro) { setMsgEdit(res.erro); return }
    setDetalhe(prev => ({ ...prev, ...editForm, nome: editForm.nome.trim() }))
    setEditando(false)
    setMsgEdit('Dados atualizados!')
  }

  async function handleFotoUsuario(e) {
    const file = e.target.files?.[0]
    if (!file || !detalhe?.matricula) return
    setMsgEdit('Processando foto...')
    try {
      const dataUrl = await processarFotoPerfil(file)
      setEditForm(p => ({ ...p, fotoPerfil: dataUrl }))
      const res = await atualizarUsuario(detalhe.matricula, { fotoPerfil: dataUrl })
      if (res?.erro) { setMsgEdit(res.erro); return }
      setDetalhe(prev => ({ ...prev, fotoPerfil: dataUrl }))
      setMsgEdit('Foto atualizada!')
    } catch (err) {
      setMsgEdit(err.message || 'Erro ao processar foto.')
    } finally {
      e.target.value = ''
    }
  }

  async function handleResetSenha() {
    setMsgEdit('')
    if (!detalhe?.matricula) { setMsgEdit('Matrícula inválida.'); return }
    setResetando(true)
    const res = await resetarSenhaAdmin(detalhe.matricula)
    if (res?.erro) setMsgEdit(res.erro)
    else {
      setMsgEdit('Link de redefinição enviado com sucesso!')
    }
    setResetando(false)
  }

  async function handleExcluir(u) {
    if (!confirm(`Excluir ${u.nome}? Esta ação é irreversível.`)) return
    const res = await excluirUsuario(u.matricula)
    if (res?.erro) {
      setMsgEdit(res.erro)
      return
    }
    setDetalhe(null)
  }

  async function handleCadastrar(e) {
    e.preventDefault()
    setCadErro('')
    if (!cadForm.nome || !cadForm.matricula || !cadForm.senha) { setCadErro('Preencha nome, matrícula e senha.'); return }
    if (cadForm.senha !== cadForm.confirmar) { setCadErro('As senhas não conferem.'); return }
    if (cadForm.senha.length < 6) { setCadErro('Senha precisa ter pelo menos 6 caracteres.'); return }
    const res = await cadastrarUsuario(cadForm)
    if (res.erro) { setCadErro(res.erro); return }
    setCadOk(true)
    setTimeout(() => { setCadOk(false); setModalCad(false); setCadForm(campoVazio()) }, 1800)
  }

  function maskTel(val) {
    const n = val.replace(/\D/g, '').slice(0, 11)
    if (n.length > 7) return `(${n.slice(0,2)}) ${n.slice(2,7)}-${n.slice(7)}`
    if (n.length > 2) return `(${n.slice(0,2)}) ${n.slice(2)}`
    if (n.length > 0) return `(${n}`
    return n
  }

  return (
    <Layout titulo="Usuários">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input style={{ ...s.inputBusca, flex: 1 }} placeholder="🔍 Buscar nome ou matrícula..." value={busca} onChange={e => setBusca(e.target.value)} />
          {isAdmin && (
            <button style={s.btnNovo} onClick={() => { setModalCad(true); setCadForm(campoVazio()); setCadErro(''); setCadOk(false) }}>
              {isMobile ? '+' : '+ Cadastrar usuário'}
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[['todos','Todos'],['alunos','Alunos'],['staff','Staff'],['bloqueados','🚫 Bloq.']].map(([v,l]) => (
            <button key={v} style={{ ...s.filtroBtn, ...(filtro === v ? s.filtroBtnOn : {}) }} onClick={() => setFiltro(v)}>{l}</button>
          ))}
          <span style={{ fontSize: '0.78rem', color: '#94A3B8', alignSelf: 'center', marginLeft: 'auto' }}>{filtrados.length} usuário(s)</span>
        </div>
      </div>

      {isMobile ? (
        <div style={s.tabela}>
          {filtrados.map(u => {
            const pc = perfilCor[u.perfil] || perfilCor.aluno
            return (
              <div key={u.matricula} style={s.mCard}>
                <div style={{ flexShrink: 0 }}>
                  {u.fotoPerfil
                    ? <img src={u.fotoPerfil} alt={u.nome} style={s.mAvatarPequeno} />
                    : <div style={s.mAvatarLetra}>{u.nome?.[0]?.toUpperCase()}</div>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: '#1A202C', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.nome}</div>
                  <div style={{ fontSize: '0.72rem', color: '#94A3B8', fontFamily: 'monospace', marginTop: 1 }}>{u.matricula}</div>
                  <div style={{ display: 'flex', gap: 5, marginTop: 5, flexWrap: 'wrap' }}>
                    <span style={{ ...s.badge, background: pc.bg, color: pc.color }}>{u.perfil}</span>
                    <span style={{ ...s.badge, background: u.bloqueado ? '#FEE2E2' : '#D1FAE5', color: u.bloqueado ? '#991B1B' : '#065F46' }}>
                      {u.bloqueado ? '🚫 Bloq.' : '✓ Ativo'}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button style={s.btnAcao} onClick={() => abrirDetalhe(u)}>✏️</button>
                  {u.bloqueado
                    ? <button style={{ ...s.btnAcao, background: '#D1FAE5' }} onClick={() => desbloquearUsuario(u.matricula)}>✓</button>
                    : <button style={{ ...s.btnAcao, background: '#FEE2E2' }} onClick={() => bloquearUsuario(u.matricula)}>🚫</button>}
                </div>
              </div>
            )
          })}
          {filtrados.length === 0 && <div style={{ textAlign: 'center', padding: '2rem', color: '#94A3B8' }}>Nenhum usuário encontrado.</div>}
        </div>
      ) : (
        <div style={s.tabela}>
          <div style={s.thead}>
            <span style={{ flex: 2 }}>Usuário</span>
            <span style={{ flex: 1 }}>Matrícula</span>
            <span style={{ flex: 1 }}>Perfil</span>
            <span style={{ flex: 1 }}>Pedidos</span>
            <span style={{ flex: 1 }}>Total</span>
            <span style={{ flex: 1 }}>Status</span>
            <span style={{ width: 80 }}>Ações</span>
          </div>
          {filtrados.map(u => {
            const pc = perfilCor[u.perfil] || perfilCor.aluno
            return (
              <div key={u.matricula} style={s.trow}>
                <div style={{ flex: 2, display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, color: '#1A202C' }}>
                  {u.fotoPerfil
                    ? <img src={u.fotoPerfil} alt={u.nome} style={s.avatarImg} />
                    : <div style={s.avatar}>{u.nome?.[0]?.toUpperCase()}</div>}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.nome}</span>
                </div>
                <span style={{ flex: 1, color: '#64748B', fontSize: '0.82rem', fontFamily: 'monospace' }}>{u.matricula}</span>
                <span style={{ flex: 1 }}><span style={{ ...s.badge, background: pc.bg, color: pc.color }}>{u.perfil}</span></span>
                <span style={{ flex: 1, color: '#475569' }}>{pedidosDoUsuario(u.matricula).length}</span>
                <span style={{ flex: 1, color: '#003D7C', fontWeight: 700 }}>R$ {totalGasto(u.matricula).toFixed(2).replace('.', ',')}</span>
                <span style={{ flex: 1 }}>
                  <span style={{ ...s.badge, background: u.bloqueado ? '#FEE2E2' : '#D1FAE5', color: u.bloqueado ? '#991B1B' : '#065F46' }}>
                    {u.bloqueado ? '🚫 Bloq.' : '✓ Ativo'}
                  </span>
                </span>
                <div style={{ width: 80, display: 'flex', gap: 4 }}>
                  <button style={s.btnAcao} onClick={() => abrirDetalhe(u)} title="Editar">✏️</button>
                  {u.bloqueado
                    ? <button style={{ ...s.btnAcao, background: '#D1FAE5' }} onClick={() => desbloquearUsuario(u.matricula)} title="Desbloquear">✓</button>
                    : <button style={{ ...s.btnAcao, background: '#FEE2E2' }} onClick={() => bloquearUsuario(u.matricula)} title="Bloquear">🚫</button>}
                </div>
              </div>
            )
          })}
          {filtrados.length === 0 && <div style={{ textAlign: 'center', padding: '2rem', color: '#94A3B8' }}>Nenhum usuário encontrado.</div>}
        </div>
      )}

      {/* ── Modal Detalhe / Edição ── */}
      {detalhe && (
        <div style={s.overlay} onClick={e => e.target === e.currentTarget && setDetalhe(null)}>
          <div style={s.modalBox}>
            <div style={s.mHeader}>
              {(editForm.fotoPerfil || detalhe.fotoPerfil)
                ? <img src={editForm.fotoPerfil || detalhe.fotoPerfil} alt={detalhe.nome} style={s.mAvatar} />
                : <div style={s.mAvatarLetras}>{detalhe.nome?.[0]?.toUpperCase()}</div>}
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#94A3B8' }}>{detalhe.matricula}</p>
                <h3 style={{ margin: '2px 0', fontWeight: 800, color: '#0F172A' }}>{detalhe.nome}</h3>
                <span style={{ ...s.badge, background: perfilCor[detalhe.perfil]?.bg, color: perfilCor[detalhe.perfil]?.color }}>{detalhe.perfil}</span>
              </div>
              <button style={s.fecharBtn} onClick={() => setDetalhe(null)} aria-label="Fechar detalhes do usuário">✕</button>
            </div>

            {/* Estatísticas (só para aluno) */}
            {isAdmin && (
              <div style={s.fotoBox}>
                <div>
                  <strong style={s.secaoTit}>Foto do perfil</strong>
                  <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: '0.82rem' }}>Escolha uma foto para aparecer no avatar do usuario.</p>
                </div>
                <label style={s.btnFotoAdmin}>
                  Selecionar foto
                  <input type="file" accept="image/*" onChange={handleFotoUsuario} style={{ display: 'none' }} />
                </label>
              </div>
            )}

            {detalhe.perfil === 'aluno' && (
              <div style={s.statsRow}>
                <div style={s.statBox}><strong>{pedidosDoUsuario(detalhe.matricula).length}</strong><span>Pedidos</span></div>
                <div style={s.statBox}><strong>R$ {totalGasto(detalhe.matricula).toFixed(2).replace('.', ',')}</strong><span>Total gasto</span></div>
              </div>
            )}

            {/* Edição de dados */}
            <div style={s.secao}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <h4 style={s.secaoTit}>Dados do usuário</h4>
                {!editando && <button style={s.btnEditar} onClick={() => setEditando(true)}>✏️ Editar</button>}
              </div>
              {editando ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { label: 'Nome', key: 'nome', type: 'text' },
                    { label: 'E-mail', key: 'email', type: 'email' },
                    { label: 'Telefone', key: 'telefone', type: 'tel' },
                    { label: 'Curso', key: 'curso', type: 'text' },
                  ].map(({ label, key, type }) => (
                    <div key={key}>
                      <label style={s.label}>{label}</label>
                      <input style={s.input} type={type} value={editForm[key]}
                        onChange={e => setEditForm(p => ({ ...p, [key]: key === 'telefone' ? maskTel(e.target.value) : e.target.value }))} />
                    </div>
                  ))}
                  {isAdmin && (
                    <div>
                      <label style={s.label}>Perfil</label>
                      <select style={s.input} value={editForm.perfil} onChange={e => setEditForm(p => ({ ...p, perfil: e.target.value }))}>
                        {PERFIS.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <button style={s.btnCancelar} onClick={() => { setEditando(false); setMsgEdit('') }}>Cancelar</button>
                    <button style={{ ...s.btnSalvar, opacity: salvando ? 0.7 : 1 }} onClick={handleSalvarEdicao} disabled={salvando}>
                      {salvando ? 'Salvando...' : 'Salvar alterações'}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.87rem', color: '#475569' }}>
                  {detalhe.email    && <span>📧 {detalhe.email}</span>}
                  {detalhe.telefone && <span>📱 {detalhe.telefone}</span>}
                  {detalhe.curso    && <span>📚 {detalhe.curso}</span>}
                  <span style={{ ...s.badge, background: detalhe.bloqueado ? '#FEE2E2' : '#D1FAE5', color: detalhe.bloqueado ? '#991B1B' : '#065F46', marginTop: 4, display: 'inline-block' }}>
                    {detalhe.bloqueado ? '🚫 Bloqueado' : '✓ Ativo'}
                  </span>
                </div>
              )}
            </div>

            {/* Enviar link de redefinição */}
            <div style={s.secao}>
              <h4 style={s.secaoTit}>🔑 Enviar link de redefinição</h4>
              <p style={{ margin: 0, color: '#475569', fontSize: '0.88rem', marginBottom: 10 }}>
                {detalhe?.email ? `Será enviado para ${detalhe.email}` : 'Nenhum e-mail cadastrado. Atualize o e-mail do usuário antes de enviar o link de redefinição.'}
              </p>
              <button style={{ ...s.btnSalvar, opacity: resetando ? 0.7 : 1 }} onClick={handleResetSenha} disabled={resetando}>
                {resetando ? 'Enviando...' : 'Enviar link'}
              </button>
            </div>

            {msgEdit && <p style={{ color: msgEdit.includes('sucesso') || msgEdit.includes('!') ? '#059669' : '#DC2626', fontSize: '0.85rem', margin: '0 0 10px' }}>{msgEdit}</p>}

            <div style={s.acoesModal}>
              <button style={s.btnCancelar} onClick={() => setDetalhe(null)}>Fechar</button>
              {detalhe.bloqueado
                ? <button style={{ ...s.btnSalvar, background: '#22C55E' }} onClick={() => { desbloquearUsuario(detalhe.matricula); setDetalhe(p => ({ ...p, bloqueado: false })) }}>✓ Desbloquear</button>
                : <button style={{ ...s.btnSalvar, background: '#F59E0B' }} onClick={() => { bloquearUsuario(detalhe.matricula); setDetalhe(p => ({ ...p, bloqueado: true })) }}>🚫 Bloquear</button>}
              {isAdmin && <button style={{ ...s.btnSalvar, background: '#EF4444' }} onClick={() => handleExcluir(detalhe)}>🗑️ Excluir</button>}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Cadastrar usuário ── */}
      {modalCad && (
        <div style={s.overlay} onClick={e => e.target === e.currentTarget && setModalCad(false)}>
          <div style={s.modalBox}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontWeight: 800, color: '#0F172A' }}>Cadastrar usuário</h3>
              <button style={s.fecharBtn} onClick={() => setModalCad(false)} aria-label="Fechar cadastro de usuário">✕</button>
            </div>
            {cadOk ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#059669', fontWeight: 700, fontSize: '1.1rem' }}>✅ Usuário cadastrado!</div>
            ) : (
              <form onSubmit={handleCadastrar} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={s.label}>Perfil</label>
                  <select style={s.input} value={cadForm.perfil} onChange={e => setCadForm(p => ({ ...p, perfil: e.target.value }))}>
                    {PERFIS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                {[
                  { label: 'Nome completo', key: 'nome', type: 'text', ph: 'Ex: João Silva' },
                  { label: 'Matrícula', key: 'matricula', type: 'text', ph: 'Ex: ADM002' },
                  { label: 'E-mail', key: 'email', type: 'email', ph: 'Ex: joao@gmail.com' },
                  { label: 'Telefone', key: 'telefone', type: 'tel', ph: '(11) 99999-0001' },
                  { label: 'Curso (opcional)', key: 'curso', type: 'text', ph: 'Ex: Administração' },
                  { label: 'Senha', key: 'senha', type: 'password', ph: 'Mínimo 6 caracteres' },
                  { label: 'Confirmar senha', key: 'confirmar', type: 'password', ph: 'Repita a senha' },
                ].map(({ label, key, type, ph }) => (
                  <div key={key}>
                    <label style={s.label}>{label}</label>
                    <input style={s.input} type={type} placeholder={ph} value={cadForm[key]}
                      onChange={e => setCadForm(p => ({ ...p, [key]: key === 'telefone' ? maskTel(e.target.value) : e.target.value }))} />
                  </div>
                ))}
                {cadErro && <p style={{ color: '#DC2626', fontSize: '0.85rem', margin: 0 }}>{cadErro}</p>}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                  <button type="button" style={s.btnCancelar} onClick={() => setModalCad(false)}>Cancelar</button>
                  <button type="submit" style={s.btnSalvar}>Cadastrar</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </Layout>
  )
}

const s = {
  topBar: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' },
  inputBusca: { padding: '0.6rem 1rem', borderRadius: 10, border: '2px solid #E2E8F0', fontSize: '0.9rem', outline: 'none', flex: 1, minWidth: 180 },
  filtroBtn: { padding: '0.4rem 0.9rem', borderRadius: 20, border: '2px solid #E2E8F0', background: '#fff', color: '#64748B', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' },
  filtroBtnOn: { background: '#003D7C', color: '#fff', borderColor: '#003D7C' },
  btnNovo: { padding: '0.5rem 1.1rem', borderRadius: 10, background: '#F47920', color: '#fff', fontWeight: 700, fontSize: '0.85rem', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' },
  tabela: { background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflowX: 'auto' },
  mCard: { display: 'flex', alignItems: 'center', padding: '0.75rem', borderBottom: '1px solid #F1F5F9', gap: 10 },
  mAvatarPequeno: { width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 },
  mAvatarLetra: { width: 44, height: 44, borderRadius: '50%', background: '#003D7C', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1rem', flexShrink: 0 },
  thead: { display: 'flex', padding: '0.7rem 1rem', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', fontWeight: 700, fontSize: '0.75rem', color: '#64748B', gap: 8, alignItems: 'center', minWidth: 620 },
  trow: { display: 'flex', padding: '0.65rem 1rem', borderBottom: '1px solid #F1F5F9', alignItems: 'center', gap: 8, fontSize: '0.83rem', minWidth: 620 },
  avatar: { width: 28, height: 28, borderRadius: '50%', background: '#003D7C', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.75rem', flexShrink: 0 },
  avatarImg: { width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 },
  badge: { padding: '0.2rem 0.6rem', borderRadius: 20, fontWeight: 700, fontSize: '0.72rem' },
  btnAcao: { padding: '0.3rem 0.5rem', borderRadius: 6, background: '#F1F5F9', border: 'none', cursor: 'pointer', fontSize: '0.85rem' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem' },
  modalBox: { background: '#fff', borderRadius: 16, padding: '1.5rem', width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' },
  mHeader: { display: 'flex', gap: 12, alignItems: 'center', marginBottom: '1rem' },
  mAvatar: { width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 },
  mAvatarLetras: { width: 52, height: 52, borderRadius: '50%', background: '#003D7C', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', fontWeight: 800, flexShrink: 0 },
  fotoBox: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '0.75rem', marginBottom: '1rem' },
  btnFotoAdmin: { background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', borderRadius: 8, padding: '0.5rem 0.8rem', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', whiteSpace: 'nowrap' },
  fecharBtn: { background: '#F1F5F9', border: 'none', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: '1rem' },
  statBox: { background: '#F8FAFC', borderRadius: 10, padding: '0.6rem', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 2, fontSize: '0.78rem', color: '#64748B' },
  secao: { marginBottom: '1.1rem' },
  secaoTit: { fontWeight: 700, color: '#0F172A', marginBottom: 8, fontSize: '0.88rem' },
  label: { display: 'block', fontWeight: 600, fontSize: '0.8rem', color: '#374151', marginBottom: 4 },
  input: { width: '100%', padding: '0.62rem 0.9rem', border: '2px solid #E2E8F0', borderRadius: 8, fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' },
  btnEditar: { background: '#EFF6FF', color: '#1D4ED8', border: 'none', borderRadius: 8, padding: '0.35rem 0.8rem', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' },
  acoesModal: { display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: 8 },
  btnCancelar: { padding: '0.55rem 1.1rem', borderRadius: 8, background: '#F1F5F9', color: '#64748B', fontWeight: 600, fontSize: '0.85rem', border: 'none', cursor: 'pointer' },
  btnSalvar: { padding: '0.55rem 1.1rem', borderRadius: 8, background: '#003D7C', color: '#fff', fontWeight: 700, fontSize: '0.85rem', border: 'none', cursor: 'pointer' },
}
