"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useMarketsStream } from "../context/MarketsStreamContext";

type CompactMarket = {
  id: string;
  pair: string;
  base: string;
  quote: string;
  mark_price: number;
  change_24h_pct: number;
  volume_24h: number;
};

type DashboardSummary = {
  active_markets: number;
  volume_24h_total: number;
  top_gainers: CompactMarket[];
  top_losers: CompactMarket[];
  open_orders_count: number;
  feed_connected: boolean;
  server_ts: number;
};

type AiBriefResponse = {
  brief: string;
  source: string;
  model: string | null;
  generated_at: number;
};

function fmtVol(n: number) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtPrice(n: number) {
  if (n < 0.000001) return n.toFixed(10);
  if (n < 0.01) return n.toFixed(8);
  if (n < 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function StatusDot(props: { label: string; tone: "ok" | "warn" | "bad" }) {
  const color = props.tone === "ok" ? "#3b82f6" : props.tone === "warn" ? "#e8b84a" : "#f07178";
  return (
    <span
      className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em]"
      style={{ color }}
    >
      <span
        className={props.tone === "ok" ? "dash-live-dot" : undefined}
        style={{
          width: 7,
          height: 7,
          borderRadius: 999,
          background: color,
          boxShadow: props.tone === "ok" ? `0 0 12px ${color}` : undefined,
        }}
      />
      {props.label}
    </span>
  );
}

function MetricTile(props: { label: string; value: string; hint?: string; delay: number }) {
  return (
    <div
      className="dash-rise relative overflow-hidden px-5 py-5"
      style={{
        animationDelay: `${props.delay}ms`,
        background: "linear-gradient(160deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.015) 100%)",
        border: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(59,130,246,0.55), transparent)" }}
      />
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/35">{props.label}</p>
      <p className="mt-3 font-display text-3xl font-semibold tracking-tight text-white">{props.value}</p>
      {props.hint ? <p className="mt-2 text-xs text-white/35">{props.hint}</p> : null}
    </div>
  );
}

function MoversTable(props: {
  title: string;
  accent: string;
  rows: CompactMarket[];
  empty: string;
}) {
  return (
    <section
      className="dash-rise overflow-hidden"
      style={{
        border: "1px solid rgba(255,255,255,0.07)",
        background: "rgba(8,12,18,0.72)",
      }}
    >
      <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
        <h2 className="font-display text-lg font-semibold tracking-tight text-white">{props.title}</h2>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: props.accent }} />
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {["Market", "Last", "24h", "Volume"].map((h) => (
              <th
                key={h}
                className={
                  h === "Market"
                    ? "px-5 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-white/30"
                    : "px-5 py-3 text-right font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-white/30"
                }
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {props.rows.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-5 py-12 text-center text-sm text-white/35">
                {props.empty}
              </td>
            </tr>
          ) : (
            props.rows.map((m, i) => {
              const pos = m.change_24h_pct >= 0;
              return (
                <tr
                  key={m.id}
                  className="dash-row border-t border-white/[0.04] transition-colors"
                  style={{ animationDelay: `${120 + i * 60}ms` }}
                >
                  <td className="px-5 py-3.5">
                    <Link href={`/trade/${m.id}`} className="group inline-flex items-baseline gap-0.5">
                      <span className="text-sm font-semibold text-white group-hover:text-[#3b82f6]">{m.base}</span>
                      <span className="text-sm text-white/30">/{m.quote}</span>
                    </Link>
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono text-sm tabular-nums text-white/85">
                    {fmtPrice(m.mark_price)}
                  </td>
                  <td
                    className="px-5 py-3.5 text-right font-mono text-sm font-semibold tabular-nums"
                    style={{ color: pos ? "#3b82f6" : "#f07178" }}
                  >
                    {pos ? "+" : ""}
                    {m.change_24h_pct.toFixed(2)}%
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono text-sm tabular-nums text-white/40">
                    {fmtVol(m.volume_24h)}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </section>
  );
}

export function DashboardPage() {
  const { connected, status } = useMarketsStream();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiBrief, setAiBrief] = useState<AiBriefResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/v1/dashboard/summary");
      if (!r.ok) {
        const text = await r.text();
        throw new Error(text || `HTTP ${r.status}`);
      }
      const data = (await r.json()) as DashboardSummary;
      setSummary(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(load, 5000);
    return () => window.clearInterval(id);
  }, [load]);

  const runAiBrief = useCallback(async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const r = await fetch("/api/v1/ai/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: aiQuestion.trim() || undefined,
          summary: summary ?? undefined,
        }),
      });
      if (!r.ok) {
        throw new Error((await r.text()) || `HTTP ${r.status}`);
      }
      setAiBrief((await r.json()) as AiBriefResponse);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "AI brief failed");
    } finally {
      setAiLoading(false);
    }
  }, [aiQuestion, summary]);

  let wsTone: "ok" | "warn" | "bad" = "bad";
  let wsLabel = "Stream down";
  if (status === "connected") {
    wsTone = "ok";
    wsLabel = "Stream live";
  } else if (status === "reconnecting") {
    wsTone = "warn";
    wsLabel = "Reconnecting";
  }

  const feedTone: "ok" | "warn" = summary?.feed_connected ? "ok" : "warn";
  const feedLabel = summary?.feed_connected ? "Feed online" : "Simulated feed";

  let linkValue = "Offline";
  if (connected) linkValue = "Online";
  else if (status === "reconnecting") linkValue = "Retry";

  return (
    <div className="relative min-h-screen overflow-hidden text-white" style={{ minHeight: "calc(100dvh - 3.25rem)" }}>
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 55% at 12% -10%, rgba(59,130,246,0.14), transparent 55%), radial-gradient(ellipse 60% 45% at 90% 10%, rgba(56,140,180,0.12), transparent 50%), linear-gradient(180deg, #071019 0%, #05080d 48%, #030507 100%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-35"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          maskImage: "linear-gradient(180deg, rgba(0,0,0,0.55), transparent 75%)",
        }}
      />

      <div className="relative mx-auto max-w-[1400px] px-5 pb-20 pt-10 sm:px-8">
        <header className="dash-rise mb-10 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#3b82f6]">
              Carmlize · AI market intelligence · Test build
            </p>
            <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Understand the market faster
            </h1>
            <p className="mt-3 max-w-xl text-base leading-relaxed text-white/45">
              This project is a test environment for developer experience. It combines AI with
              real-time market intelligence so engineers can build, wire, and evaluate how
              signals, desk metrics, and trade flows work together.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/trade/btc-usdt"
                className="inline-flex items-center justify-center bg-[#3b82f6] px-5 py-2.5 text-sm font-semibold text-[#0b1220] transition hover:brightness-110"
              >
                Open markets
              </Link>
              <Link
                href="/markets"
                className="inline-flex items-center justify-center border border-white/15 px-5 py-2.5 text-sm font-medium text-white/75 transition hover:border-white/30 hover:text-white"
              >
                Browse pairs
              </Link>
            </div>
          </div>
          <div className="flex flex-col items-start gap-3 lg:items-end">
            <StatusDot label={wsLabel} tone={wsTone} />
            {summary ? <StatusDot label={feedLabel} tone={feedTone} /> : null}
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/25">
              Refresh every 5s
            </p>
          </div>
        </header>

        {loading && !summary ? (
          <div className="border border-white/[0.07] px-4 py-16 text-center text-sm text-white/35">
            <span className="inline-flex items-center gap-2">
              <span className="dash-live-dot h-2 w-2 rounded-full bg-[#3b82f6]" />
              Syncing intelligence feed...
            </span>
          </div>
        ) : null}

        {error && !summary ? (
          <div
            className="px-4 py-12 text-center"
            style={{ border: "1px solid rgba(240,113,120,0.35)", background: "rgba(240,113,120,0.06)" }}
          >
            <p className="text-sm text-[#f07178]">{error}</p>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                void load();
              }}
              className="mt-4 bg-[#3b82f6] px-4 py-2 text-sm font-semibold text-[#0b1220]"
            >
              Retry
            </button>
          </div>
        ) : null}

        {summary ? (
          <>
            {error ? <p className="mb-4 text-xs text-[#e8b84a]">Last refresh failed: {error}</p> : null}

            <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MetricTile label="Tracked markets" value={String(summary.active_markets)} delay={40} />
              <MetricTile label="24h volume" value={fmtVol(summary.volume_24h_total)} delay={100} />
              <MetricTile label="Open orders" value={String(summary.open_orders_count)} delay={160} />
              <MetricTile
                label="Live link"
                value={linkValue}
                hint={connected ? "WebSocket attached" : "Polling fallback may be active"}
                delay={220}
              />
            </div>

            <section
              className="dash-rise mb-8 grid gap-4 border border-white/[0.07] p-5 md:grid-cols-3"
              style={{ background: "rgba(8,12,18,0.55)" }}
            >
              {[
                {
                  title: "Collect",
                  body: "Market ticks, order flow, and desk state in one live surface.",
                },
                {
                  title: "Combine AI",
                  body: "Use AI with live data to surface trends, risk, and opportunity signals.",
                },
                {
                  title: "Test DX",
                  body: "Built as a developer-experience test: wire APIs, streams, and UI end to end.",
                },
              ].map((item) => (
                <div key={item.title}>
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#3b82f6]">{item.title}</p>
                  <p className="mt-2 text-sm leading-relaxed text-white/50">{item.body}</p>
                </div>
              ))}
            </section>

            <section
              className="dash-rise mb-8 border border-white/[0.07] p-5"
              style={{ background: "rgba(8,12,18,0.72)" }}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#3b82f6]">AI brief</p>
                  <h2 className="mt-1 font-display text-lg font-semibold text-white">Market intelligence</h2>
                  <p className="mt-1 max-w-2xl text-sm text-white/45">
                    Combines live desk metrics with AI. Without OPENAI_API_KEY, a heuristic brief still runs for DX testing.
                  </p>
                </div>
                {aiBrief ? (
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/35">
                    source · {aiBrief.source}
                    {aiBrief.model ? ` · ${aiBrief.model}` : ""}
                  </span>
                ) : null}
              </div>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <input
                  value={aiQuestion}
                  onChange={(e) => setAiQuestion(e.target.value)}
                  placeholder="Optional: ask about risk, opportunity, or a pair…"
                  className="min-w-0 flex-1 border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#3b82f6]/60"
                />
                <button
                  type="button"
                  disabled={aiLoading}
                  onClick={() => void runAiBrief()}
                  className="bg-[#3b82f6] px-4 py-2 text-sm font-semibold text-[#0b1220] disabled:opacity-50"
                >
                  {aiLoading ? "Generating…" : "Generate AI brief"}
                </button>
              </div>

              {aiError ? <p className="mt-3 text-sm text-[#f07178]">{aiError}</p> : null}

              {aiBrief ? (
                <pre className="mt-4 whitespace-pre-wrap border border-white/[0.06] bg-black/25 p-4 font-sans text-sm leading-relaxed text-white/75">
                  {aiBrief.brief}
                </pre>
              ) : (
                <p className="mt-4 text-sm text-white/35">
                  Click generate to turn current gainers, losers, volume, and feed status into a short AI desk brief.
                </p>
              )}
            </section>

            {summary.active_markets === 0 ? (
              <div className="border border-white/[0.07] px-4 py-16 text-center text-sm text-white/35">
                No active markets yet.
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                <MoversTable
                  title="Opportunity signals"
                  accent="#3b82f6"
                  rows={summary.top_gainers}
                  empty="No gainers available."
                />
                <MoversTable
                  title="Risk signals"
                  accent="#f07178"
                  rows={summary.top_losers}
                  empty="No losers available."
                />
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
