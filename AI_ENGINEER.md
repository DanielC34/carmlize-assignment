# Carmlize — AI Engineer Take-Home

**Audience:** AI / ML engineers  
**Product:** Carmlize — AI-powered crypto market intelligence  
**Repo context:** This is a **test project for developer experience**. Your job is to combine **AI** with **live market intelligence** (REST + WebSocket desk data) in a way that is grounded, testable, and useful on the dashboard.

Full-stack UI/API work already exists under `client/`. You focus on the **AI intelligence layer**.

---

## Elevator pitch (what Carmlize is)

Carmlize helps users understand crypto markets faster by combining:

- real-time market data,
- desk / order-flow context,
- and AI that turns raw numbers into **signals and insights**.

Interview one-liner:

> “Carmlize is building an AI-powered crypto market intelligence platform. Our goal is to combine real-time market data, blockchain data, and AI to help users understand what is happening in the market and make better decisions faster.”

---

## What already exists (do not rebuild)

| Piece | Location |
|-------|----------|
| Dashboard summary API | `GET /api/v1/dashboard/summary` |
| Basic AI brief (heuristic + optional OpenAI) | `GET/POST /api/v1/ai/brief`, `client/lib/aiBrief.js` |
| Dashboard UI + brief panel | `/dashboard`, `client/src/views/DashboardPage.tsx` |
| Live markets WebSocket | `/ws/markets` |
| Matching / orders API | `/api/v1/orders` |

Starter brief works **without** an API key (heuristic). With `OPENAI_API_KEY`, it can call OpenAI.

Your task is to upgrade this from a simple text dump into a **proper AI engineer deliverable**.

---

## Your mission

Build Carmlize’s AI intelligence layer so that live desk metrics become:

1. **Structured signals** (scored opportunity / risk),
2. A **grounded brief** that cites those signals and metrics,
3. Optional **Q&A** that stays faithful to provided data,
4. **Evals + tests** so quality is measurable without a key and with a key.

Stay inside the `client/` workspace (Next.js route handlers + `client/lib/` + dashboard UI).

---

## Requirements

### 1) Structured signals API (required)

Add:

```http
POST /api/v1/ai/signals
Content-Type: application/json
```

**Behavior**

- Input (optional): `{ "summary": <dashboard summary> }`  
  If `summary` is omitted, build it from live engines (same pattern as brief).
- Output JSON:

```json
{
  "signals": [
    {
      "id": "string",
      "pair": "BTC-USDT",
      "market_id": "btc-usdt",
      "type": "opportunity" | "risk",
      "score": 0.0,
      "confidence": 0.0,
      "headline": "short title",
      "reason": "1-2 sentences grounded in metrics",
      "evidence": {
        "change_24h_pct": 1.2,
        "volume_24h": 1234567,
        "mark_price": 65000
      }
    }
  ],
  "source": "heuristic" | "openai" | "heuristic_fallback",
  "model": "gpt-4o-mini" | null,
  "generated_at": 1710000000
}
```

**Rules**

- `score` and `confidence` in `[0, 1]`.
- Reasons must reference real fields from the summary (no invented prices).
- Must work **without** `OPENAI_API_KEY` (deterministic heuristic ranking is fine).
- With a key, you may refine headlines/reasons via LLM, but **numbers must still come from evidence**.

### 2) Upgrade the AI brief (required)

Improve `POST /api/v1/ai/brief` (and/or compose it from signals):

- Brief should incorporate **signals** (not only top gainers/losers prose).
- Support optional `question` (already present).
- Return citations, e.g.:

```json
{
  "brief": "...",
  "citations": [
    { "market_id": "btc-usdt", "field": "change_24h_pct", "value": -1.9 }
  ],
  "signals_used": ["signal-id-1", "signal-id-2"],
  "source": "heuristic" | "openai" | "heuristic_fallback",
  "model": null,
  "generated_at": 1710000000
}
```

- Never invent metric values. If the model is unavailable, fall back cleanly.

### 3) Dashboard UX (required)

On `/dashboard`, upgrade the AI section beyond a single text box:

- **Signal cards** (opportunity vs risk), showing pair, score, headline, reason.
- Richer **brief panel** that shows source/model and citations or “evidence used”.
- Keep Carmlize blue theme; keep the “test / DX + combine AI” framing visible.
- Loading / empty / error states.

### 4) Grounding & safety (required)

- System prompt / heuristic logic must forbid hallucinated prices.
- Cap question length; reject or truncate oversized payloads with plain-text `400`.
- Do not return stack traces to the client.
- Log (server-side): source, model, latency_ms, prompt/version id (simple string is enough).

### 5) Tests & evals (required)

**Unit tests** (`npm run test`):

- Heuristic signals: known summary → expected top opportunity/risk pairs.
- Brief grounding: output mentions evidence pairs / does not invent a fake pair.
- No-key path: `source` is `heuristic` (or documented fallback).
- Invalid body → `400` behavior if you add validation helpers (or route-level tests if practical).

**Eval script** (add e.g. `npm run eval:ai` → `node client/scripts/evalAi.mjs` or similar):

- Small golden set (3–5 fixtures under `client/test/fixtures/ai/`).
- Checks such as:
  - JSON schema / required keys,
  - every `evidence.mark_price` equals the fixture summary,
  - latency for heuristic path under a soft threshold (e.g. &lt; 200ms).
- Print a short pass/fail summary (no heavy ML framework required).

### 6) Docs (required)

Update this file’s **Done when** checklist if you change scope, and document in the main `readme.md` or here:

- How to run with / without `OPENAI_API_KEY`
- New endpoints
- How to run `npm run test` and `npm run eval:ai`

---

## Non-goals

Do **not** spend time on:

- Autonomous trading agents or order placement by the model  
- Fine-tuning / hosting your own weights  
- Large news crawlers or embeddings infra (a tiny mocked headline list is OK if useful)  
- Blockchain / wallet / smart-contract work  
- Rebranding or unrelated dashboard refactors  

---

## Suggested approach

1. Implement `client/lib/aiSignals.js` (heuristic ranking from `change_24h_pct`, volume, etc.).
2. Add `POST /api/v1/ai/signals`.
3. Refactor brief generation to consume signals + citations.
4. Wire dashboard signal cards.
5. Add unit tests + a minimal eval script.
6. Optionally enhance LLM path (structured JSON from the model, validated against evidence).

---

## Environment

```bash
cp .env.example .env
npm install
npm run dev
# → http://localhost:3000/dashboard
```

---

## Do I need an OpenAI API key?

**No — not required to complete or pass this task.**

| Mode | When | What you must deliver |
|------|------|------------------------|
| **Heuristic (required)** | No `OPENAI_API_KEY` | Full signals API, grounded brief, dashboard UX, tests, eval |
| **LLM (optional bonus)** | `OPENAI_API_KEY` set | Same contracts; model may refine headlines/reasons; numbers still from evidence |

We score you primarily on **grounding, API design, fallback reliability, tests/evals, and UX**.  
A strong heuristic-only submission can fully satisfy **Done when**. Using OpenAI is a plus, not a gate.

```bash
# Optional only:
# OPENAI_API_KEY=sk-...
# OPENAI_MODEL=gpt-4o-mini
```

---

## 6-hour timeline

Plan for **6 hours** total. Stick to this order; skip polish until the path works end-to-end.

| Block | Time | Focus | Exit criteria |
|-------|------|--------|----------------|
| **0. Setup** | 0:00–0:20 | Clone, `npm install`, `npm run dev`, hit `/dashboard` and existing `/api/v1/ai/brief` | App runs; you understand current brief fallback |
| **1. Signals core** | 0:20–1:50 | `client/lib/aiSignals.js` + `POST /api/v1/ai/signals` (heuristic scoring + evidence) | Curl returns valid JSON signals with no API key |
| **2. Brief upgrade** | 1:50–3:00 | Wire brief to signals; add citations / `signals_used`; keep no-key fallback | Brief response includes citations; still works without key |
| **3. Dashboard UI** | 3:00–4:20 | Signal cards + richer brief panel (loading / empty / error) | `/dashboard` shows signals + generate brief flow |
| **4. Tests & eval** | 4:20–5:30 | Unit tests + `npm run eval:ai` + 3–5 fixtures | `npm run test` and eval script pass |
| **5. Docs & demo** | 5:30–6:00 | Update docs, note design choices, optional OpenAI path if time | PR-ready checklist complete |

**If you run behind:** ship heuristic signals + citations + UI + tests first. Skip LLM polish and extras (news, embeddings, agents).

**If you finish early:** add OpenAI structured JSON (validated against evidence), latency logging, or one golden eval for the LLM path.

---

## Done when

- [ ] `POST /api/v1/ai/signals` returns scored, grounded signals
- [ ] AI brief uses signals + citations / evidence; optional question supported
- [ ] Dashboard shows signal cards + improved brief panel (loading/empty/error)
- [ ] Works without API key; uses LLM when key is present *(LLM optional)*
- [ ] `npm run test` covers AI happy path + at least one failure/edge case
- [ ] `npm run eval:ai` (or equivalent) runs a small faithfulness/schema eval
- [ ] README / this doc explains how to run AI features

---

## How we evaluate you

| Area | What “good” looks like |
|------|-------------------------|
| Grounding | No fake prices; evidence matches summary |
| API design | Clear JSON contracts, consistent errors |
| AI quality | Useful signals + readable brief, not generic fluff |
| DX / reliability | Heuristic fallback, logs, no crash without key |
| Tests & evals | Automated checks you’d trust in CI |
| Product sense | Feels like market intelligence, not a chatbot toy |

---

## Time box

**Fixed budget: 6 hours** (see timeline above). Depth beats breadth: one solid signals → brief → UI → eval path beats many half-wired ideas.

---

## Deliverable

Open a PR (or push a branch) with:

1. Code + tests + eval script  
2. Short notes in the PR / this file: design choices, prompt/heuristic version, known limitations  
3. Screenshots or a short clip of `/dashboard` AI section if possible  
