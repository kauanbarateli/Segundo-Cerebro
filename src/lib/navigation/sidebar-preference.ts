/**
 * Browser-only presentation preference for the layout Codex sidebar. It is not a
 * domain preference: no account write, no migration and no demo-data key. The head
 * script in `src/lib/theme.ts` paints the same attribute before React hydrates.
 */
export const SIDEBAR_STORAGE_KEY = "segundo-cerebro-sidebar";
export const SIDEBAR_COMPACT_QUERY = "(max-width: 1050px)";
export const SIDEBAR_MOBILE_QUERY = "(max-width: 600px)";
export type SidebarState = "collapsed" | "expanded";

export function parseSidebarState(value: string | null): SidebarState | null {
  return value === "collapsed" || value === "expanded" ? value : null;
}

let memoryChoice: SidebarState | null = null;

/** A manual choice wins over the responsive fallback, including when storage fails. */
export function readSidebarChoice(): SidebarState | null {
  try {
    return parseSidebarState(localStorage.getItem(SIDEBAR_STORAGE_KEY)) ?? memoryChoice;
  } catch {
    return memoryChoice;
  }
}

export function saveSidebarChoice(state: SidebarState): void {
  memoryChoice = state;
  try {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, state);
  } catch {
    // The current tab keeps the choice in memory.
  }
}

export function resolveSidebarState(choice: SidebarState | null, compact: boolean): SidebarState {
  return choice ?? (compact ? "collapsed" : "expanded");
}

export function applySidebarState(state: SidebarState): void {
  document.documentElement.setAttribute("data-sidebar", state);
}
