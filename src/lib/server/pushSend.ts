import webpush from "web-push";
import { getAllPushSubscriptions, deletePushSubscription } from "./db";

function configured() {
  return Boolean(process.env.VAPID_PUBLIC_KEY?.trim() && process.env.VAPID_PRIVATE_KEY?.trim());
}

export async function sendPushToAll(payload: { title: string; body: string; url?: string; tag?: string }) {
  if (!configured()) {
    console.error("[push] chiavi VAPID mancanti");
    return { sent: 0, total: 0, skipped: true, errors: [] as string[] };
  }
  webpush.setVapidDetails(
    (process.env.VAPID_SUBJECT || "mailto:orb@local").trim(),
    (process.env.VAPID_PUBLIC_KEY as string).trim(),
    (process.env.VAPID_PRIVATE_KEY as string).trim()
  );
  const subs = await getAllPushSubscriptions();
  let sent = 0;
  const errors: string[] = [];
  for (const row of subs) {
    try {
      await webpush.sendNotification(row.subscription, JSON.stringify(payload));
      sent += 1;
    } catch (err: any) {
      const code = err?.statusCode ?? "?";
      const msg = `${code} ${String(err?.body ?? err?.message ?? err).slice(0, 120)}`;
      console.error("[push] invio fallito:", msg);
      errors.push(msg);
      if (code === 410 || code === 404) {
        await deletePushSubscription(row.endpoint).catch(() => undefined);
      }
    }
  }
  console.log(`[push] inviate ${sent}/${subs.length}`);
  return { sent, total: subs.length, errors };
}
