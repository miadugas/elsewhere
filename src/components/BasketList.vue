<script setup lang="ts">
import type { BasketRow, Metro } from "../types";

defineProps<{ rows: BasketRow[]; from: Metro; to: Metro }>();

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });
</script>

<template>
  <section class="rounded-[var(--radius-sheet)] bg-white p-5 shadow">
    <h2 class="text-sm uppercase tracking-wide opacity-70">The Basket</h2>
    <p class="mb-3 text-xs opacity-50">Estimated from regional price parity</p>
    <ul>
      <li
        v-for="r in rows"
        :key="r.id"
        class="flex items-center justify-between border-b border-[var(--color-contour)] py-2 last:border-0"
      >
        <span class="flex items-center gap-2"
          ><span class="text-xl">{{ r.emoji }}</span
          >{{ r.label }}</span
        >
        <span class="text-right text-sm">
          <span class="opacity-60"
            >{{ from.short }} {{ money(r.fromPrice) }}</span
          >
          <span class="mx-1">→</span>
          <span class="font-bold">{{ to.short }} {{ money(r.toPrice) }}</span>
        </span>
      </li>
    </ul>
  </section>
</template>
