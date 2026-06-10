import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  AlertTriangle, CheckCircle2, ClipboardList, Clock, CreditCard, Edit3, Eye,
  ImagePlus, Megaphone, Package, PackageCheck, PlusCircle, Save, Search, ShoppingBag, XCircle,
} from 'lucide-react'
import Layout from '../../components/Layout'
import AvisosSetor from '../../components/AvisosSetor'
import { useApp } from '../../contexts/AppContext'
import { formatPrice } from '../../utils/formatters'
import { estoqueNivel } from '../../utils/statusColors'
import { useIsMobile } from '../../utils/useIsMobile'
import { processarFotoPerfil } from '../../utils/image.js'
import { DIAS_CARDAPIO, DIAS_LABEL, resumoDiasProduto } from '../../utils/cardapioDias'
import { ehGestao } from '../../utils/perfis'

const ROTAS_ABA = {
  dashboard: '/vendedor',
  pedidos: '/vendedor/pedidos',
  produtos: '/vendedor/produtos',
  estoque: '/vendedor/estoque',
  vendas: '/vendedor/vendas',
  avisos: '/vendedor/avisos',
}

function abaPorRota(pathname) {
  if (pathname.includes('/pedidos')) return 'pedidos'
  if (pathname.includes('/produtos')) return 'produtos'
  if (pathname.includes('/estoque')) return 'estoque'
  if (pathname.includes('/vendas')) return 'vendas'
  if (pathname.includes('/avisos')) return 'avisos'
  return 'dashboard'
}

const PRODUTO_VAZIO = { nome: '', categoria: '', preco: '', estoque: '', estoqueBaixo: '', disponivel: true, composicao: '', foto: '', diasProducao: [] }
const PRODUTO_LOTE_VAZIO = { nome: '', categoria: 'Lanches', preco: '', estoque: '', estoqueBaixo: '', diasProducao: [], disponivel: true }

const FILTROS_PEDIDOS = [
  ['todos', 'Todos'],
  ['pendentes', 'Pendentes'],
  ['entregues', 'Entregues'],
  ['cancelados', 'Cancelados'],
]

const FILTROS_ESTOQUE = [
  ['todos', 'Todos'],
  ['critico', 'Critico'],
  ['baixo', 'Baixo'],
]

const STATUS_AJUSTE_PRODUCAO = [
  'Pronto para venda',
  'Parcialmente pronto',
  'Esgotado',
]

const FORM_AJUSTE_VAZIO = { quantidade: '', status: '', motivo: '', observacao: '' }

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

function ordenarPorNome(a, b) {
  return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR')
}

function pedidoCodigo(pedido) {
  return String(pedido?.numero || pedido?.id || 'pedido').slice(-6).toUpperCase()
}

function alunoNome(pedido) {
  return pedido?.alunoNome || pedido?.nomeAluno || pedido?.aluno || pedido?.nome || 'Aluno não informado'
}

function getFormaPagamento(pedido) {
  return pedido?.formaPagamento || pedido?.pagamento || pedido?.metodoPagamento || 'Não informado'
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
  if (normal === 'pronto') return { label: 'Pronto', bg: '#DCFCE7', color: '#166534' }
  if (normal === 'entregue') return { label: 'Entregue', bg: '#E2E8F0', color: '#475569' }
  if (normal === 'cancelado') return { label: 'Cancelado', bg: '#FEE2E2', color: '#B91C1C' }
  return { label: status || 'Não informado', bg: '#F1F5F9', color: '#475569' }
}

function filtrarPedidos(pedidos, filtro, pagamento, busca = '') {
  const termo = busca.trim().toLowerCase()
  return pedidos.filter(pedido => {
    const status = normalizeStatus(pedido.status)
    const statusOk = filtro === 'todos'
      || (filtro === 'pendentes' && !['entregue', 'cancelado'].includes(status))
      || (filtro === 'entregues' && status === 'entregue')
      || (filtro === 'cancelados' && status === 'cancelado')

    const pagamentoOk = pagamento === 'todos' || normalizeStatus(getFormaPagamento(pedido)) === normalizeStatus(pagamento)
    const buscaOk = !termo
      || pedidoCodigo(pedido).toLowerCase().includes(termo)
      || String(pedido.numero || '').toLowerCase().includes(termo)
      || String(pedido.id || '').toLowerCase().includes(termo)
      || String(pedido.matricula || pedido.alunoMatricula || '').toLowerCase().includes(termo)
      || alunoNome(pedido).toLowerCase().includes(termo)

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
    usuarioLogado, pedidos, produtos, producaoHoje,
    atualizarStatusPedido, cancelarPedido, marcarPedidoPago,
    atualizarProduto, adicionarProduto, adicionarProdutos,
    ajustarProducaoVendedor,
  } = useApp()
  const podeEditarPreco = ehGestao(usuarioLogado?.role || usuarioLogado?.perfil)
  const location = useLocation()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const aba = abaPorRota(location.pathname)
  const [filtroPedidos, setFiltroPedidos] = useState('todos')
  const [filtroPagamento, setFiltroPagamento] = useState('todos')
  const [buscaPedido, setBuscaPedido] = useState('')
  const [buscaProduto, setBuscaProduto] = useState('')
  const [filtroEstoque, setFiltroEstoque] = useState('todos')
  const [detalhePedido, setDetalhePedido] = useState(null)
  const [detalheProduto, setDetalheProduto] = useState(null)
  const [produtoForm, setProdutoForm] = useState(PRODUTO_VAZIO)
  const [loteProdutos, setLoteProdutos] = useState([{ ...PRODUTO_LOTE_VAZIO }])
  const [produtoEditando, setProdutoEditando] = useState(null)
  const [editorProdutoAberto, setEditorProdutoAberto] = useState(false)
  const [filtroCategoria, setFiltroCategoria] = useState('todas')
  const [filtroDisponivel, setFiltroDisponivel] = useState('todos')
  const [ajusteItem, setAjusteItem] = useState(null)
  const [formAjuste, setFormAjuste] = useState(FORM_AJUSTE_VAZIO)

  function selecionarAba(id) {
    navigate(ROTAS_ABA[id] || '/vendedor')
  }

  const hoje = inicioDoDia()
  const pedidosOrdenados = useMemo(() => [...pedidos].sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0)), [pedidos])
  const formasPagamento = useMemo(() => Array.from(new Set(pedidos.map(getFormaPagamento).filter(Boolean))), [pedidos])
  const pedidosPorBusca = useMemo(() => filtrarPedidos(pedidosOrdenados, 'todos', 'todos', buscaPedido), [pedidosOrdenados, buscaPedido])
  const pedidosVisiveis = useMemo(() => filtrarPedidos(pedidosOrdenados, filtroPedidos, filtroPagamento, buscaPedido), [pedidosOrdenados, filtroPedidos, filtroPagamento, buscaPedido])
  const vendasHoje = useMemo(() => pedidos.filter(p => {
    const data = p.pagoEm || p.retiradoEm || p.criadoEm || 0
    return normalizeStatus(p.status) !== 'cancelado' && data >= hoje && (p.pago || normalizeStatus(p.status) === 'entregue')
  }), [pedidos, hoje])
  const totalVendas = vendasHoje.reduce((acc, p) => acc + getTotalPedido(p), 0)
  const itensVendidos = useMemo(() => contarItens(vendasHoje), [vendasHoje])

  const produtosOrdenados = useMemo(() => [...produtos].sort(ordenarPorNome), [produtos])
  const produtosFiltrados = useMemo(() => produtosOrdenados.filter(produto => {
    const termo = buscaProduto.trim().toLowerCase()
    const nivel = estoqueNivel(Number(produto.estoque || 0), Number(produto.estoqueBaixo || 0))
    const buscaOk = !termo || String(produto.nome || '').toLowerCase().includes(termo) || String(produto.categoria || '').toLowerCase().includes(termo)
    const estoqueOk = filtroEstoque === 'todos'
      || (filtroEstoque === 'critico' && Number(produto.estoque || 0) === 0)
      || (filtroEstoque === 'baixo' && ['Baixo', 'Critico', 'Crítico'].includes(nivel.label))
    const categoriaOk = filtroCategoria === 'todas' || String(produto.categoria || '') === filtroCategoria
    const disponivelOk = filtroDisponivel === 'todos' || (filtroDisponivel === 'ativos' ? produto.disponivel !== false : produto.disponivel === false)
    return buscaOk && estoqueOk && categoriaOk && disponivelOk
  }), [produtosOrdenados, buscaProduto, filtroEstoque, filtroCategoria, filtroDisponivel])
  const categoriasProduto = useMemo(() => Array.from(new Set(produtos.map(p => p.categoria || 'Sem categoria'))).sort(), [produtos])

  const estoqueBaixo = useMemo(() => produtos.filter(p => Number(p.estoqueBaixo || 0) > 0 && Number(p.estoque || 0) <= Number(p.estoqueBaixo || 0)), [produtos])
  const producaoCozinha = useMemo(() => (producaoHoje || [])
    .filter(item => item.visivelParaVendedor !== false && !['cancelado'].includes(normalizeStatus(item.status)))
    .sort((a, b) => {
      const peso = { 'pronto para venda': 1, 'parcialmente pronto': 2, 'em producao': 3, planejado: 4, esgotado: 5 }
      return (peso[normalizeStatus(a.status)] || 9) - (peso[normalizeStatus(b.status)] || 9)
    }), [producaoHoje])
  const pendentes = pedidos.filter(p => !['entregue', 'cancelado'].includes(normalizeStatus(p.status))).length
  const entregues = pedidos.filter(p => normalizeStatus(p.status) === 'entregue').length
  const cancelados = pedidos.filter(p => normalizeStatus(p.status) === 'cancelado').length

  async function confirmarRetirada(pedido) {
    await atualizarStatusPedido(pedido.id, 'Entregue')
  }

  async function cancelar(pedido) {
    if (!confirm(`Cancelar pedido #${pedidoCodigo(pedido)}?`)) return
    await cancelarPedido(pedido.id, 'Cancelado pelo vendedor')
  }

  async function salvarEstoque(produto, estoque) {
    await atualizarProduto({ ...produto, estoque: Math.max(0, Number(estoque || 0)) })
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
    if (produto) {
      const esgotado = normalizeStatus(resultado.status) === 'esgotado' || resultado.quantidadeRestante <= 0
      await atualizarProduto({ ...produto, estoque: resultado.quantidadeRestante, disponivel: !esgotado })
    }
    setAjusteItem(null)
    setFormAjuste(FORM_AJUSTE_VAZIO)
  }

  function editarProduto(produto) {
    setProdutoEditando(produto.id)
    setProdutoForm({
      nome: produto.nome || '',
      categoria: produto.categoria || '',
      preco: String(produto.preco ?? ''),
      estoque: String(produto.estoque ?? ''),
      estoqueBaixo: String(produto.estoqueBaixo ?? ''),
      disponivel: produto.disponivel !== false,
      composicao: produto.composicao || produto.descricao || '',
      foto: produto.foto || '',
      diasProducao: produto.diasCardapio || produto.diasProducao || [],
    })
    setEditorProdutoAberto(true)
  }

  async function handleFotoProduto(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const dataUrl = await processarFotoPerfil(file, 900, 650000)
    setProdutoForm(p => ({ ...p, foto: dataUrl }))
    e.target.value = ''
  }

  async function salvarProduto(e) {
    e.preventDefault()
    if (!produtoForm.nome.trim()) return
    const payload = {
      nome: produtoForm.nome.trim(),
      categoria: produtoForm.categoria.trim() || 'Lanches',
      preco: Number(produtoForm.preco || 0),
      estoque: Math.max(0, Number(produtoForm.estoque || 0)),
      estoqueBaixo: Math.max(0, Number(produtoForm.estoqueBaixo || 0)),
      disponivel: !!produtoForm.disponivel,
      composicao: produtoForm.composicao.trim(),
      foto: produtoForm.foto || '',
      diasProducao: produtoForm.diasProducao || [],
      diasCardapio: produtoForm.diasProducao || [],
    }
    if (produtoEditando) {
      const original = produtos.find(p => p.id === produtoEditando)
      if (!podeEditarPreco) payload.preco = Number(original?.preco || 0)
      await atualizarProduto({ ...original, ...payload })
    } else {
      await adicionarProduto(payload)
    }
    setProdutoEditando(null)
    setProdutoForm(PRODUTO_VAZIO)
    setEditorProdutoAberto(false)
  }

  function atualizarLinhaLote(index, campo, valor) {
    setLoteProdutos(prev => prev.map((item, i) => i === index ? { ...item, [campo]: valor } : item))
  }

  function toggleDiaProdutoForm(dia) {
    setProdutoForm(prev => {
      const dias = prev.diasProducao || []
      return { ...prev, diasProducao: dias.includes(dia) ? dias.filter(d => d !== dia) : [...dias, dia] }
    })
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

  function PedidoCard({ pedido }) {
    const itens = Array.isArray(pedido.itens) ? pedido.itens : []
    const encerrado = ['entregue', 'cancelado'].includes(normalizeStatus(pedido.status))

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
          <span><CreditCard size={14} /> {getFormaPagamento(pedido)} - {pedido.pago ? 'Pago' : 'Pendente'}</span>
          <span><ShoppingBag size={14} /> {formatPrice(getTotalPedido(pedido))}</span>
          <span>{pedidoHora(pedido)} - Retirada {pedido.horarioRetirada || '--:--'}</span>
        </div>
        <div style={s.itens}>
          {itens.length === 0 ? <span style={s.meta}>Itens não informados.</span> : itens.map((item, i) => (
            <span key={`${pedido.id}-${i}`} style={s.item}>{item.quantidade || 1}x {item.nome || item.produtoNome || 'Produto'}</span>
          ))}
        </div>
        <div style={{ ...s.acoes, flexDirection: isMobile ? 'column' : 'row' }}>
          {!pedido.pago && !encerrado && (
            <button style={{ ...s.btnSecundario, width: isMobile ? '100%' : 'auto' }} onClick={() => marcarPedidoPago(pedido.id)}>
              <CreditCard size={15} /> Confirmar pagamento
            </button>
          )}
          {!encerrado && (
            <button style={{ ...s.btnPrimario, width: isMobile ? '100%' : 'auto' }} onClick={() => confirmarRetirada(pedido)}>
              <CheckCircle2 size={15} /> Marcar entregue
            </button>
          )}
          <button style={{ ...s.btnSecundario, width: isMobile ? '100%' : 'auto' }} onClick={() => setDetalhePedido(pedido)}>
            <Eye size={15} /> Ver detalhes
          </button>
          {!encerrado && (
            <button style={{ ...s.btnPerigo, width: isMobile ? '100%' : 'auto' }} onClick={() => cancelar(pedido)}>Cancelar</button>
          )}
        </div>
      </article>
    )
  }

  function ProdutoCard({ produto }) {
    const nivel = estoqueNivel(Number(produto.estoque || 0), Number(produto.estoqueBaixo || 0))
    return (
      <article style={s.produtoCard}>
        <div style={s.produtoTop}>
          {produto.foto ? <img src={produto.foto} alt={produto.nome} style={s.thumb} /> : <div style={s.produtoIcon}><Package size={24} /></div>}
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong style={s.codigo}>{produto.nome || 'Produto'}</strong>
            <p style={s.meta}>{produto.categoria || 'Sem categoria'} - {formatPrice(produto.preco || 0)}</p>
            <p style={s.diaResumo}>{resumoDiasProduto(produto)}</p>
          </div>
        </div>
        <span style={{ ...s.badge, background: nivel.bg, color: nivel.color }}>{produto.estoque || 0} un - {nivel.label}</span>
        <label style={s.label}>Atualizar estoque</label>
        <input type="number" min="0" defaultValue={produto.estoque || 0} onBlur={e => salvarEstoque(produto, e.target.value)} style={s.input} />
        <button type="button" style={s.btnSecundario} onClick={() => setDetalheProduto(produto)}><Eye size={15} /> Ver detalhes</button>
        <button type="button" style={s.btnPrimario} onClick={() => editarProduto(produto)}><Save size={15} /> Editar</button>
      </article>
    )
  }

  return (
    <Layout titulo="Painel do Vendedor">
      <div style={{ ...s.page, paddingBottom: isMobile ? 128 : 32 }}>
        {(aba === 'dashboard' || aba === 'pedidos') && (
          <div style={{ ...s.statsGrid, gridTemplateColumns: isMobile ? '1fr' : 'repeat(5, minmax(0, 1fr))' }}>
            <StatCard icon={ClipboardList} label="Pendentes" value={pendentes} color="#F59E0B" />
            <StatCard icon={PackageCheck} label="Entregues" value={entregues} color="#22C55E" />
            <StatCard icon={ShoppingBag} label="Vendas hoje" value={formatPrice(totalVendas)} color="#003D7C" />
            <StatCard icon={AlertTriangle} label="Estoque baixo" value={estoqueBaixo.length} color="#EF4444" />
            <StatCard icon={XCircle} label="Cancelados" value={cancelados} color="#A855F7" />
          </div>
        )}

        {aba === 'dashboard' && (
          <>
            <section style={s.sectionCard}>
              <div style={s.sectionHeader}>
                <h3 style={s.sectionTitle}>Producao da cozinha</h3>
                <span style={s.meta}>{producaoCozinha.length} item(ns) informado(s)</span>
              </div>
              <div style={s.producaoGrid}>
                {producaoCozinha.length === 0 ? <EmptyState>Nenhuma producao informada pela cozinha hoje.</EmptyState> : producaoCozinha.slice(0, 8).map(item => {
                  const visual = producaoVisual(item.status)
                  return (
                    <article key={item.id} style={s.producaoCard}>
                      <div style={s.produtoLinha}>
                        {item.produtoFoto && <img src={item.produtoFoto} alt={item.produtoNome} style={s.produtoFotoMini} />}
                        <div>
                          <strong>{item.produtoNome}</strong>
                          <p style={s.meta}>{item.produtoCategoria || 'Produto'}</p>
                        </div>
                      </div>
                      <span style={{ ...s.badge, background: visual.bg, color: visual.color }}>{visual.label}</span>
                      <div style={s.producaoInfo}>
                        <span>Disponível: <strong>{item.quantidadeRestante || 0} un</strong></span>
                        <span><Clock size={13} /> Previsão: <strong>{item.horarioPrevisto || '--:--'}</strong></span>
                        <span>Atualizado as <strong>{horaAtualizacao(item.atualizadoEm)}</strong></span>
                      </div>
                      {item.observacao && <p style={s.obs}>{item.observacao}</p>}
                      <button type="button" style={s.btnSecundario} onClick={() => abrirAjusteProducao(item)}><Edit3 size={15} /> Ajustar producao recebida</button>
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
                <div style={s.searchBox}>
                  <Search size={16} color="#64748B" />
                  <input value={buscaPedido} onChange={e => setBuscaPedido(e.target.value)} placeholder="Buscar por matricula ou numero do pedido" style={s.searchInput} />
                </div>
                {pedidosPorBusca.length === 0 ? <EmptyState>Nenhuma venda encontrada.</EmptyState> : pedidosPorBusca.slice(0, 4).map(pedido => <PedidoCard key={pedido.id} pedido={pedido} />)}
              </section>
              <section style={s.sectionCard}>
                <h3 style={s.sectionTitle}>Estoque em atencao</h3>
                {estoqueBaixo.length === 0 ? <EmptyState>Nenhum produto com estoque crítico.</EmptyState> : estoqueBaixo.slice(0, 6).map(produto => <ProdutoCard key={produto.id} produto={produto} />)}
              </section>
            </div>
          </>
        )}

        {aba === 'pedidos' && (
          <section style={s.sectionCard}>
            <div style={s.sectionHeader}>
              <h3 style={s.sectionTitle}>Pedidos e vendas</h3>
              <div style={s.filtros}>
                <div style={s.searchBox}>
                  <Search size={16} color="#64748B" />
                  <input value={buscaPedido} onChange={e => setBuscaPedido(e.target.value)} placeholder="Buscar por matricula ou numero do pedido" style={s.searchInput} />
                </div>
                {FILTROS_PEDIDOS.map(([id, label]) => (
                  <button key={id} style={{ ...s.filtroBtn, ...(filtroPedidos === id ? s.filtroBtnAtivo : {}) }} onClick={() => setFiltroPedidos(id)}>{label}</button>
                ))}
                <select value={filtroPagamento} onChange={e => setFiltroPagamento(e.target.value)} style={s.selectFiltro}>
                  <option value="todos">Todos pagamentos</option>
                  {formasPagamento.map(forma => <option key={forma} value={forma}>{forma}</option>)}
                </select>
              </div>
            </div>
            <div style={s.lista}>
              {pedidosVisiveis.length === 0 ? <EmptyState>Nenhum registro encontrado.</EmptyState> : pedidosVisiveis.map(pedido => <PedidoCard key={pedido.id} pedido={pedido} />)}
            </div>
          </section>
        )}

        {aba === 'produtos' && (
          <div style={{ ...s.contentGrid, gridTemplateColumns: isMobile ? '1fr' : 'minmax(300px, 390px) 1fr' }}>
            <form onSubmit={salvarProduto} style={s.sectionCard}>
              <h3 style={s.sectionTitle}>{produtoEditando ? 'Editar produto' : 'Novo produto'}</h3>
              <div style={s.fotoLinha}>
                <div style={s.fotoPreview}>
                  {produtoForm.foto ? <img src={produtoForm.foto} alt="Produto" style={s.fotoImg} /> : <ImagePlus size={28} color="#94A3B8" />}
                </div>
                <label style={s.btnSecundario}>
                  <ImagePlus size={15} /> Imagem
                  <input type="file" accept="image/*" onChange={handleFotoProduto} style={{ display: 'none' }} />
                </label>
              </div>
              <input value={produtoForm.nome} onChange={e => setProdutoForm({ ...produtoForm, nome: e.target.value })} placeholder="Nome do produto" style={s.input} />
              <input value={produtoForm.categoria} onChange={e => setProdutoForm({ ...produtoForm, categoria: e.target.value })} placeholder="Categoria" style={s.input} />
              <input
                type="number" step="0.01" value={produtoForm.preco}
                onChange={e => setProdutoForm({ ...produtoForm, preco: e.target.value })}
                placeholder="Preço" style={s.input}
                disabled={!!produtoEditando && !podeEditarPreco}
                title={!!produtoEditando && !podeEditarPreco ? 'Apenas administradores podem alterar o preço de um produto ja cadastrado.' : undefined}
              />
              {!!produtoEditando && !podeEditarPreco && <p style={s.meta}>Apenas administradores podem alterar o preço de um produto ja cadastrado.</p>}
              <div style={s.formGrid}>
                <input type="number" value={produtoForm.estoque} onChange={e => setProdutoForm({ ...produtoForm, estoque: e.target.value })} placeholder="Estoque" style={s.input} />
                <input type="number" value={produtoForm.estoqueBaixo} onChange={e => setProdutoForm({ ...produtoForm, estoqueBaixo: e.target.value })} placeholder="Estoque minimo" style={s.input} />
              </div>
              <textarea value={produtoForm.composicao} onChange={e => setProdutoForm({ ...produtoForm, composicao: e.target.value })} placeholder="Descrição / composição" rows={3} style={{ ...s.input, resize: 'vertical' }} />
              <div>
                <label style={s.label}>Dias no cardapio</label>
                <div style={s.diasLinha}>
                  {DIAS_CARDAPIO.map(dia => {
                    const ativo = (produtoForm.diasProducao || []).includes(dia)
                    return (
                      <button key={dia} type="button" onClick={() => toggleDiaProdutoForm(dia)} style={{ ...s.diaBtn, ...(ativo ? s.diaBtnAtivo : {}) }}>
                        {DIAS_LABEL[dia] || dia}
                      </button>
                    )
                  })}
                </div>
              </div>
              <label style={s.check}><input type="checkbox" checked={produtoForm.disponivel} onChange={e => setProdutoForm({ ...produtoForm, disponivel: e.target.checked })} /> Produto ativo no cardapio</label>
              <div style={s.acoes}>
                <button type="submit" style={s.btnPrimario}><Save size={15} /> Salvar</button>
                {produtoEditando && <button type="button" style={s.btnSecundario} onClick={() => { setProdutoEditando(null); setProdutoForm(PRODUTO_VAZIO) }}><XCircle size={15} /> Cancelar</button>}
              </div>

              {!produtoEditando && (
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
              )}
            </form>

            <section style={s.sectionCard}>
              <div style={s.sectionHeader}>
                <h3 style={s.sectionTitle}>Produtos cadastrados</h3>
                <button style={s.linkBtn} onClick={() => { setProdutoEditando(null); setProdutoForm(PRODUTO_VAZIO) }}><PlusCircle size={15} /> Limpar formulario</button>
              </div>
              <div style={s.searchBox}>
                <Search size={16} color="#64748B" />
                <input value={buscaProduto} onChange={e => setBuscaProduto(e.target.value)} placeholder="Pesquisar produto" style={s.searchInput} />
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

        {aba === 'estoque' && (
          <section style={s.sectionCard}>
            <div style={s.sectionHeader}>
              <h3 style={s.sectionTitle}>Produtos e estoque</h3>
              <div style={s.searchBox}>
                <Search size={16} color="#64748B" />
                <input value={buscaProduto} onChange={e => setBuscaProduto(e.target.value)} placeholder="Pesquisar produto" style={s.searchInput} />
              </div>
            </div>
            <div style={s.filtros}>
              {FILTROS_ESTOQUE.map(([id, label]) => (
                <button key={id} style={{ ...s.filtroBtn, ...(filtroEstoque === id ? s.filtroBtnAtivo : {}) }} onClick={() => setFiltroEstoque(id)}>{label}</button>
              ))}
            </div>
            <div style={s.produtosGrid}>
              {produtosFiltrados.length === 0 ? <EmptyState>Nenhum produto encontrado.</EmptyState> : produtosFiltrados.map(produto => <ProdutoCard key={produto.id} produto={produto} />)}
            </div>
          </section>
        )}

        {aba === 'vendas' && (
          <div style={{ ...s.contentGrid, gridTemplateColumns: isMobile ? '1fr' : 'minmax(260px, 360px) 1fr' }}>
            <section style={s.sectionCard}>
              <h3 style={s.sectionTitle}>Resumo do dia</h3>
              <div style={s.vendasBox}><span>Total vendido hoje</span><strong>{formatPrice(totalVendas)}</strong></div>
              <div style={s.vendasBox}><span>Pedidos pagos/retirados</span><strong>{vendasHoje.length}</strong></div>
            </section>
            <section style={s.sectionCard}>
              <h3 style={s.sectionTitle}>Itens vendidos</h3>
              {itensVendidos.length === 0 ? <EmptyState>Sem vendas hoje.</EmptyState> : itensVendidos.map(([nome, qtd]) => (
                <div key={nome} style={s.linhaResumo}><span>{nome}</span><strong>{qtd} un</strong></div>
              ))}
            </section>
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
                <h3 style={s.modalTitle}>Ajustar producao recebida</h3>
                <p style={s.meta}>{ajusteItem.produtoNome} - Disponivel atual: {ajusteItem.quantidadeRestante || 0} un</p>
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

      {detalhePedido && (
        <div style={s.modalOverlay} role="dialog" aria-modal="true">
          <div style={{ ...s.modal, padding: isMobile ? 18 : 24 }}>
            <div style={s.modalHeader}>
              <div>
                <h3 style={s.modalTitle}>Pedido #{pedidoCodigo(detalhePedido)}</h3>
                <p style={s.meta}>{alunoNome(detalhePedido)} {detalhePedido.matricula ? `- ${detalhePedido.matricula}` : ''}</p>
              </div>
              <button style={s.closeBtn} onClick={() => setDetalhePedido(null)}>Fechar</button>
            </div>
            <div style={s.detailGrid}>
              <p><strong>Status:</strong> <StatusBadge status={detalhePedido.status} /></p>
              <p><strong>Pagamento:</strong> {getFormaPagamento(detalhePedido)} - {detalhePedido.pago ? 'Pago' : 'Pendente'}</p>
              <p><strong>Data:</strong> {formatarDataHora(getPedidoDate(detalhePedido) || detalhePedido.criadoEm || detalhePedido.createdAt)}</p>
              <p><strong>Total:</strong> {formatPrice(getTotalPedido(detalhePedido))}</p>
            </div>
            <h4 style={s.detailTitle}>Itens</h4>
            <div style={s.lista}>
              {(detalhePedido.itens || []).map((item, index) => (
                <div key={`${item.nome || 'item'}-${index}`} style={s.linhaResumo}>
                  <span>{item.quantidade || 1}x {item.nome || item.produtoNome || 'Produto'}</span>
                  <strong>{formatPrice(item.preco || item.valor || 0)}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {editorProdutoAberto && (
        <div style={s.modalOverlay} role="dialog" aria-modal="true">
          <form onSubmit={salvarProduto} style={{ ...s.modal, padding: isMobile ? 18 : 24 }}>
            <div style={s.modalHeader}>
              <div>
                <h3 style={s.modalTitle}>Editar produto</h3>
                <p style={s.meta}>Atualize preco, estoque, imagem e disponibilidade.</p>
              </div>
              <button
                type="button"
                style={s.closeBtn}
                onClick={() => { setEditorProdutoAberto(false); setProdutoEditando(null); setProdutoForm(PRODUTO_VAZIO) }}
              >
                Fechar
              </button>
            </div>

            <div style={s.fotoLinha}>
              <div style={s.fotoPreview}>
                {produtoForm.foto ? <img src={produtoForm.foto} alt="Produto" style={s.fotoImg} /> : <ImagePlus size={28} color="#94A3B8" />}
              </div>
              <label style={s.btnSecundario}>
                <ImagePlus size={15} /> Imagem
                <input type="file" accept="image/*" onChange={handleFotoProduto} style={{ display: 'none' }} />
              </label>
            </div>

            <div style={{ ...s.formGrid, gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr' }}>
              <input value={produtoForm.nome} onChange={e => setProdutoForm({ ...produtoForm, nome: e.target.value })} placeholder="Nome do produto" style={s.input} />
              <input value={produtoForm.categoria} onChange={e => setProdutoForm({ ...produtoForm, categoria: e.target.value })} placeholder="Categoria" style={s.input} />
              <input
                type="number" step="0.01" value={produtoForm.preco}
                onChange={e => setProdutoForm({ ...produtoForm, preco: e.target.value })}
                placeholder="Preço" style={s.input}
                disabled={!!produtoEditando && !podeEditarPreco}
                title={!!produtoEditando && !podeEditarPreco ? 'Apenas administradores podem alterar o preço de um produto ja cadastrado.' : undefined}
              />
              <input type="number" value={produtoForm.estoque} onChange={e => setProdutoForm({ ...produtoForm, estoque: e.target.value })} placeholder="Estoque" style={s.input} />
              <input type="number" value={produtoForm.estoqueBaixo} onChange={e => setProdutoForm({ ...produtoForm, estoqueBaixo: e.target.value })} placeholder="Estoque minimo" style={s.input} />
            </div>
            {!!produtoEditando && !podeEditarPreco && <p style={s.meta}>Apenas administradores podem alterar o preço de um produto ja cadastrado.</p>}

            <textarea value={produtoForm.composicao} onChange={e => setProdutoForm({ ...produtoForm, composicao: e.target.value })} placeholder="Descrição / composição" rows={3} style={{ ...s.input, resize: 'vertical' }} />
            <div>
              <label style={s.label}>Dias no cardapio</label>
              <div style={s.diasLinha}>
                {DIAS_CARDAPIO.map(dia => {
                  const ativo = (produtoForm.diasProducao || []).includes(dia)
                  return (
                    <button key={dia} type="button" onClick={() => toggleDiaProdutoForm(dia)} style={{ ...s.diaBtn, ...(ativo ? s.diaBtnAtivo : {}) }}>
                      {DIAS_LABEL[dia] || dia}
                    </button>
                  )
                })}
              </div>
            </div>
            <label style={s.check}><input type="checkbox" checked={produtoForm.disponivel} onChange={e => setProdutoForm({ ...produtoForm, disponivel: e.target.checked })} /> Produto ativo no cardapio</label>
            <div style={s.acoes}>
              <button type="submit" style={s.btnPrimario}><Save size={15} /> Salvar alteracoes</button>
              <button type="button" style={s.btnSecundario} onClick={() => { setEditorProdutoAberto(false); setProdutoEditando(null); setProdutoForm(PRODUTO_VAZIO) }}><XCircle size={15} /> Cancelar</button>
            </div>
          </form>
        </div>
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
              <p><strong>Estoque minimo:</strong> {detalheProduto.estoqueBaixo || 0} un</p>
              <p><strong>Status:</strong> {detalheProduto.disponivel === false ? 'Indisponivel' : 'Disponível'}</p>
              <p><strong>Dias no cardapio:</strong> {resumoDiasProduto(detalheProduto)}</p>
            </div>
            <h4 style={s.detailTitle}>Descrição / composição</h4>
            <p style={s.obs}>{detalheProduto.descricao || detalheProduto.composicao || detalheProduto.ingredientes || 'Informação não cadastrada.'}</p>
            <h4 style={s.detailTitle}>Alergenos e nutricional</h4>
            <p style={s.obs}>{detalheProduto.alergenos || detalheProduto.nutricional || detalheProduto.infoNutricional || 'Informação não cadastrada.'}</p>
          </div>
        </div>
      )}
    </Layout>
  )
}

const s = {
  page: { display: 'flex', flexDirection: 'column', gap: 16 },
  abas: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  abasMobile: { overflowX: 'auto', flexWrap: 'nowrap', paddingBottom: 8, marginLeft: -4, marginRight: -4 },
  aba: { padding: '0.55rem 0.9rem', borderRadius: 20, border: '1.5px solid #CBD5E1', background: '#fff', color: '#64748B', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' },
  abaAtiva: { background: '#003D7C', borderColor: '#003D7C', color: '#fff' },
  statsGrid: { display: 'grid', gap: 12 },
  statCard: { background: '#fff', borderRadius: 14, padding: 16, boxShadow: '0 8px 24px rgba(15,23,42,0.06)', display: 'flex', flexDirection: 'column', gap: 6 },
  statIcon: { width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  statLabel: { color: '#64748B', fontSize: '0.8rem', fontWeight: 700 },
  statValue: { fontSize: '1.35rem', fontWeight: 900 },
  contentGrid: { display: 'grid', gap: 16, alignItems: 'start' },
  sectionCard: { background: '#fff', borderRadius: 18, padding: 20, boxShadow: '0 8px 24px rgba(15,23,42,0.06)', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 },
  sectionHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  sectionTitle: { margin: 0, fontWeight: 900, color: '#0F172A', fontSize: '1rem', display: 'inline-flex', alignItems: 'center', gap: 8 },
  lista: { display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 },
  pedidoCard: { border: '1px solid #E5E7EB', background: '#F8FAFC', borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 },
  pedidoTop: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  pedidoInfoGrid: { display: 'flex', gap: 14, flexWrap: 'wrap', color: '#64748B', fontSize: '0.82rem', fontWeight: 700 },
  codigo: { color: '#0F172A', fontWeight: 900 },
  meta: { color: '#64748B', fontSize: '0.84rem', margin: 0, lineHeight: 1.45 },
  badge: { borderRadius: 999, padding: '0.25rem 0.7rem', fontSize: '0.74rem', fontWeight: 900, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
  filtros: { display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' },
  filtroBtn: { border: '1px solid #E2E8F0', background: '#fff', color: '#64748B', borderRadius: 999, padding: '0.42rem 0.8rem', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' },
  filtroBtnAtivo: { background: '#003D7C', color: '#fff', borderColor: '#003D7C' },
  selectFiltro: { border: '1px solid #CBD5E1', background: '#fff', color: '#475569', borderRadius: 12, padding: '0.5rem 0.75rem', fontWeight: 700, fontFamily: 'inherit' },
  searchBox: { display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #CBD5E1', borderRadius: 12, padding: '0 0.75rem', minHeight: 44, background: '#fff', minWidth: 240 },
  searchInput: { border: 'none', outline: 'none', fontFamily: 'inherit', flex: 1, minWidth: 0, fontWeight: 700 },
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
  btnSecundario: { background: '#E8F0FB', color: '#003D7C', border: 'none', borderRadius: 12, padding: '0.68rem 0.95rem', fontWeight: 900, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, minHeight: 44, fontFamily: 'inherit' },
  btnPerigo: { background: '#FEE2E2', color: '#DC2626', border: 'none', borderRadius: 12, padding: '0.68rem 0.95rem', fontWeight: 900, cursor: 'pointer', minHeight: 44, fontFamily: 'inherit' },
  linkBtn: { border: 'none', background: '#EFF6FF', color: '#1D4ED8', borderRadius: 10, padding: '0.5rem 0.75rem', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' },
  producaoGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 12 },
  producaoCard: { background: '#F8FAFC', border: '1px solid #E5E7EB', borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 },
  produtoLinha: { display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 },
  produtoFotoMini: { width: 46, height: 46, borderRadius: 10, objectFit: 'cover', background: '#E2E8F0', flexShrink: 0 },
  producaoInfo: { display: 'flex', flexDirection: 'column', gap: 5, color: '#475569', fontSize: '0.82rem', fontWeight: 700 },
  produtosGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 },
  produtoCard: { display: 'flex', flexDirection: 'column', gap: 10, background: '#F8FAFC', border: '1px solid #E5E7EB', borderRadius: 14, padding: 14, minWidth: 0 },
  produtoTop: { display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 },
  thumb: { width: 58, height: 58, borderRadius: 12, objectFit: 'cover', flexShrink: 0 },
  produtoIcon: { width: 58, height: 58, borderRadius: 12, background: '#E8F0FB', color: '#003D7C', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  vendasBox: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC', border: '1px solid #E5E7EB', borderRadius: 14, padding: 14, color: '#64748B', fontWeight: 800 },
  linhaResumo: { display: 'flex', justifyContent: 'space-between', gap: 10, borderBottom: '1px solid #E2E8F0', padding: '0.55rem 0', color: '#334155' },
  vazio: { background: '#F8FAFC', borderRadius: 14, padding: '2rem', textAlign: 'center', color: '#94A3B8', border: '1px dashed #CBD5E1', fontWeight: 700 },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modal: { width: '100%', maxWidth: 820, maxHeight: '90vh', overflowY: 'auto', background: '#fff', borderRadius: 18, boxShadow: '0 24px 80px rgba(15,23,42,0.25)' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, marginBottom: 16 },
  modalTitle: { margin: 0, color: '#0F172A', fontSize: '1.2rem', fontWeight: 900 },
  closeBtn: { border: 'none', background: '#003D7C', color: '#fff', borderRadius: 10, minHeight: 40, padding: '0 0.9rem', fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit' },
  detailGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, color: '#475569', fontSize: '0.88rem' },
  detailTitle: { margin: '16px 0 8px', color: '#0F172A' },
  obs: { color: '#475569', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: 12, margin: 0, lineHeight: 1.45 },
  produtoFotoModal: { width: '100%', maxHeight: 260, objectFit: 'cover', borderRadius: 14, marginBottom: 14, background: '#E2E8F0' },
}
