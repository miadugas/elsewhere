# App Live-Fetch (Phase 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The app fetches live metro data from `data.miacodes.com/api/metros`, seeded instantly from a cached-or-bundled snapshot and revalidated in the background — preserving instant load + offline.

**Architecture:** A new `src/data/metroSource.ts` owns the IO (bundled import, validation, localStorage cache, live fetch). `useComparison` turns `metros` into a `ref` seeded from `cachedOrBundled()` and exposes `loadMetros()`; `ComparePage` calls it `onMounted`. Components that read `c.metros` switch to `c.metros.value`. Engines are unchanged (they already take `metros` as a parameter).

**Tech Stack:** Vue 3 `<script setup>` + TypeScript, Vitest + @vue/test-utils (jsdom), global `fetch` + `localStorage`.

**Working branch:** commit directly to `main` (Mia's active-dev directive). `git fetch && git merge --ff-only origin/main` first if local `main` is behind.

**Fallback chain:** live fetch → localStorage cache → bundled import. Any fetch/parse/validation/storage failure is swallowed; the seed stays. No error UI.

---

## File map

- **Create** `src/data/metroSource.ts` — `BUNDLED`, `isValidMetros`, `readCache`, `writeCache`, `cachedOrBundled`, `fetchLiveMetros`.
- **Create** `tests/metroSource.test.ts` — unit tests for all of the above (mock `fetch`, real jsdom `localStorage`).
- **Modify** `src/composables/useComparison.ts` — `metros` becomes a `ref` seeded from `cachedOrBundled()`; internal computeds use `metros.value`; add + return `loadMetros()`; `API_BASE` from env.
- **Modify** `tests/useComparison.test.ts` — one `.value` fix (line ~64).
- **Modify** `src/pages/ComparePage.vue` — `onMounted(() => c.loadMetros())`; two `:metros="c.metros.value"`.
- **Modify** `src/pages/ExploreView.vue` — `:metros="c.metros.value"` + `availableFilters(c.metros.value)`.
- **Modify** `tests/affordFilters.test.ts` — one `.value` fix (line ~8).
- **Modify** `tests/comparePage.test.ts` — stub `fetch` so the `onMounted` fetch is an offline no-op.

---

## Task 1: metroSource module

**Files:**

- Create: `src/data/metroSource.ts`
- Test: `tests/metroSource.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/metroSource.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isValidMetros,
  readCache,
  writeCache,
  cachedOrBundled,
  fetchLiveMetros,
  BUNDLED,
} from "../src/data/metroSource";
import type { Metro } from "../src/types";

const sample: Metro[] = [
  {
    id: "x-ca",
    name: "X, CA",
    short: "X",
    states: ["CA"],
    rpp: { overall: 120, housing: 1, goods: 1, otherServices: 1 },
  },
];

beforeEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isValidMetros", () => {
  it("accepts a non-empty array whose first item has id + rpp.overall", () => {
    expect(isValidMetros(sample)).toBe(true);
  });
  it("rejects empty arrays, non-arrays, and malformed items", () => {
    expect(isValidMetros([])).toBe(false);
    expect(isValidMetros(null)).toBe(false);
    expect(isValidMetros("<html>")).toBe(false);
    expect(isValidMetros([{ foo: 1 }])).toBe(false);
  });
});

describe("cache", () => {
  it("cachedOrBundled returns the bundled data when cache is empty", () => {
    expect(cachedOrBundled()).toBe(BUNDLED);
  });
  it("writeCache then readCache round-trips valid data", () => {
    writeCache(sample);
    expect(readCache()).toEqual(sample);
    expect(cachedOrBundled()).toEqual(sample);
  });
  it("readCache returns null for a corrupt cache entry", () => {
    localStorage.setItem("elsewhere:metros:v1", "{not json");
    expect(readCache()).toBeNull();
  });
});

describe("fetchLiveMetros", () => {
  it("returns the metros on a valid 200 response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => sample }),
    );
    expect(await fetchLiveMetros("https://api.test")).toEqual(sample);
  });
  it("returns null on a non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: async () => sample }),
    );
    expect(await fetchLiveMetros("https://api.test")).toBeNull();
  });
  it("returns null on a malformed payload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ nope: 1 }) }),
    );
    expect(await fetchLiveMetros("https://api.test")).toBeNull();
  });
  it("returns null when fetch rejects (offline)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await fetchLiveMetros("https://api.test")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/metroSource.test.ts`
Expected: FAIL — cannot resolve `../src/data/metroSource`.

- [ ] **Step 3: Write the module**

Create `src/data/metroSource.ts`:

```ts
import bundled from "./metros.json";
import type { Metro } from "../types";

export const BUNDLED = bundled as Metro[];
const CACHE_KEY = "elsewhere:metros:v1";

/** True only for a non-empty array whose first item looks like a Metro. */
export function isValidMetros(data: unknown): data is Metro[] {
  if (!Array.isArray(data) || data.length === 0) return false;
  const first = data[0] as { id?: unknown; rpp?: { overall?: unknown } };
  return (
    typeof first?.id === "string" && typeof first?.rpp?.overall === "number"
  );
}

/** Last successfully-fetched snapshot, or null if absent/corrupt/unavailable. */
export function readCache(): Metro[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { metros?: unknown };
    return isValidMetros(parsed?.metros) ? (parsed.metros as Metro[]) : null;
  } catch {
    return null;
  }
}

/** Persist a snapshot. Silently ignores quota / unavailable storage. */
export function writeCache(metros: Metro[]): void {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ fetchedAt: new Date().toISOString(), metros }),
    );
  } catch {
    /* private mode / quota — bundled fallback still works */
  }
}

/** Synchronous seed for instant first render: cache if present, else bundled. */
export function cachedOrBundled(): Metro[] {
  return readCache() ?? BUNDLED;
}

/** Live fetch. Resolves to validated metros, or null on ANY failure. Never throws. */
export async function fetchLiveMetros(
  apiBase: string,
): Promise<Metro[] | null> {
  try {
    const res = await fetch(`${apiBase}/api/metros`);
    if (!res.ok) return null;
    const data = await res.json();
    return isValidMetros(data) ? data : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/metroSource.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Typecheck**

Run: `npx vue-tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/data/metroSource.ts tests/metroSource.test.ts
git commit -m "feat(data): metroSource — bundled/cache/live fetch with validation"
```

---

## Task 2: Wire useComparison to the reactive source

**Files:**

- Modify: `src/composables/useComparison.ts`
- Modify: `tests/useComparison.test.ts`

- [ ] **Step 1: Swap the import + module-level seed**

In `src/composables/useComparison.ts`, replace the metros import line:

```ts
import metrosData from "../data/metros.json";
```

with:

```ts
import {
  cachedOrBundled,
  fetchLiveMetros,
  writeCache,
} from "../data/metroSource";
```

And **delete** the module-level line:

```ts
const metros = metrosData as Metro[];
```

(Keep `const basketItems = basketData as BasketItem[];` as-is.)

Add the API base constant just below the remaining module-level consts:

```ts
const API_BASE = import.meta.env.VITE_API_BASE ?? "https://data.miacodes.com";
```

- [ ] **Step 2: Make `metros` a seeded ref + reference `.value` internally**

Inside `useComparison()`, at the top of the function body (before `from`/`to`), add:

```ts
const metros = ref<Metro[]>(cachedOrBundled());
```

Then update the three internal readers to use `metros.value`:

`from`:

```ts
const from = computed(() =>
  fromId.value ? (findMetro(metros.value, fromId.value) ?? null) : null,
);
```

`to`:

```ts
const to = computed(() =>
  toId.value ? (findMetro(metros.value, toId.value) ?? null) : null,
);
```

`affordable`:

```ts
const affordable = computed<AffordRow[]>(() =>
  from.value && salary.value > 0
    ? rankByAffordability(from.value, salary.value, metros.value)
    : [],
);
```

- [ ] **Step 3: Add `loadMetros` and return it**

Still inside `useComparison()`, after the `filters`/`activeFilterCount` block (before `return {`), add:

```ts
// Background revalidation — swap to live data when it arrives, cache it.
// Fire-and-forget; any failure leaves the seed in place.
async function loadMetros() {
  const live = await fetchLiveMetros(API_BASE);
  if (live) {
    metros.value = live;
    writeCache(live);
  }
}
```

Add `loadMetros` to the returned object (alongside the existing keys, e.g. right after `metros,`):

```ts
    metros,
    loadMetros,
```

- [ ] **Step 4: Fix the one `.value` reader in the existing test**

In `tests/useComparison.test.ts`, line ~64 currently reads:

```ts
c.setFrom(c.metros[0].id);
```

Change to:

```ts
c.setFrom(c.metros.value[0].id);
```

- [ ] **Step 5: Run the composable tests + typecheck**

Run: `npx vitest run tests/useComparison.test.ts && npx vue-tsc --noEmit`
Expected: PASS. (No `loadMetros` call here, so no network is touched — `metros` seeds from the bundled data since localStorage is empty.)

- [ ] **Step 6: Commit**

```bash
git add src/composables/useComparison.ts tests/useComparison.test.ts
git commit -m "feat(app): useComparison seeds a metros ref + exposes loadMetros"
```

---

## Task 3: Trigger on mount + component/test `.value` touch-ups

**Files:**

- Modify: `src/pages/ComparePage.vue`
- Modify: `src/pages/ExploreView.vue`
- Modify: `tests/affordFilters.test.ts`
- Modify: `tests/comparePage.test.ts`

- [ ] **Step 1: Stub fetch in the ComparePage test (so the mount fetch is offline)**

`tests/comparePage.test.ts` mounts `ComparePage`, which will call `loadMetros()` on mount. Keep it offline. Change the top import line:

```ts
import { describe, it, expect } from "vitest";
```

to:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
```

And add, immediately after the imports (before the first `describe`):

```ts
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockRejectedValue(new Error("no network in test")),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
});
```

(The rejected fetch makes `loadMetros` a no-op; assertions run against the bundled seed exactly as before.)

- [ ] **Step 2: Trigger `loadMetros` on mount in ComparePage**

In `src/pages/ComparePage.vue`, add `onMounted` to the vue import (line 2):

```ts
import { computed, ref, onMounted } from "vue";
```

Then, right after `const c = useComparison();` (line ~18), add:

```ts
onMounted(() => {
  c.loadMetros();
});
```

- [ ] **Step 3: `.value` touch-ups in ComparePage template**

In `src/pages/ComparePage.vue`, both PlacePicker bindings (lines ~177 and ~185) currently read `:metros="c.metros"`. Change both to:

```html
:metros="c.metros.value"
```

- [ ] **Step 4: `.value` touch-ups in ExploreView**

In `src/pages/ExploreView.vue`:

- Line ~44: `:metros="c.metros"` → `:metros="c.metros.value"`
- Line ~63: `:filters="availableFilters(c.metros)"` → `:filters="availableFilters(c.metros.value)"`

- [ ] **Step 5: Fix the `.value` reader in affordFilters test**

In `tests/affordFilters.test.ts`, line ~8:

```ts
c.setFrom(c.metros[0].id);
```

Change to:

```ts
c.setFrom(c.metros.value[0].id);
```

- [ ] **Step 6: Full suite + typecheck + build**

Run: `npx vitest run && npx vue-tsc --noEmit && npx vite build`
Expected: all tests pass, tsc clean, build succeeds. (No real network during tests — comparePage stubs fetch; other tests never call `loadMetros`.)

- [ ] **Step 7: Manual smoke (optional but recommended)**

Run the dev server and open the Compare page with devtools Network open. Expect a request to `https://data.miacodes.com/api/metros` returning 200 (CORS allows `localhost:5173`), and the app rendering instantly before it resolves. Search/compare still works.

- [ ] **Step 8: Commit**

```bash
git add src/pages/ComparePage.vue src/pages/ExploreView.vue tests/affordFilters.test.ts tests/comparePage.test.ts
git commit -m "feat(app): fetch live metros on mount; read metros ref via .value"
```

---

## Self-review notes (reconciled against the spec)

- **Spec coverage:** seed-then-revalidate (T2 `metros` ref + `loadMetros`, T3 onMounted) ✓; fallback chain live→cache→bundled (T1 `fetchLiveMetros`/`readCache`/`BUNDLED`, consumed in T2) ✓; localStorage cache key `elsewhere:metros:v1` (T1) ✓; env-var API base default `data.miacodes.com` (T2) ✓; `isValidMetros` guard — array, non-empty, `id`+`rpp.overall` (T1) ✓; silent failure, no error UI (T1 swallows, T2 only swaps on truthy) ✓; `.value` touch-ups in ExploreView + ComparePage (T3) ✓; tests with mocked fetch + localStorage (T1, T3 stub) ✓.
- **Deviation from spec (intentional):** IO extracted to `src/data/metroSource.ts` instead of inlined in `useComparison.ts` — improves testability and isolation; the composable just wires the ref + `loadMetros`. Behavior identical to the spec.
- **No network in tests:** only `ComparePage` calls `loadMetros` (on mount) and its test stubs `fetch`; `useComparison`/`affordFilters` tests never call it.
- **Type/name consistency:** `cachedOrBundled()`, `fetchLiveMetros(apiBase)`, `writeCache(metros)`, `isValidMetros(data)` used identically across T1→T2. `metros` is a `ref<Metro[]>`; every reader (`from`/`to`/`affordable` internal; `c.metros.value` in components/tests) uses `.value`.
- **YAGNI held:** no freshness UI, no SW caching, no retry — exactly the spec's out-of-scope list.
