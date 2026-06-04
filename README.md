# Elsewhere

Cost-of-living parity, mobile-first. Answers one question: **"If I move from here to there, what salary keeps my life the same?"** — with a tangible everyday-price "Basket" (a localized Big Mac Index) so the numbers feel real.

Vue 3 + Vite + TypeScript PWA · Tailwind v4 · free/official data only · static-first (works offline).

> Working title — name may change. Design spec + plans live in `docs/superpowers/`.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Vitest — engines, composable, page smoke
npm run build      # type-checks (vue-tsc) + builds to dist/ + emits PWA service worker
```

## Architecture

- **Pure engines** (`src/engines/`) — `parity` (required-salary math), `basket` (localized prices), `places` (metro type-ahead). No I/O, fully unit-tested.
- **`useComparison`** (`src/composables/`) — the single reactive seam wiring engines to the bundled JSON data.
- **Components** (`src/components/`) render over the engines; no business math in the UI.
- **Data** (`src/data/`) — hand-seeded `metros.json` (15 metros) + `basket.json`. A future data pipeline (Plan C) replaces the seed with real BEA RPP + HUD rents.

## Deploy (Cloudflare Pages)

- **Build command:** `npm run build`
- **Build output directory:** `dist`
- **Node version:** 20

The app is fully static — the calculator works offline once loaded (data is bundled). Connect the repo in the Cloudflare Pages dashboard, or `npx wrangler pages deploy dist`.

## Roadmap

- **Plan A (this):** core calculator PWA — ✅
- **Plan B:** MapLibre + self-hosted Protomaps arc map
- **Plan C:** BEA/HUD data pipeline (cron on the_litterbox) replacing the seed data
