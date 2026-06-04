import type { Metro } from "../types";

export function searchMetros(metros: Metro[], query: string): Metro[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return metros
    .filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.short.toLowerCase().includes(q) ||
        m.states.some((s) => s.toLowerCase() === q),
    )
    .slice(0, 8);
}

export function findMetro(metros: Metro[], id: string): Metro | undefined {
  return metros.find((m) => m.id === id);
}
