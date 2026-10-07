/**
 * Browser preference, separate from domain rules and account preferences (T-027).
 * Adapted from novo-segundo-cerebro@151b2db, src/components/theme/tema-init.ts.
 * Keep this module free of `use client`: the server layout needs the script's
 * literal value, not a React client reference. Its stable bytes can be hashed
 * directly for the blocking Content Security Policy planned in T-014.
 */
export const THEME_STORAGE_KEY = "segundo-cerebro-theme";
export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

/**
 * Synchronous head script. No interpolation or request-specific values.
 * The preceding stylesheet supplies --canvas from the generated JSON tokens.
 * Reading it after resolving data-theme also colors the browser chrome correctly.
 */
export const THEME_INIT_SCRIPT = `(function(){var p;try{p=localStorage.getItem('segundo-cerebro-theme');}catch(e){}var t=p==='light'||p==='dark'?p:window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';var r=document.documentElement;r.setAttribute('data-theme',t);r.style.colorScheme=t;var m=document.querySelector('meta[name="theme-color"]');var c=getComputedStyle(r).getPropertyValue('--canvas').trim();if(m&&c)m.setAttribute('content',c);})();`;

export function parseThemePreference(value: string | null): ThemePreference {
  return value === "light" || value === "dark" ? value : "system";
}

export function readThemePreference(): ThemePreference {
  try {
    return parseThemePreference(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "system";
  }
}

export function saveThemePreference(preference: ThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // The current tab still honors the choice when persistence is unavailable.
  }
}

export function applyTheme(preference: ThemePreference): ResolvedTheme {
  const resolved = preference === "system"
    ? window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
    : preference;
  document.documentElement.setAttribute("data-theme", resolved);
  document.documentElement.style.colorScheme = resolved;
  const themeColor = document.querySelector('meta[name="theme-color"]');
  const canvas = getComputedStyle(document.documentElement).getPropertyValue("--canvas").trim();
  if (themeColor && canvas) themeColor.setAttribute("content", canvas);
  return resolved;
}
