"use client";

import { Fragment, createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { resolveAccess, type FeatureKey } from "../../core/access/resolve-access";
import { useDemoAccess } from "../navigation/demo-access-provider";
import { createDemoApplication } from "./application";
import { executeDemoDomainCommand } from "./domain-commands";
import { createConnectedApplication, DEMO_COMMAND_SESSION, type ClientApplication } from "./connected-application";
import type { DemoQueries, DemoQueryKey, QueryState } from "./types";

export const DEMO_LOGOUT_EVENT = "segundo-cerebro:demo-logout";
export const DEMO_PRIVACY_KEY = "segundo-cerebro:demo:values-hidden:v1";
export type DemoScenario = "example" | "empty";
const featureForQuery: Record<DemoQueryKey, FeatureKey> = { tasks: "tarefas", captures: "capturar", habits: "habitos", finance: "financeiro", agenda: "calendario", knowledge: "conhecimento", projects: "projetos", drive: "drive", vault: "cofre", settings: "configuracoes" };
const Context = createContext<(ClientApplication & { logout(): void; closing: boolean; epoch: number; scenario: DemoScenario; setScenario(value: DemoScenario): void }) | null>(null);
const PrivacyContext = createContext<{ valuesHidden: boolean; setValuesHidden(value: boolean): void } | null>(null);
const disabled: QueryState<never> = { status: "idle", data: null, error: null };

function application(serverUserId: string | undefined, scenario: DemoScenario): ClientApplication {
  if (serverUserId) return createConnectedApplication(serverUserId);
  const demo = createDemoApplication(scenario === "empty" ? { initial: {} } : {});
  return { ...demo, ...DEMO_COMMAND_SESSION, mode: "demo", refreshActive: async () => undefined, executeDomainCommand: (name, input) => executeDemoDomainCommand(demo, name, input) };
}
export function DemoApplicationProvider({ children, serverUserId, accountValuesHidden }: { children: ReactNode; serverUserId?: string; accountValuesHidden?: boolean }) {
  return <ApplicationSession key={serverUserId ?? "demo"} serverUserId={serverUserId} accountValuesHidden={accountValuesHidden}>{children}</ApplicationSession>;
}
function ApplicationSession({ children, serverUserId, accountValuesHidden }: { children: ReactNode; serverUserId?: string; accountValuesHidden?: boolean }) {
  const [session, setSession] = useState(() => ({ app: application(serverUserId, "example"), epoch: 0, scenario: "example" as DemoScenario }));
  // Start concealed until the local preference is known; never flash saved-private values.
  const [valuesHidden, setHidden] = useState(accountValuesHidden ?? true);
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);
  const pathname = usePathname();
  const { policy, ready, resetDemo } = useDemoAccess();
  const projectAccess = resolveAccess("projetos", policy);
  const projectVisible = ready && projectAccess.allowed && projectAccess.visible;
  const exitHandled = useRef(false);
  const ending = useRef<Promise<void> | null>(null);
  const logoutSubmitting = useRef(false);
  const lifetime = useRef({ generation: 0 });
  const replaceSession = useCallback((scenario: DemoScenario) => {
    if (serverUserId) return;
    // Synchronous notification cancels pending editor flushes before unmount.
    window.dispatchEvent(new CustomEvent(DEMO_LOGOUT_EVENT, { detail: { userId: session.app.userId } }));
    try { localStorage.removeItem(`segundo-cerebro:captures:drafts:v1:${encodeURIComponent(session.app.userId)}`); } catch { /* Storage may be unavailable. */ }
    session.app.dispose();
    setSession({ app: application(undefined, scenario), epoch: session.epoch + 1, scenario });
  }, [session, serverUserId]);
  const logout = useCallback(() => {
    // Conceal before invalidating local readers or waiting on journal cleanup.
    setHidden(true);
    if (serverUserId) {
      closingRef.current = true;
      setClosing(true);
      window.dispatchEvent(new CustomEvent(DEMO_LOGOUT_EVENT, { detail: { userId: session.app.userId } }));
      try { localStorage.removeItem(`segundo-cerebro:captures:drafts:v1:${encodeURIComponent(session.app.userId)}`); } catch { /* Storage may be unavailable. */ }
      ending.current ??= session.app.clearSessionJournal().catch(() => { /* Auth logout still proceeds if local storage is unavailable. */ });
    } else replaceSession("example");
    resetDemo();
    try { localStorage.removeItem(DEMO_PRIVACY_KEY); } catch { /* Keep the in-memory preference usable. */ }
    exitHandled.current = true;
  }, [replaceSession, resetDemo, serverUserId, session.app]);
  useEffect(() => { if (!serverUserId && exitHandled.current) setHidden(false); }, [serverUserId, session.epoch]);
  const setValuesHidden = useCallback((value: boolean) => {
    if (closingRef.current) return;
    setHidden(value);
    try { localStorage.setItem(DEMO_PRIVACY_KEY, value ? "1" : "0"); } catch { /* Memory is enough for this visit. */ }
  }, []);
  useEffect(() => {
    if (closingRef.current) { setHidden(true); return; }
    if (serverUserId) { setHidden(accountValuesHidden ?? true); return; }
    try { setHidden(localStorage.getItem(DEMO_PRIVACY_KEY) === "1"); } catch { setHidden(false); }
    const sync = (event: StorageEvent) => {
      // Logout or clearing storage in another tab must not reveal this session.
      if (event.key === DEMO_PRIVACY_KEY && (event.newValue === "1" || event.newValue === "0")) setHidden(event.newValue === "1");
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [serverUserId, accountValuesHidden]);
  useEffect(() => {
    if (serverUserId) return;
    if (pathname !== "/sair") exitHandled.current = false;
    else if (!exitHandled.current) logout();
  }, [pathname, logout, serverUserId]);
  useEffect(() => {
    if (!serverUserId) return;
    // Client-only hydration; restores a journal but never replays a command.
    void session.app.initializeJournal().catch(() => { /* The shared feedback explains unavailable storage. */ });
    const beforeLogout = (event: SubmitEvent) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement) || form.method.toLowerCase() !== "post") return;
      const target = new URL(form.action, window.location.href);
      if (target.origin !== window.location.origin || target.pathname !== "/auth/logout") return;
      event.preventDefault();
      if (logoutSubmitting.current) return;
      logoutSubmitting.current = true;
      // Capture runs before the shell's onSubmit. Close/abort synchronously, then
      // submit once, even if a blocked store or suspended tab prevents cleanup.
      logout();
      void Promise.resolve(ending.current).finally(() => {
        // Closing unmounts the shell's original form. This cookie-only endpoint
        // has no form fields; submit a fresh connected form after cleanup.
        const submission = document.createElement("form"); submission.action = target.href; submission.method = "post"; submission.hidden = true; document.body.appendChild(submission);
        HTMLFormElement.prototype.submit.call(submission);
      });
    };
    document.addEventListener("submit", beforeLogout, true);
    return () => document.removeEventListener("submit", beforeLogout, true);
  }, [serverUserId, session.app, logout]);
  useEffect(() => { void session.app.setProjectVisibility(projectVisible); }, [session.app, projectVisible]);
  useEffect(() => {
    const counter = lifetime.current;
    const generation = ++counter.generation;
    return () => {
      // Strict Mode reattaches the same instance synchronously; real unmounts dispose it.
      queueMicrotask(() => { if (generation === counter.generation) session.app.dispose(); });
    };
  }, [session.app]);
  useEffect(() => {
    if (!serverUserId) return;
    const refresh = () => { if (document.visibilityState === "visible") void session.app.refreshActive(); };
    window.addEventListener("focus", refresh); document.addEventListener("visibilitychange", refresh);
    return () => { window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [serverUserId, session.app]);
  return <PrivacyContext.Provider value={{ valuesHidden, setValuesHidden }}><Context.Provider value={{ ...session.app, logout, closing, epoch: session.epoch, scenario: session.scenario, setScenario: replaceSession }}>{closing ? <div className="shell-loading" role="status">Encerrando sua sessão…</div> : <Fragment key={session.epoch}>{children}</Fragment>}</Context.Provider></PrivacyContext.Provider>;
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
export function useOptionalDemoApplication() { return useContext(Context); }
export function useDemoQuery<K extends DemoQueryKey>(key: K, enabled = true): QueryState<DemoQueries[K]> & { retry(): void } {
  const { subscribe: subscribeQuery, getSnapshot, load, closing } = useDemoApplication();
  const { policy, ready } = useDemoAccess();
  const active = !closing && enabled && ready && resolveAccess(featureForQuery[key], policy).allowed;
  const subscribe = useCallback((listener: () => void) => active ? subscribeQuery(key, listener) : () => undefined, [active, subscribeQuery, key]);
  const snapshot = useCallback(() => active ? getSnapshot(key) : disabled, [active, getSnapshot, key]);
  const state = useSyncExternalStore(subscribe, snapshot, () => disabled);
  useEffect(() => { if (active) void load(key); }, [active, load, key]);
  return { ...state, retry: () => { if (active) void load(key, true); } };
}
