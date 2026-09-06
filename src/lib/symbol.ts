// Unica fonte del simbolo: METAAPI_SYMBOL (default ETHUSD).
export const APP_NAME = "ETH Weekend";

export function getTradingSymbol(): string {
  return (process.env.METAAPI_SYMBOL || process.env.METAAPI_SYMBOL_BTCUSD || "ETHUSD").trim();
}

export function getSymbolLabel(symbol = getTradingSymbol()): string {
  const base = symbol.replace(/[^A-Za-z]/g, "").toUpperCase();
  if (base.startsWith("ETH")) return "Ethereum / USD";
  if (base.startsWith("BTC")) return "Bitcoin / USD";
  if (base.length >= 6) return `${base.slice(0, 3)} / ${base.slice(3, 6)}`;
  return symbol;
}

export function getTradingViewSymbol(symbol = getTradingSymbol()): string {
  const cleaned = symbol.replace(/[^A-Za-z]/g, "").toUpperCase();
  const pair = cleaned.endsWith("M") && cleaned.length > 3 ? cleaned.slice(0, -1) : cleaned;
  return `BITSTAMP:${pair || "ETHUSD"}`;
}
