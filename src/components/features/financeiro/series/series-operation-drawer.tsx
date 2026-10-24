"use client";
import { useEffect, useRef, useState, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/dialog";
import { Icons } from "@/components/ui/icons";
import { ErroDeDominio } from "@/core/contracts/base";
import { decodeFinanceSeriesCommand } from "@/core/financeiro/series/series-validation";
import type { FinanceSeriesDetailView } from "@/core/financeiro/series/series-public-validation";
import type { FinanceSeriesCommand, FinanceSeriesResult } from "@/core/financeiro/series/series-types";
import type { FinanceSeriesPreview } from "@/core/financeiro/series/series-preview-types";
import type { SeriesJournalSnapshot } from "@/lib/finance-series-journal";
import { FinanceFormError, type FinanceErrors } from "../finance-form";
import { civilLabel } from "../finance-model";
import { Money } from "../finance-panels";
import { SeriesFields } from "./series-fields";
import { SeriesPendingActions } from "./series-pending-actions";
import { initialSeriesForm, SERIES_ACTION_LABELS, SERIES_FREQUENCY_LABELS, seriesEffectReview, seriesIntent, type SeriesAction, type SeriesCatalog, type SeriesEffectReview } from "./series-ui-model";
import type { SeriesLiveSession, SeriesRun } from "./use-series-channel";

type Review = Extract<FinanceSeriesPreview, { kind: "review" }>;
interface Props { action: SeriesAction; detail: FinanceSeriesDetailView | null; occurrenceId?: string | null; ownerId: string; today: string; catalog: SeriesCatalog; session: SeriesLiveSession; run: SeriesRun; busy: boolean; journal: SeriesJournalSnapshot | null; returnFocusRef: RefObject<HTMLElement | null>; onClose(): void; onSaved(result: FinanceSeriesResult): void }
export function SeriesOperationDrawer({ action, detail, occurrenceId = null, ownerId, today, catalog, session, run, busy, journal, returnFocusRef, onClose, onSaved }: Props) {
  const [form, setForm] = useState(() => initialSeriesForm(today, detail, occurrenceId)), [errors, setErrors] = useState<FinanceErrors>({}), [failure, setFailure] = useState<string | null>(null);
  const [request, setRequest] = useState<FinanceSeriesCommand | null>(null), [review, setReview] = useState<Review | null>(null), [effects, setEffects] = useState<SeriesEffectReview | null>(null), [acknowledged, setAcknowledged] = useState(false);
  const intention = useRef<string | null>(null), alive = useRef(true), initialFocusRef = useRef<HTMLInputElement | null>(null), reviewFocusRef = useRef<HTMLHeadingElement | null>(null), errorRef = useRef<HTMLParagraphElement | null>(null), fieldsRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    const target = review ? reviewFocusRef.current : initialFocusRef.current ?? fieldsRef.current?.querySelector<HTMLElement>('input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])') ?? fieldsRef.current;
    target?.focus({ preventScroll: true });
  }, [review]);
  useEffect(() => { if (failure) errorRef.current?.focus({ preventScroll: true }); }, [failure]);
  useEffect(() => { if (Object.keys(errors).length) fieldsRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus({ preventScroll: true }); }, [errors]);
  const current = () => alive.current && session.current();
  const pending = journal?.pending ?? null;
  async function fetchReview(next: FinanceSeriesCommand) {
    const reply = await run(session, client => client.preview(next)); if (!current()) return;
    if (!reply.ok) { setFailure(reply.message); return; }
    if (reply.result.kind === "confirmed") { onSaved(reply.result.result); return; }
    setReview(reply.result); setAcknowledged(false);
    try { setEffects(seriesEffectReview(reply.result, next, ownerId)); }
    catch (error) { setEffects(null); setFailure(error instanceof ErroDeDominio ? error.message : "Confira os dados atuais e as competências antes de continuar."); }
  }
  async function prepare() {
    if (busy || pending || !current()) return; setErrors({}); setFailure(null);
    try {
      intention.current ??= crypto.randomUUID(); const next = seriesIntent({ form, action, detail, occurrenceId, catalog, today, clientId: intention.current }); setRequest(next); await fetchReview(next); if (!current()) return;
    } catch (error) { if (!current()) return; if (error instanceof FinanceFormError) setErrors(error.fields); else setFailure("Confira os campos e as datas antes de preparar a prévia."); }
  }
  async function reconfirm() {
    if (!request || !review || busy || pending || !current()) return;
    const next = structuredClone(request); next.input.expected_finance_revision = review.revisions.observed_finance;
    if (next.command !== "finance.recurring.create") { if (review.revisions.observed_series === null) return; next.input.expected_revision = review.revisions.observed_series; }
    const decoded = decodeFinanceSeriesCommand(next); setRequest(decoded); setFailure(null); setAcknowledged(false); await fetchReview(decoded); if (!current()) return;
  }
  async function commit() {
    if (!request || !review || review.consistency !== "same" || !effects || !acknowledged || busy || pending || !current()) return;
    setFailure(null); const reply = await run(session, client => client.execute(request)); if (!current()) return;
    if (reply.ok) onSaved(reply.result);
    else { setFailure(reply.message); if (reply.code === "conflict") { setReview(null); setEffects(null); setAcknowledged(false); } }
  }
  function back() { if (busy || pending) return; setReview(null); setEffects(null); setFailure(null); setAcknowledged(false); }
  const destructive = action === "end" || action === "occurrence.cancel";
  const chosenTemplate = request?.command === "finance.recurring.create" ? request.input.definition.template : request?.command === "finance.recurring.update_future" ? request.input.patch.template ?? null : null;
  return <Drawer open title={SERIES_ACTION_LABELS[action]} description="Confira os dados, revise o efeito e só então confirme. Nenhum pagamento é automático." returnFocusRef={returnFocusRef} initialFocusRef={initialFocusRef} onClose={onClose} dismissible={!busy}
    footer={pending ? <Button onClick={onClose} disabled={busy}>Fechar e manter tentativa</Button> : review ? <><Button disabled={busy} onClick={back}>Voltar aos dados</Button>{review.consistency === "changed" ? <Button variant="primary" disabled={busy} onClick={() => { void reconfirm(); }}>Revisei os dados; atualizar prévia</Button> : <Button variant={destructive ? "danger" : "primary"} disabled={busy || !effects || !acknowledged} loading={busy} onClick={() => { void commit(); }}>Confirmar operação</Button>}</> : <><Button disabled={busy} onClick={onClose}>Cancelar</Button><Button variant="primary" loading={busy} onClick={() => { void prepare(); }}>Revisar antes de salvar</Button></>}>
    <div className="series-fields" ref={fieldsRef} tabIndex={-1}>
      {failure && <p ref={errorRef} tabIndex={-1} role="alert" className="finance-error">{failure}</p>}
      {pending ? <SeriesPendingActions entry={pending} session={session} run={run} busy={busy} hidden={false} onConfirmed={onSaved} /> : review && request ? <div className="series-review">
        <h3 tabIndex={-1} ref={reviewFocusRef}>Prévia da operação</h3>
        {review.consistency === "changed" && <p className="series-warning" role="alert">Os dados mudaram desde a abertura. Confira abaixo a conta, o fechamento, as datas e a previsão atual antes de atualizar a prévia. Isso ainda não autoriza salvar.</p>}
        <dl className="series-review-data"><div><dt>Operação</dt><dd>{SERIES_ACTION_LABELS[action]}</dd></div><div><dt>Dia de referência</dt><dd>{civilLabel(review.today)}</dd></div>{review.data.accounts.filter(account => account.id === (request.command === "finance.recurring.create" ? request.input.definition.template.account_id : request.command === "finance.recurring.update_future" ? request.input.patch.template?.account_id ?? review.data.series?.template.account_id : review.data.series?.template.account_id)).map(account => <div key={account.id}><dt>Conta atual</dt><dd>{account.name}{account.kind === "credit_card" ? ` · fechamento dia ${account.statement_closing_day}` : ""}{account.archived_at ? " · arquivada" : ""}</dd></div>)}</dl>
        {chosenTemplate && <><h3>Dados que você escolheu</h3><dl className="series-review-data"><div><dt>Descrição</dt><dd>{chosenTemplate.description}</dd></div><div><dt>{(request.command === "finance.recurring.create" ? request.input.definition.kind : review.data.series?.kind) === "parcelamento" ? "Total original do parcelamento" : "Novo valor por ocorrência"}</dt><dd><Money value={chosenTemplate.amount_cents} hidden={false} /></dd></div><div><dt>Categoria</dt><dd>{chosenTemplate.category_id === null ? "Sem categoria" : review.data.categories.find(item => item.id === chosenTemplate.category_id)?.name ?? "Indisponível"}</dd></div>{chosenTemplate.payee && <div><dt>Favorecido</dt><dd>{chosenTemplate.payee}</dd></div>}{chosenTemplate.notes && <div><dt>Observações</dt><dd>{chosenTemplate.notes}</dd></div>}{chosenTemplate.tag_ids.length > 0 && <div><dt>Etiquetas</dt><dd>{chosenTemplate.tag_ids.map(id => review.data.tags.find(item => item.id === id)?.name ?? "Indisponível").join(", ")}</dd></div>}</dl></>}
        {request.command === "finance.recurring.create" && <dl className="series-review-data"><div><dt>Frequência escolhida</dt><dd>{SERIES_FREQUENCY_LABELS[request.input.definition.frequency]}</dd></div><div><dt>Primeira posição registrada</dt><dd>{request.input.definition.first_index} de {request.input.definition.total} · {civilLabel(request.input.definition.anchor_on)}</dd></div><div><dt>Término escolhido</dt><dd>{request.input.definition.ends_on ? civilLabel(request.input.definition.ends_on) : "Na última posição"}</dd></div></dl>}
        {request.command === "finance.recurring.update_future" && <dl className="series-review-data"><div><dt>Aplicar a partir de</dt><dd>{civilLabel(request.input.from_on)}</dd></div><div><dt>Término escolhido</dt><dd>{request.input.patch.ends_on ? civilLabel(request.input.patch.ends_on) : "Na última posição"}</dd></div></dl>}
        {request.command === "finance.recurring.occurrence.update" && <p>Total realizado escolhido: <Money value={request.input.patch.paid_cents} hidden={false} />. {review.data.accounts.some(account => review.data.transactions.some(row => row.id === review.data.occurrences.find(item => item.id === request.input.occurrence_id)?.transaction_id && row.account_id === account.id && account.kind === "credit_card" && row.kind === "expense")) ? "A fatura continuará sendo paga separadamente." : "O registro anterior e sua identidade serão preservados."}</p>}
        {effects && <>
          <dl className="series-review-data"><div><dt>Novas previsões</dt><dd>{effects.planned.length}</dd></div><div><dt>Reativadas pela série</dt><dd>{effects.restored.length}</dd></div><div><dt>Ocorrências a conferir</dt><dd>{effects.eligible.length}</dd></div><div><dt>Preservadas ou fora do recorte</dt><dd>{effects.protectedCount}</dd></div></dl>
          {effects.planned.length > 0 && <><p className="finance-note">Novas ocorrências ficam planejadas. Valores no cartão são projeção de compra, sem pagamento de fatura.</p><ul className="series-occurrences" aria-label="Novos lançamentos previstos">{effects.planned.map(item => <li key={item.index}><div><strong>Posição {item.index}</strong><span>{civilLabel(item.occurred_on)}</span></div><div><Money value={item.amount_cents} hidden={false} /><span>{item.statement_month ? `Fatura ${item.statement_month.slice(0, 7).split("-").reverse().join("/")}` : "Conta comum"}</span></div></li>)}</ul></>}
          {effects.restored.length > 0 && <p className="finance-note">Serão reativadas {effects.restored.length} ocorrências que a série pausou, até {civilLabel(effects.restored.map(row => row.occurred_on).sort().at(-1)!)}. Elas podem estar além do horizonte de novas criações; os IDs e as datas permanecem.</p>}
          {effects.updatedPreview.length > 0 ? <details className="series-details" open><summary>Antes e depois das ocorrências ({effects.updatedPreview.length})</summary><ul className="series-occurrences">{effects.updatedPreview.map(({ before, after }) => <li key={before.id}><div><strong>Posição {before.installment_no} · {civilLabel(before.occurred_on)}</strong></div><div><span>Antes</span><Money value={before.amount_cents} hidden={false} /></div><p className="finance-note">{review.data.accounts.find(item => item.id === before.account_id)?.name ?? "Conta indisponível"}{before.statement_month ? ` · Fatura ${before.statement_month.slice(0, 7).split("-").reverse().join("/")}` : ""}</p>{after ? <><div><span>Depois</span><Money value={after.amount_cents} hidden={false} /></div><p className="finance-note">{after.description} · {review.data.accounts.find(item => item.id === after.account_id)?.name ?? "Conta indisponível"}{after.statement_month ? ` · Fatura ${after.statement_month.slice(0, 7).split("-").reverse().join("/")}` : ""}</p></> : <p className="finance-note">Fora do novo término: será suprimida, sem recuperação automática.</p>}</li>)}</ul></details> : effects.eligible.length > 0 && <details className="series-details"><summary>Conferir ocorrências atuais elegíveis ({effects.eligible.length})</summary><ul className="series-occurrences">{effects.eligible.map(row => <li key={row.id}><div><span>{row.description}</span><span>{civilLabel(row.occurred_on)}</span></div><div><Money value={row.amount_cents} hidden={false} /><span>Posição {row.installment_no}</span></div></li>)}</ul></details>}
          {effects.exhausted && <p className="finance-note">Esta ação alcança o limite atual de quantidade ou término. Novas gerações exigem ação explícita e respeitam esse limite.</p>}
        </>}
        <p className="finance-note">Pagos, parciais, realizados, conciliados e exclusões manuais permanecem protegidos conforme a operação. Não há cobrança bancária nem renovação em segundo plano.</p>
        {review.consistency === "same" && effects && <Button className="series-confirm" role="checkbox" aria-checked={acknowledged} variant="ghost" disabled={busy} onClick={() => setAcknowledged(value => !value)}><span className="series-check" aria-hidden="true">{acknowledged && <Icons.Check />}</span>Conferi as datas, os valores e o efeito desta operação.</Button>}
      </div> : <SeriesFields action={action} value={form} onChange={setForm} catalog={catalog} detail={detail} today={today} occurrenceId={occurrenceId} errors={errors} disabled={busy} initialFocusRef={initialFocusRef} />}
    </div>
  </Drawer>;
}
