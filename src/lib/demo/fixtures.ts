import type { EstadoInicialMemoria } from "../../adapters/memory";
import type { Captura } from "../../core/capturas";
import type { Categoria, HabitoDoUsuario, MarcacaoHabito, Projeto } from "../../core/contracts";
import type { Tarefa } from "../../core/tarefas";
import type { ContaFinanceira, CategoriaFinanceira, LancamentoFinanceiro } from "../../core/financeiro";
import { normalizarPagamento, somaMeses } from "../../core/financeiro";
import { segundaDaSemana, somarDias } from "../../core/habitos";
import { diaCivilDe, instanteDe } from "../../core/tempo";
import type { AgendaEvent } from "./types";

/** Exact illustrative day from doc 14 §3. The factory accepts another clock. */
export const DEMO_NOW = "2026-09-23T17:00:00.000Z";
export const DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";

export function createDemoFixture(now = DEMO_NOW, userId = DEMO_USER_ID): { initial: EstadoInicialMemoria; agenda: AgendaEvent[] } {
  const today = diaCivilDe(now), month = `${today.slice(0, 7)}-01`;
  const stamp = instanteDe(`${somarDias(today, -40)}T09:00`)!;
  const base = { user_id: userId, created_at: stamp, updated_at: stamp };
  const categories: Categoria[] = [["work", "Trabalho"], ["personal", "Pessoal"], ["study", "Estudos"]].map(([key, name]) => ({
    ...base, id: `category-${key}`, name: name!, normalized_name: name!.toLocaleLowerCase("pt-BR"), color_key: key!, is_system: true,
  }));
  const projects: Projeto[] = [
    { ...base, id: "project-sc-v2", name: "Segundo Cérebro V2", description: "Um lugar para capturar, conectar e organizar o dia.", color_key: "work", position: 0, deleted_at: null },
    { ...base, id: "project-central-voe", name: "Central VOE", description: "Operação e acompanhamento da Central.", color_key: "personal", position: 1, deleted_at: null },
  ];
  const task = (id: string, title: string, patch: Partial<Tarefa>): Tarefa => ({
    ...base, id, title, client_id: id, description: null, category_id: "category-work", project_id: null,
    source: "manual", origin_capture_id: null, status: "todo", priority: "medium", due_at: null,
    scheduled_start_at: null, scheduled_end_at: null, all_day: true, estimated_minutes: null,
    board_position: null, completed_at: null, archived_at: null, deleted_at: null, ...patch,
  });
  const tasks: Tarefa[] = [
    task("task-proposta", "Enviar proposta Central T15", { priority: "high", due_at: instanteDe(somarDias(today, -1)), board_position: 0 }),
    task("task-milestones", "Revisar plano de milestones do V2", { status: "in_progress", priority: "high", project_id: "project-sc-v2", due_at: instanteDe(`${today}T14:30`), scheduled_start_at: instanteDe(`${today}T14:00`), scheduled_end_at: instanteDe(`${today}T14:30`), all_day: false, estimated_minutes: 30, board_position: 1 }),
    task("task-fatura", "Pagar fatura do cartão Nubank", { category_id: "category-personal", due_at: instanteDe(`${somaMeses(month, 1).slice(0, 7)}-05`), board_position: 2 }),
    task("task-rls", "Estudar RLS de moderação", { category_id: "category-study", due_at: instanteDe(somarDias(today, 1)), estimated_minutes: 45, board_position: 3 }),
    task("task-spec", "Escrever spec do T-001", { project_id: "project-sc-v2", priority: "low", due_at: instanteDe(somarDias(today, 2)), board_position: 4 }),
    task("task-racao", "Comprar ração do Canto", { category_id: "category-personal", priority: "low", status: "done", due_at: instanteDe(today), completed_at: instanteDe(`${today}T10:00`), board_position: 5 }),
    task("task-rodada", "Responder rodada 2", { project_id: "project-sc-v2", status: "done", due_at: instanteDe(today), completed_at: instanteDe(`${today}T11:00`), board_position: 6 }),
  ];
  // Names and exact bodies: doc 14 §3.1. These are synthetic product examples.
  const notes: Array<[string, string, Captura["type"], string, string | null, Captura["status"], string]> = [
    ["architecture", "Decisões de arquitetura", "note", "work", "project-sc-v2", "organized", "O Núcleo concentra as regras; as telas cuidam da experiência. A direção está em [[Visão do produto]].\n\nTrês decisões para levar adiante:\n• Dinheiro em centavos inteiros.\n• Fatura derivada na leitura.\n• Toda escrita registra sua origem.\n\nO modelo de valores está em [[Financeiro fundido]]."],
    ["vision", "Visão do produto", "note", "work", "project-sc-v2", "organized", "Um sistema integrado de informações pessoais. Capturar, conectar e reencontrar o que importa.\n\nAs regras estão em [[Decisões de arquitetura]]. Uma ideia pequena pode começar no [[Atalho de captura pelo relógio?]]."],
    ["journal", "Diário de bordo", "note", "work", "project-sc-v2", "organized", "Hoje fechei as [[Decisões de arquitetura]] e revisei as etapas do projeto.\n\nPróximo passo: experimentar a captura no celular com o mínimo de interrupções."],
    ["finance", "Financeiro fundido", "note", "personal", "project-sc-v2", "organized", "Unir plano do mês, pagamentos parciais e visão de dívida. A fatura continua derivada.\n\nContexto: [[Decisões de arquitetura]]."],
    ["watch", "Atalho de captura pelo relógio?", "idea", "personal", null, "inbox", "Registrar uma ideia sem tirar o celular do bolso. Começar pelo fluxo de captura rápida da [[Visão do produto]]."],
    ["accountant", "Ligar pro contador até sexta", "task", "personal", null, "inbox", "Confirmar documentos e alinhar a próxima entrega."],
    ["book", "Livro: A Philosophy of Software Design", "note", "study", null, "inbox", "Boas interfaces escondem complexidade e tornam a intenção clara.\n\nAplicar essa ideia às [[Decisões de arquitetura]] do Segundo Cérebro."],
  ];
  const captures: Captura[] = notes.map(([id, title, type, category, project_id, status, content], index) => ({
    ...base, id, client_id: id, title, type, category_id: `category-${category}`, project_id, status, content,
    created_at: new Date(Date.parse(stamp) - index * 60_000).toISOString(),
    captured_at: new Date(Date.parse(stamp) - index * 60_000).toISOString(), organized_at: status === "organized" ? stamp : null, converted_task_id: null, archived_at: null, deleted_at: null,
  }));
  const monday = segundaDaSemana(today);
  const habits: HabitoDoUsuario[] = [
    { ...base, id: "habit-leitura", name: "Ler 20 minutos", schedule_kind: "daily", weekdays: [], weekly_target: null, started_on: somarDias(today, -11), archived_at: null, color_key: "study", icon_key: null, position: 0 },
    { ...base, id: "habit-academia", name: "Academia", schedule_kind: "weekly_target", weekdays: [], weekly_target: 3, started_on: somarDias(monday, -35), archived_at: null, color_key: "personal", icon_key: null, position: 1 },
    { ...base, id: "habit-meditacao", name: "Meditar 10 min", schedule_kind: "weekdays", weekdays: [1, 3, 5], weekly_target: null, started_on: monday, archived_at: null, color_key: "personal", icon_key: null, position: 2 },
  ];
  const entries: MarcacaoHabito[] = [];
  const mark = (habitId: string, day: string) => { if (day <= today) entries.push({ id: `mark-${habitId}-${day}`, user_id: userId, habit_id: habitId, done_on: day, note: null, created_at: instanteDe(`${day}T08:00`)! }); };
  for (let offset = -11; offset <= 0; offset++) mark("habit-leitura", somarDias(today, offset));
  for (let week = -5; week < 0; week++) for (let day = 0; day < 3; day++) mark("habit-academia", somarDias(monday, week * 7 + day));
  mark("habit-academia", monday); mark("habit-academia", somarDias(monday, 1)); mark("habit-meditacao", monday);
  const account = (id: string, name: string, kind: ContaFinanceira["kind"], opening: number): ContaFinanceira => ({ ...base, id, name, kind, institution: name, currency: "BRL", opening_balance_cents: opening, color_key: "fin-1", archived_at: null, credit_limit_cents: null, statement_closing_day: null, payment_due_day: null });
  const accounts = [account("account-itau", "Itaú", "checking", 195222), account("account-cdb", "CDB", "investment", 1370000), { ...account("account-nubank", "Nubank", "credit_card", 0), credit_limit_cents: 800000, statement_closing_day: 28, payment_due_day: 5 }];
  const financeCategories: CategoriaFinanceira[] = ["Receita", "Moradia", "Alimentação", "Transporte", "Saúde", "Outras"].map((name, index) => ({ ...base, id: `fin-category-${index}`, name, normalized_name: name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR"), kind: index === 0 ? "income" : "expense", parent_id: null, color_key: `fin-${index + 1}` }));
  const transactions: LancamentoFinanceiro[] = [];
  function movement(id: string, accountId: string, description: string, amount: number, kind: LancamentoFinanceiro["kind"], category: number | null, day: number, transfer: string | null = null) {
    const row: LancamentoFinanceiro = { ...base, id, account_id: accountId, category_id: category === null ? null : `fin-category-${category}`, kind, amount_cents: amount, description, payee: null, occurred_on: `${month.slice(0, 7)}-${String(day).padStart(2, "0")}`, transfer_group_id: transfer, notes: null, paid_cents: amount, installment_group_id: null, installment_no: null, installment_total: null, statement_month: accountId === "account-nubank" ? month : null, serie_tipo: null, status: "confirmed", source: "manual", due_date: null, deleted_at: null };
    const { is_paid: _derived, ...normalized } = normalizarPagamento(row, accounts.find((item) => item.id === accountId)!);
    void _derived; transactions.push(normalized);
  }
  movement("fin-income", "account-itau", "Recebimento do mês", 800000, "income", 0, 5);
  movement("fin-moradia", "account-itau", "Moradia", 83480, "expense", 1, 5);
  movement("fin-transfer-out", "account-itau", "Aplicação em CDB", 480000, "expense", null, 6, "transfer-cdb");
  movement("fin-transfer-in", "account-cdb", "Aplicação em CDB", 480000, "income", null, 6, "transfer-cdb");
  movement("fin-food", "account-nubank", "Alimentação do mês", 123410, "expense", 2, 20);
  movement("fin-transport", "account-nubank", "Transporte", 45420, "expense", 3, 21);
  movement("fin-health", "account-nubank", "Saúde", 38990, "expense", 4, 15);
  movement("fin-other", "account-nubank", "Outras despesas", 32440, "expense", 5, 16);
  movement("fin-home", "account-nubank", "Itens para casa", 1020, "expense", 1, 10);
  const agenda: AgendaEvent[] = [["event-daily", "Daily Maestri", "09:30", "09:45", "Google Meet"], ["event-voe", "Reunião Central VOE", "15:00", "16:00", null], ["event-academia", "Academia", "19:00", "20:00", null]].map(([id, title, start, end, location]) => ({ id: id!, title: title!, starts_at: instanteDe(`${today}T${start}`)!, ends_at: instanteDe(`${today}T${end}`)!, location: location ?? null, linked_capture_id: null, habit_id: id === "event-academia" ? "habit-academia" : null }));
  return { initial: { task: tasks, capture: captures, category: categories, project: projects, habit: habits, habit_entry: entries, habit_pause: [], finance_account: accounts, finance_category: financeCategories, finance_transaction: transactions, finance_budget: [{ ...base, id: "budget-food", category_id: "fin-category-2", month, limit_cents: 150000 }] }, agenda };
}
