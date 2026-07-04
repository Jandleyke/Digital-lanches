// Proxy para a API do Google Gemini (camada gratuita) - mantém a chave no
// servidor. O frontend nunca fala diretamente com o Gemini.
const MODELOS = ['gemini-2.5-flash-lite', 'gemini-2.0-flash-lite', 'gemini-2.0-flash', 'gemini-2.5-flash']
const RESPOSTA_INDISPONIVEL = 'Assistente indisponível no momento.'
const RESPOSTA_LIMITE = 'Limite de uso gratuito do assistente atingido, tente novamente em instantes.'
const RESPOSTA_ERRO = 'Não consegui responder agora. Tente novamente em instantes.'
const RESPOSTA_SOBRECARGA = 'O assistente está com alta demanda agora. Tente novamente em alguns instantes.'
const RESPOSTA_ACAO_INVALIDA = 'Não consegui confirmar essa ação com os dados disponíveis. Confira o item ou pedido e tente de novo.'
const MAX_PAYLOAD_BYTES = 24 * 1024
const MAX_MENSAGEM_CHARS = 800
const MAX_HISTORICO_ITENS = 6

const INSTRUCAO_ALUNO = `Você é o assistente virtual da cantina "Senac Lanches".
Fale em português do Brasil, com tom simpático, direto e útil. Ajude o aluno com cardápio,
preços, ingredientes, alergias, favoritos, carrinho, status dos pedidos e tela atual.

Regras obrigatórias:
- Responda APENAS com base no JSON de contexto enviado pelo sistema.
- Se faltar informação no contexto, diga claramente que não tem essa informação.
- Se a pergunta não tiver relação com a cantina, recuse educadamente e redirecione.
- Se o aluno tiver alergias e um produto tiver alergênicos relacionados, avise antes de recomendar.
- Para comparações e recomendações, use os campos preço, categoria, descrição, estoque, favorito, avaliacaoMedia e totalAvaliacoes.
- Quando o aluno pedir o melhor lanche, destaque itens bem avaliados e convide a adicionar ao carrinho sem ser insistente.
- Seja breve: normalmente 1 a 3 frases.

Você também pode EXECUTAR ações quando o aluno pedir explicitamente. Não execute ação em perguntas
ambíguas, sugestões ou dúvidas gerais. Quando houver ambiguidade entre produtos, responda pedindo
para o aluno escolher e deixe "acao" como null.

Ações disponíveis:
- favoritar: { "tipo": "favoritar", "produto": "Nome exato do produto" }
- desfavoritar: { "tipo": "desfavoritar", "produto": "Nome exato do produto" }
- adicionar_carrinho: { "tipo": "adicionar_carrinho", "produto": "Nome exato do produto", "quantidade": 1 }
- cancelar_pedido: { "tipo": "cancelar_pedido", "pedidoId": "id do pedido em meusPedidos" }

Use exatamente o nome do produto em contexto.cardapio. Só adicione produtos disponíveis e com estoque.
Só cancele pedidos com podeCancelar=true. Sempre responda em JSON válido, sem markdown.`

const INSTRUCAO_AVISOS = `Você ajuda a equipe da cantina "Senac Lanches" (admin, gerente, vendedor, cozinha, professor)
a escrever avisos internos e respostas a avisos já existentes. Fale em português do Brasil, tom
profissional, claro e breve.

Você pode fazer exatamente UMA das três coisas abaixo por resposta, de acordo com o pedido do usuário:

1. Criar um rascunho de aviso novo a partir de uma descrição (ex: "criar aviso dizendo que não haverá
   aula dia 10/07 para a turma 75 no turno da tarde"). Preencha o campo "rascunhoAviso" com titulo curto,
   mensagem completa, tipo (info = comunicado geral, aviso = alerta importante, novidade, promo = promoção),
   prioridade (baixa/media/alta) e destino (todos/aluno/vendedor/cozinha/admin) mais adequado ao conteúdo.

2. Melhorar o texto de um aviso que o usuário já está escrevendo (vem em contexto.rascunhoAtual.mensagem).
   Preencha "textoMelhorado" com a nova versão do texto, seguindo o pedido (mais profissional, mais curto,
   mais claro, corrigir português, tom mais formal). NÃO invente informação nova, apenas reescreva o que já
   existe.

3. Ajudar a redigir uma resposta a um aviso já aberto (vem em contexto.avisoAtual, com titulo e mensagem).
   Preencha "rascunhoResposta" com o texto da resposta, no tom pedido (confirmar recebimento, pedir mais
   informações, resposta formal, resposta curta, avisar que um setor está ciente, etc.).

Regras obrigatórias:
- Nunca invente datas, turmas, quantidades ou nomes que não foram informados. Se faltar um dado essencial
  para criar o aviso, não invente — pergunte no campo "resposta" e deixe os três rascunhos como null.
- Preencha SOMENTE o campo relevante ao pedido (rascunhoAviso OU textoMelhorado OU rascunhoResposta).
  Os outros dois devem ficar null. Se o pedido não for nenhuma das três coisas, deixe os três null e
  responda normalmente no campo "resposta".
- Você NUNCA publica, envia, edita, exclui ou marca nada como lido sozinho — você só gera o rascunho.
  O usuário sempre revisa e confirma manualmente clicando em "usar" e depois em salvar/enviar.
- O campo "resposta" deve ser curto: 1 a 2 frases dizendo o que você preparou.
- Sempre responda em JSON válido, sem markdown.`

const INSTRUCAO_ADMIN = `Você é o assistente virtual de gestão da cantina "Senac Lanches".
Fale em português do Brasil, com tom profissional e objetivo. Ajude a administração a entender
vendas, ticket médio, pedidos, estoque, itens indisponíveis, avaliações e gargalos operacionais.

Regras obrigatórias:
- Responda APENAS com base no JSON de contexto enviado pelo sistema.
- Se faltar informação, diga isso e sugira qual dado consultar.
- Se a pergunta não tiver relação com a gestão da cantina, recuse educadamente e redirecione.
- Quando fizer análise, cite os números principais e uma ação prática.
- Seja objetivo: normalmente 2 a 5 bullets curtos.`

const ESQUEMA_RESPOSTA_ALUNO = {
  type: 'OBJECT',
  propertyOrdering: ['resposta', 'acao'],
  properties: {
    resposta: { type: 'STRING' },
    acao: {
      type: 'OBJECT',
      nullable: true,
      propertyOrdering: ['tipo', 'produto', 'quantidade', 'pedidoId'],
      properties: {
        tipo: { type: 'STRING', enum: ['favoritar', 'desfavoritar', 'adicionar_carrinho', 'cancelar_pedido'] },
        produto: { type: 'STRING' },
        quantidade: { type: 'INTEGER' },
        pedidoId: { type: 'STRING' },
      },
    },
  },
  required: ['resposta'],
}

const ESQUEMA_RESPOSTA_AVISOS = {
  type: 'OBJECT',
  propertyOrdering: ['resposta', 'rascunhoAviso', 'textoMelhorado', 'rascunhoResposta'],
  properties: {
    resposta: { type: 'STRING' },
    rascunhoAviso: {
      type: 'OBJECT',
      nullable: true,
      propertyOrdering: ['titulo', 'mensagem', 'tipo', 'prioridade', 'destino'],
      properties: {
        titulo: { type: 'STRING' },
        mensagem: { type: 'STRING' },
        tipo: { type: 'STRING', enum: ['info', 'aviso', 'novidade', 'promo'] },
        prioridade: { type: 'STRING', enum: ['baixa', 'media', 'alta'] },
        destino: { type: 'STRING', enum: ['todos', 'aluno', 'vendedor', 'cozinha', 'admin'] },
      },
    },
    textoMelhorado: { type: 'STRING', nullable: true },
    rascunhoResposta: { type: 'STRING', nullable: true },
  },
  required: ['resposta'],
}

function normalizar(texto = '') {
  return String(texto)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function produtosDoContexto(contexto) {
  return Array.isArray(contexto?.cardapio) ? contexto.cardapio : []
}

function pedidosDoContexto(contexto) {
  return Array.isArray(contexto?.meusPedidos) ? contexto.meusPedidos : []
}

function tamanhoPayload(body) {
  try {
    return Buffer.byteLength(JSON.stringify(body || {}), 'utf8')
  } catch {
    return MAX_PAYLOAD_BYTES + 1
  }
}

function perfilSeguro(perfil, contexto) {
  const perfilNormalizado = (perfil === 'admin' || perfil === 'gerente') ? 'admin' : 'aluno'
  if (perfilNormalizado === 'aluno') return 'aluno'

  const pareceContextoAdmin = [
    'vendasHoje',
    'ticketMedio',
    'totalPedidosHoje',
    'totalPagosHoje',
    'statusContagem',
  ].some(campo => Object.hasOwn(contexto || {}, campo))

  return pareceContextoAdmin ? perfilNormalizado : 'aluno'
}

function historicoSeguro(historico) {
  if (!Array.isArray(historico)) return []
  return historico
    .slice(-MAX_HISTORICO_ITENS)
    .filter(item => item && typeof item.texto === 'string')
    .map(item => ({
      autor: item.autor === 'bot' ? 'bot' : 'user',
      texto: item.texto.slice(0, MAX_MENSAGEM_CHARS),
    }))
}

function encontrarProduto(contexto, nome) {
  const alvo = normalizar(nome)
  if (!alvo) return null
  return produtosDoContexto(contexto).find(p => normalizar(p.nome) === alvo) || null
}

function encontrarProdutoNaMensagem(contexto, mensagem) {
  const texto = normalizar(mensagem)
  return produtosDoContexto(contexto).find(p => texto.includes(normalizar(p.nome))) || null
}

function formatarMoeda(valor = 0) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function listaItensPedido(pedido) {
  return (pedido.itens || [])
    .map(i => `${i.quantidade || 1}x ${i.nome}`)
    .join(', ')
}

function responderAlunoLocal(contexto, mensagem) {
  const texto = normalizar(mensagem)
  const produtoNaMensagem = encontrarProdutoNaMensagem(contexto, mensagem)

  if (/(adicion|coloca|bota|inclui).*(carrinho|pedido)/.test(texto) && produtoNaMensagem) {
    return {
      resposta: `Pronto, vou adicionar ${produtoNaMensagem.nome} ao seu carrinho.`,
      acao: { tipo: 'adicionar_carrinho', produto: produtoNaMensagem.nome, quantidade: 1 },
    }
  }

  if (/favorit/.test(texto) && produtoNaMensagem) {
    const desfavoritar = /(desfavorit|remov|tir)/.test(texto)
    return {
      resposta: desfavoritar
        ? `Pronto, vou remover ${produtoNaMensagem.nome} dos seus favoritos.`
        : `Pronto, vou favoritar ${produtoNaMensagem.nome} para você.`,
      acao: { tipo: desfavoritar ? 'desfavoritar' : 'favoritar', produto: produtoNaMensagem.nome },
    }
  }

  if (/(preco|preço|quanto custa|valor)/.test(texto) && produtoNaMensagem) {
    return { resposta: `${produtoNaMensagem.nome} custa ${formatarMoeda(produtoNaMensagem.preco)}.`, acao: null }
  }

  if (/(melhor|avaliad|top|gostoso|barat|recomenda|sugere|indica)/.test(texto)) {
    const produtos = produtosDoContexto(contexto)
      .filter(p => p.estoque !== 0)
      .filter(p => !/lanche/.test(texto) || normalizar(p.categoria).includes('lanche'))
      .sort((a, b) => {
        if (/(barat|preco|preço)/.test(texto)) return (a.preco || 0) - (b.preco || 0)
        const nota = (b.avaliacaoMedia || 0) - (a.avaliacaoMedia || 0)
        if (nota !== 0) return nota
        return (b.totalAvaliacoes || 0) - (a.totalAvaliacoes || 0)
      })

    const escolhido = produtos[0]
    if (escolhido) {
      return {
        resposta: `${escolhido.nome} é uma boa pedida hoje: ${formatarMoeda(escolhido.preco)}${escolhido.avaliacaoMedia ? `, nota ${Number(escolhido.avaliacaoMedia).toFixed(1).replace('.', ',')} nas avaliações` : ''}.${escolhido.descricao ? ` ${escolhido.descricao}.` : ''} Quer que eu adicione ao carrinho?`,
        acao: null,
      }
    }
  }

  if (/carrinho/.test(texto)) {
    const itens = contexto?.carrinho?.itens || []
    if (!itens.length) return { resposta: 'Seu carrinho está vazio no momento.', acao: null }
    return {
      resposta: `No seu carrinho tem ${itens.map(i => `${i.quantidade}x ${i.nome}`).join(', ')}. Total: ${formatarMoeda(contexto.carrinho.total)}.`,
      acao: null,
    }
  }

  if (/(pedido|status|retirada)/.test(texto)) {
    const pedidos = pedidosDoContexto(contexto)
    if (!pedidos.length) return { resposta: 'Não encontrei pedidos seus no contexto atual.', acao: null }
    const resumo = pedidos
      .slice(0, 3)
      .map(p => `${p.id}: ${p.status}${p.horarioRetirada ? `, retirada ${p.horarioRetirada}` : ''}${p.itens?.length ? ` (${listaItensPedido(p)})` : ''}`)
      .join('\n')
    return { resposta: `Seus pedidos mais recentes:\n${resumo}`, acao: null }
  }

  if (/(alerg|alergen)/.test(texto)) {
    const alertas = contexto?.alertasAlergia || []
    if (!contexto?.aluno?.alergias?.length) return { resposta: 'Você não tem alergias cadastradas no perfil.', acao: null }
    if (!alertas.length) return { resposta: 'Não encontrei itens do cardápio atual com as alergias cadastradas no seu perfil.', acao: null }
    return {
      resposta: `Atenção: ${alertas.map(a => `${a.produto} (${a.alergenios.join(', ')})`).join('; ')}.`,
      acao: null,
    }
  }

  if (/cardapio|cardápio|tem hoje|opcoes|opções/.test(texto)) {
    const nomes = produtosDoContexto(contexto).slice(0, 8).map(p => `${p.nome} (${formatarMoeda(p.preco)})`)
    if (nomes.length) return { resposta: `No cardápio disponível: ${nomes.join(', ')}.`, acao: null }
  }

  return null
}

function responderAdminLocal(contexto, mensagem) {
  const texto = normalizar(mensagem)

  if (/(resumo|venda|hoje|ticket)/.test(texto)) {
    return `Hoje foram ${contexto?.totalPedidosHoje || 0} pedido(s), ${contexto?.totalPagosHoje || 0} pago(s), vendas de ${formatarMoeda(contexto?.vendasHoje)} e ticket médio de ${formatarMoeda(contexto?.ticketMedio)}.`
  }

  if (/(estoque|reposi|baixo|indispon)/.test(texto)) {
    const baixos = contexto?.estoqueBaixo || []
    const indisponiveis = contexto?.indisponiveis || []
    if (!baixos.length && !indisponiveis.length) return 'Não encontrei itens com estoque baixo ou indisponíveis no contexto atual.'
    const partes = []
    if (baixos.length) partes.push(`Estoque baixo: ${baixos.map(p => `${p.nome} (${p.estoque})`).join(', ')}.`)
    if (indisponiveis.length) partes.push(`Indisponíveis: ${indisponiveis.map(p => p.nome).join(', ')}.`)
    return partes.join('\n')
  }

  if (/(mais vendid|produto vendeu)/.test(texto)) {
    const maisVendidos = contexto?.maisVendidos || []
    if (!maisVendidos.length) return 'Ainda não há itens vendidos hoje no contexto atual.'
    return `Mais vendidos hoje: ${maisVendidos.map(p => `${p.nome} (${p.qtd})`).join(', ')}.`
  }

  return null
}

function limitarQuantidade(valor, estoque) {
  const quantidade = Math.min(Math.max(Number(valor) || 1, 1), 10)
  if (typeof estoque === 'number' && estoque > 0) return Math.min(quantidade, estoque)
  return quantidade
}

function validarRascunhoAviso(rascunho) {
  if (!rascunho || typeof rascunho !== 'object') return null
  const titulo = String(rascunho.titulo || '').trim().slice(0, 120)
  const mensagem = String(rascunho.mensagem || '').trim().slice(0, 2000)
  if (!titulo || !mensagem) return null
  const tipo = ['info', 'aviso', 'novidade', 'promo'].includes(rascunho.tipo) ? rascunho.tipo : 'info'
  const prioridade = ['baixa', 'media', 'alta'].includes(rascunho.prioridade) ? rascunho.prioridade : 'media'
  const destino = ['todos', 'aluno', 'vendedor', 'cozinha', 'admin'].includes(rascunho.destino) ? rascunho.destino : 'todos'
  return { titulo, mensagem, tipo, prioridade, destino }
}

function validarAcao(acao, contexto) {
  if (!acao || typeof acao !== 'object') return null

  if (acao.tipo === 'favoritar' || acao.tipo === 'desfavoritar') {
    const produto = encontrarProduto(contexto, acao.produto)
    if (!produto) return null
    return { tipo: acao.tipo, produto: produto.nome }
  }

  if (acao.tipo === 'adicionar_carrinho') {
    const produto = encontrarProduto(contexto, acao.produto)
    if (!produto || produto.estoque === 0) return null
    return {
      tipo: 'adicionar_carrinho',
      produto: produto.nome,
      quantidade: limitarQuantidade(acao.quantidade, produto.estoque),
    }
  }

  if (acao.tipo === 'cancelar_pedido') {
    const pedido = pedidosDoContexto(contexto).find(p => String(p.id) === String(acao.pedidoId))
    if (!pedido || !pedido.podeCancelar) return null
    return { tipo: 'cancelar_pedido', pedidoId: pedido.id }
  }

  return null
}

function extrairRespostaAluno(texto) {
  try {
    return JSON.parse(texto)
  } catch {
    const trechoJson = texto.match(/\{[\s\S]*\}/)?.[0]
    if (!trechoJson) return { resposta: texto, acao: null }
    try {
      return JSON.parse(trechoJson)
    } catch {
      return { resposta: texto, acao: null }
    }
  }
}

function esperar(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function consultarGemini({ apiKey, instrucao, contents, generationConfig }) {
  let ultimoErro = null

  for (const modelo of MODELOS) {
    for (let tentativa = 0; tentativa < 2; tentativa += 1) {
      const resposta = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: instrucao }] },
            contents,
            generationConfig,
          }),
        }
      )

      if (resposta.ok) return { ok: true, dados: await resposta.json(), modelo }

      const corpo = await resposta.text()
      ultimoErro = { status: resposta.status, corpo, modelo }

      if (resposta.status === 429) break
      if (resposta.status !== 503) return { ok: false, tipo: 'erro', ...ultimoErro }
      if (tentativa === 0) await esperar(600)
    }
  }

  return { ok: false, tipo: ultimoErro?.status === 429 ? 'limite' : 'sobrecarga', ...ultimoErro }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ resposta: RESPOSTA_INDISPONIVEL })
    return
  }

  try {
    if (tamanhoPayload(req.body) > MAX_PAYLOAD_BYTES) {
      res.status(413).json({ resposta: RESPOSTA_ERRO })
      return
    }

    const { perfil, modo, contexto, historico, mensagem } = req.body || {}
    if (!mensagem || typeof mensagem !== 'string' || mensagem.length > MAX_MENSAGEM_CHARS) {
      res.status(200).json({ resposta: RESPOSTA_ERRO })
      return
    }

    if (modo === 'avisos') {
      const apiKeyAvisos = process.env.GEMINI_API_KEY
      if (!apiKeyAvisos) {
        res.status(200).json({ resposta: RESPOSTA_INDISPONIVEL })
        return
      }

      const contentsAvisos = []
      for (const item of historicoSeguro(historico)) {
        contentsAvisos.push({ role: item.autor === 'bot' ? 'model' : 'user', parts: [{ text: item.texto }] })
      }
      contentsAvisos.push({ role: 'user', parts: [{ text: `Contexto (JSON): ${JSON.stringify(contexto || {})}\n\nPedido do usuário: ${mensagem}` }] })

      const consultaAvisos = await consultarGemini({
        apiKey: apiKeyAvisos,
        instrucao: INSTRUCAO_AVISOS,
        contents: contentsAvisos,
        generationConfig: { maxOutputTokens: 550, temperature: 0.4, responseMimeType: 'application/json', responseSchema: ESQUEMA_RESPOSTA_AVISOS },
      })

      if (consultaAvisos.tipo === 'limite') {
        res.status(200).json({ resposta: RESPOSTA_LIMITE })
        return
      }
      if (consultaAvisos.tipo === 'sobrecarga') {
        console.error('Gemini indisponível (avisos):', consultaAvisos.status, consultaAvisos.modelo, consultaAvisos.corpo)
        res.status(200).json({ resposta: RESPOSTA_SOBRECARGA })
        return
      }
      if (!consultaAvisos.ok) {
        console.error('Gemini respondeu com erro (avisos):', consultaAvisos.status, consultaAvisos.modelo, consultaAvisos.corpo)
        res.status(200).json({ resposta: RESPOSTA_ERRO })
        return
      }

      const textoAvisos = consultaAvisos.dados?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
      if (!textoAvisos) {
        res.status(200).json({ resposta: RESPOSTA_ERRO })
        return
      }

      const parsedAvisos = extrairRespostaAluno(textoAvisos)
      res.status(200).json({
        resposta: parsedAvisos.resposta || RESPOSTA_ERRO,
        rascunhoAviso: validarRascunhoAviso(parsedAvisos.rascunhoAviso),
        textoMelhorado: typeof parsedAvisos.textoMelhorado === 'string' ? parsedAvisos.textoMelhorado.trim().slice(0, 2000) || null : null,
        rascunhoResposta: typeof parsedAvisos.rascunhoResposta === 'string' ? parsedAvisos.rascunhoResposta.trim().slice(0, 1000) || null : null,
      })
      return
    }

    const perfilValidado = perfilSeguro(perfil, contexto)
    const ehAdmin = perfilValidado === 'admin'
    const respostaLocal = ehAdmin
      ? responderAdminLocal(contexto || {}, mensagem)
      : responderAlunoLocal(contexto || {}, mensagem)
    if (respostaLocal) {
      res.status(200).json(typeof respostaLocal === 'string' ? { resposta: respostaLocal } : respostaLocal)
      return
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      res.status(200).json({ resposta: RESPOSTA_INDISPONIVEL })
      return
    }

    const instrucao = ehAdmin ? INSTRUCAO_ADMIN : INSTRUCAO_ALUNO

    const contents = []
    for (const item of historicoSeguro(historico)) {
      contents.push({ role: item.autor === 'bot' ? 'model' : 'user', parts: [{ text: item.texto }] })
    }
    contents.push({ role: 'user', parts: [{ text: `Contexto (JSON): ${JSON.stringify(contexto || {})}\n\nMensagem do usuário: ${mensagem}` }] })

    const generationConfig = ehAdmin
      ? { maxOutputTokens: 500, temperature: 0.35 }
      : { maxOutputTokens: 450, temperature: 0.35, responseMimeType: 'application/json', responseSchema: ESQUEMA_RESPOSTA_ALUNO }

    const consulta = await consultarGemini({ apiKey, instrucao, contents, generationConfig })

    if (consulta.tipo === 'limite') {
      res.status(200).json({ resposta: RESPOSTA_LIMITE })
      return
    }
    if (consulta.tipo === 'sobrecarga') {
      console.error('Gemini indisponível por alta demanda:', consulta.status, consulta.modelo, consulta.corpo)
      res.status(200).json({ resposta: RESPOSTA_SOBRECARGA })
      return
    }
    if (!consulta.ok) {
      console.error('Gemini respondeu com erro:', consulta.status, consulta.modelo, consulta.corpo)
      res.status(200).json({ resposta: RESPOSTA_ERRO })
      return
    }

    const dados = consulta.dados
    const texto = dados?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
    if (!texto) {
      res.status(200).json({ resposta: RESPOSTA_ERRO })
      return
    }

    if (ehAdmin) {
      res.status(200).json({ resposta: texto })
      return
    }

    const respostaAluno = extrairRespostaAluno(texto)
    const acao = validarAcao(respostaAluno.acao, contexto)
    const respostaFinal = respostaAluno.acao && !acao
      ? RESPOSTA_ACAO_INVALIDA
      : respostaAluno.resposta || RESPOSTA_ERRO

    res.status(200).json({ resposta: respostaFinal, acao })
  } catch (erro) {
    console.error('Falha ao consultar o assistente:', erro)
    res.status(200).json({ resposta: RESPOSTA_ERRO })
  }
}
