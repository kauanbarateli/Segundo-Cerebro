import { describe, expect, it, vi } from "vitest";
import { ConnectedApplicationError, createConnectedApplication, isCommandOutcomeUnknown } from "../../src/lib/demo/connected-application";
import { createDemoFixture } from "../../src/lib/demo/fixtures";
import { CaptureRequests } from "../../src/components/features/capturar/requests";
import type { Captura } from "../../src/core/capturas";
import type { Tarefa } from "../../src/core/tarefas";

const userId = "10000000-0000-4000-8000-000000000001";
const now = "2026-10-08T01:00:00.000Z";
const fixture = createDemoFixture(now, userId);
const capture = fixture.initial.capture![0]!;
const task = fixture.initial.task![0]!;
const dto = (items: Captura[] | Tarefa[] = []) => ({ items, categories: [], projects: [] });
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
const fields = { title: "Nota conectada", content: "Conteúdo", type: "note" as const, category_id: null, project_id: null, attachments: [] };
const deferred = <T>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };

describe("aplicação conectada de Capturar e Tarefas", () => {
  it("inicia sem consultar ou plantar exemplos nos módulos reais e mantém o outro universo isolado", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json(dto()));
    const app = createConnectedApplication(userId, { fetch: fetcher, now: () => now });
    expect(fetcher).not.toHaveBeenCalled();
    expect(app.getSnapshot("captures")).toMatchObject({ status: "idle", data: null });
    expect(app.today()).toBe("2026-10-07");
    await app.load("knowledge");
    expect(fetcher).not.toHaveBeenCalled();
    expect(app.getSnapshot("knowledge").data?.items.every(item => item.user_id === userId)).toBe(true);
    expect(app.getSnapshot("knowledge").data?.items.length).toBeGreaterThan(0);
    await app.load("captures");
    expect(app.getSnapshot("captures")).toEqual({ status: "ready", data: dto(), error: null });
    expect(app.getSnapshot("tasks").data).toBeNull();
    app.dispose();
  });

  it("usa só o endpoint relativo com cookies, sem cache/redirecionamento/segredo no pedido", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json(dto([task])));
    const app = createConnectedApplication(userId, { fetch: fetcher });
    await app.load("tasks");
    expect(fetcher).toHaveBeenCalledWith("/api/capture-tasks?query=tasks", expect.objectContaining({
      method: "GET", credentials: "same-origin", cache: "no-store", redirect: "error", headers: { Accept: "application/json", "X-Expected-User-ID": userId },
    }));
    const data = app.getSnapshot("tasks").data!;
    expect(() => { data.items[0]!.title = "mutação por fora"; }).toThrow();
    app.dispose();
  });

  it.each([400, 401, 403, 404, 409, 429, 503])("HTTP %i aparece como erro e retry pode recuperar um vazio verdadeiro", async status => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json({ ok: false, code: "PRIVATE_DETAIL", message: "secret-canary" }, status)).mockResolvedValueOnce(json(dto()));
    const app = createConnectedApplication(userId, { fetch: fetcher });
    await app.load("captures");
    expect(app.getSnapshot("captures")).toMatchObject({ status: "error", data: null });
    expect(app.getSnapshot("captures").error).not.toContain("secret-canary");
    await app.load("captures", true);
    expect(app.getSnapshot("captures")).toEqual({ status: "ready", data: dto(), error: null });
    app.dispose();
  });

  it("recusa DTO malformado e registros de outro usuário, sem convertê-los em vazio", async () => {
    for (const body of [{ items: [] }, dto([{ ...capture, title: 123 } as unknown as Captura])]) {
      const app = createConnectedApplication(userId, { fetch: vi.fn<typeof fetch>().mockResolvedValue(json(body)) });
      await app.load("captures");
      expect(app.getSnapshot("captures")).toMatchObject({ status: "error", data: null });
      app.dispose();
    }
  });

  it.each([dto([{ ...capture, user_id: "other" }]), { ...dto(), categories: [{ id: "category", user_id: "other", name: "Privada" }] }])("resposta de leitura de outra conta encerra a sessão local", async body => {
    const app = createConnectedApplication(userId, { fetch: vi.fn<typeof fetch>().mockResolvedValue(json(body)) });
    await app.load("captures");
    expect(app.getSnapshot("captures")).toMatchObject({ status: "idle", data: null });
    expect(app.getCommandSnapshot()).toMatchObject({ status: "session-changed" });
    app.dispose();
  });

  it("conversão atualiza os dois observadores; módulo desmontado é recarregado só quando reaberto", async () => {
    let converted = false, complete = false;
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (url, init) => {
      if (init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { command: string };
        if (body.command === "task.status") { complete = true; return json({ ok: true, result: { ...task, status: "done" } }); }
        converted = true; return json({ ok: true, result: { captura: { ...capture, converted_task_id: task.id }, tarefa: task } });
      }
      return String(url).includes("query=captures") ? json(dto([{ ...capture, converted_task_id: converted ? task.id : null }])) : json(dto(converted ? [{ ...task, status: complete ? "done" : task.status }] : []));
    });
    const app = createConnectedApplication(userId, { fetch: fetcher });
    const stop = app.subscribe("tasks", () => undefined);
    app.subscribe("captures", () => undefined);
    await Promise.all([app.load("tasks"), app.load("captures")]);
    await app.commands.captures.convert({ capture_id: capture.id, client_id: "conversion-command" });
    expect(app.getSnapshot("tasks").data?.items).toHaveLength(1);
    expect(app.getSnapshot("captures").data?.items[0]?.converted_task_id).toBe(task.id);
    stop();
    const reads = () => fetcher.mock.calls.filter(([url]) => String(url).includes("query=tasks")).length;
    const before = reads();
    await app.commands.tasks.status({ id: task.id, client_id: "update", status: "done" });
    expect(reads()).toBe(before);
    await app.load("tasks");
    expect(reads()).toBe(before + 1);
    expect(app.getSnapshot("tasks").data?.items[0]?.status).toBe("done");
    app.dispose();
  });

  it("ignora leitura anterior à mutação e publica só a atualização posterior", async () => {
    const old = deferred<Response>(); let reads = 0;
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
      if (init?.method === "POST") return json({ ok: true, result: { ...task, status: "done" } });
      return ++reads === 1 ? old.promise : json(dto([{ ...task, status: "done" }]));
    });
    const app = createConnectedApplication(userId, { fetch: fetcher });
    const observed: string[] = [];
    app.subscribe("tasks", () => { const state = app.getSnapshot("tasks"); if (state.status === "ready") observed.push(state.data!.items[0]!.status); });
    const firstRead = app.load("tasks");
    const write = app.commands.tasks.status({ id: task.id, client_id: "status-command", status: "done" });
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    await new Promise(resolve => setTimeout(resolve, 0));
    old.resolve(json(dto([task])));
    await Promise.all([firstRead, write]);
    expect(observed).toEqual(["done"]);
    app.dispose();
  });

  it("resultado de escrita confirmado não vira falha de escrita se a atualização da lista falhar", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => init?.method === "POST" ? json({ ok: true, result: task }) : json({}, 503));
    const app = createConnectedApplication(userId, { fetch: fetcher });
    app.subscribe("tasks", () => undefined);
    await expect(app.commands.tasks.status({ id: task.id, client_id: "confirmed", status: "done" })).resolves.toMatchObject({ id: task.id });
    expect(app.getSnapshot("tasks")).toMatchObject({ status: "error", data: null });
    app.dispose();
  });

  it.each(["network", "commit", "invalid"])("preserva envio e client_id após resultado incerto: %s", async mode => {
    const fetcher = vi.fn<typeof fetch>().mockImplementationOnce(async () => {
      if (mode === "network") throw new Error("private-network-canary");
      return mode === "commit" ? json({ ok: false, code: "COMMIT_UNKNOWN" }, 503) : json({ ok: true });
    }).mockResolvedValueOnce(json({ ok: true, result: capture }));
    const app = createConnectedApplication(userId, { fetch: fetcher });
    const input = { ...fields, client_id: "same-operation" };
    const failure = await app.commands.captures.create(input).catch(error => error);
    expect(isCommandOutcomeUnknown(failure)).toBe(true);
    expect(failure.message).not.toContain("private-network-canary");
    await app.commands.captures.create(input);
    expect(fetcher.mock.calls[0]![1]!.body).toBe(fetcher.mock.calls[1]![1]!.body);
    expect(input.client_id).toBe("same-operation");
    app.dispose();
  });

  it("refresh consulta só módulos reais observados e nunca usa exemplos como recuperação", async () => {
    let count = 0;
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => ++count === 1 ? json(dto()) : json(dto([capture])));
    const app = createConnectedApplication(userId, { fetch: fetcher });
    await app.refreshActive();
    expect(fetcher).not.toHaveBeenCalled();
    const stop = app.subscribe("captures", () => undefined);
    await app.load("captures"); await app.refreshActive();
    expect(app.getSnapshot("captures").data?.items[0]?.id).toBe(capture.id);
    stop(); await app.refreshActive();
    expect(fetcher).toHaveBeenCalledTimes(2);
    app.dispose();
  });

  it("logout aborta leituras e impede resposta tardia ou comando da sessão anterior", async () => {
    const pending = deferred<Response>();
    const fetcher = vi.fn<typeof fetch>().mockReturnValue(pending.promise);
    const app = createConnectedApplication(userId, { fetch: fetcher });
    const loading = app.load("captures"), signal = fetcher.mock.calls[0]![1]!.signal!;
    app.dispose();
    expect(signal.aborted).toBe(true);
    pending.resolve(json(dto([capture]))); await loading;
    expect(app.getSnapshot("captures")).toMatchObject({ status: "idle", data: null });
    await expect(app.commands.captures.create({ ...fields, client_id: "after-logout" })).rejects.toThrow("encerrada");
  });

  it("bloqueia anexos e organização em Conhecimento antes da rede e não altera demonstração", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const app = createConnectedApplication(userId, { fetch: fetcher });
    await expect(app.commands.captures.organize({ id: capture.id, client_id: "organize", destination: "knowledge" })).rejects.toThrow("ainda não");
    await expect(app.commands.captures.create({ ...fields, client_id: "attachment", attachments: [{ id: "image", name: "image.png", mime: "image/png", bytes: 2, width: 1, height: 1 }] })).rejects.toThrow("Anexos");
    expect(() => app.stageImage({ id: "image", name: "image.png", mime: "image/png", bytes: 2, width: 1, height: 1, blob: new Blob(["hi"], { type: "image/png" }) })).toThrow("Anexos");
    expect(fetcher).not.toHaveBeenCalled();
    app.dispose();
  });

  it("validação é definitiva e conflitos não são rotulados como sucesso", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json({ ok: false, code: "VALIDATION" }, 400)).mockResolvedValueOnce(json({ ok: false, code: "CONFLICT" }, 409));
    const app = createConnectedApplication(userId, { fetch: fetcher });
    for (const code of ["VALIDATION", "CONFLICT"]) {
      const failure = await app.commands.tasks.status({ id: task.id, client_id: "request", status: "done" }).catch(error => error);
      expect(failure).toBeInstanceOf(ConnectedApplicationError);
      expect(failure).toMatchObject({ code, outcomeUnknown: false });
    }
    app.dispose();
  });
  it.each([[404, "NOT_FOUND"], [429, "RATE_LIMITED"]] as const)("recusa HTTP %i é conhecida e não bloqueia como resultado incerto", async (status, code) => {
    const app = createConnectedApplication(userId, { fetch: vi.fn<typeof fetch>().mockResolvedValue(json({ ok: false, code }, status)) });
    await expect(app.commands.tasks.status({ id: task.id, client_id: "request", status: "done" })).rejects.toMatchObject({ code, outcomeUnknown: false });
    app.dispose();
  });

  it("retém o envio exato após UNKNOWN, erro de leitura e remontagem dos observadores", async () => {
    let writes = 0, failRead = true;
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
      if (init?.method === "POST") {
        if (++writes === 1) throw new Error("resposta perdida");
        return json({ ok: true, result: capture });
      }
      return failRead ? json({}, 503) : json(dto([capture]));
    });
    const app = createConnectedApplication(userId, { fetch: fetcher });
    const input = { ...fields, client_id: "original-operation" };
    let stop = app.subscribe("captures", () => undefined);
    await expect(app.commands.captures.create(input)).rejects.toMatchObject({ outcomeUnknown: true });
    input.title = "Alteração externa não deve modificar o envio retido";
    await app.refreshActive();
    expect(app.getSnapshot("captures")).toMatchObject({ status: "error", data: null });
    stop(); // The route/editor can unmount without deleting the session command.
    const observed: string[] = [];
    app.subscribeCommands(() => observed.push(app.getCommandSnapshot().status));
    stop = app.subscribe("captures", () => undefined);
    expect(app.getCommandSnapshot()).toMatchObject({ status: "pending", retrying: false });
    await expect(app.commands.captures.create({ ...fields, client_id: "new-operation" })).rejects.toMatchObject({ code: "PENDING_COMMAND", outcomeUnknown: false });
    await expect(app.commands.captures.create(input)).rejects.toMatchObject({ code: "PENDING_COMMAND" });
    expect(writes).toBe(1);
    failRead = false;
    await app.retryPendingCommand();
    const sent = fetcher.mock.calls.filter(([, init]) => init?.method === "POST");
    expect(sent[1]![1]!.body).toBe(sent[0]![1]!.body);
    expect(JSON.parse(String(sent[1]![1]!.body))).toMatchObject({ input: { title: fields.title, client_id: "original-operation" } });
    expect(sent.every(([, init]) => new Headers(init?.headers).get("X-Expected-User-ID") === userId)).toBe(true);
    expect(app.getSnapshot("captures").data?.items[0]?.id).toBe(capture.id);
    expect(app.getCommandSnapshot()).toEqual({ status: "confirmed", clientId: "original-operation", href: `/capturar?capture=${encodeURIComponent(capture.id)}`, label: "Abrir nota" });
    expect(observed).toEqual(["pending", "confirmed"]);
    app.clearCommandFeedback(); expect(app.getCommandSnapshot()).toEqual({ status: "idle" });
    stop(); app.dispose();
  });

  it("confirmação repetida mantém o envio pendente quando o retry recebe limite", async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValueOnce(new Error("lost"))
      .mockResolvedValueOnce(json({}, 429)).mockResolvedValueOnce(json({ ok: true, result: task }));
    const app = createConnectedApplication(userId, { fetch: fetcher });
    const input = { id: task.id, client_id: "same-status", status: "done" as const };
    await expect(app.commands.tasks.status(input)).rejects.toMatchObject({ outcomeUnknown: true });
    await expect(app.retryPendingCommand()).rejects.toMatchObject({ code: "RATE_LIMITED" });
    app.clearCommandFeedback();
    expect(app.getCommandSnapshot()).toMatchObject({ status: "pending", retrying: false });
    await app.commands.tasks.status(input);
    expect(new Set(fetcher.mock.calls.map(([, init]) => init?.body)).size).toBe(1);
    expect(app.getCommandSnapshot()).toMatchObject({ status: "confirmed" });
    app.dispose();
  });

  it("VALIDATION no mesmo envio é definitiva, libera nova edição e informa o identificador recusado", async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValueOnce(new Error("lost"))
      .mockResolvedValueOnce(json({ code: "VALIDATION" }, 400)).mockResolvedValueOnce(json({ ok: true, result: capture }));
    const app = createConnectedApplication(userId, { fetch: fetcher });
    await expect(app.commands.captures.create({ ...fields, client_id: "invalid-original" })).rejects.toMatchObject({ outcomeUnknown: true });
    await expect(app.retryPendingCommand()).rejects.toMatchObject({ code: "VALIDATION", outcomeUnknown: false });
    expect(app.getCommandSnapshot()).toMatchObject({ status: "rejected", clientId: "invalid-original" });
    await app.retryPendingCommand(); expect(fetcher).toHaveBeenCalledTimes(2);
    app.clearCommandFeedback(); expect(app.getCommandSnapshot()).toEqual({ status: "idle" });
    await app.commands.captures.create({ ...fields, title: "Corrigida", client_id: "corrected" });
    expect(fetcher).toHaveBeenCalledTimes(3); app.dispose();
  });

  it("troca de conta detectada em leitura elimina o UNKNOWN sem enviar logout nem retry", async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValueOnce(new Error("lost"))
      .mockResolvedValueOnce(json({ code: "SESSION_CHANGED" }, 409));
    const app = createConnectedApplication(userId, { fetch: fetcher });
    await expect(app.commands.captures.create({ ...fields, client_id: "previous-user" })).rejects.toMatchObject({ outcomeUnknown: true });
    await app.load("captures");
    expect(app.getCommandSnapshot()).toMatchObject({ status: "session-changed" });
    expect(app.getSnapshot("captures").data).toBeNull();
    await expect(app.retryPendingCommand()).rejects.toMatchObject({ code: "SESSION_CHANGED", outcomeUnknown: false });
    expect(fetcher).toHaveBeenCalledTimes(2); app.dispose();
  });

  it("impede uma segunda escrita em voo e descarta resultado tardio depois da troca de conta", async () => {
    const write = deferred<Response>(), oldRead = deferred<Response>();
    let reads = 0;
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
      if (init?.method === "POST") return write.promise;
      return ++reads === 1 ? json(dto([task])) : oldRead.promise;
    });
    const app = createConnectedApplication(userId, { fetch: fetcher });
    await app.load("tasks"); await app.load("knowledge");
    const listener = vi.fn(); app.subscribe("tasks", listener); app.subscribe("knowledge", listener);
    const loading = app.load("tasks", true);
    const mutation = app.commands.tasks.status({ id: task.id, client_id: "old-account", status: "done" });
    await expect(app.commands.captures.create({ ...fields, client_id: "second" })).rejects.toMatchObject({ code: "BUSY" });
    const mutationResult = expect(mutation).rejects.toMatchObject({ code: "SESSION_CHANGED", outcomeUnknown: false });
    write.resolve(json({ code: "SESSION_CHANGED" }, 409)); await mutationResult;
    expect(app.getCommandSnapshot()).toMatchObject({ status: "session-changed" });
    expect(app.getSnapshot("tasks")).toMatchObject({ status: "idle", data: null });
    expect(app.getSnapshot("knowledge")).toMatchObject({ status: "idle", data: null });
    expect(listener).toHaveBeenCalled();
    expect(fetcher.mock.calls[1]?.[1]?.signal?.aborted).toBe(true);
    oldRead.resolve(json(dto([task]))); await loading;
    expect(app.getSnapshot("tasks").data).toBeNull();
    const calls = fetcher.mock.calls.length;
    await expect(app.commands.captures.create({ ...fields, client_id: "after-change" })).rejects.toMatchObject({ code: "SESSION_CHANGED", outcomeUnknown: false });
    await expect(app.retryPendingCommand()).rejects.toMatchObject({ code: "SESSION_CHANGED" });
    await app.refreshActive(); expect(fetcher).toHaveBeenCalledTimes(calls);
    expect(fetcher.mock.calls.every(([url]) => !String(url).includes("logout"))).toBe(true);
    app.dispose();
  });

  it("resposta de escrita com outro dono nunca vira resultado incerto", async () => {
    const app = createConnectedApplication(userId, { fetch: vi.fn<typeof fetch>().mockResolvedValue(json({ ok: true, result: { ...capture, user_id: "other" } })) });
    await expect(app.commands.captures.create({ ...fields, client_id: "wrong-owner" })).rejects.toMatchObject({ code: "SESSION_CHANGED", outcomeUnknown: false });
    expect(app.getCommandSnapshot()).toMatchObject({ status: "session-changed" });
    app.dispose();
  });

  it("dispose elimina o payload pendente e nenhum retry envia depois do logout", async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error("lost"));
    const app = createConnectedApplication(userId, { fetch: fetcher });
    await expect(app.commands.captures.create({ ...fields, client_id: "pending-logout" })).rejects.toMatchObject({ outcomeUnknown: true });
    app.dispose();
    expect(app.getCommandSnapshot()).toEqual({ status: "idle" });
    await expect(app.retryPendingCommand()).rejects.toMatchObject({ code: "CLOSED" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe("identidade de envio da captura", () => {
  it("mantém id com ordem diferente de propriedades e proíbe novo payload enquanto o resultado é incerto", () => {
    const requests = new CaptureRequests();
    const first = requests.id("save", { title: "Nota", content: "texto" });
    requests.unknown("save");
    expect(requests.id("save", { content: "texto", title: "Nota" })).toBe(first);
    expect(() => requests.id("save", { title: "Outro" })).toThrow("Confirme");
    requests.complete("save");
    expect(requests.id("save", { title: "Outro" })).not.toBe(first);
  });
});
