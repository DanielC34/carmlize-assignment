import { NextResponse } from "next/server";
import { getMarketEngine, getPriceAlertStore } from "../../../../lib/engines.js";

export const dynamic = "force-dynamic";

export async function GET() {
  const engine = getMarketEngine();
  const alerts = await getPriceAlertStore().list(engine.overview().markets);
  return NextResponse.json({ alerts });
}

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return new NextResponse("invalid JSON body", { status: 400 });
  }
  try {
    const alert = await getPriceAlertStore().create(body, getMarketEngine().overview().markets);
    return NextResponse.json({ alert }, { status: 201 });
  } catch (error) {
    if (isPriceAlertError(error)) {
      return new NextResponse(error.message, { status: error.code === "NOT_FOUND" ? 404 : 400 });
    }
    throw error;
  }
}

function isPriceAlertError(error) {
  return error != null && typeof error === "object" &&
    (error.code === "BAD_REQUEST" || error.code === "NOT_FOUND") &&
    typeof error.message === "string";
}
