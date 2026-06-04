<script setup lang="ts">
const props = defineProps<{ modelValue: number }>();
const emit = defineEmits<{ "update:modelValue": [n: number] }>();

function onInput(e: Event) {
  const raw = (e.target as HTMLInputElement).value.replace(/[^0-9]/g, "");
  emit("update:modelValue", raw ? Number(raw) : 0);
}

const display = () =>
  props.modelValue > 0 ? props.modelValue.toLocaleString("en-US") : "";
</script>

<template>
  <label class="block">
    <div class="flex items-center gap-2 pl-1">
      <svg class="h-3 w-3" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <rect
          x="1.5"
          y="1.5"
          width="9"
          height="9"
          rx="2"
          stroke="var(--color-route)"
          stroke-width="1.6"
        />
      </svg>
      <span
        class="text-[length:var(--text-eyebrow)] uppercase opacity-70"
        style="letter-spacing: var(--text-eyebrow--letter-spacing)"
        >Your current salary</span
      >
    </div>

    <div
      class="input-pop mt-1.5 flex items-center gap-2 px-4"
      :style="{
        background: 'var(--color-surface-dark)',
        color: 'var(--color-on-dark)',
        borderRadius: 'var(--radius-sheet)',
        border: '1.5px solid transparent',
        boxShadow: 'var(--shadow-sheet-lifted)',
        minHeight: '60px',
      }"
    >
      <span
        class="tnum text-[length:var(--text-numeric)] font-black opacity-60"
        aria-hidden="true"
        >$</span
      >
      <input
        :value="display()"
        @input="onInput"
        inputmode="numeric"
        placeholder="70,000"
        class="tnum w-full bg-transparent text-[length:var(--text-numeric)] font-black tracking-tight text-[var(--color-on-dark)] outline-none placeholder:opacity-40"
        aria-label="Current salary in dollars"
      />
      <span
        class="text-[length:var(--text-eyebrow)] font-bold uppercase opacity-60"
        style="letter-spacing: var(--text-eyebrow--letter-spacing)"
        >/ yr</span
      >
    </div>
  </label>
</template>
