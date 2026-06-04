<script setup lang="ts">
import { ref } from "vue";
import type { Metro } from "../types";

const props = defineProps<{ from: Metro; to: Metro }>();
const open = ref(false);

const rows = () =>
  (["housing", "goods", "otherServices"] as const).map((k) => ({
    key: k,
    label: {
      housing: "Housing",
      goods: "Goods & groceries",
      otherServices: "Services",
    }[k],
    from: props.from.rpp[k],
    to: props.to.rpp[k],
  }));
</script>

<template>
  <section class="rounded-[var(--radius-sheet)] bg-white p-5 shadow">
    <button
      @click="open = !open"
      class="flex w-full items-center justify-between text-sm font-semibold uppercase tracking-wide"
    >
      Why? Category breakdown
      <span>{{ open ? "−" : "+" }}</span>
    </button>
    <ul v-if="open" class="mt-3">
      <li
        v-for="r in rows()"
        :key="r.key"
        class="flex items-center justify-between border-b border-[var(--color-contour)] py-2 last:border-0"
      >
        <span>{{ r.label }}</span>
        <span class="text-sm">
          <span class="opacity-60">{{ from.short }} {{ r.from }}</span>
          <span class="mx-1">→</span>
          <span class="font-bold">{{ to.short }} {{ r.to }}</span>
        </span>
      </li>
    </ul>
    <p v-if="open" class="mt-2 text-xs opacity-50">
      Index where 100 = U.S. average (BEA RPP).
    </p>
  </section>
</template>
