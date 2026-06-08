import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isValidMetros,
  readCache,
  writeCache,
  cachedOrBundled,
  fetchLiveMetros,
  BUNDLED,
} from "../src/data/metroSource";
import type { Metro } from "../src/types";

const sample: Metro[] = [
  {
    id: "x-ca",
    name: "X, CA",
    short: "X",
    states: ["CA"],
    rpp: { overall: 120, housing: 1, goods: 1, otherServices: 1 },
  },
];

beforeEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isValidMetros", () => {
  it("accepts a non-empty array whose first item has id + rpp.overall", () => {
    expect(isValidMetros(sample)).toBe(true);
  });
  it("rejects empty arrays, non-arrays, and malformed items", () => {
    expect(isValidMetros([])).toBe(false);
    expect(isValidMetros(null)).toBe(false);
    expect(isValidMetros("<html>")).toBe(false);
    expect(isValidMetros([{ foo: 1 }])).toBe(false);
  });
});

describe("cache", () => {
  it("cachedOrBundled returns the bundled data when cache is empty", () => {
    expect(cachedOrBundled()).toBe(BUNDLED);
  });
  it("writeCache then readCache round-trips valid data", () => {
    writeCache(sample);
    expect(readCache()).toEqual(sample);
    expect(cachedOrBundled()).toEqual(sample);
  });
  it("readCache returns null for a corrupt cache entry", () => {
    localStorage.setItem("elsewhere:metros:v1", "{not json");
    expect(readCache()).toBeNull();
  });
});

describe("fetchLiveMetros", () => {
  it("returns the metros on a valid 200 response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => sample }),
    );
    expect(await fetchLiveMetros("https://api.test")).toEqual(sample);
  });
  it("returns null on a non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: async () => sample }),
    );
    expect(await fetchLiveMetros("https://api.test")).toBeNull();
  });
  it("returns null on a malformed payload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ nope: 1 }) }),
    );
    expect(await fetchLiveMetros("https://api.test")).toBeNull();
  });
  it("returns null when fetch rejects (offline)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await fetchLiveMetros("https://api.test")).toBeNull();
  });
});
