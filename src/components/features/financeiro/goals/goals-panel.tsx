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
import type { GoalImageHostBinding, GoalImagePreparedEditor } from "./goal-image-host-binding";
import { GoalImageSourceRecovery } from "./goal-image-source-recovery";
import "./goals.css";

export interface GoalsPanelProps {
  ownerId: string; client: FinanceGoalsClient; today: string; accounts: readonly GoalAccountChoice[];
  hidden: boolean; reveal(): void; createId(): string; compact?: boolean;
  silentUnavailable?: boolean; onResolved?(): Promise<void>;
  imageHost?: GoalImageHostBinding;
}
type Overlay = { kind: "editor"; goal: FinancialGoal | null; revision: string } | { kind: "detail"; detail: GoalDetailView } | { kind: "history"; id: string; page: GoalReservationsView; releases: { id: string; page: GoalReleasesView } | null };
/** Uses the supplied owner-bound client; availability and each operation remain server-authorized. */
export function GoalsPanel(props: GoalsPanelProps) { return <GoalsSession key={`${props.ownerId}:${props.client.epoch}`} {...props} />; }
function GoalsSession({ ownerId, client, today, accounts, hidden, reveal, createId, compact = false, silentUnavailable = false, onResolved, imageHost }: GoalsPanelProps) {
  const channel = useGoalsChannel(ownerId, client), [overlay, setOverlay] = useState<Overlay | null>(null), [filter, setFilter] = useState<GoalPageQuery["archived"]>("active"), [highlightDetail, setHighlightDetail] = useState<GoalListItem | null>(null), [localError, setLocalError] = useState<string | null>(null);
  const [imagePrepared, setImagePrepared] = useState<GoalImagePreparedEditor | null>(null), [imageLoading, setImageLoading] = useState(false), [sourceActive, setSourceActive] = useState(false), [imageError, setImageError] = useState<string | null>(null);
  const imageRequest = useRef<object | null>(null), overlayRef = useRef(overlay), latestImages = useRef({ imageHost, hidden }); overlayRef.current = overlay; latestImages.current = { imageHost, hidden };
  const trigger = useRef<HTMLElement | null>(null), section = useRef<HTMLElement>(null), sectionTitle = useRef<HTMLHeadingElement>(null);
  useEffect(() => { imageRequest.current = null; setOverlay(null); setHighlightDetail(null); setLocalError(null); setImagePrepared(null); setImageLoading(false); setSourceActive(false); setImageError(null); }, [client, imageHost]);
  useEffect(() => () => { imageRequest.current = null; imageHost?.conceal(); }, [imageHost]);
  useEffect(() => { if (hidden) { imageRequest.current = null; imageHost?.conceal(); setImageLoading(false); setSourceActive(false); } }, [hidden, imageHost]);
  const terminalAvailable = typeof client.terminal?.status === "function" && typeof client.terminal?.settle === "function";
  const page = channel.page, blocked = !channel.available || channel.busy || channel.needsRefresh || imageLoading || sourceActive || Boolean(channel.journal?.pending || channel.journal?.reconfirmRequired || channel.review);
  async function configureImages(target: Extract<Overlay, { kind: "editor" }>) {
    if (!imageHost || hidden || !channel.current() || channel.busy || imageRequest.current) return;
    const own = imageHost, token = {}; imageRequest.current = token; setImageLoading(true); setImageError(null); setSourceActive(false);
    const currentTarget = () => imageRequest.current === token && channel.current() && latestImages.current.imageHost === own && !latestImages.current.hidden && overlayRef.current === target;
    const current = () => currentTarget() && own.current();
    try {
      const prepared = await own.prepareEditor({ goalId: target.goal?.id ?? null, goalRevision: target.goal?.revision ?? null, baselineFileId: target.goal?.image_file_id ?? null }, channel.currentImageController);
      if (!current()) { if (currentTarget()) setImageError("A configuração da foto mudou. Reabra o Financeiro antes de revisar esta edição."); return; } setImagePrepared(prepared);
    } catch { if (currentTarget()) setImageError("Não foi possível conferir o envio da foto. Os registros foram preservados. Consulte novamente nesta sessão antes de revisar a meta."); }
    finally { if (currentTarget()) { imageRequest.current = null; setImageLoading(false); } }
  }
  async function load(next = false, selectedFilter = filter) {
    setLocalError(null);
    if (next && channel.needsRefresh) { setLocalError("Atualize a lista completa e confira os dados atuais antes de carregar outra página."); return; }
    // The channel keeps host refresh and page read inside its SAME exclusion.
    // A refusal leaves needsRefresh intact and never runs the Goals read.
    const result = await channel.loadPage({ cursor: next ? page?.next_cursor ?? null : null, limit: 20, archived: selectedFilter }, next ? undefined : onResolved); if (!channel.current()) return;
    if (result.ok && !next) { setFilter(selectedFilter); setHighlightDetail(null); }
  }
  async function open(id: string, target: HTMLElement) {
    imageRequest.current = null; imageHost?.conceal(); setImagePrepared(null); setSourceActive(false); setImageLoading(false);
    trigger.current = target; const reply = await channel.run(controller => controller.detail(id)); if (!channel.current()) return;
    if (reply.ok) { if (reply.result) setOverlay({ kind: "detail", detail: reply.result }); else setLocalError("Esta meta não está disponível para sua conta."); }
  }
  function edit(goal: FinancialGoal | null, target?: HTMLElement, revision = page?.finance_revision) {
    if (blocked || !revision) return; if (target) trigger.current = target;
    imageRequest.current = null; imageHost?.conceal(); setImagePrepared(null); setImageError(null); setSourceActive(false);
    const next: Extract<Overlay, { kind: "editor" }> = { kind: "editor", goal, revision }; overlayRef.current = next; setOverlay(next);
    if (imageHost && !hidden) void configureImages(next);
  }
  function closeOverlay() { if (channel.current() && !channel.busy) { imageRequest.current = null; imageHost?.conceal(); setImageLoading(false); setSourceActive(false); channel.cancelReview(); setOverlay(null); } }
  async function prepare(intent: GoalCommand, required = false) {
    const reply = await channel.run(controller => controller.prepare(intent));
    if (!channel.current() || !reply.ok) { if (required) throw new Error("GOAL_REVIEW_UNAVAILABLE"); return; }
    if (reply.result.kind === "confirmed") { setOverlay(null); channel.confirmed(); await refreshResolved(); }
  }
  async function prepareEditor(intent: GoalCommand) { await prepare(intent, true); }
  async function refreshResolved() {
    try { await onResolved?.(); return true; }
    catch { if (channel.current()) setLocalError("Não foi possível atualizar a tela. Carregue os dados atuais antes de continuar; isso não desfaz uma tentativa já resolvida."); return false; }
  }
  async function confirm() {
    const reply = await channel.run(controller => controller.confirm()); if (!channel.current()) return;
    if (reply.ok) { setOverlay(null); channel.confirmed(); await refreshResolved(); }
  }
  async function reconcile() {
    if (terminalAvailable) {
      const reply = await channel.run(controller => controller.attemptStatus()); if (!channel.current()) return;
      if (reply.ok && (reply.result.kind === "confirmed" || reply.result.kind === "closed")) { setOverlay(null); channel.resolved(reply.result.kind); await refreshResolved(); }
      return;
    }
    const reply = await channel.run(controller => controller.reconcile()); if (!channel.current()) return;
    if (reply.ok) { setOverlay(null); channel.confirmed(); await refreshResolved(); }
  }
  async function settleAttempt() {
    if (!terminalAvailable || !channel.journal?.pending) return;
    const reply = await channel.run(controller => controller.attemptSettle()); if (!channel.current()) return;
    if (reply.ok && (reply.result.kind === "confirmed" || reply.result.kind === "closed")) { setOverlay(null); channel.resolved(reply.result.kind); await refreshResolved(); }
  }
  async function acknowledge() {
    if (!channel.reviewedCurrent || channel.needsRefresh) return;
    const reply = await channel.run(controller => controller.acknowledgeReview());
    if (channel.current() && reply.ok) sectionTitle.current?.focus({ preventScroll: true });
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
  const notice = <GoalOperationNotice failure={channel.failure} journal={channel.journal} review={channel.review} busy={channel.busy} hidden={hidden} success={channel.success} resolution={channel.resolution} canAcknowledge={channel.reviewedCurrent && !channel.needsRefresh} confirm={() => void confirm()} cancel={channel.cancelReview} reconcile={() => void reconcile()} settle={terminalAvailable && channel.journal?.pending ? () => void settleAttempt() : undefined} acknowledge={() => void acknowledge()} />;
  const featured = page?.items.find(item => item.goal.id === page.highlight?.goal_id) ?? (highlightDetail?.goal.id === page?.highlight?.goal_id ? highlightDetail : null);
  const visible = compact ? featured ? [featured] : [] : page?.items ?? [];
  const ready = channel.phase === "ready" && channel.available;
  const overlayVisible = ready && overlay !== null;
  const imageCurrent = imagePrepared?.capability.isCurrent() === true;
  if (silentUnavailable && channel.phase === "ready" && !channel.available && !channel.journal?.pending && !channel.journal?.reconfirmRequired && !channel.failure && !localError) return null;
  return <section className={`fg-surface ${compact ? "fg-featured" : "fg-planning"}`} aria-label="Metas financeiras" ref={section}>
    <header className="fg-section-head"><h2 ref={sectionTitle} tabIndex={-1}>Metas financeiras</h2><Button onClick={event => edit(null, event.currentTarget)} disabled={blocked || !page} aria-label="Nova meta financeira"><Icons.Capture />{!compact && "Nova meta"}</Button></header>
    {channel.phase === "loading" ? <div className="fg-loading" role="status" aria-busy="true"><span aria-hidden="true" />Carregando metas…</div> : <>
      {!overlayVisible && notice}{!overlayVisible && localError && <p role="alert" className="fg-form-error">{localError}</p>}
      {!channel.available && channel.phase !== "error" && <p>Metas financeiras não estão disponíveis nesta sessão.</p>}
      {channel.phase === "error" && <p>Não foi possível conferir suas metas. Nenhum dado foi substituído.</p>}
      <div className="fg-actions fg-toolbar">{channel.phase === "error" || !channel.available ? <Button onClick={channel.reloadSession} disabled={channel.busy}>Conferir disponibilidade</Button> : <Button onClick={() => void load()} disabled={channel.busy}>Atualizar metas</Button>}{hidden && <Button onClick={reveal}>Exibir valores</Button>}{ready && !compact && <Field as="select" label="Mostrar metas" value={filter} onChange={event => void load(false, event.target.value as GoalPageQuery["archived"])} disabled={channel.busy}><option value="active">Ativas</option><option value="archived">Arquivadas</option><option value="all">Todas</option></Field>}</div>
      {ready && page && <>
        {compact && <Field as="select" label="Meta em destaque" value={page.highlight?.goal_id ?? ""} onChange={event => void selectHighlight(event.target.value)} disabled={blocked}><option value="">Sem destaque</option>{page.items.filter(item => item.goal.archived_at === null).map(item => <option key={item.goal.id} value={item.goal.id}>{item.goal.name}</option>)}{page.highlight?.goal_id && !page.items.some(item => item.goal.id === page.highlight?.goal_id) && <option value={page.highlight.goal_id}>Meta destacada fora desta página</option>}</Field>}
        {compact && page.highlight?.goal_id && !featured && <Button disabled={channel.busy} onClick={() => void selectHighlight(page.highlight!.goal_id!)}>Carregar meta em destaque</Button>}
        {visible.length ? <div className="fg-cards">{visible.map(item => <GoalCard key={item.goal.id} item={item} compact={compact} hidden={hidden} disabled={channel.busy} open={target => void open(item.goal.id, target)} edit={target => edit(item.goal, target)} />)}</div> : <div className="fg-empty"><p>{compact && page.items.length ? "Escolha uma meta para destacar." : "Defina uma conquista e acompanhe quanto já guardou."}</p><Button variant="primary" onClick={event => edit(null, event.currentTarget)} disabled={blocked}>{compact && page.items.length ? "Nova meta" : "Criar primeira meta"}</Button></div>}
        {page.next_cursor && <Button onClick={() => void load(true)} disabled={channel.busy}>Carregar mais metas</Button>}
      </>}
    </>}
    {ready && overlay && <Dialog open title={overlay.kind === "editor" ? overlay.goal ? "Editar meta financeira" : "Nova meta financeira" : overlay.kind === "history" ? "Aportes e liberações" : "Meta financeira"} onClose={closeOverlay} returnFocusRef={trigger} dismissible={!channel.busy} className="fg-dialog">
      {localError && <p className="fg-form-error" role="alert">{localError}</p>}
      {overlay.kind === "editor" ? <>
        {imageHost && imageError && <p className="fg-form-error" role="alert">{imageError}</p>}
        {imageHost && imageLoading && <p role="status" aria-busy="true">Conferindo o envio protegido desta sessão…</p>}
        {imageHost && !hidden && !imageLoading && !imageCurrent && !sourceActive && <Button disabled={channel.busy} onClick={() => void configureImages(overlay)}>Conferir envio da foto</Button>}
        {imageHost && !imagePrepared ? <div className="fg-reveal"><p>{hidden ? "Exiba os valores para preparar esta edição." : "Confira o envio local antes de revisar a meta. Isso preserva fotos pendentes de outras edições."}</p>{hidden && <Button onClick={reveal}>Exibir valores</Button>}<Button onClick={closeOverlay}>Cancelar</Button></div> : <GoalEditor key={overlay.goal?.id ?? "new"} goal={overlay.goal} financeRevision={overlay.revision} hidden={hidden} reveal={reveal} blocked={blocked || Boolean(imageHost && !imageCurrent)} busy={channel.busy} createId={createId} prepare={prepareEditor} cancel={closeOverlay} imageUpload={imagePrepared?.capability}>{notice}</GoalEditor>}
        {imageHost && !hidden && !imageLoading && imagePrepared?.source && (imageCurrent || sourceActive) && !channel.review && !channel.journal?.pending && !channel.journal?.reconfirmRequired && <GoalImageSourceRecovery source={imagePrepared.source} hidden={hidden} newImagesEnabled={imagePrepared.capability.newImagesEnabled !== false} current={() => channel.current() && imageHost.current()} onActive={() => setSourceActive(true)} onReturn={() => configureImages(overlay)} />}
      </> : overlay.kind === "detail" ? <GoalDetail detail={overlay.detail} review={channel.review} accounts={accounts} today={today} hidden={hidden} reveal={reveal} blocked={blocked} busy={channel.busy} createId={createId} prepare={prepare} cancel={closeOverlay} edit={() => edit(overlay.detail.goal, undefined, overlay.detail.finance_revision)} history={() => void history(overlay.detail.goal.id)} secondary={secondary}>{notice}</GoalDetail> : <GoalHistory page={overlay.page} releases={overlay.releases} hidden={hidden} reveal={reveal} today={today} busy={channel.busy} blocked={blocked} createId={createId} prepare={prepare} more={() => void history(overlay.id, true)} showReleases={(id, next) => void releases(id, next)}>{notice}</GoalHistory>}
    </Dialog>}
  </section>;
}
