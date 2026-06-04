export type ParityCategory = "housing" | "goods" | "otherServices";

export interface Metro {
  id: string; // "detroit-mi"
  name: string; // "Detroit-Warren-Dearborn, MI"
  short: string; // "Detroit"
  states: string[]; // ["MI"]
  lat: number;
  lng: number;
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
  requiredSalary: number; // rounded to whole dollars
  delta: number; // requiredSalary - fromSalary
  pct: number; // fraction, e.g. 0.18 = 18% pricier
}

export interface BasketRow {
  id: string;
  label: string;
  emoji: string;
  fromPrice: number;
  toPrice: number;
}
