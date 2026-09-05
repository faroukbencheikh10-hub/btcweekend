import webpush from "web-push";
import { getAllPushSubscriptions, deletePushSubscription } from "./db";

function configured() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export async function sendPushToAll(payload: { title: string; body: string; url?: string; tag?: string }) {
  if (!configured()) return { sent: 0, skipped: true };
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:orb@local",
    process.env.VAPID_PUBLIC_KEY as string,
    process.env.VAPID_PRIVATE_KEY as string
  );
  const subs = await getAllPushSubscriptions();
  let sent = 0;
  for (const row of subs) {
    try {
      await webpush.sendNotification(row.subscription, JSON.stringify(payload));
      sent += 1;
    } catch (err: any) {
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        await deletePushSubscription(row.endpoint).catch(() => undefined);
      }
    }
  }
  return { sent };
}
