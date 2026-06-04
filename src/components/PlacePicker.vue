<script setup lang="ts">
import { ref, computed } from "vue";
import type { Metro } from "../types";
import { searchMetros, findMetro } from "../engines/places";

const props = defineProps<{
  label: string;
  metros: Metro[];
  modelValue: string | null;
}>();
const emit = defineEmits<{ "update:modelValue": [id: string] }>();

const query = ref("");
const open = ref(false);
const matches = computed(() => searchMetros(props.metros, query.value));
const selected = computed(() =>
  props.modelValue ? (findMetro(props.metros, props.modelValue) ?? null) : null,
);

function choose(m: Metro) {
  emit("update:modelValue", m.id);
  query.value = "";
  open.value = false;
}
</script>

<template>
  <div class="relative">
    <div class="flex items-center gap-2 pl-1">
      <!-- route pin icon — From or To -->
      <svg
        class="h-3 w-3"
        viewBox="0 0 12 12"
        fill="none"
        aria-hidden="true"
      >
        <circle
          cx="6"
          cy="6"
          r="4.5"
          :fill="label === 'From' ? 'var(--color-route)' : 'var(--color-paper)'"
          :stroke="
            label === 'From' ? 'var(--color-route)' : 'var(--color-route)'
          "
          stroke-width="1.6"
        />
      </svg>
      <span
        class="text-[length:var(--text-eyebrow)] uppercase opacity-70"
        style="letter-spacing: var(--text-eyebrow--letter-spacing)"
        >{{ label }}</span
      >
    </div>

    <div
      class="mt-1.5 flex items-center gap-3 px-4"
      :style="{
        background: 'var(--color-paper)',
        borderRadius: 'var(--radius-sheet)',
        border: '1px solid var(--color-contour)',
        boxShadow: 'var(--shadow-sheet)',
        minHeight: '56px',
      }"
    >
      <input
        :value="open ? query : (selected?.short ?? '')"
        @focus="open = true"
        @input="
          (e) => {
            query = (e.target as HTMLInputElement).value;
            open = true;
          }
        "
        :placeholder="selected ? selected.short : 'Type a city…'"
        class="w-full bg-transparent text-[length:var(--text-lede)] font-bold outline-none placeholder:font-semibold placeholder:opacity-40"
        :aria-label="label"
        autocomplete="off"
      />

      <!-- state-code badge (atlas chip) -->
      <span
        v-if="selected"
        class="tnum shrink-0 rounded-[var(--radius-chip)] px-2 py-0.5 text-[length:var(--text-eyebrow)] font-black uppercase"
        style="
          letter-spacing: var(--text-eyebrow--letter-spacing);
          background: var(--color-ink);
          color: var(--color-paper);
        "
      >
        {{ selected.states.join("·") }}
      </span>
    </div>

    <!-- Dropdown — bottom-sheet style -->
    <ul
      v-if="open && matches.length"
      class="absolute z-20 mt-2 max-h-72 w-full overflow-auto"
      :style="{
        background: 'var(--color-paper)',
        borderRadius: 'var(--radius-sheet)',
        border: '1px solid var(--color-contour)',
        boxShadow: 'var(--shadow-sheet-lifted)',
      }"
    >
      <li
        v-for="m in matches"
        :key="m.id"
        @mousedown.prevent="choose(m)"
        class="flex cursor-pointer items-center justify-between px-4 py-3 transition-colors"
        style="border-bottom: 1px solid var(--color-contour)"
        :class="'hover:bg-[var(--color-paper-deep)]'"
      >
        <div class="flex min-w-0 flex-col">
          <span class="truncate text-[length:var(--text-body)] font-bold">{{
            m.short
          }}</span>
          <span
            class="truncate text-[length:var(--text-eyebrow)] uppercase opacity-55"
            style="letter-spacing: var(--text-eyebrow--letter-spacing)"
            >{{ m.name }}</span
          >
        </div>
        <span
          class="tnum ml-3 shrink-0 rounded-[var(--radius-chip)] px-2 py-0.5 text-[length:var(--text-eyebrow)] font-black uppercase"
          style="
            letter-spacing: var(--text-eyebrow--letter-spacing);
            background: var(--color-paper-deep);
            color: var(--color-ink);
            border: 1px solid var(--color-contour);
          "
        >
          {{ m.states.join("·") }}
        </span>
      </li>
    </ul>
  </div>
</template>
