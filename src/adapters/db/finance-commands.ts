import "server-only";
import { exigir, type ContextoDeEscrita, type DependenciasDeDominio } from "../../core/contracts";
import { criarContaFinanceira, editarContaFinanceira, arquivarContaFinanceira, criarCategoriaFinanceira, editarCategoriaFinanceira, criarLancamentoFinanceiro, editarLancamentoFinanceiro, excluirLancamentoFinanceiro, restaurarLancamentoFinanceiro, duplicarLancamentoFinanceiro, transferirFinanceiro, pagarFaturaFinanceira, criarSerieFinanceira, encerrarSerieFinanceira, salvarOrcamentoFinanceiro, criarEtiquetaFinanceira, editarEtiquetaFinanceira, type FinanceUnitOfWork } from "../../core/financeiro";
export const FINANCE_EXECUTORS = {
  "finance.account.create": criarContaFinanceira, "finance.account.update": editarContaFinanceira, "finance.account.close": arquivarContaFinanceira,
  "finance.category.create": criarCategoriaFinanceira, "finance.category.update": editarCategoriaFinanceira,
  "finance.transaction.create": criarLancamentoFinanceiro, "finance.transaction.update": editarLancamentoFinanceiro,
  "finance.transaction.delete": excluirLancamentoFinanceiro, "finance.transaction.restore": restaurarLancamentoFinanceiro, "finance.transaction.duplicate": duplicarLancamentoFinanceiro,
  "finance.transfer.create": transferirFinanceiro, "finance.statement.pay": pagarFaturaFinanceira,
  "finance.series.create": criarSerieFinanceira, "finance.series.stop": encerrarSerieFinanceira,
  "finance.budget.save": salvarOrcamentoFinanceiro, "finance.tag.create": criarEtiquetaFinanceira, "finance.tag.update": editarEtiquetaFinanceira,
};
export type FinanceCommand = keyof typeof FINANCE_EXECUTORS;
export type FinanceRequest = { [K in FinanceCommand]: { command: K; input: Parameters<(typeof FINANCE_EXECUTORS)[K]>[3] } }[FinanceCommand];
export const FINANCE_COMMANDS = Object.keys(FINANCE_EXECUTORS) as FinanceCommand[];
const transaction = ["account_id", "category_id", "kind", "amount_cents", "paid_cents", "description", "payee", "occurred_on", "status", "due_date", "notes", "statement_month", "tag_ids"];
const account = ["name", "kind", "institution", "opening_balance_cents", "color_key", "credit_limit_cents", "statement_closing_day", "payment_due_day"];
const category = ["name", "kind", "color_key"], tag = ["name", "color_key"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function object(value: unknown): asserts value is Record<string, unknown> { exigir(!!value && typeof value === "object" && !Array.isArray(value), "Operação inválida."); }
function only(value: Record<string, unknown>, allowed: string[]) { exigir(Object.keys(value).every(key => allowed.includes(key)), "Campos não permitidos na operação."); }
function references(value: Record<string, unknown>) {
  for (const [key, entry] of Object.entries(value)) if (key === "id" || key.endsWith("_id") && key !== "client_id") exigir(entry === null || typeof entry === "string" && UUID.test(entry), "Identificador inválido.");
  if (value.tag_ids !== undefined) exigir(Array.isArray(value.tag_ids) && value.tag_ids.length <= 30 && value.tag_ids.every(id => typeof id === "string" && UUID.test(id)), "Etiquetas inválidas.");
}
export function decodeFinanceRequest(value: unknown): FinanceRequest {
  object(value); only(value, ["command", "input"]); exigir(typeof value.command === "string" && Object.hasOwn(FINANCE_EXECUTORS, value.command), "Comando financeiro inválido.");
  object(value.input); const input = value.input, command = value.command;
  exigir(typeof input.client_id === "string" && input.client_id.trim().length > 0 && input.client_id.length <= 200, "Informe client_id.");
  if (command === "finance.transfer.create") only(input, ["client_id", "from_account_id", "to_account_id", "amount_cents", "occurred_on", "description"]);
  else if (command === "finance.statement.pay") only(input, ["client_id", "from_account_id", "card_account_id", "statement_month", "amount_cents", "occurred_on", "interest_rate_percent", "iof_cents"]);
  else if (command === "finance.series.create") { only(input, ["client_id", "fields", "serie_tipo", "count"]); object(input.fields); only(input.fields, transaction); references(input.fields); }
  else if (command === "finance.series.stop") only(input, ["client_id", "installment_group_id", "from_on"]);
  else if (command === "finance.budget.save") only(input, ["client_id", "category_id", "month", "limit_cents"]);
  else if (command.endsWith(".update")) { only(input, ["client_id", "id", "patch"]); object(input.patch); only(input.patch, command.startsWith("finance.account.") ? account : command.startsWith("finance.category.") ? category : command.startsWith("finance.tag.") ? tag : transaction); references(input.patch); }
  else if (command.endsWith(".create")) only(input, ["client_id", ...(command.startsWith("finance.account.") ? account : command.startsWith("finance.category.") ? category : command.startsWith("finance.tag.") ? tag : transaction)]);
  else only(input, ["client_id", "id", ...(command.endsWith(".duplicate") ? ["occurred_on"] : [])]);
  references(input);
  return structuredClone(value) as FinanceRequest;
}
export function executeFinanceCommand(store: FinanceUnitOfWork, deps: DependenciasDeDominio, context: ContextoDeEscrita, request: FinanceRequest): Promise<unknown> {
  // The discriminated request is decoded once above; every executor shares the same ports.
  const executor = FINANCE_EXECUTORS[request.command] as (s: FinanceUnitOfWork, d: DependenciasDeDominio, c: ContextoDeEscrita, input: FinanceRequest["input"]) => Promise<unknown>;
  return executor(store, deps, context, request.input);
}
