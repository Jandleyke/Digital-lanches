import { useState, useMemo } from 'react'
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis,
  Tooltip, ResponsiveContainer, Legend, LineChart, Line,
} from 'recharts'
import Layout from '../../components/Layout'
import { useApp } from '../../contexts/AppContext'
import { useIsMobile } from '../../utils/useIsMobile'
import { formatPrice } from '../../utils/formatters'
import AvisosBanner from '../../components/AvisosBanner'
import { DollarSign, Package, Flame, Target, AlertTriangle, Star } from 'lucide-react'

const PIE_CORES = ['#003D7C','#F47920','#22C55E','#EF4444','#A855F7','#F59E0B','#06B6D4']

const PERIODOS = [
  { val: 'hoje',   label: 'Hoje' },
  { val: '7dias',  label: '7 dias' },
  { val: '30dias', label: '30 dias' },
  { val: 'todos',  label: 'Todos' },
]

function inicioPeriodo(val) {
  const agora = Date.now()
  if (val === 'hoje') {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime()
  }
  if (val === '7dias')  return agora - 7  * 86400000
  if (val === '30dias') return agora - 30 * 86400000
  return 0
}

export default function Dashboard() {
  const { pedidos, produtos } = useApp()
  const isMobile = useIsMobile()
  const [periodo, setPeriodo] = useState('hoje')

  const pedidosFiltrados = useMemo(() => {
    const inicio = inicioPeriodo(periodo)
    return pedidos.filter(p => (p.criadoEm || 0) >= inicio)
  }, [pedidos, periodo])

  const totalVendas = pedidosFiltrados.filter(p => p.pago).reduce((acc, p) => acc + p.total, 0)
  const totalPedidos = pedidosFiltrados.length
  const pedidosAtivos = pedidosFiltrados.filter(p => p.status !== 'Entregue' && p.status !== 'Cancelado').length
  const pedidosPagos = pedidosFiltrados.filter(p => p.pago)
  const ticketMedio = pedidosPagos.length ? pedidosPagos.reduce((a, p) => a + p.total, 0) / pedidosPagos.length : 0
  const estoqueBaixo = produtos.filter(p => p.estoqueBaixo > 0 && p.estoque <= p.estoqueBaixo)

  const maisVendidos = useMemo(() => {
    const cont = {}
    pedidosFiltrados.forEach(p => p.itens?.forEach(i => {
      cont[i.nome] = (cont[i.nome] || 0) + i.quantidade
    }))
    return Object.entries(cont).sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([nome, qtd]) => ({ nome: nome.length > 14 ? nome.slice(0, 13) + '…' : nome, qtd }))
  }, [pedidosFiltrados])

  const dadosTempo = useMemo(() => {
    if (periodo === 'hoje') {
      const porHora = {}
      pedidosFiltrados.forEach(p => {
        if (!p.criadoEm) return
        const h = new Date(p.criadoEm).getHours()
        porHora[h] = (porHora[h] || 0) + 1
      })
      return Array.from({ length: 13 }, (_, i) => ({ hora: `${i + 7}h`, pedidos: porHora[i + 7] || 0 }))
    }

    const porDia = {}
    pedidosFiltrados.forEach(p => {
      if (!p.criadoEm) return
      const d = new Date(p.criadoEm)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      porDia[key] = (porDia[key] || 0) + p.total
    })

    return Object.entries(porDia)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([data, total]) => {
        const [, month, day] = data.split('-')
        return { dia: `${day}/${month}`, total }
      })
  }, [periodo, pedidosFiltrados])

  const statusData = useMemo(() => {
    const contagem = {}
    pedidosFiltrados.forEach(p => {
      const status = p.status || 'Recebido'
      contagem[status] = (contagem[status] || 0) + 1
    })
    return Object.entries(contagem)
      .map(([status, value]) => ({
        status,
        value,
        cor: status === 'Recebido' ? '#F59E0B'
          : status === 'Pronto' ? '#22C55E'
          : status === 'Entregue' ? '#94A3B8'
          : '#EF4444'
      }))
  }, [pedidosFiltrados])

  const tempoTitulo = periodo === 'hoje' ? 'Pedidos por Horário' : 'Vendas por Dia'

  const avaliados = useMemo(() => pedidosFiltrados.filter(p => p.avaliacao > 0), [pedidosFiltrados])
  const notaMedia = avaliados.length ? avaliados.reduce((acc, p) => acc + p.avaliacao, 0) / avaliados.length : null

  const distribuicaoNotas = useMemo(() => {
    const cont = [0, 0, 0, 0, 0]
    avaliados.forEach(p => { if (p.avaliacao >= 1 && p.avaliacao <= 5) cont[p.avaliacao - 1]++ })
    return [5, 4, 3, 2, 1].map(n => ({ nota: `${n}★`, qtd: cont[n - 1] }))
  }, [avaliados])

  const itensMelhorAvaliados = useMemo(() => {
    const acc = {}
    avaliados.forEach(p => p.itens?.forEach(i => {
      if (!acc[i.nome]) acc[i.nome] = { soma: 0, qtd: 0 }
      acc[i.nome].soma += p.avaliacao
      acc[i.nome].qtd += 1
    }))
    return Object.entries(acc)
      .filter(([, v]) => v.qtd >= 2)
      .map(([nome, v]) => ({ nome, media: v.soma / v.qtd, qtd: v.qtd }))
      .sort((a, b) => b.media - a.media || b.qtd - a.qtd)
      .slice(0, 5)
  }, [avaliados])

  const cards = useMemo(() => [
    { icon: DollarSign,    label: 'Total Vendas',   valor: formatPrice(totalVendas),       cor: '#003D7C' },
    { icon: Package,       label: 'Total Pedidos',  valor: totalPedidos,                   cor: '#F47920' },
    { icon: Flame,         label: 'Pedidos Ativos', valor: pedidosAtivos,                  cor: '#22C55E' },
    { icon: Target,        label: 'Ticket Médio',   valor: formatPrice(ticketMedio),       cor: '#A855F7' },
    { icon: Star,          label: 'Nota Média',     valor: notaMedia !== null ? `${notaMedia.toFixed(1)} ⭐` : '—', cor: '#F59E0B' },
    { icon: AlertTriangle, label: 'Est. Crítico',   valor: `${estoqueBaixo.length} itens`, cor: '#EF4444' },
  ], [totalVendas, totalPedidos, pedidosAtivos, ticketMedio, notaMedia, estoqueBaixo.length])

  return (
    <Layout titulo="Dashboard">
      {/* Filtro de período */}
      <AvisosBanner perfil="admin" />
      <div style={{ ...s.periodoBar, marginBottom: isMobile ? '0.5rem' : '1rem' }}>
        <span style={s.periodoLabel}>Período:</span>
        <div style={s.periodoGrupo}>
          {PERIODOS.map(p => (
            <button key={p.val}
              style={{ ...s.periodoBtn, ...(periodo === p.val ? s.periodoBtnAtivo : {}) }}
              onClick={() => setPeriodo(p.val)}>
              {p.label}
            </button>
          ))}
        </div>
        {periodo !== 'todos' && (
          <span style={s.periodoInfo}>{totalPedidos === 0 ? 'Sem pedidos neste período' : `${totalPedidos} pedido(s)`}</span>
        )}
      </div>

      {/* Cards de métricas */}
      <div style={{ ...s.cardsGrid, gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: isMobile ? '0.5rem' : '0.75rem', marginBottom: isMobile ? '0.6rem' : '1rem' }}>
        {cards.map(c => {
          const Icon = c.icon
          return (
            <div key={c.label} style={{ ...s.card, borderTop: `4px solid ${c.cor}`, padding: isMobile ? '0.7rem' : '1rem', gap: isMobile ? 2 : 4 }}>
              <div style={{ ...s.cardIconBox, width: isMobile ? 28 : 34, height: isMobile ? 28 : 34, marginBottom: 0 }}>
                <Icon size={isMobile ? 14 : 18} color={c.cor} strokeWidth={2} />
              </div>
              <p style={{ ...s.cardLabel, fontSize: isMobile ? '0.72rem' : '0.78rem' }}>{c.label}</p>
              <strong style={{ ...s.cardValor, color: c.cor, fontSize: isMobile ? '1.05rem' : '1.3rem' }}>{c.valor}</strong>
            </div>
          )
        })}
      </div>

      {/* Gráficos linha 1 */}
      <div style={{ ...s.row, gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '0.5rem' : '0.75rem', marginBottom: isMobile ? '0.5rem' : '0.75rem' }}>
        <div style={{ ...s.box, padding: isMobile ? '0.75rem' : '1.1rem' }}>
          <h3 style={{ ...s.boxTitulo, marginBottom: isMobile ? '0.4rem' : '0.75rem', fontSize: isMobile ? '0.85rem' : '0.92rem' }}>{tempoTitulo}</h3>
          {dadosTempo.some(d => (periodo === 'hoje' ? d.pedidos > 0 : d.total > 0)) ? (
            <ResponsiveContainer width="100%" height={200}>
              {periodo === 'hoje' ? (
                <BarChart data={dadosTempo} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                  <XAxis dataKey="hora" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="pedidos" fill="#003D7C" radius={[4, 4, 0, 0]} />
                </BarChart>
              ) : (
                <LineChart data={dadosTempo} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                  <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="total" stroke="#003D7C" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              )}
            </ResponsiveContainer>
          ) : <p style={s.semDados}>Nenhum pedido neste período.</p>}
        </div>

        <div style={{ ...s.box, padding: isMobile ? '0.75rem' : '1.1rem' }}>
          <h3 style={{ ...s.boxTitulo, marginBottom: isMobile ? '0.4rem' : '0.75rem', fontSize: isMobile ? '0.85rem' : '0.92rem' }}>Status dos Pedidos</h3>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value" nameKey="status">
                  {statusData.map((d, i) => <Cell key={i} fill={d.cor} />)}
                </Pie>
                <Tooltip formatter={(v, n) => [v, n]} />
                <Legend iconType="circle" iconSize={10} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p style={s.semDados}>Nenhum pedido neste período.</p>}
        </div>
      </div>

      {/* Gráficos linha 2 */}
      <div style={{ ...s.row, gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr', gap: isMobile ? '0.5rem' : '0.75rem', marginBottom: isMobile ? '0.5rem' : '0.75rem' }}>
        <div style={{ ...s.box, padding: isMobile ? '0.75rem' : '1.1rem' }}>
          <h3 style={{ ...s.boxTitulo, marginBottom: isMobile ? '0.4rem' : '0.75rem', fontSize: isMobile ? '0.85rem' : '0.92rem' }}>Produtos Mais Vendidos</h3>
          {maisVendidos.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={maisVendidos} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis dataKey="nome" type="category" tick={{ fontSize: 11 }} width={100} />
                <Tooltip />
                <Bar dataKey="qtd" fill="#F47920" radius={[0, 4, 4, 0]}>
                  {maisVendidos.map((_, i) => <Cell key={i} fill={PIE_CORES[i % PIE_CORES.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <p style={s.semDados}>Nenhum produto vendido neste período.</p>}
        </div>

        <div style={{ ...s.box, padding: isMobile ? '0.75rem' : '1.1rem' }}>
          <h3 style={{ ...s.boxTitulo, marginBottom: isMobile ? '0.4rem' : '0.75rem', fontSize: isMobile ? '0.85rem' : '0.92rem' }}>Estoque Crítico</h3>
          {estoqueBaixo.length === 0 ? (
            <p style={{ color: '#22C55E', fontSize: '0.85rem', marginTop: 8 }}>✓ Todos os produtos com estoque adequado</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
              {estoqueBaixo.sort((a, b) => a.estoque - b.estoque).map(p => (
                <div key={p.id} style={s.estoqueItem}>
                  <span style={{ fontSize: '1.1rem' }}>{p.emoji}</span>
                  <span style={{ flex: 1, fontSize: '0.84rem', color: '#475569' }}>{p.nome}</span>
                  <span style={{
                    fontWeight: 800, fontSize: '0.84rem',
                    color: p.estoque === 0 ? '#EF4444' : '#F59E0B',
                    background: p.estoque === 0 ? '#FEE2E2' : '#FEF3C7',
                    padding: '0.15rem 0.55rem', borderRadius: 8,
                  }}>
                    {p.estoque === 0 ? 'SEM ESTOQUE' : `${p.estoque} un`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Gráficos linha 3 — Avaliações */}
      <div style={{ ...s.row, gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '0.5rem' : '0.75rem' }}>
        <div style={{ ...s.box, padding: isMobile ? '0.75rem' : '1.1rem' }}>
          <h3 style={{ ...s.boxTitulo, marginBottom: isMobile ? '0.4rem' : '0.75rem', fontSize: isMobile ? '0.85rem' : '0.92rem' }}>Distribuição das Avaliações</h3>
          {avaliados.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={distribuicaoNotas} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis dataKey="nota" type="category" tick={{ fontSize: 11 }} width={36} />
                <Tooltip />
                <Bar dataKey="qtd" fill="#F59E0B" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p style={s.semDados}>Nenhuma avaliação neste período.</p>}
        </div>

        <div style={{ ...s.box, padding: isMobile ? '0.75rem' : '1.1rem' }}>
          <h3 style={{ ...s.boxTitulo, marginBottom: isMobile ? '0.4rem' : '0.75rem', fontSize: isMobile ? '0.85rem' : '0.92rem' }}>Itens Mais Bem Avaliados</h3>
          {itensMelhorAvaliados.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
              {itensMelhorAvaliados.map(item => (
                <div key={item.nome} style={s.estoqueItem}>
                  <span style={{ flex: 1, fontSize: '0.84rem', color: '#475569' }}>{item.nome}</span>
                  <span style={{ fontSize: '0.78rem', color: '#94A3B8' }}>{item.qtd} avaliação(ões)</span>
                  <span style={{
                    fontWeight: 800, fontSize: '0.84rem', color: '#F59E0B',
                    background: '#FEF3C7', padding: '0.15rem 0.55rem', borderRadius: 8,
                  }}>
                    {item.media.toFixed(1)} ⭐
                  </span>
                </div>
              ))}
            </div>
          ) : <p style={s.semDados}>Avaliações insuficientes para destacar itens neste período.</p>}
        </div>
      </div>
    </Layout>
  )
}

const s = {
  periodoBar: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1rem', flexWrap: 'wrap' },
  periodoLabel: { fontWeight: 600, color: '#64748B', fontSize: '0.85rem' },
  periodoGrupo: { display: 'flex', gap: 5 },
  periodoBtn: { padding: '0.35rem 0.9rem', borderRadius: 20, border: '2px solid #E2E8F0', background: '#fff', color: '#64748B', fontWeight: 600, fontSize: '0.8rem' },
  periodoBtnAtivo: { background: '#003D7C', color: '#fff', borderColor: '#003D7C' },
  periodoInfo: { color: '#94A3B8', fontSize: '0.8rem' },
  cardsGrid: { display: 'grid', gap: '0.75rem', marginBottom: '1rem' },
  card: { background: '#fff', borderRadius: 14, padding: '1rem', display: 'flex', flexDirection: 'column', gap: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  cardIconBox: { width: 34, height: 34, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  cardLabel: { color: '#64748B', fontSize: '0.78rem' },
  cardValor: { fontSize: '1.3rem', fontWeight: 800 },
  row: { display: 'grid', gap: '0.75rem', marginBottom: '0.75rem' },
  box: { background: '#fff', borderRadius: 14, padding: '1.1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  boxTitulo: { fontWeight: 700, marginBottom: '0.75rem', fontSize: '0.92rem', color: '#1A202C' },
  semDados: { color: '#94A3B8', fontSize: '0.85rem', textAlign: 'center', padding: '2rem 0' },
  estoqueItem: { display: 'flex', alignItems: 'center', gap: 8, padding: '0.35rem 0', borderBottom: '1px solid #FEF2F2' },
}
