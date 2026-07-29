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

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: "ok" | "warn" | "bad";
}) {
  const color = tone === "ok" ? "#3dffa0" : tone === "warn" ? "#fbbf24" : "#ef5350";
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold"
      style={{ background: `${color}1a`, color, border: `1px solid ${color}33` }}
    >
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function MarketRows({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: CompactMarket[];
  empty: string;
}) {
  return (
    <div
      className="overflow-hidden rounded-2xl"
      style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}
    >
      <div className="border-b border-white/[0.06] px-4 py-3 text-sm font-semibold text-white/80">
        {title}
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr style={{ background: "rgba(255,255,255,0.02)" }}>
            {["Market", "Price", "24h %", "Volume"].map((h) => (
              <th
                key={h}
                className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider ${
                  h === "Market" ? "text-left" : "text-right"
                }`}
                style={{ color: "rgba(255,255,255,0.4)" }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-8 text-center text-sm text-white/35">
                {empty}
              </td>
            </tr>
          )}
          {rows.map((m) => {
            const pos = m.change_24h_pct >= 0;
            return (
              <tr key={m.id} className="border-t border-white/[0.04]">
                <td className="px-4 py-3 text-sm font-semibold text-white">
                  <Link href={`/trade/${m.id}`} className="hover:text-[#3dffa0]">
                    {m.base}
                    <span className="font-normal text-white/40">/{m.quote}</span>
                  </Link>
                </td>
                <td className="px-4 py-3 text-right font-mono text-sm text-white/85">
                  {fmtPrice(m.mark_price)}
                </td>
                <td
                  className="px-4 py-3 text-right font-mono text-sm font-semibold"
                  style={{ color: pos ? "#3dffa0" : "#ef5350" }}
                >
                  {pos ? "+" : ""}
                  {m.change_24h_pct.toFixed(2)}%
                </td>
                <td className="px-4 py-3 text-right font-mono text-sm text-white/55">
                  {fmtVol(m.volume_24h)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function DashboardPage() {
  const { connected, status } = useMarketsStream();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/v1/dashboard/summary");
      if (!r.ok) {
        const text = await r.text();
        throw new Error(text || `HTTP ${r.status}`);
      }
      setSummary((await r.json()) as DashboardSummary);
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

  const wsTone = status === "connected" ? "ok" : status === "reconnecting" ? "warn" : "bad";
  const wsLabel =
    status === "connected"
      ? "Live stream connected"
      : status === "reconnecting"
        ? "Live stream reconnecting"
        : "Live stream disconnected";

  const feedTone = summary?.feed_connected ? "ok" : "warn";
  const feedLabel = summary?.feed_connected ? "Data feed connected" : "Data feed offline (simulated)";

  return (
    <div className="min-h-screen text-white" style={{ background: "#060c18" }}>
      <div className="mx-auto max-w-[1400px] px-5 pb-16 pt-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Dashboard</h1>
            <p className="mt-1 text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
              Platform overview · Markets, volume, and open orders
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill label={wsLabel} tone={wsTone} />
            {summary && <StatusPill label={feedLabel} tone={feedTone} />}
          </div>
        </div>

        {loading && !summary && (
          <div className="rounded-2xl px-4 py-14 text-center text-sm text-white/35"
            style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full" style={{ background: "#3dffa0" }} />
              Loading dashboard…
            </span>
          </div>
        )}

        {error && !summary && (
          <div className="rounded-2xl px-4 py-10 text-center"
            style={{ border: "1px solid rgba(239,83,80,0.35)", background: "rgba(239,83,80,0.06)" }}>
            <p className="text-sm text-[#ef5350]">{error}</p>
            <button
              type="button"
              onClick={() => { setLoading(true); void load(); }}
              className="mt-4 rounded-lg px-4 py-2 text-sm font-semibold text-[#060c18]"
              style={{ background: "linear-gradient(135deg,#3dffa0,#38bdf8)" }}
            >
              Retry
            </button>
          </div>
        )}

        {summary && (
          <>
            {error && (
              <p className="mb-4 text-xs text-[#fbbf24]">Last refresh failed: {error}</p>
            )}
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Active Markets", value: String(summary.active_markets) },
                { label: "24h Volume", value: fmtVol(summary.volume_24h_total) },
                { label: "Open Orders", value: String(summary.open_orders_count) },
                {
                  label: "Client WS",
                  value: connected ? "Connected" : status === "reconnecting" ? "Reconnecting" : "Down",
                },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="rounded-2xl p-4"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <p className="mb-1.5 text-xs uppercase tracking-widest text-white/40">{label}</p>
                  <p className="font-mono text-xl font-bold text-white">{value}</p>
                </div>
              ))}
            </div>

            {summary.active_markets === 0 ? (
              <div className="rounded-2xl px-4 py-14 text-center text-sm text-white/35"
                style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                No active markets yet.
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                <MarketRows title="Top gainers" rows={summary.top_gainers} empty="No gainers available." />
                <MarketRows title="Top losers" rows={summary.top_losers} empty="No losers available." />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
