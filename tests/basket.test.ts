import { describe, it, expect } from "vitest";
import { localizeBasket } from "../src/engines/basket";
import type { Metro, BasketItem } from "../src/types";

const detroit = {
  rpp: { overall: 94.5, housing: 80.1, goods: 97.2, otherServices: 96.0 },
} as Metro;
const austin = {
  rpp: { overall: 103.2, housing: 112.8, goods: 98.9, otherServices: 101.4 },
} as Metro;

const items: BasketItem[] = [
  {
    id: "pizza-slice",
    label: "Slice of pizza",
    emoji: "🍕",
    nationalAvg: 3.5,
    category: "goods",
  },
  {
    id: "rent-1br",
    label: "1-bedroom rent",
    emoji: "🏠",
    nationalAvg: 1500,
    category: "housing",
  },
];

describe("localizeBasket", () => {
  it("bends each national price by the right category parity for both metros", () => {
    const rows = localizeBasket(detroit, austin, items);
    const pizza = rows.find((r) => r.id === "pizza-slice")!;
    // from: 3.5 * 97.2/100 = 3.402 -> 3.40 ; to: 3.5 * 98.9/100 = 3.4615 -> 3.46
    expect(pizza.fromPrice).toBe(3.4);
    expect(pizza.toPrice).toBe(3.46);
    const rent = rows.find((r) => r.id === "rent-1br")!;
    // from: 1500 * 80.1/100 = 1201.5 ; to: 1500 * 112.8/100 = 1692
    expect(rent.fromPrice).toBe(1201.5);
    expect(rent.toPrice).toBe(1692);
  });

  it("preserves label and emoji and order", () => {
    const rows = localizeBasket(detroit, austin, items);
    expect(rows.map((r) => r.id)).toEqual(["pizza-slice", "rent-1br"]);
    expect(rows[0].emoji).toBe("🍕");
  });
});
