import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  AlertTriangle, CheckCircle2, ClipboardList, Edit3, Flame,
  Megaphone, PackageCheck, PlusCircle, Save, Search, Send, Timer, Trash2, Utensils, XCircle,
} from 'lucide-react'
import Layout from '../../components/Layout'
import AvisosSetor from '../../components/AvisosSetor'
import ProdutoFormModal from '../../components/ProdutoFormModal'
import { PRODUTO_FORM_VAZIO, formParaProduto } from '../../utils/produtoForm'
import { useApp } from '../../contexts/AppContext'
import { MOTIVOS_DESPERDICIO } from '../../contexts/hooks/useProducaoDiaria'
import { DIAS_CARDAPIO, DIAS_LABEL, diaDaSemanaAtual, produtoDisponivelNoDia } from '../../utils/cardapioDias'
import { formatPrice } from '../../utils/formatters'
import { useIsMobile } from '../../utils/useIsMobile'

const DIAS_SEMANA_ORD = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado']
const DIAS_CURTO = { domingo: 'Dom', segunda: 'Seg', terca: 'Ter', quarta: 'Qua', quinta: 'Qui', sexta: 'Sex', sabado: 'Sáb' }
const DIAS_FULL  = { domingo: 'Domingo', segunda: 'Segunda-feira', terca: 'Terça-feira', quarta: 'Quarta-feira', quinta: 'Quinta-feira', sexta: 'Sexta-feira', sabado: 'Sábado' }

function datasSemannaAtual() {
  const hoje = new Date()
  const dom = new Date(hoje)
  dom.setDate(hoje.getDate() - hoje.getDay())
  dom.setHours(0, 0, 0, 0)
  return DIAS_SEMANA_ORD.map((dia, i) => {
    const d = new Date(dom)
    d.setDate(dom.getDate() + i)
    d.setHours(0, 0, 0, 0)
    return { dia, ts: d.getTime(), isoDate: d.toISOString().slice(0, 10), numero: d.getDate(), isHoje: i === hoje.getDay() }
  })
}

const ROTAS_ABA = {
  dashboard: '/cozinha',
  producao: '/cozinha/producao',
  cardapio: '/cozinha/cardapio',
  avisos: '/cozinha/avisos',
}

function abaPorRota(pathname) {
  if (pathname.includes('/producao')) return 'producao'
  if (pathname.includes('/cardapio')) return 'cardapio'
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

function diasProduto(produto) {
  const dias = produto.diasProducao || produto.dias || produto.cardapioSemanal
  if (Array.isArray(dias)) return dias
  if (typeof dias === 'string') return dias.split(',').map(d => d.trim()).filter(Boolean)
  return []
}

function EmptyState({ children }) {
  return <div style={s.vazio}>{children}</div>
}

function StatCard({ icon: Icon, label, value, color, onClick }) {
  return (
    <div
      style={{ ...s.statCard, borderTop: `4px solid ${color}`, cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div style={s.statIcon}><Icon size={18} color={color} /></div>
      <span style={s.statLabel}>{label}</span>
      <strong style={{ ...s.statValue, color }}>{value}</strong>
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
  const { pedidos, produtos, atualizarProduto, adicionarProduto, criarAviso, avisos, producaoDiaria, producaoHoje, salvarProducao, atualizarProducao, removerProducao, registrarDesperdicio } = useApp()
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
  const [diaSelecionado, setDiaSelecionado] = useState(diaDaSemanaAtual())
  const [qtdPorProduto, setQtdPorProduto] = useState({})
  const [buscaProduto, setBuscaProduto] = useState('')
  const [horarioPrevistoForm, setHorarioPrevistoForm] = useState('')
  const [loteDesperdicioForm, setLoteDesperdicioForm] = useState({})
  const [novoProdutoAberto, setNovoProdutoAberto] = useState(false)
  const [novoProdutoForm, setNovoProdutoForm] = useState(PRODUTO_FORM_VAZIO)
  const [salvandoProduto, setSalvandoProduto] = useState(false)
  const [erroSalvarProduto, setErroSalvarProduto] = useState('')

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
  const cardapioHoje = useMemo(() => produtos.filter(p => p.disponivel !== false && Number(p.estoque || 0) > 0), [produtos])
  const produtosDoDia = useMemo(() => produtos, [produtos])
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
  const semanaDatas = useMemo(() => datasSemannaAtual(), [])
  const producaoDoDia = useMemo(() => {
    const diaInfo = semanaDatas.find(d => d.dia === diaSelecionado)
    if (!diaInfo) return []
    const fim = diaInfo.ts + 24 * 60 * 60 * 1000 - 1
    return (producaoDiaria || [])
      .filter(item => { const t = Number(item.dataProducaoTs || item.criadoEm || 0); return t >= diaInfo.ts && t <= fim })
      .sort((a, b) => (b.atualizadoEm || b.criadoEm || 0) - (a.atualizadoEm || a.criadoEm || 0))
  }, [producaoDiaria, diaSelecionado, semanaDatas])
  const producaoDoDiaFiltrada = useMemo(() => {
    const termo = buscaProducao.trim().toLowerCase()
    return producaoDoDia.filter(item => {
      const statusOk = filtroProducao === 'todos' || normalizeStatus(item.status) === normalizeStatus(filtroProducao)
      const buscaOk = !termo || String(item.produtoNome || '').toLowerCase().includes(termo)
      return statusOk && buscaOk
    })
  }, [producaoDoDia, buscaProducao, filtroProducao])
  const produtosFiltrados = useMemo(() => {
    const t = buscaProduto.trim().toLowerCase()
    return t ? produtos.filter(p => p.nome?.toLowerCase().includes(t) || p.categoria?.toLowerCase().includes(t)) : produtos
  }, [produtos, buscaProduto])
  const temProducaoNoDia = useMemo(() => {
    return Object.fromEntries(semanaDatas.map(({ dia, ts }) => {
      const fim = ts + 24 * 60 * 60 * 1000 - 1
      const tem = (producaoDiaria || []).some(item => { const t = Number(item.dataProducaoTs || item.criadoEm || 0); return t >= ts && t <= fim })
      return [dia, tem]
    }))
  }, [producaoDiaria, semanaDatas])

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
      const item = producaoOrdenada.find(p => p.id === id)
      if (!item) continue
      if (quantidade > Number(item.quantidadeRestante || 0)) continue
      const resultado = await registrarDesperdicio(item.id, item, {
        quantidade,
        motivo: motivo || MOTIVOS_DESPERDICIO[0],
        observacao: observacao || '',
      })
      const produto = produtos.find(p => String(p.id) === String(item.produtoId))
      if (produto) {
        await atualizarProduto({ ...produto, estoque: resultado.quantidadeRestante })
      }
    }
    setLoteDesperdicioForm({})
  }

  function abrirNovoProduto() {
    setNovoProdutoForm(PRODUTO_FORM_VAZIO)
    setErroSalvarProduto('')
    setNovoProdutoAberto(true)
  }

  async function salvarNovoProduto(e) {
    e.preventDefault()
    if (!novoProdutoForm.nome.trim()) {
      setErroSalvarProduto('Informe o nome do produto.')
      return
    }
    setSalvandoProduto(true)
    setErroSalvarProduto('')
    try {
      await adicionarProduto(formParaProduto(novoProdutoForm))
      setNovoProdutoAberto(false)
    } catch {
      setErroSalvarProduto('Não foi possível salvar o produto. Tente novamente.')
    } finally {
      setSalvandoProduto(false)
    }
  }

  async function planejarProduto(produto) {
    const qtd = Math.max(1, Number(qtdPorProduto[produto.id] || 1))
    const diaInfo = semanaDatas.find(d => d.dia === diaSelecionado)
    if (!diaInfo) return
    const jaExiste = producaoDoDia.find(p => String(p.produtoId) === String(produto.id) && normalizeStatus(p.status) !== 'cancelado')
    if (jaExiste) {
      await atualizarProducao(jaExiste.id, jaExiste, { quantidadePlanejada: Number(jaExiste.quantidadePlanejada || 0) + qtd }, { acao: 'Adicionou quantidade ao planejamento' })
    } else {
      await salvarProducao({
        produtoId: produto.id, produtoNome: produto.nome,
        produtoCategoria: produto.categoria || '', produtoFoto: produto.foto || '',
        quantidadePlanejada: qtd, horarioPrevisto: horarioPrevistoForm,
        status: 'Planejado', dataProducao: diaInfo.isoDate, dataProducaoTs: diaInfo.ts,
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

  return (
    <Layout titulo="Painel da Cozinha">
      <div style={{ ...s.page, paddingBottom: isMobile ? 128 : 32 }}>
        {aba === 'dashboard' && (
          <>
            <section style={s.sectionCard}>
              <div style={s.sectionHeader}>
                <h3 style={s.sectionTitle}>Resumo de hoje</h3>
              </div>
              <div style={{ ...s.statsGrid, gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(5, minmax(0, 1fr))' }}>
                <StatCard icon={ClipboardList} label="Pedidos hoje" value={pedidosHoje.length} color="#003D7C" onClick={() => setPainelDetalhe('pedidos')} />
                <StatCard icon={Utensils} label="Total produzido" value={`${totalProduzidoHoje} un`} color="#7C3AED" onClick={() => setPainelDetalhe('produzido')} />
                <StatCard icon={Trash2} label="Desperdicado" value={`${totalDesperdicadoHoje} un`} color="#EF4444" onClick={() => setPainelDetalhe('desperdicio')} />
                <StatCard icon={XCircle} label="Esgotados" value={produtosEsgotados} color="#B91C1C" onClick={() => setPainelDetalhe('esgotados')} />
                <StatCard icon={PackageCheck} label="Disponivel" value={`${totalDisponivelHoje} un`} color="#22C55E" onClick={() => setPainelDetalhe('disponivel')} />
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
                  <h3 style={s.sectionTitle}>Producao do dia</h3>
                  <p style={s.meta}>Atualize o status, registre desperdicio ou marque como esgotado.</p>
                </div>
                <button style={s.linkBtn} onClick={() => selecionarAba('producao')}>Editar / lote</button>
              </div>
              {producaoOrdenada.length === 0 ? (
                <EmptyState>Nenhuma producao registrada hoje. Cadastre o que sera produzido na aba Producao.</EmptyState>
              ) : producaoOrdenada.map(item => {
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
                    <div style={s.acoes}>
                      <button style={s.btnSecundario} onClick={() => mudarStatusProducao(item, 'Em producao')}>Em producao</button>
                      <button style={s.btnPrimario} onClick={() => mudarStatusProducao(item, 'Pronto para venda')}><CheckCircle2 size={15} /> Pronto</button>
                      <button style={s.btnPerigo} onClick={() => abrirDesperdicio(item)} disabled={Number(item.quantidadeRestante || 0) <= 0}><Trash2 size={15} /> Desperdicio</button>
                    </div>
                  </article>
                )
              })}
            </section>
          </>
        )}

        {aba === 'producao' && (
          <div style={s.producaoPage}>

            {/* Seletor de dias da semana */}
            <div style={s.sectionCard}>
              <div style={s.sectionHeader}>
                <div>
                  <h3 style={s.sectionTitle}>Semana atual</h3>
                  <p style={s.meta}>Selecione o dia para planejar ou visualizar a produção</p>
                </div>
                {producaoEditando && (
                  <button style={s.linkBtn} onClick={() => { setFormProducao(FORM_PRODUCAO); setProducaoEditando(null) }}>
                    ← Voltar ao planejamento
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                {semanaDatas.map(({ dia, numero, isHoje }) => {
                  const ativo = diaSelecionado === dia
                  const temItem = temProducaoNoDia[dia]
                  return (
                    <button key={dia} onClick={() => { setDiaSelecionado(dia); setProducaoEditando(null); setBuscaProducao(''); setFiltroProducao('todos') }}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                        padding: '0.55rem 0.9rem', borderRadius: 14, border: 'none', cursor: 'pointer',
                        minWidth: 58, fontFamily: 'inherit', position: 'relative',
                        background: ativo ? '#003D7C' : isHoje ? '#EFF6FF' : '#F8FAFC',
                        color: ativo ? '#fff' : isHoje ? '#003D7C' : '#64748B',
                        fontWeight: ativo || isHoje ? 900 : 700,
                        boxShadow: ativo ? '0 4px 12px rgba(0,61,124,0.25)' : 'none',
                        outline: isHoje && !ativo ? '2px solid #003D7C' : 'none',
                      }}>
                      <span style={{ fontSize: '0.68rem' }}>{DIAS_CURTO[dia]}</span>
                      <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>{numero}</span>
                      {temItem && <span style={{ width: 6, height: 6, borderRadius: '50%', background: ativo ? '#7DD3FC' : '#22C55E', marginTop: 2 }} />}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Stats do dia selecionado */}
            <div style={{ ...s.statsGrid, gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(5, minmax(0, 1fr))' }}>
              <StatCard icon={ClipboardList} label={`Planejados — ${DIAS_CURTO[diaSelecionado]}`} value={producaoDoDia.filter(i => normalizeStatus(i.status) !== 'cancelado').length} color="#003D7C" />
              <StatCard icon={Flame} label="Em produção" value={producaoDoDia.filter(i => normalizeStatus(i.status) === 'em producao').length} color="#F59E0B" />
              <StatCard icon={PackageCheck} label="Prontos" value={producaoDoDia.filter(i => ['pronto para venda','parcialmente pronto'].includes(normalizeStatus(i.status))).length} color="#22C55E" />
              <StatCard icon={XCircle} label="Esgotados" value={producaoDoDia.filter(i => normalizeStatus(i.status) === 'esgotado').length} color="#EF4444" />
              <StatCard icon={Timer} label="Pedidos aguardando" value={pedidosAtivos.length} color="#0EA5E9" />
            </div>

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

            {/* Grid de produtos para planejar */}
            {!producaoEditando && (
              <div style={s.sectionCard}>
                <div style={s.sectionHeader}>
                  <div>
                    <h3 style={s.sectionTitle}>Planejar produção — {DIAS_FULL[diaSelecionado]}</h3>
                    <p style={s.meta}>Clique em um produto para adicioná-lo ao planejamento. Produtos já planejados mostram em verde.</p>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <label style={{ ...s.meta, fontWeight: 700 }}>Horário:</label>
                    <input type="time" value={horarioPrevistoForm} onChange={e => setHorarioPrevistoForm(e.target.value)} style={{ ...s.input, maxWidth: 130, minHeight: 36, padding: '0.4rem 0.6rem' }} />
                  </div>
                </div>
                <div style={s.searchBox}>
                  <Search size={16} color="#64748B" />
                  <input value={buscaProduto} onChange={e => setBuscaProduto(e.target.value)} placeholder="Buscar produto..." style={s.searchInput} />
                </div>
                {produtosFiltrados.length === 0
                  ? <EmptyState>Nenhum produto encontrado.</EmptyState>
                  : (
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fill, minmax(155px, 1fr))', gap: 12 }}>
                      {produtosFiltrados.map(produto => {
                        const planejado = producaoDoDia.find(p => String(p.produtoId) === String(produto.id) && normalizeStatus(p.status) !== 'cancelado')
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
                  )
                }
              </div>
            )}

            {/* Lista de produção do dia selecionado */}
            <section style={s.sectionCard}>
              <div style={s.sectionHeader}>
                <div>
                  <h3 style={s.sectionTitle}>Produção — {DIAS_FULL[diaSelecionado]}</h3>
                  <span style={s.meta}>{producaoDoDia.filter(i => normalizeStatus(i.status) !== 'cancelado').length} item(ns) planejado(s)</span>
                </div>
                <div style={s.searchBox}>
                  <Search size={16} color="#64748B" />
                  <input value={buscaProducao} onChange={e => setBuscaProducao(e.target.value)} placeholder="Pesquisar" style={s.searchInput} />
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
                {producaoDoDiaFiltrada.length === 0
                  ? <EmptyState>Nenhuma produção planejada para {DIAS_FULL[diaSelecionado]}.</EmptyState>
                  : producaoDoDiaFiltrada.map(item => {
                    const visual = producaoStatusVisual(item.status)
                    return (
                      <article key={item.id} style={{ ...s.producaoCard, borderLeftColor: visual.border }}>
                        <div style={s.pedidoTop}>
                          <div style={s.produtoMini}>
                            {item.produtoFoto && <img src={item.produtoFoto} alt={item.produtoNome} style={s.produtoMiniImg} />}
                            <div>
                              <strong style={s.codigo}>{item.produtoNome}</strong>
                              <p style={s.meta}>{item.produtoCategoria || 'Produto'} — atualizado {tempoDesde(item.atualizadoEm)}</p>
                            </div>
                          </div>
                          <span style={{ ...s.badge, background: visual.bg, color: visual.color }}>{visual.label}</span>
                        </div>
                        <div style={s.producaoMetrics}>
                          <span>Planejado <strong>{item.quantidadePlanejada || 0}</strong></span>
                          <span>Em produção <strong>{item.quantidadeEmProducao || 0}</strong></span>
                          <span>Pronto <strong>{item.quantidadePronta || 0}</strong></span>
                          <span>Restante <strong>{item.quantidadeRestante || 0}</strong></span>
                          <span>Desperdiçado <strong>{item.quantidadeDesperdicada || 0}</strong></span>
                          <span>Previsão <strong>{item.horarioPrevisto || '--:--'}</strong></span>
                        </div>
                        {item.observacao && <p style={s.obs}>{item.observacao}</p>}
                        <p style={s.meta}>Última atualização: {formatarHoraAtualizacao(item.atualizadoEm)} por {item.atualizadoPor?.nome || item.criadoPor?.nome || 'Cozinha'}</p>
                        <div style={s.acoes}>
                          <button style={s.btnSecundario} onClick={() => editarPlanejamento(item)}><Edit3 size={15} /> Editar</button>
                          <button style={s.btnSecundario} onClick={() => mudarStatusProducao(item, 'Em producao')}>Em produção</button>
                          <button style={s.btnPrimario} onClick={() => mudarStatusProducao(item, 'Pronto para venda')}><CheckCircle2 size={15} /> Pronto</button>
                          <button style={s.btnSecundario} onClick={() => avisarVendedor(item)}><Send size={15} /> Avisar vendedor</button>
                          <button style={s.btnPerigo} onClick={() => abrirDesperdicio(item)} disabled={Number(item.quantidadeRestante || 0) <= 0}><Trash2 size={15} /> Desperdício</button>
                          <button style={s.btnPerigo} onClick={() => cancelarProducao(item)}>Cancelar</button>
                        </div>
                        {Array.isArray(item.historicoDesperdicio) && item.historicoDesperdicio.length > 0 && (
                          <details style={s.historicoBox}>
                            <summary>Histórico de desperdício</summary>
                            {item.historicoDesperdicio.slice(-5).reverse().map(h => (
                              <p key={h.id} style={s.meta}>{formatarDataHora(h.dataHora)} — {h.quantidade} un ({h.motivo}) por {h.responsavel?.nome || 'Usuário'}{h.observacao ? ` — ${h.observacao}` : ''}</p>
                            ))}
                          </details>
                        )}
                        {Array.isArray(item.historico) && item.historico.length > 0 && (
                          <details style={s.historicoBox}>
                            <summary>Histórico de alterações</summary>
                            {item.historico.slice(-5).reverse().map(h => (
                              <p key={h.id} style={s.meta}>{formatarDataHora(h.data)} — {h.acao} por {h.usuario?.nome || 'Usuário'}</p>
                            ))}
                          </details>
                        )}
                      </article>
                    )
                  })
                }
              </div>
            </section>

            {/* Desperdício em lote (mostra itens do dia selecionado) */}
            {itensDisponiveis.length > 0 && (
              <section style={s.sectionCard}>
                <div style={s.sectionHeader}>
                  <h3 style={s.sectionTitle}>Registrar desperdício em lote</h3>
                  <p style={s.meta}>Informe a quantidade perdida de cada produto e registre tudo de uma vez.</p>
                </div>
                <div style={s.loteLista}>
                  {itensDisponiveis.map(item => (
                    <div key={item.id} style={{ ...s.loteItem, gridTemplateColumns: isMobile ? '1fr' : 'minmax(180px, 1.5fr) minmax(110px, 0.6fr) minmax(86px, 0.55fr) minmax(160px, 1fr) minmax(160px, 1fr)' }}>
                      <div style={s.produtoMini}>
                        {item.produtoFoto && <img src={item.produtoFoto} alt={item.produtoNome} style={s.produtoMiniImg} />}
                        <div>
                          <strong style={s.codigo}>{item.produtoNome}</strong>
                          <p style={s.meta}>Disponível: {item.quantidadeRestante || 0} un</p>
                        </div>
                      </div>
                      <p style={s.meta}>Disponível <strong>{item.quantidadeRestante || 0}</strong></p>
                      <input type="number" min="0" max={item.quantidadeRestante || 0} value={loteDesperdicioForm[item.id]?.quantidade || ''} onChange={e => atualizarLoteDesperdicio(item.id, 'quantidade', e.target.value)} placeholder="Qtd." style={s.inputMini} />
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
              </section>
            )}
          </div>
        )}

        {aba === 'cardapio' && (
          <section style={s.sectionCard}>
            <div style={s.sectionHeader}>
              <div>
                <h3 style={s.sectionTitle}>Cardápio disponivel</h3>
                <span style={s.meta}>{cardapioHoje.length} produto(s)</span>
              </div>
              <button style={s.btnPrimario} onClick={abrirNovoProduto}><PlusCircle size={15} /> Novo produto</button>
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

    {novoProdutoAberto && (
        <ProdutoFormModal
          titulo="Novo produto"
          subtitulo="Cadastre um novo produto para o cardápio"
          form={novoProdutoForm}
          setForm={setNovoProdutoForm}
          onSalvar={salvarNovoProduto}
          onFechar={() => setNovoProdutoAberto(false)}
          salvando={salvandoProduto}
          erroSalvar={erroSalvarProduto}
          isMobile={isMobile}
        />
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
  producaoCard: { border: '1px solid #E5E7EB', borderLeft: '5px solid #CBD5E1', background: '#fff', borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 12, boxShadow: '0 6px 18px rgba(15,23,42,0.05)' },
  pedidoTop: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
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
