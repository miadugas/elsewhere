<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { Wallet } from "lucide-vue-next";
import type { PayPeriod } from "../engines/pay";

const props = defineProps<{
  modelValue: number; // amount in the CURRENT period (annual $ or hourly $/hr)
  period: PayPeriod;
  hoursPerWeek: number;
}>();
const emit = defineEmits<{
  "update:modelValue": [n: number];
  "update:period": [p: PayPeriod];
  "update:hoursPerWeek": [h: number];
}>();

const PERIODS: { id: PayPeriod; label: string }[] = [
  { id: "annual", label: "Annual" },
  { id: "hourly", label: "Hourly" },
];

// Local editable string so decimals type smoothly (trailing dot, etc.).
const raw = ref("");
const editing = ref(false);

function fmt(n: number): string {
  if (n <= 0) return "";
  return props.period === "hourly"
    ? String(Math.round(n * 100) / 100)
    : Math.round(n).toLocaleString("en-US");
}
watch(
  () => [props.modelValue, props.period, props.hoursPerWeek],
  () => {
    if (!editing.value) raw.value = fmt(props.modelValue);
  },
  { immediate: true },
);

function onInput(e: Event) {
  const v = (e.target as HTMLInputElement).value;
  if (props.period === "hourly") {
    // digits + a single decimal point
    const cleaned = v.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
    raw.value = cleaned;
    emit("update:modelValue", cleaned ? Number(cleaned) : 0);
  } else {
    const digits = v.replace(/[^0-9]/g, "");
    raw.value = digits ? Number(digits).toLocaleString("en-US") : "";
    emit("update:modelValue", digits ? Number(digits) : 0);
  }
}

function onHours(e: Event) {
  const h = Number((e.target as HTMLInputElement).value.replace(/[^0-9]/g, ""));
  emit("update:hoursPerWeek", h > 0 ? Math.min(h, 168) : 0);
}

const placeholder = computed(() =>
  props.period === "hourly" ? "34.00" : "70,000",
);
const suffix = computed(() => (props.period === "hourly" ? "/ hr" : "/ yr"));
</script>

<template>
  <div class="block">
    <!-- label + Annual/Hourly toggle -->
    <div class="flex items-center justify-between pl-1">
      <div class="flex items-center gap-2">
        <Wallet
          class="h-4 w-4 opacity-70"
          :stroke-width="2"
          aria-hidden="true"
        />
        <span
          class="font-display whitespace-nowrap text-[length:var(--text-eyebrow)] font-semibold uppercase opacity-70"
          style="letter-spacing: var(--text-eyebrow--letter-spacing)"
          >Your current pay</span
        >
      </div>

      <div
        class="period-toggle relative flex items-center p-1"
        :class="{ 'is-hourly': period === 'hourly' }"
        role="group"
        aria-label="Pay period"
        :style="{
          borderRadius: 'var(--radius-pill)',
          background: 'var(--slider-track)',
          border:
            '1px solid color-mix(in oklch, var(--color-on-dark) 14%, transparent)',
          boxShadow:
            'inset 0 1px 3px rgba(0, 0, 0, 0.18), inset 0 0 0 1px rgba(255, 255, 255, 0.18)',
        }"
      >
        <!-- sliding thumb — moves between Annual / Hourly like the theme switch -->
        <span class="period-thumb" aria-hidden="true" />
        <button
          v-for="opt in PERIODS"
          :key="opt.id"
          type="button"
          @click="opt.id !== period && emit('update:period', opt.id)"
          :aria-pressed="period === opt.id"
          class="font-display relative z-10 flex-1 px-3 py-1 text-center text-[length:var(--text-eyebrow)] font-bold uppercase"
          :style="{
            letterSpacing: 'var(--text-eyebrow--letter-spacing)',
            color:
              period === opt.id
                ? 'var(--color-surface-dark)'
                : 'var(--slider-muted)',
            opacity: 1,
            transition:
              period === opt.id
                ? 'color 160ms ease 200ms, opacity 160ms ease 200ms'
                : 'color 160ms ease 0ms, opacity 160ms ease 0ms',
          }"
        >
          {{ opt.label }}
        </button>
      </div>
    </div>

    <!-- the pay input — matches the From/To city pickers -->
    <div
      class="input-pop mt-1.5 flex items-center gap-2 px-4"
      :style="{
        background: 'var(--color-paper)',
        color: 'var(--color-ink)',
        borderRadius: 'var(--radius-sheet)',
        border: '1.5px solid var(--color-contour-ink)',
        boxShadow: 'var(--shadow-sheet)',
        minHeight: '56px',
      }"
    >
      <span
        class="tnum text-[length:var(--text-numeric)] font-black"
        style="color: var(--color-ink-soft)"
        aria-hidden="true"
        >$</span
      >
      <input
        :value="raw"
        @input="onInput"
        @focus="editing = true"
        @blur="
          editing = false;
          raw = fmt(props.modelValue);
        "
        :inputmode="period === 'hourly' ? 'decimal' : 'numeric'"
        :placeholder="placeholder"
        class="tnum min-w-0 flex-1 bg-transparent text-[length:var(--text-numeric)] font-black tracking-tight text-[var(--color-ink)] outline-none placeholder:opacity-40"
        :aria-label="
          period === 'hourly'
            ? 'Current hourly pay in dollars'
            : 'Current annual salary in dollars'
        "
      />

      <!-- hourly: hours/week lives INSIDE the field, using the dead space -->
      <label
        v-if="period === 'hourly'"
        class="flex shrink-0 items-center gap-1.5"
        title="Hours worked per week"
      >
        <input
          :value="hoursPerWeek || ''"
          @input="onHours"
          inputmode="numeric"
          placeholder="40"
          aria-label="Hours per week"
          class="tnum hrs-chip w-9 bg-transparent py-0.5 text-center text-[length:var(--text-meta)] font-bold text-[var(--color-ink)] outline-none"
          :class="{ 'hrs-chip--callout': editing }"
          style="border-radius: var(--radius-chip)"
        />
        <span
          class="font-display text-[length:var(--text-eyebrow)] font-semibold uppercase transition-opacity"
          style="letter-spacing: var(--text-eyebrow--letter-spacing)"
          :style="{ opacity: editing ? 0.9 : 0.5 }"
          >hrs/wk</span
        >
      </label>

      <span
        class="font-display shrink-0 text-[length:var(--text-eyebrow)] font-bold uppercase opacity-70"
        style="letter-spacing: var(--text-eyebrow--letter-spacing)"
        >{{ suffix }}</span
      >
    </div>
  </div>
</template>

<style scoped>
/* Annual/Hourly sliding thumb — slides between the two like the theme switch.
   Buttons are equal-width (flex-1), so the thumb is one half and translates
   100% of its own width to land under the other option. */
.period-thumb {
  position: absolute;
  top: 4px;
  bottom: 4px;
  left: 4px;
  z-index: 0;
  width: calc(50% - 4px);
  border-radius: var(--radius-pill);
  background: var(--slider-thumb);
  /* same lift as the theme-switch sun knob: drop shadow + a warm glow */
  box-shadow:
    0 2px 5px rgba(0, 0, 0, 0.3),
    0 0 10px 1px var(--slider-thumb-glow);
  transform: translateX(0);
  transition: transform 360ms cubic-bezier(0.34, 1.35, 0.5, 1);
}
.period-toggle.is-hourly .period-thumb {
  transform: translateX(100%);
}
@media (prefers-reduced-motion: reduce) {
  .period-thumb {
    transition: none;
  }
}

/* hours/week chip — quiet by default, called out while the rate is focused */
.hrs-chip {
  border: 1px solid color-mix(in oklch, var(--color-ink) 22%, transparent);
  background: color-mix(in oklch, var(--color-ink) 6%, transparent);
  transition:
    border-color 160ms ease,
    background 160ms ease,
    box-shadow 160ms ease;
}
.hrs-chip--callout {
  border-color: var(--color-route);
  background: color-mix(in oklch, var(--color-route) 18%, transparent);
  animation: hrs-pulse 1.6s ease-out infinite;
}
@keyframes hrs-pulse {
  0% {
    box-shadow: 0 0 0 0 color-mix(in oklch, var(--color-route) 45%, transparent);
  }
  70%,
  100% {
    box-shadow: 0 0 0 6px
      color-mix(in oklch, var(--color-route) 0%, transparent);
  }
}
@media (prefers-reduced-motion: reduce) {
  .hrs-chip--callout {
    animation: none;
    box-shadow: 0 0 0 3px
      color-mix(in oklch, var(--color-route) 30%, transparent);
  }
}
</style>
