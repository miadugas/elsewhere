import type { Metro } from "../types";
import type { AffordRow } from "./explore";

/**
 * Top marginal state individual income-tax rate (%), keyed by USPS code.
 * Source: Tax Foundation, "State Individual Income Tax Rates" 2024.
 * Wage-income view: WA (cap-gains only) and NH (interest/dividends, phasing
 * out) are treated as 0 for earned income.
 */
export const STATE_TOP_RATE: Record<string, number> = {
  AL: 5.0,
  AK: 0,
  AZ: 2.5,
  AR: 4.4,
  CA: 13.3,
  CO: 4.4,
  CT: 6.99,
  DE: 6.6,
  DC: 10.75,
  FL: 0,
  GA: 5.49,
  HI: 11.0,
  ID: 5.8,
  IL: 4.95,
  IN: 3.05,
  IA: 5.7,
  KS: 5.7,
  KY: 4.0,
  LA: 4.25,
  ME: 7.15,
  MD: 5.75,
  MA: 9.0,
  MI: 4.25,
  MN: 9.85,
  MS: 4.7,
  MO: 4.8,
  MT: 5.9,
  NE: 5.84,
  NV: 0,
  NH: 0,
  NJ: 10.75,
  NM: 5.9,
  NY: 10.9,
  NC: 4.5,
  ND: 2.5,
  OH: 3.5,
  OK: 4.75,
  OR: 9.9,
  PA: 3.07,
  RI: 5.99,
  SC: 6.4,
  SD: 0,
  TN: 0,
  TX: 0,
  UT: 4.65,
  VT: 8.75,
  VA: 5.75,
  WA: 0,
  WV: 5.12,
  WI: 7.65,
  WY: 0,
};

function taxRate(m: Metro): number | undefined {
  const st = m.states[0];
  return st && st in STATE_TOP_RATE ? STATE_TOP_RATE[st] : undefined;
}

export interface FilterBand {
  id: string;
  label: string;
  test: (m: Metro) => boolean;
}

export interface FilterDef {
  id: string;
  label: string;
  emoji: string;
  has: (m: Metro) => boolean;
  bands: FilterBand[];
  badge: (m: Metro) => string | null;
}

export const FILTERS: FilterDef[] = [
  {
    id: "politics",
    label: "Political lean",
    emoji: "🗳️",
    has: (m) => m.politics !== undefined,
    badge: (m) =>
      m.politics === undefined
        ? null
        : m.politics > 0
          ? `D+${Math.round(m.politics)}`
          : m.politics < 0
            ? `R+${Math.round(-m.politics)}`
            : "even",
    bands: [
      { id: "blue", label: "Lean blue", test: (m) => m.politics! > 5 },
      {
        id: "purple",
        label: "Purple",
        test: (m) => Math.abs(m.politics!) <= 5,
      },
      { id: "red", label: "Lean red", test: (m) => m.politics! < -5 },
    ],
  },
  {
    id: "temp",
    label: "Temperature",
    emoji: "🌡️",
    has: (m) => m.tempF !== undefined,
    badge: (m) => (m.tempF === undefined ? null : `${Math.round(m.tempF)}°`),
    bands: [
      { id: "cold", label: "Cold (<50°)", test: (m) => m.tempF! < 50 },
      {
        id: "mild",
        label: "Mild (50–65°)",
        test: (m) => m.tempF! >= 50 && m.tempF! <= 65,
      },
      { id: "hot", label: "Hot (>65°)", test: (m) => m.tempF! > 65 },
    ],
  },
  {
    id: "humidity",
    label: "Humidity",
    emoji: "💧",
    has: (m) => m.humidity !== undefined,
    badge: (m) =>
      m.humidity === undefined ? null : `${Math.round(m.humidity)}% hum`,
    bands: [
      { id: "dry", label: "Dry (<55%)", test: (m) => m.humidity! < 55 },
      {
        id: "moderate",
        label: "Moderate (55–70%)",
        test: (m) => m.humidity! >= 55 && m.humidity! <= 70,
      },
      { id: "humid", label: "Humid (>70%)", test: (m) => m.humidity! > 70 },
    ],
  },
  {
    id: "aqi",
    label: "Air quality",
    emoji: "🌫️",
    has: (m) => m.aqi !== undefined,
    badge: (m) =>
      m.aqi === undefined
        ? null
        : m.aqi <= 50
          ? "good air"
          : m.aqi <= 100
            ? "ok air"
            : "poor air",
    bands: [
      { id: "good", label: "Good (≤50)", test: (m) => m.aqi! <= 50 },
      {
        id: "moderate",
        label: "Moderate (51–100)",
        test: (m) => m.aqi! > 50 && m.aqi! <= 100,
      },
      { id: "poor", label: "Poor (>100)", test: (m) => m.aqi! > 100 },
    ],
  },
  {
    id: "risk",
    label: "Disaster risk",
    emoji: "🌪️",
    has: (m) => m.risk !== undefined,
    badge: (m) =>
      m.risk === undefined
        ? null
        : m.risk < 33
          ? "low risk"
          : m.risk <= 66
            ? "med risk"
            : "high risk",
    bands: [
      { id: "low", label: "Low (<33)", test: (m) => m.risk! < 33 },
      {
        id: "medium",
        label: "Medium (33–66)",
        test: (m) => m.risk! >= 33 && m.risk! <= 66,
      },
      { id: "high", label: "High (>66)", test: (m) => m.risk! > 66 },
    ],
  },
  {
    id: "tax",
    label: "State income tax",
    emoji: "🧾",
    has: (m) => taxRate(m) !== undefined,
    badge: (m) => {
      const r = taxRate(m);
      return r === undefined ? null : r === 0 ? "no tax" : `${r}% tax`;
    },
    bands: [
      { id: "none", label: "No tax", test: (m) => taxRate(m) === 0 },
      {
        id: "low",
        label: "Low (0–5%)",
        test: (m) => {
          const r = taxRate(m)!;
          return r > 0 && r <= 5;
        },
      },
      { id: "high", label: "High (>5%)", test: (m) => taxRate(m)! > 5 },
    ],
  },
];

export type ActiveBands = Record<string, string | null>;

/**
 * Narrow ranked rows by the active bands. Ordering is preserved (input is
 * already ranked by required salary). A metro missing the datum for an active
 * filter is excluded and tallied into `hiddenNoData` — never silently dropped,
 * never imputed.
 */
export function applyFilters(
  rows: AffordRow[],
  active: ActiveBands,
): { rows: AffordRow[]; hiddenNoData: number } {
  const activeDefs = FILTERS.map((f) => ({
    f,
    band: f.bands.find((b) => b.id === active[f.id]),
  })).filter((x): x is { f: FilterDef; band: FilterBand } => !!x.band);

  if (activeDefs.length === 0) return { rows, hiddenNoData: 0 };

  let hiddenNoData = 0;
  const out = rows.filter((row) => {
    for (const { f, band } of activeDefs) {
      if (!f.has(row.metro)) {
        hiddenNoData++;
        return false;
      }
      if (!band.test(row.metro)) return false;
    }
    return true;
  });
  return { rows: out, hiddenNoData };
}

export interface MetroBadge {
  emoji: string;
  text: string;
}

/** Compact attribute badges for a metro, in FILTERS order, omitting absent data. */
export function metroBadges(m: Metro): MetroBadge[] {
  const out: MetroBadge[] = [];
  for (const f of FILTERS) {
    const text = f.badge(m);
    if (text !== null) out.push({ emoji: f.emoji, text });
  }
  return out;
}
