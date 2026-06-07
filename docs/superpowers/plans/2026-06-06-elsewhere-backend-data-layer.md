# Backend Data Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a Postgres-backed Express API (`GET /api/metros`) on the_litterbox, fed by the existing data pipeline, so the app can fetch live metro data (app-side consumption is Phase 3, not here).

**Architecture:** A self-contained `server/` (Express + pg) added to this monorepo; a `db/schema.sql` for `metros`+`cities`; `scripts/build-metros.py` extended to UPSERT Postgres (env-gated, still emits `metros.json`); a `~/apps/elsewhere` Docker Compose stack (postgres + api + cloudflared + pipeline); and a deploy runbook for the SSH step.

**Tech Stack:** Node 20 + Express + node-postgres (`pg`), Vitest + supertest (server tests live in `server/`), Python 3 + psycopg2 (pipeline), Postgres 16, Docker Compose, Cloudflare Tunnel.

**Working branch:** commit directly to `main` (Mia's active-dev directive — no feature branches this stretch). Run `git fetch && git merge --ff-only origin/main` before starting if local `main` is behind.

---

## File map

- **Create** `db/schema.sql` — `metros` + `cities` tables.
- **Create** `server/package.json` — self-contained API deps (express, cors, pg; supertest dev). `server/node_modules` keeps server deps out of the frontend.
- **Create** `server/map.js` + `server/map.test.js` — pure `mapMetro(row)` (PG row → Metro shape). The testable seam.
- **Create** `server/app.js` + `server/app.test.js` — `createApp(db)` with routes, CORS, cache headers (db injected → testable with a fake).
- **Create** `server/db.js` — real `pg` Pool + `allMetros()`/`health()` (verified at deploy, not unit-tested).
- **Create** `server/index.js` — wires real db + listens.
- **Create** `Dockerfile.api`, `Dockerfile.pipeline`, `docker-compose.yml`, `.env.example`, `.dockerignore`, `scripts/requirements.txt`.
- **Create** `scripts/test_build_metros.py` — stdlib `unittest` for the pipeline's pure helpers.
- **Modify** `scripts/build-metros.py` — add `os`/`quote` imports, `wiki_url`, `metro_upsert_params`, `write_postgres`, `cbsa` on each entry, call `write_postgres(out)` in `main`.
- **Create** `docs/superpowers/deploy/elsewhere-backend-runbook.md` — rsync + ssh deploy steps.

Root `package.json` is **not** modified — server deps are isolated in `server/`, and Vitest (no `include` restriction in `vite.config.ts`) auto-discovers `server/*.test.js`, resolving `supertest`/`express` from `server/node_modules` because resolution is relative to the importing file.

---

## Task 1: Database schema

**Files:**

- Create: `db/schema.sql`

This is an infrastructure artifact (applied against Postgres at deploy, Task 7 runbook). No local unit test — `create table if not exists` makes it idempotent.

- [ ] **Step 1: Write the schema**

Create `db/schema.sql`:

```sql
-- Elsewhere backend schema. Idempotent: safe to re-apply.

create table if not exists metros (
  id                  text primary key,        -- slug "denver-co"
  cbsa                text unique,             -- CBSA FIPS (pipeline join key)
  name                text not null,
  short               text not null,
  states              text[] not null,
  pop                 integer,
  rpp_overall         numeric,
  rpp_housing         numeric,
  rpp_goods           numeric,
  rpp_other_services  numeric,
  politics            numeric,
  temp_f              numeric,
  humidity            numeric,
  aqi                 numeric,
  risk                numeric,
  updated_at          timestamptz not null default now()
);

create table if not exists cities (
  metro_id            text primary key references metros(id) on delete cascade,
  wikipedia_url       text,
  blurb               text,
  summary_source      text,
  summary_updated_at  timestamptz
);

create index if not exists metros_pop_idx on metros (pop desc nulls last);
```

- [ ] **Step 2: Sanity-check the SQL parses (if psql available)**

Run: `command -v psql >/dev/null && psql --no-psqlrc -f db/schema.sql --set ON_ERROR_STOP=1 -d postgres --dry-run 2>/dev/null; echo "schema written"`
Expected: prints `schema written` (psql may be absent locally — that's fine; the file is applied at deploy).

- [ ] **Step 3: Commit**

```bash
git add db/schema.sql
git commit -m "feat(db): schema for metros + cities tables"
```

---

## Task 2: Server scaffold + metro mapper

**Files:**

- Create: `server/package.json`
- Create: `server/map.js`
- Create: `server/map.test.js`

- [ ] **Step 1: Create `server/package.json`**

```json
{
  "name": "elsewhere-api",
  "private": true,
  "type": "module",
  "version": "0.0.1",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^4.21.2",
    "pg": "^8.13.1"
  },
  "devDependencies": {
    "supertest": "^7.0.0"
  }
}
```

- [ ] **Step 2: Install server deps**

Run: `cd server && npm install && cd ..`
Expected: creates `server/node_modules` and `server/package-lock.json`, exit 0.

- [ ] **Step 3: Write the failing test**

Create `server/map.test.js`:

```js
import { describe, it, expect } from "vitest";
import { mapMetro } from "./map.js";

// Mimics a node-postgres row: numeric columns come back as STRINGS, int as number,
// text[] as a JS array, LEFT JOIN columns possibly null.
const pgRow = {
  id: "denver-co",
  cbsa: "19740",
  name: "Denver-Aurora-Centennial, CO",
  short: "Denver",
  states: ["CO"],
  pop: 2986000,
  rpp_overall: "104.4",
  rpp_housing: "118.2",
  rpp_goods: "99.1",
  rpp_other_services: "101.0",
  politics: "18.0",
  temp_f: null,
  humidity: null,
  aqi: "42",
  risk: "30.5",
  wikipedia_url: "https://en.wikipedia.org/wiki/Denver",
  blurb: null,
};

describe("mapMetro", () => {
  it("reassembles the nested rpp object with numeric (not string) values", () => {
    const m = mapMetro(pgRow);
    expect(m.rpp).toEqual({
      overall: 104.4,
      housing: 118.2,
      goods: 99.1,
      otherServices: 101.0,
    });
    expect(typeof m.rpp.overall).toBe("number");
  });

  it("copies identity + numeric lifestyle fields, coercing to numbers", () => {
    const m = mapMetro(pgRow);
    expect(m.id).toBe("denver-co");
    expect(m.short).toBe("Denver");
    expect(m.states).toEqual(["CO"]);
    expect(m.pop).toBe(2986000);
    expect(m.politics).toBe(18);
    expect(m.aqi).toBe(42);
    expect(m.risk).toBe(30.5);
  });

  it("omits absent (null) optional fields rather than emitting null", () => {
    const m = mapMetro(pgRow);
    expect("tempF" in m).toBe(false);
    expect("humidity" in m).toBe(false);
    expect("blurb" in m).toBe(false);
  });

  it("includes city detail when present", () => {
    const m = mapMetro(pgRow);
    expect(m.wikipedia_url).toBe("https://en.wikipedia.org/wiki/Denver");
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run server/map.test.js`
Expected: FAIL — cannot resolve `./map.js`.

- [ ] **Step 5: Write the mapper**

Create `server/map.js`:

```js
// PG row (snake_case; numerics arrive as strings) -> the Metro shape the app
// already consumes. Absent optional fields are omitted, not set to null.
const num = (v) => (v == null ? undefined : Number(v));

export function mapMetro(row) {
  const m = {
    id: row.id,
    name: row.name,
    short: row.short,
    states: row.states,
    rpp: {
      overall: num(row.rpp_overall),
      housing: num(row.rpp_housing),
      goods: num(row.rpp_goods),
      otherServices: num(row.rpp_other_services),
    },
  };
  if (row.pop != null) m.pop = row.pop;
  if (row.politics != null) m.politics = num(row.politics);
  if (row.temp_f != null) m.tempF = num(row.temp_f);
  if (row.humidity != null) m.humidity = num(row.humidity);
  if (row.aqi != null) m.aqi = num(row.aqi);
  if (row.risk != null) m.risk = num(row.risk);
  if (row.cbsa != null) m.cbsa = row.cbsa;
  if (row.wikipedia_url != null) m.wikipedia_url = row.wikipedia_url;
  if (row.blurb != null) m.blurb = row.blurb;
  return m;
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run server/map.test.js`
Expected: PASS (4 tests).

- [ ] **Step 7: Commit**

```bash
git add server/package.json server/package-lock.json server/map.js server/map.test.js
git commit -m "feat(api): server scaffold + mapMetro row mapper"
```

---

## Task 3: Express app + routes

**Files:**

- Create: `server/app.js`
- Create: `server/app.test.js`

- [ ] **Step 1: Write the failing test**

Create `server/app.test.js`:

```js
import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "./app.js";

const sampleMetro = {
  id: "denver-co",
  name: "Denver-Aurora-Centennial, CO",
  short: "Denver",
  states: ["CO"],
  rpp: { overall: 104.4, housing: 118.2, goods: 99.1, otherServices: 101.0 },
  pop: 2986000,
};

const okDb = {
  allMetros: async () => [sampleMetro],
  health: async () => ({
    ok: true,
    count: 1,
    updated_at: "2026-06-06T00:00:00.000Z",
  }),
};
const downDb = {
  allMetros: async () => {
    throw new Error("db down");
  },
  health: async () => {
    throw new Error("db down");
  },
};

describe("createApp", () => {
  it("GET /api/metros returns the metro array with nested rpp + cache header", async () => {
    const res = await request(createApp(okDb)).get("/api/metros");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].id).toBe("denver-co");
    expect(res.body[0].rpp.overall).toBe(104.4);
    expect(res.headers["cache-control"]).toContain("max-age=3600");
  });

  it("echoes an allowed CORS origin", async () => {
    const res = await request(createApp(okDb))
      .get("/api/metros")
      .set("Origin", "http://localhost:5173");
    expect(res.headers["access-control-allow-origin"]).toBe(
      "http://localhost:5173",
    );
  });

  it("GET /api/health returns ok + count + updated_at", async () => {
    const res = await request(createApp(okDb)).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      count: 1,
      updated_at: "2026-06-06T00:00:00.000Z",
    });
  });

  it("returns 503 when the database is unavailable", async () => {
    const res = await request(createApp(downDb)).get("/api/metros");
    expect(res.status).toBe(503);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/app.test.js`
Expected: FAIL — cannot resolve `./app.js`.

- [ ] **Step 3: Write the app factory**

Create `server/app.js`:

```js
import express from "express";
import cors from "cors";

// db is injected (real pool in index.js, a fake in tests). It must expose
// async allMetros() and async health().
export function createApp(db) {
  const allowed = (process.env.CORS_ORIGINS || "http://localhost:5173")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const app = express();
  app.use(cors({ origin: allowed }));

  app.get("/api/health", async (_req, res) => {
    try {
      res.json(await db.health());
    } catch {
      res.status(503).json({ ok: false });
    }
  });

  app.get("/api/metros", async (_req, res) => {
    try {
      const metros = await db.allMetros();
      res.set(
        "Cache-Control",
        "public, max-age=3600, stale-while-revalidate=86400",
      );
      res.json(metros);
    } catch {
      res.status(503).json({ error: "database unavailable" });
    }
  });

  return app;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/app.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add server/app.js server/app.test.js
git commit -m "feat(api): express app with /api/metros, /api/health, CORS, cache headers"
```

---

## Task 4: Real DB module + server entry

**Files:**

- Create: `server/db.js`
- Create: `server/index.js`

These talk to a live Postgres, so they're verified at deploy (runbook), not unit-tested. Keep them minimal.

- [ ] **Step 1: Write the db module**

Create `server/db.js`:

```js
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
```

- [ ] **Step 2: Write the server entry**

Create `server/index.js`:

```js
import { createApp } from "./app.js";
import { db } from "./db.js";

const port = Number(process.env.PORT) || 8080;
createApp(db).listen(port, () => {
  console.log(`elsewhere api listening on :${port}`);
});
```

- [ ] **Step 3: Verify the modules import without a live DB**

Run: `cd server && node -e "import('./app.js').then(m=>console.log(typeof m.createApp))" && cd ..`
Expected: prints `function` (importing `app.js` does not touch Postgres; importing `db.js`/`index.js` would open a pool, so we only smoke-test `app.js` here).

- [ ] **Step 4: Commit**

```bash
git add server/db.js server/index.js
git commit -m "feat(api): pg-backed db module + server entrypoint"
```

---

## Task 5: Docker stack + env

**Files:**

- Create: `Dockerfile.api`
- Create: `Dockerfile.pipeline`
- Create: `docker-compose.yml`
- Create: `.env.example`
- Create: `.dockerignore`
- Create: `scripts/requirements.txt`

Infrastructure files — verified by `docker compose config` if Docker is present, otherwise at deploy.

- [ ] **Step 1: Write `Dockerfile.api`**

```dockerfile
FROM node:20-slim
WORKDIR /app
COPY server/package*.json ./
RUN npm ci --omit=dev
COPY server/ ./
EXPOSE 8080
CMD ["node", "index.js"]
```

- [ ] **Step 2: Write `scripts/requirements.txt`**

```text
psycopg2-binary==2.9.10
```

- [ ] **Step 3: Write `Dockerfile.pipeline`**

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY scripts/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY scripts/ ./scripts/
# DATABASE_URL is provided by compose; the script upserts PG and also writes
# /app/src/data/metros.json (ignored on the box — the API reads PG).
CMD ["python3", "scripts/build-metros.py"]
```

- [ ] **Step 4: Write `docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: elsewhere
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: elsewhere
    volumes:
      - pgdata:/var/lib/postgresql/data
    restart: unless-stopped

  api:
    build:
      context: .
      dockerfile: Dockerfile.api
    environment:
      DATABASE_URL: postgres://elsewhere:${POSTGRES_PASSWORD}@postgres:5432/elsewhere
      CORS_ORIGINS: ${CORS_ORIGINS}
      PORT: "8080"
    depends_on:
      - postgres
    restart: unless-stopped

  cloudflared:
    image: cloudflare/cloudflared:latest
    command: tunnel run
    environment:
      TUNNEL_TOKEN: ${TUNNEL_TOKEN}
    depends_on:
      - api
    restart: unless-stopped

  # Run on demand / via host cron: `docker compose run --rm pipeline`
  pipeline:
    build:
      context: .
      dockerfile: Dockerfile.pipeline
    environment:
      DATABASE_URL: postgres://elsewhere:${POSTGRES_PASSWORD}@postgres:5432/elsewhere
    depends_on:
      - postgres
    profiles: ["manual"]

volumes:
  pgdata:
```

- [ ] **Step 5: Write `.env.example`**

```text
# Copy to .env on the_litterbox (gitignored). Never commit real values.
POSTGRES_PASSWORD=change-me
CORS_ORIGINS=https://elsewhere.pages.dev,http://localhost:5173
TUNNEL_TOKEN=your-cloudflare-tunnel-token
```

- [ ] **Step 6: Write `.dockerignore`**

```text
node_modules
server/node_modules
dist
.git
.superpowers
src/data/metros.json
```

- [ ] **Step 7: Ensure `.env` is gitignored**

Run: `grep -qxF '.env' .gitignore || echo '.env' >> .gitignore; grep -c '.env' .gitignore`
Expected: prints a count ≥ 1.

- [ ] **Step 8: Validate compose (if Docker present)**

Run: `command -v docker >/dev/null && docker compose config -q && echo "compose ok" || echo "docker absent — validate at deploy"`
Expected: prints `compose ok` or the deploy note.

- [ ] **Step 9: Commit**

```bash
git add Dockerfile.api Dockerfile.pipeline docker-compose.yml .env.example .dockerignore scripts/requirements.txt .gitignore
git commit -m "feat(infra): docker compose stack for ~/apps/elsewhere"
```

---

## Task 6: Pipeline port (write Postgres)

**Files:**

- Modify: `scripts/build-metros.py`
- Create: `scripts/test_build_metros.py`

- [ ] **Step 1: Write the failing test**

Create `scripts/test_build_metros.py`:

```python
import importlib.util
import pathlib
import unittest

# Load the hyphenated module by path (can't `import build-metros`).
_spec = importlib.util.spec_from_file_location(
    "build_metros", pathlib.Path(__file__).parent / "build-metros.py"
)
bm = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(bm)


class TestPureHelpers(unittest.TestCase):
    def test_wiki_url_simple(self):
        self.assertEqual(bm.wiki_url("Denver"), "https://en.wikipedia.org/wiki/Denver")

    def test_wiki_url_spaces_become_underscores(self):
        self.assertEqual(
            bm.wiki_url("Salt Lake City"),
            "https://en.wikipedia.org/wiki/Salt_Lake_City",
        )

    def test_upsert_params_order_and_length(self):
        entry = {
            "id": "denver-co",
            "cbsa": "19740",
            "name": "Denver-Aurora-Centennial, CO",
            "short": "Denver",
            "states": ["CO"],
            "pop": 2986000,
            "rpp": {"overall": 1.0, "housing": 2.0, "goods": 3.0, "otherServices": 4.0},
            "politics": 18.0,
            "aqi": 42.0,
        }
        p = bm.metro_upsert_params(entry)
        self.assertEqual(len(p), 15)
        self.assertEqual(p[0], "denver-co")  # id
        self.assertEqual(p[1], "19740")       # cbsa
        self.assertEqual(p[4], ["CO"])        # states
        self.assertEqual(p[6], 1.0)           # rpp_overall
        self.assertEqual(p[9], 4.0)           # rpp_other_services
        self.assertEqual(p[10], 18.0)         # politics
        self.assertIsNone(p[11])              # temp_f absent -> None
        self.assertEqual(p[13], 42.0)         # aqi


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 scripts/test_build_metros.py`
Expected: FAIL — `AttributeError: module 'build_metros' has no attribute 'wiki_url'`.

- [ ] **Step 3: Add imports to `scripts/build-metros.py`**

Change the import line (currently line 19):

```python
import csv, io, json, math, os, re, sys, urllib.request, zipfile
from pathlib import Path
from urllib.parse import quote
```

- [ ] **Step 4: Add the pure helpers + `write_postgres` before `def main()`**

Insert immediately above `def main() -> None:`:

```python
def wiki_url(short: str) -> str:
    """Anchor-city Wikipedia URL (curation happens later in the cities table)."""
    return "https://en.wikipedia.org/wiki/" + quote(short.replace(" ", "_"))


def metro_upsert_params(e: dict) -> tuple:
    """Flatten a metros.json entry into the 15-value row for the metros upsert."""
    rpp = e["rpp"]
    return (
        e["id"],
        e.get("cbsa"),
        e["name"],
        e["short"],
        e["states"],
        e.get("pop"),
        rpp.get("overall"),
        rpp.get("housing"),
        rpp.get("goods"),
        rpp.get("otherServices"),
        e.get("politics"),
        e.get("tempF"),
        e.get("humidity"),
        e.get("aqi"),
        e.get("risk"),
    )


def write_postgres(entries: list[dict]) -> None:
    """UPSERT metros + seed cities(wikipedia_url). Gated on DATABASE_URL so
    local `npm run data:build` (no Postgres) still works — it just skips this."""
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        print("  DATABASE_URL not set — skipping Postgres write", file=sys.stderr)
        return
    import psycopg2
    from psycopg2.extras import execute_values

    conn = psycopg2.connect(dsn)
    try:
        with conn, conn.cursor() as cur:
            execute_values(
                cur,
                """
                insert into metros
                  (id,cbsa,name,short,states,pop,rpp_overall,rpp_housing,
                   rpp_goods,rpp_other_services,politics,temp_f,humidity,aqi,risk,updated_at)
                values %s
                on conflict (id) do update set
                  cbsa=excluded.cbsa, name=excluded.name, short=excluded.short,
                  states=excluded.states, pop=excluded.pop,
                  rpp_overall=excluded.rpp_overall, rpp_housing=excluded.rpp_housing,
                  rpp_goods=excluded.rpp_goods, rpp_other_services=excluded.rpp_other_services,
                  politics=excluded.politics, temp_f=excluded.temp_f,
                  humidity=excluded.humidity, aqi=excluded.aqi, risk=excluded.risk,
                  updated_at=now()
                """,
                [metro_upsert_params(e) for e in entries],
                template="(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,now())",
            )
            execute_values(
                cur,
                """
                insert into cities (metro_id, wikipedia_url) values %s
                on conflict (metro_id) do update set wikipedia_url=excluded.wikipedia_url
                """,
                [(e["id"], wiki_url(e["short"])) for e in entries],
            )
        print(f"  wrote {len(entries)} metros to Postgres", file=sys.stderr)
    finally:
        conn.close()
```

- [ ] **Step 5: Add `cbsa` to each entry + call `write_postgres` in `main()`**

In `main()`, change the entry construction (currently line 299) to include `cbsa`:

```python
        entry = {"id": cid, "cbsa": fips, "name": m["name"].strip(), "short": short, "states": states, "rpp": rpp}
```

Then, after the two existing `print(...)` coverage lines at the end of `main()` (after line 328), add:

```python
    write_postgres(out)
```

- [ ] **Step 6: Run the unit test to verify it passes**

Run: `python3 scripts/test_build_metros.py`
Expected: PASS — `Ran 3 tests ... OK`.

- [ ] **Step 7: Verify local JSON build still works without Postgres**

Run: `npm run data:build 2>&1 | tail -4`
Expected: writes `src/data/metros.json`, prints the coverage line, and prints `DATABASE_URL not set — skipping Postgres write`. No traceback. (Each metro entry now also carries a `cbsa` field — a harmless additive change to the JSON.)

- [ ] **Step 8: Confirm the frontend still type-checks + tests pass with the new JSON field**

Run: `npx vue-tsc --noEmit && npx vitest run 2>&1 | tail -3`
Expected: tsc clean; all tests pass (the extra `cbsa` key in `metros.json` is ignored by the `as Metro[]` cast).

- [ ] **Step 9: Commit**

```bash
git add scripts/build-metros.py scripts/test_build_metros.py src/data/metros.json
git commit -m "feat(pipeline): upsert metros + seed cities into Postgres (env-gated)"
```

---

## Task 7: Deploy runbook

**Files:**

- Create: `docs/superpowers/deploy/elsewhere-backend-runbook.md`

Documentation — no test. This is the SSH/deploy step Mia runs (or authorizes) after everything above is green.

- [ ] **Step 1: Write the runbook**

Create `docs/superpowers/deploy/elsewhere-backend-runbook.md`:

````markdown
# Deploy: Elsewhere backend → the_litterbox

Stack: `~/apps/elsewhere` (postgres + api + cloudflared + pipeline). Pattern matches
grave-goods (Docker Compose + Cloudflare Tunnel, rsync from the Mac). Run from the
repo root on the Mac. Replace `LITTERBOX` with the box's ssh host alias.

## 1. Sync code to the box

```bash
rsync -av --delete \
  server/ db/ scripts/ docker-compose.yml Dockerfile.api Dockerfile.pipeline \
  --exclude node_modules --exclude '__pycache__' \
  LITTERBOX:~/apps/elsewhere/
```

(Copy each top-level path; `server/node_modules` is excluded — the image installs deps.)

## 2. Create the secrets file on the box (first time only)

```bash
ssh LITTERBOX
cd ~/apps/elsewhere
cp .env.example .env   # if you rsynced it; otherwise create .env
# edit .env: set a strong POSTGRES_PASSWORD, CORS_ORIGINS (the Pages origin),
# and TUNNEL_TOKEN from the Cloudflare tunnel for this app.
```

## 3. Bring up Postgres + API + tunnel

```bash
docker compose up -d postgres api cloudflared
```

## 4. Apply the schema

```bash
docker compose exec -T postgres psql -U elsewhere -d elsewhere < ~/apps/elsewhere/db/schema.sql
```

## 5. Populate the data (run the pipeline once)

```bash
docker compose run --rm pipeline
```

Expect the coverage line and `wrote N metros to Postgres`.

## 6. Wire the Cloudflare Tunnel hostname

In the Cloudflare dashboard → the tunnel for this app → Published application routes:
add a public hostname (e.g. `data.<your-domain>`) → service `http://api:8080`.

## 7. Verify

```bash
curl -s https://data.<your-domain>/api/health   # -> {"ok":true,"count":...,"updated_at":...}
curl -s https://data.<your-domain>/api/metros | head -c 200
```

## 8. Schedule the daily refresh (host cron on the box)

```bash
crontab -e
# daily at 04:30 — refresh gov data into Postgres
30 4 * * * cd ~/apps/elsewhere && /usr/bin/docker compose run --rm pipeline >> ~/apps/elsewhere/pipeline.log 2>&1
```

## Update later (code change)

Re-run step 1 (rsync), then `docker compose up -d --build api` (and re-run the
pipeline if the script changed). Schema changes: re-run step 4 (idempotent).
````

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/deploy/elsewhere-backend-runbook.md
git commit -m "docs(deploy): runbook for the elsewhere backend stack"
```

---

## Self-review notes (reconciled against the spec)

- **Spec coverage:** schema (T1) ✓; Express API /api/metros + /api/health + CORS + cache (T3) ✓; pg db module (T4) ✓; pipeline UPSERT + cities seed, env-gated, still emits JSON (T6) ✓; Docker stack 4 containers + own postgres (T5) ✓; deploy/SSH runbook + daily cron (T7) ✓; testing via mapMetro + mocked-db route tests + stdlib unittest for pipeline (T2/T3/T6) ✓.
- **Shape compatibility:** `mapMetro` reassembles `rpp:{overall,housing,goods,otherServices}` and coerces pg numeric-strings to numbers → matches the app's `Metro`. The added `cbsa` key in `metros.json` is additive and ignored by the `as Metro[]` cast (verified in T6 step 8).
- **No live infra in build tasks:** every task runs/tests on the Mac; Postgres is only touched at deploy (T7). The pipeline's PG write is gated on `DATABASE_URL`.
- **Type/name consistency:** `db` exposes `allMetros()`/`health()` — used identically in `app.js`, `app.test.js`, and `db.js`. `metro_upsert_params` returns 15 values matching the 15 `%s` + `now()` template (16 columns).
- **Isolation:** server deps live in `server/package.json` (not root); Vitest discovers `server/*.test.js` and resolves them from `server/node_modules`.
