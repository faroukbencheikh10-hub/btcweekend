const TOKEN = process.env.METAAPI_TOKEN;
const ACCOUNT_ID = process.env.METAAPI_ACCOUNT_ID;
const SYMBOL = process.env.METAAPI_SYMBOL || process.env.METAAPI_SYMBOL_BTCUSD || "BTCUSD";
const RAW_REGION = process.env.METAAPI_REGION;

function regionCandidates(): string[] {
  const raw = RAW_REGION?.trim().toLowerCase();
  if (raw) return [raw];
  return ["backup-new-york", "new-york", "london"];
}

let regioneConfermata: string | null = null;

function clientApiBase(region: string) {
  return `https://mt-client-api-v1.${region}.agiliumtrade.ai`;
}
function marketDataApiBase(region: string) {
  return `https://mt-market-data-client-api-v1.${region}.agiliumtrade.ai`;
}

function isRegionMismatch(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("429")) return false;
  return msg.includes("ENOTFOUND") || msg.includes("fetch failed") || (msg.includes("404") && msg.includes("is not found"));
}

function assertConfigured() {
  if (!TOKEN || !ACCOUNT_ID) {
    throw new Error("MetaApi non configurato: mancano METAAPI_TOKEN / METAAPI_ACCOUNT_ID");
  }
}

const METAAPI_TIMEOUT_MS = 15000;

async function metaApiGet(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), METAAPI_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json", "auth-token": TOKEN as string },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`MetaApi HTTP ${res.status}: ${await res.text()}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function metaApiGetWithRegion(buildUrl: (region: string) => string): Promise<unknown> {
  const candidati = regioneConfermata ? [regioneConfermata] : regionCandidates();
  let ultimoErrore: unknown = null;
  for (const region of candidati) {
    try {
      const data = await metaApiGet(buildUrl(region));
      regioneConfermata = region;
      return data;
    } catch (err) {
      ultimoErrore = err;
      if (isRegionMismatch(err)) {
        if (regioneConfermata === region) regioneConfermata = null;
        continue;
      }
      throw err;
    }
  }
  throw ultimoErrore ?? new Error("MetaApi: nessuna regione valida");
}

export async function metaApiFetchQuote(symbol: string = SYMBOL): Promise<{
  close: number;
  quotedAt: number | null;
} | null> {
  try {
    assertConfigured();
    const data = (await metaApiGetWithRegion(
      (region) => `${clientApiBase(region)}/users/current/accounts/${ACCOUNT_ID}/symbols/${symbol}/current-price`
    )) as { bid?: number; ask?: number; time?: string };
    if (typeof data.bid !== "number" || typeof data.ask !== "number") return null;
    const close = (data.bid + data.ask) / 2;
    if (!Number.isFinite(close)) return null;
    const quotedAt = data.time ? new Date(data.time).getTime() : null;
    return { close, quotedAt: Number.isFinite(quotedAt) ? quotedAt : null };
  } catch (err) {
    console.error("[metaApiData] prezzo fallito:", err);
    return null;
  }
}

const HA_OFFSET = /(?:Z|[+-]\d{2}:?\d{2})$/;

export async function metaApiFetchM5(outputsize = 80, symbol: string = SYMBOL) {
  try {
    assertConfigured();
    const data = (await metaApiGetWithRegion(
      (region) =>
        `${marketDataApiBase(region)}/users/current/accounts/${ACCOUNT_ID}/historical-market-data/symbols/${symbol}/timeframes/5m/candles?limit=${outputsize}`
    )) as Array<{ time: string; open: number; high: number; low: number; close: number }>;
    if (!Array.isArray(data) || data.length === 0) return [];
    const candles = [];
    for (const c of data) {
      const raw = String(c.time ?? "");
      if (!HA_OFFSET.test(raw)) continue;
      const ms = new Date(raw).getTime();
      if (!Number.isFinite(ms)) continue;
      candles.push({
        open: String(c.open),
        high: String(c.high),
        low: String(c.low),
        close: String(c.close),
        datetime: new Date(ms).toISOString(),
      });
    }
    candles.sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime());
    return candles;
  } catch (err) {
    console.error("[metaApiData] candele M5 fallite:", err);
    return [];
  }
}
