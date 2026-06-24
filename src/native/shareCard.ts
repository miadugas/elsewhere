// Renders the shareable result card to a PNG data URL (1080×1350, 4:5).
// Canvas-direct rather than rasterizing an SVG, so the loaded "Geist Variable"
// font applies reliably inside WKWebView (SVG-in-canvas drops unembedded fonts).

export interface ShareCardData {
  fromShort: string;
  toShort: string;
  fromSalary: number;
  requiredSalary: number;
  pct: number;
}

const W = 1080;
const H = 1350;
const FAMILY =
  '"Geist Variable", ui-sans-serif, system-ui, -apple-system, sans-serif';

const INK = "#f3f7fc";
const INK_SOFT = "#a7b0c2";
const MUTED = "#828ba1";
const BLUE = "#79a9f4";
const CHEAPER = "#4ec58a";
const PRICIER = "#f2864e";

const money = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

export async function renderShareCard(d: ShareCardData): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context unavailable");

  await ensureFonts();

  // ── midnight sky ──
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#0e1533");
  sky.addColorStop(1, "#06091a");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // ── stars ──
  const stars: [number, number, number, number][] = [
    [190, 238, 4, 0.5],
    [396, 172, 3.2, 0.35],
    [686, 190, 3.8, 0.4],
    [889, 266, 3.2, 0.3],
    [524, 136, 2.8, 0.45],
    [962, 396, 3.2, 0.28],
  ];
  for (const [x, y, r, a] of stars) {
    ctx.globalAlpha = a;
    ctx.fillStyle = "#e9eff6";
    disc(ctx, x, y, r);
  }
  ctx.globalAlpha = 1;

  // ── header ──
  ctx.textAlign = "left";
  ctx.fillStyle = "#eaf0f7";
  ctx.font = `800 48px ${FAMILY}`;
  ctx.fillText("Elsewhere", 96, 158);
  ctx.fillStyle = MUTED;
  ctx.font = `700 20px ${FAMILY}`;
  track(ctx, 4);
  ctx.fillText("COST OF LIVING PARITY", 97, 198);
  track(ctx, 0);

  // ── hero: the number gets the whole stage now ──
  ctx.textAlign = "center";

  ctx.fillStyle = MUTED;
  ctx.font = `700 26px ${FAMILY}`;
  track(ctx, 6);
  ctx.fillText(`YOU'D NEED IN ${d.toShort.toUpperCase()}`, 540, 486);
  track(ctx, 0);

  ctx.fillStyle = INK;
  track(ctx, -3);
  const big = money(d.requiredSalary);
  const bigSize = fitFont(ctx, big, 900, 224, 936);
  ctx.font = `900 ${bigSize}px ${FAMILY}`;
  ctx.fillText(big, 540, 712);
  track(ctx, 0);

  ctx.fillStyle = INK_SOFT;
  ctx.font = `500 33px ${FAMILY}`;
  ctx.fillText(`to match ${money(d.fromSalary)} in ${d.fromShort}`, 540, 786);

  // ── delta pill ──
  const cheaper = d.pct < 0;
  const pctText = `${Math.abs(Math.round(d.pct * 100))}% ${
    cheaper ? "cheaper" : "pricier"
  }`;
  drawPill(ctx, 540, 862, pctText, cheaper);

  // ── footer ──
  ctx.textAlign = "center";
  ctx.fillStyle = INK_SOFT;
  ctx.font = `500 26px ${FAMILY}`;
  ctx.fillText("The salary that keeps your life the same.", 540, 1210);
  ctx.fillStyle = BLUE;
  ctx.font = `700 24px ${FAMILY}`;
  track(ctx, 1);
  ctx.fillText("elsewhere.miacodes.com", 540, 1256);
  track(ctx, 0);

  return canvas.toDataURL("image/png");
}

// ── helpers ──

function disc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

// letterSpacing is widely supported in WKWebView (iOS 16+) but not in every
// TS DOM lib version — set it through a loose cast.
function track(ctx: CanvasRenderingContext2D, px: number) {
  (ctx as unknown as { letterSpacing: string }).letterSpacing = `${px}px`;
}

// largest font size (stepping down from `max`) at which `text` fits within
// `maxWidth` — keeps the hero number as big as the card allows without
// clipping a longer figure. Measures at the ctx's current letterSpacing.
function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  weight: number,
  max: number,
  maxWidth: number,
) {
  let size = max;
  ctx.font = `${weight} ${size}px ${FAMILY}`;
  while (size > 96 && ctx.measureText(text).width > maxWidth) {
    size -= 4;
    ctx.font = `${weight} ${size}px ${FAMILY}`;
  }
  return size;
}

function drawPill(
  ctx: CanvasRenderingContext2D,
  cx: number,
  top: number,
  text: string,
  cheaper: boolean,
) {
  const h = 88,
    padX = 44,
    gap = 18,
    tri = 26;
  ctx.font = `800 30px ${FAMILY}`;
  track(ctx, 0);
  ctx.textAlign = "left";
  const textWidth = ctx.measureText(text).width;
  const w = padX * 2 + tri + gap + textWidth;
  const x = cx - w / 2;
  const inkColor = cheaper ? "#06231a" : "#2a1402";

  ctx.fillStyle = cheaper ? CHEAPER : PRICIER;
  roundRect(ctx, x, top, w, h, h / 2);
  ctx.fill();

  const triX = x + padX;
  const midY = top + h / 2;
  ctx.fillStyle = inkColor;
  ctx.beginPath();
  if (cheaper) {
    ctx.moveTo(triX, midY - 6);
    ctx.lineTo(triX + tri, midY - 6);
    ctx.lineTo(triX + tri / 2, midY + 9);
  } else {
    ctx.moveTo(triX, midY + 6);
    ctx.lineTo(triX + tri, midY + 6);
    ctx.lineTo(triX + tri / 2, midY - 9);
  }
  ctx.closePath();
  ctx.fill();

  ctx.textBaseline = "middle";
  ctx.fillStyle = inkColor;
  ctx.fillText(text, triX + tri + gap, midY + 2);
  ctx.textBaseline = "alphabetic";
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

async function ensureFonts() {
  if (typeof document === "undefined" || !document.fonts) return;
  try {
    await Promise.all(
      ["500", "600", "700", "800", "900"].map((w) =>
        document.fonts.load(`${w} 100px "Geist Variable"`),
      ),
    );
    await document.fonts.ready;
  } catch {
    /* fall back to system sans — better a rendered card than none */
  }
}
