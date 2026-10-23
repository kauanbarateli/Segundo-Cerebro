"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { browserFinanceSeriesClient, type FinanceSeriesClient, type SeriesClientFailure, type SeriesClientReply } from "@/lib/finance-series-client";
import type { SeriesJournalSnapshot } from "@/lib/finance-series-journal";

export interface SeriesLiveSession { client: FinanceSeriesClient; current(): boolean }
export type SeriesRun = <T>(session: SeriesLiveSession, work: (client: FinanceSeriesClient) => Promise<SeriesClientReply<T>>) => Promise<SeriesClientReply<T>>;
const changed = (): SeriesClientFailure => ({ ok: false, code: "session-changed", message: "A sessão mudou. Recarregue para continuar na sua conta." });
const blocked = (): SeriesClientFailure => ({ ok: false, code: "pending", message: "Aguarde a ação atual antes de continuar." });
interface ChannelState { session: SeriesLiveSession | null; phase: "loading" | "ready" | "error"; available: boolean; journal: SeriesJournalSnapshot | null; failure: SeriesClientFailure | null }
/** The lifetime belongs to the authenticated owner + provider service, not a row. */
export function useSeriesChannel(ownerId: string, providerEpoch: number, closing: boolean) {
  const latestIdentity = useRef({ ownerId, providerEpoch, closing }); latestIdentity.current = { ownerId, providerEpoch, closing };
  const life = useRef<{ generation: number; session: SeriesLiveSession | null; busy: boolean }>({ generation: 0, session: null, busy: false });
  const [state, setState] = useState<ChannelState>({ session: null, phase: "loading", available: false, journal: null, failure: null }), [busy, setBusy] = useState(false);
  useEffect(() => {
    const instance = life.current;
    const generation = ++instance.generation; let alive = !closing, client: FinanceSeriesClient | null = null, unsubscribe: () => void = () => undefined;
    const current = () => alive && instance.generation === generation && latestIdentity.current.ownerId === ownerId && latestIdentity.current.providerEpoch === providerEpoch && !latestIdentity.current.closing;
    if (closing) { instance.session = null; return () => { alive = false; }; }
    const report = (failure: SeriesClientFailure) => { if (current()) setState(value => ({ ...value, phase: "error", failure })); };
    try {
      client = browserFinanceSeriesClient(ownerId, current); const session: SeriesLiveSession = { client, current }; instance.session = session; instance.busy = false; setBusy(false); setState({ session, phase: "loading", available: false, journal: null, failure: null });
      const initialize = async () => {
        const journal = await session.client.loadPending(); if (!current()) return;
        if (!journal.ok) { report(journal); return; }
        const availability = await session.client.availability(); if (!current()) return;
        if (!availability.ok) { setState({ session, phase: "error", available: false, journal: journal.result, failure: availability }); return; }
        setState({ session, phase: "ready", available: availability.result.available, journal: journal.result, failure: null });
      };
      void initialize().catch(() => { report({ ok: false, code: "unavailable", message: "Não foi possível abrir as séries. Recarregue esta área para tentar novamente." }); });
      unsubscribe = session.client.subscribe(() => {
        // Other tabs may change the local pending entry, never dispatch it here.
        void session.client.loadPending().then(reply => { if (!current()) return; if (reply.ok) setState(value => ({ ...value, journal: reply.result })); else report(reply); }).catch(() => { report({ ok: false, code: "journal-unavailable", message: "Não foi possível conferir a tentativa local. Nenhum novo envio deve ser iniciado." }); });
      });
    } catch { report({ ok: false, code: "journal-unavailable", message: "Este navegador não disponibilizou o registro seguro das séries. Seus outros lançamentos continuam disponíveis." }); }
    return () => { alive = false; unsubscribe(); client?.dispose(); if (instance.generation === generation) { instance.session = null; instance.busy = false; } };
  }, [ownerId, providerEpoch, closing]);

  const run = useCallback(async <T>(session: SeriesLiveSession, work: (client: FinanceSeriesClient) => Promise<SeriesClientReply<T>>): Promise<SeriesClientReply<T>> => {
    if (!session.current() || life.current.session !== session) return changed(); if (life.current.busy) return blocked();
    life.current.busy = true; setBusy(true); setState(value => ({ ...value, failure: null }));
    try {
      const reply = await work(session.client); if (!session.current() || life.current.session !== session) return changed();
      if (!reply.ok && reply.code === "session-changed") { setState(value => ({ ...value, phase: "error", failure: reply })); return reply; }
      if (!reply.ok && reply.code === "disabled") setState(value => ({ ...value, available: false }));
      const journal = await session.client.loadPending(); if (!session.current() || life.current.session !== session) return changed();
      if (journal.ok) setState(value => ({ ...value, journal: journal.result, failure: reply.ok ? null : reply }));
      else setState(value => ({ ...value, phase: "error", failure: journal }));
      return reply;
    } catch { if (!session.current() || life.current.session !== session) return changed(); const failure: SeriesClientFailure = { ok: false, code: "unavailable", message: "Não foi possível concluir esta ação. Confira a tentativa pendente antes de continuar." }; setState(value => ({ ...value, failure })); return failure; }
    finally { if (session.current() && life.current.session === session) { life.current.busy = false; setBusy(false); } }
  }, []);
  return { ...state, busy, run };
}
