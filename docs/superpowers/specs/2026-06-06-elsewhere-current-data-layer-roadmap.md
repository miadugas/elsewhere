# Elsewhere — Current-Data Layer Roadmap

**Date:** 2026-06-06
**Status:** Direction approved. Slice 1 (gas) has its own design + plan.
**Purpose:** Sequence how Elsewhere moves each category from static/annual data toward "as current as we can get," without breaking the stable headline number.

## Framing

### Two dials per category

Every basket/parity category has two independent levers:

- **Base price** — how current the _dollar amount_ is.
- **Geography** — how current/local the _multiplier_ is.

A category can improve one dial even if the other stays modeled. (Gas moves both; the modeled items can cheaply move only the base price.)

### Two blast radii

- **Tier A — Basket row.** Cosmetic, per-item. Safe. No methodology risk.
- **Tier B — Headline parity.** Feeds the "keeps your life the same" number. Risky/parked — any change must preserve the _stable-number_ feel and avoid double-counting what BEA already includes.

**Governance rule:** new live sources land in Tier A by default. Promoting a source into Tier B (the headline) is a deliberate, per-category methodology decision — never automatic.

## Per-category source map

| Category                           | Best current source                 | Free / legal                                  | Freshness                 | Geography                          | Blast radius                |
| ---------------------------------- | ----------------------------------- | --------------------------------------------- | ------------------------- | ---------------------------------- | --------------------------- |
| **Gas** (goods)                    | EIA petroleum/pri/gnd               | Public domain (US gov)                        | Weekly                    | Region (PADD + CA)                 | A — slice 1                 |
| **Rent / 1-br** (housing)          | Zillow ZORI (primary) or HUD FMR    | ZORI: free + attribution · HUD: public domain | ZORI monthly · HUD annual | **Metro**                          | A → possibly **B**          |
| **Pizza / Beer / Coffee**          | BLS CPI item indices                | Public domain                                 | Monthly                   | **National only** (no clean metro) | A (base-price recency only) |
| **Headline housing parity**        | BEA RPP, optionally ZORI-nowcast    | Public domain                                 | BEA annual · ZORI monthly | Metro                              | **B — parked**              |
| **Headline goods/services parity** | BEA RPP (gas/CPI as recency signal) | Public domain                                 | Annual                    | Metro                              | B — not planned             |

**Key insight:** pizza/beer/coffee have no clean metro price feed and likely never will (the metro tier is proprietary). But **BLS CPI** can refresh their _national base price_ monthly for free — so one job makes the whole modeled basket feel current (recent dollars) while keeping BEA geography. Broad win, low cost.

## Sources considered (cross-cutting)

- **EIA** — energy. Gas done; home electricity/natural gas available later (state, monthly) but not current basket items.
- **BLS CPI** — free API, national + ~23 metros (limited, lagged), monthly, by item category. Best used for _national base-price recency_ on modeled items, not metro geography.
- **Zillow ZORI** — monthly, metro/ZIP rent index, free CSV. The strongest "current + local" rent source. Confirm redistribution/attribution terms.
- **HUD Fair Market Rents** — annual, metro, public domain. Lower freshness than ZORI but zero license risk; good fallback/cross-check.
- **AAA / GasBuddy / paid aggregators** — rejected for gas (ToS / cost); same verdict applies to any metro-level retail item.

## Slices (sequence)

1. **Gas** — EIA regional, basket row. _(designed; plan written)_
   - Establishes the shared plumbing: cron → small JSON → fetch/cache/bundled fallback → freshness tag → per-item live-price registry.
2. **CPI base-price refresh** — one cron pulls BLS CPI for the modeled items (pizza/beer/coffee) and updates their `nationalAvg` monthly. Geography stays BEA. Whole basket reads as "current dollars," no per-item feeds.
3. **Rent (ZORI), basket row** — real metro + monthly rent for the 1-br line. Tier A (safe). Highest single-item value (rent dominates cost of living).
4. **Methodology call — rent into the headline (Tier B, parked).** Decide whether ZORI should nowcast the housing parity that drives the headline number. Requires a deliberate approach to preserve stability (e.g., blend ZORI movement into the annual BEA housing index, show a freshness indicator, cap the swing). Do not start until 1–3 ship and the approach is agreed.

(Open to reordering 2 and 3 — rent is higher value, the CPI batch is broader/cheaper.)

## Shared architecture — "the current-data layer"

The gas slice intentionally builds reusable pieces; each later slice adds a source without re-plumbing:

- **Cron jobs** (`scripts/build-<source>.py`) each fetch one source and write a small JSON to `public/` (v1 host) — `gas.json`, later `rent.json`, `cpi-base.json`. Keys live in the cron env.
- **Fetch/cache/fallback** — a generic helper (extracted from `useGasPrices`/`pickGas` once slice 2 exists): live → localStorage cache → bundled snapshot, per source.
- **Per-item live registry** — `basket.ts` resolves an item's price via a registry (`item id → live resolver`) instead of hardcoding gas. Adding a category = adding a registry entry, not a refactor.
- **Freshness tag** — each live row shows "as of \<date>" / "est." via the `BasketRow.note` field.
- **Headline stays BEA** unless a Tier-B decision explicitly wires a source in.

Files differ per source on purpose (gas has _regions_, rent has _metros_, CPI is _national_) — there is no single unified feed; the _pattern_ is what generalizes.

## To confirm

1. **Zillow ZORI** redistribution + attribution terms for a public app (before slice 3).
2. **BLS CPI series IDs** mapping to pizza / beer / coffee (before slice 2).
3. EIA series IDs for gas regions (slice 1 implementation detail — in the gas plan).

## Out of scope (for now)

- Station/metro-level gas precision (proprietary).
- Live prices feeding the headline parity beyond the deliberate Tier-B rent decision.
- Real-time (sub-weekly) anything — sources are weekly/monthly at best; "current" means freshest-available, labeled.
