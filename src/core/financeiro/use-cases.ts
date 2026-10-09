import { exigir, naoEncontrado, type ContextoDeEscrita, type DependenciasDeDominio } from "../contracts/base";
import { emitirEvento, executarComando } from "../contracts/operations";
import type { FinanceTransaction as Transacao, FinanceUnitOfWork as UnitOfWork } from "./ports";
import { diaCivilDe, instanteDe, SO_DATA } from "../tempo";
import { calcularEncargos, faturaDe, faturaDoEncargo, planoDeParcelas, planoDeRecorrencia, somaMeses } from "./credit";
import { faturaFinanceira, normalizarPagamento, type ContaFinanceira, type CategoriaFinanceira, type EtiquetaFinanceira, type LancamentoFinanceiro, type OrcamentoFinanceiro } from "./fused";

export type CamposContaFinanceira = Pick<ContaFinanceira, "name" | "kind" | "institution" | "opening_balance_cents" | "color_key" | "credit_limit_cents" | "statement_closing_day" | "payment_due_day">;
export type CamposCategoriaFinanceira = Pick<CategoriaFinanceira, "name" | "kind" | "color_key">;
export type CamposLancamentoFinanceiro = Pick<LancamentoFinanceiro, "account_id" | "category_id" | "kind" | "amount_cents" | "paid_cents" | "description" | "payee" | "occurred_on" | "status" | "due_date" | "notes"> & { statement_month?: string | null; tag_ids?: string[] };
type Editar<T> = { id: string; client_id: string; patch: Partial<T> };
type Identificar = { id: string; client_id: string };
const transactionKeys: readonly (keyof CamposLancamentoFinanceiro)[] = ["account_id", "category_id", "kind", "amount_cents", "paid_cents", "description", "payee", "occurred_on", "status", "due_date", "notes", "statement_month", "tag_ids"];
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
  fields.tag_ids = fields.tag_ids ?? [];
  exigir(Array.isArray(fields.tag_ids) && fields.tag_ids.length <= 30 && new Set(fields.tag_ids).size === fields.tag_ids.length, "Etiquetas inválidas.");
  for (const id of fields.tag_ids) if (typeof id !== "string" || !tx.financeiro.etiquetas || !await tx.financeiro.etiquetas.get(id)) naoEncontrado();
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
  return { ...normalized, tag_ids: fields.tag_ids };
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

export interface TransferenciaFinanceira { client_id: string; from_account_id: string; to_account_id: string; amount_cents: number; occurred_on: string; description: string }
export interface PagamentoFaturaFinanceira { client_id: string; from_account_id: string; card_account_id: string; statement_month: string; amount_cents: number; occurred_on: string; interest_rate_percent?: number; iof_cents?: number }
export interface SerieFinanceira { client_id: string; fields: CamposLancamentoFinanceiro; serie_tipo: "parcelamento" | "recorrencia"; count: number }
export interface ResultadoTransferencia { group_id: string; transactions: LancamentoFinanceiro[] }
export interface ResultadoPagamentoFatura extends ResultadoTransferencia { charges: LancamentoFinanceiro | null }
export interface ResultadoSerie { group_id: string; transactions: LancamentoFinanceiro[] }
async function activeAccount(tx: Transacao, id: string) { const row = await tx.financeiro.contas.get(id); if (!row || row.archived_at !== null) naoEncontrado(); return row; }
function newTransaction(deps: DependenciasDeDominio, context: ContextoDeEscrita, fields: Required<CamposLancamentoFinanceiro>): LancamentoFinanceiro {
  const now = deps.clock.now();
  return { ...fields, id: deps.ids.next(), user_id: context.user_id, source: "manual", transfer_group_id: null, installment_group_id: null, installment_no: null, installment_total: null, serie_tipo: null, deleted_at: null, created_at: now, updated_at: now };
}
async function insertTransaction(tx: Transacao, deps: DependenciasDeDominio, context: ContextoDeEscrita, row: LancamentoFinanceiro) {
  await tx.financeiro.lancamentos.insert(row); await emitirEvento(tx, deps, context, "finance_transaction", null, row, "created"); return row;
}
async function transferRows(tx: Transacao, deps: DependenciasDeDominio, context: ContextoDeEscrita, input: Omit<TransferenciaFinanceira, "client_id">, statement: string | null = null): Promise<ResultadoTransferencia> {
  exigir(input.from_account_id !== input.to_account_id, "A origem e o destino precisam ser diferentes.");
  await activeAccount(tx, input.from_account_id); await activeAccount(tx, input.to_account_id);
  cents(input.amount_cents, "Valor", 1); day(input.occurred_on, "Data");
  const description = text(input.description, "Descrição", 200)!;
  const group_id = deps.ids.next(); const transactions: LancamentoFinanceiro[] = [];
  for (const [account_id, kind] of [[input.from_account_id, "expense"], [input.to_account_id, "income"]] as const) {
    const fields = await transactionFields(tx, { account_id, kind, amount_cents: input.amount_cents, paid_cents: input.amount_cents, occurred_on: input.occurred_on, description, category_id: null, status: "confirmed", due_date: null, notes: null, payee: null, ...(kind === "income" && statement ? { statement_month: statement } : {}) });
    const row = { ...newTransaction(deps, context, fields), transfer_group_id: group_id };
    transactions.push(await insertTransaction(tx, deps, context, row));
  }
  return { group_id, transactions };
}
export function transferirFinanceiro(store: UnitOfWork, deps: DependenciasDeDominio, context: ContextoDeEscrita, input: TransferenciaFinanceira): Promise<ResultadoTransferencia> {
  input = structuredClone(input); context = { ...context };
  return executarComando(store, context, "finance.transfer.create", input.client_id, input, async tx => {
    const from = await activeAccount(tx, input.from_account_id), to = await activeAccount(tx, input.to_account_id);
    exigir(from.kind !== "credit_card" && to.kind !== "credit_card", "Para cartão, use o pagamento de fatura.");
    return transferRows(tx, deps, context, input);
  });
}
export function pagarFaturaFinanceira(store: UnitOfWork, deps: DependenciasDeDominio, context: ContextoDeEscrita, input: PagamentoFaturaFinanceira): Promise<ResultadoPagamentoFatura> {
  input = structuredClone(input); context = { ...context };
  return executarComando(store, context, "finance.statement.pay", input.client_id, input, async tx => {
    const from = await activeAccount(tx, input.from_account_id), card = await activeAccount(tx, input.card_account_id);
    exigir(from.kind !== "credit_card" && card.kind === "credit_card", "Selecione uma conta de origem e um cartão.");
    month(input.statement_month); cents(input.amount_cents, "Pagamento", 1); day(input.occurred_on, "Data");
    const statement = faturaFinanceira(await tx.financeiro.lancamentos.list({ includeDeleted: true }), card, input.statement_month);
    const charges = calcularEncargos({ saldoRemanescenteCents: Math.max(0, statement.openCents - input.amount_cents), taxaMensalPercent: input.interest_rate_percent ?? 0, iofCents: input.iof_cents ?? 0 });
    const result = await transferRows(tx, deps, context, { from_account_id: from.id, to_account_id: card.id, amount_cents: input.amount_cents, occurred_on: input.occurred_on, description: `Pagamento da fatura ${input.statement_month.slice(0, 7)}` }, input.statement_month);
    let charge: LancamentoFinanceiro | null = null;
    if (charges.totalCents > 0 && statement.openCents > input.amount_cents) {
      const fields = await transactionFields(tx, { account_id: card.id, category_id: null, kind: "expense", amount_cents: charges.totalCents, paid_cents: charges.totalCents, description: "Juros e IOF da fatura", payee: null, notes: null, status: "confirmed", due_date: null, occurred_on: input.occurred_on, statement_month: faturaDoEncargo(input.statement_month, input.occurred_on, card.statement_closing_day!) });
      charge = await insertTransaction(tx, deps, context, newTransaction(deps, context, fields));
    }
    return { ...result, charges: charge };
  });
}
export function criarSerieFinanceira(store: UnitOfWork, deps: DependenciasDeDominio, context: ContextoDeEscrita, input: SerieFinanceira): Promise<ResultadoSerie> {
  input = structuredClone(input); context = { ...context };
  return executarComando(store, context, "finance.series.create", input.client_id, input, async tx => {
    exigir(["parcelamento", "recorrencia"].includes(input.serie_tipo) && Number.isInteger(input.count) && input.count >= 2 && input.count <= 120, "Informe uma série finita de 2 a 120 ocorrências.");
    const original = await transactionFields(tx, input.fields); const account = await activeAccount(tx, original.account_id);
    const plan = input.serie_tipo === "parcelamento"
      ? planoDeParcelas({ totalCents: original.amount_cents, numeroDeParcelas: input.count, dataCompra: original.occurred_on, diaFechamento: account.statement_closing_day })
      : planoDeRecorrencia({ valorCents: original.amount_cents, ocorrencias: input.count, dataInicial: original.occurred_on });
    const group_id = deps.ids.next(), transactions: LancamentoFinanceiro[] = [];
    let remainingPaid = original.paid_cents;
    for (const occurrence of plan) {
      const paid = input.serie_tipo === "parcelamento" ? Math.min(remainingPaid, occurrence.amountCents) : occurrence.numero === 1 ? original.paid_cents : 0;
      if (input.serie_tipo === "parcelamento") remainingPaid -= paid;
      const statement_month = account.kind === "credit_card" && original.statement_month !== null ? somaMeses(original.statement_month, occurrence.numero - 1) : occurrence.statementMonth;
      const fields = await transactionFields(tx, { ...original, amount_cents: occurrence.amountCents, paid_cents: paid, occurred_on: occurrence.occurredOn, statement_month, status: input.serie_tipo === "recorrencia" && occurrence.numero > 1 ? "planned" : original.status });
      const row = { ...newTransaction(deps, context, fields), source: input.serie_tipo === "recorrencia" ? "recurring" as const : "manual" as const, installment_group_id: group_id, installment_no: occurrence.numero, installment_total: input.count, serie_tipo: input.serie_tipo };
      transactions.push(await insertTransaction(tx, deps, context, row));
    }
    return { group_id, transactions };
  });
}
export function encerrarSerieFinanceira(store: UnitOfWork, deps: DependenciasDeDominio, context: ContextoDeEscrita, input: { client_id: string; installment_group_id: string; from_on: string }): Promise<ResultadoSerie> {
  input = structuredClone(input); context = { ...context };
  return executarComando(store, context, "finance.series.stop", input.client_id, input, async tx => {
    day(input.from_on, "Data de encerramento");
    exigir(input.from_on >= diaCivilDe(deps.clock.now()), "O encerramento preserva ocorrências passadas.");
    const rows = (await tx.financeiro.lancamentos.list({ includeDeleted: true })).filter(row => row.installment_group_id === input.installment_group_id);
    if (!rows.length) naoEncontrado(); exigir(rows.every(row => row.serie_tipo === "recorrencia"), "Somente recorrências podem ser encerradas.");
    const transactions: LancamentoFinanceiro[] = [];
    for (const before of rows) {
      const account = await tx.financeiro.contas.get(before.account_id);
      const unpaid = before.paid_cents === 0 || account?.kind === "credit_card" && ["planned", "pending"].includes(before.status);
      if (before.deleted_at !== null || before.occurred_on < input.from_on || !unpaid) continue;
      const now = deps.clock.now(), after = { ...before, deleted_at: now, updated_at: now };
      await tx.financeiro.lancamentos.replace(after); await emitirEvento(tx, deps, context, "finance_transaction", before, after, "deleted"); transactions.push(after);
    }
    return { group_id: input.installment_group_id, transactions };
  });
}
export function arquivarContaFinanceira(store: UnitOfWork, deps: DependenciasDeDominio, context: ContextoDeEscrita, input: Identificar): Promise<ContaFinanceira> {
  input = structuredClone(input); context = { ...context };
  return executarComando(store, context, "finance.account.close", input.client_id, input, async tx => {
    const before = await tx.financeiro.contas.get(input.id); if (!before) naoEncontrado(); if (before.archived_at) return before;
    const now = deps.clock.now(), after = { ...before, archived_at: now, updated_at: now };
    await tx.financeiro.contas.replace(after); await emitirEvento(tx, deps, context, "finance_account", before, after, "updated"); return after;
  });
}
export function duplicarLancamentoFinanceiro(store: UnitOfWork, deps: DependenciasDeDominio, context: ContextoDeEscrita, input: Identificar & { occurred_on?: string }): Promise<LancamentoFinanceiro> {
  input = structuredClone(input); context = { ...context };
  return executarComando(store, context, "finance.transaction.duplicate", input.client_id, input, async tx => {
    const before = await tx.financeiro.lancamentos.get(input.id); if (!before || before.deleted_at) naoEncontrado(); independent(before);
    const fields = await transactionFields(tx, { ...pick(before, transactionKeys), occurred_on: input.occurred_on ?? before.occurred_on, statement_month: undefined });
    return insertTransaction(tx, deps, context, newTransaction(deps, context, fields));
  });
}
export type CamposEtiquetaFinanceira = Pick<EtiquetaFinanceira, "name" | "color_key">;
async function tagFields(tx: Transacao, input: CamposEtiquetaFinanceira, id?: string) {
  exigir(tx.financeiro.etiquetas, "Etiquetas não estão disponíveis neste adaptador.");
  const fields = { name: text(input.name, "Nome da etiqueta", 80)!, color_key: color(input.color_key) }, normalized_name = normalize(fields.name);
  exigir(!(await tx.financeiro.etiquetas.list()).some(row => row.id !== id && row.normalized_name === normalized_name), "Já existe uma etiqueta com esse nome."); return { ...fields, normalized_name };
}
export function criarEtiquetaFinanceira(store: UnitOfWork, deps: DependenciasDeDominio, context: ContextoDeEscrita, input: CamposEtiquetaFinanceira & { client_id: string }): Promise<EtiquetaFinanceira> {
  input = structuredClone(input); context = { ...context };
  return executarComando(store, context, "finance.tag.create", input.client_id, input, async tx => {
    const fields = await tagFields(tx, input), now = deps.clock.now();
    const row = { ...fields, id: deps.ids.next(), user_id: context.user_id, created_at: now, updated_at: now };
    await tx.financeiro.etiquetas!.insert(row); await emitirEvento(tx, deps, context, "finance_tag", null, row, "created"); return row;
  });
}
export function editarEtiquetaFinanceira(store: UnitOfWork, deps: DependenciasDeDominio, context: ContextoDeEscrita, input: Editar<CamposEtiquetaFinanceira>): Promise<EtiquetaFinanceira> {
  input = structuredClone(input); context = { ...context };
  return executarComando(store, context, "finance.tag.update", input.client_id, input, async tx => {
    const before = await tx.financeiro.etiquetas?.get(input.id); if (!before) naoEncontrado();
    const fields = await tagFields(tx, { ...before, ...input.patch }, before.id), after = { ...before, ...fields, updated_at: deps.clock.now() };
    await tx.financeiro.etiquetas!.replace(after); await emitirEvento(tx, deps, context, "finance_tag", before, after, "updated"); return after;
  });
}
