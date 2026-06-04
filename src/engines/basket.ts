import type { Metro, BasketItem, BasketRow } from "../types";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function localizeBasket(
  from: Metro,
  to: Metro,
  items: BasketItem[],
): BasketRow[] {
  return items.map((item) => ({
    id: item.id,
    label: item.label,
    emoji: item.emoji,
    fromPrice: round2(item.nationalAvg * (from.rpp[item.category] / 100)),
    toPrice: round2(item.nationalAvg * (to.rpp[item.category] / 100)),
  }));
}
