import { describe, it, expect } from "vitest";
import { requiredSalary } from "../src/engines/parity";
import type { Metro } from "../src/types";

const detroit = {
  rpp: { overall: 94.5, housing: 80.1, goods: 97.2, otherServices: 96.0 },
} as Metro;
const austin = {
  rpp: { overall: 103.2, housing: 112.8, goods: 98.9, otherServices: 101.4 },
} as Metro;

describe("requiredSalary", () => {
  it("scales salary by the ratio of overall RPPs", () => {
    const r = requiredSalary(detroit, austin, 70000);
    // 70000 * (103.2 / 94.5) = 76444.4...
    expect(r.requiredSalary).toBe(76444);
    expect(r.fromSalary).toBe(70000);
    expect(r.delta).toBe(6444);
    expect(r.pct).toBeCloseTo(103.2 / 94.5 - 1, 5);
  });

  it("returns a lower number when moving somewhere cheaper", () => {
    const r = requiredSalary(austin, detroit, 100000);
    expect(r.requiredSalary).toBeLessThan(100000);
    expect(r.delta).toBeLessThan(0);
  });

  it("is identity when both metros are equal", () => {
    const r = requiredSalary(detroit, detroit, 50000);
    expect(r.requiredSalary).toBe(50000);
    expect(r.delta).toBe(0);
    expect(r.pct).toBe(0);
  });
});
