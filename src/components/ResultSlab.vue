<script setup lang="ts">
import { computed } from "vue";
import type { Metro, ParityResult } from "../types";

const props = defineProps<{ from: Metro; to: Metro; result: ParityResult }>();

const money = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
const cheaper = computed(() => props.result.delta < 0);
const pctText = computed(
  () => `${Math.abs(Math.round(props.result.pct * 100))}%`,
);
</script>

<template>
  <!-- map slot reserved for the map layer plan -->
  <section
    class="rounded-[var(--radius-sheet)] bg-[var(--color-ink)] p-6 text-[var(--color-paper)] shadow-lg"
  >
    <p class="text-sm uppercase tracking-wide opacity-70">
      To live like {{ money(result.fromSalary) }} in {{ from.short }}
    </p>
    <p class="mt-2 text-sm uppercase tracking-wide opacity-70">you'd need</p>
    <p class="mt-1 text-5xl font-extrabold leading-none">
      {{ money(result.requiredSalary) }}
    </p>
    <p class="mt-1 text-lg opacity-90">in {{ to.short }}</p>
    <p
      class="mt-4 inline-block rounded-[var(--radius-pill)] px-3 py-1 text-sm font-bold"
      :style="{
        background: cheaper ? 'var(--color-cheaper)' : 'var(--color-pricier)',
      }"
    >
      {{ cheaper ? "↓" : "↑" }} {{ money(Math.abs(result.delta)) }} ({{
        pctText
      }}
      {{ cheaper ? "cheaper" : "pricier" }})
    </p>
  </section>
</template>
