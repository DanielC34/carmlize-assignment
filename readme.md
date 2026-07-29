# ZyncSwap — Frontend & Backend Tasks

ZyncSwap is a trading dashboard for monitoring live crypto markets, placing paper orders, and reviewing order-book activity. This repository is a **Next.js full-stack app** — React UI, REST API routes, a custom WebSocket server, and server-side business logic in `client/lib/`.

**Scope is limited to the `client/` workspace.** Build and wire dashboard features across the frontend and backend. No blockchain, wallet, or smart-contract work is required.

Focus on end-to-end flows, API design, real-time data UX, and test coverage.

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
| `GET /api/v1/markets` | Full markets overview |
| `GET /api/v1/markets/:id` | Single market detail (order book, trades) |
| `GET /api/v1/orders` | List orders (`?market_id=`, `?open_only=true`) |
| `POST /api/v1/orders` | Submit a limit or market order |
| `DELETE /api/v1/orders/:id` | Cancel an open order |
| `WS /ws/markets` | Live market snapshots and price ticks |

Environment variables are read from the repo-root `.env` (see `.env.example`). Only `PORT` is commonly changed for local dev.

---

## Tasks

### Task 1 — Dashboard Overview Page

Create a new dashboard route (e.g. `/dashboard`) that gives operators an at-a-glance view of the platform.

**Backend:** Add `GET /api/v1/dashboard/summary` (or extend an existing route) returning aggregated metrics, such as:

- Total number of active markets
- Combined 24h volume across all markets
- Top 3 gainers and top 3 losers by `change_24h_pct`
- Count of open orders (from the matching engine)
- WebSocket / data-feed status (connected or not)

**Frontend:** Build the dashboard page with summary cards, a compact gainers/losers table, and a live connection indicator. Use the existing dark theme and typography from `/markets`.

Handle loading, empty, and error states.

---

### Task 2 — Markets Monitor Enhancements

`MarketsPage` already shows a sortable, searchable market table fed by the WebSocket stream. Improve it for dashboard use:

- Add a visible **connection status** badge (connected / reconnecting / disconnected) using `MarketsStreamContext`
- Persist the user's **sort and filter preferences** in `localStorage` so they survive page reloads
- Add a **refresh fallback**: if the WebSocket is down, poll `GET /api/v1/markets` every few seconds so the table still updates
- Show a clear empty state when no markets match the search query

Keep the UI consistent with the existing table design.

---

### Task 3 — Orders Management Panel

`TradeEntryPanel` currently stores orders in `PaperTradeContext` (browser `localStorage` only). The server already exposes a full order API via `lib/matchingEngine.js`.

Wire the trade flow to the backend:

- On limit/market submit, `POST /api/v1/orders` with `{ market_id, side, order_type, size, price? }`
- Load open orders via `GET /api/v1/orders?market_id=…&open_only=true` and display them in the orders tab on the trade page
- Allow cancelling an open order with `DELETE /api/v1/orders/:id`
- Surface API validation errors (400/404) in the existing toast UI
- Refresh the order list after submit or cancel

Document in the README whether you kept, removed, or migrated the localStorage paper-trade layer.

---

### Task 4 — API Tests & Error Handling

**Tests:** Add automated tests for at least one server module in `client/lib/` (e.g. `matchingEngine.js`, `merge.js`, or a new dashboard summary helper). Use Node's built-in test runner or a framework of your choice. Cover:

- Happy path (e.g. submit and list an order, or format a price correctly)
- At least one validation/error case (e.g. invalid size, unknown market, cancel non-existent order)

**Error handling:** Review one API route you touched and ensure consistent error responses — plain-text `400`/`404` messages for bad input, `JSON` for successful payloads. Do not return stack traces to the client.

Add an `npm run test` script at the repo root if one does not exist.

---

## Implementation notes

### Paper trade layer (Task 3)

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

## Done When

- Dashboard overview page is live with summary metrics and connection status
- Markets page shows connection status, persisted preferences, and HTTP polling fallback
- Trade flow uses the backend order API (submit, list, cancel) with toast errors
- Tests cover at least one `client/lib/` module (happy path + error case)
- `npm install` → `npm run dev` works on a clean checkout
