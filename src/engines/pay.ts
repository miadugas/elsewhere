// Pay-period engine — annual is the canonical unit the parity math runs on.
// Hourly is a lens: convert at the input/display edges only.

export type PayPeriod = "annual" | "hourly";

export const WEEKS_PER_YEAR = 52;

/** Annual equivalent of an hourly wage at a given hours/week. */
export function annualFromHourly(hourly: number, hoursPerWeek: number): number {
  return hourly * hoursPerWeek * WEEKS_PER_YEAR;
}

/** Hourly equivalent of an annual salary at a given hours/week. */
export function hourlyFromAnnual(annual: number, hoursPerWeek: number): number {
  const hours = hoursPerWeek * WEEKS_PER_YEAR;
  return hours > 0 ? annual / hours : 0;
}

/** Format an amount already expressed in `period` (hourly shows cents). */
export function formatPay(amount: number, period: PayPeriod): string {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    ...(period === "hourly"
      ? { minimumFractionDigits: 2, maximumFractionDigits: 2 }
      : { maximumFractionDigits: 0 }),
  });
}

/** Format a canonical annual amount for display in the chosen period. */
export function formatPayFromAnnual(
  annual: number,
  period: PayPeriod,
  hoursPerWeek: number,
): string {
  const amount =
    period === "hourly" ? hourlyFromAnnual(annual, hoursPerWeek) : annual;
  return formatPay(amount, period);
}

/** Short unit suffix for the chosen period ("" for annual — it's implied). */
export function unitSuffix(period: PayPeriod): string {
  return period === "hourly" ? "/hr" : "";
}
