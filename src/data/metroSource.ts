import bundled from "./metros.json";
import type { Metro } from "../types";

export const BUNDLED = bundled as Metro[];
const CACHE_KEY = "elsewhere:metros:v1";

/** True only for a non-empty array whose first item looks like a Metro. */
export function isValidMetros(data: unknown): data is Metro[] {
  if (!Array.isArray(data) || data.length === 0) return false;
  const first = data[0] as { id?: unknown; rpp?: { overall?: unknown } };
  return (
    typeof first?.id === "string" && typeof first?.rpp?.overall === "number"
  );
}

/** Last successfully-fetched snapshot, or null if absent/corrupt/unavailable. */
export function readCache(): Metro[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { metros?: unknown };
    return isValidMetros(parsed?.metros) ? (parsed.metros as Metro[]) : null;
  } catch {
    return null;
  }
}

/** Persist a snapshot. Silently ignores quota / unavailable storage. */
export function writeCache(metros: Metro[]): void {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ fetchedAt: new Date().toISOString(), metros }),
    );
  } catch {
    /* private mode / quota — bundled fallback still works */
  }
}

/** Synchronous seed for instant first render: cache if present, else bundled. */
export function cachedOrBundled(): Metro[] {
  return readCache() ?? BUNDLED;
}

/** Live fetch. Resolves to validated metros, or null on ANY failure. Never throws. */
export async function fetchLiveMetros(
  apiBase: string,
): Promise<Metro[] | null> {
  try {
    const res = await fetch(`${apiBase}/api/metros`);
    if (!res.ok) return null;
    const data = await res.json();
    return isValidMetros(data) ? data : null;
  } catch {
    return null;
  }
}
