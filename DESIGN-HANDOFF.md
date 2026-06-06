# Elsewhere — Design Handoff

**Status:** Logic done + tested (23 tests, 7 files). The visual polish pass is **done** — the app now wears the full "celestial atlas" identity in light + dark. This doc is the current-state spec: tokens, components, states, and what's still gated.

Run it: `cd ~/Developer/elsewhere && npm run dev` → `localhost:5173`. Pick Detroit → Austin, enter a salary.

## What it is

Mobile-first PWA. One question: _"If I move from here to there, what salary keeps my life the same?"_ — plus a tangible everyday-price **Basket** (localized Big Mac Index). Three tabs: **Compare** (the core flow), **Explore** (browse metros), **About**.

## Aesthetic — "celestial atlas" (shipped)

> ⚠️ Superseded the original spec's highway-orange atlas. Don't revert to terrain-green / highway-orange — the palette is now a **night-sky journey**.

- **Palette:** cool indigo-navy neutrals + a **sky-blue accent** (`--color-route`) + a **sun→moon journey gradient** (warm gold origin `--color-route-from` → moon-blue destination `--color-route-to`). Deltas stay green (cheaper) / red (pricier).
- **Backdrop:** kept from the original — paper + faint **contour dot-grid** (22px) + soft sky/terrain washes, `background-attachment: fixed`.
- **Two surface families:**
  - `paper` / `ink` / `canvas` — **flip with theme** (cards + page text).
  - `surface-dark` / `on-dark` — **do NOT flip**; the confident slab + active control labels read dark in both modes.
- **Type:** one family — **Geist Variable**. Hierarchy from weight + size; numbers use tabular figures (`.tnum`).
- **Icons:** **Lucide** (`lucide-vue-next`). No SF Symbols (web-license), no hand-rolled images.

## Theme system — read this before touching tokens

Four contexts in `src/styles/tokens.css`, and **every theme-dependent token must be set in all four** or forced-light/dark breaks when the OS preference disagrees:

1. `@theme { … }` — light defaults
2. `@media (prefers-color-scheme: dark) :root` — auto dark
3. `:root[data-theme="light"]` — forced light
4. `:root[data-theme="dark"]` — forced dark

Theme is driven by `useTheme.ts` (`isDark`, `toggle()`); `<html data-theme>` forces a mode, otherwise OS preference wins. Toggling animates the sun ⇄ moon switch in the header.

## Design tokens — `src/styles/tokens.css`

Reference tokens, never hardcode. Selected light-mode values (dark equivalents live in the dark blocks):

| Token                                          | Light value                                     | Usage                                    |
| ---------------------------------------------- | ----------------------------------------------- | ---------------------------------------- |
| `--color-canvas`                               | `oklch(0.95 0.018 250)`                         | page background (pale sky)               |
| `--color-paper`                                | `oklch(0.99 0.006 250)`                         | card / input surfaces                    |
| `--color-ink` / `--color-ink-soft`             | `oklch(0.25 0.04 268)` / `0.42 …`               | primary / secondary text                 |
| `--color-surface-dark`                         | `oklch(0.2 0.035 270)`                          | always-dark slab + active labels         |
| `--color-route`                                | `oklch(0.55 0.16 255)`                          | sky-blue accent — `$`, focus ring, links |
| `--color-route-from` / `--color-route-to`      | gold `0.72 0.14 75` / blue `0.55 0.15 258`      | journey gradient (From pin / To flag)    |
| `--color-cheaper` / `--color-pricier`          | green `0.57 0.12 150` / red `0.55 0.17 28`      | parity deltas                            |
| `--color-contour` / `--color-contour-ink`      | `0.86 …` / `0.74 …`                             | dot-grid, dividers, borders              |
| `--radius-sheet` / `-slab` / `-chip` / `-pill` | 20 / 24 / 12 / 9999px                           | cards / hero / chips / pills             |
| `--shadow-sheet` / `-sheet-lifted` / `-slab`   | navy-tinted, deepen in dark via `--shadow-base` | elevation                                |
| type scale                                     | `--text-eyebrow → --text-hero`                  | see file for size/line-height/tracking   |
| spacing                                        | `--space-gutter / -sheet-pad / -stack / -thumb` | layout rhythm                            |

### Shared "slider" family

The **theme switch**, **Annual/Hourly pay toggle**, and **bottom nav** all consume one token set so they read as one family:

| Token                 | Role                                                                       |
| --------------------- | -------------------------------------------------------------------------- |
| `--slider-track`      | sky gradient (light) → night-navy gradient (dark)                          |
| `--slider-thumb`      | sun gold (light) → pale moon (dark)                                        |
| `--slider-thumb-glow` | thumb halo                                                                 |
| `--slider-muted`      | inactive label = `ink @ 40%` (matches input placeholder, flips with theme) |

## Components — `src/components/` + `src/pages/`

| File                            | What it is                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------- |
| `pages/ComparePage.vue`         | app shell — header + wordmark, theme toggle, the Compare flow, 3-tab sliding pill nav |
| `pages/ExploreView.vue`         | Explore tab — browse metros                                                           |
| `pages/AboutView.vue`           | About tab — "One honest number" + 3 info cards                                        |
| `components/ResultSlab.vue`     | always-dark hero — required salary + delta pill (reserved `<MapCanvas>` slot inside)  |
| `components/PlainEnglish.vue`   | one-sentence plain-language readout of the result                                     |
| `components/BasketList.vue`     | everyday-price rows (the shareable screenshot), Lucide icons                          |
| `components/AffordList.vue`     | affordability breakdown rows                                                          |
| `components/BreakdownSheet.vue` | category parity tap-through                                                           |
| `components/PlacePicker.vue`    | From/To type-ahead — From = green `MapPin`, To = pink `Flag`                          |
| `components/SalaryInput.vue`    | `$` input + sliding Annual/Hourly toggle; hourly reveals hrs/wk chip                  |
| `components/ThemeToggle.vue`    | sliding sun ⇄ moon switch (filled crescent SVG + fade-in stars)                       |

## States & interactions

| Element                | State        | Behavior                                                                                                           |
| ---------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------ |
| Inputs (`.input-pop`)  | focus-within | route-blue ring (`box-shadow 3px @26%`) + lift `translateY(-1px)`, 150ms                                           |
| `PlacePicker` field    | selected     | border `1.5px var(--color-ink)` + state-code chip (ink bg / paper text)                                            |
| `PlacePicker` dropdown | open         | bottom-sheet style on `--color-paper` (calm surface — **not** a loud gradient), `--shadow-sheet-lifted`            |
| `PlacePicker` row      | hover        | subtle route-tint band (`color-mix(route 14%)`), 150ms                                                             |
| Theme toggle           | click        | knob slides 30px, sun→moon morph 440ms `cubic-bezier(0.34,1.4,0.5,1)`, stars fade in                               |
| Pay toggle             | click        | thumb slides `translateX(100%)` over half-width, 360ms; active label `surface-dark`, inactive `--slider-muted`     |
| Bottom nav             | tab change   | thumb slides `0 / 100% / 200%` over one-third width, 380ms; active label color delayed 210ms so it flips mid-slide |
| hrs/wk chip            | rate focused | route-tint callout + pulse (reduced-motion → static ring)                                                          |

## Responsive behavior

Single-column, **mobile-first**, capped at `max-w-md` and centered — desktop just centers the phone-width column. Thumb zone: inputs live in the lower portion (44px+ targets, numeric/decimal keypad on salary); results render above. Bottom nav is `fixed`, content reserves `--space-thumb` (5.5rem) of bottom padding.

## Motion

| Element        | Trigger     | Animation                                  | Duration  | Easing                        |
| -------------- | ----------- | ------------------------------------------ | --------- | ----------------------------- |
| Result stack   | mount       | `rise-in` staggered (0 / 70 / 140 / 210ms) | 0.5s      | `cubic-bezier(0.22,1,0.36,1)` |
| Empty hero     | mount       | `rise-in`                                  | 0.55s     | same                          |
| Sliders/thumbs | interaction | translate (see states)                     | 360–440ms | spring-ish cubic-bezier       |

All motion is transform/opacity only and respects `prefers-reduced-motion: reduce`.

## Accessibility

- Theme toggle: `role="switch"` + `aria-checked` + dynamic `aria-label`.
- Pay toggle: `role="group"` + per-button `aria-pressed`.
- Nav: `aria-current="page"` on active tab.
- Inputs carry `aria-label`; decorative pins/scene `aria-hidden`.
- **To verify before ship:** dark-mode contrast on muted labels + route-tint hovers; full keyboard focus order through the dropdown.

## Data — real, bundled, offline

- **`src/data/metros.json` — 384 real metros** (BEA 2024 Metro RPP). _This replaces the old 15-metro seed; Plan C is done._
- `src/data/basket.json` — everyday-price basket.
- Static / offline — bundled JSON, **no runtime fetching**. PWA caches scenes (`vite-plugin-pwa`, `globPatterns` includes `jpg`).

## Still gated

- **The map** (`<MapCanvas>` over the slab + the route arc) = **Plan B** — needs Protomaps tile hosting. Reserved slot in `ResultSlab.vue`.
- **Icon set** — placeholder `public/icon.svg` only; full PNG/apple-touch set is a branding task.
- **Cleanup:** `@heroicons/vue` is still in `package.json` but unused (evaluated, dropped for Lucide) — safe to uninstall.

## Guardrail

All math lives in `src/engines/` + `src/composables/`. **No logic in components** — presentation only. Keep props/emits intact; `npm test` (23 tests) + `npx vue-tsc --noEmit` catch breaks.
