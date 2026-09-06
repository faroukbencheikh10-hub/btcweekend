import { closeSignal, getSegnaliAperti } from "@/lib/server/db";
import { metaApiFetchM5 } from "@/lib/server/metaApiData";
import { getTradingSymbol } from "@/lib/symbol";

export type CandleBar = {
  open: number;
  high: number;
  low: number;
  close: number;
  datetime: string;
};

export type TradeResolution = {
  outcome: "WIN" | "LOSS";
  resultR: number;
  closedAt: string;
  reason: "SL" | "TP1";
  candleLow: number;
  candleHigh: number;
};

function n(v: unknown): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : NaN;
}

export function getSpreadBufferPct(): number {
  const raw = Number(process.env.SPREAD_BUFFER_PCT ?? "0.05");
  return Number.isFinite(raw) && raw >= 0 ? raw : 0.05;
}

/** Buffer in unità di prezzo: SPREAD_BUFFER_PCT è in % (default 0.05 = 0.05%). */
export function spreadBufferFromPrice(price: number): number {
  if (!Number.isFinite(price) || price <= 0) return 0;
  return Number(((price * getSpreadBufferPct()) / 100).toFixed(6));
}

function toBars(raw: Array<{ open: string | number; high: string | number; low: string | number; close: string | number; datetime: string }>): CandleBar[] {
  const out: CandleBar[] = [];
  for (const row of raw) {
    const open = n(row.open);
    const high = n(row.high);
    const low = n(row.low);
    const close = n(row.close);
    const t = row.datetime ? new Date(row.datetime) : null;
    if (![open, high, low, close].every(Number.isFinite) || !t || Number.isNaN(t.getTime())) continue;
    out.push({ open, high, low, close, datetime: t.toISOString() });
  }
  out.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
  return out;
}

function coversFrom(bars: CandleBar[], from: Date): boolean {
  if (bars.length === 0) return false;
  const first = new Date(bars[0].datetime).getTime();
  // Tolleranza di una candela M5: se la prima candela è dopo from + 6 min, manca copertura.
  return first <= from.getTime() + 6 * 60 * 1000;
}

export async function fetchM5Covering(from: Date): Promise<CandleBar[]> {
  const elapsedMin = Math.max(0, (Date.now() - from.getTime()) / 60_000);
  const needed = Math.min(1000, Math.max(300, Math.ceil(elapsedMin / 5) + 24));
  const first = await metaApiFetchM5(needed, getTradingSymbol(), from.toISOString());
  let bars = toBars(first).filter((b) => new Date(b.datetime).getTime() >= from.getTime() - 60_000);
  if (!coversFrom(bars, from)) {
    const fallback = await metaApiFetchM5(needed, getTradingSymbol());
    bars = toBars(fallback).filter((b) => new Date(b.datetime).getTime() >= from.getTime() - 60_000);
  }
  return bars;
}

/**
 * Scorre le M5 in ordine cronologico.
 * BUY: SL se low <= SL + buffer; TP se high >= TP1.
 * SELL: SL se high >= SL - buffer; TP se low <= TP1.
 * Stessa candela SL+TP → LOSS (conservativo).
 */
export function resolveOnCandles(input: {
  direction: string;
  entry: number;
  stopLoss: number;
  tp1: number;
  riskReward: number;
  candles: CandleBar[];
}): TradeResolution | null {
  const direction = (input.direction || "").toUpperCase();
  if (direction !== "BUY" && direction !== "SELL") return null;
  const sl = n(input.stopLoss);
  const tp1 = n(input.tp1);
  const entry = n(input.entry);
  if (![sl, tp1, entry].every(Number.isFinite)) return null;

  const buffer = spreadBufferFromPrice(entry);
  const winR = Number.isFinite(input.riskReward) && input.riskReward > 0
    ? Number(input.riskReward)
    : sl !== entry
      ? Math.abs(tp1 - entry) / Math.abs(entry - sl)
      : 1.6;

  for (const c of input.candles) {
    const hitSl = direction === "BUY" ? c.low <= sl + buffer : c.high >= sl - buffer;
    const hitTp = direction === "BUY" ? c.high >= tp1 : c.low <= tp1;
    if (hitSl && hitTp) {
      return { outcome: "LOSS", resultR: -1, closedAt: c.datetime, reason: "SL", candleLow: c.low, candleHigh: c.high };
    }
    if (hitSl) {
      return { outcome: "LOSS", resultR: -1, closedAt: c.datetime, reason: "SL", candleLow: c.low, candleHigh: c.high };
    }
    if (hitTp) {
      return { outcome: "WIN", resultR: winR, closedAt: c.datetime, reason: "TP1", candleLow: c.low, candleHigh: c.high };
    }
  }
  return null;
}

export async function resolveOpenTrades(): Promise<{
  checked: number;
  closed: Array<{ id: string; outcome: "WIN" | "LOSS"; reason: "SL" | "TP1"; closedAt: string }>;
  stillOpen: number;
  bufferPct: number;
}> {
  const aperti = await getSegnaliAperti();
  const closed: Array<{ id: string; outcome: "WIN" | "LOSS"; reason: "SL" | "TP1"; closedAt: string }> = [];

  for (const signal of aperti) {
    const startRaw = signal.attivato_il ?? signal.created_at;
    const from = startRaw ? new Date(startRaw) : null;
    if (!from || Number.isNaN(from.getTime())) continue;

    const candles = await fetchM5Covering(from);
    const afterEntry = candles.filter((c) => new Date(c.datetime).getTime() >= from.getTime());
    const hit = resolveOnCandles({
      direction: signal.direction,
      entry: n(signal.entry),
      stopLoss: n(signal.stop_loss),
      tp1: n(signal.tp1),
      riskReward: n(signal.risk_reward),
      candles: afterEntry,
    });
    if (!hit) continue;

    const note = `Chiuso ${hit.reason} su candela M5 ${hit.closedAt} (H ${hit.candleHigh} L ${hit.candleLow}). Esito da candele, non dal prezzo corrente.`;
    await closeSignal(signal.id, hit.outcome, hit.resultR, hit.closedAt, note);
    closed.push({ id: signal.id, outcome: hit.outcome, reason: hit.reason, closedAt: hit.closedAt });
  }

  const still = await getSegnaliAperti();
  return {
    checked: aperti.length,
    closed,
    stillOpen: still.length,
    bufferPct: getSpreadBufferPct(),
  };
}
