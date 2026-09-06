"use client";

import { useState } from "react";
import { getTradingViewSymbol } from "@/lib/symbol";

const TIMEFRAMES = [
  { label: "5m", value: "5" },
  { label: "15m", value: "15" },
  { label: "30m", value: "30" },
] as const;

export function ChartPanel({ symbol }: { symbol: string }) {
  const [tf, setTf] = useState("5");
  const tvSymbol = getTradingViewSymbol(symbol);

  const src =
    `https://www.tradingview.com/widgetembed/?frameElementId=eth-orb-${tf}` +
    `&symbol=${encodeURIComponent(tvSymbol)}&interval=${tf}` +
    `&hidesidetoolbar=0&hidetoptoolbar=0&symboledit=0&saveimage=1` +
    `&toolbarbg=11151c&theme=dark&style=1&timezone=Etc%2FUTC` +
    `&withdateranges=1&hideideas=1&hidevolume=0&locale=it`;

  return (
    <div className="rounded-xl border border-border bg-panel overflow-hidden flex flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">{symbol} — Grafico live</span>
        <div className="flex gap-1 rounded-lg bg-panel2 p-1">
          {TIMEFRAMES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTf(t.value)}
              className={`px-2.5 py-1 text-xs rounded-md font-medium ${
                tf === t.value ? "bg-gold text-white" : "text-muted hover:text-text"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="relative w-full" style={{ height: 520 }}>
        <iframe
          key={tf}
          src={src}
          title={`Grafico ${symbol} ${tf}m`}
          className="absolute inset-0 h-full w-full border-0"
          referrerPolicy="no-referrer-when-downgrade"
          allow="fullscreen; clipboard-write"
        />
      </div>
    </div>
  );
}
