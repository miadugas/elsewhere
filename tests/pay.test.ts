import { describe, it, expect } from "vitest";
import {
  annualFromHourly,
  hourlyFromAnnual,
  formatPay,
  formatPayFromAnnual,
} from "../src/engines/pay";
import { useComparison } from "../src/composables/useComparison";

describe("pay engine", () => {
  it("converts annual <-> hourly at 40h/wk (2080h/yr)", () => {
    expect(annualFromHourly(40, 40)).toBe(83200); // 40 * 40 * 52
    expect(hourlyFromAnnual(83200, 40)).toBe(40);
  });

  it("respects a custom hours/week", () => {
    expect(annualFromHourly(50, 30)).toBe(78000); // 50 * 30 * 52
    expect(hourlyFromAnnual(78000, 30)).toBe(50);
  });

  it("guards against divide-by-zero hours", () => {
    expect(hourlyFromAnnual(80000, 0)).toBe(0);
  });

  it("formats with cents for hourly, whole dollars for annual", () => {
    expect(formatPay(40.5, "hourly")).toBe("$40.50");
    expect(formatPay(83200, "annual")).toBe("$83,200");
    expect(formatPayFromAnnual(83200, "hourly", 40)).toBe("$40.00");
  });
});

describe("useComparison — hourly lens", () => {
  it("stores hourly input as canonical annual; parity is unit-agnostic", () => {
    const c = useComparison();
    c.setFrom("detroit-mi");
    c.setTo("austin-tx");
    c.setPeriod("hourly");
    c.setHoursPerWeek(40);
    c.setSalary(40); // $40/hr -> $83,200/yr canonical
    expect(c.salary.value).toBe(83200);
    // displaySalary mirrors back to the hourly unit
    expect(c.displaySalary.value).toBe(40);
    // parity is unit-agnostic: the hourly lens yields the same canonical
    // annual required as feeding the equivalent annual salary directly
    const annual = useComparison();
    annual.setFrom("detroit-mi");
    annual.setTo("austin-tx");
    annual.setSalary(83200);
    expect(c.result.value!.requiredSalary).toBe(
      annual.result.value!.requiredSalary,
    );
  });

  it("switching period leaves the canonical annual untouched", () => {
    const c = useComparison();
    c.setFrom("detroit-mi");
    c.setTo("austin-tx");
    c.setSalary(83200); // annual
    c.setPeriod("hourly");
    expect(c.salary.value).toBe(83200); // canonical unchanged
    expect(c.displaySalary.value).toBe(40); // shown as $40/hr
  });
});
