# Elsewhere — Plan A: Core Calculator PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A complete, testable, deployable Vue PWA that answers "if I move from here to there, what salary keeps my life the same?" with a tangible everyday-price Basket — running on a hand-seeded ~15-metro dataset, no map and no live data pipeline yet.

**Architecture:** Three pure, unit-tested engines (`parity`, `basket`, `places`) consume bundled static JSON. A thin reactive composable holds comparison state. Vue components render over the engines — no business math in components. Mobile-first single column; PWA shell works offline.

**Tech Stack:** Vue 3 + Vite + TypeScript · Vitest + @vue/test-utils · Tailwind v4 (`@tailwindcss/vite`) · vite-plugin-pwa · deploy to Cloudflare Pages.

---

## File Structure

```
elsewhere/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── src/
│   ├── main.ts
│   ├── App.vue
│   ├── types.ts                      # Metro, BasketItem, ParityResult, BasketRow
│   ├── data/
│   │   ├── metros.json               # ~15 hand-seeded metros + RPP
│   │   └── basket.json               # everyday items + national avg prices
│   ├── engines/
│   │   ├── parity.ts                 # requiredSalary()
│   │   ├── basket.ts                 # localizeBasket()
│   │   └── places.ts                 # searchMetros(), findMetro()
│   ├── composables/
│   │   └── useComparison.ts          # reactive from/to/salary + derived results
│   ├── components/
│   │   ├── SalaryInput.vue
│   │   ├── PlacePicker.vue
│   │   ├── ResultSlab.vue
│   │   ├── BasketList.vue
│   │   └── BreakdownSheet.vue
│   ├── pages/
│   │   └── ComparePage.vue
│   └── styles/
│       └── tokens.css                # cartographic palette @theme
└── tests/
    ├── parity.test.ts
    ├── basket.test.ts
    ├── places.test.ts
    └── useComparison.test.ts
```

**Boundaries:** engines are pure (no I/O, no Vue) → fully unit-testable and reused unchanged by Plans B/C. The composable is the only stateful seam between engines and UI. The map is deliberately absent — `ResultSlab` reserves a slot a `<MapCanvas>` drops into in Plan B.

---

### Task 1: Scaffold project + test runner

**Files:**

- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.ts`, `src/App.vue`
- Test: `tests/smoke.test.ts`

- [ ] **Step 1: Scaffold Vue + TS via Vite**

Run from `~/Developer/elsewhere`:

```bash
npm create vite@latest . -- --template vue-ts
npm install
```

If prompted about the non-empty dir (the `docs/` and `.git` exist), choose "Ignore files and continue."

- [ ] **Step 2: Add dev/test deps**

```bash
npm install -D vitest @vue/test-utils jsdom @tailwindcss/vite tailwindcss
npm install vite-plugin-pwa
```

- [ ] **Step 3: Configure Vite (Tailwind v4 + PWA placeholder + Vitest)**

Replace `vite.config.ts`:

```ts
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  test: {
    environment: "jsdom",
    globals: true,
  },
});
```

Add to `package.json` scripts: `"test": "vitest run"`, `"test:watch": "vitest"`.

- [ ] **Step 4: Write a smoke test**

`tests/smoke.test.ts`:

```ts
import { describe, it, expect } from "vitest";

describe("toolchain", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run it**

Run: `npm test`
Expected: 1 passing test.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "chore: scaffold Vue+TS+Vite+Vitest for Elsewhere"
```

---

### Task 2: Types + seed data

**Files:**

- Create: `src/types.ts`, `src/data/metros.json`, `src/data/basket.json`

- [ ] **Step 1: Define types**

`src/types.ts`:

```ts
export type ParityCategory = "housing" | "goods" | "otherServices";

export interface Metro {
  id: string; // "detroit-mi"
  name: string; // "Detroit-Warren-Dearborn, MI"
  short: string; // "Detroit"
  states: string[]; // ["MI"]
  lat: number;
  lng: number;
  rpp: {
    overall: number; // 100 = national average
    housing: number;
    goods: number;
    otherServices: number;
  };
}

export interface BasketItem {
  id: string; // "pizza-slice"
  label: string; // "Slice of pizza"
  emoji: string; // "🍕"
  nationalAvg: number; // dollars
  category: ParityCategory;
}

export interface ParityResult {
  fromSalary: number;
  requiredSalary: number; // rounded to whole dollars
  delta: number; // requiredSalary - fromSalary
  pct: number; // fraction, e.g. 0.18 = 18% pricier
}

export interface BasketRow {
  id: string;
  label: string;
  emoji: string;
  fromPrice: number;
  toPrice: number;
}
```

- [ ] **Step 2: Seed metros** _(values are realistic placeholders; Plan C replaces them with real BEA RPP)_

`src/data/metros.json`:

```json
[
  {
    "id": "detroit-mi",
    "name": "Detroit-Warren-Dearborn, MI",
    "short": "Detroit",
    "states": ["MI"],
    "lat": 42.331,
    "lng": -83.046,
    "rpp": {
      "overall": 94.5,
      "housing": 80.1,
      "goods": 97.2,
      "otherServices": 96.0
    }
  },
  {
    "id": "austin-tx",
    "name": "Austin-Round Rock, TX",
    "short": "Austin",
    "states": ["TX"],
    "lat": 30.267,
    "lng": -97.743,
    "rpp": {
      "overall": 103.2,
      "housing": 112.8,
      "goods": 98.9,
      "otherServices": 101.4
    }
  },
  {
    "id": "nyc-ny",
    "name": "New York-Newark-Jersey City, NY-NJ",
    "short": "New York",
    "states": ["NY", "NJ"],
    "lat": 40.713,
    "lng": -74.006,
    "rpp": {
      "overall": 122.4,
      "housing": 168.2,
      "goods": 104.1,
      "otherServices": 113.0
    }
  },
  {
    "id": "chicago-il",
    "name": "Chicago-Naperville-Elgin, IL",
    "short": "Chicago",
    "states": ["IL"],
    "lat": 41.878,
    "lng": -87.63,
    "rpp": {
      "overall": 106.1,
      "housing": 118.0,
      "goods": 99.8,
      "otherServices": 104.2
    }
  },
  {
    "id": "denver-co",
    "name": "Denver-Aurora-Lakewood, CO",
    "short": "Denver",
    "states": ["CO"],
    "lat": 39.739,
    "lng": -104.99,
    "rpp": {
      "overall": 105.8,
      "housing": 124.5,
      "goods": 98.0,
      "otherServices": 102.9
    }
  },
  {
    "id": "atlanta-ga",
    "name": "Atlanta-Sandy Springs-Alpharetta, GA",
    "short": "Atlanta",
    "states": ["GA"],
    "lat": 33.749,
    "lng": -84.388,
    "rpp": {
      "overall": 99.0,
      "housing": 95.3,
      "goods": 98.4,
      "otherServices": 100.1
    }
  },
  {
    "id": "phoenix-az",
    "name": "Phoenix-Mesa-Chandler, AZ",
    "short": "Phoenix",
    "states": ["AZ"],
    "lat": 33.448,
    "lng": -112.074,
    "rpp": {
      "overall": 100.4,
      "housing": 102.7,
      "goods": 99.1,
      "otherServices": 99.6
    }
  },
  {
    "id": "seattle-wa",
    "name": "Seattle-Tacoma-Bellevue, WA",
    "short": "Seattle",
    "states": ["WA"],
    "lat": 47.606,
    "lng": -122.332,
    "rpp": {
      "overall": 113.6,
      "housing": 142.0,
      "goods": 101.2,
      "otherServices": 108.0
    }
  },
  {
    "id": "miami-fl",
    "name": "Miami-Fort Lauderdale-Pompano Beach, FL",
    "short": "Miami",
    "states": ["FL"],
    "lat": 25.762,
    "lng": -80.192,
    "rpp": {
      "overall": 107.7,
      "housing": 126.4,
      "goods": 100.0,
      "otherServices": 104.6
    }
  },
  {
    "id": "nashville-tn",
    "name": "Nashville-Davidson-Murfreesboro, TN",
    "short": "Nashville",
    "states": ["TN"],
    "lat": 36.163,
    "lng": -86.781,
    "rpp": {
      "overall": 97.6,
      "housing": 98.0,
      "goods": 97.0,
      "otherServices": 97.8
    }
  },
  {
    "id": "minneapolis-mn",
    "name": "Minneapolis-St. Paul-Bloomington, MN",
    "short": "Minneapolis",
    "states": ["MN"],
    "lat": 44.978,
    "lng": -93.265,
    "rpp": {
      "overall": 101.5,
      "housing": 104.2,
      "goods": 99.5,
      "otherServices": 101.0
    }
  },
  {
    "id": "portland-or",
    "name": "Portland-Vancouver-Hillsboro, OR-WA",
    "short": "Portland",
    "states": ["OR", "WA"],
    "lat": 45.515,
    "lng": -122.679,
    "rpp": {
      "overall": 107.0,
      "housing": 128.0,
      "goods": 99.0,
      "otherServices": 103.5
    }
  },
  {
    "id": "columbus-oh",
    "name": "Columbus, OH",
    "short": "Columbus",
    "states": ["OH"],
    "lat": 39.961,
    "lng": -82.999,
    "rpp": {
      "overall": 92.8,
      "housing": 82.0,
      "goods": 96.5,
      "otherServices": 94.0
    }
  },
  {
    "id": "raleigh-nc",
    "name": "Raleigh-Cary, NC",
    "short": "Raleigh",
    "states": ["NC"],
    "lat": 35.78,
    "lng": -78.639,
    "rpp": {
      "overall": 98.2,
      "housing": 96.0,
      "goods": 98.0,
      "otherServices": 99.0
    }
  },
  {
    "id": "lasvegas-nv",
    "name": "Las Vegas-Henderson-Paradise, NV",
    "short": "Las Vegas",
    "states": ["NV"],
    "lat": 36.17,
    "lng": -115.14,
    "rpp": {
      "overall": 98.6,
      "housing": 100.5,
      "goods": 98.2,
      "otherServices": 98.0
    }
  }
]
```

- [ ] **Step 3: Seed basket**

`src/data/basket.json`:

```json
[
  {
    "id": "pizza-slice",
    "label": "Slice of pizza",
    "emoji": "🍕",
    "nationalAvg": 3.5,
    "category": "goods"
  },
  {
    "id": "gas-gallon",
    "label": "Gallon of gas",
    "emoji": "⛽",
    "nationalAvg": 3.4,
    "category": "goods"
  },
  {
    "id": "beer-sixpack",
    "label": "Six-pack of beer",
    "emoji": "🍺",
    "nationalAvg": 9.5,
    "category": "goods"
  },
  {
    "id": "coffee",
    "label": "Cup of coffee",
    "emoji": "☕",
    "nationalAvg": 4.25,
    "category": "otherServices"
  },
  {
    "id": "rent-1br",
    "label": "1-bedroom rent",
    "emoji": "🏠",
    "nationalAvg": 1500,
    "category": "housing"
  }
]
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(data): types + hand-seeded metros and basket"
```

---

### Task 3: `parity` engine (TDD)

**Files:**

- Create: `src/engines/parity.ts`, `tests/parity.test.ts`

- [ ] **Step 1: Write failing test**

`tests/parity.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { requiredSalary } from "../src/engines/parity";
import type { Metro } from "../src/types";

const detroit = {
  rpp: { overall: 94.5, housing: 80.1, goods: 97.2, otherServices: 96.0 },
} as Metro;
const austin = {
  rpp: { overall: 103.2, housing: 112.8, goods: 98.9, otherServices: 101.4 },
} as Metro;

describe("requiredSalary", () => {
  it("scales salary by the ratio of overall RPPs", () => {
    const r = requiredSalary(detroit, austin, 70000);
    // 70000 * (103.2 / 94.5) = 76444.4...
    expect(r.requiredSalary).toBe(76444);
    expect(r.fromSalary).toBe(70000);
    expect(r.delta).toBe(6444);
    expect(r.pct).toBeCloseTo(103.2 / 94.5 - 1, 5);
  });

  it("returns a lower number when moving somewhere cheaper", () => {
    const r = requiredSalary(austin, detroit, 100000);
    expect(r.requiredSalary).toBeLessThan(100000);
    expect(r.delta).toBeLessThan(0);
  });

  it("is identity when both metros are equal", () => {
    const r = requiredSalary(detroit, detroit, 50000);
    expect(r.requiredSalary).toBe(50000);
    expect(r.delta).toBe(0);
    expect(r.pct).toBe(0);
  });
});
```

- [ ] **Step 2: Run — verify it fails**

Run: `npx vitest run tests/parity.test.ts`
Expected: FAIL — `requiredSalary is not a function` / module not found.

- [ ] **Step 3: Implement**

`src/engines/parity.ts`:

```ts
import type { Metro, ParityResult } from "../types";

export function requiredSalary(
  from: Metro,
  to: Metro,
  salary: number,
): ParityResult {
  const ratio = to.rpp.overall / from.rpp.overall;
  const required = Math.round(salary * ratio);
  return {
    fromSalary: salary,
    requiredSalary: required,
    delta: required - salary,
    pct: ratio - 1,
  };
}
```

- [ ] **Step 4: Run — verify pass**

Run: `npx vitest run tests/parity.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(engine): parity required-salary calculator"
```

---

### Task 4: `basket` engine (TDD)

**Files:**

- Create: `src/engines/basket.ts`, `tests/basket.test.ts`

- [ ] **Step 1: Write failing test**

`tests/basket.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { localizeBasket } from "../src/engines/basket";
import type { Metro, BasketItem } from "../src/types";

const detroit = {
  rpp: { overall: 94.5, housing: 80.1, goods: 97.2, otherServices: 96.0 },
} as Metro;
const austin = {
  rpp: { overall: 103.2, housing: 112.8, goods: 98.9, otherServices: 101.4 },
} as Metro;

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
    label: "1-bedroom rent",
    emoji: "🏠",
    nationalAvg: 1500,
    category: "housing",
  },
];

describe("localizeBasket", () => {
  it("bends each national price by the right category parity for both metros", () => {
    const rows = localizeBasket(detroit, austin, items);
    const pizza = rows.find((r) => r.id === "pizza-slice")!;
    // from: 3.5 * 97.2/100 = 3.402 -> 3.40 ; to: 3.5 * 98.9/100 = 3.4615 -> 3.46
    expect(pizza.fromPrice).toBe(3.4);
    expect(pizza.toPrice).toBe(3.46);
    const rent = rows.find((r) => r.id === "rent-1br")!;
    // from: 1500 * 80.1/100 = 1201.5 ; to: 1500 * 112.8/100 = 1692
    expect(rent.fromPrice).toBe(1201.5);
    expect(rent.toPrice).toBe(1692);
  });

  it("preserves label and emoji and order", () => {
    const rows = localizeBasket(detroit, austin, items);
    expect(rows.map((r) => r.id)).toEqual(["pizza-slice", "rent-1br"]);
    expect(rows[0].emoji).toBe("🍕");
  });
});
```

- [ ] **Step 2: Run — verify it fails**

Run: `npx vitest run tests/basket.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/engines/basket.ts`:

```ts
import type { Metro, BasketItem, BasketRow } from "../types";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function localizeBasket(
  from: Metro,
  to: Metro,
  items: BasketItem[],
): BasketRow[] {
  return items.map((item) => ({
    id: item.id,
    label: item.label,
    emoji: item.emoji,
    fromPrice: round2(item.nationalAvg * (from.rpp[item.category] / 100)),
    toPrice: round2(item.nationalAvg * (to.rpp[item.category] / 100)),
  }));
}
```

- [ ] **Step 4: Run — verify pass**

Run: `npx vitest run tests/basket.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(engine): basket price localization"
```

---

### Task 5: `places` engine (TDD)

**Files:**

- Create: `src/engines/places.ts`, `tests/places.test.ts`

- [ ] **Step 1: Write failing test**

`tests/places.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { searchMetros, findMetro } from "../src/engines/places";
import type { Metro } from "../src/types";

const metros: Metro[] = [
  {
    id: "detroit-mi",
    name: "Detroit-Warren-Dearborn, MI",
    short: "Detroit",
    states: ["MI"],
    lat: 0,
    lng: 0,
    rpp: { overall: 94.5, housing: 80, goods: 97, otherServices: 96 },
  },
  {
    id: "austin-tx",
    name: "Austin-Round Rock, TX",
    short: "Austin",
    states: ["TX"],
    lat: 0,
    lng: 0,
    rpp: { overall: 103, housing: 112, goods: 98, otherServices: 101 },
  },
  {
    id: "denver-co",
    name: "Denver-Aurora-Lakewood, CO",
    short: "Denver",
    states: ["CO"],
    lat: 0,
    lng: 0,
    rpp: { overall: 105, housing: 124, goods: 98, otherServices: 102 },
  },
];

describe("searchMetros", () => {
  it("matches on short name, case-insensitive", () => {
    expect(searchMetros(metros, "det").map((m) => m.id)).toEqual([
      "detroit-mi",
    ]);
    expect(searchMetros(metros, "AUS").map((m) => m.id)).toEqual(["austin-tx"]);
  });

  it("matches on a state code exactly", () => {
    expect(searchMetros(metros, "CO").map((m) => m.id)).toEqual(["denver-co"]);
  });

  it("returns empty for blank query", () => {
    expect(searchMetros(metros, "   ")).toEqual([]);
  });
});

describe("findMetro", () => {
  it("returns the metro by id", () => {
    expect(findMetro(metros, "austin-tx")?.short).toBe("Austin");
  });
  it("returns undefined for unknown id", () => {
    expect(findMetro(metros, "nope")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run — verify it fails**

Run: `npx vitest run tests/places.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/engines/places.ts`:

```ts
import type { Metro } from "../types";

export function searchMetros(metros: Metro[], query: string): Metro[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return metros
    .filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.short.toLowerCase().includes(q) ||
        m.states.some((s) => s.toLowerCase() === q),
    )
    .slice(0, 8);
}

export function findMetro(metros: Metro[], id: string): Metro | undefined {
  return metros.find((m) => m.id === id);
}
```

- [ ] **Step 4: Run — verify pass**

Run: `npx vitest run tests/places.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(engine): metro type-ahead search + lookup"
```

---

### Task 6: `useComparison` composable (TDD)

**Files:**

- Create: `src/composables/useComparison.ts`, `tests/useComparison.test.ts`

- [ ] **Step 1: Write failing test**

`tests/useComparison.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { useComparison } from "../src/composables/useComparison";

describe("useComparison", () => {
  it("has no result until from, to, and a positive salary are set", () => {
    const c = useComparison();
    expect(c.result.value).toBeNull();
    c.setFrom("detroit-mi");
    c.setTo("austin-tx");
    expect(c.result.value).toBeNull(); // salary still 0
    c.setSalary(70000);
    expect(c.result.value?.requiredSalary).toBe(76444);
  });

  it("produces basket rows once both metros are chosen", () => {
    const c = useComparison();
    c.setFrom("detroit-mi");
    c.setTo("austin-tx");
    expect(c.basket.value.length).toBeGreaterThan(0);
    expect(c.basket.value[0]).toHaveProperty("fromPrice");
  });

  it("recomputes when salary changes", () => {
    const c = useComparison();
    c.setFrom("detroit-mi");
    c.setTo("austin-tx");
    c.setSalary(70000);
    const first = c.result.value!.requiredSalary;
    c.setSalary(140000);
    expect(c.result.value!.requiredSalary).toBe(first * 2);
  });
});
```

- [ ] **Step 2: Run — verify it fails**

Run: `npx vitest run tests/useComparison.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/composables/useComparison.ts`:

```ts
import { ref, computed } from "vue";
import metrosData from "../data/metros.json";
import basketData from "../data/basket.json";
import type { Metro, BasketItem, ParityResult, BasketRow } from "../types";
import { findMetro } from "../engines/places";
import { requiredSalary } from "../engines/parity";
import { localizeBasket } from "../engines/basket";

const metros = metrosData as Metro[];
const basketItems = basketData as BasketItem[];

export function useComparison() {
  const fromId = ref<string | null>(null);
  const toId = ref<string | null>(null);
  const salary = ref(0);

  const from = computed(() =>
    fromId.value ? (findMetro(metros, fromId.value) ?? null) : null,
  );
  const to = computed(() =>
    toId.value ? (findMetro(metros, toId.value) ?? null) : null,
  );

  const result = computed<ParityResult | null>(() => {
    if (!from.value || !to.value || salary.value <= 0) return null;
    return requiredSalary(from.value, to.value, salary.value);
  });

  const basket = computed<BasketRow[]>(() => {
    if (!from.value || !to.value) return [];
    return localizeBasket(from.value, to.value, basketItems);
  });

  return {
    metros,
    from,
    to,
    salary,
    result,
    basket,
    setFrom: (id: string) => (fromId.value = id),
    setTo: (id: string) => (toId.value = id),
    setSalary: (n: number) => (salary.value = n),
  };
}
```

- [ ] **Step 4: Run — verify pass**

Run: `npx vitest run tests/useComparison.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(state): useComparison composable wiring engines to data"
```

---

### Task 7: Cartographic tokens

**Files:**

- Create: `src/styles/tokens.css`
- Modify: `src/main.ts`

- [ ] **Step 1: Write tokens (Tailwind v4 @theme)**

`src/styles/tokens.css`:

```css
@import "tailwindcss";

@theme {
  /* cartographic palette — "the texture of moving" */
  --color-paper: #f7f5ef; /* atlas paper background */
  --color-ink: #1a1d1a; /* near-black slab + text */
  --color-terrain: #3f7d4e; /* terrain green */
  --color-water: #2f6fb0; /* water blue */
  --color-route: #e0662a; /* highway-sign warm — the route motif */
  --color-contour: #d8d2c2; /* contour linework */
  --color-cheaper: #2f8a5b; /* delta positive (cheaper) */
  --color-pricier: #c2452f; /* delta negative (pricier) */

  --radius-sheet: 20px; /* bottom-sheet cards */
  --radius-pill: 9999px; /* pill nav */
}

html,
body,
#app {
  height: 100%;
}
body {
  background: var(--color-paper);
  color: var(--color-ink);
  margin: 0;
}
```

- [ ] **Step 2: Import in main.ts**

`src/main.ts`:

```ts
import { createApp } from "vue";
import App from "./App.vue";
import "./styles/tokens.css";

createApp(App).mount("#app");
```

- [ ] **Step 3: Verify build compiles**

Run: `npm run build`
Expected: build succeeds, no CSS errors.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "style: cartographic palette tokens"
```

---

### Task 8: `SalaryInput` component

**Files:**

- Create: `src/components/SalaryInput.vue`

- [ ] **Step 1: Implement**

`src/components/SalaryInput.vue`:

```vue
<script setup lang="ts">
const props = defineProps<{ modelValue: number }>();
const emit = defineEmits<{ "update:modelValue": [n: number] }>();

function onInput(e: Event) {
  const raw = (e.target as HTMLInputElement).value.replace(/[^0-9]/g, "");
  emit("update:modelValue", raw ? Number(raw) : 0);
}

const display = () =>
  props.modelValue > 0 ? props.modelValue.toLocaleString("en-US") : "";
</script>

<template>
  <label class="block">
    <span class="text-sm uppercase tracking-wide opacity-70"
      >Your current salary</span
    >
    <div
      class="mt-1 flex items-center rounded-[var(--radius-sheet)] bg-white px-4 py-3 shadow"
    >
      <span class="text-2xl font-bold">$</span>
      <input
        :value="display()"
        @input="onInput"
        inputmode="numeric"
        placeholder="70,000"
        class="ml-1 w-full bg-transparent text-2xl font-bold outline-none"
        aria-label="Current salary in dollars"
      />
    </div>
  </label>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat(ui): SalaryInput with numeric keypad + comma formatting"
```

---

### Task 9: `PlacePicker` component

**Files:**

- Create: `src/components/PlacePicker.vue`

- [ ] **Step 1: Implement**

`src/components/PlacePicker.vue`:

```vue
<script setup lang="ts">
import { ref, computed } from "vue";
import type { Metro } from "../types";
import { searchMetros, findMetro } from "../engines/places";

const props = defineProps<{
  label: string;
  metros: Metro[];
  modelValue: string | null;
}>();
const emit = defineEmits<{ "update:modelValue": [id: string] }>();

const query = ref("");
const open = ref(false);
const matches = computed(() => searchMetros(props.metros, query.value));
const selected = computed(() =>
  props.modelValue ? (findMetro(props.metros, props.modelValue) ?? null) : null,
);

function choose(m: Metro) {
  emit("update:modelValue", m.id);
  query.value = "";
  open.value = false;
}
</script>

<template>
  <div class="relative">
    <span class="text-sm uppercase tracking-wide opacity-70">{{ label }}</span>
    <input
      :value="open ? query : (selected?.short ?? '')"
      @focus="open = true"
      @input="
        (e) => {
          query = (e.target as HTMLInputElement).value;
          open = true;
        }
      "
      :placeholder="selected ? selected.short : 'Type a city…'"
      class="mt-1 w-full rounded-[var(--radius-sheet)] bg-white px-4 py-3 text-lg font-semibold shadow outline-none"
      :aria-label="label"
    />
    <ul
      v-if="open && matches.length"
      class="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-[var(--radius-sheet)] bg-white shadow-lg"
    >
      <li
        v-for="m in matches"
        :key="m.id"
        @mousedown.prevent="choose(m)"
        class="cursor-pointer px-4 py-3 hover:bg-[var(--color-contour)]"
      >
        <span class="font-semibold">{{ m.short }}</span>
        <span class="ml-1 text-sm opacity-60">{{ m.states.join(", ") }}</span>
      </li>
    </ul>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat(ui): PlacePicker type-ahead"
```

---

### Task 10: `ResultSlab` component

**Files:**

- Create: `src/components/ResultSlab.vue`

- [ ] **Step 1: Implement**

`src/components/ResultSlab.vue`:

```vue
<script setup lang="ts">
import { computed } from "vue";
import type { Metro, ParityResult } from "../types";

const props = defineProps<{ from: Metro; to: Metro; result: ParityResult }>();

const money = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
const cheaper = computed(() => props.result.delta < 0);
const pctText = computed(
  () => `${Math.abs(Math.round(props.result.pct * 100))}%`,
);
</script>

<template>
  <!-- map slot reserved for Plan B -->
  <section
    class="rounded-[var(--radius-sheet)] bg-[var(--color-ink)] p-6 text-[var(--color-paper)] shadow-lg"
  >
    <p class="text-sm uppercase tracking-wide opacity-70">
      To live like {{ money(result.fromSalary) }} in {{ from.short }}
    </p>
    <p class="mt-2 text-sm uppercase tracking-wide opacity-70">you'd need</p>
    <p class="mt-1 text-5xl font-extrabold leading-none">
      {{ money(result.requiredSalary) }}
    </p>
    <p class="mt-1 text-lg opacity-90">in {{ to.short }}</p>
    <p
      class="mt-4 inline-block rounded-[var(--radius-pill)] px-3 py-1 text-sm font-bold"
      :style="{
        background: cheaper ? 'var(--color-cheaper)' : 'var(--color-pricier)',
      }"
    >
      {{ cheaper ? "↓" : "↑" }} {{ money(Math.abs(result.delta)) }} ({{
        pctText
      }}
      {{ cheaper ? "cheaper" : "pricier" }})
    </p>
  </section>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat(ui): ResultSlab hero with delta pill"
```

---

### Task 11: `BasketList` component

**Files:**

- Create: `src/components/BasketList.vue`

- [ ] **Step 1: Implement**

`src/components/BasketList.vue`:

```vue
<script setup lang="ts">
import type { BasketRow, Metro } from "../types";

defineProps<{ rows: BasketRow[]; from: Metro; to: Metro }>();

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });
</script>

<template>
  <section class="rounded-[var(--radius-sheet)] bg-white p-5 shadow">
    <h2 class="text-sm uppercase tracking-wide opacity-70">The Basket</h2>
    <p class="mb-3 text-xs opacity-50">Estimated from regional price parity</p>
    <ul>
      <li
        v-for="r in rows"
        :key="r.id"
        class="flex items-center justify-between border-b border-[var(--color-contour)] py-2 last:border-0"
      >
        <span class="flex items-center gap-2"
          ><span class="text-xl">{{ r.emoji }}</span
          >{{ r.label }}</span
        >
        <span class="text-right text-sm">
          <span class="opacity-60"
            >{{ from.short }} {{ money(r.fromPrice) }}</span
          >
          <span class="mx-1">→</span>
          <span class="font-bold">{{ to.short }} {{ money(r.toPrice) }}</span>
        </span>
      </li>
    </ul>
  </section>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat(ui): BasketList tangible price anchor"
```

---

### Task 12: `BreakdownSheet` component

**Files:**

- Create: `src/components/BreakdownSheet.vue`

- [ ] **Step 1: Implement**

`src/components/BreakdownSheet.vue`:

```vue
<script setup lang="ts">
import { ref } from "vue";
import type { Metro } from "../types";

const props = defineProps<{ from: Metro; to: Metro }>();
const open = ref(false);

const rows = () =>
  (["housing", "goods", "otherServices"] as const).map((k) => ({
    key: k,
    label: {
      housing: "Housing",
      goods: "Goods & groceries",
      otherServices: "Services",
    }[k],
    from: props.from.rpp[k],
    to: props.to.rpp[k],
  }));
</script>

<template>
  <section class="rounded-[var(--radius-sheet)] bg-white p-5 shadow">
    <button
      @click="open = !open"
      class="flex w-full items-center justify-between text-sm font-semibold uppercase tracking-wide"
    >
      Why? Category breakdown
      <span>{{ open ? "−" : "+" }}</span>
    </button>
    <ul v-if="open" class="mt-3">
      <li
        v-for="r in rows()"
        :key="r.key"
        class="flex items-center justify-between border-b border-[var(--color-contour)] py-2 last:border-0"
      >
        <span>{{ r.label }}</span>
        <span class="text-sm">
          <span class="opacity-60">{{ from.short }} {{ r.from }}</span>
          <span class="mx-1">→</span>
          <span class="font-bold">{{ to.short }} {{ r.to }}</span>
        </span>
      </li>
    </ul>
    <p v-if="open" class="mt-2 text-xs opacity-50">
      Index where 100 = U.S. average (BEA RPP).
    </p>
  </section>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat(ui): BreakdownSheet category parity tap-through"
```

---

### Task 13: `ComparePage` + `App.vue` wiring

**Files:**

- Create: `src/pages/ComparePage.vue`
- Modify: `src/App.vue`

- [ ] **Step 1: Build the page**

`src/pages/ComparePage.vue`:

```vue
<script setup lang="ts">
import { useComparison } from "../composables/useComparison";
import PlacePicker from "../components/PlacePicker.vue";
import SalaryInput from "../components/SalaryInput.vue";
import ResultSlab from "../components/ResultSlab.vue";
import BasketList from "../components/BasketList.vue";
import BreakdownSheet from "../components/BreakdownSheet.vue";

const c = useComparison();
</script>

<template>
  <main class="mx-auto flex min-h-full max-w-md flex-col gap-4 p-4">
    <h1 class="text-center text-2xl font-extrabold">Elsewhere</h1>

    <ResultSlab
      v-if="c.result.value && c.from.value && c.to.value"
      :from="c.from.value"
      :to="c.to.value"
      :result="c.result.value"
    />
    <BasketList
      v-if="c.from.value && c.to.value"
      :rows="c.basket.value"
      :from="c.from.value"
      :to="c.to.value"
    />
    <BreakdownSheet
      v-if="c.from.value && c.to.value"
      :from="c.from.value"
      :to="c.to.value"
    />

    <!-- inputs live in the thumb zone -->
    <div class="mt-auto flex flex-col gap-3 pt-4">
      <PlacePicker
        label="From"
        :metros="c.metros"
        :model-value="c.from.value?.id ?? null"
        @update:model-value="c.setFrom"
      />
      <PlacePicker
        label="To"
        :metros="c.metros"
        :model-value="c.to.value?.id ?? null"
        @update:model-value="c.setTo"
      />
      <SalaryInput
        :model-value="c.salary.value"
        @update:model-value="c.setSalary"
      />
    </div>
  </main>
</template>
```

- [ ] **Step 2: Mount it**

`src/App.vue`:

```vue
<script setup lang="ts">
import ComparePage from "./pages/ComparePage.vue";
</script>

<template>
  <ComparePage />
</template>
```

- [ ] **Step 3: Manual verify in dev server**

Run: `npm run dev`
In the browser: pick From = Detroit, To = Austin, salary = 70000. Expected: ResultSlab shows ~$76,444, an "↑ pricier" pill, the Basket lists pizza/gas/etc. with both-city prices, and Breakdown expands category indices.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(ui): ComparePage wiring all components"
```

---

### Task 14: PWA shell (offline)

**Files:**

- Modify: `vite.config.ts`, `index.html`
- Create: `public/manifest` icons referenced by the plugin (use a placeholder 512px PNG for now)

- [ ] **Step 1: Enable vite-plugin-pwa**

Update `vite.config.ts` plugins to include:

```ts
import { VitePWA } from 'vite-plugin-pwa'
// ...
plugins: [
  vue(),
  tailwindcss(),
  VitePWA({
    registerType: 'autoUpdate',
    manifest: {
      name: 'Elsewhere',
      short_name: 'Elsewhere',
      description: 'Cost-of-living parity — what salary keeps your life the same?',
      theme_color: '#1a1d1a',
      background_color: '#f7f5ef',
      display: 'standalone',
      icons: [{ src: '/icon-512.png', sizes: '512x512', type: 'image/png' }],
    },
    workbox: { globPatterns: ['**/*.{js,css,html,json,woff2}'] },
  }),
],
```

- [ ] **Step 2: Add a placeholder icon**

Drop any 512×512 PNG at `public/icon-512.png` (replace with branded icon during the visual polish pass).

- [ ] **Step 3: Build + preview, confirm SW registers**

Run: `npm run build && npm run preview`
Expected: build emits `sw.js` + `manifest.webmanifest`; in the browser devtools → Application → Service Workers shows the worker active. Toggle offline and reload — the calculator still loads and computes (data is bundled).

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(pwa): offline app shell via vite-plugin-pwa"
```

---

### Task 15: Cloudflare Pages deploy config

**Files:**

- Create: `wrangler.toml` (optional, for `wrangler pages` CLI) or document dashboard settings in `README.md`

- [ ] **Step 1: Document/declare build settings**

Create `README.md` with the Cloudflare Pages settings:

```md
## Deploy (Cloudflare Pages)

- Build command: `npm run build`
- Build output directory: `dist`
- Node version: 20
```

- [ ] **Step 2: Full verification gate**

Run: `npm run build && npm test`
Expected: build succeeds; all engine + composable tests pass (13 tests total).

- [ ] **Step 3: First deploy**

Connect the repo in the Cloudflare Pages dashboard (or `npx wrangler pages deploy dist`). Confirm the live URL loads, installs to home screen on a phone, and computes Detroit→Austin offline after first load.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "docs: Cloudflare Pages deploy config + verification"
```

---

## Self-Review

**Spec coverage:** §1 scope (door #1 only) → Tasks 6/13. §2 metro granularity → Task 2 seed + engines. §3 data model + basket math → Tasks 2/4. §4 static-first/offline/units → Tasks 3-6/14. §5 three screens → Tasks 8-13. §6 visual chrome+identity → Tasks 7/10/11 (map slot reserved, full map = Plan B). §8 testing → Tasks 3-6. ZIP rent overlay is represented in the seed as the `rent-1br` basket item + housing parity; true ZIP-level rent arrives with Plan C — noted, not a v1-core gap.

**Placeholder scan:** none — every step has runnable code or an exact command. Seed RPP values are explicitly labeled realistic placeholders replaced by Plan C.

**Type consistency:** `Metro`, `BasketItem`, `ParityResult`, `BasketRow` defined in Task 2 and used unchanged in Tasks 3-13. `requiredSalary`/`localizeBasket`/`searchMetros`/`findMetro` signatures match across engines, composable, and tests.

**Deferred to other plans:** live map (Plan B), real BEA/HUD/Zillow data + ZIP rents + cron (Plan C). Both are explicit in the spec roadmap.
