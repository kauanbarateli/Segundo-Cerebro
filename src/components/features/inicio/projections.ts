import type { Captura } from "../../../core/capturas";
import type { Tarefa } from "../../../core/tarefas";
import type { HabitoDoUsuario, MarcacaoHabito, PausaDoUsuario } from "../../../core/contracts";
import { contarNaSemana, resumirHabitos, segundaDaSemana } from "../../../core/habitos/habits";
import { dayRangeInTimeZone, diaCivilDe } from "../../../core/tempo";
import { faturaFinanceira, fechamentoDaFatura, saldosFinanceiros, statusDaFatura, totaisFinanceiros, vencimentoDaFatura,
  type ContaFinanceira, type LancamentoFinanceiro } from "../../../core/financeiro";

/** One eligible collection feeds the 3/5 responsive list and all counters. */
export function projectTasks(items: readonly Tarefa[], nowIso: string) {
  const today = diaCivilDe(nowIso);
  const monday = segundaDaSemana(today);
  const active = items.filter((item) => item.deleted_at === null && item.archived_at === null && item.status !== "archived");
  const open = active.filter((item) => item.status !== "done");
  const isDue = (task: Tarefa) => task.due_at !== null && diaCivilDe(task.due_at) <= today;
  const isScheduled = (task: Tarefa) => task.scheduled_start_at !== null && diaCivilDe(task.scheduled_start_at) === today;
  const byDate = (a: Tarefa, b: Tarefa) => Date.parse(a.due_at ?? a.scheduled_start_at ?? "9999-01-01T00:00:00Z") - Date.parse(b.due_at ?? b.scheduled_start_at ?? "9999-01-01T00:00:00Z") || a.id.localeCompare(b.id);
  const focus = open.find((item) => item.status === "in_progress") ?? open.filter((item) => isDue(item) || isScheduled(item)).sort(byDate)[0] ?? null;
  const rank = (task: Tarefa) => task.status === "done" ? 3 : task.due_at && diaCivilDe(task.due_at) < today ? 0 : task.id === focus?.id ? 1 : 2;
  const rows = active.filter((item) => item.status === "done"
    ? item.completed_at !== null && diaCivilDe(item.completed_at) === today
    : item.id === focus?.id || isDue(item) || isScheduled(item))
    .sort((a, b) => rank(a) - rank(b) || byDate(a, b));
  return { focus, today: rows, openCount: open.length,
    completedWeek: active.filter((item) => item.status === "done" && item.completed_at && diaCivilDe(item.completed_at) >= monday && diaCivilDe(item.completed_at) <= today).length };
}

export function projectCaptures(items: readonly Captura[]) {
  const active = items.filter((item) => item.deleted_at === null && item.archived_at === null && item.status !== "archived" && item.status !== "draft");
  return { inbox: active.filter((item) => item.status === "inbox"), organized: active.filter((item) => item.status === "organized").length, total: active.length };
}

export function projectHabits(items: readonly HabitoDoUsuario[], entries: readonly MarcacaoHabito[], pauses: readonly PausaDoUsuario[], nowIso: string) {
  const today = diaCivilDe(nowIso);
  const monday = segundaDaSemana(today);
  const marks = new Map(items.map((habit) => [habit.id, new Set(entries.filter((entry) => entry.habit_id === habit.id && entry.done_on <= today).map((entry) => entry.done_on))]));
  const ordered = [...items].sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, "pt-BR") || a.id.localeCompare(b.id));
  const summary = resumirHabitos(ordered, marks, monday, today, today, [...pauses]);
  return { summary, items: summary.porHabito.map((row) => ({ habit: row.habito,
    // A mark can be undone after its cadence or pause changes.
    done: marks.get(row.habito.id)!.has(today) ? true : row.hojeFeito, summary: row,
    weeklyDone: row.habito.schedule_kind === "weekly_target" ? contarNaSemana(row.habito, marks.get(row.habito.id)!, monday) : null,
  })) };
}

export function projectAgenda<T extends { id: string; starts_at: string; ends_at: string }>(items: readonly T[], nowIso: string) {
  const range = dayRangeInTimeZone(new Date(nowIso));
  const start = Date.parse(range.startIso), end = Date.parse(range.endIso);
  const rows = items.filter((item) => Date.parse(item.starts_at) < end && Date.parse(item.ends_at) > start)
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at) || a.id.localeCompare(b.id));
  return { items: rows, next: rows.find((item) => Date.parse(item.ends_at) > Date.parse(nowIso)) ?? null };
}

export function projectFinance(accounts: readonly ContaFinanceira[], transactions: readonly LancamentoFinanceiro[], nowIso: string) {
  const today = diaCivilDe(nowIso), month = `${today.slice(0, 7)}-01`;
  const totals = totaisFinanceiros(transactions, accounts, [month]);
  const balances = saldosFinanceiros(transactions, accounts).filter((balance) => accounts.some((account) => account.id === balance.account_id && account.archived_at === null));
  const cards = accounts.filter((account) => account.archived_at === null && account.kind === "credit_card" && account.statement_closing_day !== null && account.payment_due_day !== null)
    .map((account) => {
      const statement = faturaFinanceira(transactions, account, month);
      return { account, statement, closes: fechamentoDaFatura(month, account.statement_closing_day!), due: vencimentoDaFatura(month, account.payment_due_day!, account.statement_closing_day!),
        status: statusDaFatura({ hoje: today, mesFatura: month, diaFechamento: account.statement_closing_day!, diaVencimento: account.payment_due_day!, resumo: statement }) };
    });
  return { month, totals, balances, cards };
}
