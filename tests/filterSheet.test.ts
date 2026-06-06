import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import FilterSheet from "../src/components/FilterSheet.vue";

describe("FilterSheet", () => {
  it("is collapsed by default and shows the active count", () => {
    const wrapper = mount(FilterSheet, {
      props: { active: { temp: "mild" }, activeCount: 1 },
    });
    expect(wrapper.text()).toContain("Filters");
    expect(wrapper.text()).toContain("1");
  });

  it("emits set-band when a band is clicked", async () => {
    const wrapper = mount(FilterSheet, {
      props: { active: {}, activeCount: 0 },
    });
    await wrapper.find("button[aria-expanded]").trigger("click");
    const bandBtn = wrapper
      .findAll("button")
      .find((b) => b.text().includes("Lean blue"))!;
    await bandBtn.trigger("click");
    expect(wrapper.emitted("set-band")).toBeTruthy();
    expect(wrapper.emitted("set-band")![0]).toEqual(["politics", "blue"]);
  });

  it("emits clear when Clear all is clicked", async () => {
    const wrapper = mount(FilterSheet, {
      props: { active: { temp: "mild" }, activeCount: 1 },
    });
    await wrapper.find("button[aria-expanded]").trigger("click");
    const clearBtn = wrapper
      .findAll("button")
      .find((b) => b.text().includes("Clear all"))!;
    await clearBtn.trigger("click");
    expect(wrapper.emitted("clear")).toBeTruthy();
  });
});
