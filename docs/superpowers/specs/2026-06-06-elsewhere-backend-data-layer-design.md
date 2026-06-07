# Elsewhere — backend data layer (the_litterbox)

**Date:** 2026-06-06
**Status:** Approved design, ready for implementation plan
**Topic:** Move metro data from a bundled static JSON to Postgres on the_litterbox, served by an Express API the app fetches live (Phase 2 of the option-1 hybrid plan).

## Problem

Today the app bundles `src/data/metros.json` into the JS at build time (static, offline, deployed to Cloudflare Pages). Fresh/"real" data means a server users actually fetch from. This builds the **backend foundation**: a Postgres database + Express API on the_litterbox, fed by the existing data pipeline on a cron. The app's switch to fetching it (with cache + bundled fallback) is **Phase 3**, out of scope here.

## Scope

**In:** Postgres schema (`metros` + `cities`), port `scripts/build-metros.py` to UPSERT Postgres (still emitting `metros.json` as the fallback), an Express API (`GET /api/metros`, `GET /api/health`), a Docker Compose stack for `~/apps/elsewhere`, and a deploy runbook.

**Out (later phases):** app-side fetch/cache/fallback wiring (Phase 3); AI summary generation (Phase 4); wiring summaries into expandable rows (Phase 5); NOAA climate (separate chip).

## Decisions (locked)

1. **Delivery model:** option 1 — app fetches live + caches + bundled fallback (fallback/app work is Phase 3).
2. **Serving:** an **Express API** (`GET /api/metros`) reading Postgres. Not a static export.
3. **Repo:** **monorepo** — `server/` + `db/` added to this repo; pipeline adapted in place.
4. **Container boundary:** Elsewhere is its **own isolated `~/apps/elsewhere` Compose stack** (own Postgres), separate from grave-goods/portfolio. Mirrors the established the_litterbox pattern.
5. **Cron cadence:** daily (gov data is annual; daily is cheap and keeps "live" honest).
6. **Fallback:** pipeline keeps emitting committed `metros.json` for Phase 3's offline fallback.
7. **API hostname:** a subdomain on a Cloudflare-managed domain — chosen at deploy time, not blocking the build.

## Architecture

`~/apps/elsewhere/` Docker Compose stack (4 containers), exposed via Cloudflare Tunnel:

```
postgres     own named volume — source of truth
api          node:20 Express — GET /api/metros, /api/health — reads PG
cloudflared  tunnel → https://<sub>.<domain>/api/*
pipeline     python:3.12 + psycopg2 — runs build-metros.py on daily cron → UPSERT PG
```

Frontend stays on Cloudflare Pages. Data flow: **cron → pipeline fetches gov sources → UPSERT Postgres → API serves JSON → (Phase 3) app fetches + caches + bundled fallback.**

Monorepo additions:

```
server/
  index.js        Express app (routes, CORS, cache headers)
  db.js           pg Pool (conn from env)
  map.js          mapMetro(row) — PG row → Metro shape (the testable seam)
db/
  schema.sql      tables + indexes
docker-compose.yml
Dockerfile.api    node:20
Dockerfile.pipeline  python:3.12 + psycopg2-binary
scripts/build-metros.py   adapted: same fetch/join, now UPSERTs PG + emits metros.json
docs/superpowers/deploy/elsewhere-backend-runbook.md   rsync+ssh deploy steps
```

## Database schema (`db/schema.sql`)

```sql
create table if not exists metros (
  id                  text primary key,         -- slug "denver-co"
  cbsa                text unique,              -- CBSA FIPS (pipeline join key)
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
  wikipedia_url       text,          -- curated; pipeline seeds a derived value
  blurb               text,          -- AI summary body (null until Phase 4)
  summary_source      text,          -- provenance, e.g. "claude-opus-4-8"
  summary_updated_at  timestamptz
);
```

Explicit numeric columns (not jsonb) so lifestyle attributes are queryable server-side later. The API reassembles `rpp: { overall, housing, goods, otherServices }` so the returned JSON matches what the app consumes today — **zero app-side shape change.**

## Pipeline port (`scripts/build-metros.py`)

- **All existing source fetch/join logic is unchanged.** Only the output stage is added.
- New `write_postgres(metros)`: `INSERT … ON CONFLICT (id) DO UPDATE SET …` for `metros`, via psycopg2 (connection from `DATABASE_URL` / standard `PG*` env). Idempotent and re-runnable. **Gated on `DATABASE_URL` being set** — when absent (e.g. `npm run data:build` on the Mac with no Postgres/psycopg2), the PG write is skipped with a log line and the script still emits `metros.json`. So local builds never require Postgres; only the `pipeline` container (which sets `DATABASE_URL`) writes the DB.
- New `seed_cities(metros)`: UPSERT `cities(metro_id, wikipedia_url)` with a derived anchor-city URL (`https://en.wikipedia.org/wiki/<short with spaces→_>`), leaving `blurb` untouched. Gives DB-backed links immediately; curation/blurbs come later.
- **Still writes `metros.json`** to `src/data/` (committed) as the Phase-3 fallback.
- Connection-less unit-testable helpers: the UPSERT SQL/param builder and the wikipedia-URL derivation are pure functions.
- Runs inside the `pipeline` container on a **daily** cron.

## API (`server/`, Express)

- `GET /api/metros` → `Metro[]`. `metros LEFT JOIN cities` so `wikipedia_url` and `blurb` ride along in one payload (~100 KB; `blurb` null until Phase 4). Reassembles the `rpp` nesting via `mapMetro`.
- `GET /api/health` → `{ ok: true, count, updated_at }` (max `updated_at` across metros).
- **CORS** allow-list: the Cloudflare Pages production origin + `http://localhost:5173` (dev). Reject others.
- **Caching:** `Cache-Control: public, max-age=3600, stale-while-revalidate=86400` + ETag.
- `db.js` = a single pg `Pool`; `map.js` = pure `mapMetro(row)`. Routes stay thin so they're testable with a mocked db module.
- No auth (read-only public data). No write endpoints. YAGNI.

## Deployment (the_litterbox)

The_litterbox enters only here, after local build + tests pass. Pattern from grave-goods (Docker Compose + Portainer + Cloudflare Tunnel, rsync from the Mac, no `gh` on the box):

1. `rsync` `server/ db/ scripts/ docker-compose.yml Dockerfile.* ` → `the_litterbox:~/apps/elsewhere/`.
2. `ssh` in → `docker compose up -d` (postgres + api + cloudflared + pipeline).
3. Apply `db/schema.sql` (`docker compose exec -T postgres psql …`).
4. Run the pipeline once (`docker compose run --rm pipeline`) to populate tables.
5. Add a cloudflared **public hostname** → the api container; confirm `https://<sub>.<domain>/api/health` returns `ok`.

Delivered as a copy-paste **runbook** (`docs/superpowers/deploy/elsewhere-backend-runbook.md`) with exact commands. Mia runs the SSH/deploy (her box + Cloudflare), or explicitly authorizes Claude to. **No live-infra changes happen during the build tasks.**

Secrets (Postgres password, etc.) live in a `.env` on the box (gitignored), never committed. `DATABASE_URL` wired via Compose env.

## Error handling / edge cases

- **Pipeline:** a source fetch failing is logged per-factor (existing `safe()` pattern) and never aborts the upsert of the rows it did get; coverage counts still print. A DB connection failure aborts loudly (cron alerts via non-zero exit).
- **API:** if Postgres is down, `/api/metros` returns `503` (the app then falls back to cache/bundle in Phase 3). `/api/health` reflects DB reachability.
- **Schema:** `create table if not exists` + idempotent upserts → re-running deploy/pipeline is safe.

## Testing (vitest — already in the repo)

- `server/map.test.js`: `mapMetro(row)` produces the exact `Metro` shape incl. nested `rpp`; null lifestyle fields stay absent/optional.
- `server/api.test.js`: `GET /api/metros` with a **mocked `db.js`** (fixture rows) → asserts JSON array shape, the `rpp` nesting, the CORS header, and Cache-Control.
- `scripts` pipeline: unit-test the UPSERT SQL/param builder and the wikipedia-URL derivation as pure functions (no live PG).
- Live Postgres integration is verified manually via the deploy runbook step 5, not in CI.

## Rollout

Single coherent backend delivered, then deployed once via the runbook. The app continues working on its bundled JSON throughout — nothing user-facing changes until Phase 3 flips it to fetch the API. This phase is invisible to users by design; it stands up the foundation.
