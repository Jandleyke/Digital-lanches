# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Senac Lanches is a PWA for ordering food from a school cafeteria at SENAC (a Brazilian technical school). Live at `https://senac-lanches.vercel.app`.

## Commands

```bash
npm run dev            # Vite dev server (localhost:5173)
npm run build          # Production build to dist/
npm run lint           # ESLint check
npm run test           # Run tests once (Vitest)
npm run test:watch     # Vitest watch mode
npm run preview        # Preview production build locally
npm run deploy         # Deploy to Vercel production (npx vercel --prod --yes)
npm run deploy:firebase  # Firebase Hosting fallback
```

**Before finishing any task**, always run in order:
1. `npx eslint .` — must pass
2. `npx vite build` — must succeed
3. `npx vitest run` — all tests must pass
4. Then commit, push, and `npx vercel --prod --yes`

## Architecture

**Stack:** React 19 + Vite, Firebase Firestore (real-time `onSnapshot`), Firebase Auth, Vercel serverless functions (`api/`), Google Gemini API for the AI assistant.

**State management:** A single `AppContext.jsx` composes all domain hooks and exposes them via `useAppContext()`. Domain hooks live in `src/contexts/hooks/`:
- `useAuth` — authentication, user management, role resolution
- `usePedidos` — orders, status changes, estimated time
- `useProdutos` — product catalog, availability toggling
- `useCarrinho` — cart + favorites
- `useAvisos` — announcements per role
- `useProducaoDiaria` — kitchen daily production planning
- `useLanchoneteConfig` — cantina hours and settings
- `useAvaliacoes` — order ratings

**Routing & access control:** `App.jsx` defines all routes. The `<Protegida>` wrapper checks Firebase auth + user role + account status. Routes are split per role. Multi-role users land on `/escolher-acesso` to pick their active role.

**User roles:**
| Role | Routes | Purpose |
|------|--------|---------|
| `aluno` | `/aluno/*` | Browse menu, cart, orders, history, ratings |
| `professor` | `/aluno/*` + `/professor/avisos` | Student features + teacher announcements |
| `cozinha` | `/cozinha/*`, `/painel` | Real-time order queue, production planning, inventory |
| `vendedor` | `/vendedor/*`, `/painel` | Counter sales, order lookup, inventory |
| `admin` | `/admin/*` | User management, product catalog, reports |

**Serverless API (`api/`):**
- `adminUsuarios.js` — Firebase Admin SDK: create/edit/delete users
- `chat.js` — Gemini API proxy (keeps API key server-side)
- `sendPush.js` — Web push notification dispatcher

## Key Patterns

**Code-splitting:** Pages are lazy-loaded via a `lazyComRecarga` wrapper that auto-reloads once if a chunk fails (handles new deploys while tab is open).

**AI Assistant:** Floating widget in `Layout.jsx` powered by Gemini (`gemini-2.5-flash`). Students can have the AI execute actions (add to cart, cancel orders); admins get read-only summaries. Context is built in `src/utils/aiContext.js`.

**Testing:** Vitest + Testing Library + JSDOM. Tests cover pure utilities in `src/utils/` (formatters, pedidos, producao, lanchonete, nomes, perfis, aiContext, notifications, storage). Tests do not cover React components.

**PDF reports:** `jsPDF` is dynamically imported in `Relatorios.jsx` to keep the bundle small.

## Environment Variables

Client-side (`.env`): `VITE_EMAILJS_*`, `VITE_VAPID_PUBLIC_KEY`

Server-side (Vercel dashboard only — never in code): `GEMINI_API_KEY`, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `VAPID_PRIVATE_KEY`

## Firestore Security Rules

`firestore.rules` uses helper functions: `isSignedIn()`, `hasRole(roles)`, `isStaff()`, `isCozinhaOuAdmin()`, `podeGerenciarAvisos()`. Rules gate access per collection based on user `perfil`/`role`/`roles` fields in Firestore.

## Important Constraints

- **No audio/sound** — removed by client request; do not add back.
- **No future order scheduling** — feature was removed; do not recreate.
- **Viewport is locked** (`user-scalable=no`) — intentional mobile app feel.
- Large pages (`Cozinha.jsx` ~80KB, `Vendedor.jsx` ~90KB) are intentionally monolithic with tab-based navigation; avoid splitting unless specifically requested.
