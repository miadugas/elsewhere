import { ref, computed } from "vue";
import metrosData from "../data/metros.json";
import basketData from "../data/basket.json";
import type { Metro, BasketItem, ParityResult, BasketRow } from "../types";
import { findMetro } from "../engines/places";
import { requiredSalary } from "../engines/parity";
import { localizeBasket } from "../engines/basket";

const metros = metrosData as Metro[];
const basketItems = basketData as BasketItem[];

export function useComparison() {
  const fromId = ref<string | null>(null);
  const toId = ref<string | null>(null);
  const salary = ref(0);

  const from = computed(() =>
    fromId.value ? (findMetro(metros, fromId.value) ?? null) : null,
  );
  const to = computed(() =>
    toId.value ? (findMetro(metros, toId.value) ?? null) : null,
  );

  const result = computed<ParityResult | null>(() => {
    if (!from.value || !to.value || salary.value <= 0) return null;
    return requiredSalary(from.value, to.value, salary.value);
  });

  const basket = computed<BasketRow[]>(() => {
    if (!from.value || !to.value) return [];
    return localizeBasket(from.value, to.value, basketItems);
  });

  return {
    metros,
    from,
    to,
    salary,
    result,
    basket,
    setFrom: (id: string) => (fromId.value = id),
    setTo: (id: string) => (toId.value = id),
    setSalary: (n: number) => (salary.value = n),
  };
}
