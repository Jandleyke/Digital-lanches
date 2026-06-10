import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  AlertTriangle, CheckCircle2, ClipboardList, Clock, Edit3, Eye, Flame,
  Megaphone, PackageCheck, PlusCircle, Save, Search, Send, Timer, Trash2, Utensils, XCircle,
} from 'lucide-react'
import Layout from '../../components/Layout'
import AvisosSetor from '../../components/AvisosSetor'
import { useApp } from '../../contexts/AppContext'
import { MOTIVOS_DESPERDICIO } from '../../contexts/hooks/useProducaoDiaria'
import { formatPrice } from '../../utils/formatters'
import { useIsMobile } from '../../utils/useIsMobile'

const ROTAS_ABA = {
  dashboard: '/cozinha',
  pedidos: '/cozinha/pedidos',
  producao: '/cozinha/producao',
  cardapio: '/cozinha/cardapio',
  avisos: '/cozinha/avisos',
}

function abaPorRota(pathname) {
  if (pathname.includes('/pedidos')) return 'pedidos'
  if (pathname.includes('/producao')) return 'producao'
  if (pathname.includes('/cardapio')) return 'cardapio'
  if (pathname.includes('/avisos')) return 'avisos'
  return 'dashboard'
}

const FILTROS = [
  ['todos', 'Todos'],
  ['pendentes', 'Pendentes'],
  ['preparo', 'Em preparo'],
  ['prontos', 'Prontos'],
  ['entregues', 'Entregues'],
  ['cancelados', 'Cancelados'],
]

const STATUS_PRODUCAO = [
  'Planejado',
  'Em producao',
  'Pronto para venda',
  'Parcialmente pronto',
  'Esgotado',
  'Cancelado',
]

const FORM_DESPERDICIO = {
  quantidade: '',
  motivo: MOTIVOS_DESPERDICIO[0],
  observacao: '',
}

const FORM_PRODUCAO = {
  produtoId: '',
  quantidadePlanejada: '',
  quantidadeEmProducao: '',
  quantidadePronta: '',
  quantidadeVendida: '',
  horarioPrevisto: '',
  status: 'Planejado',
  observacao: '',
  visivelParaVendedor: true,
  visivelParaAdmin: true,
}

const FLUXO = {
  Recebido: 'Em preparo',
  'Em preparo': 'Pronto',
  Pronto: 'Entregue',
}

function inicioDoDia() {
  const data = new Date()
  data.setHours(0, 0, 0, 0)
  return data.getTime()
}

function normalizeStatus(status) {
  return String(status || '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function statusVisual(status) {
  const normal = normalizeStatus(status)
  if (normal === 'recebido' || normal === 'pendente') return { label: 'Pendente', bg: '#FEF3C7', color: '#92400E' }
  if (normal === 'em preparo' || normal === 'preparando') return { label: 'Preparando', bg: '#DBEAFE', color: '#1D4ED8' }
  if (normal === 'pronto') return { label: 'Pronto', bg: '#DCFCE7', color: '#166534' }
  if (normal === 'entregue') return { label: 'Entregue', bg: '#E2E8F0', color: '#475569' }
  if (normal === 'cancelado') return { label: 'Cancelado', bg: '#FEE2E2', color: '#B91C1C' }
  return { label: status || 'Não informado', bg: '#F1F5F9', color: '#475569' }
}

function producaoStatusVisual(status) {
  const normal = normalizeStatus(status)
  if (normal === 'planejado') return { label: 'Planejado', bg: '#E0F2FE', color: '#075985', border: '#38BDF8' }
  if (normal === 'em producao') return { label: 'Em producao', bg: '#FEF3C7', color: '#92400E', border: '#F59E0B' }
  if (normal === 'pronto para venda') return { label: 'Pronto para venda', bg: '#DCFCE7', color: '#166534', border: '#22C55E' }
  if (normal === 'parcialmente pronto') return { label: 'Parcialmente pronto', bg: '#F5F3FF', color: '#6D28D9', border: '#8B5CF6' }
  if (normal === 'esgotado') return { label: 'Esgotado', bg: '#FEE2E2', color: '#B91C1C', border: '#EF4444' }
  if (normal === 'cancelado') return { label: 'Cancelado', bg: '#E2E8F0', color: '#475569', border: '#94A3B8' }
  return { label: status || 'Não informado', bg: '#F1F5F9', color: '#475569', border: '#CBD5E1' }
}

function formatarHoraAtualizacao(valor) {
  if (!valor) return 'Não atualizado'
  const date = new Date(valor)
  if (Number.isNaN(date.getTime())) return 'Não atualizado'
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function tempoDesde(valor) {
  if (!valor) return 'sem atualizacao'
  const diffMin = Math.max(0, Math.floor((Date.now() - Number(valor)) / 60000))
  if (diffMin < 1) return 'agora'
  if (diffMin < 60) return `${diffMin} min`
  const horas = Math.floor(diffMin / 60)
  return `${horas}h ${diffMin % 60}min`
}

function pedidoCodigo(pedido) {
  return String(pedido?.numero || pedido?.id || 'pedido').slice(-6).toUpperCase()
}

function alunoNome(pedido) {
  return pedido?.alunoNome || pedido?.nomeAluno || pedido?.aluno || pedido?.nome || 'Aluno não informado'
}

function pedidoHora(pedido) {
  if (pedido?.horarioPedido) return pedido.horarioPedido
  const valor = pedido?.criadoEm || pedido?.createdAt
  if (!valor) return '--:--'
  try {
    const date = valor?.toDate ? valor.toDate() : new Date(valor)
    if (Number.isNaN(date.getTime())) return '--:--'
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return '--:--'
  }
}

function formatarDataHora(valor) {
  if (!valor) return 'Não informado'
  try {
    const date = valor?.toDate ? valor.toDate() : new Date(valor)
    if (Number.isNaN(date.getTime())) return 'Não informado'
    return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return 'Não informado'
  }
}

function contarItens(pedidos) {
  const mapa = {}
  pedidos.forEach(pedido => {
    pedido.itens?.forEach(item => {
      const nome = item.nome || item.produtoNome || 'Produto'
      mapa[nome] = (mapa[nome] || 0) + Number(item.quantidade || 1)
    })
  })
  return Object.entries(mapa).sort((a, b) => b[1] - a[1])
}

function diasProduto(produto) {
  const dias = produto.diasProducao || produto.dias || produto.cardapioSemanal
  if (Array.isArray(dias)) return dias
  if (typeof dias === 'string') return dias.split(',').map(d => d.trim()).filter(Boolean)
  return []
}

function filtrarPedidos(pedidos, filtro, busca = '') {
  const termo = busca.trim().toLowerCase()
  const porBusca = pedidos.filter(p => !termo
    || alunoNome(p).toLowerCase().includes(termo)
    || pedidoCodigo(p).toLowerCase().includes(termo)
    || String(p.matricula || '').toLowerCase().includes(termo))
  const base = porBusca
  if (filtro === 'pendentes') return base.filter(p => ['recebido', 'pendente'].includes(normalizeStatus(p.status)))
  if (filtro === 'preparo') return base.filter(p => ['em preparo', 'preparando'].includes(normalizeStatus(p.status)))
  if (filtro === 'prontos') return base.filter(p => normalizeStatus(p.status) === 'pronto')
  if (filtro === 'entregues') return base.filter(p => normalizeStatus(p.status) === 'entregue')
  if (filtro === 'cancelados') return base.filter(p => normalizeStatus(p.status) === 'cancelado')
  return base
}

function EmptyState({ children }) {
  return <div style={s.vazio}>{children}</div>
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div style={{ ...s.statCard, borderTop: `4px solid ${color}` }}>
      <div style={s.statIcon}><Icon size={18} color={color} /></div>
      <span style={s.statLabel}>{label}</span>
      <strong style={{ ...s.statValue, color }}>{value}</strong>
    </div>
  )
}

function StatusBadge({ status }) {
  const visual = statusVisual(status)
  return <span style={{ ...s.badge, background: visual.bg, color: visual.color }}>{visual.label}</span>
}

export default function Cozinha() {
  const { pedidos, produtos, atualizarProduto, atualizarStatusPedido, cancelarPedido, criarAviso, avisos, producaoHoje, salvarProducao, atualizarProducao, removerProducao, registrarDesperdicio } = useApp()
  const location = useLocation()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const aba = abaPorRota(location.pathname)
  const [filtro, setFiltro] = useState('todos')
  const [busca, setBusca] = useState('')
  const [detalhe, setDetalhe] = useState(null)
  const [formProducao, setFormProducao] = useState(FORM_PRODUCAO)
  const [loteProducao, setLoteProducao] = useState([])
  const [producaoEditando, setProducaoEditando] = useState(null)
  const [buscaProducao, setBuscaProducao] = useState('')
  const [filtroProducao, setFiltroProducao] = useState('todos')
  const [desperdicioItem, setDesperdicioItem] = useState(null)
  const [formDesperdicio, setFormDesperdicio] = useState(FORM_DESPERDICIO)

  function selecionarAba(id) {
    navigate(ROTAS_ABA[id] || '/cozinha')
  }

  const hoje = inicioDoDia()
  const pedidosPreparo = useMemo(() => pedidos
    .filter(p => ['recebido', 'pendente', 'em preparo', 'preparando', 'pronto', 'entregue', 'cancelado'].includes(normalizeStatus(p.status)))
    .sort((a, b) => (a.criadoEm || 0) - (b.criadoEm || 0))
  , [pedidos])
  const pedidosHoje = useMemo(() => pedidos.filter(p => (p.criadoEm || 0) >= hoje), [pedidos, hoje])
  const pedidosFiltrados = useMemo(() => filtrarPedidos(pedidosPreparo, filtro, busca), [pedidosPreparo, filtro, busca])
  const pedidosAtivos = useMemo(() => pedidosPreparo.filter(p => !['entregue', 'cancelado'].includes(normalizeStatus(p.status))), [pedidosPreparo])
  const resumoProducao = useMemo(() => contarItens(pedidosAtivos.filter(p => ['recebido', 'pendente', 'em preparo', 'preparando'].includes(normalizeStatus(p.status)))), [pedidosAtivos])
  const cardapioHoje = useMemo(() => produtos.filter(p => p.disponivel !== false && Number(p.estoque || 0) > 0), [produtos])
  const producaoOrdenada = useMemo(() => [...(producaoHoje || [])].sort((a, b) => (b.atualizadoEm || b.criadoEm || 0) - (a.atualizadoEm || a.criadoEm || 0)), [producaoHoje])
  const producaoFiltrada = useMemo(() => {
    const termo = buscaProducao.trim().toLowerCase()
    return producaoOrdenada.filter(item => {
      const statusOk = filtroProducao === 'todos' || normalizeStatus(item.status) === normalizeStatus(filtroProducao)
      const buscaOk = !termo || String(item.produtoNome || '').toLowerCase().includes(termo)
      return statusOk && buscaOk
    })
  }, [producaoOrdenada, buscaProducao, filtroProducao])
  const totalProduzidoHoje = producaoOrdenada.reduce((acc, item) => acc + Number(item.quantidadePronta || 0), 0)
  const produtosPlanejados = producaoOrdenada.filter(item => normalizeStatus(item.status) !== 'cancelado').length
  const produtosEmProducao = producaoOrdenada.filter(item => normalizeStatus(item.status) === 'em producao').length
  const produtosProntos = producaoOrdenada.filter(item => normalizeStatus(item.status) === 'pronto para venda' || normalizeStatus(item.status) === 'parcialmente pronto').length
  const produtosEsgotados = producaoOrdenada.filter(item => normalizeStatus(item.status) === 'esgotado').length
  const totalDisponivelHoje = producaoOrdenada.reduce((acc, item) => acc + Number(item.quantidadeRestante || 0), 0)
  const totalDesperdicadoHoje = producaoOrdenada.reduce((acc, item) => acc + Number(item.quantidadeDesperdicada || 0), 0)
  const totalVendidoHoje = producaoOrdenada.reduce((acc, item) => acc + Number(item.quantidadeVendida || 0), 0)
  const houveRegistroVendas = producaoOrdenada.some(item => Number(item.quantidadeVendida || 0) > 0)
  const avisosCozinha = useMemo(() => (avisos || [])
    .filter(a => ['cozinha', 'todos'].includes(a.destino || a.destinatario))
    .sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0))
    .slice(0, 3), [avisos])

  const pendentes = pedidosPreparo.filter(p => ['recebido', 'pendente'].includes(normalizeStatus(p.status))).length
  const emPreparo = pedidosPreparo.filter(p => ['em preparo', 'preparando'].includes(normalizeStatus(p.status))).length
  const prontos = pedidosPreparo.filter(p => normalizeStatus(p.status) === 'pronto').length
  const tempoMedio = emPreparo > 0 ? '15 min' : '--'

  async function avancarStatus(pedido) {
    const proximo = FLUXO[pedido.status]
    if (!proximo) return
    await atualizarStatusPedido(pedido.id, proximo)
  }

  async function cancelar(pedido) {
    if (!confirm(`Cancelar pedido #${pedidoCodigo(pedido)}?`)) return
    await cancelarPedido(pedido.id, 'Cancelado pela cozinha')
  }

  function montarPayloadProducao(dados, itemEditando = null) {
    const produto = produtos.find(p => String(p.id) === String(dados.produtoId))
    if (!produto) return null
    return {
      ...dados,
      id: itemEditando?.id,
      produtoId: produto.id,
      produtoNome: produto.nome,
      produtoCategoria: produto.categoria || '',
      produtoFoto: produto.foto || '',
      criadoPor: itemEditando?.criadoPor,
      criadoEm: itemEditando?.criadoEm,
      historico: itemEditando?.historico || [],
    }
  }

  async function sincronizarEstoqueProducao(salvo) {
    const produto = produtos.find(p => String(p.id) === String(salvo.produtoId))
    if (!produto) return
    if (['Pronto para venda', 'Parcialmente pronto'].includes(salvo.status)) {
      await atualizarProduto({ ...produto, estoque: salvo.quantidadeRestante, disponivel: true })
    }
    if (salvo.status === 'Esgotado' || salvo.status === 'Cancelado') {
      await atualizarProduto({ ...produto, estoque: 0, disponivel: salvo.status !== 'Esgotado' ? produto.disponivel : false })
    }
  }

  function adicionarItemLote(e) {
    e.preventDefault()
    const produto = produtos.find(p => String(p.id) === String(formProducao.produtoId))
    if (!produto) return
    const jaNaLista = loteProducao.some(item => String(item.produtoId) === String(produto.id))
    const jaPlanejadoHoje = !producaoEditando && producaoOrdenada.some(item => String(item.produtoId) === String(produto.id) && normalizeStatus(item.status) !== 'cancelado')
    if (jaNaLista || jaPlanejadoHoje) {
      alert('Esse produto ja esta na lista de producao de hoje.')
      return
    }
    setLoteProducao(prev => [...prev, {
      ...formProducao,
      produtoId: produto.id,
      produtoNome: produto.nome,
      produtoCategoria: produto.categoria || '',
      produtoFoto: produto.foto || '',
    }])
    setFormProducao(prev => ({
      ...FORM_PRODUCAO,
      horarioPrevisto: prev.horarioPrevisto,
      status: prev.status,
      visivelParaVendedor: prev.visivelParaVendedor,
      visivelParaAdmin: prev.visivelParaAdmin,
    }))
  }

  function atualizarItemLote(index, campo, valor) {
    setLoteProducao(prev => prev.map((item, i) => i === index ? { ...item, [campo]: valor } : item))
  }

  function removerItemLote(index) {
    setLoteProducao(prev => prev.filter((_, i) => i !== index))
  }

  async function salvarPlanejamento(e) {
    e.preventDefault()
    const payload = montarPayloadProducao(formProducao, producaoEditando)
    if (!payload) return
    const salvo = await salvarProducao(payload)
    await sincronizarEstoqueProducao(salvo)
    setFormProducao(FORM_PRODUCAO)
    setProducaoEditando(null)
  }

  async function salvarLoteProducao() {
    if (loteProducao.length === 0) return
    for (const item of loteProducao) {
      const payload = montarPayloadProducao(item)
      if (payload) {
        const salvo = await salvarProducao(payload)
        await sincronizarEstoqueProducao(salvo)
      }
    }
    setLoteProducao([])
  }

  function editarPlanejamento(item) {
    setProducaoEditando(item)
    setLoteProducao([])
    setFormProducao({
      produtoId: item.produtoId || '',
      quantidadePlanejada: String(item.quantidadePlanejada || ''),
      quantidadeEmProducao: String(item.quantidadeEmProducao || ''),
      quantidadePronta: String(item.quantidadePronta || ''),
      quantidadeVendida: String(item.quantidadeVendida || ''),
      horarioPrevisto: item.horarioPrevisto || '',
      status: item.status || 'Planejado',
      observacao: item.observacao || '',
      visivelParaVendedor: item.visivelParaVendedor !== false,
      visivelParaAdmin: item.visivelParaAdmin !== false,
    })
  }

  async function mudarStatusProducao(item, status) {
    const produto = produtos.find(p => String(p.id) === String(item.produtoId))
    const dados = { status }
    if (status === 'Em producao') dados.quantidadeEmProducao = item.quantidadeEmProducao || item.quantidadePlanejada || 0
    if (status === 'Pronto para venda') dados.quantidadePronta = item.quantidadePronta || item.quantidadePlanejada || item.quantidadeEmProducao || 0
    if (status === 'Esgotado') dados.quantidadePronta = 0
    const atualizado = await atualizarProducao(item.id, item, dados, { acao: `Marcou como ${status}` })
    if (produto && ['Pronto para venda', 'Parcialmente pronto'].includes(status)) {
      await atualizarProduto({ ...produto, estoque: atualizado.quantidadeRestante, disponivel: true })
    }
    if (produto && status === 'Esgotado') {
      await atualizarProduto({ ...produto, estoque: 0, disponivel: false })
    }
  }

  async function cancelarProducao(item) {
    if (!confirm(`Cancelar producao de ${item.produtoNome}?`)) return
    await removerProducao(item.id, item)
  }

  function abrirDesperdicio(item) {
    setDesperdicioItem(item)
    setFormDesperdicio(FORM_DESPERDICIO)
  }

  async function confirmarDesperdicio(e) {
    e.preventDefault()
    const quantidade = Number(formDesperdicio.quantidade)
    if (!desperdicioItem || !quantidade || quantidade <= 0) {
      alert('Informe uma quantidade valida para registrar o desperdicio.')
      return
    }
    if (quantidade > Number(desperdicioItem.quantidadeRestante || 0)) {
      alert('A quantidade informada e maior que o disponivel para este produto.')
      return
    }
    const resultado = await registrarDesperdicio(desperdicioItem.id, desperdicioItem, {
      quantidade,
      motivo: formDesperdicio.motivo,
      observacao: formDesperdicio.observacao,
    })
    const produto = produtos.find(p => String(p.id) === String(desperdicioItem.produtoId))
    if (produto) {
      await atualizarProduto({ ...produto, estoque: resultado.quantidadeRestante })
    }
    setDesperdicioItem(null)
    setFormDesperdicio(FORM_DESPERDICIO)
  }

  async function avisarVendedor(item) {
    await criarAviso({
      titulo: `Producao: ${item.produtoNome}`,
      mensagem: `${item.produtoNome} - ${item.status}. Disponível: ${item.quantidadeRestante || 0}. ${item.horarioPrevisto ? `Previsão: ${item.horarioPrevisto}.` : ''} ${item.observacao || ''}`.trim(),
      destino: 'vendedor',
      tipo: normalizeStatus(item.status) === 'esgotado' ? 'aviso' : 'info',
    })
  }

  function PedidoCard({ pedido }) {
    const itens = Array.isArray(pedido.itens) ? pedido.itens : []
    return (
      <article style={s.pedidoCard}>
        <div style={s.pedidoTop}>
          <div>
            <strong style={s.codigo}>Pedido #{pedidoCodigo(pedido)}</strong>
            <p style={s.meta}>{alunoNome(pedido)} {pedido.matricula ? `- ${pedido.matricula}` : ''}</p>
          </div>
          <StatusBadge status={pedido.status} />
        </div>
        <div style={s.pedidoInfoGrid}>
          <span><Clock size={14} /> Pedido {pedidoHora(pedido)}</span>
          <span><Timer size={14} /> Retirada {pedido.horarioRetirada || '--:--'}</span>
        </div>
        <div style={s.itens}>
          {itens.length === 0 ? <span style={s.meta}>Itens não informados.</span> : itens.map((item, i) => (
            <span key={`${pedido.id}-${i}`} style={s.item}>{item.quantidade || 1}x {item.nome || item.produtoNome || 'Produto'}</span>
          ))}
        </div>
        {pedido.observacao && <p style={s.obs}>Obs: {pedido.observacao}</p>}
        <div style={{ ...s.acoes, flexDirection: isMobile ? 'column' : 'row' }}>
          {FLUXO[pedido.status] && (
            <button style={{ ...s.btnPrimario, width: isMobile ? '100%' : 'auto' }} onClick={() => avancarStatus(pedido)}>
              <CheckCircle2 size={15} /> {pedido.status === 'Recebido' ? 'Iniciar preparo' : pedido.status === 'Em preparo' ? 'Marcar pronto' : 'Entregar'}
            </button>
          )}
          <button style={{ ...s.btnSecundario, width: isMobile ? '100%' : 'auto' }} onClick={() => setDetalhe(pedido)}>
            <Eye size={15} /> Ver detalhes
          </button>
          {normalizeStatus(pedido.status) !== 'entregue' && (
            <button style={{ ...s.btnPerigo, width: isMobile ? '100%' : 'auto' }} onClick={() => cancelar(pedido)}>Cancelar</button>
          )}
        </div>
      </article>
    )
  }

  return (
    <Layout titulo="Painel da Cozinha">
      <div style={{ ...s.page, paddingBottom: isMobile ? 128 : 32 }}>
        {(aba === 'dashboard' || aba === 'pedidos') && (
          <div style={{ ...s.statsGrid, gridTemplateColumns: isMobile ? '1fr' : 'repeat(5, minmax(0, 1fr))' }}>
            <StatCard icon={ClipboardList} label="Pendentes" value={pendentes} color="#F59E0B" />
            <StatCard icon={Flame} label="Em preparo" value={emPreparo} color="#1D4ED8" />
            <StatCard icon={PackageCheck} label="Prontos" value={prontos} color="#22C55E" />
            <StatCard icon={Timer} label="Tempo medio" value={tempoMedio} color="#A855F7" />
            <StatCard icon={Utensils} label="Pedidos hoje" value={pedidosHoje.length} color="#003D7C" />
          </div>
        )}

        {aba === 'dashboard' && (
          <>
            <section style={s.sectionCard}>
              <div style={s.sectionHeader}>
                <h3 style={s.sectionTitle}>Resumo de hoje</h3>
                <button style={s.linkBtn} onClick={() => selecionarAba('producao')}>Ver producao</button>
              </div>
              <div style={{ ...s.statsGrid, gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(6, minmax(0, 1fr))' }}>
                <StatCard icon={Utensils} label="Total produzido" value={`${totalProduzidoHoje} un`} color="#7C3AED" />
                <StatCard icon={PackageCheck} label="Disponivel" value={`${totalDisponivelHoje} un`} color="#22C55E" />
                <StatCard icon={Trash2} label="Desperdicado" value={`${totalDesperdicadoHoje} un`} color="#EF4444" />
                <StatCard icon={XCircle} label="Esgotados" value={produtosEsgotados} color="#B91C1C" />
                <StatCard icon={Flame} label="Em producao" value={produtosEmProducao} color="#F59E0B" />
                <StatCard icon={CheckCircle2} label="Total vendido" value={houveRegistroVendas ? `${totalVendidoHoje} un` : 'Nao informado'} color="#0EA5E9" />
              </div>
              {avisosCozinha.length > 0 && (
                <div style={s.loteBox}>
                  <strong style={{ color: '#0F172A' }}>Ultimos avisos</strong>
                  {avisosCozinha.map(aviso => (
                    <div key={aviso.id} style={s.linhaResumo}>
                      <span>{aviso.titulo}</span>
                      <span style={s.meta}>{formatarHoraAtualizacao(aviso.criadoEm)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <div style={{ ...s.contentGrid, gridTemplateColumns: isMobile ? '1fr' : '1.4fr 1fr' }}>
              <section style={s.sectionCard}>
                <div style={s.sectionHeader}>
                  <h3 style={s.sectionTitle}>Fila de preparo</h3>
                  <button style={s.linkBtn} onClick={() => selecionarAba('pedidos')}>Ver pedidos</button>
                </div>
                {pedidosAtivos.length === 0 ? <EmptyState>Nenhum pedido aguardando preparo.</EmptyState> : pedidosAtivos.slice(0, 4).map(pedido => <PedidoCard key={pedido.id} pedido={pedido} />)}
              </section>

              <section style={s.sectionCard}>
                <h3 style={s.sectionTitle}>O que produzir agora</h3>
                {resumoProducao.length === 0 ? <EmptyState>Sem itens aguardando preparo.</EmptyState> : resumoProducao.map(([nome, qtd]) => (
                  <div key={nome} style={s.linhaResumo}><span>{nome}</span><strong>{qtd} un</strong></div>
                ))}
              </section>
            </div>
          </>
        )}

        {aba === 'pedidos' && (
          <section style={s.sectionCard}>
            <div style={s.sectionHeader}>
              <h3 style={s.sectionTitle}>Pedidos da cozinha</h3>
              <div style={s.searchBox}>
                <Search size={16} color="#64748B" />
                <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar pedido ou aluno" style={s.searchInput} />
              </div>
              <div style={s.filtros}>
                {FILTROS.map(([id, label]) => (
                  <button key={id} style={{ ...s.filtroBtn, ...(filtro === id ? s.filtroBtnAtivo : {}) }} onClick={() => setFiltro(id)}>{label}</button>
                ))}
              </div>
            </div>
            <div style={s.lista}>
              {pedidosFiltrados.length === 0 ? <EmptyState>Nenhum pedido aguardando preparo.</EmptyState> : pedidosFiltrados.map(pedido => <PedidoCard key={pedido.id} pedido={pedido} />)}
            </div>
          </section>
        )}

        {aba === 'producao' && (
          <div style={s.producaoPage}>
            <div style={{ ...s.statsGrid, gridTemplateColumns: isMobile ? '1fr' : 'repeat(6, minmax(0, 1fr))' }}>
              <StatCard icon={ClipboardList} label="Planejados hoje" value={produtosPlanejados} color="#003D7C" />
              <StatCard icon={Flame} label="Em producao" value={produtosEmProducao} color="#F59E0B" />
              <StatCard icon={PackageCheck} label="Prontos venda" value={produtosProntos} color="#22C55E" />
              <StatCard icon={XCircle} label="Esgotados" value={produtosEsgotados} color="#EF4444" />
              <StatCard icon={Utensils} label="Total produzido" value={`${totalProduzidoHoje} un`} color="#7C3AED" />
              <StatCard icon={Timer} label="Pedidos aguardando" value={pedidosAtivos.length} color="#0EA5E9" />
            </div>

            <div style={{ ...s.contentGrid, gridTemplateColumns: '1fr' }}>
              <form onSubmit={producaoEditando ? salvarPlanejamento : adicionarItemLote} style={s.sectionCard}>
                <div style={s.sectionHeader}>
                  <div>
                    <h3 style={s.sectionTitle}>{producaoEditando ? 'Editar producao' : 'Cadastro rapido da producao do dia'}</h3>
                    <p style={s.meta}>{producaoEditando ? 'Atualize apenas este item.' : 'Adicione vários produtos na lista e salve tudo de uma vez.'}</p>
                  </div>
                  {producaoEditando && <button type="button" style={s.linkBtn} onClick={() => { setFormProducao(FORM_PRODUCAO); setProducaoEditando(null) }}>Novo lote</button>}
                </div>
                <div style={{ ...s.formGridRapido, gridTemplateColumns: isMobile ? '1fr' : 'minmax(220px, 1.5fr) repeat(3, minmax(120px, 0.7fr)) minmax(150px, 1fr)' }}>
                  <select value={formProducao.produtoId} onChange={e => setFormProducao({ ...formProducao, produtoId: e.target.value })} style={s.input} required>
                    <option value="">Selecionar produto</option>
                    {produtos.map(produto => <option key={produto.id} value={produto.id}>{produto.nome}</option>)}
                  </select>
                  <input type="number" min="0" value={formProducao.quantidadePlanejada} onChange={e => setFormProducao({ ...formProducao, quantidadePlanejada: e.target.value })} placeholder="Planejada" style={s.input} />
                  <input type="number" min="0" value={formProducao.quantidadeEmProducao} onChange={e => setFormProducao({ ...formProducao, quantidadeEmProducao: e.target.value })} placeholder="Em producao" style={s.input} />
                  <input type="number" min="0" value={formProducao.quantidadePronta} onChange={e => setFormProducao({ ...formProducao, quantidadePronta: e.target.value })} placeholder="Pronta" style={s.input} />
                  <input type="time" value={formProducao.horarioPrevisto} onChange={e => setFormProducao({ ...formProducao, horarioPrevisto: e.target.value })} style={s.input} />
                </div>
                <div style={{ ...s.formGrid2, gridTemplateColumns: isMobile ? '1fr' : 'minmax(180px, 0.45fr) 1fr' }}>
                  <select value={formProducao.status} onChange={e => setFormProducao({ ...formProducao, status: e.target.value })} style={s.input}>
                    {STATUS_PRODUCAO.map(status => <option key={status} value={status}>{status}</option>)}
                  </select>
                  <input value={formProducao.observacao} onChange={e => setFormProducao({ ...formProducao, observacao: e.target.value })} placeholder="Observacao rapida" style={s.input} />
                </div>
                <div style={s.checkRow}>
                  <label style={s.checkLabel}><input type="checkbox" checked={formProducao.visivelParaVendedor} onChange={e => setFormProducao({ ...formProducao, visivelParaVendedor: e.target.checked })} /> Aparecer para vendedor</label>
                  <label style={s.checkLabel}><input type="checkbox" checked={formProducao.visivelParaAdmin} onChange={e => setFormProducao({ ...formProducao, visivelParaAdmin: e.target.checked })} /> Aparecer para admin</label>
                </div>
                <div style={s.acoes}>
                  <button type="submit" style={s.btnPrimario}><PlusCircle size={15} /> {producaoEditando ? 'Atualizar producao' : 'Adicionar na lista'}</button>
                  {!producaoEditando && (
                    <button type="button" style={{ ...s.btnSecundario, opacity: loteProducao.length === 0 ? 0.55 : 1 }} disabled={loteProducao.length === 0} onClick={salvarLoteProducao}>
                      <Save size={15} /> Salvar {loteProducao.length || ''} item(ns)
                    </button>
                  )}
                  {producaoEditando && (
                    <>
                      <button type="button" style={s.btnSecundario} onClick={() => mudarStatusProducao(producaoEditando, 'Pronto para venda')}><CheckCircle2 size={15} /> Marcar pronto</button>
                      <button type="button" style={s.btnPerigo} onClick={() => mudarStatusProducao(producaoEditando, 'Esgotado')}>Esgotado</button>
                    </>
                  )}
                </div>

                {!producaoEditando && (
                  <div style={s.loteBox}>
                    <div style={s.loteHeader}>
                      <strong>Lista para salvar</strong>
                      <span style={s.meta}>{loteProducao.length} produto(s) no lote</span>
                    </div>
                    {loteProducao.length === 0 ? (
                      <div style={s.vazioCompacto}>Adicione os produtos que vao ser produzidos hoje.</div>
                    ) : (
                      <div style={s.loteLista}>
                        {loteProducao.map((item, index) => (
                          <div key={`${item.produtoId}-${index}`} style={{ ...s.loteItem, gridTemplateColumns: isMobile ? '1fr' : 'minmax(180px, 1.5fr) repeat(3, minmax(86px, 0.55fr)) minmax(130px, 0.8fr) 44px' }}>
                            <div style={s.produtoMini}>
                              {item.produtoFoto && <img src={item.produtoFoto} alt={item.produtoNome} style={s.produtoMiniImg} />}
                              <div>
                                <strong style={s.codigo}>{item.produtoNome}</strong>
                                <p style={s.meta}>{item.produtoCategoria || 'Produto'}</p>
                              </div>
                            </div>
                            <input type="number" min="0" value={item.quantidadePlanejada} onChange={e => atualizarItemLote(index, 'quantidadePlanejada', e.target.value)} placeholder="Plan." style={s.inputMini} />
                            <input type="number" min="0" value={item.quantidadeEmProducao} onChange={e => atualizarItemLote(index, 'quantidadeEmProducao', e.target.value)} placeholder="Prod." style={s.inputMini} />
                            <input type="number" min="0" value={item.quantidadePronta} onChange={e => atualizarItemLote(index, 'quantidadePronta', e.target.value)} placeholder="Pronta" style={s.inputMini} />
                            <select value={item.status} onChange={e => atualizarItemLote(index, 'status', e.target.value)} style={s.inputMini}>
                              {STATUS_PRODUCAO.map(status => <option key={status} value={status}>{status}</option>)}
                            </select>
                            <button type="button" title="Remover" style={s.iconBtnPerigo} onClick={() => removerItemLote(index)}><Trash2 size={17} /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </form>

              <section style={s.sectionCard}>
                <div style={s.sectionHeader}>
                  <h3 style={s.sectionTitle}>Lista de producao do dia</h3>
                  <div style={s.searchBox}>
                    <Search size={16} color="#64748B" />
                    <input value={buscaProducao} onChange={e => setBuscaProducao(e.target.value)} placeholder="Pesquisar produto" style={s.searchInput} />
                  </div>
                </div>
                <div style={s.filtros}>
                  {['todos', ...STATUS_PRODUCAO].map(status => (
                    <button key={status} style={{ ...s.filtroBtn, ...(filtroProducao === status ? s.filtroBtnAtivo : {}) }} onClick={() => setFiltroProducao(status)}>
                      {status === 'todos' ? 'Todos' : status}
                    </button>
                  ))}
                </div>
                <div style={s.lista}>
                  {producaoFiltrada.length === 0 ? <EmptyState>Nenhuma producao planejada hoje.</EmptyState> : producaoFiltrada.map(item => {
                    const visual = producaoStatusVisual(item.status)
                    return (
                      <article key={item.id} style={{ ...s.producaoCard, borderLeftColor: visual.border }}>
                        <div style={s.pedidoTop}>
                          <div style={s.produtoMini}>
                            {item.produtoFoto && <img src={item.produtoFoto} alt={item.produtoNome} style={s.produtoMiniImg} />}
                            <div>
                              <strong style={s.codigo}>{item.produtoNome}</strong>
                              <p style={s.meta}>{item.produtoCategoria || 'Produto'} - Atualizado {tempoDesde(item.atualizadoEm)}</p>
                            </div>
                          </div>
                          <span style={{ ...s.badge, background: visual.bg, color: visual.color }}>{visual.label}</span>
                        </div>
                        <div style={s.producaoMetrics}>
                          <span>Planejado <strong>{item.quantidadePlanejada || 0}</strong></span>
                          <span>Em producao <strong>{item.quantidadeEmProducao || 0}</strong></span>
                          <span>Pronto <strong>{item.quantidadePronta || 0}</strong></span>
                          <span>Restante <strong>{item.quantidadeRestante || 0}</strong></span>
                          <span>Desperdicado <strong>{item.quantidadeDesperdicada || 0}</strong></span>
                          <span>Previsão <strong>{item.horarioPrevisto || '--:--'}</strong></span>
                        </div>
                        {item.observacao && <p style={s.obs}>{item.observacao}</p>}
                        <p style={s.meta}>última atualização: {formatarHoraAtualizacao(item.atualizadoEm)} por {item.atualizadoPor?.nome || item.criadoPor?.nome || 'Cozinha'}</p>
                        <div style={s.acoes}>
                          <button style={s.btnSecundario} onClick={() => editarPlanejamento(item)}><Edit3 size={15} /> Editar</button>
                          <button style={s.btnSecundario} onClick={() => mudarStatusProducao(item, 'Em producao')}>Em producao</button>
                          <button style={s.btnPrimario} onClick={() => mudarStatusProducao(item, 'Pronto para venda')}><CheckCircle2 size={15} /> Pronto</button>
                          <button style={s.btnPerigo} onClick={() => mudarStatusProducao(item, 'Esgotado')}>Esgotado</button>
                          <button style={s.btnSecundario} onClick={() => avisarVendedor(item)}><Send size={15} /> Avisar vendedor</button>
                          <button style={s.btnPerigo} onClick={() => abrirDesperdicio(item)} disabled={Number(item.quantidadeRestante || 0) <= 0}><Trash2 size={15} /> Registrar desperdicio</button>
                          <button style={s.btnPerigo} onClick={() => cancelarProducao(item)}>Cancelar</button>
                        </div>
                        {Array.isArray(item.historicoDesperdicio) && item.historicoDesperdicio.length > 0 && (
                          <details style={s.historicoBox}>
                            <summary>Historico de desperdicio</summary>
                            {item.historicoDesperdicio.slice(-5).reverse().map(h => (
                              <p key={h.id} style={s.meta}>{formatarDataHora(h.dataHora)} - {h.quantidade} un ({h.motivo}) por {h.responsavel?.nome || 'Usuario'}{h.observacao ? ` - ${h.observacao}` : ''}</p>
                            ))}
                          </details>
                        )}
                        {Array.isArray(item.historico) && item.historico.length > 0 && (
                          <details style={s.historicoBox}>
                            <summary>Historico de alteracoes</summary>
                            {item.historico.slice(-5).reverse().map(h => (
                              <p key={h.id} style={s.meta}>{formatarDataHora(h.data)} - {h.acao} por {h.usuario?.nome || 'Usuario'}</p>
                            ))}
                          </details>
                        )}
                      </article>
                    )
                  })}
                </div>
              </section>
            </div>
          </div>
        )}

        {aba === 'cardapio' && (
          <section style={s.sectionCard}>
            <div style={s.sectionHeader}>
              <h3 style={s.sectionTitle}>Cardápio disponivel</h3>
              <span style={s.meta}>{cardapioHoje.length} produto(s)</span>
            </div>
            <div style={s.produtosGrid}>
              {cardapioHoje.length === 0 ? <EmptyState>Nenhum produto disponivel no momento.</EmptyState> : cardapioHoje.map(produto => (
                <article key={produto.id} style={s.produtoCard}>
                  {produto.foto && <img src={produto.foto} alt={produto.nome} style={s.fotoProduto} />}
                  <strong>{produto.nome}</strong>
                  <span style={s.meta}>{produto.categoria || 'Cardápio'} - {formatPrice(produto.preco || 0)}</span>
                  <span style={s.meta}>Estoque: {produto.estoque || 0}</span>
                  <span style={s.meta}>Dias: {diasProduto(produto).join(', ') || 'Não definido'}</span>
                  {Number(produto.estoque || 0) <= Number(produto.estoqueBaixo || 0) && (
                    <span style={s.alerta}><AlertTriangle size={14} /> Estoque baixo</span>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}

        {aba === 'avisos' && (
          <section style={s.sectionCard}>
            <div style={s.sectionHeader}>
              <h3 style={s.sectionTitle}><Megaphone size={18} /> Avisos da cozinha</h3>
            </div>
            <AvisosSetor setor="cozinha" />
          </section>
        )}
      </div>

      {desperdicioItem && (
        <div style={s.modalOverlay} role="dialog" aria-modal="true">
          <div style={{ ...s.modal, maxWidth: 480, padding: isMobile ? 18 : 24 }}>
            <div style={s.modalHeader}>
              <div>
                <h3 style={s.modalTitle}>Registrar desperdicio</h3>
                <p style={s.meta}>{desperdicioItem.produtoNome} - Disponivel: {desperdicioItem.quantidadeRestante || 0} un</p>
              </div>
              <button style={s.closeBtn} onClick={() => setDesperdicioItem(null)}>Fechar</button>
            </div>
            <form onSubmit={confirmarDesperdicio} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input
                type="number" min="1" max={desperdicioItem.quantidadeRestante || 0}
                value={formDesperdicio.quantidade}
                onChange={e => setFormDesperdicio({ ...formDesperdicio, quantidade: e.target.value })}
                placeholder="Quantidade desperdicada" style={s.input} required
              />
              <select value={formDesperdicio.motivo} onChange={e => setFormDesperdicio({ ...formDesperdicio, motivo: e.target.value })} style={s.input}>
                {MOTIVOS_DESPERDICIO.map(motivo => <option key={motivo} value={motivo}>{motivo}</option>)}
              </select>
              <input
                value={formDesperdicio.observacao}
                onChange={e => setFormDesperdicio({ ...formDesperdicio, observacao: e.target.value })}
                placeholder="Observacao (opcional)" style={s.input}
              />
              <div style={s.acoes}>
                <button type="submit" style={s.btnPrimario}><Trash2 size={15} /> Confirmar desperdicio</button>
                <button type="button" style={s.btnSecundario} onClick={() => setDesperdicioItem(null)}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detalhe && (
        <div style={s.modalOverlay} role="dialog" aria-modal="true">
          <div style={{ ...s.modal, padding: isMobile ? 18 : 24 }}>
            <div style={s.modalHeader}>
              <div>
                <h3 style={s.modalTitle}>Pedido #{pedidoCodigo(detalhe)}</h3>
                <p style={s.meta}>{alunoNome(detalhe)} {detalhe.matricula ? `- ${detalhe.matricula}` : ''}</p>
              </div>
              <button style={s.closeBtn} onClick={() => setDetalhe(null)}>Fechar</button>
            </div>
            <div style={s.detailGrid}>
              <p><strong>Status:</strong> <StatusBadge status={detalhe.status} /></p>
              <p><strong>Horario:</strong> {formatarDataHora(detalhe.criadoEm || detalhe.createdAt)}</p>
              <p><strong>Retirada:</strong> {detalhe.horarioRetirada || '--:--'}</p>
              <p><strong>Total:</strong> {formatPrice(detalhe.total || 0)}</p>
            </div>
            <h4 style={s.detailTitle}>Itens</h4>
            <div style={s.lista}>
              {(detalhe.itens || []).map((item, index) => (
                <div key={`${item.nome || 'item'}-${index}`} style={s.linhaResumo}>
                  <span>{item.quantidade || 1}x {item.nome || item.produtoNome || 'Produto'}</span>
                  <strong>{formatPrice(item.preco || item.valor || 0)}</strong>
                </div>
              ))}
            </div>
            <h4 style={s.detailTitle}>Observacoes</h4>
            <p style={s.obs}>{detalhe.observacao || detalhe.observacoes || 'Nenhuma observacao informada.'}</p>
          </div>
        </div>
      )}
    </Layout>
  )
}

const s = {
  page: { display: 'flex', flexDirection: 'column', gap: 16 },
  producaoPage: { display: 'flex', flexDirection: 'column', gap: 16 },
  abas: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  abasMobile: { overflowX: 'auto', flexWrap: 'nowrap', paddingBottom: 8, marginLeft: -4, marginRight: -4 },
  aba: { padding: '0.55rem 0.9rem', borderRadius: 20, border: '1.5px solid #CBD5E1', background: '#fff', color: '#64748B', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' },
  abaAtiva: { background: '#003D7C', borderColor: '#003D7C', color: '#fff' },
  statsGrid: { display: 'grid', gap: 12 },
  statCard: { background: '#fff', borderRadius: 14, padding: 16, boxShadow: '0 8px 24px rgba(15,23,42,0.06)', display: 'flex', flexDirection: 'column', gap: 6 },
  statIcon: { width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  statLabel: { color: '#64748B', fontSize: '0.8rem', fontWeight: 700 },
  statValue: { fontSize: '1.45rem', fontWeight: 900 },
  contentGrid: { display: 'grid', gap: 16, alignItems: 'start' },
  formGrid2: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 },
  formGridRapido: { display: 'grid', gap: 10, alignItems: 'center' },
  sectionCard: { background: '#fff', borderRadius: 18, padding: 20, boxShadow: '0 8px 24px rgba(15,23,42,0.06)', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 },
  sectionHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  sectionTitle: { margin: 0, fontWeight: 900, color: '#0F172A', fontSize: '1rem', display: 'inline-flex', alignItems: 'center', gap: 8 },
  lista: { display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 },
  pedidoCard: { border: '1px solid #E5E7EB', background: '#F8FAFC', borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 },
  producaoCard: { border: '1px solid #E5E7EB', borderLeft: '5px solid #CBD5E1', background: '#fff', borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 12, boxShadow: '0 6px 18px rgba(15,23,42,0.05)' },
  pedidoTop: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  pedidoInfoGrid: { display: 'flex', gap: 14, flexWrap: 'wrap', color: '#64748B', fontSize: '0.82rem', fontWeight: 700 },
  codigo: { color: '#0F172A', fontWeight: 900 },
  meta: { color: '#64748B', fontSize: '0.84rem', margin: 0, lineHeight: 1.45 },
  badge: { borderRadius: 999, padding: '0.25rem 0.7rem', fontSize: '0.74rem', fontWeight: 900, whiteSpace: 'nowrap' },
  filtros: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  filtroBtn: { border: '1px solid #E2E8F0', background: '#fff', color: '#64748B', borderRadius: 999, padding: '0.42rem 0.8rem', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' },
  filtroBtnAtivo: { background: '#003D7C', color: '#fff', borderColor: '#003D7C' },
  searchBox: { display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #CBD5E1', borderRadius: 12, padding: '0 0.75rem', minHeight: 44, background: '#fff', minWidth: 240 },
  searchInput: { border: 'none', outline: 'none', fontFamily: 'inherit', flex: 1, minWidth: 0, fontWeight: 700 },
  input: { border: '1px solid #CBD5E1', borderRadius: 12, padding: '0.72rem 0.8rem', fontFamily: 'inherit', outlineColor: '#003D7C', minHeight: 44 },
  inputMini: { border: '1px solid #CBD5E1', borderRadius: 10, padding: '0.55rem 0.65rem', fontFamily: 'inherit', outlineColor: '#003D7C', minHeight: 38, minWidth: 0, width: '100%', boxSizing: 'border-box' },
  checkRow: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  checkLabel: { display: 'inline-flex', alignItems: 'center', gap: 7, color: '#475569', fontWeight: 800, fontSize: '0.83rem' },
  itens: { display: 'flex', gap: 7, flexWrap: 'wrap' },
  item: { background: '#fff', color: '#475569', borderRadius: 20, padding: '0.3rem 0.7rem', fontSize: '0.8rem', fontWeight: 700, border: '1px solid #E2E8F0' },
  obs: { color: '#475569', background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 12, margin: 0, lineHeight: 1.45 },
  acoes: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  btnPrimario: { background: '#003D7C', color: '#fff', border: 'none', borderRadius: 12, padding: '0.68rem 0.95rem', fontWeight: 900, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, minHeight: 44, fontFamily: 'inherit' },
  btnSecundario: { background: '#E8F0FB', color: '#003D7C', border: 'none', borderRadius: 12, padding: '0.68rem 0.95rem', fontWeight: 900, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, minHeight: 44, fontFamily: 'inherit' },
  btnPerigo: { background: '#FEE2E2', color: '#DC2626', border: 'none', borderRadius: 12, padding: '0.68rem 0.95rem', fontWeight: 900, cursor: 'pointer', minHeight: 44, fontFamily: 'inherit' },
  iconBtnPerigo: { width: 40, height: 40, borderRadius: 12, border: 'none', background: '#FEE2E2', color: '#DC2626', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  linkBtn: { border: 'none', background: '#EFF6FF', color: '#1D4ED8', borderRadius: 10, padding: '0.5rem 0.75rem', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' },
  linhaResumo: { display: 'flex', justifyContent: 'space-between', gap: 10, borderBottom: '1px solid #E2E8F0', padding: '0.55rem 0', color: '#334155' },
  vendasBox: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC', border: '1px solid #E5E7EB', borderRadius: 14, padding: 14, color: '#64748B', fontWeight: 800 },
  produtosGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 12 },
  produtoCard: { display: 'flex', flexDirection: 'column', gap: 7, background: '#F8FAFC', border: '1px solid #E5E7EB', borderRadius: 14, padding: 14 },
  produtoMini: { display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 },
  produtoMiniImg: { width: 48, height: 48, borderRadius: 10, objectFit: 'cover', background: '#E2E8F0', flexShrink: 0 },
  loteBox: { background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 16, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 },
  loteHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', color: '#0F172A' },
  loteLista: { display: 'flex', flexDirection: 'column', gap: 8 },
  loteItem: { display: 'grid', gap: 8, alignItems: 'center', background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: 10 },
  vazioCompacto: { background: '#fff', border: '1px dashed #CBD5E1', borderRadius: 12, padding: '1rem', color: '#94A3B8', fontWeight: 800, textAlign: 'center' },
  producaoMetrics: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, color: '#475569', fontSize: '0.82rem' },
  historicoBox: { background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: '0.65rem 0.85rem', color: '#475569', fontWeight: 800 },
  fotoProduto: { width: '100%', height: 118, borderRadius: 12, objectFit: 'cover', background: '#E2E8F0' },
  alerta: { display: 'inline-flex', alignItems: 'center', gap: 5, background: '#FEF3C7', color: '#92400E', borderRadius: 20, padding: '0.28rem 0.68rem', fontSize: '0.75rem', fontWeight: 900 },
  vazio: { background: '#F8FAFC', borderRadius: 14, padding: '2rem', textAlign: 'center', color: '#94A3B8', border: '1px dashed #CBD5E1', fontWeight: 700 },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modal: { width: '100%', maxWidth: 820, maxHeight: '90vh', overflowY: 'auto', background: '#fff', borderRadius: 18, boxShadow: '0 24px 80px rgba(15,23,42,0.25)' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, marginBottom: 16 },
  modalTitle: { margin: 0, color: '#0F172A', fontSize: '1.2rem', fontWeight: 900 },
  closeBtn: { border: 'none', background: '#003D7C', color: '#fff', borderRadius: 10, minHeight: 40, padding: '0 0.9rem', fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit' },
  detailGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, color: '#475569', fontSize: '0.88rem' },
  detailTitle: { margin: '16px 0 8px', color: '#0F172A' },
}
