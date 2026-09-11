/**
 * Carmlize AI market brief — LLM when OPENAI_API_KEY is set, else heuristic fallback.
 * Keeps the DX test runnable without external credentials.
 */

function fmtVol(n) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${Number(n || 0).toFixed(0)}`;
}

function lineMarket(m) {
  const sign = m.change_24h_pct >= 0 ? "+" : "";
  return `${m.pair}: ${sign}${m.change_24h_pct.toFixed(2)}% · vol ${fmtVol(m.volume_24h)} · last ${m.mark_price}`;
}

/**
 * Deterministic brief from live desk metrics (no API key required).
 * @param {any} summary
 * @param {string} [question]
 */
export function buildHeuristicBrief(summary, question) {
  const gainers = summary?.top_gainers ?? [];
  const losers = summary?.top_losers ?? [];
  const g0 = gainers[0];
  const l0 = losers[0];
  const feed = summary?.feed_connected ? "live upstream feed" : "simulated feed";

  const lines = [
    `Carmlize desk brief (${feed}).`,
    `Tracking ${summary?.active_markets ?? 0} markets with ${fmtVol(summary?.volume_24h_total ?? 0)} combined 24h volume and ${summary?.open_orders_count ?? 0} open orders.`,
  ];

  if (g0) {
    lines.push(
      `Opportunity signal: ${g0.pair} leads gainers at ${g0.change_24h_pct >= 0 ? "+" : ""}${g0.change_24h_pct.toFixed(2)}% — watch follow-through vs volume.`,
    );
  }
  if (l0) {
    lines.push(
      `Risk signal: ${l0.pair} leads losers at ${l0.change_24h_pct.toFixed(2)}% — check liquidity and avoid chasing dumps.`,
    );
  }
  if (gainers.length) {
    lines.push(`Top movers up: ${gainers.map((m) => m.pair).join(", ")}.`);
  }
  if (losers.length) {
    lines.push(`Top movers down: ${losers.map((m) => m.pair).join(", ")}.`);
  }

  lines.push(
    "AI note: this is a developer-experience test path that combines live market intelligence with AI-ready briefing. Set OPENAI_API_KEY for a model-generated brief.",
  );

  if (question && String(question).trim()) {
    lines.push(`Your question: “${String(question).trim()}”`);
    lines.push(
      "Heuristic answer: use gainers for opportunity context and losers for risk; confirm with order book depth on the Trade desk before acting.",
    );
  }

  return lines.join("\n");
}

function buildPrompt(summary, question) {
  const blocks = [
    "You are Carmlize, an AI crypto market intelligence assistant.",
    "Write a concise desk brief (6-10 short sentences) covering: overall tape, opportunity signals, risk signals, and one practical next step.",
    "Be factual from the data. Do not invent prices. No investment advice disclaimer spam — one short caution is enough.",
    "",
    `Active markets: ${summary.active_markets}`,
    `24h volume: ${fmtVol(summary.volume_24h_total)}`,
    `Open orders: ${summary.open_orders_count}`,
    `Feed connected: ${summary.feed_connected}`,
    "",
    "Top gainers:",
    ...(summary.top_gainers ?? []).map((m) => `- ${lineMarket(m)}`),
    "",
    "Top losers:",
    ...(summary.top_losers ?? []).map((m) => `- ${lineMarket(m)}`),
  ];
  if (question && String(question).trim()) {
    blocks.push("", `Analyst question: ${String(question).trim()}`);
  }
  return blocks.join("\n");
}

/**
 * @param {any} summary dashboard summary payload
 * @param {{ question?: string }} [opts]
 */
export async function generateMarketBrief(summary, opts = {}) {
  const question = opts.question ?? "";
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

  if (!apiKey) {
    return {
      brief: buildHeuristicBrief(summary, question),
      source: "heuristic",
      model: null,
    };
  }

  const prompt = buildPrompt(summary, question);
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      max_tokens: 450,
      messages: [
        {
          role: "system",
          content:
            "You help traders and developers understand crypto markets quickly. Keep output plain text paragraphs.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!r.ok) {
    const errText = await r.text().catch(() => "");
    // Fall back so the DX demo never hard-fails on AI outages.
    return {
      brief: `${buildHeuristicBrief(summary, question)}\n\n(LLM unavailable: HTTP ${r.status}${errText ? ` — ${errText.slice(0, 120)}` : ""})`,
      source: "heuristic_fallback",
      model,
    };
  }

  const data = await r.json();
  const brief = data?.choices?.[0]?.message?.content?.trim();
  if (!brief) {
    return {
      brief: buildHeuristicBrief(summary, question),
      source: "heuristic_fallback",
      model,
    };
  }

  return { brief, source: "openai", model };
}
