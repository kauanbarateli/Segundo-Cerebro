import { describe, expect, it, vi } from "vitest";
import { ErroDeDominio } from "../../src/core/contracts/base";
import { createDemoApplication } from "../../src/lib/demo/application";
import { ConnectedApplicationError } from "../../src/lib/demo/connected-application";
import { TaskActionCommand, TASK_ACTION_STATUS } from "../../src/components/features/tarefas/task-action-command";

describe("T-048: intenção de movimento e recuperação", () => {
  it("reenvia o mesmo destino depois de commit com resposta perdida, conservando os outros dados", async () => {
    const app = createDemoApplication();
    await app.load("tasks");
    const original = app.getSnapshot("tasks").data!.items.find(item => item.status === "in_progress")!;
    const count = app.getSnapshot("tasks").data!.items.length;
    const ids = vi.fn(() => "kanban-move");
    const command = new TaskActionCommand(ids);
    const request = command.begin(original, "complete")!;
    const committed = await app.commands.tasks.status({ ...request.input, status: TASK_ACTION_STATUS[request.action]! });
    command.failed(new ConnectedApplicationError("COMMIT_UNKNOWN", "Resposta perdida.", true));
    await app.load("tasks", true);
    const refreshed = app.getSnapshot("tasks").data!.items.find(item => item.id === original.id)!;
    expect(refreshed.status).toBe("done");
    expect(command.begin(refreshed, "reopen")).toBeNull();
    expect(command.begin({ ...original, id: "another-task" }, "start")).toBeNull();
    const retry = command.retry()!;
    expect(retry.input).toBe(request.input);
    expect(retry.action).toBe("complete");
    expect(await app.commands.tasks.status({ ...retry.input, status: TASK_ACTION_STATUS[retry.action]! })).toEqual(committed);
    expect(command.settled(retry.input.client_id)).toBe(true);
    await app.load("tasks", true);
    const items = app.getSnapshot("tasks").data!.items;
    expect(items).toHaveLength(count);
    expect(items.find(item => item.id === original.id)).toEqual({ ...original, status: "done", completed_at: committed.completed_at, updated_at: committed.updated_at });
    expect(ids).toHaveBeenCalledTimes(1);
    app.dispose();
  });

  it("falha transacional conserva a tarefa anterior e repete o client_id, sem movimento otimista", async () => {
    let fail = true;
    const app = createDemoApplication({ beforeOperation: point => { if (point === "commit" && fail) throw new ErroDeDominio("CONFLICT", "Falha de commit."); } });
    await app.load("tasks");
    const original = app.getSnapshot("tasks").data!.items.find(item => item.status === "todo")!;
    const command = new TaskActionCommand(() => "same-intent");
    const first = command.begin(original, "start")!;
    expect(command.begin(original, "complete")).toBeNull();
    try { await app.commands.tasks.status({ ...first.input, status: "in_progress" }); }
    catch (error) { command.failed(error); }
    await app.load("tasks", true);
    expect(app.getSnapshot("tasks").data!.items.find(item => item.id === original.id)).toEqual(original);
    expect(command.state).toMatchObject({ pending: false, uncertain: false });
    fail = false;
    const second = command.begin(original, "start")!;
    expect(second.input).toBe(first.input);
    const moved = await app.commands.tasks.status({ ...second.input, status: "in_progress" });
    expect(moved).toEqual({ ...original, status: "in_progress", updated_at: moved.updated_at });
    command.settled(second.input.client_id);
    app.dispose();
  });

  it("serializa envios, conserva incerteza após rate limit e libera só a confirmação correspondente", async () => {
    const app = createDemoApplication();
    await app.load("tasks");
    const task = app.getSnapshot("tasks").data!.items[0]!;
    const ids = vi.fn().mockReturnValueOnce("first").mockReturnValueOnce("second");
    const command = new TaskActionCommand(ids);
    const first = command.begin(task, "start")!;
    expect(command.retry()).toBeNull();
    command.failed(new ConnectedApplicationError("UNKNOWN", "Sem resposta.", true));
    command.retry();
    command.failed(new ConnectedApplicationError("RATE_LIMITED", "Aguarde."));
    expect(command.state).toMatchObject({ pending: false, uncertain: true, input: first.input });
    expect(command.settled("unrelated-command")).toBe(false);
    expect(command.retry()?.input).toBe(first.input);
    expect(command.settled(first.input.client_id)).toBe(true);
    expect(command.begin({ ...task, deleted_at: "2026-10-21T12:00:00Z" }, "start")).toBeNull();
    expect(command.begin({ ...task, deleted_at: "2026-10-21T12:00:00Z" }, "restore")?.input.client_id).toBe("second");
    app.dispose();
  });

  it("uma rejeição definitiva permite corrigir a intenção com novo identificador", async () => {
    const app = createDemoApplication();
    await app.load("tasks");
    const task = app.getSnapshot("tasks").data!.items[0]!;
    const ids = vi.fn().mockReturnValueOnce("invalid").mockReturnValueOnce("corrected");
    const command = new TaskActionCommand(ids);
    command.begin(task, "start");
    command.failed(new ConnectedApplicationError("VALIDATION", "Inválido."));
    expect(command.state).toBeNull();
    expect(command.begin(task, "complete")?.input.client_id).toBe("corrected");
    app.dispose();
  });
});
