import { useState, useEffect } from 'react'
import { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore'
import { db } from '../../firebase'
import { notificarPush } from '../../utils/notificarPush'
import { ehGestao, normalizarPerfil } from '../../utils/perfis'
import { produtoEhBebida } from '../../utils/producao'

function quantidadeNaoNegativa(valor) {
  const numero = Number(valor)
  return Number.isFinite(numero) ? Math.max(0, Math.floor(numero)) : 0
}

function fotoPersistente(valor) {
  const foto = String(valor || '').trim()
  return foto.startsWith('blob:') ? '' : foto
}

export function useProdutos(usuarioLogado) {
  const [produtos, setProdutos] = useState([])

  useEffect(() => {
    if (!usuarioLogado) return
    let unsub = () => {}
    try {
      unsub = onSnapshot(collection(db, 'produtos'), (snap) => {
        const podeLimparFotosInvalidas = ehGestao(usuarioLogado?.role || usuarioLogado?.perfil)
        const lista = snap.docs.map(produtoDoc => {
          const dados = produtoDoc.data()
          const foto = fotoPersistente(dados.foto)
          if (podeLimparFotosInvalidas && dados.foto && !foto) {
            updateDoc(produtoDoc.ref, { foto: '' }).catch(error => console.error('[Firestore] limpar foto temporária:', error))
          }
          return { ...dados, foto }
        })
        setProdutos(lista.sort((a, b) => (a.id || 0) - (b.id || 0)))
      }, err => console.error('[Firestore] produtos:', err))
    } catch (e) {
      console.error('[Firestore] produtos init:', e)
    }
    return unsub
    // Só re-inscreve quando o usuário/perfil realmente muda — não a cada nova
    // referência do objeto `usuarioLogado` (que evita reler a coleção `produtos`).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuarioLogado?.uid, usuarioLogado?.perfil])

  async function atualizarProduto(produto) {
    const anterior = produtos.find(p => String(p.id) === String(produto.id))
    const perfil = normalizarPerfil(usuarioLogado?.role || usuarioLogado?.perfil)
    const estoqueAnterior = quantidadeNaoNegativa(anterior?.estoque)
    const estoqueSolicitado = quantidadeNaoNegativa(produto.estoque)
    const estoqueMudou = Boolean(anterior) && estoqueSolicitado !== estoqueAnterior
    const categoria = String(anterior?.categoria || produto.categoria || '').trim().toLowerCase()

    if (estoqueMudou && ehGestao(perfil)) {
      throw new Error('O administrador pode visualizar o estoque, mas não editar a quantidade diretamente.')
    }
    if (estoqueMudou && perfil === 'vendedor' && categoria !== 'bebidas') {
      throw new Error('O vendedor pode editar somente o estoque de bebidas.')
    }

    const produtoSeguro = {
      ...produto,
      estoque: estoqueSolicitado,
      estoqueBaixo: quantidadeNaoNegativa(produto.estoqueBaixo),
      foto: fotoPersistente(produto.foto),
    }
    if (Object.prototype.hasOwnProperty.call(produto, 'estoqueInicial')) {
      produtoSeguro.estoqueInicial = quantidadeNaoNegativa(produto.estoqueInicial)
    }
    // Admin/gestão não pode alterar `disponivel` de comidas — a Cozinha controla via produção
    if (ehGestao(perfil) && anterior && !produtoEhBebida(anterior)) {
      produtoSeguro.disponivel = anterior.disponivel !== undefined ? anterior.disponivel : true
    }
    try {
      await setDoc(doc(db, 'produtos', String(produto.id)), produtoSeguro)
      const limite = Number(produtoSeguro.estoqueBaixo || 0)
      if (limite > 0 && estoqueSolicitado <= limite && estoqueAnterior > limite) {
        const mensagem = `${produtoSeguro.nome}: ${estoqueSolicitado} un restante(s).`
        notificarPush({ destino: 'admin', titulo: 'Estoque baixo', mensagem, url: '/admin/estoque' })
        notificarPush({ destino: 'vendedor', titulo: 'Estoque baixo', mensagem, url: '/vendedor' })
      }
      return { ok: true }
    } catch (e) {
      console.error(e)
      throw e
    }
  }
  async function adicionarProduto(produto) {
    const id = Date.now()
    const perfil = normalizarPerfil(usuarioLogado?.role || usuarioLogado?.perfil)
    const categoria = String(produto.categoria || '').trim().toLowerCase()
    const estoque = perfil === 'vendedor' && categoria !== 'bebidas' ? 0 : quantidadeNaoNegativa(produto.estoque)
    const produtoSeguro = { ...produto, id, estoque, estoqueInicial: quantidadeNaoNegativa(produto.estoqueInicial ?? estoque), estoqueBaixo: quantidadeNaoNegativa(produto.estoqueBaixo), foto: fotoPersistente(produto.foto) }
    try { await setDoc(doc(db, 'produtos', String(id)), produtoSeguro) } catch (e) { console.error(e); throw e }
  }
  async function adicionarProdutos(novosProdutos) {
    const batch = writeBatch(db)
    const base = Date.now()
    novosProdutos.forEach((produto, index) => {
      const id = produto.id || base + index
      const perfil = normalizarPerfil(usuarioLogado?.role || usuarioLogado?.perfil)
      const categoria = String(produto.categoria || '').trim().toLowerCase()
      const estoque = perfil === 'vendedor' && categoria !== 'bebidas' ? 0 : quantidadeNaoNegativa(produto.estoque)
      batch.set(doc(db, 'produtos', String(id)), {
        ...produto,
        id,
        estoque,
        estoqueInicial: quantidadeNaoNegativa(produto.estoqueInicial ?? estoque),
        estoqueBaixo: quantidadeNaoNegativa(produto.estoqueBaixo),
        foto: fotoPersistente(produto.foto),
      })
    })
    await batch.commit()
  }
  async function removerProduto(id) {
    await deleteDoc(doc(db, 'produtos', String(id)))
  }
  async function removerProdutos(ids) {
    await Promise.all(ids.map(id => deleteDoc(doc(db, 'produtos', String(id)))))
  }

  async function atualizarDisponibilidadeProdutos(ids, disponivel) {
    const batch = writeBatch(db)
    const agora = Date.now()
    const perfil = normalizarPerfil(usuarioLogado?.role || usuarioLogado?.perfil)
    const data = new Date(agora)
    const cardapioManualData = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
    const selecionados = ids
      .map(id => produtos.find(produto => String(produto.id) === String(id)))
      .filter(Boolean)
    const alterados = { bebidas: 0, comidas: 0 }

    selecionados.forEach(produto => {
      const ref = doc(db, 'produtos', String(produto.id))
      if (produtoEhBebida(produto)) {
        alterados.bebidas += 1
        batch.update(ref, {
          disponivel: Boolean(disponivel),
          cardapioManualHoje: Boolean(disponivel),
          cardapioManualData: disponivel ? cardapioManualData : '',
          cardapioManualEm: disponivel ? agora : null,
          atualizadoEm: agora,
        })
        return
      }

      if (perfil === 'vendedor') return

      alterados.comidas += 1
      batch.update(ref, {
        visivelPlanejamento: Boolean(disponivel),
        atualizadoEm: agora,
        avisoCardapioCozinha: 'O controle do cardápio de comidas é feito pela Cozinha. Esta ação não remove o produto do cardápio do dia.',
      })
    })
    await batch.commit()
    return alterados
  }

  return { produtos, atualizarProduto, adicionarProduto, adicionarProdutos, removerProduto, removerProdutos, atualizarDisponibilidadeProdutos }
}
