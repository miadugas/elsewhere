import type { Metro, BasketItem, BasketRow } from "../types";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function localizeBasket(
  from: Metro,
  to: Metro,
  items: BasketItem[],
): BasketRow[] {
  return items.map((item) => {
    const liveFrom = item.metroField
      ? (from[item.metroField] as number | undefined)
      : undefined;
    const liveTo = item.metroField
      ? (to[item.metroField] as number | undefined)
      : undefined;
    const useLive = liveFrom != null && liveTo != null;

    const row: BasketRow = {
      id: item.id,
      label: item.label,
      emoji: item.emoji,
      fromPrice: useLive
        ? round2(liveFrom as number)
        : round2(item.nationalAvg * (from.rpp[item.category] / 100)),
      toPrice: useLive
        ? round2(liveTo as number)
        : round2(item.nationalAvg * (to.rpp[item.category] / 100)),
    };
    if (item.metroField) row.note = useLive ? (item.note ?? "live") : "est.";
    return row;
  });
}
