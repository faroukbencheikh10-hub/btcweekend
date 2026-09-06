import { ensureSchema, insertSignal, insertMarketSnapshot, getSegnaleAttivo } from "@/lib/server/db";
import { getMarketSnapshot, isMarketOpen } from "@/lib/server/marketData";
import { getRelevantNews } from "@/lib/server/news";
import { getEconomicCalendar } from "@/lib/server/calendar";
import { validateSignal } from "@/lib/server/validateSignal";
import { valutaSetupTrend } from "@/lib/server/trendStrategy";
import { sendPushToAll } from "@/lib/server/pushSend";
import { chiamaSeAttivo } from "@/lib/server/twilioCall";
import { getTradingSymbol } from "@/lib/symbol";
import { resolveOpenTrades } from "@/lib/server/resolveOpenTrades";

type Chiusure = Awaited<ReturnType<typeof resolveOpenTrades>>;

function cronFields(chiusure: Chiusure, snapshotSaved: boolean, extra: Record<string, unknown> = {}) {
  return {
    open_signals: chiusure.stillOpen,
    checked: chiusure.checked,
    closed: chiusure.closed,
    snapshot_saved: snapshotSaved,
    chiusure,
    ...extra,
  };
}

export async function runTrendAnalysis(_options?: { force?: boolean }) {
  await ensureSchema();

  let snapshotSaved = false;
  let marketSnapshot: Awaited<ReturnType<typeof getMarketSnapshot>> | null = null;
  try {
    marketSnapshot = await getMarketSnapshot();
    await insertMarketSnapshot(marketSnapshot);
    snapshotSaved = true;
  } catch (err) {
    console.error("[runTrendAnalysis] snapshot non salvato:", err);
    snapshotSaved = false;
  }

  // Sempre, dopo lo snapshot: chiudi gli aperti sulle candele M5 (non sul prezzo spot).
  const chiusure = await resolveOpenTrades();

  if (!isMarketOpen()) {
    return cronFields(chiusure, snapshotSaved, {
      skipped: true,
      reason: "fuori_finestra_weekend",
      xauusd: marketSnapshot?.xauusd ?? null,
    });
  }

  const latest = await getSegnaleAttivo();
  const aperto =
    latest && (latest.direction === "BUY" || latest.direction === "SELL") && !latest.outcome;

  if (aperto && latest) {
    return cronFields(chiusure, snapshotSaved, {
      skipped: true,
      reason: "signal_active",
      activeSignalId: latest.id,
      direction: latest.direction,
      xauusd: marketSnapshot?.xauusd ?? null,
    });
  }

  if (!marketSnapshot) {
    try {
      marketSnapshot = await getMarketSnapshot();
    } catch (err) {
      return cronFields(chiusure, snapshotSaved, {
        skipped: true,
        reason: "snapshot_unavailable",
        error: err instanceof Error ? err.message : "snapshot_unavailable",
      });
    }
  }

  const [news, calendar] = await Promise.all([
    getRelevantNews().catch(() => []),
    getEconomicCalendar().catch(() => []),
  ]);

  const highImpact = calendar.filter((e) => e.impact === "high");
  const vicinoNews = highImpact.some((e) => {
    const t = new Date(e.time).getTime();
    return Number.isFinite(t) && Math.abs(Date.now() - t) < 30 * 60 * 1000;
  });
  if (vicinoNews) {
    const skipped = validateSignal({
      direction: "NO_TRADE",
      entry: null,
      stopLoss: null,
      tp1: null,
      tp2: null,
      riskReward: null,
      confidence: 0,
      reasoning: "Notizia ad alto impatto entro 30 minuti. Nessun trade.",
    });
    const saved = await insertSignal(skipped);
    return cronFields(chiusure, snapshotSaved, {
      signalId: saved.id,
      direction: "NO_TRADE",
      rejectedReason: skipped.reasoning,
      newsCount: news.length,
      xauusd: marketSnapshot.xauusd,
    });
  }

  const setup = valutaSetupTrend({
    prezzo: Number(marketSnapshot.xauusd),
    atr15m: marketSnapshot.atr15m ?? null,
    atr1h: marketSnapshot.atr1h ?? null,
    session: marketSnapshot.session,
    candles: marketSnapshot.candles,
  });

  const signal = setup.ok && setup.direzione
    ? validateSignal({
        direction: setup.direzione,
        entry: setup.entry,
        stopLoss: setup.stopLoss,
        tp1: setup.tp1,
        tp2: setup.tp2,
        riskReward: setup.rischioRendimento,
        confidence: 70,
        reasoning: setup.motivo,
      })
    : validateSignal({
        direction: "NO_TRADE",
        entry: null,
        stopLoss: null,
        tp1: null,
        tp2: null,
        riskReward: null,
        confidence: 0,
        reasoning: setup.motivo,
      });

  const saved = await insertSignal(signal);

  if (signal.direction === "BUY" || signal.direction === "SELL") {
    const prezzoTesto = Number(marketSnapshot.xauusd).toFixed(2);
    const symbol = getTradingSymbol();
    sendPushToAll({
      title: `${signal.direction} · ${symbol} ORB · ${prezzoTesto}`,
      body: `Entry ${Number(signal.entry).toFixed(2)} · SL ${Number(signal.stopLoss).toFixed(2)} · TP1 ${Number(signal.tp1).toFixed(2)} · TP2 ${Number(signal.tp2).toFixed(2)}`,
      url: "/",
    }).catch(() => undefined);
    chiamaSeAttivo(
      `Segnale ${signal.direction === "BUY" ? "acquisto" : "vendita"} su ${symbol}. Entrata ${Number(signal.entry).toFixed(2)}. Stop ${Number(signal.stopLoss).toFixed(2)}.`,
    ).catch(() => undefined);
  }

  return cronFields(chiusure, snapshotSaved, {
    signalId: saved.id,
    direction: signal.direction,
    confidence: signal.confidence,
    xauusd: marketSnapshot.xauusd,
    atr15m: marketSnapshot.atr15m,
    dataSource: marketSnapshot.source,
    setup: setup.setup,
    rejectedReason: signal.rejectedReason ?? (!setup.ok ? setup.motivo : null),
    newsCount: news.length,
    calendarCount: calendar.length,
  });
}
