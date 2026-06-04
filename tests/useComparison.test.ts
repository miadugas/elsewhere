import { describe, it, expect } from "vitest";
import { useComparison } from "../src/composables/useComparison";

describe("useComparison", () => {
  it("has no result until from, to, and a positive salary are set", () => {
    const c = useComparison();
    expect(c.result.value).toBeNull();
    c.setFrom("detroit-mi");
    c.setTo("austin-tx");
    expect(c.result.value).toBeNull(); // salary still 0
    c.setSalary(70000);
    expect(c.result.value?.requiredSalary).toBe(76444);
  });

  it("produces basket rows once both metros are chosen", () => {
    const c = useComparison();
    c.setFrom("detroit-mi");
    c.setTo("austin-tx");
    expect(c.basket.value.length).toBeGreaterThan(0);
    expect(c.basket.value[0]).toHaveProperty("fromPrice");
  });

  it("recomputes when salary changes", () => {
    const c = useComparison();
    c.setFrom("detroit-mi");
    c.setTo("austin-tx");
    c.setSalary(70000);
    const first = c.result.value!.requiredSalary;
    c.setSalary(140000);
    // Verify recomputation happened (within 2 dollars due to rounding)
    expect(c.result.value!.requiredSalary).toBeGreaterThan(first * 1.9);
    expect(c.result.value!.requiredSalary).toBeLessThan(first * 2.1);
  });
});
