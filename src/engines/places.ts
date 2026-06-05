import type { Metro } from "../types";

/** Lower tier = stronger match. Returns -1 when the metro doesn't match. */
function matchTier(m: Metro, q: string): number {
  const short = m.short.toLowerCase();
  if (short === q) return 0; // exact city name
  if (short.startsWith(q)) return 1; // city name prefix
  if (m.states.some((s) => s.toLowerCase() === q)) return 2; // state code
  if (short.includes(q) || m.name.toLowerCase().includes(q)) return 3; // anywhere
  return -1;
}

export function searchMetros(metros: Metro[], query: string): Metro[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return (
    metros
      .map((m) => ({ m, tier: matchTier(m, q) }))
      .filter((s) => s.tier >= 0)
      // best match tier first, then biggest metro (population) first
      .sort((a, b) => a.tier - b.tier || (b.m.pop ?? 0) - (a.m.pop ?? 0))
      .slice(0, 8)
      .map((s) => s.m)
  );
}

export function findMetro(metros: Metro[], id: string): Metro | undefined {
  return metros.find((m) => m.id === id);
}
