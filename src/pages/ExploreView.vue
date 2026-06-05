<script setup lang="ts">
import type { useComparison } from "../composables/useComparison";
import PlacePicker from "../components/PlacePicker.vue";
import SalaryInput from "../components/SalaryInput.vue";
import AffordList from "../components/AffordList.vue";

const props = defineProps<{ comparison: ReturnType<typeof useComparison> }>();
const c = props.comparison;

const ready = () => !!c.from.value && c.salary.value > 0;
</script>

<template>
  <section class="reveal flex flex-col px-5 pb-2 pt-4">
    <!-- intro -->
    <p
      class="text-[length:var(--text-eyebrow)] uppercase opacity-70"
      style="letter-spacing: var(--text-eyebrow--letter-spacing)"
    >
      The money question
    </p>
    <h2
      class="font-display mt-1 font-black"
      style="
        font-size: var(--text-display);
        line-height: var(--text-display--line-height);
        letter-spacing: var(--text-display--letter-spacing);
      "
    >
      Where could<br />I afford?
    </h2>
    <p class="mt-3 text-[length:var(--text-body)] opacity-80">
      Your pay, ranked across every US metro — where it stretches furthest.
    </p>

    <!-- inputs -->
    <div class="mt-6 flex flex-col gap-4">
      <PlacePicker
        label="From"
        label-text="Your city"
        :swappable="false"
        :metros="c.metros"
        :model-value="c.from.value?.id ?? null"
        @update:model-value="c.setFrom"
      />
      <SalaryInput
        :model-value="c.displaySalary.value"
        :period="c.period.value"
        :hours-per-week="c.hoursPerWeek.value"
        @update:model-value="c.setSalary"
        @update:period="c.setPeriod"
        @update:hours-per-week="c.setHoursPerWeek"
      />
    </div>

    <!-- ranked list -->
    <div class="mt-6">
      <AffordList
        v-if="ready()"
        :rows="c.affordable.value"
        :period="c.period.value"
        :hours-per-week="c.hoursPerWeek.value"
        :limit="50"
      />
      <section
        v-else
        class="px-5 py-8 text-center"
        :style="{
          borderRadius: 'var(--radius-sheet)',
          background: 'var(--color-paper)',
          border: '1px dashed var(--color-contour-ink)',
          boxShadow: 'var(--shadow-sheet)',
        }"
      >
        <p
          class="text-[length:var(--text-eyebrow)] uppercase opacity-60"
          style="letter-spacing: var(--text-eyebrow--letter-spacing)"
        >
          Two steps
        </p>
        <p class="mt-1 text-[length:var(--text-lede)] font-bold">
          Pick your city and pay to see where your money goes furthest.
        </p>
      </section>
    </div>
  </section>
</template>
