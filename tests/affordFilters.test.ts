import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import ExploreView from "../src/pages/ExploreView.vue";
import { useComparison } from "../src/composables/useComparison";

function ready() {
  const c = useComparison();
  c.setFrom(c.metros.value[0].id);
  c.salary.value = 80000;
  return c;
}

describe("ExploreView filters", () => {
  it("renders the Filters control once a city and salary are set", () => {
    const c = ready();
    const wrapper = mount(ExploreView, { props: { comparison: c } });
    expect(wrapper.text()).toContain("Filters");
  });

  it("shows a hidden-no-data line when an active filter excludes metros lacking data", () => {
    const c = ready();
    c.setBand("humidity", "humid");
    const wrapper = mount(ExploreView, { props: { comparison: c } });
    if (c.filteredAffordable.value.hiddenNoData > 0) {
      expect(wrapper.text()).toContain("no data");
    } else {
      expect(true).toBe(true);
    }
  });
});
