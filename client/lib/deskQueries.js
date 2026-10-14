import { MatchError } from "./matchingEngine.js";

export function parseLimit(value) {
  if (value == null) return 50;
  if (!/^\d+$/.test(value) || Number(value) < 1) {
    throw new MatchError("BAD_REQUEST", "limit must be a positive integer");
  }
  return Math.min(Number(value), 200);
}

export async function queryTrades(matchingEngine, marketEngine, marketId, limit) {
  if (marketId && !marketEngine.detail(marketId)) {
    throw new MatchError("NOT_FOUND", "unknown market_id");
  }
  return matchingEngine.recentTrades(marketId, limit);
}
