"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEMO_LOGOUT_EVENT, useDemoApplication } from "@/lib/demo/demo-provider";

/** One command channel for the Calendar and Integrações surfaces. Both read the
 * same `agenda` query and send the same domain commands; there is no second
 * account state. OAuth starts here and is fenced on logout/owner change. */
export function useCalendarCommands(onSessionEnd?: () => void) {
  const app = useDemoApplication();
  const { executeDomainCommand, refreshActive, retryPendingCommand } = app;
  const [busy, setBusy] = useState(false), [feedback, setFeedback] = useState("");
  const connection = useRef({ generation: 0, closing: false, controller: null as AbortController | null });
  const sessionEnd = useRef(onSessionEnd);
  useEffect(() => { sessionEnd.current = onSessionEnd; }, [onSessionEnd]);
  useEffect(() => {
    const state = connection.current; state.closing = false; state.generation++;
    const end = () => { state.closing = true; state.generation++; state.controller?.abort(); state.controller = null; sessionEnd.current?.(); setFeedback(""); setBusy(false); };
    const logout = (event: Event) => { const detail: unknown = (event as CustomEvent<unknown>).detail; if (detail && typeof detail === "object" && "userId" in detail && detail.userId === app.userId) end(); };
    window.addEventListener(DEMO_LOGOUT_EVENT, logout); return () => { window.removeEventListener(DEMO_LOGOUT_EVENT, logout); end(); };
  }, [app.userId]);
  const send = useCallback(async (command: string, input: Record<string, unknown>, resume = false) => {
    setBusy(true); setFeedback("");
    try {
      const retained = resume ? await retryPendingCommand({ command, input }) : undefined;
      if (retained === undefined) await executeDomainCommand(command, { ...input, client_id: crypto.randomUUID() });
      setFeedback("Agenda atualizada.");
    }
    catch (error) { setFeedback(error instanceof Error ? error.message : "Não foi possível confirmar a operação. Confira o estado e tente novamente."); }
    finally { await refreshActive(); setBusy(false); }
  }, [executeDomainCommand, refreshActive, retryPendingCommand]);
  async function connect(accountId?: string) {
    const state = connection.current; if (state.closing || app.closing || state.controller) return;
    const controller = new AbortController(), generation = ++state.generation; state.controller = controller;
    const alive = () => !state.closing && !app.closing && !controller.signal.aborted && state.generation === generation;
    setBusy(true); setFeedback(""); try { const response = await fetch("/api/calendar/oauth/start", { method: "POST", credentials: "same-origin", redirect: "error", cache: "no-store", signal: controller.signal, headers: { "Content-Type": "application/json", "X-Expected-User-ID": app.userId }, body: JSON.stringify({ client_id: crypto.randomUUID(), ...(accountId ? { account_id: accountId } : {}) }) }), result: unknown = await response.json(); if (!alive()) return;
      if (response.status === 409 && result && typeof result === "object" && "code" in result && result.code === "SESSION_CHANGED") { await app.clearSessionJournal(); if (alive()) window.location.reload(); return; }
      if (!response.ok || !result || typeof result !== "object" || !("authorization_url" in result) || typeof result.authorization_url !== "string") throw new Error(result && typeof result === "object" && "message" in result && typeof result.message === "string" ? result.message : "Não foi possível iniciar a conexão. Confira a configuração da integração e tente novamente.");
      const target = new URL(result.authorization_url); if (target.origin !== "https://accounts.google.com" || target.pathname !== "/o/oauth2/v2/auth") throw new Error("O endereço de autorização não foi confirmado."); window.location.assign(target.href);
    } catch (error) { if (alive()) { setFeedback(error instanceof Error ? error.message : "Não foi possível conectar a agenda."); setBusy(false); } } finally { if (state.controller === controller) state.controller = null; }
  }
  return { busy, setBusy, feedback, setFeedback, send, connect };
}
export type CalendarCommands = ReturnType<typeof useCalendarCommands>;
