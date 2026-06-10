export type ParityCategory = "housing" | "goods" | "otherServices";

export interface Metro {
  id: string; // "detroit-mi"
  name: string; // "Detroit-Warren-Dearborn, MI"
  short: string; // "Detroit"
  states: string[]; // ["MI"]
  lat?: number; // optional — populated with the map (Plan B); unused in v1
  lng?: number;
  pop?: number; // CBSA population (Census) — ranks search results by metro size
  rpp: {
    overall: number; // 100 = national average
    housing: number;
    goods: number;
    otherServices: number;
  };
  // ── lifestyle attributes (optional: not every metro matches every source) ──
  politics?: number; // signed 2024 pres. margin in points: +8 = D+8, -12 = R+12
  tempF?: number; // annual avg temperature, °F
  humidity?: number; // annual avg relative humidity, %
  aqi?: number; // median AQI for the year (lower = cleaner)
  risk?: number; // FEMA National Risk Index composite 0–100 (higher = riskier)
  rent?: number; // typical monthly market rent — Zillow ZORI, all homes
}

export interface BasketItem {
  id: string; // "pizza-slice"
  label: string; // "Slice of pizza"
  emoji: string; // "🍕"
  nationalAvg: number; // dollars
  category: ParityCategory;
  metroField?: "rent"; // when set, use this per-metro $ value instead of RPP-derived
  note?: string; // source/freshness label shown when the live value is used
}

export interface ParityResult {
  fromSalary: number;
  requiredSalary: number; // to keep the same life in `to` (rounded whole $)
  delta: number; // requiredSalary - fromSalary
  pct: number; // fraction, e.g. 0.18 = 18% pricier
  buyingPower: number; // what fromSalary's purchasing power is worth in `to`
}

export interface BasketRow {
  id: string;
  label: string;
  emoji: string;
  fromPrice: number;
  toPrice: number;
  note?: string;
}
