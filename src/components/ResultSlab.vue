<script setup lang="ts">
import { computed } from "vue";
import type { Metro, ParityResult } from "../types";
import {
  formatPayFromAnnual,
  unitSuffix,
  type PayPeriod,
} from "../engines/pay";

const props = defineProps<{
  from: Metro;
  to: Metro;
  result: ParityResult;
  period: PayPeriod;
  hoursPerWeek: number;
}>();

// result figures are canonical annual; render them in the chosen period.
const money = (n: number) =>
  formatPayFromAnnual(n, props.period, props.hoursPerWeek);
const suffix = computed(() => unitSuffix(props.period));
const cheaper = computed(() => props.result.delta < 0);
const pctText = computed(
  () => `${Math.abs(Math.round(props.result.pct * 100))}%`,
);
const fromState = computed(() => props.from.states[0] ?? "—");
const toState = computed(() => props.to.states[0] ?? "—");

// The "other unit" equivalent of the hero number, so an hourly result also
// shows its yearly figure (and vice-versa). result.* is canonical annual.
const equivPeriod = computed<PayPeriod>(() =>
  props.period === "hourly" ? "annual" : "hourly",
);
const equivValue = computed(() =>
  formatPayFromAnnual(
    props.result.requiredSalary,
    equivPeriod.value,
    props.hoursPerWeek,
  ),
);
const equivWord = computed(() =>
  props.period === "hourly" ? "a year" : "an hour",
);
</script>

<template>
  <section
    class="relative overflow-hidden text-[var(--color-on-dark)]"
    :style="{
      borderRadius: 'var(--radius-slab)',
      background:
        'linear-gradient(180deg, var(--color-surface-dark) 0%, var(--color-surface-dark-soft) 100%)',
      boxShadow: 'var(--shadow-slab)',
    }"
  >
    <!-- ────────────────────────────────────────────────────────── -->
    <!--  RESERVED MAP SLOT — <MapCanvas/> drops in here later.     -->
    <!--  Keep this comment block; the map plan targets this spot.  -->
    <!-- ────────────────────────────────────────────────────────── -->
    <!-- <MapCanvas :from="from" :to="to" /> -->

    <!-- decorative contour rings — atlas seal vibe, top-right corner -->
    <svg
      class="pointer-events-none absolute -right-12 -top-12 h-44 w-44 opacity-[0.18]"
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
        <circle cx="50" cy="50" r="34" />
        <circle cx="50" cy="50" r="22" />
        <circle cx="50" cy="50" r="10" />
      </g>
    </svg>

    <div class="relative p-6 pt-5">
      <!-- ── Route motif: FROM →arc→ TO ─────────────────────────── -->
      <div class="flex items-center gap-3">
        <div class="flex min-w-0 flex-col">
          <span
            class="text-[length:var(--text-eyebrow)] uppercase opacity-70"
            style="letter-spacing: var(--text-eyebrow--letter-spacing)"
            >From</span
          >
          <span class="truncate text-[length:var(--text-lede)] font-bold">{{
            from.short
          }}</span>
        </div>

        <!-- the brand motif: a low arc anchored by the From/To pins -->
        <div class="relative h-7 flex-1">
          <svg
            class="absolute inset-0 h-full w-full"
            viewBox="0 0 100 28"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="rt-slab" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stop-color="var(--color-route-from)" />
                <stop offset="100%" stop-color="var(--color-route-to)" />
              </linearGradient>
            </defs>
            <path
              d="M2,24 Q50,-8 98,24"
              fill="none"
              stroke="url(#rt-slab)"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-dasharray="1.5 4"
            />
          </svg>
          <img
            src="/emoji/from.svg"
            alt=""
            draggable="false"
            class="pointer-events-none absolute h-4 w-4"
            style="left: 2%; top: 24px; transform: translate(-50%, -86%)"
          />
          <img
            src="/emoji/to.svg"
            alt=""
            draggable="false"
            class="pointer-events-none absolute h-4 w-4"
            style="left: 98%; top: 24px; transform: translate(-50%, -86%)"
          />
        </div>

        <div class="flex min-w-0 flex-col items-end">
          <span
            class="text-[length:var(--text-eyebrow)] uppercase opacity-70"
            style="letter-spacing: var(--text-eyebrow--letter-spacing)"
            >To</span
          >
          <span class="truncate text-[length:var(--text-lede)] font-bold">{{
            to.short
          }}</span>
        </div>
      </div>

      <!-- contour divider -->
      <div class="contour-rule mt-5 opacity-40" />

      <!-- ── The moment ─────────────────────────────────────────── -->
      <p
        class="mt-5 text-[length:var(--text-eyebrow)] uppercase opacity-70"
        style="letter-spacing: var(--text-eyebrow--letter-spacing)"
      >
        To live like
        <span class="tnum font-bold opacity-100"
          >{{ money(result.fromSalary) }}{{ suffix }}</span
        >
        in {{ from.short }}, {{ fromState }}
      </p>

      <p
        class="mt-2 text-[length:var(--text-meta)] font-semibold uppercase opacity-80"
        style="letter-spacing: var(--text-eyebrow--letter-spacing)"
      >
        you'd need
      </p>

      <p
        class="tnum mt-2 font-black"
        style="
          font-size: var(--text-hero);
          line-height: var(--text-hero--line-height);
          letter-spacing: var(--text-hero--letter-spacing);
        "
      >
        {{ money(result.requiredSalary)
        }}<span
          v-if="suffix"
          class="font-bold opacity-60"
          style="font-size: 0.32em"
          >{{ suffix }}</span
        >
      </p>

      <p class="mt-2 text-[length:var(--text-lede)] opacity-90">
        in <span class="font-bold">{{ to.short }}, {{ toState }}</span>
      </p>

      <!-- the same number expressed the other way (hourly ⇄ yearly) -->
      <p class="mt-1.5 text-[length:var(--text-meta)] opacity-60">
        ≈ <span class="tnum font-semibold opacity-90">{{ equivValue }}</span>
        {{ equivWord }}
        <span class="opacity-75">· {{ hoursPerWeek }} hrs/wk</span>
      </p>

      <!-- ── Delta pill ─────────────────────────────────────────── -->
      <div class="mt-5 flex items-center gap-3">
        <span
          class="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-3 py-1.5 text-[length:var(--text-meta)] font-bold uppercase"
          style="letter-spacing: 0.05em"
          :style="{
            background: cheaper
              ? 'var(--color-cheaper)'
              : 'var(--color-pricier)',
            color: 'var(--color-on-dark)',
          }"
        >
          <span aria-hidden="true">{{ cheaper ? "▼" : "▲" }}</span>
          <span class="tnum"
            >{{ money(Math.abs(result.delta)) }}{{ suffix }}</span
          >
          <span class="opacity-80">·</span>
          <span class="tnum">{{ pctText }}</span>
          <span>{{ cheaper ? "cheaper" : "pricier" }}</span>
        </span>
      </div>

      <!-- ── Atlas seal: tiny meta in the corner, shareable feel ── -->
      <div
        class="mt-6 flex items-center justify-between text-[length:var(--text-eyebrow)] uppercase opacity-65"
        style="letter-spacing: var(--text-eyebrow--letter-spacing)"
      >
        <span>Elsewhere · Parity Index</span>
        <span class="tnum">{{ fromState }} → {{ toState }}</span>
      </div>
    </div>
  </section>
</template>
