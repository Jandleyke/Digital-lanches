import Layout from '../../components/Layout'
import { useApp } from '../../contexts/AppContext'
import { Heart, Utensils, X } from 'lucide-react'

export default function Favoritos() {
  const { produtos, favoritos, toggleFavorito, adicionarAoCarrinho } = useApp()
  const favoritados = produtos.filter(p => favoritos.includes(p.id))

  return (
    <Layout titulo="Meus Favoritos">
      {favoritados.length === 0
        ? (
          <div style={{ textAlign: 'center', padding: '4rem 0', color: '#94A3B8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <Heart size={52} strokeWidth={1.2} color="#CBD5E1" />
            <p style={{ marginTop: 4 }}>Nenhum produto favoritado ainda.</p>
            <p style={{ fontSize: '0.85rem' }}>Toque no coração no cardápio para favoritar.</p>
          </div>
        )
        : (
          <div style={s.grid}>
            {favoritados.map(p => (
              <div key={p.id} style={s.card}>
                <div style={s.iconBox}>
                  <Utensils size={18} color="#94A3B8" strokeWidth={1.8} />
                </div>
                <div style={s.info}>
                  <strong>{p.nome}</strong>
                  <span style={s.preco}>R$ {p.preco.toFixed(2).replace('.', ',')}</span>
                </div>
                <div style={s.acoes}>
                  <button style={s.btnAdd} onClick={() => adicionarAoCarrinho(p)}>+ Adicionar</button>
                  <button style={s.btnRem} onClick={() => toggleFavorito(p.id)} title="Remover favorito">
                    <X size={15} strokeWidth={2.5} color="#EF4444" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      }
    </Layout>
  )
}

const s = {
  grid: { display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 500 },
  card: { display: 'flex', alignItems: 'center', gap: 12, background: '#fff', borderRadius: 12, padding: '0.9rem 1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  iconBox: { width: 40, height: 40, borderRadius: 10, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  info: { flex: 1, display: 'flex', flexDirection: 'column' },
  preco: { color: '#003D7C', fontWeight: 700, fontSize: '0.9rem' },
  acoes: { display: 'flex', gap: 8, alignItems: 'center' },
  btnAdd: { background: '#F47920', color: '#fff', padding: '0.4rem 0.9rem', borderRadius: 8, fontWeight: 700, fontSize: '0.82rem', border: 'none', cursor: 'pointer', fontFamily: 'inherit' },
  btnRem: { background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
}
