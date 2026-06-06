<script setup lang="ts">
import { computed } from "vue";
import type { AffordRow } from "../engines/explore";
import { formatPayFromAnnual, type PayPeriod } from "../engines/pay";
import { metroBadges } from "../engines/filters";

const props = defineProps<{
  rows: AffordRow[];
  period: PayPeriod;
  hoursPerWeek: number;
  limit?: number;
}>();

const u = computed(() => (props.period === "hourly" ? "/hr" : ""));
const money = (n: number) =>
  formatPayFromAnnual(n, props.period, props.hoursPerWeek);
const shown = computed(() => props.rows.slice(0, props.limit ?? 40));
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
    <ul id="afford-rows">
      <li
        v-for="(row, i) in shown"
        :key="row.metro.id"
        class="grid items-center gap-3 px-5 py-3"
        style="
          grid-template-columns: auto 1fr auto;
          border-bottom: 1px solid var(--color-contour);
        "
      >
        <!-- rank -->
        <span
          class="tnum flex h-6 w-6 items-center justify-center text-[length:var(--text-eyebrow)] font-black"
          :style="{
            borderRadius: 'var(--radius-pill)',
            background: 'var(--color-paper-deep)',
            color: 'var(--color-ink-soft)',
            border: '1px solid var(--color-contour)',
          }"
          >{{ i + 1 }}</span
        >

        <!-- metro -->
        <div class="min-w-0">
          <p class="truncate text-[length:var(--text-body)] font-semibold">
            {{ row.metro.short }}
          </p>
          <p
            class="truncate text-[length:var(--text-eyebrow)] uppercase opacity-70"
            style="letter-spacing: var(--text-eyebrow--letter-spacing)"
          >
            {{ row.metro.states.join("·") }}
          </p>
          <p
            v-if="metroBadges(row.metro).length"
            class="mt-0.5 flex flex-wrap gap-x-1.5 gap-y-0.5 text-[length:var(--text-eyebrow)] opacity-70"
          >
            <span
              v-for="b in metroBadges(row.metro)"
              :key="b.text"
              class="whitespace-nowrap"
            >
              {{ b.emoji }} {{ b.text }}
            </span>
          </p>
        </div>

        <!-- you'd need + delta -->
        <div class="text-right">
          <p
            class="tnum text-[length:var(--text-body)] font-black leading-none"
            :style="{
              color:
                row.result.delta < 0
                  ? 'var(--color-cheaper)'
                  : row.result.delta > 0
                    ? 'var(--color-pricier)'
                    : 'var(--color-ink)',
            }"
          >
            {{ money(row.result.requiredSalary) }}{{ u }}
          </p>
          <p
            v-if="row.result.delta !== 0"
            class="tnum mt-0.5 text-[length:var(--text-eyebrow)] font-bold uppercase opacity-70"
            style="letter-spacing: var(--text-eyebrow--letter-spacing)"
          >
            {{ row.result.delta < 0 ? "▼" : "▲"
            }}{{ Math.abs(Math.round(row.result.pct * 100)) }}%
          </p>
        </div>
      </li>
    </ul>

    <p
      class="px-5 py-3 text-[length:var(--text-eyebrow)] uppercase opacity-60"
      style="
        letter-spacing: var(--text-eyebrow--letter-spacing);
        background: var(--color-paper-deep);
      "
    >
      Showing {{ shown.length }} of {{ rows.length }} metros · what you'd need
      to keep the same life
    </p>
  </section>
</template>
