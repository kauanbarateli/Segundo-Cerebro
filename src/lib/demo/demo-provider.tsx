"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { resolveAccess, type FeatureKey } from "../../core/access/resolve-access";
import { useDemoAccess } from "../navigation/demo-access-provider";
import { createDemoApplication, type DemoApplication } from "./application";
import type { DemoQueries, DemoQueryKey, QueryState } from "./types";

export const DEMO_LOGOUT_EVENT = "segundo-cerebro:demo-logout";
const featureForQuery: Record<DemoQueryKey, FeatureKey> = { tasks: "tarefas", captures: "capturar", habits: "habitos", finance: "financeiro", agenda: "calendario" };
const Context = createContext<(DemoApplication & { logout(): void; epoch: number }) | null>(null);
const disabled: QueryState<never> = { status: "idle", data: null, error: null };

export function DemoApplicationProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState(() => ({ app: createDemoApplication(), epoch: 0 }));
  const pathname = usePathname();
  const { policy, ready, resetDemo } = useDemoAccess();
  const projectAccess = resolveAccess("projetos", policy);
  const projectVisible = ready && projectAccess.allowed && projectAccess.visible;
  const exitHandled = useRef(false);
  const logout = useCallback(() => {
    // Synchronous notification cancels pending editor flushes before unmount.
    window.dispatchEvent(new CustomEvent(DEMO_LOGOUT_EVENT, { detail: { userId: session.app.userId } }));
    try { localStorage.removeItem(`segundo-cerebro:captures:drafts:v1:${encodeURIComponent(session.app.userId)}`); } catch { /* Storage may be unavailable. */ }
    session.app.dispose();
    resetDemo();
    setSession({ app: createDemoApplication(), epoch: session.epoch + 1 });
    exitHandled.current = true;
  }, [session, resetDemo]);
  useEffect(() => {
    if (pathname !== "/sair") exitHandled.current = false;
    else if (!exitHandled.current) logout();
  }, [pathname, logout]);
  useEffect(() => { void session.app.setProjectVisibility(projectVisible); }, [session.app, projectVisible]);
  return <Context.Provider value={{ ...session.app, logout, epoch: session.epoch }}>{children}</Context.Provider>;
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
