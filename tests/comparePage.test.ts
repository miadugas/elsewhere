import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import ComparePage from "../src/pages/ComparePage.vue";

// ComparePage calls loadMetros() on mount — keep it offline so tests run
// against the bundled seed (no real network).
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockRejectedValue(new Error("no network in test")),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ComparePage", () => {
  it("mounts and shows the title and the three inputs without crashing", () => {
    const wrapper = mount(ComparePage);
    expect(wrapper.text()).toContain("Elsewhere");
    // two place pickers + one salary input
    expect(wrapper.findAll("input").length).toBeGreaterThanOrEqual(3);
  });

  it("hides the result, basket, and breakdown until both metros are chosen", () => {
    const wrapper = mount(ComparePage);
    expect(wrapper.text()).not.toContain("you'd need");
    expect(wrapper.text()).not.toContain("The Basket");
    expect(wrapper.text()).not.toContain("Category breakdown");
  });

  it("renders the result and basket after both metros and a salary are set", async () => {
    const wrapper = mount(ComparePage);
    const [fromInput, toInput, salaryInput] = wrapper.findAll("input");

    await fromInput.setValue("Detroit");
    await fromInput.trigger("input");
    await wrapper
      .findAll("li")
      .find((o) => o.text().includes("Detroit"))!
      .trigger("mousedown");

    await toInput.setValue("Austin");
    await toInput.trigger("input");
    await wrapper
      .findAll("li")
      .find((o) => o.text().includes("Austin"))!
      .trigger("mousedown");

    await salaryInput.setValue("70,000");
    await salaryInput.trigger("input");

    const text = wrapper.text();
    expect(text).toContain("you'd need");
    expect(text).toContain("$68,465");
    expect(text).toContain("The Basket");
  });
});
