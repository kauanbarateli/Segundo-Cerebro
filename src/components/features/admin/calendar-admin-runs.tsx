"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { DEMO_LOGOUT_EVENT, useDemoApplication } from "@/lib/demo/demo-provider";
import { Button } from "@/components/ui/button";
import { paraCampoLocal } from "@/core/tempo";
import type { CalendarSyncRun } from "@/core/calendario";
export function CalendarAdminRuns() {
 const app = useDemoApplication(); const [runs, setRuns] = useState<CalendarSyncRun[]>([]), [error, setError] = useState(""), [busy, setBusy] = useState(false);
 const [closed, setClosed] = useState(false), lifetime = useRef({ generation: 0, closing: false, controller: null as AbortController | null });
 const end = useCallback(() => { const state = lifetime.current; state.closing = true; state.generation++; state.controller?.abort(); state.controller = null; setRuns([]); setError(""); setBusy(false); setClosed(true); }, []);
 const load = useCallback(async () => {
  const state = lifetime.current; if (state.closing || app.closing || app.mode !== "connected") return;
  state.controller?.abort(); const controller = new AbortController(), generation = ++state.generation; state.controller = controller;
  const alive = () => !state.closing && !app.closing && !controller.signal.aborted && generation === state.generation;
  setBusy(true); setError("");
  try { const response = await fetch("/api/calendar/admin-runs", { headers: { "X-Expected-User-ID": app.userId }, credentials: "same-origin", redirect: "error", cache: "no-store", signal: controller.signal }), value: unknown = await response.json(); if (!alive()) return;
   if (!response.ok || !value || typeof value !== "object" || !("runs" in value) || !Array.isArray(value.runs) || value.runs.some(run => !run || typeof run !== "object" || Object.keys(run).some(key => !["id", "user_id", "account_id", "channel", "status", "calendar_count", "event_count", "started_at", "finished_at"].includes(key)))) throw new Error("Não foi possível consultar as sincronizações."); setRuns(value.runs as CalendarSyncRun[]);
  } catch { if (alive()) { setRuns([]); setError("Não foi possível consultar as sincronizações. Confira seu acesso e tente novamente."); } }
  finally { if (alive()) setBusy(false); if (state.controller === controller) state.controller = null; }
 }, [app.userId, app.mode, app.closing]);
 useEffect(() => { lifetime.current.closing = false; lifetime.current.generation++; setClosed(false); const logout = (event: Event) => { const detail: unknown = (event as CustomEvent<unknown>).detail; if (detail && typeof detail === "object" && "userId" in detail && detail.userId === app.userId) end(); }; window.addEventListener(DEMO_LOGOUT_EVENT, logout); void load(); return () => { window.removeEventListener(DEMO_LOGOUT_EVENT, logout); end(); }; }, [load, app.userId, end]);
 if (app.mode !== "connected" || closed || app.closing) return null;
 return <section className="admin-section" aria-labelledby="calendar-runs-title"><h2 id="calendar-runs-title">Sincronizações da agenda</h2><p>Metadados de execução. O conteúdo dos compromissos não aparece na Administração.</p><Button disabled={busy} onClick={() => void load()}>{busy ? "Consultando…" : "Atualizar execuções"}</Button>{error && <p role="alert">{error}</p>}<ul>{runs.map(run => <li key={run.id}>{paraCampoLocal(run.started_at, "datetime").replace("T", " às ")} · {run.channel === "cron" ? "Agendada" : "Manual"} · {{ running: "Em andamento", complete: "Concluída", failed: "Falhou" }[run.status]} · {run.calendar_count} calendários · {run.event_count} eventos</li>)}</ul>{!busy && !error && !runs.length && <p>Nenhuma execução registrada.</p>}</section>;
}
