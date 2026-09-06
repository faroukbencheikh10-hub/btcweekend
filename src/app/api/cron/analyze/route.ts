import { NextRequest, NextResponse } from "next/server";
import { runTrendAnalysis as runAnalysis } from "@/lib/server/runTrendAnalysis";
import { ensureSchema, isMetaApiEnabled } from "@/lib/server/db";
import { resolveOpenTrades } from "@/lib/server/resolveOpenTrades";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const headerSecret = req.headers.get("x-cron-secret");
  const querySecret = req.nextUrl.searchParams.get("secret");
  return headerSecret === secret || querySecret === secret;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  try {
    await ensureSchema();
    // Esito dei trade aperti: ad ogni cron, prima di cercare nuovi segnali.
    const chiusure = await resolveOpenTrades();
    if (!(await isMetaApiEnabled())) {
      return NextResponse.json({ skipped: "metaapi_paused", chiusure });
    }

    const result = await runAnalysis();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/analyze] errore:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Errore sconosciuto" },
      { status: 500 }
    );
  }
}
