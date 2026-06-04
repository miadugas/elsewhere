// One-shot helper: convert the atlas palette to OKLCH.
// Accents stay faithful (same perceived color). Neutrals are unified to a
// single warm hue (toward the route-orange) at low chroma for cohesion, with
// chroma eased at the light/dark extremes. Run: node scripts/palette-oklch.mjs
import { converter, formatHex } from "culori";
const toOk = converter("oklch");

const NEUTRALS = new Set([
  "paper",
  "canvas",
  "paper-deep",
  "ink",
  "ink-soft",
  "surface-dark",
  "surface-dark-soft",
  "on-dark",
  "contour",
  "contour-ink",
]);

const LIGHT = {
  paper: "#f7f5ef",
  canvas: "#f7f5ef",
  "paper-deep": "#efeadc",
  ink: "#1a1d1a",
  "ink-soft": "#2b2f2b",
  "surface-dark": "#1a1d1a",
  "surface-dark-soft": "#2b2f2b",
  "on-dark": "#f7f5ef",
  terrain: "#3f7d4e",
  "terrain-soft": "#cfe1d2",
  water: "#2f6fb0",
  "water-soft": "#d6e4f2",
  route: "#e0662a",
  "route-soft": "#f6dcc8",
  contour: "#d8d2c2",
  "contour-ink": "#b7afa0",
  cheaper: "#2f8a5b",
  pricier: "#c2452f",
};
const DARK = {
  canvas: "#0a0d0a",
  paper: "#161a16",
  "paper-deep": "#1f2420",
  ink: "#ebe7da",
  "ink-soft": "#c8c0ad",
  "surface-dark": "#050706",
  "surface-dark-soft": "#14181a",
  "on-dark": "#f7f5ef",
  terrain: "#5fa872",
  "terrain-soft": "#1a2820",
  water: "#5b9ed8",
  "water-soft": "#14223a",
  route: "#f08a4a",
  "route-soft": "#3a1d10",
  contour: "#2d3330",
  "contour-ink": "#4a5450",
  cheaper: "#4eb780",
  pricier: "#e25e44",
};

// warm neutral hue — between paper's native yellow and the route-orange,
// so neutrals read warm/cohesive without turning peach.
const NEUTRAL_HUE = 74;
const r3 = (n) => Math.round(n * 1000) / 1000;
const r1 = (n) => Math.round(n * 10) / 10;

// neutral chroma eased by lightness: lowest at the extremes, gentle in mids
function neutralChroma(l) {
  if (l >= 0.9) return 0.006; // near-white paper
  if (l <= 0.18) return 0.008; // near-black slab
  return 0.01; // mid neutrals
}

function line(name, hex) {
  const c = toOk(hex);
  const L = r3(c.l);
  if (NEUTRALS.has(name)) {
    return `  --color-${name}: oklch(${L} ${neutralChroma(c.l)} ${NEUTRAL_HUE});`;
  }
  // accent: faithful
  const C = r3(c.c ?? 0);
  const H = r1(c.h ?? 0);
  return `  --color-${name}: oklch(${L} ${C} ${H});`;
}

function block(title, set) {
  console.log(`\n/* ${title} */`);
  for (const [name, hex] of Object.entries(set)) console.log(line(name, hex));
}
block("LIGHT", LIGHT);
block("DARK", DARK);
