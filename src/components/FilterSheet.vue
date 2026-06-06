<script setup lang="ts">
import { ref } from "vue";
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
      <span
        class="flex items-center gap-2 text-[length:var(--text-lede)] font-bold"
      >
        ⚙ Filters
        <span
          v-if="activeCount > 0"
          class="tnum flex h-6 min-w-6 items-center justify-center px-1.5 text-[length:var(--text-eyebrow)] font-black"
          :style="{
            borderRadius: 'var(--radius-pill)',
            background: 'var(--color-accent, var(--color-paper-deep))',
            color: '#fff',
          }"
          >{{ activeCount }}</span
        >
      </span>

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
      <ul class="px-5 pb-2 pt-3">
        <li
          v-for="f in props.filters"
          :key="f.id"
          class="py-3"
          style="border-bottom: 1px solid var(--color-contour)"
          :class="'last:border-0'"
        >
          <p class="mb-2 text-[length:var(--text-body)] font-semibold">
            {{ f.emoji }} {{ f.label }}
          </p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="b in f.bands"
              :key="b.id"
              @click="emit('set-band', f.id, b.id)"
              class="px-3 py-1.5 text-[length:var(--text-eyebrow)] font-bold"
              :style="{
                borderRadius: 'var(--radius-pill)',
                border: '1px solid var(--color-contour)',
                background:
                  active[f.id] === b.id
                    ? 'var(--color-accent, var(--color-ink))'
                    : 'var(--color-paper-deep)',
                color: active[f.id] === b.id ? '#fff' : 'var(--color-ink)',
              }"
            >
              {{ b.label }}
            </button>
          </div>
        </li>
      </ul>

      <button
        @click="emit('clear')"
        class="w-full px-5 py-3 text-center text-[length:var(--text-eyebrow)] font-bold uppercase opacity-75"
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
