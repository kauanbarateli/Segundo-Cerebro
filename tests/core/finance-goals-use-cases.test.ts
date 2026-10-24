import { expect, it } from "vitest";
import { executeGoalCommand, projectAccountAvailability, projectGoalProgress, type GoalCommand, type GoalCommandResult, type GoalImage } from "../../src/core/financeiro/goals";
import type { DependenciasDeDominio } from "../../src/core/contracts/base";
import { patrimonioFinanceiro, type LancamentoFinanceiro } from "../../src/core/financeiro/fused";
import type { GoalUnitOfWork } from "../../src/core/financeiro/goals/goal-ports";
import { financialGoal, goalAccount, GoalMemoryFixture, goalId, goalImage, goalReservation, GOAL_NOW, GOAL_OTHER, GOAL_OWNER, GOAL_TODAY } from "../fixtures/finance-goals";

function fixture(initialGoal = true) {
  const store = new GoalMemoryFixture(); if (initialGoal) store.state.goals.push(financialGoal()); let sequence = 100, client = 1000;
  const deps: DependenciasDeDominio = { clock: { now: () => GOAL_NOW }, ids: { next: () => goalId(++sequence) } };
  const common = () => ({ client_id: goalId(++client), expected_finance_revision: store.state.revision });
  const existing = () => ({ ...common(), goal_id: store.state.goals[0]!.id, expected_revision: store.state.goals[0]!.revision });
  const run = (command: GoalCommand) => executeGoalCommand(store, deps, { user_id: GOAL_OWNER, canal: "web" }, command);
  const contribute = (amount = 20000): Extract<GoalCommand, { command: "finance.goal.contribute" }> => ({ command: "finance.goal.contribute", input: { ...existing(), account_id: goalAccount.id, amount_cents: amount, occurred_on: GOAL_TODAY } });
  const release = (reservationId: string, amount = 5000): Extract<GoalCommand, { command: "finance.goal.release" }> => ({ command: "finance.goal.release", input: { ...common(), reservation_id: reservationId, amount_cents: amount, occurred_on: GOAL_TODAY } });
  return { store, deps, common, existing, run, contribute, release };
}
function reserved(result: GoalCommandResult) { if (!("reservation" in result)) throw new Error("Expected reservation result"); return result.reservation; }
it("1000→reserve200→release50 is virtual; a later real900expense shows−50available and never destroys the reservation", async () => {
  const f = fixture(), command = f.contribute(); const reservation = reserved(await f.run(command)), original = structuredClone(f.store.state.reservations);
  expect(f.store.balance()).toBe(100000); expect(f.store.ledger).toEqual([]); expect(f.store.reserved()).toBe(20000);
  expect(patrimonioFinanceiro(f.store.ledger, f.store.accounts)).toEqual({ patrimonioCents: 100000, dividaCents: 0 });
  const released = f.release(reservation.id), answer = await f.run(released); expect(await f.run(released)).toEqual(answer);
  expect(f.store.state.releases).toHaveLength(1); expect(f.store.state.reservations).toEqual(original); expect(f.store.balance()).toBe(100000);
  expect(patrimonioFinanceiro(f.store.ledger, f.store.accounts)).toEqual({ patrimonioCents: 100000, dividaCents: 0 });
  expect(projectAccountAvailability({ user_id: GOAL_OWNER, account_id: goalAccount.id, real_balance_cents: f.store.balance(), reserved_cents: f.store.reserved() }).available_cents).toBe(85000);
  const expense: LancamentoFinanceiro = { id: goalId(9000), user_id: GOAL_OWNER, account_id: goalAccount.id, category_id: null, kind: "expense", amount_cents: 90000, paid_cents: 90000, description: "Saída real", payee: null, occurred_on: GOAL_TODAY, transfer_group_id: null, notes: null, installment_group_id: null, installment_no: null, installment_total: null, statement_month: null, serie_tipo: null, status: "confirmed", source: "manual", due_date: null, deleted_at: null, tag_ids: [], created_at: GOAL_NOW, updated_at: GOAL_NOW };
  f.store.ledger.push(expense); f.store.state.revision = String(BigInt(f.store.state.revision) + 1n);
  expect(projectAccountAvailability({ user_id: GOAL_OWNER, account_id: goalAccount.id, real_balance_cents: f.store.balance(), reserved_cents: f.store.reserved() }).available_cents).toBe(-5000);
  expect(f.store.state.reservations).toEqual(original); expect(f.store.state.releases).toHaveLength(1);
  await expect(f.run(f.contribute(1))).rejects.toThrow("suficiente");
});
it("archives only metadata and its own highlight, preserves money, and restores without selecting another goal", async () => {
  const f = fixture(); await f.run(f.contribute()); const money = structuredClone(f.store.state.reservations);
  await f.run({ command: "finance.goal.highlight", input: { ...f.common(), goal_id: financialGoal().id, expected_highlight_revision: "0" } });
  const beforeEvents = f.store.state.events.length;
  await f.run({ command: "finance.goal.archive", input: f.existing() });
  expect(f.store.state.highlight?.goal_id).toBeNull(); expect(f.store.state.reservations).toEqual(money); expect(f.store.reserved()).toBe(20000);
  expect(f.store.state.events.slice(beforeEvents).map(row => row.entity_type)).toEqual(["finance_goal", "finance_goal_highlight"]);
  await expect(f.run(f.contribute(1))).rejects.toThrow("ativa");
  await f.run({ command: "finance.goal.update", input: { ...f.existing(), patch: { target_cents: 5000, name: "  Alvo ajustado  ", deadline: "2020-01-01" } } });
  expect(projectGoalProgress(f.store.state.goals[0]!, f.store.reserved()).excess_cents).toBe(15000);
  await f.run({ command: "finance.goal.restore", input: f.existing() }); expect(f.store.state.highlight?.goal_id).toBeNull(); expect(f.store.state.reservations).toEqual(money);
});
it("all metadata/highlight no-ops record a receipt without extra effects or parallel progress counters", async () => {
  const f = fixture();
  await f.run({ command: "finance.goal.highlight", input: { ...f.common(), goal_id: null, expected_highlight_revision: "0" } });
  await f.run({ command: "finance.goal.restore", input: f.existing() });
  await f.run({ command: "finance.goal.update", input: { ...f.existing(), patch: { name: "  Meta sintética  " } } });
  expect(f.store.state.events).toEqual([]); expect(f.store.state.receipts).toHaveLength(3); expect(f.store.state.revision).toBe("0");
  await f.run({ command: "finance.goal.archive", input: f.existing() }); const count = f.store.state.events.length, revision = f.store.state.revision;
  await f.run({ command: "finance.goal.archive", input: f.existing() }); expect(f.store.state.events).toHaveLength(count); expect(f.store.state.revision).toBe(revision);
  await f.run({ command: "finance.goal.restore", input: f.existing() });
  await f.run({ command: "finance.goal.highlight", input: { ...f.common(), goal_id: financialGoal().id, expected_highlight_revision: "0" } });
  const total = f.store.state.events.length; await f.run({ command: "finance.goal.highlight", input: { ...f.common(), goal_id: financialGoal().id, expected_highlight_revision: f.store.state.highlight!.revision } }); expect(f.store.state.events).toHaveLength(total);
});
it("partial releases are immutable and a new intent cannot exceed the original remaining amount", async () => {
  const f = fixture(), reservation = reserved(await f.run(f.contribute()));
  await f.run(f.release(reservation.id)); await f.run(f.release(reservation.id, 15000)); const before = structuredClone(f.store.state);
  await expect(f.run(f.release(reservation.id, 1))).rejects.toThrow("restante"); expect(f.store.state).toEqual(before); expect(f.store.state.reservations[0]).toEqual(reservation);
});
it("counts archived goals' reserves across multiple goals and clears only the archived goal's own highlight", async () => {
  const f = fixture(); await f.run(f.contribute(80000)); await f.run({ command: "finance.goal.archive", input: f.existing() });
  const created = await f.run({ command: "finance.goal.create", input: { ...f.common(), name: "Segunda meta", target_cents: 10000, deadline: null, image_file_id: null } });
  if (!("goal" in created)) throw new Error("Expected goal"); const second = created.goal;
  const next = (amount: number): GoalCommand => ({ command: "finance.goal.contribute", input: { ...f.common(), goal_id: second.id, expected_revision: second.revision, account_id: goalAccount.id, amount_cents: amount, occurred_on: GOAL_TODAY } });
  await expect(f.run(next(30000))).rejects.toThrow("suficiente"); await f.run(next(20000)); expect(f.store.reserved()).toBe(100000);
  expect(projectGoalProgress(second, 20000)).toMatchObject({ saved_cents: 20000, excess_cents: 10000, bar_basis_points: 10000 });
  await f.run({ command: "finance.goal.highlight", input: { ...f.common(), goal_id: second.id, expected_highlight_revision: "0" } });
  const featured = structuredClone(f.store.state.highlight); await f.run({ command: "finance.goal.archive", input: f.existing() }); expect(f.store.state.highlight).toEqual(featured);
});
it("rolls back BOTH metadata and highlight when the second event fails", async () => {
  const f = fixture(); await f.run(f.contribute());
  await f.run({ command: "finance.goal.highlight", input: { ...f.common(), goal_id: financialGoal().id, expected_highlight_revision: "0" } });
  const before = structuredClone(f.store.state);
  const wrapper: GoalUnitOfWork = { transaction: (context, work) => f.store.transaction(context, tx => work({ ...tx, events: { append: async event => { if (event.entity_type === "finance_goal_highlight") throw new Error("SECOND_EVENT_REFUSED"); await tx.events.append(event); } } })) };
  await expect(executeGoalCommand(wrapper, f.deps, { user_id: GOAL_OWNER, canal: "web" }, { command: "finance.goal.archive", input: f.existing() })).rejects.toThrow("SECOND_EVENT");
  expect(f.store.state).toEqual(before);
});
it("enforces global, goal and highlight CAS independently without rerunning", async () => {
  const f = fixture(); const a = f.contribute(); a.input.expected_finance_revision = "999";
  await expect(f.run(a)).rejects.toMatchObject({ code: "CONFLICT" });
  await expect(f.run({ command: "finance.goal.update", input: { ...f.existing(), expected_revision: "999", patch: { name: "Outro" } } })).rejects.toMatchObject({ code: "CONFLICT" });
  await expect(f.run({ command: "finance.goal.highlight", input: { ...f.common(), goal_id: financialGoal().id, expected_highlight_revision: "999" } })).rejects.toMatchObject({ code: "CONFLICT" });
  expect(f.store.state.events).toEqual([]); expect(f.store.state.receipts).toEqual([]); expect(f.store.calls).toBe(3);
});
it("checks the owner even when a faulty port returns a foreign goal or finalized image", async () => {
  const f = fixture(); const foreignGoal: GoalUnitOfWork = { transaction: (context, work) => f.store.transaction(context, tx => work({ ...tx, goals: { ...tx.goals, get: async () => financialGoal({ user_id: GOAL_OTHER }) } })) };
  await expect(executeGoalCommand(foreignGoal, f.deps, { user_id: GOAL_OWNER, canal: "web" }, f.contribute())).rejects.toMatchObject({ code: "NOT_FOUND" });
  const foreignImage: GoalUnitOfWork = { transaction: (context, work) => f.store.transaction(context, tx => work({ ...tx, images: { getFinalized: async () => ({ ...goalImage, user_id: GOAL_OTHER }) } })) };
  await expect(executeGoalCommand(foreignImage, f.deps, { user_id: GOAL_OWNER, canal: "web" }, { command: "finance.goal.update", input: { ...f.existing(), patch: { image_file_id: goalImage.id } } })).rejects.toThrow("Usuário");
  f.store.state.reservations.push(goalReservation({ user_id: GOAL_OTHER })); await expect(f.run(f.release(goalReservation().id))).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(f.store.state.events).toEqual([]); expect(f.store.state.receipts).toEqual([]);
});
it("release recovers its own legacy future reservation even when current goal/account/image are unavailable", async () => {
  const f = fixture(false), reservation = goalReservation({ occurred_on: "2050-01-01" }); f.store.state.reservations.push(reservation); f.store.accounts = []; f.store.images = [];
  await f.run(f.release(reservation.id)); expect(f.store.state.releases).toHaveLength(1); expect(f.store.state.reservations[0]).toEqual(reservation); expect(f.store.state.goals).toEqual([]); expect(f.store.ledger).toEqual([]);
});
it.each(["credit_card", "archived", "foreign", "future", "insufficient"] as const)("rejects %s contribution without an effect/event/receipt", async mode => {
  const f = fixture(), command = f.contribute();
  if (mode === "credit_card") f.store.accounts[0]!.kind = "credit_card";
  if (mode === "archived") f.store.accounts[0]!.archived_at = GOAL_NOW;
  if (mode === "foreign") f.store.accounts[0]!.user_id = GOAL_OTHER;
  if (mode === "future") command.input.occurred_on = "2050-01-01";
  if (mode === "insufficient") command.input.amount_cents = 100001;
  const before = structuredClone(f.store.state); await expect(f.run(command)).rejects.toThrow(); expect(f.store.state).toEqual(before);
});
it.each(["owner", "revision"] as const)("rejects totals from another %s without treating a page as complete", async poison => {
  const f = fixture(); f.store.totalsPoison = poison; await expect(f.run(f.contribute())).rejects.toThrow("Apuração"); expect(f.store.state.reservations).toEqual([]); expect(f.store.state.events).toEqual([]);
  f.store.totalsPoison = null; const reservation = reserved(await f.run(f.contribute())); f.store.totalsPoison = poison;
  await expect(f.run(f.release(reservation.id))).rejects.toThrow("Apuração"); expect(f.store.state.releases).toEqual([]);
});
it("receipt wins before current references and CAS; reusing a clientId with different money conflicts", async () => {
  const f = fixture(), command = f.contribute(), result = await f.run(command); f.store.state.goals = []; f.store.accounts = []; f.store.images = [];
  f.deps.clock.now = () => { throw new Error("Replay must not read a new clock"); }; const state = structuredClone(f.store.state);
  expect(await f.run(command)).toEqual(result); expect(f.store.state).toEqual(state);
  await expect(f.run({ ...command, input: { ...command.input, amount_cents: 1 } })).rejects.toMatchObject({ code: "CONFLICT" });
  (result as { reservation: { amount_cents: number } }).reservation.amount_cents = 1; expect((await f.run(command) as { reservation: { amount_cents: number } }).reservation.amount_cents).toBe(20000);
});
it.each(["write", "event", "receipt", "before_commit"] as const)("rolls back money/event/receipt on %s failure and does not rerun callback", async point => {
  const f = fixture(), before = structuredClone(f.store.state); f.store.fail = point;
  await expect(f.run(f.contribute())).rejects.toThrow("SYNTHETIC"); expect(f.store.calls).toBe(1); expect(f.store.state).toEqual(before);
});
it("unknown AFTER commit propagates and only the same intent reconciles its original receipt", async () => {
  const f = fixture(), command = f.contribute(); f.store.fail = "after_commit";
  await expect(f.run(command)).rejects.toThrow("AFTER_COMMIT"); expect(f.store.calls).toBe(1); expect(f.store.state.reservations).toHaveLength(1);
  expect(reserved(await f.run(command)).id).toBe(f.store.state.reservations[0]!.id); expect(f.store.state.reservations).toHaveLength(1); expect(f.store.state.events).toHaveLength(1);
});
it("concurrent new intents cannot reserve or release the same availability twice in this serialized injected port", async () => {
  const f = fixture(), a = f.contribute(75000), b = f.contribute(75000); const result = await Promise.allSettled([f.run(a), f.run(b)]);
  expect(result.map(row => row.status).sort()).toEqual(["fulfilled", "rejected"]); expect(f.store.reserved()).toBe(75000); expect(f.store.state.receipts).toHaveLength(1);
  const reservation = f.store.state.reservations[0]!, c = f.release(reservation.id, 50000), d = f.release(reservation.id, 50000);
  expect((await Promise.allSettled([f.run(c), f.run(d)])).map(row => row.status).sort()).toEqual(["fulfilled", "rejected"]); expect(f.store.reserved()).toBe(25000); expect(f.store.state.releases).toHaveLength(1);
});
it("copies intent/context before await and prevents a captured port from writing after completion", async () => {
  const f = fixture(); let unlock!: () => void; f.store.receiptBarrier = new Promise<void>(resolve => { unlock = resolve; });
  const command = f.contribute(), context = { user_id: GOAL_OWNER, canal: "web" as const }; const pending = executeGoalCommand(f.store, f.deps, context, command);
  command.input.amount_cents = 99999; context.user_id = GOAL_OTHER; unlock(); const result = reserved(await pending);
  expect(result.amount_cents).toBe(20000); expect(result.user_id).toBe(GOAL_OWNER);
  await expect(f.store.lastPorts!.reservations.insert(result)).rejects.toMatchObject({ code: "TRANSACTION_CLOSED" });
});
it("does not let an adapter mutate the Core's captured actor through its transaction argument", async () => {
  const f = fixture();
  const mutating: GoalUnitOfWork = { transaction: (context, work) => f.store.transaction(structuredClone(context), async tx => { context.user_id = GOAL_OTHER; context.canal = "api"; return work(tx); }) };
  const result = reserved(await executeGoalCommand(mutating, f.deps, { user_id: GOAL_OWNER, canal: "web" }, f.contribute()));
  expect(result.user_id).toBe(GOAL_OWNER); expect(f.store.state.events[0]).toMatchObject({ user_id: GOAL_OWNER, canal: "web" });
});
it("never adopts a port's later revision together with later totals after the initial CAS", async () => {
  const f = fixture(); let revision = "0", reads = 0;
  const moving: GoalUnitOfWork = { transaction: (context, work) => f.store.transaction(context, tx => work({
    ...tx, get financeRevision() { reads++; return revision; },
    goals: { ...tx.goals, get: async id => { const row = await tx.goals.get(id); revision = "999"; return row; } },
    accountTotals: { get: async id => { const row = await tx.accountTotals.get(id); return row === null ? null : { ...row, finance_revision: revision }; } },
    goalTotals: { get: async id => ({ ...await tx.goalTotals.get(id), finance_revision: revision }) },
  })) };
  await expect(executeGoalCommand(moving, f.deps, { user_id: GOAL_OWNER, canal: "web" }, f.contribute())).rejects.toThrow("Apuração");
  expect(reads).toBe(1); expect(f.store.state.reservations).toEqual([]); expect(f.store.state.events).toEqual([]); expect(f.store.state.receipts).toEqual([]);
});
it("validates only a new image binding and preserves name edits/removal after an old file disappears", async () => {
  const f = fixture(false), command: Extract<GoalCommand, { command: "finance.goal.create" }> = { command: "finance.goal.create", input: { ...f.common(), name: "  Nova meta  ", target_cents: 10000, deadline: null, image_file_id: goalImage.id } };
  const result = await f.run(command); expect("goal" in result && result.goal.name).toBe("Nova meta"); f.store.images = [];
  expect(await f.run(command)).toEqual(result);
  await f.run({ command: "finance.goal.update", input: { ...f.existing(), patch: { name: "Renomeada" } } });
  await f.run({ command: "finance.goal.update", input: { ...f.existing(), patch: { image_file_id: null } } }); expect(f.store.state.goals[0]!.image_file_id).toBeNull();
  const before = structuredClone(f.store.state); f.store.images = [{ ...goalImage, status: "reserved" } as unknown as GoalImage];
  await expect(f.run({ command: "finance.goal.update", input: { ...f.existing(), patch: { image_file_id: goalImage.id } } })).rejects.toThrow("finalizada"); expect(f.store.state).toEqual(before);
});
