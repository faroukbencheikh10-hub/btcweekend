import pg from "pg";

const { Pool } = pg;
let pool: pg.Pool | undefined;

function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL non impostata");
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 3,
    });
  }
  return pool;
}

export async function ensureSchema() {
  const client = getPool();
  await client.query(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
    CREATE TABLE IF NOT EXISTS signals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      direction TEXT NOT NULL,
      entry NUMERIC NOT NULL,
      stop_loss NUMERIC NOT NULL,
      tp1 NUMERIC NOT NULL,
      tp2 NUMERIC NOT NULL,
      risk_reward NUMERIC NOT NULL,
      confidence NUMERIC NOT NULL,
      reasoning TEXT NOT NULL,
      market_snapshot JSONB,
      outcome TEXT,
      result_r NUMERIC,
      closed_at TIMESTAMPTZ,
      is_demo BOOLEAN NOT NULL DEFAULT false,
      attivato_il TIMESTAMPTZ
    );
    ALTER TABLE signals ADD COLUMN IF NOT EXISTS attivato_il TIMESTAMPTZ;
    CREATE TABLE IF NOT EXISTS market_snapshots (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      xauusd NUMERIC,
      xauusd_change_pct NUMERIC,
      dxy NUMERIC,
      dxy_change_pct NUMERIC,
      us10y NUMERIC,
      us10y_change_pct NUMERIC,
      raw JSONB
    );
    CREATE TABLE IF NOT EXISTS context_snapshots (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      news JSONB,
      calendar JSONB
    );
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      endpoint TEXT NOT NULL UNIQUE,
      subscription JSONB NOT NULL
    );
    CREATE TABLE IF NOT EXISTS signals_5m (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      direction TEXT NOT NULL,
      entry NUMERIC NOT NULL,
      stop_loss NUMERIC NOT NULL,
      tp1 NUMERIC NOT NULL,
      tp2 NUMERIC NOT NULL,
      risk_reward NUMERIC NOT NULL,
      confidence NUMERIC NOT NULL,
      reasoning TEXT NOT NULL,
      market_snapshot JSONB,
      outcome TEXT,
      result_r NUMERIC,
      closed_at TIMESTAMPTZ,
      is_demo BOOLEAN NOT NULL DEFAULT false
    );
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

export async function savePushSubscription(endpoint: string, subscription: unknown) {
  await getPool().query(
    `INSERT INTO push_subscriptions (endpoint, subscription) VALUES ($1,$2)
     ON CONFLICT (endpoint) DO UPDATE SET subscription = EXCLUDED.subscription`,
    [endpoint, JSON.stringify(subscription)]
  );
}
export async function deletePushSubscription(endpoint: string) {
  await getPool().query(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [endpoint]);
}
export async function getAllPushSubscriptions() {
  const res = await getPool().query(`SELECT endpoint, subscription FROM push_subscriptions`);
  return res.rows as { endpoint: string; subscription: any }[];
}

export async function insertSignal(signal: {
  direction: string;
  entry: number | null;
  stopLoss: number | null;
  tp1: number | null;
  tp2: number | null;
  riskReward: number | null;
  confidence: number;
  reasoning: string;
  marketSnapshot?: unknown;
}) {
  const res = await getPool().query(
    `INSERT INTO signals (direction, entry, stop_loss, tp1, tp2, risk_reward, confidence, reasoning, market_snapshot, is_demo, attivato_il)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,false, CASE WHEN $1 IN ('BUY','SELL') THEN now() ELSE NULL END)
     RETURNING id, created_at`,
    [signal.direction, signal.entry ?? 0, signal.stopLoss ?? 0, signal.tp1 ?? 0, signal.tp2 ?? 0, signal.riskReward ?? 0, signal.confidence ?? 0, signal.reasoning ?? "", JSON.stringify(signal.marketSnapshot ?? {})]
  );
  return res.rows[0];
}

export async function insertMarketSnapshot(s: {
  xauusd: number;
  xauusdChangePct: number;
  dxy: number | null;
  dxyChangePct: number | null;
  us10y: number | null;
  us10yChangePct: number | null;
  [k: string]: unknown;
}) {
  await getPool().query(
    `INSERT INTO market_snapshots (xauusd, xauusd_change_pct, dxy, dxy_change_pct, us10y, us10y_change_pct, raw)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [s.xauusd, s.xauusdChangePct, s.dxy, s.dxyChangePct, s.us10y, s.us10yChangePct, JSON.stringify(s)]
  );
}

export async function insertContextSnapshot(news: unknown, calendar: unknown) {
  await getPool().query(`INSERT INTO context_snapshots (news, calendar) VALUES ($1,$2)`, [
    JSON.stringify(news ?? []),
    JSON.stringify(calendar ?? []),
  ]);
}

export async function getLatestMarketSnapshot() {
  const res = await getPool().query(
    `SELECT id, created_at, xauusd, xauusd_change_pct, dxy, dxy_change_pct, us10y, us10y_change_pct,
            raw->>'xauusdQuotedAt' AS xauusd_quoted_at
     FROM market_snapshots ORDER BY created_at DESC LIMIT 1`
  );
  const row = res.rows[0];
  if (!row) return null;
  return { ...row, raw: { xauusdQuotedAt: row.xauusd_quoted_at ?? null } };
}

export async function getLatestContextSnapshot() {
  const res = await getPool().query(`SELECT * FROM context_snapshots ORDER BY created_at DESC LIMIT 1`);
  return res.rows[0] ?? null;
}

export async function getSetting(key: string): Promise<string | null> {
  const res = await getPool().query(`SELECT value FROM app_settings WHERE key = $1`, [key]);
  return res.rows[0]?.value ?? null;
}
export async function setSetting(key: string, value: string) {
  await getPool().query(
    `INSERT INTO app_settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [key, value]
  );
}

export async function getSignalHistory(limit = 20) {
  const res = await getPool().query(
    `SELECT * FROM signals WHERE is_demo = false ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  return res.rows;
}
export async function getLatestSignal() {
  const res = await getPool().query(`SELECT * FROM signals WHERE is_demo = false ORDER BY created_at DESC LIMIT 1`);
  return res.rows[0] ?? null;
}
export async function getSegnaleAttivo() {
  const res = await getPool().query(
    `SELECT * FROM signals WHERE is_demo = false AND direction IN ('BUY','SELL') AND attivato_il IS NOT NULL AND outcome IS NULL ORDER BY attivato_il DESC LIMIT 1`
  );
  return res.rows[0] ?? null;
}
export async function closeSignal(id: string, outcome: "WIN" | "LOSS" | "BREAKEVEN", resultR: number) {
  await getPool().query(`UPDATE signals SET outcome = $2, result_r = $3, closed_at = now() WHERE id = $1`, [id, outcome, resultR]);
}
export async function getStats() {
  const res = await getPool().query(
    `SELECT COUNT(*) FILTER (WHERE is_demo = false AND direction <> 'NO_TRADE') AS total,
            COUNT(*) FILTER (WHERE is_demo = false AND outcome = 'WIN') AS wins,
            COUNT(*) FILTER (WHERE is_demo = false AND outcome IN ('WIN','LOSS')) AS decided,
            AVG(risk_reward) FILTER (WHERE is_demo = false AND direction <> 'NO_TRADE' AND risk_reward > 0) AS avg_rr
     FROM signals`
  );
  return res.rows[0];
}
export async function getSignalHistory5m(limit = 50) {
  const res = await getPool().query(`SELECT * FROM signals_5m WHERE is_demo = false ORDER BY created_at DESC LIMIT $1`, [limit]);
  return res.rows;
}
export async function getStats5m() {
  return { total: 0, wins: 0, decided: 0, avg_rr: null };
}
export async function getLatestSignal5m() {
  const res = await getPool().query(`SELECT * FROM signals_5m WHERE is_demo = false ORDER BY created_at DESC LIMIT 1`);
  return res.rows[0] ?? null;
}
export async function isAiPaused() {
  return (await getSetting("ai_paused")) === "true";
}
export async function setAiPaused(paused: boolean) {
  await setSetting("ai_paused", paused ? "true" : "false");
  if (paused) await setSetting("ai_paused_at", new Date().toISOString());
}
export async function chiamateAttive() {
  return (await getSetting("chiamate_attive")) === "true";
}
export async function setChiamateAttive(attive: boolean) {
  await setSetting("chiamate_attive", attive ? "true" : "false");
}
export async function getTickerState() {
  const [snap, ultimo] = await Promise.all([
    getPool().query(`SELECT xauusd, xauusd_change_pct, created_at, raw->>'xauusdQuotedAt' AS xauusd_quoted_at FROM market_snapshots ORDER BY created_at DESC LIMIT 1`),
    getPool().query(`SELECT id, direction, entry, confidence FROM signals WHERE is_demo = false ORDER BY created_at DESC LIMIT 1`),
  ]);
  const s = snap.rows[0] ?? null;
  return {
    prezzo: s?.xauusd != null ? Number(s.xauusd) : null,
    variazionePct: s?.xauusd_change_pct != null ? Number(s.xauusd_change_pct) : null,
    snapshotCreatoIl: s?.created_at ?? null,
    quotatoIl: s?.xauusd_quoted_at ? Number(s.xauusd_quoted_at) : null,
    ultimoSegnale: ultimo.rows[0] ?? null,
    ultimoSegnale5m: null,
  };
}
export async function getSegnaliConSnapshot(limit = 3) {
  const res = await getPool().query(`SELECT id, created_at, direction, market_snapshot FROM signals WHERE market_snapshot IS NOT NULL ORDER BY created_at DESC LIMIT $1`, [limit]);
  return res.rows;
}
export async function getSegnaliInAttesa() {
  return [];
}
export async function attivaSegnale(id: string) {
  await getPool().query(`UPDATE signals SET attivato_il = now() WHERE id = $1`, [id]);
}
export async function scadeSegnaleInAttesa(id: string, note: string) {
  await getPool().query(`UPDATE signals SET outcome = 'BREAKEVEN', result_r = 0, closed_at = now() WHERE id = $1`, [id]);
}
