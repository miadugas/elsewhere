<script setup lang="ts">
import { computed, ref, type Component } from "vue";
import { Pizza, Fuel, Beer, Coffee, House } from "lucide-vue-next";
import type { BasketRow, Metro } from "../types";

const props = defineProps<{ rows: BasketRow[]; from: Metro; to: Metro }>();

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

/** Presentation-only: which Lucide icon stands in for each unicode glyph.
 *  Falls back to the native emoji if a row isn't mapped. */
const EMOJI_ICON: Record<string, Component> = {
  "🍕": Pizza,
  "⛽": Fuel,
  "🍺": Beer,
  "☕": Coffee,
  "🏠": House,
};

const open = ref(true);

/** Display-only: per-row delta % for the color cue + tiny indicator bar.
 *  No business logic — the prices come pre-computed from src/engines/basket.ts. */
const decorated = computed(() =>
  props.rows.map((r) => {
    const ratio = r.fromPrice > 0 ? r.toPrice / r.fromPrice : 1;
    const pct = Math.round((ratio - 1) * 100);
    return {
      ...r,
      pct,
      cheaper: pct < 0,
      pricier: pct > 0,
      // bar fill 0-100, centered around 0% (cap at ±40% for visual scale)
      bar: Math.max(-40, Math.min(40, pct)),
    };
  }),
);

/** Display-only aggregate for the collapsed summary chip.
 *  green = avg basket cheaper · red = pricier · water-blue = within ±3% */
const SAME_TOLERANCE = 3;
const summary = computed(() => {
  const rows = decorated.value;
  if (!rows.length) return null;
  const avgPct = Math.round(
    rows.reduce((sum, r) => sum + r.pct, 0) / rows.length,
  );
  const kind: "cheaper" | "pricier" | "similar" =
    avgPct <= -SAME_TOLERANCE
      ? "cheaper"
      : avgPct >= SAME_TOLERANCE
        ? "pricier"
        : "similar";
  const color =
    kind === "cheaper"
      ? "var(--color-cheaper)"
      : kind === "pricier"
        ? "var(--color-pricier)"
        : "var(--color-water)";
  const glyph = kind === "cheaper" ? "▼" : kind === "pricier" ? "▲" : "≈";
  const word =
    kind === "cheaper" ? "cheaper" : kind === "pricier" ? "pricier" : "similar";
  return { avgPct, kind, color, glyph, word };
});
</script>

<template>
  <section
    class="overflow-hidden"
    :style="{
      borderRadius: 'var(--radius-sheet)',
      background: 'var(--color-paper)',
      boxShadow: 'var(--shadow-sheet)',
      border: '1px solid var(--color-contour)',
    }"
  >
    <!-- ── Header (also the collapse toggle) ──────────────────── -->
    <button
      type="button"
      @click="open = !open"
      class="flex w-full items-center justify-between px-5 pb-4 pt-5 text-left"
      :style="{
        borderBottom: open ? '1px solid var(--color-contour)' : 'none',
      }"
      :aria-expanded="open"
      aria-controls="basket-rows"
    >
      <div class="min-w-0 flex-1">
        <h2
          class="text-[length:var(--text-numeric)] font-black leading-none tracking-tight"
        >
          The Basket
        </h2>
        <p
          class="mt-1.5 text-[length:var(--text-eyebrow)] whitespace-nowrap uppercase opacity-75"
          style="letter-spacing: var(--text-eyebrow--letter-spacing)"
        >
          Same item · Two cities
        </p>
      </div>

      <div class="flex shrink-0 items-center gap-2">
        <!-- Avg basket delta — compact + color-coded, shown in BOTH states
             so the header layout is identical open vs collapsed. -->
        <span
          v-if="summary"
          class="tnum flex items-center gap-1 rounded-[var(--radius-pill)] px-2.5 py-1 text-[length:var(--text-eyebrow)] font-black uppercase"
          style="letter-spacing: var(--text-eyebrow--letter-spacing)"
          :style="{
            background: summary.color,
            color: 'var(--color-on-dark)',
          }"
          :aria-label="`Basket is on average ${Math.abs(summary.avgPct)}% ${summary.word} in ${to.short}`"
        >
          <span aria-hidden="true">{{ summary.glyph }}</span>
          <span>{{ Math.abs(summary.avgPct) }}%</span>
        </span>

        <!-- chevron pill -->
        <span
          class="flex h-9 w-9 items-center justify-center transition-transform"
          :style="{
            borderRadius: 'var(--radius-pill)',
            background: 'var(--color-paper-deep)',
            border: '1px solid var(--color-contour)',
            transform: open ? 'rotate(180deg)' : 'rotate(0)',
          }"
          aria-hidden="true"
        >
          <svg class="h-3 w-3" viewBox="0 0 12 12" fill="none">
            <path
              d="M2,4 L6,8 L10,4"
              stroke="var(--color-ink)"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </span>
      </div>
    </button>

    <!-- ── Rows ───────────────────────────────────────────────── -->
    <ul v-if="open" id="basket-rows">
      <li
        v-for="r in decorated"
        :key="r.id"
        class="grid items-center gap-3 px-5 py-3.5"
        style="
          grid-template-columns: auto 1fr auto;
          border-bottom: 1px solid var(--color-contour);
        "
      >
        <!-- icon medallion (Lucide line icon; native glyph fallback) -->
        <span
          class="flex h-10 w-10 items-center justify-center text-xl"
          :style="{
            borderRadius: 'var(--radius-pill)',
            background: 'var(--color-paper-deep)',
            border: '1px solid var(--color-contour)',
          }"
        >
          <component
            :is="EMOJI_ICON[r.emoji]"
            v-if="EMOJI_ICON[r.emoji]"
            class="h-6 w-6"
            :stroke-width="2"
            :aria-label="r.label"
          />
          <template v-else>{{ r.emoji }}</template>
        </span>

        <!-- label + tiny diff scale -->
        <div class="min-w-0">
          <p class="truncate text-[length:var(--text-body)] font-semibold">
            {{ r.label }}
          </p>
          <div
            class="mt-1.5 flex items-center gap-2 text-[length:var(--text-eyebrow)] uppercase"
            style="letter-spacing: var(--text-eyebrow--letter-spacing)"
          >
            <span class="opacity-75">{{ from.short }}</span>
            <span class="tnum opacity-80">{{ money(r.fromPrice) }}</span>
            <span v-if="r.note" class="opacity-60">· {{ r.note }}</span>
          </div>
        </div>

        <!-- TO price — big, with delta -->
        <div class="text-right">
          <p
            class="tnum text-[length:var(--text-numeric)] font-black leading-none"
            :style="{
              color: r.cheaper
                ? 'var(--color-cheaper)'
                : r.pricier
                  ? 'var(--color-pricier)'
                  : 'var(--color-ink)',
            }"
          >
            {{ money(r.toPrice) }}
          </p>
          <p
            v-if="r.pct !== 0"
            class="mt-1 flex items-center justify-end gap-1 text-[length:var(--text-eyebrow)] font-bold uppercase opacity-70"
            style="letter-spacing: var(--text-eyebrow--letter-spacing)"
            :aria-label="`${Math.abs(r.pct)}% ${r.cheaper ? 'less' : 'more'} in ${to.short}`"
          >
            <span aria-hidden="true">{{ r.cheaper ? "▼" : "▲" }}</span>
            <span class="tnum">{{ Math.abs(r.pct) }}%</span>
            {{ r.cheaper ? "less" : "more" }}
          </p>
          <p
            v-else
            class="text-[length:var(--text-eyebrow)] uppercase opacity-70"
            style="letter-spacing: var(--text-eyebrow--letter-spacing)"
          >
            same
          </p>
        </div>
      </li>
    </ul>

    <!-- ── Footer note ────────────────────────────────────────── -->
    <p
      v-if="open"
      class="whitespace-nowrap px-5 py-3 text-center text-[0.5rem] uppercase opacity-70"
      style="letter-spacing: 0.02em; background: var(--color-paper-deep)"
    >
      Localized via regional price parity · National avg = 100 · Rent data ©
      Zillow
    </p>
  </section>
</template>
