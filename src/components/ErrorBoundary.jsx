import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { erro: null }
  }

  static getDerivedStateFromError(erro) {
    return { erro }
  }

  componentDidCatch(erro, info) {
    console.error('[ErrorBoundary]', erro, info)
  }

  render() {
    if (this.state.erro) {
      return (
        <div style={s.tela}>
          <div style={s.card}>
            <div style={s.emoji}>⚠️</div>
            <h1 style={s.titulo}>Ops, algo deu errado</h1>
            <p style={s.texto}>
              A tela travou por um erro inesperado. Tente recarregar a página — se o problema continuar, avise o suporte.
            </p>
            <button style={s.botao} onClick={() => window.location.reload()}>Recarregar página</button>
            <details style={s.detalhes}>
              <summary>Detalhes técnicos</summary>
              <pre style={s.pre}>{String(this.state.erro?.message || this.state.erro)}</pre>
            </details>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

const s = {
  tela: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F5F7FA', padding: '1.5rem' },
  card: { background: '#fff', borderRadius: 18, padding: '2rem', maxWidth: 420, width: '100%', textAlign: 'center', boxShadow: '0 8px 24px rgba(15,23,42,0.08)' },
  emoji: { fontSize: '2.5rem', marginBottom: 8 },
  titulo: { fontSize: '1.15rem', fontWeight: 800, color: '#0F172A', margin: '0 0 8px' },
  texto: { color: '#64748B', fontSize: '0.9rem', lineHeight: 1.5, margin: '0 0 18px' },
  botao: { background: '#003D7C', color: '#fff', border: 'none', borderRadius: 12, padding: '0.75rem 1.5rem', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.9rem' },
  detalhes: { marginTop: 16, textAlign: 'left', fontSize: '0.78rem', color: '#94A3B8' },
  pre: { whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: '#F8FAFC', borderRadius: 8, padding: 10, marginTop: 6 },
}
