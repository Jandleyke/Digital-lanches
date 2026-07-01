import Layout from '../../components/Layout'
import { useApp } from '../../contexts/AppContext'
import { Heart, Utensils, X, ShoppingCart } from 'lucide-react'
import { produtoDisponivelParaCardapioDia } from '../../utils/producao'

export default function Favoritos() {
  const { produtos, producaoHoje, favoritos, toggleFavorito, adicionarAoCarrinho } = useApp()
  const favoritados = produtos.filter(p => favoritos.includes(p.id))

  function podeAdicionar(p) {
    return produtoDisponivelParaCardapioDia(p, producaoHoje)
  }

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
            {favoritados.map(p => {
              const produtoDia = podeAdicionar(p)
              const disponivel = Boolean(produtoDia)
              return (
                <div key={p.id} style={{ ...s.card, opacity: disponivel ? 1 : 0.7 }}>
                  <div style={s.iconBox}>
                    {p.foto
                      ? <img src={p.foto} alt={p.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : p.emoji
                        ? <span style={{ fontSize: '1.6rem' }}>{p.emoji}</span>
                        : <Utensils size={18} color="#94A3B8" strokeWidth={1.8} />
                    }
                  </div>
                  <div style={s.info}>
                    <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{p.nome}</strong>
                    {disponivel
                      ? <span style={s.preco}>R$ {p.preco.toFixed(2).replace('.', ',')}</span>
                      : <span style={s.indisponivel}>{p.estoque <= 0 ? 'Sem estoque' : 'Indisponível hoje'}</span>
                    }
                  </div>
                  <div style={s.acoes}>
                    <button
                      style={{ ...s.btnAdd, background: disponivel ? '#F47920' : '#CBD5E1', cursor: disponivel ? 'pointer' : 'not-allowed' }}
                      onClick={() => produtoDia && adicionarAoCarrinho(produtoDia)}
                      disabled={!disponivel}
                    >
                      <ShoppingCart size={13} color="#fff" style={{ marginRight: 4 }} />
                      Adicionar
                    </button>
                    <button style={s.btnRem} onClick={() => toggleFavorito(p.id)} title="Remover favorito">
                      <X size={15} strokeWidth={2.5} color="#EF4444" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )
      }
    </Layout>
  )
}

const s = {
  grid: { display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 500 },
  card: { display: 'flex', alignItems: 'center', gap: 12, background: '#fff', borderRadius: 12, padding: '0.9rem 1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  iconBox: { width: 52, height: 52, borderRadius: 12, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' },
  info: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },
  preco: { color: '#003D7C', fontWeight: 700, fontSize: '0.9rem' },
  indisponivel: { color: '#94A3B8', fontSize: '0.8rem', fontWeight: 600 },
  acoes: { display: 'flex', gap: 8, alignItems: 'center' },
  btnAdd: { color: '#fff', padding: '0.4rem 0.9rem', borderRadius: 8, fontWeight: 700, fontSize: '0.82rem', border: 'none', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center' },
  btnRem: { background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
}
