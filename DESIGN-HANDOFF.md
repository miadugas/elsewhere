# Elsewhere — Design Handoff (for the visual polish pass)

The logic is **done and tested**. This is a function-first skeleton in primer — the cartographic identity exists only as CSS tokens so far. Your job: dress it up without breaking the wiring.

## What it is

Mobile-first PWA. One question: _"If I move from here to there, what salary keeps my life the same?"_ — plus a tangible everyday-price **Basket** (localized Big Mac Index). Run it: `cd ~/Developer/elsewhere && npm run dev` → `localhost:5173`. Pick Detroit → Austin, enter a salary.

## Locked aesthetic (don't redirect this — it was decided in the spec)

Two layers, kept distinct:

- **Chrome** (from rideshare/delivery refs): muted **map backdrop**, **floating bottom-sheet cards** over it, **pill bottom nav**, a confident **black slab** for the hero result number. Soft elevation on sheets, generous whitespace.
- **Identity** (place-flavored cartography — _"the texture of moving"_): the **From→To route/arc** as the brand motif, **state silhouettes** as icons, an **atlas palette** (terrain greens, water blues, highway-sign warm, contour linework) — NOT generic pastel fintech.

Full rationale: `docs/superpowers/specs/2026-06-03-elsewhere-design.md` §6.

## Constraints

- **Mobile-first.** Thumb zone = inputs in the lower 2/3; result renders above. 44px+ targets, numeric keypad on salary.
- **No UI library.** Hand-built components (this is deliberate).
- **Tailwind v4** via `@tailwindcss/vite` — tokens live in `@theme`, utilities auto-generate.
- **Static / offline.** Don't add runtime data fetching; data is bundled JSON.

## Tokens already defined — `src/styles/tokens.css`

```
--color-paper #f7f5ef   --color-ink #1a1d1a     --color-terrain #3f7d4e
--color-water #2f6fb0    --color-route #e0662a   --color-contour #d8d2c2
--color-cheaper #2f8a5b  --color-pricier #c2452f
--radius-sheet 20px      --radius-pill 9999px
```

Extend these (type scale, shadows, spacing) rather than hardcoding values in components.

## Components to restyle — `src/components/` + `src/pages/`

| File                            | What it is                                | Polish targets                                                              |
| ------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------- |
| `pages/ComparePage.vue`         | the whole screen, single column           | overall rhythm, section spacing, the bottom-sheet stack, add pill nav shell |
| `components/ResultSlab.vue`     | black hero — required salary + delta pill | make it _the_ moment: type scale, the route motif, share-ready              |
| `components/BasketList.vue`     | 🍕⛽🍺 price rows (the shareable bit)     | this is the screenshot people post — give it character                      |
| `components/PlacePicker.vue`    | From/To type-ahead                        | dropdown styling, selected-state, maybe state silhouettes                   |
| `components/SalaryInput.vue`    | $ numeric input                           | feel tactile, on-brand                                                      |
| `components/BreakdownSheet.vue` | category parity tap-through               | collapse/expand affordance, table rhythm                                    |

## Not done yet / gated

- **The map** (bottom-sheet-over-map look + the arc) = **Plan B** — needs Protomaps tile hosting. `ResultSlab.vue` has a reserved comment slot for `<MapCanvas>`. The full "rideshare" feel arrives with it.
- **Real data** (real metros/rents) = **Plan C**. Current data is a 15-metro seed — fine for design.
- **Icon set** — only a placeholder `public/icon.svg`. Full PNG/apple-touch set is a branding task.

## Guardrail

All math lives in `src/engines/` + `src/composables/useComparison.ts`. **Don't put logic in components.** Restyle freely; keep props/emits intact (17 tests + a ComparePage mount test will catch breaks — run `npm test`).
