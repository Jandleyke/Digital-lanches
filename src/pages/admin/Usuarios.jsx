import { useState } from 'react'
import Layout from '../../components/Layout'
import { useApp } from '../../contexts/AppContext'
import { useIsMobile } from '../../utils/useIsMobile'
import { processarFotoPerfil } from '../../utils/image.js'
import { PERFIL_INFO, ehAluno, ehGestao, ehStaff, perfisDoUsuario, perfisParaExibicao } from '../../utils/perfis'
import { Ban, CheckCircle2, Pencil, Search, UserPlus } from 'lucide-react'

const PERFIS_SELECIONAVEIS = ['aluno', 'professor', 'admin', 'gerente', 'vendedor', 'cozinha']
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
  return { nome: '', matricula: '', senha: '', confirmar: '', roles: ['aluno'], curso: '', telefone: '', email: '' }
}

function SeletorPerfis({ selecionados = [], onChange }) {
  function alternar(perfil) {
    const novos = selecionados.includes(perfil) ? selecionados.filter(item => item !== perfil) : [...selecionados, perfil]
    if (novos.length) onChange(novos)
  }
  return (
    <div style={s.rolesGrid}>
      {PERFIS_SELECIONAVEIS.map(perfil => (
        <label key={perfil} style={{ ...s.roleOption, ...(selecionados.includes(perfil) ? s.roleOptionAtiva : {}) }}>
          <input type="checkbox" checked={selecionados.includes(perfil)} onChange={() => alternar(perfil)} />
          {PERFIL_INFO[perfil]?.nome || perfil}
        </label>
      ))}
    </div>
  )
}

function BadgesPerfis({ usuario, limite }) {
  const perfis = perfisParaExibicao(usuario)
  const visiveis = limite ? perfis.slice(0, limite) : perfis
  return <div style={s.rolesBadges}>{visiveis.map(perfil => {
    const cor = perfilCor[perfil] || perfilCor.aluno
    return <span key={perfil} style={{ ...s.badge, background: cor.bg, color: cor.color }}>{PERFIL_INFO[perfil]?.nome || perfil}</span>
  })}{limite && perfis.length > limite && <span style={s.badgeExtra}>+{perfis.length - limite}</span>}</div>
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

  const isAdmin = ehGestao(usuarioLogado?.perfil)
  const isMobile = useIsMobile()
  const isCompact = useIsMobile(1180)

  const filtrados = usuarios
    .filter(u => {
      if (filtro === 'alunos')    return perfisDoUsuario(u).some(ehAluno)
      if (filtro === 'staff')     return perfisDoUsuario(u).some(ehStaff)
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
    setEditForm({ nome: u.nome || '', email: u.email || '', telefone: u.telefone || '', curso: u.curso || '', roles: perfisDoUsuario(u), fotoPerfil: u.fotoPerfil || '' })
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
      roles: editForm.roles,
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
      <div style={s.toolbar}>
        <div style={{ ...s.toolbarTop, flexDirection: isMobile ? 'column' : 'row' }}>
          <div style={s.searchBox}>
            <Search size={17} color="#64748B" />
            <input style={s.inputBusca} placeholder="Buscar por nome ou matrícula" value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
          {isAdmin && (
            <button style={{ ...s.btnNovo, width: isMobile ? '100%' : 'auto' }} onClick={() => { setModalCad(true); setCadForm(campoVazio()); setCadErro(''); setCadOk(false) }}>
              <UserPlus size={17} /> {isMobile ? 'Novo usuário' : 'Cadastrar usuário'}
            </button>
          )}
        </div>
        <div style={s.toolbarBottom}>
          <div style={s.filtros} role="group" aria-label="Filtrar usuários">
            {[['todos','Todos'],['alunos','Alunos/Prof.'],['staff','Equipe'],['bloqueados','Bloqueados']].map(([v,l]) => (
              <button key={v} style={{ ...s.filtroBtn, ...(filtro === v ? s.filtroBtnOn : {}) }} onClick={() => setFiltro(v)}>{l}</button>
            ))}
          </div>
          <span style={s.contador}>{filtrados.length} {filtrados.length === 1 ? 'usuário' : 'usuários'}</span>
        </div>
      </div>

      {isCompact ? (
        <div style={s.compactList}>
          {filtrados.map(u => {
            return (
              <div key={u.matricula} style={s.mCard}>
                <div style={s.mCardTop}>
                  {u.fotoPerfil
                    ? <img src={u.fotoPerfil} alt={u.nome} style={s.mAvatarPequeno} />
                    : <div style={s.mAvatarLetra}>{u.nome?.[0]?.toUpperCase()}</div>}
                  <div style={s.mIdentity}>
                    <strong style={s.mNome}>{u.nome}</strong>
                    <span style={s.mMatricula}>Matrícula {u.matricula}</span>
                  </div>
                  <div style={s.mStatus}>
                    <span style={{ ...s.badge, background: u.bloqueado ? '#FEE2E2' : '#D1FAE5', color: u.bloqueado ? '#991B1B' : '#065F46' }}>
                      {u.bloqueado ? 'Bloqueado' : 'Ativo'}
                    </span>
                  </div>
                </div>

                <div style={s.mDetails}>
                  <div style={s.mPerfis}><span style={s.mLabel}>Perfis</span><BadgesPerfis usuario={u} /></div>
                  <div style={s.mStats}>
                    <span><strong>{pedidosDoUsuario(u.matricula).length}</strong> pedidos</span>
                    <span><strong>R$ {totalGasto(u.matricula).toFixed(2).replace('.', ',')}</strong> total</span>
                  </div>
                </div>

                <div style={s.mActions}>
                  <button style={s.btnEditarLinha} onClick={() => abrirDetalhe(u)}><Pencil size={15} /> Editar</button>
                  {u.bloqueado
                    ? <button style={s.btnDesbloquear} onClick={() => desbloquearUsuario(u.matricula)}><CheckCircle2 size={15} /> Desbloquear</button>
                    : <button style={s.btnBloquear} onClick={() => bloquearUsuario(u.matricula)}><Ban size={15} /> Bloquear</button>}
                </div>
              </div>
            )
          })}
          {filtrados.length === 0 && <div style={s.vazio}>Nenhum usuário encontrado.</div>}
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
            return (
              <div key={u.matricula} style={s.trow}>
                <div style={{ flex: 2, display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, color: '#1A202C' }}>
                  {u.fotoPerfil
                    ? <img src={u.fotoPerfil} alt={u.nome} style={s.avatarImg} />
                    : <div style={s.avatar}>{u.nome?.[0]?.toUpperCase()}</div>}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.nome}</span>
                </div>
                <span style={{ flex: 1, color: '#64748B', fontSize: '0.82rem', fontFamily: 'monospace' }}>{u.matricula}</span>
                <span style={{ flex: 1 }}><BadgesPerfis usuario={u} limite={2} /></span>
                <span style={{ flex: 1, color: '#475569' }}>{pedidosDoUsuario(u.matricula).length}</span>
                <span style={{ flex: 1, color: '#003D7C', fontWeight: 700 }}>R$ {totalGasto(u.matricula).toFixed(2).replace('.', ',')}</span>
                <span style={{ flex: 1 }}>
                  <span style={{ ...s.badge, background: u.bloqueado ? '#FEE2E2' : '#D1FAE5', color: u.bloqueado ? '#991B1B' : '#065F46' }}>
                    {u.bloqueado ? '🚫 Bloq.' : '✓ Ativo'}
                  </span>
                </span>
                <div style={{ width: 80, display: 'flex', gap: 4 }}>
                  <button style={s.btnAcao} onClick={() => abrirDetalhe(u)} title="Editar" aria-label={`Editar ${u.nome}`}><Pencil size={14} /></button>
                  {u.bloqueado
                    ? <button style={{ ...s.btnAcao, background: '#D1FAE5', color: '#047857' }} onClick={() => desbloquearUsuario(u.matricula)} title="Desbloquear" aria-label={`Desbloquear ${u.nome}`}><CheckCircle2 size={14} /></button>
                    : <button style={{ ...s.btnAcao, background: '#FEE2E2', color: '#DC2626' }} onClick={() => bloquearUsuario(u.matricula)} title="Bloquear" aria-label={`Bloquear ${u.nome}`}><Ban size={14} /></button>}
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
                <BadgesPerfis usuario={detalhe} />
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

            {perfisDoUsuario(detalhe).includes('aluno') && (
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
                      <label style={s.label}>Perfis de acesso</label>
                      <SeletorPerfis selecionados={editForm.roles} onChange={roles => setEditForm(p => ({ ...p, roles }))} />
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
                  <label style={s.label}>Perfis de acesso</label>
                  <SeletorPerfis selecionados={cadForm.roles} onChange={roles => setCadForm(p => ({ ...p, roles }))} />
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
  toolbar: { display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12, minWidth: 0 },
  toolbarTop: { display: 'flex', gap: 8, alignItems: 'stretch', minWidth: 0 },
  searchBox: { flex: 1, minWidth: 0, minHeight: 40, display: 'flex', alignItems: 'center', gap: 8, padding: '0 0.72rem', borderRadius: 8, border: '1px solid #CBD5E1', background: '#fff' },
  inputBusca: { width: '100%', minWidth: 0, border: 'none', background: 'transparent', fontSize: '0.88rem', outline: 'none', color: '#0F172A', fontFamily: 'inherit' },
  toolbarBottom: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, minWidth: 0 },
  filtros: { minWidth: 0, display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 },
  filtroBtn: { flexShrink: 0, minHeight: 36, padding: '0 0.8rem', borderRadius: 8, border: '1px solid #CBD5E1', background: '#fff', color: '#64748B', fontWeight: 700, fontSize: '0.76rem', cursor: 'pointer' },
  filtroBtnOn: { background: '#003D7C', color: '#fff', borderColor: '#003D7C' },
  contador: { flexShrink: 0, color: '#64748B', background: '#E8F0FB', borderRadius: 8, padding: '0.36rem 0.65rem', fontSize: '0.74rem', fontWeight: 800 },
  btnNovo: { minHeight: 44, padding: '0 1rem', borderRadius: 8, background: '#F47920', color: '#fff', fontWeight: 800, fontSize: '0.82rem', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7 },
  tabela: { background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflowX: 'auto' },
  compactList: { display: 'flex', flexDirection: 'column', gap: 8 },
  mCard: { display: 'flex', flexDirection: 'column', background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, padding: '0.8rem', boxShadow: '0 3px 12px rgba(15,23,42,0.05)', minWidth: 0 },
  mCardTop: { display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 },
  mAvatarPequeno: { width: 40, height: 40, borderRadius: 8, objectFit: 'cover', flexShrink: 0 },
  mAvatarLetra: { width: 40, height: 40, borderRadius: 8, background: '#003D7C', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.88rem', flexShrink: 0 },
  mIdentity: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 },
  mNome: { color: '#0F172A', fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  mMatricula: { color: '#64748B', fontFamily: 'monospace', fontSize: '0.68rem' },
  mStatus: { flexShrink: 0 },
  mDetails: { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '0.7rem 0 0.65rem 50px' },
  mPerfis: { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 },
  mLabel: { color: '#94A3B8', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase' },
  mStats: { display: 'flex', alignItems: 'center', gap: 12, color: '#64748B', fontSize: '0.72rem', whiteSpace: 'nowrap' },
  mActions: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 7, paddingTop: 8, borderTop: '1px solid #F1F5F9' },
  btnEditarLinha: { minHeight: 38, borderRadius: 8, background: '#E8F0FB', color: '#003D7C', fontWeight: 800, fontSize: '0.76rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 },
  btnBloquear: { minHeight: 38, borderRadius: 8, background: '#FEE2E2', color: '#DC2626', fontWeight: 800, fontSize: '0.76rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 },
  btnDesbloquear: { minHeight: 38, borderRadius: 8, background: '#D1FAE5', color: '#047857', fontWeight: 800, fontSize: '0.76rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 },
  vazio: { background: '#fff', border: '1px dashed #CBD5E1', borderRadius: 8, textAlign: 'center', padding: '2rem', color: '#94A3B8' },
  thead: { display: 'flex', padding: '0.7rem 1rem', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', fontWeight: 700, fontSize: '0.75rem', color: '#64748B', gap: 8, alignItems: 'center', minWidth: 620 },
  trow: { display: 'flex', padding: '0.65rem 1rem', borderBottom: '1px solid #F1F5F9', alignItems: 'center', gap: 8, fontSize: '0.83rem', minWidth: 620 },
  avatar: { width: 28, height: 28, borderRadius: '50%', background: '#003D7C', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.75rem', flexShrink: 0 },
  avatarImg: { width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 },
  badge: { display: 'inline-flex', alignItems: 'center', padding: '0.2rem 0.55rem', borderRadius: 8, fontWeight: 800, fontSize: '0.68rem', lineHeight: 1.25 },
  badgeExtra: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 28, padding: '0.2rem 0.45rem', borderRadius: 8, background: '#F1F5F9', color: '#475569', fontWeight: 900, fontSize: '0.68rem' },
  rolesBadges: { display: 'flex', gap: 4, flexWrap: 'wrap' },
  rolesGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 7, marginTop: 6 },
  roleOption: { border: '1px solid #CBD5E1', borderRadius: 8, padding: '0.55rem 0.6rem', display: 'flex', alignItems: 'center', gap: 7, color: '#475569', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' },
  roleOptionAtiva: { borderColor: '#003D7C', background: '#EFF6FF', color: '#003D7C' },
  btnAcao: { width: 34, height: 34, padding: 0, borderRadius: 8, background: '#E8F0FB', color: '#003D7C', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
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
