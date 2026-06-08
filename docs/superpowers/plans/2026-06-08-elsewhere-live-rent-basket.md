# Live Rent in the Basket (ZORI) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the RPP-derived rent row with real per-metro market rent (Zillow ZORI, all-homes), relabeled "Typical rent," flowing through the existing metros pipeline → Postgres → API → app, with an RPP fallback and Zillow attribution.

**Architecture:** `build-metros.py` gains a ZORI loader (joined to CBSA via Zillow's crosswalk) that writes a per-metro `rent` (into `metros.json` + a new `rent` column). `mapMetro` carries it. `localizeBasket` uses `metro.rent` for the rent row (RPP fallback when absent). `BasketList` shows the source note + a Zillow footer credit.

**Tech Stack:** Python 3 (pipeline), Postgres, Node/Express (API), Vue 3 + TS + Vitest.

**Working branch:** commit directly to `main` (Mia's active-dev directive). `git fetch && git merge --ff-only origin/main` first if behind.

**Scope:** Tier A (basket row) only — headline parity untouched. Task order is deliberate: **data layer first** so the committed `metros.json` carries `rent` before the frontend reads it (otherwise every metro would hit the RPP fallback).

---

## Task 1: Rent through the data layer (pipeline + schema + API)

**Files:**

- Modify: `scripts/build-metros.py`
- Modify: `scripts/test_build_metros.py`
- Modify: `db/schema.sql`
- Modify: `server/map.js`
- Test: `server/map.test.js`

### Step 1 — Add the ZORI source constants

In `scripts/build-metros.py`, add near the other URL constants (after `GAZ_CBSA`):

```python
# Zillow ZORI (all-homes, smoothed, seasonally adjusted) — metro level.
# Free for public use WITH attribution (shown in the app footer).
ZORI_METRO_CSV = (
    "https://files.zillowstatic.com/research/public_csvs/zori/"
    "Metro_zori_uc_sfrcondomfr_sm_sa_month.csv"
)
# Zillow → CBSA crosswalk (maps MetroRegionID_Zillow -> CBSACode).
ZILLOW_XWALK_CSV = (
    "https://files.zillowstatic.com/research/public/CountyCrossWalk_Zillow.csv"
)
```

> If Zillow has moved these paths, update the constants — both loaders are wrapped in `safe()`, so a 404 degrades to the RPP fallback rather than breaking the build. Verify coverage in Step 6.

### Step 2 — Add the crosswalk + rent loaders

Insert above `def slug(...)` (sibling of the other `load_*` functions):

```python
def load_zillow_crosswalk() -> dict[str, str]:
    """Zillow MetroRegionID -> CBSA code."""
    raw = fetch(ZILLOW_XWALK_CSV).decode("utf-8-sig")
    rows = csv.DictReader(io.StringIO(raw))
    out: dict[str, str] = {}
    for r in rows:
        rid = (r.get("MetroRegionID_Zillow") or "").strip()
        cbsa = (r.get("CBSACode") or "").strip()
        if rid and cbsa.isdigit():
            out.setdefault(rid, cbsa)
    return out


def latest_value(row: list[str], date_cols: list[int]) -> float | None:
    """Most recent non-empty monthly value in a ZORI row."""
    for i in reversed(date_cols):
        if i < len(row) and row[i].strip():
            try:
                return round(float(row[i]))
            except ValueError:
                continue
    return None


def load_rent(region_to_cbsa: dict[str, str]) -> dict[str, int]:
    """CBSA code -> typical monthly rent (latest ZORI, all-homes)."""
    raw = fetch(ZORI_METRO_CSV).decode("utf-8-sig")
    rows = list(csv.reader(io.StringIO(raw)))
    if not rows:
        return {}
    h = rows[0]
    i_region = h.index("RegionID")
    date_cols = [i for i, c in enumerate(h) if re.match(r"\d{4}-\d{2}", c.strip())]
    out: dict[str, int] = {}
    for r in rows[1:]:
        if len(r) <= i_region:
            continue
        cbsa = region_to_cbsa.get(r[i_region].strip())
        if not cbsa:
            continue
        val = latest_value(r, date_cols)
        if val is not None:
            out[cbsa] = val
    return out
```

### Step 3 — Wire rent into `main()` enrichment

In `main()`, after the existing `safe(...)` calls (e.g. after `climate = safe("climate", load_climate)`), add:

```python
    xwalk = safe("zillow-xwalk", load_zillow_crosswalk)
    rent = safe("rent", lambda: load_rent(xwalk))
```

Add `"rent": 0` to the `cover` dict:

```python
    cover = {"politics": 0, "tempF": 0, "humidity": 0, "aqi": 0, "risk": 0, "rent": 0}
```

Inside the `for fips, m in metros.items():` loop, after the `risk` block (before `out.append(entry)`), add:

```python
        if fips in rent:
            entry["rent"] = rent[fips]
            cover["rent"] += 1
```

### Step 4 — Persist rent in Postgres (`write_postgres`)

In `metro_upsert_params`, add `rent` as the final value (making it 16 values):

```python
        e.get("aqi"),
        e.get("risk"),
        e.get("rent"),
    )
```

In `write_postgres`, add `rent` to the insert columns + one more `%s` in the template + the on-conflict set. Replace the `execute_values(... metros ...)` call's SQL + template with:

```python
            execute_values(
                cur,
                """
                insert into metros
                  (id,cbsa,name,short,states,pop,rpp_overall,rpp_housing,
                   rpp_goods,rpp_other_services,politics,temp_f,humidity,aqi,risk,rent,updated_at)
                values %s
                on conflict (id) do update set
                  cbsa=excluded.cbsa, name=excluded.name, short=excluded.short,
                  states=excluded.states, pop=excluded.pop,
                  rpp_overall=excluded.rpp_overall, rpp_housing=excluded.rpp_housing,
                  rpp_goods=excluded.rpp_goods, rpp_other_services=excluded.rpp_other_services,
                  politics=excluded.politics, temp_f=excluded.temp_f,
                  humidity=excluded.humidity, aqi=excluded.aqi, risk=excluded.risk,
                  rent=excluded.rent, updated_at=now()
                """,
                [metro_upsert_params(e) for e in entries],
                template="(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,now())",
            )
```

### Step 5 — Update the pipeline unit test (now failing on the 16th value)

In `scripts/test_build_metros.py`, update `test_upsert_params_order_and_length`:

- add `"rent": 1850` to the `entry` fixture,
- change the length assertion to `16`,
- assert the new value:

```python
        self.assertEqual(len(p), 16)
        self.assertEqual(p[0], "denver-co")
        self.assertEqual(p[1], "19740")
        self.assertEqual(p[6], 1.0)
        self.assertEqual(p[9], 4.0)
        self.assertEqual(p[10], 18.0)
        self.assertIsNone(p[11])
        self.assertEqual(p[13], 42.0)
        self.assertEqual(p[15], 1850)  # rent
```

Run: `python3 scripts/test_build_metros.py`
Expected: `Ran 3 tests ... OK`.

### Step 6 — Rebuild data + verify rent coverage

Run: `npm run data:build 2>&1 | tail -5`
Expected: coverage line now includes `'rent': <N>` with **N in the hundreds** (ZORI covers major metros) and no traceback. The committed `src/data/metros.json` now has a `rent` field on covered metros.

- If `rent: 0`, the ZORI/crosswalk URL is stale — open the CSV header (`curl -sI <url>`), fix the constant, re-run. Do not proceed until rent coverage is non-zero.

Spot-check Denver:
Run: `node -e 'const m=require("./src/data/metros.json").find(x=>x.id==="denver-co"); console.log("Denver rent:", m.rent)'`
Expected: a realistic Denver figure (~$1,900–2,100), **not** $2,203.

### Step 7 — Schema column

In `db/schema.sql`, add `rent numeric` to the `metros` table definition (after `risk numeric,`), and add an idempotent alter for existing DBs at the end of the file:

```sql
alter table metros add column if not exists rent numeric;
```

### Step 8 — API mapper carries rent (TDD)

In `server/map.test.js`, add `rent: "1985"` to the `pgRow` fixture and a new assertion in the "copies identity + numeric lifestyle fields" test:

```js
expect(m.rent).toBe(1985);
```

Run: `npx vitest run server/map.test.js` → expect FAIL (rent undefined).

Then in `server/map.js`, add after the `risk` line:

```js
if (row.rent != null) m.rent = num(row.rent);
```

Run: `npx vitest run server/map.test.js` → expect PASS.

### Step 9 — Commit

```bash
git add scripts/build-metros.py scripts/test_build_metros.py db/schema.sql server/map.js server/map.test.js src/data/metros.json
git commit -m "feat(data): per-metro typical rent from Zillow ZORI (pipeline + schema + API)"
```

---

## Task 2: Frontend — basket uses real rent

**Files:**

- Modify: `src/types.ts`
- Modify: `src/data/basket.json`
- Modify: `src/engines/basket.ts`
- Test: `tests/basket.test.ts`
- Modify: `src/components/BasketList.vue`

### Step 1 — Types

In `src/types.ts`:

Add to `Metro` (after `risk?`):

```ts
  rent?: number; // typical monthly market rent — Zillow ZORI, all homes
```

Extend `BasketItem`:

```ts
export interface BasketItem {
  id: string;
  label: string;
  emoji: string;
  nationalAvg: number;
  category: ParityCategory;
  metroField?: "rent"; // when set, use this per-metro $ value instead of RPP-derived
  note?: string; // source/freshness label shown when the live value is used
}
```

Extend `BasketRow`:

```ts
export interface BasketRow {
  id: string;
  label: string;
  emoji: string;
  fromPrice: number;
  toPrice: number;
  note?: string;
}
```

### Step 2 — Basket data

In `src/data/basket.json`, replace the rent item with:

```json
{
  "id": "rent-1br",
  "label": "Typical rent",
  "emoji": "🏠",
  "nationalAvg": 2010,
  "category": "housing",
  "metroField": "rent",
  "note": "Zillow ZORI"
}
```

### Step 3 — Write the failing engine test

In `tests/basket.test.ts`, replace the `items` fixture and add rent cases. The new fixture + tests:

```ts
const items: BasketItem[] = [
  {
    id: "pizza-slice",
    label: "Slice of pizza",
    emoji: "🍕",
    nationalAvg: 3.5,
    category: "goods",
  },
  {
    id: "rent-1br",
    label: "Typical rent",
    emoji: "🏠",
    nationalAvg: 2010,
    category: "housing",
    metroField: "rent",
    note: "Zillow ZORI",
  },
];

describe("localizeBasket rent (live metro value)", () => {
  it("uses metro.rent directly for both cities when present, with the source note", () => {
    const f = { rpp: detroit.rpp, rent: 1300 } as Metro;
    const t = { rpp: austin.rpp, rent: 1750 } as Metro;
    const rent = localizeBasket(f, t, items).find((r) => r.id === "rent-1br")!;
    expect(rent.fromPrice).toBe(1300);
    expect(rent.toPrice).toBe(1750);
    expect(rent.note).toBe("Zillow ZORI");
  });

  it("falls back to RPP-derived rent with an 'est.' note when metro.rent is absent", () => {
    const rent = localizeBasket(detroit, austin, items).find(
      (r) => r.id === "rent-1br",
    )!;
    // 2010 * 80.1/100 = 1610.01 ; 2010 * 112.8/100 = 2267.28
    expect(rent.fromPrice).toBe(1610.01);
    expect(rent.toPrice).toBe(2267.28);
    expect(rent.note).toBe("est.");
  });

  it("leaves non-metroField items unchanged (no note)", () => {
    const pizza = localizeBasket(detroit, austin, items).find(
      (r) => r.id === "pizza-slice",
    )!;
    expect(pizza.fromPrice).toBe(3.4);
    expect(pizza.note).toBeUndefined();
  });
});
```

(Keep the existing two tests; they still pass — pizza math unchanged.)

Run: `npx vitest run tests/basket.test.ts` → expect FAIL (note undefined / live value not used).

### Step 4 — Implement the resolver in `src/engines/basket.ts`

Replace the body of `localizeBasket`:

```ts
export function localizeBasket(
  from: Metro,
  to: Metro,
  items: BasketItem[],
): BasketRow[] {
  return items.map((item) => {
    const liveFrom = item.metroField
      ? (from[item.metroField] as number | undefined)
      : undefined;
    const liveTo = item.metroField
      ? (to[item.metroField] as number | undefined)
      : undefined;
    const useLive = liveFrom != null && liveTo != null;

    const row: BasketRow = {
      id: item.id,
      label: item.label,
      emoji: item.emoji,
      fromPrice: useLive
        ? round2(liveFrom as number)
        : round2(item.nationalAvg * (from.rpp[item.category] / 100)),
      toPrice: useLive
        ? round2(liveTo as number)
        : round2(item.nationalAvg * (to.rpp[item.category] / 100)),
    };
    if (item.metroField) row.note = useLive ? (item.note ?? "live") : "est.";
    return row;
  });
}
```

Run: `npx vitest run tests/basket.test.ts` → expect PASS (all cases).

### Step 5 — Show the note + attribution in `BasketList.vue`

In the label block (after the `from.short` + `money(r.fromPrice)` line, inside that uppercase `<div>`), add the source note:

```html
<span v-if="r.note" class="opacity-60">· {{ r.note }}</span>
```

In the footer paragraph, append the Zillow credit. Change the footer text node from:

```
      Localized via regional price parity · National avg = 100
```

to:

```
      Localized via regional price parity · National avg = 100 · Rent data ©
      Zillow
```

### Step 6 — Full verify

Run: `npx vitest run && npx vue-tsc --noEmit && npx vite build 2>&1 | tail -3`
Expected: all tests pass, tsc clean, build succeeds.

### Step 7 — Visual smoke (recommended)

Run the dev server, open Compare with From = Denver, To = a cheaper metro, a salary set. The rent row should read **"Typical rent"**, show Denver's real ZORI rent (~$1,900–2,100, not $2,203), carry a small **"· Zillow ZORI"** note, and the footer should credit Zillow.

### Step 8 — Commit

```bash
git add src/types.ts src/data/basket.json src/engines/basket.ts tests/basket.test.ts src/components/BasketList.vue
git commit -m "feat(basket): typical rent uses real ZORI per-metro value + attribution"
```

---

## Self-review notes (reconciled against the spec)

- **Spec coverage:** ZORI all-homes metro source + crosswalk join (T1 Step 2) ✓; fold into metros pipeline/table/API (T1) ✓; relabel "Typical rent" + seed 2010 (T2 Step 2) ✓; engine uses `metro.rent` with RPP fallback + note (T2 Step 4) ✓; attribution row note + footer (T2 Steps 2/5) ✓; Tier A only (no parity/headline files touched) ✓; tests on engine + mapper + pipeline helper (T1 Step 5/8, T2 Step 3) ✓.
- **Order safety:** data lands first (T1 regenerates `metros.json` with `rent`), so when the frontend (T2) ships, real rent is already in the bundled snapshot — the worse RPP fallback (2010 × housing RPP) is hit only for the rare ZORI-gap metro (small metros, RPP≈100, so ~$2,010, sane).
- **Type/name consistency:** `metroField: "rent"` matches `Metro.rent`; `metro_upsert_params` returns 16 values matching 16 `%s` + `now()`; `mapMetro` coerces `rent` like other numerics; `localizeBasket(from,to,items)` signature unchanged.
- **Honest fallback labeling:** live → "Zillow ZORI", gap → "est." Never silently mislabels.
- **YAGNI:** no headline change, no separate rent.json, no ZORI-by-bedroom chase (all-homes per the approved spec).
