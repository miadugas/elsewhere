<script setup lang="ts">
import { useComparison } from "../composables/useComparison";
import PlacePicker from "../components/PlacePicker.vue";
import SalaryInput from "../components/SalaryInput.vue";
import ResultSlab from "../components/ResultSlab.vue";
import BasketList from "../components/BasketList.vue";
import BreakdownSheet from "../components/BreakdownSheet.vue";

const c = useComparison();
</script>

<template>
  <main class="mx-auto flex min-h-full max-w-md flex-col gap-4 p-4">
    <h1 class="text-center text-2xl font-extrabold">Elsewhere</h1>

    <ResultSlab
      v-if="c.result.value && c.from.value && c.to.value"
      :from="c.from.value"
      :to="c.to.value"
      :result="c.result.value"
    />
    <BasketList
      v-if="c.from.value && c.to.value"
      :rows="c.basket.value"
      :from="c.from.value"
      :to="c.to.value"
    />
    <BreakdownSheet
      v-if="c.from.value && c.to.value"
      :from="c.from.value"
      :to="c.to.value"
    />

    <!-- inputs live in the thumb zone -->
    <div class="mt-auto flex flex-col gap-3 pt-4">
      <PlacePicker
        label="From"
        :metros="c.metros"
        :model-value="c.from.value?.id ?? null"
        @update:model-value="c.setFrom"
      />
      <PlacePicker
        label="To"
        :metros="c.metros"
        :model-value="c.to.value?.id ?? null"
        @update:model-value="c.setTo"
      />
      <SalaryInput
        :model-value="c.salary.value"
        @update:model-value="c.setSalary"
      />
    </div>
  </main>
</template>
