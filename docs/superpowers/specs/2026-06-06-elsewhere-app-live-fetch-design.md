# Elsewhere — app fetches live data (Phase 3)

**Date:** 2026-06-06
**Status:** Approved design, ready for implementation plan
**Topic:** Make the frontend consume the live API (`data.miacodes.com/api/metros`) instead of only the bundled JSON, with cache + bundled fallback.

## Problem

The app imports metro data statically (`import metrosData from "../data/metros.json"`). Phase 2 stood up a live API. Phase 3 wires the app to fetch it so users get current data — without losing instant load or offline resilience.

## Decision (locked)

**Seed bundled → revalidate live.** The app starts instantly from a cached-or-bundled snapshot (no spinner, works offline), fires the API fetch in the background, and swaps in live data when it arrives. Fallback chain: **live (fetch) → localStorage cache → bundled import.**

## Scope

**In:** turn the `useComparison` data seam into a reactive, self-loading source; a `loadMetros()` fetch with validation; localStorage caching; `.value` touch-ups in the two components that read `c.metros`; an env-var API base; tests.

**Out (YAGNI):** freshness/"live vs offline" indicator UI, service-worker runtime caching, retry/backoff, error toasts. The Pages-origin CORS entry is a deploy-time config change, not code (noted below).

## Architecture

The data seam is already isolated: **only `src/composables/useComparison.ts` imports `metros.json`**, and the engines (`searchMetros`, `findMetro`, `rankByAffordability`, `availableFilters`, `applyFilters`) take `metros` as a parameter — so they don't change. The work is concentrated in `useComparison.ts` plus small `.value` edits in consumers.

### `useComparison.ts`

- `metros` becomes `const metros = ref<Metro[]>(cachedOrBundled())` — seeded synchronously, so first render is instant.
- `cachedOrBundled()`: read localStorage key `elsewhere:metros:v1`; if it parses to a valid non-empty array, use it; else use the bundled `metrosData` import.
- `loadMetros()` (async, fired once on composable init):
  1. `fetch(`${API_BASE}/api/metros`)`
  2. if `res.ok` and the JSON `isValidMetros(data)` → `metros.value = data` and `localStorage.setItem("elsewhere:metros:v1", JSON.stringify({ fetchedAt: <iso>, metros: data }))`.
  3. any failure (network, non-200, invalid payload, JSON parse, localStorage throw) → swallow; the seed stays.
- Internal computeds (`from`, `to`, `affordable`) read `metros.value`.
- Returned to consumers: `metros` (the ref). New optional exports: none required (keep surface minimal).

### Config

`const API_BASE = import.meta.env.VITE_API_BASE ?? "https://data.miacodes.com"`. Overridable via a `.env` / `.env.local` for dev. Dev origin `http://localhost:5173` is already in the box's `CORS_ORIGINS`. When the frontend deploys to Cloudflare Pages, add that origin to `~/apps/elsewhere/.env` `CORS_ORIGINS` and `docker compose up -d api` (deploy step, not code).

### Validation — `isValidMetros(data)`

Returns true only if `data` is an array, length > 0, and `data[0]` has a string `id` and an object `rpp` with numeric `overall`. Guards against a malformed/HTML/empty API response ever replacing good seed data.

### Consumer `.value` touch-ups

- `src/pages/ExploreView.vue`: `:metros="c.metros.value"` and `availableFilters(c.metros.value)`.
- `src/pages/ComparePage.vue`: `:metros="c.metros.value"`.
  (Matches the existing convention — `c.from.value`, `c.affordable.value` etc. are already accessed with `.value`.)

## Data flow

```
init ─▶ metros = ref(cachedOrBundled())   ── instant render, offline-safe
   └─▶ loadMetros() (background)
          fetch /api/metros
            ├─ ok + valid  ─▶ metros.value = live ; cache to localStorage
            └─ fail/invalid ─▶ keep seed (cache or bundle)
```

## Error handling / edge cases

- Box down / offline / CORS error / 503 → fetch rejects or non-ok → seed stays, no UI error. The app is fully usable on bundled/cached data.
- Malformed payload → `isValidMetros` false → ignored.
- localStorage unavailable/full (private mode, quota) → wrapped in try/catch; reads/writes degrade to bundled-only, no crash.
- Stale cache is acceptable — it's only a seed; a successful fetch always supersedes it within the same session.

## Testing (Vitest; mock `global.fetch` + `localStorage`)

- **seeds from bundled** when no cache present and fetch is pending/never resolves.
- **swaps to live** after a successful fetch, and **writes** the localStorage cache (`elsewhere:metros:v1`).
- **keeps the seed** when fetch rejects, returns non-ok, or returns an invalid payload (array of garbage / not an array / empty).
- **seeds from cache** when localStorage holds a valid snapshot (used instead of the bundle).
- existing `useComparison`/page tests still pass after the `.value` change (update any that read `c.metros`).

Tests stub `fetch` per-case and reset `localStorage` between cases. No real network.

## Rollout

Single frontend change, committed to `main`. Works in dev immediately (CORS already allows localhost). No user-visible change except fresher data once fetched; offline/instant behavior preserved. The Pages-origin CORS addition happens whenever the frontend is deployed.
