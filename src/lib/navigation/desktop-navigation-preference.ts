/**
 * Browser-only presentation preference for the desktop navigation (doc21).
 * It is not an account preference: no Supabase write, no migration, no cookie and
 * no UUID. The head script in `src/lib/theme.ts` paints the same attribute before
 * React hydrates; CSS applies the dock only where `DESKTOP_DOCK_QUERY` matches,
 * so the saved choice never hides the sidebar on phones, tablets or touch-only
 * screens. The collapsed/expanded sidebar choice lives in its own key and is
 * never rewritten here, which is how returning to the sidebar restores it.
 */
export const DESKTOP_NAVIGATION_STORAGE_KEY = "segundo-cerebro-desktop-navigation-v1";
export const DESKTOP_NAVIGATION_ATTRIBUTE = "data-desktop-navigation";
/** RECOMENDADO (doc21 §2): beyond the compact sidebar range and with a precise pointer available. */
export const DESKTOP_DOCK_QUERY = "(min-width: 1051px) and (any-pointer: fine)";
export type DesktopNavigationMode = "sidebar" | "dock";
export const DEFAULT_DESKTOP_NAVIGATION: DesktopNavigationMode = "sidebar";

/** Strict: anything other than the literal "dock" — absent, invalid, JSON — is the sidebar. */
export function parseDesktopNavigation(value: unknown): DesktopNavigationMode {
  return value === "dock" ? "dock" : DEFAULT_DESKTOP_NAVIGATION;
}

/** Presentation actually shown: the saved dock applies only on an eligible desktop. */
export function effectiveDesktopNavigation(saved: DesktopNavigationMode, eligible: boolean): DesktopNavigationMode {
  return eligible && saved === "dock" ? "dock" : "sidebar";
}

let memoryChoice: DesktopNavigationMode | null = null;

/** Reads the saved choice; falls back to the in-tab memory copy when storage is unavailable. */
export function readDesktopNavigation(): DesktopNavigationMode {
  try {
    const stored = localStorage.getItem(DESKTOP_NAVIGATION_STORAGE_KEY);
    if (stored !== null) return parseDesktopNavigation(stored);
  } catch {
    // Storage unavailable: the tab keeps its own copy below.
  }
  return memoryChoice ?? DEFAULT_DESKTOP_NAVIGATION;
}

/** The attribute painted on <html>; it is the shared snapshot for every subscriber in the tab. */
export function currentDesktopNavigation(): DesktopNavigationMode {
  return parseDesktopNavigation(document.documentElement.getAttribute(DESKTOP_NAVIGATION_ATTRIBUTE));
}

export function applyDesktopNavigation(mode: DesktopNavigationMode): void {
  document.documentElement.setAttribute(DESKTOP_NAVIGATION_ATTRIBUTE, mode);
}

/**
 * Explicit user action only (Configurações → Aplicar navegação). Returns whether the
 * choice was persisted; when not, the current tab still applies it until reload.
 */
export function saveDesktopNavigation(mode: DesktopNavigationMode): { persisted: boolean } {
  memoryChoice = mode;
  applyDesktopNavigation(mode);
  try {
    localStorage.setItem(DESKTOP_NAVIGATION_STORAGE_KEY, mode);
    return { persisted: localStorage.getItem(DESKTOP_NAVIGATION_STORAGE_KEY) === mode };
  } catch {
    return { persisted: false };
  }
}

/**
 * Same tab: the attribute changes. Other tabs: the storage event repaints the
 * attribute (a removed key resolves to the sidebar). Never writes storage.
 */
export function subscribeDesktopNavigation(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: [DESKTOP_NAVIGATION_ATTRIBUTE] });
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== DESKTOP_NAVIGATION_STORAGE_KEY) return;
    if (event.storageArea !== null && event.storageArea !== window.localStorage) return;
    memoryChoice = null;
    const next = event.key === null ? DEFAULT_DESKTOP_NAVIGATION : parseDesktopNavigation(event.newValue);
    if (currentDesktopNavigation() !== next) applyDesktopNavigation(next);
  };
  window.addEventListener("storage", onStorage);
  return () => { observer.disconnect(); window.removeEventListener("storage", onStorage); };
}
