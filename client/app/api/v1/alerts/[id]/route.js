import { NextResponse } from "next/server";
import { getPriceAlertStore } from "../../../../../lib/engines.js";

export async function DELETE(_req, { params }) {
  const id = (await params).id?.trim();
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return new NextResponse("invalid alert id", { status: 400 });
  }
  try {
    await getPriceAlertStore().delete(id.toLowerCase());
    return new NextResponse(null, { status: 204 });
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
