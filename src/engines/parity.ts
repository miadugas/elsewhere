import type { Metro, ParityResult } from "../types";

export function requiredSalary(
  from: Metro,
  to: Metro,
  salary: number,
): ParityResult {
  const ratio = to.rpp.overall / from.rpp.overall;
  const required = Math.round(salary * ratio);
  return {
    fromSalary: salary,
    requiredSalary: required,
    delta: required - salary,
    pct: ratio - 1,
    // inverse: keep your pay, what its purchasing power is worth in `to`
    buyingPower: Math.round(salary / ratio),
  };
}
