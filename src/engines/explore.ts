import type { Metro, ParityResult } from "../types";
import { requiredSalary } from "./parity";

export interface AffordRow {
  metro: Metro;
  result: ParityResult;
}

/**
 * Every metro except `from`, ranked by what you'd need to keep the same life
 * there — cheapest first (i.e. where your current pay stretches furthest).
 * Same unit-agnostic parity math as the compare doorway, just fanned out.
 */
export function rankByAffordability(
  from: Metro,
  salary: number,
  metros: Metro[],
): AffordRow[] {
  return metros
    .filter((m) => m.id !== from.id)
    .map((m) => ({ metro: m, result: requiredSalary(from, m, salary) }))
    .sort((a, b) => a.result.requiredSalary - b.result.requiredSalary);
}
