# Carmlize — Blockchain Developer Take-Home

**Audience:** Blockchain / on-chain engineers 
**Product:** Carmlize — AI-powered crypto market intelligence  
**Repo context:** This is a **test project for developer experience**. Your job is to add an **on-chain intelligence layer** (read + analyze blockchain data) that sits next to live desk metrics — grounded, testable, and useful on the dashboard.

Full-stack UI/API work already exists under `client/`. You focus on **reading the chain and turning it into market context**. Carmlize has **no platform token** and no mint/swap product; do not build one.

---

## Elevator pitch (what Carmlize is)

Carmlize helps users understand crypto markets faster by combining:

- real-time market data,
- desk / order-flow context,
- **blockchain data** (transfers, gas, chain health),
- and AI that turns raw numbers into signals and insights.

Interview one-liner:

> “Carmlize is building an AI-powered crypto market intelligence platform. Our goal is to combine real-time market data, blockchain data, and AI to help users understand what is happening in the market and make better decisions faster.”

---

## What already exists (do not rebuild)

| Piece | Location |
|-------|----------|
| App config (`CHAIN_ID`, `RPC_URL`) | `GET /api/v1/config`, `client/lib/config.js`, `.env.example` |
| Dashboard summary API | `GET /api/v1/dashboard/summary` |
| Dashboard UI | `/dashboard`, `client/src/views/DashboardPage.tsx` |
| Live markets WebSocket | `/ws/markets`, `client/lib/marketEngine.js` |
| Wallet connect (EIP-1193 / viem) | `client/src/wallet/`, `WalletBar` |
| `viem` dependency | repo-root `package.json` |

Wallet connect is already wired for the paper-trade desk. You may **read** a connected address (balances) if you have time. You must **not** send transactions, deploy contracts, or add approve/swap/mint UI.

---

## Your mission

Build Carmlize’s on-chain intelligence layer so that Ethereum (or the configured chain) becomes:

1. A **chain snapshot** (block, gas, RPC health) the dashboard can trust,
2. **Asset activity** mapped to existing desk pairs (`eth-usdt`, `btc-usdt`, `link-usdt`, …),
3. A **recent large-transfer feed** grounded in real (or fixture) logs,
4. **Tests + a fixture path** so the task is completable **without a live RPC**.

Stay inside the `client/` workspace (Next.js route handlers + `client/lib/` + dashboard UI).

---

## Requirements

### 1) Token registry (required)

Add a small mapping from **desk markets → on-chain assets** (Ethereum mainnet addresses by default). Cover **at least 6** of the seeded pairs in `client/lib/marketEngine.js`, including:

| `market_id` | On-chain asset | Notes |
|-------------|----------------|--------|
| `eth-usdt` | WETH | `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` |
| `btc-usdt` | WBTC | `0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599` |
| `link-usdt` | LINK | well-known ERC-20 |
| `uni-usdt` | UNI | well-known ERC-20 |
| `aave-usdt` | AAVE | well-known ERC-20 |
| plus ≥1 more | your choice | e.g. USDT, LDO, CRV, SNX |

Store this in something like `client/lib/onchainTokens.js` (addresses, decimals, symbol). Native ETH may be represented as WETH for Transfer logs.

Unknown `market_id` → skip or `404`; do not invent addresses.

### 2) On-chain overview API (required)

Add:

```http
GET /api/v1/onchain/overview
```

**Output JSON:**

```json
{
  "chain_id": 1,
  "block_number": 21000000,
  "gas_gwei": 12.4,
  "rpc_healthy": true,
  "assets": [
    {
      "market_id": "eth-usdt",
      "symbol": "WETH",
      "token": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      "decimals": 18,
      "transfer_count": 42,
      "transfer_volume_raw": "123450000000000000000",
      "large_transfer_count": 3,
      "lookback_blocks": 200
    }
  ],
  "source": "fixture" | "rpc" | "fixture_fallback",
  "generated_at": 1710000000
}
```

**Rules**

- Must work **without** `RPC_URL` using checked-in fixtures (`source: "fixture"`).
- With `RPC_URL`, prefer live reads via **viem** (`getBlockNumber`, gas price, `getLogs` for `Transfer`). Keep the lookback **small** (e.g. 100–500 blocks) so public RPCs do not rate-limit you to death.
- If RPC fails, fall back to fixtures (`source: "fixture_fallback"`). Do not crash the dashboard.
- `transfer_volume_raw` is a **string** (uint256). Never silently lose precision in JSON numbers.
- Log (server-side): source, chain_id, latency_ms, block_number.

### 3) Large-transfer activity API (required)

Add:

```http
GET /api/v1/onchain/activity?market_id=eth-usdt
```

- `market_id` optional: omit → activity across the registered token set (cap the list, e.g. 25 events).
- Invalid `market_id` that is not in the registry → plain-text `400` or `404`.
- Output JSON:

```json
{
  "market_id": "eth-usdt",
  "events": [
    {
      "tx_hash": "0x…",
      "block_number": 21000000,
      "token": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      "symbol": "WETH",
      "from": "0x…",
      "to": "0x…",
      "value_raw": "5000000000000000000",
      "value_formatted": "5",
      "log_index": 12
    }
  ],
  "source": "fixture" | "rpc" | "fixture_fallback",
  "generated_at": 1710000000
}
```

**Large transfer:** define a clear threshold per token (e.g. ≥ 10 WETH, ≥ 0.5 WBTC, or a USD-ish cutoff documented in code). Filter in the helper, not only in the UI.

### 4) Dashboard UX (required)

On `/dashboard`, add an **On-chain intelligence** section (same Carmlize blue theme, keep the test / DX framing visible):

- Chain status: chain id, latest block, gas (gwei), RPC healthy vs fixture.
- Compact **asset activity** table (symbol, transfer count, large-transfer count) linking to `/trade/{market_id}` where possible.
- Recent large transfers (from, to truncated, amount, tx hash as etherscan-style link for chain id 1).
- Loading / empty / error states.
- Visible `source` badge (`fixture` / `rpc` / `fixture_fallback`).

Do not hide the existing AI brief or movers tables.

### 5) Reliability & safety (required)

- Read-only: **no** `eth_sendTransaction`, **no** contract deploys, **no** writes.
- Time out RPC calls (e.g. 8s) and fall back to fixtures.
- Do not return stack traces to the client. Plain-text `400`/`404`; JSON success bodies.
- Treat addresses as untrusted input: validate `0x` + 40 hex if you add a wallet-balance route.
- Do not log private keys. There should be none in this task.

### 6) Tests (required)

**Unit tests** (`npm run test`):

- Token registry: known `market_id` → expected address/decimals; unknown id is rejected.
- Overview from a fixture: expected `source`, asset count, `transfer_volume_raw` stays a string.
- Activity filter: fixture logs → only events above your large-transfer threshold.
- RPC-down path: mocked failing client → `fixture_fallback` (or documented equivalent).
- Invalid `market_id` → `400`/`404` behavior (helper or route-level).

Ship fixtures under e.g. `client/test/fixtures/onchain/` (overview + a handful of Transfer-shaped logs). Tests must pass **offline** with no RPC.

### 7) Docs (required)

Update this file’s **Done when** checklist if you change scope, and document in the main `readme.md` or here:

- How to run with / without `RPC_URL`
- New endpoints
- Token list + large-transfer thresholds
- How to run `npm run test`

---

## Optional bonus (only if the required path is done)

Pick **one**:

- **Wallet read:** `GET /api/v1/onchain/wallet/:address` returns native balance + registered ERC-20 balances (viem `getBalance` / `readContract`). Show it on the dashboard when a wallet is connected (existing `WalletContext`). Still no signing.
- **Desk vs chain:** join overview assets with `GET /api/v1/dashboard/summary` and show a simple “desk 24h volume vs on-chain transfer count” hint per pair.
- **Multi-chain note:** if `CHAIN_ID` is not 1, either document “fixtures only” or swap in a minimal Sepolia registry — do not silently use mainnet addresses on the wrong chain.

---

## Non-goals

Do **not** spend time on:

- Solidity, Hardhat, Foundry, or deploying any contract  
- A Carmlize (or any) ERC-20, mint, burn, or airdrop  
- DEX / swap / liquidity / permit / approve flows  
- Indexer infra (The Graph, custom node, Kafka) — viem + a short `getLogs` window is enough  
- Bridging, L2 sequencers, or MEV searchers  
- Replacing wallet connect or the matching engine  
- AI / OpenAI work (see `AI_ENGINEER.md` if that is your track)  
- Rebranding or unrelated dashboard refactors  

---

## Suggested approach

1. `client/lib/onchainTokens.js` — registry + threshold helpers.
2. `client/lib/onchain.js` — `loadFixtureOverview` / `loadFixtureActivity` + optional `fetchFromRpc` (viem public client).
3. `GET /api/v1/onchain/overview` and `GET /api/v1/onchain/activity`.
4. Dashboard on-chain panel (status + table + recent whales).
5. Unit tests against fixtures; mock RPC failure for fallback.
6. Optional wallet-balance route if time remains.

---

## Environment

```bash
cp .env.example .env
npm install
npm run dev
# → http://localhost:3000/dashboard
```

```bash
# Optional live reads (Ethereum mainnet by default):
# CHAIN_ID=1
# RPC_URL=https://ethereum.publicnode.com
```

A public RPC is enough. Do not commit API keys or paid-RPC secrets.

---

## Do I need a live RPC?

**No — not required to complete or pass this task.**

| Mode | When | What you must deliver |
|------|------|------------------------|
| **Fixture (required)** | No `RPC_URL` or RPC unused | Full overview + activity APIs, dashboard UX, tests |
| **RPC (optional bonus)** | `RPC_URL` set | Same JSON contracts; live block/gas/`Transfer` logs; fixture fallback on failure |

We score you primarily on **read-path design, mapping desk pairs to tokens, fallback reliability, tests, and UX**.  
A strong fixture-only submission can fully satisfy **Done when**. Live RPC is a plus, not a gate.

---

## 6-hour timeline

Plan for **6 hours** total. Stick to this order; skip polish until the path works end-to-end.

| Block | Time | Focus | Exit criteria |
|-------|------|--------|----------------|
| **0. Setup** | 0:00–0:20 | Clone, `npm install`, `npm run dev`, hit `/dashboard` and `/api/v1/config` | App runs; you see `chain_id` / empty `rpc_url` |
| **1. Registry + fixtures** | 0:20–1:20 | Token map, fixture JSON, parse/normalize helpers | Known market → address; fixtures load in Node |
| **2. Overview API** | 1:20–2:40 | `GET /api/v1/onchain/overview` (fixture first) | Curl returns valid JSON with `source: "fixture"` |
| **3. Activity API** | 2:40–3:40 | `GET /api/v1/onchain/activity` + large-transfer filter | Curl lists capped, thresholded events |
| **4. Dashboard UI** | 3:40–4:50 | On-chain panel (status, assets, recent transfers) | `/dashboard` shows chain context without RPC |
| **5. Tests & docs** | 4:50–6:00 | Unit tests + README notes; optional RPC path if time | `npm run test` passes; checklist complete |

**If you run behind:** ship fixture overview + activity + UI + tests first. Skip live `getLogs` and wallet balances.

**If you finish early:** add viem RPC path with timeout + fallback, then one optional bonus.

---

## Done when

- [ ] Token registry maps ≥6 desk pairs to checksummed addresses + decimals
- [ ] `GET /api/v1/onchain/overview` returns chain snapshot + per-asset activity
- [ ] `GET /api/v1/onchain/activity` returns thresholded transfers (string amounts)
- [ ] Dashboard shows on-chain panel with loading / empty / error and a `source` badge
- [ ] Works without `RPC_URL`; uses RPC when set and falls back on failure *(RPC optional)*
- [ ] `npm run test` covers registry, fixture happy path, threshold filter, and one failure/fallback case
- [ ] README / this doc explains how to run on-chain features

---

## How we evaluate you

| Area | What “good” looks like |
|------|-------------------------|
| On-chain literacy | Correct ERC-20 `Transfer` handling, decimals, uint256-as-string |
| Mapping | Desk pairs ↔ tokens is explicit and documented |
| API design | Clear JSON contracts, consistent errors |
| Reliability | Fixture path + RPC timeout/fallback; no crash without RPC |
| Tests | Automated checks you’d trust in CI (offline) |
| Product sense | Feels like market intelligence, not a block explorer clone |
| Scope control | Reads only — no contracts, tokens, or swaps |

---

## Time box

**Fixed budget: 6 hours** (see timeline above). Depth beats breadth: one solid registry → overview → activity → UI → tests path beats a half-wired indexer.

---

## Deliverable

Open a PR (or push a branch) with:

1. Code + tests + fixtures  
2. Short notes in the PR / this file: design choices (lookback, thresholds), known RPC limitations  
3. Screenshot of `/dashboard` on-chain section if possible  
