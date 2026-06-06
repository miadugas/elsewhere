<script setup lang="ts">
import { ref, computed } from "vue";
import { House, ShoppingCart, Wrench, MapPin, Flag } from "lucide-vue-next";
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
const MIN_PIN_GAP = 5; // keep the two pins visibly separate at tiny diffs
const MAX_PCT = 50; // bar scale cap (±50% from the home baseline)

// Display-only: translate the raw BEA index into a human "% more/less vs the
// From city" + a baseline-bar position. No business math — parity is untouched.
const rows = computed(() => {
  const built = (["housing", "goods", "otherServices"] as const).map((k) => {
    const fromRpp = props.from.rpp[k];
    const toRpp = props.to.rpp[k];
    const pct = Math.round((toRpp / fromRpp - 1) * 100);
    const clamped = Math.max(-MAX_PCT, Math.min(MAX_PCT, pct));
    return {
      key: k,
      label: LABELS[k],
      fromRpp: Math.round(fromRpp),
      toRpp: Math.round(toRpp),
      pct,
      cheaper: pct < 0,
      pricier: pct > 0,
      same: pct === 0,
      // 50% = home baseline; Austin sits right (pricier) or left (cheaper).
      // Floor the offset so the pins never fully stack on tiny differences.
      austinPos:
        pct === 0
          ? 50
          : 50 +
            Math.sign(pct) *
              Math.max(MIN_PIN_GAP, (Math.abs(clamped) / MAX_PCT) * 50),
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
      <!-- legend: name the pins so the bars are self-explanatory -->
      <div
        class="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 pb-1 pt-3 text-[length:var(--text-eyebrow)] uppercase opacity-75"
        style="letter-spacing: var(--text-eyebrow--letter-spacing)"
      >
        <span class="flex items-center gap-1.5">
          <MapPin
            class="h-3.5 w-3.5"
            :style="{ color: 'var(--color-route-from)' }"
            aria-hidden="true"
          />
          {{ from.short }} · where you are
        </span>
        <span class="flex items-center gap-1.5">
          <Flag
            class="h-3.5 w-3.5"
            :style="{ color: 'var(--color-route-to)' }"
            aria-hidden="true"
          />
          {{ to.short }} · where you're headed
        </span>
      </div>
      <p
        class="px-5 pb-2 text-[length:var(--text-meta)] opacity-60"
        style="letter-spacing: 0.01em"
      >
        The farther the {{ to.short }} pin sits from {{ from.short }}, the
        bigger the price gap.
      </p>

      <ul class="px-5 pb-3 pt-1">
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

          <!-- baseline route: home city is the green origin pin (center),
               the To city is the pink destination pin — gap = the cost difference -->
          <div class="relative mt-2.5 h-7" aria-hidden="true">
            <div
              class="absolute inset-x-0 top-1/2 h-px -translate-y-1/2"
              style="background: var(--color-contour-ink); opacity: 0.5"
            />
            <div
              v-if="!r.same"
              class="absolute top-1/2 h-1.5 -translate-y-1/2"
              :style="{
                left: Math.min(50, r.austinPos) + '%',
                width: Math.abs(r.austinPos - 50) + '%',
                borderRadius: 'var(--radius-pill)',
                background: r.cheaper
                  ? 'var(--color-cheaper)'
                  : 'var(--color-pricier)',
              }"
            />
            <!-- home origin pin (baseline) -->
            <MapPin
              class="pointer-events-none absolute h-4 w-4"
              style="
                left: 50%;
                top: 50%;
                color: var(--color-route-from);
                transform: translate(-50%, -86%);
              "
            />
            <!-- To destination pin -->
            <Flag
              class="pointer-events-none absolute h-4 w-4"
              :style="{
                left: r.austinPos + '%',
                top: '50%',
                color: 'var(--color-route-to)',
                transform: 'translate(-50%, -86%)',
              }"
            />
          </div>

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
        class="px-5 py-3 text-[length:var(--text-eyebrow)] uppercase opacity-70"
        style="
          letter-spacing: var(--text-eyebrow--letter-spacing);
          background: var(--color-paper-deep);
          border-top: 1px solid var(--color-contour);
        "
      >
        Real cost-of-living data · U.S. Bureau of Economic Analysis
      </p>
    </div>
  </section>
</template>
