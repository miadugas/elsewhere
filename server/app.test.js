import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "./app.js";

const sampleMetro = {
  id: "denver-co",
  name: "Denver-Aurora-Centennial, CO",
  short: "Denver",
  states: ["CO"],
  rpp: { overall: 104.4, housing: 118.2, goods: 99.1, otherServices: 101.0 },
  pop: 2986000,
};

const okDb = {
  allMetros: async () => [sampleMetro],
  health: async () => ({
    ok: true,
    count: 1,
    updated_at: "2026-06-06T00:00:00.000Z",
  }),
};
const downDb = {
  allMetros: async () => {
    throw new Error("db down");
  },
  health: async () => {
    throw new Error("db down");
  },
};

describe("createApp", () => {
  it("GET /api/metros returns the metro array with nested rpp + cache header", async () => {
    const res = await request(createApp(okDb)).get("/api/metros");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].id).toBe("denver-co");
    expect(res.body[0].rpp.overall).toBe(104.4);
    expect(res.headers["cache-control"]).toContain("max-age=3600");
  });
  it("echoes an allowed CORS origin", async () => {
    const res = await request(createApp(okDb))
      .get("/api/metros")
      .set("Origin", "http://localhost:5173");
    expect(res.headers["access-control-allow-origin"]).toBe(
      "http://localhost:5173",
    );
  });
  it("GET /api/health returns ok + count + updated_at", async () => {
    const res = await request(createApp(okDb)).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      count: 1,
      updated_at: "2026-06-06T00:00:00.000Z",
    });
  });
  it("returns 503 when the database is unavailable", async () => {
    const res = await request(createApp(downDb)).get("/api/metros");
    expect(res.status).toBe(503);
  });
});
