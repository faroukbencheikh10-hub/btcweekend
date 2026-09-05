"use client";

import { useMemo, useState } from "react";
import { TradeSignal } from "@/lib/types";
import { formatRecency } from "@/lib/formatTime";

const DIRECTION_FILTERS = ["Tutti", "BUY", "SELL"] as const;

function outcomeColor(outcome?: TradeSignal["outcome"]) {
  if (outcome === "WIN") return "text-buy";
  if (outcome === "LOSS") return "text-sell";
  return "text-muted";
}

function directionColor(direction: TradeSignal["direction"]) {
  if (direction === "BUY") return "text-buy";
  if (direction === "SELL") return "text-sell";
  return "text-muted";
}

function directionLabel(direction: TradeSignal["direction"]) {
  return direction === "NO_TRADE" ? "NO TRADE" : direction;
}

function price(n: number) {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(2);
}

export function SignalHistory({
  signals,
  compact = false,
}: {
  signals: TradeSignal[];
  compact?: boolean;
}) {
  const [filter, setFilter] = useState<(typeof DIRECTION_FILTERS)[number]>("Tutti");
  const filtered = useMemo(
    () => (filter === "Tutti" ? signals : signals.filter((s) => s.direction === filter)),
    [signals, filter]
  );

  return (
    <div className="rounded-xl border border-border bg-panel p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4 gap-3">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">Storico segnali</span>
        <div className="flex gap-1 rounded-lg bg-panel2 p-1">
          {DIRECTION_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 text-[11px] rounded-md font-medium ${
                filter === f ? "bg-gold text-white" : "text-muted hover:text-text"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-panel2 py-8 text-center text-sm text-muted">
          Nessun segnale in questa categoria.
        </div>
      ) : (
        <div className="space-y-2 max-h-[420px] overflow-y-auto">
          {filtered.map((s) => (
            <div key={s.id} className="rounded-lg border border-border bg-panel2 px-3 py-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-sm font-semibold ${directionColor(s.direction)}`}>
                  {directionLabel(s.direction)}
                </span>
                <span className="font-mono text-[10px] text-muted">{formatRecency(s.createdAt)}</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <div className="text-[9px] uppercase tracking-wide text-muted">Entry</div>
                  <div className="font-mono text-xs text-text">{price(s.entry)}</div>
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-wide text-muted">SL</div>
                  <div className="font-mono text-xs text-text">{price(s.stopLoss)}</div>
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-wide text-muted">TP1</div>
                  <div className="font-mono text-xs text-text">{price(s.tp1)}</div>
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-wide text-muted">Esito</div>
                  <div className={`font-mono text-xs font-medium ${outcomeColor(s.outcome)}`}>
                    {s.outcome ?? "—"}
                  </div>
                </div>
              </div>
              {s.reasoning && <p className="text-[11px] text-muted mt-2 leading-snug">{s.reasoning}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
