import Layout from '../../components/Layout'
import { useApp } from '../../contexts/AppContext'

export default function Historico() {
  const { pedidos, usuarioLogado } = useApp()
  const historico = pedidos.filter(p => p.matricula === usuarioLogado?.matricula)

  return (
    <Layout titulo="Histórico de Pedidos">
      {historico.length === 0
        ? <div style={{ textAlign: 'center', padding: '4rem 0', color: '#94A3B8' }}><p>Nenhum pedido realizado ainda.</p></div>
        : (
          <div style={s.lista}>
            {historico.map(pedido => (
              <div key={pedido.id} style={s.card}>
                <div style={s.top}>
                  <div>
                    <strong>Pedido #{pedido.id}</strong>
                    <span style={s.data}>{pedido.horarioPedido}</span>
                  </div>
                  <div style={s.topRight}>
                    <span style={{ ...s.status, ...(pedido.status === 'Entregue' ? s.statusEntregue : s.statusAtivo) }}>{pedido.status}</span>
                    <strong style={s.total}>R$ {pedido.total.toFixed(2).replace('.', ',')}</strong>
                  </div>
                </div>
                <div style={s.itens}>
                  {pedido.itens.map((item, i) => (
                    <span key={i} style={s.itemTag}>{item.quantidade}x {item.nome}</span>
                  ))}
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
  lista: { display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 600 },
  card: { background: '#fff', borderRadius: 12, padding: '1rem 1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  top: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  data: { display: 'block', fontSize: '0.8rem', color: '#94A3B8' },
  topRight: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 },
  status: { padding: '0.2rem 0.7rem', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700 },
  statusEntregue: { background: '#F1F5F9', color: '#64748B' },
  statusAtivo: { background: '#DBEAFE', color: '#2563EB' },
  total: { color: '#003D7C' },
  itens: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  itemTag: { background: '#F5F7FA', padding: '0.25rem 0.7rem', borderRadius: 20, fontSize: '0.78rem', color: '#475569' },
}
