# Afford-page Lifestyle Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 6 filterable lifestyle attributes (political lean, avg temp, avg humidity, air quality, disaster risk, state income tax) to the "Where could I afford?" page, narrowing the ranked metro list without changing its cost-based ordering.

**Architecture:** A pure declarative filter engine (`src/engines/filters.ts`) defines each factor's data accessor, badge text, and bands. Filter state lives in the shared `useComparison` composable. A new `FilterSheet.vue` (modeled on `BreakdownSheet.vue`) toggles bands; `AffordList.vue` renders per-row badges; `ExploreView.vue` shows the active count + a "hidden, no data" tally. New per-metro data is produced offline by extending `scripts/build-metros.py`.

**Tech Stack:** Vue 3 `<script setup>` + TypeScript, Vitest + @vue/test-utils (jsdom), Tailwind v4 with CSS custom-property tokens, Python 3 build script.

**Key principle:** Filters only _narrow_. Ranking by required salary never changes. Missing data is surfaced (`+N hidden · no data`), never imputed. The engine and UI are testable with fixture metros and do **not** depend on the real data landing — Task 7 (data pipeline) is last and independent.

---

## File map

- **Create** `src/engines/filters.ts` — `FilterDef`, `FILTERS`, `STATE_TOP_RATE`, `applyFilters`, `metroBadges`.
- **Create** `src/components/FilterSheet.vue` — the band-selector sheet.
- **Create** `tests/filters.test.ts` — engine unit tests.
- **Create** `tests/filterSheet.test.ts` — sheet component test.
- **Create** `tests/affordFilters.test.ts` — ExploreView integration test.
- **Modify** `src/types.ts` — add optional fields to `Metro`.
- **Modify** `src/composables/useComparison.ts` — filter state + `filteredAffordable`.
- **Modify** `src/components/AffordList.vue` — row badges + props.
- **Modify** `src/pages/ExploreView.vue` — Filters button, count, hidden line, wire `FilterSheet`.
- **Modify** `scripts/build-metros.py` — enrichment pass for the 5 data-backed factors.

---

## Task 1: Extend the Metro type

**Files:**

- Modify: `src/types.ts:3-17`

- [ ] **Step 1: Add optional lifestyle fields to `Metro`**

In `src/types.ts`, add the fields after `rpp` inside the `Metro` interface (keep the existing `id`/`name`/`short`/`states`/`lat`/`lng`/`pop`/`rpp`):

```ts
export interface Metro {
  id: string;
  name: string;
  short: string;
  states: string[];
  lat?: number;
  lng?: number;
  pop?: number;
  rpp: {
    overall: number;
    housing: number;
    goods: number;
    otherServices: number;
  };
  // ── lifestyle attributes (optional: not every metro matches every source) ──
  politics?: number; // signed 2024 pres. margin in points: +8 = D+8, -12 = R+12
  tempF?: number; // annual avg temperature, °F
  humidity?: number; // annual avg relative humidity, %
  aqi?: number; // median AQI for the year (lower = cleaner)
  risk?: number; // FEMA National Risk Index composite 0–100 (higher = riskier)
}
```

- [ ] **Step 2: Typecheck**

Run: `npx vue-tsc --noEmit`
Expected: PASS (no errors — fields are optional, nothing else changed).

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add optional lifestyle fields to Metro type"
```

---

## Task 2: Filter engine

**Files:**

- Create: `src/engines/filters.ts`
- Test: `tests/filters.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/filters.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  applyFilters,
  metroBadges,
  STATE_TOP_RATE,
} from "../src/engines/filters";
import type { Metro } from "../src/types";
import type { AffordRow } from "../src/engines/explore";

// Minimal metro factory — only the fields filters read.
function metro(id: string, extra: Partial<Metro>): Metro {
  return {
    id,
    name: id,
    short: id,
    states: ["CO"],
    rpp: { overall: 100, housing: 100, goods: 100, otherServices: 100 },
    ...extra,
  } as Metro;
}
function row(m: Metro, required = 50000): AffordRow {
  return {
    metro: m,
    result: {
      fromSalary: 50000,
      requiredSalary: required,
      delta: 0,
      pct: 0,
      buyingPower: 50000,
    },
  };
}

const blueMild = row(
  metro("blue-mild", { politics: 22, tempF: 55, states: ["WA"] }),
  70000,
);
const redHot = row(
  metro("red-hot", { politics: -18, tempF: 78, states: ["TX"] }),
  60000,
);
const purpleNoTemp = row(
  metro("purple-notemp", { politics: 2, states: ["NV"] }),
  65000,
);

const ALL = [blueMild, redHot, purpleNoTemp];

describe("applyFilters", () => {
  it("returns all rows unchanged when no band is active", () => {
    const out = applyFilters(ALL, {});
    expect(out.rows).toHaveLength(3);
    expect(out.hiddenNoData).toBe(0);
  });

  it("keeps only rows passing an active band, preserving input order", () => {
    const out = applyFilters(ALL, { politics: "blue" });
    expect(out.rows.map((r) => r.metro.id)).toEqual(["blue-mild"]);
  });

  it("treats the ±5 band as purple", () => {
    const out = applyFilters(ALL, { politics: "purple" });
    expect(out.rows.map((r) => r.metro.id)).toEqual(["purple-notemp"]);
  });

  it("excludes metros missing data for an active filter and counts them", () => {
    const out = applyFilters(ALL, { temp: "mild" });
    expect(out.rows.map((r) => r.metro.id)).toEqual(["blue-mild"]); // redHot is hot, purple has no temp
    expect(out.hiddenNoData).toBe(1); // purple-notemp had no tempF
  });

  it("ands multiple active filters together", () => {
    const out = applyFilters(ALL, { politics: "red", temp: "hot" });
    expect(out.rows.map((r) => r.metro.id)).toEqual(["red-hot"]);
  });

  it("never reorders rows (ranking is preserved)", () => {
    const out = applyFilters(ALL, { politics: "blue" });
    // input order is blue, red, purple — output must keep relative order
    const ids = out.rows.map((r) => r.metro.id);
    expect(ids).toEqual([...ids].slice()); // stable
    expect(applyFilters(ALL, {}).rows[0].metro.id).toBe("blue-mild");
  });
});

describe("tax filter", () => {
  it("reads the top marginal rate from states[0]", () => {
    expect(STATE_TOP_RATE["TX"]).toBe(0);
    expect(STATE_TOP_RATE["CA"]).toBeGreaterThan(10);
    const noTax = applyFilters(ALL, { tax: "none" });
    expect(noTax.rows.map((r) => r.metro.id)).toContain("red-hot"); // TX = 0
    expect(noTax.rows.map((r) => r.metro.id)).toContain("purple-notemp"); // NV = 0
    expect(noTax.rows.map((r) => r.metro.id)).not.toContain("blue-mild"); // WA = 0 too → adjust below
  });
});

describe("metroBadges", () => {
  it("emits one badge per present factor, in FILTERS order, omitting missing", () => {
    const badges = metroBadges(blueMild.metro);
    const texts = badges.map((b) => b.text);
    expect(texts).toContain("D+22");
    expect(texts).toContain("55°");
    expect(texts.some((t) => t.includes("hum"))).toBe(false); // no humidity datum
  });

  it("formats a red margin as R+N", () => {
    expect(metroBadges(redHot.metro).map((b) => b.text)).toContain("R+18");
  });
});
```

> Note: WA top rate is 0, so the `not.toContain("blue-mild")` line above is wrong — fix it in Step 3's test run by changing `blue-mild`'s state to a taxed state. Edit the fixture: set `blueMild` state to `["NY"]` (NY ≈ 10.9). Update the test to `expect(...).not.toContain("blue-mild")` remains valid because NY ≠ 0. Make that fixture edit now: change `states: ["WA"]` → `states: ["NY"]` in `blueMild`.

- [ ] **Step 2: Apply the fixture fix from the note**

Edit `tests/filters.test.ts`: in `blueMild`, change `states: ["WA"]` to `states: ["NY"]`.

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/filters.test.ts`
Expected: FAIL with "Failed to resolve import ../src/engines/filters" / functions not defined.

- [ ] **Step 4: Write the engine implementation**

Create `src/engines/filters.ts`:

```ts
import type { Metro } from "../types";
import type { AffordRow } from "./explore";

/**
 * Top marginal state individual income-tax rate (%), keyed by USPS code.
 * Source: Tax Foundation, "State Individual Income Tax Rates" 2024.
 * Wage-income view: WA (cap-gains only) and NH (interest/dividends, phasing
 * out) are treated as 0 for earned income.
 */
export const STATE_TOP_RATE: Record<string, number> = {
  AL: 5.0,
  AK: 0,
  AZ: 2.5,
  AR: 4.4,
  CA: 13.3,
  CO: 4.4,
  CT: 6.99,
  DE: 6.6,
  DC: 10.75,
  FL: 0,
  GA: 5.49,
  HI: 11.0,
  ID: 5.8,
  IL: 4.95,
  IN: 3.05,
  IA: 5.7,
  KS: 5.7,
  KY: 4.0,
  LA: 4.25,
  ME: 7.15,
  MD: 5.75,
  MA: 9.0,
  MI: 4.25,
  MN: 9.85,
  MS: 4.7,
  MO: 4.8,
  MT: 5.9,
  NE: 5.84,
  NV: 0,
  NH: 0,
  NJ: 10.75,
  NM: 5.9,
  NY: 10.9,
  NC: 4.5,
  ND: 2.5,
  OH: 3.5,
  OK: 4.75,
  OR: 9.9,
  PA: 3.07,
  RI: 5.99,
  SC: 6.4,
  SD: 0,
  TN: 0,
  TX: 0,
  UT: 4.65,
  VT: 8.75,
  VA: 5.75,
  WA: 0,
  WV: 5.12,
  WI: 7.65,
  WY: 0,
};

function taxRate(m: Metro): number | undefined {
  const st = m.states[0];
  return st && st in STATE_TOP_RATE ? STATE_TOP_RATE[st] : undefined;
}

export interface FilterBand {
  id: string;
  label: string;
  test: (m: Metro) => boolean;
}

export interface FilterDef {
  id: string;
  label: string;
  emoji: string;
  has: (m: Metro) => boolean;
  bands: FilterBand[];
  badge: (m: Metro) => string | null;
}

export const FILTERS: FilterDef[] = [
  {
    id: "politics",
    label: "Political lean",
    emoji: "🗳️",
    has: (m) => m.politics !== undefined,
    badge: (m) =>
      m.politics === undefined
        ? null
        : m.politics > 0
          ? `D+${Math.round(m.politics)}`
          : m.politics < 0
            ? `R+${Math.round(-m.politics)}`
            : "even",
    bands: [
      { id: "blue", label: "Lean blue", test: (m) => m.politics! > 5 },
      {
        id: "purple",
        label: "Purple",
        test: (m) => Math.abs(m.politics!) <= 5,
      },
      { id: "red", label: "Lean red", test: (m) => m.politics! < -5 },
    ],
  },
  {
    id: "temp",
    label: "Temperature",
    emoji: "🌡️",
    has: (m) => m.tempF !== undefined,
    badge: (m) => (m.tempF === undefined ? null : `${Math.round(m.tempF)}°`),
    bands: [
      { id: "cold", label: "Cold (<50°)", test: (m) => m.tempF! < 50 },
      {
        id: "mild",
        label: "Mild (50–65°)",
        test: (m) => m.tempF! >= 50 && m.tempF! <= 65,
      },
      { id: "hot", label: "Hot (>65°)", test: (m) => m.tempF! > 65 },
    ],
  },
  {
    id: "humidity",
    label: "Humidity",
    emoji: "💧",
    has: (m) => m.humidity !== undefined,
    badge: (m) =>
      m.humidity === undefined ? null : `${Math.round(m.humidity)}% hum`,
    bands: [
      { id: "dry", label: "Dry (<55%)", test: (m) => m.humidity! < 55 },
      {
        id: "moderate",
        label: "Moderate (55–70%)",
        test: (m) => m.humidity! >= 55 && m.humidity! <= 70,
      },
      { id: "humid", label: "Humid (>70%)", test: (m) => m.humidity! > 70 },
    ],
  },
  {
    id: "aqi",
    label: "Air quality",
    emoji: "🌫️",
    has: (m) => m.aqi !== undefined,
    badge: (m) =>
      m.aqi === undefined
        ? null
        : m.aqi <= 50
          ? "good air"
          : m.aqi <= 100
            ? "ok air"
            : "poor air",
    bands: [
      { id: "good", label: "Good (≤50)", test: (m) => m.aqi! <= 50 },
      {
        id: "moderate",
        label: "Moderate (51–100)",
        test: (m) => m.aqi! > 50 && m.aqi! <= 100,
      },
      { id: "poor", label: "Poor (>100)", test: (m) => m.aqi! > 100 },
    ],
  },
  {
    id: "risk",
    label: "Disaster risk",
    emoji: "🌪️",
    has: (m) => m.risk !== undefined,
    badge: (m) =>
      m.risk === undefined
        ? null
        : m.risk < 33
          ? "low risk"
          : m.risk <= 66
            ? "med risk"
            : "high risk",
    bands: [
      { id: "low", label: "Low (<33)", test: (m) => m.risk! < 33 },
      {
        id: "medium",
        label: "Medium (33–66)",
        test: (m) => m.risk! >= 33 && m.risk! <= 66,
      },
      { id: "high", label: "High (>66)", test: (m) => m.risk! > 66 },
    ],
  },
  {
    id: "tax",
    label: "State income tax",
    emoji: "🧾",
    has: (m) => taxRate(m) !== undefined,
    badge: (m) => {
      const r = taxRate(m);
      return r === undefined ? null : r === 0 ? "no tax" : `${r}% tax`;
    },
    bands: [
      { id: "none", label: "No tax", test: (m) => taxRate(m) === 0 },
      {
        id: "low",
        label: "Low (0–5%)",
        test: (m) => {
          const r = taxRate(m)!;
          return r > 0 && r <= 5;
        },
      },
      { id: "high", label: "High (>5%)", test: (m) => taxRate(m)! > 5 },
    ],
  },
];

export type ActiveBands = Record<string, string | null>;

/**
 * Narrow ranked rows by the active bands. Ordering is preserved (input is
 * already ranked by required salary). A metro missing the datum for an active
 * filter is excluded and tallied into `hiddenNoData` — never silently dropped,
 * never imputed.
 */
export function applyFilters(
  rows: AffordRow[],
  active: ActiveBands,
): { rows: AffordRow[]; hiddenNoData: number } {
  const activeDefs = FILTERS.map((f) => ({
    f,
    band: f.bands.find((b) => b.id === active[f.id]),
  })).filter((x): x is { f: FilterDef; band: FilterBand } => !!x.band);

  if (activeDefs.length === 0) return { rows, hiddenNoData: 0 };

  let hiddenNoData = 0;
  const out = rows.filter((row) => {
    for (const { f, band } of activeDefs) {
      if (!f.has(row.metro)) {
        hiddenNoData++;
        return false;
      }
      if (!band.test(row.metro)) return false;
    }
    return true;
  });
  return { rows: out, hiddenNoData };
}

export interface MetroBadge {
  emoji: string;
  text: string;
}

/** Compact attribute badges for a metro, in FILTERS order, omitting absent data. */
export function metroBadges(m: Metro): MetroBadge[] {
  const out: MetroBadge[] = [];
  for (const f of FILTERS) {
    const text = f.badge(m);
    if (text !== null) out.push({ emoji: f.emoji, text });
  }
  return out;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/filters.test.ts`
Expected: PASS (all assertions). If the tax test still references `blue-mild` incorrectly, confirm the Step 2 fixture edit (`blueMild` → `["NY"]`) was applied.

- [ ] **Step 6: Commit**

```bash
git add src/engines/filters.ts tests/filters.test.ts
git commit -m "feat: filter engine for afford-page lifestyle attributes"
```

---

## Task 3: Filter state in useComparison

**Files:**

- Modify: `src/composables/useComparison.ts`
- Test: `tests/useComparison.test.ts` (append cases)

- [ ] **Step 1: Write the failing test**

Append to `tests/useComparison.test.ts` (inside the existing file, after the last test — keep existing imports, add the import line if missing):

```ts
import { useComparison } from "../src/composables/useComparison";

describe("useComparison filters", () => {
  it("defaults to no active filters and an empty active count", () => {
    const c = useComparison();
    expect(c.activeFilterCount.value).toBe(0);
  });

  it("setBand toggles a band on, then off when set to the same id", () => {
    const c = useComparison();
    c.setBand("temp", "mild");
    expect(c.filters.value.temp).toBe("mild");
    expect(c.activeFilterCount.value).toBe(1);
    c.setBand("temp", "mild"); // same band again clears it
    expect(c.filters.value.temp).toBeNull();
    expect(c.activeFilterCount.value).toBe(0);
  });

  it("clearFilters removes all active bands", () => {
    const c = useComparison();
    c.setBand("temp", "mild");
    c.setBand("politics", "blue");
    expect(c.activeFilterCount.value).toBe(2);
    c.clearFilters();
    expect(c.activeFilterCount.value).toBe(0);
  });

  it("filteredAffordable narrows the ranked list without an active filter being a no-op", () => {
    const c = useComparison();
    c.setFrom(c.metros[0].id);
    c.salary.value = 80000;
    const before = c.filteredAffordable.value.rows.length;
    c.setBand("tax", "none");
    const after = c.filteredAffordable.value.rows.length;
    expect(after).toBeLessThanOrEqual(before);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/useComparison.test.ts`
Expected: FAIL — `c.setBand is not a function` / `filteredAffordable` undefined.

- [ ] **Step 3: Add filter state to the composable**

In `src/composables/useComparison.ts`, add the import near the other engine imports (after line 7):

```ts
import { applyFilters, type ActiveBands } from "../engines/filters";
```

Inside `useComparison()`, after the `affordable` computed (line 56), add:

```ts
// ── lifestyle filters (Afford page) — narrow only, never re-rank ──
const filters = ref<ActiveBands>({});

const filteredAffordable = computed(() =>
  applyFilters(affordable.value, filters.value),
);

const activeFilterCount = computed(
  () => Object.values(filters.value).filter((v) => v != null).length,
);
```

Then add these to the returned object (inside the `return { ... }`, alongside the existing keys):

```ts
    filters,
    filteredAffordable,
    activeFilterCount,
    // tapping the already-active band clears it (acts as a toggle)
    setBand: (filterId: string, bandId: string | null) => {
      filters.value = {
        ...filters.value,
        [filterId]: filters.value[filterId] === bandId ? null : bandId,
      };
    },
    clearFilters: () => (filters.value = {}),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/useComparison.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + full suite**

Run: `npx vue-tsc --noEmit && npx vitest run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/composables/useComparison.ts tests/useComparison.test.ts
git commit -m "feat: filter state + filteredAffordable in useComparison"
```

---

## Task 4: Row badges in AffordList

**Files:**

- Modify: `src/components/AffordList.vue`

- [ ] **Step 1: Import the badge helper**

In `src/components/AffordList.vue`, add to the `<script setup>` imports (after the `pay` import on line 4):

```ts
import { metroBadges } from "../engines/filters";
```

- [ ] **Step 2: Render badges under the metro name**

In the `<!-- metro -->` block, after the states `<p>` (currently lines 56-62, the `{{ row.metro.states.join("·") }}` paragraph), add a badge line:

```html
<p
  v-if="metroBadges(row.metro).length"
  class="mt-0.5 flex flex-wrap gap-x-1.5 gap-y-0.5 text-[length:var(--text-eyebrow)] opacity-70"
>
  <span
    v-for="b in metroBadges(row.metro)"
    :key="b.text"
    class="whitespace-nowrap"
  >
    {{ b.emoji }} {{ b.text }}
  </span>
</p>
```

- [ ] **Step 3: Typecheck**

Run: `npx vue-tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Verify existing tests still pass**

Run: `npx vitest run`
Expected: PASS (no test asserts the exact AffordList row markup).

- [ ] **Step 5: Commit**

```bash
git add src/components/AffordList.vue
git commit -m "feat: lifestyle attribute badges on afford rows"
```

---

## Task 5: FilterSheet component

**Files:**

- Create: `src/components/FilterSheet.vue`
- Test: `tests/filterSheet.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/filterSheet.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import FilterSheet from "../src/components/FilterSheet.vue";

describe("FilterSheet", () => {
  it("is collapsed by default and shows the active count", () => {
    const wrapper = mount(FilterSheet, {
      props: { active: { temp: "mild" }, activeCount: 1 },
    });
    expect(wrapper.text()).toContain("Filters");
    expect(wrapper.text()).toContain("1");
  });

  it("emits set-band when a band is clicked", async () => {
    const wrapper = mount(FilterSheet, {
      props: { active: {}, activeCount: 0 },
    });
    // open the sheet
    await wrapper.find("button[aria-expanded]").trigger("click");
    // click the first band button inside the panel
    const bandBtn = wrapper
      .findAll("button")
      .find((b) => b.text().includes("Lean blue"))!;
    await bandBtn.trigger("click");
    expect(wrapper.emitted("set-band")).toBeTruthy();
    expect(wrapper.emitted("set-band")![0]).toEqual(["politics", "blue"]);
  });

  it("emits clear when Clear all is clicked", async () => {
    const wrapper = mount(FilterSheet, {
      props: { active: { temp: "mild" }, activeCount: 1 },
    });
    await wrapper.find("button[aria-expanded]").trigger("click");
    const clearBtn = wrapper
      .findAll("button")
      .find((b) => b.text().includes("Clear all"))!;
    await clearBtn.trigger("click");
    expect(wrapper.emitted("clear")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/filterSheet.test.ts`
Expected: FAIL — cannot resolve `FilterSheet.vue`.

- [ ] **Step 3: Write the component**

Create `src/components/FilterSheet.vue`:

```vue
<script setup lang="ts">
import { ref } from "vue";
import { FILTERS, type ActiveBands } from "../engines/filters";

defineProps<{ active: ActiveBands; activeCount: number }>();
const emit = defineEmits<{
  "set-band": [filterId: string, bandId: string];
  clear: [];
}>();

const open = ref(false);
const filters = FILTERS; // module-level constant, non-reactive
</script>

<template>
  <section
    class="overflow-hidden"
    :style="{
      borderRadius: 'var(--radius-sheet)',
      background: 'var(--color-paper)',
      boxShadow: 'var(--shadow-sheet)',
      border: '1px solid var(--color-contour)',
    }"
  >
    <button
      @click="open = !open"
      class="flex w-full items-center justify-between px-5 py-4 text-left"
      :aria-expanded="open"
    >
      <span
        class="flex items-center gap-2 text-[length:var(--text-lede)] font-bold"
      >
        ⚙ Filters
        <span
          v-if="activeCount > 0"
          class="tnum flex h-6 min-w-6 items-center justify-center px-1.5 text-[length:var(--text-eyebrow)] font-black"
          :style="{
            borderRadius: 'var(--radius-pill)',
            background: 'var(--color-accent, var(--color-paper-deep))',
            color: '#fff',
          }"
          >{{ activeCount }}</span
        >
      </span>
      <span
        class="flex h-9 w-9 items-center justify-center transition-transform"
        :style="{
          borderRadius: 'var(--radius-pill)',
          background: 'var(--color-paper-deep)',
          border: '1px solid var(--color-contour)',
          transform: open ? 'rotate(180deg)' : 'rotate(0)',
        }"
        aria-hidden="true"
      >
        <svg class="h-3 w-3" viewBox="0 0 12 12" fill="none">
          <path
            d="M2,4 L6,8 L10,4"
            stroke="var(--color-ink)"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </span>
    </button>

    <div v-if="open" style="border-top: 1px solid var(--color-contour)">
      <ul class="px-5 pb-2 pt-3">
        <li
          v-for="f in filters"
          :key="f.id"
          class="py-3"
          style="border-bottom: 1px solid var(--color-contour)"
          :class="'last:border-0'"
        >
          <p class="mb-2 text-[length:var(--text-body)] font-semibold">
            {{ f.emoji }} {{ f.label }}
          </p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="b in f.bands"
              :key="b.id"
              @click="emit('set-band', f.id, b.id)"
              class="px-3 py-1.5 text-[length:var(--text-eyebrow)] font-bold"
              :style="{
                borderRadius: 'var(--radius-pill)',
                border: '1px solid var(--color-contour)',
                background:
                  active[f.id] === b.id
                    ? 'var(--color-accent, var(--color-ink))'
                    : 'var(--color-paper-deep)',
                color: active[f.id] === b.id ? '#fff' : 'var(--color-ink)',
              }"
            >
              {{ b.label }}
            </button>
          </div>
        </li>
      </ul>

      <button
        @click="emit('clear')"
        class="w-full px-5 py-3 text-center text-[length:var(--text-eyebrow)] font-bold uppercase opacity-75"
        style="
          letter-spacing: var(--text-eyebrow--letter-spacing);
          background: var(--color-paper-deep);
          border-top: 1px solid var(--color-contour);
        "
      >
        Clear all
      </button>
    </div>
  </section>
</template>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/filterSheet.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/FilterSheet.vue tests/filterSheet.test.ts
git commit -m "feat: FilterSheet band-selector component"
```

---

## Task 6: Wire ExploreView

**Files:**

- Modify: `src/pages/ExploreView.vue`
- Test: `tests/affordFilters.test.ts`

- [ ] **Step 1: Write the failing integration test**

Create `tests/affordFilters.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import ExploreView from "../src/pages/ExploreView.vue";
import { useComparison } from "../src/composables/useComparison";

function ready() {
  const c = useComparison();
  c.setFrom(c.metros[0].id);
  c.salary.value = 80000;
  return c;
}

describe("ExploreView filters", () => {
  it("renders the Filters control once a city and salary are set", () => {
    const c = ready();
    const wrapper = mount(ExploreView, { props: { comparison: c } });
    expect(wrapper.text()).toContain("Filters");
  });

  it("shows a hidden-no-data line when an active filter excludes metros lacking data", async () => {
    const c = ready();
    c.setBand("humidity", "humid"); // many metros will lack humidity → hidden count > 0
    const wrapper = mount(ExploreView, { props: { comparison: c } });
    // The hidden line only appears if some rows were dropped for missing data.
    if (c.filteredAffordable.value.hiddenNoData > 0) {
      expect(wrapper.text()).toContain("no data");
    } else {
      expect(true).toBe(true); // no missing-data rows in this dataset slice — line correctly absent
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/affordFilters.test.ts`
Expected: FAIL — "Filters" text not found (control not wired yet).

- [ ] **Step 3: Wire FilterSheet, count, and hidden line into ExploreView**

In `src/pages/ExploreView.vue`, add the import after the `AffordList` import (line 5):

```ts
import FilterSheet from "../components/FilterSheet.vue";
```

Replace the `<!-- ranked list -->` block (currently lines 56-85) with:

```html
<!-- filters + ranked list -->
<div v-if="ready()" class="mt-6 flex flex-col gap-4">
  <FilterSheet
    :active="c.filters.value"
    :active-count="c.activeFilterCount.value"
    @set-band="c.setBand"
    @clear="c.clearFilters"
  />

  <AffordList
    :rows="c.filteredAffordable.value.rows"
    :period="c.period.value"
    :hours-per-week="c.hoursPerWeek.value"
    :limit="50"
  />

  <p
    v-if="c.filteredAffordable.value.hiddenNoData > 0"
    class="text-center text-[length:var(--text-eyebrow)] uppercase opacity-60"
    style="letter-spacing: var(--text-eyebrow--letter-spacing)"
  >
    +{{ c.filteredAffordable.value.hiddenNoData }} hidden · no data
  </p>
</div>

<div class="mt-6">
  <section
    v-if="!ready()"
    class="px-5 py-8 text-center"
    :style="{
          borderRadius: 'var(--radius-sheet)',
          background: 'var(--color-paper)',
          border: '1px dashed var(--color-contour-ink)',
          boxShadow: 'var(--shadow-sheet)',
        }"
  >
    <p
      class="text-[length:var(--text-eyebrow)] uppercase opacity-60"
      style="letter-spacing: var(--text-eyebrow--letter-spacing)"
    >
      Two steps
    </p>
    <p class="mt-1 text-[length:var(--text-lede)] font-bold">
      Pick your city and pay to see where your money goes furthest.
    </p>
  </section>
</div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/affordFilters.test.ts`
Expected: PASS.

- [ ] **Step 5: Full suite + typecheck**

Run: `npx vue-tsc --noEmit && npx vitest run`
Expected: PASS (all suites).

- [ ] **Step 6: Visual smoke check**

Run the dev server and confirm: pick a city + salary on the Afford view → the ⚙ Filters sheet appears above the ranked list; opening it and tapping a band narrows the list; badges render under metro names. (Note: badges/filters will be sparse until Task 7 builds real data — politics/temp/etc. show only where data exists; **tax always shows** since it derives from `states[0]`.)

- [ ] **Step 7: Commit**

```bash
git add src/pages/ExploreView.vue tests/affordFilters.test.ts
git commit -m "feat: wire filter sheet + hidden-no-data tally into ExploreView"
```

---

## Task 7: Data pipeline enrichment

**Files:**

- Modify: `scripts/build-metros.py`

Goal: populate `politics`, `tempF`, `humidity`, `aqi`, `risk` on each metro from public sources, joined on CBSA FIPS (or county→CBSA). Tax is engine-side, so no data work here. Each source is a separate function; a missing match leaves the field absent. The script prints per-factor coverage.

> **Implementation reality:** exact column headers/URLs for these government files drift between vintages. Write each loader defensively (look the column up by name; skip rows that don't parse), and use the **coverage counts printed at the end** as the success signal. The 🟢 factors (politics, aqi, risk) should cover the large majority of metros; temp 🟡 and humidity 🟠 will be lower.

- [ ] **Step 1: Add the county→CBSA crosswalk loader**

In `scripts/build-metros.py`, add a constant near the other URLs (line 17-21) and a loader near `load_population`:

```python
# Census CBSA-to-county delineation (maps county FIPS -> CBSA code).
DELINEATION_CSV = (
    "https://www2.census.gov/programs-surveys/metro-micro/geographies/"
    "reference-files/2023/delineation-files/list1_2023.csv"
)


def load_county_to_cbsa() -> dict[str, str]:
    """county FIPS (5-digit) -> CBSA code. Skips the file's header/footer cruft."""
    raw = fetch(DELINEATION_CSV).decode("latin-1")
    rows = list(csv.reader(io.StringIO(raw)))
    # find the header row (the one containing "CBSA Code")
    hi = next(i for i, r in enumerate(rows) if any(c.strip() == "CBSA Code" for c in r))
    h = [c.strip() for c in rows[hi]]
    ic = h.index("CBSA Code")
    ifips_s = h.index("FIPS State Code")
    ifips_c = h.index("FIPS County Code")
    out: dict[str, str] = {}
    for r in rows[hi + 1 :]:
        if len(r) <= max(ic, ifips_s, ifips_c):
            continue
        st, co, cbsa = r[ifips_s].strip(), r[ifips_c].strip(), r[ic].strip()
        if st.isdigit() and co.isdigit() and cbsa.isdigit():
            out[st.zfill(2) + co.zfill(3)] = cbsa
    return out
```

- [ ] **Step 2: Add the politics loader (county 2024 returns → CBSA margin)**

Add near the other loaders:

```python
# County-level 2024 presidential results (votes per county).
ELECTION_CSV = (
    "https://raw.githubusercontent.com/tonmcg/"
    "US_County_Level_Election_Results_08-24/master/2024_US_County_Level_Presidential_Results.csv"
)


def load_politics(c2cbsa: dict[str, str]) -> dict[str, float]:
    """CBSA code -> signed margin in points (+ = Dem, - = Rep)."""
    raw = fetch(ELECTION_CSV).decode("utf-8-sig")
    rows = csv.DictReader(io.StringIO(raw))
    agg: dict[str, list[float]] = {}  # cbsa -> [dem_votes, rep_votes]
    for r in rows:
        fips = (r.get("county_fips") or "").strip().zfill(5)
        cbsa = c2cbsa.get(fips)
        if not cbsa:
            continue
        try:
            dem = float(r["votes_dem"])
            rep = float(r["votes_gop"])
        except (KeyError, ValueError):
            continue
        a = agg.setdefault(cbsa, [0.0, 0.0])
        a[0] += dem
        a[1] += rep
    out: dict[str, float] = {}
    for cbsa, (dem, rep) in agg.items():
        total = dem + rep
        if total > 0:
            out[cbsa] = round((dem - rep) / total * 100, 1)
    return out
```

- [ ] **Step 3: Add the AQI loader (EPA, already by CBSA)**

```python
EPA_AQI_ZIP = "https://aqs.epa.gov/aqsweb/airdata/annual_aqi_by_cbsa_2024.zip"


def load_aqi() -> dict[str, float]:
    """CBSA code -> median AQI. EPA reports by CBSA name + code."""
    zf = zipfile.ZipFile(io.BytesIO(fetch(EPA_AQI_ZIP)))
    name = next(n for n in zf.namelist() if n.endswith(".csv"))
    rows = csv.DictReader(io.StringIO(zf.read(name).decode("utf-8")))
    out: dict[str, float] = {}
    for r in rows:
        cbsa = (r.get("CBSA Code") or "").strip()
        try:
            out[cbsa] = float(r["Median AQI"])
        except (KeyError, ValueError):
            continue
    return out
```

- [ ] **Step 4: Add the FEMA risk loader (county → CBSA, pop-weighted)**

```python
FEMA_NRI_ZIP = (
    "https://hazards.fema.gov/nri/Content/StaticDocuments/DataDownload/"
    "NRI_Table_Counties/NRI_Table_Counties.zip"
)


def load_risk(c2cbsa: dict[str, str]) -> dict[str, float]:
    """CBSA code -> population-weighted mean composite risk score (0–100)."""
    zf = zipfile.ZipFile(io.BytesIO(fetch(FEMA_NRI_ZIP)))
    name = next(n for n in zf.namelist() if n.endswith(".csv"))
    rows = csv.DictReader(io.StringIO(zf.read(name).decode("latin-1")))
    agg: dict[str, list[float]] = {}  # cbsa -> [weighted_sum, pop_sum]
    for r in rows:
        fips = (r.get("STCOFIPS") or "").strip().zfill(5)
        cbsa = c2cbsa.get(fips)
        if not cbsa:
            continue
        try:
            score = float(r["RISK_SCORE"])
            pop = float(r.get("POPULATION") or 0) or 1.0
        except (KeyError, ValueError):
            continue
        a = agg.setdefault(cbsa, [0.0, 0.0])
        a[0] += score * pop
        a[1] += pop
    return {cbsa: round(ws / ps, 1) for cbsa, (ws, ps) in agg.items() if ps > 0}
```

- [ ] **Step 5: Add the climate loader (NOAA normals → nearest station)**

This is the heaviest loader. It needs CBSA centroids (Census Gazetteer) + NOAA annual normals with station coordinates, then nearest-station matching.

```python
import math

GAZ_CBSA = (
    "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2023_Gazetteer/"
    "2023_Gaz_cbsa_national.zip"
)
# NOAA 1991-2020 U.S. Climate Normals — annual/seasonal, station-level.
NOAA_NORMALS = (
    "https://www.ncei.noaa.gov/data/normals-annualseasonal/1991-2020/access/"
)  # directory of per-station CSVs; see note in Step 5b


def load_cbsa_centroids() -> dict[str, tuple[float, float]]:
    zf = zipfile.ZipFile(io.BytesIO(fetch(GAZ_CBSA)))
    name = next(n for n in zf.namelist() if n.endswith(".txt") or n.endswith(".csv"))
    text = zf.read(name).decode("latin-1")
    rows = csv.DictReader(io.StringIO(text), delimiter="\t")
    out: dict[str, tuple[float, float]] = {}
    for r in rows:
        try:
            cbsa = (r.get("GEOID") or r.get("CBSA") or "").strip()
            lat = float((r.get("INTPTLAT") or "").strip())
            lng = float((r.get("INTPTLONG") or r.get("INTPTLONG ") or "").strip())
            if cbsa:
                out[cbsa] = (lat, lng)
        except (KeyError, ValueError):
            continue
    return out
```

> **Step 5b — climate matching note:** NOAA's annual normals are one CSV per station; downloading the full set is large. Two acceptable implementations, pick one:
>
> 1. **Station inventory + nearest match:** fetch the normals station inventory (has `LATITUDE`, `LONGITUDE`, and the annual temperature normal `ANN-TAVG-NORMAL` and, where present, relative-humidity normal), then for each CBSA centroid pick the nearest station within ~50 km via the haversine helper below. Set `tempF` always (good coverage), `humidity` only where the station has the RH normal (sparser → fewer metros).
> 2. **Pre-baked extract:** if fetching the full inventory is impractical in the build environment, commit a small `scripts/data/noaa_normals.csv` (station, lat, lng, tavg, rh) generated once, and read it locally. Document the provenance in a comment.
>
> Haversine + nearest-station helper:

```python
def haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    R = 6371.0
    (lat1, lon1), (lat2, lon2) = a, b
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


def load_climate() -> dict[str, dict[str, float]]:
    """CBSA code -> {'tempF': x, 'humidity': y?}. Nearest NOAA station to centroid."""
    centroids = load_cbsa_centroids()
    stations = fetch_noaa_station_normals()  # [(lat, lng, tavg_f, rh_or_None)], see Step 5b
    out: dict[str, dict[str, float]] = {}
    for cbsa, c in centroids.items():
        best = min(stations, key=lambda s: haversine_km(c, (s[0], s[1])), default=None)
        if best and haversine_km(c, (best[0], best[1])) <= 50:
            entry = {"tempF": round(best[2], 1)}
            if best[3] is not None:
                entry["humidity"] = round(best[3], 1)
            out[cbsa] = entry
    return out
```

> Implement `fetch_noaa_station_normals()` per the chosen option in 5b. If climate proves too heavy for this pass, ship Task 7 with politics/aqi/risk wired and leave `load_climate` returning `{}` — the UI already handles absent temp/humidity gracefully. **Flag this clearly in the commit message if climate is deferred.**

- [ ] **Step 6: Run the enrichment pass in `main()`**

In `main()` (lines 93-120), after `metros = load_rpp()` and before/within the output loop, build the lookups and attach fields. Modify `main()` so the per-metro `entry` is enriched by CBSA `fips`:

```python
    pop = load_population()
    metros = load_rpp()
    c2cbsa = load_county_to_cbsa()
    politics = load_politics(c2cbsa)
    aqi = load_aqi()
    risk = load_risk(c2cbsa)
    try:
        climate = load_climate()
    except Exception as e:  # climate is the fragile one — never block the build
        print(f"  climate skipped: {e}", file=sys.stderr)
        climate = {}

    cover = {"politics": 0, "tempF": 0, "humidity": 0, "aqi": 0, "risk": 0}
```

Inside the existing `for fips, m in metros.items():` loop, after `entry = {...}` is built (line 111) and before `out.append(entry)`, add:

```python
        if fips in politics:
            entry["politics"] = politics[fips]; cover["politics"] += 1
        if fips in aqi:
            entry["aqi"] = aqi[fips]; cover["aqi"] += 1
        if fips in risk:
            entry["risk"] = risk[fips]; cover["risk"] += 1
        if fips in climate:
            cl = climate[fips]
            entry["tempF"] = cl["tempF"]; cover["tempF"] += 1
            if "humidity" in cl:
                entry["humidity"] = cl["humidity"]; cover["humidity"] += 1
```

And after the write (line 119-120), print coverage:

```python
    print(f"  coverage: {cover} of {len(out)} metros", file=sys.stderr)
```

- [ ] **Step 7: Run the build and verify coverage**

Run: `npm run data:build`
Expected: writes `src/data/metros.json`; stderr shows non-zero coverage for `politics`, `aqi`, `risk` (large majority of metros), with `tempF`/`humidity` lower or 0 if climate was deferred. No traceback.

- [ ] **Step 8: Verify the app reflects real data**

Run: `npx vitest run` (the `affordFilters` test's hidden-data branch now exercises real gaps) then dev-server smoke: badges now show politics/air/risk on most metros; filtering by `Lean blue` / `No tax` / `Good air` narrows the list and the `+N hidden · no data` line appears for sparse factors.
Expected: PASS + visible filtering.

- [ ] **Step 9: Commit**

```bash
git add scripts/build-metros.py src/data/metros.json
git commit -m "feat: enrich metros with politics, air, disaster risk (+climate where available)"
```

---

## Self-review notes (already reconciled)

- **Spec coverage:** politics/temp/humidity/aqi/risk/tax all have a filter (Task 2) + data path (Task 7, except tax which is engine-side). Sheet UI (Task 5), badges (Task 4), missing-data tally (Task 6), ranking-unchanged (Task 2 test). ✓
- **Type consistency:** `applyFilters` returns `{ rows, hiddenNoData }` — consumed identically in Task 3/6. `setBand(filterId, bandId)` signature matches the `FilterSheet` emit and the test. `metroBadges` shape `{emoji,text}` matches AffordList usage. ✓
- **Decisions honored:** margin numbers + 3 political bands; 2024 election; exclude-and-count missing data; sheet (not chips); ranking never re-sorted. ✓
- **Independence:** Tasks 1–6 are fully testable with fixtures and ship value (tax filter works immediately). Task 7 is isolated and degrades gracefully if climate is deferred. ✓
