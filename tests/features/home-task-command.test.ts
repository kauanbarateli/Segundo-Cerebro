import { describe, expect, it, vi } from "vitest";
import { HomeTaskCommand } from "../../src/components/features/inicio/task-command";
import { createDemoApplication } from "../../src/lib/demo/application";
import { ConnectedApplicationError } from "../../src/lib/demo/connected-application";
import { ErroDeDominio } from "../../src/core/contracts/base";

describe("envios de tarefa do Início", () => {
  it("confirma o mesmo envio após commit com resposta perdida e refresh, sem reabrir a tarefa", async () => {
    const app = createDemoApplication();
    const ids = vi.fn(() => "home-complete-request");
    const command = new HomeTaskCommand(ids);
    await app.load("tasks");
    const task = app.getSnapshot("tasks").data!.items.find(item => item.status === "in_progress")!;
    const input = command.begin(task)!;
    const committed = await app.commands.tasks.status(input);
    command.failed(new ConnectedApplicationError("COMMIT_UNKNOWN", "Resposta perdida.", true));

    await app.load("tasks", true);
    const refreshed = app.getSnapshot("tasks").data!.items.find(item => item.id === task.id)!;
    expect(refreshed.status).toBe("done");
    expect(command.state).toMatchObject({ pending: false, uncertain: true });
    expect(command.begin(refreshed)).toBeNull();
    expect(command.begin({ id: "another-task", status: "todo" })).toBeNull();
    const retry = command.retry()!;
    expect(retry).toBe(input);
    expect(retry.status).toBe("done");
    expect(ids).toHaveBeenCalledTimes(1);
    expect(await app.commands.tasks.status(retry)).toEqual(committed);
    command.settled(retry.client_id);
    await app.load("tasks", true);
    expect(app.getSnapshot("tasks").data!.items.find(item => item.id === task.id)?.status).toBe("done");
    expect(command.state).toBeNull();
    app.dispose();
  });

  it("serializa cliques e reenvios enquanto a resposta está pendente", () => {
    const ids = vi.fn(() => "only-once");
    const command = new HomeTaskCommand(ids);
    command.begin({ id: "a", status: "done" });
    expect(command.begin({ id: "b", status: "todo" })).toBeNull();
    expect(command.retry()).toBeNull();
    command.failed(new ConnectedApplicationError("UNKNOWN", "Timeout.", true));
    expect(command.retry()).toMatchObject({ id: "a", status: "todo", client_id: "only-once" });
    expect(command.retry()).toBeNull();
    expect(ids).toHaveBeenCalledTimes(1);
  });

  it("somente a resolução global do mesmo client_id libera o envio local", () => {
    const command = new HomeTaskCommand(() => "home-pending");
    const input = command.begin({ id: "a", status: "todo" });
    command.failed(new ConnectedApplicationError("UNKNOWN", "Timeout.", true));
    expect(command.settled("other-command")).toBe(false);
    expect(command.state?.input).toBe(input);
    expect(command.settled("home-pending")).toBe(true);
    expect(command.state).toBeNull();
    expect(command.begin({ id: "a", status: "done" })?.status).toBe("todo");
  });

  it("não apaga incerteza anterior após falha conhecida de um reenvio", () => {
    const command = new HomeTaskCommand(() => "same-request");
    const input = command.begin({ id: "a", status: "todo" });
    command.failed(new ConnectedApplicationError("UNKNOWN", "Timeout.", true));
    command.retry();
    command.failed(new ConnectedApplicationError("RATE_LIMITED", "Aguarde."));
    expect(command.state).toMatchObject({ input, pending: false, uncertain: true });
    expect(command.retry()).toBe(input);
  });

  it.each(["CONFLICT", "RATE_LIMITED", "FORBIDDEN", "NOT_FOUND"])("preserva o identificador após %s", code => {
    const command = new HomeTaskCommand(() => "same-request");
    const input = command.begin({ id: "a", status: "todo" });
    command.failed(new ConnectedApplicationError(code, "Falha conhecida."));
    expect(command.state).toMatchObject({ input, pending: false, uncertain: false });
    expect(command.retry()).toBe(input);
  });

  it.each([new ConnectedApplicationError("VALIDATION", "Inválido."), new ErroDeDominio("VALIDATION", "Inválido.")])("libera a ação após rejeição definitiva de validação", error => {
    const ids = vi.fn().mockReturnValueOnce("rejected").mockReturnValueOnce("next");
    const command = new HomeTaskCommand(ids);
    command.begin({ id: "a", status: "todo" });
    command.failed(error);
    expect(command.state).toBeNull();
    expect(command.begin({ id: "b", status: "done" })).toEqual({ id: "b", status: "todo", client_id: "next" });
  });
});
