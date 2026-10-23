import { exigir } from "@/core/contracts/base";
import { formatCentsPlain, parseBRLToCents } from "@/core/dinheiro";
import { faturaDe, parcelas, somaMesesNaData } from "@/core/financeiro/credit";
import { normalizarPagamento, type ContaFinanceira, type CategoriaFinanceira, type EtiquetaFinanceira, type LancamentoFinanceiro } from "@/core/financeiro/fused";
import { seriesDay, seriesDayAt, seriesMonth, validateSeriesHorizon } from "@/core/financeiro/series/series-calendar";
import { definitionOfSeries, planSeriesMaterialization } from "@/core/financeiro/series/series-planning";
import { seriesOccurrenceEligibility, validateSeriesRealization } from "@/core/financeiro/series/series-policy";
import { previewSeriesResume } from "@/core/financeiro/series/series-previews";
import { decodeFinanceSeriesCommand, validateSeriesDefinition } from "@/core/financeiro/series/series-validation";
import type { FinanceSeriesCommand, ManagedFinanceSeries, PlannedSeriesOccurrence, SeriesDefinition, SeriesFrequency, SeriesHorizon, SeriesStatementAssignment, SeriesTemplate } from "@/core/financeiro/series/series-types";
import type { FinanceSeriesDetailView } from "@/core/financeiro/series/series-public-validation";
import type { FinanceSeriesPreview } from "@/core/financeiro/series/series-preview-types";
import { FinanceFormError, type FinanceErrors } from "../finance-form";

export type SeriesAction = "create" | "materialize" | "pause" | "resume" | "update_future" | "end" | "occurrence.cancel" | "occurrence.update";
export const SERIES_ACTION_LABELS: Record<SeriesAction, string> = { create: "Nova série", materialize: "Preparar próximos lançamentos", pause: "Pausar série", resume: "Retomar série", update_future: "Editar próximas ocorrências", end: "Encerrar série", "occurrence.cancel": "Excluir esta ocorrência", "occurrence.update": "Registrar realização" };
export const SERIES_FREQUENCY_LABELS: Record<SeriesFrequency, string> = { weekly: "Semanal", monthly: "Mensal", yearly: "Anual" };
export const SERIES_STATE_LABELS: Record<ManagedFinanceSeries["state"], string> = { active: "Ativa", paused: "Pausada", ended: "Encerrada" };
export interface SeriesCatalog { accounts: readonly ContaFinanceira[]; categories: readonly CategoriaFinanceira[]; tags: readonly EtiquetaFinanceira[] }
export interface SeriesFormState {
  description: string; kind: "income" | "expense"; amount: string; account: string; category: string; tags: string[]; payee: string; notes: string;
  seriesKind: "recorrencia" | "parcelamento"; frequency: SeriesFrequency; anchor: string; firstIndex: string; total: string; ends: string;
  from: string; until: string; statementMode: "account_cycle" | "explicit"; assignments: Record<number, string>; paid: string; realization: "confirmed" | "reconciled";
}
export function initialSeriesForm(today: string, detail: FinanceSeriesDetailView | null = null, occurrenceId: string | null = null): SeriesFormState {
  const series = detail?.series, template = series?.template, occurrence = detail?.occurrences.find(row => row.id === occurrenceId), row = detail?.transactions.find(item => item.id === occurrence?.transaction_id);
  let until = ""; try { until = seriesDay(somaMesesNaData(today, 12)); } catch { /* Explicit valid horizon is required near the civil upper bound. */ }
  return { description: template?.description ?? "", kind: template?.kind ?? "expense", amount: template ? formatCentsPlain(template.amount_cents) : "", account: template?.account_id ?? "", category: template?.category_id ?? "", tags: [...template?.tag_ids ?? []], payee: template?.payee ?? "", notes: template?.notes ?? "", seriesKind: series?.kind ?? "recorrencia", frequency: series?.frequency ?? "monthly", anchor: series?.anchor_on ?? today, firstIndex: String(series?.first_index ?? 1), total: String(series?.total ?? 12), ends: series?.ends_on ?? "", from: today, until, statementMode: template?.statement_mode === "explicit" ? "explicit" : "account_cycle", assignments: {}, paid: row ? formatCentsPlain(row.paid_cents) : "0,00", realization: row?.status === "reconciled" ? "reconciled" : "confirmed" };
}
function templateFrom(form: SeriesFormState, catalog: SeriesCatalog, errors: FinanceErrors): SeriesTemplate {
  const account = catalog.accounts.find(row => row.id === form.account && row.archived_at === null && row.currency === "BRL"), amount = parseBRLToCents(form.amount);
  if (!account) errors.account = "Selecione uma conta ativa em reais.";
  if (amount === null || amount < 1) errors.amount = "Informe um valor maior que zero.";
  if (!form.description.trim() || form.description.trim().length > 200) errors.description = "Informe uma descrição de até 200 caracteres.";
  if (form.category && !catalog.categories.some(row => row.id === form.category && row.kind === form.kind)) errors.category = "Escolha uma categoria da mesma natureza.";
  if (form.payee.trim().length > 200) errors.payee = "Use até 200 caracteres."; if (form.notes.trim().length > 4000) errors.notes = "Use até 4.000 caracteres.";
  if (form.tags.length > 30 || new Set(form.tags).size !== form.tags.length || form.tags.some(id => !catalog.tags.some(tag => tag.id === id))) errors.tags = "Selecione até trinta etiquetas disponíveis, sem repetir.";
  return { account_id: form.account, category_id: form.category || null, kind: form.kind, amount_cents: amount ?? 0, description: form.description.trim(), payee: form.payee.trim() || null, notes: form.notes.trim() || null, tag_ids: [...form.tags], statement_mode: account?.kind === "credit_card" ? form.statementMode : "none" };
}
function day(value: string, name: keyof SeriesFormState, errors: FinanceErrors) { try { return seriesDay(value); } catch { errors[name] = "Informe uma data válida."; return value; } }
function definitionFrom(form: SeriesFormState, catalog: SeriesCatalog, errors: FinanceErrors): SeriesDefinition {
  const total = Number(form.total), first_index = Number(form.firstIndex);
  if (!/^[0-9]{1,3}$/.test(form.total) || total < 2 || total > 120) errors.total = "Informe de 2 a 120 posições.";
  if (!/^[0-9]{1,3}$/.test(form.firstIndex) || first_index < 1 || first_index > total) errors.firstIndex = "Informe uma posição entre 1 e o total.";
  const value: SeriesDefinition = { kind: form.seriesKind, frequency: form.frequency, anchor_on: day(form.anchor, "anchor", errors), first_index, total, ends_on: form.ends ? day(form.ends, "ends", errors) : null, template: templateFrom(form, catalog, errors) };
  if (!Object.keys(errors).length) try { validateSeriesDefinition(value); } catch { errors.total = "Confira quantidade, valor total, datas e término da série."; }
  return value;
}
function horizonFrom(form: SeriesFormState, today: string, errors: FinanceErrors): SeriesHorizon {
  const value = { from_on: today, until_exclusive: day(form.until, "until", errors) }; try { validateSeriesHorizon(value, today); } catch { errors.until = "Escolha um fim posterior a hoje, limitado a doze meses. A data final não será incluída."; } return value;
}
/** UI candidates only. The Core planner and server validate the complete assignment set. */
export function explicitStatementSlots(form: SeriesFormState, action: SeriesAction, detail: FinanceSeriesDetailView | null, today: string, catalog: SeriesCatalog): { index: number; day: string }[] {
  const errors: FinanceErrors = {}, definition = action === "create" ? definitionFrom(form, catalog, errors) : detail ? definitionOfSeries(detail.series) : null;
  if (!definition || Object.keys(errors).length) return [];
  const account = catalog.accounts.find(row => row.id === form.account); if (account?.kind !== "credit_card" || form.statementMode !== "explicit") return [];
  try {
    if (action === "update_future") {
      if (!detail || detail.series.template.account_id === account.id) return [];
      return detail.occurrences.flatMap(occurrence => { const row = detail.transactions.find(item => item.id === occurrence.transaction_id), oldAccount = detail.accounts.find(item => item.id === row?.account_id); return row && oldAccount && seriesOccurrenceEligibility(detail.series, occurrence, row, oldAccount, { action, today, from_on: form.from }).allowed && (!form.ends || row.occurred_on <= form.ends) ? [{ index: occurrence.index, day: row.occurred_on }] : []; });
    }
    if (!["create", "materialize", "resume"].includes(action)) return [];
    const horizon = horizonFrom(form, today, errors); if (Object.keys(errors).length) return [];
    const existing = new Set(detail?.occurrences.map(row => row.index) ?? []), slots: { index: number; day: string }[] = [];
    for (let index = detail?.series.next_index ?? definition.first_index; index <= definition.total; index++) { const value = seriesDayAt(definition, index); if (value >= horizon.until_exclusive || definition.ends_on && value > definition.ends_on) break; if (value >= horizon.from_on && !existing.has(index)) slots.push({ index, day: value }); }
    return slots;
  } catch { return []; }
}
export function seriesIntent(input: { form: SeriesFormState; action: SeriesAction; detail: FinanceSeriesDetailView | null; occurrenceId?: string | null; catalog: SeriesCatalog; today: string; clientId: string; financeRevision?: string }): FinanceSeriesCommand {
  const { form, action, detail, catalog, today } = input, errors: FinanceErrors = {}, expected_finance_revision = input.financeRevision ?? detail?.finance_revision ?? "0";
  const base = { client_id: input.clientId, expected_finance_revision }, existing = detail ? { ...base, series_id: detail.series.id, expected_revision: detail.series.revision } : null;
  const assignments: SeriesStatementAssignment[] = explicitStatementSlots(form, action, detail, today, catalog).flatMap(slot => { const raw = form.assignments[slot.index]; try { const statement_month = seriesMonth(raw ? raw + "-01" : ""); return [{ index: slot.index, statement_month }]; } catch { errors[`statement-${slot.index}`] = "Escolha a competência desta ocorrência."; return []; } });
  let command: FinanceSeriesCommand;
  if (action === "create") command = { command: "finance.recurring.create", input: { ...base, definition: definitionFrom(form, catalog, errors), horizon: horizonFrom(form, today, errors), statement_assignments: assignments } };
  else {
    if (!detail || !existing) throw new FinanceFormError({ form: "Carregue o detalhe atual desta série antes de continuar." });
    if (action === "materialize" || action === "resume") command = { command: action === "materialize" ? "finance.recurring.materialize" : "finance.recurring.resume", input: { ...existing, horizon: horizonFrom(form, today, errors), statement_assignments: assignments } };
    else if (action === "pause" || action === "end") command = { command: action === "pause" ? "finance.recurring.pause" : "finance.recurring.end", input: { ...existing, from_on: day(form.from, "from", errors) } };
    else if (action === "update_future") command = { command: "finance.recurring.update_future", input: { ...existing, from_on: day(form.from, "from", errors), patch: { template: templateFrom(form, catalog, errors), ends_on: form.ends ? day(form.ends, "ends", errors) : null }, statement_assignments: assignments } };
    else if (action === "occurrence.cancel") command = { command: "finance.recurring.occurrence.cancel", input: { ...existing, occurrence_id: input.occurrenceId ?? "" } };
    else { const paid_cents = parseBRLToCents(form.paid); if (paid_cents === null || paid_cents < 0) errors.paid = "Informe um valor realizado válido."; command = { command: "finance.recurring.occurrence.update", input: { ...existing, occurrence_id: input.occurrenceId ?? "", patch: { status: form.realization, paid_cents: paid_cents ?? 0 } } }; }
  }
  if (Object.keys(errors).length) throw new FinanceFormError(errors);
  try { return decodeFinanceSeriesCommand(command); } catch { throw new FinanceFormError({ form: "Confira as datas, os campos e os limites da operação." }); }
}
export interface SeriesEffectReview { planned: PlannedSeriesOccurrence[]; restored: LancamentoFinanceiro[]; eligible: LancamentoFinanceiro[]; updatedPreview: { before: LancamentoFinanceiro; after: LancamentoFinanceiro | null }[]; protectedCount: number; alreadyMaterialized: number; exhausted: boolean }
export function seriesEffectReview(review: Extract<FinanceSeriesPreview, { kind: "review" }>, request: FinanceSeriesCommand, ownerId: string): SeriesEffectReview {
  const { data, today } = review, summary: SeriesEffectReview = { planned: [], restored: [], eligible: [], updatedPreview: [], protectedCount: 0, alreadyMaterialized: 0, exhausted: false };
  let series = data.series;
  if (request.command === "finance.recurring.create") {
    // This temporary identity exists only to call the pure planner. It is never
    // displayed, persisted, sent as an entity ID or used to predict winner IDs.
    const reviewInstant = today + "T12:00:00.000Z";
    series = { ...structuredClone(request.input.definition), version: 2, id: request.input.client_id, user_id: ownerId, state: "active", revision: "0", next_index: request.input.definition.first_index, materialized_through: null, created_at: reviewInstant, updated_at: reviewInstant };
  }
  exigir(series, "Carregue a série atual.");
  const selectedAccountId = series.template.account_id, account = data.accounts.find(row => row.id === selectedAccountId), bindings = data.occurrences.map(occurrence => { const row = data.transactions.find(item => item.id === occurrence.transaction_id), ownAccount = data.accounts.find(item => item.id === row?.account_id); exigir(row && ownAccount, "Recarregue as referências da ocorrência."); return { occurrence, row, account: ownAccount }; });
  if (request.command === "finance.recurring.create" || request.command === "finance.recurring.materialize" || request.command === "finance.recurring.resume") {
    exigir(account, "Selecione uma conta disponível.");
    const params = { series, account, categories: data.categories, tags: data.tags, today, horizon: request.input.horizon, statement_assignments: request.input.statement_assignments };
    const resume = request.command === "finance.recurring.resume" ? previewSeriesResume({ ...params, bindings }) : null;
    const plan = resume?.planned ?? planSeriesMaterialization({ ...params, existing: data.occurrences });
    summary.planned = plan.occurrences; summary.restored = resume?.restore.map(item => item.row) ?? []; summary.protectedCount = resume ? bindings.length - resume.restore.length : plan.skipped_before_horizon.length; summary.alreadyMaterialized = plan.already_materialized.length; summary.exhausted = plan.exhausted;
  } else if (request.command === "finance.recurring.occurrence.update" || request.command === "finance.recurring.occurrence.cancel") {
    const item = bindings.find(binding => binding.occurrence.id === request.input.occurrence_id); exigir(item, "Selecione uma ocorrência disponível.");
    if (request.command === "finance.recurring.occurrence.update") { exigir(item.account.archived_at === null, "Revise a conta arquivada antes de realizar."); validateSeriesRealization(series, item.occurrence, item.row, item.account, request.input.patch); }
    else exigir(seriesOccurrenceEligibility(series, item.occurrence, item.row, item.account, { action: "cancel", today, from_on: today }).allowed, "Esta ocorrência paga, realizada ou protegida não pode ser excluída.");
    summary.eligible = [item.row];
  } else {
    exigir(request.command === "finance.recurring.pause" || request.command === "finance.recurring.end" || request.command === "finance.recurring.update_future", "Selecione uma ação de edição válida para a série.");
    const action = request.command === "finance.recurring.pause" ? "pause" : request.command === "finance.recurring.end" ? "end" : "update_future";
    exigir(action === "pause" ? series.state === "active" : series.state !== "ended", "O estado da série não permite esta ação.");
    for (const item of bindings) {
      const allowed = seriesOccurrenceEligibility(series, item.occurrence, item.row, item.account, { action, today, from_on: request.input.from_on }).allowed;
      if (request.command === "finance.recurring.update_future" && request.input.patch.ends_on && item.row.occurred_on > request.input.patch.ends_on && item.occurrence.suppression === "none") exigir(allowed, "O término não pode remover uma ocorrência paga, parcial ou realizada.");
      if (allowed) summary.eligible.push(item.row); else summary.protectedCount++;
    }
    if (request.command === "finance.recurring.update_future") {
      const template = request.input.patch.template; if (template) { exigir(template.kind === series.template.kind, "A natureza da série é imutável."); exigir(series.kind !== "parcelamento" || template.amount_cents === series.template.amount_cents, "O total original do parcelamento é imutável."); }
      if (request.input.patch.ends_on) exigir(request.input.patch.ends_on >= request.input.from_on, "O término deve respeitar a data da edição.");
      const assignments = new Map(request.input.statement_assignments.map(item => [item.index, item.statement_month]));
      const amounts = series.kind === "parcelamento" ? parcelas(series.template.amount_cents, series.total) : null;
      const nextAccount = template ? data.accounts.find(item => item.id === template.account_id) : null;
      if (template) { exigir(nextAccount && nextAccount.archived_at === null, "Escolha uma conta ativa para as próximas ocorrências."); exigir(nextAccount.kind === "credit_card" ? template.statement_mode !== "none" : template.statement_mode === "none", "Confira a competência da conta escolhida."); }
      for (const row of summary.eligible) {
        if (request.input.patch.ends_on && row.occurred_on > request.input.patch.ends_on) { summary.updatedPreview.push({ before: row, after: null }); continue; }
        if (!template || !nextAccount) { summary.updatedPreview.push({ before: row, after: structuredClone(row) }); continue; }
        let statement_month = row.statement_month;
        if (nextAccount.kind !== "credit_card") statement_month = null;
        else if (assignments.has(row.installment_no!)) { statement_month = assignments.get(row.installment_no!)!; assignments.delete(row.installment_no!); }
        else if (nextAccount.id !== row.account_id) { exigir(template.statement_mode === "account_cycle" && nextAccount.statement_closing_day !== null, "Confirme a competência de cada ocorrência que muda de cartão."); statement_month = faturaDe(row.occurred_on, nextAccount.statement_closing_day); }
        const amount_cents = amounts?.[row.installment_no! - 1] ?? template.amount_cents;
        const projection = normalizarPagamento({ account_id: nextAccount.id, kind: template.kind, amount_cents, paid_cents: 0 }, nextAccount);
        summary.updatedPreview.push({ before: row, after: { ...structuredClone(row), account_id: template.account_id, category_id: template.category_id, description: template.description.trim(), payee: template.payee?.trim() || null, notes: template.notes?.trim() || null, tag_ids: [...template.tag_ids], amount_cents, paid_cents: projection.paid_cents, statement_month } });
      }
      exigir(assignments.size === 0, "Uma competência se refere a ocorrência protegida ou fora desta edição.");
    }
  }
  return summary;
}
