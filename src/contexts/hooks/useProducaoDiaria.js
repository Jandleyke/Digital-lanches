import { useEffect, useMemo, useState } from 'react'
import { collection, deleteDoc, doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '../../firebase'

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
  return {
    ...item,
    quantidadePlanejada: Number(item.quantidadePlanejada || 0),
    quantidadeEmProducao: Number(item.quantidadeEmProducao || 0),
    quantidadePronta,
    quantidadeVendida,
    quantidadeRestante: Math.max(0, Number(item.quantidadeRestante ?? (quantidadePronta - quantidadeVendida))),
  }
}

export function useProducaoDiaria(usuarioLogado, criarAviso) {
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

  async function avisar(item, mensagem, tipo = 'info') {
    if (!criarAviso) return
    try {
      await criarAviso({
        titulo: `Producao: ${item.produtoNome}`,
        mensagem,
        destino: 'vendedor',
        tipo,
        prioridade: tipo === 'aviso' ? 'alta' : 'media',
      })
      await criarAviso({
        titulo: `Producao: ${item.produtoNome}`,
        mensagem,
        destino: 'admin',
        tipo,
        prioridade: tipo === 'aviso' ? 'alta' : 'media',
      })
    } catch (e) {
      console.error('[Firestore] aviso producao:', e)
    }
  }

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
    const mudouStatus = dados.status && dados.status !== atual.status
    const mudouQuantidade = dados.quantidadePronta !== undefined && Number(dados.quantidadePronta || 0) !== Number(atual.quantidadePronta || 0)
    await updateDoc(doc(db, 'producaoDiaria', id), {
      ...dados,
      quantidadeRestante: proxima.quantidadeRestante,
      atualizadoPor: usuarioResumo(usuarioLogado),
      atualizadoEm: agora,
      historico: [...(atual.historico || []), historicoItem(opcoes.acao || 'Atualizou producao', usuarioLogado, { status: proxima.status })],
    })
    if (opcoes.avisar !== false && (mudouStatus || mudouQuantidade)) {
      const msgStatus = proxima.status === 'Pronto para venda'
        ? `${proxima.produtoNome} esta pronta para venda. Quantidade disponivel: ${proxima.quantidadeRestante}.`
        : proxima.status === 'Em producao'
          ? `${proxima.produtoNome} esta em producao. Previsao para ficar pronto: ${proxima.horarioPrevisto || 'sem horario definido'}.`
          : proxima.status === 'Esgotado'
            ? `${proxima.produtoNome} foi marcado como esgotado pela cozinha.`
            : `Producao de ${proxima.produtoNome} atualizada para ${proxima.status}.`
      const msgQuantidade = `Quantidade disponivel de ${proxima.produtoNome} atualizada para ${proxima.quantidadeRestante} unidades.`
      await avisar(proxima, mudouQuantidade && !mudouStatus ? msgQuantidade : msgStatus, proxima.status === 'Esgotado' ? 'aviso' : 'info')
    }
    return proxima
  }

  async function removerProducao(id, atual) {
    if (atual) {
      await atualizarProducao(id, atual, { status: 'Cancelado' }, { acao: 'Cancelou producao', avisar: true })
    }
    await deleteDoc(doc(db, 'producaoDiaria', id))
  }

  return { producaoDiaria, producaoHoje, salvarProducao, atualizarProducao, removerProducao }
}
