import express from "express";
import cors from "cors";

// db is injected (real pool in index.js, a fake in tests). It must expose
// async allMetros() and async health().
export function createApp(db) {
  const allowed = (process.env.CORS_ORIGINS || "http://localhost:5173")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const app = express();
  app.use(cors({ origin: allowed }));

  app.get("/api/health", async (_req, res) => {
    try {
      res.json(await db.health());
    } catch {
      res.status(503).json({ ok: false });
    }
  });

  app.get("/api/metros", async (_req, res) => {
    try {
      const metros = await db.allMetros();
      res.set(
        "Cache-Control",
        "public, max-age=3600, stale-while-revalidate=86400",
      );
      res.json(metros);
    } catch {
      res.status(503).json({ error: "database unavailable" });
    }
  });

  return app;
}
