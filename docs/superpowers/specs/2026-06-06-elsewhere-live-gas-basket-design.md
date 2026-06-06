# Elsewhere — Live Gas in the Basket (Design Spec)

**Date:** 2026-06-06
**Status:** Approved design → ready for implementation plan
**Scope:** The Basket's "Gallon of gas" row only. The headline parity number is **not** touched.

## Problem

The Basket's "Gallon of gas" price is neither current nor gas-specific. Today it is a
static national average (`nationalAvg: 3.4` in `basket.json`) scaled by the metro's broad
**"goods"** Regional Price Parity index (`basket.ts`):

```
gasPrice(metro) = 3.40 × (metro.rpp.goods / 100)
```

Gas is the most _felt_, most _volatile_ everyday price, and it varies by region in ways the
annual goods index does not capture (West Coast runs high, Gulf Coast low). The static figure
feels wrong because it is wrong for gas specifically.

## Decision summary

| Question         | Decision                                                                                                                                                                                                                                                               |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What changes?    | Only the Basket "Gallon of gas" line. Headline parity stays BEA-based and stable.                                                                                                                                                                                      |
| Source           | **EIA** weekly retail regular gasoline (US-gov, **public domain**, no ToS/redistribution risk).                                                                                                                                                                        |
| Why not headline | Gas is a few % of total cost of living and BEA already bakes it into "goods" annually — splicing live gas into the headline would double-count it and add weekly noise to a number meant to feel stable.                                                               |
| Granularity      | **EIA region** — national + 5 PADD regions + California (its own series; large outlier).                                                                                                                                                                               |
| Delivery (v1)    | This work **builds** the cron (`build-gas.py`) + hosting; none of it pre-exists. v1 host = the app's own `public/gas.json` (cron commits it). App fetches same-origin `/gas.json` **at load** — no separate CDN, no CORS. Standalone CDN host is a later optimization. |
| Freshness        | Weekly (matches EIA's release cadence). Labeled "as of \<date>".                                                                                                                                                                                                       |
| Offline          | Graceful degradation — never breaks offline. Fallback chain: **live → localStorage cache → bundled snapshot**.                                                                                                                                                         |

### Sources considered (and why EIA)

- **EIA** — free, public domain, weekly national / 5 PADD regions / ~10 cities / select states. Chosen.
- **AAA** — daily state + metro, but **no public API**; scraping violates ToS and republishes proprietary data in a public app. Rejected (legal/fragility).
- **GasBuddy** — station-level, **commercial license only**. Rejected (cost; ToS on scraper wrappers).
- **Paid aggregators** (CollectAPI, Zyla) — legit metro/state, recurring cost. Rejected for now.

Rationale: gas's dominant variation is _regional_; intra-region spread is small. EIA regional
delivers ~90% of the felt accuracy for free and clean. Metro-level precision is the proprietary/
paid tier and not worth the cost/risk for one basket row.

## Architecture

```
EIA API ──weekly──▶ the_litterbox cron ──writes──▶ gas.json (CDN / static host)
                                                        │ fetched at app load
                                                        ▼
   bundled snapshot ◀──fallback── localStorage cache ◀── app (useGasPrices)
                                                        │
                                                        ▼
                                          localizeBasket(from, to, items, gas?)
                                                        │
                                                        ▼
                                                   BasketList (presentation)
```

The app stays offline-capable: the live `gas.json` is fetched network-first at runtime, but the
gas row always has a value via the fallback chain.

## Components

### 1. `scripts/build-gas.py` (new — cron, sibling of `build-metros.py`)

- Fetches EIA API v2 weekly **regular** gasoline retail ($/gal) for: national, PADD1–PADD5,
  and California.
- Writes `gas.json`:
  ```json
  {
    "asOf": "2026-06-01",
    "national": 4.31,
    "regions": {
      "PADD1": 3.45,
      "PADD2": 3.2,
      "PADD3": 3.05,
      "PADD4": 3.9,
      "PADD5": 4.55,
      "CA": 4.95
    }
  }
  ```
- Writes `gas.json` into the app's `public/` dir (v1 host). EIA API key lives in the cron environment —
  **never** shipped to the client.
- Runs weekly (EIA cadence).

### 2. `src/data/gas-regions.json` (new — bundled, static)

- Map: US state code → EIA region key (`"CA" → "CA"`, `"TX" → "PADD3"`, `"CO" → "PADD4"`,
  `"IL" → "PADD2"`, `"NY" → "PADD1"`, …). Covers all 50 states + DC.
- A metro's region is resolved from `metro.states[0]`.

### 3. `src/data/gas-fallback.json` (new — bundled snapshot)

- A committed copy of a recent `gas.json`, used as the final fallback leg when there is no
  network and no localStorage cache (e.g., first-ever load offline). Refreshed occasionally by
  the cron alongside the CDN copy.

### 4. `src/composables/useGasPrices.ts` (new — all fetch/cache/fallback logic)

- On load: `fetch(GAS_JSON_URL)`.
  - Success → store payload + fetch timestamp in `localStorage`; expose `source: "live"`.
  - Failure → read `localStorage` cache; expose `source: "cached"`.
  - No cache → bundled `gas-fallback.json`; expose `source: "estimate"`.
- Exposes a reactive object: `{ regions, national, asOf, source }`.
- **No business math.** Pure data acquisition + caching (display-state only), consistent with
  the project rule that logic lives in engines/composables and components are presentation.

### 5. `src/engines/basket.ts` (changed — stays a pure function)

- Signature gains an optional gas argument:
  ```ts
  localizeBasket(from, to, items, gas?: ResolvedGas): BasketRow[]
  ```
  where `ResolvedGas` carries the region map + region→price lookup (passed in, never fetched here).
- For the **gas item** (`id === "gas-gallon"`):
  - If `gas` resolves a price for the metro's region → use that real regional price directly
    (`fromPrice = gasForRegion(from)`, `toPrice = gasForRegion(to)`), **skipping** the
    `nationalAvg × goods index` formula.
  - If region unresolved → use `gas.national` if present.
  - If `gas` absent entirely → **fall back to today's behavior** (`nationalAvg × goods index`).
- All other items unchanged.
- Because the no-gas path is identical to current behavior, existing tests remain valid.

### 6. Wiring — `src/composables/useComparison.ts`

- Calls `useGasPrices()` and threads the resolved gas into `localizeBasket(...)`.
- `BasketList` stays presentational — it receives rows + a freshness descriptor as props.

### 7. UI — `BasketList` gas row freshness tag

- Small label on the gas row (or near it): "as of Jun 1" when `source` is `live`/`cached`;
  "est." when `source` is `estimate`. Styling consistent with the existing card footers.

## Data flow / fallback chain

1. App mounts → `useGasPrices` fetches CDN `gas.json`.
2. Resolve each metro's region via `gas-regions.json` (`states[0]`).
3. `localizeBasket` sets the gas row from the regional price.
4. If any step lacks data, degrade: live → cached → bundled snapshot → (last resort) the original
   `nationalAvg × goods index` estimate. The gas row always renders a number.

## Error handling / edge cases

- **Region not in map** (territories, edge metros) → use `national`; then goods-index estimate.
- **Stale cache** → still shown; the "as of \<date>" label stays honest. Gas has no hard expiry.
- **CORS** → `gas.json` served with permissive CORS (public data).
- **PWA/workbox** → do **not** precache the remote `gas.json` (runtime, network-first). The bundled
  `gas-fallback.json` is the offline source. Confirm workbox config excludes the remote URL.
- **EIA outage / shape change** → `build-gas.py` fails loudly in cron; the app keeps serving the
  last published `gas.json` (CDN) / cache / snapshot. No user-facing break.

## Testing

- **`basket.ts`** (unit): gas present → regional price used; gas absent → goods-index fallback
  (proves existing 23 tests' behavior is preserved); region-missing → national fallback.
- **`useGasPrices`** (unit, mocked `fetch` + `localStorage`): success path; fetch-fail-use-cache;
  no-cache-use-bundled; payload shape validation.
- **`build-gas.py`** (light): parse a sample EIA payload into the `gas.json` shape.

## To confirm during implementation (not blocking design)

1. Exact EIA API v2 series IDs for national, PADD1–5, and California (verify against the live API).
2. Whether to split the East Coast finer (New England / Central Atlantic / Lower Atlantic) or keep
   5 PADDs + CA. Default: 5 PADDs + CA.

(Hosting resolved: v1 = same-origin `public/gas.json`, cron-committed. CDN host deferred.)

## Out of scope

- Live prices for other basket items (pizza, beer, coffee, rent).
- Live gas affecting the headline parity number.
- Metro/station-level gas precision (proprietary/paid).
