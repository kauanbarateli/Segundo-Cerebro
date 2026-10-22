import { somaMeses, somaMesesNaData, ultimoDiaDoMes } from "./credit";
import { totalExato } from "./arithmetic";
import { cartoesDe, isTransfer, mesDeCompetencia, type MonthTotals } from "./finance";
import { normalizarPagamento, participaDoReal, totaisFinanceiros, type ContaFinanceira, type LancamentoFinanceiro } from "./fused";

export interface PontoDaCompetencia extends MonthTotals {
  /** null is the initial bucket for dates outside this civil month. */
  day: string | null;
  label: string;
}
export type LinhaDaCompetencia = Pick<LancamentoFinanceiro, "id" | "account_id" | "occurred_on" | "statement_month" | "kind" | "amount_cents" | "paid_cents" | "status"> & { competence: string | null };
export interface LinhaTemporalDaCompetencia {
  month: string;
  /** Initial bucket, then every civil day, including days without movements. */
  points: PontoDaCompetencia[];
  rows: LinhaDaCompetencia[];
  /** Real, non-transfer entries needing correction, never assigned by guess. */
  unassigned: LinhaDaCompetencia[];
}

function dataCivilValida(value: string): void {
  if (typeof value !== "string" || !/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value)) throw new RangeError("Informe uma data civil válida.");
  try { somaMesesNaData(value, 0); }
  catch { throw new RangeError("Informe uma data civil válida."); }
}

function mesValido(value: string): string {
  if (typeof value !== "string" || !/^(?!0000)\d{4}-\d{2}(?:-\d{2})?$/.test(value)) throw new RangeError("Informe um mês civil válido.");
  // Existing month inputs allow YYYY-MM or an actual civil date. Validate the
  // latter before canonicalization instead of silently accepting February 31.
  try {
    if (value.length !== 7) dataCivilValida(value);
    return somaMeses(value, 0);
  } catch { throw new RangeError("Informe um mês civil válido."); }
}

/** Competence analysis, never a cash-flow or current-account balance. */
export function linhaTemporalDaCompetencia({ transactions, accounts, month }: {
  transactions: readonly LancamentoFinanceiro[]; accounts: readonly ContaFinanceira[]; month: string;
}): LinhaTemporalDaCompetencia {
  const target = mesValido(month), owners = new Set([...accounts, ...transactions].map(row => row.user_id));
  if (owners.size > 1 || [...owners].some(owner => typeof owner !== "string" || !owner.trim())) throw new Error("A análise exige dados do mesmo usuário.");
  for (const rows of [accounts, transactions]) {
    if (rows.some(row => typeof row.id !== "string" || !row.id) || new Set(rows.map(row => row.id)).size !== rows.length) throw new Error("Identidade inválida ou duplicada na análise.");
  }
  const byAccount = new Map(accounts.map(account => [account.id, account]));
  const statuses = new Set(["planned", "pending", "confirmed", "reconciled", "cancelled"]);
  for (const row of transactions) {
    const account = byAccount.get(row.account_id);
    if (!account || account.user_id !== row.user_id) throw new Error("Lançamento sem conta correspondente do mesmo usuário.");
    if (!statuses.has(row.status) || !["income", "expense"].includes(row.kind)) throw new Error("Estado ou tipo de lançamento inválido.");
    dataCivilValida(row.occurred_on);
    if (row.statement_month !== null) mesValido(row.statement_month);
    normalizarPagamento(row, account);
  }
  const totals = totaisFinanceiros(transactions, accounts, [target]), cards = cartoesDe([...accounts]);
  const days = ultimoDiaDoMes(Number(target.slice(0, 4)), Number(target.slice(5, 7)));
  const movements = Array.from({ length: days + 1 }, () => ({ income: 0n, expense: 0n, count: 0 }));
  const selected: LinhaDaCompetencia[] = [], unassigned: LinhaDaCompetencia[] = [];
  for (const row of transactions) {
    if (!participaDoReal(row) || isTransfer(row)) continue;
    const competence = mesDeCompetencia(row, cards);
    const line: LinhaDaCompetencia = { id: row.id, account_id: row.account_id, occurred_on: row.occurred_on,
      statement_month: row.statement_month, kind: row.kind, amount_cents: row.amount_cents, paid_cents: row.paid_cents, status: row.status, competence };
    if (competence === null) { unassigned.push(line); continue; }
    if (competence !== target) continue;
    selected.push(line);
    // The stored competence is authoritative even when the original date is
    // before OR after the selected civil month (SPEC-08 doc03).
    const index = row.occurred_on.slice(0, 7) === target.slice(0, 7) ? Number(row.occurred_on.slice(8, 10)) : 0;
    const movement = movements[index]!;
    if (row.kind === "income") movement.income += BigInt(row.amount_cents);
    else movement.expense += BigInt(row.amount_cents);
    movement.count++;
  }
  let income = 0n, expense = 0n, count = 0;
  const points = movements.map((movement, index): PontoDaCompetencia => {
    income += movement.income; expense += movement.expense; count += movement.count;
    return { day: index === 0 ? null : `${target.slice(0, 7)}-${String(index).padStart(2, "0")}`,
      label: index === 0 ? "Anteriores desta competência" : String(index), incomeCents: totalExato(income, "Entradas acumuladas"),
      expenseCents: totalExato(expense, "Despesas acumuladas"), balanceCents: totalExato(income - expense, "Resultado acumulado"), transactionCount: count };
  });
  const last = points[points.length - 1]!;
  if (last.incomeCents !== totals.incomeCents || last.expenseCents !== totals.expenseCents || last.balanceCents !== totals.balanceCents || last.transactionCount !== totals.transactionCount) throw new Error("A análise diverge dos totais da competência.");
  const byDate = (a: LinhaDaCompetencia, b: LinhaDaCompetencia) => a.occurred_on.localeCompare(b.occurred_on) || a.id.localeCompare(b.id);
  return { month: target, points, rows: selected.sort(byDate), unassigned: unassigned.sort(byDate) };
}
