import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { useApp } from '../contexts/AppContext'

export default function NotFound() {
  const { usuarioLogado } = useApp()
  const navigate = useNavigate()
  const destino = usuarioLogado
    ? usuarioLogado.perfil === 'aluno' ? '/aluno/cardapio'
      : usuarioLogado.perfil === 'cozinha' ? '/cozinha'
      : '/admin'
    : '/login'

  return (
    <Layout titulo="Página não encontrada">
      <div style={s.container}>
        <span style={s.emoji}>🙈</span>
        <h2 style={s.title}>Ops! Página não encontrada.</h2>
        <p style={s.message}>Parece que você tentou acessar um caminho inválido.</p>
        <button style={s.button} onClick={() => navigate(destino)}>Ir para a página inicial</button>
      </div>
    </Layout>
  )
}

const s = {
  container: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 1rem', gap: 16 },
  emoji: { fontSize: 48 },
  title: { margin: 0, fontSize: '1.5rem', color: '#1A202C' },
  message: { color: '#64748B', textAlign: 'center', maxWidth: 400 },
  button: { marginTop: 8, background: '#F47920', color: '#fff', padding: '0.9rem 1.6rem', borderRadius: 10, border: 'none', fontWeight: 700, cursor: 'pointer' },
}
