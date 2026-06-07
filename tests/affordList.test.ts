import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import AffordList from "../src/components/AffordList.vue";
import type { AffordRow } from "../src/engines/explore";
import type { Metro } from "../src/types";

function metro(extra: Partial<Metro> = {}): Metro {
  return {
    id: "denver-co",
    name: "Denver-Aurora-Centennial, CO",
    short: "Denver",
    states: ["CO"],
    rpp: { overall: 100, housing: 100, goods: 100, otherServices: 100 },
    ...extra,
  } as Metro;
}

const rows: AffordRow[] = [
  {
    metro: metro(),
    result: {
      fromSalary: 80000,
      requiredSalary: 75000,
      delta: -5000,
      pct: -0.06,
      buyingPower: 80000,
    },
  },
];

describe("AffordList expandable rows", () => {
  it("hides city detail (full name + Wikipedia link) until the row is tapped", () => {
    const w = mount(AffordList, {
      props: { rows, period: "annual", hoursPerWeek: 40 },
    });
    expect(w.text()).not.toContain("Denver-Aurora-Centennial, CO");
    expect(w.find("a[href*='wikipedia']").exists()).toBe(false);
  });

  it("reveals the full metro name + an anchor-city Wikipedia link on tap", async () => {
    const w = mount(AffordList, {
      props: { rows, period: "annual", hoursPerWeek: 40 },
    });
    await w.find("#afford-rows button").trigger("click");
    expect(w.text()).toContain("Denver-Aurora-Centennial, CO");
    const link = w.find("a[href*='wikipedia']");
    expect(link.exists()).toBe(true);
    expect(link.attributes("href")).toBe(
      "https://en.wikipedia.org/wiki/Denver",
    );
    expect(link.attributes("rel")).toContain("noopener");
  });

  it("toggles closed again on a second tap", async () => {
    const w = mount(AffordList, {
      props: { rows, period: "annual", hoursPerWeek: 40 },
    });
    const btn = w.find("#afford-rows button");
    await btn.trigger("click");
    expect(w.find("a[href*='wikipedia']").exists()).toBe(true);
    await btn.trigger("click");
    expect(w.find("a[href*='wikipedia']").exists()).toBe(false);
  });
});
