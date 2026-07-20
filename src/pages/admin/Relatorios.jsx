import { useMemo, useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import Layout from '../../components/Layout'
import { useApp } from '../../contexts/AppContext'
import { useIsMobile } from '../../utils/useIsMobile'
import { codigoPedido } from '../../utils/pedidos'

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado']
const DIAS_CORES = ['#94A3B8', '#003D7C', '#003D7C', '#003D7C', '#003D7C', '#003D7C', '#94A3B8']

function hojeInput() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function mesInput() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

// Converte o filtro selecionado em [inicioTs, fimTs] para buscar os pedidos do
// período sob demanda. 'todos' retorna [null, null] (sem limites).
function limitesPeriodo(filtroTipo, filtroDia, filtroMes) {
  if (filtroTipo === 'dia') {
    const [ano, mes, dia] = String(filtroDia || '').split('-').map(Number)
    if (!ano || !mes || !dia) return [null, null]
    return [
      new Date(ano, mes - 1, dia, 0, 0, 0, 0).getTime(),
      new Date(ano, mes - 1, dia, 23, 59, 59, 999).getTime(),
    ]
  }
  if (filtroTipo === 'mes') {
    const [ano, mes] = String(filtroMes || '').split('-').map(Number)
    if (!ano || !mes) return [null, null]
    return [
      new Date(ano, mes - 1, 1, 0, 0, 0, 0).getTime(),
      new Date(ano, mes, 0, 23, 59, 59, 999).getTime(),
    ]
  }
  return [null, null]
}

function normalizeStatus(status) {
  return String(status || '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function isPedidoCancelado(pedido) {
  return [
    'cancelado',
    'cancelada',
    'cancelado pelo aluno',
    'cancelado_pelo_aluno',
    'cancelado-aluno',
    'cancelado pelo admin',
    'cancelado_admin',
    'cancelled',
  ].includes(normalizeStatus(pedido?.status))
}

function origemPedido(pedido) {
  return pedido?.origem === 'balcao' ? 'balcao' : 'app'
}

function origemLabel(pedido) {
  return origemPedido(pedido) === 'balcao' ? 'Balcão' : 'App'
}

function getTotalPedido(pedido) {
  return Number(pedido?.total || pedido?.valorTotal || pedido?.totalPedido || pedido?.valor || 0)
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

function getAvaliacao(pedido) {
  return Number(pedido?.avaliacao || pedido?.nota || pedido?.rating || 0)
}

function getFormaPagamento(pedido) {
  return pedido?.formaPagamento || pedido?.pagamento || pedido?.metodoPagamento || pedido?.paymentMethod || 'Não informado'
}

function alunoNome(pedido) {
  return pedido?.alunoNome || pedido?.nomeAluno || pedido?.aluno || pedido?.nome || 'Não informado'
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('pt-BR')
}

function formatAvaliacao(value) {
  if (!value || Number(value) <= 0) return 'Sem avaliacoes'
  return Number(value).toFixed(1).replace('.', ',')
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

function calcularHorarioPico(pedidosValidos) {
  const horas = {}

  pedidosValidos.forEach((pedido) => {
    const date = getPedidoDate(pedido)
    if (date) {
      const hora = date.getHours()
      horas[hora] = (horas[hora] || 0) + 1
      return
    }

    const horaTexto = String(pedido?.horarioPedido || '').split(':')[0]
    const hora = Number(horaTexto)
    if (!Number.isNaN(hora)) horas[hora] = (horas[hora] || 0) + 1
  })

  const entradas = Object.entries(horas)
  if (entradas.length === 0) return 'Sem dados'

  const [horaPico] = entradas.sort((a, b) => b[1] - a[1])[0]
  return `${String(horaPico).padStart(2, '0')}:00`
}

function getItensTexto(pedido) {
  const itens = Array.isArray(pedido?.itens) ? pedido.itens : []
  if (itens.length === 0) return 'Não informado'
  return itens.map(i => `${i.quantidade || 1}x ${i.nome || i.produtoNome || 'Produto'}`).join(', ')
}

function pedidoNoPeriodo(pedido, filtroTipo, filtroDia, filtroMes) {
  if (filtroTipo === 'todos') return true

  const date = getPedidoDate(pedido)
  if (!date) return false

  if (filtroTipo === 'dia') {
    return dateKey(date) === filtroDia
  }

  if (filtroTipo === 'mes') {
    return monthKey(date) === filtroMes
  }

  return true
}

function formatDateLabel(value) {
  if (!value) return 'Não informado'
  const [ano, mes, dia] = value.split('-')
  return `${dia}/${mes}/${ano}`
}

function formatMonthLabel(value) {
  if (!value) return 'Não informado'
  const [ano, mes] = value.split('-')
  return `${mes}/${ano}`
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function excelCell(value, style = 'Cell', type = 'String', mergeAcross = 0) {
  const merge = mergeAcross ? ` ss:MergeAcross="${mergeAcross}"` : ''
  return `<Cell ss:StyleID="${style}"${merge}><Data ss:Type="${type}">${escapeHtml(value)}</Data></Cell>`
}

function excelEmptyRow(message, colSpan) {
  return { cells: [{ value: message, style: 'Muted', mergeAcross: Math.max(0, colSpan - 1) }] }
}

function excelRow(cells, height) {
  return {
    height,
    cells: cells.map(cell => typeof cell === 'object' && cell !== null ? cell : { value: cell }),
  }
}

function excelSheet(name, widths, rows, options = {}) {
  const columns = widths.map(width => `<Column ss:Width="${width}"/>`).join('')
  const body = rows.map(row => {
    const height = row.height ? ` ss:Height="${row.height}"` : ''
    return `<Row${height}>${row.cells.map(cell => excelCell(cell.value, cell.style, cell.type || 'String', cell.mergeAcross || 0)).join('')}</Row>`
  }).join('')
  const freeze = options.freeze
    ? '<WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><FreezePanes/><FrozenNoSplit/><SplitHorizontal>1</SplitHorizontal><TopRowBottomPane>1</TopRowBottomPane><ActivePane>2</ActivePane></WorksheetOptions>'
    : ''
  const autoFilter = options.autoFilter
    ? `<AutoFilter x:Range="R1C1:R${Math.max(2, rows.length)}C${widths.length}" xmlns="urn:schemas-microsoft-com:office:excel"/>`
    : ''

  return `<Worksheet ss:Name="${escapeHtml(name)}"><Table ss:DefaultRowHeight="22">${columns}${body}</Table>${freeze}${autoFilter}</Worksheet>`
}

function statusStyle(status) {
  const normalized = normalizeStatus(status)
  if (normalized === 'cancelado') return 'StatusCancelado'
  if (normalized === 'entregue' || normalized === 'pronto') return 'StatusOk'
  if (['recebido', 'pendente', 'em preparo', 'preparando'].includes(normalized)) return 'StatusPendente'
  return 'Cell'
}

function alunoContato(pedido) {
  return pedido?.matricula || pedido?.alunoMatricula || pedido?.email || pedido?.alunoEmail || 'Não informado'
}

function motivoCancelamento(pedido) {
  const motivo = pedido?.motivoCancelamento || pedido?.cancelamentoMotivo || pedido?.motivo || 'Não informado'
  const autor = pedido?.canceladoPorNome || pedido?.canceladoPor || pedido?.canceladoPorTipo
  return autor ? `${motivo} - ${autor}` : motivo
}

export default function Relatorios() {
  const { producaoHoje = [], buscarPedidosPorPeriodo } = useApp()
  const isMobile = useIsMobile()
  const [gerandoPDF, setGerandoPDF] = useState(false)
  const [filtroTipo, setFiltroTipo] = useState('dia')
  const [filtroDia, setFiltroDia] = useState(hojeInput())
  const [filtroMes, setFiltroMes] = useState(mesInput())
  const [filtroOrigem, setFiltroOrigem] = useState('todos')
  const [pedidoCanceladoSelecionado, setPedidoCanceladoSelecionado] = useState(null)
  const [pedidosDataset, setPedidosDataset] = useState([])
  const [carregandoPedidos, setCarregandoPedidos] = useState(false)

  // Busca os pedidos do período selecionado sob demanda (getDocs), em vez de
  // depender da coleção inteira sincronizada em tempo real. Recarrega apenas
  // quando o filtro de período muda.
  useEffect(() => {
    let cancelado = false
    const [inicioTs, fimTs] = limitesPeriodo(filtroTipo, filtroDia, filtroMes)
    const carregar = async () => {
      setCarregandoPedidos(true)
      try {
        const lista = await buscarPedidosPorPeriodo(inicioTs, fimTs)
        if (!cancelado) setPedidosDataset(lista)
      } catch (err) {
        console.error('[Relatorios] buscar pedidos do periodo:', err)
        if (!cancelado) setPedidosDataset([])
      } finally {
        if (!cancelado) setCarregandoPedidos(false)
      }
    }
    carregar()
    return () => { cancelado = true }
  }, [filtroTipo, filtroDia, filtroMes, buscarPedidosPorPeriodo])

  const periodoRelatorio = filtroTipo === 'dia'
    ? `Dia ${formatDateLabel(filtroDia)}`
    : filtroTipo === 'mes'
      ? `Mes ${formatMonthLabel(filtroMes)}`
      : 'Todos os pedidos'

  const sufixoArquivo = filtroTipo === 'dia'
    ? filtroDia
    : filtroTipo === 'mes'
      ? filtroMes
      : 'todos'

  const relatorio = useMemo(() => {
    const pedidosPeriodo = pedidosDataset
      .filter(pedido => pedidoNoPeriodo(pedido, filtroTipo, filtroDia, filtroMes))
      .filter(pedido => filtroOrigem === 'todos' || origemPedido(pedido) === filtroOrigem)
    const pedidosValidos = pedidosPeriodo.filter(pedido => !isPedidoCancelado(pedido))
    const pedidosCancelados = pedidosPeriodo.filter(isPedidoCancelado)
    const totalPedidos = pedidosValidos.length
    const totalArrecadado = pedidosValidos.reduce((total, pedido) => total + getTotalPedido(pedido), 0)
    const ticketMedio = totalPedidos > 0 ? totalArrecadado / totalPedidos : 0
    const horarioPico = calcularHorarioPico(pedidosValidos)
    const pedidosAvaliados = pedidosValidos.filter(pedido => getAvaliacao(pedido) > 0)
    const avaliacaoMedia = pedidosAvaliados.length > 0
      ? pedidosAvaliados.reduce((total, pedido) => total + getAvaliacao(pedido), 0) / pedidosAvaliados.length
      : 0

    const formasPagamento = pedidosValidos.reduce((acc, pedido) => {
      const forma = getFormaPagamento(pedido)
      if (!acc[forma]) acc[forma] = { quantidade: 0, total: 0 }
      acc[forma].quantidade += 1
      acc[forma].total += getTotalPedido(pedido)
      return acc
    }, {})

    const produtosMaisVendidos = {}
    pedidosValidos.forEach(pedido => {
      const itens = Array.isArray(pedido.itens) ? pedido.itens : []
      itens.forEach(item => {
        const nome = item.nome || item.produtoNome || 'Produto'
        const quantidade = Number(item.quantidade || 1)
        const total = quantidade * Number(item.preco || item.valor || 0)
        if (!produtosMaisVendidos[nome]) produtosMaisVendidos[nome] = { nome, quantidade: 0, total: 0 }
        produtosMaisVendidos[nome].quantidade += quantidade
        produtosMaisVendidos[nome].total += total
      })
    })

    const vendasPorDiaSemana = Array(7).fill(0)
    pedidosValidos.forEach(pedido => {
      const date = getPedidoDate(pedido)
      if (!date) return
      vendasPorDiaSemana[date.getDay()] += getTotalPedido(pedido)
    })

    return {
      pedidosValidos,
      pedidosCancelados,
      totalPedidos,
      totalArrecadado,
      ticketMedio,
      horarioPico,
      avaliacaoMedia,
      totalAvaliacoes: pedidosAvaliados.length,
      formasPagamento: Object.entries(formasPagamento).map(([nome, dados]) => ({ nome, ...dados })),
      produtosMaisVendidos: Object.values(produtosMaisVendidos)
        .sort((a, b) => b.quantidade - a.quantidade || b.total - a.total),
      vendasPorDiaSemana: DIAS_SEMANA.map((dia, i) => ({
        dia: dia.slice(0, 3),
        diaCompleto: dia,
        total: Math.round(vendasPorDiaSemana[i] * 100) / 100,
      })),
    }
  }, [pedidosDataset, filtroTipo, filtroDia, filtroMes, filtroOrigem])

  const producaoResumo = useMemo(() => {
    const lista = producaoHoje || []
    if (lista.length === 0) return null

    const totalProduzido = lista.reduce((acc, item) => acc + Number(item.quantidadePronta || 0), 0)
    const totalDisponivel = lista.reduce((acc, item) => acc + Number(item.quantidadeRestante || 0), 0)
    const totalVendido = lista.reduce((acc, item) => acc + Number(item.quantidadeVendida || 0), 0)
    const totalDescartado = lista.reduce((acc, item) => acc + Number(item.quantidadeDesperdicada || 0), 0)
    const produtosEsgotados = lista.filter(item => normalizeStatus(item.status) === 'esgotado' || Number(item.quantidadeRestante || 0) <= 0).length
    const diferenca = totalProduzido - totalDisponivel - totalVendido - totalDescartado

    const historicoDescarte = []
    const ajustesVendedor = []
    lista.forEach(item => {
      ;(item.historicoDesperdicio || []).forEach(h => historicoDescarte.push({ ...h, produtoNome: h.produtoNome || item.produtoNome }))
      ;(item.historico || []).forEach(h => {
        if (h.acao === 'Ajuste de producao recebida') ajustesVendedor.push({ ...h, produtoNome: h.produtoNome || item.produtoNome })
      })
    })
    historicoDescarte.sort((a, b) => (b.dataHora || 0) - (a.dataHora || 0))
    ajustesVendedor.sort((a, b) => (b.dataHora || b.data || 0) - (a.dataHora || a.data || 0))

    return { totalProduzido, totalDisponivel, totalVendido, totalDescartado, produtosEsgotados, diferenca, historicoDescarte, ajustesVendedor }
  }, [producaoHoje])

  const resumo = [
    ['Periodo', periodoRelatorio],
    ['Total de pedidos', formatNumber(relatorio.totalPedidos)],
    ['Total arrecadado', formatCurrency(relatorio.totalArrecadado)],
    ['Media por pedido', formatCurrency(relatorio.ticketMedio)],
    ['Horario de pico', relatorio.horarioPico],
    ['Avaliacao media', relatorio.totalAvaliacoes > 0 ? `${formatAvaliacao(relatorio.avaliacaoMedia)} (${relatorio.totalAvaliacoes})` : 'Sem avaliacoes'],
    ['Cancelados', formatNumber(relatorio.pedidosCancelados.length)],
  ]

  const maiorTotalPagamento = Math.max(...relatorio.formasPagamento.map(forma => forma.total), 0)

  async function exportarPDF() {
    if (gerandoPDF) return
    setGerandoPDF(true)

    let jsPDF, autoTable
    try {
      [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
    } catch {
      alert('Não foi possível carregar o gerador de PDF. Verifique sua conexão e tente novamente.')
      setGerandoPDF(false)
      return
    }

    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const marginX = 10
      const azul = [0, 61, 124]
      const laranja = [244, 121, 32]
      const cinzaTexto = [85, 94, 112]
      const cinzaClaro = [248, 250, 252]

      const origemTexto = filtroOrigem === 'todos'
        ? 'Todas as origens'
        : filtroOrigem === 'balcao'
          ? 'Balcão'
          : 'App'

      function desenharCabecalho() {
        doc.setFillColor(255, 255, 255)
        doc.rect(0, 0, pageWidth, 26, 'F')
        doc.setFillColor(...azul)
        doc.rect(0, 0, pageWidth, 4, 'F')
        doc.setFillColor(...laranja)
        doc.rect(0, 4, pageWidth, 1.2, 'F')

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(14)
        doc.setTextColor(...azul)
        doc.text('Senac Lanches - Relatório de Pedidos', marginX, 13)

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(...cinzaTexto)
        doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, marginX, 19)
        doc.text(`Período: ${periodoRelatorio} | Origem: ${origemTexto}`, marginX + 78, 19)
      }

      function desenharRodape() {
        const paginaAtual = doc.internal.getNumberOfPages()
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7)
        doc.setTextColor(130, 140, 155)
        doc.text(`Página ${paginaAtual}`, pageWidth - marginX, pageHeight - 6, { align: 'right' })
        doc.text('Senac Lanches', marginX, pageHeight - 6)
      }

      function proximaPosicaoY(espacoNecessario = 34) {
        const yAtual = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 8 : 30
        if (yAtual + espacoNecessario > pageHeight - 14) {
          doc.addPage()
          return 30
        }
        return yAtual
      }

      function tabela(titulo, head, body, options = {}) {
        const startY = options.startY ?? proximaPosicaoY(options.espaco || 34)

        if (titulo) {
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(10)
          doc.setTextColor(...(options.corTitulo || azul))
          doc.text(titulo, marginX, startY - 3)
        }

        autoTable(doc, {
          startY,
          head: [head],
          body: body.length ? body : [[{ content: options.emptyText || 'Nenhum registro encontrado.', colSpan: head.length, styles: { halign: 'center', textColor: [100, 116, 139], fontStyle: 'bold' } }]],
          margin: { left: marginX, right: marginX, top: 30, bottom: 14 },
          tableWidth: 'auto',
          theme: 'grid',
          pageBreak: 'auto',
          rowPageBreak: 'avoid',
          headStyles: {
            fillColor: options.headColor || azul,
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: options.headFontSize || 7.4,
            cellPadding: 1.6,
            overflow: 'linebreak',
          },
          bodyStyles: {
            fontSize: options.bodyFontSize || 7.1,
            cellPadding: 1.5,
            textColor: [71, 85, 105],
            overflow: 'linebreak',
            valign: 'top',
          },
          alternateRowStyles: { fillColor: cinzaClaro },
          styles: {
            font: 'helvetica',
            lineColor: [226, 232, 240],
            lineWidth: 0.1,
            minCellHeight: 5,
          },
          columnStyles: options.columnStyles || {},
          didDrawPage: () => {
            desenharCabecalho()
            desenharRodape()
          },
        })
      }

      desenharCabecalho()
      desenharRodape()

      tabela('Resumo geral', ['Resumo', 'Valor'], resumo, {
        startY: 32,
        headColor: azul,
        bodyFontSize: 8,
        headFontSize: 8,
        columnStyles: {
          0: { cellWidth: 68, fontStyle: 'bold' },
          1: { cellWidth: pageWidth - marginX * 2 - 68 },
        },
      })

      tabela('Pedidos válidos', ['Pedido', 'Aluno', 'Origem', 'Itens', 'Total', 'Pagamento', 'Status', 'Data/Hora'], relatorio.pedidosValidos.map(p => [
        codigoPedido(p),
        alunoNome(p),
        origemLabel(p),
        getItensTexto(p),
        formatCurrency(getTotalPedido(p)),
        getFormaPagamento(p),
        p.status || 'Não informado',
        formatDateTime(getPedidoDate(p) || p.criadoEm || p.createdAt || p.dataPedido || p.data),
      ]), {
        emptyText: 'Nenhum pedido válido encontrado no período.',
        columnStyles: {
          0: { cellWidth: 18, halign: 'center' },
          1: { cellWidth: 42 },
          2: { cellWidth: 24 },
          3: { cellWidth: 78 },
          4: { cellWidth: 24, halign: 'right' },
          5: { cellWidth: 30 },
          6: { cellWidth: 28 },
          7: { cellWidth: 33 },
        },
      })

      if (relatorio.pedidosCancelados.length > 0) {
        tabela('Pedidos cancelados', ['Pedido', 'Aluno', 'Origem', 'Itens', 'Total', 'Motivo', 'Pedido em', 'Cancelado em'], relatorio.pedidosCancelados.map(p => [
          codigoPedido(p),
          alunoNome(p),
          origemLabel(p),
          getItensTexto(p),
          formatCurrency(getTotalPedido(p)),
          motivoCancelamento(p),
          formatDateTime(getPedidoDate(p) || p.criadoEm || p.createdAt || p.dataPedido || p.data),
          formatDateTime(p.canceladoEm || p.dataCancelamento),
        ]), {
          headColor: [220, 38, 38],
          corTitulo: [185, 28, 28],
          columnStyles: {
            0: { cellWidth: 18, halign: 'center' },
            1: { cellWidth: 40 },
            2: { cellWidth: 22 },
            3: { cellWidth: 58 },
            4: { cellWidth: 22, halign: 'right' },
            5: { cellWidth: 60 },
            6: { cellWidth: 28 },
            7: { cellWidth: 29 },
          },
        })
      }

      tabela('Produtos mais vendidos', ['Produto', 'Quantidade', 'Total'], relatorio.produtosMaisVendidos.map(produto => [
        produto.nome,
        formatNumber(produto.quantidade),
        formatCurrency(produto.total),
      ]), {
        emptyText: 'Nenhum produto vendido no período.',
        headColor: laranja,
        corTitulo: laranja,
        columnStyles: {
          0: { cellWidth: 150 },
          1: { cellWidth: 55, halign: 'center' },
          2: { cellWidth: 72, halign: 'right' },
        },
      })

      tabela('Formas de pagamento', ['Forma de pagamento', 'Quantidade', 'Total'], relatorio.formasPagamento.map(forma => [
        forma.nome,
        formatNumber(forma.quantidade),
        formatCurrency(forma.total),
      ]), {
        emptyText: 'Nenhuma forma de pagamento encontrada.',
        headColor: [0, 148, 94],
        corTitulo: [0, 120, 78],
        columnStyles: {
          0: { cellWidth: 150 },
          1: { cellWidth: 55, halign: 'center' },
          2: { cellWidth: 72, halign: 'right' },
        },
      })

      if (producaoResumo) {
        tabela('Produção do dia', ['Indicador', 'Valor'], [
          ['Total produzido', formatNumber(producaoResumo.totalProduzido)],
          ['Disponível', formatNumber(producaoResumo.totalDisponivel)],
          ['Vendido', formatNumber(producaoResumo.totalVendido)],
          ['Descartado', formatNumber(producaoResumo.totalDescartado)],
          ['Produtos esgotados', formatNumber(producaoResumo.produtosEsgotados)],
          ['Diferença', formatNumber(producaoResumo.diferenca)],
        ], {
          headColor: [15, 118, 110],
          corTitulo: [15, 118, 110],
          columnStyles: {
            0: { cellWidth: 120, fontStyle: 'bold' },
            1: { cellWidth: 157 },
          },
        })
      }

      const totalPaginas = doc.internal.getNumberOfPages()
      for (let i = 1; i <= totalPaginas; i += 1) {
        doc.setPage(i)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7)
        doc.setTextColor(130, 140, 155)
        doc.text(`Página ${i} de ${totalPaginas}`, pageWidth - marginX, pageHeight - 6, { align: 'right' })
      }

      doc.save(`relatorio-senac-${sufixoArquivo}.pdf`)
    } catch (error) {
      console.error('Erro ao gerar PDF:', error)
      alert('Não foi possível gerar o PDF. Tente novamente.')
    } finally {
      setGerandoPDF(false)
    }
  }


  function exportarExcel() {
    const geradoEm = new Date().toLocaleString('pt-BR')
    const totalGeral = relatorio.totalPedidos + relatorio.pedidosCancelados.length
    const horarioPico = relatorio.totalPedidos > 0 ? relatorio.horarioPico : 'Sem dados suficientes para exibir o horario de pico'

    const pedidosValidosRows = relatorio.pedidosValidos.map(p => excelRow([
      codigoPedido(p),
      alunoNome(p),
      alunoContato(p),
      origemLabel(p),
      getItensTexto(p),
      formatCurrency(getTotalPedido(p)),
      getFormaPagamento(p),
      { value: p.status || 'Não informado', style: statusStyle(p.status) },
      formatDateTime(getPedidoDate(p) || p.criadoEm || p.createdAt || p.dataPedido || p.data),
    ]))

    const pedidosCanceladosRows = relatorio.pedidosCancelados.map(p => excelRow([
      codigoPedido(p),
      alunoNome(p),
      alunoContato(p),
      origemLabel(p),
      getItensTexto(p),
      formatCurrency(getTotalPedido(p)),
      motivoCancelamento(p),
      formatDateTime(getPedidoDate(p) || p.criadoEm || p.createdAt || p.dataPedido || p.data),
      formatDateTime(p.canceladoEm || p.dataCancelamento),
      { value: p.status || 'Cancelado', style: 'StatusCancelado' },
    ]))

    const produtosRows = relatorio.produtosMaisVendidos.map((produto, index) => excelRow([
      { value: index + 1, type: 'Number' },
      produto.nome,
      { value: produto.quantidade, type: 'Number' },
      formatCurrency(produto.total),
    ]))

    const pagamentosRows = relatorio.formasPagamento.map(forma => excelRow([
      forma.nome,
      { value: forma.quantidade, type: 'Number' },
      formatCurrency(forma.total),
    ]))

    const resumoRows = [
      excelRow([{ value: 'Senac', style: 'Logo', mergeAcross: 1 }, { value: 'SENAC LANCHES - RELATORIO DE PEDIDOS', style: 'Title', mergeAcross: 11 }], 38),
      excelRow([{ value: 'LANCHES', style: 'LogoSub', mergeAcross: 1 }, { value: `Periodo do relatorio: ${periodoRelatorio}`, style: 'SubTitle', mergeAcross: 4 }, { value: `Gerado em: ${geradoEm}`, style: 'SubTitle', mergeAcross: 5 }], 28),
      excelRow([{ value: '', style: 'OrangeLine', mergeAcross: 13 }], 7),
      excelRow([{ value: 'RESUMO GERAL', style: 'SectionPlain', mergeAcross: 13 }], 24),
      excelRow([
        { value: 'Pedidos validos', style: 'CardBlue', mergeAcross: 1 },
        { value: 'Pedidos cancelados', style: 'CardRed', mergeAcross: 1 },
        { value: 'Total geral registrado', style: 'CardOrange', mergeAcross: 1 },
        { value: 'Total arrecadado', style: 'CardGreen', mergeAcross: 1 },
        { value: 'Media por pedido', style: 'CardPurple', mergeAcross: 1 },
        { value: 'Horario de pico', style: 'CardTeal', mergeAcross: 1 },
        { value: 'Avaliacao media', style: 'CardPink', mergeAcross: 1 },
      ], 28),
      excelRow([
        { value: relatorio.totalPedidos, style: 'CardValueBlue', type: 'Number', mergeAcross: 1 },
        { value: relatorio.pedidosCancelados.length, style: 'CardValueRed', type: 'Number', mergeAcross: 1 },
        { value: totalGeral, style: 'CardValueOrange', type: 'Number', mergeAcross: 1 },
        { value: formatCurrency(relatorio.totalArrecadado), style: 'CardValueGreen', mergeAcross: 1 },
        { value: formatCurrency(relatorio.ticketMedio), style: 'CardValuePurple', mergeAcross: 1 },
        { value: relatorio.totalPedidos > 0 ? relatorio.horarioPico : 'Sem dados', style: 'CardValueTeal', mergeAcross: 1 },
        { value: relatorio.totalAvaliacoes > 0 ? formatAvaliacao(relatorio.avaliacaoMedia) : 'Sem avaliacoes', style: 'CardValuePink', mergeAcross: 1 },
      ], 36),
      excelRow([]),
      excelRow([{ value: 'PEDIDOS', style: 'BoxTitle', mergeAcross: 3 }, { value: 'DESEMPENHO FINANCEIRO (APENAS PEDIDOS VALIDOS)', style: 'BoxTitle', mergeAcross: 4 }, { value: 'RESUMO DE FORMAS DE PAGAMENTO (APENAS VALIDOS)', style: 'BoxTitle', mergeAcross: 4 }], 24),
      excelRow([{ value: 'Tipo', style: 'Header' }, { value: 'Quantidade', style: 'Header', mergeAcross: 2 }, { value: 'Total arrecadado', style: 'SubBox' }, { value: 'Media por pedido', style: 'SubBox' }, { value: 'Total de pedidos', style: 'SubBox', mergeAcross: 2 }, { value: 'Forma de pagamento', style: 'Header' }, { value: 'Qtd. pedidos', style: 'Header' }, { value: 'Total arrecadado', style: 'Header', mergeAcross: 2 }]),
      excelRow(['Pedidos validos', { value: relatorio.totalPedidos, type: 'Number', mergeAcross: 2 }, { value: formatCurrency(relatorio.totalArrecadado), style: 'CardValueGreen' }, { value: formatCurrency(relatorio.ticketMedio), style: 'CardValuePurple' }, { value: relatorio.totalPedidos, style: 'CardValueBlue', type: 'Number', mergeAcross: 2 }, ...(pagamentosRows[0]?.cells || [{ value: 'Nenhuma venda registrada no periodo.', style: 'Muted', mergeAcross: 4 }])]),
      excelRow(['Pedidos cancelados', { value: relatorio.pedidosCancelados.length, type: 'Number', style: 'StatusCancelado', mergeAcross: 2 }, { value: 'Pedidos cancelados não são considerados no cálculo dos valores acima.', style: 'InfoBox', mergeAcross: 4 }, ...(pagamentosRows[1]?.cells || [{ value: '', mergeAcross: 4 }])]),
      excelRow(['Total geral registrado', { value: totalGeral, type: 'Number', style: 'CardValueGray', mergeAcross: 2 }, { value: '', mergeAcross: 4 }, ...(pagamentosRows[2]?.cells || [{ value: '', mergeAcross: 4 }])]),
      excelRow([]),
      excelRow([{ value: 'PRODUTOS MAIS VENDIDOS (APENAS PEDIDOS VALIDOS)', style: 'BoxTitle', mergeAcross: 6 }, { value: 'HORARIO DE PICO (APENAS PEDIDOS VALIDOS)', style: 'BoxTitle', mergeAcross: 6 }], 24),
      excelRow([{ value: 'Ranking', style: 'Header' }, { value: 'Produto', style: 'Header', mergeAcross: 2 }, { value: 'Quantidade vendida', style: 'Header' }, { value: 'Total arrecadado', style: 'Header', mergeAcross: 2 }, { value: relatorio.totalPedidos > 0 ? horarioPico : 'Sem dados suficientes para exibir o horario de pico.', style: 'Muted', mergeAcross: 6 }]),
      ...(produtosRows.length
        ? produtosRows.slice(0, 6).map(row => excelRow([
          row.cells[0],
          { ...row.cells[1], mergeAcross: 2 },
          row.cells[2],
          { ...row.cells[3], mergeAcross: 2 },
          { value: relatorio.totalPedidos > 0 ? 'Calculado com pedidos validos do periodo.' : 'E necessario ter pedidos validos no periodo.', style: 'Muted', mergeAcross: 6 },
        ]))
        : [excelRow([{ value: 'Nenhum produto vendido no periodo.', style: 'Muted', mergeAcross: 6 }, { value: 'E necessario ter pedidos validos no periodo.', style: 'Muted', mergeAcross: 6 }], 42)]),
      excelRow([]),
      excelRow([{ value: 'ULTIMOS PEDIDOS VALIDOS', style: 'BoxTitle', mergeAcross: 13 }], 24),
      excelRow(['Pedido', 'Aluno', 'Matricula / E-mail', 'Origem', 'Itens', 'Valor total', 'Pagamento', 'Status', 'Data/Hora'].map((value, index) => ({ value, style: 'Header', mergeAcross: index === 4 ? 3 : 0 }))),
      ...(pedidosValidosRows.length ? pedidosValidosRows.slice(0, 8) : [excelEmptyRow('Nenhum pedido valido encontrado no periodo.', 14)]),
    ]

    const detalheValidos = [
      excelRow(['Pedido', 'Aluno', 'Matricula / E-mail', 'Origem', 'Itens', 'Valor Total', 'Pagamento', 'Status', 'Data/Hora'].map(value => ({ value, style: 'Header' }))),
      ...(pedidosValidosRows.length ? pedidosValidosRows : [excelEmptyRow('Nenhum pedido valido encontrado no periodo.', 9)]),
    ]
    const detalheCancelados = [
      excelRow(['Pedido', 'Aluno', 'Matricula / E-mail', 'Origem', 'Itens', 'Valor Total', 'Motivo do Cancelamento', 'Data/Hora do Pedido', 'Data/Hora do Cancelamento', 'Status'].map(value => ({ value, style: 'Header' }))),
      ...(pedidosCanceladosRows.length ? pedidosCanceladosRows : [excelEmptyRow('Nenhum pedido cancelado encontrado no periodo.', 10)]),
    ]
    const detalheProdutos = [
      excelRow(['Ranking', 'Produto', 'Quantidade Vendida', 'Total Arrecadado'].map(value => ({ value, style: 'Header' }))),
      ...(produtosRows.length ? produtosRows : [excelEmptyRow('Nenhum produto vendido no periodo.', 4)]),
    ]
    const detalhePagamentos = [
      excelRow(['Forma de Pagamento', 'Quantidade de Pedidos', 'Total Arrecadado'].map(value => ({ value, style: 'Header' }))),
      ...(pagamentosRows.length ? pagamentosRows : [excelEmptyRow('Nenhuma venda registrada no periodo.', 3)]),
    ]

    const workbook = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Cell"><Alignment ss:Vertical="Center" ss:WrapText="1"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/></Borders><Font ss:FontName="Arial" ss:Size="10" ss:Color="#334155"/></Style>
  <Style ss:ID="Muted" ss:Parent="Cell"><Font ss:Color="#94A3B8" ss:Bold="1"/><Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/></Style>
  <Style ss:ID="Logo"><Font ss:FontName="Arial" ss:Size="24" ss:Bold="1" ss:Color="#003D7C"/><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/></Style>
  <Style ss:ID="LogoSub"><Font ss:FontName="Arial" ss:Size="12" ss:Bold="1" ss:Color="#F47920"/><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/></Style>
  <Style ss:ID="Title"><Font ss:FontName="Arial" ss:Size="20" ss:Bold="1" ss:Color="#003D7C"/><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/></Style>
  <Style ss:ID="SubTitle"><Font ss:FontName="Arial" ss:Size="10" ss:Bold="1" ss:Color="#0B1E45"/><Alignment ss:Vertical="Center"/><Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/></Style>
  <Style ss:ID="OrangeLine"><Interior ss:Color="#F47920" ss:Pattern="Solid"/></Style>
  <Style ss:ID="Section"><Font ss:FontName="Arial" ss:Size="12" ss:Bold="1" ss:Color="#003D7C"/><Interior ss:Color="#EEF2FF" ss:Pattern="Solid"/><Alignment ss:Vertical="Center"/></Style>
  <Style ss:ID="SectionPlain"><Font ss:FontName="Arial" ss:Size="13" ss:Bold="1" ss:Color="#003D7C"/><Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/><Alignment ss:Vertical="Center"/></Style>
  <Style ss:ID="BoxTitle"><Font ss:FontName="Arial" ss:Size="11" ss:Bold="1" ss:Color="#003D7C"/><Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/><Alignment ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/></Borders></Style>
  <Style ss:ID="Header"><Font ss:FontName="Arial" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#003D7C" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/></Style>
  <Style ss:ID="SubBox" ss:Parent="Cell"><Font ss:Bold="1" ss:Color="#0F172A"/><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/></Style>
  <Style ss:ID="InfoBox" ss:Parent="Cell"><Font ss:Bold="1" ss:Color="#003D7C"/><Interior ss:Color="#EFF6FF" ss:Pattern="Solid"/></Style>
  <Style ss:ID="StatusOk" ss:Parent="Cell"><Font ss:Bold="1" ss:Color="#166534"/><Interior ss:Color="#DCFCE7" ss:Pattern="Solid"/></Style>
  <Style ss:ID="StatusPendente" ss:Parent="Cell"><Font ss:Bold="1" ss:Color="#92400E"/><Interior ss:Color="#FEF3C7" ss:Pattern="Solid"/></Style>
  <Style ss:ID="StatusCancelado" ss:Parent="Cell"><Font ss:Bold="1" ss:Color="#B91C1C"/><Interior ss:Color="#FEE2E2" ss:Pattern="Solid"/></Style>
  <Style ss:ID="CardBlue" ss:Parent="Cell"><Font ss:Bold="1" ss:Color="#003D7C"/><Interior ss:Color="#E8F0FB" ss:Pattern="Solid"/></Style>
  <Style ss:ID="CardValueBlue" ss:Parent="Cell"><Font ss:Bold="1" ss:Size="14" ss:Color="#003D7C"/><Interior ss:Color="#E8F0FB" ss:Pattern="Solid"/></Style>
  <Style ss:ID="CardRed" ss:Parent="Cell"><Font ss:Bold="1" ss:Color="#B91C1C"/><Interior ss:Color="#FEE2E2" ss:Pattern="Solid"/></Style>
  <Style ss:ID="CardValueRed" ss:Parent="Cell"><Font ss:Bold="1" ss:Size="14" ss:Color="#B91C1C"/><Interior ss:Color="#FEE2E2" ss:Pattern="Solid"/></Style>
  <Style ss:ID="CardGreen" ss:Parent="Cell"><Font ss:Bold="1" ss:Color="#166534"/><Interior ss:Color="#DCFCE7" ss:Pattern="Solid"/></Style>
  <Style ss:ID="CardValueGreen" ss:Parent="Cell"><Font ss:Bold="1" ss:Size="14" ss:Color="#166534"/><Interior ss:Color="#DCFCE7" ss:Pattern="Solid"/></Style>
  <Style ss:ID="CardPurple" ss:Parent="Cell"><Font ss:Bold="1" ss:Color="#7E22CE"/><Interior ss:Color="#F3E8FF" ss:Pattern="Solid"/></Style>
  <Style ss:ID="CardValuePurple" ss:Parent="Cell"><Font ss:Bold="1" ss:Size="14" ss:Color="#7E22CE"/><Interior ss:Color="#F3E8FF" ss:Pattern="Solid"/></Style>
  <Style ss:ID="CardOrange" ss:Parent="Cell"><Font ss:Bold="1" ss:Color="#C2410C"/><Interior ss:Color="#FFEDD5" ss:Pattern="Solid"/></Style>
  <Style ss:ID="CardValueOrange" ss:Parent="Cell"><Font ss:Bold="1" ss:Size="14" ss:Color="#C2410C"/><Interior ss:Color="#FFEDD5" ss:Pattern="Solid"/></Style>
  <Style ss:ID="CardTeal" ss:Parent="Cell"><Font ss:Bold="1" ss:Color="#0E7490"/><Interior ss:Color="#CFFAFE" ss:Pattern="Solid"/></Style>
  <Style ss:ID="CardValueTeal" ss:Parent="Cell"><Font ss:Bold="1" ss:Size="12" ss:Color="#0E7490"/><Interior ss:Color="#CFFAFE" ss:Pattern="Solid"/></Style>
  <Style ss:ID="CardPink" ss:Parent="Cell"><Font ss:Bold="1" ss:Color="#DB2777"/><Interior ss:Color="#FCE7F3" ss:Pattern="Solid"/></Style>
  <Style ss:ID="CardValuePink" ss:Parent="Cell"><Font ss:Bold="1" ss:Size="12" ss:Color="#DB2777"/><Interior ss:Color="#FCE7F3" ss:Pattern="Solid"/></Style>
  <Style ss:ID="CardGray" ss:Parent="Cell"><Font ss:Bold="1" ss:Color="#475569"/><Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/></Style>
  <Style ss:ID="CardValueGray" ss:Parent="Cell"><Font ss:Bold="1" ss:Size="14" ss:Color="#475569"/><Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/></Style>
 </Styles>
 ${excelSheet('Resumo', [84, 84, 110, 110, 112, 112, 112, 112, 112, 112, 112, 112, 112, 112], resumoRows)}
 ${excelSheet('Pedidos Validos', [95, 160, 150, 110, 260, 95, 120, 100, 140], detalheValidos, { freeze: true, autoFilter: true })}
 ${excelSheet('Pedidos Cancelados', [95, 160, 150, 110, 250, 95, 220, 140, 150, 100], detalheCancelados, { freeze: true, autoFilter: true })}
 ${excelSheet('Produtos Mais Vendidos', [90, 240, 135, 135], detalheProdutos, { freeze: true, autoFilter: true })}
 ${excelSheet('Formas de Pagamento', [190, 150, 150], detalhePagamentos, { freeze: true, autoFilter: true })}
</Workbook>`

    const blob = new Blob(['\uFEFF' + workbook], { type: 'application/vnd.ms-excel;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `relatorio-senac-${sufixoArquivo}.xls`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <Layout titulo="Relatórios">
      <div style={{ ...s.page, padding: isMobile ? 16 : 24, paddingBottom: isMobile ? 130 : 120 }}>
        <section style={{ ...s.section, padding: isMobile ? 18 : 24 }}>
          <div style={{ ...s.exportCard, alignItems: isMobile ? 'stretch' : 'center', flexDirection: isMobile ? 'column' : 'row' }}>
            <div>
              <h3 style={s.sectionTitle}>Exportar relatórios</h3>
              <p style={s.sectionSub}>PDF e Excel usam somente pedidos validos nos cálculos principais.</p>
            </div>
            <div style={{ ...s.filtroBox, width: isMobile ? '100%' : 'auto' }}>
              <div style={s.filtroTabs}>
                {[
                  ['dia', 'Dia'],
                  ['mes', 'Mes'],
                  ['todos', 'Todos'],
                ].map(([valor, label]) => (
                  <button
                    key={valor}
                    type="button"
                    style={{ ...s.filtroTab, ...(filtroTipo === valor ? s.filtroTabAtivo : {}) }}
                    onClick={() => setFiltroTipo(valor)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {filtroTipo === 'dia' && (
                <input type="date" value={filtroDia} onChange={e => setFiltroDia(e.target.value)} style={s.filtroInput} />
              )}
              {filtroTipo === 'mes' && (
                <input type="month" value={filtroMes} onChange={e => setFiltroMes(e.target.value)} style={s.filtroInput} />
              )}
              <select value={filtroOrigem} onChange={e => setFiltroOrigem(e.target.value)} style={s.filtroInput} aria-label="Filtrar por origem">
                <option value="todos">Todas as origens</option>
                <option value="app">App</option>
                <option value="balcao">Balcão</option>
              </select>
            </div>
            <div style={{ ...s.exportButtons, flexDirection: isMobile ? 'column' : 'row', width: isMobile ? '100%' : 'auto' }}>
              <button style={{ ...s.exportBtn, ...s.pdfBtn, width: isMobile ? '100%' : 'auto', opacity: (gerandoPDF || carregandoPedidos) ? 0.7 : 1 }} onClick={exportarPDF} disabled={gerandoPDF || carregandoPedidos}>
                {carregandoPedidos ? 'Carregando...' : gerandoPDF ? 'Gerando PDF...' : 'Baixar PDF'}
              </button>
              <button style={{ ...s.exportBtn, ...s.csvBtn, width: isMobile ? '100%' : 'auto', opacity: carregandoPedidos ? 0.7 : 1 }} onClick={exportarExcel} disabled={carregandoPedidos}>{carregandoPedidos ? 'Carregando...' : 'Baixar Excel'}</button>
            </div>
          </div>
        </section>

        <section style={{ ...s.section, padding: isMobile ? 18 : 24 }}>
          <h3 style={s.sectionTitle}>Resumo Geral</h3>
          <p style={s.sectionSub}>{periodoRelatorio}</p>
          <div style={{ ...s.resumoGrid, gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))' }}>
            {resumo.map(([label, valor]) => (
              <div key={label} style={s.resumoItem}>
                <span style={s.resumoLabel}>{label}</span>
                <strong style={{ ...s.resumoValue, fontSize: isMobile ? '1.25rem' : '1.45rem' }}>{valor}</strong>
              </div>
            ))}
          </div>
        </section>

        <section style={{ ...s.section, padding: isMobile ? 18 : 24 }}>
          <h3 style={s.sectionTitle}>Producao do Dia</h3>
          <p style={s.sectionSub}>Dados da producao registrada hoje pela cozinha (independente do filtro de periodo acima).</p>
          {!producaoResumo ? (
            <p style={s.empty}>Nenhuma producao registrada hoje.</p>
          ) : (
            <>
              <div style={{ ...s.resumoGrid, gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(5, minmax(0, 1fr))' }}>
                <div style={s.resumoItem}>
                  <span style={s.resumoLabel}>Total produzido</span>
                  <strong style={{ ...s.resumoValue, fontSize: '1.2rem' }}>{formatNumber(producaoResumo.totalProduzido)}</strong>
                </div>
                <div style={s.resumoItem}>
                  <span style={s.resumoLabel}>Disponivel</span>
                  <strong style={{ ...s.resumoValue, fontSize: '1.2rem' }}>{formatNumber(producaoResumo.totalDisponivel)}</strong>
                </div>
                <div style={s.resumoItem}>
                  <span style={s.resumoLabel}>Vendido</span>
                  <strong style={{ ...s.resumoValue, fontSize: '1.2rem' }}>{formatNumber(producaoResumo.totalVendido)}</strong>
                </div>
                <div style={s.resumoItem}>
                  <span style={s.resumoLabel}>Descartado</span>
                  <strong style={{ ...s.resumoValue, fontSize: '1.2rem', color: '#EF4444' }}>{formatNumber(producaoResumo.totalDescartado)}</strong>
                </div>
                <div style={s.resumoItem}>
                  <span style={s.resumoLabel}>Produtos esgotados</span>
                  <strong style={{ ...s.resumoValue, fontSize: '1.2rem' }}>{formatNumber(producaoResumo.produtosEsgotados)}</strong>
                </div>
              </div>
              {producaoResumo.diferenca !== 0 && (
                <p style={s.sectionSub}>Diferenca entre produzido e (disponivel + vendido + descartado): <strong>{formatNumber(producaoResumo.diferenca)}</strong> un.</p>
              )}
            </>
          )}
        </section>

        <div style={{ ...s.grid, gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr' }}>
          <section style={{ ...s.section, padding: isMobile ? 18 : 24 }}>
            <h3 style={s.sectionTitle}>Historico de Descarte (hoje)</h3>
            {!producaoResumo || producaoResumo.historicoDescarte.length === 0 ? (
              <p style={s.empty}>Nenhum descarte registrado hoje.</p>
            ) : (
              <div style={s.produtoList}>
                {producaoResumo.historicoDescarte.map(h => (
                  <div key={h.id} style={s.produtoItem}>
                    <span style={s.produtoNome}>{h.produtoNome || 'Produto'}</span>
                    <span style={s.produtoMeta}>{h.quantidade || 0} un · {h.motivo || 'Outro'}{h.observacao ? ` (${h.observacao})` : ''} · {formatDateTime(h.dataHora)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section style={{ ...s.section, padding: isMobile ? 18 : 24 }}>
            <h3 style={s.sectionTitle}>Ajustes do Vendedor (hoje)</h3>
            {!producaoResumo || producaoResumo.ajustesVendedor.length === 0 ? (
              <p style={s.empty}>Nenhum ajuste de producao recebida registrado hoje.</p>
            ) : (
              <div style={s.produtoList}>
                {producaoResumo.ajustesVendedor.map(h => (
                  <div key={h.id} style={s.produtoItem}>
                    <span style={s.produtoNome}>{h.produtoNome || 'Produto'}</span>
                    <span style={s.produtoMeta}>{h.quantidadeAnterior ?? '-'} → {h.quantidadeNova ?? '-'} un · {h.motivo || 'Sem motivo'} · por {h.alteradoPorNome || 'Vendedor'} · {formatDateTime(h.dataHora || h.data)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div style={{ ...s.grid, gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr' }}>
          <section style={{ ...s.section, padding: isMobile ? 18 : 24 }}>
            <h3 style={s.sectionTitle}>Formas de Pagamento</h3>
            {relatorio.formasPagamento.length === 0 ? (
              <p style={s.empty}>Nenhuma forma de pagamento encontrada.</p>
            ) : (
              <div style={s.pagamentoList}>
                {relatorio.formasPagamento.map(forma => {
                  const width = maiorTotalPagamento > 0 ? (forma.total / maiorTotalPagamento) * 100 : 0
                  return (
                    <div key={forma.nome} style={s.pagamentoItem}>
                      <div style={{ ...s.pagamentoHeader, alignItems: isMobile ? 'flex-start' : 'center', flexDirection: isMobile ? 'column' : 'row' }}>
                        <div>
                          <strong style={s.pagamentoNome}>{forma.nome}</strong>
                          <p style={s.pagamentoInfo}>{formatNumber(forma.quantidade)} pedido(s)</p>
                        </div>
                        <strong style={s.pagamentoTotal}>{formatCurrency(forma.total)}</strong>
                      </div>
                      <div style={s.progressBar}>
                        <div style={{ ...s.progressFill, width: `${width}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          <section style={{ ...s.section, padding: isMobile ? 18 : 24 }}>
            <h3 style={s.sectionTitle}>Produtos Mais Vendidos</h3>
            {relatorio.produtosMaisVendidos.length === 0 ? (
              <p style={s.empty}>Nenhum produto vendido em pedidos validos.</p>
            ) : (
              <div style={s.produtoList}>
                {relatorio.produtosMaisVendidos.map(produto => (
                  <div key={produto.nome} style={s.produtoItem}>
                    <span style={s.produtoNome}>{produto.nome}</span>
                    <span style={s.produtoMeta}>{formatNumber(produto.quantidade)} un. · {formatCurrency(produto.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {relatorio.pedidosValidos.length > 0 && (
          <section style={{ ...s.section, padding: isMobile ? 18 : 24 }}>
            <h3 style={s.sectionTitle}>Vendas por Dia da Semana</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={relatorio.vendasPorDiaSemana} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                <XAxis dataKey="dia" tick={{ fontSize: 12, fill: '#64748B' }} axisLine={{ stroke: '#E2E8F0' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(value) => [formatCurrency(value), 'Vendido']}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.diaCompleto || ''}
                  contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: '0.8rem' }}
                />
                <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                  {relatorio.vendasPorDiaSemana.map((d, i) => <Cell key={i} fill={DIAS_CORES[i]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </section>
        )}

        {relatorio.pedidosValidos.length > 0 && (
          <section style={{ ...s.section, padding: isMobile ? 18 : 24 }}>
            <h3 style={s.sectionTitle}>Pedidos Válidos</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={s.table}>
                <thead>
                  <tr style={s.theadRow}>
                    {['Pedido', 'Aluno', 'Origem', 'Itens', 'Total', 'Pagamento', 'Status'].map(col => (
                      <th key={col} style={s.th}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {relatorio.pedidosValidos.map(p => (
                    <tr key={p.id || p.numero} style={s.trow}>
                      <td style={s.td}>#{codigoPedido(p)}</td>
                      <td style={s.td}>{p.alunoNome || p.nomeAluno || p.aluno || p.nome || 'Não informado'}</td>
                      <td style={s.td}>{origemLabel(p)}</td>
                      <td style={s.td}>{getItensTexto(p)}</td>
                      <td style={{ ...s.td, fontWeight: 700, color: '#003D7C' }}>{formatCurrency(getTotalPedido(p))}</td>
                      <td style={s.td}>{getFormaPagamento(p)}</td>
                      <td style={s.td}>{p.status || 'Não informado'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {relatorio.pedidosCancelados.length > 0 && (
          <section style={{ ...s.section, padding: isMobile ? 18 : 24 }}>
            <h3 style={s.sectionTitle}>Pedidos Cancelados</h3>
            <p style={s.sectionSub}>Pedidos cancelados não contam como vendas, faturamento ou média por pedido. Clique em um pedido para ver detalhes.</p>
            <div style={{ overflowX: 'auto' }}>
              <table style={s.table}>
                <thead>
                  <tr style={s.theadRow}>
                    {['Pedido', 'Aluno', 'Origem', 'Itens', 'Total', 'Cancelado em', 'Status'].map(col => (
                      <th key={col} style={s.th}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {relatorio.pedidosCancelados.map(p => (
                    <tr key={p.id || p.numero} style={{ ...s.trow, cursor: 'pointer' }} onClick={() => setPedidoCanceladoSelecionado(p)}>
                      <td style={s.td}>#{codigoPedido(p)}</td>
                      <td style={s.td}>{alunoNome(p)}</td>
                      <td style={s.td}>{origemLabel(p)}</td>
                      <td style={s.td}>{getItensTexto(p)}</td>
                      <td style={{ ...s.td, fontWeight: 700, color: '#EF4444' }}>{formatCurrency(getTotalPedido(p))}</td>
                      <td style={s.td}>{formatDateTime(p.canceladoEm || p.dataCancelamento)}</td>
                      <td style={s.td}>{p.status || 'Cancelado'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      {pedidoCanceladoSelecionado && (
        <div style={s.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="pedido-cancelado-title">
          <div style={{ ...s.modal, padding: isMobile ? 18 : 24 }}>
            <div style={s.modalHeader}>
              <h3 id="pedido-cancelado-title" style={s.sectionTitle}>Pedido Cancelado #{codigoPedido(pedidoCanceladoSelecionado)}</h3>
              <button type="button" style={s.closeBtn} onClick={() => setPedidoCanceladoSelecionado(null)}>Fechar</button>
            </div>
            <div style={s.modalBody}>
              <p style={s.td}><strong>Aluno:</strong> {alunoNome(pedidoCanceladoSelecionado)}</p>
              <p style={s.td}><strong>Matricula / E-mail:</strong> {alunoContato(pedidoCanceladoSelecionado)}</p>
              <p style={s.td}><strong>Origem:</strong> {origemLabel(pedidoCanceladoSelecionado)}</p>
              <p style={s.td}><strong>Itens:</strong> {getItensTexto(pedidoCanceladoSelecionado)}</p>
              <p style={s.td}><strong>Valor:</strong> {formatCurrency(getTotalPedido(pedidoCanceladoSelecionado))}</p>
              <p style={s.td}><strong>Horario do pedido:</strong> {formatDateTime(getPedidoDate(pedidoCanceladoSelecionado) || pedidoCanceladoSelecionado.criadoEm || pedidoCanceladoSelecionado.createdAt || pedidoCanceladoSelecionado.dataPedido || pedidoCanceladoSelecionado.data)}</p>
              <p style={s.td}><strong>Horario do cancelamento:</strong> {formatDateTime(pedidoCanceladoSelecionado.canceladoEm || pedidoCanceladoSelecionado.dataCancelamento)}</p>
              <p style={s.td}><strong>Motivo:</strong> {motivoCancelamento(pedidoCanceladoSelecionado)}</p>
              <p style={s.td}><strong>Status anterior:</strong> {pedidoCanceladoSelecionado.statusAnterior || pedidoCanceladoSelecionado.statusAntesCancelamento || 'Não informado'}</p>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

const s = {
  page: { display: 'flex', flexDirection: 'column', gap: 24 },
  section: { background: '#fff', borderRadius: 18, boxShadow: '0 8px 24px rgba(15,23,42,0.06)' },
  sectionTitle: { margin: 0, fontWeight: 800, fontSize: '1rem', color: '#0F172A' },
  sectionSub: { margin: '6px 0 0', color: '#64748B', fontSize: '0.84rem' },
  exportCard: { display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' },
  filtroBox: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  filtroTabs: { display: 'flex', gap: 6, background: '#F1F5F9', borderRadius: 12, padding: 4 },
  filtroTab: { border: 'none', background: 'transparent', color: '#64748B', borderRadius: 9, padding: '0.55rem 0.85rem', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' },
  filtroTabAtivo: { background: '#003D7C', color: '#fff' },
  filtroInput: { border: '1px solid #CBD5E1', borderRadius: 12, minHeight: 42, padding: '0 0.8rem', color: '#0F172A', fontWeight: 700, fontFamily: 'inherit', background: '#fff' },
  exportButtons: { display: 'flex', gap: 12 },
  exportBtn: { border: 'none', borderRadius: 12, padding: '0.8rem 1.25rem', fontWeight: 800, cursor: 'pointer', minHeight: 48, whiteSpace: 'nowrap', fontFamily: 'inherit' },
  pdfBtn: { background: '#003D7C', color: '#fff' },
  csvBtn: { background: '#00945E', color: '#fff' },
  resumoGrid: { display: 'grid', gap: 16, marginTop: 16 },
  resumoItem: { background: '#F8FAFC', border: '1px solid #E5E7EB', borderRadius: 14, padding: 16, minWidth: 0 },
  resumoLabel: { display: 'block', fontSize: '0.84rem', color: '#64748B', marginBottom: 8 },
  resumoValue: { display: 'block', fontWeight: 900, color: '#0F172A', overflowWrap: 'anywhere' },
  grid: { display: 'grid', gap: 24 },
  empty: { color: '#94A3B8', fontSize: '0.88rem', margin: '1rem 0 0' },
  pagamentoList: { display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 },
  pagamentoItem: { background: '#F8FAFC', borderRadius: 14, padding: 16, border: '1px solid #E5E7EB' },
  pagamentoHeader: { display: 'flex', justifyContent: 'space-between', gap: 12 },
  pagamentoNome: { fontWeight: 900, color: '#0F172A' },
  pagamentoInfo: { margin: '4px 0 0', color: '#64748B', fontSize: '0.84rem' },
  pagamentoTotal: { color: '#003D7C', whiteSpace: 'nowrap' },
  progressBar: { width: '100%', height: 10, background: '#E5E7EB', borderRadius: 999, overflow: 'hidden', marginTop: 12 },
  progressFill: { height: '100%', background: '#003D7C', borderRadius: 999 },
  produtoList: { display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 },
  produtoItem: { display: 'flex', justifyContent: 'space-between', gap: 12, background: '#F8FAFC', border: '1px solid #E5E7EB', borderRadius: 12, padding: '0.75rem 0.85rem' },
  produtoNome: { color: '#0F172A', fontWeight: 800 },
  produtoMeta: { color: '#64748B', fontSize: '0.84rem', textAlign: 'right' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' },
  theadRow: { background: '#F8FAFC' },
  th: { padding: '0.7rem 1rem', textAlign: 'left', fontWeight: 800, color: '#64748B', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' },
  trow: { borderBottom: '1px solid #F1F5F9' },
  td: { padding: '0.7rem 1rem', color: '#475569', verticalAlign: 'top' },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modal: { width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', background: '#fff', borderRadius: 18, boxShadow: '0 24px 80px rgba(15,23,42,0.25)' },
  modalHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 12 },
  modalBody: { display: 'flex', flexDirection: 'column', gap: 4 },
  closeBtn: { border: 'none', borderRadius: 10, background: '#003D7C', color: '#fff', minHeight: 42, padding: '0 1rem', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' },
}
