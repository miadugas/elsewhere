<script setup lang="ts">
import { ref, computed } from "vue";
import type { Metro, ParityResult } from "../types";
import { formatPayFromAnnual, type PayPeriod } from "../engines/pay";

const props = defineProps<{
  from: Metro;
  to: Metro;
  result: ParityResult;
  period: PayPeriod;
  hoursPerWeek: number;
}>();

const open = ref(true);

const u = computed(() => (props.period === "hourly" ? "/hr" : ""));
const money = (n: number) =>
  formatPayFromAnnual(n, props.period, props.hoursPerWeek);

const cheaper = computed(() => props.result.delta < 0);
const same = computed(() => Math.abs(props.result.pct) < 0.005);

// display-only: how much further the same pay stretches in `to`
const stretchPct = computed(() =>
  Math.abs(
    Math.round((props.result.buyingPower / props.result.fromSalary - 1) * 100),
  ),
);
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
    <!-- header / toggle -->
    <button
      type="button"
      @click="open = !open"
      class="flex w-full items-center justify-between px-5 py-4 text-left"
      :aria-expanded="open"
    >
      <div class="min-w-0 flex-1">
        <p class="text-[length:var(--text-lede)] font-bold leading-tight">
          In plain English
        </p>
        <p
          class="mt-1 text-[length:var(--text-eyebrow)] uppercase opacity-75"
          style="letter-spacing: var(--text-eyebrow--letter-spacing)"
        >
          Your pay, translated
        </p>
      </div>

      <span
        class="flex h-9 w-9 shrink-0 items-center justify-center transition-transform"
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
    </button>

    <div
      v-if="open"
      class="px-5 pb-5 pt-1"
      style="border-top: 1px solid var(--color-contour)"
    >
      <!-- equivalent salary -->
      <p class="pt-3 text-[length:var(--text-body)] leading-relaxed">
        Making
        <span class="tnum font-bold"
          >{{ money(result.fromSalary) }}{{ u }}</span
        >
        in {{ from.short }} buys the same life you'd have making
        <span class="tnum font-bold"
          >{{ money(result.requiredSalary) }}{{ u }}</span
        >
        in {{ to.short }}.
      </p>

      <!-- money goes further / less far -->
      <p
        v-if="!same"
        class="mt-3 text-[length:var(--text-body)] leading-relaxed"
      >
        Flip it around: that same
        <span class="tnum font-bold"
          >{{ money(result.fromSalary) }}{{ u }}</span
        >
        spends like
        <span class="tnum font-bold"
          >{{ money(result.buyingPower) }}{{ u }}</span
        >
        in {{ to.short }} —<template v-if="cheaper">
          your money goes about
          <span
            class="tnum font-bold"
            :style="{ color: 'var(--color-cheaper)' }"
            >{{ stretchPct }}% further</span
          ></template
        ><template v-else>
          your money falls about
          <span
            class="tnum font-bold"
            :style="{ color: 'var(--color-pricier)' }"
            >{{ stretchPct }}% short</span
          ></template
        >.
      </p>
      <p v-else class="mt-3 text-[length:var(--text-body)] leading-relaxed">
        Costs are about the same — your money goes just as far in
        {{ to.short }}.
      </p>
    </div>
  </section>
</template>
