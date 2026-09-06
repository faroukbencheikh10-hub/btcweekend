import { NextRequest, NextResponse } from "next/server";
import { runTrendAnalysis as runAnalysis } from "@/lib/server/runTrendAnalysis";
import { ensureSchema, isMetaApiEnabled, insertMarketSnapshot } from "@/lib/server/db";
import { resolveOpenTrades } from "@/lib/server/resolveOpenTrades";
import { getMarketSnapshot } from "@/lib/server/marketData";

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
    if (!(await isMetaApiEnabled())) {
      // Anche in pausa: snapshot + esito sugli aperti, niente nuovi segnali.
      let snapshot_saved = false;
      try {
        const snap = await getMarketSnapshot();
        await insertMarketSnapshot(snap);
        snapshot_saved = true;
      } catch (err) {
        console.error("[cron/analyze] snapshot in pausa fallito:", err);
      }
      const chiusure = await resolveOpenTrades();
      return NextResponse.json({
        skipped: "metaapi_paused",
        open_signals: chiusure.stillOpen,
        checked: chiusure.checked,
        closed: chiusure.closed,
        snapshot_saved,
        chiusure,
      });
    }

    const result = await runAnalysis();
    return NextResponse.json({
      ok: true,
      open_signals: result.open_signals ?? 0,
      checked: result.checked ?? 0,
      closed: result.closed ?? [],
      snapshot_saved: Boolean(result.snapshot_saved),
      ...result,
    });
  } catch (err) {
    console.error("[cron/analyze] errore:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Errore sconosciuto" },
      { status: 500 }
    );
  }
}
