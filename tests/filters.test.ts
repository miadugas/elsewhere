import { describe, it, expect } from "vitest";
import {
  applyFilters,
  availableFilters,
  metroBadges,
  STATE_TOP_RATE,
} from "../src/engines/filters";
import type { Metro } from "../src/types";
import type { AffordRow } from "../src/engines/explore";

// Minimal metro factory — only the fields filters read.
function metro(id: string, extra: Partial<Metro>): Metro {
  return {
    id,
    name: id,
    short: id,
    states: ["CO"],
    rpp: { overall: 100, housing: 100, goods: 100, otherServices: 100 },
    ...extra,
  } as Metro;
}
function row(m: Metro, required = 50000): AffordRow {
  return {
    metro: m,
    result: {
      fromSalary: 50000,
      requiredSalary: required,
      delta: 0,
      pct: 0,
      buyingPower: 50000,
    },
  };
}

const blueMild = row(
  metro("blue-mild", { politics: 22, tempF: 55, states: ["NY"] }),
  70000,
);
const redHot = row(
  metro("red-hot", { politics: -18, tempF: 78, states: ["TX"] }),
  60000,
);
const purpleNoTemp = row(
  metro("purple-notemp", { politics: 2, states: ["NV"] }),
  65000,
);

const ALL = [blueMild, redHot, purpleNoTemp];

describe("applyFilters", () => {
  it("returns all rows unchanged when no band is active", () => {
    const out = applyFilters(ALL, {});
    expect(out.rows).toHaveLength(3);
    expect(out.hiddenNoData).toBe(0);
  });

  it("keeps only rows passing an active band, preserving input order", () => {
    const out = applyFilters(ALL, { politics: "blue" });
    expect(out.rows.map((r) => r.metro.id)).toEqual(["blue-mild"]);
  });

  it("treats the ±5 band as purple", () => {
    const out = applyFilters(ALL, { politics: "purple" });
    expect(out.rows.map((r) => r.metro.id)).toEqual(["purple-notemp"]);
  });

  it("excludes metros missing data for an active filter and counts them", () => {
    const out = applyFilters(ALL, { temp: "mild" });
    expect(out.rows.map((r) => r.metro.id)).toEqual(["blue-mild"]);
    expect(out.hiddenNoData).toBe(1); // purple-notemp had no tempF
  });

  it("ands multiple active filters together", () => {
    const out = applyFilters(ALL, { politics: "red", temp: "hot" });
    expect(out.rows.map((r) => r.metro.id)).toEqual(["red-hot"]);
  });

  it("counts a metro as hidden-no-data when it lacks data for any active filter under AND", () => {
    // purple-notemp has politics but no tempF; with both filters active it is
    // excluded for the missing tempF and tallied once.
    const out = applyFilters(ALL, { politics: "purple", temp: "mild" });
    expect(out.rows).toHaveLength(0); // purple-notemp passes politics but has no temp
    expect(out.hiddenNoData).toBe(1);
  });

  it("never reorders rows (ranking is preserved)", () => {
    expect(applyFilters(ALL, {}).rows[0].metro.id).toBe("blue-mild");
  });
});

describe("tax filter", () => {
  it("reads the top marginal rate from states[0]", () => {
    expect(STATE_TOP_RATE["TX"]).toBe(0);
    expect(STATE_TOP_RATE["CA"]).toBeGreaterThan(10);
    const noTax = applyFilters(ALL, { tax: "none" });
    expect(noTax.rows.map((r) => r.metro.id)).toContain("red-hot"); // TX = 0
    expect(noTax.rows.map((r) => r.metro.id)).toContain("purple-notemp"); // NV = 0
    expect(noTax.rows.map((r) => r.metro.id)).not.toContain("blue-mild"); // NY ≠ 0
  });
});

describe("availableFilters", () => {
  it("includes a filter when at least one metro has its datum", () => {
    const metros = [metro("a", { politics: 10 }), metro("b", {})];
    const ids = availableFilters(metros).map((f) => f.id);
    expect(ids).toContain("politics");
  });

  it("omits a filter when no metro has its datum", () => {
    const metros = [metro("a", { politics: 10 }), metro("b", { aqi: 40 })];
    const ids = availableFilters(metros).map((f) => f.id);
    expect(ids).not.toContain("temp"); // no metro has tempF
    expect(ids).not.toContain("humidity");
  });

  it("always includes tax (derived from state)", () => {
    const metros = [metro("a", { states: ["TX"] })];
    expect(availableFilters(metros).map((f) => f.id)).toContain("tax");
  });
});

describe("metroBadges", () => {
  it("emits one badge per present factor, in FILTERS order, omitting missing", () => {
    const badges = metroBadges(blueMild.metro);
    const texts = badges.map((b) => b.text);
    expect(texts).toContain("D+22");
    expect(texts).toContain("55°");
    expect(texts.some((t) => t.includes("hum"))).toBe(false);
  });

  it("formats a red margin as R+N", () => {
    expect(metroBadges(redHot.metro).map((b) => b.text)).toContain("R+18");
  });
});
