import { NextResponse } from "next/server";
import { getMatchingEngine } from "../../../../../lib/engines.js";

export async function DELETE(_req, { params }) {
  let id = (await params).id?.trim();
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return new NextResponse("invalid order id", { status: 400 });
  }
  id = id.toLowerCase();
  try {
    await getMatchingEngine().cancel(id);
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    if (isMatchError(e)) {
      return new NextResponse(e.message, { status: e.code === "NOT_FOUND" ? 404 : 400 });
    }
    throw e;
  }
}

function isMatchError(error) {
  return error != null && typeof error === "object" &&
    (error.code === "BAD_REQUEST" || error.code === "NOT_FOUND") &&
    typeof error.message === "string";
}
