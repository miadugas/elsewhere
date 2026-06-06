<script setup lang="ts">
import { useTheme } from "../composables/useTheme";

// Presentation only — all theme state lives in useTheme.
const { isDark, toggle } = useTheme();

const label = () =>
  isDark.value ? "Switch to light mode" : "Switch to dark mode";
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="isDark"
    :aria-label="label()"
    :title="label()"
    class="theme-switch"
    :class="{ 'is-dark': isDark }"
    @click="toggle"
  >
    <!-- night sky: tiny stars fade in on dark -->
    <span class="stars" aria-hidden="true">
      <i style="top: 9px; left: 11px; --d: 0ms"></i>
      <i style="top: 18px; left: 19px; --d: 80ms"></i>
      <i style="top: 7px; left: 24px; --d: 140ms"></i>
    </span>

    <!-- the knob: warm sun (light) ⇄ filled bluish-white crescent (dark) -->
    <span class="knob" aria-hidden="true">
      <svg class="moon" viewBox="0 0 26 26" width="26" height="26">
        <defs>
          <radialGradient id="ts-moon-fill" cx="64%" cy="34%" r="82%">
            <stop offset="0%" stop-color="oklch(0.99 0.008 240)" />
            <stop offset="100%" stop-color="oklch(0.82 0.045 256)" />
          </radialGradient>
          <mask id="ts-moon-cut">
            <circle cx="14" cy="13" r="11" fill="#fff" />
            <circle cx="6.4" cy="11" r="10.4" fill="#000" />
          </mask>
        </defs>
        <circle
          cx="14"
          cy="13"
          r="11"
          fill="url(#ts-moon-fill)"
          mask="url(#ts-moon-cut)"
        />
      </svg>
    </span>
  </button>
</template>

<style scoped>
.theme-switch {
  position: relative;
  width: 64px;
  height: 34px;
  flex-shrink: 0;
  border-radius: 9999px;
  border: 1px solid color-mix(in oklch, var(--color-on-dark) 14%, transparent);
  padding: 0;
  cursor: pointer;
  overflow: hidden;
  /* sky by day, night-navy in dark — shared with the pay toggle + nav */
  background: var(--slider-track);
  box-shadow:
    inset 0 1px 3px rgba(0, 0, 0, 0.18),
    inset 0 0 0 1px rgba(255, 255, 255, 0.18);
  transition:
    background 420ms ease,
    border-color 420ms ease;
  -webkit-tap-highlight-color: transparent;
}
.theme-switch:focus-visible {
  outline: none;
  box-shadow:
    inset 0 1px 3px rgba(0, 0, 0, 0.18),
    0 0 0 3px color-mix(in oklch, var(--color-route) 40%, transparent);
}

/* ── stars (dark only) ─────────────────────────────────────────── */
.stars i {
  position: absolute;
  width: 3px;
  height: 3px;
  border-radius: 9999px;
  background: oklch(0.97 0.01 250);
  opacity: 0;
  transform: scale(0.4);
  transition:
    opacity 300ms ease var(--d),
    transform 300ms cubic-bezier(0.22, 1, 0.36, 1) var(--d);
}
.is-dark .stars i {
  opacity: 0.9;
  transform: scale(1);
}

/* ── knob: sun ⇄ moon ──────────────────────────────────────────── */
.knob {
  position: absolute;
  top: 4px;
  left: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 9999px;
  /* sun */
  background: radial-gradient(
    circle at 35% 30%,
    oklch(0.98 0.05 90),
    oklch(0.86 0.14 78)
  );
  box-shadow:
    0 2px 5px rgba(0, 0, 0, 0.3),
    0 0 10px 1px oklch(0.85 0.14 80 / 0.7);
  transition:
    transform 440ms cubic-bezier(0.34, 1.4, 0.5, 1),
    background 420ms ease,
    box-shadow 420ms ease;
}
.is-dark .knob {
  transform: translateX(30px);
  /* no disc on the night side — the crescent SVG is the whole knob */
  background: transparent;
  box-shadow: 0 0 11px 1px oklch(0.88 0.05 255 / 0.4);
}

/* filled crescent — fades/rotates in once the knob slides to the night side.
   The mask cut is transparent, so the night sky shows through (no eclipse ball) */
.moon {
  position: absolute;
  inset: 0;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.4));
  opacity: 0;
  transform: rotate(-22deg) scale(0.55);
  transform-origin: center;
  transition:
    opacity 340ms ease 60ms,
    transform 440ms cubic-bezier(0.34, 1.4, 0.5, 1) 60ms;
}
.is-dark .moon {
  opacity: 1;
  transform: rotate(0deg) scale(1);
}

@media (prefers-reduced-motion: reduce) {
  .knob,
  .moon,
  .stars i,
  .theme-switch {
    transition: none;
  }
}
</style>
