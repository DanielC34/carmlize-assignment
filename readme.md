# Carmlize

Carmlize is an AI-powered crypto market intelligence platform. The goal is to combine **real-time market data**, **blockchain data**, and **AI** so users can understand what is happening in the market and make better decisions faster — collect data in one place, analyze it, and turn it into useful signals and insights.

This repository is a **Next.js full-stack app** — React UI, REST API routes, a custom WebSocket server, and server-side business logic in `client/lib/`. There is **no platform token** and no mint/swap/smart-contract product surface; on-chain work (when added) is about reading and analyzing blockchain data, not issuing a Carmlize ERC20.

> **Test project:** this codebase is for evaluating developer experience. It is meant to combine AI with real-time market intelligence (APIs, WebSockets, and dashboard UX).

**Full-Stack Developer candidates:** see **[FULLSTACK_DEVELOPER.md](./FULLSTACK_DEVELOPER.md)** for the take-home (order blotter, fills tape, price alerts, dashboard desk strip). The starter already includes dashboard, markets, and trade→orders wiring — do not rebuild those.

**AI Engineer candidates:** see **[AI_ENGINEER.md](./AI_ENGINEER.md)** for the take-home (structured signals, grounded briefs, evals, dashboard UX).

**Blockchain Developer candidates:** see **[BLOCKCHAIN_DEVELOPER.md](./BLOCKCHAIN_DEVELOPER.md)** for the take-home (on-chain reads, desk-pair token mapping, activity APIs, dashboard chain context). Read-only — no token, mint, swap, or Solidity.

**Scope is limited to the `client/` workspace.** No wallet or smart-contract work is required for the fullstack track.

---

## Getting Started

You need **Node.js 18+** and **npm**.

```bash
# 1. Clone the repo
git clone <repo-url>
cd <repo-name>
npm install

# 2. Set up environment variables (optional — defaults work for local dev)
cp .env.example .env

# 3. Start the app
npm run dev
# → http://localhost:3000
```

Verify the app loads and live data appears on `/markets` and `/trade/btc-usdt` (WebSocket connection to `/ws/markets`).

---

## Project Structure

Your work lives under `client/`:

```
client/
├── app/
│   ├── (dex)/              # App pages (home, markets, trade, …)
│   └── api/                # Next.js API routes
│       ├── health/
│       └── v1/
│           ├── config/
│           ├── markets/
│           ├── orders/
│           └── …
├── lib/                    # Server-side logic
│   ├── marketEngine.js     # Live market prices (Binance feed + broadcast)
│   ├── matchingEngine.js   # In-memory order book & matching
│   └── merge.js            # Price formatting helpers
├── server.js               # Custom server — HTTP + WebSocket at /ws/markets
└── src/
    ├── components/         # Reusable UI (charts, tables, panels)
    ├── context/            # React context (markets stream, favorites, paper trade)
    └── views/              # Page-level components
```

### Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS |
| API | Next.js Route Handlers (`app/api/`) |
| Real-time | WebSocket (`/ws/markets`) via `server.js` + `lib/marketEngine.js` |
| Data | In-memory matching engine with JSON file persistence |
| Charts | klinecharts / lightweight-charts |

### Key API endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /api/health` | Service health check |
| `GET /api/v1/config` | App name and runtime configuration |
| `GET /api/v1/dashboard/summary` | Aggregated dashboard metrics |
| `GET/POST /api/v1/ai/brief` | AI market brief from live desk metrics (`OPENAI_API_KEY` optional) |
| `GET /api/v1/markets` | Full markets overview |
| `GET /api/v1/markets/:id` | Single market detail (order book, trades) |
| `GET /api/v1/orders` | List orders (`?market_id=`, `?open_only=true`) |
| `POST /api/v1/orders` | Submit a limit or market order |
| `DELETE /api/v1/orders/:id` | Cancel an open order |
| `WS /ws/markets` | Live market snapshots and price ticks |

Environment variables are read from the repo-root `.env` (see `.env.example`). Only `PORT` is commonly changed for local dev.

---

## What the starter already includes

These are **done in this repo**. Full-stack candidates should treat them as the baseline and complete **[FULLSTACK_DEVELOPER.md](./FULLSTACK_DEVELOPER.md)** instead.

| Area | What you get |
|------|----------------|
| Dashboard | `/dashboard` + `GET /api/v1/dashboard/summary` (markets, volume, gainers/losers, open orders, feed status) |
| Markets | Connection badge, persisted sort/filter, HTTP poll when the WebSocket is down |
| Trade | Ticket submits to `POST /api/v1/orders`; open orders + cancel via the matching engine |
| Tests | `npm run test` covers matching engine + dashboard summary helpers |

### Paper trade layer

Order **submit / list / cancel** on the trade page is wired to the backend matching engine (`POST/GET/DELETE /api/v1/orders`). Validation errors return plain-text `400`/`404` bodies and are shown in the trade toast UI.

The localStorage `PaperTradeContext` layer was **kept for positions only** (legacy paper PnL in the Positions tab). New limit/market orders no longer write open orders into localStorage; they live in the server matching engine.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server on port 3000 (HTTP + WebSocket) |
| `npm run client:build` | Production build |
| `npm run start` | Start production server |
| `npm run test` | Run Node test runner against `client/lib/` helpers |

---

## Done when (starter)

A clean checkout should already satisfy:

- Dashboard overview page is live with summary metrics and connection status
- Markets page shows connection status, persisted preferences, and HTTP polling fallback
- Trade flow uses the backend order API (submit, list, cancel) with toast errors
- Tests cover at least one `client/lib/` module (happy path + error case)
- `npm install` → `npm run dev` works

Candidate take-homes have their own **Done when** checklists in `FULLSTACK_DEVELOPER.md`, `AI_ENGINEER.md`, and `BLOCKCHAIN_DEVELOPER.md`.
