import { useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import Layout from '../../components/Layout'
import { useApp } from '../../contexts/AppContext'
import { useIsMobile } from '../../utils/useIsMobile'

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const DIAS_CORES = ['#94A3B8', '#003D7C', '#003D7C', '#003D7C', '#003D7C', '#003D7C', '#94A3B8']

export default function Relatorios() {
  const { pedidos } = useApp()
  const isMobile = useIsMobile()
  const [gerandoPDF, setGerandoPDF] = useState(false)

  const totalVendas = pedidos.filter(p => p.pago).reduce((acc, p) => acc + p.total, 0)
  const ticketMedio = pedidos.filter(p => p.pago).length > 0 ? totalVendas / pedidos.filter(p => p.pago).length : 0

  const contagemHorarios = {}
  pedidos.forEach(p => {
    const hora = (p.horarioPedido?.split(':')[0] || '??') + 'h'
    contagemHorarios[hora] = (contagemHorarios[hora] || 0) + 1
  })
  const horarioMaiorMovimento = Object.entries(contagemHorarios).sort((a, b) => b[1] - a[1])[0]

  const contagemPagamento = pedidos.reduce((acc, p) => {
    acc[p.pagamento] = (acc[p.pagamento] || 0) + 1
    return acc
  }, {})

  const avaliados = pedidos.filter(p => p.avaliacao > 0)
  const avaliacaoMedia = avaliados.length ? avaliados.reduce((acc, p) => acc + p.avaliacao, 0) / avaliados.length : null

  const vendasPorDiaSemana = useMemo(() => {
    const soma = Array(7).fill(0)
    pedidos.forEach(p => {
      if (!p.criadoEm || !p.pago) return
      soma[new Date(p.criadoEm).getDay()] += p.total
    })
    return DIAS_SEMANA.map((dia, i) => ({ dia: dia.slice(0, 3), diaCompleto: dia, total: Math.round(soma[i] * 100) / 100 }))
  }, [pedidos])

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

    const doc = new jsPDF()
    doc.setFontSize(18)
    doc.setTextColor(0, 61, 124)
    doc.text('Senac Lanches — Relatório de Pedidos', 14, 18)
    doc.setFontSize(10)
    doc.setTextColor(100)
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 25)
    doc.text(`Total de pedidos: ${pedidos.length}   |   Total vendido: R$ ${totalVendas.toFixed(2).replace('.', ',')}   |   Ticket médio: R$ ${ticketMedio.toFixed(2).replace('.', ',')}`, 14, 31)

    autoTable(doc, {
      startY: 36,
      head: [['Pedido', 'Aluno', 'Itens', 'Total (R$)', 'Pagamento', 'Status', 'Horário']],
      body: pedidos.map(p => [
        p.id,
        p.aluno,
        p.itens.map(i => `${i.quantidade}x ${i.nome}`).join(', '),
        p.total.toFixed(2).replace('.', ','),
        p.pagamento,
        p.status,
        p.horarioPedido,
      ]),
      headStyles: { fillColor: [0, 61, 124] },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      styles: { fontSize: 9 },
    })
    doc.save(`relatorio-senac-${new Date().toISOString().slice(0, 10)}.pdf`)
    setGerandoPDF(false)
  }

  function exportarExcel() {
    const cabecalho = ['Pedido', 'Aluno', 'Itens', 'Total (R$)', 'Pagamento', 'Pago', 'Status', 'Horário Pedido', 'Horário Retirada']
    const linhas = pedidos.map(p => [
      p.id,
      p.aluno,
      p.itens.map(i => `${i.quantidade}x ${i.nome}`).join(' | '),
      p.total.toFixed(2).replace('.', ','),
      p.pagamento,
      p.pago ? 'Sim' : 'Não',
      p.status,
      p.horarioPedido,
      p.horarioRetirada,
    ])
    const csv = [cabecalho, ...linhas]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
      .join('\r\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `relatorio-senac-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <Layout titulo="Relatórios">
      <div style={s.exportBox}>
        <span style={s.exportLabel}>Exportar:</span>
        <button style={{ ...s.exportBtn, background: '#003D7C', color: '#fff', opacity: gerandoPDF ? 0.7 : 1 }} onClick={exportarPDF} disabled={gerandoPDF}>
          {gerandoPDF ? '⏳ Gerando PDF...' : '📄 Baixar PDF'}
        </button>
        <button style={{ ...s.exportBtn, background: '#059669', color: '#fff' }} onClick={exportarExcel}>📊 Baixar Excel (CSV)</button>
      </div>

      <div style={{ ...s.grid, gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr' }}>
        <div style={s.box}>
          <h3 style={s.boxTitulo}>📊 Resumo Geral</h3>
          {pedidos.length === 0
            ? <p style={{ color: '#94A3B8', fontSize: '0.85rem' }}>Nenhum pedido registrado ainda.</p>
            : (
              <div style={s.metricas}>
                {[
                  ['Total de pedidos', pedidos.length],
                  ['Total arrecadado', `R$ ${totalVendas.toFixed(2).replace('.', ',')}`],
                  ['Ticket médio', `R$ ${ticketMedio.toFixed(2).replace('.', ',')}`],
                  ['Horário de pico', horarioMaiorMovimento?.[0] || '--'],
                  ['Avaliação média', avaliacaoMedia !== null ? `⭐ ${avaliacaoMedia.toFixed(1)} (${avaliados.length} avaliações)` : 'Sem avaliações ainda'],
                ].map(([label, valor]) => (
                  <div key={label} style={s.metricaItem}>
                    <span style={s.metricaLabel}>{label}</span>
                    <strong style={s.metricaValor}>{valor}</strong>
                  </div>
                ))}
              </div>
            )
          }
        </div>

        <div style={s.box}>
          <h3 style={s.boxTitulo}>💳 Formas de Pagamento</h3>
          {Object.keys(contagemPagamento).length === 0
            ? <p style={{ color: '#94A3B8', fontSize: '0.85rem' }}>Sem dados ainda.</p>
            : Object.entries(contagemPagamento).map(([pag, qtd]) => (
              <div key={pag} style={s.pagItem}>
                <span style={{ minWidth: 90 }}>{pag === 'PIX' ? '💳' : '💵'} {pag}</span>
                <div style={s.barraContainer}>
                  <div style={{ ...s.barra, width: `${(qtd / pedidos.length) * 100}%`, background: pag === 'PIX' ? '#003D7C' : '#F47920' }} />
                </div>
                <span style={s.pagQtd}>{qtd} pedido(s)</span>
              </div>
            ))
          }
        </div>

        {pedidos.some(p => p.pago) && (
          <div style={{ ...s.box, gridColumn: isMobile ? '1' : '1 / -1' }}>
            <h3 style={s.boxTitulo}>📅 Vendas por Dia da Semana</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={vendasPorDiaSemana} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                <XAxis dataKey="dia" tick={{ fontSize: 12, fill: '#64748B' }} axisLine={{ stroke: '#E2E8F0' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(value) => [`R$ ${value.toFixed(2).replace('.', ',')}`, 'Vendido']}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.diaCompleto || ''}
                  contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: '0.8rem' }}
                />
                <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                  {vendasPorDiaSemana.map((d, i) => <Cell key={i} fill={DIAS_CORES[i]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p style={{ fontSize: '0.78rem', color: '#94A3B8', marginTop: 4 }}>Sábado e domingo destacados em cinza (cantina normalmente fechada).</p>
          </div>
        )}

        {pedidos.length > 0 && (
          <div style={{ ...s.box, gridColumn: isMobile ? '1' : '1 / -1' }}>
            <h3 style={s.boxTitulo}>📋 Todos os Pedidos</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={s.table}>
                <thead>
                  <tr style={s.theadRow}>
                    {['Pedido', 'Aluno', 'Itens', 'Total', 'Pagamento', 'Status'].map(col => (
                      <th key={col} style={s.th}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pedidos.map(p => (
                    <tr key={p.id} style={s.trow}>
                      <td style={s.td}>#{p.id}</td>
                      <td style={s.td}>{p.aluno}</td>
                      <td style={s.td}>{p.itens.map(i => `${i.quantidade}x ${i.nome}`).join(', ')}</td>
                      <td style={{ ...s.td, fontWeight: 700, color: '#003D7C' }}>R$ {p.total.toFixed(2).replace('.', ',')}</td>
                      <td style={s.td}>{p.pagamento}</td>
                      <td style={s.td}>{p.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

const s = {
  exportBox: { display: 'flex', gap: 10, alignItems: 'center', background: '#fff', padding: '1rem 1.25rem', borderRadius: 12, marginBottom: '1.25rem', flexWrap: 'wrap' },
  exportLabel: { color: '#64748B', fontSize: '0.9rem', fontWeight: 600 },
  exportBtn: { padding: '0.55rem 1.2rem', borderRadius: 8, fontWeight: 700, fontSize: '0.85rem', border: 'none', cursor: 'pointer' },
  grid: { display: 'grid', gap: '1rem' },
  box: { background: '#fff', borderRadius: 14, padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  boxTitulo: { fontWeight: 700, marginBottom: '1rem', fontSize: '0.95rem', color: '#1A202C' },
  metricas: { display: 'flex', flexDirection: 'column', gap: 10 },
  metricaItem: { display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0', borderBottom: '1px solid #F1F5F9' },
  metricaLabel: { color: '#64748B', fontSize: '0.88rem' },
  metricaValor: { color: '#1A202C', fontSize: '0.95rem' },
  pagItem: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 },
  barraContainer: { flex: 1, height: 8, background: '#F1F5F9', borderRadius: 4, overflow: 'hidden' },
  barra: { height: '100%', borderRadius: 4 },
  pagQtd: { fontSize: '0.82rem', color: '#64748B', minWidth: 80, textAlign: 'right' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' },
  theadRow: { background: '#F8FAFC' },
  th: { padding: '0.7rem 1rem', textAlign: 'left', fontWeight: 700, color: '#64748B', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' },
  trow: { borderBottom: '1px solid #F1F5F9' },
  td: { padding: '0.7rem 1rem', color: '#475569' },
}
