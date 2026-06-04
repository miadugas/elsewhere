import { describe, it, expect } from "vitest";
import { searchMetros, findMetro } from "../src/engines/places";
import type { Metro } from "../src/types";

const metros: Metro[] = [
  {
    id: "detroit-mi",
    name: "Detroit-Warren-Dearborn, MI",
    short: "Detroit",
    states: ["MI"],
    lat: 0,
    lng: 0,
    rpp: { overall: 94.5, housing: 80, goods: 97, otherServices: 96 },
  },
  {
    id: "austin-tx",
    name: "Austin-Round Rock, TX",
    short: "Austin",
    states: ["TX"],
    lat: 0,
    lng: 0,
    rpp: { overall: 103, housing: 112, goods: 98, otherServices: 101 },
  },
  {
    id: "denver-co",
    name: "Denver-Aurora-Lakewood, CO",
    short: "Denver",
    states: ["CO"],
    lat: 0,
    lng: 0,
    rpp: { overall: 105, housing: 124, goods: 98, otherServices: 102 },
  },
];

describe("searchMetros", () => {
  it("matches on short name, case-insensitive", () => {
    expect(searchMetros(metros, "det").map((m) => m.id)).toEqual([
      "detroit-mi",
    ]);
    expect(searchMetros(metros, "AUS").map((m) => m.id)).toEqual(["austin-tx"]);
  });

  it("matches on a state code exactly", () => {
    expect(searchMetros(metros, "CO").map((m) => m.id)).toEqual(["denver-co"]);
  });

  it("returns empty for blank query", () => {
    expect(searchMetros(metros, "   ")).toEqual([]);
  });
});

describe("findMetro", () => {
  it("returns the metro by id", () => {
    expect(findMetro(metros, "austin-tx")?.short).toBe("Austin");
  });
  it("returns undefined for unknown id", () => {
    expect(findMetro(metros, "nope")).toBeUndefined();
  });
});
