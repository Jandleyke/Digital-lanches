import { useEffect, useMemo, useState } from 'react'
import { arrayUnion, collection, doc, onSnapshot, query, setDoc, updateDoc, where, orderBy, limit } from 'firebase/firestore'
import { db } from '../../firebase'
import { normalizarPerfil } from '../../utils/perfis'
import { codigoPedido } from '../../utils/pedidos'

function usuarioId(usuario) {
  return usuario?.uid || usuario?.matricula || ''
}

function usuarioResumo(usuario) {
  return {
    uid: usuario?.uid || '',
    nome: usuario?.nome || 'Usuario',
    perfil: normalizarPerfil(usuario?.role || usuario?.perfil),
    matricula: usuario?.matricula || '',
    email: usuario?.email || '',
  }
}

function atendimentoIdPedido(pedido) {
  return `pedido_${pedido?.id || pedido?.pedidoId || codigoPedido(pedido)}`
}

function mensagemPayload(usuario, texto, tipo) {
  const autor = usuarioResumo(usuario)
  return {
    id: `MSG${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    texto: String(texto || '').trim(),
    autorId: usuarioId(usuario),
    autorNome: autor.nome,
    autorPerfil: autor.perfil,
    tipo,
    criadoEm: Date.now(),
  }
}

export function useAtendimentoPedido(usuarioLogado, pedidos = []) {
  const [atendimentos, setAtendimentos] = useState([])
  const perfil = normalizarPerfil(usuarioLogado?.role || usuarioLogado?.perfil)
  const staff = ['vendedor', 'admin', 'gerente'].includes(perfil)
  const idUsuario = usuarioId(usuarioLogado)

  useEffect(() => {
    if (!idUsuario) return undefined
    const ref = collection(db, 'atendimentos')
    const consulta = staff
      ? query(ref, orderBy('atualizadoEm', 'desc'), limit(120))
      : query(ref, where('solicitanteId', '==', idUsuario))

    const unsub = onSnapshot(consulta, snap => {
      setAtendimentos(snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => Number(b.atualizadoEm || 0) - Number(a.atualizadoEm || 0)))
    }, err => console.error('[Firestore] atendimentos:', err))

    return unsub
  }, [idUsuario, staff])

  const porPedido = useMemo(() => {
    const mapa = new Map()
    atendimentos.forEach(item => mapa.set(String(item.pedidoId), item))
    return mapa
  }, [atendimentos])

  function getAtendimentoPedido(pedidoId) {
    return porPedido.get(String(pedidoId)) || null
  }

  async function enviarMensagemPedido(pedido, texto) {
    const mensagem = String(texto || '').trim()
    if (!pedido?.id || !mensagem) return null
    const agora = Date.now()
    const atendimentoId = atendimentoIdPedido(pedido)
    const msg = mensagemPayload(usuarioLogado, mensagem, 'cliente')
    const solicitante = usuarioResumo(usuarioLogado)

    await setDoc(doc(db, 'atendimentos', atendimentoId), {
      id: atendimentoId,
      pedidoId: pedido.id,
      pedidoCodigo: codigoPedido(pedido),
      pedidoStatus: pedido.status || '',
      solicitanteId: usuarioId(usuarioLogado),
      solicitanteNome: pedido.aluno || pedido.alunoNome || usuarioLogado?.nome || 'Usuario',
      solicitantePerfil: solicitante.perfil,
      solicitanteMatricula: pedido.matricula || usuarioLogado?.matricula || '',
      solicitanteEmail: usuarioLogado?.email || '',
      status: 'aberta',
      ultimaMensagem: mensagem,
      ultimoAutorTipo: 'cliente',
      novaParaVendedor: true,
      novaParaCliente: false,
      criadoEm: agora,
      atualizadoEm: agora,
      mensagens: arrayUnion(msg),
    }, { merge: true })

    return msg
  }

  async function responderAtendimento(atendimento, texto) {
    const mensagem = String(texto || '').trim()
    if (!atendimento?.id || !mensagem) return null
    const msg = mensagemPayload(usuarioLogado, mensagem, 'vendedor')
    await updateDoc(doc(db, 'atendimentos', atendimento.id), {
      status: 'respondida',
      ultimaMensagem: mensagem,
      ultimoAutorTipo: 'vendedor',
      novaParaVendedor: false,
      novaParaCliente: true,
      atualizadoEm: Date.now(),
      respondidoPor: usuarioId(usuarioLogado),
      respondidoPorNome: usuarioLogado?.nome || 'Vendedor',
      mensagens: arrayUnion(msg),
    })
    return msg
  }

  async function marcarLidoCliente(atendimento) {
    if (!atendimento?.id || !atendimento.novaParaCliente) return
    await updateDoc(doc(db, 'atendimentos', atendimento.id), { novaParaCliente: false })
  }

  async function marcarLidoVendedor(atendimento) {
    if (!atendimento?.id || !atendimento.novaParaVendedor) return
    await updateDoc(doc(db, 'atendimentos', atendimento.id), { novaParaVendedor: false })
  }

  async function encerrarAtendimento(atendimento) {
    if (!atendimento?.id) return
    await updateDoc(doc(db, 'atendimentos', atendimento.id), {
      status: 'encerrada',
      encerradoEm: Date.now(),
      encerradoPor: usuarioId(usuarioLogado),
      encerradoPorNome: usuarioLogado?.nome || 'Vendedor',
      atualizadoEm: Date.now(),
      novaParaVendedor: false,
    })
  }

  async function arquivarAtendimentosEncerrados(ids = []) {
    const encerrados = atendimentos.filter(item => {
      const selecionado = ids.length === 0 || ids.includes(item.id)
      return selecionado && item.status === 'encerrada' && !item.arquivadoVendedor
    })
    if (encerrados.length === 0) return 0
    const agora = Date.now()
    await Promise.all(encerrados.map(item => updateDoc(doc(db, 'atendimentos', item.id), {
      arquivadoVendedor: true,
      arquivadoEm: agora,
      arquivadoPor: usuarioId(usuarioLogado),
      arquivadoPorNome: usuarioLogado?.nome || 'Vendedor',
    })))
    return encerrados.length
  }

  const atendimentosComPedido = useMemo(() => atendimentos.map(item => ({
    ...item,
    pedido: pedidos.find(pedido => String(pedido.id) === String(item.pedidoId)) || null,
  })), [atendimentos, pedidos])

  return {
    atendimentos: atendimentosComPedido,
    getAtendimentoPedido,
    enviarMensagemPedido,
    responderAtendimento,
    encerrarAtendimento,
    arquivarAtendimentosEncerrados,
    marcarLidoCliente,
    marcarLidoVendedor,
  }
}
