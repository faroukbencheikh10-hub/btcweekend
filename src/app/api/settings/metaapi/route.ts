import { NextResponse } from "next/server";
import { ensureSchema, isMetaApiEnabled, toggleMetaApiEnabled } from "@/lib/server/db";

export const dynamic = "force-dynamic";

function payload(enabled: boolean) {
  return {
    enabled,
    metaapi_enabled: enabled ? "true" : "false",
  };
}

export async function GET() {
  try {
    await ensureSchema();
    const enabled = await isMetaApiEnabled();
    return NextResponse.json(payload(enabled));
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Errore sconosciuto" },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    await ensureSchema();
    const enabled = await toggleMetaApiEnabled();
    return NextResponse.json(payload(enabled));
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Errore sconosciuto" },
      { status: 500 }
    );
  }
}
