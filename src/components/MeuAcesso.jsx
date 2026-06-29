import { useNavigate } from 'react-router-dom'
import { PERFIL_INFO, perfisParaExibicao } from '../utils/perfis'

export default function MeuAcesso({ usuario, compacto = false }) {
  const navigate = useNavigate()
  const perfis = perfisParaExibicao(usuario?.acessosEntrada || usuario)
  if (perfis.length <= 1) return null

  return (
    <section style={{ ...s.card, padding: compacto ? 14 : 18 }}>
      <div>
        <h2 style={s.title}>Meu acesso</h2>
        <p style={s.current}>Perfil atual: <strong>{PERFIL_INFO[usuario.perfil]?.nome || usuario.perfil}</strong></p>
        <p style={s.available}>Acessos disponíveis: {perfis.map(perfil => PERFIL_INFO[perfil]?.nome || perfil).join(', ')}</p>
      </div>
      <button type="button" style={s.button} onClick={() => navigate('/escolher-acesso?troca=1')}>Trocar acesso</button>
    </section>
  )
}

const s = {
  card: { background: '#fff', border: '1px solid #DBEAFE', borderLeft: '4px solid #003D7C', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap', boxShadow: '0 8px 24px rgba(15,23,42,0.05)' },
  title: { margin: 0, color: '#0F172A', fontSize: '1rem', fontWeight: 900 },
  current: { margin: '6px 0 0', color: '#334155', fontSize: '0.86rem' },
  available: { margin: '3px 0 0', color: '#64748B', fontSize: '0.78rem', lineHeight: 1.4 },
  button: { border: 'none', background: '#003D7C', color: '#fff', borderRadius: 8, minHeight: 42, padding: '0 14px', fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit' },
}
