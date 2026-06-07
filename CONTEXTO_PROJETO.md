# Resumo do projeto — Senac Lanches

Cole este resumo para um novo assistente de IA entender o projeto rapidamente.

## O que é
App web (PWA instalável) de pedidos da cantina de uma escola (Senac). Alunos
fazem pedidos pelo celular/computador, a cozinha acompanha numa fila, e a
administração gerencia produtos, estoque, usuários, avisos e relatórios.

## Stack técnica
- **React 19 + Vite** (build/dev server), **react-router-dom v7**
- **Firebase Firestore** como banco de dados (tempo real via `onSnapshot`)
- **Autenticação própria**: NÃO usa Firebase Auth — login compara matrícula/senha
  direto na coleção `usuarios` do Firestore
- Hospedado na **Vercel** (deploy via `npx vercel --prod`, domínio
  `senac-lanches.vercel.app`), com função serverless em `api/` (Node/ESM)
- **Google Gemini API** (camada gratuita, modelo `gemini-2.5-flash`) para o
  assistente de IA — acessada via `fetch` direto (sem SDK), só no backend
- **Vitest + Testing Library** para testes (`npm run test`)
- Repositório no GitHub: `https://github.com/Jandleyke/senac-lanches` (privado)

## Estrutura principal
- `src/contexts/AppContext.jsx` — contexto global, compõe hooks customizados:
  `useAuth`, `useProdutos`, `usePedidos`, `useAvisos`, `useCarrinho`
  (em `src/contexts/hooks/`)
- `src/pages/student/` — telas do aluno (Cardápio, Carrinho, Pedidos, Perfil,
  Histórico, Favoritos)
- `src/pages/kitchen/` — tela da cozinha (FilaPedidos)
- `src/pages/admin/` — telas administrativas (Dashboard, Produtos, Estoque,
  Usuários, Avisos, Relatórios)
- `src/utils/` — funções utilitárias (formatters, storage, notifications,
  aiContext, etc.)
- `src/components/ChatAssistente.jsx` — widget flutuante do assistente de IA,
  montado globalmente em `Layout.jsx` para todo usuário logado (exceto cozinha)
- `api/chat.js` — função serverless da Vercel que faz proxy para o Gemini
  (mantém a `GEMINI_API_KEY` só no servidor)

## Perfis de usuário
`aluno`, `cozinha`, `admin`/`gerente` — controlam rotas e o que cada um vê.

## Decisões/recursos importantes (e por quê)
- **Notificações do navegador** (`src/utils/notifications.js`): avisa o aluno
  quando o pedido fica "Pronto". A detecção de mudança de status fica dentro do
  hook `usePedidos` (não numa página específica), para funcionar em qualquer
  tela do app, não só na tela "Meus Pedidos".
- **Função de áudio/som FOI REMOVIDA por completo** a pedido do dono — não
  recriar isso sem perguntar antes.
- **Agendamento de pedido para o dia seguinte FOI REMOVIDO** — não recriar.
- **Tela travada / sem zoom no mobile**: `index.html` usa
  `user-scalable=no, maximum-scale=1.0` e `index.css` define
  `touch-action: manipulation` em `html, body` — comportamento de app nativo.
- **Assistente de IA (Gemini, 100% gratuito)**: chat flutuante com dois modos
  conforme o perfil —
  - **aluno**: tira dúvidas sobre cardápio/pedidos/horários/alergênicos e
    também **executa ações** (favoritar/desfavoritar produto, adicionar item
    ao carrinho, cancelar pedido) quando o aluno pede explicitamente. A IA
    devolve um JSON estruturado `{ resposta, acao }` (usando
    `responseSchema` do Gemini); o frontend executa a ação chamando as MESMAS
    funções que os botões do app usam (`toggleFavorito`, `adicionarAoCarrinho`,
    `cancelarPedido`), respeitando as mesmas regras (ex.: só cancela pedido
    com status "Recebido"). Também recebe um resumo da tela atual
    (`telaAtual`) para comentar sobre o que o aluno está vendo.
  - **admin/gerente**: resume vendas, estoque e avaliações (somente leitura,
    sem ações).
  - A chave `GEMINI_API_KEY` fica só no ambiente da Vercel (nunca no bundle do
    cliente — verificado via grep em `dist/assets/*.js`). O backend
    (`api/chat.js`) sempre responde HTTP 200, mesmo em erro/limite excedido,
    devolvendo uma mensagem amigável (`{ resposta: '...' }`) para o frontend
    não precisar tratar múltiplos estados de erro.
  - `src/utils/aiContext.js` monta o contexto compacto enviado ao modelo
    (cardápio, pedidos do aluno, favoritos, carrinho, tela atual / vendas,
    estoque baixo, mais vendidos para o admin) — testado em
    `aiContext.test.js`.
  - **Atenção**: o tier gratuito do Gemini tem limite de requisições por
    minuto/dia e passa por picos de instabilidade ("high demand"); isso é do
    lado do Google, não um bug do app.
- **PDF de relatórios carregado sob demanda** (`import()` dinâmico de jsPDF),
  para não inflar o bundle principal.
- Testes cobrem funções utilitárias puras, o módulo de notificações e o
  `aiContext`.

## Como rodar localmente
```
npm install
npm run dev      # ambiente de desenvolvimento
npm run test     # testes
npx eslint .     # lint
npx vite build   # build de produção
npx vercel --prod  # deploy
```

## Variáveis de ambiente (Vercel → Project Settings → Environment Variables)
- `GEMINI_API_KEY` — chave da camada gratuita do Google Gemini, usada só por
  `api/chat.js` (sem prefixo `VITE_`, nunca exposta ao cliente)

## Fluxo de validação antes de declarar uma tarefa concluída
Sempre rodar, nesta ordem: `npx eslint .`, `npx vite build`, `npx vitest run`.
Só considerar pronto se os três passarem sem erro.
