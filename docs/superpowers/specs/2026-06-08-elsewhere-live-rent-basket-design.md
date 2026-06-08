# Elsewhere — Live Rent in the Basket (ZORI)

**Date:** 2026-06-08
**Status:** Approved design → ready for implementation plan
**Scope:** The Basket's rent row only (Tier A). The headline parity number is **not** touched.

## Problem

The Basket's rent line is RPP-derived: `nationalAvg(1500) × (metro.rpp.housing / 100)`. BEA's housing RPP measures overall housing cost level, **not** a specific rent — so Denver (housing RPP 146.9) shows **$2,203**, far above reality, and the row is mislabeled "1-bedroom rent." Rent is the largest, most-felt cost, so a wrong rent poisons trust in the whole basket. This is Slice 3 of the current-data-layer roadmap.

## Decisions (locked)

| Question                | Decision                                                                                                                                                                                                                          |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What changes            | Only the Basket rent row. Headline parity stays BEA-based/stable (Tier A).                                                                                                                                                        |
| Source                  | **Zillow ZORI, all-homes, metro level.** Free for public use **with attribution** ([Zillow terms](https://bridgedataoutput.com/zillowterms)). Monthly, market-based (40–60th-pctile mean ≈ median), smoothed/seasonally-adjusted. |
| Why all-homes (not 1BR) | The metro **all-homes** series is the confirmed, always-published headline file; metro 1BR cuts are not reliably published. All-homes is accurate for "typical rent."                                                             |
| Item relabel            | `"1-bedroom rent"` → **"Typical rent"** — honest to what ZORI measures; removes the mislabel.                                                                                                                                     |
| Join                    | Zillow `CountyCrossWalk_Zillow.csv` maps `MetroRegionID → CBSACode` → clean join to our CBSA-keyed metros.                                                                                                                        |
| Integration             | Fold into the existing metros pipeline → Postgres → `/api/metros` (rent is per-metro, same grain). No separate `rent.json`.                                                                                                       |
| Fallback                | Metros ZORI doesn't cover → RPP-derived estimate with a national typical-rent seed (~$2,010), labeled "est."                                                                                                                      |
| Attribution             | Required: rent row `note` shows "Zillow ZORI"; basket footer shows "Rent data © Zillow".                                                                                                                                          |
| HUD FMR                 | Dropped (1BR-specific, doesn't match an all-homes item; ZORI covers our metros). Documented as an alternative.                                                                                                                    |

## Architecture

Rent is one value per metro, so it rides the rails built in Phase 2/3 — no new fetch path on the client:

```
Zillow ZORI CSV ──┐
Zillow crosswalk ─┴─▶ build-metros.py (load_rent) ──▶ metros.json + Postgres `rent`
                                                          │  /api/metros (mapMetro)
                                                          ▼
   bundled snapshot ◀─ localStorage cache ◀─ app fetch (useComparison.metros)
                                                          │
                                                          ▼
                                  localizeBasket(from, to, items)  ── rent row uses metro.rent
                                                          ▼
                                              BasketList (note + footer credit)
```

## Components

### 1. Pipeline — `scripts/build-metros.py`

- `load_zillow_crosswalk()` → `{ MetroRegionID: CBSACode }` from `CountyCrossWalk_Zillow.csv`.
- `load_rent(crosswalk)` → fetch the ZORI all-homes **metro** CSV; for each row take the **latest non-empty month** column as the current rent; map `RegionID → CBSA` via the crosswalk; return `{ cbsa: round(rent) }`. Defensive: skip rows that don't map or don't parse; never throw (wrap in the existing `safe()`).
- In `main()`: attach `rent` to each metro `entry` (→ `metros.json`), and include it in `write_postgres` (new column).
- Coverage line gains `rent`.
- **Vintage:** capture the latest month label (e.g. `2026-05`) once; the app's note renders "Zillow ZORI" (the month is implementation-optional — keep the row note short).

### 2. Schema — `db/schema.sql`

- Add `rent numeric` to `metros`. Idempotent (`create table if not exists` already; for an existing DB the deploy runbook re-applies — add `alter table metros add column if not exists rent numeric;`).

### 3. API — `server/`

- `db.js` `SELECT_METROS` already does `select m.*` → `rent` comes along.
- `map.js` `mapMetro`: `if (row.rent != null) m.rent = num(row.rent)`.

### 4. Types — `src/types.ts`

- `Metro.rent?: number` (annual? no — **monthly** rent dollars, matching ZORI). Comment: "typical monthly market rent (Zillow ZORI, all homes)".

### 5. Basket data + engine — `src/data/basket.json`, `src/engines/basket.ts`, `src/types.ts`

- `basket.json` rent item: `id` stays `rent-1br` (id is stable) but `label` → `"Typical rent"`, `nationalAvg` → `2010` (national ZORI ≈ fallback seed).
- `BasketRow` gains `note?: string`.
- `localizeBasket(from, to, items)` — special-case the rent item id:
  - if `from.rent`/`to.rent` present → use it directly (no RPP), `note = "Zillow ZORI"`.
  - else → `nationalAvg × rpp.housing/100`, `note = "est."`.
  - Implemented via a small per-item resolver so gas/CPI slices reuse the seam (roadmap's "live registry").

### 6. UI — `src/components/BasketList.vue`

- Render `row.note` (small, muted) on rows that have one.
- Footer: add "Rent data © Zillow" alongside the existing "Real cost-of-living data · BEA" credit.

## Error handling / edge cases

- ZORI CSV fetch fails → `safe()` returns `{}` → all metros use RPP fallback ("est."); build still succeeds.
- A metro not in the crosswalk / no ZORI data → `rent` absent → RPP fallback for that row.
- Latest ZORI month is blank for a metro → walk back to the last non-empty month.
- `npm run data:build` on the Mac: ZORI is a public CSV (no token), so rent populates locally too; PG write still gated on `DATABASE_URL`.

## Testing (Vitest + Python unittest)

- `tests/basket.test.ts`: rent row uses `metro.rent` for both cities when present (note "Zillow ZORI"); falls back to `nationalAvg × housing RPP` with note "est." when absent; other items unchanged.
- `server/map.test.js`: `mapMetro` carries `rent` (numeric coercion from PG string).
- `scripts/test_build_metros.py`: crosswalk parse + "latest non-empty month" selection as pure helpers (fixture rows; no network).
- Existing suites stay green (label/seed change won't break the inline-fixture basket test).

## Honest caveats

- ZORI all-homes ≈ typical market rent across all unit types — higher than a strict 1BR, lower than the old RPP-derived figure; labeled "Typical rent" so it's not misread.
- ZORI is asking/observed rent (smoothed), not lease-signed; close enough for a tangible-price basket and clearly attributed.

## Rollout

Single change set, committed to `main`. Deploy = re-run the metros pipeline (now writing `rent`) + apply the `alter table` + redeploy the API (runbook). The app keeps working on bundled/cached data throughout; the rent row improves once the new data lands. Headline parity unchanged.
