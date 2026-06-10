import pg from "pg";
import { mapMetro } from "./map.js";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

// idle clients error when postgres restarts; without a listener that's an
// uncaught exception that takes the whole process down
pool.on("error", (err) => console.error("pg pool error:", err.message));

// pipeline cron is weekly — one missed run + a day of slack means stale
const STALE_AFTER_MS = 8 * 24 * 60 * 60 * 1000;

/** True when the last pipeline write is missing or older than the cron cadence allows. */
export function isStale(updatedAt, now = Date.now()) {
  if (!updatedAt) return true;
  return now - new Date(updatedAt).getTime() > STALE_AFTER_MS;
}

const SELECT_METROS = `
  select m.*, c.wikipedia_url, c.blurb, c.summary_source, c.summary_updated_at
  from metros m
  left join cities c on c.metro_id = m.id
  order by m.pop desc nulls last`;

export const db = {
  async allMetros() {
    const { rows } = await pool.query(SELECT_METROS);
    return rows.map(mapMetro);
  },
  async health() {
    const { rows } = await pool.query(
      "select count(*)::int as count, max(updated_at) as updated_at from metros",
    );
    const row = rows[0] ?? {};
    return {
      ok: true,
      count: row.count ?? 0,
      updated_at: row.updated_at ?? null,
      stale: isStale(row.updated_at),
    };
  },
  pool,
};
