# Elsewhere — Afford-page lifestyle filters

**Date:** 2026-06-06
**Status:** Approved design, ready for implementation plan
**Topic:** Add filterable lifestyle attributes (politics, climate, air, risk, tax) to the "Where could I afford?" page.

## Problem

The Afford page (`ExploreView.vue`) ranks every US metro by where your pay stretches furthest — purely on cost. But "where should I move" is more than money: people care about political climate, weather, air, disaster risk, and taxes. We want to attach those attributes to each metro and let the user **filter** the ranked list by them.

This is slice 2 of the project's "current-data layer" direction (slice 1 = live gas in the basket). Same discipline: real government / public sources, joined on the metro's CBSA FIPS, no fabricated values.

## Scope

**In:** 6 factors — political lean, avg temperature, avg humidity, air quality, natural-disaster risk, state income tax. A filter engine, a filter sheet UI, per-row attribute badges, honest missing-data handling.

**Out (YAGNI):** sunshine/clear-days and crime (FBI UCR is per-agency, can't be aggregated to a metro honestly). No re-ranking by lifestyle — filters only _narrow_. No map.

## Decisions (locked)

1. **Political framing:** badge shows the real signed margin (`D+8` / `R+12`); filter has 3 bands — Lean blue / Purple (within ±5 pts) / Lean red.
2. **Election:** 2024 presidential, county-level returns, vote-weighted to the metro.
3. **Missing data:** when a filter is active, metros lacking that datum are **excluded but counted** (`+N hidden · no data`). Never silently dropped.
4. **Filter control:** a bottom **sheet** (reuses the `BreakdownSheet` pattern), not always-visible chips.
5. **Ranking is never changed by filters** — the list stays ordered by required salary.

## Data model

`src/types.ts` — extend `Metro` with optional fields (optional because not every metro matches every source):

```ts
export interface Metro {
  // …existing id, name, short, states, pop, rpp…
  politics?: number; // signed margin in points: +8 = D+8, -12 = R+12
  tempF?: number; // annual avg temperature, °F
  humidity?: number; // annual avg relative humidity, %
  aqi?: number; // median AQI for the year (lower = cleaner)
  risk?: number; // FEMA composite risk score 0–100 (higher = riskier)
}
```

State income tax is **not stored** — it's derived at runtime from `states[0]` via a static rate table (see Filter engine).

## Data pipeline

Extends `scripts/build-metros.py`. Today the script drops the CBSA FIPS after dedup; we keep it in-memory and run an **enrichment pass** over the assembled metros before writing JSON. FIPS stays internal (not required in the output, though harmless if kept).

Each factor is one source. Add a small fetch+join function per factor, mirroring the existing `load_population` / `load_rpp` style. All sources are public, no API key.

| Factor        | Source                                                                                        | Join key                                       | Method                                                                    | Confidence          |
| ------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------- | ------------------- |
| Politics      | County-level 2024 presidential returns (e.g. `tonmcg/US_County_Level_Election_Results_08-24`) | county FIPS → CBSA via Census delineation file | sum D & R votes across the metro's counties; `margin = (D−R)/total × 100` | 🟢                  |
| AQI           | EPA AQS `annual_aqi_by_cbsa_2024.zip`                                                         | CBSA name/code                                 | median AQI for the CBSA                                                   | 🟢                  |
| Disaster risk | FEMA National Risk Index (county CSV)                                                         | county FIPS → CBSA                             | population-weighted mean of county composite scores                       | 🟢                  |
| Temp          | NOAA 1991–2020 U.S. Climate Normals (annual)                                                  | nearest GHCN station to CBSA centroid          | centroid from Census CBSA Gazetteer; nearest station with a temp normal   | 🟡                  |
| Humidity      | Same NOAA normals product                                                                     | same station                                   | relative-humidity normal where the station has one                        | 🟠 sparser coverage |
| State tax     | Static top-marginal-rate table in the engine (not the build script)                           | `states[0]`                                    | lookup                                                                    | 🟢                  |

**Honesty notes:**

- **Humidity** station coverage is thinner than temperature; expect more metros with no value. Surfaced as `—`, never imputed.
- Metros that straddle two states use `states[0]` (the anchor state) for tax; UI tooltip notes the caveat.
- Any factor that fails to match for a metro leaves the field `undefined`. The build script logs a per-factor coverage count (e.g. `politics: 372/384`).

The county→CBSA crosswalk comes from the Census CBSA-to-county delineation file (same vintage family already used). Cache downloads the way the script already does.

## Filter engine — `src/engines/filters.ts`

Pure, declarative, unit-tested. No Vue imports.

```ts
export interface FilterBand {
  id: string;
  label: string;
  test: (m: Metro) => boolean;
}
export interface FilterDef {
  id: string; // "politics"
  label: string; // "Political lean"
  emoji: string; // "🗳️"
  has: (m: Metro) => boolean; // does this metro have the datum?
  bands: FilterBand[];
}
export const FILTERS: FilterDef[];

// active = { [filterId]: bandId | null }
export function applyFilters(
  rows: AffordRow[],
  active: Record<string, string | null>,
): { rows: AffordRow[]; hiddenNoData: number };
```

- `applyFilters` keeps a row only if it passes every active band. A row whose metro lacks the datum for an active filter is excluded and tallied into `hiddenNoData`.
- Ordering of `rows` is preserved (input is already ranked by required salary).
- Bands per factor:
  - **Politics:** Lean blue (`margin > 5`) · Purple (`−5 ≤ margin ≤ 5`) · Lean red (`margin < −5`)
  - **Temp:** Cold (`<50`) · Mild (`50–65`) · Hot (`>65`)
  - **Humidity:** Dry (`<55`) · Moderate (`55–70`) · Humid (`>70`)
  - **Air:** Good (`aqi ≤ 50`) · Moderate (`51–100`) · Poor (`>100`)
  - **Risk:** Low (`<33`) · Medium (`33–66`) · High (`>66`)
  - **Tax:** None (`0%`) · Low (`>0–5%`) · High (`>5%`) — from `states[0]` via `STATE_TOP_RATE` table.

Tax is implemented as a `FilterDef` whose `has`/`test`/badge read the static rate table keyed on `states[0]`, so it fits the same shape as data-backed filters without storing anything on the metro.

## UI

### Filter state

Lives in `useComparison` (or a small `useFilters` composable colocated with it): `active: Record<string,string|null>`, an `activeCount` computed, and `setBand(filterId, bandId|null)`. The Afford list reads `applyFilters(c.affordable.value, active)`.

### `ExploreView.vue`

- List header gains a ⚙ **Filters** button showing `activeCount` when > 0, and a live metro count (`312 metros`).
- Below the list, when `hiddenNoData > 0`: a muted line `+14 hidden · no data`.

### Filter sheet (new `FilterSheet.vue`, modeled on `BreakdownSheet.vue`)

- One row per `FilterDef`: emoji + label + a segmented control of its bands, plus an "Any" reset.
- Tapping a band sets it; tapping the active band or "Any" clears it.
- "Clear all" footer action.

### Row badges (`AffordList.vue`)

- Under the metro name, a compact muted line built from whatever data the metro has:
  `🗳️ D+8 · 🌡️ 52° · 🌫️ good`
- Missing values are simply omitted from the badge line (no `—` clutter inline; the `—` concept is only the _hidden_ count).
- Badge order fixed; only present factors render.

## Error handling / edge cases

- Build script: a source fetch failing should **fail loudly** (the data is built offline, not at runtime), and print which factor/coverage was affected.
- Runtime: every new field is optional; UI guards on presence. No filter active = current behavior, unchanged.
- A band that matches zero metros still renders (shows empty list + the existing list footer), so the user understands the filter is what emptied it.

## Testing

- `filters.test.ts`: band boundary logic per factor; `applyFilters` excludes-and-counts unknowns; ranking/order preserved; tax derived from `states[0]`.
- `FilterSheet` component test: selecting/clearing a band emits the right state; activeCount reflects it.
- Existing parity/explore tests untouched (filters don't touch ranking).
- Build-script change verified by running `npm run data:build` and asserting coverage counts are non-zero for the 🟢 factors.

## Rollout

Single PR. Data rebuild is a one-time `npm run data:build`; the committed `metros.json` carries the new fields. No runtime API calls added.
