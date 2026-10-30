import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { GoalCommand } from "../../src/core/financeiro/goals/goal-types";
import type { FinanceGoalsClient, GoalJournalView, GoalReply } from "../../src/lib/finance-goals-client-contract";
import { createGoalsController } from "../../src/components/features/financeiro/goals/goals-ui-model";
import { captureGoalTerminalBrowserAttempt, receiveGoalTerminalBrowserOutcome, type GoalTerminalClientOutcome, type GoalTerminalDigest } from "../../src/lib/finance-goals-terminal-browser";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`, owner = id(1), epoch = id(2);
const command = (n = 3): Extract<GoalCommand, { command: "finance.goal.create" }> => ({ command: "finance.goal.create", input: { client_id: id(n), expected_finance_revision: "0", name: "Original held A", target_cents: 10000, deadline: null, image_file_id: null } });
const ok = <T>(result: T): GoalReply<T> => ({ ok: true, result });
const unavailable = async <T>(): Promise<GoalReply<T>> => ({ ok: false, code: "unavailable", message: "Synthetic unavailable" });
const digest: GoalTerminalDigest = async (_, bytes) => Uint8Array.from(createHash("sha256").update(new Uint8Array(bytes)).digest()).buffer;
async function outcome(original: GoalCommand = command(), kind: "closed" | "confirmed" | "uncertain" = "closed"): Promise<GoalTerminalClientOutcome> {
  const abort = new AbortController(), capture = await captureGoalTerminalBrowserAttempt(owner, epoch, original, abort.signal, () => undefined, digest), binding = { ...capture.binding };
  const reply = kind === "closed" ? { version: 2, kind, binding, disposition: { ...binding, id: id(90), closed_at: "2026-10-23T12:00:00.000Z" } }
    : kind === "uncertain" ? { version: 2, kind, binding }
      : { version: 2, kind, binding, result: { version: 1, goal: { version: 1, id: id(10), user_id: owner, name: command().input.name, target_cents: 10000, deadline: null, image_file_id: null, archived_at: null, revision: "0", created_at: "2026-10-23T12:00:00.000Z", updated_at: "2026-10-23T12:00:00.000Z" } } };
  return receiveGoalTerminalBrowserOutcome(capture, async () => ({ ok: true, result: reply }), abort.signal, () => undefined);
}
function fixture(capability = true) {
  let current = true, journal: GoalJournalView = { ownerId: owner, epoch, reconfirmRequired: false, pending: { intent: command(), phase: "uncertain" } };
  const terminal = { status: vi.fn<(original: GoalCommand) => Promise<GoalReply<GoalTerminalClientOutcome>>>(() => unavailable<GoalTerminalClientOutcome>()), settle: vi.fn<(original: GoalCommand) => Promise<GoalReply<GoalTerminalClientOutcome>>>(() => unavailable<GoalTerminalClientOutcome>()) };
  const client: FinanceGoalsClient = {
    ownerId: owner, epoch, ...(capability ? { terminal } : {}), isCurrent: () => current,
    loadPending: vi.fn<FinanceGoalsClient["loadPending"]>(async () => ok(structuredClone(journal))), availability: vi.fn<FinanceGoalsClient["availability"]>(async () => ok({ available: true })),
    page: vi.fn<FinanceGoalsClient["page"]>(async () => ok({ version: 1, finance_revision: "1", items: [], highlight: null, next_cursor: null })),
    detail: vi.fn<FinanceGoalsClient["detail"]>(() => unavailable()), reservations: vi.fn<FinanceGoalsClient["reservations"]>(() => unavailable()), releases: vi.fn<FinanceGoalsClient["releases"]>(() => unavailable()),
    prepare: vi.fn<FinanceGoalsClient["prepare"]>(async original => ok({ kind: "review", intent: original, financeRevision: "0", goalRevision: null, highlightRevision: null, account: null })),
    stage: vi.fn<FinanceGoalsClient["stage"]>(() => unavailable()), execute: vi.fn<FinanceGoalsClient["execute"]>(() => unavailable()), reconcile: vi.fn<FinanceGoalsClient["reconcile"]>(() => unavailable()),
    acknowledgeReview: vi.fn<FinanceGoalsClient["acknowledgeReview"]>(async () => { journal = { ...journal, reconfirmRequired: false }; return ok(structuredClone(journal)); }),
  };
  return { client, terminal, view: () => structuredClone(journal), set: (value: GoalJournalView) => { journal = structuredClone(value); }, revoke: () => { current = false; } };
}
describe("terminal controller — synthetic port; no HTTP or SQL acceptance", () => {
  it("V1 port without the grouped capability refuses instead of falling back", async () => {
    const h = fixture(false), controller = createGoalsController(owner, h.client); await controller.open();
    expect(await controller.attemptStatus()).toMatchObject({ ok: false, code: "unavailable" }); expect(await controller.attemptSettle()).toMatchObject({ ok: false, code: "unavailable" });
    expect(h.client.execute).not.toHaveBeenCalled(); expect(h.client.reconcile).not.toHaveBeenCalled(); expect(controller.state().journal?.pending?.intent).toEqual(command());
  });
  it("availability false does not block explicit recovery of the held original", async () => {
    const h = fixture(); h.client.availability = vi.fn<FinanceGoalsClient["availability"]>(async () => ok({ available: false }));
    const controller = createGoalsController(owner, h.client); await controller.open(); expect(controller.state().available).toBe(false);
    const positive = await outcome(); h.terminal.settle.mockImplementationOnce(async () => { h.set({ ...h.view(), pending: null, reconfirmRequired: true }); return ok(positive); });
    expect(await controller.attemptSettle()).toMatchObject({ ok: true, result: { kind: "closed" } }); expect(h.terminal.settle).toHaveBeenCalledExactlyOnceWith(command()); expect(h.client.execute).not.toHaveBeenCalled();
  });
  it("uses logical held A after clear partial and releases only after NEW positive A and durable reconfirm readback", async () => {
    const h = fixture(), controller = createGoalsController(owner, h.client); await controller.open();
    h.terminal.settle.mockImplementationOnce(async () => { h.set({ ...h.view(), pending: null, reconfirmRequired: true }); return { ok: false, code: "uncertain", message: "Synthetic lost readback" }; });
    expect(await controller.attemptSettle()).toMatchObject({ ok: false, code: "uncertain" }); expect(controller.state().journal?.pending?.intent).toEqual(command());
    const fresh = await outcome(); h.terminal.status.mockResolvedValueOnce(ok(fresh));
    expect(await controller.attemptStatus()).toMatchObject({ ok: true, result: { version: 2, kind: "closed" } });
    expect(h.terminal.status).toHaveBeenCalledExactlyOnceWith(command()); expect(h.client.execute).not.toHaveBeenCalled();
    expect(controller.state().journal).toMatchObject({ pending: null, reconfirmRequired: true });
    expect(await controller.prepare(command(4))).toMatchObject({ ok: false, code: "uncertain" });
    expect(await controller.acknowledgeReview()).toMatchObject({ ok: false, code: "uncertain" }); expect(h.client.acknowledgeReview).not.toHaveBeenCalled();
    await controller.page({ cursor: null, limit: 20, archived: "active" }); expect((await controller.acknowledgeReview()).ok).toBe(true);
    expect((await controller.prepare(command(4))).ok).toBe(true); expect(h.client.execute).not.toHaveBeenCalled();
  });
  it.each(["uncertain", "error"] as const)("physical null with %s is not a positive proof and never releases held A", async mode => {
    const h = fixture(), controller = createGoalsController(owner, h.client); await controller.open(); h.set({ ...h.view(), pending: null, reconfirmRequired: true });
    h.terminal.status.mockResolvedValueOnce(mode === "uncertain" ? ok(await outcome(command(), "uncertain")) : { ok: false, code: "forbidden", message: "Synthetic denial" });
    expect(await controller.attemptStatus()).toMatchObject({ ok: false, code: "uncertain" }); expect(controller.state().journal?.pending?.intent).toEqual(command());
    expect(await controller.prepare(command(4))).toMatchObject({ ok: false, code: "uncertain" }); expect(h.client.prepare).not.toHaveBeenCalled(); expect(h.client.execute).not.toHaveBeenCalled();
  });
  it.each(["missing-reconfirm", "physical-B"] as const)("positive A with %s refuses completion and retains the exact original", async mode => {
    const h = fixture(), controller = createGoalsController(owner, h.client); await controller.open(); const proof = await outcome();
    h.terminal.status.mockImplementationOnce(async () => { h.set({ ...h.view(), pending: mode === "physical-B" ? { intent: command(4), phase: "staged" } : null, reconfirmRequired: mode === "physical-B" }); return ok(proof); });
    expect(await controller.attemptStatus()).toMatchObject({ ok: false, code: "uncertain" }); expect(controller.state().journal?.pending?.intent).toEqual(command());
    if (mode === "physical-B") expect(h.view().pending?.intent).toEqual(command(4)); expect(h.client.execute).not.toHaveBeenCalled();
  });
  it("a proof for B or mutated service argument cannot redefine held A", async () => {
    const h = fixture(), controller = createGoalsController(owner, h.client); await controller.open(); const other = await outcome(command(4));
    h.terminal.status.mockImplementationOnce(async original => { original.input.client_id = id(4); h.set({ ...h.view(), pending: null, reconfirmRequired: true }); return ok(other); });
    expect(await controller.attemptStatus()).toMatchObject({ ok: false, code: "uncertain" }); expect(controller.state().journal?.pending?.intent).toEqual(command()); expect(h.client.execute).not.toHaveBeenCalled();
  });
  it("confirmed returns the original financial result1, not a reversal, then still requires review", async () => {
    const h = fixture(), controller = createGoalsController(owner, h.client); await controller.open(); const proof = await outcome(command(), "confirmed");
    h.terminal.settle.mockImplementationOnce(async () => { h.set({ ...h.view(), pending: null, reconfirmRequired: true }); return ok(proof); });
    expect(await controller.attemptSettle()).toMatchObject({ ok: true, result: { version: 2, kind: "confirmed", result: { version: 1, goal: { user_id: owner } } } });
    expect(controller.state().review).toBeNull(); expect(h.client.execute).not.toHaveBeenCalled(); expect(h.client.acknowledgeReview).not.toHaveBeenCalled();
  });
  it("late response after close/identity change cannot resolve the new controller", async () => {
    const h = fixture(), controller = createGoalsController(owner, h.client); await controller.open(); let finish!: (value: GoalReply<GoalTerminalClientOutcome>) => void;
    h.terminal.status.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })); const pending = controller.attemptStatus();
    const result = await outcome(); controller.close(); h.revoke(); finish(ok(result));
    expect(await pending).toMatchObject({ ok: false, code: "session-changed" }); expect(controller.state().journal).toBeNull(); expect(h.client.execute).not.toHaveBeenCalled();
  });
  it("double action is serialized and no timer, mount or finally issues settle", async () => {
    const h = fixture(), controller = createGoalsController(owner, h.client); await controller.open(); let finish!: (value: GoalReply<GoalTerminalClientOutcome>) => void;
    h.terminal.status.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })); const pending = controller.attemptStatus();
    expect(await controller.attemptSettle()).toMatchObject({ ok: false, code: "busy" }); expect(h.terminal.settle).not.toHaveBeenCalled();
    finish(ok(await outcome(command(), "uncertain"))); await pending; expect(h.terminal.status).toHaveBeenCalledTimes(1); expect(h.terminal.settle).not.toHaveBeenCalled();
  });
  it("a remounted terminal-capable client still needs a fresh page and human acknowledgement", async () => {
    const h = fixture(); h.set({ ...h.view(), pending: null, reconfirmRequired: true }); const controller = createGoalsController(owner, h.client); await controller.open();
    expect(await controller.acknowledgeReview()).toMatchObject({ ok: false, code: "uncertain" }); expect(h.client.acknowledgeReview).not.toHaveBeenCalled();
    await controller.page({ cursor: null, limit: 20, archived: "active" }); expect((await controller.acknowledgeReview()).ok).toBe(true); expect(h.terminal.status).not.toHaveBeenCalled(); expect(h.terminal.settle).not.toHaveBeenCalled();
  });
});
