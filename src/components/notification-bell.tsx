"use client";
import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing } from "lucide-react";
import { getNotificationPermission, isPushSupported, getExistingPushSubscription, subscribeToPush } from "@/lib/notifications";

type Status = "granted" | "denied" | "default" | "unsupported" | "loading";

export function NotificationBell() {
  const [status, setStatus] = useState<Status>("default");
  const [open, setOpen] = useState(false);
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
  }
  const Icon = status === "granted" ? BellRing : status === "denied" ? BellOff : Bell;
  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-panel2 text-muted hover:text-gold">
        <Icon size={16} />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-72 rounded-xl border border-border bg-panel p-4 z-50">
          <p className="text-sm font-medium text-text mb-2">Notifiche ORB</p>
          {status === "granted" && <p className="text-xs text-buy">Notifiche attive</p>}
          {status === "default" && (
            <button onClick={handleEnable} className="w-full rounded-lg bg-gold text-black text-xs font-semibold py-2">Attiva notifiche</button>
          )}
          {status === "denied" && <p className="text-xs text-sell">Permesso negato</p>}
          {status === "unsupported" && <p className="text-xs text-muted">Push non supportate</p>}
        </div>
      )}
    </div>
  );
}
