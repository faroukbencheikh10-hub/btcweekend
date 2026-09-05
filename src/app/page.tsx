import { AppHeader } from "@/components/app-header";
import { ChartPanel } from "@/components/chart-panel";
import { GenerateSignalButton } from "@/components/generate-signal-button";
import { MetaApiToggle } from "@/components/metaapi-toggle";
import { SignalPanel } from "@/components/signal-panel";
import { SignalHistory } from "@/components/signal-history";
import { PerformanceStatsPanel } from "@/components/performance-stats";
import { getLatestMarketSnapshot, getLatestSignal, getSignalHistory, getStats } from "@/lib/server/db";
import { MarketQuote, TradeSignal, PerformanceStats } from "@/lib/types";

export const dynamic = "force-dynamic";

function mapSignalRow(row: any): TradeSignal {
  return {
    id: row.id,
    createdAt: row.created_at,
    direction: row.direction,
    entry: Number(row.entry),
    stopLoss: Number(row.stop_loss),
    tp1: Number(row.tp1),
    tp2: Number(row.tp2),
    riskReward: Number(row.risk_reward),
    confidence: Number(row.confidence),
    reasoning: row.reasoning,
    outcome: row.outcome ?? undefined,
    resultR: row.result_r !== null && row.result_r !== undefined ? Number(row.result_r) : undefined,
    attivatoIl: row.attivato_il ?? null,
    isDemo: false,
  };
}

export default async function Home() {
  let snap: any = null;
  let latest: any = null;
  let history: any[] = [];
  let statsRow: any = null;
  try {
    [snap, latest, history, statsRow] = await Promise.all([
      getLatestMarketSnapshot(),
      getLatestSignal(),
      getSignalHistory(20),
      getStats(),
    ]);
  } catch {}

  const decided = Number(statsRow?.decided ?? 0);
  const stats: PerformanceStats = {
    totalSignals: Number(statsRow?.total ?? 0),
    winRate: decided > 0 ? Math.round((Number(statsRow?.wins ?? 0) / decided) * 100) : null,
    avgRR: statsRow?.avg_rr != null ? Number(statsRow.avg_rr) : null,
    bestCondition: null,
  };

  const quote: MarketQuote = {
    symbol: "BTCUSD",
    label: "Bitcoin / USD",
    price: snap?.xauusd != null ? Number(snap.xauusd) : null,
    changePercent: snap?.xauusd_change_pct != null ? Number(snap.xauusd_change_pct) : null,
    status: snap ? "live" : "disconnected",
  };

  const current = latest ? mapSignalRow(latest) : null;
  const rows = history.map(mapSignalRow);

  return (
    <div className="min-h-screen">
      <AppHeader quote={quote} />
      <main className="mx-auto max-w-[1100px] px-4 py-6 space-y-4">
        <ChartPanel />
        <GenerateSignalButton label="Genera segnale ORB" />
        <MetaApiToggle />
        <SignalPanel signal={current} />
        <SignalHistory signals={rows} />
        <PerformanceStatsPanel stats={stats} />
      </main>
    </div>
  );
}
