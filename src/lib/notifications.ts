export function isNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}
export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (!isNotificationSupported()) return "unsupported";
  return Notification.permission;
}
export async function requestNotificationPermission() {
  if (!isNotificationSupported()) return "unsupported" as const;
  return Notification.requestPermission();
}
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const cleaned = base64String.trim();
  const padding = "=".repeat((4 - (cleaned.length % 4)) % 4);
  const base64 = (cleaned + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}
export function isPushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}
export async function getExistingPushSubscription() {
  if (!isPushSupported()) return null;
  const reg = await navigator.serviceWorker.register("/sw.js");
  return reg.pushManager.getSubscription();
}
export async function subscribeToPush(): Promise<{ ok: boolean; reason?: string }> {
  if (!isPushSupported()) return { ok: false, reason: "unsupported" };
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  if (!publicKey) return { ok: false, reason: "missing_vapid_key" };
  try {
    const permission = await requestNotificationPermission();
    if (permission !== "granted") return { ok: false, reason: permission };
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    if (existing) await existing.unsubscribe();
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription),
    });
    if (!res.ok) return { ok: false, reason: "server_error" };
    return { ok: true };
  } catch {
    return { ok: false, reason: "subscribe_failed" };
  }
}
