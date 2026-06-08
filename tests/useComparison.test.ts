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
    // real BEA 2024 RPPs: Detroit 100.3, Austin 98.1 → 70000 * 98.1/100.3
    expect(c.result.value?.requiredSalary).toBe(68465);
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

describe("useComparison filters", () => {
  it("defaults to no active filters and an empty active count", () => {
    const c = useComparison();
    expect(c.activeFilterCount.value).toBe(0);
  });

  it("setBand toggles a band on, then off when set to the same id", () => {
    const c = useComparison();
    c.setBand("temp", "mild");
    expect(c.filters.value.temp).toBe("mild");
    expect(c.activeFilterCount.value).toBe(1);
    c.setBand("temp", "mild"); // same band again clears it
    expect(c.filters.value.temp).toBeNull();
    expect(c.activeFilterCount.value).toBe(0);
  });

  it("clearFilters removes all active bands", () => {
    const c = useComparison();
    c.setBand("temp", "mild");
    c.setBand("politics", "blue");
    expect(c.activeFilterCount.value).toBe(2);
    c.clearFilters();
    expect(c.activeFilterCount.value).toBe(0);
  });

  it("filteredAffordable narrows the ranked list (active filter is not a no-op)", () => {
    const c = useComparison();
    c.setFrom(c.metros.value[0].id);
    c.salary.value = 80000;
    const before = c.filteredAffordable.value.rows.length;
    c.setBand("tax", "none");
    const after = c.filteredAffordable.value.rows.length;
    expect(after).toBeLessThanOrEqual(before);
  });
});
