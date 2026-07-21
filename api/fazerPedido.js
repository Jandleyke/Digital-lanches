import admin from 'firebase-admin'
import {
  JANELA_PEDIDO_MS,
  chaveDiariaPedido,
  deveAtualizarEstoqueProdutoNoPedido,
  estoqueAposVenda,
  gerarCodigoPedidoAleatorio,
} from '../src/utils/pedidos.js'
import {
  producaoDisponivelParaVenda,
  produtoEhBebida,
  produtoLiberadoManualHoje,
} from '../src/utils/producao.js'

const ROLES_VALIDOS = ['aluno', 'professor', 'admin', 'gerente', 'vendedor', 'cozinha']
const PAGAMENTOS_VALIDOS = ['Dinheiro', 'PIX', 'Pix', 'Debito', 'Credito', 'Débito', 'Crédito', 'Conta do Professor']

function privateKey() {
  return process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
}

function serviceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
  if (process.env.FIREBASE_CLIENT_EMAIL && privateKey()) {
    return {
      projectId: process.env.FIREBASE_PROJECT_ID || 'senac-lanches',
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey(),
    }
  }
  return null
}

function appAdmin() {
  if (admin.apps.length) return admin.app()
  const credenciais = serviceAccount()
  if (!credenciais) throw new Error('Firebase Admin não configurado no servidor.')
  return admin.initializeApp({
    credential: admin.credential.cert(credenciais),
    projectId: credenciais.projectId || process.env.FIREBASE_PROJECT_ID || 'senac-lanches',
  })
}

function erroCliente(message, status = 400, code = 'invalid-argument') {
  const erro = new Error(message)
  erro.status = status
  erro.code = code
  return erro
}

function normalizarPerfil(perfil = '') {
  const p = String(perfil).toLowerCase().trim()
  if (['administrador', 'adm', 'lanchonete'].includes(p)) return 'admin'
  if (['gerente', 'gestor'].includes(p)) return 'gerente'
  if (['vendedor', 'vendedora', 'atendente'].includes(p)) return 'vendedor'
  if (['cozinheiro', 'cozinha', 'producao', 'produção'].includes(p)) return 'cozinha'
  if (['prof', 'docente', 'professora'].includes(p)) return 'professor'
  return ROLES_VALIDOS.includes(p) ? p : 'aluno'
}

function perfisDoUsuario(dados = {}) {
  const fonte = [
    ...(Array.isArray(dados.roles) ? dados.roles : []),
    ...(Array.isArray(dados.perfis) ? dados.perfis : []),
    dados.role,
    dados.perfil,
    dados.tipo,
  ].filter(Boolean)
  const perfis = [...new Set(fonte.map(normalizarPerfil).filter(role => ROLES_VALIDOS.includes(role)))]
  return perfis.length ? perfis : ['aluno']
}

function nomeParaVinculo(valor = '') {
  return String(valor)
    .trim()
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extrairToken(req) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) throw erroCliente('Sua sessão expirou. Saia e entre novamente para finalizar o pedido.', 401, 'unauthenticated')
  return token
}

function validarHorario(horario, horarioEm) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(horario || ''))) {
    throw erroCliente('Selecione um horário válido para retirada.')
  }
  const timestamp = Number(horarioEm || 0)
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    throw erroCliente('Selecione um horário válido para retirada.')
  }
  if (timestamp < Date.now() - 60 * 1000) {
    throw erroCliente('O horário selecionado para retirada já passou. Escolha um horário futuro.')
  }
  return timestamp
}

function normalizarItens(carrinho = []) {
  if (!Array.isArray(carrinho) || carrinho.length === 0) {
    throw erroCliente('Seu carrinho está vazio.')
  }
  return carrinho.map(item => {
    const produtoId = String(item?.produtoId || item?.id || '').trim()
    const quantidade = Number(item?.quantidade || 0)
    if (!produtoId) throw erroCliente('Um item do carrinho não possui identificação válida.')
    if (!Number.isInteger(quantidade) || quantidade <= 0) throw erroCliente('Quantidade inválida no carrinho.')
    return {
      produtoId,
      quantidade,
      producaoDiaIds: Array.isArray(item?.producaoDiaIds) ? item.producaoDiaIds.map(id => String(id)).filter(Boolean) : [],
    }
  })
}

function consumirProducoes(transaction, refs, snaps, quantidade) {
  let restante = Number(quantidade || 0)
  const consumos = []
  refs.forEach((ref, index) => {
    if (restante <= 0) return
    const snap = snaps[index]
    if (!snap.exists) return
    const dados = snap.data() || {}
    if (!producaoDisponivelParaVenda(dados)) return
    const disponivel = Math.max(0, Number(dados.quantidadeRestante || 0))
    const usado = Math.min(disponivel, restante)
    if (usado <= 0) return
    const novoRestante = Math.max(0, disponivel - usado)
    const update = {
      quantidadeVendida: Number(dados.quantidadeVendida || 0) + usado,
      quantidadeRestante: novoRestante,
      atualizadoEm: Date.now(),
    }
    if (novoRestante <= 0) update.status = 'Esgotado'
    transaction.update(ref, update)
    consumos.push({ id: ref.id, quantidade: usado })
    restante -= usado
  })
  if (restante > 0) throw erroCliente('Produto fora do cardápio do dia ou sem produção disponível.', 409, 'failed-precondition')
  return consumos
}

async function usuarioDoPedido(app, uid, authUser) {
  const db = admin.firestore(app)
  const ref = db.doc(`usuarios/${uid}`)
  const snap = await ref.get()
  if (!snap.exists) {
    throw erroCliente('Cadastro do usuário não encontrado. Procure a administração para revisar seu acesso.', 403, 'permission-denied')
  }
  const atual = snap.data() || {}
  const roles = perfisDoUsuario(atual)
  const perfil = roles.includes('professor') ? 'professor' : roles[0]
  if (!['aluno', 'professor'].includes(perfil)) {
    throw erroCliente('Seu perfil não tem permissão para finalizar pedidos pelo carrinho.', 403, 'permission-denied')
  }
  if (atual.ativo === false || atual.bloqueado === true) {
    throw erroCliente('Seu cadastro está bloqueado ou inativo. Procure a administração.', 403, 'permission-denied')
  }
  const normalizado = {
    uid,
    userId: uid,
    email: String(atual.email || authUser.email || '').trim().toLowerCase(),
    role: perfil,
    perfil,
    roles,
    nomeVinculo: atual.nomeVinculo || nomeParaVinculo(atual.nome || authUser.displayName || ''),
    atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
  }
  if (!Object.hasOwn(atual, 'ativo')) normalizado.ativo = true
  if (!Object.hasOwn(atual, 'bloqueado')) normalizado.bloqueado = false
  await ref.set(normalizado, { merge: true })
  return { ...atual, ...normalizado, uid, perfil }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ erro: 'Método não permitido.' })
    return
  }

  try {
    const app = appAdmin()
    const db = admin.firestore(app)
    const decoded = await admin.auth(app).verifyIdToken(extrairToken(req))
    const authUser = await admin.auth(app).getUser(decoded.uid)
    const usuario = await usuarioDoPedido(app, decoded.uid, authUser)
    const { carrinho, horarioRetirada, horarioRetiradaEm, pagamento } = req.body || {}
    const perfilAluno = usuario.perfil
    const formaPagamento = String(pagamento || '').trim()
    if (!PAGAMENTOS_VALIDOS.includes(formaPagamento)) throw erroCliente('Forma de pagamento inválida.')
    if (formaPagamento === 'Conta do Professor' && perfilAluno !== 'professor') {
      throw erroCliente('Conta do Professor está disponível somente para professores.', 403, 'permission-denied')
    }

    const itensRecebidos = normalizarItens(carrinho)
    const criadoEm = Date.now()
    const retiradaEm = validarHorario(horarioRetirada, horarioRetiradaEm)
    const chaveDiaria = chaveDiariaPedido(criadoEm)
    const firestoreId = `P${chaveDiaria}-${criadoEm}-${decoded.uid.slice(0, 6)}`
    let pedidoCriado = null

    await db.runTransaction(async transaction => {
      const pedidoRef = db.doc(`pedidos/${firestoreId}`)
      const contadorRef = db.doc(`contadoresPedidos/${chaveDiaria}`)
      const itensComRefs = itensRecebidos.map(item => ({
        item,
        produtoRef: db.doc(`produtos/${item.produtoId}`),
        producaoRefs: item.producaoDiaIds.map(id => db.doc(`producaoDiaria/${id}`)),
      }))

      const contadorSnap = await transaction.get(contadorRef)
      const produtoSnaps = await Promise.all(itensComRefs.map(({ produtoRef }) => transaction.get(produtoRef)))
      const producaoSnapsPorItem = await Promise.all(
        itensComRefs.map(({ producaoRefs }) => Promise.all(producaoRefs.map(ref => transaction.get(ref))))
      )

      const itensPedido = itensComRefs.map(({ item, producaoRefs }, index) => {
        const snap = produtoSnaps[index]
        if (!snap.exists) throw erroCliente(`O item ${item.produtoId} não está mais disponível.`, 409, 'not-found')
        const produto = snap.data() || {}
        const nome = String(produto.nome || 'Produto')
        const preco = Number(produto.preco || 0)
        const estoqueAtual = Math.max(0, Number(produto.estoque || 0))
        const producoesDisponiveis = producaoSnapsPorItem[index]
          .filter(snapProducao => snapProducao.exists && producaoDisponivelParaVenda(snapProducao.data()))
        const quantidadeProducao = producoesDisponiveis
          .reduce((total, snapProducao) => total + Math.max(0, Number(snapProducao.data().quantidadeRestante || 0)), 0)
        const liberadoManual = produtoLiberadoManualHoje(produto)

        if (produtoEhBebida(produto) && produto.disponivel === false) {
          throw erroCliente(`${nome} não está disponível no cardápio de hoje.`, 409, 'failed-precondition')
        }
        if (liberadoManual && estoqueAtual < item.quantidade) {
          throw erroCliente(`Não há quantidade suficiente disponível para ${nome}.`, 409, 'failed-precondition')
        }
        if (!liberadoManual && quantidadeProducao < item.quantidade) {
          throw erroCliente(`${nome} não está disponível no cardápio do dia.`, 409, 'failed-precondition')
        }

        const producaoConsumo = producaoRefs.length
          ? consumirProducoes(transaction, producaoRefs, producaoSnapsPorItem[index], item.quantidade)
          : []
        if (deveAtualizarEstoqueProdutoNoPedido(estoqueAtual, producaoConsumo)) {
          transaction.update(itensComRefs[index].produtoRef, { estoque: estoqueAposVenda(estoqueAtual, item.quantidade) })
        }
        return {
          produtoId: item.produtoId,
          nome,
          quantidade: item.quantidade,
          preco,
          producaoDiaIds: producaoRefs.map(ref => ref.id),
          producaoConsumo,
        }
      })

      const numero = Number(contadorSnap.data()?.ultimoNumero || 0) + 1
      if (numero > 9999) throw erroCliente('O limite diário de pedidos foi atingido. Procure o atendimento.', 409, 'resource-exhausted')
      const codigosUsados = Array.isArray(contadorSnap.data()?.codigosUsados) ? contadorSnap.data().codigosUsados : []
      const codigoPedidoGerado = gerarCodigoPedidoAleatorio(codigosUsados)
      const inicioContagemEm = Math.max(criadoEm, retiradaEm)
      pedidoCriado = {
        id: firestoreId,
        numero,
        codigoPedido: codigoPedidoGerado,
        chaveDiaria,
        uid: decoded.uid,
        userId: decoded.uid,
        alunoId: decoded.uid,
        aluno: usuario.nome || authUser.displayName || 'Aluno',
        nomeVinculo: usuario.nomeVinculo || nomeParaVinculo(usuario.nome || authUser.displayName || ''),
        matricula: String(usuario.matricula || ''),
        alunoMatricula: String(usuario.matricula || ''),
        alunoPerfil: perfilAluno,
        alunoCadastrado: true,
        itens: itensPedido,
        total: itensPedido.reduce((acc, item) => acc + item.preco * item.quantidade, 0),
        status: 'Recebido',
        statusKey: 'em_processo',
        origem: 'app',
        origemLabel: 'App',
        lancadoPorNome: usuario.nome || authUser.displayName || 'Aluno',
        horarioPedido: new Date(criadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        horarioRetirada,
        horarioRetiradaEm: retiradaEm,
        inicioContagemEm,
        pagamento: formaPagamento,
        formaPagamento,
        pagamentoStatus: formaPagamento === 'Conta do Professor' ? 'pendente' : 'aguardando_entrega',
        pago: false,
        criadoEm,
        cancelavelAte: inicioContagemEm + JANELA_PEDIDO_MS,
      }

      transaction.set(contadorRef, {
        ultimoNumero: numero,
        chaveDiaria,
        atualizadoEm: criadoEm,
        codigosUsados: [...codigosUsados, codigoPedidoGerado],
      }, { merge: true })
      transaction.set(pedidoRef, pedidoCriado)
    })

    res.status(200).json({ ok: true, pedido: pedidoCriado })
  } catch (e) {
    console.error('fazerPedido:', {
      code: e?.code || '',
      message: e?.message || '',
      stack: e?.stack || '',
    })
    const status = e.status || (e.code === 'auth/id-token-expired' ? 401 : 500)
    res.status(status).json({
      erro: e.message || 'Não foi possível processar o pedido.',
      codigo: e.code || 'internal',
    })
  }
}
