"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { useDemoApplication, useDemoPrivacy } from "@/lib/demo/demo-provider";
import type { DemoQueries } from "@/lib/demo/types";
import type { FinanceSeriesDetailView } from "@/core/financeiro/series/series-public-validation";
import type { FinanceSeriesPage, FinanceSeriesResult } from "@/core/financeiro/series/series-types";
import { civilLabel } from "../finance-model";
import { Money } from "../finance-panels";
import { SeriesDetailDrawer } from "./series-detail-drawer";
import { SeriesOperationDrawer } from "./series-operation-drawer";
import { SeriesPendingActions } from "./series-pending-actions";
import { SERIES_FREQUENCY_LABELS, SERIES_STATE_LABELS, type SeriesAction, type SeriesCatalog } from "./series-ui-model";
import { useSeriesChannel, type SeriesLiveSession } from "./use-series-channel";
import "./series.css";

export interface SeriesOpenRequest { ownerId: string; providerEpoch: number; seriesId: string; sequence: number }
export function FinanceSeriesPanel({ data, openRequest, onOpenHandled }: { data: DemoQueries["finance"]; openRequest?: SeriesOpenRequest | null; onOpenHandled?(): void }) {
  const app = useDemoApplication(), [restart, setRestart] = useState(0);
  if (app.mode !== "connected") return null;
  return <SeriesPanelSession key={`${app.userId}:${app.epoch}:${restart}`} data={data} reload={() => setRestart(value => value + 1)} openRequest={openRequest} onOpenHandled={onOpenHandled} />;
}
function SeriesPanelSession({ data, reload, openRequest, onOpenHandled }: { data: DemoQueries["finance"]; reload(): void; openRequest?: SeriesOpenRequest | null; onOpenHandled?(): void }) {
  const app = useDemoApplication(), privacy = useDemoPrivacy(), channel = useSeriesChannel(app.userId, app.epoch, app.closing), today = app.today();
  const { session: channelSession, phase: channelPhase, available: channelAvailable, busy: channelBusy, run: runChannel } = channel;
  const [page, setPage] = useState<FinanceSeriesPage | null>(null), [detail, setDetail] = useState<FinanceSeriesDetailView | null>(null), [action, setAction] = useState<{ kind: SeriesAction; detail: FinanceSeriesDetailView | null; occurrenceId: string | null } | null>(null);
  const [notice, setNotice] = useState<string | null>(null), [failure, setFailure] = useState<string | null>(null), [checkedCurrentData, setCheckedCurrentData] = useState(false);
  const [requestedTarget, setRequestedTarget] = useState<string | null>(null), handledOpen = useRef<number | null>(null);
  const latestOpen = useRef(openRequest); latestOpen.current = openRequest;
  const initialList = useRef<SeriesLiveSession | null>(null), trigger = useRef<HTMLElement | null>(null), panel = useRef<HTMLElement | null>(null), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const current = (session: SeriesLiveSession) => alive.current && session.current();
  async function loadPage(session: SeriesLiveSession, cursor: string | null = null) {
    const reply = await channel.run(session, client => client.page({ cursor, limit: 20 })); if (!current(session)) return;
    if (!reply.ok) { setFailure(reply.message); return; }
    setPage(previous => ({ ...reply.result, items: cursor === null ? reply.result.items : [...previous?.items ?? [], ...reply.result.items] })); setFailure(null);
  }
  useEffect(() => {
    const session = channelSession; if (!session || channelPhase !== "ready" || !channelAvailable || initialList.current === session) return;
    initialList.current = session; void (async () => {
      const reply = await runChannel(session, client => client.page({ cursor: null, limit: 20 })); if (!alive.current || !session.current()) return;
      if (reply.ok) setPage(reply.result); else setFailure(reply.message);
    })();
  }, [channelSession, channelPhase, channelAvailable, runChannel]);
  useEffect(() => {
    const session = channelSession;
    if (!openRequest || openRequest.ownerId !== app.userId || openRequest.providerEpoch !== app.epoch || !session || !page || channelPhase !== "ready" || !channelAvailable || channelBusy || handledOpen.current === openRequest.sequence) return;
    handledOpen.current = openRequest.sequence; const id = openRequest.seriesId; trigger.current = panel.current;
    void (async () => {
      const reply = await runChannel(session, client => client.detail(id)); if (!alive.current || !session.current() || latestOpen.current?.sequence !== openRequest.sequence) return;
      if (reply.ok) { setDetail(reply.result); setRequestedTarget(null); } else { setFailure(reply.message); setRequestedTarget(id); }
      onOpenHandled?.();
    })();
  }, [openRequest, app.userId, app.epoch, channelSession, channelPhase, channelAvailable, channelBusy, runChannel, page, onOpenHandled]);
  async function openDetail(id: string, target: HTMLElement) {
    const session = channel.session; if (!session || channel.busy) return; trigger.current = target; setFailure(null);
    const reply = await channel.run(session, client => client.detail(id)); if (!current(session)) return;
    if (reply.ok) { setDetail(reply.result); setRequestedTarget(null); } else setFailure(reply.message);
  }
  function openAction(kind: SeriesAction, source: FinanceSeriesDetailView | null, occurrenceId: string | null = null) {
    if (privacy.valuesHidden || channel.busy || channel.journal?.pending || channel.journal?.reconfirmRequired || !channel.available || channel.phase !== "ready") return;
    setDetail(null); setAction({ kind, detail: source, occurrenceId }); setFailure(null); setNotice(null);
  }
  async function saved(result: FinanceSeriesResult, session: SeriesLiveSession) {
    if (!current(session)) return; setAction(null); setDetail(null); setNotice(`Operação confirmada: ${result.affected.created} novas previsões, ${result.affected.restored} reativadas e ${result.affected.suppressed} suprimidas.`);
    try { await app.refreshActive(); if (!current(session)) return; await loadPage(session); if (!current(session)) return; }
    catch { if (current(session)) setFailure("A operação foi confirmada, mas a tela não pôde ser atualizada. Recarregue os dados antes de preparar outra."); }
  }
  async function checkCurrentData() {
    const session = channel.session; if (!session || channel.busy) return;
    try {
      const reply = await channel.run(session, async client => { await app.refreshActive(); if (!current(session)) return { ok: false as const, code: "session-changed" as const, message: "A sessão mudou. Recarregue para continuar." }; return client.page({ cursor: null, limit: 20 }); });
      if (!current(session)) return; if (!reply.ok) { setFailure(reply.message); return; } setPage(reply.result); setCheckedCurrentData(true); setNotice("Dados atuais carregados. Confira os lançamentos e as séries antes de confirmar sua reconferência.");
    }
    catch { if (current(session)) setFailure("Não foi possível conferir os dados atuais. Nenhuma nova tentativa foi preparada."); }
  }
  async function acknowledge() { const session = channel.session; if (!session || !checkedCurrentData || channel.busy) return; const reply = await channel.run(session, client => client.acknowledgeReconfirmation()); if (!current(session)) return; if (!reply.ok) setFailure(reply.message); else { setCheckedCurrentData(false); setNotice("Reconferência registrada. Uma nova operação exige sua própria prévia e confirmação."); } }
  const session = channel.session, pending = channel.journal?.pending ?? null;
  if (channel.phase === "ready" && !channel.available && !pending && !channel.journal?.reconfirmRequired && !channel.failure && !failure) return null;
  const catalog: SeriesCatalog = action?.detail ? { accounts: [...new Map([...data.accounts, ...action.detail.accounts].map(row => [row.id, row])).values()], categories: [...new Map([...data.categories, ...action.detail.categories].map(row => [row.id, row])).values()], tags: [...new Map([...(data.tags ?? []), ...action.detail.tags].map(row => [row.id, row])).values()] } : { ...data, tags: data.tags ?? [] };
  return <section className="series-panel" aria-label="Séries financeiras" ref={panel} tabIndex={-1}>
    <div className="series-heading"><h2>Dívidas e contas recorrentes</h2>{channel.phase === "ready" && channel.available && !pending && !channel.journal?.reconfirmRequired && <Button disabled={channel.busy} onClick={event => { trigger.current = event.currentTarget; if (privacy.valuesHidden) { privacy.setValuesHidden(false); setNotice("Valores exibidos. Escolha Nova série para preencher os dados."); } else openAction("create", null); }}>{privacy.valuesHidden ? <Icons.Eye /> : <Icons.Capture />}{privacy.valuesHidden ? "Exibir valores para nova série" : "Nova série"}</Button>}</div>
    <p className="finance-note">Contas que se repetem, com frequência e fim definidos. Novos lançamentos começam como previsão e só são preparados quando você confirma.</p>
    {channel.phase === "loading" && <p role="status" className="finance-note">Conferindo a gestão de séries…</p>}
    {(failure || channel.failure) && <p role="alert" className="finance-error">{failure ?? channel.failure?.message}</p>}
    {notice && <p role="status" className="finance-note">{notice}</p>}
    {requestedTarget && channel.available && channel.phase === "ready" && <Button disabled={channel.busy} onClick={event => { void openDetail(requestedTarget, panel.current ?? event.currentTarget); }}>Tentar abrir recorrência</Button>}
    {channel.phase === "error" && <Button onClick={reload}>Recarregar esta área</Button>}
    {pending && session && <SeriesPendingActions key={`${pending.epoch}:${pending.request.input.client_id}`} entry={pending} session={session} run={channel.run} busy={channel.busy || channel.phase !== "ready" || !channel.available} hidden={privacy.valuesHidden} onConfirmed={result => { void saved(result, session); }} />}
    {!channel.available && (pending || channel.journal?.reconfirmRequired) && <div className="series-recovery"><p className="finance-note">A gestão de séries está indisponível neste ambiente. A tentativa local permanece preservada; isso não confirma nem desfaz um envio anterior.</p><Button disabled={channel.busy} onClick={reload}>Conferir disponibilidade</Button></div>}
    {channel.journal?.reconfirmRequired && !pending && <div className="series-recovery"><strong>Confira seus dados antes de continuar</strong><p className="finance-note">O corpo de uma tentativa anterior foi removido ao sair ou trocar de conta. Isso não prova que o envio foi desfeito. Confira os lançamentos e as séries atuais antes de preparar outra operação.</p><div className="series-actions"><Button disabled={channel.busy || !session || !channel.available} onClick={() => { void checkCurrentData(); }}>Carregar dados atuais</Button><Button disabled={channel.busy || !checkedCurrentData || !session || !channel.available} onClick={() => { void acknowledge(); }}>Conferi os dados atuais</Button></div></div>}
    {channel.available && session && channel.phase === "ready" && <>
      {page?.items.length ? <ul className="series-list">{page.items.map(series => <li key={series.id}><div className="series-list-copy"><strong>{series.template.description}</strong><span className="finance-note">{SERIES_FREQUENCY_LABELS[series.frequency]} · {SERIES_STATE_LABELS[series.state]} · posições {series.first_index} a {series.total}</span><span className="finance-note">{series.ends_on ? `Até ${civilLabel(series.ends_on)}` : "Até a última posição"}{series.materialized_through ? ` · preparado até ${civilLabel(series.materialized_through)}` : " · ainda não preparado"}</span></div><Money value={series.template.amount_cents} hidden={privacy.valuesHidden} /><Button disabled={channel.busy} onClick={event => { void openDetail(series.id, event.currentTarget); }} aria-label={`Gerenciar ${series.template.description}`}>Gerenciar série</Button></li>)}</ul> : <p className="finance-note">{page ? "Nenhuma série gerida ainda. Crie uma recorrência ou parcelamento; grupos anteriores permanecem preservados." : "Carregando séries…"}</p>}
      <div className="series-actions"><Button disabled={channel.busy} onClick={() => { void loadPage(session); }}>Atualizar séries</Button>{page?.next_cursor && <Button disabled={channel.busy} onClick={() => { void loadPage(session, page.next_cursor); }}>Ver mais séries</Button>}</div>
    </>}
    {detail && session && channel.available && channel.phase === "ready" && <SeriesDetailDrawer detail={detail} hidden={privacy.valuesHidden} busy={channel.busy} blocked={!!pending || !!channel.journal?.reconfirmRequired} today={today} returnFocusRef={trigger} onClose={() => setDetail(null)} reveal={() => privacy.setValuesHidden(false)} onAction={(kind, occurrenceId) => openAction(kind, detail, occurrenceId)} />}
    {action && session && channel.available && channel.phase === "ready" && !privacy.valuesHidden && <SeriesOperationDrawer key={`${action.kind}:${action.detail?.series.id ?? "new"}:${action.occurrenceId ?? ""}`} action={action.kind} detail={action.detail} occurrenceId={action.occurrenceId} ownerId={app.userId} today={today} catalog={catalog} session={session} run={channel.run} busy={channel.busy} journal={channel.journal} returnFocusRef={trigger} onClose={() => setAction(null)} onSaved={result => { void saved(result, session); }} />}
  </section>;
}
