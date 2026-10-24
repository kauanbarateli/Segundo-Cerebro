import { useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { GoalsPanel } from "../../../src/components/features/financeiro/goals/goals-panel";
import { Button } from "../../../src/components/ui/button";
import type { FinancialGoal, GoalCommand, GoalCommandResult, GoalHighlight, GoalRelease, GoalReservation } from "../../../src/core/financeiro/goals/goal-types";
import type { FinanceGoalsClient, GoalDetailView, GoalJournalView, GoalPageView, GoalPrepared, GoalReply } from "../../../src/lib/finance-goals-client-contract";
import { captureGoalTerminalBrowserAttempt, consumeGoalTerminalProof, receiveGoalTerminalBrowserOutcome, type GoalTerminalClientOutcome } from "../../../src/lib/finance-goals-terminal-browser";
import type { GoalTerminalDisposition, GoalTerminalReply } from "../../../src/lib/finance-goals-terminal-contract";

/** Entire port/journal is synthetic RAM. Does NOT certify storage durability, HTTP, Auth or SQL. */
export interface GoalsFixtureOptions { hidden?: boolean; compact?: boolean; empty?: boolean; image?: boolean; featured?: boolean; mode?: "normal" | "lost-response" | "no-receipt" | "quota" | "unavailable"; terminal?: "normal" | "fail" | "lost-response"; pending?: boolean; ownerId?: string; hostRefresh?: "fail-once" | "fail-twice" | "hold-first" }
export interface GoalsTrace { method: string; owner: string; clientId?: string }
export const fixtureOwner = "11111111-1111-4111-8111-111111111111", fixtureOther = "22222222-2222-4222-8222-222222222222";
export const fixtureGoalImage = "77777777-7777-4777-8777-777777777777";
const accountId = "33333333-3333-4333-8333-333333333333", goalId = "44444444-4444-4444-8444-444444444444", reservationId = "55555555-5555-4555-8555-555555555555", instant = "2026-10-23T12:00:00Z";
let root: Root | null = null, current: ReturnType<typeof fakeClient> | null = null;
let change: ((options: GoalsFixtureOptions) => void) | null = null;
let setMask: ((value: boolean) => void) | null = null;
const trace: GoalsTrace[] = [];
function ok<T>(result: T): GoalReply<T> { return { ok: true, result: structuredClone(result) }; }
function same(a: GoalCommand, b: GoalCommand) { return JSON.stringify(a) === JSON.stringify(b); }
function fakeClient(options: GoalsFixtureOptions) {
  const owner = options.ownerId ?? fixtureOwner, epoch = crypto.randomUUID(); let live = true, revision = 1;
  let refreshFailures = options.hostRefresh === "fail-twice" ? 2 : options.hostRefresh === "fail-once" ? 1 : 0;
  let holdRefresh = options.hostRefresh === "hold-first", releaseRefresh = () => undefined as void;
  const refreshGate = holdRefresh ? new Promise<void>(done => { releaseRefresh = done; }) : Promise.resolve();
  let journal: GoalJournalView = { ownerId: owner, epoch, reconfirmRequired: false, pending: null };
  if (options.pending) journal.pending = { phase: "uncertain", intent: { command: "finance.goal.create", input: { client_id: "88888888-8888-4888-8888-888888888888", expected_finance_revision: "1", name: "Reserva da viagem", target_cents: 100000, deadline: null, image_file_id: null } } };
  let highlight: GoalHighlight | null = options.featured && !options.empty ? { version: 1, id: owner, user_id: owner, goal_id: goalId, revision: "1", created_at: instant, updated_at: instant } : null;
  let goals: FinancialGoal[] = options.empty ? [] : [{ version: 1, id: goalId, user_id: owner, name: "Viagem dos sonhos", target_cents: 600000, deadline: "2027-07-01", image_file_id: options.image ? fixtureGoalImage : null, archived_at: null, revision: "1", created_at: instant, updated_at: instant }];
  const reservations: GoalReservation[] = options.empty ? [] : [{ version: 1, id: reservationId, user_id: owner, goal_id: goalId, account_id: accountId, amount_cents: 240000, occurred_on: "2026-10-20", client_id: reservationId, created_at: instant }];
  const releases: GoalRelease[] = [], receipts = new Map<string, { intent: GoalCommand; result: GoalCommandResult }>();
  const terminalDispositions = new Map<string, GoalTerminalDisposition>();
  const stamp = (method: string, intent?: GoalCommand) => { trace.push({ method, owner, ...(intent ? { clientId: intent.input.client_id } : {}) }); };
  const released = (id: string) => releases.filter(row => row.reservation_id === id).reduce((sum, row) => sum + row.amount_cents, 0);
  const saved = (id: string) => reservations.filter(row => row.goal_id === id).reduce((sum, row) => sum + row.amount_cents - released(row.id), 0);
  const reserved = () => reservations.reduce((sum, row) => sum + row.amount_cents - released(row.id), 0);
  const item = (goal: FinancialGoal) => ({ goal, totals: { user_id: owner, goal_id: goal.id, finance_revision: String(revision), saved_cents: saved(goal.id) } });
  const known = (intent: GoalCommand) => { const receipt = receipts.get(intent.input.client_id); return receipt && same(receipt.intent, intent) ? receipt : null; };
  async function terminalAttempt(intent: GoalCommand, method: "status" | "settle"): Promise<GoalReply<GoalTerminalClientOutcome>> {
    stamp("attempt-" + method, intent);
    const guard = () => { if (!live) throw Error("Synthetic session changed."); };
    const abort = new AbortController(), capture = await captureGoalTerminalBrowserAttempt(owner, epoch, intent, abort.signal, guard);
    if (options.terminal === "fail") return { ok: false, code: "uncertain", message: "Synthetic terminal failure." };
    const receipt = known(intent);
    let disposition = terminalDispositions.get(intent.input.client_id);
    if (!receipt && !disposition && method === "settle") {
      disposition = { ...capture.binding, id: crypto.randomUUID(), closed_at: instant };
      terminalDispositions.set(intent.input.client_id, disposition); revision += 1;
    }
    // This RAM server seam models a lost reply after the control write. It is
    // deliberately not evidence of SQL atomicity or localStorage durability.
    if (method === "settle" && options.terminal === "lost-response") return { ok: false, code: "uncertain", message: "Synthetic lost terminal response." };
    const reply: GoalTerminalReply = receipt ? { version: 2, kind: "confirmed", binding: { ...capture.binding }, result: receipt.result }
      : disposition ? { version: 2, kind: "closed", binding: { ...capture.binding }, disposition }
      : { version: 2, kind: "uncertain", binding: { ...capture.binding } };
    const outcome = await receiveGoalTerminalBrowserOutcome(capture, async () => ({ ok: true, result: reply }), abort.signal, guard);
    if (outcome.proof !== null) {
      consumeGoalTerminalProof(outcome.proof, owner, epoch, intent);
      journal = { ...journal, pending: null, reconfirmRequired: true };
    }
    return { ok: true, result: outcome };
  }
  function apply(intent: GoalCommand): GoalCommandResult {
    if (terminalDispositions.has(intent.input.client_id)) throw new Error("fixture terminal fence");
    const previous = known(intent); if (previous) return previous.result;
    const requestedId = "goal_id" in intent.input ? intent.input.goal_id : null;
    const base = requestedId ? goals.find(goal => goal.id === requestedId) : null;
    let result: GoalCommandResult;
    if (intent.command === "finance.goal.create") { const goal: FinancialGoal = { version: 1, id: crypto.randomUUID(), user_id: owner, name: intent.input.name, target_cents: intent.input.target_cents, deadline: intent.input.deadline, image_file_id: null, archived_at: null, revision: "0", created_at: instant, updated_at: instant }; goals.push(goal); result = { version: 1, goal }; }
    else if (intent.command === "finance.goal.update") { if (!base) throw new Error("fixture goal missing"); const goal = { ...base, ...intent.input.patch, revision: String(Number(base.revision) + 1), updated_at: instant }; goals = goals.map(row => row.id === goal.id ? goal : row); result = { version: 1, goal }; }
    else if (intent.command === "finance.goal.archive" || intent.command === "finance.goal.restore") { if (!base) throw new Error("fixture goal missing"); const goal = { ...base, archived_at: intent.command === "finance.goal.archive" ? instant : null, revision: String(Number(base.revision) + 1), updated_at: instant }; goals = goals.map(row => row.id === goal.id ? goal : row); if (highlight?.goal_id === goal.id && goal.archived_at) highlight = { ...highlight, goal_id: null, revision: String(Number(highlight.revision) + 1) }; result = { version: 1, goal, highlight }; }
    else if (intent.command === "finance.goal.highlight") { highlight = { version: 1, id: owner, user_id: owner, goal_id: intent.input.goal_id, revision: String(Number(highlight?.revision ?? "0") + 1), created_at: instant, updated_at: instant }; result = { version: 1, highlight }; }
    else if (intent.command === "finance.goal.contribute") { const reservation: GoalReservation = { version: 1, id: crypto.randomUUID(), user_id: owner, goal_id: intent.input.goal_id, account_id: intent.input.account_id, amount_cents: intent.input.amount_cents, occurred_on: intent.input.occurred_on, client_id: intent.input.client_id, created_at: instant }; reservations.push(reservation); result = { version: 1, reservation }; }
    else if (intent.command === "finance.goal.release") { const release: GoalRelease = { version: 1, id: crypto.randomUUID(), user_id: owner, reservation_id: intent.input.reservation_id, amount_cents: intent.input.amount_cents, occurred_on: intent.input.occurred_on, client_id: intent.input.client_id, created_at: instant }; releases.push(release); result = { version: 1, release }; }
    else throw new Error("fixture command unavailable");
    revision += 1; receipts.set(intent.input.client_id, { intent: structuredClone(intent), result: structuredClone(result) }); return result;
  }
  const client: FinanceGoalsClient = {
    ownerId: owner, epoch, isCurrent: () => live,
    ...(options.terminal ? { terminal: { status: (intent: GoalCommand) => terminalAttempt(intent, "status"), settle: (intent: GoalCommand) => terminalAttempt(intent, "settle") } } : {}),
    async loadPending() { stamp("journal"); return ok(journal); },
    async availability() { stamp("availability"); return ok({ available: options.mode !== "unavailable" }); },
    async page(query) { stamp("page"); const matching = goals.filter(goal => query.archived === "all" || query.archived === (goal.archived_at ? "archived" : "active")).sort((a, b) => a.id < b.id ? -1 : 1).filter(goal => query.cursor === null || goal.id > query.cursor); const rows = matching.slice(0, query.limit); const view: GoalPageView = { version: 1, finance_revision: String(revision), items: rows.map(item), highlight, next_cursor: matching.length > rows.length ? rows.at(-1)!.id : null }; return ok(view); },
    async detail(id) { stamp("detail"); const goal = goals.find(value => value.id === id); const detail: GoalDetailView | null = goal ? { version: 1, finance_revision: String(revision), ...item(goal), highlight } : null; return ok(detail); },
    async reservations(query) { stamp("reservations"); return ok({ version: 1 as const, finance_revision: String(revision), items: reservations.filter(row => row.goal_id === query.id).map(reservation => ({ reservation, totals: { user_id: owner, reservation_id: reservation.id, finance_revision: String(revision), released_cents: released(reservation.id) } })), next_cursor: null }); },
    async releases(query) { stamp("releases"); return ok({ version: 1 as const, finance_revision: String(revision), items: releases.filter(row => row.reservation_id === query.id), next_cursor: null }); },
    async prepare(intent) {
      stamp("prepare", intent); const previous = known(intent); if (previous) return ok<GoalPrepared>({ kind: "confirmed", intent, result: previous.result });
      const available = 600000 - reserved();
      if (intent.command === "finance.goal.contribute" && (intent.input.amount_cents > available || intent.input.account_id !== accountId)) return { ok: false, code: "validation", message: "Disponível insuficiente para este aporte." };
      return ok<GoalPrepared>({ kind: "review", intent, financeRevision: String(revision), goalRevision: "expected_revision" in intent.input ? intent.input.expected_revision : null, highlightRevision: "expected_highlight_revision" in intent.input ? intent.input.expected_highlight_revision : null, account: intent.command === "finance.goal.contribute" ? { id: accountId, realBalance: 600000, reserved: reserved(), available } : null });
    },
    async stage(intent) { stamp("stage", intent); if (options.mode === "quota") return { ok: false, code: "journal-unavailable", message: "Registro indisponível; nenhum envio realizado." }; if (journal.pending && !same(journal.pending.intent, intent)) return { ok: false, code: "uncertain", message: "Resolva a tentativa anterior." }; journal = { ...journal, pending: { intent: structuredClone(intent), phase: "staged" } }; return ok(journal); },
    async execute(intent) { stamp("execute", intent); if (!journal.pending || !same(journal.pending.intent, intent)) throw new Error("fixture stage required"); journal.pending.phase = "uncertain"; if (options.mode === "no-receipt") return { ok: false, code: "uncertain", message: "Sem confirmação." }; const result = apply(intent); if (options.mode === "lost-response") return { ok: false, code: "uncertain", message: "Resposta perdida." }; journal.pending = null; return ok(result); },
    async reconcile(intent) { stamp("reconcile", intent); const previous = known(intent); if (!previous) return { ok: false, code: "uncertain", message: "Ausência de recibo não comprova ausência de efeito." }; journal.pending = null; return ok(previous.result); },
    async acknowledgeReview() { stamp("acknowledge"); if (journal.pending) return { ok: false, code: "uncertain", message: "Pendente" }; journal.reconfirmRequired = false; return ok(journal); },
  };
  return { client, releaseRefresh() { releaseRefresh(); }, async refresh() { stamp("host-refresh"); if (holdRefresh) { holdRefresh = false; await refreshGate; } if (refreshFailures > 0) { refreshFailures--; throw new Error("SYNTHETIC_HOST_REFRESH_REFUSED"); } }, close() { live = false; journal.pending = null; }, snapshot() { return structuredClone({ goals, reservations, releases, journal, revision, terminalDispositions: [...terminalDispositions.values()] }); } };
}
function Fixture({ options }: { options: GoalsFixtureOptions }) {
  const [session, setSession] = useState(() => fakeClient(options)), [hidden, setHidden] = useState(options.hidden ?? false), [closed, setClosed] = useState(false);
  current = session;
  setMask = setHidden;
  change = input => { session.close(); setSession(fakeClient(input)); setClosed(false); };
  return <main style={{ padding: 16, maxWidth: 1100, margin: "auto" }}><h1>Metas sintéticas</h1><Button onClick={() => setHidden(value => !value)}>{hidden ? "Exibir valores do painel" : "Ocultar valores do painel"}</Button><Button onClick={() => { session.close(); setClosed(true); }}>Encerrar sessão sintética</Button>
    {closed ? <p>Sessão encerrada; o corpo local foi redigido na fixture.</p> : <GoalsPanel client={session.client} ownerId={session.client.ownerId} today="2026-10-23" accounts={[{ id: accountId, name: "Conta principal", currency: "BRL", kind: "checking", archived: false }, { id: "66666666-6666-4666-8666-666666666666", name: "Cartão não elegível", currency: "BRL", kind: "credit_card", archived: false }]} hidden={hidden} reveal={() => setHidden(false)} createId={() => crypto.randomUUID()} compact={options.compact} onResolved={options.hostRefresh ? session.refresh : undefined} />}
  </main>;
}
declare global { interface Window { __mountGoals(options: GoalsFixtureOptions): void; __changeGoalsOwner(options: GoalsFixtureOptions): void; __setGoalsHidden(value: boolean): void; __releaseGoalsHostRefresh(): void; __goalsTrace: GoalsTrace[]; __goalsSnapshot(): unknown; __unmountGoals(): void } }
Object.assign(window, {
  __goalsTrace: trace,
  __mountGoals(options: GoalsFixtureOptions) { const host = document.getElementById("goals-root"); if (!host) throw new Error("fixture host missing"); root ??= createRoot(host); root.render(<Fixture options={options} />); },
  __changeGoalsOwner(options: GoalsFixtureOptions) { change?.(options); },
  __setGoalsHidden(value: boolean) { setMask?.(value); },
  __releaseGoalsHostRefresh() { current?.releaseRefresh(); },
  __goalsSnapshot() { return current?.snapshot(); },
  __unmountGoals() { current?.close(); root?.unmount(); root = null; current = null; change = null; setMask = null; },
});
