import { useState, useEffect } from 'react'
import { arrayRemove, arrayUnion, collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import { notificarPush } from '../../utils/notificarPush'
import { chaveArquivoAviso, usuarioAvisoId } from '../../utils/avisos'

export function useAvisos(usuarioLogado) {
  const [avisos, setAvisos] = useState([])

  useEffect(() => {
    if (!usuarioLogado) return
    const unsub = onSnapshot(collection(db, 'avisos'), (snap) => {
      setAvisos(snap.docs.map(d => d.data())
        .sort((a, b) => {
          if (a.fixado && !b.fixado) return -1
          if (!a.fixado && b.fixado) return 1
          return (b.createdAt || b.criadoEm || 0) - (a.createdAt || a.criadoEm || 0)
        }))
    }, err => console.error('[Firestore] avisos:', err))
    return unsub
  }, [usuarioLogado])

  async function criarAviso({ titulo, mensagem, texto, mensagemHtml, tipo, fixado, destino, destinatario, prioridade, status, produtoPromocao }) {
    const id = `AV${Date.now()}`
    const conteudo = mensagem || texto || ''
    const destinoFinal = destino || destinatario || 'todos'
    const agora = Date.now()
    try {
      await setDoc(doc(db, 'avisos', id), {
        id,
        titulo,
        mensagem: conteudo,
        texto: conteudo,
        mensagemHtml: mensagemHtml || '',
        tipo: tipo || 'info',
        prioridade: prioridade || 'media',
        status: status || 'ativo',
        produtoPromocao: produtoPromocao ? {
          id: produtoPromocao.id,
          nome: produtoPromocao.nome || '',
          preco: Number(produtoPromocao.preco || 0),
          categoria: produtoPromocao.categoria || '',
          foto: produtoPromocao.foto || '',
        } : null,
        fixado: !!fixado,
        destino: destinoFinal,
        destinatario: destinoFinal,
        autorId: usuarioLogado?.uid || usuarioLogado?.matricula || '',
        autorNome: usuarioLogado?.nome || 'Sistema',
        autorRole: usuarioLogado?.role || usuarioLogado?.perfil || '',
        autor: usuarioLogado?.nome || 'Sistema',
        lidoPor: [],
        lidoDetalhes: [],
        arquivadoPorUsuarios: [],
        arquivadoDetalhes: [],
        respostas: [],
        createdAt: agora,
        criadoEm: agora,
      })
      if (tipo === 'promo' && (destinoFinal === 'aluno' || destinoFinal === 'todos')) {
        notificarPush({ titulo, mensagem: conteudo, destino: destinoFinal, url: '/aluno/cardapio' })
      } else if (prioridade === 'alta') {
        notificarPush({ titulo, mensagem: conteudo, destino: destinoFinal, url: '/' })
      }
    } catch (e) {
      console.error(e)
      throw e
    }
  }
  async function editarAviso(id, dados) {
    try { await updateDoc(doc(db, 'avisos', id), dados) } catch (e) { console.error(e); throw e }
  }
  async function excluirAviso(id) {
    try { await deleteDoc(doc(db, 'avisos', id)) } catch (e) { console.error(e); throw e }
  }
  async function marcarAvisoLido(id) {
    const leitor = usuarioLogado?.uid || usuarioLogado?.matricula
    if (!id || !leitor) return
    try {
      await updateDoc(doc(db, 'avisos', id), {
        lidoPor: arrayUnion(leitor),
        lidoDetalhes: arrayUnion({
          id: leitor,
          nome: usuarioLogado?.nome || 'Usuario',
          perfil: usuarioLogado?.role || usuarioLogado?.perfil || '',
          data: Date.now(),
        }),
      })
    } catch (e) { console.error(e) }
  }
  async function responderAviso(id, mensagem) {
    const autorId = usuarioLogado?.uid || usuarioLogado?.matricula
    const texto = String(mensagem || '').trim()
    if (!id || !autorId || !texto) return
    try {
      await updateDoc(doc(db, 'avisos', id), {
        respostas: arrayUnion({
          id: `RP${Date.now()}_${autorId}`,
          texto,
          autorId,
          autorNome: usuarioLogado?.nome || 'Usuario',
          autorRole: usuarioLogado?.role || usuarioLogado?.perfil || '',
          criadoEm: Date.now(),
        }),
      })
    } catch (e) {
      console.error(e)
      throw e
    }
  }

  async function arquivarAvisoParaUsuario(id, escopo = 'geral') {
    const leitor = chaveArquivoAviso(usuarioLogado, escopo)
    if (!id || !leitor) return
    try {
      await updateDoc(doc(db, 'avisos', id), {
        arquivadoPorUsuarios: arrayUnion(leitor),
        arquivadoDetalhes: arrayUnion({
          id: leitor,
          usuarioId: usuarioAvisoId(usuarioLogado),
          escopo: escopo || 'geral',
          nome: usuarioLogado?.nome || 'Usuario',
          perfil: usuarioLogado?.role || usuarioLogado?.perfil || '',
          data: Date.now(),
        }),
      })
    } catch (e) {
      console.error(e)
      throw e
    }
  }

  async function desarquivarAvisoParaUsuario(id, escopo = 'geral') {
    const leitor = chaveArquivoAviso(usuarioLogado, escopo)
    if (!id || !leitor) return
    try {
      await updateDoc(doc(db, 'avisos', id), {
        arquivadoPorUsuarios: arrayRemove(leitor),
      })
    } catch (e) {
      console.error(e)
      throw e
    }
  }

  return { avisos, criarAviso, editarAviso, excluirAviso, marcarAvisoLido, responderAviso, arquivarAvisoParaUsuario, desarquivarAvisoParaUsuario }
}
