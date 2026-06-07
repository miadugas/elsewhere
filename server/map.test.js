import { describe, it, expect } from "vitest";
import { mapMetro } from "./map.js";

const pgRow = {
  id: "denver-co",
  cbsa: "19740",
  name: "Denver-Aurora-Centennial, CO",
  short: "Denver",
  states: ["CO"],
  pop: 2986000,
  rpp_overall: "104.4",
  rpp_housing: "118.2",
  rpp_goods: "99.1",
  rpp_other_services: "101.0",
  politics: "18.0",
  temp_f: null,
  humidity: null,
  aqi: "42",
  risk: "30.5",
  wikipedia_url: "https://en.wikipedia.org/wiki/Denver",
  blurb: null,
};

describe("mapMetro", () => {
  it("reassembles the nested rpp object with numeric (not string) values", () => {
    const m = mapMetro(pgRow);
    expect(m.rpp).toEqual({
      overall: 104.4,
      housing: 118.2,
      goods: 99.1,
      otherServices: 101.0,
    });
    expect(typeof m.rpp.overall).toBe("number");
  });
  it("copies identity + numeric lifestyle fields, coercing to numbers", () => {
    const m = mapMetro(pgRow);
    expect(m.id).toBe("denver-co");
    expect(m.short).toBe("Denver");
    expect(m.states).toEqual(["CO"]);
    expect(m.pop).toBe(2986000);
    expect(m.politics).toBe(18);
    expect(m.aqi).toBe(42);
    expect(m.risk).toBe(30.5);
  });
  it("omits absent (null) optional fields rather than emitting null", () => {
    const m = mapMetro(pgRow);
    expect("tempF" in m).toBe(false);
    expect("humidity" in m).toBe(false);
    expect("blurb" in m).toBe(false);
  });
  it("includes city detail when present", () => {
    const m = mapMetro(pgRow);
    expect(m.wikipedia_url).toBe("https://en.wikipedia.org/wiki/Denver");
  });
});
