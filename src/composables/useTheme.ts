import { ref, computed, watch } from "vue";

/**
 * Theme controller — display-only state, no business logic.
 *
 * Three modes:
 *  - "auto"  → follow OS via prefers-color-scheme (no [data-theme] on <html>)
 *  - "light" → force light (<html data-theme="light">)
 *  - "dark"  → force dark  (<html data-theme="dark">)
 *
 * Persists choice to localStorage so the next page load respects it.
 * Module-scoped ref so every caller shares the same state.
 */

export type Theme = "auto" | "light" | "dark";

const STORAGE_KEY = "elsewhere:theme";
const VALID: Theme[] = ["auto", "light", "dark"];

function readStored(): Theme {
  if (typeof window === "undefined") return "auto";
  try {
    const raw = window.localStorage?.getItem(STORAGE_KEY);
    return raw && (VALID as string[]).includes(raw) ? (raw as Theme) : "auto";
  } catch {
    return "auto";
  }
}

function applyTheme(t: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (t === "auto") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", t);
}

const theme = ref<Theme>(readStored());
// apply once on module load so there's no flash before first component mounts
applyTheme(theme.value);

// Track the OS preference reactively so `auto` resolves correctly and the
// binary toggle knows which face to show before any explicit choice.
const systemDark = ref(
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
    : false,
);
if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", (e) => {
      systemDark.value = e.matches;
    });
}

// Resolved light/dark, accounting for `auto` → OS preference.
const isDark = computed(() =>
  theme.value === "auto" ? systemDark.value : theme.value === "dark",
);

watch(theme, (t) => {
  applyTheme(t);
  if (typeof window !== "undefined") {
    try {
      window.localStorage?.setItem(STORAGE_KEY, t);
    } catch {
      /* localStorage blocked — ignore, theme still applied to DOM */
    }
  }
});

export function useTheme() {
  function cycle() {
    theme.value =
      theme.value === "auto"
        ? "light"
        : theme.value === "light"
          ? "dark"
          : "auto";
  }

  function set(t: Theme) {
    theme.value = t;
  }

  // Binary flip for the sun/moon switcher — sets an explicit light/dark
  // based on what's currently showing (so the first flip leaves `auto`).
  function toggle() {
    theme.value = isDark.value ? "light" : "dark";
  }

  return { theme, isDark, cycle, set, toggle };
}
