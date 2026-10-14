import { NextResponse } from "next/server";
import { getMarketEngine, getMatchingEngine } from "../../../../lib/engines.js";
import { formatPrice, quoteDp } from "../../../../lib/merge.js";
import { parseLimit, queryTrades } from "../../../../lib/deskQueries.js";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const marketId = searchParams.get("market_id")?.trim() || undefined;
  try {
    const limit = parseLimit(searchParams.get("limit"));
    const marketEngine = getMarketEngine();
    const trades = await queryTrades(getMatchingEngine(), marketEngine, marketId, limit);
    const markets = new Map(marketEngine.overview().markets.map((market) => [market.id, market]));
    return NextResponse.json({
      trades: trades.map((trade) => ({
        id: trade.id,
        market_id: trade.market_id,
        price: formatPrice(trade.price, quoteDp(markets.get(trade.market_id)?.quote ?? "USDT")),
        size: trade.size.toFixed(8),
        taker_side: trade.taker_side,
        maker_order_id: trade.maker_order_id,
        taker_order_id: trade.taker_order_id,
        ts: trade.ts,
      })),
    });
  } catch (error) {
    if (isMatchError(error)) {
      return new NextResponse(error.message, { status: error.code === "NOT_FOUND" ? 404 : 400 });
    }
    throw error;
  }
}

function isMatchError(error) {
  return error != null && typeof error === "object" &&
    (error.code === "BAD_REQUEST" || error.code === "NOT_FOUND") &&
    typeof error.message === "string";
}
