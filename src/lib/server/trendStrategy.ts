// ORB sul grafico M5 su BTCUSD, 24/7. Niente ICT, niente AI, niente filtri orari.
// Trova il box delle candele precedenti e entra sulla chiusura fuori.
//
// Le soglie erano in dollari fissi tarate sull'oro (~4400$): 5-18$ di box,
// 8$ di inseguimento massimo, 20$ di candela shock, TP1 12$, TP2 20-30$.
// Sul bitcoin il prezzo e' su un'altra scala, quindi qui le stesse soglie
// sono espresse in PERCENTUALE del prezzo e ricalcolate ad ogni ciclo,
// cosi' la logica resta identica a quella dell'oro qualunque sia il prezzo.

export type DirezioneTrade = "BUY" | "SELL";
export type SetupNome = "orb";

export interface SetupTrend {
  ok: boolean;
  direzione: DirezioneTrade | null;
  entry: number | null;
  stopLoss: number | null;
  tp1: number | null;
  tp2: number | null;
  rischioRendimento: number;
  zona: string | null;
  motivo: string;
  setup: SetupNome | null;
}

type Candle = {
  open: string | number;
  high: string | number;
  low: string | number;
  close: string | number;
  datetime?: string;
};

type Bar = { o: number; h: number; l: number; c: number; t: Date };

// Percentuali del prezzo (riferimento oro 4400$: 5$ = 0.11%, 18$ = 0.41%, ecc.)
const BOX_MIN_PCT = 0.0011;
const BOX_MAX_PCT = 0.0041;
const NO_CHASE_PCT = 0.0018;
const SHOCK_M5_PCT = 0.0045;
const ORB_TP1_MIN_PCT = 0.0027;
const ORB_TP2_MIN_PCT = 0.0045;
const ORB_TP2_MAX_PCT = 0.0068;
const RISCHIO_MIN_PCT = 0.00034;
const STOP_BUFFER_PCT = 0.00009;
const MIN_RR = 1.5;
const LUNGHEZZE_BOX = [8, 10, 12, 16];

type Soglie = {
  boxMin: number;
  boxMax: number;
  noChase: number;
  shockM5: number;
  tp1Min: number;
  tp2Min: number;
  tp2Max: number;
  rischioMin: number;
  stopBuffer: number;
};

function soglieDaPrezzo(prezzo: number): Soglie {
  const r = (pct: number) => Number((prezzo * pct).toFixed(2));
  return {
    boxMin: r(BOX_MIN_PCT),
    boxMax: r(BOX_MAX_PCT),
    noChase: r(NO_CHASE_PCT),
    shockM5: r(SHOCK_M5_PCT),
    tp1Min: r(ORB_TP1_MIN_PCT),
    tp2Min: r(ORB_TP2_MIN_PCT),
    tp2Max: r(ORB_TP2_MAX_PCT),
    rischioMin: r(RISCHIO_MIN_PCT),
    stopBuffer: r(STOP_BUFFER_PCT),
  };
}

function n(v: unknown): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : NaN;
}

function no(motivo: string): SetupTrend {
  return {
    ok: false,
    direzione: null,
    entry: null,
    stopLoss: null,
    tp1: null,
    tp2: null,
    rischioRendimento: 0,
    zona: null,
    motivo,
    setup: null,
  };
}

function chiuseCronologiche(candele: Candle[] | undefined): Bar[] {
  if (!Array.isArray(candele) || candele.length < 3) return [];
  const out: Bar[] = [];
  for (let i = 1; i < candele.length; i++) {
    const row = candele[i];
    const o = n(row.open);
    const h = n(row.high);
    const l = n(row.low);
    const c = n(row.close);
    const t = row.datetime ? new Date(row.datetime) : null;
    if (![o, h, l, c].every(Number.isFinite) || !t || Number.isNaN(t.getTime())) continue;
    out.push({ o, h, l, c, t });
  }
  out.sort((a, b) => a.t.getTime() - b.t.getTime());
  return out;
}

function boxDa(bars: Bar[]): { high: number; low: number; size: number; n: number } | null {
  if (bars.length < 6) return null;
  const high = Math.max(...bars.map((b) => b.h));
  const low = Math.min(...bars.map((b) => b.l));
  const size = Number((high - low).toFixed(2));
  if (!Number.isFinite(size) || size <= 0) return null;
  return { high: Number(high.toFixed(2)), low: Number(low.toFixed(2)), size, n: bars.length };
}

function scegliBox(prima: Bar[], sg: Soglie): { high: number; low: number; size: number; n: number } | null {
  const candidati: { high: number; low: number; size: number; n: number }[] = [];
  for (const len of LUNGHEZZE_BOX) {
    if (prima.length < len) continue;
    const box = boxDa(prima.slice(-len));
    if (!box) continue;
    if (box.size < sg.boxMin || box.size > sg.boxMax) continue;
    candidati.push(box);
  }
  if (candidati.length === 0) return null;
  candidati.sort((a, b) => a.size - b.size);
  return candidati[0];
}

function livelli(
  direzione: DirezioneTrade,
  entry: number,
  stopLoss: number,
  tp1Dist: number,
  tp2Dist: number,
  rischioMin: number
): { stopLoss: number; tp1: number; tp2: number; rr: number } | null {
  const sl = Number(stopLoss.toFixed(2));
  const en = Number(entry.toFixed(2));
  const rischio = Math.abs(en - sl);
  if (rischio < rischioMin) return null;
  const tp1 =
    direzione === "BUY" ? Number((en + tp1Dist).toFixed(2)) : Number((en - tp1Dist).toFixed(2));
  const tp2 =
    direzione === "BUY" ? Number((en + tp2Dist).toFixed(2)) : Number((en - tp2Dist).toFixed(2));
  const rr = Number((Math.abs(tp1 - en) / rischio).toFixed(2));
  if (rr < MIN_RR) return null;
  if (direzione === "BUY" && !(sl < en && en < tp1)) return null;
  if (direzione === "SELL" && !(tp1 < en && en < sl)) return null;
  return { stopLoss: sl, tp1, tp2, rr };
}

function orbTargets(rischio: number, sg: Soglie): { tp1: number; tp2: number } {
  const tp1 = Math.max(sg.tp1Min, Number((rischio * 1.6).toFixed(2)));
  const tp2 = Math.min(sg.tp2Max, Math.max(sg.tp2Min, Number((rischio * 2.4).toFixed(2))));
  return { tp1, tp2 };
}

export function valutaSetupTrend(input: {
  prezzo: number;
  atr15m: number | null;
  atr1h?: number | null;
  session?: { sessione?: string | null } | null;
  candles?: { "5m"?: Candle[]; "15m"?: Candle[]; "1h"?: Candle[]; "4h"?: Candle[] } | null;
}): SetupTrend {
  const prezzo = n(input.prezzo);
  if (!Number.isFinite(prezzo) || prezzo <= 0) return no("Prezzo BTCUSD non disponibile.");
  const sg = soglieDaPrezzo(prezzo);

  const m5 = chiuseCronologiche(input.candles?.["5m"]);
  if (m5.length < 14) return no("Candele M5 insufficienti per leggere il box.");

  const last = m5[m5.length - 1];
  const prima = m5.slice(0, -1);
  const box = scegliBox(prima, sg);
  if (!box) {
    const grezzo = boxDa(prima.slice(-12));
    const size = grezzo ? grezzo.size.toFixed(2) : "?";
    return no(`Nessun box M5 valido (serve ${sg.boxMin}–${sg.boxMax}$). Range recente ${size}$.`);
  }

  if (last.h - last.l >= sg.shockM5) {
    return no(`Candela M5 da ${(last.h - last.l).toFixed(1)}$: shock, non si insegue.`);
  }

  const closeBuy = last.c > box.high;
  const closeSell = last.c < box.low;
  if (!closeBuy && !closeSell) {
    return no(`Prezzo nel box ${box.low}–${box.high} (${box.size.toFixed(2)}$, ${box.n} M5). Aspetto chiusura fuori.`);
  }

  const direzione: DirezioneTrade = closeBuy ? "BUY" : "SELL";
  const bordo = direzione === "BUY" ? box.high : box.low;
  const oltre = Math.abs(last.c - bordo);
  if (oltre > sg.noChase) {
    return no(`Chiusura già ${oltre.toFixed(1)}$ oltre il bordo ${bordo}. Niente inseguimento.`);
  }

  const entry = Number(prezzo.toFixed(2));
  const stopLoss = direzione === "BUY" ? box.low - sg.stopBuffer : box.high + sg.stopBuffer;
  const rischio = Math.abs(entry - stopLoss);
  const tgt = orbTargets(rischio, sg);
  const lv = livelli(direzione, entry, stopLoss, tgt.tp1, tgt.tp2, sg.rischioMin);
  if (!lv) return no(`Breakout ${direzione} sul box ${box.size.toFixed(2)}$ ma R:R sotto 1.5.`);

  return {
    ok: true,
    direzione,
    entry,
    stopLoss: lv.stopLoss,
    tp1: lv.tp1,
    tp2: lv.tp2,
    rischioRendimento: lv.rr,
    zona: `box ${box.low}–${box.high}`,
    motivo: `ORB M5 ${direzione}. Box ${box.low}–${box.high} (${box.size.toFixed(2)}$, ${box.n} candele). Chiusura ${last.c.toFixed(2)} fuori. Stop lato opposto. TP1 ${lv.tp1} TP2 ${lv.tp2}. Nessun orario, nessun ICT. Soglie in % del prezzo.`,
    setup: "orb",
  };
}
