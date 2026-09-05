"use client";

import { useEffect, useState } from "react";

export function MetaApiToggle() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings/metaapi")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setEnabled(data.enabled !== false && data.metaapi_enabled !== "false");
      })
      .catch(() => {
        if (!cancelled) setEnabled(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/settings/metaapi", { method: "POST" });
      const data = await res.json();
      setEnabled(Boolean(data.enabled));
    } catch {
      // stato invariato
    } finally {
      setBusy(false);
    }
  }

  const paused = enabled === false;
  const label = enabled === null ? "MetaApi: …" : paused ? "MetaApi: IN PAUSA" : "MetaApi: ATTIVO";

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy || enabled === null}
      className={`w-full rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50 ${
        paused
          ? "border-sell/40 bg-sell text-white"
          : "border-buy/40 bg-buy/15 text-buy"
      }`}
    >
      {busy ? "Aggiorno…" : label}
    </button>
  );
}
