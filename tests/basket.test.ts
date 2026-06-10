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
    label: "Typical rent",
    emoji: "🏠",
    nationalAvg: 2010,
    category: "housing",
    metroField: "rent",
    note: "Zillow ZORI",
  },
];

describe("localizeBasket", () => {
  it("bends each national price by the right category parity for both metros", () => {
    const rows = localizeBasket(detroit, austin, items);
    const pizza = rows.find((r) => r.id === "pizza-slice")!;
    // from: 3.5 * 97.2/100 = 3.402 -> 3.40 ; to: 3.5 * 98.9/100 = 3.4615 -> 3.46
    expect(pizza.fromPrice).toBe(3.4);
    expect(pizza.toPrice).toBe(3.46);
  });

  it("preserves label and emoji and order", () => {
    const rows = localizeBasket(detroit, austin, items);
    expect(rows.map((r) => r.id)).toEqual(["pizza-slice", "rent-1br"]);
    expect(rows[0].emoji).toBe("🍕");
  });
});

describe("localizeBasket rent (live metro value)", () => {
  it("uses metro.rent directly for both cities when present, with the source note", () => {
    const f = { rpp: detroit.rpp, rent: 1300 } as Metro;
    const t = { rpp: austin.rpp, rent: 1750 } as Metro;
    const rent = localizeBasket(f, t, items).find((r) => r.id === "rent-1br")!;
    expect(rent.fromPrice).toBe(1300);
    expect(rent.toPrice).toBe(1750);
    expect(rent.note).toBe("Zillow ZORI");
  });

  it("falls back to RPP-derived rent with an 'est.' note when metro.rent is absent", () => {
    const rent = localizeBasket(detroit, austin, items).find(
      (r) => r.id === "rent-1br",
    )!;
    // 2010 * 80.1/100 = 1610.01 ; 2010 * 112.8/100 = 2267.28
    expect(rent.fromPrice).toBe(1610.01);
    expect(rent.toPrice).toBe(2267.28);
    expect(rent.note).toBe("est.");
  });

  it("leaves non-metroField items unchanged (no note)", () => {
    const pizza = localizeBasket(detroit, austin, items).find(
      (r) => r.id === "pizza-slice",
    )!;
    expect(pizza.fromPrice).toBe(3.4);
    expect(pizza.note).toBeUndefined();
  });
});
