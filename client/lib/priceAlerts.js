import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

export class PriceAlertError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export class PriceAlertStore {
  constructor(dataPath) {
    this.path = path.isAbsolute(dataPath) ? dataPath : path.join(process.cwd(), dataPath);
    this.alerts = [];
    this.writeQueue = Promise.resolve();
    if (fs.existsSync(this.path)) {
      const saved = JSON.parse(fs.readFileSync(this.path, "utf8"));
      if (!saved || typeof saved !== "object" || !Array.isArray(saved.alerts)) {
        throw new Error("price alert persistence must contain an alerts array");
      }
      this.alerts = saved.alerts;
    }
  }

  persist() {
    const snapshot = JSON.stringify({ alerts: this.alerts }, null, 2);
    const operation = this.writeQueue.then(async () => {
      const directory = path.dirname(this.path);
      await fsp.mkdir(directory, { recursive: true });
      const temporaryPath = `${this.path}.${process.pid}.${crypto.randomUUID()}.tmp`;
      await fsp.writeFile(temporaryPath, snapshot, "utf8");
      await fsp.rename(temporaryPath, this.path);
    });
    this.writeQueue = operation.catch(() => {});
    return operation;
  }

  async create(input, markets, now = Math.floor(Date.now() / 1000)) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new PriceAlertError("BAD_REQUEST", "request body must be a JSON object");
    }
    const marketId = typeof input?.market_id === "string" ? input.market_id.trim() : "";
    if (!marketId) throw new PriceAlertError("BAD_REQUEST", "market_id is required");
    if (!markets.some((market) => market.id === marketId)) {
      throw new PriceAlertError("NOT_FOUND", "unknown market_id");
    }
    if (input?.direction !== "above" && input?.direction !== "below") {
      throw new PriceAlertError("BAD_REQUEST", "direction must be above or below");
    }
    const price = typeof input?.price === "number" ? input.price : Number(input?.price);
    if (!Number.isFinite(price) || price <= 0) {
      throw new PriceAlertError("BAD_REQUEST", "price must be a finite number greater than zero");
    }

    const alert = {
      id: crypto.randomUUID(),
      market_id: marketId,
      direction: input.direction,
      price,
      status: "active",
      created_at: now,
      triggered_at: null,
      triggered_price: null,
    };
    this.alerts.push(alert);
    await this.persist();
    return { ...alert };
  }

  async list(markets, now = Math.floor(Date.now() / 1000)) {
    const prices = new Map(markets.map((market) => [market.id, market.mark_price]));
    let changed = false;
    for (const alert of this.alerts) {
      const markPrice = prices.get(alert.market_id);
      if (alert.status !== "active" || !Number.isFinite(markPrice)) continue;
      const crossed = alert.direction === "above"
        ? markPrice >= alert.price
        : markPrice <= alert.price;
      if (crossed) {
        alert.status = "triggered";
        alert.triggered_at = now;
        alert.triggered_price = markPrice;
        changed = true;
      }
    }
    if (changed) await this.persist();
    return this.alerts
      .slice()
      .sort((a, b) => b.created_at - a.created_at)
      .map((alert) => ({ ...alert }));
  }

  async delete(id) {
    const index = this.alerts.findIndex((alert) => alert.id === id);
    if (index < 0) throw new PriceAlertError("NOT_FOUND", "not found");
    this.alerts.splice(index, 1);
    await this.persist();
  }
}

export function createPriceAlertStore(dataPath) {
  return new PriceAlertStore(dataPath);
}
