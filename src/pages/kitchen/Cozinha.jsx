import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  ArchiveRestore, Calendar, CheckCircle2, ChevronLeft, ChevronRight, ClipboardList, CloudSun, Flame,
  Megaphone, Moon, PackageCheck, PlusCircle, RefreshCw as RefreshIcon, Save, Sun, Trash2, Utensils, X, XCircle,
} from 'lucide-react'
import Layout from '../../components/Layout'
import AvisosSetor from '../../components/AvisosSetor'
import GerenciarEstoque from '../../components/GerenciarEstoque'
import GerenciarProdutos from '../../components/GerenciarProdutos'
import { AreaPlanejamento, AvisoPlanejamentoSalvo } from '../../components/cozinha/PlanejamentoProducao'
import ListaProducao from '../../components/cozinha/ListaProducao'
import { useApp } from '../../contexts/AppContext'
import { MOTIVOS_DESPERDICIO } from '../../contexts/hooks/useProducaoDiaria'
import { produtoDisponivelNoDia } from '../../utils/cardapioDias'
import { useIsMobile } from '../../utils/useIsMobile'
import { codigoPedido as pedidoCodigo } from '../../utils/pedidos'
import { dadosParaStatusProducao, maxDesperdicio as maxDescarte, normalizarStatusProducao as normalizeStatus, visualStatusProducao as producaoStatusVisual } from '../../utils/producao'
import { useTempoAtual } from '../../utils/useTempoAtual'

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

const CATEGORIAS_PRODUCAO = ['Todos', 'Lanches', 'Salgados', 'Doces']

function categoriaProducaoValida(produto) {
  const categoriaOk = ['lanches', 'salgados', 'doces'].includes(String(produto?.categoria || '').trim().toLowerCase())
  return categoriaOk && produto?.visivelPlanejamento !== false
}

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

function labelDia(ts, referencia = Date.now()) {
  const hoje = inicioDoDiaTs(new Date(referencia))
  if (ts === hoje) return 'Hoje'
  if (ts === hoje + 24 * 60 * 60 * 1000) return 'Amanhã'
  return formatarDiaCompleto(ts)
}

function semanaContendo(refTs, referencia = Date.now()) {
  const ref = new Date(refTs)
  const dom = new Date(ref)
  dom.setDate(ref.getDate() - ref.getDay())
  dom.setHours(0, 0, 0, 0)
  const hojeTs = inicioDoDiaTs(new Date(referencia))
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

function inicioDoDia(referencia = Date.now()) {
  const data = new Date(referencia)
  data.setHours(0, 0, 0, 0)
  return data.getTime()
}

function statusVisual(status) {
  const normal = normalizeStatus(status)
  if (normal === 'recebido' || normal === 'pendente') return { label: 'Pendente', bg: '#FEF3C7', color: '#92400E' }
  if (normal === 'em preparo' || normal === 'preparando') return { label: 'Preparando', bg: '#DBEAFE', color: '#1D4ED8' }
  if (normal === 'pronto') return { label: 'Pronto', bg: '#DCFCE7', color: '#166534' }
  if (normal === 'entregue') return { label: 'Entregue', bg: '#DCFCE7', color: '#166534' }
  if (normal === 'cancelado') return { label: 'Cancelado', bg: '#FEE2E2', color: '#B91C1C' }
  return { label: status || 'Não informado', bg: '#F1F5F9', color: '#475569' }
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

function alunoNome(pedido) {
  return pedido?.alunoNome || pedido?.nomeAluno || pedido?.aluno || pedido?.nome || 'Aluno não informado'
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
  descarte: 'Descarte registrado hoje',
  esgotados: 'Produtos esgotados',
}

function StatusBadge({ status }) {
  const visual = statusVisual(status)
  return <span style={{ ...s.badge, background: visual.bg, color: visual.color }}>{visual.label}</span>
}

export default function Cozinha() {
  const { pedidos, produtos, atualizarProduto, criarAviso, avisos, producaoDiaria, producaoHoje, salvarProducao, atualizarProducao, removerProducao, registrarDesperdicio: registrarDescarte } = useApp()
  const location = useLocation()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const tempoAtual = useTempoAtual(60000)
  const aba = abaPorRota(location.pathname)
  const [formProducao, setFormProducao] = useState(FORM_PRODUCAO)
  const [loteProducao, setLoteProducao] = useState([])
  const [producaoEditando, setProducaoEditando] = useState(null)
  const [buscaProducao, setBuscaProducao] = useState('')
  const [filtroProducao, setFiltroProducao] = useState('todos')
  const [descarteItem, setDescarteItem] = useState(null)
  const [formDescarte, setFormDescarte] = useState(FORM_DESPERDICIO)
  const [painelDetalhe, setPainelDetalhe] = useState(null)
  const [dataSelecionadaTs, setDataSelecionadaTs] = useState(() => inicioDoDiaTs(new Date()))
  const [calendarioAberto, setCalendarioAberto] = useState(false)
  const [mesVisivelTs, setMesVisivelTs] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d.getTime() })
  const [turnoSelecionado, setTurnoSelecionado] = useState(turnoAtual())
  const [qtdPorProduto, setQtdPorProduto] = useState({})
  const [buscaProduto, setBuscaProduto] = useState('')
  const [filtroCategoriaProducao, setFiltroCategoriaProducao] = useState('Todos')
  const horarioPrevistoForm = ''
  const [loteDescarteForm, setLoteDescarteForm] = useState({})
  const [menuAbertoId, setMenuAbertoId] = useState(null)
  const [verTodosProdutos, setVerTodosProdutos] = useState(false)
  const [subAbaProducao, setSubAbaProducao] = useState('producao')
  const [loteDescarteAberto, setLoteDescarteAberto] = useState(false)
  const [modoSelecaoProducao, setModoSelecaoProducao] = useState(false)
  const [itensSelecionadosProducao, setItensSelecionadosProducao] = useState([])
  const [gerandoPDFProducao, setGerandoPDFProducao] = useState(false)
  const [planejamentoSalvo, setPlanejamentoSalvo] = useState(null)

  function selecionarAba(id) {
    navigate(ROTAS_ABA[id] || '/cozinha')
  }

  function irParaProducao() {
    setSubAbaProducao('producao')
    setPlanejamentoSalvo(null)
    setTimeout(() => document.getElementById('producao-lista')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  const hoje = useMemo(() => inicioDoDia(tempoAtual), [tempoAtual])
  const pedidosHoje = useMemo(() => pedidos.filter(p => (p.criadoEm || 0) >= hoje), [pedidos, hoje])
  const producaoOrdenada = useMemo(() => [...(producaoHoje || [])].sort((a, b) => (b.atualizadoEm || b.criadoEm || 0) - (a.atualizadoEm || a.criadoEm || 0)), [producaoHoje])
  const totalProduzidoHoje = producaoOrdenada.reduce((acc, item) => acc + Number(item.quantidadePronta || 0), 0)
  const produtosEsgotados = producaoOrdenada.filter(item => normalizeStatus(item.status) === 'esgotado').length
  const totalDisponivelHoje = producaoOrdenada.reduce((acc, item) => acc + Number(item.quantidadeRestante || 0), 0)
  const totalDescartadoHoje = producaoOrdenada.reduce((acc, item) => acc + Number(item.quantidadeDesperdicada || 0), 0)
  const estoqueBaixoCozinha = useMemo(
    () => produtos.filter(p => Number(p.estoqueBaixo || 0) > 0 && Number(p.estoque || 0) <= Number(p.estoqueBaixo || 0)).length,
    [produtos]
  )
  const descartesHoje = useMemo(() => {
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
  const semanaDatas = useMemo(() => semanaContendo(dataSelecionadaTs, tempoAtual), [dataSelecionadaTs, tempoAtual])
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
  const itensParaDescarte = useMemo(() => producaoDoDiaTurno.filter(item => maxDescarte(item) > 0 && normalizeStatus(item.status) !== 'cancelado'), [producaoDoDiaTurno])
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
  const produtosProducao = useMemo(() => produtos.filter(categoriaProducaoValida), [produtos])
  const produtosFiltrados = useMemo(() => {
    const t = buscaProduto.trim().toLowerCase()
    const base = filtroCategoriaProducao === 'Todos'
      ? produtosProducao
      : produtosProducao.filter(p => String(p.categoria || '').trim().toLowerCase() === filtroCategoriaProducao.toLowerCase())
    return t ? base.filter(p => p.nome?.toLowerCase().includes(t) || p.categoria?.toLowerCase().includes(t)) : base
  }, [produtosProducao, buscaProduto, filtroCategoriaProducao])
  const produtosRapidos = useMemo(() => {
    const contagem = {}
    ;(producaoDiaria || []).forEach(item => { contagem[item.produtoId] = (contagem[item.produtoId] || 0) + 1 })
    return [...produtosProducao].sort((a, b) => (contagem[String(b.id)] || 0) - (contagem[String(a.id)] || 0)).slice(0, 8)
  }, [produtosProducao, producaoDiaria])
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
    const hojeTs = inicioDoDiaTs(new Date(tempoAtual))
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
      await atualizarProduto({ ...produto, estoque: item.quantidadeRestante })
      await atualizarProducao(item.id, item, { estoqueLiberado: true }, { acao: 'Liberou no cardápio automaticamente' })
    })
  }, [producaoDiaria, produtos, atualizarProduto, atualizarProducao, tempoAtual])

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
      await atualizarProduto({ ...produto, estoque: salvo.quantidadeRestante })
    }
    if (salvo.status === 'Esgotado' || salvo.status === 'Cancelado') {
      await atualizarProduto({ ...produto, estoque: 0 })
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

  function removerItemLote(index) {
    setLoteProducao(prev => prev.filter((_, i) => i !== index))
  }

  function cancelarRascunhoLote() {
    if (loteProducao.length === 0) return
    if (!confirm(`Remover os ${loteProducao.length} item(ns) do rascunho?`)) return
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
      if (!confirm(`Remover ${itens.length} item(ns) selecionado(s) da producao?`)) return
      for (const item of itens) {
        const jaEstavaLiberado = item.estoqueLiberado || ['pronto para venda', 'parcialmente pronto'].includes(normalizeStatus(item.status))
        if (jaEstavaLiberado) {
          const produto = produtos.find(p => String(p.id) === String(item.produtoId))
          if (produto) await atualizarProduto({ ...produto, estoque: 0 })
        }
        await removerProducao(item.id, item)
      }
    } else {
      const erros = []
      for (const item of itens) {
        try {
          await mudarStatusProducao(item, status, { silencioso: true })
        } catch (error) {
          erros.push(item.produtoNome || item.produtoId || 'Produto')
          console.error('status lote producao:', error)
        }
      }
      if (['Pronto para venda', 'Parcialmente pronto'].includes(status)) {
        alert(erros.length
          ? `Produtos marcados como prontos e liberados no cardapio do dia. Erro em: ${erros.join(', ')}.`
          : 'Produtos marcados como prontos e liberados no cardapio do dia.')
      }
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
    let totalSalvos = 0
    for (const item of loteProducao) {
      const payload = montarPayloadProducao(item)
      if (payload) {
        const salvo = await salvarProducao(payload)
        await sincronizarEstoqueProducao(salvo)
        totalSalvos += 1
      }
    }
    setLoteProducao([])
    if (totalSalvos > 0) {
      setPlanejamentoSalvo(`${totalSalvos} ${totalSalvos === 1 ? 'produto foi adicionado' : 'produtos foram adicionados'} ao planejamento.`)
    }
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

  async function mudarStatusProducao(item, status, opcoes = {}) {
    const produto = produtos.find(p => String(p.id) === String(item.produtoId))
    const diaTs = Number(item.dataProducaoTs || item.criadoEm || Date.now())
    const ehHoje = diaTs === inicioDoDiaTs(new Date())
    const dados = dadosParaStatusProducao(item, status, ehHoje)
    const liberaCardapio = ehHoje && ['Pronto para venda', 'Parcialmente pronto'].includes(status)
    const atualizado = await atualizarProducao(item.id, item, dados, {
      acao: liberaCardapio ? 'Produto marcado como pronto e liberado no cardapio do dia.' : `Marcou como ${status}`,
    })
    if (!ehHoje && ['Pronto para venda', 'Parcialmente pronto', 'Esgotado'].includes(status)) {
      alert(`Esse item é da produção planejada para ${formatarDiaCompleto(diaTs)}. Ele só vai entrar no cardápio do aluno nesse dia, não agora.`)
      return
    }
    if (produto && ['Pronto para venda', 'Parcialmente pronto'].includes(status)) {
      const diaSemana = DIAS_SEMANA_ORD[new Date(diaTs).getDay()]
      let diasCardapio = produto.diasCardapio || produto.diasProducao || []
      if (opcoes.perguntarDias && !produtoDisponivelNoDia(produto, diaSemana)) {
        const adicionar = confirm(
          `${produto.nome} ficará pronto, mas os "Dias de produção" cadastrados desse produto não incluem ${DIAS_FULL[diaSemana]} — por isso ele NÃO vai aparecer no cardápio do aluno hoje.\n\nQuer adicionar ${DIAS_FULL[diaSemana]} aos dias de produção desse produto agora?`
        )
        if (adicionar) diasCardapio = [...diasCardapio, diaSemana]
      }
      if (!diasCardapio.includes(diaSemana)) diasCardapio = [...diasCardapio, diaSemana]
      await atualizarProduto({ ...produto, disponivel: true, estoque: atualizado.quantidadeRestante, diasCardapio })
      if (!opcoes.silencioso) alert('Produto marcado como pronto e liberado no cardápio do dia.')
    }
    if (produto && status === 'Esgotado') {
      await atualizarProduto({ ...produto, estoque: 0 })
    }
  }

  async function cancelarProducao(item) {
    if (!confirm(`Cancelar producao de ${item.produtoNome}?`)) return
    const jaEstavaLiberado = item.estoqueLiberado || ['pronto para venda', 'parcialmente pronto'].includes(normalizeStatus(item.status))
    if (jaEstavaLiberado) {
      const produto = produtos.find(p => String(p.id) === String(item.produtoId))
      if (produto) await atualizarProduto({ ...produto, estoque: 0 })
    }
    await removerProducao(item.id, item)
  }

  function abrirDescarte(item) {
    setDescarteItem(item)
    setFormDescarte(FORM_DESPERDICIO)
  }

  async function confirmarDescarte(e) {
    e.preventDefault()
    const quantidade = Number(formDescarte.quantidade)
    if (!descarteItem || !quantidade || quantidade <= 0) {
      alert('Informe uma quantidade valida para registrar o descarte.')
      return
    }
    if (quantidade > maxDescarte(descarteItem)) {
      alert('A quantidade informada é maior que o disponível para este produto.')
      return
    }
    const resultado = await registrarDescarte(descarteItem.id, descarteItem, {
      quantidade,
      motivo: formDescarte.motivo,
      observacao: formDescarte.observacao,
    })
    const itemTs = Number(descarteItem.dataProducaoTs || descarteItem.criadoEm || 0)
    const produto = produtos.find(p => String(p.id) === String(descarteItem.produtoId))
    if (produto && itemTs === inicioDoDiaTs(new Date())) {
      await atualizarProduto({ ...produto, estoque: resultado.quantidadeRestante })
    }
    setDescarteItem(null)
    setFormDescarte(FORM_DESPERDICIO)
  }

  function atualizarLoteDescarte(id, campo, valor) {
    setLoteDescarteForm(prev => ({
      ...prev,
      [id]: { quantidade: '', motivo: MOTIVOS_DESPERDICIO[0], observacao: '', ...prev[id], [campo]: valor },
    }))
  }

  async function registrarLoteDescarte() {
    const itens = Object.entries(loteDescarteForm)
      .map(([id, dados]) => ({ id, ...dados, quantidade: Number(dados.quantidade) }))
      .filter(({ quantidade }) => quantidade > 0)
    if (itens.length === 0) {
      alert('Informe a Quantidade descartada de pelo menos um produto.')
      return
    }
    for (const { id, quantidade, motivo, observacao } of itens) {
      const item = producaoDoDia.find(p => p.id === id)
      if (!item) continue
      if (quantidade > maxDescarte(item)) continue
      const resultado = await registrarDescarte(item.id, item, {
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
    setLoteDescarteForm({})
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
    setPlanejamentoSalvo(`${produto.nome} foi ${jaExiste ? 'atualizado no' : 'adicionado ao'} planejamento.`)
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
                <StatCard icon={Trash2} label="Descartado" value={totalDescartadoHoje} unidade="un" color="#EF4444" onClick={() => setPainelDetalhe('descarte')} />
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
                  <h3 style={s.sectionTitle}>Produção planejada — {labelDia(dataSelecionadaTs, tempoAtual)}</h3>
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
                <EmptyState>Nenhuma produção planejada para {labelDia(dataSelecionadaTs, tempoAtual)}. Cadastre o que será produzido na aba Produção.</EmptyState>
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
                              <p style={s.meta}>Pronto {item.quantidadePronta || 0} un - Disponivel {item.quantidadeRestante || 0} un - Descartado {item.quantidadeDesperdicada || 0} un</p>
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
              <div style={{ ...s.statsGridRow, gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))' }}>
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
                <button style={{ ...s.subAbaBtn, ...(subAbaProducao === 'producao' ? s.subAbaBtnAtivo : {}) }} onClick={() => { setSubAbaProducao('producao'); setPlanejamentoSalvo(null) }}>
                  Produção {contagemStatus.todos > 0 && <span style={s.filtroCount}>{contagemStatus.todos}</span>}
                </button>
                <button style={{ ...s.subAbaBtn, ...(subAbaProducao === 'planejar' ? s.subAbaBtnAtivo : {}) }} onClick={() => setSubAbaProducao('planejar')}>
                  <PlusCircle size={14} /> Planejar
                </button>
              </div>
            )}

            {planejamentoSalvo && subAbaProducao === 'planejar' && (
              <AvisoPlanejamentoSalvo mensagem={planejamentoSalvo} onIrProducao={irParaProducao} styles={s} />
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
                <div style={{ ...s.formGridRapido, gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, minmax(0, 1fr))' }}>
                  <input type="number" min="0" value={formProducao.quantidadePlanejada} onChange={e => setFormProducao({ ...formProducao, quantidadePlanejada: e.target.value })} placeholder="Qtd. planejada" style={s.input} />
                  <input type="number" min="0" value={formProducao.quantidadeEmProducao} onChange={e => setFormProducao({ ...formProducao, quantidadeEmProducao: e.target.value })} placeholder="Em produção" style={s.input} />
                  <input type="number" min="0" value={formProducao.quantidadePronta} onChange={e => setFormProducao({ ...formProducao, quantidadePronta: e.target.value })} placeholder="Qtd. pronta" style={s.input} />
                  <input type="time" value={formProducao.horarioPrevisto} onChange={e => setFormProducao({ ...formProducao, horarioPrevisto: e.target.value })} style={s.input} />
                </div>
                <div style={{ ...s.formGrid2, gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) minmax(0, 2fr)' }}>
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

            {!producaoEditando && subAbaProducao === 'planejar' && (
              <AreaPlanejamento
                isMobile={isMobile}
                formProducao={formProducao}
                setFormProducao={setFormProducao}
                produtos={produtosProducao}
                turnos={TURNOS}
                turnoSelecionado={turnoSelecionado}
                adicionarItemLote={adicionarItemLote}
                loteProducao={loteProducao}
                turnoLabels={TURNO_LABEL}
                removerItemLote={removerItemLote}
                verTodosProdutos={verTodosProdutos}
                setVerTodosProdutos={setVerTodosProdutos}
                buscaProduto={buscaProduto}
                setBuscaProduto={setBuscaProduto}
                categorias={CATEGORIAS_PRODUCAO}
                filtroCategoria={filtroCategoriaProducao}
                setFiltroCategoria={setFiltroCategoriaProducao}
                produtosFiltrados={produtosFiltrados}
                produtosRapidos={produtosRapidos}
                producaoDoDiaTurno={producaoDoDiaTurno}
                qtdPorProduto={qtdPorProduto}
                setQtdPorProduto={setQtdPorProduto}
                planejarProduto={planejarProduto}
                styles={s}
              />
            )}

            {!producaoEditando && subAbaProducao === 'producao' && (
              <ListaProducao
                isMobile={isMobile}
                titulo={`Produção — ${formatarDiaCompleto(dataSelecionadaTs)} (${TURNO_LABEL[turnoSelecionado]})`}
                vazioTexto={`Nenhuma produção planejada para ${formatarDiaCompleto(dataSelecionadaTs)} (${TURNO_LABEL[turnoSelecionado]}).`}
                modoSelecao={modoSelecaoProducao}
                sairModoSelecao={sairModoSelecaoProducao}
                selecionarTodos={selecionarTodosProducao}
                todosSelecionados={itensSelecionadosProducao.length === producaoDoDiaFiltrada.filter(item => normalizeStatus(item.status) !== 'cancelado').length}
                itensSelecionados={itensSelecionadosProducao}
                itensDoTurno={producaoDoDiaTurno}
                itensFiltrados={producaoDoDiaFiltrada}
                busca={buscaProducao}
                setBusca={setBuscaProducao}
                iniciarSelecao={() => setModoSelecaoProducao(true)}
                statusDisponiveis={STATUS_PRODUCAO}
                filtro={filtroProducao}
                setFiltro={setFiltroProducao}
                contagemStatus={contagemStatus}
                toggleSelecao={toggleSelecaoProducao}
                menuAbertoId={menuAbertoId}
                setMenuAbertoId={setMenuAbertoId}
                mudarStatus={mudarStatusProducao}
                editar={editarPlanejamento}
                avisarVendedor={avisarVendedor}
                abrirDescarte={abrirDescarte}
                cancelar={cancelarProducao}
                tempoDesde={tempoDesde}
                styles={s}
              />
            )}

            {/* Desperdício em lote (mostra itens do dia selecionado) */}
            {!producaoEditando && subAbaProducao === 'producao' && itensParaDescarte.length > 0 && (
              <section id="descarte-lote" style={s.sectionCard}>
                <button type="button" style={s.loteToggleBtn} onClick={() => setLoteDescarteAberto(v => !v)}>
                  <span style={s.sectionTitle}><Trash2 size={16} /> Registrar descarte em lote</span>
                  <ChevronRight size={16} style={{ transform: loteDescarteAberto ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }} />
                </button>
                {loteDescarteAberto && (
                  <>
                    <p style={s.meta}>Informe a quantidade perdida de cada produto e registre tudo de uma vez.</p>
                    <div style={s.loteLista}>
                      {itensParaDescarte.map(item => (
                        <div key={item.id} style={{ ...s.loteItem, gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1.5fr) minmax(0, 0.6fr) minmax(0, 0.55fr) minmax(0, 1fr) minmax(0, 1fr)' }}>
                          <div style={s.produtoMini}>
                            {item.produtoFoto && <img src={item.produtoFoto} alt={item.produtoNome} style={s.produtoMiniImg} />}
                            <div>
                              <strong style={s.codigo}>{item.produtoNome}</strong>
                              <p style={s.meta}>Disponível para descarte: {maxDescarte(item)} un</p>
                            </div>
                          </div>
                          <p style={s.meta}>Disponível <strong>{maxDescarte(item)}</strong></p>
                          <input type="number" min="0" max={maxDescarte(item)} value={loteDescarteForm[item.id]?.quantidade || ''} onChange={e => atualizarLoteDescarte(item.id, 'quantidade', e.target.value)} placeholder="Qtd." style={s.inputMini} />
                          <select value={loteDescarteForm[item.id]?.motivo || MOTIVOS_DESPERDICIO[0]} onChange={e => atualizarLoteDescarte(item.id, 'motivo', e.target.value)} style={s.inputMini}>
                            {MOTIVOS_DESPERDICIO.map(motivo => <option key={motivo} value={motivo}>{motivo}</option>)}
                          </select>
                          <input value={loteDescarteForm[item.id]?.observacao || ''} onChange={e => atualizarLoteDescarte(item.id, 'observacao', e.target.value)} placeholder="Observação (opcional)" style={s.inputMini} />
                        </div>
                      ))}
                    </div>
                    <div style={s.acoes}>
                      <button type="button" style={s.btnPerigo} onClick={registrarLoteDescarte}><Trash2 size={15} /> Registrar descartes</button>
                    </div>
                  </>
                )}
              </section>
            )}

            {loteProducao.length > 0 && (
              <div style={{ ...s.salvarBar, ...(isMobile ? s.salvarBarMobile : {}), bottom: isMobile ? 64 : 0 }}>
                <button type="button" style={s.btnCancelarRascunho} onClick={cancelarRascunhoLote}>
                  <X size={16} /> Remover itens
                </button>
                <button type="button" style={s.btnSalvarPlanejamento} onClick={salvarLoteProducao}>
                  <Save size={16} /> Salvar planejamento ({loteProducao.length} {loteProducao.length === 1 ? 'item' : 'itens'})
                </button>
              </div>
            )}

            {modoSelecaoProducao && itensSelecionadosProducao.length > 0 && (
              <div style={{ ...s.salvarBar, ...(isMobile ? s.salvarBarMobile : {}), bottom: isMobile ? 64 : 0, flexWrap: 'wrap' }}>
                <button type="button" style={s.btnLoteAcao} onClick={() => aplicarStatusLoteSelecionados('Em producao')}>
                  <Flame size={16} /> Iniciar produção ({itensSelecionadosProducao.length})
                </button>
                <button type="button" style={{ ...s.btnLoteAcao, background: '#16A34A' }} onClick={() => aplicarStatusLoteSelecionados('Pronto para venda')}>
                  <CheckCircle2 size={16} /> Marcar selecionados como prontos
                </button>
                <button type="button" style={s.btnCancelarRascunho} onClick={() => aplicarStatusLoteSelecionados('Cancelado')}>
                  <Trash2 size={16} /> Remover itens
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
                    <span>Pedido {pedidoCodigo(p)} - {alunoNome(p)}</span>
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
              {painelDetalhe === 'descarte' && (
                descartesHoje.length === 0 ? <EmptyState>Nenhum descarte registrado hoje.</EmptyState> : descartesHoje.map(h => (
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

      {descarteItem && (
        <div style={s.modalOverlay} role="dialog" aria-modal="true">
          <div style={{ ...s.modal, maxWidth: 480, padding: isMobile ? 18 : 24 }}>
            <div style={s.modalHeader}>
              <div>
                <h3 style={s.modalTitle}>Registrar descarte</h3>
                <p style={s.meta}>{descarteItem.produtoNome} - Disponivel para descarte: {maxDescarte(descarteItem)} un</p>
              </div>
              <button style={s.closeBtn} onClick={() => setDescarteItem(null)}>Fechar</button>
            </div>
            <form onSubmit={confirmarDescarte} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input
                type="number" min="1" max={maxDescarte(descarteItem)}
                value={formDescarte.quantidade}
                onChange={e => setFormDescarte({ ...formDescarte, quantidade: e.target.value })}
                placeholder="Quantidade descartada" style={s.input} required
              />
              <select value={formDescarte.motivo} onChange={e => setFormDescarte({ ...formDescarte, motivo: e.target.value })} style={s.input}>
                {MOTIVOS_DESPERDICIO.map(motivo => <option key={motivo} value={motivo}>{motivo}</option>)}
              </select>
              <input
                value={formDescarte.observacao}
                onChange={e => setFormDescarte({ ...formDescarte, observacao: e.target.value })}
                placeholder="Observacao (opcional)" style={s.input}
              />
              <div style={s.acoes}>
                <button type="submit" style={s.btnPrimario}><Trash2 size={15} /> Confirmar descarte</button>
                <button type="button" style={s.btnSecundario} onClick={() => setDescarteItem(null)}>Cancelar</button>
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
  producaoPage: { display: 'flex', flexDirection: 'column', gap: 16, width: '100%', minWidth: 0, overflowX: 'hidden' },
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
  diasScroll: { display: 'flex', gap: 8, overflowX: 'auto', flex: 1, minWidth: 0, paddingBottom: 2 },
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
  planejamentoSucesso: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '0.8rem 0.9rem', borderRadius: 12, border: '1px solid #86EFAC', background: '#F0FDF4', color: '#166534' },
  planejamentoSucessoTexto: { display: 'flex', alignItems: 'center', gap: 9, minWidth: 0, flex: 1 },
  btnIrProducao: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, minHeight: 40, padding: '0.55rem 0.8rem', borderRadius: 10, border: 'none', background: '#15803D', color: '#fff', fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
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
  qtyControl: { display: 'flex', alignItems: 'center', gap: 6, width: '100%', minWidth: 0 },
  prodRow: { border: '1px solid #E5E7EB', background: '#fff', borderRadius: 14, padding: '0.7rem 0.85rem', display: 'flex', flexDirection: 'column', gap: 8 },
  prodRowSelecionada: { background: '#EFF6FF', border: '1px solid #93C5FD' },
  prodRowTop: { display: 'flex', alignItems: 'center', gap: 10 },
  prodRowTopMobile: { flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  prodRowInfo: { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },
  prodRowInfoMobile: { width: '100%', justifyContent: 'space-between', paddingLeft: 0 },
  prodRowQtd: { color: '#0F172A', fontSize: '0.88rem', whiteSpace: 'nowrap' },
  checkOn: { width: 22, height: 22, borderRadius: 6, border: '2px solid #3B82F6', background: '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  checkOff: { width: 22, height: 22, borderRadius: 6, border: '2px solid #CBD5E1', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  produtoMiniThumb: { width: 40, height: 40, borderRadius: 10, overflow: 'hidden', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  iconBtnMenu: { width: 34, height: 34, borderRadius: 10, border: 'none', background: '#F1F5F9', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, marginLeft: 'auto' },
  menuAcoes: { display: 'flex', flexDirection: 'column', gap: 7, paddingTop: 8, borderTop: '1px solid #E2E8F0' },
  filtroCount: { background: 'rgba(0,0,0,0.08)', borderRadius: 999, padding: '0.05rem 0.5rem', fontSize: '0.7rem', fontWeight: 900 },
  salvarBar: { position: 'fixed', left: 0, right: 0, padding: '0.7rem 1rem', background: '#fff', borderTop: '1px solid #E2E8F0', boxShadow: '0 -8px 20px rgba(15,23,42,0.06)', zIndex: 40, display: 'flex', justifyContent: 'center', gap: 10 },
  salvarBarMobile: { padding: '0.55rem', gap: 6, alignItems: 'stretch' },
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
  sectionCard: { background: '#fff', borderRadius: 18, padding: 'clamp(12px, 3vw, 20px)', boxShadow: '0 8px 24px rgba(15,23,42,0.06)', width: '100%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 },
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
  searchBox: { display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #CBD5E1', borderRadius: 12, padding: '0 0.72rem', minHeight: 40, background: '#fff', minWidth: 220 },
  searchBoxMobile: { width: '100%', minWidth: 0 },
  searchInput: { border: 'none', outline: 'none', fontFamily: 'inherit', flex: 1, minWidth: 0, fontWeight: 700 },
  input: { width: '100%', minWidth: 0, boxSizing: 'border-box', border: '1px solid #CBD5E1', borderRadius: 12, padding: '0.72rem 0.8rem', fontFamily: 'inherit', outlineColor: '#003D7C', minHeight: 44 },
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
  produtoCardGrid: { background: '#fff', borderRadius: 14, padding: '0.85rem', minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 2px 8px rgba(15,23,42,0.05)' },
  produtoCardGridMobile: { padding: '0.55rem' },
  qtyBtn: { width: 30, height: 30, borderRadius: 8, border: '1px solid #CBD5E1', background: '#F8FAFC', color: '#334155', fontWeight: 900, fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'inherit' },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modal: { width: '100%', maxWidth: 820, maxHeight: '90vh', overflowY: 'auto', background: '#fff', borderRadius: 18, boxShadow: '0 24px 80px rgba(15,23,42,0.25)' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, marginBottom: 16 },
  modalTitle: { margin: 0, color: '#0F172A', fontSize: '1.2rem', fontWeight: 900 },
  closeBtn: { border: 'none', background: '#003D7C', color: '#fff', borderRadius: 10, minHeight: 40, padding: '0 0.9rem', fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit' },
}
