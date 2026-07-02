import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { arrayUnion, doc, updateDoc } from 'firebase/firestore'
import {
  AlertTriangle, CheckCircle2, ClipboardList, Clock, CreditCard, Edit3, Eye, EyeOff,
  Megaphone, MessageCircle, Minus, Package, PackageCheck, Plus, PlusCircle, Save, Search, Send,
  ScanLine, ShoppingBag, Trash2, XCircle,
} from 'lucide-react'
import Layout from '../../components/Layout'
import AvisosSetor from '../../components/AvisosSetor'
import GerenciarEstoque from '../../components/GerenciarEstoque'
import ProdutoFormModal from '../../components/ProdutoFormModal'
import PedidoBalcao from '../../components/PedidoBalcao'
import LeitorQrPedido from '../../components/vendor/LeitorQrPedido'
import { useApp } from '../../contexts/AppContext'
import { useToast } from '../../contexts/hooks/useToast'
import { db } from '../../firebase'
import { formatPrice } from '../../utils/formatters'
import { estoqueNivel } from '../../utils/statusColors'
import { useIsMobile } from '../../utils/useIsMobile'
import { DIAS_CARDAPIO, DIAS_LABEL, resumoDiasProduto } from '../../utils/cardapioDias'
import { ehGestao, normalizarPerfil } from '../../utils/perfis'
import { PRODUTO_FORM_VAZIO, produtoParaForm, formParaProduto } from '../../utils/produtoForm'
import { useTempoAtual } from '../../utils/useTempoAtual'
import { maxDesperdicio, produtoDisponivelParaCardapioDia } from '../../utils/producao'
import { MOTIVOS_DESPERDICIO } from '../../contexts/hooks/useProducaoDiaria'
import {
  JANELA_PEDIDO_MS,
  compararPedidosFila,
  codigoPedido as codigoPedidoBase,
  dataIsoLocal,
  encontrarPedidoPorQr,
  horarioRetiradaParaTimestamp,
  pedidoAntesDaRetirada,
  pedidoNoFiltroStatus,
} from '../../utils/pedidos'

const ROTAS_ABA = {
  dashboard: '/vendedor',
  balcao: '/vendedor/balcao',
  pedidos: '/vendedor/pedidos',
  atendimento: '/vendedor/atendimento',
  produtos: '/vendedor/produtos',
  estoque: '/vendedor/estoque',
  vendas: '/vendedor/vendas',
  avisos: '/vendedor/avisos',
}

function abaPorRota(pathname) {
  if (pathname.includes('/balcao')) return 'balcao'
  if (pathname.includes('/pedidos')) return 'pedidos'
  if (pathname.includes('/atendimento')) return 'atendimento'
  if (pathname.includes('/produtos')) return 'produtos'
  if (pathname.includes('/estoque')) return 'estoque'
  if (pathname.includes('/vendas')) return 'vendas'
  if (pathname.includes('/avisos')) return 'avisos'
  return 'dashboard'
}

const PRODUTO_LOTE_VAZIO = { nome: '', categoria: 'Lanches', preco: '', estoque: '', estoqueBaixo: '', diasProducao: [], disponivel: true }

const FILTROS_PEDIDOS = [
  ['todos', 'Todos'],
  ['pendentes', 'Pendentes'],
  ['entregues', 'Entregues'],
  ['cancelados', 'Cancelados'],
]

const PAGAMENTOS_BALCAO = ['Dinheiro', 'PIX', 'Débito', 'Crédito']

const MOTIVOS_CANCELAMENTO = [
  'Aluno desistiu',
  'Produto indisponível',
  'Erro no pedido',
  'Pagamento não realizado',
  'Outro motivo',
]

const STATUS_AJUSTE_PRODUCAO = [
  'Pronto para venda',
  'Parcialmente pronto',
  'Esgotado',
]

const CATEGORIAS_RAPIDAS_PRODUTOS = ['Bebidas', 'Lanches', 'Salgados', 'Doces']

const FORM_AJUSTE_VAZIO = { quantidade: '', status: '', motivo: '', observacao: '' }
const FORM_DESCARTE_VAZIO = { quantidade: '', motivo: MOTIVOS_DESPERDICIO[0], observacao: '' }

function inicioDoDia(referencia = Date.now()) {
  const data = new Date(referencia)
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

function ordenarPorNome(a, b) {
  return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR')
}

function produtoEhBebida(produto) {
  return String(produto?.categoria || '').trim().toLowerCase() === 'bebidas'
}

function pedidoCodigo(pedido) {
  return codigoPedidoBase(pedido)
}

function alunoNome(pedido) {
  return pedido?.alunoNome || pedido?.nomeAluno || pedido?.aluno || pedido?.nome || 'Aluno não informado'
}

function perfilClientePedido(pedido, usuarios = []) {
  const perfilSalvo = normalizarPerfil(pedido?.alunoPerfil || pedido?.perfilAluno || pedido?.solicitantePerfil)
  if (perfilSalvo === 'professor') return 'professor'

  const matricula = String(pedido?.matricula || pedido?.alunoMatricula || pedido?.solicitanteMatricula || '').trim()
  const nome = String(alunoNome(pedido)).trim().toLowerCase()
  const usuario = usuarios.find(u => {
    const mesmaMatricula = matricula && String(u.matricula || '').trim() === matricula
    const mesmoNome = nome && String(u.nome || '').trim().toLowerCase() === nome
    return mesmaMatricula || mesmoNome
  })

  return normalizarPerfil(usuario?.role || usuario?.perfil || perfilSalvo)
}

function clienteLabel(pedido, usuarios = []) {
  return perfilClientePedido(pedido, usuarios) === 'professor'
    ? 'Professor'
    : 'Aluno'
}

function origemLabel(pedido) {
  return pedido?.origem === 'balcao' ? 'Balcão' : 'App'
}

function getFormaPagamento(pedido) {
  return pedido?.formaPagamento || pedido?.pagamento || pedido?.metodoPagamento || 'Não informado'
}

function contaProfessorPendente(pedido) {
  return normalizeStatus(getFormaPagamento(pedido)) === 'conta do professor'
    && !pedido?.pago
    && normalizeStatus(pedido?.status) !== 'cancelado'
}

function getTotalPedido(pedido) {
  return Number(pedido?.total || pedido?.valorTotal || pedido?.valor || 0)
}

function getPedidoDate(pedido) {
  const valor = pedido?.criadoEm || pedido?.createdAt || pedido?.dataPedido || pedido?.data
  if (!valor) return null
  try {
    const date = valor?.toDate ? valor.toDate() : new Date(valor)
    return Number.isNaN(date.getTime()) ? null : date
  } catch {
    return null
  }
}

function pedidoDataIso(pedido) {
  const date = getPedidoDate(pedido)
  return date ? dataIsoLocal(date) : null
}

function hojeIso() {
  return dataIsoLocal()
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

function pedidoHora(pedido) {
  if (pedido?.horarioPedido) return pedido.horarioPedido
  const date = getPedidoDate(pedido)
  return date ? date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--'
}

function statusVisual(status) {
  const normal = normalizeStatus(status)
  if (normal === 'recebido' || normal === 'pendente') return { label: 'Pendente', bg: '#FEF3C7', color: '#92400E' }
  if (normal === 'em preparo' || normal === 'preparando') return { label: 'Preparando', bg: '#DBEAFE', color: '#1D4ED8' }
  if (normal === 'pronto') return { label: 'Aguardando retirada', bg: '#DCFCE7', color: '#166534' }
  if (normal === 'entregue') return { label: 'Entregue', bg: '#DCFCE7', color: '#166534' }
  if (normal === 'cancelado') return { label: 'Cancelado', bg: '#FEE2E2', color: '#B91C1C' }
  return { label: status || 'Não informado', bg: '#F1F5F9', color: '#475569' }
}

function filtrarPedidos(pedidos, filtro, pagamento, busca = '') {
  const termo = busca.trim().toLowerCase()
  return pedidos.filter(pedido => {
    const statusOk = pedidoNoFiltroStatus(pedido, filtro)

    const pagamentoOk = pagamento === 'todos' || normalizeStatus(getFormaPagamento(pedido)) === normalizeStatus(pagamento)
    const buscaOk = !termo
      || pedidoCodigo(pedido).toLowerCase().includes(termo)
      || String(pedido.numero || '').toLowerCase().includes(termo)
      || String(pedido.id || '').toLowerCase().includes(termo)
      || String(pedido.matricula || pedido.alunoMatricula || '').toLowerCase().includes(termo)
      || alunoNome(pedido).toLowerCase().includes(termo)
      || String(pedido.status || '').toLowerCase().includes(termo)
      || statusVisual(pedido.status).label.toLowerCase().includes(termo)

    return statusOk && pagamentoOk && buscaOk
  })
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

function isPedidoCancelado(p) {
  return ['cancelado','cancelada','cancelado pelo aluno','cancelado_pelo_aluno','cancelado-aluno','cancelado pelo admin','cancelado_admin','cancelled'].includes(normalizeStatus(p?.status))
}

function getItensTexto(p) {
  const itens = Array.isArray(p?.itens) ? p.itens : []
  return itens.length ? itens.map(i => `${i.quantidade || 1}x ${i.nome || i.produtoNome || 'Produto'}`).join(', ') : 'Nao informado'
}

function xmlEscape(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
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

function StatusBadge({ status }) {
  const visual = statusVisual(status)
  return <span style={{ ...s.badge, background: visual.bg, color: visual.color }}>{visual.label}</span>
}

function producaoVisual(status) {
  const normal = normalizeStatus(status)
  if (normal === 'pronto para venda') return { bg: '#DCFCE7', color: '#166534', label: 'Pronto para venda' }
  if (normal === 'em producao') return { bg: '#FEF3C7', color: '#92400E', label: 'Em producao' }
  if (normal === 'parcialmente pronto') return { bg: '#F5F3FF', color: '#6D28D9', label: 'Parcialmente pronto' }
  if (normal === 'esgotado') return { bg: '#FEE2E2', color: '#B91C1C', label: 'Esgotado' }
  if (normal === 'planejado') return { bg: '#E0F2FE', color: '#075985', label: 'Planejado' }
  return { bg: '#F1F5F9', color: '#475569', label: status || 'Não informado' }
}

function horaAtualizacao(valor) {
  if (!valor) return '--:--'
  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) return '--:--'
  return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export default function Vendedor() {
  const {
    usuarioLogado, usuarios, pedidos, produtos, producaoHoje,
    atualizarStatusPedido, darBaixaContaProfessor, cancelarPedido, editarPedido,
    atualizarProduto, adicionarProduto, adicionarProdutos, atualizarDisponibilidadeProdutos,
    ajustarProducaoVendedor, registrarDesperdicio,
    atendimentos, responderAtendimento, encerrarAtendimento, arquivarAtendimentosEncerrados, marcarLidoVendedor,
  } = useApp()
  const podeEditarPreco = ehGestao(usuarioLogado?.role || usuarioLogado?.perfil)
  const location = useLocation()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const toast = useToast()
  const tempoAtual = useTempoAtual(60000)
  const aba = abaPorRota(location.pathname)
  const [filtroPedidos, setFiltroPedidos] = useState('todos')
  const [filtroPagamento, setFiltroPagamento] = useState('todos')
  const [filtroData, setFiltroData] = useState('')
  const [buscaPedido, setBuscaPedido] = useState('')
  const [leitorQrAberto, setLeitorQrAberto] = useState(false)
  const [buscaProduto, setBuscaProduto] = useState('')
  const [detalhePedido, setDetalhePedido] = useState(null)
  const [pagamentoEditando, setPagamentoEditando] = useState('')
  const [salvandoPagamento, setSalvandoPagamento] = useState(false)
  const [erroPagamento, setErroPagamento] = useState('')
  const [pedidoCancelando, setPedidoCancelando] = useState(null)
  const [motivoCancelamento, setMotivoCancelamento] = useState(MOTIVOS_CANCELAMENTO[0])
  const [motivoOutro, setMotivoOutro] = useState('')
  const [cancelandoPedido, setCancelandoPedido] = useState(false)
  const [erroCancelamento, setErroCancelamento] = useState('')
  const [pedidoEditando, setPedidoEditando] = useState(null)
  const [itensEdicao, setItensEdicao] = useState([])
  const [observacaoEdicao, setObservacaoEdicao] = useState('')
  const [horarioEdicao, setHorarioEdicao] = useState('')
  const [pagamentoEdicao, setPagamentoEdicao] = useState('')
  const [buscaProdutoEdicao, setBuscaProdutoEdicao] = useState('')
  const [salvandoEdicao, setSalvandoEdicao] = useState(false)
  const [erroEdicao, setErroEdicao] = useState('')
  const [retiradaPedido, setRetiradaPedido] = useState(null)
  const [confirmacaoRetirada, setConfirmacaoRetirada] = useState('')
  const [erroRetirada, setErroRetirada] = useState('')
  const [detalheProduto, setDetalheProduto] = useState(null)
  const [produtoForm, setProdutoForm] = useState(PRODUTO_FORM_VAZIO)
  const [loteProdutos, setLoteProdutos] = useState([{ ...PRODUTO_LOTE_VAZIO }])
  const [produtoEditando, setProdutoEditando] = useState(null)
  const [editorProdutoAberto, setEditorProdutoAberto] = useState(false)
  const [salvandoProduto, setSalvandoProduto] = useState(false)
  const [erroSalvarProduto, setErroSalvarProduto] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('todas')
  const [filtroDisponivel, setFiltroDisponivel] = useState('todos')
  const [modoDisponibilidadeLote, setModoDisponibilidadeLote] = useState(false)
  const [produtosSelecionados, setProdutosSelecionados] = useState([])
  const [alterandoDisponibilidade, setAlterandoDisponibilidade] = useState(false)
  const [ajusteItem, setAjusteItem] = useState(null)
  const [formAjuste, setFormAjuste] = useState(FORM_AJUSTE_VAZIO)
  const [descarteItem, setDescarteItem] = useState(null)
  const [formDescarte, setFormDescarte] = useState(FORM_DESCARTE_VAZIO)
  const [erroDescarte, setErroDescarte] = useState('')
  const [atendimentoAbertoId, setAtendimentoAbertoId] = useState('')
  const [respostaAtendimento, setRespostaAtendimento] = useState('')
  const [enviandoAtendimento, setEnviandoAtendimento] = useState(false)
  const [filtroAtendimentoStatus, setFiltroAtendimentoStatus] = useState('ativos')
  const [filtroAtendimentoPeriodo, setFiltroAtendimentoPeriodo] = useState('hoje')
  const [limpandoAtendimento, setLimpandoAtendimento] = useState(false)
  const [filtroVendasTipo, setFiltroVendasTipo] = useState('dia')
  const [filtroVendasDia, setFiltroVendasDia] = useState(hojeIso)
  const [filtroVendasMes, setFiltroVendasMes] = useState(() => hojeIso().slice(0, 7))
  const [filtroVendasOrigem, setFiltroVendasOrigem] = useState('todos')
  const [gerandoPDFVendas, setGerandoPDFVendas] = useState(false)

  function selecionarAba(id) {
    navigate(ROTAS_ABA[id] || '/vendedor')
  }

  function abrirAtendimento(atendimento) {
    setAtendimentoAbertoId(atendimento?.id || '')
    setRespostaAtendimento('')
    if (atendimento?.novaParaVendedor) marcarLidoVendedor(atendimento).catch(() => {})
  }

  function pedidoDoAtendimento(atendimento) {
    return atendimento?.pedido
      || pedidos.find(pedido => String(pedido.id) === String(atendimento?.pedidoId))
      || null
  }

  function codigoAtendimento(atendimento) {
    const pedido = pedidoDoAtendimento(atendimento)
    if (pedido) return pedidoCodigo(pedido)

    const codigoSalvo = String(atendimento?.pedidoCodigo || '').replace(/\D/g, '')
    if (codigoSalvo) return codigoSalvo.padStart(4, '0').slice(-4)

    return pedidoCodigo(atendimento)
  }

  async function enviarRespostaAtendimento(atendimento) {
    const texto = respostaAtendimento.trim()
    if (!atendimento?.id || !texto || enviandoAtendimento) return
    setEnviandoAtendimento(true)
    try {
      await responderAtendimento(atendimento, texto)
      setRespostaAtendimento('')
      toast('O vendedor respondeu sua solicitação.', 'success')
    } catch (error) {
      toast(error.message || 'Não foi possível responder.', 'error')
    } finally {
      setEnviandoAtendimento(false)
    }
  }

  async function finalizarAtendimento(atendimento) {
    try {
      await encerrarAtendimento(atendimento)
      toast('Atendimento encerrado.', 'success')
    } catch (error) {
      toast(error.message || 'Não foi possível encerrar o atendimento.', 'error')
    }
  }

  async function limparHistoricoAtendimento(lista = []) {
    const encerrados = lista.filter(item => item.status === 'encerrada' && !item.arquivadoVendedor)
    if (encerrados.length === 0 || limpandoAtendimento) return
    if (!confirm(`Limpar ${encerrados.length} conversa(s) encerrada(s) do histórico?`)) return
    setLimpandoAtendimento(true)
    try {
      const total = await arquivarAtendimentosEncerrados(encerrados.map(item => item.id))
      toast(`${total} conversa(s) removida(s) do histórico.`, 'success')
      if (encerrados.some(item => item.id === atendimentoAbertoId)) setAtendimentoAbertoId('')
    } catch (error) {
      toast(error.message || 'Não foi possível limpar o histórico.', 'error')
    } finally {
      setLimpandoAtendimento(false)
    }
  }

  function limparFiltrosPedidos() {
    setBuscaPedido('')
    setFiltroData('')
    setFiltroPedidos('todos')
    setFiltroPagamento('todos')
  }

  function abrirDetalhePedido(pedido) {
    setDetalhePedido(pedido)
    setPagamentoEditando(getFormaPagamento(pedido))
    setErroPagamento('')
  }

  function lerPedidoPorQr(conteudo) {
    const pedido = encontrarPedidoPorQr(conteudo, pedidos)
    if (!pedido) {
      toast('QR Code inválido ou pedido não encontrado.', 'error')
      return false
    }

    setLeitorQrAberto(false)
    setFiltroPedidos('todos')
    setFiltroPagamento('todos')
    setFiltroData('')
    setBuscaPedido(pedidoCodigo(pedido))
    abrirDetalhePedido(pedido)
    toast(`Pedido ${pedidoCodigo(pedido)} encontrado.`, 'success')
    return true
  }

  async function salvarPagamentoPedido() {
    if (!detalhePedido?.id) return
    setSalvandoPagamento(true)
    setErroPagamento('')
    try {
      const encerrado = ['entregue', 'cancelado'].includes(normalizeStatus(detalhePedido.status))
      if (encerrado && !podeEditarPreco) {
        throw new Error('Somente Admin/Gerente pode alterar o pagamento de um pedido encerrado.')
      }
      if (pagamentoEditando === 'Conta do Professor' && perfilClientePedido(detalhePedido, usuarios) !== 'professor') {
        throw new Error('Conta do Professor está disponível somente para professor cadastrado.')
      }
      const formaAnterior = getFormaPagamento(detalhePedido)
      const pagamentoPendente = pagamentoEditando === 'Conta do Professor'
      const pagoEm = pagamentoPendente ? null : Date.now()
      await updateDoc(doc(db, 'pedidos', detalhePedido.id), {
        formaPagamento: pagamentoEditando,
        pagamento: pagamentoEditando,
        pago: !pagamentoPendente,
        pagamentoStatus: pagamentoPendente ? 'pendente' : 'pago',
        pagoEm,
        pagamentoAtualizadoEm: Date.now(),
        pagamentoAtualizadoPor: usuarioLogado.uid,
        pagamentoAtualizadoPorNome: usuarioLogado.nome || 'Vendedor',
        historicoPagamentos: arrayUnion({
          formaAntiga: formaAnterior,
          formaNova: pagamentoEditando,
          alteradoPor: usuarioLogado.uid,
          alteradoPorNome: usuarioLogado.nome || 'Vendedor',
          dataHora: Date.now(),
        }),
      })
      setDetalhePedido(prev => ({
        ...prev,
        formaPagamento: pagamentoEditando,
        pagamento: pagamentoEditando,
        pago: !pagamentoPendente,
        pagamentoStatus: pagamentoPendente ? 'pendente' : 'pago',
        pagoEm,
      }))
      toast('Forma de pagamento atualizada.', 'success')
    } catch (e) {
      setErroPagamento(e.message || 'Não foi possível atualizar o pagamento.')
    } finally {
      setSalvandoPagamento(false)
    }
  }

  const hoje = useMemo(() => inicioDoDia(tempoAtual), [tempoAtual])
  const pedidosOrdenados = useMemo(() => [...pedidos].sort(compararPedidosFila), [pedidos])
  const pedidosPorData = useMemo(
    () => filtroData ? pedidosOrdenados.filter(p => pedidoDataIso(p) === filtroData) : pedidosOrdenados,
    [pedidosOrdenados, filtroData]
  )
  const formasPagamento = useMemo(() => Array.from(new Set(pedidos.map(getFormaPagamento).filter(Boolean))), [pedidos])
  const pedidosVisiveis = useMemo(() => filtrarPedidos(pedidosPorData, filtroPedidos, filtroPagamento, buscaPedido), [pedidosPorData, filtroPedidos, filtroPagamento, buscaPedido])
  const haFiltrosPedidos = Boolean(buscaPedido.trim() || filtroData || filtroPedidos !== 'todos' || filtroPagamento !== 'todos')
  const pedidoEncontrado = useMemo(() => {
    const termo = buscaPedido.trim().toLowerCase().replace(/^pedido\s*/, '')
    if (!termo || pedidosVisiveis.length === 0) return null
    const exato = pedidosVisiveis.find(pedido => {
      const codigo = pedidoCodigo(pedido).toLowerCase()
      return codigo === termo
        || codigo.replace(/^0+/, '') === termo.replace(/^0+/, '')
        || String(pedido.numero || '').toLowerCase() === termo
        || String(pedido.matricula || pedido.alunoMatricula || '').toLowerCase() === termo
        || alunoNome(pedido).toLowerCase() === termo
    })
    return exato || (pedidosVisiveis.length === 1 ? pedidosVisiveis[0] : null)
  }, [buscaPedido, pedidosVisiveis])
  const atendimentosNaoArquivados = useMemo(() => atendimentos.filter(item => !item.arquivadoVendedor), [atendimentos])
  const atendimentosAbertos = useMemo(() => atendimentosNaoArquivados.filter(item => item.status !== 'encerrada'), [atendimentosNaoArquivados])
  const atendimentosEncerrados = useMemo(() => atendimentosNaoArquivados.filter(item => item.status === 'encerrada'), [atendimentosNaoArquivados])
  const atendimentosHoje = useMemo(() => atendimentosNaoArquivados.filter(item => dataIsoLocal(item.atualizadoEm || item.criadoEm) === hojeIso()), [atendimentosNaoArquivados])
  const atendimentosVisiveis = useMemo(() => {
    const base = filtroAtendimentoPeriodo === 'hoje'
      ? atendimentosNaoArquivados.filter(item => dataIsoLocal(item.atualizadoEm || item.criadoEm) === hojeIso())
      : atendimentosNaoArquivados
    return base.filter(item => {
      if (filtroAtendimentoStatus === 'ativos') return item.status !== 'encerrada'
      if (filtroAtendimentoStatus === 'encerradas') return item.status === 'encerrada'
      return true
    })
  }, [atendimentosNaoArquivados, filtroAtendimentoPeriodo, filtroAtendimentoStatus])
  const atendimentoSelecionado = atendimentosVisiveis.find(item => item.id === atendimentoAbertoId) || null
  const vendasHoje = useMemo(() => pedidos.filter(p => {
    const data = p.pagoEm || p.retiradoEm || p.criadoEm || 0
    return normalizeStatus(p.status) !== 'cancelado' && data >= hoje && (p.pago || normalizeStatus(p.status) === 'entregue')
  }), [pedidos, hoje])
  const pedidosHojeDashboard = useMemo(() => pedidos.filter(p => {
    const date = getPedidoDate(p)
    const criadoEm = date ? date.getTime() : Number(p.criadoEm || 0)
    return criadoEm >= hoje
  }), [pedidos, hoje])
  const totalVendas = vendasHoje.reduce((acc, p) => acc + getTotalPedido(p), 0)
  const itensVendidos = useMemo(() => contarItens(vendasHoje), [vendasHoje])

  const pedidosRelatorioVendas = useMemo(() => pedidos.filter(p => {
    const date = getPedidoDate(p)
    const str = date ? dataIsoLocal(date) : null
    if (filtroVendasTipo === 'dia' && str !== filtroVendasDia) return false
    if (filtroVendasTipo === 'mes' && (!str || !str.startsWith(filtroVendasMes))) return false
    if (filtroVendasOrigem !== 'todos' && (p?.origem === 'balcao' ? 'balcao' : 'app') !== filtroVendasOrigem) return false
    return true
  }), [pedidos, filtroVendasTipo, filtroVendasDia, filtroVendasMes, filtroVendasOrigem])
  const pedidosValidosRelatorio = useMemo(() => pedidosRelatorioVendas.filter(p => !isPedidoCancelado(p)), [pedidosRelatorioVendas])
  const pedidosCanceladosRelatorio = useMemo(() => pedidosRelatorioVendas.filter(isPedidoCancelado), [pedidosRelatorioVendas])

  const produtosOrdenados = useMemo(() => [...produtos].sort(ordenarPorNome), [produtos])
  const produtosFiltrados = useMemo(() => produtosOrdenados.filter(produto => {
    const termo = buscaProduto.trim().toLowerCase()
    const buscaOk = !termo || String(produto.nome || '').toLowerCase().includes(termo) || String(produto.categoria || '').toLowerCase().includes(termo)
    const categoriaOk = filtroCategoria === 'todas' || String(produto.categoria || '') === filtroCategoria
    const disponivelOk = filtroDisponivel === 'todos' || (filtroDisponivel === 'ativos' ? produto.disponivel !== false : produto.disponivel === false)
    return buscaOk && categoriaOk && disponivelOk
  }), [produtosOrdenados, buscaProduto, filtroCategoria, filtroDisponivel])
  const categoriasProduto = useMemo(() => Array.from(new Set(produtos.map(p => p.categoria || 'Sem categoria'))).sort(), [produtos])
  const produtosParaEdicao = useMemo(() => {
    const termo = buscaProdutoEdicao.trim().toLowerCase()
    return produtosOrdenados.filter(produto => (
      produtoDisponivelParaCardapioDia(produto, producaoHoje) !== null
      && (!termo || String(produto.nome || '').toLowerCase().includes(termo))
    )).slice(0, 8)
  }, [produtosOrdenados, buscaProdutoEdicao, producaoHoje])

  const estoqueBaixo = useMemo(() => produtos.filter(p => Number(p.estoqueBaixo || 0) > 0 && Number(p.estoque || 0) <= Number(p.estoqueBaixo || 0)), [produtos])
  const producaoCozinha = useMemo(() => (producaoHoje || [])
    .filter(item => item.visivelParaVendedor !== false && !['cancelado'].includes(normalizeStatus(item.status)))
    .sort((a, b) => {
      const peso = { 'pronto para venda': 1, 'parcialmente pronto': 2, 'em producao': 3, planejado: 4, esgotado: 5 }
      return (peso[normalizeStatus(a.status)] || 9) - (peso[normalizeStatus(b.status)] || 9)
    }), [producaoHoje])
  const pendentes = pedidosHojeDashboard.filter(p => !['entregue', 'cancelado'].includes(normalizeStatus(p.status)) || contaProfessorPendente(p)).length
  const entregues = pedidosHojeDashboard.filter(p => normalizeStatus(p.status) === 'entregue').length
  const cancelados = pedidosHojeDashboard.filter(p => normalizeStatus(p.status) === 'cancelado').length

  async function confirmarRetirada(pedido) {
    if (pedidoAntesDaRetirada(pedido)) {
      alert('O tempo do pedido começará a contar a partir do horário selecionado para retirada.')
      return
    }
    if (normalizeStatus(getFormaPagamento(pedido)) !== 'conta do professor') {
      const resultado = await atualizarStatusPedido(pedido.id, 'Entregue', pedido)
      if (resultado?.erro) {
        toast(resultado.erro, 'error')
        return
      }
      if (detalhePedido?.id === pedido.id) setDetalhePedido(null)
      toast('Pedido entregue e pago com sucesso.', 'success')
      return
    }
    setRetiradaPedido(pedido)
    setConfirmacaoRetirada('')
    setErroRetirada('')
  }

  async function concluirRetirada(e) {
    e.preventDefault()
    if (!retiradaPedido) return
    const matriculaEsperada = String(retiradaPedido.matricula || retiradaPedido.alunoMatricula || '').trim()
    const valorInformado = confirmacaoRetirada.trim()
    if (!valorInformado) {
      setErroRetirada('Informe a matrícula do professor para entregar o pedido.')
      return
    }
    if (valorInformado !== matriculaEsperada) {
      setErroRetirada('A matrícula informada não corresponde ao professor deste pedido.')
      return
    }
    const resultado = await atualizarStatusPedido(retiradaPedido.id, 'Entregue')
    if (resultado?.erro) {
      setErroRetirada(resultado.erro)
      return
    }
    setRetiradaPedido(null)
    if (detalhePedido?.id === retiradaPedido.id) setDetalhePedido(null)
    setConfirmacaoRetirada('')
    setErroRetirada('')
  }

  function cancelar(pedido) {
    setPedidoCancelando(pedido)
    setMotivoCancelamento(MOTIVOS_CANCELAMENTO[0])
    setMotivoOutro('')
    setErroCancelamento('')
  }

  async function confirmarCancelamento(e) {
    e.preventDefault()
    if (!pedidoCancelando) return
    const motivo = motivoCancelamento === 'Outro motivo' ? motivoOutro.trim() : motivoCancelamento
    if (!motivo) {
      setErroCancelamento('Informe o motivo do cancelamento.')
      return
    }
    setCancelandoPedido(true)
    setErroCancelamento('')
    const resultado = await cancelarPedido(pedidoCancelando.id, motivo)
    setCancelandoPedido(false)
    if (resultado?.erro) {
      setErroCancelamento(resultado.erro)
      return
    }
    if (detalhePedido?.id === pedidoCancelando.id) setDetalhePedido(null)
    setPedidoCancelando(null)
    toast('Pedido cancelado e estoque devolvido.', 'success')
  }

  function abrirEdicaoPedido(pedido) {
    if (['entregue', 'cancelado'].includes(normalizeStatus(pedido.status))) {
      toast('Pedidos encerrados não podem ser editados.', 'error')
      return
    }
    setPedidoEditando(pedido)
    setItensEdicao((pedido.itens || []).map(item => ({
      produtoId: item.produtoId || item.id,
      nome: item.nome || item.produtoNome || 'Produto',
      quantidade: Math.max(1, Number(item.quantidade || 1)),
      preco: Number(item.preco || item.valor || 0),
    })))
    setObservacaoEdicao(pedido.observacao || pedido.observacoes || '')
    setHorarioEdicao(pedido.horarioRetirada || '')
    setPagamentoEdicao(getFormaPagamento(pedido))
    setBuscaProdutoEdicao('')
    setErroEdicao('')
  }

  function alterarQuantidadeEdicao(index, delta) {
    setItensEdicao(prev => prev.map((item, i) => i === index
      ? { ...item, quantidade: Math.max(1, Number(item.quantidade || 1) + delta) }
      : item))
  }

  function removerItemEdicao(index) {
    setItensEdicao(prev => prev.filter((_, i) => i !== index))
  }

  function adicionarProdutoEdicao(produto) {
    if (!produtoDisponivelParaCardapioDia(produto, producaoHoje)) {
      setErroEdicao('Produto indisponível no cardápio do dia.')
      return
    }
    setItensEdicao(prev => {
      const index = prev.findIndex(item => String(item.produtoId) === String(produto.id))
      if (index >= 0) {
        return prev.map((item, i) => i === index ? { ...item, quantidade: item.quantidade + 1 } : item)
      }
      return [...prev, {
        produtoId: produto.id,
        nome: produto.nome,
        quantidade: 1,
        preco: Number(produto.preco || 0),
      }]
    })
    setErroEdicao('')
  }

  async function salvarEdicaoPedido(e) {
    e.preventDefault()
    if (!pedidoEditando || itensEdicao.length === 0) {
      setErroEdicao('O pedido precisa ter pelo menos um item.')
      return
    }
    if (pagamentoEdicao === 'Conta do Professor' && perfilClientePedido(pedidoEditando, usuarios) !== 'professor') {
      setErroEdicao('Conta do Professor está disponível somente para professor cadastrado.')
      return
    }
    setSalvandoEdicao(true)
    setErroEdicao('')
    const criadoEm = getPedidoDate(pedidoEditando)?.getTime() || Number(pedidoEditando.criadoEm || Date.now())
    const horarioRetiradaEm = horarioEdicao ? horarioRetiradaParaTimestamp(horarioEdicao, criadoEm) : null
    const pagamentoMudou = pagamentoEdicao !== getFormaPagamento(pedidoEditando)
    const pagamentoPendente = pagamentoEdicao === 'Conta do Professor'
    const agora = Date.now()
    const updates = {
      itens: itensEdicao,
      total: itensEdicao.reduce((acc, item) => acc + Number(item.preco || 0) * Number(item.quantidade || 0), 0),
      observacao: observacaoEdicao.trim(),
      horarioRetirada: horarioEdicao,
      formaPagamento: pagamentoEdicao,
      pagamento: pagamentoEdicao,
      ...(horarioRetiradaEm ? {
        horarioRetiradaEm,
        inicioContagemEm: Math.max(criadoEm, horarioRetiradaEm),
        cancelavelAte: Math.max(criadoEm, horarioRetiradaEm) + JANELA_PEDIDO_MS,
      } : {}),
      ...(pagamentoMudou ? {
        pago: !pagamentoPendente,
        pagamentoStatus: pagamentoPendente ? 'pendente' : 'pago',
        pagoEm: pagamentoPendente ? null : agora,
        historicoPagamentos: arrayUnion({
          formaAntiga: getFormaPagamento(pedidoEditando),
          formaNova: pagamentoEdicao,
          alteradoPor: usuarioLogado.uid,
          alteradoPorNome: usuarioLogado.nome || 'Vendedor',
          dataHora: agora,
        }),
      } : {}),
    }
    const resultado = await editarPedido(pedidoEditando.id, updates, pedidoEditando.itens || [])
    setSalvandoEdicao(false)
    if (resultado?.erro) {
      setErroEdicao(resultado.erro)
      return
    }
    setPedidoEditando(null)
    if (detalhePedido?.id === pedidoEditando.id) setDetalhePedido(null)
    toast('Pedido atualizado com sucesso.', 'success')
  }

  async function baixarPagamentoProfessor(pedido) {
    if (!confirm(`Dar baixa no pagamento do pedido ${pedidoCodigo(pedido)}?`)) return
    const resultado = await darBaixaContaProfessor(pedido.id)
    if (resultado?.erro) {
      toast(resultado.erro, 'error')
      return
    }
    toast('Pagamento da Conta do Professor baixado.', 'success')
  }

  async function salvarEstoque(produto, estoque) {
    if (!produtoEhBebida(produto)) {
      alert('O vendedor pode editar somente o estoque de bebidas.')
      return
    }
    try {
      await atualizarProduto({ ...produto, estoque: Math.max(0, Number(estoque || 0)) })
    } catch (error) {
      alert(error.message || 'Não foi possível atualizar o estoque.')
    }
  }

  function abrirAjusteProducao(item) {
    setAjusteItem(item)
    setFormAjuste({
      quantidade: String(item.quantidadeRestante || 0),
      status: item.status || '',
      motivo: '',
      observacao: item.observacao || '',
    })
  }

  function abrirDescarte(item) {
    setDescarteItem(item)
    setFormDescarte(FORM_DESCARTE_VAZIO)
    setErroDescarte('')
  }

  async function confirmarDescarte(e) {
    e.preventDefault()
    if (!descarteItem) return
    const quantidade = Number(formDescarte.quantidade || 0)
    const maximo = maxDesperdicio(descarteItem)
    if (!quantidade || quantidade <= 0) {
      setErroDescarte('Informe uma quantidade válida para registrar o descarte.')
      return
    }
    if (quantidade > maximo) {
      setErroDescarte(`A quantidade máxima para descarte é ${maximo} un.`)
      return
    }
    try {
      const resultado = await registrarDesperdicio(descarteItem.id, descarteItem, {
        quantidade,
        motivo: formDescarte.motivo,
        observacao: formDescarte.observacao,
      })
      const produto = produtos.find(p => String(p.id) === String(descarteItem.produtoId))
      if (produto) await atualizarProduto({ ...produto, estoque: resultado.quantidadeRestante })
      setDescarteItem(null)
      setFormDescarte(FORM_DESCARTE_VAZIO)
      setErroDescarte('')
      toast('Descarte registrado e estoque atualizado.', 'success')
    } catch (error) {
      setErroDescarte(error.message || 'Não foi possível registrar o descarte.')
    }
  }

  async function confirmarAjusteProducao(e) {
    e.preventDefault()
    if (!ajusteItem) return
    if (!formAjuste.motivo.trim()) {
      alert('Informe o motivo do ajuste.')
      return
    }
    const resultado = await ajustarProducaoVendedor(ajusteItem.id, ajusteItem, {
      novaQuantidade: Number(formAjuste.quantidade || 0),
      novoStatus: formAjuste.status || ajusteItem.status,
      motivo: formAjuste.motivo.trim(),
      observacao: formAjuste.observacao.trim(),
    })
    const produto = produtos.find(p => String(p.id) === String(ajusteItem.produtoId))
    if (produto && produtoEhBebida(produto)) {
      await atualizarProduto({ ...produto, estoque: resultado.quantidadeRestante })
    }
    setAjusteItem(null)
    setFormAjuste(FORM_AJUSTE_VAZIO)
  }

  function abrirNovoProduto() {
    setProdutoEditando(null)
    setProdutoForm(PRODUTO_FORM_VAZIO)
    setErroSalvarProduto('')
    setEditorProdutoAberto(true)
  }

  function editarProduto(produto) {
    setProdutoEditando(produto.id)
    setProdutoForm(produtoParaForm(produto))
    setErroSalvarProduto('')
    setEditorProdutoAberto(true)
  }

  async function salvarProduto(e) {
    e.preventDefault()
    if (!produtoForm.nome.trim()) {
      setErroSalvarProduto('Informe o nome do produto.')
      return
    }
    setSalvandoProduto(true)
    setErroSalvarProduto('')
    try {
      const payload = formParaProduto(produtoForm)
      if (produtoEditando) {
        const original = produtos.find(p => p.id === produtoEditando)
        if (!podeEditarPreco) payload.preco = Number(original?.preco || 0)
        payload.categoria = original?.categoria || payload.categoria
        payload.estoque = Number(original?.estoque || 0)
        await atualizarProduto({ ...original, ...payload })
      } else {
        await adicionarProduto(payload)
      }
      setProdutoEditando(null)
      setProdutoForm(PRODUTO_FORM_VAZIO)
      setEditorProdutoAberto(false)
    } catch {
      setErroSalvarProduto('Não foi possível salvar o produto. Tente novamente.')
    } finally {
      setSalvandoProduto(false)
    }
  }

  function atualizarLinhaLote(index, campo, valor) {
    setLoteProdutos(prev => prev.map((item, i) => i === index ? { ...item, [campo]: valor } : item))
  }

  function toggleDiaLote(index, dia) {
    setLoteProdutos(prev => prev.map((item, i) => {
      if (i !== index) return item
      const dias = item.diasProducao || []
      return { ...item, diasProducao: dias.includes(dia) ? dias.filter(d => d !== dia) : [...dias, dia] }
    }))
  }

  function adicionarLinhaLote() {
    setLoteProdutos(prev => [...prev, { ...PRODUTO_LOTE_VAZIO }])
  }

  function removerLinhaLote(index) {
    setLoteProdutos(prev => prev.length === 1 ? prev : prev.filter((_, i) => i !== index))
  }

  async function salvarProdutosEmLote() {
    const validos = loteProdutos.filter(item => item.nome.trim())
    if (validos.length === 0) return
    await adicionarProdutos(validos.map(item => ({
      nome: item.nome.trim(),
      categoria: item.categoria || 'Lanches',
      preco: Number(item.preco || 0),
      estoque: Math.max(0, Number(item.estoque || 0)),
      estoqueInicial: Math.max(0, Number(item.estoque || 0)),
      estoqueBaixo: Math.max(0, Number(item.estoqueBaixo || 0)),
      disponivel: item.disponivel !== false,
      diasProducao: item.diasProducao || [],
      diasCardapio: item.diasProducao || [],
    })))
    setLoteProdutos([{ ...PRODUTO_LOTE_VAZIO }])
  }

  function alternarProdutoSelecionado(produtoId) {
    setProdutosSelecionados(atuais => atuais.includes(produtoId) ? atuais.filter(id => id !== produtoId) : [...atuais, produtoId])
  }

  function cancelarDisponibilidadeLote() {
    setModoDisponibilidadeLote(false)
    setProdutosSelecionados([])
  }

  async function salvarDisponibilidadeLote(disponivel) {
    if (alterandoDisponibilidade) return
    if (!produtosSelecionados.length) {
      toast(disponivel ? 'Selecione ao menos um produto para disponibilizar.' : 'Selecione ao menos um produto.', 'error')
      return
    }
    setAlterandoDisponibilidade(true)
    try {
      const resultado = await atualizarDisponibilidadeProdutos(produtosSelecionados, disponivel)
      cancelarDisponibilidadeLote()
      if (resultado?.bebidas) toast(disponivel ? 'Bebida atualizada no card�pio.' : 'Bebida pausada no card�pio.')
      else toast('A vendedora controla apenas bebidas no card�pio. As comidas s�o liberadas pela Cozinha.', 'info')
    } catch (error) {
      toast(error.message || 'Não foi possível alterar os produtos.')
    } finally {
      setAlterandoDisponibilidade(false)
    }
  }

  function renderPedidoCard(pedido, destaque = false) {
    const itens = Array.isArray(pedido.itens) ? pedido.itens : []
    const encerrado = ['entregue', 'cancelado'].includes(normalizeStatus(pedido.status))
    const podeEntregar = !encerrado
    const pagamentoProfessorPendente = contaProfessorPendente(pedido)
    const atendimentoPedido = atendimentos.find(item => String(item.pedidoId) === String(pedido.id) && !item.arquivadoVendedor)

    return (
      <article
        key={pedido.id}
        style={s.pedidoCard}
        onClick={() => abrirDetalhePedido(pedido)}
      >
        <div style={s.pedidoTop}>
          <div>
            <strong style={s.codigo}>Pedido {pedidoCodigo(pedido)}</strong>
            <p style={s.meta}>{alunoNome(pedido)} {pedido.matricula ? `- ${pedido.matricula}` : ''}</p>
          </div>
          <div style={s.pedidoBadges}>
            {atendimentoPedido && (
              <button
                type="button"
                style={{ ...s.mensagemPedidoBadge, ...(atendimentoPedido.novaParaVendedor ? s.mensagemPedidoBadgeNova : {}) }}
                onClick={e => {
                  e.stopPropagation()
                  setFiltroAtendimentoPeriodo('todos')
                  setFiltroAtendimentoStatus('todos')
                  abrirAtendimento(atendimentoPedido)
                  selecionarAba('atendimento')
                }}
              >
                <MessageCircle size={13} /> {atendimentoPedido.novaParaVendedor ? 'Nova mensagem' : 'Mensagem'}
              </button>
            )}
            <StatusBadge status={pedido.status} />
          </div>
        </div>
        <div style={s.pedidoInfoGrid}>
          <span><ShoppingBag size={14} /> {origemLabel(pedido)}</span>
          <span><CreditCard size={14} /> {getFormaPagamento(pedido)} - {pedido.pago ? 'Pago' : 'Pendente'}</span>
          <span><ShoppingBag size={14} /> {formatPrice(getTotalPedido(pedido))}</span>
          <span>{pedidoHora(pedido)} - Retirada {pedido.horarioRetirada || '--:--'}</span>
        </div>
        <div style={s.itens}>
          {itens.length === 0 ? <span style={s.meta}>Itens não informados.</span> : itens.map((item, i) => (
            <span key={`${pedido.id}-${i}`} style={s.item}>{item.quantidade || 1}x {item.nome || item.produtoNome || 'Produto'}</span>
          ))}
        </div>
        {destaque && (
          <div style={s.resultadoDetalhes}>
            <div style={s.detailGrid}>
              <p><strong>Data e hora:</strong> {formatarDataHora(getPedidoDate(pedido) || pedido.criadoEm)}</p>
              <p><strong>Retirada:</strong> {pedido.horarioRetirada || 'Não informada'}</p>
              <p><strong>Matrícula:</strong> {pedido.matricula || pedido.alunoMatricula || 'Não informada'}</p>
              <p><strong>Origem:</strong> {origemLabel(pedido)}</p>
            </div>
            {(pedido.itens || []).map((item, index) => {
              const quantidade = Number(item.quantidade || 1)
              const preco = Number(item.preco || item.valor || 0)
              return (
                <div key={`${pedido.id}-detalhe-${index}`} style={s.linhaResumo}>
                  <span>{quantidade}x {item.nome || item.produtoNome || 'Produto'} · {formatPrice(preco)} cada</span>
                  <strong>{formatPrice(preco * quantidade)}</strong>
                </div>
              )
            })}
            {(pedido.observacao || pedido.observacoes) && <p style={s.obs}><strong>Observações:</strong> {pedido.observacao || pedido.observacoes}</p>}
          </div>
        )}
        <div style={{ ...s.acoes, flexDirection: isMobile ? 'column' : 'row' }}>
          {pagamentoProfessorPendente && (
            <button style={{ ...s.btnPagamento, width: isMobile ? '100%' : 'auto' }} onClick={e => { e.stopPropagation(); baixarPagamentoProfessor(pedido) }}>
              <CreditCard size={15} /> Dar baixa no pagamento
            </button>
          )}
          {podeEntregar && (
            <button style={{ ...s.btnEntregue, width: isMobile ? '100%' : 'auto' }} onClick={e => { e.stopPropagation(); confirmarRetirada(pedido) }}>
              <CheckCircle2 size={15} /> Entregue
            </button>
          )}
          {(!encerrado || podeEditarPreco) && (
            <button style={{ ...s.btnSecundario, width: isMobile ? '100%' : 'auto' }} onClick={e => { e.stopPropagation(); abrirDetalhePedido(pedido) }}>
              <CreditCard size={15} /> Alterar pagamento
            </button>
          )}
          {!encerrado && (
            <button style={{ ...s.btnEditar, width: isMobile ? '100%' : 'auto' }} onClick={e => { e.stopPropagation(); abrirEdicaoPedido(pedido) }}>
              <Edit3 size={15} /> Editar pedido
            </button>
          )}
          <button style={{ ...s.btnSecundario, width: isMobile ? '100%' : 'auto' }} onClick={e => { e.stopPropagation(); abrirDetalhePedido(pedido) }}>
            <Eye size={15} /> Ver detalhes
          </button>
          {!encerrado && (
            <button style={{ ...s.btnPerigo, width: isMobile ? '100%' : 'auto' }} onClick={e => { e.stopPropagation(); cancelar(pedido) }}>Cancelar</button>
          )}
        </div>
      </article>
    )
  }

  function ProdutoCard({ produto }) {
    const nivel = estoqueNivel(Number(produto.estoque || 0), Number(produto.estoqueBaixo || 0))
    const podeEditarEstoque = produtoEhBebida(produto)
    const selecionado = produtosSelecionados.includes(produto.id)
    return (
      <article
        style={{ ...s.produtoCard, ...(selecionado ? { borderColor: '#3B82F6', background: '#EFF6FF' } : {}) }}
        onClick={modoDisponibilidadeLote ? () => alternarProdutoSelecionado(produto.id) : undefined}
      >
        <div style={s.produtoTop}>
          {modoDisponibilidadeLote && (
            <span style={{ width: 28, height: 28, flexShrink: 0, borderRadius: 8, border: `2px solid ${selecionado ? '#2563EB' : '#CBD5E1'}`, background: selecionado ? '#2563EB' : '#fff', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {selecionado && <CheckCircle2 size={17} />}
            </span>
          )}
          {produto.foto ? <img src={produto.foto} alt={produto.nome} style={s.thumb} /> : <div style={s.produtoIcon}><Package size={24} /></div>}
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong style={s.codigo}>{produto.nome || 'Produto'}</strong>
            <p style={s.meta}>{produto.categoria || 'Sem categoria'} - {formatPrice(produto.preco || 0)}</p>
            <p style={s.diaResumo}>{resumoDiasProduto(produto)}</p>
          </div>
        </div>
        <span style={{ ...s.badge, background: nivel.bg, color: nivel.color }}>{produto.estoque || 0} un - {nivel.label}</span>
        {modoDisponibilidadeLote ? (
          <span style={{ ...s.badge, alignSelf: 'flex-start', background: produto.disponivel === false ? '#FEE2E2' : '#D1FAE5', color: produto.disponivel === false ? '#B91C1C' : '#166534' }}>
            {produtoEhBebida(produto) ? (produto.disponivel === false ? 'Bebida pausada' : 'Bebida no card�pio') : 'Comida controlada pela Cozinha'}
          </span>
        ) : (
          <>
            <label style={s.label}>{podeEditarEstoque ? 'Atualizar estoque' : 'Estoque somente leitura'}</label>
            {podeEditarEstoque
              ? <input type="number" min="0" defaultValue={produto.estoque || 0} onBlur={e => salvarEstoque(produto, e.target.value)} style={s.input} />
              : <div style={s.estoqueSomenteLeitura}>Apenas bebidas podem ser ajustadas pelo vendedor.</div>}
            <button type="button" style={s.btnSecundario} onClick={() => setDetalheProduto(produto)}><Eye size={15} /> Ver detalhes</button>
            <button type="button" style={s.btnPrimario} onClick={() => editarProduto(produto)}><Save size={15} /> Editar</button>
          </>
        )}
      </article>
    )
  }

  const formatCurrencyV = v => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`
  const periodoRelatorioVendas = filtroVendasTipo === 'dia'
    ? `Dia ${filtroVendasDia.split('-').reverse().join('/')}`
    : filtroVendasTipo === 'mes'
      ? `Mes ${filtroVendasMes.split('-').reverse().join('/')}`
      : 'Todos os periodos'

  async function exportarPDFVendas() {
    if (gerandoPDFVendas) return
    setGerandoPDFVendas(true)
    let jsPDF, autoTable
    try {
      [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
    } catch {
      alert('Nao foi possivel carregar o gerador de PDF.')
      setGerandoPDFVendas(false)
      return
    }
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const W = doc.internal.pageSize.getWidth()
      const H = doc.internal.pageSize.getHeight()
      const mx = 10
      const azul = [0, 61, 124]
      function cab() {
        doc.setFillColor(255,255,255); doc.rect(0,0,W,26,'F')
        doc.setFillColor(...azul); doc.rect(0,0,W,4,'F')
        doc.setFillColor(244,121,32); doc.rect(0,4,W,1.2,'F')
        doc.setFont('helvetica','bold'); doc.setFontSize(14); doc.setTextColor(...azul)
        doc.text('Senac Lanches - Relatorio de Vendas', mx, 13)
        doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(85,94,112)
        doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}  |  Periodo: ${periodoRelatorioVendas}`, mx, 19)
      }
      function rod() {
        doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(130,140,155)
        doc.text(`Pagina ${doc.internal.getNumberOfPages()}`, W - mx, H - 6, { align: 'right' })
      }
      function tab(titulo, head, body) {
        const startY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 10 : 32
        if (titulo) { doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(...azul); doc.text(titulo, mx, startY - 3) }
        autoTable(doc, {
          startY, head: [head],
          body: body.length ? body : [[{ content: 'Nenhum registro encontrado.', colSpan: head.length, styles: { halign: 'center' } }]],
          margin: { left: mx, right: mx, top: 30, bottom: 14 }, theme: 'grid',
          headStyles: { fillColor: azul, textColor: [255,255,255], fontStyle: 'bold', fontSize: 7.4, cellPadding: 1.6 },
          bodyStyles: { fontSize: 7.1, cellPadding: 1.5, textColor: [71,85,105] },
          alternateRowStyles: { fillColor: [248,250,252] },
          didDrawPage: () => { cab(); rod() },
        })
      }
      cab(); rod()
      const totalV = pedidosValidosRelatorio.reduce((s, p) => s + getTotalPedido(p), 0)
      tab('Resumo', ['Indicador','Valor'], [
        ['Pedidos validos', String(pedidosValidosRelatorio.length)],
        ['Pedidos cancelados', String(pedidosCanceladosRelatorio.length)],
        ['Total arrecadado', formatCurrencyV(totalV)],
        ['Media por pedido', formatCurrencyV(pedidosValidosRelatorio.length > 0 ? totalV / pedidosValidosRelatorio.length : 0)],
        ['Periodo', periodoRelatorioVendas],
      ])
      tab('Pedidos validos', ['Pedido','Aluno','Origem','Itens','Total','Pagamento','Status','Data/Hora'],
        pedidosValidosRelatorio.map(p => [
          pedidoCodigo(p), alunoNome(p), origemLabel(p), getItensTexto(p),
          formatCurrencyV(getTotalPedido(p)), getFormaPagamento(p), p.status || 'Nao informado',
          formatarDataHora(getPedidoDate(p) || p.criadoEm),
        ])
      )
      if (pedidosCanceladosRelatorio.length > 0) {
        tab('Pedidos cancelados', ['Pedido','Aluno','Origem','Itens','Total','Status','Data/Hora'],
          pedidosCanceladosRelatorio.map(p => [
            pedidoCodigo(p), alunoNome(p), origemLabel(p), getItensTexto(p),
            formatCurrencyV(getTotalPedido(p)), p.status || 'Cancelado',
            formatarDataHora(getPedidoDate(p) || p.criadoEm),
          ])
        )
      }
      const sufixo = filtroVendasTipo === 'dia' ? filtroVendasDia : filtroVendasTipo === 'mes' ? filtroVendasMes : 'todos'
      doc.save(`relatorio-vendas-${sufixo}.pdf`)
    } catch (err) {
      console.error('Erro PDF vendas:', err)
      alert('Nao foi possivel gerar o PDF.')
    } finally {
      setGerandoPDFVendas(false)
    }
  }

  function exportarExcelVendas() {
    const H = v => `<Cell ss:StyleID="H"><Data ss:Type="String">${xmlEscape(v)}</Data></Cell>`
    const C = v => `<Cell ss:StyleID="C"><Data ss:Type="String">${xmlEscape(String(v ?? ''))}</Data></Cell>`
    const R = cells => `<Row>${cells}</Row>`
    const styles = `<Style ss:ID="H"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#003D7C" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center" ss:Vertical="Center"/></Style><Style ss:ID="C"><Alignment ss:Vertical="Center" ss:WrapText="1"/><Font ss:Color="#334155"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/></Borders></Style>`
    const colsVal = [80,150,80,240,90,110,100,130].map(w=>`<Column ss:Width="${w}"/>`).join('')
    const colsCanc = [80,150,80,240,90,100,130].map(w=>`<Column ss:Width="${w}"/>`).join('')
    const headVal = R([H('Pedido'),H('Aluno'),H('Origem'),H('Itens'),H('Total'),H('Pagamento'),H('Status'),H('Data/Hora')].join(''))
    const headCanc = R([H('Pedido'),H('Aluno'),H('Origem'),H('Itens'),H('Total'),H('Status'),H('Data/Hora')].join(''))
    const rowsVal = pedidosValidosRelatorio.map(p => R([pedidoCodigo(p),alunoNome(p),origemLabel(p),getItensTexto(p),formatCurrencyV(getTotalPedido(p)),getFormaPagamento(p),p.status||'Nao informado',formatarDataHora(getPedidoDate(p)||p.criadoEm)].map(C).join(''))).join('')
    const rowsCanc = pedidosCanceladosRelatorio.map(p => R([pedidoCodigo(p),alunoNome(p),origemLabel(p),getItensTexto(p),formatCurrencyV(getTotalPedido(p)),p.status||'Cancelado',formatarDataHora(getPedidoDate(p)||p.criadoEm)].map(C).join(''))).join('')
    const wb = `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles>${styles}</Styles><Worksheet ss:Name="Pedidos Validos"><Table ss:DefaultRowHeight="22">${colsVal}${headVal}${rowsVal||R(C('Nenhum pedido valido encontrado.'))}</Table></Worksheet><Worksheet ss:Name="Pedidos Cancelados"><Table ss:DefaultRowHeight="22">${colsCanc}${headCanc}${rowsCanc||R(C('Nenhum pedido cancelado encontrado.'))}</Table></Worksheet></Workbook>`
    const blob = new Blob(['﻿' + wb], { type: 'application/vnd.ms-excel;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const sufixo = filtroVendasTipo === 'dia' ? filtroVendasDia : filtroVendasTipo === 'mes' ? filtroVendasMes : 'todos'
    a.download = `relatorio-vendas-${sufixo}.xls`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <Layout titulo={aba === 'balcao' ? null : (podeEditarPreco ? 'Gestão de pedidos' : 'Painel do Vendedor')}>
      <div style={{ ...s.page, paddingBottom: isMobile ? 128 : 32 }}>
        {(aba === 'dashboard' || (aba === 'pedidos' && !podeEditarPreco)) && (
          <div style={{ ...s.statsGrid, gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(5, minmax(0, 1fr))' }}>
            <StatCard icon={ClipboardList} label="Pendentes" value={pendentes} color="#F59E0B" onClick={() => { setFiltroPedidos('pendentes'); setFiltroData(hojeIso()); selecionarAba('pedidos') }} />
            <StatCard icon={PackageCheck} label="Entregues" value={entregues} color="#22C55E" onClick={() => { setFiltroPedidos('entregues'); setFiltroData(hojeIso()); selecionarAba('pedidos') }} />
            <StatCard icon={ShoppingBag} label="Vendas hoje" value={formatPrice(totalVendas)} color="#003D7C" onClick={() => selecionarAba('vendas')} />
            <StatCard icon={AlertTriangle} label="Estoque baixo" value={estoqueBaixo.length} color="#EF4444" onClick={() => navigate(ROTAS_ABA.estoque, { state: { filtroInicial: 'atencao' } })} />
            <StatCard icon={XCircle} label="Cancelados" value={cancelados} color="#A855F7" onClick={() => { setFiltroPedidos('cancelados'); setFiltroData(hojeIso()); selecionarAba('pedidos') }} />
          </div>
        )}

        {aba === 'dashboard' && (
          <>
            <section style={s.sectionCard}>
              <div style={s.sectionHeader}>
                <h3 style={s.sectionTitle}>Produção da cozinha</h3>
                <span style={s.meta}>{producaoCozinha.length} item(ns) informado(s)</span>
              </div>
              <div style={s.lista}>
                {producaoCozinha.length === 0 ? <EmptyState>Nenhuma produção informada pela cozinha hoje.</EmptyState> : producaoCozinha.slice(0, 8).map(item => {
                  const visual = producaoVisual(item.status)
                  return (
                    <article key={item.id} style={s.prodRow}>
                      <div style={s.prodRowTop}>
                        <div style={s.produtoMini}>
                          <div style={s.produtoMiniThumb}>
                            {item.produtoFoto
                              ? <img src={item.produtoFoto} alt={item.produtoNome} style={s.produtoMiniImg} />
                              : <Package size={18} color="#94A3B8" />
                            }
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <strong style={s.codigo}>{item.produtoNome}</strong>
                            <p style={s.meta}>{item.produtoCategoria || 'Produto'}</p>
                          </div>
                        </div>
                        <strong style={s.prodRowQtd}>{item.quantidadeRestante || 0} un</strong>
                        <span style={{ ...s.badge, background: visual.bg, color: visual.color }}>{visual.label}</span>
                        <button style={s.iconBtnMenu} onClick={() => abrirAjusteProducao(item)} title="Ajustar producao recebida"><Edit3 size={16} /></button>
                        <button
                          style={{ ...s.iconBtnMenu, color: '#DC2626', background: '#FEE2E2', opacity: maxDesperdicio(item) <= 0 ? 0.55 : 1 }}
                          onClick={() => abrirDescarte(item)}
                          title="Registrar descarte"
                          disabled={maxDesperdicio(item) <= 0}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div style={s.producaoInfo}>
                        <span><Clock size={13} /> Previsão: <strong>{item.horarioPrevisto || '--:--'}</strong></span>
                        <span>Atualizado às <strong>{horaAtualizacao(item.atualizadoEm)}</strong></span>
                      </div>
                      {item.observacao && <p style={s.obs}>{item.observacao}</p>}
                    </article>
                  )
                })}
              </div>
            </section>

            <div style={{ ...s.contentGrid, gridTemplateColumns: isMobile ? '1fr' : '1.35fr 1fr' }}>
              <section style={s.sectionCard}>
                <div style={s.sectionHeader}>
                  <h3 style={s.sectionTitle}>Pedidos recentes</h3>
                  <button style={s.linkBtn} onClick={() => selecionarAba('pedidos')}>Ver todos</button>
                </div>
                <div style={{ ...s.searchBox, ...(isMobile ? s.searchBoxMobilePedido : {}) }}>
                  <Search size={16} color="#64748B" />
                  <input value={buscaPedido} onChange={e => setBuscaPedido(e.target.value)} placeholder={isMobile ? 'Pedido, nome ou matricula' : 'Buscar por matricula ou numero do pedido'} style={{ ...s.searchInput, ...(isMobile ? s.searchInputMobile : {}) }} />
                </div>
                <div style={s.filtros}>
                  <input type="date" value={filtroData} onChange={e => setFiltroData(e.target.value)} style={s.selectFiltro} />
                  <button style={{ ...s.filtroBtn, ...(filtroData === hojeIso() ? s.filtroBtnAtivo : {}) }} onClick={() => setFiltroData(hojeIso())}>Hoje</button>
                  {filtroData && <button style={s.filtroBtn} onClick={() => setFiltroData('')}>Todos os dias</button>}
                  {FILTROS_PEDIDOS.map(([id, label]) => (
                    <button key={id} style={{ ...s.filtroBtn, ...(filtroPedidos === id ? s.filtroBtnAtivo : {}) }} onClick={() => setFiltroPedidos(id)}>{label}</button>
                  ))}
                </div>
                {pedidosVisiveis.length === 0 ? <EmptyState>Nenhum pedido encontrado {filtroData ? `em ${filtroData.split('-').reverse().join('/')}` : ''}.</EmptyState> : pedidosVisiveis.slice(0, 4).map(pedido => renderPedidoCard(pedido))}
              </section>
              <section style={s.sectionCard}>
                <div style={s.sectionHeader}>
                  <h3 style={s.sectionTitle}>Estoque em atenção</h3>
                  {estoqueBaixo.length > 0 && (
                    <button style={s.linkBtn} onClick={() => navigate(ROTAS_ABA.estoque, { state: { filtroInicial: 'atencao' } })}>Ver tudo</button>
                  )}
                </div>
                {estoqueBaixo.length === 0 ? <EmptyState>Nenhum produto com estoque crítico.</EmptyState> : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {estoqueBaixo.slice(0, 6).map(produto => (
                      <button
                        key={produto.id}
                        type="button"
                        style={s.estoqueMiniRow}
                        onClick={() => navigate(ROTAS_ABA.estoque, { state: { filtroInicial: 'atencao' } })}
                      >
                        {produto.foto ? <img src={produto.foto} alt={produto.nome} style={s.estoqueMiniThumb} /> : <div style={{ ...s.estoqueMiniThumb, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Package size={16} color="#94A3B8" /></div>}
                        <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 700, fontSize: '0.85rem', color: '#1A202C' }}>{produto.nome}</span>
                        <span style={s.estoqueMiniBadge}>{produto.estoque} un</span>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </>
        )}

        {aba === 'pedidos' && (
          <section style={s.sectionCard}>
            <div style={s.orientacaoRetirada}>A confirmação de matrícula é exigida somente para pedidos na Conta do Professor.</div>
            <div style={s.sectionHeader}>
              <h3 style={s.sectionTitle}>Buscar Pedido</h3>
              <button type="button" style={s.btnLeitorQr} onClick={() => setLeitorQrAberto(true)}>
                <ScanLine size={17} /> Ler QR Code
              </button>
            </div>
            <div style={s.filtrosPedidos}>
              <div style={{ ...s.searchBoxPedidos, ...(isMobile ? s.searchBoxPedidosMobile : {}) }}>
                <Search size={17} color="#64748B" />
                <input value={buscaPedido} onChange={e => setBuscaPedido(e.target.value)} placeholder={isMobile ? 'Pedido, nome ou matricula' : 'Número, matrícula, nome ou status'} style={{ ...s.searchInput, ...(isMobile ? s.searchInputMobile : {}) }} />
              </div>

              <div style={s.filtroGrupos}>
                <div style={s.filtroGrupo}>
                  <span style={s.filtroRotulo}>Período</span>
                  <div style={s.filtroOpcoes}>
                    <input aria-label="Data dos pedidos" type="date" value={filtroData} onChange={e => setFiltroData(e.target.value)} style={s.selectFiltro} />
                    <button type="button" style={{ ...s.filtroBtn, ...(filtroData === hojeIso() ? s.filtroBtnPeriodoAtivo : {}) }} onClick={() => setFiltroData(hojeIso())}>Hoje</button>
                    <button type="button" style={{ ...s.filtroBtn, ...(!filtroData ? s.filtroBtnPeriodoAtivo : {}) }} onClick={() => setFiltroData('')}>Todos os dias</button>
                  </div>
                </div>

                <div style={s.filtroGrupo}>
                  <span style={s.filtroRotulo}>Status</span>
                  <div style={s.filtroOpcoes}>
                    {FILTROS_PEDIDOS.map(([id, label]) => (
                      <button type="button" key={id} style={{ ...s.filtroBtn, ...(filtroPedidos === id ? s.filtroBtnAtivo : {}) }} onClick={() => setFiltroPedidos(id)}>{label}</button>
                    ))}
                  </div>
                </div>

                <label style={s.filtroGrupo}>
                  <span style={s.filtroRotulo}>Forma de pagamento</span>
                  <select value={filtroPagamento} onChange={e => setFiltroPagamento(e.target.value)} style={s.selectFiltro}>
                    <option value="todos">Todas as formas</option>
                    {formasPagamento.map(forma => <option key={forma} value={forma}>{forma}</option>)}
                  </select>
                </label>
              </div>

              <div style={s.filtroRodape}>
                <span style={s.filtroResultado}>{pedidosVisiveis.length} {pedidosVisiveis.length === 1 ? 'pedido encontrado' : 'pedidos encontrados'}</span>
                {haFiltrosPedidos && <button type="button" style={s.limparFiltrosBtn} onClick={limparFiltrosPedidos}>Limpar filtros</button>}
              </div>
            </div>
            {pedidoEncontrado && (
              <div style={s.resultadoBusca}>
                <span style={s.resultadoLabel}>Pedido encontrado</span>
                {renderPedidoCard(pedidoEncontrado, true)}
              </div>
            )}
            <div style={s.lista}>
              {pedidosVisiveis.length === 0
                ? <EmptyState>Nenhum registro encontrado{filtroData ? ` em ${filtroData.split('-').reverse().join('/')}` : ''}.</EmptyState>
                : pedidosVisiveis
                  .filter(pedido => pedido.id !== pedidoEncontrado?.id)
                  .map(pedido => renderPedidoCard(pedido))}
            </div>
          </section>
        )}

        {aba === 'atendimento' && (
          <section style={{ ...s.sectionCard, ...s.atendimentoSection }}>
            <div style={s.atendimentoHeader}>
              <div>
                <h3 style={s.sectionTitle}><MessageCircle size={18} /> Atendimento</h3>
                <p style={s.meta}>Conversas vinculadas aos pedidos.</p>
              </div>
              <div style={s.atendimentoResumo}>
                <span style={s.atendimentoResumoItem}><strong>{atendimentosAbertos.length}</strong> abertas</span>
                <span style={s.atendimentoResumoItem}><strong>{atendimentosHoje.length}</strong> hoje</span>
                <span style={s.atendimentoResumoItem}><strong>{atendimentosEncerrados.length}</strong> encerradas</span>
              </div>
            </div>

            <div style={s.atendimentoToolbar}>
              <div style={s.filtroOpcoes}>
                {[
                  ['hoje', 'Hoje'],
                  ['todos', 'Todos os dias'],
                ].map(([valor, label]) => (
                  <button key={valor} type="button" style={{ ...s.filtroBtn, ...(filtroAtendimentoPeriodo === valor ? s.filtroBtnPeriodoAtivo : {}) }} onClick={() => setFiltroAtendimentoPeriodo(valor)}>
                    {label}
                  </button>
                ))}
              </div>
              <div style={s.filtroOpcoes}>
                {[
                  ['ativos', 'Abertos'],
                  ['encerradas', 'Encerrados'],
                  ['todos', 'Todos'],
                ].map(([valor, label]) => (
                  <button key={valor} type="button" style={{ ...s.filtroBtn, ...(filtroAtendimentoStatus === valor ? s.filtroBtnAtivo : {}) }} onClick={() => setFiltroAtendimentoStatus(valor)}>
                    {label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                style={{ ...s.btnPerigo, minHeight: 38, padding: '0.5rem 0.75rem', opacity: atendimentosEncerrados.length > 0 ? 1 : 0.55 }}
                onClick={() => limparHistoricoAtendimento(atendimentosEncerrados)}
                disabled={limpandoAtendimento || atendimentosEncerrados.length === 0}
              >
                <Trash2 size={14} /> {limpandoAtendimento ? 'Limpando...' : 'Limpar histórico'}
              </button>
            </div>

            {atendimentosVisiveis.length === 0 ? (
              <EmptyState>Nenhuma conversa encontrada neste filtro.</EmptyState>
            ) : (
              <div style={{ ...s.atendimentoGrid, gridTemplateColumns: '1fr' }}>
                <div style={s.atendimentoLista}>
                  {atendimentosVisiveis.map(atendimento => {
                    const ativo = atendimentoSelecionado?.id === atendimento.id
                    const pedido = pedidoDoAtendimento(atendimento)
                    const encerrado = atendimento.status === 'encerrada'
                    return (
                      <button
                        key={atendimento.id}
                        type="button"
                        style={{ ...s.atendimentoCard, ...(ativo ? s.atendimentoCardAtivo : {}), ...(atendimento.novaParaVendedor ? s.atendimentoCardNovo : {}) }}
                        onClick={() => abrirAtendimento(atendimento)}
                      >
                        <div style={s.atendimentoTop}>
                          <strong>Pedido {codigoAtendimento(atendimento)}</strong>
                          <span style={{ ...s.badge, background: encerrado ? '#E2E8F0' : '#DCFCE7', color: encerrado ? '#475569' : '#166534' }}>
                            {encerrado ? 'Encerrado' : 'Aberto'}
                          </span>
                        </div>
                        <span style={s.atendimentoCliente}>{atendimento.solicitanteNome} · {atendimento.solicitantePerfil || 'cliente'}</span>
                        <div style={s.atendimentoMiniInfo}>
                          <span>{pedido?.status || atendimento.pedidoStatus || 'Pedido sem status'}</span>
                          <span>{formatPrice(getTotalPedido(pedido || {}))}</span>
                        </div>
                        <p style={s.atendimentoUltima}>{atendimento.ultimaMensagem || 'Sem mensagem recente'}</p>
                        <div style={s.atendimentoRodape}>
                          <span>{formatarDataHora(atendimento.atualizadoEm, 'Agora')}</span>
                          {atendimento.novaParaVendedor && <span style={s.novoBadge}>Nova</span>}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        {aba === 'atendimento' && atendimentoSelecionado && (() => {
          const atendimento = atendimentoSelecionado
          const pedido = pedidoDoAtendimento(atendimento)
          const mensagens = atendimento.mensagens || []
          const encerrado = atendimento.status === 'encerrada'
          return (
            <div style={s.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="chat-atendimento-title">
              <div style={{ ...s.modal, maxWidth: 680, padding: isMobile ? 16 : 20 }}>
                <div style={s.modalHeader}>
                  <div>
                    <h3 id="chat-atendimento-title" style={s.modalTitle}>Pedido {codigoAtendimento(atendimento)}</h3>
                    <p style={s.meta}>{atendimento.solicitanteNome} · {atendimento.solicitanteMatricula || atendimento.solicitanteEmail || 'Sem identificador'}</p>
                  </div>
                  <button style={s.closeBtn} onClick={() => setAtendimentoAbertoId('')}>Fechar</button>
                </div>
                <div style={s.atendimentoPedidoInfo}>
                  <span>Status: <strong>{pedido?.status || atendimento.pedidoStatus || 'Não informado'}</strong></span>
                  <span>Total: <strong>{formatPrice(getTotalPedido(pedido || {}))}</strong></span>
                  <span>Atualizado: <strong>{formatarDataHora(atendimento.atualizadoEm, 'Agora')}</strong></span>
                </div>
                <div style={s.atendimentoMensagens}>
                  {mensagens.map(msg => {
                    const vendedor = msg.tipo === 'vendedor'
                    return (
                      <div key={msg.id} style={{ ...s.atendimentoMsg, ...(vendedor ? s.atendimentoMsgVendedor : s.atendimentoMsgCliente) }}>
                        <strong>{vendedor ? 'Vendedor' : msg.autorNome || 'Cliente'}</strong>
                        <p>{msg.texto}</p>
                        <span>{formatarDataHora(msg.criadoEm, '')}</span>
                      </div>
                    )
                  })}
                </div>
                {encerrado ? (
                  <div style={s.estoqueSomenteLeitura}>Atendimento encerrado.</div>
                ) : (
                  <div style={s.atendimentoForm}>
                    <input
                      value={respostaAtendimento}
                      onChange={e => setRespostaAtendimento(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') enviarRespostaAtendimento(atendimento) }}
                      placeholder="Responder solicitação..."
                      style={{ ...s.input, flex: 1, minWidth: isMobile ? '100%' : 220 }}
                      maxLength={500}
                    />
                    <button type="button" style={s.btnPrimario} onClick={() => enviarRespostaAtendimento(atendimento)} disabled={enviandoAtendimento || !respostaAtendimento.trim()}>
                      <Send size={15} /> Responder
                    </button>
                    <button type="button" style={s.btnPerigo} onClick={() => finalizarAtendimento(atendimento)}>
                      Encerrar
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })()}

        {aba === 'balcao' && <PedidoBalcao />}

        {aba === 'produtos' && (
          <div style={{ ...s.contentGrid, gridTemplateColumns: isMobile ? '1fr' : 'minmax(300px, 390px) 1fr' }}>
            <section style={s.sectionCard}>
              <div style={s.sectionHeader}>
                <h3 style={s.sectionTitle}>Cadastro de produtos</h3>
              </div>
              <p style={s.meta}>Cadastre um novo produto com foto, informações nutricionais e alérgenos.</p>
              <div style={s.acoes}>
                <button type="button" style={s.btnPrimario} onClick={abrirNovoProduto}><PlusCircle size={15} /> Novo produto</button>
              </div>

              <div style={s.loteBox}>
                <div style={s.sectionHeader}>
                  <h3 style={s.sectionTitle}>Cadastro em lote</h3>
                  <span style={s.meta}>{loteProdutos.filter(item => item.nome.trim()).length} pronto(s)</span>
                </div>
                {loteProdutos.map((item, index) => (
                  <div key={index} style={s.loteItem}>
                    <input value={item.nome} onChange={e => atualizarLinhaLote(index, 'nome', e.target.value)} placeholder="Nome" style={s.input} />
                    <div style={s.formGrid}>
                      <input type="number" step="0.01" value={item.preco} onChange={e => atualizarLinhaLote(index, 'preco', e.target.value)} placeholder="Preço" style={s.input} />
                      <input type="number" value={item.estoque} onChange={e => atualizarLinhaLote(index, 'estoque', e.target.value)} placeholder="Estoque" style={s.input} />
                    </div>
                    <div style={s.diasLinha}>
                      {DIAS_CARDAPIO.map(dia => {
                        const ativo = (item.diasProducao || []).includes(dia)
                        return (
                          <button key={dia} type="button" onClick={() => toggleDiaLote(index, dia)} style={{ ...s.diaBtn, ...(ativo ? s.diaBtnAtivo : {}) }}>
                            {DIAS_LABEL[dia] || dia}
                          </button>
                        )
                      })}
                    </div>
                    <button type="button" style={s.btnPerigo} onClick={() => removerLinhaLote(index)}>Remover linha</button>
                  </div>
                ))}
                <div style={s.acoes}>
                  <button type="button" style={s.btnSecundario} onClick={adicionarLinhaLote}><PlusCircle size={15} /> Adicionar linha</button>
                  <button type="button" style={s.btnPrimario} onClick={salvarProdutosEmLote}><Save size={15} /> Salvar lote</button>
                </div>
              </div>
            </section>

            <section style={s.sectionCard}>
              <div style={s.sectionHeader}>
                <h3 style={s.sectionTitle}>Produtos cadastrados</h3>
                <button type="button" style={modoDisponibilidadeLote ? s.btnPerigo : s.btnSecundario} onClick={() => modoDisponibilidadeLote ? cancelarDisponibilidadeLote() : setModoDisponibilidadeLote(true)}>
                  {modoDisponibilidadeLote ? <><XCircle size={15} /> Cancelar seleção</> : <><CheckCircle2 size={15} /> Disponibilidade em lote</>}
                </button>
              </div>
              {modoDisponibilidadeLote && (
                <div style={{ ...s.acoes, padding: 10, borderRadius: 10, background: '#EFF6FF' }}>
                  <button type="button" style={s.btnSecundario} onClick={() => setProdutosSelecionados(produtosFiltrados.map(produto => produto.id))}>Selecionar exibidos</button>
                  <span style={s.meta}>{produtosSelecionados.length} selecionado(s)</span>
                  <button type="button" style={s.btnEntregue} disabled={alterandoDisponibilidade} onClick={() => salvarDisponibilidadeLote(true)}><CheckCircle2 size={15} /> Disponibilizar no cardápio</button>
                  <button type="button" style={s.btnEditar} disabled={!produtosSelecionados.length || alterandoDisponibilidade} onClick={() => salvarDisponibilidadeLote(false)}><EyeOff size={15} /> Pausar venda</button>
                </div>
              )}
              <div style={s.searchBox}>
                <Search size={16} color="#64748B" />
                <input value={buscaProduto} onChange={e => setBuscaProduto(e.target.value)} placeholder="Pesquisar produto" style={s.searchInput} />
              </div>
              <div style={s.categoriaChips}>
                <button type="button" style={{ ...s.categoriaChip, ...(filtroCategoria === 'todas' ? s.categoriaChipAtivo : {}) }} onClick={() => setFiltroCategoria('todas')}>
                  Todos
                </button>
                {CATEGORIAS_RAPIDAS_PRODUTOS.map(categoria => (
                  <button
                    key={categoria}
                    type="button"
                    style={{ ...s.categoriaChip, ...(filtroCategoria === categoria ? s.categoriaChipAtivo : {}) }}
                    onClick={() => setFiltroCategoria(categoria)}
                  >
                    {categoria}
                  </button>
                ))}
              </div>
              <div style={s.filtros}>
                <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)} style={s.selectFiltro}>
                  <option value="todas">Todas categorias</option>
                  {categoriasProduto.map(categoria => <option key={categoria} value={categoria}>{categoria}</option>)}
                </select>
                <select value={filtroDisponivel} onChange={e => setFiltroDisponivel(e.target.value)} style={s.selectFiltro}>
                  <option value="todos">Todos status</option>
                  <option value="ativos">Ativos</option>
                  <option value="inativos">Inativos</option>
                </select>
              </div>
              <div style={s.produtosGrid}>
                {produtosFiltrados.length === 0 ? <EmptyState>Nenhum produto encontrado.</EmptyState> : produtosFiltrados.map(produto => <ProdutoCard key={produto.id} produto={produto} />)}
              </div>
            </section>
          </div>
        )}

        {aba === 'estoque' && <GerenciarEstoque />}

        {aba === 'vendas' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <section style={s.sectionCard}>
              <div style={{ display: 'flex', alignItems: isMobile ? 'stretch' : 'flex-start', justifyContent: 'space-between', gap: 16, flexDirection: isMobile ? 'column' : 'row', flexWrap: 'wrap' }}>
                <div>
                  <h3 style={s.sectionTitle}>Exportar relatorios</h3>
                  <p style={s.meta}>PDF e Excel com os pedidos do periodo selecionado.</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: 4, background: '#F1F5F9', borderRadius: 12, padding: 3 }}>
                    {[['dia','Dia'],['mes','Mes'],['todos','Todos']].map(([v,l]) => (
                      <button key={v} type="button" style={{ border: 'none', background: filtroVendasTipo === v ? '#003D7C' : 'transparent', color: filtroVendasTipo === v ? '#fff' : '#64748B', borderRadius: 9, padding: '0.48rem 0.8rem', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => setFiltroVendasTipo(v)}>{l}</button>
                    ))}
                  </div>
                  {filtroVendasTipo === 'dia' && <input type="date" value={filtroVendasDia} onChange={e => setFiltroVendasDia(e.target.value)} style={s.input} />}
                  {filtroVendasTipo === 'mes' && <input type="month" value={filtroVendasMes} onChange={e => setFiltroVendasMes(e.target.value)} style={s.input} />}
                  <select value={filtroVendasOrigem} onChange={e => setFiltroVendasOrigem(e.target.value)} style={s.input}>
                    <option value="todos">Todas as origens</option>
                    <option value="app">App</option>
                    <option value="balcao">Balcao</option>
                  </select>
                  <button style={{ ...s.btnPrimario, opacity: gerandoPDFVendas ? 0.7 : 1, width: isMobile ? '100%' : 'auto' }} onClick={exportarPDFVendas} disabled={gerandoPDFVendas}>
                    {gerandoPDFVendas ? 'Gerando...' : 'Baixar PDF'}
                  </button>
                  <button style={{ ...s.btnEntregue, width: isMobile ? '100%' : 'auto' }} onClick={exportarExcelVendas}>Baixar Excel</button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', borderTop: '1px solid #E2E8F0', paddingTop: 12, marginTop: 4 }}>
                <span style={s.meta}><strong style={{ color: '#003D7C' }}>{pedidosValidosRelatorio.length}</strong> validos</span>
                <span style={s.meta}><strong style={{ color: '#DC2626' }}>{pedidosCanceladosRelatorio.length}</strong> cancelados</span>
                <span style={s.meta}>Total: <strong style={{ color: '#166534' }}>{formatCurrencyV(pedidosValidosRelatorio.reduce((acc, p) => acc + getTotalPedido(p), 0))}</strong></span>
              </div>
            </section>
            <div style={{ ...s.contentGrid, gridTemplateColumns: isMobile ? '1fr' : 'minmax(260px, 360px) 1fr' }}>
              <section style={s.sectionCard}>
                <h3 style={s.sectionTitle}>Resumo do dia</h3>
                <div style={s.vendasBox}><span>Total vendido hoje</span><strong>{formatPrice(totalVendas)}</strong></div>
                <div style={s.vendasBox}><span>Pedidos pagos/retirados</span><strong>{vendasHoje.length}</strong></div>
              </section>
              <section style={s.sectionCard}>
                <h3 style={s.sectionTitle}>Itens vendidos hoje</h3>
                {itensVendidos.length === 0 ? <EmptyState>Sem vendas hoje.</EmptyState> : itensVendidos.map(([nome, qtd]) => (
                  <div key={nome} style={s.linhaResumo}><span>{nome}</span><strong>{qtd} un</strong></div>
                ))}
              </section>
            </div>
          </div>
        )}

        {aba === 'avisos' && (
          <section style={s.sectionCard}>
            <div style={s.sectionHeader}>
              <h3 style={s.sectionTitle}><Megaphone size={18} /> Avisos do vendedor</h3>
            </div>
            <AvisosSetor setor="vendedor" />
          </section>
        )}
      </div>

      {ajusteItem && (
        <div style={s.modalOverlay} role="dialog" aria-modal="true">
          <div style={{ ...s.modal, maxWidth: 480, padding: isMobile ? 18 : 24 }}>
            <div style={s.modalHeader}>
              <div>
                <h3 style={s.modalTitle}>Ajustar produção recebida</h3>
                <p style={s.meta}>{ajusteItem.produtoNome} - Disponível atual: {ajusteItem.quantidadeRestante || 0} un</p>
              </div>
              <button style={s.closeBtn} onClick={() => setAjusteItem(null)}>Fechar</button>
            </div>
            <form onSubmit={confirmarAjusteProducao} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label style={s.label}>Nova quantidade disponivel</label>
              <input
                type="number" min="0"
                value={formAjuste.quantidade}
                onChange={e => setFormAjuste({ ...formAjuste, quantidade: e.target.value })}
                style={s.input} required
              />
              <label style={s.label}>Novo status do dia</label>
              <select value={formAjuste.status} onChange={e => setFormAjuste({ ...formAjuste, status: e.target.value })} style={s.input}>
                <option value={ajusteItem.status}>{ajusteItem.status} (manter)</option>
                {STATUS_AJUSTE_PRODUCAO.filter(st => st !== ajusteItem.status).map(status => <option key={status} value={status}>{status}</option>)}
              </select>
              <label style={s.label}>Motivo do ajuste</label>
              <input
                value={formAjuste.motivo}
                onChange={e => setFormAjuste({ ...formAjuste, motivo: e.target.value })}
                placeholder="Ex.: contagem fisica, produto esgotou, sobrou estoque..." style={s.input} required
              />
              <label style={s.label}>Observacao (opcional)</label>
              <input
                value={formAjuste.observacao}
                onChange={e => setFormAjuste({ ...formAjuste, observacao: e.target.value })}
                placeholder="Observacao adicional" style={s.input}
              />
              <div style={s.acoes}>
                <button type="submit" style={s.btnPrimario}><Save size={15} /> Salvar ajuste</button>
                <button type="button" style={s.btnSecundario} onClick={() => setAjusteItem(null)}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {descarteItem && (
        <div style={s.modalOverlay} role="dialog" aria-modal="true">
          <div style={{ ...s.modal, maxWidth: 480, padding: isMobile ? 18 : 24 }}>
            <div style={s.modalHeader}>
              <div>
                <h3 style={s.modalTitle}>Registrar descarte</h3>
                <p style={s.meta}>{descarteItem.produtoNome} - Disponível para descarte: {maxDesperdicio(descarteItem)} un</p>
              </div>
              <button style={s.closeBtn} onClick={() => setDescarteItem(null)}>Fechar</button>
            </div>
            <form onSubmit={confirmarDescarte} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label style={s.label}>Quantidade descartada</label>
              <input
                type="number"
                min="1"
                max={maxDesperdicio(descarteItem)}
                value={formDescarte.quantidade}
                onChange={e => { setFormDescarte({ ...formDescarte, quantidade: e.target.value }); setErroDescarte('') }}
                placeholder="Quantidade"
                style={s.input}
                required
              />
              <label style={s.label}>Motivo</label>
              <select value={formDescarte.motivo} onChange={e => setFormDescarte({ ...formDescarte, motivo: e.target.value })} style={s.input}>
                {MOTIVOS_DESPERDICIO.map(motivo => <option key={motivo} value={motivo}>{motivo}</option>)}
              </select>
              <label style={s.label}>Observação (opcional)</label>
              <input
                value={formDescarte.observacao}
                onChange={e => setFormDescarte({ ...formDescarte, observacao: e.target.value })}
                placeholder="Ex.: produto caiu, venceu, sobrou no balcão..."
                style={s.input}
              />
              {erroDescarte && <p style={s.erroRetirada}>{erroDescarte}</p>}
              <div style={s.acoes}>
                <button type="submit" style={s.btnPerigoForte}><Trash2 size={15} /> Confirmar descarte</button>
                <button type="button" style={s.btnSecundario} onClick={() => setDescarteItem(null)}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {leitorQrAberto && (
        <LeitorQrPedido
          aberto
          onClose={() => setLeitorQrAberto(false)}
          onResultado={lerPedidoPorQr}
        />
      )}

      {retiradaPedido && (
        <div style={s.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="titulo-retirada">
          <form onSubmit={concluirRetirada} style={{ ...s.modal, maxWidth: 460, padding: isMobile ? 18 : 24 }}>
            <div style={s.modalHeader}>
              <div>
                <h3 id="titulo-retirada" style={s.modalTitle}>Entregar pedido {pedidoCodigo(retiradaPedido)}</h3>
                <p style={s.meta}>{alunoNome(retiradaPedido)}</p>
              </div>
              <button type="button" style={s.closeBtn} onClick={() => setRetiradaPedido(null)}>Fechar</button>
            </div>
            <div style={s.orientacaoRetirada}>Confirme a matrícula do professor antes de entregar pela Conta do Professor.</div>
            <label style={s.label} htmlFor="confirmacao-retirada">Matrícula do professor</label>
            <input
              id="confirmacao-retirada"
              value={confirmacaoRetirada}
              onChange={e => { setConfirmacaoRetirada(e.target.value); setErroRetirada('') }}
              style={{ ...s.input, width: '100%', boxSizing: 'border-box', marginTop: 6 }}
              placeholder="Digite a matrícula"
              inputMode="numeric"
              autoFocus
            />
            {erroRetirada && <p role="alert" style={s.erroRetirada}>{erroRetirada}</p>}
            <button type="submit" style={{ ...s.btnPrimario, width: '100%', marginTop: 14 }}>
              <CheckCircle2 size={15} /> Confirmar entrega
            </button>
          </form>
        </div>
      )}

      {pedidoCancelando && (
        <div style={s.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="titulo-cancelamento">
          <form onSubmit={confirmarCancelamento} style={{ ...s.modal, maxWidth: 500, padding: isMobile ? 18 : 24 }}>
            <div style={s.modalHeader}>
              <div>
                <h3 id="titulo-cancelamento" style={s.modalTitle}>Cancelar pedido {pedidoCodigo(pedidoCancelando)}</h3>
                <p style={s.meta}>O estoque dos itens será devolvido automaticamente.</p>
              </div>
              <button type="button" style={s.closeBtn} onClick={() => setPedidoCancelando(null)}>Fechar</button>
            </div>
            <p style={s.avisoPerigo}>Tem certeza que deseja cancelar este pedido?</p>
            <label style={s.label} htmlFor="motivo-cancelamento">Motivo do cancelamento</label>
            <select id="motivo-cancelamento" value={motivoCancelamento} onChange={e => { setMotivoCancelamento(e.target.value); setErroCancelamento('') }} style={{ ...s.selectFiltro, width: '100%', minHeight: 44, marginTop: 6 }}>
              {MOTIVOS_CANCELAMENTO.map(motivo => <option key={motivo} value={motivo}>{motivo}</option>)}
            </select>
            {motivoCancelamento === 'Outro motivo' && (
              <input value={motivoOutro} onChange={e => { setMotivoOutro(e.target.value); setErroCancelamento('') }} placeholder="Descreva o motivo" style={{ ...s.input, width: '100%', boxSizing: 'border-box', marginTop: 10 }} autoFocus />
            )}
            {erroCancelamento && <p role="alert" style={s.erroRetirada}>{erroCancelamento}</p>}
            <button type="submit" style={{ ...s.btnPerigoForte, width: '100%', marginTop: 14 }} disabled={cancelandoPedido}>
              <XCircle size={16} /> {cancelandoPedido ? 'Cancelando...' : 'Confirmar cancelamento'}
            </button>
          </form>
        </div>
      )}

      {pedidoEditando && (
        <div style={s.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="titulo-edicao-pedido">
          <form onSubmit={salvarEdicaoPedido} style={{ ...s.modal, maxWidth: 900, padding: isMobile ? 18 : 24 }}>
            <div style={s.modalHeader}>
              <div>
                <h3 id="titulo-edicao-pedido" style={s.modalTitle}>Editar pedido {pedidoCodigo(pedidoEditando)}</h3>
                <p style={s.meta}>{alunoNome(pedidoEditando)} · estoque validado ao salvar</p>
              </div>
              <button type="button" style={s.closeBtn} onClick={() => setPedidoEditando(null)}>Fechar</button>
            </div>

            <h4 style={s.detailTitle}>Itens do pedido</h4>
            <div style={s.editorItens}>
              {itensEdicao.map((item, index) => (
                <div key={`${item.produtoId}-${index}`} style={s.editorItem}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <strong style={s.codigo}>{item.nome}</strong>
                    <p style={s.meta}>{formatPrice(item.preco)} cada · {formatPrice(item.preco * item.quantidade)}</p>
                  </div>
                  <div style={s.quantidadeControle}>
                    <button type="button" title="Diminuir quantidade" style={s.iconBtnMenu} onClick={() => alterarQuantidadeEdicao(index, -1)}><Minus size={15} /></button>
                    <strong>{item.quantidade}</strong>
                    <button type="button" title="Aumentar quantidade" style={s.iconBtnMenu} onClick={() => alterarQuantidadeEdicao(index, 1)}><Plus size={15} /></button>
                    <button type="button" title="Remover item" style={s.iconBtnPerigo} onClick={() => removerItemEdicao(index)}><Trash2 size={15} /></button>
                  </div>
                </div>
              ))}
              {itensEdicao.length === 0 && <EmptyState>Adicione pelo menos um produto.</EmptyState>}
            </div>

            <h4 style={s.detailTitle}>Adicionar produto</h4>
            <div style={{ ...s.searchBox, width: '100%', boxSizing: 'border-box' }}>
              <Search size={16} color="#64748B" />
              <input value={buscaProdutoEdicao} onChange={e => setBuscaProdutoEdicao(e.target.value)} placeholder="Buscar produto disponível" style={s.searchInput} />
            </div>
            <div style={s.produtosEdicao}>
              {produtosParaEdicao.map(produto => (
                <button type="button" key={produto.id} style={s.produtoEdicaoBtn} onClick={() => adicionarProdutoEdicao(produto)}>
                  <PlusCircle size={16} />
                  <span>{produto.nome}</span>
                  <small>{produto.estoque} un · {formatPrice(produto.preco)}</small>
                </button>
              ))}
            </div>

            <div style={{ ...s.formGrid, gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr' }}>
              <label style={s.campoLabel}>Forma de pagamento
                <select value={pagamentoEdicao} onChange={e => setPagamentoEdicao(e.target.value)} style={{ ...s.selectFiltro, width: '100%', minHeight: 44 }}>
                  {[...new Set([getFormaPagamento(pedidoEditando), ...PAGAMENTOS_BALCAO, ...(perfilClientePedido(pedidoEditando, usuarios) === 'professor' ? ['Conta do Professor'] : [])])].map(forma => <option key={forma} value={forma}>{forma}</option>)}
                </select>
              </label>
              <label style={s.campoLabel}>Horário de retirada
                <input type="time" value={horarioEdicao} onChange={e => setHorarioEdicao(e.target.value)} style={{ ...s.input, width: '100%', boxSizing: 'border-box' }} />
              </label>
            </div>
            <label style={s.campoLabel}>Observações
              <textarea value={observacaoEdicao} onChange={e => setObservacaoEdicao(e.target.value)} placeholder="Observação do pedido" rows={3} style={{ ...s.input, width: '100%', boxSizing: 'border-box', resize: 'vertical' }} />
            </label>
            <div style={s.totalEdicao}><span>Total atualizado</span><strong>{formatPrice(itensEdicao.reduce((acc, item) => acc + item.preco * item.quantidade, 0))}</strong></div>
            {erroEdicao && <p role="alert" style={s.erroRetirada}>{erroEdicao}</p>}
            <button type="submit" style={{ ...s.btnEditar, width: '100%', marginTop: 14 }} disabled={salvandoEdicao || itensEdicao.length === 0}>
              <Save size={16} /> {salvandoEdicao ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </form>
        </div>
      )}

      {detalhePedido && (
        <div style={s.modalOverlay} role="dialog" aria-modal="true">
          <div style={{ ...s.modal, padding: isMobile ? 18 : 24 }}>
            <div style={s.modalHeader}>
              <div>
                <h3 style={s.modalTitle}>Pedido {pedidoCodigo(detalhePedido)}</h3>
                <p style={s.meta}>{alunoNome(detalhePedido)} {detalhePedido.matricula ? `- ${detalhePedido.matricula}` : ''}</p>
              </div>
              <button style={s.closeBtn} onClick={() => setDetalhePedido(null)}>Fechar</button>
            </div>
            <div style={s.detailGrid}>
              <p><strong>{clienteLabel(detalhePedido, usuarios)}:</strong> {alunoNome(detalhePedido)}</p>
              <p><strong>Matrícula:</strong> {detalhePedido.matricula || detalhePedido.alunoMatricula || 'Não informada'}</p>
              <p><strong>Cadastro:</strong> {detalhePedido.origem === 'balcao' && detalhePedido.alunoCadastrado === false ? 'Sem cadastro' : 'Cadastrado'}</p>
              <p><strong>Origem:</strong> {origemLabel(detalhePedido)}</p>
              <p><strong>Lançado por:</strong> {detalhePedido.lancadoPor?.nome || detalhePedido.lancadoPorNome || alunoNome(detalhePedido)}</p>
              <p><strong>Status:</strong> <StatusBadge status={detalhePedido.status} /></p>
              <p><strong>Pagamento:</strong> {getFormaPagamento(detalhePedido)} - {detalhePedido.pago ? 'Pago' : 'Pendente'}</p>
              <p><strong>Data:</strong> {formatarDataHora(getPedidoDate(detalhePedido) || detalhePedido.criadoEm || detalhePedido.createdAt)}</p>
              <p><strong>Horário de retirada:</strong> {detalhePedido.horarioRetirada || 'Não informado'}</p>
              <p><strong>Entregue por:</strong> {detalhePedido.entreguePorNome || 'Ainda não entregue'}</p>
              <p><strong>Total:</strong> {formatPrice(getTotalPedido(detalhePedido))}</p>
            </div>
            {(!['entregue', 'cancelado'].includes(normalizeStatus(detalhePedido.status)) || podeEditarPreco) && (
              <div style={s.pagamentoEditor}>
                <label htmlFor="pagamento-pedido"><strong>Alterar forma de pagamento</strong></label>
                <div style={{ ...s.acoes, flexDirection: isMobile ? 'column' : 'row' }}>
                  <select
                    id="pagamento-pedido"
                    value={pagamentoEditando}
                    onChange={e => setPagamentoEditando(e.target.value)}
                    style={{ ...s.selectFiltro, flex: 1, minHeight: 44 }}
                  >
                    {[...new Set([
                      getFormaPagamento(detalhePedido),
                      ...PAGAMENTOS_BALCAO,
                      ...(perfilClientePedido(detalhePedido, usuarios) === 'professor' ? ['Conta do Professor'] : []),
                    ])].map(forma => <option key={forma} value={forma}>{forma}</option>)}
                  </select>
                  <button
                    type="button"
                    style={s.btnPrimario}
                    onClick={salvarPagamentoPedido}
                    disabled={salvandoPagamento || pagamentoEditando === getFormaPagamento(detalhePedido)}
                  >
                    <Save size={15} /> {salvandoPagamento ? 'Salvando...' : 'Salvar pagamento'}
                  </button>
                </div>
                {erroPagamento && <p role="alert" style={s.erroRetirada}>{erroPagamento}</p>}
              </div>
            )}
            <h4 style={s.detailTitle}>Itens</h4>
            <div style={s.lista}>
              {(detalhePedido.itens || []).map((item, index) => {
                const quantidade = Number(item.quantidade || 1)
                const preco = Number(item.preco || item.valor || 0)
                return (
                  <div key={`${item.nome || 'item'}-${index}`} style={s.linhaResumo}>
                    <span>{quantidade}x {item.nome || item.produtoNome || 'Produto'} · {formatPrice(preco)} cada</span>
                    <strong>{formatPrice(preco * quantidade)}</strong>
                  </div>
                )
              })}
            </div>
            {(detalhePedido.observacao || detalhePedido.observacoes) && (
              <><h4 style={s.detailTitle}>Observações</h4><p style={s.obs}>{detalhePedido.observacao || detalhePedido.observacoes}</p></>
            )}
            <div style={{ ...s.acoes, marginTop: 18, flexDirection: isMobile ? 'column' : 'row' }}>
              {!['entregue', 'cancelado'].includes(normalizeStatus(detalhePedido.status)) && (
                <>
                  <button type="button" style={s.btnEntregue} onClick={() => confirmarRetirada(detalhePedido)}><CheckCircle2 size={15} /> Entregue</button>
                  <button type="button" style={s.btnEditar} onClick={() => { setDetalhePedido(null); abrirEdicaoPedido(detalhePedido) }}><Edit3 size={15} /> Editar pedido</button>
                  <button type="button" style={s.btnPerigo} onClick={() => { setDetalhePedido(null); cancelar(detalhePedido) }}><XCircle size={15} /> Cancelar pedido</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {editorProdutoAberto && (
        <ProdutoFormModal
          titulo={produtoEditando ? 'Editar produto' : 'Novo produto'}
          subtitulo={produtoEditando ? 'Atualize as informações do produto.' : 'Cadastre um novo produto para o cardápio'}
          form={produtoForm}
          setForm={setProdutoForm}
          onSalvar={salvarProduto}
          onFechar={() => { setEditorProdutoAberto(false); setProdutoEditando(null); setProdutoForm(PRODUTO_FORM_VAZIO) }}
          salvando={salvandoProduto}
          erroSalvar={erroSalvarProduto}
          isMobile={isMobile}
          precoDesabilitado={!!produtoEditando && !podeEditarPreco}
          categoriaDesabilitada={!!produtoEditando}
          estoqueDesabilitado={!!produtoEditando || !produtoEhBebida(produtoForm)}
          minimoDesabilitado
        />
      )}

      {detalheProduto && (
        <div style={s.modalOverlay} role="dialog" aria-modal="true">
          <div style={{ ...s.modal, padding: isMobile ? 18 : 24 }}>
            <div style={s.modalHeader}>
              <div>
                <h3 style={s.modalTitle}>{detalheProduto.nome || 'Produto'}</h3>
                <p style={s.meta}>{detalheProduto.categoria || 'Sem categoria'}</p>
              </div>
              <button style={s.closeBtn} onClick={() => setDetalheProduto(null)}>Fechar</button>
            </div>
            {detalheProduto.foto && <img src={detalheProduto.foto} alt={detalheProduto.nome} style={s.produtoFotoModal} />}
            <div style={s.detailGrid}>
              <p><strong>Preço:</strong> {formatPrice(detalheProduto.preco || 0)}</p>
              <p><strong>Estoque:</strong> {detalheProduto.estoque || 0} un</p>
              <p><strong>Estoque mínimo:</strong> {detalheProduto.estoqueBaixo || 0} un</p>
              <p><strong>Status:</strong> {detalheProduto.disponivel === false ? 'Indisponível' : 'Disponível'}</p>
              <p><strong>Dias no cardápio:</strong> {resumoDiasProduto(detalheProduto)}</p>
            </div>
            <h4 style={s.detailTitle}>Descrição / composição</h4>
            <p style={s.obs}>{detalheProduto.descricao || detalheProduto.composicao || detalheProduto.ingredientes || 'Informação não cadastrada.'}</p>
            <h4 style={s.detailTitle}>Alérgenos e nutricional</h4>
            <p style={s.obs}>{detalheProduto.alergenos || detalheProduto.nutricional || detalheProduto.infoNutricional || 'Informação não cadastrada.'}</p>
          </div>
        </div>
      )}
    </Layout>
  )
}

const s = {
  page: { display: 'flex', flexDirection: 'column', gap: 16 },
  statsGrid: { display: 'grid', gap: 12, alignItems: 'stretch' },
  statCard: { background: '#fff', borderRadius: 14, padding: 16, boxShadow: '0 8px 24px rgba(15,23,42,0.06)', display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 },
  statIcon: { width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  statLabel: { color: '#64748B', fontSize: '0.78rem', fontWeight: 700, lineHeight: 1.25, minHeight: '2.1em', display: 'flex', alignItems: 'flex-end' },
  statValue: { fontSize: '1.4rem', fontWeight: 900, lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  statUnidade: { fontSize: '0.75rem', fontWeight: 700, opacity: 0.7 },
  contentGrid: { display: 'grid', gap: 16, alignItems: 'start' },
  sectionCard: { background: '#fff', borderRadius: 'clamp(12px, 1.5vw, 18px)', padding: 'clamp(14px, 2vw, 20px)', boxShadow: '0 8px 24px rgba(15,23,42,0.06)', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 },
  sectionHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  sectionTitle: { margin: 0, fontWeight: 900, color: '#0F172A', fontSize: '1rem', display: 'inline-flex', alignItems: 'center', gap: 8 },
  lista: { display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 },
  pedidoCard: { border: '1px solid #E5E7EB', background: '#F8FAFC', borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 12, cursor: 'pointer' },
  resultadoBusca: { border: '2px solid #93C5FD', background: '#EFF6FF', borderRadius: 12, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 },
  resultadoLabel: { color: '#1D4ED8', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase' },
  resultadoDetalhes: { borderTop: '1px solid #DBEAFE', paddingTop: 8 },
  orientacaoRetirada: { background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', borderRadius: 10, padding: '0.7rem 0.85rem', fontSize: '0.84rem', fontWeight: 800 },
  erroRetirada: { margin: '0.65rem 0 0', background: '#FEE2E2', color: '#B91C1C', borderRadius: 9, padding: '0.6rem 0.75rem', fontSize: '0.82rem', fontWeight: 700 },
  pedidoTop: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  pedidoBadges: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' },
  mensagemPedidoBadge: { border: '1px solid #BFDBFE', background: '#EFF6FF', color: '#003D7C', borderRadius: 999, padding: '0.28rem 0.65rem', fontSize: '0.72rem', fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' },
  mensagemPedidoBadgeNova: { borderColor: '#F47920', background: '#FFF7ED', color: '#C2410C' },
  pedidoInfoGrid: { display: 'flex', gap: 14, flexWrap: 'wrap', color: '#64748B', fontSize: '0.82rem', fontWeight: 700 },
  codigo: { color: '#0F172A', fontWeight: 900 },
  meta: { color: '#64748B', fontSize: '0.84rem', margin: 0, lineHeight: 1.45 },
  badge: { borderRadius: 999, padding: '0.25rem 0.7rem', fontSize: '0.74rem', fontWeight: 900, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
  filtros: { display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' },
  filtrosPedidos: { width: '100%', display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 2 },
  filtroGrupos: { display: 'flex', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap' },
  filtroGrupo: { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 },
  filtroRotulo: { color: '#64748B', fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase' },
  filtroOpcoes: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  filtroRodape: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', paddingTop: 10, borderTop: '1px solid #E2E8F0' },
  filtroResultado: { color: '#475569', fontSize: '0.8rem', fontWeight: 800 },
  limparFiltrosBtn: { border: 'none', background: 'transparent', color: '#1D4ED8', padding: '0.35rem 0', fontSize: '0.78rem', fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit' },
  filtroBtn: { border: '1px solid #E2E8F0', background: '#fff', color: '#64748B', borderRadius: 999, padding: '0.42rem 0.8rem', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' },
  filtroBtnPeriodoAtivo: { background: '#F47920', color: '#fff', borderColor: '#F47920' },
  filtroBtnAtivo: { background: '#003D7C', color: '#fff', borderColor: '#003D7C' },
  categoriaChips: { display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' },
  categoriaChip: { border: '1px solid #CBD5E1', background: '#fff', color: '#475569', borderRadius: 999, padding: '0.45rem 0.85rem', fontSize: '0.78rem', fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit' },
  categoriaChipAtivo: { background: '#003D7C', borderColor: '#003D7C', color: '#fff', boxShadow: '0 5px 14px rgba(0,61,124,0.16)' },
  selectFiltro: { border: '1px solid #CBD5E1', background: '#fff', color: '#475569', borderRadius: 12, padding: '0.5rem 0.75rem', fontWeight: 700, fontFamily: 'inherit' },
  searchBox: { display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #CBD5E1', borderRadius: 12, padding: '0 0.75rem', minHeight: 40, background: '#fff', minWidth: 0, width: '100%', flex: '1 1 auto' },
  searchBoxMobilePedido: { minHeight: 38, borderRadius: 10, borderColor: '#BFD0E4', background: '#fff', boxSizing: 'border-box', padding: '0 0.65rem' },
  searchBoxPedidos: { width: '100%', minHeight: 42, boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 10, padding: '0 0.8rem', borderRadius: 12, border: '1.5px solid #D8E4F2', background: '#F8FBFF', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8), 0 8px 20px rgba(15,23,42,0.04)', flex: '0 0 auto' },
  searchBoxPedidosMobile: { minHeight: 40, borderRadius: 10, padding: '0 0.65rem', borderColor: '#BFD0E4', background: '#fff', boxShadow: 'none' },
  searchInput: { border: 'none', outline: 'none', fontFamily: 'inherit', flex: 1, minWidth: 0, fontWeight: 700 },
  searchInputMobile: { fontSize: '0.82rem' },
  input: { border: '1px solid #CBD5E1', borderRadius: 12, padding: '0.72rem 0.8rem', fontFamily: 'inherit', outlineColor: '#003D7C', minHeight: 44 },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  fotoLinha: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  fotoPreview: { width: 78, height: 78, borderRadius: 14, background: '#F8FAFC', border: '1px dashed #CBD5E1', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  fotoImg: { width: '100%', height: '100%', objectFit: 'cover' },
  check: { display: 'flex', gap: 8, alignItems: 'center', color: '#475569', fontWeight: 800, fontSize: '0.86rem' },
  label: { color: '#475569', fontSize: '0.78rem', fontWeight: 800 },
  diasLinha: { display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 },
  diaBtn: { padding: '0.32rem 0.65rem', borderRadius: 999, border: '1.5px solid #CBD5E1', background: '#fff', color: '#64748B', fontSize: '0.74rem', fontWeight: 800, cursor: 'pointer' },
  diaBtnAtivo: { background: '#E8F0FB', color: '#003D7C', borderColor: '#003D7C' },
  diaResumo: { margin: '4px 0 0', color: '#1D4ED8', background: '#EFF6FF', borderRadius: 8, padding: '0.16rem 0.45rem', fontSize: '0.7rem', fontWeight: 800, display: 'inline-block' },
  loteBox: { borderTop: '1px solid #E2E8F0', marginTop: 6, paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 },
  loteItem: { background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 14, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 },
  itens: { display: 'flex', gap: 7, flexWrap: 'wrap' },
  item: { background: '#fff', color: '#475569', borderRadius: 20, padding: '0.3rem 0.7rem', fontSize: '0.8rem', fontWeight: 700, border: '1px solid #E2E8F0' },
  acoes: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  btnPrimario: { background: '#003D7C', color: '#fff', border: 'none', borderRadius: 12, padding: '0.68rem 0.95rem', fontWeight: 900, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, minHeight: 44, fontFamily: 'inherit' },
  btnLeitorQr: { background: '#F47920', color: '#fff', border: 'none', borderRadius: 12, padding: '0.68rem 0.95rem', fontWeight: 900, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, minHeight: 44, fontFamily: 'inherit' },
  btnEntregue: { background: '#15803D', color: '#fff', border: 'none', borderRadius: 12, padding: '0.68rem 0.95rem', fontWeight: 900, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, minHeight: 44, fontFamily: 'inherit' },
  btnEditar: { background: '#F47920', color: '#fff', border: 'none', borderRadius: 12, padding: '0.68rem 0.95rem', fontWeight: 900, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, minHeight: 44, fontFamily: 'inherit' },
  btnPagamento: { background: '#15803D', color: '#fff', border: 'none', borderRadius: 12, padding: '0.68rem 0.95rem', fontWeight: 900, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, minHeight: 44, fontFamily: 'inherit' },
  btnSecundario: { background: '#E8F0FB', color: '#003D7C', border: 'none', borderRadius: 12, padding: '0.68rem 0.95rem', fontWeight: 900, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, minHeight: 44, fontFamily: 'inherit' },
  btnPerigo: { background: '#FEE2E2', color: '#DC2626', border: 'none', borderRadius: 12, padding: '0.68rem 0.95rem', fontWeight: 900, cursor: 'pointer', minHeight: 44, fontFamily: 'inherit' },
  btnPerigoForte: { background: '#DC2626', color: '#fff', border: 'none', borderRadius: 12, padding: '0.68rem 0.95rem', fontWeight: 900, cursor: 'pointer', minHeight: 44, fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7 },
  linkBtn: { border: 'none', background: '#EFF6FF', color: '#1D4ED8', borderRadius: 10, padding: '0.5rem 0.75rem', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' },
  estoqueMiniRow: { display: 'flex', alignItems: 'center', gap: 10, border: '1px solid #F1F5F9', background: '#F8FAFC', borderRadius: 12, padding: '0.5rem 0.7rem', cursor: 'pointer', fontFamily: 'inherit', width: '100%', textAlign: 'left' },
  estoqueMiniThumb: { width: 34, height: 34, borderRadius: 8, objectFit: 'cover', background: '#E2E8F0', flexShrink: 0 },
  estoqueMiniBadge: { background: '#FEE2E2', color: '#B91C1C', borderRadius: 999, padding: '0.18rem 0.6rem', fontSize: '0.75rem', fontWeight: 800, flexShrink: 0 },
  estoqueSomenteLeitura: { background: '#F1F5F9', color: '#64748B', borderRadius: 10, padding: '0.65rem 0.75rem', fontSize: '0.78rem', fontWeight: 700 },
  atendimentoSection: { gap: 16 },
  atendimentoHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' },
  atendimentoResumo: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  atendimentoResumoItem: { background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 999, padding: '0.35rem 0.65rem', color: '#475569', fontSize: '0.76rem', fontWeight: 800 },
  atendimentoToolbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', borderTop: '1px solid #E2E8F0', borderBottom: '1px solid #E2E8F0', padding: '12px 0' },
  atendimentoGrid: { display: 'grid', gap: 16, alignItems: 'start' },
  atendimentoLista: { display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0, maxHeight: 620, overflowY: 'auto', paddingRight: 2 },
  atendimentoCard: { border: '1px solid #D8E4F2', background: '#fff', borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', width: '100%', boxShadow: '0 6px 16px rgba(15,23,42,0.04)' },
  atendimentoCardAtivo: { borderColor: '#003D7C', background: '#EFF6FF', boxShadow: '0 10px 24px rgba(0,61,124,0.12)' },
  atendimentoCardNovo: { borderLeft: '4px solid #F47920' },
  atendimentoTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  atendimentoCliente: { color: '#475569', fontSize: '0.82rem', fontWeight: 800, lineHeight: 1.3 },
  atendimentoMiniInfo: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, color: '#64748B', fontSize: '0.76rem', fontWeight: 800, background: '#F8FAFC', borderRadius: 10, padding: '0.38rem 0.55rem' },
  atendimentoUltima: { margin: 0, color: '#0F172A', fontSize: '0.82rem', fontWeight: 800, lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' },
  atendimentoRodape: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, color: '#94A3B8', fontSize: '0.72rem', fontWeight: 800 },
  novoBadge: { background: '#F47920', color: '#fff', borderRadius: 999, padding: '0.12rem 0.5rem', fontSize: '0.68rem', fontWeight: 900 },
  atendimentoPainel: { border: '1px solid #D8E4F2', background: '#F8FAFC', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0, position: 'sticky', top: 88 },
  atendimentoPainelHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  atendimentoPedidoInfo: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 10, color: '#64748B', fontSize: '0.78rem', fontWeight: 800 },
  atendimentoMensagens: { display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 430, overflowY: 'auto', padding: 4 },
  atendimentoMsg: { maxWidth: '86%', borderRadius: 12, padding: '0.65rem 0.8rem', fontSize: '0.82rem', lineHeight: 1.4 },
  atendimentoMsgCliente: { alignSelf: 'flex-start', background: '#fff', color: '#0F172A', border: '1px solid #E2E8F0' },
  atendimentoMsgVendedor: { alignSelf: 'flex-end', background: '#003D7C', color: '#fff' },
  atendimentoForm: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  prodRow: { border: '1px solid #E5E7EB', background: '#fff', borderRadius: 14, padding: '0.7rem 0.85rem', display: 'flex', flexDirection: 'column', gap: 8 },
  prodRowTop: { display: 'flex', alignItems: 'center', gap: 10 },
  prodRowQtd: { color: '#0F172A', fontSize: '0.88rem', whiteSpace: 'nowrap' },
  produtoMini: { display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 },
  produtoMiniThumb: { width: 40, height: 40, borderRadius: 10, overflow: 'hidden', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  produtoMiniImg: { width: '100%', height: '100%', objectFit: 'cover' },
  iconBtnMenu: { width: 34, height: 34, borderRadius: 10, border: 'none', background: '#F1F5F9', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 },
  producaoInfo: { display: 'flex', gap: 14, flexWrap: 'wrap', color: '#475569', fontSize: '0.82rem', fontWeight: 700 },
  produtosGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 },
  produtoCard: { display: 'flex', flexDirection: 'column', gap: 10, background: '#F8FAFC', border: '1px solid #E5E7EB', borderRadius: 14, padding: 14, minWidth: 0 },
  produtoTop: { display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 },
  thumb: { width: 58, height: 58, borderRadius: 12, objectFit: 'cover', flexShrink: 0 },
  produtoIcon: { width: 58, height: 58, borderRadius: 12, background: '#E8F0FB', color: '#003D7C', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  vendasBox: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC', border: '1px solid #E5E7EB', borderRadius: 14, padding: 14, color: '#64748B', fontWeight: 800 },
  linhaResumo: { display: 'flex', justifyContent: 'space-between', gap: 10, borderBottom: '1px solid #E2E8F0', padding: '0.55rem 0', color: '#334155' },
  avisoPerigo: { background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 10, padding: 12, fontWeight: 800 },
  editorItens: { display: 'flex', flexDirection: 'column', gap: 8 },
  editorItem: { border: '1px solid #E2E8F0', borderRadius: 10, padding: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  quantidadeControle: { display: 'flex', alignItems: 'center', gap: 8 },
  iconBtnPerigo: { width: 34, height: 34, borderRadius: 10, border: 'none', background: '#FEE2E2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  produtosEdicao: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 8, marginTop: 8 },
  produtoEdicaoBtn: { border: '1px solid #CBD5E1', background: '#fff', color: '#0F172A', borderRadius: 10, padding: 10, cursor: 'pointer', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 8px', alignItems: 'center', textAlign: 'left', fontFamily: 'inherit', fontWeight: 800 },
  campoLabel: { color: '#475569', fontSize: '0.82rem', fontWeight: 800, display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 },
  totalEdicao: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC', borderTop: '2px solid #E2E8F0', marginTop: 14, padding: '14px 4px 0', color: '#0F172A', fontSize: '1.05rem', fontWeight: 900 },
  vazio: { background: '#F8FAFC', borderRadius: 14, padding: '2rem', textAlign: 'center', color: '#94A3B8', border: '1px dashed #CBD5E1', fontWeight: 700 },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modal: { width: '100%', maxWidth: 820, maxHeight: '90vh', overflowY: 'auto', background: '#fff', borderRadius: 18, boxShadow: '0 24px 80px rgba(15,23,42,0.25)' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, marginBottom: 16 },
  modalTitle: { margin: 0, color: '#0F172A', fontSize: '1.2rem', fontWeight: 900 },
  closeBtn: { border: 'none', background: '#003D7C', color: '#fff', borderRadius: 10, minHeight: 40, padding: '0 0.9rem', fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit' },
  detailGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, color: '#475569', fontSize: '0.88rem' },
  pagamentoEditor: { borderTop: '1px solid #E2E8F0', borderBottom: '1px solid #E2E8F0', padding: '14px 0', marginTop: 12, color: '#334155' },
  detailTitle: { margin: '16px 0 8px', color: '#0F172A' },
  obs: { color: '#475569', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: 12, margin: 0, lineHeight: 1.45 },
  produtoFotoModal: { width: '100%', maxHeight: 260, objectFit: 'cover', borderRadius: 14, marginBottom: 14, background: '#E2E8F0' },
}
