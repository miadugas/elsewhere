# Live Gas in the Basket — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Basket's "Gallon of gas" row with a real, current EIA regional gas price (fetched at load, cached, with offline fallback), leaving the headline parity number untouched.

**Architecture:** A cron script (`build-gas.py`) fetches EIA weekly regional gas prices and writes `public/gas.json`. At load, a composable (`useGasPrices`) fetches `/gas.json` and resolves a `ResolvedGas` via the fallback chain **live → localStorage cache → bundled snapshot**. The pure `gas.ts` engine maps a metro's state → EIA region → price; `localizeBasket` uses that real price for the gas row (skipping the goods-index formula) and falls back to today's formula when no gas data is present. Components stay presentational.

**Tech Stack:** Vue 3 (`<script setup>`), TypeScript, Vitest, Python 3 (cron), EIA API v2.

**Spec:** `docs/superpowers/specs/2026-06-06-elsewhere-live-gas-basket-design.md`

---

## File Structure

| File                               | Responsibility                                                                     | New/Modify |
| ---------------------------------- | ---------------------------------------------------------------------------------- | ---------- |
| `src/types.ts`                     | Add `GasRegion`, `GasData`, `GasSource`, `ResolvedGas`; add `note?` to `BasketRow` | Modify     |
| `src/data/gas-regions.json`        | State code → EIA region lookup (50 states + DC)                                    | Create     |
| `src/data/gas-fallback.json`       | Bundled `GasData` snapshot (offline last resort)                                   | Create     |
| `src/engines/gas.ts`               | Pure: `regionForMetro`, `gasPriceForMetro`, `pickGas`, `formatAsOf`                | Create     |
| `src/engines/basket.ts`            | `localizeBasket` gains optional `gas`; gas row uses regional price + note          | Modify     |
| `src/composables/useGasPrices.ts`  | `loadGas` (fetch+cache+fallback) + module-singleton composable                     | Create     |
| `src/composables/useComparison.ts` | Wire `useGasPrices` into the `basket` computed                                     | Modify     |
| `src/components/BasketList.vue`    | Render the gas row's freshness `note`                                              | Modify     |
| `scripts/build-gas.py`             | Cron: fetch EIA → write `public/gas.json`                                          | Create     |
| `tests/gas.test.ts`                | Unit tests for `gas.ts`                                                            | Create     |
| `tests/useGasPrices.test.ts`       | Unit tests for `loadGas` fallback chain                                            | Create     |
| `tests/basket.test.ts`             | Add gas-override + fallback cases                                                  | Modify     |

---

## Task 1: Types

**Files:**

- Modify: `src/types.ts`

- [ ] **Step 1: Add gas types and extend `BasketRow`**

Append to `src/types.ts` (and edit `BasketRow`):

```ts
export type GasRegion = "PADD1" | "PADD2" | "PADD3" | "PADD4" | "PADD5" | "CA";

export interface GasData {
  asOf: string; // ISO date, e.g. "2026-06-01"
  national: number; // $/gal
  regions: Record<GasRegion, number>; // $/gal per EIA region
}

export type GasSource = "live" | "cached" | "estimate";

export interface ResolvedGas {
  data: GasData;
  source: GasSource;
}
```

Edit `BasketRow` to add an optional note (used only by the gas row):

```ts
export interface BasketRow {
  id: string;
  label: string;
  emoji: string;
  fromPrice: number;
  toPrice: number;
  note?: string; // freshness tag, e.g. "as of Jun 1" — gas row only
}
```

- [ ] **Step 2: Typecheck**

Run: `npx vue-tsc --noEmit`
Expected: passes (no usages yet).

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat(types): add gas price types + BasketRow note"
```

---

## Task 2: Bundled data — region map + fallback snapshot

**Files:**

- Create: `src/data/gas-regions.json`
- Create: `src/data/gas-fallback.json`

- [ ] **Step 1: Create `src/data/gas-regions.json`**

State → EIA region. PADD1 East Coast, PADD2 Midwest, PADD3 Gulf, PADD4 Rockies, PADD5 West; California split out (`CA`).

```json
{
  "CT": "PADD1",
  "DE": "PADD1",
  "DC": "PADD1",
  "FL": "PADD1",
  "GA": "PADD1",
  "ME": "PADD1",
  "MD": "PADD1",
  "MA": "PADD1",
  "NH": "PADD1",
  "NJ": "PADD1",
  "NY": "PADD1",
  "NC": "PADD1",
  "PA": "PADD1",
  "RI": "PADD1",
  "SC": "PADD1",
  "VT": "PADD1",
  "VA": "PADD1",
  "WV": "PADD1",
  "IL": "PADD2",
  "IN": "PADD2",
  "IA": "PADD2",
  "KS": "PADD2",
  "KY": "PADD2",
  "MI": "PADD2",
  "MN": "PADD2",
  "MO": "PADD2",
  "NE": "PADD2",
  "ND": "PADD2",
  "OH": "PADD2",
  "OK": "PADD2",
  "SD": "PADD2",
  "TN": "PADD2",
  "WI": "PADD2",
  "AL": "PADD3",
  "AR": "PADD3",
  "LA": "PADD3",
  "MS": "PADD3",
  "NM": "PADD3",
  "TX": "PADD3",
  "CO": "PADD4",
  "ID": "PADD4",
  "MT": "PADD4",
  "UT": "PADD4",
  "WY": "PADD4",
  "AK": "PADD5",
  "AZ": "PADD5",
  "HI": "PADD5",
  "NV": "PADD5",
  "OR": "PADD5",
  "WA": "PADD5",
  "CA": "CA"
}
```

- [ ] **Step 2: Create `src/data/gas-fallback.json`** (a recent snapshot; the cron refreshes it occasionally)

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

- [ ] **Step 3: Commit**

```bash
git add src/data/gas-regions.json src/data/gas-fallback.json
git commit -m "feat(data): add gas region map + bundled fallback snapshot"
```

---

## Task 3: Gas engine (`gas.ts`) — pure logic

**Files:**

- Create: `src/engines/gas.ts`
- Test: `tests/gas.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/gas.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  regionForMetro,
  gasPriceForMetro,
  pickGas,
  formatAsOf,
} from "../src/engines/gas";
import type { GasData, Metro } from "../src/types";

const gas: GasData = {
  asOf: "2026-06-01",
  national: 4.31,
  regions: {
    PADD1: 3.45,
    PADD2: 3.2,
    PADD3: 3.05,
    PADD4: 3.9,
    PADD5: 4.55,
    CA: 4.95,
  },
};

const denver = { states: ["CO"] } as Metro; // PADD4
const sf = { states: ["CA"] } as Metro; // CA
const guam = { states: ["GU"] } as Metro; // not in map

describe("regionForMetro", () => {
  it("maps a metro's first state to its EIA region", () => {
    expect(regionForMetro(denver)).toBe("PADD4");
    expect(regionForMetro(sf)).toBe("CA");
  });
  it("returns null for an unmapped state", () => {
    expect(regionForMetro(guam)).toBeNull();
  });
});

describe("gasPriceForMetro", () => {
  it("returns the region price", () => {
    expect(gasPriceForMetro(denver, gas)).toBe(3.9);
    expect(gasPriceForMetro(sf, gas)).toBe(4.95);
  });
  it("falls back to national when region is unmapped", () => {
    expect(gasPriceForMetro(guam, gas)).toBe(4.31);
  });
});

describe("pickGas", () => {
  const bundled: GasData = { ...gas, asOf: "2026-05-01" };
  it("prefers remote -> source live", () => {
    expect(pickGas(gas, null, bundled)).toEqual({ data: gas, source: "live" });
  });
  it("uses cache when remote is null -> source cached", () => {
    const cached = { ...gas, asOf: "2026-05-25" };
    expect(pickGas(null, cached, bundled)).toEqual({
      data: cached,
      source: "cached",
    });
  });
  it("uses bundled when remote+cache null -> source estimate", () => {
    expect(pickGas(null, null, bundled)).toEqual({
      data: bundled,
      source: "estimate",
    });
  });
});

describe("formatAsOf", () => {
  it("formats an ISO date as 'Mon D'", () => {
    expect(formatAsOf("2026-06-01")).toBe("Jun 1");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/gas.test.ts`
Expected: FAIL — cannot resolve `../src/engines/gas`.

- [ ] **Step 3: Implement `src/engines/gas.ts`**

```ts
import type { GasData, GasRegion, Metro, ResolvedGas } from "../types";
import regionMap from "../data/gas-regions.json";

const STATE_TO_REGION = regionMap as Record<string, GasRegion>;

/** EIA region for a metro, via its primary state. Null if unmapped. */
export function regionForMetro(metro: Metro): GasRegion | null {
  const state = metro.states[0];
  return STATE_TO_REGION[state] ?? null;
}

/** $/gal for a metro: region price, else national. */
export function gasPriceForMetro(metro: Metro, gas: GasData): number {
  const region = regionForMetro(metro);
  return region ? gas.regions[region] : gas.national;
}

/** Fallback chain: remote (live) -> cache (cached) -> bundled (estimate). */
export function pickGas(
  remote: GasData | null,
  cached: GasData | null,
  bundled: GasData,
): ResolvedGas {
  if (remote) return { data: remote, source: "live" };
  if (cached) return { data: cached, source: "cached" };
  return { data: bundled, source: "estimate" };
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** "2026-06-01" -> "Jun 1". Parsed manually to avoid timezone drift. */
export function formatAsOf(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/gas.test.ts`
Expected: PASS (10 assertions).

- [ ] **Step 5: Commit**

```bash
git add src/engines/gas.ts tests/gas.test.ts
git commit -m "feat(gas): pure region/price/fallback helpers"
```

---

## Task 4: Basket engine uses regional gas

**Files:**

- Modify: `src/engines/basket.ts`
- Test: `tests/basket.test.ts`

- [ ] **Step 1: Add failing tests to `tests/basket.test.ts`**

Append these cases (and add the import at the top: `import type { GasData } from "../src/types";`). Add a `gas-gallon` item to the existing `items` array, or define a local one in the new `describe`:

```ts
describe("localizeBasket with live gas", () => {
  const gas: GasData = {
    asOf: "2026-06-01",
    national: 4.31,
    regions: {
      PADD1: 3.45,
      PADD2: 3.2,
      PADD3: 3.05,
      PADD4: 3.9,
      PADD5: 4.55,
      CA: 4.95,
    },
  };
  const co = {
    states: ["CO"],
    rpp: { overall: 100, housing: 100, goods: 100, otherServices: 100 },
  } as Metro; // PADD4
  const ca = {
    states: ["CA"],
    rpp: { overall: 100, housing: 100, goods: 100, otherServices: 100 },
  } as Metro; // CA
  const gasItems: BasketItem[] = [
    {
      id: "gas-gallon",
      label: "Gallon of gas",
      emoji: "⛽",
      nationalAvg: 3.4,
      category: "goods",
    },
  ];

  it("uses the regional gas price for the gas row, not the goods index", () => {
    const rows = localizeBasket(co, ca, gasItems, {
      data: gas,
      source: "live",
    });
    const row = rows.find((r) => r.id === "gas-gallon")!;
    expect(row.fromPrice).toBe(3.9); // CO -> PADD4
    expect(row.toPrice).toBe(4.95); // CA
    expect(row.note).toBe("as of Jun 1");
  });

  it("labels the row 'est.' when source is estimate", () => {
    const rows = localizeBasket(co, ca, gasItems, {
      data: gas,
      source: "estimate",
    });
    expect(rows[0].note).toBe("est.");
  });

  it("falls back to the goods-index formula when no gas is passed", () => {
    const rows = localizeBasket(co, ca, gasItems); // no gas arg
    // 3.4 * 100/100 = 3.40 for both (goods rpp = 100)
    expect(rows[0].fromPrice).toBe(3.4);
    expect(rows[0].toPrice).toBe(3.4);
    expect(rows[0].note).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/basket.test.ts`
Expected: FAIL — `localizeBasket` takes 3 args / `note` undefined.

- [ ] **Step 3: Update `src/engines/basket.ts`**

```ts
import type { Metro, BasketItem, BasketRow, ResolvedGas } from "../types";
import { gasPriceForMetro, formatAsOf } from "./gas";

const GAS_ITEM_ID = "gas-gallon";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function localizeBasket(
  from: Metro,
  to: Metro,
  items: BasketItem[],
  gas?: ResolvedGas | null,
): BasketRow[] {
  return items.map((item) => {
    // Gas is special-cased: use a real regional price when we have one.
    if (gas && item.id === GAS_ITEM_ID) {
      return {
        id: item.id,
        label: item.label,
        emoji: item.emoji,
        fromPrice: round2(gasPriceForMetro(from, gas.data)),
        toPrice: round2(gasPriceForMetro(to, gas.data)),
        note:
          gas.source === "estimate"
            ? "est."
            : `as of ${formatAsOf(gas.data.asOf)}`,
      };
    }
    // Everything else (and gas when no live data): national avg × category parity.
    return {
      id: item.id,
      label: item.label,
      emoji: item.emoji,
      fromPrice: round2(item.nationalAvg * (from.rpp[item.category] / 100)),
      toPrice: round2(item.nationalAvg * (to.rpp[item.category] / 100)),
    };
  });
}
```

- [ ] **Step 4: Run the full suite (regression check)**

Run: `npx vitest run`
Expected: PASS — all prior tests plus the new gas cases (existing 23 unaffected because the no-gas path is unchanged).

- [ ] **Step 5: Commit**

```bash
git add src/engines/basket.ts tests/basket.test.ts
git commit -m "feat(basket): use regional gas price for the gas row"
```

---

## Task 5: `useGasPrices` composable (fetch + cache + fallback)

**Files:**

- Create: `src/composables/useGasPrices.ts`
- Test: `tests/useGasPrices.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/useGasPrices.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { loadGas } from "../src/composables/useGasPrices";
import type { GasData } from "../src/types";

const remote: GasData = {
  asOf: "2026-06-08",
  national: 4.4,
  regions: {
    PADD1: 3.5,
    PADD2: 3.2,
    PADD3: 3.0,
    PADD4: 3.9,
    PADD5: 4.6,
    CA: 5.0,
  },
};

function fakeStorage(initial?: string) {
  const store: Record<string, string> = initial
    ? { "elsewhere:gas": initial }
    : {};
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
  } as unknown as Storage;
}

describe("loadGas", () => {
  it("returns live + caches when fetch succeeds", async () => {
    const storage = fakeStorage();
    const fetchFn = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => remote });
    const res = await loadGas({ fetchFn, storage });
    expect(res.source).toBe("live");
    expect(res.data.national).toBe(4.4);
    expect(storage.getItem("elsewhere:gas")).toContain("4.4");
  });

  it("returns cached when fetch throws but cache exists", async () => {
    const cached: GasData = { ...remote, asOf: "2026-06-01" };
    const storage = fakeStorage(JSON.stringify(cached));
    const fetchFn = vi.fn().mockRejectedValue(new Error("offline"));
    const res = await loadGas({ fetchFn, storage });
    expect(res.source).toBe("cached");
    expect(res.data.asOf).toBe("2026-06-01");
  });

  it("returns estimate (bundled) when fetch fails and no cache", async () => {
    const storage = fakeStorage();
    const fetchFn = vi.fn().mockRejectedValue(new Error("offline"));
    const res = await loadGas({ fetchFn, storage });
    expect(res.source).toBe("estimate");
    expect(res.data.asOf).toBe("2026-06-01"); // matches the bundled snapshot
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/useGasPrices.test.ts`
Expected: FAIL — cannot resolve `../src/composables/useGasPrices`.

- [ ] **Step 3: Implement `src/composables/useGasPrices.ts`**

```ts
import { ref, onMounted } from "vue";
import type { GasData, ResolvedGas } from "../types";
import { pickGas } from "../engines/gas";
import bundled from "../data/gas-fallback.json";

const GAS_URL = "/gas.json";
const CACHE_KEY = "elsewhere:gas";
const BUNDLED = bundled as GasData;

interface LoadDeps {
  fetchFn?: typeof fetch;
  storage?: Storage;
}

/** Acquire gas data via the fallback chain: live -> cached -> bundled. Pure-ish:
 *  all side effects (fetch, storage) are injected so it's unit-testable. */
export async function loadGas(deps: LoadDeps = {}): Promise<ResolvedGas> {
  const fetchFn =
    deps.fetchFn ?? (typeof fetch !== "undefined" ? fetch : undefined);
  const storage =
    deps.storage ??
    (typeof localStorage !== "undefined" ? localStorage : undefined);

  const cached = readCache(storage);
  let remote: GasData | null = null;
  try {
    if (fetchFn) {
      const res = await fetchFn(GAS_URL, { cache: "no-store" });
      if (res.ok) {
        remote = (await res.json()) as GasData;
        writeCache(storage, remote);
      }
    }
  } catch {
    /* offline / network error — fall through to cache/bundled */
  }
  return pickGas(remote, cached, BUNDLED);
}

function readCache(storage?: Storage): GasData | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as GasData) : null;
  } catch {
    return null;
  }
}

function writeCache(storage: Storage | undefined, data: GasData): void {
  try {
    storage?.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    /* storage blocked — ignore */
  }
}

// Module-scoped singleton so multiple consumers share one fetch (mirrors useTheme).
const gas = ref<ResolvedGas>({ data: BUNDLED, source: "estimate" });
let started = false;

export function useGasPrices() {
  onMounted(() => {
    if (started) return;
    started = true;
    loadGas().then((r) => {
      gas.value = r;
    });
  });
  return { gas };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/useGasPrices.test.ts`
Expected: PASS (3 cases).

- [ ] **Step 5: Commit**

```bash
git add src/composables/useGasPrices.ts tests/useGasPrices.test.ts
git commit -m "feat(gas): useGasPrices fetch/cache/fallback composable"
```

---

## Task 6: Wire gas into `useComparison`

**Files:**

- Modify: `src/composables/useComparison.ts`

- [ ] **Step 1: Import and call the composable**

Add to the imports in `src/composables/useComparison.ts`:

```ts
import { useGasPrices } from "./useGasPrices";
```

Inside `useComparison()`, before the `basket` computed, add:

```ts
const { gas } = useGasPrices();
```

- [ ] **Step 2: Pass gas into `localizeBasket`**

Replace the existing `basket` computed:

```ts
const basket = computed<BasketRow[]>(() => {
  if (!from.value || !to.value) return [];
  return localizeBasket(from.value, to.value, basketItems, gas.value);
});
```

- [ ] **Step 3: Typecheck + full suite**

Run: `npx vue-tsc --noEmit && npx vitest run`
Expected: passes. `tests/useComparison.test.ts` and `tests/comparePage.test.ts` still green (gas defaults to the bundled estimate; gas-gallon row now uses regional price — if an assertion checked the old gas-gallon value, update it to the regional value or assert on a non-gas row).

- [ ] **Step 4: Commit**

```bash
git add src/composables/useComparison.ts
git commit -m "feat(basket): wire live gas into the comparison basket"
```

---

## Task 7: Show the freshness tag in `BasketList`

**Files:**

- Modify: `src/components/BasketList.vue`

- [ ] **Step 1: Render `row.note` on the gas row**

In `src/components/BasketList.vue`, find where each row's label/sub-label renders. Next to the item label (the left column under the title), add a conditional tag bound to `row.note`. Match the existing eyebrow style used elsewhere:

```vue
<span
  v-if="row.note"
  class="ml-2 align-middle text-[0.5rem] uppercase opacity-60"
  style="letter-spacing: 0.04em"
>
  · {{ row.note }}
</span>
```

(Place it immediately after the row's label text. `row` is the existing `v-for` variable — match the real variable name in the template, e.g. `r`.)

- [ ] **Step 2: Verify in the preview**

Run the dev server, pick two metros in different regions (e.g., Denver → San Francisco), open the Basket, and confirm the "Gallon of gas" row shows a real regional price with a "· as of \<date>" tag. Confirm other rows are unchanged.

- [ ] **Step 3: Commit**

```bash
git add src/components/BasketList.vue
git commit -m "feat(basket): show gas freshness tag on the gas row"
```

---

## Task 8: `build-gas.py` cron script

**Files:**

- Create: `scripts/build-gas.py`

- [ ] **Step 1: Write the script**

Create `scripts/build-gas.py`:

```python
#!/usr/bin/env python3
"""Fetch EIA weekly regular-gasoline retail prices and write public/gas.json.

Source: EIA API v2, petroleum/pri/gnd (Gasoline & Diesel retail).
  product EPMR = regular gasoline, process PTE = retail price, weekly.
Run on the cron ("the_litterbox"); EIA_API_KEY lives in the cron env.
Confirm exact duoarea codes against the live API before first run.
"""
import json
import os
import sys
import urllib.request
import urllib.parse
from pathlib import Path

EIA_KEY = os.environ["EIA_API_KEY"]
BASE = "https://api.eia.gov/v2/petroleum/pri/gnd/data/"
OUT = Path(__file__).resolve().parent.parent / "public" / "gas.json"

# EIA duoarea code -> our region key
DUOAREA = {
    "NUS": "national",
    "R10": "PADD1",
    "R20": "PADD2",
    "R30": "PADD3",
    "R40": "PADD4",
    "R50": "PADD5",
    "SCA": "CA",
}


def fetch_rows() -> list[dict]:
    params = [
        ("api_key", EIA_KEY),
        ("frequency", "weekly"),
        ("data[0]", "value"),
        ("facets[product][]", "EPMR"),
        ("facets[process][]", "PTE"),
        ("sort[0][column]", "period"),
        ("sort[0][direction]", "desc"),
        ("length", "500"),
    ]
    for code in DUOAREA:
        params.append(("facets[duoarea][]", code))
    url = BASE + "?" + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url, timeout=30) as r:
        return json.load(r)["response"]["data"]


def latest_by_area(rows: list[dict]) -> dict[str, tuple[str, float]]:
    """Most-recent (period, value) per duoarea. Rows are sorted period desc."""
    out: dict[str, tuple[str, float]] = {}
    for row in rows:
        code = row.get("duoarea")
        if code in DUOAREA and code not in out and row.get("value") is not None:
            out[code] = (row["period"], round(float(row["value"]), 2))
    return out


def main() -> None:
    latest = latest_by_area(fetch_rows())
    if "NUS" not in latest:
        print("ERROR: no national value from EIA", file=sys.stderr)
        sys.exit(1)
    as_of = max(p for p, _ in latest.values())
    payload = {
        "asOf": as_of,
        "national": latest["NUS"][1],
        "regions": {
            region: latest[code][1]
            for code, region in DUOAREA.items()
            if region != "national" and code in latest
        },
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, indent=2) + "\n")
    print(f"Wrote {OUT} (asOf {as_of})", file=sys.stderr)


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Dry-run with a real key (manual confirmation)**

Run: `EIA_API_KEY=<key> python3 scripts/build-gas.py`
Expected: writes `public/gas.json` with `asOf`, `national`, and all 6 regions. If a duoarea code returns nothing, adjust it per the EIA API dashboard (https://www.eia.gov/opendata/browser/petroleum/pri/gnd) and re-run. Get a free key at https://www.eia.gov/opendata/register.php.

- [ ] **Step 3: Confirm the app reads it**

Run the dev server; `public/gas.json` is served at `/gas.json`. Reload, open the Basket — the gas row should show the freshly fetched `asOf`.

- [ ] **Step 4: Commit (script + first generated file)**

```bash
git add scripts/build-gas.py public/gas.json
git commit -m "feat(data): build-gas.py — EIA weekly gas -> public/gas.json"
```

---

## Task 9: PWA / offline correctness

**Files:**

- Modify: `vite.config.ts` (workbox runtime caching, if needed)

- [ ] **Step 1: Keep `/gas.json` network-first (not precached stale)**

In `vite.config.ts`, ensure `gas.json` is NOT added to workbox `globPatterns` precache (it would pin a stale copy). Add a runtime caching rule so it's network-first with a short cache, and offline falls through to the app's `loadGas` chain:

```ts
workbox: {
  globPatterns: ["**/*.{js,css,html,json,svg,jpg,woff2}"],
  globIgnores: ["**/gas.json"],
  runtimeCaching: [
    {
      urlPattern: ({ url }) => url.pathname === "/gas.json",
      handler: "NetworkFirst",
      options: { cacheName: "gas-json", expiration: { maxAgeSeconds: 86400 } },
    },
  ],
},
```

(If the existing `globPatterns` differs, keep its other entries; only add `globIgnores` + `runtimeCaching`.)

- [ ] **Step 2: Build and verify**

Run: `npx vue-tsc --noEmit && npx vitest run && npm run build`
Expected: typecheck clean, all tests pass, production build succeeds.

- [ ] **Step 3: Commit**

```bash
git add vite.config.ts
git commit -m "chore(pwa): network-first /gas.json, exclude from precache"
```

---

## Self-Review

**Spec coverage:**

- Basket-only scope → Tasks 4, 6, 7 (gas row only; headline untouched). ✓
- EIA source + regions → Tasks 2, 8. ✓
- Cron writes `public/gas.json` (v1 same-origin host) → Task 8. ✓
- Fetch at load + cache + fallback chain (live→cached→estimate) → Tasks 3 (`pickGas`), 5 (`loadGas`). ✓
- Gas skips goods-index formula; falls back when absent → Task 4. ✓
- Freshness label → Tasks 4 (`note`), 7 (render). ✓
- Offline / PWA network-first → Task 9. ✓
- Tests: basket regional + fallback, useGasPrices chain, gas engine → Tasks 3, 4, 5. ✓

**Placeholders:** none — every code step has full code.

**Type consistency:** `GasData`, `GasRegion`, `GasSource`, `ResolvedGas` defined in Task 1 and used identically in Tasks 3–6. `localizeBasket(from, to, items, gas?)` signature consistent across Tasks 4 and 6. `loadGas(deps)` / `pickGas(remote, cached, bundled)` signatures match between Tasks 3 and 5. Region keys (`PADD1..5`, `CA`) consistent across data (Task 2), engine (Task 3), and script (Task 8).
