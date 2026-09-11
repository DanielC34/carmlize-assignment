import { NextResponse } from "next/server";
import { getMarketEngine, getMatchingEngine } from "../../../../../lib/engines.js";
import { buildDashboardSummary } from "../../../../../lib/dashboardSummary.js";
import { generateMarketBrief } from "../../../../../lib/aiBrief.js";

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const question = typeof body.question === "string" ? body.question.slice(0, 500) : "";

    let summary = body.summary;
    if (!summary || typeof summary !== "object") {
      summary = await buildDashboardSummary(getMarketEngine(), getMatchingEngine());
    }

    const result = await generateMarketBrief(summary, { question });
    return NextResponse.json({
      brief: result.brief,
      source: result.source,
      model: result.model,
      generated_at: Math.floor(Date.now() / 1000),
    });
  } catch (e) {
    const message = e?.message ?? "ai brief unavailable";
    if (String(message).includes("not ready")) {
      return new NextResponse("service warming up", { status: 503 });
    }
    console.error("ai brief failed:", message);
    return new NextResponse("failed to generate AI brief", { status: 500 });
  }
}

export async function GET() {
  try {
    const summary = await buildDashboardSummary(getMarketEngine(), getMatchingEngine());
    const result = await generateMarketBrief(summary, {});
    return NextResponse.json({
      brief: result.brief,
      source: result.source,
      model: result.model,
      generated_at: Math.floor(Date.now() / 1000),
    });
  } catch (e) {
    const message = e?.message ?? "ai brief unavailable";
    if (String(message).includes("not ready")) {
      return new NextResponse("service warming up", { status: 503 });
    }
    console.error("ai brief failed:", message);
    return new NextResponse("failed to generate AI brief", { status: 500 });
  }
}
