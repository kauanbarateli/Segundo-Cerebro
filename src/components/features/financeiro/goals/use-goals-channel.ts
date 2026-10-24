"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FinanceGoalsClient, GoalFailure, GoalJournalView, GoalPageQuery, GoalPageView, GoalReply, GoalReview } from "@/lib/finance-goals-client-contract";
import { createGoalsController } from "./goals-ui-model";

type Controller = ReturnType<typeof createGoalsController>;
type Resolution = "confirmed" | "closed";
interface State { client: FinanceGoalsClient; phase: "loading" | "ready" | "error"; available: boolean; journal: GoalJournalView | null; review: GoalReview | null; page: GoalPageView | null; failure: GoalFailure | null; busy: boolean; success: boolean; resolution: Resolution | null; needsRefresh: boolean; reviewedCurrent: boolean }
export function useGoalsChannel(ownerId: string, client: FinanceGoalsClient) {
  const [restart, setRestart] = useState(0);
  const active = useRef<Controller | null>(null);
  const running = useRef<Controller | null>(null);
  const [state, setState] = useState<State>(() => ({ client, phase: "loading", available: false, journal: null, review: null, page: null, failure: null, busy: false, success: false, resolution: null, needsRefresh: false, reviewedCurrent: false }));
  useEffect(() => {
    const controller = createGoalsController(ownerId, client); active.current = controller;
    const current = () => active.current === controller && controller.current();
    setState({ client, phase: "loading", available: false, journal: null, review: null, page: null, failure: null, busy: false, success: false, resolution: null, needsRefresh: false, reviewedCurrent: false });
    void (async () => {
      const opened = await controller.open(); if (!current()) return;
      if (!opened.ok) { setState(value => ({ ...value, phase: "error", failure: opened, ...controller.state() })); return; }
      const snapshot = controller.state();
      if (!snapshot.available) { setState(value => ({ ...value, ...snapshot, phase: "ready" })); return; }
      const reply = await controller.page({ cursor: null, limit: 20, archived: "active" }); if (!current()) return;
      setState(value => ({ ...value, ...controller.state(), phase: reply.ok ? "ready" : "error", page: reply.ok ? reply.result : null, failure: reply.ok ? null : reply }));
    })().catch(() => { if (current()) setState(value => ({ ...value, phase: "error", failure: { ok: false, code: "unavailable", message: "Não foi possível carregar Metas." } })); });
    return () => { controller.close(); if (active.current === controller) active.current = null; };
  }, [ownerId, client, restart]);
  const run = useCallback(async <T,>(work: (controller: Controller) => Promise<GoalReply<T>>): Promise<GoalReply<T>> => {
    const controller = active.current;
    if (!controller?.current() || !controller.matches(ownerId, client)) return { ok: false, code: "session-changed", message: "A sessão mudou. Reabra Metas para continuar." };
    if (running.current === controller) return { ok: false, code: "busy", message: "Aguarde a operação em andamento." }; running.current = controller;
    const current = () => active.current === controller && controller.current();
    setState(value => ({ ...value, busy: true, failure: null, success: false, resolution: null }));
    try {
      const reply = await work(controller); if (!current()) return { ok: false, code: "session-changed", message: "A sessão mudou. Reabra Metas para continuar." };
      setState(value => ({ ...value, ...controller.state(), failure: reply.ok ? null : reply })); return reply;
    } finally { if (running.current === controller) running.current = null; if (current()) setState(value => ({ ...value, busy: false })); }
  }, [ownerId, client]);
  const page = useCallback(async (query: GoalPageQuery, beforeRead?: () => Promise<void>) => {
    const controller = active.current;
    // Hold the SAME channel exclusion through the host refresh and page read.
    // An older host read cannot straddle a newer financial resolution.
    const reply = await run<GoalPageView>(async value => {
      try { await beforeRead?.(); }
      catch { return { ok: false, code: "unavailable", message: "Não foi possível atualizar a tela. Carregue os dados atuais antes de continuar." }; }
      if (active.current !== value || !value.current() || !value.matches(ownerId, client)) return { ok: false, code: "session-changed", message: "A sessão mudou. Reabra Metas para continuar." };
      return value.page(query);
    });
    if (reply.ok && controller === active.current && controller?.current()) setState(value => {
      const previous = value.page;
      if (query.cursor && previous && previous.finance_revision !== reply.result.finance_revision) return { ...value, failure: { ok: false, code: "conflict", message: "Os dados mudaram entre as páginas. Atualize a lista antes de continuar." } };
      return { ...value, phase: "ready", needsRefresh: false, reviewedCurrent: query.cursor === null || value.reviewedCurrent, page: query.cursor && previous ? { ...reply.result, items: [...previous.items, ...reply.result.items] } : reply.result };
    }); return reply;
  }, [run, ownerId, client]);
  const bound = active.current, valid = state.client === client && client.ownerId === ownerId && bound?.matches(ownerId, client) === true && bound.current();
  return {
    ...state, phase: valid ? state.phase : "loading" as const, page: valid ? state.page : null, review: valid ? state.review : null,
    journal: valid ? state.journal : null, available: valid && state.available, failure: valid ? state.failure : null, resolution: valid ? state.resolution : null,
    current: () => Boolean(valid && active.current === bound && bound?.current()),
    run, loadPage: page,
    reloadSession() { if (active.current?.matches(ownerId, client)) { active.current.close(); setRestart(value => value + 1); } },
    cancelReview() { if (!valid || active.current !== bound || !bound?.current()) return; bound.discardReview(); setState(value => ({ ...value, ...bound.state(), failure: null })); },
    confirmed() { if (valid && active.current === bound && bound?.current()) setState(value => ({ ...value, success: true, resolution: null, needsRefresh: true, reviewedCurrent: false })); },
    resolved(kind: Resolution) { if (valid && active.current === bound && bound?.current()) setState(value => ({ ...value, success: false, resolution: kind, needsRefresh: true, reviewedCurrent: false })); },
  };
}
