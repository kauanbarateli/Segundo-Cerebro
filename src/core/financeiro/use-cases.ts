import { exigir, naoEncontrado, type ContextoDeEscrita, type DependenciasDeDominio } from "../contracts/base";
import { emitirEvento, executarComando } from "../contracts/operations";
import type { Transacao, UnitOfWork } from "../contracts/unit-of-work";
import { instanteDe, SO_DATA } from "../tempo";
import { faturaDe } from "./credit";
import { normalizarPagamento, type ContaFinanceira, type CategoriaFinanceira, type LancamentoFinanceiro, type OrcamentoFinanceiro } from "./fused";

export type CamposContaFinanceira = Pick<ContaFinanceira, "name" | "kind" | "institution" | "opening_balance_cents" | "color_key" | "credit_limit_cents" | "statement_closing_day" | "payment_due_day">;
export type CamposCategoriaFinanceira = Pick<CategoriaFinanceira, "name" | "kind" | "color_key">;
export type CamposLancamentoFinanceiro = Pick<LancamentoFinanceiro, "account_id" | "category_id" | "kind" | "amount_cents" | "paid_cents" | "description" | "payee" | "occurred_on" | "status" | "due_date" | "notes"> & { statement_month?: string | null };
type Editar<T> = { id: string; client_id: string; patch: Partial<T> };
type Identificar = { id: string; client_id: string };
const transactionKeys: readonly (keyof CamposLancamentoFinanceiro)[] = ["account_id", "category_id", "kind", "amount_cents", "paid_cents", "description", "payee", "occurred_on", "status", "due_date", "notes", "statement_month"];
const accountKeys: readonly (keyof CamposContaFinanceira)[] = ["name", "kind", "institution", "opening_balance_cents", "color_key", "credit_limit_cents", "statement_closing_day", "payment_due_day"];
const categoryKeys: readonly (keyof CamposCategoriaFinanceira)[] = ["name", "kind", "color_key"];
function pick<T>(input: T, keys: readonly (keyof T)[]): T { exigir(input !== null && typeof input === "object" && !Array.isArray(input), "Informe os campos da operação."); return Object.fromEntries(keys.filter((key) => input[key] !== undefined).map((key) => [key, input[key]])) as T; }
function text(value: unknown, label: string, max: number, optional = false): string | null {
  if (optional && value === null) return null;
  exigir(typeof value === "string" && value.length <= max && (optional || value.trim().length > 0), `${label}: informe até ${max} caracteres.`);
  return value.trim() || null;
}
function cents(value: number, label: string, min = 0): number { exigir(Number.isSafeInteger(value) && value >= min, `${label}: informe centavos inteiros válidos.`); return value; }
function day(value: string, label: string): string { exigir(typeof value === "string" && SO_DATA.test(value) && instanteDe(value) !== null, `${label}: informe uma data válida.`); return value; }
function month(value: string): string { exigir(typeof value === "string" && /^\d{4}-\d{2}-01$/.test(value), "Informe a competência como AAAA-MM-01."); return day(value, "Competência"); }
function color(value: string): string { exigir(typeof value === "string" && /^fin-[1-6]$/.test(value), "Escolha uma cor financeira válida."); return value; }
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR");
function independent(row: LancamentoFinanceiro) {
  exigir(row.transfer_group_id === null && row.installment_group_id === null && row.serie_tipo === null, "Use o fluxo da transferência ou série para alterar este lançamento vinculado.");
}
function accountFields(input: CamposContaFinanceira): CamposContaFinanceira {
  const fields = pick(input, accountKeys);
  exigir(["checking", "savings", "credit_card", "cash", "investment", "other"].includes(fields.kind), "Tipo de conta inválido.");
  fields.name = text(fields.name, "Nome da conta", 120)!; fields.institution = text(fields.institution, "Instituição", 120, true);
  fields.color_key = color(fields.color_key); fields.opening_balance_cents = cents(fields.opening_balance_cents, "Saldo inicial", -Number.MAX_SAFE_INTEGER);
  if (fields.kind === "credit_card") {
    exigir(fields.credit_limit_cents !== null, "Informe o limite do cartão."); cents(fields.credit_limit_cents, "Limite do cartão");
    for (const value of [fields.statement_closing_day, fields.payment_due_day]) exigir(value !== null && Number.isInteger(value) && value >= 1 && value <= 31, "Fechamento e vencimento devem ficar entre 1 e 31.");
  } else { fields.credit_limit_cents = null; fields.statement_closing_day = null; fields.payment_due_day = null; }
  return fields;
}
async function categoryFields(tx: Transacao, input: CamposCategoriaFinanceira, id?: string): Promise<CamposCategoriaFinanceira & { normalized_name: string }> {
  const fields = pick(input, categoryKeys);
  exigir(["income", "expense"].includes(fields.kind), "Tipo de categoria inválido.");
  fields.name = text(fields.name, "Nome da categoria", 80)!; fields.color_key = color(fields.color_key);
  const normalized_name = normalize(fields.name);
  exigir(!(await tx.financeiro.categorias.list()).some((row) => row.id !== id && row.kind === fields.kind && row.normalized_name === normalized_name), "Já existe uma categoria desse tipo com esse nome.");
  return { ...fields, normalized_name };
}
async function transactionFields(tx: Transacao, input: CamposLancamentoFinanceiro, before?: LancamentoFinanceiro): Promise<Required<CamposLancamentoFinanceiro>> {
  const fields = pick(input, transactionKeys);
  exigir(["income", "expense"].includes(fields.kind), "Tipo de lançamento inválido.");
  exigir(["planned", "pending", "confirmed", "reconciled", "cancelled"].includes(fields.status), "Status do lançamento inválido.");
  exigir(typeof fields.account_id === "string" && fields.account_id.length > 0, "Selecione uma conta.");
  const account = await tx.financeiro.contas.get(fields.account_id); if (!account || account.archived_at !== null) naoEncontrado();
  exigir(fields.category_id === null || typeof fields.category_id === "string" && fields.category_id.length > 0, "Categoria inválida.");
  if (fields.category_id !== null) {
    const category = await tx.financeiro.categorias.get(fields.category_id); if (!category) naoEncontrado();
    exigir(fields.kind !== "expense" || category.kind === "expense", "Uma despesa precisa de categoria de despesa.");
  }
  fields.description = text(fields.description, "Descrição", 200)!; fields.payee = text(fields.payee, "Favorecido", 120, true); fields.notes = text(fields.notes, "Observações", 5000, true);
  fields.occurred_on = day(fields.occurred_on, "Data"); if (fields.due_date !== null) fields.due_date = day(fields.due_date, "Vencimento");
  cents(fields.amount_cents, "Valor", 1); cents(fields.paid_cents, "Pagamento");
  let statement = fields.statement_month;
  if (account.kind !== "credit_card") { exigir(statement === undefined || statement === null, "Contas comuns não possuem competência de cartão."); statement = null; }
  else if (statement === undefined || statement === null && (!before || before.account_id !== account.id)) {
    exigir(account.statement_closing_day !== null, "O cartão precisa de um dia de fechamento."); statement = faturaDe(fields.occurred_on, account.statement_closing_day);
  }
  if (statement !== null) month(statement);
  const { is_paid: _derived, ...normalized } = normalizarPagamento({ ...fields, statement_month: statement }, account); void _derived;
  return normalized;
}

export function criarContaFinanceira(store: UnitOfWork, deps: DependenciasDeDominio, context: ContextoDeEscrita, input: CamposContaFinanceira & { client_id: string }): Promise<ContaFinanceira> {
  input = structuredClone(input); context = { ...context };
  return executarComando(store, context, "finance.account.create", input.client_id, input, async (tx) => {
    const now = deps.clock.now(); const row: ContaFinanceira = { ...accountFields(input), id: deps.ids.next(), user_id: context.user_id, currency: "BRL", archived_at: null, created_at: now, updated_at: now };
    await tx.financeiro.contas.insert(row); await emitirEvento(tx, deps, context, "finance_account", null, row, "created"); return row;
  });
}
export function editarContaFinanceira(store: UnitOfWork, deps: DependenciasDeDominio, context: ContextoDeEscrita, input: Editar<CamposContaFinanceira>): Promise<ContaFinanceira> {
  input = structuredClone(input); context = { ...context };
  return executarComando(store, context, "finance.account.update", input.client_id, input, async (tx) => {
    const before = await tx.financeiro.contas.get(input.id); if (!before || before.archived_at) naoEncontrado();
    const fields = accountFields({ ...before, ...pick(input.patch, accountKeys) }); exigir(fields.kind === before.kind, "O tipo da conta preserva seu histórico e não pode ser alterado.");
    const after = { ...before, ...fields, updated_at: deps.clock.now() };
    await tx.financeiro.contas.replace(after); await emitirEvento(tx, deps, context, "finance_account", before, after, "updated"); return after;
  });
}
export function criarCategoriaFinanceira(store: UnitOfWork, deps: DependenciasDeDominio, context: ContextoDeEscrita, input: CamposCategoriaFinanceira & { client_id: string }): Promise<CategoriaFinanceira> {
  input = structuredClone(input); context = { ...context };
  return executarComando(store, context, "finance.category.create", input.client_id, input, async (tx) => {
    const fields = await categoryFields(tx, input); const now = deps.clock.now();
    const row: CategoriaFinanceira = { ...fields, id: deps.ids.next(), user_id: context.user_id, parent_id: null, created_at: now, updated_at: now };
    await tx.financeiro.categorias.insert(row); await emitirEvento(tx, deps, context, "finance_category", null, row, "created"); return row;
  });
}
export function editarCategoriaFinanceira(store: UnitOfWork, deps: DependenciasDeDominio, context: ContextoDeEscrita, input: Editar<CamposCategoriaFinanceira>): Promise<CategoriaFinanceira> {
  input = structuredClone(input); context = { ...context };
  return executarComando(store, context, "finance.category.update", input.client_id, input, async (tx) => {
    const before = await tx.financeiro.categorias.get(input.id); if (!before) naoEncontrado();
    const fields = await categoryFields(tx, { ...before, ...pick(input.patch, categoryKeys) }, before.id); exigir(fields.kind === before.kind, "O tipo da categoria preserva seu histórico e não pode ser alterado.");
    const after = { ...before, ...fields, updated_at: deps.clock.now() };
    await tx.financeiro.categorias.replace(after); await emitirEvento(tx, deps, context, "finance_category", before, after, "updated"); return after;
  });
}
export function criarLancamentoFinanceiro(store: UnitOfWork, deps: DependenciasDeDominio, context: ContextoDeEscrita, input: CamposLancamentoFinanceiro & { client_id: string }): Promise<LancamentoFinanceiro> {
  input = structuredClone(input); context = { ...context };
  return executarComando(store, context, "finance.transaction.create", input.client_id, input, async (tx) => {
    const fields = await transactionFields(tx, input); const now = deps.clock.now();
    const row: LancamentoFinanceiro = { ...fields, id: deps.ids.next(), user_id: context.user_id, source: "manual", transfer_group_id: null, installment_group_id: null, installment_no: null, installment_total: null, serie_tipo: null, deleted_at: null, created_at: now, updated_at: now };
    await tx.financeiro.lancamentos.insert(row); await emitirEvento(tx, deps, context, "finance_transaction", null, row, "created"); return row;
  });
}
export function editarLancamentoFinanceiro(store: UnitOfWork, deps: DependenciasDeDominio, context: ContextoDeEscrita, input: Editar<CamposLancamentoFinanceiro>): Promise<LancamentoFinanceiro> {
  input = structuredClone(input); context = { ...context };
  return executarComando(store, context, "finance.transaction.update", input.client_id, input, async (tx) => {
    const before = await tx.financeiro.lancamentos.get(input.id); if (!before || before.deleted_at) naoEncontrado(); independent(before);
    const patch = pick(input.patch, transactionKeys);
    const merged = { ...before, ...patch };
    // A changed account derives a new assignment; common edits preserve the historical month.
    if (patch.account_id && patch.account_id !== before.account_id && patch.statement_month === undefined) delete (merged as Partial<LancamentoFinanceiro>).statement_month;
    const fields = await transactionFields(tx, merged, before); const after = { ...before, ...fields, updated_at: deps.clock.now() };
    await tx.financeiro.lancamentos.replace(after); await emitirEvento(tx, deps, context, "finance_transaction", before, after, before.status === after.status ? "updated" : "status_changed"); return after;
  });
}
function trash(store: UnitOfWork, deps: DependenciasDeDominio, context: ContextoDeEscrita, input: Identificar, restore: boolean): Promise<LancamentoFinanceiro> {
  input = structuredClone(input); context = { ...context };
  return executarComando(store, context, restore ? "finance.transaction.restore" : "finance.transaction.delete", input.client_id, input, async (tx) => {
    const before = await tx.financeiro.lancamentos.get(input.id); if (!before) naoEncontrado(); independent(before);
    if (restore ? before.deleted_at === null : before.deleted_at !== null) return before;
    const now = deps.clock.now(); const after = { ...before, deleted_at: restore ? null : now, updated_at: now };
    await tx.financeiro.lancamentos.replace(after); await emitirEvento(tx, deps, context, "finance_transaction", before, after, restore ? "restored" : "deleted"); return after;
  });
}
export const excluirLancamentoFinanceiro = (store: UnitOfWork, deps: DependenciasDeDominio, context: ContextoDeEscrita, input: Identificar) => trash(store, deps, context, input, false);
export const restaurarLancamentoFinanceiro = (store: UnitOfWork, deps: DependenciasDeDominio, context: ContextoDeEscrita, input: Identificar) => trash(store, deps, context, input, true);
export function salvarOrcamentoFinanceiro(store: UnitOfWork, deps: DependenciasDeDominio, context: ContextoDeEscrita, input: { client_id: string; category_id: string; month: string; limit_cents: number }): Promise<OrcamentoFinanceiro> {
  input = structuredClone(input); context = { ...context };
  return executarComando(store, context, "finance.budget.save", input.client_id, input, async (tx) => {
    const category = await tx.financeiro.categorias.get(input.category_id); if (!category) naoEncontrado(); exigir(category.kind === "expense", "Orçamento exige categoria de despesa.");
    month(input.month); cents(input.limit_cents, "Limite do orçamento", 1);
    const before = (await tx.financeiro.orcamentos.list()).find((row) => row.category_id === input.category_id && row.month === input.month) ?? null;
    const now = deps.clock.now(); const after: OrcamentoFinanceiro = { id: before?.id ?? deps.ids.next(), user_id: context.user_id, category_id: input.category_id, month: input.month, limit_cents: input.limit_cents, created_at: before?.created_at ?? now, updated_at: now };
    if (before) await tx.financeiro.orcamentos.replace(after); else await tx.financeiro.orcamentos.insert(after);
    await emitirEvento(tx, deps, context, "finance_budget", before, after, before ? "updated" : "created"); return after;
  });
}
