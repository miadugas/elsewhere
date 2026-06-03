# Elsewhere — Plan B: Map Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a zoomed-out cartographic map behind the result — two metro pins joined by a great-circle arc (the "texture of moving" motif) — using MapLibre GL + self-hosted Protomaps tiles, behind a swappable interface so Plan A still works if the map fails to load.

**Architecture:** A pure `arc` geometry function (great-circle interpolation, TDD'd) feeds a thin `MapCanvas.vue` MapLibre wrapper. The basemap is a single self-hosted `.pmtiles` file served via the `pmtiles://` protocol — no per-call provider fees. The map is an _enhancement layer_: `ComparePage` renders it inside `ResultSlab`'s reserved slot only when both metros are chosen.

**Tech Stack:** maplibre-gl · pmtiles (protocol + file) · Protomaps basemap · Cloudflare R2 or the_litterbox for tile hosting.

**Prerequisite:** Plan A complete (engines, `useComparison`, `ResultSlab` with reserved map slot).

---

## File Structure

```
src/
├── engines/
│   └── arc.ts                  # great-circle interpolation (pure)
├── components/
│   └── MapCanvas.vue           # MapLibre wrapper: 2 pins + arc, zoomed to fit
├── map/
│   └── style.ts                # MapLibre style JSON referencing pmtiles + cartographic colors
tests/
└── arc.test.ts
public/
└── (basemap.pmtiles hosted off-repo on R2/the_litterbox; URL via env)
```

**Boundary:** `arc.ts` is pure and testable with zero map deps. `MapCanvas.vue` is the only file touching `maplibre-gl`. If the tile URL is unreachable, `MapCanvas` renders an empty paper-colored box — the app degrades, never breaks.

---

### Task 1: `arc` geometry engine (TDD)

**Files:**

- Create: `src/engines/arc.ts`, `tests/arc.test.ts`

- [ ] **Step 1: Write failing test**

`tests/arc.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { greatCircleArc } from "../src/engines/arc";

describe("greatCircleArc", () => {
  it("starts at the origin and ends at the destination", () => {
    const pts = greatCircleArc([-83.046, 42.331], [-97.743, 30.267], 32);
    expect(pts[0][0]).toBeCloseTo(-83.046, 3);
    expect(pts[0][1]).toBeCloseTo(42.331, 3);
    expect(pts[pts.length - 1][0]).toBeCloseTo(-97.743, 3);
    expect(pts[pts.length - 1][1]).toBeCloseTo(30.267, 3);
  });

  it("returns steps + 1 points", () => {
    expect(greatCircleArc([-83, 42], [-97, 30], 16)).toHaveLength(17);
  });

  it("bows along the great circle (midpoint is not the naive average)", () => {
    const mid = greatCircleArc([-122.33, 47.6], [-74.0, 40.71], 2)[1];
    const naiveLat = (47.6 + 40.71) / 2;
    expect(Math.abs(mid[1] - naiveLat)).toBeGreaterThan(0.5);
  });
});
```

- [ ] **Step 2: Run — verify it fails**

Run: `npx vitest run tests/arc.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/engines/arc.ts`:

```ts
type LngLat = [number, number];

const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

// Slerp along the great circle between two [lng, lat] points.
export function greatCircleArc(from: LngLat, to: LngLat, steps = 48): LngLat[] {
  const [lng1, lat1] = [toRad(from[0]), toRad(from[1])];
  const [lng2, lat2] = [toRad(to[0]), toRad(to[1])];

  const d =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((lat2 - lat1) / 2) ** 2 +
          Math.cos(lat1) * Math.cos(lat2) * Math.sin((lng2 - lng1) / 2) ** 2,
      ),
    );

  if (d === 0) return [from, to];

  const pts: LngLat[] = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const a = Math.sin((1 - f) * d) / Math.sin(d);
    const b = Math.sin(f * d) / Math.sin(d);
    const x =
      a * Math.cos(lat1) * Math.cos(lng1) + b * Math.cos(lat2) * Math.cos(lng2);
    const y =
      a * Math.cos(lat1) * Math.sin(lng1) + b * Math.cos(lat2) * Math.sin(lng2);
    const z = a * Math.sin(lat1) + b * Math.sin(lat2);
    const lat = Math.atan2(z, Math.sqrt(x * x + y * y));
    const lng = Math.atan2(y, x);
    pts.push([toDeg(lng), toDeg(lat)]);
  }
  return pts;
}
```

- [ ] **Step 4: Run — verify pass**

Run: `npx vitest run tests/arc.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(map): great-circle arc geometry"
```

---

### Task 2: Host the basemap + install map deps

**Files:**

- Modify: `package.json` (deps), `.env` (tile URL)

- [ ] **Step 1: Install**

```bash
npm install maplibre-gl pmtiles
```

- [ ] **Step 2: Get a Protomaps basemap file**

Download a US extract `.pmtiles` from the Protomaps build service (https://protomaps.com) or generate one. For first integration you may point at Protomaps' public demo tiles, but **for production self-host**: upload `basemap.pmtiles` to Cloudflare R2 (public bucket) or serve from the_litterbox behind the existing Cloudflare Tunnel.

- [ ] **Step 3: Record the URL**

Add to `.env`:

```
VITE_PMTILES_URL=https://<your-r2-or-tunnel-host>/basemap.pmtiles
```

Add `.env` to `.gitignore` if not already; document the var in `README.md`.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "chore(map): add maplibre + pmtiles deps and tile URL config"
```

---

### Task 3: MapLibre style with cartographic colors

**Files:**

- Create: `src/map/style.ts`

- [ ] **Step 1: Implement the style factory**

`src/map/style.ts`:

```ts
import type { StyleSpecification } from "maplibre-gl";

// Minimal cartographic style over a Protomaps basemap source.
// Colors mirror tokens.css: paper / water / terrain / contour.
export function buildStyle(pmtilesUrl: string): StyleSpecification {
  return {
    version: 8,
    glyphs:
      "https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf",
    sources: {
      base: {
        type: "vector",
        url: `pmtiles://${pmtilesUrl}`,
        attribution: "© OpenStreetMap, Protomaps",
      },
    },
    layers: [
      {
        id: "bg",
        type: "background",
        paint: { "background-color": "#f7f5ef" },
      },
      {
        id: "water",
        type: "fill",
        source: "base",
        "source-layer": "water",
        paint: { "fill-color": "#cdddec" },
      },
      {
        id: "land",
        type: "fill",
        source: "base",
        "source-layer": "landuse",
        paint: { "fill-color": "#eceadd" },
      },
      {
        id: "boundaries",
        type: "line",
        source: "base",
        "source-layer": "boundaries",
        paint: { "line-color": "#d8d2c2", "line-width": 1 },
      },
    ],
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat(map): cartographic MapLibre style over pmtiles"
```

---

### Task 4: `MapCanvas` component

**Files:**

- Create: `src/components/MapCanvas.vue`

- [ ] **Step 1: Implement**

`src/components/MapCanvas.vue`:

```vue
<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from "vue";
import maplibregl from "maplibre-gl";
import { Protocol } from "pmtiles";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Metro } from "../types";
import { buildStyle } from "../map/style";
import { greatCircleArc } from "../engines/arc";

const props = defineProps<{ from: Metro; to: Metro }>();
const el = ref<HTMLDivElement | null>(null);
let map: maplibregl.Map | null = null;

const ARC_SOURCE = "route-arc";

function drawRoute() {
  if (!map) return;
  const coords = greatCircleArc(
    [props.from.lng, props.from.lat],
    [props.to.lng, props.to.lat],
  );
  const data = {
    type: "Feature",
    geometry: { type: "LineString", coordinates: coords },
    properties: {},
  } as const;
  const existing = map.getSource(ARC_SOURCE) as
    | maplibregl.GeoJSONSource
    | undefined;
  if (existing) {
    existing.setData(data as any);
  } else {
    map.addSource(ARC_SOURCE, { type: "geojson", data: data as any });
    map.addLayer({
      id: ARC_SOURCE,
      type: "line",
      source: ARC_SOURCE,
      paint: { "line-color": "#e0662a", "line-width": 3 },
    });
  }
  for (const m of [props.from, props.to]) {
    new maplibregl.Marker({ color: "#e0662a" })
      .setLngLat([m.lng, m.lat])
      .addTo(map);
  }
  const bounds = new maplibregl.LngLatBounds();
  coords.forEach((c) => bounds.extend(c as [number, number]));
  map.fitBounds(bounds, { padding: 48, duration: 600 });
}

onMounted(() => {
  const url = import.meta.env.VITE_PMTILES_URL;
  if (!el.value || !url) return; // graceful no-op: paper box stays empty
  const protocol = new Protocol();
  maplibregl.addProtocol("pmtiles", protocol.tile);
  map = new maplibregl.Map({
    container: el.value,
    style: buildStyle(url),
    interactive: false,
    attributionControl: { compact: true },
  });
  map.on("load", drawRoute);
});

watch(
  () => [props.from.id, props.to.id],
  () => map?.loaded() && drawRoute(),
);

onBeforeUnmount(() => {
  map?.remove();
  maplibregl.removeProtocol("pmtiles");
});
</script>

<template>
  <div
    ref="el"
    class="h-40 w-full overflow-hidden rounded-[var(--radius-sheet)] bg-[var(--color-paper)]"
    aria-hidden="true"
  />
</template>
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat(map): MapCanvas with pins + arc, fit-to-bounds, graceful no-op"
```

---

### Task 5: Slot the map into `ResultSlab`

**Files:**

- Modify: `src/components/ResultSlab.vue`

- [ ] **Step 1: Add the map above the headline**

In `src/components/ResultSlab.vue`, import and render `MapCanvas` at the top of the `<section>` (the slot reserved in Plan A). Add to `<script setup>`:

```ts
import MapCanvas from "./MapCanvas.vue";
```

Add as the first child inside `<section>`, before the `<p>` eyebrow:

```vue
<MapCanvas :from="from" :to="to" class="mb-4" />
```

- [ ] **Step 2: Manual verify**

Run: `npm run dev`
Pick Detroit → Austin. Expected: a muted cartographic map shows two orange pins joined by a gently bowed arc, fit to frame, above the salary headline. With `VITE_PMTILES_URL` unset, the box renders empty paper and the rest of the app is unaffected.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(ui): render route map inside ResultSlab"
```

---

### Task 6: Verification gate

- [ ] **Step 1: Full test + build**

Run: `npm run build && npm test`
Expected: build succeeds; all tests pass including `arc.test.ts` (3 new).

- [ ] **Step 2: Offline sanity**

Confirm: with the SW active and network offline, the calculator + Basket still work; the map simply shows the paper box (tiles need network — the accepted tradeoff from the spec).

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "test(map): verification gate for map layer"
```

---

## Self-Review

**Spec coverage:** §6 "v1 map = zoomed-out arc between two metros" → Tasks 1/4/5. §4 "MapLibre + self-hosted Protomaps, no per-call fees" → Tasks 2/3. §4 "map layer isolated so v1 arc and v2 radius are swappable" → `MapCanvas` is the sole maplibre consumer; arc geometry is a separate pure module. §4 "offline tradeoff: map needs network, calc works offline" → Task 4 graceful no-op + Task 6 offline sanity.

**Placeholder scan:** none — runnable code/commands throughout. The basemap `.pmtiles` is an asset, not code; Task 2 gives concrete hosting options.

**Type consistency:** `Metro` reused from Plan A `src/types.ts`; `greatCircleArc(from, to, steps)` signature matches its sole caller in `MapCanvas`. The `ARC_SOURCE` constant is used consistently for source + layer id.

**Deferred to Plan C:** real metro coordinates already ship in Plan A's seed (`lat`/`lng`), so the map works on seed data immediately; Plan C only refreshes values, not shape.
