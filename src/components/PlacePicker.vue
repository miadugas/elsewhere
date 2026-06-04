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
    <span class="text-sm uppercase tracking-wide opacity-70">{{ label }}</span>
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
      class="mt-1 w-full rounded-[var(--radius-sheet)] bg-white px-4 py-3 text-lg font-semibold shadow outline-none"
      :aria-label="label"
    />
    <ul
      v-if="open && matches.length"
      class="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-[var(--radius-sheet)] bg-white shadow-lg"
    >
      <li
        v-for="m in matches"
        :key="m.id"
        @mousedown.prevent="choose(m)"
        class="cursor-pointer px-4 py-3 hover:bg-[var(--color-contour)]"
      >
        <span class="font-semibold">{{ m.short }}</span>
        <span class="ml-1 text-sm opacity-60">{{ m.states.join(", ") }}</span>
      </li>
    </ul>
  </div>
</template>
