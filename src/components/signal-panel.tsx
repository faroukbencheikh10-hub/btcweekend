import { TradeSignal } from "@/lib/types";
import { TrendingUp, TrendingDown, CircleSlash, ShieldAlert } from "lucide-react";
import { formatRecency } from "@/lib/formatTime";

function DirectionBadge({ direction }: { direction: TradeSignal["direction"] }) {
  if (direction === "BUY") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg bg-buy/15 text-buy px-3 py-1.5 text-sm font-semibold">
        <TrendingUp size={16} /> BUY
      </span>
    );
  }
  if (direction === "SELL") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg bg-sell/15 text-sell px-3 py-1.5 text-sm font-semibold">
        <TrendingDown size={16} /> SELL
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg bg-panel2 text-muted px-3 py-1.5 text-sm font-semibold">
      <CircleSlash size={16} /> NO TRADE
    </span>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-panel2 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
      <div className="font-mono text-sm text-text mt-0.5">{value}</div>
    </div>
  );
}

function formatPrice(n: number) {
  if (!Number.isFinite(n) || n === 0) return "—";
  return n.toFixed(2);
}

export function SignalPanel({ signal }: { signal: TradeSignal | null }) {
  if (!signal) {
    return (
      <div className="rounded-xl border border-border bg-panel p-5">
        <div className="flex items-center gap-2 mb-3">
          <ShieldAlert size={16} className="text-muted" />
          <span className="text-xs font-medium uppercase tracking-wide text-muted">Segnale corrente</span>
        </div>
        <p className="text-sm text-muted">Nessun segnale. Premi Genera segnale ORB.</p>
      </div>
    );
  }
  const noTrade = signal.direction === "NO_TRADE";
  return (
    <div className="rounded-xl border border-border bg-panel p-5">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">Segnale corrente</span>
        <span className="font-mono text-[10px] text-muted">{formatRecency(signal.createdAt)}</span>
      </div>
      <div className="flex items-center justify-between mb-4">
        <DirectionBadge direction={signal.direction} />
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wide text-muted">Confidence</div>
          <div className="font-mono text-lg font-semibold text-gold">{Number(signal.confidence) || 0}%</div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        <Metric label="Entry" value={noTrade ? "—" : formatPrice(signal.entry)} />
        <Metric label="Stop Loss" value={noTrade ? "—" : formatPrice(signal.stopLoss)} />
        <Metric label="R:R" value={noTrade || !signal.riskReward ? "—" : signal.riskReward.toFixed(1)} />
        <Metric label="TP1" value={noTrade ? "—" : formatPrice(signal.tp1)} />
        <Metric label="TP2" value={noTrade ? "—" : formatPrice(signal.tp2)} />
        <Metric label="Esito" value={signal.outcome ?? (noTrade ? "nessun trade" : "aperto")} />
      </div>
      <div className="rounded-lg bg-panel2 border border-border px-3 py-2.5">
        <div className="text-[10px] uppercase tracking-wide text-muted mb-1">Spiegazione</div>
        <p className="text-xs text-text leading-relaxed whitespace-pre-wrap">{signal.reasoning || "—"}</p>
      </div>
    </div>
  );
}
