import { useEffect, useMemo, useState } from 'react'
import { collection, deleteDoc, doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import { notificarPush } from '../../utils/notificarPush'

function inicioDoDia() {
  const data = new Date()
  data.setHours(0, 0, 0, 0)
  return data.getTime()
}

function fimDoDia() {
  const data = new Date()
  data.setHours(23, 59, 59, 999)
  return data.getTime()
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10)
}

function usuarioResumo(usuarioLogado) {
  return {
    id: usuarioLogado?.uid || usuarioLogado?.matricula || '',
    nome: usuarioLogado?.nome || 'Usuario',
    perfil: usuarioLogado?.role || usuarioLogado?.perfil || '',
  }
}

function historicoItem(acao, usuarioLogado, extra = {}) {
  return {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    acao,
    usuario: usuarioResumo(usuarioLogado),
    data: Date.now(),
    ...extra,
  }
}

function normalizarProducao(item) {
  const quantidadePronta = Number(item.quantidadePronta || 0)
  const quantidadeVendida = Number(item.quantidadeVendida || 0)
  const quantidadeDesperdicada = Number(item.quantidadeDesperdicada || 0)
  return {
    ...item,
    quantidadePlanejada: Number(item.quantidadePlanejada || 0),
    quantidadeEmProducao: Number(item.quantidadeEmProducao || 0),
    quantidadePronta,
    quantidadeVendida,
    quantidadeDesperdicada,
    historicoDesperdicio: Array.isArray(item.historicoDesperdicio) ? item.historicoDesperdicio : [],
    quantidadeRestante: Math.max(0, Number(item.quantidadeRestante ?? (quantidadePronta - quantidadeVendida - quantidadeDesperdicada))),
  }
}

export const MOTIVOS_DESPERDICIO = ['Queimou', 'Venceu', 'Caiu no chao', 'Sobrou', 'Erro de producao', 'Danificado', 'Outro']

export function useProducaoDiaria(usuarioLogado) {
  const [producaoDiaria, setProducaoDiaria] = useState([])

  useEffect(() => {
    if (!usuarioLogado) return
    const unsub = onSnapshot(collection(db, 'producaoDiaria'), (snap) => {
      setProducaoDiaria(snap.docs.map(d => normalizarProducao({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.atualizadoEm || b.criadoEm || 0) - (a.atualizadoEm || a.criadoEm || 0)))
    }, err => console.error('[Firestore] producaoDiaria:', err))
    return unsub
  }, [usuarioLogado])

  const producaoHoje = useMemo(() => {
    const ini = inicioDoDia()
    const fim = fimDoDia()
    return producaoDiaria.filter(item => {
      const data = Number(item.dataProducaoTs || item.criadoEm || 0)
      return data >= ini && data <= fim
    })
  }, [producaoDiaria])

  async function salvarProducao(dados) {
    const id = dados.id || `PD${Date.now()}`
    const agora = Date.now()
    const quantidadePronta = Number(dados.quantidadePronta || 0)
    const quantidadeVendida = Number(dados.quantidadeVendida || 0)
    const payload = normalizarProducao({
      id,
      produtoId: dados.produtoId || '',
      produtoNome: dados.produtoNome || 'Produto',
      produtoCategoria: dados.produtoCategoria || '',
      produtoFoto: dados.produtoFoto || '',
      quantidadePlanejada: Number(dados.quantidadePlanejada || 0),
      quantidadeEmProducao: Number(dados.quantidadeEmProducao || 0),
      quantidadePronta,
      quantidadeVendida,
      quantidadeRestante: Math.max(0, quantidadePronta - quantidadeVendida),
      horarioPrevisto: dados.horarioPrevisto || '',
      status: dados.status || 'Planejado',
      observacao: dados.observacao || '',
      dataProducao: dados.dataProducao || hojeISO(),
      dataProducaoTs: dados.dataProducaoTs || inicioDoDia(),
      visivelParaVendedor: dados.visivelParaVendedor !== false,
      visivelParaAdmin: dados.visivelParaAdmin !== false,
      criadoPor: dados.criadoPor || usuarioResumo(usuarioLogado),
      criadoEm: dados.criadoEm || agora,
      atualizadoPor: usuarioResumo(usuarioLogado),
      atualizadoEm: agora,
      historico: [...(dados.historico || []), historicoItem(dados.id ? 'Atualizou planejamento' : 'Criou planejamento', usuarioLogado, { status: dados.status || 'Planejado' })],
    })
    await setDoc(doc(db, 'producaoDiaria', id), payload, { merge: true })
    return payload
  }

  async function atualizarProducao(id, atual, dados, opcoes = {}) {
    const agora = Date.now()
    const proxima = normalizarProducao({ ...atual, ...dados })
    await updateDoc(doc(db, 'producaoDiaria', id), {
      ...dados,
      quantidadeRestante: proxima.quantidadeRestante,
      atualizadoPor: usuarioResumo(usuarioLogado),
      atualizadoEm: agora,
      historico: [...(atual.historico || []), historicoItem(opcoes.acao || 'Atualizou producao', usuarioLogado, { status: proxima.status })],
    })

    const statusNovo = dados.status
    if (statusNovo && statusNovo !== atual.status) {
      if (statusNovo === 'Esgotado') {
        notificarPush({
          destino: 'vendedor',
          titulo: 'Produto esgotado',
          mensagem: `${atual.produtoNome || 'Produto'} esta esgotado.`,
          url: '/vendedor',
        })
      } else if (statusNovo === 'Pronto para venda' || statusNovo === 'Parcialmente pronto') {
        notificarPush({
          destino: 'vendedor',
          titulo: 'Producao pronta',
          mensagem: `${atual.produtoNome || 'Produto'} esta disponivel para venda.`,
          url: '/vendedor',
        })
      }
    }

    return proxima
  }

  async function removerProducao(id, atual) {
    if (atual) {
      await atualizarProducao(id, atual, { status: 'Cancelado' }, { acao: 'Cancelou producao' })
    }
    await deleteDoc(doc(db, 'producaoDiaria', id))
  }

  async function registrarDesperdicio(id, atual, { quantidade, motivo, observacao }) {
    const agora = Date.now()
    const qtd = Math.max(0, Number(quantidade || 0))
    const quantidadeDesperdicada = Number(atual.quantidadeDesperdicada || 0) + qtd
    const quantidadeRestante = Math.max(0, Number(atual.quantidadeRestante || 0) - qtd)
    const usuario = usuarioResumo(usuarioLogado)
    const entradaDesperdicio = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      produtoId: atual.produtoId || '',
      produtoNome: atual.produtoNome || '',
      quantidade: qtd,
      motivo: motivo || 'Outro',
      observacao: observacao || '',
      responsavel: usuario,
      dataHora: agora,
    }
    await updateDoc(doc(db, 'producaoDiaria', id), {
      quantidadeDesperdicada,
      quantidadeRestante,
      historicoDesperdicio: [...(atual.historicoDesperdicio || []), entradaDesperdicio],
      atualizadoPor: usuario,
      atualizadoEm: agora,
      historico: [...(atual.historico || []), historicoItem('Registrou desperdicio', usuarioLogado, {
        quantidade: qtd,
        motivo: motivo || 'Outro',
        observacao: observacao || '',
      })],
    })
    notificarPush({
      destino: 'admin',
      titulo: 'Desperdicio registrado',
      mensagem: `${atual.produtoNome || 'Produto'}: ${qtd} un (${motivo || 'Outro'})`,
      url: '/admin/relatorios',
    })
    return { quantidadeDesperdicada, quantidadeRestante }
  }

  async function ajustarProducaoVendedor(id, atual, { novaQuantidade, novoStatus, motivo, observacao }) {
    const agora = Date.now()
    const quantidadeAnterior = Number(atual.quantidadeRestante || 0)
    const quantidadeNova = Math.max(0, Number(novaQuantidade ?? quantidadeAnterior))
    const statusAnterior = atual.status || 'Planejado'
    const statusNovo = novoStatus || statusAnterior
    const usuario = usuarioResumo(usuarioLogado)
    const quantidadePronta = quantidadeNova + Number(atual.quantidadeVendida || 0) + Number(atual.quantidadeDesperdicada || 0)
    const entrada = {
      ...historicoItem('Ajuste de producao recebida', usuarioLogado, {
        produtoId: atual.produtoId || '',
        produtoNome: atual.produtoNome || '',
        quantidadeAnterior,
        quantidadeNova,
        statusAnterior,
        statusNovo,
        motivo: motivo || '',
        observacao: observacao || '',
        alteradoPorId: usuario.id,
        alteradoPorNome: usuario.nome,
        perfil: usuario.perfil,
        dataHora: agora,
      }),
      acao: 'Ajuste de producao recebida',
    }
    await updateDoc(doc(db, 'producaoDiaria', id), {
      quantidadePronta,
      quantidadeRestante: quantidadeNova,
      status: statusNovo,
      observacao: observacao || atual.observacao || '',
      atualizadoPor: usuario,
      atualizadoEm: agora,
      historico: [...(atual.historico || []), entrada],
    })
    notificarPush({
      destino: 'admin',
      titulo: 'Ajuste de producao recebida',
      mensagem: `${atual.produtoNome || 'Produto'}: ${quantidadeAnterior} -> ${quantidadeNova} un (${motivo || 'Sem motivo informado'})`,
      url: '/admin/relatorios',
    })
    return { quantidadeRestante: quantidadeNova, status: statusNovo }
  }

  return {
    producaoDiaria, producaoHoje, salvarProducao, atualizarProducao, removerProducao,
    registrarDesperdicio, ajustarProducaoVendedor,
  }
}
