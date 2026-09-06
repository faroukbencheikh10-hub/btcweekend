// Rapporto rischio/rendimento minimo 1.5, massimo 4.
const MIN_RISK_REWARD = 1.5;
const MAX_RISK_REWARD = 4;

export interface RawSignal {
  direction: string;
  entry: number | null;
  stopLoss: number | null;
  tp1: number | null;
  tp2: number | null;
  riskReward: number | null;
  confidence: number;
  reasoning: string;
  [key: string]: unknown;
}

export interface ValidatedSignal extends RawSignal {
  direction: "BUY" | "SELL" | "NO_TRADE";
  rejectedReason?: string;
  stopAtrRatio?: number | null;
}

function normalizeDirection(raw: string): "BUY" | "SELL" | "NO_TRADE" | null {
  const d = (raw ?? "").toString().trim().toUpperCase();
  if (d === "BUY" || d === "LONG") return "BUY";
  if (d === "SELL" || d === "SHORT") return "SELL";
  if (d === "NO_TRADE" || d === "NOTRADE" || d === "NO TRADE") return "NO_TRADE";
  return null;
}

export function validateSignal(raw: RawSignal, atrField: "atr15m" | "atr5m" = "atr15m"): ValidatedSignal {
  const normalized = normalizeDirection(raw.direction);

  if (normalized === null) {
    return {
      ...raw,
      direction: "NO_TRADE",
      entry: 0,
      stopLoss: 0,
      tp1: 0,
      tp2: 0,
      riskReward: 0,
      rejectedReason: `direzione "${raw.direction}" non riconosciuta`,
    };
  }

  if (normalized === "NO_TRADE") {
    return { ...raw, direction: "NO_TRADE" };
  }

  let { entry, stopLoss, tp1, tp2 } = raw;

  if (entry === null || stopLoss === null || tp1 === null) {
    return {
      ...raw,
      direction: "NO_TRADE",
      entry: 0,
      stopLoss: 0,
      tp1: 0,
      tp2: 0,
      riskReward: 0,
      rejectedReason: `${normalized} scartato: entry/stopLoss/tp1 mancanti`,
    };
  }

  const snapshot = raw.marketSnapshot as { atr15m?: number | null; atr5m?: number | null } | undefined;
  const atr = snapshot?.[atrField] ?? null;
  const stopDistance = Math.abs(entry - stopLoss);
  const stopAtrRatio =
    atr !== null && atr > 0 ? Number((stopDistance / atr).toFixed(2)) : null;

  if (tp2 != null && Number.isFinite(Number(tp2))) {
    const a = Number(tp1);
    const b = Number(tp2);
    if (normalized === "BUY" && b < a) {
      tp1 = b;
      tp2 = a;
    } else if (normalized === "SELL" && b > a) {
      tp1 = b;
      tp2 = a;
    }
  }

  if (normalized === "BUY" && tp1 != null && tp2 != null && !(entry < Number(tp1) && Number(tp1) < Number(tp2))) {
    const near = Math.min(Number(tp1), Number(tp2));
    const far = Math.max(Number(tp1), Number(tp2));
    tp1 = near;
    tp2 = far;
  }
  if (normalized === "SELL" && tp1 != null && tp2 != null && !(entry > Number(tp1) && Number(tp1) > Number(tp2))) {
    const near = Math.max(Number(tp1), Number(tp2));
    const far = Math.min(Number(tp1), Number(tp2));
    tp1 = near;
    tp2 = far;
  }

  const validBuy = normalized === "BUY" && stopLoss < entry && entry < Number(tp1);
  const validSell = normalized === "SELL" && Number(tp1) < entry && entry < stopLoss;

  if (normalized === "BUY" && !validBuy) {
    return {
      ...raw,
      direction: "NO_TRADE",
      entry: 0,
      stopLoss: 0,
      tp1: 0,
      tp2: 0,
      riskReward: 0,
      rejectedReason: `BUY scartato: richiesto SL < Entry < TP1, ricevuto SL=${stopLoss} Entry=${entry} TP1=${tp1}`,
    };
  }

  if (normalized === "SELL" && !validSell) {
    return {
      ...raw,
      direction: "NO_TRADE",
      entry: 0,
      stopLoss: 0,
      tp1: 0,
      tp2: 0,
      riskReward: 0,
      rejectedReason: `SELL scartato: richiesto TP1 < Entry < SL, ricevuto TP1=${tp1} Entry=${entry} SL=${stopLoss}`,
    };
  }

  const reward = Math.abs(tp1 - entry);
  const riskReward = stopDistance > 0 ? Number((reward / stopDistance).toFixed(2)) : 0;

  if (riskReward < MIN_RISK_REWARD) {
    return {
      ...raw,
      direction: "NO_TRADE",
      entry: 0,
      stopLoss: 0,
      tp1: 0,
      tp2: 0,
      riskReward: 0,
      rejectedReason: `${normalized} scartato: rapporto rischio/rendimento reale ${riskReward}, sotto il minimo ${MIN_RISK_REWARD}`,
    };
  }

  if (riskReward > MAX_RISK_REWARD) {
    return {
      ...raw,
      direction: "NO_TRADE",
      entry: 0,
      stopLoss: 0,
      tp1: 0,
      tp2: 0,
      riskReward: 0,
      rejectedReason: `${normalized} scartato: rapporto rischio/rendimento reale ${riskReward}, sopra il massimo ${MAX_RISK_REWARD}`,
    };
  }

  return { ...raw, direction: normalized, tp1, tp2, riskReward, stopAtrRatio };
}
