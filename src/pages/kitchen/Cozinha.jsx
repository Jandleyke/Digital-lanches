import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  ArchiveRestore, Calendar, CheckCircle2, ChevronLeft, ChevronRight, ClipboardList, CloudSun, Edit3, Flame,
  Megaphone, MoreVertical, Moon, PackageCheck, Plus, PlusCircle, RefreshCw as RefreshIcon, Save, Search, Send, Sun, Trash2, Utensils, X, XCircle,
} from 'lucide-react'
import Layout from '../../components/Layout'
import AvisosSetor from '../../components/AvisosSetor'
import GerenciarEstoque from '../../components/GerenciarEstoque'
import GerenciarProdutos from '../../components/GerenciarProdutos'
import { useApp } from '../../contexts/AppContext'
import { MOTIVOS_DESPERDICIO } from '../../contexts/hooks/useProducaoDiaria'
import { produtoDisponivelNoDia } from '../../utils/cardapioDias'
import { useIsMobile } from '../../utils/useIsMobile'

const DIAS_SEMANA_ORD = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado']
const DIAS_CURTO = { domingo: 'Dom', segunda: 'Seg', terca: 'Ter', quarta: 'Qua', quinta: 'Qui', sexta: 'Sex', sabado: 'Sáb' }
const DIAS_FULL  = { domingo: 'Domingo', segunda: 'Segunda-feira', terca: 'Terça-feira', quarta: 'Quarta-feira', quinta: 'Quinta-feira', sexta: 'Sexta-feira', sabado: 'Sábado' }
const DIAS_SEMANA_MIN = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const MESES_LABEL = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

const TURNOS = [
  { id: 'manha', label: 'Manhã', icon: Sun },
  { id: 'tarde', label: 'Tarde', icon: CloudSun },
  { id: 'noite', label: 'Noite', icon: Moon },
]

const TURNO_LABEL = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' }

function turnoAtual() {
  const hora = new Date().getHours()
  if (hora >= 5 && hora < 12) return 'manha'
  if (hora >= 12 && hora < 18) return 'tarde'
  return 'noite'
}

function inicioDoDiaTs(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function isoDeTs(ts) {
  return new Date(ts).toISOString().slice(0, 10)
}

function formatarDiaCompleto(ts) {
  const d = new Date(ts)
  const dia = DIAS_SEMANA_ORD[d.getDay()]
  return `${DIAS_FULL[dia]}, ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

const TURNO_ORDEM = ['manha', 'tarde', 'noite']

function labelDia(ts) {
  const hoje = inicioDoDiaTs(new Date())
  if (ts === hoje) return 'Hoje'
  if (ts === hoje + 24 * 60 * 60 * 1000) return 'Amanhã'
  return formatarDiaCompleto(ts)
}

function semanaContendo(refTs) {
  const ref = new Date(refTs)
  const dom = new Date(ref)
  dom.setDate(ref.getDate() - ref.getDay())
  dom.setHours(0, 0, 0, 0)
  const hojeTs = inicioDoDiaTs(new Date())
  return DIAS_SEMANA_ORD.map((dia, i) => {
    const d = new Date(dom)
    d.setDate(dom.getDate() + i)
    d.setHours(0, 0, 0, 0)
    return { dia, ts: d.getTime(), isoDate: d.toISOString().slice(0, 10), numero: d.getDate(), isHoje: d.getTime() === hojeTs }
  })
}

function diasGradeMes(mesTs) {
  const ref = new Date(mesTs)
  const ano = ref.getFullYear()
  const mes = ref.getMonth()
  const primeiroDia = new Date(ano, mes, 1)
  const ultimoDia = new Date(ano, mes + 1, 0)
  const offset = primeiroDia.getDay()
  const dias = []
  for (let i = 0; i < offset; i++) dias.push(null)
  for (let dia = 1; dia <= ultimoDia.getDate(); dia++) {
    const data = new Date(ano, mes, dia)
    data.setHours(0, 0, 0, 0)
    dias.push({ ts: data.getTime(), numero: dia })
  }
  return dias
}

const ROTAS_ABA = {
  dashboard: '/cozinha',
  producao: '/cozinha/producao',
  cardapio: '/cozinha/cardapio',
  estoque: '/cozinha/estoque',
  avisos: '/cozinha/avisos',
}

function abaPorRota(pathname) {
  if (pathname.includes('/producao')) return 'producao'
  if (pathname.includes('/cardapio')) return 'cardapio'
  if (pathname.includes('/estoque')) return 'estoque'
  if (pathname.includes('/avisos')) return 'avisos'
  return 'dashboard'
}

const STATUS_PRODUCAO = [
  'Planejado',
  'Em producao',
  'Pronto para venda',
  'Parcialmente pronto',
  'Esgotado',
  'Cancelado',
]

const STATUS_PRODUCAO_FORM = ['Planejado', 'Em producao', 'Pronto para venda', 'Cancelado']

const FORM_DESPERDICIO = {
  quantidade: '',
  motivo: MOTIVOS_DESPERDICIO[0],
  observacao: '',
}

const FORM_PRODUCAO = {
  produtoId: '',
  quantidadePlanejada: '1',
  quantidadeEmProducao: '',
  quantidadePronta: '',
  quantidadeVendida: '',
  horarioPrevisto: '',
  status: 'Planejado',
  observacao: '',
  turno: '',
  visivelParaVendedor: true,
  visivelParaAdmin: true,
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
  if (normal === 'em producao') return { label: 'Em produção', bg: '#FEF3C7', color: '#92400E', border: '#F59E0B' }
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

function maxDesperdicio(item) {
  if (!item) return 0
  const restante = Number(item.quantidadeRestante || 0)
  if (restante > 0) return restante
  const base = Math.max(Number(item.quantidadePlanejada || 0), Number(item.quantidadeEmProducao || 0))
  return Math.max(0, base - Number(item.quantidadeDesperdicada || 0))
}

function EmptyState({ children }) {
  return <div style={s.vazio}>{children}</div>
}

function StatCard({ icon: Icon, label, value, unidade, color, onClick }) {
  return (
    <div
      style={{ ...s.statCard, borderTop: `4px solid ${color}`, cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div style={s.statIcon}><Icon size={18} color={color} /></div>
      <span style={s.statLabel}>{label}</span>
      <strong style={{ ...s.statValue, color }}>
        {value}{unidade && <span style={s.statUnidade}> {unidade}</span>}
      </strong>
    </div>
  )
}

const TITULOS_PAINEL = {
  pedidos: 'Pedidos de hoje',
  produzido: 'Total produzido hoje',
  disponivel: 'Disponivel para venda',
  desperdicio: 'Desperdicio registrado hoje',
  esgotados: 'Produtos esgotados',
}

function StatusBadge({ status }) {
  const visual = statusVisual(status)
  return <span style={{ ...s.badge, background: visual.bg, color: visual.color }}>{visual.label}</span>
}

export default function Cozinha() {
  const { pedidos, produtos, atualizarProduto, criarAviso, avisos, producaoDiaria, producaoHoje, salvarProducao, atualizarProducao, removerProducao, registrarDesperdicio } = useApp()
  const location = useLocation()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const aba = abaPorRota(location.pathname)
  const [formProducao, setFormProducao] = useState(FORM_PRODUCAO)
  const [loteProducao, setLoteProducao] = useState([])
  const [producaoEditando, setProducaoEditando] = useState(null)
  const [buscaProducao, setBuscaProducao] = useState('')
  const [filtroProducao, setFiltroProducao] = useState('todos')
  const [desperdicioItem, setDesperdicioItem] = useState(null)
  const [formDesperdicio, setFormDesperdicio] = useState(FORM_DESPERDICIO)
  const [painelDetalhe, setPainelDetalhe] = useState(null)
  const [dataSelecionadaTs, setDataSelecionadaTs] = useState(() => inicioDoDiaTs(new Date()))
  const [calendarioAberto, setCalendarioAberto] = useState(false)
  const [mesVisivelTs, setMesVisivelTs] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d.getTime() })
  const [turnoSelecionado, setTurnoSelecionado] = useState(turnoAtual())
  const [qtdPorProduto, setQtdPorProduto] = useState({})
  const [buscaProduto, setBuscaProduto] = useState('')
  const [horarioPrevistoForm, setHorarioPrevistoForm] = useState('')
  const [loteDesperdicioForm, setLoteDesperdicioForm] = useState({})
  const [menuAbertoId, setMenuAbertoId] = useState(null)
  const [verTodosProdutos, setVerTodosProdutos] = useState(false)
  const [subAbaProducao, setSubAbaProducao] = useState('producao')
  const [loteDesperdicioAberto, setLoteDesperdicioAberto] = useState(false)
  const [modoSelecaoProducao, setModoSelecaoProducao] = useState(false)
  const [itensSelecionadosProducao, setItensSelecionadosProducao] = useState([])
  const [gerandoPDFProducao, setGerandoPDFProducao] = useState(false)

  function selecionarAba(id) {
    navigate(ROTAS_ABA[id] || '/cozinha')
  }

  const hoje = inicioDoDia()
  const pedidosPreparo = useMemo(() => pedidos
    .filter(p => ['recebido', 'pendente', 'em preparo', 'preparando', 'pronto', 'entregue', 'cancelado'].includes(normalizeStatus(p.status)))
    .sort((a, b) => (a.criadoEm || 0) - (b.criadoEm || 0))
  , [pedidos])
  const pedidosHoje = useMemo(() => pedidos.filter(p => (p.criadoEm || 0) >= hoje), [pedidos, hoje])
  const pedidosAtivos = useMemo(() => pedidosPreparo.filter(p => !['entregue', 'cancelado'].includes(normalizeStatus(p.status))), [pedidosPreparo])
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
  const estoqueBaixoCozinha = useMemo(
    () => produtos.filter(p => Number(p.estoqueBaixo || 0) > 0 && Number(p.estoque || 0) <= Number(p.estoqueBaixo || 0)).length,
    [produtos]
  )
  const desperdiciosHoje = useMemo(() => {
    const lista = []
    producaoOrdenada.forEach(item => {
      ;(item.historicoDesperdicio || []).forEach(h => lista.push({ ...h, produtoNome: h.produtoNome || item.produtoNome }))
    })
    return lista.sort((a, b) => (b.dataHora || 0) - (a.dataHora || 0))
  }, [producaoOrdenada])
  const itensProduzidos = useMemo(() => producaoOrdenada.filter(item => Number(item.quantidadePronta || 0) > 0), [producaoOrdenada])
  const itensDisponiveis = useMemo(() => producaoOrdenada.filter(item => Number(item.quantidadeRestante || 0) > 0), [producaoOrdenada])
  const itensEsgotados = useMemo(() => producaoOrdenada.filter(item => normalizeStatus(item.status) === 'esgotado'), [producaoOrdenada])
  const avisosCozinha = useMemo(() => (avisos || [])
    .filter(a => ['cozinha', 'todos'].includes(a.destino || a.destinatario))
    .sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0))
    .slice(0, 3), [avisos])
  const semanaDatas = useMemo(() => semanaContendo(dataSelecionadaTs), [dataSelecionadaTs])
  const producaoDoDia = useMemo(() => {
    const fim = dataSelecionadaTs + 24 * 60 * 60 * 1000 - 1
    return (producaoDiaria || [])
      .filter(item => { const t = Number(item.dataProducaoTs || item.criadoEm || 0); return t >= dataSelecionadaTs && t <= fim })
      .sort((a, b) => (b.atualizadoEm || b.criadoEm || 0) - (a.atualizadoEm || a.criadoEm || 0))
  }, [producaoDiaria, dataSelecionadaTs])
  const producaoDoDiaTurno = useMemo(
    () => producaoDoDia.filter(item => (item.turno || 'manha') === turnoSelecionado),
    [producaoDoDia, turnoSelecionado]
  )
  const producaoDashboardPorTurno = useMemo(() => {
    const grupos = new Map()
    producaoDoDia
      .filter(item => normalizeStatus(item.status) !== 'cancelado')
      .forEach(item => {
        const turno = item.turno || 'manha'
        if (!grupos.has(turno)) grupos.set(turno, [])
        grupos.get(turno).push(item)
      })
    return TURNO_ORDEM
      .filter(turno => grupos.has(turno))
      .map(turno => ({ turno, itens: grupos.get(turno).sort((a, b) => String(a.produtoNome).localeCompare(String(b.produtoNome))) }))
  }, [producaoDoDia])
  const itensParaDesperdicio = useMemo(() => producaoDoDiaTurno.filter(item => maxDesperdicio(item) > 0 && normalizeStatus(item.status) !== 'cancelado'), [producaoDoDiaTurno])
  const producaoDoDiaFiltrada = useMemo(() => {
    const termo = buscaProducao.trim().toLowerCase()
    return producaoDoDiaTurno.filter(item => {
      const statusOk = filtroProducao === 'todos' || normalizeStatus(item.status) === normalizeStatus(filtroProducao)
      const buscaOk = !termo || String(item.produtoNome || '').toLowerCase().includes(termo)
      return statusOk && buscaOk
    })
  }, [producaoDoDiaTurno, buscaProducao, filtroProducao])
  const ultimaAtualizacaoTurno = useMemo(
    () => producaoDoDiaTurno.reduce((acc, item) => Math.max(acc, Number(item.atualizadoEm || item.criadoEm || 0)), 0),
    [producaoDoDiaTurno]
  )
  const percentConcluido = producaoDoDiaTurno.filter(i => normalizeStatus(i.status) !== 'cancelado').length > 0
    ? Math.round((producaoDoDiaTurno.filter(i => ['pronto para venda', 'parcialmente pronto'].includes(normalizeStatus(i.status))).length / producaoDoDiaTurno.filter(i => normalizeStatus(i.status) !== 'cancelado').length) * 100)
    : 0
  const produtosFiltrados = useMemo(() => {
    const t = buscaProduto.trim().toLowerCase()
    return t ? produtos.filter(p => p.nome?.toLowerCase().includes(t) || p.categoria?.toLowerCase().includes(t)) : produtos
  }, [produtos, buscaProduto])
  const produtosRapidos = useMemo(() => {
    const contagem = {}
    ;(producaoDiaria || []).forEach(item => { contagem[item.produtoId] = (contagem[item.produtoId] || 0) + 1 })
    return [...produtos].sort((a, b) => (contagem[String(b.id)] || 0) - (contagem[String(a.id)] || 0)).slice(0, 8)
  }, [produtos, producaoDiaria])
  const contagemStatus = useMemo(() => {
    const base = { todos: producaoDoDiaTurno.filter(i => normalizeStatus(i.status) !== 'cancelado').length }
    STATUS_PRODUCAO.forEach(status => { base[status] = producaoDoDiaTurno.filter(i => normalizeStatus(i.status) === normalizeStatus(status)).length })
    return base
  }, [producaoDoDiaTurno])
  const temProducaoNoDia = useMemo(() => {
    return Object.fromEntries(semanaDatas.map(({ ts }) => {
      const fim = ts + 24 * 60 * 60 * 1000 - 1
      const tem = (producaoDiaria || []).some(item => { const t = Number(item.dataProducaoTs || item.criadoEm || 0); return t >= ts && t <= fim })
      return [ts, tem]
    }))
  }, [producaoDiaria, semanaDatas])
  const diasComProducao = useMemo(() => {
    const set = new Set()
    ;(producaoDiaria || []).forEach(item => {
      if (normalizeStatus(item.status) === 'cancelado') return
      const t = Number(item.dataProducaoTs || item.criadoEm || 0)
      if (t) set.add(inicioDoDiaTs(t))
    })
    return set
  }, [producaoDiaria])

  // Quando o dia planejado chega (vira "hoje"), libera automaticamente no cardápio
  // os itens que já estavam marcados Pronto/Parcialmente pronto pra essa data.
  // Usa a flag "estoqueLiberado" pra sincronizar só uma vez — depois disso, o
  // estoque do produto pode cair normalmente conforme os alunos compram, sem
  // esse efeito ficar "devolvendo" o valor antigo por cima das vendas reais.
  useEffect(() => {
    const hojeTs = inicioDoDiaTs(new Date())
    const pendentes = (producaoDiaria || []).filter(item => {
      const status = normalizeStatus(item.status)
      if (!['pronto para venda', 'parcialmente pronto'].includes(status)) return false
      if (item.estoqueLiberado) return false
      const ts = Number(item.dataProducaoTs || item.criadoEm || 0)
      return ts === hojeTs
    })
    pendentes.forEach(async item => {
      const produto = produtos.find(p => String(p.id) === String(item.produtoId))
      if (!produto) return
      await atualizarProduto({ ...produto, estoque: item.quantidadeRestante, disponivel: true })
      await atualizarProducao(item.id, item, { estoqueLiberado: true }, { acao: 'Liberou no cardápio automaticamente' })
    })
  }, [producaoDiaria, produtos, atualizarProduto, atualizarProducao])

  function montarPayloadProducao(dados, itemEditando = null) {
    const produto = produtos.find(p => String(p.id) === String(dados.produtoId))
    if (!produto) return null
    const itemTs = Number(dados.dataProducaoTs || itemEditando?.dataProducaoTs || itemEditando?.criadoEm || 0)
    const ehHoje = itemTs === inicioDoDiaTs(new Date())
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
      estoqueLiberado: ehHoje && ['Pronto para venda', 'Parcialmente pronto'].includes(dados.status),
    }
  }

  async function sincronizarEstoqueProducao(salvo) {
    const produto = produtos.find(p => String(p.id) === String(salvo.produtoId))
    if (!produto) return
    const itemTs = Number(salvo.dataProducaoTs || salvo.criadoEm || 0)
    if (itemTs !== inicioDoDiaTs(new Date())) return
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
    if (!produto) {
      alert('Selecione um produto.')
      return
    }
    const diaInfo = { ts: dataSelecionadaTs, isoDate: isoDeTs(dataSelecionadaTs) }
    const turno = formProducao.turno || turnoSelecionado
    const jaNaLista = loteProducao.some(item => String(item.produtoId) === String(produto.id) && item.turno === turno)
    const jaPlanejado = producaoDoDiaTurno.some(item => String(item.produtoId) === String(produto.id) && normalizeStatus(item.status) !== 'cancelado')
    if (jaNaLista || jaPlanejado) {
      alert('Esse produto ja esta planejado para este dia e turno.')
      return
    }
    setLoteProducao(prev => [...prev, {
      ...formProducao,
      quantidadePlanejada: Math.max(1, Number(formProducao.quantidadePlanejada) || 1),
      turno,
      produtoId: produto.id,
      produtoNome: produto.nome,
      produtoCategoria: produto.categoria || '',
      produtoFoto: produto.foto || '',
      dataProducao: diaInfo.isoDate,
      dataProducaoTs: diaInfo.ts,
    }])
    setFormProducao({ ...FORM_PRODUCAO, turno })
  }

  function atualizarItemLote(index, campo, valor) {
    setLoteProducao(prev => prev.map((item, i) => i === index ? { ...item, [campo]: valor } : item))
  }

  function removerItemLote(index) {
    setLoteProducao(prev => prev.filter((_, i) => i !== index))
  }

  function cancelarRascunhoLote() {
    if (loteProducao.length === 0) return
    if (!confirm(`Descartar os ${loteProducao.length} item(ns) do rascunho?`)) return
    setLoteProducao([])
  }

  function toggleSelecaoProducao(id) {
    setItensSelecionadosProducao(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function selecionarTodosProducao() {
    const ids = producaoDoDiaFiltrada.filter(i => normalizeStatus(i.status) !== 'cancelado').map(i => i.id)
    setItensSelecionadosProducao(prev => prev.length === ids.length ? [] : ids)
  }

  function sairModoSelecaoProducao() {
    setModoSelecaoProducao(false)
    setItensSelecionadosProducao([])
  }

  async function aplicarStatusLoteSelecionados(status) {
    const itens = producaoDoDiaTurno.filter(i => itensSelecionadosProducao.includes(i.id))
    if (itens.length === 0) return
    if (status === 'Cancelado') {
      if (!confirm(`Cancelar ${itens.length} item(ns) selecionado(s)?`)) return
      for (const item of itens) {
        const jaEstavaLiberado = item.estoqueLiberado || ['pronto para venda', 'parcialmente pronto'].includes(normalizeStatus(item.status))
        if (jaEstavaLiberado) {
          const produto = produtos.find(p => String(p.id) === String(item.produtoId))
          if (produto) await atualizarProduto({ ...produto, estoque: 0, disponivel: false })
        }
        await removerProducao(item.id, item)
      }
    } else {
      for (const item of itens) await mudarStatusProducao(item, status)
    }
    sairModoSelecaoProducao()
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
      turno: item.turno || 'manha',
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
    const diaTs = Number(item.dataProducaoTs || item.criadoEm || Date.now())
    const ehHoje = diaTs === inicioDoDiaTs(new Date())
    if (ehHoje && ['Pronto para venda', 'Parcialmente pronto'].includes(status)) dados.estoqueLiberado = true
    const atualizado = await atualizarProducao(item.id, item, dados, { acao: `Marcou como ${status}` })
    if (!ehHoje && ['Pronto para venda', 'Parcialmente pronto', 'Esgotado'].includes(status)) {
      alert(`Esse item é da produção planejada para ${formatarDiaCompleto(diaTs)}. Ele só vai entrar no cardápio do aluno nesse dia, não agora.`)
      return
    }
    if (produto && ['Pronto para venda', 'Parcialmente pronto'].includes(status)) {
      const diaSemana = DIAS_SEMANA_ORD[new Date(diaTs).getDay()]
      let diasCardapio = produto.diasCardapio || produto.diasProducao || []
      if (!produtoDisponivelNoDia(produto, diaSemana)) {
        const adicionar = confirm(
          `${produto.nome} ficará pronto, mas os "Dias de produção" cadastrados desse produto não incluem ${DIAS_FULL[diaSemana]} — por isso ele NÃO vai aparecer no cardápio do aluno hoje.\n\nQuer adicionar ${DIAS_FULL[diaSemana]} aos dias de produção desse produto agora?`
        )
        if (adicionar) diasCardapio = [...diasCardapio, diaSemana]
      }
      await atualizarProduto({ ...produto, estoque: atualizado.quantidadeRestante, disponivel: true, diasCardapio })
    }
    if (produto && status === 'Esgotado') {
      await atualizarProduto({ ...produto, estoque: 0, disponivel: false })
    }
  }

  async function cancelarProducao(item) {
    if (!confirm(`Cancelar producao de ${item.produtoNome}?`)) return
    const jaEstavaLiberado = item.estoqueLiberado || ['pronto para venda', 'parcialmente pronto'].includes(normalizeStatus(item.status))
    if (jaEstavaLiberado) {
      const produto = produtos.find(p => String(p.id) === String(item.produtoId))
      if (produto) await atualizarProduto({ ...produto, estoque: 0, disponivel: false })
    }
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
    if (quantidade > maxDesperdicio(desperdicioItem)) {
      alert('A quantidade informada e maior que o disponivel para este produto.')
      return
    }
    const resultado = await registrarDesperdicio(desperdicioItem.id, desperdicioItem, {
      quantidade,
      motivo: formDesperdicio.motivo,
      observacao: formDesperdicio.observacao,
    })
    const itemTs = Number(desperdicioItem.dataProducaoTs || desperdicioItem.criadoEm || 0)
    const produto = produtos.find(p => String(p.id) === String(desperdicioItem.produtoId))
    if (produto && itemTs === inicioDoDiaTs(new Date())) {
      await atualizarProduto({ ...produto, estoque: resultado.quantidadeRestante })
    }
    setDesperdicioItem(null)
    setFormDesperdicio(FORM_DESPERDICIO)
  }

  function atualizarLoteDesperdicio(id, campo, valor) {
    setLoteDesperdicioForm(prev => ({
      ...prev,
      [id]: { quantidade: '', motivo: MOTIVOS_DESPERDICIO[0], observacao: '', ...prev[id], [campo]: valor },
    }))
  }

  async function registrarLoteDesperdicio() {
    const itens = Object.entries(loteDesperdicioForm)
      .map(([id, dados]) => ({ id, ...dados, quantidade: Number(dados.quantidade) }))
      .filter(({ quantidade }) => quantidade > 0)
    if (itens.length === 0) {
      alert('Informe a quantidade desperdicada de pelo menos um produto.')
      return
    }
    for (const { id, quantidade, motivo, observacao } of itens) {
      const item = producaoDoDia.find(p => p.id === id)
      if (!item) continue
      if (quantidade > maxDesperdicio(item)) continue
      const resultado = await registrarDesperdicio(item.id, item, {
        quantidade,
        motivo: motivo || MOTIVOS_DESPERDICIO[0],
        observacao: observacao || '',
      })
      const itemTs = Number(item.dataProducaoTs || item.criadoEm || 0)
      const produto = produtos.find(p => String(p.id) === String(item.produtoId))
      if (produto && itemTs === inicioDoDiaTs(new Date())) {
        await atualizarProduto({ ...produto, estoque: resultado.quantidadeRestante })
      }
    }
    setLoteDesperdicioForm({})
  }

  async function planejarProduto(produto) {
    const qtd = Math.max(1, Number(qtdPorProduto[produto.id] || 1))
    const diaInfo = { ts: dataSelecionadaTs, isoDate: isoDeTs(dataSelecionadaTs) }
    const jaExiste = producaoDoDiaTurno.find(p => String(p.produtoId) === String(produto.id) && normalizeStatus(p.status) !== 'cancelado')
    if (jaExiste) {
      await atualizarProducao(jaExiste.id, jaExiste, { quantidadePlanejada: Number(jaExiste.quantidadePlanejada || 0) + qtd }, { acao: 'Adicionou quantidade ao planejamento' })
    } else {
      await salvarProducao({
        produtoId: produto.id, produtoNome: produto.nome,
        produtoCategoria: produto.categoria || '', produtoFoto: produto.foto || '',
        quantidadePlanejada: qtd, horarioPrevisto: horarioPrevistoForm,
        status: 'Planejado', dataProducao: diaInfo.isoDate, dataProducaoTs: diaInfo.ts,
        turno: turnoSelecionado,
        visivelParaVendedor: true, visivelParaAdmin: true,
      })
    }
    setQtdPorProduto(p => ({ ...p, [produto.id]: 1 }))
  }

  async function avisarVendedor(item) {
    await criarAviso({
      titulo: `Producao: ${item.produtoNome}`,
      mensagem: `${item.produtoNome} - ${item.status}. Disponível: ${item.quantidadeRestante || 0}. ${item.horarioPrevisto ? `Previsão: ${item.horarioPrevisto}.` : ''} ${item.observacao || ''}`.trim(),
      destino: 'vendedor',
      tipo: normalizeStatus(item.status) === 'esgotado' ? 'aviso' : 'info',
    })
  }

  async function exportarProducaoPDF() {
    if (gerandoPDFProducao) return
    if (producaoDashboardPorTurno.length === 0) {
      alert(`Não há produção planejada para ${formatarDiaCompleto(dataSelecionadaTs)}.`)
      return
    }
    setGerandoPDFProducao(true)
    let jsPDF, autoTable
    try {
      [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
    } catch {
      alert('Não foi possível carregar o gerador de PDF. Verifique sua conexão e tente novamente.')
      setGerandoPDFProducao(false)
      return
    }

    const doc = new jsPDF()
    doc.setFontSize(16)
    doc.setTextColor(0, 61, 124)
    doc.text(`Senac Lanches - Produção planejada - ${formatarDiaCompleto(dataSelecionadaTs)}`, 14, 16)
    doc.setFontSize(9)
    doc.setTextColor(100)
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 22)

    let y = 30
    producaoDashboardPorTurno.forEach(grupo => {
      if (y > 270) { doc.addPage(); y = 20 }
      doc.setFontSize(11)
      doc.setTextColor(0, 61, 124)
      doc.text(TURNO_LABEL[grupo.turno] || grupo.turno, 14, y)
      autoTable(doc, {
        startY: y + 4,
        head: [['Produto', 'Categoria', 'Qtd. planejada', 'Status']],
        body: grupo.itens.map(item => [
          item.produtoNome,
          item.produtoCategoria || '-',
          String(item.quantidadePlanejada || 0),
          producaoStatusVisual(item.status).label,
        ]),
        headStyles: { fillColor: [0, 61, 124] },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        styles: { fontSize: 9 },
        margin: { left: 14, right: 14 },
      })
      y = doc.lastAutoTable.finalY + 12
    })

    doc.save(`producao-senac-${isoDeTs(dataSelecionadaTs)}.pdf`)
    setGerandoPDFProducao(false)
  }

  return (
    <Layout titulo="Painel da Cozinha">
      <div style={{ ...s.page, paddingBottom: isMobile ? 128 : 32 }}>
        {aba === 'dashboard' && (
          <>
            <section style={s.sectionCard}>
              <div style={s.sectionHeader}>
                <h3 style={s.sectionTitle}>Resumo de hoje</h3>
              </div>
              <div style={{ ...s.statsGrid, gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(6, minmax(0, 1fr))' }}>
                <StatCard icon={ClipboardList} label="Pedidos hoje" value={pedidosHoje.length} color="#003D7C" onClick={() => setPainelDetalhe('pedidos')} />
                <StatCard icon={Utensils} label="Total produzido" value={totalProduzidoHoje} unidade="un" color="#7C3AED" onClick={() => setPainelDetalhe('produzido')} />
                <StatCard icon={Trash2} label="Desperdiçado" value={totalDesperdicadoHoje} unidade="un" color="#EF4444" onClick={() => setPainelDetalhe('desperdicio')} />
                <StatCard icon={XCircle} label="Esgotados" value={produtosEsgotados} color="#B91C1C" onClick={() => setPainelDetalhe('esgotados')} />
                <StatCard icon={PackageCheck} label="Disponível" value={totalDisponivelHoje} unidade="un" color="#22C55E" onClick={() => setPainelDetalhe('disponivel')} />
                <StatCard icon={ArchiveRestore} label="Estoque em atenção" value={estoqueBaixoCozinha} color="#D97706" onClick={() => navigate(ROTAS_ABA.estoque, { state: { filtroInicial: 'atencao' } })} />
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

            <section style={s.sectionCard}>
              <div style={s.sectionHeader}>
                <div>
                  <h3 style={s.sectionTitle}>Produção planejada — {labelDia(dataSelecionadaTs)}</h3>
                  <p style={s.meta}>Só para consulta — para alterar status, vá na aba Produção.</p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    style={s.calendarBtn}
                    title="Escolher outro dia"
                    onClick={() => {
                      const d = new Date(dataSelecionadaTs)
                      d.setDate(1)
                      setMesVisivelTs(d.getTime())
                      setCalendarioAberto(true)
                    }}
                  >
                    <Calendar size={16} />
                  </button>
                  <button style={s.linkBtn} onClick={exportarProducaoPDF} disabled={gerandoPDFProducao}>
                    {gerandoPDFProducao ? 'Gerando...' : '🖨 Exportar / Imprimir'}
                  </button>
                  <button style={s.linkBtn} onClick={() => { setSubAbaProducao('producao'); setProducaoEditando(null); selecionarAba('producao') }}>Editar / lote</button>
                </div>
              </div>
              {producaoDashboardPorTurno.length === 0 ? (
                <EmptyState>Nenhuma produção planejada para {labelDia(dataSelecionadaTs)}. Cadastre o que será produzido na aba Produção.</EmptyState>
              ) : producaoDashboardPorTurno.map(grupo => (
                <div key={grupo.turno} style={s.grupoDiaTurno}>
                  <div style={s.grupoDiaTurnoHeader}>
                    <span style={s.turnoChip}>{TURNO_LABEL[grupo.turno] || grupo.turno}</span>
                    <span style={s.meta}>{grupo.itens.length} item(ns)</span>
                    <button
                      type="button"
                      style={{ ...s.linkBtn, marginLeft: 'auto', padding: '0.3rem 0.65rem', fontSize: '0.76rem' }}
                      onClick={() => {
                        setTurnoSelecionado(grupo.turno)
                        setSubAbaProducao('producao')
                        setProducaoEditando(null)
                        selecionarAba('producao')
                      }}
                    >
                      Editar este lote
                    </button>
                  </div>
                  {grupo.itens.map(item => {
                    const visual = producaoStatusVisual(item.status)
                    return (
                      <article key={item.id} style={{ ...s.producaoCard, borderLeftColor: visual.border }}>
                        <div style={s.pedidoTop}>
                          <div style={s.produtoMini}>
                            {item.produtoFoto && <img src={item.produtoFoto} alt={item.produtoNome} style={s.produtoMiniImg} />}
                            <div>
                              <strong style={s.codigo}>{item.produtoNome}</strong>
                              <p style={s.meta}>Pronto {item.quantidadePronta || 0} un - Disponivel {item.quantidadeRestante || 0} un - Desperdicado {item.quantidadeDesperdicada || 0} un</p>
                            </div>
                          </div>
                          <span style={{ ...s.badge, background: visual.bg, color: visual.color }}>{visual.label}</span>
                        </div>
                      </article>
                    )
                  })}
                </div>
              ))}
            </section>
          </>
        )}

        {aba === 'producao' && (
          <div style={s.producaoPage}>

            {/* Semana + Turno */}
            <div style={s.sectionCard}>
              <div style={s.semanaRow}>
                <div style={s.diasScroll}>
                  {semanaDatas.map(({ ts, numero, isHoje, dia }) => {
                    const ativo = dataSelecionadaTs === ts
                    const temItem = temProducaoNoDia[ts]
                    return (
                      <button key={ts} onClick={() => { setDataSelecionadaTs(ts); setProducaoEditando(null); setBuscaProducao(''); setFiltroProducao('todos'); sairModoSelecaoProducao() }}
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                          padding: '0.6rem 0.8rem', borderRadius: 12, border: ativo ? 'none' : '1.5px solid #E2E8F0', cursor: 'pointer',
                          minWidth: 52, fontFamily: 'inherit', position: 'relative', flexShrink: 0,
                          background: ativo ? '#003D7C' : isHoje ? '#EFF6FF' : '#fff',
                          color: ativo ? '#fff' : isHoje ? '#003D7C' : '#64748B',
                          fontWeight: ativo || isHoje ? 900 : 700,
                          boxShadow: ativo ? '0 4px 12px rgba(0,61,124,0.28)' : 'none',
                          transition: 'all 0.15s',
                        }}>
                        <span style={{ fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: 0.3 }}>{DIAS_CURTO[dia]}</span>
                        <span style={{ fontSize: '1.05rem', lineHeight: 1 }}>{numero}</span>
                        {temItem && <span style={{ width: 5, height: 5, borderRadius: '50%', background: ativo ? '#7DD3FC' : '#22C55E', marginTop: 1 }} />}
                      </button>
                    )
                  })}
                </div>
                <button
                  type="button"
                  style={s.calendarBtn}
                  title="Ver mês completo"
                  onClick={() => {
                    const d = new Date(dataSelecionadaTs)
                    d.setDate(1)
                    setMesVisivelTs(d.getTime())
                    setCalendarioAberto(true)
                  }}
                >
                  <Calendar size={18} />
                </button>
              </div>

              <div style={s.divisorH} />

              <div style={s.turnoRow}>
                <span style={s.turnoRowLabel}>Turno</span>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {TURNOS.map(({ id, label, icon: Icon }) => {
                    const ativo = turnoSelecionado === id
                    return (
                      <button key={id} onClick={() => { setTurnoSelecionado(id); setProducaoEditando(null); setBuscaProducao(''); setFiltroProducao('todos'); sairModoSelecaoProducao() }}
                        style={{ ...s.turnoBtn, ...(ativo ? s.turnoBtnAtivo : {}) }}>
                        <Icon size={15} /> {label}
                      </button>
                    )
                  })}
                </div>
                <span style={{ ...s.atualizadoTag, marginLeft: 'auto' }}><RefreshIcon size={13} /> {ultimaAtualizacaoTurno ? tempoDesde(ultimaAtualizacaoTurno) : 'agora'}</span>
              </div>

              {producaoEditando && (
                <button style={s.linkBtn} onClick={() => { setFormProducao(FORM_PRODUCAO); setProducaoEditando(null) }}>
                  ← Voltar ao planejamento
                </button>
              )}
            </div>

            {/* Stats */}
            <div style={s.statsSlim}>
              <div style={{ ...s.statsGridRow, gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)' }}>
                <div style={s.statsSlimItem}><strong style={{ color: '#003D7C', fontSize: '1.5rem' }}>{producaoDoDiaTurno.filter(i => normalizeStatus(i.status) !== 'cancelado').length}</strong><span style={s.statsSlimLabel}>Planejados</span></div>
                <div style={s.statsSlimItem}><strong style={{ color: '#F59E0B', fontSize: '1.5rem' }}>{producaoDoDiaTurno.filter(i => normalizeStatus(i.status) === 'em producao').length}</strong><span style={s.statsSlimLabel}>Em produção</span></div>
                <div style={s.statsSlimItem}><strong style={{ color: '#22C55E', fontSize: '1.5rem' }}>{producaoDoDiaTurno.filter(i => ['pronto para venda','parcialmente pronto'].includes(normalizeStatus(i.status))).length}</strong><span style={s.statsSlimLabel}>Prontos</span></div>
                <div style={s.statsSlimItem}><strong style={{ color: '#EF4444', fontSize: '1.5rem' }}>{producaoDoDiaTurno.filter(i => normalizeStatus(i.status) === 'esgotado').length}</strong><span style={s.statsSlimLabel}>Esgotados</span></div>
              </div>
              <div style={s.divisorH} />
              <div style={s.progressoRow2}>
                <span style={s.progressoLabel}>Progresso do dia</span>
                <div style={s.progressoTrack}><div style={{ ...s.progressoFill, width: `${percentConcluido}%` }} /></div>
                <strong style={s.progressoPercent}>{percentConcluido}%</strong>
              </div>
            </div>

            {/* Abas internas */}
            {!producaoEditando && (
              <div style={s.subAbas}>
                <button style={{ ...s.subAbaBtn, ...(subAbaProducao === 'producao' ? s.subAbaBtnAtivo : {}) }} onClick={() => setSubAbaProducao('producao')}>
                  Produção {contagemStatus.todos > 0 && <span style={s.filtroCount}>{contagemStatus.todos}</span>}
                </button>
                <button style={{ ...s.subAbaBtn, ...(subAbaProducao === 'planejar' ? s.subAbaBtnAtivo : {}) }} onClick={() => setSubAbaProducao('planejar')}>
                  <PlusCircle size={14} /> Planejar
                </button>
              </div>
            )}

            {/* Formulário de edição (quando editando item existente) */}
            {producaoEditando && (
              <form onSubmit={salvarPlanejamento} style={s.sectionCard}>
                <div style={s.sectionHeader}>
                  <div>
                    <h3 style={s.sectionTitle}>Editando: {producaoEditando.produtoNome}</h3>
                    <p style={s.meta}>Atualize as informações deste item de produção.</p>
                  </div>
                </div>
                <div style={{ ...s.formGridRapido, gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)' }}>
                  <input type="number" min="0" value={formProducao.quantidadePlanejada} onChange={e => setFormProducao({ ...formProducao, quantidadePlanejada: e.target.value })} placeholder="Qtd. planejada" style={s.input} />
                  <input type="number" min="0" value={formProducao.quantidadeEmProducao} onChange={e => setFormProducao({ ...formProducao, quantidadeEmProducao: e.target.value })} placeholder="Em produção" style={s.input} />
                  <input type="number" min="0" value={formProducao.quantidadePronta} onChange={e => setFormProducao({ ...formProducao, quantidadePronta: e.target.value })} placeholder="Qtd. pronta" style={s.input} />
                  <input type="time" value={formProducao.horarioPrevisto} onChange={e => setFormProducao({ ...formProducao, horarioPrevisto: e.target.value })} style={s.input} />
                </div>
                <div style={{ ...s.formGrid2, gridTemplateColumns: isMobile ? '1fr' : '1fr 2fr' }}>
                  <select value={formProducao.status} onChange={e => setFormProducao({ ...formProducao, status: e.target.value })} style={s.input}>
                    {STATUS_PRODUCAO_FORM.map(st => <option key={st} value={st}>{st}</option>)}
                  </select>
                  <input value={formProducao.observacao} onChange={e => setFormProducao({ ...formProducao, observacao: e.target.value })} placeholder="Observação (opcional)" style={s.input} />
                </div>
                <div style={s.acoes}>
                  <button type="submit" style={s.btnPrimario}><Save size={15} /> Salvar alterações</button>
                  <button type="button" style={s.btnSecundario} onClick={() => mudarStatusProducao(producaoEditando, 'Pronto para venda')}><CheckCircle2 size={15} /> Marcar pronto</button>
                  <button type="button" style={s.btnSecundario} onClick={() => { setFormProducao(FORM_PRODUCAO); setProducaoEditando(null) }}>Cancelar edição</button>
                </div>
              </form>
            )}

            {/* Cadastrar planejamento */}
            {!producaoEditando && subAbaProducao === 'planejar' && (
              <div id="cadastrar-planejamento" style={s.sectionCard}>
                <h3 style={s.sectionTitle}>Cadastrar planejamento</h3>
                <div style={{ display: 'grid', gap: 10, gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr 1fr 1.4fr' }}>
                  <div>
                    <label style={s.campoLabel}>Produto</label>
                    <select value={formProducao.produtoId} onChange={e => setFormProducao({ ...formProducao, produtoId: e.target.value })} style={s.input}>
                      <option value="">Selecione o produto</option>
                      {produtos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={s.campoLabel}>Quantidade</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button type="button" style={s.qtyBtn} onClick={() => setFormProducao(f => ({ ...f, quantidadePlanejada: String(Math.max(1, Number(f.quantidadePlanejada || 1) - 1)) }))}>−</button>
                      <input type="number" min="1" value={formProducao.quantidadePlanejada} onChange={e => setFormProducao({ ...formProducao, quantidadePlanejada: e.target.value })} style={{ ...s.input, textAlign: 'center', padding: '0.6rem 0.3rem' }} />
                      <button type="button" style={s.qtyBtn} onClick={() => setFormProducao(f => ({ ...f, quantidadePlanejada: String(Number(f.quantidadePlanejada || 1) + 1) }))}>+</button>
                    </div>
                  </div>
                  <div>
                    <label style={s.campoLabel}>Turno</label>
                    <select value={formProducao.turno || turnoSelecionado} onChange={e => setFormProducao({ ...formProducao, turno: e.target.value })} style={s.input}>
                      {TURNOS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={s.campoLabel}>Observação (opcional)</label>
                    <input value={formProducao.observacao} onChange={e => setFormProducao({ ...formProducao, observacao: e.target.value })} placeholder="Ex.: sem cebola" style={s.input} />
                  </div>
                </div>
                <button type="button" style={{ ...s.btnPrimario, width: '100%', justifyContent: 'center' }} onClick={adicionarItemLote}>
                  <PlusCircle size={16} /> Adicionar ao planejamento
                </button>

                {loteProducao.length > 0 && (
                  <div style={s.loteBox}>
                    <strong style={{ color: '#0F172A' }}>Itens no rascunho ({loteProducao.length})</strong>
                    {loteProducao.map((item, i) => (
                      <div key={`${item.produtoId}-${i}`} style={s.linhaResumo}>
                        <span>{item.produtoNome} — {item.quantidadePlanejada} un ({TURNO_LABEL[item.turno] || item.turno})</span>
                        <button type="button" style={s.iconBtnPerigo} onClick={() => removerItemLote(i)}><X size={14} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Planejamento rápido */}
            {!producaoEditando && subAbaProducao === 'planejar' && (
              <div style={s.sectionCard}>
                <div style={s.sectionHeader}>
                  <h3 style={s.sectionTitle}>Planejamento rápido</h3>
                  <button style={s.linkBtn} onClick={() => setVerTodosProdutos(v => !v)}>
                    {verTodosProdutos ? 'Ver menos' : 'Ver todos'} <ChevronRight size={14} />
                  </button>
                </div>
                {verTodosProdutos && (
                  <div style={s.searchBox}>
                    <Search size={16} color="#64748B" />
                    <input value={buscaProduto} onChange={e => setBuscaProduto(e.target.value)} placeholder="Buscar produto..." style={s.searchInput} />
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fill, minmax(155px, 1fr))', gap: 12 }}>
                  {(verTodosProdutos ? produtosFiltrados : produtosRapidos).map(produto => {
                    const planejado = producaoDoDiaTurno.find(p => String(p.produtoId) === String(produto.id) && normalizeStatus(p.status) !== 'cancelado')
                    const qtd = qtdPorProduto[produto.id] ?? 1
                    return (
                      <div key={produto.id} style={{ ...s.produtoCardGrid, border: planejado ? '2px solid #22C55E' : '2px solid #E5E7EB' }}>
                        <div style={{ width: '100%', height: 76, borderRadius: 10, overflow: 'hidden', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 7, flexShrink: 0 }}>
                          {produto.foto
                            ? <img src={produto.foto} alt={produto.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : produto.emoji
                              ? <span style={{ fontSize: '2rem' }}>{produto.emoji}</span>
                              : <Utensils size={26} color="#94A3B8" strokeWidth={1.5} />
                          }
                        </div>
                        <strong style={{ fontSize: '0.8rem', color: '#0F172A', display: 'block', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{produto.nome}</strong>
                        {planejado
                          ? <div style={{ fontSize: '0.7rem', color: '#16A34A', fontWeight: 800, marginBottom: 6 }}>✓ {planejado.quantidadePlanejada} un planejadas</div>
                          : <div style={{ fontSize: '0.7rem', color: '#94A3B8', marginBottom: 6 }}>{produto.categoria || 'Produto'}</div>
                        }
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 7 }}>
                          <button type="button" style={s.qtyBtn} onClick={() => setQtdPorProduto(p => ({ ...p, [produto.id]: Math.max(1, (p[produto.id] ?? 1) - 1) }))}>−</button>
                          <input type="number" min="1" max="999" value={qtd}
                            onChange={e => setQtdPorProduto(p => ({ ...p, [produto.id]: Math.max(1, Number(e.target.value) || 1) }))}
                            style={{ ...s.inputMini, width: 44, textAlign: 'center', padding: '0.3rem 0.2rem' }} />
                          <button type="button" style={s.qtyBtn} onClick={() => setQtdPorProduto(p => ({ ...p, [produto.id]: Math.min(999, (p[produto.id] ?? 1) + 1) }))}>+</button>
                        </div>
                        <button type="button"
                          style={{ ...s.btnPrimario, width: '100%', fontSize: '0.76rem', padding: '0.45rem 0.4rem', justifyContent: 'center', minHeight: 34, background: planejado ? '#16A34A' : '#003D7C' }}
                          onClick={() => planejarProduto(produto)}>
                          {planejado ? `+ Adicionar ${qtd} un` : `Planejar ${qtd} un`}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Lista de produção do dia selecionado */}
            {!producaoEditando && subAbaProducao === 'producao' && (
            <section id="producao-lista" style={s.sectionCard}>
              {modoSelecaoProducao ? (
                <div style={s.sectionHeader}>
                  <button style={s.linkBtn} onClick={sairModoSelecaoProducao}>← Cancelar seleção</button>
                  <button style={s.linkBtn} onClick={selecionarTodosProducao}>
                    {itensSelecionadosProducao.length === producaoDoDiaFiltrada.filter(i => normalizeStatus(i.status) !== 'cancelado').length ? 'Desmarcar todos' : 'Selecionar todos'}
                  </button>
                  <span style={{ color: '#1D4ED8', fontWeight: 800, fontSize: '0.85rem', marginLeft: 'auto' }}>
                    {itensSelecionadosProducao.length} selecionado{itensSelecionadosProducao.length !== 1 ? 's' : ''}
                  </span>
                </div>
              ) : (
                <div style={s.sectionHeader}>
                  <div>
                    <h3 style={s.sectionTitle}>Produção — {formatarDiaCompleto(dataSelecionadaTs)} ({TURNO_LABEL[turnoSelecionado]})</h3>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <div style={s.searchBox}>
                      <Search size={16} color="#64748B" />
                      <input value={buscaProducao} onChange={e => setBuscaProducao(e.target.value)} placeholder="Buscar produto..." style={s.searchInput} />
                    </div>
                    {producaoDoDiaTurno.filter(i => normalizeStatus(i.status) !== 'cancelado').length > 0 && (
                      <button type="button" style={s.linkBtn} onClick={() => setModoSelecaoProducao(true)}>
                        ☑ Selecionar
                      </button>
                    )}
                  </div>
                </div>
              )}
              <div style={s.filtros}>
                {['todos', ...STATUS_PRODUCAO].map(status => {
                  const ativo = filtroProducao === status
                  const visual = status === 'todos'
                    ? { bg: '#E8F0FB', color: '#003D7C' }
                    : producaoStatusVisual(status)
                  const label = status === 'todos' ? 'Todos' : visual.label
                  return (
                    <button key={status} onClick={() => setFiltroProducao(status)}
                      style={{
                        ...s.filtroBtn,
                        background: ativo ? visual.color : visual.bg,
                        color: ativo ? '#fff' : visual.color,
                        boxShadow: ativo ? `0 4px 10px ${visual.color}55` : 'none',
                      }}>
                      {label}
                      <span style={{ ...s.filtroCount, background: ativo ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.08)' }}>
                        {contagemStatus[status] ?? 0}
                      </span>
                    </button>
                  )
                })}
              </div>
              <div style={s.lista}>
                {producaoDoDiaFiltrada.length === 0
                  ? <EmptyState>Nenhuma produção planejada para {formatarDiaCompleto(dataSelecionadaTs)} ({TURNO_LABEL[turnoSelecionado]}).</EmptyState>
                  : producaoDoDiaFiltrada.map(item => {
                    const visual = producaoStatusVisual(item.status)
                    const statusNorm = normalizeStatus(item.status)
                    const qtdExibida = statusNorm === 'planejado' ? item.quantidadePlanejada
                      : statusNorm === 'em producao' ? item.quantidadeEmProducao
                      : statusNorm === 'esgotado' ? 0
                      : item.quantidadePronta
                    const menuAberto = menuAbertoId === item.id
                    const selecionado = itensSelecionadosProducao.includes(item.id)
                    const podeSelecionar = statusNorm !== 'cancelado'
                    return (
                      <article key={item.id} style={{ ...s.prodRow, ...(selecionado ? s.prodRowSelecionada : {}) }}>
                        <div
                          style={{ ...s.prodRowTop, cursor: modoSelecaoProducao && podeSelecionar ? 'pointer' : 'default' }}
                          onClick={() => { if (modoSelecaoProducao && podeSelecionar) toggleSelecaoProducao(item.id) }}
                        >
                          {modoSelecaoProducao ? (
                            <div style={selecionado ? s.checkOn : s.checkOff}>
                              {selecionado && <span style={{ color: '#fff', fontSize: '0.7rem', fontWeight: 900 }}>✓</span>}
                            </div>
                          ) : null}
                          <div style={s.produtoMini}>
                            <div style={s.produtoMiniThumb}>
                              {item.produtoFoto
                                ? <img src={item.produtoFoto} alt={item.produtoNome} style={s.produtoMiniImg} />
                                : <Utensils size={18} color="#94A3B8" />
                              }
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <strong style={s.codigo}>{item.produtoNome}</strong>
                              <p style={s.meta}>{item.produtoCategoria || 'Produto'}</p>
                            </div>
                          </div>
                          <strong style={s.prodRowQtd}>{qtdExibida || 0} un</strong>
                          <span style={{ ...s.badge, background: visual.bg, color: visual.color }}>{visual.label}</span>
                          {!modoSelecaoProducao && (
                            <button style={s.iconBtnMenu} onClick={e => { e.stopPropagation(); setMenuAbertoId(menuAberto ? null : item.id) }}><MoreVertical size={18} /></button>
                          )}
                        </div>
                        {item.observacao && <p style={s.obs}>{item.observacao}</p>}
                        {!modoSelecaoProducao && menuAberto && (
                          <div style={s.menuAcoes}>
                            {statusNorm === 'planejado' && (
                              <button style={s.btnPrimario} onClick={() => mudarStatusProducao(item, 'Em producao')}><Flame size={15} /> Iniciar produção</button>
                            )}
                            {statusNorm === 'em producao' && (
                              <button style={s.btnPrimario} onClick={() => mudarStatusProducao(item, 'Pronto para venda')}><CheckCircle2 size={15} /> Marcar pronto</button>
                            )}
                            {['pronto para venda', 'parcialmente pronto'].includes(statusNorm) && (
                              <button style={s.btnSecundario} onClick={() => mudarStatusProducao(item, 'Esgotado')}><XCircle size={15} /> Marcar esgotado</button>
                            )}
                            <button style={s.btnSecundario} onClick={() => editarPlanejamento(item)}><Edit3 size={15} /> Editar quantidade</button>
                            <button style={s.btnSecundario} onClick={() => avisarVendedor(item)}><Send size={15} /> Avisar vendedor</button>
                            <button style={s.btnPerigo} onClick={() => abrirDesperdicio(item)} disabled={maxDesperdicio(item) <= 0 || statusNorm === 'cancelado'}><Trash2 size={15} /> Registrar desperdício</button>
                            {statusNorm !== 'cancelado' && (
                              <button style={s.btnPerigo} onClick={() => cancelarProducao(item)}><X size={15} /> Cancelar item</button>
                            )}
                            <p style={s.meta}>Atualizado {tempoDesde(item.atualizadoEm)} por {item.atualizadoPor?.nome || item.criadoPor?.nome || 'Cozinha'}</p>
                          </div>
                        )}
                      </article>
                    )
                  })
                }
              </div>
            </section>
            )}

            {/* Desperdício em lote (mostra itens do dia selecionado) */}
            {!producaoEditando && subAbaProducao === 'producao' && itensParaDesperdicio.length > 0 && (
              <section id="desperdicio-lote" style={s.sectionCard}>
                <button type="button" style={s.loteToggleBtn} onClick={() => setLoteDesperdicioAberto(v => !v)}>
                  <span style={s.sectionTitle}><Trash2 size={16} /> Registrar desperdício em lote</span>
                  <ChevronRight size={16} style={{ transform: loteDesperdicioAberto ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }} />
                </button>
                {loteDesperdicioAberto && (
                  <>
                    <p style={s.meta}>Informe a quantidade perdida de cada produto e registre tudo de uma vez.</p>
                    <div style={s.loteLista}>
                      {itensParaDesperdicio.map(item => (
                        <div key={item.id} style={{ ...s.loteItem, gridTemplateColumns: isMobile ? '1fr' : 'minmax(180px, 1.5fr) minmax(110px, 0.6fr) minmax(86px, 0.55fr) minmax(160px, 1fr) minmax(160px, 1fr)' }}>
                          <div style={s.produtoMini}>
                            {item.produtoFoto && <img src={item.produtoFoto} alt={item.produtoNome} style={s.produtoMiniImg} />}
                            <div>
                              <strong style={s.codigo}>{item.produtoNome}</strong>
                              <p style={s.meta}>Disponível para desperdício: {maxDesperdicio(item)} un</p>
                            </div>
                          </div>
                          <p style={s.meta}>Disponível <strong>{maxDesperdicio(item)}</strong></p>
                          <input type="number" min="0" max={maxDesperdicio(item)} value={loteDesperdicioForm[item.id]?.quantidade || ''} onChange={e => atualizarLoteDesperdicio(item.id, 'quantidade', e.target.value)} placeholder="Qtd." style={s.inputMini} />
                          <select value={loteDesperdicioForm[item.id]?.motivo || MOTIVOS_DESPERDICIO[0]} onChange={e => atualizarLoteDesperdicio(item.id, 'motivo', e.target.value)} style={s.inputMini}>
                            {MOTIVOS_DESPERDICIO.map(motivo => <option key={motivo} value={motivo}>{motivo}</option>)}
                          </select>
                          <input value={loteDesperdicioForm[item.id]?.observacao || ''} onChange={e => atualizarLoteDesperdicio(item.id, 'observacao', e.target.value)} placeholder="Observação (opcional)" style={s.inputMini} />
                        </div>
                      ))}
                    </div>
                    <div style={s.acoes}>
                      <button type="button" style={s.btnPerigo} onClick={registrarLoteDesperdicio}><Trash2 size={15} /> Registrar desperdícios</button>
                    </div>
                  </>
                )}
              </section>
            )}

            <button type="button" style={{ ...s.fab, bottom: isMobile ? 150 : 90 }} onClick={() => { setProducaoEditando(null); setSubAbaProducao('planejar'); setTimeout(() => document.getElementById('cadastrar-planejamento')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50) }}>
              <Plus size={26} />
            </button>

            {loteProducao.length > 0 && (
              <div style={{ ...s.salvarBar, bottom: isMobile ? 64 : 0 }}>
                <button type="button" style={s.btnCancelarRascunho} onClick={cancelarRascunhoLote}>
                  <X size={16} /> Cancelar
                </button>
                <button type="button" style={s.btnSalvarPlanejamento} onClick={salvarLoteProducao}>
                  <Save size={16} /> Salvar planejamento ({loteProducao.length} {loteProducao.length === 1 ? 'item' : 'itens'})
                </button>
              </div>
            )}

            {modoSelecaoProducao && itensSelecionadosProducao.length > 0 && (
              <div style={{ ...s.salvarBar, bottom: isMobile ? 64 : 0, flexWrap: 'wrap' }}>
                <button type="button" style={s.btnLoteAcao} onClick={() => aplicarStatusLoteSelecionados('Em producao')}>
                  <Flame size={16} /> Iniciar produção ({itensSelecionadosProducao.length})
                </button>
                <button type="button" style={{ ...s.btnLoteAcao, background: '#16A34A' }} onClick={() => aplicarStatusLoteSelecionados('Pronto para venda')}>
                  <CheckCircle2 size={16} /> Marcar pronto ({itensSelecionadosProducao.length})
                </button>
                <button type="button" style={s.btnCancelarRascunho} onClick={() => aplicarStatusLoteSelecionados('Cancelado')}>
                  <X size={16} /> Cancelar
                </button>
              </div>
            )}
          </div>
        )}

        {aba === 'cardapio' && <GerenciarProdutos />}

        {aba === 'estoque' && <GerenciarEstoque />}

        {aba === 'avisos' && (
          <section style={s.sectionCard}>
            <div style={s.sectionHeader}>
              <h3 style={s.sectionTitle}><Megaphone size={18} /> Avisos da cozinha</h3>
            </div>
            <AvisosSetor setor="cozinha" />
          </section>
        )}
      </div>

      {painelDetalhe && (
        <div style={s.modalOverlay} role="dialog" aria-modal="true">
          <div style={{ ...s.modal, maxWidth: 520, padding: isMobile ? 18 : 24 }}>
            <div style={s.modalHeader}>
              <h3 style={s.modalTitle}>{TITULOS_PAINEL[painelDetalhe]}</h3>
              <button style={s.closeBtn} onClick={() => setPainelDetalhe(null)}>Fechar</button>
            </div>
            <div style={s.lista}>
              {painelDetalhe === 'pedidos' && (
                pedidosHoje.length === 0 ? <EmptyState>Nenhum pedido hoje.</EmptyState> : pedidosHoje.map(p => (
                  <div key={p.id} style={s.linhaResumo}>
                    <span>#{pedidoCodigo(p)} - {alunoNome(p)}</span>
                    <StatusBadge status={p.status} />
                  </div>
                ))
              )}
              {painelDetalhe === 'produzido' && (
                itensProduzidos.length === 0 ? <EmptyState>Nenhuma producao registrada hoje.</EmptyState> : itensProduzidos.map(item => (
                  <div key={item.id} style={s.linhaResumo}><span>{item.produtoNome}</span><strong>{item.quantidadePronta || 0} un</strong></div>
                ))
              )}
              {painelDetalhe === 'disponivel' && (
                itensDisponiveis.length === 0 ? <EmptyState>Nenhum produto disponivel agora.</EmptyState> : itensDisponiveis.map(item => (
                  <div key={item.id} style={s.linhaResumo}><span>{item.produtoNome}</span><strong>{item.quantidadeRestante || 0} un</strong></div>
                ))
              )}
              {painelDetalhe === 'desperdicio' && (
                desperdiciosHoje.length === 0 ? <EmptyState>Nenhum desperdicio registrado hoje.</EmptyState> : desperdiciosHoje.map(h => (
                  <div key={h.id} style={s.linhaResumo}>
                    <span>{h.produtoNome} - {h.quantidade} un ({h.motivo})</span>
                    <span style={s.meta}>{formatarHoraAtualizacao(h.dataHora)}</span>
                  </div>
                ))
              )}
              {painelDetalhe === 'esgotados' && (
                itensEsgotados.length === 0 ? <EmptyState>Nenhum produto esgotado hoje.</EmptyState> : itensEsgotados.map(item => (
                  <div key={item.id} style={s.linhaResumo}><span>{item.produtoNome}</span><span style={s.meta}>Atualizado {tempoDesde(item.atualizadoEm)}</span></div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {desperdicioItem && (
        <div style={s.modalOverlay} role="dialog" aria-modal="true">
          <div style={{ ...s.modal, maxWidth: 480, padding: isMobile ? 18 : 24 }}>
            <div style={s.modalHeader}>
              <div>
                <h3 style={s.modalTitle}>Registrar desperdicio</h3>
                <p style={s.meta}>{desperdicioItem.produtoNome} - Disponivel para desperdicio: {maxDesperdicio(desperdicioItem)} un</p>
              </div>
              <button style={s.closeBtn} onClick={() => setDesperdicioItem(null)}>Fechar</button>
            </div>
            <form onSubmit={confirmarDesperdicio} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input
                type="number" min="1" max={maxDesperdicio(desperdicioItem)}
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

    {calendarioAberto && (
        <div style={s.modalOverlay} role="dialog" aria-modal="true" onClick={() => setCalendarioAberto(false)}>
          <div style={{ ...s.modal, maxWidth: 360, padding: 18 }} onClick={e => e.stopPropagation()}>
            <div style={s.calendarHeader}>
              <button type="button" style={s.calendarNavBtn} onClick={() => { const d = new Date(mesVisivelTs); d.setMonth(d.getMonth() - 1); setMesVisivelTs(d.getTime()) }}>
                <ChevronLeft size={18} />
              </button>
              <strong style={{ color: '#0F172A' }}>{MESES_LABEL[new Date(mesVisivelTs).getMonth()]} {new Date(mesVisivelTs).getFullYear()}</strong>
              <button type="button" style={s.calendarNavBtn} onClick={() => { const d = new Date(mesVisivelTs); d.setMonth(d.getMonth() + 1); setMesVisivelTs(d.getTime()) }}>
                <ChevronRight size={18} />
              </button>
            </div>
            <div style={s.calendarGrid}>
              {DIAS_SEMANA_MIN.map((letra, i) => <span key={i} style={s.calendarWeekday}>{letra}</span>)}
              {diasGradeMes(mesVisivelTs).map((dia, i) => {
                if (!dia) return <span key={`vazio-${i}`} />
                const ativo = dia.ts === dataSelecionadaTs
                const hoje = dia.ts === inicioDoDiaTs(new Date())
                const temPlanejamento = diasComProducao.has(dia.ts)
                return (
                  <button
                    key={dia.ts}
                    type="button"
                    style={{
                      ...s.calendarDay,
                      background: ativo ? '#003D7C' : hoje ? '#EFF6FF' : 'transparent',
                      color: ativo ? '#fff' : hoje ? '#003D7C' : '#334155',
                      fontWeight: ativo || hoje ? 900 : 700,
                      position: 'relative',
                    }}
                    onClick={() => {
                      setDataSelecionadaTs(dia.ts)
                      setProducaoEditando(null)
                      setBuscaProducao('')
                      setFiltroProducao('todos')
                      setCalendarioAberto(false)
                      sairModoSelecaoProducao()
                    }}
                  >
                    {dia.numero}
                    {temPlanejamento && (
                      <span style={{
                        position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)',
                        width: 5, height: 5, borderRadius: '50%', background: ativo ? '#7DD3FC' : '#22C55E',
                      }} />
                    )}
                  </button>
                )
              })}
            </div>
            <button type="button" style={{ ...s.btnSecundario, width: '100%', justifyContent: 'center' }} onClick={() => setCalendarioAberto(false)}>Fechar</button>
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
  headerRow: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  headerTitulo: { margin: 0, fontWeight: 900, color: '#0F172A', fontSize: '1.35rem' },
  headerCard: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '0.2rem 0.1rem' },
  headerData: { margin: 0, fontWeight: 900, color: '#0F172A', fontSize: '1.25rem', lineHeight: 1.2 },
  headerTurnoPill: { display: 'inline-block', marginTop: 4, background: '#E8F0FB', color: '#003D7C', borderRadius: 999, padding: '0.2rem 0.7rem', fontSize: '0.75rem', fontWeight: 800 },
  atualizadoTag: { display: 'inline-flex', alignItems: 'center', gap: 5, color: '#0EA5E9', fontWeight: 800, fontSize: '0.78rem', background: '#EFF6FF', borderRadius: 999, padding: '0.35rem 0.8rem', whiteSpace: 'nowrap' },
  semanaRow: { display: 'flex', alignItems: 'center', gap: 10 },
  diasScroll: { display: 'flex', gap: 8, overflowX: 'auto', flex: 1, paddingBottom: 2 },
  divisorH: { height: 1, background: '#EEF2F6', margin: '2px 0' },
  turnoRow: { display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' },
  turnoRowLabel: { fontSize: '0.72rem', fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, minWidth: 40 },
  turnoBtn: { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '0.55rem 1.1rem', borderRadius: 12, border: '1.5px solid #E2E8F0', background: '#fff', color: '#64748B', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' },
  turnoBtnAtivo: { background: '#003D7C', borderColor: '#003D7C', color: '#fff', boxShadow: '0 4px 12px rgba(0,61,124,0.28)' },
  statsSlim: { background: '#fff', borderRadius: 16, padding: '1.1rem 1.2rem', boxShadow: '0 6px 18px rgba(15,23,42,0.05)', display: 'flex', flexDirection: 'column', gap: 14 },
  statsGridRow: { display: 'grid', gap: 10 },
  statsSlimItem: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 },
  statsSlimLabel: { fontSize: '0.76rem', color: '#64748B', fontWeight: 700 },
  progressoRow2: { display: 'flex', alignItems: 'center', gap: 12 },
  progressoLabel: { fontSize: '0.8rem', color: '#64748B', fontWeight: 700, whiteSpace: 'nowrap' },
  progressoPercent: { fontSize: '0.88rem', fontWeight: 900, color: '#0F172A', minWidth: 38, textAlign: 'right' },
  subAbas: { display: 'flex', gap: 8, background: '#F1F5F9', borderRadius: 14, padding: 4 },
  subAbaBtn: { flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: 'none', background: 'transparent', color: '#64748B', borderRadius: 10, padding: '0.6rem 0.8rem', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' },
  subAbaBtnAtivo: { background: '#fff', color: '#003D7C', boxShadow: '0 2px 8px rgba(15,23,42,0.08)' },
  loteToggleBtn: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, fontFamily: 'inherit' },
  grupoDiaTurno: { display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 4 },
  grupoDiaTurnoHeader: { display: 'flex', alignItems: 'center', gap: 8, paddingTop: 6, borderTop: '1px solid #E2E8F0', marginTop: 4 },
  turnoChip: { background: '#E8F0FB', color: '#003D7C', borderRadius: 999, padding: '0.18rem 0.6rem', fontSize: '0.74rem', fontWeight: 800 },
  calendarBtn: { width: 48, height: 48, borderRadius: 12, border: '1.5px solid #E2E8F0', background: '#fff', color: '#003D7C', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 },
  calendarHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  calendarNavBtn: { width: 32, height: 32, borderRadius: 8, border: 'none', background: '#F1F5F9', color: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  calendarGrid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 16 },
  calendarWeekday: { textAlign: 'center', fontSize: '0.72rem', fontWeight: 800, color: '#94A3B8', padding: '4px 0' },
  calendarDay: { aspectRatio: '1', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  quickActionsGrid: { display: 'grid', gap: 10 },
  quickAction: { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: '0.85rem 0.7rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, fontWeight: 800, fontSize: '0.8rem', color: '#0F172A', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 6px 18px rgba(15,23,42,0.05)', textAlign: 'center' },
  quickActionIcon: { width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  progressoRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  progressoBox: { display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 160 },
  progressoTrack: { flex: 1, height: 10, borderRadius: 999, background: '#E2E8F0', overflow: 'hidden' },
  progressoFill: { height: '100%', borderRadius: 999, background: 'linear-gradient(90deg,#003D7C,#22C55E)', transition: 'width 0.3s' },
  campoLabel: { display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#475569', marginBottom: 5 },
  prodRow: { border: '1px solid #E5E7EB', background: '#fff', borderRadius: 14, padding: '0.7rem 0.85rem', display: 'flex', flexDirection: 'column', gap: 8 },
  prodRowSelecionada: { background: '#EFF6FF', border: '1px solid #93C5FD' },
  prodRowTop: { display: 'flex', alignItems: 'center', gap: 10 },
  prodRowQtd: { color: '#0F172A', fontSize: '0.88rem', whiteSpace: 'nowrap' },
  checkOn: { width: 22, height: 22, borderRadius: 6, border: '2px solid #3B82F6', background: '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  checkOff: { width: 22, height: 22, borderRadius: 6, border: '2px solid #CBD5E1', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  produtoMiniThumb: { width: 40, height: 40, borderRadius: 10, overflow: 'hidden', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  iconBtnMenu: { width: 34, height: 34, borderRadius: 10, border: 'none', background: '#F1F5F9', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, marginLeft: 'auto' },
  menuAcoes: { display: 'flex', flexDirection: 'column', gap: 7, paddingTop: 8, borderTop: '1px solid #E2E8F0' },
  filtroCount: { background: 'rgba(0,0,0,0.08)', borderRadius: 999, padding: '0.05rem 0.5rem', fontSize: '0.7rem', fontWeight: 900 },
  fab: { position: 'fixed', right: 20, width: 56, height: 56, borderRadius: '50%', background: '#F47920', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 20px rgba(244,121,32,0.4)', cursor: 'pointer', zIndex: 50 },
  salvarBar: { position: 'fixed', left: 0, right: 0, padding: '0.7rem 1rem', background: '#fff', borderTop: '1px solid #E2E8F0', boxShadow: '0 -8px 20px rgba(15,23,42,0.06)', zIndex: 40, display: 'flex', justifyContent: 'center', gap: 10 },
  btnSalvarPlanejamento: { background: '#003D7C', color: '#fff', border: 'none', borderRadius: 12, padding: '0.85rem 1.2rem', fontWeight: 900, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'inherit', flex: 1, maxWidth: 400 },
  btnCancelarRascunho: { background: '#FEE2E2', color: '#DC2626', border: 'none', borderRadius: 12, padding: '0.85rem 1rem', fontWeight: 900, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'inherit', flexShrink: 0 },
  btnLoteAcao: { background: '#F59E0B', color: '#fff', border: 'none', borderRadius: 12, padding: '0.85rem 1rem', fontWeight: 900, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'inherit', flex: 1, whiteSpace: 'nowrap' },
  statsGrid: { display: 'grid', gap: 12, alignItems: 'stretch' },
  statCard: { background: '#fff', borderRadius: 14, padding: 16, boxShadow: '0 8px 24px rgba(15,23,42,0.06)', display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 },
  statIcon: { width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  statLabel: { color: '#64748B', fontSize: '0.78rem', fontWeight: 700, lineHeight: 1.25, minHeight: '2.1em', display: 'flex', alignItems: 'flex-end' },
  statValue: { fontSize: '1.4rem', fontWeight: 900, lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  statUnidade: { fontSize: '0.75rem', fontWeight: 700, opacity: 0.7 },
  contentGrid: { display: 'grid', gap: 16, alignItems: 'start' },
  formGrid2: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 },
  formGridRapido: { display: 'grid', gap: 10, alignItems: 'center' },
  sectionCard: { background: '#fff', borderRadius: 18, padding: 20, boxShadow: '0 8px 24px rgba(15,23,42,0.06)', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 },
  sectionHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  sectionTitle: { margin: 0, fontWeight: 900, color: '#0F172A', fontSize: '1rem', display: 'inline-flex', alignItems: 'center', gap: 8 },
  lista: { display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 },
  producaoCard: { border: '1px solid #E5E7EB', borderLeft: '5px solid #CBD5E1', background: '#fff', borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 12, boxShadow: '0 6px 18px rgba(15,23,42,0.05)' },
  pedidoTop: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  codigo: { color: '#0F172A', fontWeight: 900 },
  meta: { color: '#64748B', fontSize: '0.84rem', margin: 0, lineHeight: 1.45 },
  badge: { borderRadius: 999, padding: '0.25rem 0.7rem', fontSize: '0.74rem', fontWeight: 900, whiteSpace: 'nowrap' },
  filtros: { display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, flexWrap: 'nowrap' },
  filtroBtn: { border: 'none', borderRadius: 999, padding: '0.5rem 0.9rem', fontWeight: 800, fontSize: '0.84rem', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.15s' },
  searchBox: { display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #CBD5E1', borderRadius: 12, padding: '0 0.75rem', minHeight: 44, background: '#fff', minWidth: 240 },
  searchInput: { border: 'none', outline: 'none', fontFamily: 'inherit', flex: 1, minWidth: 0, fontWeight: 700 },
  input: { border: '1px solid #CBD5E1', borderRadius: 12, padding: '0.72rem 0.8rem', fontFamily: 'inherit', outlineColor: '#003D7C', minHeight: 44 },
  inputMini: { border: '1px solid #CBD5E1', borderRadius: 10, padding: '0.55rem 0.65rem', fontFamily: 'inherit', outlineColor: '#003D7C', minHeight: 38, minWidth: 0, width: '100%', boxSizing: 'border-box' },
  checkRow: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  checkLabel: { display: 'inline-flex', alignItems: 'center', gap: 7, color: '#475569', fontWeight: 800, fontSize: '0.83rem' },
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
  produtoCardGrid: { background: '#fff', borderRadius: 14, padding: '0.85rem', display: 'flex', flexDirection: 'column', boxShadow: '0 2px 8px rgba(15,23,42,0.05)' },
  qtyBtn: { width: 30, height: 30, borderRadius: 8, border: '1px solid #CBD5E1', background: '#F8FAFC', color: '#334155', fontWeight: 900, fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'inherit' },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modal: { width: '100%', maxWidth: 820, maxHeight: '90vh', overflowY: 'auto', background: '#fff', borderRadius: 18, boxShadow: '0 24px 80px rgba(15,23,42,0.25)' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, marginBottom: 16 },
  modalTitle: { margin: 0, color: '#0F172A', fontSize: '1.2rem', fontWeight: 900 },
  closeBtn: { border: 'none', background: '#003D7C', color: '#fff', borderRadius: 10, minHeight: 40, padding: '0 0.9rem', fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit' },
}
