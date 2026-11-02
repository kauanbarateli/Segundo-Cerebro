import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DESKTOP_DOCK_QUERY, DESKTOP_NAVIGATION_STORAGE_KEY, currentDesktopNavigation, effectiveDesktopNavigation,
  parseDesktopNavigation, readDesktopNavigation, saveDesktopNavigation, subscribeDesktopNavigation,
} from "../src/lib/navigation/desktop-navigation-preference";
import { SIDEBAR_STORAGE_KEY } from "../src/lib/navigation/sidebar-preference";

// Minimal browser doubles: Vitest runs in Node here and the project has no DOM environment.
type Listener = (event: { key: string | null; newValue: string | null; storageArea: unknown }) => void;
let store: Map<string, string>, blocked: boolean, attributes: Map<string, string>, observers: Set<() => void>, listeners: Set<Listener>;
const storage = {
  getItem: (key: string) => { if (blocked) throw new Error("bloqueado"); return store.get(key) ?? null; },
  setItem: (key: string, value: string) => { if (blocked) throw new Error("bloqueado"); store.set(key, value); },
};
beforeEach(() => {
  store = new Map(); blocked = false; attributes = new Map(); observers = new Set(); listeners = new Set();
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("document", { documentElement: {
    getAttribute: (key: string) => attributes.get(key) ?? null,
    setAttribute: (key: string, value: string) => { attributes.set(key, value); for (const notify of observers) notify(); },
  } });
  vi.stubGlobal("MutationObserver", class { constructor(private callback: () => void) {} observe() { observers.add(this.callback); } disconnect() { observers.delete(this.callback); } });
  vi.stubGlobal("window", {
    localStorage: storage,
    addEventListener: (_type: string, listener: Listener) => listeners.add(listener),
    removeEventListener: (_type: string, listener: Listener) => listeners.delete(listener),
  });
});
afterEach(() => { vi.unstubAllGlobals(); });
const storageEvent = (key: string | null, newValue: string | null) => { for (const listener of listeners) listener({ key, newValue, storageArea: storage }); };

describe("doc21: preferência local da navegação do computador", () => {
  it("N01: só o literal dock seleciona a dock", () => {
    for (const value of [null, undefined, "", "Dock", "sidebar", "true", '{"mode":"dock"}', 1, {}]) expect(parseDesktopNavigation(value)).toBe("sidebar");
    expect(parseDesktopNavigation("dock")).toBe("dock");
    expect(readDesktopNavigation()).toBe("sidebar");
    store.set(DESKTOP_NAVIGATION_STORAGE_KEY, "qualquer"); expect(readDesktopNavigation()).toBe("sidebar");
  });
  it("N07/N08: a dock só vale em computador elegível, sem apagar a escolha", () => {
    expect(effectiveDesktopNavigation("dock", true)).toBe("dock");
    expect(effectiveDesktopNavigation("dock", false)).toBe("sidebar");
    expect(effectiveDesktopNavigation("sidebar", true)).toBe("sidebar");
    expect(DESKTOP_DOCK_QUERY).toBe("(min-width: 1051px) and (any-pointer: fine)");
  });
  it("N03: salvar persiste e pinta o atributo sem tocar a escolha recolhida da lateral", () => {
    store.set(SIDEBAR_STORAGE_KEY, "collapsed");
    expect(saveDesktopNavigation("dock")).toEqual({ persisted: true });
    expect(store.get(DESKTOP_NAVIGATION_STORAGE_KEY)).toBe("dock");
    expect(currentDesktopNavigation()).toBe("dock");
    expect(store.get(SIDEBAR_STORAGE_KEY)).toBe("collapsed");
    expect(readDesktopNavigation()).toBe("dock");
  });
  it("N04: armazenamento bloqueado mantém a escolha na aba e informa que não persistiu", () => {
    blocked = true;
    expect(saveDesktopNavigation("dock")).toEqual({ persisted: false });
    expect(currentDesktopNavigation()).toBe("dock");
    expect(readDesktopNavigation()).toBe("dock");
    expect(store.size).toBe(0);
  });
  it("N06: outra aba repinta pelo evento storage; chave removida volta à lateral; outras chaves são ignoradas", () => {
    const seen: string[] = [];
    const stop = subscribeDesktopNavigation(() => seen.push(currentDesktopNavigation()));
    storageEvent(DESKTOP_NAVIGATION_STORAGE_KEY, "dock");
    expect(currentDesktopNavigation()).toBe("dock");
    storageEvent("outra-chave", "sidebar");
    expect(currentDesktopNavigation()).toBe("dock");
    storageEvent(DESKTOP_NAVIGATION_STORAGE_KEY, null);
    expect(currentDesktopNavigation()).toBe("sidebar");
    storageEvent(DESKTOP_NAVIGATION_STORAGE_KEY, "dock"); storageEvent(null, null);
    expect(currentDesktopNavigation()).toBe("sidebar");
    expect(seen).toEqual(["dock", "sidebar", "dock", "sidebar"]);
    stop();
    expect(listeners.size).toBe(0); expect(observers.size).toBe(0);
  });
  it("assinar e ler nunca escrevem no armazenamento", () => {
    const stop = subscribeDesktopNavigation(() => undefined);
    readDesktopNavigation(); currentDesktopNavigation(); stop();
    expect(store.size).toBe(0);
  });
});
