import { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import { useApp } from '../../contexts/AppContext'
import { useIsMobile } from '../../utils/useIsMobile'

const DIAS = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo']

export default function Lanchonete() {
  const { lanchoneteConfig, salvarLanchoneteConfig } = useApp()
  const isMobile = useIsMobile()
  const [form, setForm] = useState(lanchoneteConfig)
  const [msg, setMsg] = useState('')
  const [salvando, setSalvando] = useState(false)

  // Sincroniza o formulario quando o Firestore entrega a configuracao inicial.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setForm(lanchoneteConfig), [lanchoneteConfig])

  function setCampo(campo, valor) {
    setForm(prev => ({ ...prev, [campo]: valor }))
    setMsg('')
  }

  function toggleDia(dia) {
    setForm(prev => {
      const dias = prev.diasFuncionamento || []
      return {
        ...prev,
        diasFuncionamento: dias.includes(dia) ? dias.filter(d => d !== dia) : [...dias, dia],
      }
    })
  }

  async function salvar(e) {
    e.preventDefault()
    setSalvando(true)
    setMsg('')
    try {
      await salvarLanchoneteConfig(form)
      setMsg('Dados da lanchonete salvos.')
    } catch (err) {
      console.error('salvarLanchoneteConfig:', err)
      setMsg('Não foi possível salvar. Verifique as permissões.')
    } finally {
      setSalvando(false)
    }
  }

  const campos = [
    ['nome', 'Nome da lanchonete'],
    ['endereco', 'Endereco'],
    ['bairro', 'Bairro'],
    ['cidade', 'Cidade'],
    ['cep', 'CEP'],
    ['telefone', 'Telefone'],
    ['email', 'E-mail'],
    ['responsavel', 'Responsável'],
  ]

  return (
    <Layout titulo="Cadastro da Lanchonete">
      <form onSubmit={salvar} style={{ ...s.card, maxWidth: isMobile ? '100%' : 760 }}>
        <div style={{ ...s.grid, gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr' }}>
          {campos.map(([campo, label]) => (
            <label key={campo} style={s.campo}>
              <span style={s.label}>{label}</span>
              <input
                style={s.input}
                value={form[campo] || ''}
                onChange={e => setCampo(campo, e.target.value)}
              />
            </label>
          ))}
          <label style={s.campo}>
            <span style={s.label}>Abertura</span>
            <input style={s.input} type="time" value={form.horarioAbertura || ''} onChange={e => setCampo('horarioAbertura', e.target.value)} />
          </label>
          <label style={s.campo}>
            <span style={s.label}>Fechamento</span>
            <input style={s.input} type="time" value={form.horarioFechamento || ''} onChange={e => setCampo('horarioFechamento', e.target.value)} />
          </label>
        </div>

        <div style={{ marginTop: '1rem' }}>
          <span style={s.label}>Dias de funcionamento</span>
          <div style={s.dias}>
            {DIAS.map(dia => {
              const ativo = (form.diasFuncionamento || []).includes(dia)
              return (
                <button key={dia} type="button" onClick={() => toggleDia(dia)}
                  style={{ ...s.diaBtn, ...(ativo ? s.diaBtnAtivo : {}) }}>
                  {dia}
                </button>
              )
            })}
          </div>
        </div>

        {msg && <p style={{ ...s.msg, color: msg.startsWith('Nao') ? '#DC2626' : '#059669' }}>{msg}</p>}

        <button type="submit" disabled={salvando} style={{ ...s.salvar, opacity: salvando ? 0.7 : 1 }}>
          {salvando ? 'Salvando...' : 'Salvar'}
        </button>
      </form>
    </Layout>
  )
}

const s = {
  card: { background: '#fff', borderRadius: 14, padding: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  grid: { display: 'grid', gap: '0.85rem' },
  campo: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: { fontSize: '0.82rem', fontWeight: 700, color: '#475569' },
  input: { padding: '0.7rem 0.9rem', border: '2px solid #E2E8F0', borderRadius: 8, fontSize: '0.92rem', outline: 'none', boxSizing: 'border-box' },
  dias: { display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 },
  diaBtn: { padding: '0.5rem 0.85rem', borderRadius: 20, border: '1.5px solid #CBD5E1', background: '#fff', color: '#64748B', fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize' },
  diaBtnAtivo: { background: '#E8F0FB', color: '#003D7C', borderColor: '#003D7C' },
  salvar: { marginTop: '1.1rem', background: '#003D7C', color: '#fff', border: 'none', borderRadius: 10, padding: '0.75rem 1.4rem', fontWeight: 800, cursor: 'pointer' },
  msg: { marginTop: '0.8rem', fontSize: '0.86rem', fontWeight: 700 },
}
