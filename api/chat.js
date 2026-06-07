// Proxy para a API do Google Gemini (camada gratuita) — mantém a chave no
// servidor. O frontend nunca fala diretamente com o Gemini.
const MODELO = 'gemini-2.5-flash'
const RESPOSTA_INDISPONIVEL = 'Assistente indisponível no momento.'
const RESPOSTA_LIMITE = 'Limite de uso gratuito do assistente atingido, tente novamente em instantes.'
const RESPOSTA_ERRO = 'Não consegui responder agora. Tente novamente em instantes.'

const INSTRUCAO_ALUNO = `Você é o assistente virtual da cantina "Senac Lanches". Converse de forma
simpática e direta com o aluno, ajudando com dúvidas sobre o cardápio, status dos pedidos,
horários de retirada, alergênicos, favoritos, carrinho e a tela em que ele está navegando
("telaAtual" no contexto). Responda APENAS com base nos dados fornecidos em "contexto" — se não
souber algo a partir deles, diga que não tem essa informação. Se a pergunta não tiver relação com
a cantina, recuse educadamente e redirecione para o assunto. Seja breve.

Além de responder, você pode EXECUTAR ações para o aluno quando ele pedir explicitamente. Para
isso, preencha o campo "acao" da resposta (deixe "acao" como null quando for só uma pergunta).
Ações disponíveis (use exatamente o "nome" do produto/pedido como aparece no contexto):
- favoritar: { "tipo": "favoritar", "produto": "Nome exato do produto" }
- desfavoritar: { "tipo": "desfavoritar", "produto": "Nome exato do produto" }
- adicionar_carrinho: { "tipo": "adicionar_carrinho", "produto": "Nome exato do produto", "quantidade": 1 }
- cancelar_pedido: { "tipo": "cancelar_pedido", "pedidoId": "id do pedido em meusPedidos" }
Só use "cancelar_pedido" se o pedido tiver "podeCancelar": true; caso contrário explique ao aluno
que esse pedido não pode mais ser cancelado. Só use "favoritar"/"adicionar_carrinho" com produtos
que existam em "cardapio". Sempre escreva em "resposta" uma frase confirmando o que você está
fazendo (ex.: "Pronto, adicionei 2 Coxinhas ao seu carrinho!").`

const INSTRUCAO_ADMIN = `Você é o assistente virtual de gestão da cantina "Senac Lanches". Ajude a
administração a entender vendas, estoque e avaliações, resumindo números e sugerindo ações com
base nos dados fornecidos em "contexto". Responda APENAS com base nesses dados — se faltar
informação, diga isso. Se a pergunta não tiver relação com a gestão da cantina, recuse
educadamente e redirecione para o assunto. Seja objetivo.`

const ESQUEMA_RESPOSTA_ALUNO = {
  type: 'OBJECT',
  properties: {
    resposta: { type: 'STRING' },
    acao: {
      type: 'OBJECT',
      nullable: true,
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ resposta: RESPOSTA_INDISPONIVEL })
    return
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    res.status(200).json({ resposta: RESPOSTA_INDISPONIVEL })
    return
  }

  try {
    const { perfil, contexto, historico, mensagem } = req.body || {}
    if (!mensagem || typeof mensagem !== 'string') {
      res.status(200).json({ resposta: RESPOSTA_ERRO })
      return
    }

    const ehAdmin = perfil === 'admin' || perfil === 'gerente'
    const instrucao = ehAdmin ? INSTRUCAO_ADMIN : INSTRUCAO_ALUNO

    const contents = []
    if (Array.isArray(historico)) {
      for (const item of historico.slice(-6)) {
        if (!item?.texto) continue
        contents.push({ role: item.autor === 'bot' ? 'model' : 'user', parts: [{ text: String(item.texto) }] })
      }
    }
    contents.push({ role: 'user', parts: [{ text: `Contexto (JSON): ${JSON.stringify(contexto || {})}\n\nPergunta do usuário: ${mensagem}` }] })

    const generationConfig = ehAdmin
      ? { maxOutputTokens: 350, temperature: 0.4 }
      : { maxOutputTokens: 350, temperature: 0.4, responseMimeType: 'application/json', responseSchema: ESQUEMA_RESPOSTA_ALUNO }

    const resposta = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent?key=${apiKey}`,
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

    if (resposta.status === 429) {
      res.status(200).json({ resposta: RESPOSTA_LIMITE })
      return
    }
    if (!resposta.ok) {
      console.error('Gemini respondeu com erro:', resposta.status, await resposta.text())
      res.status(200).json({ resposta: RESPOSTA_ERRO })
      return
    }

    const dados = await resposta.json()
    const texto = dados?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
    if (!texto) {
      res.status(200).json({ resposta: RESPOSTA_ERRO })
      return
    }

    if (ehAdmin) {
      res.status(200).json({ resposta: texto })
      return
    }

    try {
      const { resposta: textoResposta, acao } = JSON.parse(texto)
      res.status(200).json({ resposta: textoResposta || RESPOSTA_ERRO, acao: acao || null })
    } catch {
      res.status(200).json({ resposta: texto, acao: null })
    }
  } catch (erro) {
    console.error('Falha ao consultar o assistente:', erro)
    res.status(200).json({ resposta: RESPOSTA_ERRO })
  }
}
