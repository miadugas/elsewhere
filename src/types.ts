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
}

export interface BasketItem {
  id: string; // "pizza-slice"
  label: string; // "Slice of pizza"
  emoji: string; // "🍕"
  nationalAvg: number; // dollars
  category: ParityCategory;
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
}
