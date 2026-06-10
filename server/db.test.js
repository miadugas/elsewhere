import { describe, it, expect } from "vitest";
import { isStale } from "./db.js";

const NOW = new Date("2026-06-09T12:00:00Z").getTime();
const days = (n) => n * 24 * 60 * 60 * 1000;

describe("isStale", () => {
  it("fresh within the 8-day cron window", () => {
    expect(isStale(new Date(NOW - days(2)), NOW)).toBe(false);
    expect(isStale(new Date(NOW - days(7)), NOW)).toBe(false);
  });
  it("stale past the window", () => {
    expect(isStale(new Date(NOW - days(9)), NOW)).toBe(true);
  });
  it("stale when the table has never been written", () => {
    expect(isStale(null, NOW)).toBe(true);
    expect(isStale(undefined, NOW)).toBe(true);
  });
});
