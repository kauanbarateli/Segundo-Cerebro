import "server-only";
import { ErroDeDominio, instanteValido } from "../../core/contracts/base";
import type { ReciboIdempotente } from "../../core/contracts";
import type { ContaFinanceira, CategoriaFinanceira, EtiquetaFinanceira, LancamentoFinanceiro, OrcamentoFinanceiro } from "../../core/financeiro";
import { AuthGuardError } from "../../lib/auth/types";
import { CommitOutcomeUnknown } from "./capture-task-store";
import { FINANCE_COMMANDS, type FinanceCommand } from "./finance-commands";
import type { FinanceGateway, FinanceSnapshot } from "./finance-store";
export type FinanceOperation = FinanceCommand | "read.finance";
export type FinanceRpcName = "finance_snapshot" | "finance_revision" | "finance_receipt" | "finance_commit" | "transfer" | "pay_statement" | "create_series" | "close_account";
export interface FinanceRpcArguments { p_user: string; p_session: string; p_operation: FinanceOperation; p_command?: string; p_client_id?: string; p_request?: unknown }
export type FinanceRpc = (name: FinanceRpcName, args: FinanceRpcArguments) => Promise<{ data: unknown; error: { code?: string } | null }>;
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const uuid = (v: unknown) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const nullableText = (v: unknown) => v === null || typeof v === "string";
const safe = (v: unknown) => typeof v === "number" && Number.isSafeInteger(v);
const day = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && instanteValido(`${v}T12:00:00Z`) && new Date(`${v}T12:00:00Z`).toISOString().slice(0, 10) === v;
function ensure(v: unknown): asserts v { if (!v) throw new AuthGuardError("unavailable"); }
function base(v: unknown, actor: string): asserts v is Record<string, unknown> { ensure(record(v) && uuid(v.id) && v.user_id === actor && typeof v.created_at === "string" && instanteValido(v.created_at) && typeof v.updated_at === "string" && instanteValido(v.updated_at)); }
export function validateFinanceRow(v: unknown, kind: string, actor: string) {
  base(v, actor);
  const fields: Record<string, string[]> = {
    finance_account: ["name", "kind", "institution", "currency", "opening_balance_cents", "color_key", "archived_at", "credit_limit_cents", "statement_closing_day", "payment_due_day"],
    finance_category: ["name", "normalized_name", "kind", "parent_id", "color_key"], finance_tag: ["name", "normalized_name", "color_key"],
    finance_budget: ["category_id", "month", "limit_cents"],
    finance_transaction: ["account_id", "category_id", "kind", "amount_cents", "paid_cents", "description", "payee", "occurred_on", "transfer_group_id", "notes", "installment_group_id", "installment_no", "installment_total", "statement_month", "serie_tipo", "status", "source", "due_date", "deleted_at", "tag_ids"],
  };
  ensure(fields[kind] && Object.keys(v).every(key => ["id", "user_id", "created_at", "updated_at", ...fields[kind]!].includes(key)));
  if (["finance_account", "finance_category", "finance_tag"].includes(kind)) ensure(typeof v.color_key === "string" && /^fin-[1-6]$/.test(v.color_key));
  if (kind === "finance_account") {
    ensure(typeof v.name === "string" && ["checking", "savings", "credit_card", "cash", "investment", "other"].includes(String(v.kind)) && safe(v.opening_balance_cents) && v.currency === "BRL" && nullableText(v.institution) && nullableText(v.archived_at));
    ensure(v.kind !== "credit_card" || safe(v.credit_limit_cents) && Number(v.credit_limit_cents) >= 0 && [v.statement_closing_day, v.payment_due_day].every(d => Number.isInteger(d) && Number(d) >= 1 && Number(d) <= 31));
  } else if (kind === "finance_transaction") {
    ensure(uuid(v.account_id) && (v.category_id === null || uuid(v.category_id)) && ["income", "expense"].includes(String(v.kind)) && safe(v.amount_cents) && Number(v.amount_cents) > 0 && safe(v.paid_cents) && Number(v.paid_cents) >= 0 && Number(v.paid_cents) <= Number(v.amount_cents));
    ensure(["planned", "pending", "confirmed", "reconciled", "cancelled"].includes(String(v.status)) && ["manual", "recurring", "import"].includes(String(v.source)) && typeof v.description === "string" && day(v.occurred_on) && (v.due_date === null || day(v.due_date)) && (v.statement_month === null || day(v.statement_month) && String(v.statement_month).endsWith("-01")));
    ensure([v.transfer_group_id, v.installment_group_id].every(id => id === null || uuid(id)) && [v.notes, v.payee, v.deleted_at].every(nullableText) && (v.serie_tipo === null || ["parcelamento", "recorrencia"].includes(String(v.serie_tipo))));
    ensure(v.tag_ids === undefined || Array.isArray(v.tag_ids) && v.tag_ids.length <= 30 && v.tag_ids.every(uuid));
    ensure(v.installment_group_id === null ? v.installment_no === null && v.installment_total === null && v.serie_tipo === null : Number.isInteger(v.installment_no) && Number.isInteger(v.installment_total) && Number(v.installment_no) >= 1 && Number(v.installment_no) <= Number(v.installment_total) && Number(v.installment_total) >= 2 && Number(v.installment_total) <= 120 && v.serie_tipo !== null);
  } else if (kind === "finance_budget") ensure((v.category_id === null || uuid(v.category_id)) && day(v.month) && String(v.month).endsWith("-01") && safe(v.limit_cents) && Number(v.limit_cents) > 0);
  else if (kind === "finance_category" || kind === "finance_tag") { ensure(typeof v.name === "string" && typeof v.normalized_name === "string" && typeof v.color_key === "string"); if (kind === "finance_category") ensure(["income", "expense"].includes(String(v.kind)) && (v.parent_id === null || uuid(v.parent_id))); }
  else ensure(false);
}
function validateResult(value: unknown, command: string, actor: string) {
  if (command === "finance.transfer.create" || command === "finance.statement.pay" || command.startsWith("finance.series.")) {
    ensure(record(value) && uuid(value.group_id) && Array.isArray(value.transactions));
    for (const row of value.transactions) validateFinanceRow(row, "finance_transaction", actor);
    if (command === "finance.statement.pay" && value.charges !== null) validateFinanceRow(value.charges, "finance_transaction", actor);
  } else validateFinanceRow(value, command.startsWith("finance.account.") ? "finance_account" : command.startsWith("finance.category.") ? "finance_category" : command.startsWith("finance.tag.") ? "finance_tag" : command.startsWith("finance.budget.") ? "finance_budget" : "finance_transaction", actor);
}
function receipt(value: unknown, actor: string): asserts value is ReciboIdempotente {
  ensure(record(value) && value.user_id === actor && FINANCE_COMMANDS.includes(value.command as FinanceCommand) && typeof value.client_id === "string" && typeof value.fingerprint === "string"); validateResult(value.result, String(value.command), actor);
}
export function parseFinanceSnapshot(value: unknown, actor: string): FinanceSnapshot {
  ensure(record(value) && typeof value.revision === "string" && /^(0|[1-9][0-9]*)$/.test(value.revision));
  for (const [key, kind] of Object.entries({ accounts: "finance_account", categories: "finance_category", transactions: "finance_transaction", budgets: "finance_budget", tags: "finance_tag" })) { ensure(Array.isArray(value[key])); for (const row of value[key]) validateFinanceRow(row, kind, actor); }
  ensure(Array.isArray(value.events) && Array.isArray(value.receipts));
  for (const e of value.events) { ensure(record(e) && uuid(e.id) && e.user_id === actor && uuid(e.entity_id) && ["created", "updated", "deleted", "restored", "status_changed"].includes(String(e.action)) && ["web", "api", "cron"].includes(String(e.canal)) && typeof e.occurred_at === "string" && instanteValido(e.occurred_at)); for (const state of [e.before, e.after]) if (state !== null) { validateFinanceRow(state, String(e.entity_type), actor); ensure(record(state) && state.id === e.entity_id); } }
  for (const r of value.receipts) receipt(r, actor);
  ensure(Object.values(value).filter(Array.isArray).reduce((n, rows) => n + rows.length, 0) <= 10000 && Buffer.byteLength(JSON.stringify(value), "utf8") <= 8 * 1024 * 1024);
  return structuredClone(value) as unknown as FinanceSnapshot;
}
export class FinanceRateLimitError extends Error { constructor() { super("Aguarde um pouco antes de salvar outra alteração."); this.name = "FinanceRateLimitError"; } }
export function createFinanceGateway(actor: string, session: string, operation: FinanceOperation, rpc: FinanceRpc): FinanceGateway & { presentation(): Promise<{ accounts: ContaFinanceira[]; categories: CategoriaFinanceira[]; transactions: LancamentoFinanceiro[]; budgets: OrcamentoFinanceiro[]; tags: EtiquetaFinanceira[] }> } {
  ensure(uuid(actor) && uuid(session) && (operation === "read.finance" || FINANCE_COMMANDS.includes(operation)));
  async function call(name: FinanceRpcName, extra: Partial<FinanceRpcArguments> = {}, writing = false) {
    let response; try { response = await rpc(name, { p_user: actor, p_session: session, p_operation: operation, ...extra }); } catch { if (writing) throw new CommitOutcomeUnknown(); throw new AuthGuardError("unavailable"); }
    if (response.error) { const code = response.error.code; if (code === "42501") throw new AuthGuardError("forbidden"); if (code === "PT429") throw new FinanceRateLimitError(); if (["23505", "40001", "40P01"].includes(code ?? "")) throw new ErroDeDominio("CONFLICT", "Os dados mudaram. Repita o mesmo envio."); if (["22023", "23514", "23503", "22P02"].includes(code ?? "")) throw new ErroDeDominio("VALIDATION", "Revise os dados da operação."); if (writing && !code) throw new CommitOutcomeUnknown(); throw new AuthGuardError("unavailable"); }
    return response.data;
  }
  const snapshot = async () => parseFinanceSnapshot(await call("finance_snapshot"), actor);
  return { actorId: actor, snapshot, async presentation() { const { accounts, categories, transactions, budgets, tags } = await snapshot(); return { accounts, categories, transactions, budgets, tags }; },
    async currentRevision() { const value = await call("finance_revision"); ensure(typeof value === "string" && /^(0|[1-9][0-9]*)$/.test(value)); return value; },
    async receipt(command, clientId) { const value = await call("finance_receipt", { p_command: command, p_client_id: clientId }); if (value === null) return null; receipt(value, actor); ensure(value.command === command && value.client_id === clientId); return value; },
    async commit(request) { ensure(request.context.user_id === actor && request.receipt.command === operation);
      const names: Partial<Record<FinanceOperation, FinanceRpcName>> = { "finance.transfer.create": "transfer", "finance.statement.pay": "pay_statement", "finance.series.create": "create_series", "finance.account.close": "close_account" };
      const value = await call(names[operation] ?? "finance_commit", { p_request: request }, true);
      if (!record(value) || !["stale", "committed", "replayed"].includes(String(value.status))) throw new CommitOutcomeUnknown(); if (value.status === "stale") return { status: "stale" };
      try { validateResult(value.result, operation, actor); } catch { throw new CommitOutcomeUnknown(); } return { status: value.status as "committed" | "replayed", result: value.result };
    } };
}
