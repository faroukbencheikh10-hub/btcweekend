import { chiamateAttive } from "./db";

export async function chiamaSeAttivo(testo: string) {
  if (!(await chiamateAttive())) return { skipped: true };
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  const to = process.env.TWILIO_TO_NUMBER;
  if (!sid || !token || !from || !to) return { skipped: true, reason: "twilio_missing" };
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json`;
  const body = new URLSearchParams({
    To: to,
    From: from,
    Twiml: `<Response><Say language="it-IT">${testo}</Say></Response>`,
  });
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64") },
    body,
  });
  return { ok: res.ok };
}
