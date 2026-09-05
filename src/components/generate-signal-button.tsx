"use client";
import { useState } from "react";

export function GenerateSignalButton({ label = "Genera segnale ORB" }: { label?: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function chiama(confermaChiusura: boolean) {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confermaChiusura }),
    });
    return res.json();
  }

  async function run() {
    setBusy(true);
    setMsg(null);
    try {
      let data = await chiama(false);
      if (data.skipped && (data.reason === "conferma_richiesta" || data.reason === "conferma_richiesta_attesa")) {
        const r = data.risultatoR !== null && data.risultatoR !== undefined ? ` (${data.risultatoR}R)` : "";
        const ok = window.confirm(
          `C'è un ${data.direction} aperto da ${data.minutiAperto ?? "?"} min${r}. Vuoi comunque generare un nuovo segnale?`
        );
        if (!ok) {
          setMsg("Trade aperto, nessuna nuova analisi.");
          return;
        }
        data = await chiama(true);
      }
      if (data.skipped && data.reason === "fuori_finestra_weekend") setMsg("Fuori dalla finestra weekend (SOLO_WEEKEND attivo)");
      else if (data.skipped && data.reason === "signal_active") setMsg("Trade aperto, nessuna nuova analisi.");
      else if (data.direction === "NO_TRADE") setMsg(data.rejectedReason || "Nessun setup");
      else if (data.direction) setMsg(`${data.direction} generato`);
      else setMsg(data.error || "Errore");
      location.reload();
    } catch {
      setMsg("Errore di rete");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <button onClick={run} disabled={busy} className="w-full rounded-lg bg-gold text-black font-semibold py-2 disabled:opacity-50">
        {busy ? "Analisi ORB…" : label}
      </button>
      {msg && <p className="text-xs text-muted">{msg}</p>}
    </div>
  );
}
