import { MarketQuote, TradeSignal, EconomicEvent, NewsItem, PerformanceStats } from "./types";

export const XAUUSD_QUOTE: MarketQuote = {
  symbol: "XAUUSD",
  label: "Oro / USD",
  price: null,
  changePercent: null,
  status: "disconnected",
};
export const DXY_QUOTE: MarketQuote = {
  symbol: "DXY",
  label: "Dollar Index",
  price: null,
  changePercent: null,
  status: "disconnected",
};
export const US10Y_QUOTE: MarketQuote = {
  symbol: "US10Y",
  label: "US 10Y Yield",
  price: null,
  changePercent: null,
  status: "disconnected",
};
export const ECONOMIC_CALENDAR: EconomicEvent[] = [];
export const NEWS_FEED: NewsItem[] = [];
export const CURRENT_SIGNAL: TradeSignal | null = null;
export const SIGNAL_HISTORY: TradeSignal[] = [];
export const PERFORMANCE_STATS: PerformanceStats = {
  totalSignals: 0,
  winRate: null,
  avgRR: null,
  bestCondition: null,
};
