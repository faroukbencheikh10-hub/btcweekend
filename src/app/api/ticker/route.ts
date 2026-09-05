import { NextResponse } from "next/server";
import { getTickerState } from "@/lib/server/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const state = await getTickerState();
    return NextResponse.json({ ok: true, ...state });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Errore sconosciuto" },
      { status: 500 }
    );
  }
}
