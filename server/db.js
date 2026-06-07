import pg from "pg";
import { mapMetro } from "./map.js";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

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
    return { ok: true, count: rows[0].count, updated_at: rows[0].updated_at };
  },
  pool,
};
