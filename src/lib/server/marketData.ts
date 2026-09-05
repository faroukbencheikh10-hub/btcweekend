import { computeATR } from "./atr";
import { metaApiFetchQuote, metaApiFetchM5 } from "./metaApiData";

// Bitcoin quota 24 ore su 24, 7 giorni su 7: nessun mercato chiuso.
// Se SOLO_WEEKEND=true l'app lavora solo quando l'oro e' chiuso
// (venerdi 21:00 UTC -> domenica 22:00 UTC), cioe' quando "soldi" dorme.
function finestraWeekend(d = new Date()) {
  const day = d.getUTCDay();
  const h = d.getUTCHours();
  if (day === 6) return true;
  if (day === 0 && h < 22) return true;
  if (day === 5 && h >= 21) return true;
  return false;
}

export function isMarketOpen() {
  const soloWeekend = (process.env.SOLO_WEEKEND ?? "").trim().toLowerCase() === "true";
  if (!soloWeekend) return true;
  return finestraWeekend();
}

export async function getCurrentPrice(): Promise<number | null> {
  const q = await metaApiFetchQuote();
  return q?.close ?? null;
}

export async function getMarketSnapshot() {
  const [quote, m5] = await Promise.all([metaApiFetchQuote(), metaApiFetchM5(80)]);
  const btcusd = quote?.close ?? Number(m5[0]?.close) ?? 0;
  const primaChiusura = Number(m5[m5.length - 1]?.close);
  const changePct =
    Number.isFinite(primaChiusura) && primaChiusura > 0 && btcusd > 0
      ? Number((((btcusd - primaChiusura) / primaChiusura) * 100).toFixed(3))
      : 0;
  return {
    // Il campo si chiama ancora "xauusd" nel database per non cambiare lo schema:
    // per questo progetto contiene il prezzo BTCUSD.
    xauusd: btcusd,
    xauusdChangePct: changePct,
    dxy: null,
    dxyChangePct: null,
    us10y: null,
    us10yChangePct: null,
    atr5m: computeATR(m5),
    atr15m: null,
    atr1h: null,
    source: "metaapi",
    session: { sessione: "24/7" },
    candles: {
      "5m": m5,
      "15m": [],
      "1h": [],
      "4h": [],
    },
    xauusdQuotedAt: quote?.quotedAt ?? Date.now(),
  };
}
