"use client";
import { useEffect, useState } from "react";
import { MarketQuote } from "@/lib/types";
import { DataStatusBadge } from "./data-status-badge";

export function PriceTicker({ quote: initialQuote }: { quote: MarketQuote }) {
  const [quote, setQuote] = useState(initialQuote);
  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      try {
        const res = await fetch("/api/ticker", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!data?.ok) return;
        setQuote((prev) => ({
          ...prev,
          price: data.prezzo !== null ? Number(data.prezzo) : prev.price,
          changePercent: data.variazionePct !== null ? Number(data.variazionePct) : prev.changePercent,
          status: "live",
        }));
      } catch {}
    }
    const interval = setInterval(refresh, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);
  return (
    <div className="flex items-center gap-3">
      <div>
        <div className="text-[11px] uppercase tracking-wide text-muted">{quote.label}</div>
        <div className="font-mono text-xl font-semibold text-text">
          {quote.price !== null ? quote.price.toFixed(2) : "\u2014"}
        </div>
      </div>
      <DataStatusBadge status={quote.status} />
    </div>
  );
}
