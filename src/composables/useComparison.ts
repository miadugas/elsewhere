import { ref, computed } from "vue";
import metrosData from "../data/metros.json";
import basketData from "../data/basket.json";
import type { Metro, BasketItem, ParityResult, BasketRow } from "../types";
import { findMetro } from "../engines/places";
import { requiredSalary } from "../engines/parity";
import { rankByAffordability, type AffordRow } from "../engines/explore";
import { applyFilters, type ActiveBands } from "../engines/filters";
import { localizeBasket } from "../engines/basket";
import {
  annualFromHourly,
  hourlyFromAnnual,
  type PayPeriod,
} from "../engines/pay";

const metros = metrosData as Metro[];
const basketItems = basketData as BasketItem[];

export function useComparison() {
  const fromId = ref<string | null>(null);
  const toId = ref<string | null>(null);
  // `salary` is the canonical ANNUAL figure the parity math runs on.
  // `period` + `hoursPerWeek` are the input/display lens only.
  const salary = ref(0);
  const period = ref<PayPeriod>("annual");
  const hoursPerWeek = ref(40);

  // The salary expressed in the currently selected period (for the input).
  const displaySalary = computed(() =>
    period.value === "hourly"
      ? hourlyFromAnnual(salary.value, hoursPerWeek.value)
      : salary.value,
  );

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

  // "Where could I afford?" — all metros ranked by your current pay + city.
  const affordable = computed<AffordRow[]>(() =>
    from.value && salary.value > 0
      ? rankByAffordability(from.value, salary.value, metros)
      : [],
  );

  // ── lifestyle filters (Afford page) — narrow only, never re-rank ──
  const filters = ref<ActiveBands>({});

  const filteredAffordable = computed(() =>
    applyFilters(affordable.value, filters.value),
  );

  const activeFilterCount = computed(
    () => Object.values(filters.value).filter((v) => v != null).length,
  );

  return {
    metros,
    from,
    to,
    salary,
    period,
    hoursPerWeek,
    displaySalary,
    result,
    basket,
    affordable,
    setFrom: (id: string) => (fromId.value = id),
    setTo: (id: string) => (toId.value = id),
    // Flip origin and destination (salary stays — it's still "your pay").
    swap: () => {
      const f = fromId.value;
      fromId.value = toId.value;
      toId.value = f;
    },
    // `n` is entered in the current period; store it as canonical annual.
    setSalary: (n: number) =>
      (salary.value =
        period.value === "hourly"
          ? annualFromHourly(n, hoursPerWeek.value)
          : n),
    setPeriod: (p: PayPeriod) => (period.value = p),
    setHoursPerWeek: (h: number) => (hoursPerWeek.value = h),
    filters,
    filteredAffordable,
    activeFilterCount,
    // tapping the already-active band clears it (acts as a toggle)
    setBand: (filterId: string, bandId: string | null) => {
      filters.value = {
        ...filters.value,
        [filterId]: filters.value[filterId] === bandId ? null : bandId,
      };
    },
    clearFilters: () => (filters.value = {}),
  };
}
