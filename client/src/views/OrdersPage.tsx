"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Market = { id: string; pair: string; quote: string };
type Order = {
  id: string;
  market_id: string;
  side: "buy" | "sell";
  order_type: "limit" | "market";
  price: string | null;
  size: string;
  size_remaining: string;
  status: "open" | "partially_filled" | "filled" | "cancelled";
  created_at: number;
};
type Trade = {
  id: number;
  market_id: string;
  price: string;
  size: string;
  taker_side: "buy" | "sell";
  maker_order_id: string;
  taker_order_id: string;
  ts: number;
};
type PriceAlert = {
  id: string;
  market_id: string;
  direction: "above" | "below";
  price: number;
  status: "active" | "triggered";
  created_at: number;
  triggered_at: number | null;
  triggered_price: number | null;
};

async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error((await response.text()) || `HTTP ${response.status}`);
  return response.status === 204 ? ({} as T) : response.json();
}

function formatTime(timestamp: number) {
  return new Date(timestamp * 1000).toLocaleString();
}

function Section(props: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden border border-white/[0.08] bg-[rgba(8,12,18,0.72)]">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
        <h2 className="font-display text-lg font-semibold text-white">{props.title}</h2>
        {props.count !== undefined ? (
          <span className="font-mono text-xs text-white/35">{props.count} records</span>
        ) : null}
      </div>
      {props.children}
    </section>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="px-5 py-12 text-center text-sm text-white/40">{children}</p>;
}

function ErrorMessage({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="border-b border-[#f07178]/20 bg-[#f07178]/[0.06] px-5 py-3 text-sm text-[#f07178]">
      {children}
    </p>
  );
}

const inputClass =
  "min-w-0 border border-white/10 bg-[#080d13] px-3 py-2 text-sm text-white outline-none focus:border-[#3b82f6]/70";
const buttonClass =
  "border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/75 transition hover:border-[#3b82f6]/60 hover:text-white disabled:cursor-not-allowed disabled:opacity-40";

export function OrdersPage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [marketError, setMarketError] = useState<string | null>(null);
  const [marketFilter, setMarketFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sideFilter, setSideFilter] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [tradesLoading, setTradesLoading] = useState(true);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [tradesError, setTradesError] = useState<string | null>(null);
  const [alertsError, setAlertsError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [workingOrder, setWorkingOrder] = useState<string | null>(null);
  const [workingAlert, setWorkingAlert] = useState<string | null>(null);
  const [alertMarket, setAlertMarket] = useState("");
  const [alertDirection, setAlertDirection] = useState<"above" | "below">("above");
  const [alertPrice, setAlertPrice] = useState("");
  const [creatingAlert, setCreatingAlert] = useState(false);

  const loadOrders = useCallback(async () => {
    const params = new URLSearchParams();
    if (marketFilter) params.set("market_id", marketFilter);
    if (statusFilter) params.set("status", statusFilter);
    if (sideFilter) params.set("side", sideFilter);
    try {
      const data = await readJson<{ orders: Order[] }>(`/api/v1/orders?${params}`);
      setOrders(data.orders);
      setOrdersError(null);
    } catch (error) {
      setOrdersError(error instanceof Error ? error.message : "Unable to load orders");
    } finally {
      setOrdersLoading(false);
    }
  }, [marketFilter, sideFilter, statusFilter]);

  const loadTrades = useCallback(async () => {
    try {
      const query = marketFilter ? `?market_id=${encodeURIComponent(marketFilter)}&limit=50` : "?limit=50";
      const data = await readJson<{ trades: Trade[] }>(`/api/v1/trades${query}`);
      setTrades(data.trades);
      setTradesError(null);
    } catch (error) {
      setTradesError(error instanceof Error ? error.message : "Unable to load fills");
    } finally {
      setTradesLoading(false);
    }
  }, [marketFilter]);

  const loadAlerts = useCallback(async () => {
    try {
      const data = await readJson<{ alerts: PriceAlert[] }>("/api/v1/alerts");
      setAlerts(data.alerts);
      setAlertsError(null);
    } catch (error) {
      setAlertsError(error instanceof Error ? error.message : "Unable to load alerts");
    } finally {
      setAlertsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void readJson<{ markets: Market[] }>("/api/v1/markets")
      .then((data) => {
        if (!active) return;
        setMarkets(data.markets);
        setMarketError(null);
        setAlertMarket((current) => current || data.markets[0]?.id || "");
      })
      .catch((error: unknown) => {
        if (active) setMarketError(error instanceof Error ? error.message : "Unable to load markets");
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    void loadOrders();
    void loadTrades();
    void loadAlerts();
    const interval = window.setInterval(() => {
      void loadOrders();
      void loadTrades();
      void loadAlerts();
    }, 5000);
    return () => window.clearInterval(interval);
  }, [loadAlerts, loadOrders, loadTrades]);

  async function cancelOrder(order: Order) {
    if (!window.confirm(`Cancel ${order.side.toUpperCase()} ${order.market_id} order?`)) return;
    setWorkingOrder(order.id);
    setActionError(null);
    try {
      await readJson(`/api/v1/orders/${order.id}`, { method: "DELETE" });
      await loadOrders();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to cancel order");
    } finally {
      setWorkingOrder(null);
    }
  }

  async function submitAlert(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreatingAlert(true);
    setAlertsError(null);
    try {
      await readJson("/api/v1/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          market_id: alertMarket,
          direction: alertDirection,
          price: Number(alertPrice),
        }),
      });
      setAlertPrice("");
      await loadAlerts();
    } catch (error) {
      setAlertsError(error instanceof Error ? error.message : "Unable to create alert");
    } finally {
      setCreatingAlert(false);
    }
  }

  async function deleteAlert(alert: PriceAlert) {
    setWorkingAlert(alert.id);
    setAlertsError(null);
    try {
      await readJson(`/api/v1/alerts/${alert.id}`, { method: "DELETE" });
      await loadAlerts();
    } catch (error) {
      setAlertsError(error instanceof Error ? error.message : "Unable to delete alert");
    } finally {
      setWorkingAlert(null);
    }
  }

  const pairName = (id: string) => markets.find((market) => market.id === id)?.pair ?? id.toUpperCase();

  return (
    <main className="mx-auto max-w-[1500px] px-4 pb-24 pt-8 sm:px-8">
      <header className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#60a5fa]">Carmlize · Test / DX desk</p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">Orders &amp; fills</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/45">
            Operator blotter across live markets, matching-engine executions, and persistent mark-price alerts.
          </p>
        </div>
        <Link href="/trade/btc-usdt" className="self-start border border-[#3b82f6]/50 px-4 py-2 text-sm font-semibold text-[#93c5fd] hover:bg-[#3b82f6]/10 md:self-auto">
          Open trade ticket
        </Link>
      </header>

      <div className="mb-6 grid gap-3 border border-white/[0.08] bg-[rgba(8,12,18,0.55)] p-4 sm:grid-cols-3">
        <label className="flex flex-col gap-2 text-[10px] font-mono uppercase tracking-[0.15em] text-white/40">
          Market
          <select className={inputClass} value={marketFilter} onChange={(event) => setMarketFilter(event.target.value)}>
            <option value="">All markets</option>
            {markets.map((market) => <option key={market.id} value={market.id}>{market.pair}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-[10px] font-mono uppercase tracking-[0.15em] text-white/40">
          Status
          <select className={inputClass} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">All statuses</option>
            {["open", "partially_filled", "filled", "cancelled"].map((status) => <option key={status} value={status}>{status.replace("_", " ")}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-[10px] font-mono uppercase tracking-[0.15em] text-white/40">
          Side
          <select className={inputClass} value={sideFilter} onChange={(event) => setSideFilter(event.target.value)}>
            <option value="">Buy &amp; sell</option>
            <option value="buy">Buy</option>
            <option value="sell">Sell</option>
          </select>
        </label>
      </div>

      {marketError ? <ErrorMessage>{marketError}</ErrorMessage> : null}
      {actionError ? <ErrorMessage>{actionError}</ErrorMessage> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(340px,0.9fr)]">
        <div className="space-y-6">
          <Section title="Order blotter" count={orders.length}>
            {ordersError ? <ErrorMessage>{ordersError}</ErrorMessage> : null}
            {ordersLoading && orders.length === 0 ? <EmptyState>Loading orders…</EmptyState> : null}
            {!ordersLoading && !ordersError && orders.length === 0 ? <EmptyState>No orders match these filters. Place an order from the trade ticket to populate the blotter.</EmptyState> : null}
            {orders.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[780px] text-left">
                  <thead className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/35">
                    <tr>{["Market", "Side / type", "Limit price", "Size / remaining", "Status", "Created", "Action"].map((label) => <th key={label} className="px-4 py-3 font-medium">{label}</th>)}</tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => {
                      const cancellable = order.status === "open" || order.status === "partially_filled";
                      return (
                        <tr key={order.id} className="border-t border-white/[0.05] text-sm hover:bg-white/[0.02]">
                          <td className="whitespace-nowrap px-4 py-3 font-semibold text-white/85">{pairName(order.market_id)}</td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <span className={order.side === "buy" ? "text-[#60a5fa]" : "text-[#f07178]"}>{order.side.toUpperCase()}</span>
                            <span className="ml-2 text-xs text-white/35">{order.order_type}</span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 font-mono text-white/70">{order.price ?? "Market"}</td>
                          <td className="whitespace-nowrap px-4 py-3 font-mono text-white/65">{order.size} <span className="text-white/30">/ {order.size_remaining}</span></td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-white/60">{order.status.replace("_", " ")}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-white/40">{formatTime(order.created_at)}</td>
                          <td className="whitespace-nowrap px-4 py-3">
                            {cancellable ? <button type="button" className={buttonClass} disabled={workingOrder === order.id} onClick={() => void cancelOrder(order)}>{workingOrder === order.id ? "Cancelling…" : "Cancel"}</button> : <span className="text-xs text-white/25">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </Section>

          <Section title="Fills tape" count={trades.length}>
            {tradesError ? <ErrorMessage>{tradesError}</ErrorMessage> : null}
            {tradesLoading && trades.length === 0 ? <EmptyState>Loading fills…</EmptyState> : null}
            {!tradesLoading && !tradesError && trades.length === 0 ? <EmptyState>No matching-engine executions yet. A fill appears here when compatible orders cross.</EmptyState> : null}
            {trades.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[540px] text-left">
                  <thead className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/35">
                    <tr>{["Market", "Taker side", "Price", "Size", "Order refs", "Time"].map((label) => <th key={label} className="px-4 py-3 font-medium">{label}</th>)}</tr>
                  </thead>
                  <tbody>
                    {trades.map((trade) => (
                      <tr key={trade.id} className="border-t border-white/[0.05] text-sm">
                        <td className="px-4 py-3 font-semibold text-white/80">{pairName(trade.market_id)}</td>
                        <td className={`px-4 py-3 ${trade.taker_side === "buy" ? "text-[#60a5fa]" : "text-[#f07178]"}`}>{trade.taker_side.toUpperCase()}</td>
                        <td className="px-4 py-3 font-mono text-white/70">{trade.price}</td>
                        <td className="px-4 py-3 font-mono text-white/70">{trade.size}</td>
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-[10px] text-white/40" title={`Maker ${trade.maker_order_id} · Taker ${trade.taker_order_id}`}>
                          {trade.maker_order_id.slice(0, 8)} / {trade.taker_order_id.slice(0, 8)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-white/40">{formatTime(trade.ts)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </Section>
        </div>

        <Section title="Price alerts" count={alerts.length}>
          {alertsError ? <ErrorMessage>{alertsError}</ErrorMessage> : null}
          <form onSubmit={(event) => void submitAlert(event)} className="space-y-3 border-b border-white/[0.06] p-4">
            <label className="flex flex-col gap-2 text-[10px] font-mono uppercase tracking-[0.15em] text-white/40">
              Market
              <select required className={inputClass} value={alertMarket} onChange={(event) => setAlertMarket(event.target.value)}>
                {markets.map((market) => <option key={market.id} value={market.id}>{market.pair}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-2 text-[10px] font-mono uppercase tracking-[0.15em] text-white/40">
                Trigger
                <select className={inputClass} value={alertDirection} onChange={(event) => setAlertDirection(event.target.value as "above" | "below")}>
                  <option value="above">Mark reaches / above</option>
                  <option value="below">Mark reaches / below</option>
                </select>
              </label>
              <label className="flex flex-col gap-2 text-[10px] font-mono uppercase tracking-[0.15em] text-white/40">
                Price
                <input required min="0" step="any" type="number" className={inputClass} value={alertPrice} onChange={(event) => setAlertPrice(event.target.value)} placeholder="e.g. 65000" />
              </label>
            </div>
            <button type="submit" disabled={creatingAlert || !alertMarket} className="w-full bg-[#3b82f6] px-4 py-2.5 text-sm font-semibold text-[#071019] disabled:opacity-50">
              {creatingAlert ? "Saving alert…" : "Create price alert"}
            </button>
          </form>
          {alertsLoading && alerts.length === 0 ? <EmptyState>Loading alerts…</EmptyState> : null}
          {!alertsLoading && !alertsError && alerts.length === 0 ? <EmptyState>No alerts yet. Create one above; active alerts are checked against the latest mark price whenever alerts are read.</EmptyState> : null}
          <ul className="divide-y divide-white/[0.05]">
            {alerts.map((alert) => (
              <li key={alert.id} className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-semibold text-white/85">{pairName(alert.market_id)} <span className="font-mono text-sm text-white/65">{alert.direction} {alert.price.toLocaleString()}</span></p>
                  <p className="mt-1 text-xs text-white/35">
                    {alert.status === "triggered" && alert.triggered_price != null
                      ? `Triggered at ${alert.triggered_price.toLocaleString()} · ${formatTime(alert.triggered_at ?? alert.created_at)}`
                      : `Active · created ${formatTime(alert.created_at)}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={alert.status === "triggered" ? "border border-[#60a5fa]/30 bg-[#60a5fa]/10 px-2 py-1 text-[10px] uppercase text-[#93c5fd]" : "border border-white/10 px-2 py-1 text-[10px] uppercase text-white/45"}>{alert.status}</span>
                  <button type="button" className={buttonClass} disabled={workingAlert === alert.id} onClick={() => void deleteAlert(alert)}>{workingAlert === alert.id ? "…" : "Delete"}</button>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </main>
  );
}
