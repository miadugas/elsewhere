<script setup lang="ts">
import { computed, ref } from "vue";
import { useComparison } from "../composables/useComparison";
import { useTheme } from "../composables/useTheme";
import PlacePicker from "../components/PlacePicker.vue";
import SalaryInput from "../components/SalaryInput.vue";
import ResultSlab from "../components/ResultSlab.vue";
import PlainEnglish from "../components/PlainEnglish.vue";
import BasketList from "../components/BasketList.vue";
import BreakdownSheet from "../components/BreakdownSheet.vue";
import ExploreView from "./ExploreView.vue";

const c = useComparison();
const { theme, cycle: cycleTheme } = useTheme();

// which doorway is showing — the bottom nav switches this
const view = ref<"compare" | "explore">("compare");

const hasBothMetros = computed(() => !!c.from.value && !!c.to.value);
const hasResult = computed(
  () => !!c.result.value && !!c.from.value && !!c.to.value,
);

const themeLabel = computed(() =>
  theme.value === "auto"
    ? "Theme: auto · tap for light"
    : theme.value === "light"
      ? "Theme: light · tap for dark"
      : "Theme: dark · tap for auto",
);
</script>

<template>
  <main
    class="relative mx-auto flex min-h-full max-w-md flex-col"
    :style="{ paddingBottom: 'var(--space-thumb)' }"
  >
    <!-- ── Brand mark ─────────────────────────────────────────── -->
    <header class="px-5 pb-2 pt-6">
      <div class="flex items-center justify-between">
        <div class="flex flex-col gap-1">
          <h1
            class="text-[length:var(--text-numeric)] font-black leading-none tracking-tight"
          >
            Elsewhere
          </h1>
          <span
            class="text-[length:var(--text-eyebrow)] uppercase opacity-75"
            style="letter-spacing: var(--text-eyebrow--letter-spacing)"
            >cost of living parity</span
          >
        </div>
        <!-- Theme toggle — cycles auto → light → dark → auto -->
        <button
          type="button"
          @click="cycleTheme"
          class="relative flex h-11 w-11 items-center justify-center transition-transform active:scale-95"
          :style="{
            borderRadius: 'var(--radius-pill)',
            background: 'var(--color-paper)',
            border: '1px solid var(--color-contour)',
            boxShadow: 'var(--shadow-sheet)',
          }"
          :aria-label="themeLabel"
          :title="themeLabel"
        >
          <!-- current mode as a bundled Fluent-Flat emoji -->
          <img
            :src="
              theme === 'auto'
                ? '/emoji/auto.svg'
                : theme === 'light'
                  ? '/emoji/sun.svg'
                  : '/emoji/moon.svg'
            "
            class="h-6 w-6"
            alt=""
            draggable="false"
          />

          <!-- tiny "A"/"L"/"D" tag at the corner for clarity -->
          <span
            class="tnum absolute -bottom-1 -right-1 flex h-4 min-w-4 items-center justify-center px-1 text-[0.55rem] font-black uppercase"
            style="
              border-radius: var(--radius-pill);
              background: var(--color-surface-dark);
              color: var(--color-on-dark);
              letter-spacing: 0.04em;
            "
            aria-hidden="true"
          >
            {{ theme === "auto" ? "A" : theme === "light" ? "L" : "D" }}
          </span>
        </button>
      </div>
    </header>

    <!-- ════ COMPARE doorway ═══════════════════════════════════ -->
    <template v-if="view === 'compare'">
      <!-- ── Result stack ───────────────────────────────────────── -->
      <div
        class="reveal-stack flex flex-col gap-[var(--space-stack)] px-5 pt-4"
        v-if="hasBothMetros"
      >
        <ResultSlab
          v-if="hasResult"
          :from="c.from.value!"
          :to="c.to.value!"
          :result="c.result.value!"
          :period="c.period.value"
          :hours-per-week="c.hoursPerWeek.value"
        />

        <!-- Prompt when metros picked but no salary yet -->
        <section
          v-else
          class="px-5 py-6 text-center"
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
            Almost there
          </p>
          <p class="mt-1 text-[length:var(--text-lede)] font-bold">
            Enter your salary below to see the parity number.
          </p>
        </section>

        <PlainEnglish
          v-if="hasResult"
          :from="c.from.value!"
          :to="c.to.value!"
          :result="c.result.value!"
          :period="c.period.value"
          :hours-per-week="c.hoursPerWeek.value"
        />

        <BasketList
          :rows="c.basket.value"
          :from="c.from.value!"
          :to="c.to.value!"
        />
        <BreakdownSheet :from="c.from.value!" :to="c.to.value!" />
      </div>

      <!-- ── Empty hero: nothing picked yet ─────────────────────── -->
      <section v-else class="reveal mt-2 px-5 pb-2 pt-4">
        <div
          class="relative overflow-hidden px-6 py-8"
          :style="{
            borderRadius: 'var(--radius-slab)',
            background: 'var(--color-surface-dark)',
            color: 'var(--color-on-dark)',
            boxShadow: 'var(--shadow-slab)',
          }"
        >
          <svg
            class="pointer-events-none absolute -right-10 -top-10 h-40 w-40 opacity-20"
            viewBox="0 0 100 100"
            aria-hidden="true"
          >
            <g
              fill="none"
              stroke="var(--color-on-dark)"
              stroke-width="0.6"
              stroke-dasharray="2 2"
            >
              <circle cx="50" cy="50" r="46" />
              <circle cx="50" cy="50" r="32" />
              <circle cx="50" cy="50" r="18" />
            </g>
          </svg>

          <p
            class="text-[length:var(--text-eyebrow)] uppercase opacity-70"
            style="letter-spacing: var(--text-eyebrow--letter-spacing)"
          >
            The question
          </p>
          <p
            class="font-display mt-2 font-black"
            style="
              font-size: var(--text-display);
              line-height: var(--text-display--line-height);
              letter-spacing: var(--text-display--letter-spacing);
            "
          >
            If I move,<br />what's my number?
          </p>
          <p class="mt-3 text-[length:var(--text-body)] opacity-80">
            Pick two cities below. We'll show the salary that keeps your life
            the same — and what changes when you swap zip codes.
          </p>

          <!-- decorative route arc, anchored by the From/To pins -->
          <div class="relative mt-5 h-8 w-full">
            <svg
              class="absolute inset-0 h-full w-full"
              viewBox="0 0 200 32"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="rt-hero" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stop-color="var(--color-route-from)" />
                  <stop offset="100%" stop-color="var(--color-route-to)" />
                </linearGradient>
              </defs>
              <path
                d="M4,26 Q100,-10 196,26"
                fill="none"
                stroke="url(#rt-hero)"
                stroke-width="2"
                stroke-linecap="round"
                stroke-dasharray="1.5 4"
              />
            </svg>
            <img
              src="/emoji/from.svg"
              alt=""
              draggable="false"
              class="pointer-events-none absolute h-5 w-5"
              style="left: 2%; top: 26px; transform: translate(-50%, -86%)"
            />
            <img
              src="/emoji/to.svg"
              alt=""
              draggable="false"
              class="pointer-events-none absolute h-5 w-5"
              style="left: 98%; top: 26px; transform: translate(-50%, -86%)"
            />
          </div>
        </div>
      </section>

      <!-- ── Thumb zone: inputs ─────────────────────────────────── -->
      <section class="mt-auto px-5 pb-4 pt-6" aria-label="Comparison inputs">
        <!-- From → To read as one route pair; the dashed rail on the left
           threads the From waypoint down into the To waypoint. -->
        <div class="flex flex-col gap-3">
          <PlacePicker
            label="From"
            :metros="c.metros"
            :model-value="c.from.value?.id ?? null"
            @update:model-value="c.setFrom"
            @swap="c.swap"
          />

          <PlacePicker
            label="To"
            :metros="c.metros"
            :model-value="c.to.value?.id ?? null"
            @update:model-value="c.setTo"
            @swap="c.swap"
          />
        </div>

        <!-- salary is a separate question — give it room to breathe -->
        <div class="mt-7">
          <SalaryInput
            :model-value="c.displaySalary.value"
            :period="c.period.value"
            :hours-per-week="c.hoursPerWeek.value"
            @update:model-value="c.setSalary"
            @update:period="c.setPeriod"
            @update:hours-per-week="c.setHoursPerWeek"
          />
        </div>
      </section>
    </template>

    <!-- ════ EXPLORE doorway ═══════════════════════════════════ -->
    <ExploreView v-else-if="view === 'explore'" :comparison="c" />

    <!-- ── Pill bottom nav ─────────────────────────────────────── -->
    <nav
      class="fixed inset-x-0 bottom-3 z-30 mx-auto flex max-w-[22rem] items-center justify-between gap-1 p-1.5"
      :style="{
        borderRadius: 'var(--radius-pill)',
        background: 'var(--color-surface-dark)',
        boxShadow: 'var(--shadow-sheet-lifted)',
      }"
      aria-label="App sections"
    >
      <button
        type="button"
        @click="view = 'compare'"
        :aria-current="view === 'compare' ? 'page' : undefined"
        class="font-display flex flex-1 items-center justify-center gap-1.5 px-3 py-2 text-[length:var(--text-eyebrow)] uppercase transition-colors"
        :class="view === 'compare' ? 'font-black' : 'font-bold'"
        :style="
          view === 'compare'
            ? {
                borderRadius: 'var(--radius-pill)',
                background: 'var(--color-on-dark)',
                color: 'var(--color-surface-dark)',
                letterSpacing: 'var(--text-eyebrow--letter-spacing)',
              }
            : {
                color: 'var(--color-on-dark)',
                opacity: 0.6,
                letterSpacing: 'var(--text-eyebrow--letter-spacing)',
              }
        "
      >
        <svg class="h-3 w-3" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path
            d="M1,9 Q6,1 11,9"
            stroke="var(--color-route)"
            stroke-width="1.6"
            stroke-linecap="round"
          />
        </svg>
        Compare
      </button>
      <button
        type="button"
        @click="view = 'explore'"
        :aria-current="view === 'explore' ? 'page' : undefined"
        class="font-display flex flex-1 items-center justify-center gap-1.5 px-3 py-2 text-[length:var(--text-eyebrow)] uppercase transition-colors"
        :class="view === 'explore' ? 'font-black' : 'font-bold'"
        :style="
          view === 'explore'
            ? {
                borderRadius: 'var(--radius-pill)',
                background: 'var(--color-on-dark)',
                color: 'var(--color-surface-dark)',
                letterSpacing: 'var(--text-eyebrow--letter-spacing)',
              }
            : {
                color: 'var(--color-on-dark)',
                opacity: 0.6,
                letterSpacing: 'var(--text-eyebrow--letter-spacing)',
              }
        "
      >
        <svg class="h-3 w-3" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <circle
            cx="5"
            cy="5"
            r="3.2"
            stroke="var(--color-route)"
            stroke-width="1.4"
          />
          <path
            d="M7.5,7.5 L10.5,10.5"
            stroke="var(--color-route)"
            stroke-width="1.6"
            stroke-linecap="round"
          />
        </svg>
        Explore
      </button>
      <button
        type="button"
        disabled
        aria-disabled="true"
        title="Coming soon"
        class="font-display flex flex-1 cursor-not-allowed items-center justify-center gap-1.5 px-3 py-2 text-[length:var(--text-eyebrow)] font-bold uppercase text-[var(--color-on-dark)] opacity-35"
        style="letter-spacing: var(--text-eyebrow--letter-spacing)"
      >
        About
      </button>
    </nav>
  </main>
</template>
