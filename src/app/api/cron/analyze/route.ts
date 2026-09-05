import { NextRequest, NextResponse } from "next/server";
import { runTrendAnalysis as runAnalysis } from "@/lib/server/runTrendAnalysis";
import { ensureSchema, isMetaApiEnabled } from "@/lib/server/db";

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
      return NextResponse.json({ skipped: "metaapi_paused" });
    }

    const btc = await runAnalysis();
    return NextResponse.json({ ok: true, ...btc });
  } catch (err) {
    console.error("[cron/analyze] errore btc:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Errore sconosciuto" },
      { status: 500 }
    );
  }
}
