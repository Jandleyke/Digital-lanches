import { useState, useMemo, useCallback } from 'react'
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis,
  Tooltip, ResponsiveContainer, LineChart, Line,
} from 'recharts'
import Layout from '../../components/Layout'
import { useApp } from '../../contexts/AppContext'
import { useIsMobile } from '../../utils/useIsMobile'
import { formatPrice } from '../../utils/formatters'
import AvisosBanner from '../../components/AvisosBanner'
import { DollarSign, Package, Flame, Target, AlertTriangle, Star, PackageCheck, Clock, Trash2, RefreshCcw, ChevronDown, ChevronUp } from 'lucide-react'

const PIE_CORES = ['#003D7C','#F47920','#22C55E','#EF4444','#A855F7','#F59E0B','#06B6D4']

const PERIODOS = [
  { val: 'hoje',   label: 'Hoje' },
  { val: '7dias',  label: '7 dias' },
  { val: '30dias', label: '30 dias' },
  { val: 'todos',  label: 'Todos' },
]

const STATUS_PRODUCAO = ['todos', 'Planejado', 'Em producao', 'Pronto para venda', 'Cancelado']
const PRODUCAO_OCULTOS = ['parcialmente pronto', 'esgotado']

function inicioPeriodo(val) {
  const agora = Date.now()
  if (val === 'hoje') {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime()
  }
  if (val === '7dias')  return agora - 7  * 86400000
  if (val === '30dias') return agora - 30 * 86400000
  return 0
}

function normalizeStatus(status) {
  return String(status || '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function getPedidoDate(pedido) {
  const value = pedido?.criadoEm || pedido?.createdAt || pedido?.dataPedido || pedido?.data || pedido?.timestamp
  if (!value) return null

  try {
    const date = value?.toDate ? value.toDate() : new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  } catch {
    return null
  }
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDateTime(value) {
  if (!value) return 'Não informado'

  try {
    const date = value?.toDate ? value.toDate() : new Date(value)
    if (Number.isNaN(date.getTime())) return 'Não informado'
    return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return 'Não informado'
  }
}

function getTotalPedido(pedido) {
  return Number(pedido?.total || pedido?.valorTotal || pedido?.totalPedido || pedido?.valor || 0)
}

function isStatusCancelado(status) {
  return [
    'cancelado',
    'cancelada',
    'cancelado pelo aluno',
    'cancelado_pelo_aluno',
    'cancelado-aluno',
    'cancelado pelo admin',
    'cancelado_admin',
    'cancelled',
  ].includes(normalizeStatus(status))
}

function isPedidoCancelado(pedido) {
  return isStatusCancelado(pedido?.status)
}

function isPedidoEntregue(pedido) {
  return ['entregue', 'finalizado', 'finalizada'].includes(normalizeStatus(pedido?.status))
}

function getStatusAgrupado(status) {
  if (isStatusCancelado(status)) return 'Cancelado'
  const normalizado = normalizeStatus(status)
  if (['em preparo', 'em_preparo', 'preparando'].includes(normalizado)) return 'Em preparo'
  if (['entregue', 'finalizado', 'finalizada'].includes(normalizado)) return 'Entregue'
  return status || 'Recebido'
}

function getPedidosPorStatus(statusSelecionado, pedidos) {
  const statusNormalizado = normalizeStatus(statusSelecionado)

  return pedidos.filter((pedido) => {
    const statusPedido = normalizeStatus(pedido.status)

    if (statusNormalizado === 'cancelado') return isStatusCancelado(statusPedido)
    if (statusNormalizado === 'entregue') return ['entregue', 'finalizado', 'finalizada'].includes(statusPedido)
    if (statusNormalizado === 'preparando') return ['preparando', 'em preparo', 'em_preparo'].includes(statusPedido)

    return statusPedido === statusNormalizado
  })
}

function producaoVisual(status) {
  const normal = normalizeStatus(status)
  if (normal === 'pronto para venda') return { bg: '#DCFCE7', color: '#166534', label: 'Pronto para venda' }
  if (normal === 'em producao') return { bg: '#FEF3C7', color: '#92400E', label: 'Em producao' }
  if (normal === 'parcialmente pronto') return { bg: '#F5F3FF', color: '#6D28D9', label: 'Parcialmente pronto' }
  if (normal === 'esgotado') return { bg: '#FEE2E2', color: '#B91C1C', label: 'Esgotado' }
  if (normal === 'cancelado') return { bg: '#E2E8F0', color: '#475569', label: 'Cancelado' }
  return { bg: '#E0F2FE', color: '#075985', label: status || 'Planejado' }
}

function horaCurta(valor) {
  if (!valor) return '--:--'
  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) return '--:--'
  return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function CollapseToggle({ aberto, onClick }) {
  return (
    <button type="button" onClick={onClick} style={s.collapseBtn} title={aberto ? 'Minimizar seção' : 'Expandir seção'}>
      {aberto ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
    </button>
  )
}

export default function Dashboard() {
  const { pedidos, produtos, producaoHoje } = useApp()
  const isMobile = useIsMobile()
  const [periodo, setPeriodo] = useState('hoje')
  const [statusSelecionado, setStatusSelecionado] = useState(null)
  const [pedidosDoStatus, setPedidosDoStatus] = useState([])
  const [filtroProducao, setFiltroProducao] = useState('todos')
  const [secoesFechadas, setSecoesFechadas] = useState({})
  const [detalheExtra, setDetalheExtra] = useState(null)

  const alternarSecao = useCallback((id) => {
    setSecoesFechadas(prev => ({ ...prev, [id]: !prev[id] }))
  }, [])

  const pedidosFiltrados = useMemo(() => {
    const inicio = inicioPeriodo(periodo)
    return pedidos.filter(p => {
      const date = getPedidoDate(p)
      const time = date ? date.getTime() : Number(p.criadoEm || 0)
      return time >= inicio
    })
  }, [pedidos, periodo])

  const pedidosValidos = useMemo(() => pedidosFiltrados.filter(p => !isPedidoCancelado(p)), [pedidosFiltrados])
  const pedidosCancelados = useMemo(() => pedidosFiltrados.filter(isPedidoCancelado), [pedidosFiltrados])
  const listaPedidosAtivos = useMemo(() => pedidosValidos.filter(p => !isPedidoEntregue(p)), [pedidosValidos])
  const pedidosVendidos = useMemo(() => pedidosValidos.filter(p => p.pago), [pedidosValidos])
  const totalVendas = pedidosVendidos.reduce((acc, p) => acc + getTotalPedido(p), 0)
  const totalPedidos = pedidosValidos.length
  const pedidosAtivos = listaPedidosAtivos.length
  const pedidosPagos = pedidosVendidos
  const ticketMedio = pedidosPagos.length ? pedidosPagos.reduce((a, p) => a + getTotalPedido(p), 0) / pedidosPagos.length : 0
  const estoqueBaixo = produtos.filter(p => p.estoqueBaixo > 0 && p.estoque <= p.estoqueBaixo)
  const producaoAdmin = useMemo(() => (producaoHoje || [])
    .filter(item => item.visivelParaAdmin !== false)
    .filter(item => !PRODUCAO_OCULTOS.includes(normalizeStatus(item.status)))
    .filter(item => filtroProducao === 'todos' || normalizeStatus(item.status) === normalizeStatus(filtroProducao))
    .sort((a, b) => (b.atualizadoEm || b.criadoEm || 0) - (a.atualizadoEm || a.criadoEm || 0)), [producaoHoje, filtroProducao])

  const maisVendidos = useMemo(() => {
    const cont = {}
    pedidosVendidos.forEach(p => p.itens?.forEach(i => {
      cont[i.nome] = (cont[i.nome] || 0) + Number(i.quantidade || 1)
    }))
    return Object.entries(cont).sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([nome, qtd]) => ({ nome: nome.length > 14 ? nome.slice(0, 13) + '…' : nome, qtd }))
  }, [pedidosVendidos])

  const dadosTempo = useMemo(() => {
    if (periodo === 'hoje') {
      const porHora = {}
      pedidosVendidos.forEach(p => {
        if (!p.criadoEm) return
        const h = new Date(p.criadoEm).getHours()
        porHora[h] = (porHora[h] || 0) + 1
      })
      return Array.from({ length: 13 }, (_, i) => ({ hora: `${i + 7}h`, pedidos: porHora[i + 7] || 0 }))
    }

    const porDia = {}
    pedidosVendidos.forEach(p => {
      if (!p.criadoEm) return
      const d = new Date(p.criadoEm)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      porDia[key] = (porDia[key] || 0) + getTotalPedido(p)
    })

    return Object.entries(porDia)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([data, total]) => {
        const [, month, day] = data.split('-')
        return { dia: `${day}/${month}`, total }
      })
  }, [periodo, pedidosVendidos])

  const statusData = useMemo(() => {
    const contagem = {}
    pedidosFiltrados.forEach(p => {
      const status = getStatusAgrupado(p.status)
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

  function abrirPedidosPorStatus(status) {
    setStatusSelecionado(status)
    setPedidosDoStatus(getPedidosPorStatus(status, pedidosFiltrados))
  }

  const abrirListaPedidos = useCallback((titulo, lista) => {
    setStatusSelecionado(titulo)
    setPedidosDoStatus(lista)
  }, [])

  function fecharPedidosPorStatus() {
    setStatusSelecionado(null)
    setPedidosDoStatus([])
  }

  const avaliados = useMemo(() => pedidosValidos.filter(p => p.avaliacao > 0), [pedidosValidos])
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

  const totalDesperdicioHoje = useMemo(() => (producaoHoje || [])
    .reduce((acc, item) => acc + Number(item.quantidadeDesperdicada || 0), 0), [producaoHoje])

  const desperdiciosHojeTodos = useMemo(() => {
    const lista = []
    ;(producaoHoje || []).forEach(item => {
      (item.historicoDesperdicio || []).forEach(h => lista.push({ ...h, produtoNome: h.produtoNome || item.produtoNome }))
    })
    return lista.sort((a, b) => (b.dataHora || 0) - (a.dataHora || 0))
  }, [producaoHoje])

  const desperdiciosHoje = useMemo(() => desperdiciosHojeTodos.slice(0, 5), [desperdiciosHojeTodos])

  const ajustesVendedorHoje = useMemo(() => {
    const lista = []
    ;(producaoHoje || []).forEach(item => {
      (item.historico || []).forEach(h => {
        if (h.acao === 'Ajuste de producao recebida') lista.push({ ...h, produtoNome: h.produtoNome || item.produtoNome })
      })
    })
    return lista.sort((a, b) => (b.dataHora || b.data || 0) - (a.dataHora || a.data || 0)).slice(0, 5)
  }, [producaoHoje])

  const abrirDetalheEstoque = useCallback(() => {
    setDetalheExtra({ titulo: 'Estoque Crítico', tipo: 'estoque', itens: estoqueBaixo })
  }, [estoqueBaixo])

  const abrirDetalheDesperdicio = useCallback(() => {
    setDetalheExtra({ titulo: 'Desperdício do Dia', tipo: 'desperdicio', itens: desperdiciosHojeTodos })
  }, [desperdiciosHojeTodos])

  const cards = useMemo(() => [
    { icon: DollarSign,    label: 'Total Vendas',   valor: formatPrice(totalVendas),       cor: '#003D7C', onClick: () => abrirListaPedidos('Vendas pagas', pedidosVendidos), title: 'Ver pedidos pagos do período' },
    { icon: Package,       label: 'Total Pedidos',  valor: totalPedidos,                   cor: '#F47920', onClick: () => abrirListaPedidos('Pedidos válidos', pedidosValidos), title: 'Ver pedidos válidos do período' },
    { icon: Flame,         label: 'Pedidos Ativos', valor: pedidosAtivos,                  cor: '#22C55E', onClick: () => abrirListaPedidos('Pedidos ativos', listaPedidosAtivos), title: 'Ver pedidos ativos do período' },
    { icon: Target,        label: 'Ticket Médio',   valor: formatPrice(ticketMedio),       cor: '#A855F7', onClick: () => abrirListaPedidos('Pedidos pagos', pedidosPagos), title: 'Ver pedidos que compõem o ticket médio' },
    { icon: Star,          label: 'Nota Média',     valor: notaMedia !== null ? `${notaMedia.toFixed(1)} ⭐` : '—', cor: '#F59E0B', onClick: () => abrirListaPedidos('Pedidos avaliados', avaliados), title: 'Ver pedidos avaliados' },
    { icon: AlertTriangle, label: 'Est. Crítico',   valor: `${estoqueBaixo.length} itens`, cor: '#EF4444', onClick: abrirDetalheEstoque, title: 'Ver produtos com estoque crítico' },
    { icon: Trash2,        label: 'Desperdício Hoje', valor: `${totalDesperdicioHoje} un`, cor: '#EF4444', onClick: abrirDetalheDesperdicio, title: 'Ver desperdícios registrados hoje' },
  ], [totalVendas, totalPedidos, pedidosAtivos, pedidosValidos, listaPedidosAtivos, pedidosVendidos, pedidosPagos, abrirListaPedidos, ticketMedio, notaMedia, avaliados, estoqueBaixo.length, totalDesperdicioHoje, abrirDetalheEstoque, abrirDetalheDesperdicio])

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
          <span style={s.periodoInfo}>{totalPedidos === 0 ? 'Sem pedidos válidos neste período' : `${totalPedidos} pedido(s) válido(s)`}</span>
        )}
        {pedidosCancelados.length > 0 && (
          <button
            type="button"
            style={s.canceladosBtn}
            onClick={() => abrirPedidosPorStatus('Cancelado')}
            title="Ver pedidos cancelados neste período"
          >
            {pedidosCancelados.length} cancelado(s)
          </button>
        )}
      </div>

      {/* Cards de métricas */}
      <div style={{ ...s.cardsGrid, gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: isMobile ? '0.5rem' : '0.75rem', marginBottom: isMobile ? '0.6rem' : '1rem' }}>
        {cards.map(c => {
          const Icon = c.icon
          return (
            <button
              key={c.label}
              type="button"
              style={{
                ...s.card,
                ...(c.onClick ? s.cardInterativo : {}),
                borderTop: `4px solid ${c.cor}`,
                padding: isMobile ? '0.7rem' : '1rem',
                gap: isMobile ? 2 : 4,
              }}
              onClick={c.onClick}
              disabled={!c.onClick}
              title={c.title || c.label}
            >
              <div style={{ ...s.cardIconBox, width: isMobile ? 28 : 34, height: isMobile ? 28 : 34, marginBottom: 0 }}>
                <Icon size={isMobile ? 14 : 18} color={c.cor} strokeWidth={2} />
              </div>
              <p style={{ ...s.cardLabel, fontSize: isMobile ? '0.72rem' : '0.78rem' }}>{c.label}</p>
              <strong style={{ ...s.cardValor, color: c.cor, fontSize: isMobile ? '1.05rem' : '1.3rem' }}>{c.valor}</strong>
            </button>
          )
        })}
      </div>

      {/* Gráficos linha 1 */}
      <div style={{ ...s.box, padding: isMobile ? '0.75rem' : '1.1rem', marginBottom: isMobile ? '0.5rem' : '0.75rem' }}>
        <div style={s.producaoHeader}>
          <h3 style={{ ...s.boxTitulo, margin: 0 }}><PackageCheck size={16} /> Producao da Cozinha</h3>
          <div style={s.producaoFiltros}>
            {!secoesFechadas.producao && STATUS_PRODUCAO.map(status => (
              <button key={status} style={{ ...s.producaoFiltroBtn, ...(filtroProducao === status ? s.producaoFiltroAtivo : {}) }} onClick={() => setFiltroProducao(status)}>
                {status === 'todos' ? 'Todos' : status}
              </button>
            ))}
            <CollapseToggle aberto={!secoesFechadas.producao} onClick={() => alternarSecao('producao')} />
          </div>
        </div>
        {!secoesFechadas.producao && (
          producaoAdmin.length === 0 ? (
            <p style={s.semDados}>Nenhuma producao informada hoje.</p>
          ) : (
            <div style={s.producaoGrid}>
              {producaoAdmin.slice(0, 8).map(item => {
                const visual = producaoVisual(item.status)
                return (
                  <article
                    key={item.id}
                    style={{ ...s.producaoCard, ...s.producaoCardClicavel }}
                    role="button"
                    tabIndex={0}
                    onClick={() => setDetalheExtra({ titulo: item.produtoNome, tipo: 'producao', item })}
                    onKeyDown={e => { if (e.key === 'Enter') setDetalheExtra({ titulo: item.produtoNome, tipo: 'producao', item }) }}
                  >
                    <div style={s.producaoTop}>
                      <strong>{item.produtoNome}</strong>
                      <span style={{ ...s.producaoBadge, background: visual.bg, color: visual.color }}>{visual.label}</span>
                    </div>
                    <div style={s.producaoMeta}>
                      <span>Planejado: <strong>{item.quantidadePlanejada || 0}</strong></span>
                      <span>Pronto: <strong>{item.quantidadePronta || 0}</strong></span>
                      <span>Restante: <strong>{item.quantidadeRestante || 0}</strong></span>
                      <span><Clock size={12} /> Prev.: <strong>{item.horarioPrevisto || '--:--'}</strong></span>
                    </div>
                    {item.observacao && <p style={s.producaoObs}>{item.observacao}</p>}
                    <p style={s.producaoAutor}>Por {item.atualizadoPor?.nome || item.criadoPor?.nome || 'Cozinha'} - atualizado as {horaCurta(item.atualizadoEm)}</p>
                  </article>
                )
              })}
            </div>
          )
        )}
      </div>

      {/* Desperdício e ajustes do vendedor */}
      <div style={{ ...s.row, gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '0.5rem' : '0.75rem', marginBottom: isMobile ? '0.5rem' : '0.75rem' }}>
        <div style={{ ...s.box, padding: isMobile ? '0.75rem' : '1.1rem' }}>
          <div style={s.boxHeader}>
            <h3 style={{ ...s.boxTitulo, marginBottom: 0, fontSize: isMobile ? '0.85rem' : '0.92rem' }}><Trash2 size={16} /> Desperdício do Dia</h3>
            <CollapseToggle aberto={!secoesFechadas.desperdicio} onClick={() => alternarSecao('desperdicio')} />
          </div>
          {!secoesFechadas.desperdicio && (
            desperdiciosHoje.length === 0 ? (
              <p style={s.semDados}>Nenhum desperdício registrado hoje.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                {desperdiciosHoje.map(item => (
                  <div key={item.id} style={s.estoqueItem}>
                    <span style={{ flex: 1, fontSize: '0.84rem', color: '#475569' }}>{item.produtoNome || 'Produto'}</span>
                    <span style={{ fontSize: '0.78rem', color: '#94A3B8' }}>{item.motivo || 'Outro'} - {horaCurta(item.dataHora)}</span>
                    <span style={{
                      fontWeight: 800, fontSize: '0.84rem', color: '#EF4444',
                      background: '#FEE2E2', padding: '0.15rem 0.55rem', borderRadius: 8,
                    }}>
                      {item.quantidade || 0} un
                    </span>
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        <div style={{ ...s.box, padding: isMobile ? '0.75rem' : '1.1rem' }}>
          <div style={s.boxHeader}>
            <h3 style={{ ...s.boxTitulo, marginBottom: 0, fontSize: isMobile ? '0.85rem' : '0.92rem' }}><RefreshCcw size={16} /> Ajustes do Vendedor</h3>
            <CollapseToggle aberto={!secoesFechadas.ajustes} onClick={() => alternarSecao('ajustes')} />
          </div>
          {!secoesFechadas.ajustes && (
            ajustesVendedorHoje.length === 0 ? (
              <p style={s.semDados}>Nenhum ajuste de produção registrado hoje.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                {ajustesVendedorHoje.map(item => (
                  <div key={item.id} style={s.estoqueItem}>
                    <span style={{ flex: 1, fontSize: '0.84rem', color: '#475569' }}>{item.produtoNome || 'Produto'}</span>
                    <span style={{ fontSize: '0.78rem', color: '#94A3B8' }}>{item.quantidadeAnterior ?? '-'} → {item.quantidadeNova ?? '-'} un - {horaCurta(item.dataHora || item.data)}</span>
                    <span style={{
                      fontWeight: 800, fontSize: '0.78rem', color: '#003D7C',
                      background: '#E0ECFF', padding: '0.15rem 0.55rem', borderRadius: 8,
                    }}>
                      {item.alteradoPorNome || item.usuario?.nome || 'Vendedor'}
                    </span>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>

      <div style={{ ...s.row, gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '0.5rem' : '0.75rem', marginBottom: isMobile ? '0.5rem' : '0.75rem' }}>
        <div style={{ ...s.box, padding: isMobile ? '0.75rem' : '1.1rem' }}>
          <div style={s.boxHeader}>
            <h3 style={{ ...s.boxTitulo, marginBottom: 0, fontSize: isMobile ? '0.85rem' : '0.92rem' }}>{tempoTitulo}</h3>
            <CollapseToggle aberto={!secoesFechadas.tempo} onClick={() => alternarSecao('tempo')} />
          </div>
          {!secoesFechadas.tempo && (
            dadosTempo.some(d => (periodo === 'hoje' ? d.pedidos > 0 : d.total > 0)) ? (
              <ResponsiveContainer width="100%" height={200}>
                {periodo === 'hoje' ? (
                  <BarChart data={dadosTempo} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <XAxis dataKey="hora" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="pedidos" fill="#003D7C" radius={[4, 4, 0, 0]} />
                  </BarChart>
                ) : (
                  <LineChart data={dadosTempo} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="total" stroke="#003D7C" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                )}
              </ResponsiveContainer>
            ) : <p style={s.semDados}>Nenhum pedido neste período.</p>
          )}
        </div>

        <div style={{ ...s.box, padding: isMobile ? '0.75rem' : '1.1rem' }}>
          <div style={s.boxHeader}>
            <h3 style={{ ...s.boxTitulo, marginBottom: 0, fontSize: isMobile ? '0.85rem' : '0.92rem' }}>Status dos Pedidos</h3>
            <CollapseToggle aberto={!secoesFechadas.statusPedidos} onClick={() => alternarSecao('statusPedidos')} />
          </div>
          {!secoesFechadas.statusPedidos && (
            statusData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                      nameKey="status"
                      onClick={(data) => abrirPedidosPorStatus(data.status)}
                      cursor="pointer"
                    >
                      {statusData.map((d, i) => <Cell key={i} fill={d.cor} />)}
                    </Pie>
                    <Tooltip formatter={(v, n) => [v, n]} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={s.statusLegend}>
                  {statusData.map(d => (
                    <button key={d.status} type="button" style={s.statusLegendItem} onClick={() => abrirPedidosPorStatus(d.status)} title={`Ver pedidos: ${d.status}`}>
                      <span style={{ ...s.statusDot, background: d.cor }} />
                      <span>{d.status}</span>
                      <strong>{d.value}</strong>
                    </button>
                  ))}
                </div>
              </>
            ) : <p style={s.semDados}>Nenhum pedido neste período.</p>
          )}
        </div>
      </div>

      {/* Gráficos linha 2 */}
      <div style={{ ...s.row, gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr', gap: isMobile ? '0.5rem' : '0.75rem', marginBottom: isMobile ? '0.5rem' : '0.75rem' }}>
        <div style={{ ...s.box, padding: isMobile ? '0.75rem' : '1.1rem' }}>
          <div style={s.boxHeader}>
            <h3 style={{ ...s.boxTitulo, marginBottom: 0, fontSize: isMobile ? '0.85rem' : '0.92rem' }}>Produtos Mais Vendidos</h3>
            <CollapseToggle aberto={!secoesFechadas.maisVendidos} onClick={() => alternarSecao('maisVendidos')} />
          </div>
          {!secoesFechadas.maisVendidos && (
            maisVendidos.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={maisVendidos} layout="vertical" margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis dataKey="nome" type="category" tick={{ fontSize: 11 }} width={100} />
                  <Tooltip />
                  <Bar dataKey="qtd" fill="#F47920" radius={[0, 4, 4, 0]}>
                    {maisVendidos.map((_, i) => <Cell key={i} fill={PIE_CORES[i % PIE_CORES.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <p style={s.semDados}>Nenhum produto vendido neste período.</p>
          )}
        </div>

        <div style={{ ...s.box, padding: isMobile ? '0.75rem' : '1.1rem' }}>
          <div style={s.boxHeader}>
            <h3 style={{ ...s.boxTitulo, marginBottom: 0, fontSize: isMobile ? '0.85rem' : '0.92rem' }}>Estoque Crítico</h3>
            <CollapseToggle aberto={!secoesFechadas.estoque} onClick={() => alternarSecao('estoque')} />
          </div>
          {!secoesFechadas.estoque && (
            estoqueBaixo.length === 0 ? (
              <p style={{ color: '#22C55E', fontSize: '0.85rem', marginTop: 8 }}>✓ Todos os produtos com estoque adequado</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                {[...estoqueBaixo].sort((a, b) => a.estoque - b.estoque).map(p => (
                  <button key={p.id} type="button" style={{ ...s.estoqueItem, ...s.estoqueItemClicavel }} onClick={() => setDetalheExtra({ titulo: p.nome, tipo: 'produto', item: p })}>
                    <span style={{ fontSize: '1.1rem' }}>{p.emoji}</span>
                    <span style={{ flex: 1, fontSize: '0.84rem', color: '#475569', textAlign: 'left' }}>{p.nome}</span>
                    <span style={{
                      fontWeight: 800, fontSize: '0.84rem',
                      color: p.estoque === 0 ? '#EF4444' : '#F59E0B',
                      background: p.estoque === 0 ? '#FEE2E2' : '#FEF3C7',
                      padding: '0.15rem 0.55rem', borderRadius: 8,
                    }}>
                      {p.estoque === 0 ? 'SEM ESTOQUE' : `${p.estoque} un`}
                    </span>
                  </button>
                ))}
              </div>
            )
          )}
        </div>
      </div>

      {/* Gráficos linha 3 — Avaliações */}
      <div style={{ ...s.row, gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '0.5rem' : '0.75rem' }}>
        <div style={{ ...s.box, padding: isMobile ? '0.75rem' : '1.1rem' }}>
          <div style={s.boxHeader}>
            <h3 style={{ ...s.boxTitulo, marginBottom: 0, fontSize: isMobile ? '0.85rem' : '0.92rem' }}>Distribuição das Avaliações</h3>
            <CollapseToggle aberto={!secoesFechadas.distribuicaoNotas} onClick={() => alternarSecao('distribuicaoNotas')} />
          </div>
          {!secoesFechadas.distribuicaoNotas && (
            avaliados.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={distribuicaoNotas} layout="vertical" margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis dataKey="nota" type="category" tick={{ fontSize: 11 }} width={36} />
                  <Tooltip />
                  <Bar dataKey="qtd" fill="#F59E0B" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p style={s.semDados}>Nenhuma avaliação neste período.</p>
          )}
        </div>

        <div style={{ ...s.box, padding: isMobile ? '0.75rem' : '1.1rem' }}>
          <div style={s.boxHeader}>
            <h3 style={{ ...s.boxTitulo, marginBottom: 0, fontSize: isMobile ? '0.85rem' : '0.92rem' }}>Itens Mais Bem Avaliados</h3>
            <CollapseToggle aberto={!secoesFechadas.melhorAvaliados} onClick={() => alternarSecao('melhorAvaliados')} />
          </div>
          {!secoesFechadas.melhorAvaliados && (
            itensMelhorAvaliados.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
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
            ) : <p style={s.semDados}>Avaliações insuficientes para destacar itens neste período.</p>
          )}
        </div>
      </div>

      {statusSelecionado && (
        <div style={s.statusOverlay} role="dialog" aria-modal="true" aria-labelledby="pedidos-status-title">
          <div style={{ ...s.statusModal, padding: isMobile ? 18 : 24, borderRadius: isMobile ? 16 : 18 }}>
            <div style={{ ...s.statusHeader, alignItems: isMobile ? 'flex-start' : 'center', flexDirection: isMobile ? 'column' : 'row' }}>
              <div>
                <h2 id="pedidos-status-title" style={s.statusTitle}>Pedidos - {statusSelecionado}</h2>
                <p style={s.statusSubtitle}>{pedidosDoStatus.length} pedido(s) encontrado(s)</p>
              </div>
              <button type="button" style={s.closeBtn} onClick={fecharPedidosPorStatus}>Fechar</button>
            </div>

            {pedidosDoStatus.length === 0 ? (
              <p style={s.semDados}>Nenhum pedido encontrado para este status.</p>
            ) : (
              <div style={s.statusList}>
                {pedidosDoStatus.map((pedido) => {
                  const pedidoCancelado = isStatusCancelado(pedido.status)
                  const itens = Array.isArray(pedido.itens) ? pedido.itens : []
                  const dataPedido = getPedidoDate(pedido)

                  return (
                    <div key={pedido.id || pedido.numero} style={s.pedidoStatusCard}>
                      <div style={s.pedidoStatusTop}>
                        <h3 style={s.pedidoStatusTitle}>Pedido #{pedido.numero || pedido.id || 'Não informado'}</h3>
                        <span style={s.statusBadge}>{pedido.status || 'Não informado'}</span>
                      </div>
                      <div style={s.pedidoInfoGrid}>
                        <p style={s.pedidoInfo}><strong>Aluno:</strong> {pedido.alunoNome || pedido.nomeAluno || pedido.aluno || pedido.nome || 'Não informado'}</p>
                        <p style={s.pedidoInfo}><strong>Matricula:</strong> {pedido.matricula || pedido.alunoMatricula || 'Não informada'}</p>
                        <p style={s.pedidoInfo}><strong>Total:</strong> {formatCurrency(getTotalPedido(pedido))}</p>
                        <p style={s.pedidoInfo}><strong>Data:</strong> {dataPedido ? formatDateTime(dataPedido) : formatDateTime(pedido.criadoEm || pedido.createdAt || pedido.dataPedido || pedido.data)}</p>
                      </div>

                      <div style={s.itensBox}>
                        <strong style={s.itensTitle}>Itens</strong>
                        {itens.length > 0 ? (
                          <ul style={s.itensList}>
                            {itens.map((item, index) => (
                              <li key={`${item.produtoId || item.nome || 'item'}-${index}`} style={s.itemLinha}>
                                <span>{item.quantidade || 1}x {item.nome || item.produtoNome || 'Produto'}</span>
                                <span>{formatCurrency(item.preco || item.valor || 0)}</span>
                              </li>
                            ))}
                          </ul>
                        ) : <p style={s.pedidoInfo}>Não informado</p>}
                      </div>

                      {pedidoCancelado && (
                        <div style={s.cancelamentoInfo}>
                          <p style={s.pedidoInfo}><strong>Cancelado por:</strong> {pedido.canceladoPorNome || pedido.canceladoPor || pedido.canceladoPorTipo || 'Não informado'}</p>
                          <p style={s.pedidoInfo}><strong>Motivo:</strong> {pedido.motivoCancelamento || pedido.cancelamentoMotivo || pedido.motivo || 'Não informado'}</p>
                          <p style={s.pedidoInfo}><strong>Cancelado em:</strong> {formatDateTime(pedido.canceladoEm || pedido.dataCancelamento)}</p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {detalheExtra && (
        <div style={s.statusOverlay} role="dialog" aria-modal="true" aria-labelledby="detalhe-extra-title">
          <div style={{ ...s.statusModal, maxWidth: 560, padding: isMobile ? 18 : 24, borderRadius: isMobile ? 16 : 18 }}>
            <div style={{ ...s.statusHeader, alignItems: 'center' }}>
              <h2 id="detalhe-extra-title" style={s.statusTitle}>{detalheExtra.titulo}</h2>
              <button type="button" style={s.closeBtn} onClick={() => setDetalheExtra(null)}>Fechar</button>
            </div>

            {detalheExtra.tipo === 'estoque' && (
              detalheExtra.itens.length === 0 ? (
                <p style={s.semDados}>Nenhum produto com estoque crítico.</p>
              ) : (
                <div style={s.statusList}>
                  {detalheExtra.itens.map(p => (
                    <div key={p.id} style={s.pedidoStatusCard}>
                      <div style={s.pedidoStatusTop}>
                        <h3 style={s.pedidoStatusTitle}>{p.emoji} {p.nome}</h3>
                        <span style={s.statusBadge}>{p.categoria || 'Produto'}</span>
                      </div>
                      <div style={s.pedidoInfoGrid}>
                        <p style={s.pedidoInfo}><strong>Estoque atual:</strong> {p.estoque ?? 0} un</p>
                        <p style={s.pedidoInfo}><strong>Estoque mínimo:</strong> {p.estoqueBaixo ?? 0} un</p>
                        <p style={s.pedidoInfo}><strong>Preço:</strong> {formatCurrency(p.preco)}</p>
                        <p style={s.pedidoInfo}><strong>Disponível:</strong> {p.disponivel !== false ? 'Sim' : 'Não'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {detalheExtra.tipo === 'desperdicio' && (
              detalheExtra.itens.length === 0 ? (
                <p style={s.semDados}>Nenhum desperdício registrado hoje.</p>
              ) : (
                <div style={s.statusList}>
                  {detalheExtra.itens.map(item => (
                    <div key={item.id} style={s.pedidoStatusCard}>
                      <div style={s.pedidoStatusTop}>
                        <h3 style={s.pedidoStatusTitle}>{item.produtoNome || 'Produto'}</h3>
                        <span style={s.statusBadge}>{item.quantidade || 0} un</span>
                      </div>
                      <div style={s.pedidoInfoGrid}>
                        <p style={s.pedidoInfo}><strong>Motivo:</strong> {item.motivo || 'Outro'}</p>
                        <p style={s.pedidoInfo}><strong>Responsável:</strong> {item.responsavel?.nome || 'Não informado'}</p>
                        <p style={s.pedidoInfo}><strong>Horário:</strong> {formatDateTime(item.dataHora)}</p>
                        {item.observacao && <p style={s.pedidoInfo}><strong>Observação:</strong> {item.observacao}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {detalheExtra.tipo === 'producao' && (() => {
              const item = detalheExtra.item
              const visual = producaoVisual(item.status)
              return (
                <div style={s.pedidoStatusCard}>
                  <div style={s.pedidoStatusTop}>
                    <span style={{ ...s.producaoBadge, background: visual.bg, color: visual.color }}>{visual.label}</span>
                  </div>
                  <div style={s.pedidoInfoGrid}>
                    <p style={s.pedidoInfo}><strong>Categoria:</strong> {item.produtoCategoria || 'Não informado'}</p>
                    <p style={s.pedidoInfo}><strong>Planejado:</strong> {item.quantidadePlanejada || 0} un</p>
                    <p style={s.pedidoInfo}><strong>Em produção:</strong> {item.quantidadeEmProducao || 0} un</p>
                    <p style={s.pedidoInfo}><strong>Pronto:</strong> {item.quantidadePronta || 0} un</p>
                    <p style={s.pedidoInfo}><strong>Restante:</strong> {item.quantidadeRestante || 0} un</p>
                    <p style={s.pedidoInfo}><strong>Vendido:</strong> {item.quantidadeVendida || 0} un</p>
                    <p style={s.pedidoInfo}><strong>Desperdiçado:</strong> {item.quantidadeDesperdicada || 0} un</p>
                    <p style={s.pedidoInfo}><strong>Previsão:</strong> {item.horarioPrevisto || '--:--'}</p>
                  </div>
                  {item.observacao && <p style={s.pedidoInfo}><strong>Observação:</strong> {item.observacao}</p>}
                  <p style={s.pedidoInfo}><strong>Atualizado por:</strong> {item.atualizadoPor?.nome || item.criadoPor?.nome || 'Cozinha'} às {formatDateTime(item.atualizadoEm)}</p>

                  {Array.isArray(item.historicoDesperdicio) && item.historicoDesperdicio.length > 0 && (
                    <div style={s.itensBox}>
                      <strong style={s.itensTitle}>Histórico de desperdício</strong>
                      <ul style={s.itensList}>
                        {item.historicoDesperdicio.slice(-5).reverse().map(h => (
                          <li key={h.id} style={s.itemLinha}>
                            <span>{h.quantidade} un - {h.motivo}{h.observacao ? ` (${h.observacao})` : ''}</span>
                            <span>{formatDateTime(h.dataHora)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {Array.isArray(item.historico) && item.historico.length > 0 && (
                    <div style={s.itensBox}>
                      <strong style={s.itensTitle}>Histórico de alterações</strong>
                      <ul style={s.itensList}>
                        {item.historico.slice(-5).reverse().map(h => (
                          <li key={h.id} style={s.itemLinha}>
                            <span>{h.acao} por {h.usuario?.nome || 'Usuário'}</span>
                            <span>{formatDateTime(h.data)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )
            })()}

            {detalheExtra.tipo === 'produto' && (() => {
              const p = detalheExtra.item
              return (
                <div style={s.pedidoStatusCard}>
                  <div style={s.pedidoInfoGrid}>
                    <p style={s.pedidoInfo}><strong>Categoria:</strong> {p.categoria || 'Não informado'}</p>
                    <p style={s.pedidoInfo}><strong>Estoque atual:</strong> {p.estoque ?? 0} un</p>
                    <p style={s.pedidoInfo}><strong>Estoque mínimo:</strong> {p.estoqueBaixo ?? 0} un</p>
                    <p style={s.pedidoInfo}><strong>Preço:</strong> {formatCurrency(p.preco)}</p>
                    <p style={s.pedidoInfo}><strong>Disponível:</strong> {p.disponivel !== false ? 'Sim' : 'Não'}</p>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      )}
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
  canceladosBtn: { border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#DC2626', borderRadius: 999, padding: '0.3rem 0.65rem', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' },
  cardsGrid: { display: 'grid', gap: '0.75rem', marginBottom: '1rem' },
  card: { background: '#fff', border: 'none', borderRadius: 14, padding: '1rem', display: 'flex', flexDirection: 'column', gap: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', textAlign: 'left', fontFamily: 'inherit', opacity: 1, cursor: 'default' },
  cardInterativo: { cursor: 'pointer' },
  cardIconBox: { width: 34, height: 34, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  cardLabel: { color: '#64748B', fontSize: '0.78rem' },
  cardValor: { fontSize: '1.3rem', fontWeight: 800 },
  row: { display: 'grid', gap: '0.75rem', marginBottom: '0.75rem' },
  box: { background: '#fff', borderRadius: 14, padding: '1.1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  boxTitulo: { fontWeight: 700, marginBottom: '0.75rem', fontSize: '0.92rem', color: '#1A202C', display: 'flex', alignItems: 'center', gap: 6 },
  boxHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: '0.5rem' },
  collapseBtn: { border: '1px solid #E2E8F0', background: '#fff', color: '#64748B', borderRadius: 8, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 },
  semDados: { color: '#94A3B8', fontSize: '0.85rem', textAlign: 'center', padding: '2rem 0' },
  producaoHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 },
  producaoFiltros: { display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' },
  producaoFiltroBtn: { border: '1px solid #E2E8F0', background: '#fff', color: '#64748B', borderRadius: 999, padding: '0.32rem 0.65rem', fontSize: '0.76rem', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' },
  producaoFiltroAtivo: { background: '#003D7C', borderColor: '#003D7C', color: '#fff' },
  producaoGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 10 },
  producaoCard: { border: '1px solid #E5E7EB', background: '#F8FAFC', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 },
  producaoCardClicavel: { cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', width: '100%' },
  producaoTop: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  producaoBadge: { borderRadius: 999, padding: '0.2rem 0.55rem', fontWeight: 900, fontSize: '0.7rem', whiteSpace: 'nowrap' },
  producaoMeta: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, color: '#475569', fontSize: '0.78rem' },
  producaoObs: { margin: 0, color: '#475569', background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, padding: 8, fontSize: '0.78rem', lineHeight: 1.4 },
  producaoAutor: { margin: 0, color: '#94A3B8', fontWeight: 700, fontSize: '0.72rem' },
  estoqueItem: { display: 'flex', alignItems: 'center', gap: 8, padding: '0.35rem 0', borderBottom: '1px solid #FEF2F2' },
  estoqueItemClicavel: { width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' },
  statusLegend: { display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 2 },
  statusLegendItem: { display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #E2E8F0', background: '#fff', borderRadius: 999, padding: '0.3rem 0.65rem', color: '#475569', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  statusDot: { width: 9, height: 9, borderRadius: '50%', flexShrink: 0 },
  statusOverlay: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  statusModal: { width: '100%', maxWidth: 900, maxHeight: '90vh', overflowY: 'auto', background: '#fff', boxShadow: '0 24px 80px rgba(15,23,42,0.25)' },
  statusHeader: { display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 20 },
  statusTitle: { margin: 0, color: '#0F172A', fontSize: '1.2rem', fontWeight: 800 },
  statusSubtitle: { margin: '4px 0 0', color: '#64748B', fontSize: '0.85rem' },
  closeBtn: { border: 'none', borderRadius: 10, background: '#003D7C', color: '#fff', minHeight: 42, padding: '0 1rem', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' },
  statusList: { display: 'flex', flexDirection: 'column', gap: 14 },
  pedidoStatusCard: { border: '1px solid #E5E7EB', background: '#F8FAFC', borderRadius: 14, padding: 16 },
  pedidoStatusTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' },
  pedidoStatusTitle: { margin: 0, fontSize: '1rem', color: '#0F172A' },
  statusBadge: { background: '#E0ECFF', color: '#003D7C', borderRadius: 999, padding: '0.25rem 0.65rem', fontWeight: 800, fontSize: '0.75rem' },
  pedidoInfoGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '4px 14px' },
  pedidoInfo: { margin: '0.25rem 0', color: '#475569', fontSize: '0.86rem', lineHeight: 1.45 },
  itensBox: { marginTop: 10 },
  itensTitle: { color: '#0F172A', fontSize: '0.88rem' },
  itensList: { listStyle: 'none', padding: 0, margin: '8px 0 0', display: 'flex', flexDirection: 'column', gap: 6 },
  itemLinha: { display: 'flex', justifyContent: 'space-between', gap: 12, color: '#475569', fontSize: '0.85rem', borderBottom: '1px solid #E5E7EB', paddingBottom: 6 },
  cancelamentoInfo: { marginTop: 12, padding: 12, borderRadius: 12, background: '#FFF1F2', color: '#991B1B' },
}
