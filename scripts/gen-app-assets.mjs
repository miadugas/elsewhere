// Renders native app icon + splash sources for @capacitor/assets from the
// brand SVG. Run via `node scripts/gen-app-assets.mjs`, then
// `npx capacitor-assets generate --ios`.
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const MIDNIGHT = "#060a1a"; // --color-canvas (dark) — the brand sky
await mkdir("assets", { recursive: true });

// 1024 app icon — oversample the 512 viewBox then downscale for crisp edges.
const icon = await sharp("public/icon.svg", { density: 384 })
  .resize(1024, 1024)
  .png()
  .toBuffer();
await sharp(icon).toFile("assets/icon.png");

// 2732 splash — the journey mark centered on the midnight sky. The icon's own
// midnight ground blends into the canvas, leaving the arc + stars. One sky
// reads as intentional in both themes, so light + dark share it.
const mark = await sharp(icon).resize(820, 820).toBuffer();
const splash = sharp({
  create: { width: 2732, height: 2732, channels: 4, background: MIDNIGHT },
})
  .composite([{ input: mark, gravity: "center" }])
  .png();
await splash.clone().toFile("assets/splash.png");
await splash.clone().toFile("assets/splash-dark.png");

console.log("wrote assets/icon.png, assets/splash.png, assets/splash-dark.png");
