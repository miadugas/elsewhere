<script setup lang="ts">
import { ref, computed } from "vue";
import { MapPin, Flag } from "lucide-vue-next";
import type { Metro } from "../types";
import { searchMetros, findMetro } from "../engines/places";

const props = defineProps<{
  label: string; // drives the pin (From = green origin, else pink)
  metros: Metro[];
  modelValue: string | null;
  labelText?: string; // override the displayed eyebrow (defaults to label)
  swappable?: boolean; // show the corner swap arrow (default true)
}>();
const emit = defineEmits<{ "update:modelValue": [id: string]; swap: [] }>();

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
      <!-- route waypoint — From (green origin pin) / To (pink destination flag) -->
      <MapPin
        v-if="label === 'From'"
        class="h-4 w-4"
        :style="{ color: 'var(--color-route-from)' }"
        aria-hidden="true"
      />
      <Flag
        v-else
        class="h-4 w-4"
        :style="{ color: 'var(--color-route-to)' }"
        aria-hidden="true"
      />
      <span
        class="font-display text-[length:var(--text-eyebrow)] font-semibold uppercase opacity-70"
        style="letter-spacing: var(--text-eyebrow--letter-spacing)"
        >{{ labelText ?? label }}</span
      >
    </div>

    <div
      class="input-pop mt-1.5 flex items-center gap-3 px-4"
      :style="{
        background: 'var(--color-paper)',
        borderRadius: 'var(--radius-sheet)',
        border: selected
          ? '1.5px solid var(--color-ink)'
          : '1.5px solid var(--color-contour-ink)',
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

      <!-- swap button — muted arrow (From points down to To, To points up) -->
      <button
        v-if="swappable !== false"
        type="button"
        @click="emit('swap')"
        class="-mr-1.5 flex h-9 w-9 shrink-0 items-center justify-center transition-colors active:scale-90"
        style="
          border-radius: var(--radius-pill);
          color: var(--color-contour-ink);
        "
        :class="'hover:bg-[var(--color-paper-deep)] hover:text-[var(--color-ink)]'"
        aria-label="Swap From and To cities"
        title="Swap From and To"
      >
        <svg class="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            :d="
              label === 'From'
                ? 'M8,3 L8,12 M4.5,8.5 L8,12 L11.5,8.5'
                : 'M8,13 L8,4 M4.5,7.5 L8,4 L11.5,7.5'
            "
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
    </div>

    <!-- Dropdown — bottom-sheet style, celestial-tinted surface -->
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
        class="city-row flex cursor-pointer items-center justify-between px-4 py-3"
      >
        <div class="flex min-w-0 flex-col">
          <span class="truncate text-[length:var(--text-body)] font-bold">{{
            m.short
          }}</span>
          <span
            class="truncate text-[length:var(--text-eyebrow)] uppercase opacity-70"
            style="letter-spacing: var(--text-eyebrow--letter-spacing)"
            >{{ m.name }}</span
          >
        </div>
        <span
          class="tnum ml-3 shrink-0 rounded-[var(--radius-chip)] px-2 py-0.5 text-[length:var(--text-eyebrow)] font-black uppercase"
          style="
            letter-spacing: var(--text-eyebrow--letter-spacing);
            background: color-mix(
              in oklch,
              var(--color-route) 15%,
              transparent
            );
            color: var(--color-route);
            border: 1px solid
              color-mix(in oklch, var(--color-route) 32%, transparent);
          "
        >
          {{ m.states.join("·") }}
        </span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
/* highlighted city row — raised paper band with a soft bevel above + below
   (square corners, full-bleed) so a selection reads as a lifted strip */
.city-row {
  position: relative;
  border-bottom: 1px solid var(--color-contour);
  transition:
    background-color 150ms ease,
    box-shadow 150ms ease,
    border-color 150ms ease,
    transform 150ms ease;
}
/* highlighted row mirrors the input's focus state exactly: rounded field,
   route border + glow ring (faked with box-shadow so there's no layout
   shift), same lift. Divider hides so the rounded corners read clean. */
.city-row:hover {
  z-index: 1;
  border-radius: var(--radius-sheet);
  border-bottom-color: transparent;
  background: var(--color-paper);
  box-shadow:
    inset 0 0 0 1.5px var(--color-route),
    0 0 0 3px color-mix(in oklch, var(--color-route) 26%, transparent),
    var(--shadow-sheet-lifted);
  transform: translateY(-1px);
}
</style>
