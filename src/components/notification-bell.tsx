"use client";
import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing } from "lucide-react";
import { getNotificationPermission, isPushSupported, getExistingPushSubscription, subscribeToPush } from "@/lib/notifications";

type Status = "granted" | "denied" | "default" | "unsupported" | "loading";

export function NotificationBell() {
  const [status, setStatus] = useState<Status>("default");
  const [open, setOpen] = useState(false);
  const [test, setTest] = useState<string | null>(null);
  const [testBusy, setTestBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (!isPushSupported()) return setStatus("unsupported");
      if (getNotificationPermission() === "denied") return setStatus("denied");
      const existing = await getExistingPushSubscription().catch(() => null);
      setStatus(existing ? "granted" : "default");
    })();
  }, []);

  async function handleEnable() {
    setStatus("loading");
    const result = await subscribeToPush();
    setStatus(result.ok ? "granted" : result.reason === "denied" ? "denied" : "default");
    if (!result.ok && result.reason) setTest(`Attivazione fallita: ${result.reason}`);
  }

  async function handleTest() {
    setTestBusy(true);
    setTest(null);
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      const data = await res.json();
      if (!data.ok) setTest(`Errore: ${data.error ?? "sconosciuto"}`);
      else if (data.skipped) setTest("Chiavi VAPID mancanti sul server");
      else if (data.total === 0) setTest("Nessun dispositivo iscritto");
      else setTest(`Inviata a ${data.sent}/${data.total} dispositivi${data.errors?.length ? ` · errore: ${data.errors[0]}` : ""}`);
    } catch {
      setTest("Errore di rete");
    } finally {
      setTestBusy(false);
    }
  }

  const Icon = status === "granted" ? BellRing : status === "denied" ? BellOff : Bell;
  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-panel2 text-muted hover:text-gold">
        <Icon size={16} />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-72 rounded-xl border border-border bg-panel p-4 z-50 space-y-2">
          <p className="text-sm font-medium text-text">Notifiche ORB</p>
          {status === "granted" && <p className="text-xs text-buy">Notifiche attive su questo dispositivo</p>}
          {status === "default" && (
            <button onClick={handleEnable} className="w-full rounded-lg bg-gold text-white text-xs font-semibold py-2">Attiva notifiche</button>
          )}
          {status === "loading" && <p className="text-xs text-muted">Attivazione…</p>}
          {status === "denied" && <p className="text-xs text-sell">Permesso negato nelle impostazioni del browser</p>}
          {status === "unsupported" && <p className="text-xs text-muted">Push non supportate qui. Su iPhone: Safari → Aggiungi alla Home, poi apri dall'icona.</p>}
          <button
            onClick={handleTest}
            disabled={testBusy}
            className="w-full rounded-lg border border-border bg-panel2 text-text text-xs font-medium py-2 disabled:opacity-50"
          >
            {testBusy ? "Invio…" : "Invia notifica di prova"}
          </button>
          {test && <p className="text-[11px] text-muted leading-snug">{test}</p>}
        </div>
      )}
    </div>
  );
}
