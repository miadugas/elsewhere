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
    <span class="text-sm uppercase tracking-wide opacity-70"
      >Your current salary</span
    >
    <div
      class="mt-1 flex items-center rounded-[var(--radius-sheet)] bg-white px-4 py-3 shadow"
    >
      <span class="text-2xl font-bold">$</span>
      <input
        :value="display()"
        @input="onInput"
        inputmode="numeric"
        placeholder="70,000"
        class="ml-1 w-full bg-transparent text-2xl font-bold outline-none"
        aria-label="Current salary in dollars"
      />
    </div>
  </label>
</template>
