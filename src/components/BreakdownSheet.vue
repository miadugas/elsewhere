<script setup lang="ts">
import { ref, computed } from "vue";
import { House, ShoppingCart, Wrench } from "lucide-vue-next";
import type { Metro } from "../types";

const props = defineProps<{ from: Metro; to: Metro }>();
const open = ref(false);

const LABELS = {
  housing: "Housing",
  goods: "Goods & groceries",
  otherServices: "Services",
} as const;
// Module-level (non-reactive) so component refs never enter the computed rows.
const ICONS = {
  housing: House,
  goods: ShoppingCart,
  otherServices: Wrench,
} as const;
// Display-only: translate the raw BEA index into a human "% more/less vs the
// From city" + a shared-scale bar fraction. No business math — parity untouched.
const rows = computed(() => {
  const built = (["housing", "goods", "otherServices"] as const).map((k) => {
    const fromRpp = props.from.rpp[k];
    const toRpp = props.to.rpp[k];
    const pct = Math.round((toRpp / fromRpp - 1) * 100);
    return {
      key: k,
      label: LABELS[k],
      pct,
      cheaper: pct < 0,
      pricier: pct > 0,
      same: pct === 0,
    };
  });
  // the single biggest mover drives the parity number — flag it
  const driver = built.reduce((a, b) =>
    Math.abs(b.pct) > Math.abs(a.pct) ? b : a,
  );
  return built.map((r) => ({
    ...r,
    isDriver: r.key === driver.key && !r.same,
  }));
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
    <button
      @click="open = !open"
      class="flex w-full items-center justify-between px-5 py-4 text-left"
      :aria-expanded="open"
    >
      <div class="min-w-0 flex-1">
        <p class="text-[length:var(--text-lede)] font-bold leading-tight">
          Category breakdown
        </p>
        <p
          class="mt-1 text-[length:var(--text-eyebrow)] uppercase opacity-75"
          style="letter-spacing: var(--text-eyebrow--letter-spacing)"
        >
          Why your number changes
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

    <div v-if="open" style="border-top: 1px solid var(--color-contour)">
      <ul class="px-5 pb-3 pt-3">
        <li
          v-for="r in rows"
          :key="r.key"
          class="py-3"
          style="border-bottom: 1px solid var(--color-contour)"
          :class="'last:border-0'"
        >
          <!-- headline: category ……… the human takeaway -->
          <div class="flex items-baseline justify-between gap-3">
            <span class="flex items-center gap-2">
              <component
                :is="ICONS[r.key]"
                class="h-5 w-5"
                :stroke-width="2"
                aria-hidden="true"
              />
              <span class="text-[length:var(--text-body)] font-semibold">{{
                r.label
              }}</span>
            </span>
            <span
              class="shrink-0 text-[length:var(--text-lede)] font-black"
              :style="{
                color: r.same
                  ? 'var(--color-ink-soft)'
                  : r.cheaper
                    ? 'var(--color-cheaper)'
                    : 'var(--color-pricier)',
              }"
            >
              <template v-if="r.same">about the same</template>
              <template v-else
                ><span class="tnum">{{ Math.abs(r.pct) }}%</span>
                {{ r.cheaper ? "less" : "more" }}</template
              >
            </span>
          </div>

          <!-- caption: which direction, which cities -->
          <p
            v-if="!r.same"
            class="mt-0.5 text-[length:var(--text-eyebrow)] uppercase opacity-70"
            style="letter-spacing: var(--text-eyebrow--letter-spacing)"
          >
            in {{ to.short }} vs {{ from.short }}
          </p>

          <!-- plain-English driver line on the biggest mover -->
          <p
            v-if="r.isDriver"
            class="mt-1.5 text-[length:var(--text-meta)] font-semibold"
            style="color: var(--color-ink-soft)"
          >
            {{
              r.cheaper
                ? "Biggest reason your number comes down."
                : "Biggest reason your number goes up."
            }}
          </p>
        </li>
      </ul>

      <p
        class="whitespace-nowrap px-5 py-3 text-center text-[0.5rem] uppercase opacity-70"
        style="
          letter-spacing: 0.02em;
          background: var(--color-paper-deep);
          border-top: 1px solid var(--color-contour);
        "
      >
        Real cost-of-living data · U.S. Bureau of Economic Analysis · 2024
      </p>
    </div>
  </section>
</template>
