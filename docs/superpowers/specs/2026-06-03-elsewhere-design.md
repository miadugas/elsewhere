# Elsewhere — v1 Design Spec

> **Status:** draft for review · **Date:** 2026-06-03 · **Name:** Elsewhere (working title, may change)

Elsewhere answers one question: **"If I move from here to there, what salary keeps my life the same?"** — and makes the answer _feel_ real with a tangible everyday-price "basket" (a localized Big Mac Index). Mobile-first Vue PWA, free/official data only, static-first.

Origin: comparing cost-of-living parity for a relative moving out of Michigan. The hook is real, sticky, and shareable.

---

## 1. Scope

### One engine, three doorways

Underneath, every use case is the same math: _take a cost-of-living index for Place A and Place B, plus a dollar amount, do the math._

- **"Should I move?"** → A, B, current salary → required salary **← v1 ships this doorway only**
- **"How far does my money go?"** → A, B, spending → equivalent value _(later)_
- **"Where could I afford?"** → income vs. every place → ranked list _(later)_

### Roadmap layers

- **Layer 0 (v1):** parity calculator + the **Basket** (tangible-price anchor). Zoomed-out arc map between the two metros.
- **Layer 1 (v2):** "how close can I afford to get" — street-level radius/heatmap around a target area.
- **Layer 2 (someday):** live local data — restaurants-within-budget, neighborhood demographics, walkability. Separate engine (live places APIs); explicitly out of scope.

### Explicit non-goals for v1

- No user accounts, no saved history.
- No "spending power" or "where can I afford" doorways.
- No interactive street-level map (that's Layer 1).
- No revenue mechanism (parked — see §7).
- No paid/licensed or scraped data.

---

## 2. Use case & granularity

- **Front door:** "Should I move?"
- **Unit of comparison:** **metro area (MSA)** for overall parity, with a **ZIP-level rent overlay** for the single biggest cost (housing). This is the finest grain available from _free/official_ data.

---

## 3. Data

**Free/official only. $0. No licensed or scraped sources.**

| Source                                        | Grain       | Use                                                                                                      |
| --------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------- |
| BEA Regional Price Parities (RPP)             | Metro (MSA) | Overall + category parities (housing, goods, other services) — the "is a dollar worth more here?" number |
| HUD Fair Market Rents / Zillow ZORI           | ZIP         | Median 1BR rent overlay (housing precision)                                                              |
| National average item prices (public/derived) | National    | Basket items, bent by each metro's food/goods parity                                                     |

The dataset is **small and slow** (BEA annual, rents quarterly) — the textbook case for bundling it static rather than serving it from a DB.

### Data model (bundled static JSON)

- **`metros.json`** — ~380 rows: metro id, name, state(s), centroid lat/lng, overall RPP, category parities (housing, goods, other services).
- **`rents.json`** — median 1BR rent by ZIP + a ZIP→metro lookup table.
- **`basket.json`** — national-average prices for a handful of relatable items (🍕 slice, ⛽ gallon of gas, 🍺 sixer, ☕ coffee, 🏠 1BR rent), each tagged with the parity category used to localize it.

### Basket math (honest, no scraping)

`local_price = national_avg_price × (destination_category_parity / 100)`

Rent comes from the ZIP overlay directly when available, else the metro housing parity. Every basket figure is labeled **"estimated from regional price parity,"** not presented as a scraped real-time price.

---

## 4. Platform & architecture

- **Vue 3 + Vite + TypeScript PWA**, **mobile-first**. Desktop = the same single column centered in a max-width frame.
- **Static-first.** The calculator is math in the browser over bundled JSON. Hosted on **Cloudflare Pages**. **The calculator works offline.**
- **the_litterbox = the data kitchen** 🍳 — a scheduled cron fetches fresh BEA + HUD/Zillow data, rebuilds the JSON, commits it. A down day is invisible to users.
- **Maps:** **MapLibre GL** (open-source renderer) + **Protomaps** (.pmtiles — the whole basemap is _one file_ self-hosted on the_litterbox or Cloudflare R2). No per-call provider fees, no rate limits.
- **Offline tradeoff (accepted):** the map backdrop needs network; the **calculator still works offline** (data bundled). No pretty map on a plane — fair trade.
- **Share cards (later):** a small service on the_litterbox renders the pizza-index brag image for social.

### Units / boundaries

- **`parity` engine** — pure functions: given (fromMetro, toMetro, salary) → { requiredSalary, delta, pct }. No I/O, fully unit-testable.
- **`basket` engine** — pure: given (toMetro, items) → localized prices. Unit-testable.
- **`places` lookup** — type-ahead resolver: text → metro (and ZIP → metro). Reads bundled JSON.
- **`map` layer** — MapLibre wrapper: renders the two pins + connecting arc. Isolated so v1's zoomed-out arc and v2's street-level radius are swappable behind one interface.
- **UI** — Vue components over the engines. No business math in components.

---

## 5. Screens (v1 = 3 views)

1. **Compare (home)** — _From_ place + _To_ place (metro type-ahead) and a _current salary_ numeric input. Inputs sit in the thumb zone (lower 2/3); the result renders above as you type. Native numeric keypad, 44px+ targets.
2. **Result + Basket** — the **hero**: oversized _"You'd need $X in [To] to live like $Y in [From]"_ in a confident black slab, with a +/− delta. Directly below, **the Basket** 🧺 — everyday items priced in both places (_"Your $4 Detroit slice → $5.20 in Austin"_). This is the screenshot people share — designed share-ready.
3. **Breakdown (optional tap-through)** — parity split by category (housing, groceries, utilities, transport, healthcare) so power-users see _why_. Housing uses the ZIP-rent overlay; the rest from metro RPP.

First-timer gets a real answer in **two taps and a number.**

---

## 6. Visual direction

**Chrome — from rideshare/delivery references:**

- Muted **map backdrop** with **floating bottom-sheet cards** over it.
- **Pill bottom nav** (carries the 3 doorways once v2/v3 land).
- Confident **black slab** for the hero result number.
- Clean palette, generous whitespace, soft elevation on the sheets.

**Identity — place-flavored cartography ("the texture of moving"):**

- **From → To as a route** — two places joined by a path/arc. This connection _is_ the brand motif (result screen + share card).
- **State silhouettes** as recognizable icons (the Michigan mitten, the Texas shape) — free personality, no stock imagery.
- **Cartographic palette** — terrain greens, water blues, highway-sign warm, contour linework — reads "atlas," not "generic pastel fintech."
- Geography drives palette, type, and personality for everything that isn't the map/sheet/nav chrome.

**v1 map = zoomed-out arc** between the two metros (you can't show two cities 1,200 mi apart at street level). **v2 map = street-level radius** (the rideshare reference's true home).

This is a **brand-new identity, fully separate from the-local-666** — neither aesthetic bleeds into the other.

---

## 7. Revenue — parked

Build the useful free thing first; revenue follows an audience. v1 ships with **no monetization**, but the Result + Basket screens are designed **share-ready** so organic growth is free. Future options, in likely order: contextual **affiliate** (moving services, rental listings, truck rental), then a **Pro tier** (saved comparisons, the v2 affordability map, multi-city ranking). Banner ads explicitly avoided — they'd cheapen the clean look.

---

## 8. Testing

- **Engines (`parity`, `basket`, `places`)** — unit tests with known fixtures (e.g., Detroit→Austin with a real RPP pair → expected required salary; basket math against hand-computed values). These are pure functions; this is where correctness lives.
- **Data integrity** — a build-time check that every metro has the required parity fields and every basket item references a valid category.
- **Component smoke** — Compare flow renders a result on valid input; invalid/empty input is handled gracefully.
- **Map** — mocked in unit tests; manual/visual check for the arc render.

---

## 9. Open questions

- Confirm exact BEA RPP vintage + the precise HUD vs. Zillow rent source (and license/attribution terms for each) during data-pipeline build.
- National-average item prices: pick the specific public source(s) for each basket item.
- Type-ahead place resolution: bundle a metro/ZIP index vs. a tiny client-side fuzzy search lib — decide at build time.
