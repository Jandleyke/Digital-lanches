import { useState, useEffect } from 'react'
import { arrayRemove, arrayUnion, collection, doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import { notificarPush } from '../../utils/notificarPush'
import { avisoCriadoPorUsuario, avisoDestinadoAoUsuario, chaveArquivoAviso, usuarioAvisoId } from '../../utils/avisos'
import { normalizarPerfil } from '../../utils/perfis'

export function useAvisos(usuarioLogado) {
  const [avisos, setAvisos] = useState([])

  useEffect(() => {
    if (!usuarioLogado) return
    const unsub = onSnapshot(collection(db, 'avisos'), (snap) => {
      setAvisos(snap.docs.map(d => d.data())
        .filter(aviso => !aviso.deletedAt && aviso.status !== 'excluido')
        .sort((a, b) => {
          if (a.fixado && !b.fixado) return -1
          if (!a.fixado && b.fixado) return 1
          return (b.createdAt || b.criadoEm || 0) - (a.createdAt || a.criadoEm || 0)
        }))
    }, err => console.error('[Firestore] avisos:', err))
    return unsub
  }, [usuarioLogado])

  async function criarAviso({ titulo, mensagem, texto, mensagemHtml, tipo, fixado, destino, destinos, destinatario, prioridade, status, produtoPromocao, recipients, recipientsDetalhes }) {
    const id = `AV${Date.now()}`
    const conteudo = mensagem || texto || ''
    const destinosFinais = Array.isArray(destinos) && destinos.length > 0 ? [...new Set(destinos)] : [destino || destinatario || 'todos']
    const destinoFinal = destinosFinais[0] || 'todos'
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
        destinos: destinosFinais,
        recipients: Array.isArray(recipients) ? recipients.map(String) : [],
        recipientsDetalhes: Array.isArray(recipientsDetalhes) ? recipientsDetalhes : [],
        createdBy: usuarioLogado?.uid || usuarioLogado?.matricula || '',
        createdByMatricula: usuarioLogado?.matricula || '',
        createdByEmail: usuarioLogado?.email || '',
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
    try {
      const atual = avisos.find(aviso => aviso.id === id)
      if (atual && !avisoCriadoPorUsuario(atual, usuarioLogado)) throw new Error('Somente quem criou o aviso pode editar.')
      const permitidos = { ...dados }
      delete permitidos.createdAt
      delete permitidos.criadoEm
      delete permitidos.createdBy
      delete permitidos.createdByMatricula
      delete permitidos.createdByEmail
      delete permitidos.autorId
      delete permitidos.autorNome
      delete permitidos.autorRole
      delete permitidos.autor
      await updateDoc(doc(db, 'avisos', id), {
        ...permitidos,
        updatedAt: Date.now(),
        updatedBy: usuarioLogado?.uid || usuarioLogado?.matricula || '',
        updatedByNome: usuarioLogado?.nome || 'Usuario',
      })
    } catch (e) { console.error(e); throw e }
  }
  async function excluirAviso(id) {
    try {
      const atual = avisos.find(aviso => aviso.id === id)
      if (atual && !avisoCriadoPorUsuario(atual, usuarioLogado)) throw new Error('Somente quem criou o aviso pode apagar para todos.')
      await updateDoc(doc(db, 'avisos', id), {
        status: 'excluido',
        deletedAt: Date.now(),
        deletedBy: usuarioLogado?.uid || usuarioLogado?.matricula || '',
        deletedByNome: usuarioLogado?.nome || 'Usuario',
      })
    } catch (e) { console.error(e); throw e }
  }
  async function marcarAvisoLido(id) {
    const leitor = usuarioLogado?.uid || usuarioLogado?.matricula
    if (!id || !leitor) return
    const atual = avisos.find(aviso => aviso.id === id)
    if (atual && !avisoDestinadoAoUsuario(atual, usuarioLogado, normalizarPerfil(usuarioLogado?.perfil || usuarioLogado?.role))) return
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
    const atual = avisos.find(aviso => aviso.id === id)
    if (atual && !avisoDestinadoAoUsuario(atual, usuarioLogado, normalizarPerfil(usuarioLogado?.perfil || usuarioLogado?.role))) return
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
