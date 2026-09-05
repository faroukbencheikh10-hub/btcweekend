import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json({
    ok: true,
    skipped: true,
    reason: "disabled",
    note: "Canale 5m ICT disattivato. Usa /api/generate (ORB).",
  });
}
