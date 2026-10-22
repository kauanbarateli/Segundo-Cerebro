import { describe, expect, it, vi } from "vitest";
import { TaskActionCommand, TASK_ACTION_STATUS, subscribeTaskActionSettlements } from "../../src/components/features/tarefas/task-action-command";
import { createConnectedApplication, type CommandFeedback } from "../../src/lib/demo/connected-application";
import { CommandJournal, journalInput } from "../../src/lib/demo/command-journal";
import { createDemoFixture } from "../../src/lib/demo/fixtures";
import { journalBrowser } from "./helpers/journal-browser";

const owner = "10000000-0000-4000-8000-000000000001";
const otherOwner = "10000000-0000-4000-8000-000000000002";
const now = "2026-10-21T12:00:00.000Z";
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });

function connectedTask(userId = owner, clientId = "same-task-status", outcome: "confirmed" | "rejected" = "confirmed", sleeping = false) {
  const task = createDemoFixture(now, userId).initial.task!.find(item => item.status === "todo")!;
  const committed = { ...task, status: "done" as const, completed_at: now, updated_at: now };
  const browser = journalBrowser();
  let posts = 0;
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
    if (init?.method !== "POST") return json({ items: [committed], categories: [], projects: [] });
    posts++;
    if (posts === 1) return json({ ok: false, code: "COMMIT_UNKNOWN" }, 503);
    return outcome === "confirmed" ? json({ ok: true, result: committed }) : json({ ok: false, code: "VALIDATION" }, 400);
  });
  const tab = browser.tab();
  // The original journal can reopen one snapshot after a tab misses storage notifications.
  const app = createConnectedApplication(userId, { fetch: fetcher, now: () => now,
    journal: sleeping ? user => new CommandJournal(user, { ...tab.environment, subscribe: () => () => undefined }) : tab.journal });
  const command = new TaskActionCommand(() => clientId);
  const request = command.begin(task, "complete")!;
  const input = { ...request.input, status: TASK_ACTION_STATUS[request.action]! };
  const postBodies = () => fetcher.mock.calls.filter(([, init]) => init?.method === "POST").map(([, init]) => init!.body);
  return { app, browser, command, task, request, input, committed, fetcher, postBodies };
}

async function loseResponse(state: ReturnType<typeof connectedTask>) {
  const failure: unknown = await state.app.commands.tasks.status(state.input).catch((error: unknown) => error);
  expect(failure).toMatchObject({ outcomeUnknown: true });
  state.command.failed(failure);
  expect(state.command.state).toMatchObject({ pending: false, uncertain: true, input: state.request.input });
  expect(state.app.getCommandSnapshot()).toMatchObject({ status: "pending" });
  expect(state.browser.entries()).toHaveLength(1);
}

describe("T-048: settlements do journal conectado original", () => {
  it.each(["confirmed", "rejected"] as const)("a confirmação global %s libera somente a intenção correspondente sem outro POST local", async outcome => {
    const state = connectedTask(owner, "global-task-status", outcome);
    const settlements: string[] = [];
    const stop = subscribeTaskActionSettlements(state.app, state.command, resolved => settlements.push(resolved.input.client_id));
    try {
      await loseResponse(state);
      expect(settlements).toEqual([]);
      if (outcome === "confirmed") await expect(state.app.retryPendingCommand()).resolves.toEqual(state.committed);
      else await expect(state.app.retryPendingCommand()).rejects.toMatchObject({ code: "VALIDATION" });
      expect(state.app.getCommandSnapshot()).toMatchObject({ status: outcome, clientId: state.request.input.client_id });
      expect(settlements).toEqual([state.request.input.client_id]);
      expect(state.command.state).toBeNull();
      expect(state.browser.entries()).toHaveLength(0);
      expect(state.postBodies()).toHaveLength(2);
      expect(state.postBodies()[1]).toBe(state.postBodies()[0]);
      expect(state.command.settleFeedback(state.app.getCommandSnapshot(), state.app.userId)).toBeNull();
      expect(state.postBodies()).toHaveLength(2);
    } finally { stop(); state.app.dispose(); }
  });

  it.each(["confirmed", "rejected"] as const)("um único adopt com %s de A e pending de B libera somente A", async outcome => {
    const state = connectedTask(owner, "retained-burst-a", outcome, true);
    const settlements: { clientId: string; status: string }[] = [];
    const feedbacks: CommandFeedback[] = [];
    const stop = subscribeTaskActionSettlements(state.app, state.command, (retained, feedback) => {
      settlements.push({ clientId: retained.input.client_id, status: feedback.status });
    });
    const stopFeedback = state.app.subscribeCommands(() => feedbacks.push(state.app.getCommandSnapshot()));
    try {
      await loseResponse(state);
      const journal = state.browser.tab().journal(owner);
      await journal.open();
      const nextInput = { ...state.input, client_id: "next-burst-b", status: "in_progress" as const };
      const next = await journal.exclusive(async () => {
        const original = journal.snapshot().entries[0]!;
        expect(journalInput(original)).toEqual(state.input);
        journal.finish(original, outcome, outcome === "confirmed" ? state.task.id : null);
        return journal.stage("task.status", nextInput).entry;
      });
      expect(settlements).toEqual([]);
      expect(state.command.state).toMatchObject({ pending: false, uncertain: true, input: state.request.input });
      expect(state.app.getCommandSnapshot()).toMatchObject({ status: "pending" });
      feedbacks.length = 0;

      await state.app.initializeJournal();

      expect(feedbacks).toHaveLength(2);
      expect(feedbacks[0]).toMatchObject({ status: outcome, clientId: state.request.input.client_id });
      expect(feedbacks[1]).toMatchObject({ status: "pending", retrying: false });
      expect(state.app.getCommandSnapshot()).toEqual(feedbacks[1]);
      expect(settlements).toEqual([{ clientId: state.request.input.client_id, status: outcome }]);
      expect(state.command.state).toBeNull();
      expect(journal.snapshot().entries).toEqual([next]);
      expect(journalInput(next)).toEqual(nextInput);
      expect(state.browser.entries()).toHaveLength(1);
      expect(state.postBodies()).toHaveLength(1);

      await state.app.initializeJournal();
      expect(settlements).toHaveLength(1);
      expect(journal.snapshot().entries).toEqual([next]);
      expect(state.postBodies()).toHaveLength(1);
    } finally { stopFeedback(); stop(); state.app.dispose(); }
  });

  it.each(["confirmed", "rejected"] as const)("a assinatura removida não consome %s, e a nova assinatura lê o terminal já disponível", async outcome => {
    const state = connectedTask(owner, "settled-before-subscribe", outcome);
    const settled = vi.fn();
    let stop: () => void = () => undefined;
    try {
      await loseResponse(state);
      stop = subscribeTaskActionSettlements(state.app, state.command, settled);
      stop();
      if (outcome === "confirmed") await state.app.retryPendingCommand();
      else await expect(state.app.retryPendingCommand()).rejects.toMatchObject({ code: "VALIDATION" });
      expect(settled).not.toHaveBeenCalled();
      expect(state.command.state).toMatchObject({ pending: false, uncertain: true, input: state.request.input });

      const retained = state.command.state;
      stop = subscribeTaskActionSettlements(state.app, state.command, settled);
      expect(settled).toHaveBeenCalledExactlyOnceWith(retained, state.app.getCommandSnapshot());
      expect(state.command.state).toBeNull();
      expect(state.browser.entries()).toHaveLength(0);
      expect(state.postBodies()).toHaveLength(2);
      expect(state.postBodies()[1]).toBe(state.postBodies()[0]);
    } finally { stop(); state.app.dispose(); }
  });

  it.each([
    { scenario: "other-client", outcome: "confirmed" }, { scenario: "other-client", outcome: "rejected" },
    { scenario: "other-user", outcome: "confirmed" }, { scenario: "other-user", outcome: "rejected" },
  ] as const)("um settlement conectado $outcome de $scenario não libera a intenção retida", async ({ scenario, outcome }) => {
    const state = connectedTask();
    const other = connectedTask(scenario === "other-user" ? otherOwner : owner,
      scenario === "other-client" ? "another-task-status" : state.request.input.client_id, outcome);
    const settled = vi.fn();
    const stop = subscribeTaskActionSettlements(other.app, state.command, settled);
    try {
      await loseResponse(state);
      await loseResponse(other);
      if (outcome === "confirmed") await other.app.retryPendingCommand();
      else await expect(other.app.retryPendingCommand()).rejects.toMatchObject({ code: "VALIDATION" });
      const feedback = other.app.getCommandSnapshot();
      expect(feedback).toMatchObject({ status: outcome, clientId: other.request.input.client_id });
      expect(state.command.settleFeedback(feedback, other.app.userId)).toBeNull();
      expect(state.command.state).toMatchObject({ pending: false, uncertain: true, input: state.request.input });
      expect(settled).not.toHaveBeenCalled();
      expect(state.browser.entries()).toHaveLength(1);
      expect(state.postBodies()).toHaveLength(1);
    } finally { stop(); state.app.dispose(); other.app.dispose(); }
  });

  it("o settlement publicado durante o próprio replay não encerra o owner antes de sua Promise", async () => {
    const state = connectedTask();
    let observed = 0;
    const settled = vi.fn();
    const stopBinding = subscribeTaskActionSettlements(state.app, state.command, settled);
    const stop = state.app.subscribeCommands(() => {
      const feedback = state.app.getCommandSnapshot();
      if (feedback.status !== "confirmed") return;
      observed++;
      expect(state.command.state).toMatchObject({ pending: true, uncertain: true });
      expect(state.command.settleFeedback(feedback, state.app.userId)).toBeNull();
    });
    try {
      await loseResponse(state);
      const retry = state.command.retry()!;
      await expect(state.app.commands.tasks.status({ ...retry.input, status: TASK_ACTION_STATUS[retry.action]! })).resolves.toEqual(state.committed);
      expect(observed).toBe(1);
      expect(settled).not.toHaveBeenCalled();
      expect(state.command.state).toMatchObject({ pending: true, uncertain: true });
      expect(state.command.settled(retry.input.client_id)).toBe(true);
      expect(state.command.state).toBeNull();
      expect(state.postBodies()).toHaveLength(2);
      expect(state.postBodies()[1]).toBe(state.postBodies()[0]);
    } finally { stop(); stopBinding(); state.app.dispose(); }
  });

  it("pending, idle e sessão alterada não são confirmação e não enviam a intenção antiga", async () => {
    const state = connectedTask();
    const settled = vi.fn();
    const stop = subscribeTaskActionSettlements(state.app, state.command, settled);
    try {
      await loseResponse(state);
      expect(state.command.settleFeedback(state.app.getCommandSnapshot(), owner)).toBeNull();
      state.fetcher.mockResolvedValueOnce(json({ items: [{ ...state.task, user_id: otherOwner }], categories: [], projects: [] }));
      await state.app.load("tasks", true);
      expect(state.app.getCommandSnapshot()).toMatchObject({ status: "session-changed" });
      expect(state.command.settleFeedback(state.app.getCommandSnapshot(), owner)).toBeNull();
      await expect(state.app.retryPendingCommand()).rejects.toMatchObject({ code: "SESSION_CHANGED" });
      state.app.dispose();
      const idle: CommandFeedback = { status: "idle" };
      expect(state.command.settleFeedback(idle, owner)).toBeNull();
      expect(state.command.state).toMatchObject({ uncertain: true, input: state.request.input });
      expect(settled).not.toHaveBeenCalled();
      expect(state.postBodies()).toHaveLength(1);
    } finally { stop(); state.app.dispose(); }
  });
});
