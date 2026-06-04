<script setup lang="ts">
import { ref, computed } from "vue";
import type { Metro } from "../types";

const props = defineProps<{ from: Metro; to: Metro }>();
const open = ref(false);

const rows = computed(() =>
  (["housing", "goods", "otherServices"] as const).map((k) => {
    const fromRpp = props.from.rpp[k];
    const toRpp = props.to.rpp[k];
    const diff = toRpp - fromRpp;
    return {
      key: k,
      label: {
        housing: "Housing",
        goods: "Goods & groceries",
        otherServices: "Services",
      }[k],
      icon: { housing: "🏠", goods: "🛒", otherServices: "🛠️" }[k],
      from: fromRpp,
      to: toRpp,
      diff,
      cheaper: diff < 0,
      pricier: diff > 0,
      // 0-100 bar position relative to a 70–130 range, clamped
      barFromPos: Math.max(0, Math.min(100, ((fromRpp - 70) / 60) * 100)),
      barToPos: Math.max(0, Math.min(100, ((toRpp - 70) / 60) * 100)),
    };
  }),
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
    <button
      @click="open = !open"
      class="flex w-full items-center justify-between px-5 py-4 text-left"
      :aria-expanded="open"
    >
      <div>
        <p
          class="text-[length:var(--text-eyebrow)] uppercase opacity-60"
          style="letter-spacing: var(--text-eyebrow--letter-spacing)"
        >
          Why? · BEA RPP
        </p>
        <p class="mt-0.5 text-[length:var(--text-lede)] font-bold">
          Category breakdown
        </p>
      </div>

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
        <svg
          class="h-3 w-3"
          viewBox="0 0 12 12"
          fill="none"
        >
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

    <div v-if="open" style="border-top: 1px solid var(--color-contour)">
      <ul class="px-5 pb-3 pt-2">
        <li
          v-for="r in rows"
          :key="r.key"
          class="py-3"
          style="border-bottom: 1px solid var(--color-contour)"
          :class="'last:border-0'"
        >
          <!-- label + diff -->
          <div class="flex items-center justify-between">
            <span class="flex items-center gap-2">
              <span class="text-base" aria-hidden="true">{{ r.icon }}</span>
              <span class="text-[length:var(--text-body)] font-semibold">{{
                r.label
              }}</span>
            </span>
            <span
              class="tnum text-[length:var(--text-eyebrow)] font-black uppercase"
              style="letter-spacing: var(--text-eyebrow--letter-spacing)"
              :style="{
                color: r.cheaper
                  ? 'var(--color-cheaper)'
                  : r.pricier
                    ? 'var(--color-pricier)'
                    : 'var(--color-ink)',
              }"
            >
              {{ r.cheaper ? "▼" : r.pricier ? "▲" : "·" }}
              {{ Math.abs(Math.round(r.diff)) }} pts
            </span>
          </div>

          <!-- index scale: 70 ────●────────●──── 130 -->
          <div class="relative mt-3 h-7">
            <!-- the axis -->
            <div
              class="absolute inset-x-0 top-3 h-px"
              style="background: var(--color-contour-ink); opacity: 0.5"
            />
            <!-- center tick (national avg = 100) -->
            <div
              class="absolute top-2 h-3 w-px"
              style="left: 50%; background: var(--color-contour-ink)"
              aria-hidden="true"
            />
            <!-- FROM marker -->
            <span
              class="absolute -translate-x-1/2"
              :style="{
                left: r.barFromPos + '%',
                top: '6px',
              }"
              aria-hidden="true"
            >
              <span
                class="block h-3 w-3"
                :style="{
                  borderRadius: 'var(--radius-pill)',
                  background: 'var(--color-paper)',
                  border: '2px solid var(--color-ink)',
                }"
              />
            </span>
            <!-- TO marker -->
            <span
              class="absolute -translate-x-1/2"
              :style="{
                left: r.barToPos + '%',
                top: '6px',
              }"
              aria-hidden="true"
            >
              <span
                class="block h-3 w-3"
                :style="{
                  borderRadius: 'var(--radius-pill)',
                  background: 'var(--color-route)',
                  border: '2px solid var(--color-ink)',
                }"
              />
            </span>
            <!-- scale labels -->
            <span
              class="absolute left-0 top-5 text-[length:var(--text-eyebrow)] opacity-50"
              style="letter-spacing: var(--text-eyebrow--letter-spacing)"
              >70</span
            >
            <span
              class="absolute right-0 top-5 text-[length:var(--text-eyebrow)] opacity-50"
              style="letter-spacing: var(--text-eyebrow--letter-spacing)"
              >130</span
            >
          </div>

          <!-- explicit indices -->
          <div
            class="mt-1 flex items-center justify-between text-[length:var(--text-eyebrow)] uppercase opacity-70"
            style="letter-spacing: var(--text-eyebrow--letter-spacing)"
          >
            <span class="tnum"
              >{{ from.short }} · <b>{{ r.from }}</b></span
            >
            <span class="tnum"
              >{{ to.short }} ·
              <b style="color: var(--color-route)">{{ r.to }}</b></span
            >
          </div>
        </li>
      </ul>

      <p
        class="px-5 py-3 text-[length:var(--text-eyebrow)] uppercase opacity-55"
        style="
          letter-spacing: var(--text-eyebrow--letter-spacing);
          background: var(--color-paper-deep);
          border-top: 1px solid var(--color-contour);
        "
      >
        Index · 100 = U.S. average · Source BEA RPP
      </p>
    </div>
  </section>
</template>
