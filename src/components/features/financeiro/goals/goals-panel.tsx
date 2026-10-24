"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Icons } from "@/components/ui/icons";
import type { FinancialGoal, GoalCommand } from "@/core/financeiro/goals/goal-types";
import type { FinanceGoalsClient, GoalAccountChoice, GoalDetailView, GoalListItem, GoalPageQuery, GoalReleasesView, GoalReservationsView } from "@/lib/finance-goals-client-contract";
import { GoalCard } from "./goal-card";
import { GoalDetail } from "./goal-detail";
import { GoalEditor } from "./goal-editor";
import { GoalHistory } from "./goal-history";
import { GoalOperationNotice } from "./goal-operation-notice";
import { goalIntent } from "./goals-ui-model";
import { useGoalsChannel } from "./use-goals-channel";
import "./goals.css";

export interface GoalsPanelProps {
  ownerId: string; client: FinanceGoalsClient; today: string; accounts: readonly GoalAccountChoice[];
  hidden: boolean; reveal(): void; createId(): string; compact?: boolean;
}
type Overlay = { kind: "editor"; goal: FinancialGoal | null; revision: string } | { kind: "detail"; detail: GoalDetailView } | { kind: "history"; id: string; page: GoalReservationsView; releases: { id: string; page: GoalReleasesView } | null };
/** Isolated composition. The production workspace, transport and journal remain unconnected. */
export function GoalsPanel(props: GoalsPanelProps) { return <GoalsSession key={`${props.ownerId}:${props.client.epoch}`} {...props} />; }
function GoalsSession({ ownerId, client, today, accounts, hidden, reveal, createId, compact = false }: GoalsPanelProps) {
  const channel = useGoalsChannel(ownerId, client), [overlay, setOverlay] = useState<Overlay | null>(null), [filter, setFilter] = useState<GoalPageQuery["archived"]>("active"), [highlightDetail, setHighlightDetail] = useState<GoalListItem | null>(null), [localError, setLocalError] = useState<string | null>(null);
  const trigger = useRef<HTMLElement | null>(null), section = useRef<HTMLElement>(null);
  useEffect(() => { setOverlay(null); setHighlightDetail(null); setLocalError(null); }, [client]);
  const page = channel.page, blocked = !channel.available || channel.busy || channel.needsRefresh || Boolean(channel.journal?.pending || channel.journal?.reconfirmRequired || channel.review);
  async function load(next = false, selectedFilter = filter) {
    setLocalError(null); const result = await channel.loadPage({ cursor: next ? page?.next_cursor ?? null : null, limit: 20, archived: selectedFilter }); if (!channel.current()) return;
    if (result.ok && !next) { setFilter(selectedFilter); setHighlightDetail(null); }
  }
  async function open(id: string, target: HTMLElement) {
    trigger.current = target; const reply = await channel.run(controller => controller.detail(id)); if (!channel.current()) return;
    if (reply.ok) { if (reply.result) setOverlay({ kind: "detail", detail: reply.result }); else setLocalError("Esta meta não está disponível para sua conta."); }
  }
  function edit(goal: FinancialGoal | null, target?: HTMLElement, revision = page?.finance_revision) {
    if (blocked || !revision) return; if (target) trigger.current = target; setOverlay({ kind: "editor", goal, revision });
  }
  function closeOverlay() { if (channel.current() && !channel.busy) { channel.cancelReview(); setOverlay(null); } }
  async function prepare(intent: GoalCommand) {
    const reply = await channel.run(controller => controller.prepare(intent)); if (!channel.current()) return;
    if (reply.ok && reply.result.kind === "confirmed") { setOverlay(null); channel.confirmed(); }
  }
  async function confirm() {
    const reply = await channel.run(controller => controller.confirm()); if (!channel.current()) return;
    if (reply.ok) { setOverlay(null); channel.confirmed(); }
  }
  async function reconcile() {
    const reply = await channel.run(controller => controller.reconcile()); if (!channel.current()) return;
    if (reply.ok) { setOverlay(null); channel.confirmed(); }
  }
  async function history(id: string, next = false) {
    const old = overlay?.kind === "history" && overlay.id === id ? overlay : null;
    const reply = await channel.run(controller => controller.reservations({ id, cursor: next ? old?.page.next_cursor ?? null : null, limit: 20 })); if (!channel.current() || !reply.ok) return;
    if (next && old && old.page.finance_revision !== reply.result.finance_revision) { setLocalError("O histórico mudou entre as páginas. Reabra os aportes para conferir."); return; }
    setOverlay({ kind: "history", id, page: next && old ? { ...reply.result, items: [...old.page.items, ...reply.result.items] } : reply.result, releases: null });
  }
  async function releases(id: string, next: boolean) {
    if (overlay?.kind !== "history") return; const original = overlay;
    const old = original.releases?.id === id ? original.releases.page : null;
    const reply = await channel.run(controller => controller.releases({ id, cursor: next ? old?.next_cursor ?? null : null, limit: 20 })); if (!channel.current() || !reply.ok) return;
    if (next && old && old.finance_revision !== reply.result.finance_revision) { setLocalError("As liberações mudaram entre as páginas. Consulte a reserva novamente."); return; }
    setOverlay(value => value === original ? { ...original, releases: { id, page: next && old ? { ...reply.result, items: [...old.items, ...reply.result.items] } : reply.result } } : value);
  }
  function secondary(command: "finance.goal.archive" | "finance.goal.restore" | "finance.goal.highlight") {
    if (blocked || overlay?.kind !== "detail") return; const { detail } = overlay;
    const common = { client_id: createId(), expected_finance_revision: detail.finance_revision };
    const intent = command === "finance.goal.highlight" ? goalIntent(command, { ...common, goal_id: detail.highlight?.goal_id === detail.goal.id ? null : detail.goal.id, expected_highlight_revision: detail.highlight?.revision ?? "0" }) : goalIntent(command, { ...common, goal_id: detail.goal.id, expected_revision: detail.goal.revision });
    void prepare(intent);
  }
  async function selectHighlight(id: string) {
    if (channel.busy || !page) return;
    if (id && !page.items.some(item => item.goal.id === id)) {
      const reply = await channel.run(controller => controller.detail(id)); if (!channel.current() || !reply.ok || !reply.result) return;
      setHighlightDetail(reply.result); return;
    }
    if (blocked) return;
    await prepare(goalIntent("finance.goal.highlight", { client_id: createId(), expected_finance_revision: page.finance_revision, goal_id: id || null, expected_highlight_revision: page.highlight?.revision ?? "0" }));
  }
  const notice = <GoalOperationNotice failure={channel.failure} journal={channel.journal} review={channel.review} busy={channel.busy} hidden={hidden} success={channel.success} canAcknowledge={channel.reviewedCurrent} confirm={() => void confirm()} cancel={channel.cancelReview} reconcile={() => void reconcile()} acknowledge={() => { if (channel.reviewedCurrent) void channel.run(controller => controller.acknowledgeReview()); }} />;
  const featured = page?.items.find(item => item.goal.id === page.highlight?.goal_id) ?? (highlightDetail?.goal.id === page?.highlight?.goal_id ? highlightDetail : null);
  const visible = compact ? featured ? [featured] : [] : page?.items ?? [];
  const ready = channel.phase === "ready" && channel.available;
  return <section className={`fg-surface ${compact ? "fg-featured" : "fg-planning"}`} aria-label="Metas financeiras" ref={section}>
    <header className="fg-section-head"><h2>Metas financeiras</h2><Button onClick={event => edit(null, event.currentTarget)} disabled={blocked || !page} aria-label="Nova meta financeira"><Icons.Capture />{!compact && "Nova meta"}</Button></header>
    {channel.phase === "loading" ? <div className="fg-loading" role="status" aria-busy="true"><span aria-hidden="true" />Carregando metas…</div> : <>
      {!overlay && notice}{!overlay && localError && <p role="alert" className="fg-form-error">{localError}</p>}
      {!channel.available && channel.phase !== "error" && <p>Metas financeiras não estão disponíveis nesta sessão.</p>}
      {channel.phase === "error" && <p>Não foi possível conferir suas metas. Nenhum dado foi substituído.</p>}
      <div className="fg-actions">{channel.phase === "error" || !channel.available ? <Button onClick={channel.reloadSession} disabled={channel.busy}>Conferir disponibilidade</Button> : <Button onClick={() => void load()} disabled={channel.busy}>Atualizar metas</Button>}{hidden && <Button onClick={reveal}>Exibir valores</Button>}{ready && !compact && <Field as="select" label="Mostrar metas" value={filter} onChange={event => void load(false, event.target.value as GoalPageQuery["archived"])} disabled={channel.busy}><option value="active">Ativas</option><option value="archived">Arquivadas</option><option value="all">Todas</option></Field>}</div>
      {ready && page && <>
        {compact && <Field as="select" label="Meta em destaque" value={page.highlight?.goal_id ?? ""} onChange={event => void selectHighlight(event.target.value)} disabled={blocked}><option value="">Sem destaque</option>{page.items.filter(item => item.goal.archived_at === null).map(item => <option key={item.goal.id} value={item.goal.id}>{item.goal.name}</option>)}{page.highlight?.goal_id && !page.items.some(item => item.goal.id === page.highlight?.goal_id) && <option value={page.highlight.goal_id}>Meta destacada fora desta página</option>}</Field>}
        {compact && page.highlight?.goal_id && !featured && <Button disabled={channel.busy} onClick={() => void selectHighlight(page.highlight!.goal_id!)}>Carregar meta em destaque</Button>}
        {visible.length ? <div className="fg-cards">{visible.map(item => <GoalCard key={item.goal.id} item={item} compact={compact} hidden={hidden} disabled={channel.busy} open={target => void open(item.goal.id, target)} edit={target => edit(item.goal, target)} />)}</div> : <div className="fg-empty"><p>{compact && page.items.length ? "Escolha uma meta para destacar." : "Defina uma conquista e acompanhe quanto já guardou."}</p><Button variant="primary" onClick={event => edit(null, event.currentTarget)} disabled={blocked}>{compact && page.items.length ? "Nova meta" : "Criar primeira meta"}</Button></div>}
        {page.next_cursor && <Button onClick={() => void load(true)} disabled={channel.busy}>Carregar mais metas</Button>}
      </>}
    </>}
    {ready && overlay && <Dialog open title={overlay.kind === "editor" ? overlay.goal ? "Editar meta financeira" : "Nova meta financeira" : overlay.kind === "history" ? "Aportes e liberações" : "Meta financeira"} onClose={closeOverlay} returnFocusRef={trigger} dismissible={!channel.busy} className="fg-dialog">
      {localError && <p className="fg-form-error" role="alert">{localError}</p>}
      {overlay.kind === "editor" ? <GoalEditor key={overlay.goal?.id ?? "new"} goal={overlay.goal} financeRevision={overlay.revision} hidden={hidden} reveal={reveal} blocked={blocked} busy={channel.busy} createId={createId} prepare={prepare} cancel={closeOverlay}>{notice}</GoalEditor> : overlay.kind === "detail" ? <GoalDetail detail={overlay.detail} review={channel.review} accounts={accounts} today={today} hidden={hidden} reveal={reveal} blocked={blocked} busy={channel.busy} createId={createId} prepare={prepare} edit={() => edit(overlay.detail.goal, undefined, overlay.detail.finance_revision)} history={() => void history(overlay.detail.goal.id)} secondary={secondary}>{notice}</GoalDetail> : <GoalHistory page={overlay.page} releases={overlay.releases} hidden={hidden} reveal={reveal} today={today} busy={channel.busy} blocked={blocked} createId={createId} prepare={prepare} more={() => void history(overlay.id, true)} showReleases={(id, next) => void releases(id, next)}>{notice}</GoalHistory>}
    </Dialog>}
  </section>;
}
