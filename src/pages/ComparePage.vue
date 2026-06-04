<script setup lang="ts">
import { computed } from "vue";
import { useComparison } from "../composables/useComparison";
import { useTheme } from "../composables/useTheme";
import PlacePicker from "../components/PlacePicker.vue";
import SalaryInput from "../components/SalaryInput.vue";
import ResultSlab from "../components/ResultSlab.vue";
import BasketList from "../components/BasketList.vue";
import BreakdownSheet from "../components/BreakdownSheet.vue";

const c = useComparison();
const { theme, cycle: cycleTheme } = useTheme();

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
        <div class="flex items-baseline gap-2">
          <h1
            class="text-[length:var(--text-numeric)] font-black tracking-tight"
          >
            Elsewhere
          </h1>
          <span
            class="text-[length:var(--text-eyebrow)] uppercase opacity-60"
            style="letter-spacing: var(--text-eyebrow--letter-spacing)"
            >cost-of-living parity</span
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
          <!-- AUTO: half-filled disc (sun + moon merged) with dashed atlas ring -->
          <svg
            v-if="theme === 'auto'"
            class="h-5 w-5"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              fill="none"
              stroke="var(--color-ink)"
              stroke-width="1.2"
              stroke-dasharray="1 2"
            />
            <path d="M12,4 A8,8 0 0,1 12,20 Z" fill="var(--color-ink)" />
            <circle
              cx="12"
              cy="12"
              r="6.5"
              fill="none"
              stroke="var(--color-route)"
              stroke-width="1"
              stroke-dasharray="1.5 2"
            />
          </svg>

          <!-- LIGHT: sun -->
          <svg
            v-else-if="theme === 'light'"
            class="h-5 w-5"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="4.2" fill="var(--color-route)" />
            <g
              stroke="var(--color-ink)"
              stroke-width="1.6"
              stroke-linecap="round"
            >
              <line x1="12" y1="2.5" x2="12" y2="5" />
              <line x1="12" y1="19" x2="12" y2="21.5" />
              <line x1="2.5" y1="12" x2="5" y2="12" />
              <line x1="19" y1="12" x2="21.5" y2="12" />
              <line x1="5.2" y1="5.2" x2="7" y2="7" />
              <line x1="17" y1="17" x2="18.8" y2="18.8" />
              <line x1="5.2" y1="18.8" x2="7" y2="17" />
              <line x1="17" y1="7" x2="18.8" y2="5.2" />
            </g>
          </svg>

          <!-- DARK: crescent moon with a contour star -->
          <svg v-else class="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M19,14.5 A8.5,8.5 0 1,1 9.5,5 A6.5,6.5 0 0,0 19,14.5 Z"
              fill="var(--color-ink)"
            />
            <circle cx="17.5" cy="6.5" r="1" fill="var(--color-route)" />
          </svg>

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

    <!-- ── Result stack ───────────────────────────────────────── -->
    <div
      class="flex flex-col gap-[var(--space-stack)] px-5 pt-4"
      v-if="hasBothMetros"
    >
      <ResultSlab
        v-if="hasResult"
        :from="c.from.value!"
        :to="c.to.value!"
        :result="c.result.value!"
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

      <BasketList
        :rows="c.basket.value"
        :from="c.from.value!"
        :to="c.to.value!"
      />
      <BreakdownSheet :from="c.from.value!" :to="c.to.value!" />
    </div>

    <!-- ── Empty hero: nothing picked yet ─────────────────────── -->
    <section v-else class="mt-2 px-5 pb-2 pt-4">
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
          Pick two cities below. We'll show the salary that keeps your life the
          same — and what changes when you swap zip codes.
        </p>

        <!-- decorative route arc -->
        <svg
          class="mt-5 h-8 w-full"
          viewBox="0 0 200 32"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d="M4,26 Q100,-10 196,26"
            fill="none"
            stroke="var(--color-route)"
            stroke-width="2"
            stroke-linecap="round"
            stroke-dasharray="1.5 4"
          />
          <circle cx="4" cy="26" r="4" fill="var(--color-route)" />
          <circle
            cx="196"
            cy="26"
            r="4"
            fill="var(--color-on-dark)"
            stroke="var(--color-route)"
            stroke-width="2"
          />
        </svg>
      </div>
    </section>

    <!-- ── Thumb zone: inputs ─────────────────────────────────── -->
    <section
      class="mt-auto flex flex-col gap-3 px-5 pb-4 pt-6"
      aria-label="Comparison inputs"
    >
      <PlacePicker
        label="From"
        :metros="c.metros"
        :model-value="c.from.value?.id ?? null"
        @update:model-value="c.setFrom"
      />

      <!-- vertical route arrow between pickers -->
      <div class="flex justify-center" aria-hidden="true">
        <svg class="h-5 w-3" viewBox="0 0 12 20" fill="none">
          <path
            d="M6,1 L6,16 M2,12 L6,16 L10,12"
            stroke="var(--color-route)"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-dasharray="1.5 2.5"
          />
        </svg>
      </div>

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
    </section>

    <!-- ── Pill bottom nav (shell — non-functional for now) ───── -->
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
        class="flex flex-1 items-center justify-center gap-1.5 px-3 py-2 text-[length:var(--text-eyebrow)] font-black uppercase"
        :style="{
          borderRadius: 'var(--radius-pill)',
          background: 'var(--color-on-dark)',
          color: 'var(--color-surface-dark)',
          letterSpacing: 'var(--text-eyebrow--letter-spacing)',
        }"
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
        class="flex flex-1 items-center justify-center px-3 py-2 text-[length:var(--text-eyebrow)] font-bold uppercase text-[var(--color-on-dark)] opacity-60"
        style="letter-spacing: var(--text-eyebrow--letter-spacing)"
      >
        Saved
      </button>
      <button
        type="button"
        class="flex flex-1 items-center justify-center px-3 py-2 text-[length:var(--text-eyebrow)] font-bold uppercase text-[var(--color-on-dark)] opacity-60"
        style="letter-spacing: var(--text-eyebrow--letter-spacing)"
      >
        About
      </button>
    </nav>
  </main>
</template>
