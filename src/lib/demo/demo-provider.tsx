"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { resolveAccess, type FeatureKey } from "../../core/access/resolve-access";
import { useDemoAccess } from "../navigation/demo-access-provider";
import { createDemoApplication, type DemoApplication } from "./application";
import type { DemoQueries, DemoQueryKey, QueryState } from "./types";

export const DEMO_LOGOUT_EVENT = "segundo-cerebro:demo-logout";
export const DEMO_PRIVACY_KEY = "segundo-cerebro:demo:values-hidden:v1";
export type DemoScenario = "example" | "empty";
const featureForQuery: Record<DemoQueryKey, FeatureKey> = { tasks: "tarefas", captures: "capturar", habits: "habitos", finance: "financeiro", agenda: "calendario", knowledge: "conhecimento", projects: "projetos", drive: "drive", vault: "cofre", settings: "configuracoes" };
const Context = createContext<(DemoApplication & { logout(): void; epoch: number; scenario: DemoScenario; setScenario(value: DemoScenario): void }) | null>(null);
const PrivacyContext = createContext<{ valuesHidden: boolean; setValuesHidden(value: boolean): void } | null>(null);
const disabled: QueryState<never> = { status: "idle", data: null, error: null };

export function DemoApplicationProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState(() => ({ app: createDemoApplication(), epoch: 0, scenario: "example" as DemoScenario }));
  // Start concealed until the local preference is known; never flash saved-private values.
  const [valuesHidden, setHidden] = useState(true);
  const pathname = usePathname();
  const { policy, ready, resetDemo } = useDemoAccess();
  const projectAccess = resolveAccess("projetos", policy);
  const projectVisible = ready && projectAccess.allowed && projectAccess.visible;
  const exitHandled = useRef(false);
  const replaceSession = useCallback((scenario: DemoScenario) => {
    // Synchronous notification cancels pending editor flushes before unmount.
    window.dispatchEvent(new CustomEvent(DEMO_LOGOUT_EVENT, { detail: { userId: session.app.userId } }));
    try { localStorage.removeItem(`segundo-cerebro:captures:drafts:v1:${encodeURIComponent(session.app.userId)}`); } catch { /* Storage may be unavailable. */ }
    session.app.dispose();
    setSession({ app: createDemoApplication(scenario === "empty" ? { initial: {} } : {}), epoch: session.epoch + 1, scenario });
  }, [session]);
  const logout = useCallback(() => {
    replaceSession("example");
    resetDemo();
    setHidden(false);
    try { localStorage.removeItem(DEMO_PRIVACY_KEY); } catch { /* Keep the in-memory preference usable. */ }
    exitHandled.current = true;
  }, [replaceSession, resetDemo]);
  const setValuesHidden = useCallback((value: boolean) => {
    setHidden(value);
    try { localStorage.setItem(DEMO_PRIVACY_KEY, value ? "1" : "0"); } catch { /* Memory is enough for this visit. */ }
  }, []);
  useEffect(() => {
    try { setHidden(localStorage.getItem(DEMO_PRIVACY_KEY) === "1"); } catch { setHidden(false); }
    const sync = (event: StorageEvent) => {
      // Logout or clearing storage in another tab must not reveal this session.
      if (event.key === DEMO_PRIVACY_KEY && (event.newValue === "1" || event.newValue === "0")) setHidden(event.newValue === "1");
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  useEffect(() => {
    if (pathname !== "/sair") exitHandled.current = false;
    else if (!exitHandled.current) logout();
  }, [pathname, logout]);
  useEffect(() => { void session.app.setProjectVisibility(projectVisible); }, [session.app, projectVisible]);
  return <PrivacyContext.Provider value={{ valuesHidden, setValuesHidden }}><Context.Provider value={{ ...session.app, logout, epoch: session.epoch, scenario: session.scenario, setScenario: replaceSession }}>{children}</Context.Provider></PrivacyContext.Provider>;
}
export function useDemoPrivacy() {
  const privacy = useContext(PrivacyContext);
  if (!privacy) throw new Error("A preferência requer DemoApplicationProvider.");
  return privacy;
}
export function useDemoApplication() {
  const app = useContext(Context);
  if (!app) throw new Error("A demonstração requer DemoApplicationProvider.");
  return app;
}
export function useDemoQuery<K extends DemoQueryKey>(key: K, enabled = true): QueryState<DemoQueries[K]> & { retry(): void } {
  const { subscribe: subscribeQuery, getSnapshot, load } = useDemoApplication();
  const { policy, ready } = useDemoAccess();
  const active = enabled && ready && resolveAccess(featureForQuery[key], policy).allowed;
  const subscribe = useCallback((listener: () => void) => active ? subscribeQuery(key, listener) : () => undefined, [active, subscribeQuery, key]);
  const snapshot = useCallback(() => active ? getSnapshot(key) : disabled, [active, getSnapshot, key]);
  const state = useSyncExternalStore(subscribe, snapshot, () => disabled);
  useEffect(() => { if (active) void load(key); }, [active, load, key]);
  return { ...state, retry: () => { if (active) void load(key, true); } };
}
