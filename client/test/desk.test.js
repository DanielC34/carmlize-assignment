import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { MatchError, MatchingEngine } from "../lib/matchingEngine.js";
import { parseLimit, queryTrades } from "../lib/deskQueries.js";
import { PriceAlertError, PriceAlertStore } from "../lib/priceAlerts.js";

function order(id, created_at, side, status, market_id = "btc-usdt") {
  return {
    id,
    market_id,
    side,
    order_type: "limit",
    price: 100,
    size_original: 1,
    size_remaining: status === "filled" ? 0 : 1,
    status,
    created_at,
  };
}

describe("desk query helpers", () => {
  it("filters orders by status and side, returns newest first, and caps rows at 200", async () => {
    const engine = new MatchingEngine(path.join(os.tmpdir(), `unused-${crypto.randomUUID()}.json`));
    for (let index = 0; index < 205; index++) {
      engine.inner.orders.set(
        `order-${index}`,
        order(`order-${index}`, index, index % 2 ? "sell" : "buy", index === 204 ? "filled" : "open"),
      );
    }

    const buys = await engine.queryOrders({ status: "open", side: "buy", limit: 500 });
    assert.equal(buys.length, 102);
    assert.equal(buys[0].created_at, 202);
    assert.ok(buys.every((entry) => entry.side === "buy" && entry.status === "open"));

    const capped = await engine.queryOrders({ limit: 500 });
    assert.equal(capped.length, 200);
    assert.equal(capped[0].created_at, 204);
  });

  it("rejects invalid order filters and malformed limits", async () => {
    const engine = new MatchingEngine(path.join(os.tmpdir(), `unused-${crypto.randomUUID()}.json`));
    await assert.rejects(() => engine.queryOrders({ status: "pending" }), (error) => {
      assert.ok(error instanceof MatchError);
      assert.equal(error.code, "BAD_REQUEST");
      return true;
    });
    await assert.rejects(() => engine.queryOrders({ side: "short" }), /side must be buy or sell/i);
    assert.equal(parseLimit(null), 50);
    assert.equal(parseLimit("250"), 200);
    assert.throws(() => parseLimit("many"), /limit must be a positive integer/i);
    assert.throws(() => parseLimit("0"), /limit must be a positive integer/i);
  });

  it("keeps insertion order newest-first when timestamps have one-second precision", async () => {
    const engine = new MatchingEngine(path.join(os.tmpdir(), `unused-${crypto.randomUUID()}.json`));
    engine.inner.orders.set("first", order("first", 100, "buy", "open"));
    engine.inner.orders.set("second", order("second", 100, "buy", "open"));

    const listed = await engine.queryOrders({ limit: 2 });
    assert.deepEqual(listed.map((entry) => entry.id), ["second", "first"]);
  });

  it("returns global/market-filtered trades newest first and rejects unknown markets", async () => {
    const engine = new MatchingEngine(path.join(os.tmpdir(), `unused-${crypto.randomUUID()}.json`));
    engine.inner.trades.push(
      { id: 1, market_id: "btc-usdt", ts: 1 },
      { id: 2, market_id: "eth-usdt", ts: 2 },
      { id: 3, market_id: "btc-usdt", ts: 3 },
    );
    const marketEngine = { detail: (id) => id === "btc-usdt" || id === "eth-usdt" ? { id } : null };

    const globalTrades = await queryTrades(engine, marketEngine, undefined, 2);
    assert.deepEqual(globalTrades.map((trade) => trade.id), [3, 2]);
    const marketTrades = await queryTrades(engine, marketEngine, "btc-usdt", 5);
    assert.deepEqual(marketTrades.map((trade) => trade.id), [3, 1]);
    await assert.rejects(
      () => queryTrades(engine, marketEngine, "missing-usdt", 50),
      (error) => error instanceof MatchError && error.code === "NOT_FOUND",
    );
  });
});

describe("PriceAlertStore", () => {
  async function tempStore() {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "carmlize-alerts-"));
    return { directory, store: new PriceAlertStore(path.join(directory, "alerts.json")) };
  }

  it("creates, evaluates, persists and reloads above/below alerts", async () => {
    const { directory, store } = await tempStore();
    try {
      const initialMarkets = [{ id: "btc-usdt", mark_price: 100 }];
      const above = await store.create({ market_id: "btc-usdt", direction: "above", price: 101 }, initialMarkets, 10);
      const below = await store.create({ market_id: "btc-usdt", direction: "below", price: 99 }, initialMarkets, 11);
      const triggered = await store.list([{ id: "btc-usdt", mark_price: 102 }], 20);

      assert.equal(triggered.find((alert) => alert.id === above.id)?.status, "triggered");
      assert.equal(triggered.find((alert) => alert.id === above.id)?.triggered_price, 102);
      assert.equal(triggered.find((alert) => alert.id === below.id)?.status, "active");

      const reloaded = new PriceAlertStore(path.join(directory, "alerts.json"));
      const crossedBelow = await reloaded.list([{ id: "btc-usdt", mark_price: 98 }], 30);
      assert.equal(crossedBelow.find((alert) => alert.id === below.id)?.status, "triggered");
      assert.equal(crossedBelow.find((alert) => alert.id === below.id)?.triggered_at, 30);
    } finally {
      await fs.rm(directory, { recursive: true, force: true });
    }
  });

  it("validates input and rejects deletion of a missing alert", async () => {
    const { directory, store } = await tempStore();
    try {
      const markets = [{ id: "btc-usdt", mark_price: 100 }];
      await assert.rejects(
        () => store.create({ market_id: "missing", direction: "above", price: 1 }, markets),
        (error) => error instanceof PriceAlertError && error.code === "NOT_FOUND",
      );
      await assert.rejects(() => store.create(null, markets), /request body must be a JSON object/i);
      await assert.rejects(
        () => store.create({ market_id: "btc-usdt", direction: "above", price: 0 }, markets),
        /price must be a finite number/i,
      );
      await assert.rejects(
        () => store.delete("00000000-0000-4000-8000-000000000000"),
        (error) => error instanceof PriceAlertError && error.code === "NOT_FOUND",
      );
    } finally {
      await fs.rm(directory, { recursive: true, force: true });
    }
  });

  it("surfaces invalid persisted alert data instead of resetting the store", async () => {
    const { directory } = await tempStore();
    const storePath = path.join(directory, "alerts.json");
    try {
      await fs.writeFile(storePath, JSON.stringify({ alerts: null }), "utf8");
      assert.throws(
        () => new PriceAlertStore(storePath),
        /price alert persistence must contain an alerts array/i,
      );
    } finally {
      await fs.rm(directory, { recursive: true, force: true });
    }
  });
});
