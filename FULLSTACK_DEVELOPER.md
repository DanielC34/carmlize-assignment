# Carmlize — Full-Stack Developer Take-Home

**Audience:** Full-stack engineers (Next.js / React + API)  
**Product:** Carmlize — AI-powered crypto market intelligence  
**Repo context:** This is a **test project for developer experience**. Your job is to add a **desk operations layer** — orders, fills, and alerts that operators can actually use — wired end to end (API + UI + tests).

Dashboard, live markets, and the trade ticket already exist under `client/`. You **do not** rebuild those. You extend them into a coherent operator workflow.

---

## Elevator pitch (what Carmlize is)

Carmlize helps users understand crypto markets faster by combining:

- real-time market data,
- desk / order-flow context,
- blockchain data,
- and AI that turns raw numbers into signals and insights.

Interview one-liner:

> “Carmlize is building an AI-powered crypto market intelligence platform. Our goal is to combine real-time market data, blockchain data, and AI to help users understand what is happening in the market and make better decisions faster.”

---

## What already exists (do not rebuild)

| Piece | Location |
|-------|----------|
| Dashboard summary + UI | `GET /api/v1/dashboard/summary`, `/dashboard` |
| Live markets table + WS | `/markets`, `/ws/markets`, `MarketsStreamContext` |
| HTTP poll fallback when WS is down | `MarketsPage` |
| Trade ticket → matching engine | `POST/GET/DELETE /api/v1/orders`, `TradeEntryPanel` |
| Market detail (book + trades merge) | `GET /api/v1/markets/:id` |
| Matching engine (in-memory + JSON file) | `client/lib/matchingEngine.js` |
| Starter tests | `npm run test` → `client/test/*.test.js` |

Wallet connect is required by the existing trade ticket. You do not need to change wallet code. No Solidity, no RPC work, no AI/LLM work (those are other tracks).

---

## Your mission

Build Carmlize’s **operator desk** so that live markets and the matching engine become:

1. A **cross-market order blotter** (filter, inspect, cancel),
2. A **fills / trade tape** (what actually matched),
3. **Price alerts** evaluated against live mark prices,
4. **Dashboard + nav** so this is visible without living only on `/trade/:id`,
5. **Tests** for the new helpers and failure cases.

Stay inside the `client/` workspace (Next.js route handlers + `client/lib/` + React views).

---

## Requirements

### 1) Richer orders list API (required)

`GET /api/v1/orders` already supports `market_id` and `open_only`. Extend it (keep those params working) with:

| Query | Behavior |
|-------|----------|
| `status` | `open` \| `partially_filled` \| `filled` \| `cancelled` (optional) |
| `side` | `buy` \| `sell` (optional) |
| `limit` | max rows, default **50**, cap **200** |

**Rules**

- Invalid `status` / `side` / non-numeric `limit` → plain-text `400`.
- Newest first (`created_at` descending) unless you document another sort and stick to it.
- Response stays JSON: `{ "orders": [ ... ] }` using the existing order shape (`id`, `market_id`, `side`, `order_type`, `price`, `size`, `size_remaining`, `status`, `created_at`).
- Put filtering in `client/lib/` (extend `listOrders` or add `queryOrders`) so it is unit-testable without HTTP.

### 2) Fills tape API (required)

Add:

```http
GET /api/v1/trades?market_id=btc-usdt&limit=50
```

- `market_id` optional (omit → all markets).
- `limit` default 50, cap 200.
- Unknown `market_id` → plain-text `404`.
- Output JSON:

```json
{
  "trades": [
    {
      "id": 1,
      "market_id": "btc-usdt",
      "price": "64000.00",
      "size": "0.10000000",
      "taker_side": "buy",
      "maker_order_id": "…",
      "taker_order_id": "…",
      "ts": 1710000000
    }
  ]
}
```

Use `matchingEngine` trades (see `recentTrades`). You will likely need a **global** recent-trades helper (today `recentTrades` is per-market). Newest first.

### 3) Price alerts API (required)

Persist alerts in a JSON file (same idea as the matching engine file), e.g. `client/lib/priceAlerts.js`.

```http
GET    /api/v1/alerts
POST   /api/v1/alerts
DELETE /api/v1/alerts/:id
```

**POST body**

```json
{
  "market_id": "btc-usdt",
  "direction": "above" | "below",
  "price": 65000
}
```

**Stored / GET shape**

```json
{
  "alerts": [
    {
      "id": "uuid",
      "market_id": "btc-usdt",
      "direction": "above",
      "price": 65000,
      "status": "active" | "triggered",
      "created_at": 1710000000,
      "triggered_at": null,
      "triggered_price": null
    }
  ]
}
```

**Rules**

- Validate `market_id` against the live market engine (`404` if unknown).
- `price` must be a finite number `> 0` (`400` otherwise).
- `direction` must be `above` or `below`.
- On each `GET /api/v1/alerts` (and/or a small evaluate helper used by dashboard), compare **active** alerts to current `mark_price`. If crossed, set `status: "triggered"`, `triggered_at`, `triggered_price`, and persist.
- Do not fire alerts in a busy loop on every WS tick unless you debounce; evaluating on GET / dashboard poll is enough.
- `DELETE` unknown id → plain-text `404`; invalid id → `400`.
- No stack traces to the client.

### 4) Operator blotter UI (required)

Add a page at **`/orders`** (or `/desk`) and a nav link in `AppShell` (next to Intelligence / Markets / Trade).

The page must include:

- **Filters:** market (select or search), status, side. Reflect query params or controlled state; either is fine.
- **Orders table** from the extended list API. Show pair, side, type, price, size remaining, status, time. Cancel still-open orders (`DELETE /api/v1/orders/:id`) with a confirm or obvious button; surface `400`/`404` text.
- **Fills tape** from `GET /api/v1/trades` (latest fills, with pair + taker side + price + size).
- **Alerts panel:** list alerts, create one (market + above/below + price), delete; show triggered vs active.
- Loading / empty / error states. Keep the Carmlize blue dark theme. Keep the “test / DX” framing visible.

Empty blotter is expected on a fresh checkout — that is a valid empty state, not a bug. You can place a couple of orders on `/trade/btc-usdt` while demoing.

### 5) Dashboard wiring (required)

On `/dashboard`, add a compact **Desk** strip (do not remove AI brief or movers):

- Open orders count (already in summary — you may reuse it).
- Last **5** fills (pair, side, price, time) with a link to `/orders`.
- Triggered alerts count (and/or the latest triggered alert headline).

Handle loading / empty / error for this strip independently if the new endpoints fail.

Optional but nice: include `open_orders_count` / last fill time in `GET /api/v1/dashboard/summary` instead of extra client fan-out. If you extend summary, keep existing fields so you do not break the current dashboard.

### 6) Tests (required)

`npm run test` must cover the **new** logic (add files under `client/test/`):

- `queryOrders` (or equivalent): status/side filters, limit cap, invalid status rejected.
- Trades helper: newest-first, market filter, unknown market.
- Alerts: create → evaluate above/below against a fake `mark_price` → triggered; delete missing id fails.
- At least one API validation case (bad POST body or bad query) if you test routes; otherwise helper-level validation is enough.

Happy path + at least one failure/edge case per new module.

### 7) Docs (required)

Update this file’s **Done when** checklist if you change scope, and document in `readme.md` or here:

- New routes and query params
- Where alert JSON is stored (and that it is local-dev only)
- How to demo: place orders on Trade, then inspect `/orders` and dashboard

---

## Optional bonus (only if the required path is done)

Pick **one**:

- **Bulk cancel:** `POST /api/v1/orders/cancel-all` with optional `market_id`; confirm in the blotter UI.
- **Query-string deep links:** `/orders?market_id=eth-usdt&status=open` hydrates filters.
- **Live blotter:** poll every few seconds **or** subscribe to `/ws/markets` and refetch trades when ticks arrive (no need for a new WS protocol).

---

## Non-goals

Do **not** spend time on:

- AI / OpenAI / signals / evals (`AI_ENGINEER.md`)  
- RPC, Solidity, token registries, wallet balances (`BLOCKCHAIN_DEVELOPER.md`)  
- Replacing the matching engine or Binance feed  
- Auth, users, or multi-tenant isolation  
- Production databases (Postgres, Redis) — JSON file is the intended persistence  
- Rebranding or a visual redesign of Markets / Trade  

---

## Suggested approach

1. Extend `listOrders` / add `queryOrders` + tests.  
2. Add `listTrades` (global) + `GET /api/v1/trades`.  
3. Implement `priceAlerts.js` (CRUD + `evaluateAlerts(overview)`).  
4. Build `/orders` (filters, tables, alerts form).  
5. Wire a desk strip on `/dashboard` + nav link.  
6. Docs + a quick demo path (submit two orders, trigger one alert).

---

## Environment

```bash
cp .env.example .env
npm install
npm run dev
# → http://localhost:3000/dashboard
# → http://localhost:3000/trade/btc-usdt
# → http://localhost:3000/orders   (your new page)
```

No extra API keys. Matching-engine data lives in a local JSON file (see `client/lib/engines.js`). Alerts should follow the same pattern.

---

## Do I need a wallet or OpenAI key?

**No extra credentials are required to pass this task.**

| Need | Required? |
|------|-----------|
| Node 18+ / `npm run dev` | Yes |
| Browser wallet | Only to click the existing Trade ticket (already in the starter) |
| `OPENAI_API_KEY` | No |
| `RPC_URL` | No |

We score you on **API design, end-to-end UX, realtime-aware empty/error states, and tests**. Depth on blotter + alerts beats extra pages.

---

## 6-hour timeline

Plan for **6 hours** total. Stick to this order; skip polish until the path works end-to-end.

| Block | Time | Focus | Exit criteria |
|-------|------|--------|----------------|
| **0. Setup** | 0:00–0:20 | Clone, `npm run dev`, click dashboard / markets / trade, `curl` existing orders API | You know what is already wired |
| **1. Orders query** | 0:20–1:20 | Filter helper + `GET /api/v1/orders` query params + tests | Curl with `status` / `side` / `limit` works |
| **2. Trades API** | 1:20–2:10 | Global recent trades + `GET /api/v1/trades` | Curl returns newest fills (empty OK) |
| **3. Alerts** | 2:10–3:30 | JSON store, POST/GET/DELETE, evaluate vs mark price | Curl create + GET shows `triggered` when price crossed |
| **4. Blotter UI** | 3:30–4:50 | `/orders` + nav: tables, filters, cancel, alerts form | Page usable with loading/empty/error |
| **5. Dashboard + docs** | 4:50–6:00 | Desk strip, tests, README notes | Checklist complete; `npm run test` green |

**If you run behind:** ship filtered orders + trades API + `/orders` table + tests. Alerts can be GET/POST only without fancy UI.

**If you finish early:** query-string filters, bulk cancel, or dashboard summary extension.

---

## Done when

- [ ] `GET /api/v1/orders` supports `status`, `side`, `limit` with consistent `400`s
- [ ] `GET /api/v1/trades` returns a newest-first fills tape
- [ ] Alerts CRUD + evaluate-on-read against live `mark_price`
- [ ] `/orders` blotter: filters, orders, fills, alerts, cancel; loading/empty/error
- [ ] `/dashboard` shows a desk strip (fills + alerts) with a nav link to the blotter
- [ ] `npm run test` covers new helpers (happy path + failure/edge)
- [ ] README / this doc explains new endpoints and how to demo

---

## How we evaluate you

| Area | What “good” looks like |
|------|-------------------------|
| API design | Clear query contracts, plain-text errors, JSON success |
| End-to-end | Trade ticket → blotter → dashboard stay in sync |
| UX | Filters, empty states, visible errors, theme consistency |
| Data | Newest-first, limits capped, unknown market handled |
| Tests | Checks you’d keep in CI |
| Scope control | Desk ops only — no AI, chain, or rewrite of Markets/Trade |

---

## Time box

**Fixed budget: 6 hours** (see timeline above). One solid orders → fills → alerts → UI → tests path beats five half-wired extras.

---

## Deliverable

Open a PR (or push a branch) with:

1. Code + tests  
2. Short notes in the PR / this file: persistence path, how alerts are evaluated, known limits  
3. Screenshots of `/orders` and the dashboard desk strip if possible  
