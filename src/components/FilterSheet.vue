<script setup lang="ts">
import { ref, type Component } from "vue";
import {
  Droplets,
  ShieldAlert,
  SlidersHorizontal,
  Thermometer,
  Vote,
  Wind,
} from "lucide-vue-next";
import { FILTERS, type ActiveBands, type FilterDef } from "../engines/filters";

const props = withDefaults(
  defineProps<{
    active: ActiveBands;
    activeCount: number;
    filters?: FilterDef[];
  }>(),
  { filters: () => FILTERS },
);
const emit = defineEmits<{
  "set-band": [filterId: string, bandId: string];
  clear: [];
}>();

const open = ref(false);

/** Presentation-only: Lucide stand-ins for the filter emoji (same pattern as
 *  BasketList). Falls back to the native glyph if a filter isn't mapped. */
const EMOJI_ICON: Record<string, Component> = {
  "🗳️": Vote,
  "🌡️": Thermometer,
  "💧": Droplets,
  "🌫️": Wind,
  "🌪️": ShieldAlert,
};
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
    <!-- ── Header (also the collapse toggle) ──────────────────── -->
    <button
      type="button"
      @click="open = !open"
      class="flex w-full items-center justify-between px-5 pb-4 pt-5 text-left"
      :style="{
        borderBottom: open ? '1px solid var(--color-contour)' : 'none',
      }"
      :aria-expanded="open"
      aria-controls="filter-rows"
    >
      <div class="min-w-0 flex-1">
        <h2
          class="flex items-center gap-2 text-[length:var(--text-numeric)] font-black leading-none tracking-tight"
        >
          <SlidersHorizontal
            class="h-5 w-5"
            :stroke-width="2.25"
            aria-hidden="true"
          />
          Filters
        </h2>
        <p
          class="mt-1.5 text-[length:var(--text-eyebrow)] whitespace-nowrap uppercase opacity-75"
          style="letter-spacing: var(--text-eyebrow--letter-spacing)"
        >
          Narrow the field
        </p>
      </div>

      <div class="flex shrink-0 items-center gap-2">
        <span
          v-if="activeCount > 0"
          class="tnum flex h-6 min-w-6 items-center justify-center px-1.5 text-[length:var(--text-eyebrow)] font-black"
          :style="{
            borderRadius: 'var(--radius-pill)',
            background: 'var(--color-route)',
            color: 'var(--color-on-dark)',
          }"
          :aria-label="`${activeCount} active ${activeCount === 1 ? 'filter' : 'filters'}`"
          >{{ activeCount }}</span
        >

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
      </div>
    </button>

    <div v-if="open" id="filter-rows">
      <ul class="px-5 pb-2 pt-3">
        <li
          v-for="f in props.filters"
          :key="f.id"
          class="py-3.5"
          style="border-bottom: 1px solid var(--color-contour)"
          :class="'last:border-0'"
        >
          <p
            class="mb-2.5 flex items-center gap-2 text-[length:var(--text-body)] font-semibold"
          >
            <component
              :is="EMOJI_ICON[f.emoji]"
              v-if="EMOJI_ICON[f.emoji]"
              class="h-4 w-4 opacity-70"
              :stroke-width="2"
              aria-hidden="true"
            />
            <template v-else>{{ f.emoji }}</template>
            {{ f.label }}
          </p>
          <div class="flex flex-wrap gap-2" role="group" :aria-label="f.label">
            <button
              v-for="b in f.bands"
              :key="b.id"
              type="button"
              @click="emit('set-band', f.id, b.id)"
              class="whitespace-nowrap px-3.5 py-2 text-[length:var(--text-eyebrow)] font-bold transition-colors duration-150"
              :style="{
                borderRadius: 'var(--radius-pill)',
                border:
                  active[f.id] === b.id
                    ? '1px solid var(--color-route)'
                    : '1px solid var(--color-contour)',
                background:
                  active[f.id] === b.id
                    ? 'var(--color-route)'
                    : 'var(--color-paper-deep)',
                color:
                  active[f.id] === b.id
                    ? 'var(--color-on-dark)'
                    : 'var(--color-ink)',
              }"
              :aria-pressed="active[f.id] === b.id"
            >
              {{ b.label }}
            </button>
          </div>
        </li>
      </ul>

      <button
        v-if="activeCount > 0"
        type="button"
        @click="emit('clear')"
        class="w-full px-5 py-3 text-center text-[length:var(--text-eyebrow)] font-bold uppercase opacity-75 transition-opacity hover:opacity-100"
        style="
          letter-spacing: var(--text-eyebrow--letter-spacing);
          background: var(--color-paper-deep);
          border-top: 1px solid var(--color-contour);
        "
      >
        Clear all
      </button>
    </div>
  </section>
</template>
