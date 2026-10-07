import { describe, expect, it } from "vitest";
import { createDemoApplication } from "../../src/lib/demo/application";
import { createDemoFixture, DEMO_NOW } from "../../src/lib/demo/fixtures";
import { faturaFinanceira, patrimonioFinanceiro, saldosFinanceiros, totaisFinanceiros } from "../../src/core/financeiro";
import type { DemoQueryKey } from "../../src/lib/demo/types";

describe("universo compartilhado de demonstração", () => {
  it("deriva os números do protótipo de uma só massa, sem contadores artificiais", async () => {
    const app = createDemoApplication();
    await Promise.all([app.load("tasks"), app.load("captures"), app.load("finance")]);
    const tasks = app.getSnapshot("tasks").data!.items;
    const captures = app.getSnapshot("captures").data!.items;
    const finance = app.getSnapshot("finance").data!;
    expect(tasks.filter((row) => row.status === "todo" || row.status === "in_progress")).toHaveLength(5);
    expect(tasks.filter((row) => row.status === "done")).toHaveLength(2);
    expect(captures.filter((row) => row.status === "organized")).toHaveLength(4);
    expect(captures.filter((row) => row.status === "inbox")).toHaveLength(3);
    expect(totaisFinanceiros(finance.transactions, finance.accounts, ["2026-09-01"])).toMatchObject({ incomeCents: 800000, expenseCents: 324760, balanceCents: 475240 });
    const balances = saldosFinanceiros(finance.transactions, finance.accounts);
    expect(balances.find((row) => row.account_id === "account-itau")?.balance_cents).toBe(431742);
    expect(balances.find((row) => row.account_id === "account-cdb")?.balance_cents).toBe(1850000);
    expect(faturaFinanceira(finance.transactions, finance.accounts.find((row) => row.id === "account-nubank")!, "2026-09-01")).toMatchObject({ totalCents: 241280, paidCents: 0, openCents: 241280 });
    expect(patrimonioFinanceiro(finance.transactions, finance.accounts)).toBeDefined();
  });

  it("nenhuma consulta é antecipada para um bloco desligado", async () => {
    const queried: DemoQueryKey[] = [];
    const app = createDemoApplication({ onQuery: (key) => queried.push(key) });
    expect(queried).toEqual([]);
    await app.load("tasks");
    expect(queried).toEqual(["tasks"]);
    expect(app.getSnapshot("finance").status).toBe("idle");
    await app.load("tasks");
    expect(queried).toEqual(["tasks"]);
  });

  it("concluir e converter atualiza todos os observadores dos mesmos registros", async () => {
    const app = createDemoApplication();
    const observations: string[] = [];
    const stopHome = app.subscribe("tasks", () => observations.push("home"));
    const stopTasks = app.subscribe("tasks", () => observations.push("tasks"));
    const stopCaptures = app.subscribe("captures", () => observations.push("captures"));
    await Promise.all([app.load("tasks"), app.load("captures")]);
    await app.commands.tasks.status({ id: "task-milestones", status: "done", client_id: "finish" });
    expect(app.getSnapshot("tasks").data!.items.find((row) => row.id === "task-milestones")?.status).toBe("done");
    const converted = await app.commands.captures.convert({ capture_id: "watch", client_id: "convert" });
    await app.commands.captures.convert({ capture_id: "watch", client_id: "convert" });
    expect(app.getSnapshot("tasks").data!.items.filter((row) => row.origin_capture_id === "watch")).toHaveLength(1);
    expect(app.getSnapshot("captures").data!.items.find((row) => row.id === "watch")?.converted_task_id).toBe(converted.tarefa.id);
    expect(observations.filter((value) => value === "home")).toHaveLength(observations.filter((value) => value === "tasks").length);
    stopHome(); stopTasks(); stopCaptures();
  });

  it("ocultar Projetos remove seu enriquecimento sem consultar esse repositório", async () => {
    let reads = 0;
    const app = createDemoApplication({ beforeOperation: (point, query) => { if (point === "read" && query === "tasks") reads++; } });
    await app.setProjectVisibility(false);
    await app.load("tasks");
    expect(reads).toBe(2); // tasks + common categories; projects is not queried.
    expect(app.getSnapshot("tasks").data!.projects).toEqual([]);
    await app.setProjectVisibility(true);
    await app.load("tasks");
    expect(reads).toBe(5);
    expect(app.getSnapshot("tasks").data!.projects).toHaveLength(2);
  });

  it("não consulta módulo desmontado depois de uma mutação; reabre com o estado atualizado", async () => {
    const queried: DemoQueryKey[] = [];
    const app = createDemoApplication({ onQuery: (key) => queried.push(key) });
    await app.load("tasks");
    await app.commands.tasks.status({ id: "task-milestones", status: "done", client_id: "finish" });
    expect(queried).toEqual(["tasks"]);
    await app.load("tasks");
    expect(queried).toEqual(["tasks", "tasks"]);
    expect(app.getSnapshot("tasks").data!.items.find((row) => row.id === "task-milestones")?.status).toBe("done");
  });

  it("erro injetado na leitura aparece como erro e retry recupera, sem falso vazio", async () => {
    let fail = true;
    const app = createDemoApplication({ beforeOperation: (point, query) => { if (point === "read" && query === "tasks" && fail) throw new Error("infra"); } });
    await app.load("tasks");
    expect(app.getSnapshot("tasks")).toMatchObject({ status: "error", data: null, error: expect.stringContaining("Tente de novo") });
    fail = false;
    await app.load("tasks", true);
    expect(app.getSnapshot("tasks").data!.items).toHaveLength(7);
  });

  it("falha de escrita não publica estado parcialmente alterado", async () => {
    const app = createDemoApplication({ beforeOperation: (point) => { if (point === "commit") throw new Error("commit indisponível"); } });
    await app.load("tasks");
    await expect(app.commands.tasks.status({ id: "task-milestones", status: "done", client_id: "finish" })).rejects.toThrow("commit indisponível");
    await app.load("tasks", true);
    expect(app.getSnapshot("tasks").data!.items.find((row) => row.id === "task-milestones")?.status).toBe("in_progress");
  });

  it("instâncias e snapshots não permitem alterar a visita de outro usuário", async () => {
    const a = createDemoApplication({ userId: "alice" }), b = createDemoApplication({ userId: "bob" });
    await Promise.all([a.load("tasks"), b.load("tasks")]);
    expect(() => { a.getSnapshot("tasks").data!.items[0]!.title = "Mutação fora do núcleo"; }).toThrow();
    await a.commands.tasks.status({ id: "task-milestones", status: "done", client_id: "finish" });
    await b.load("tasks", true);
    expect(b.getSnapshot("tasks").data!.items.every((row) => row.user_id === "bob")).toBe(true);
    expect(b.getSnapshot("tasks").data!.items.find((row) => row.id === "task-milestones")?.status).toBe("in_progress");
  });

  it("hoje usa o fuso do aplicativo inclusive na borda UTC", () => {
    const app = createDemoApplication({ clock: { now: () => "2026-09-24T01:00:00.000Z" } });
    expect(app.today()).toBe("2026-09-23");
    expect(createDemoApplication().clock.now()).toBe(DEMO_NOW);
    const fixture = createDemoFixture("2026-09-24T01:00:00.000Z");
    expect(fixture.agenda[0]!.starts_at).toBe("2026-09-23T12:30:00.000Z");
  });

  it("vazio real é um snapshot pronto com lista vazia", async () => {
    const app = createDemoApplication({ initial: {} });
    await app.load("tasks");
    expect(app.getSnapshot("tasks")).toEqual({ status: "ready", data: { items: [], categories: [], projects: [] }, error: null });
  });

  it("encerrar cancela leituras pendentes, limpa bytes e impede novas escritas", async () => {
    const queried: DemoQueryKey[] = [];
    const app = createDemoApplication({ onQuery: (key) => queried.push(key) });
    const blob = new Blob([new Uint8Array([1])], { type: "image/png" });
    app.stageImage({ id: "image", name: "Imagem.png", blob, mime: "image/png", width: 1, height: 1, bytes: 1 });
    const pending = app.load("tasks");
    app.dispose();
    await pending;
    expect(queried).toEqual([]);
    expect(app.getImage("image")).toBeUndefined();
    expect(app.getSnapshot("tasks").status).toBe("idle");
    await expect(app.commands.tasks.status({ id: "task-milestones", status: "done", client_id: "finish" })).rejects.toThrow("encerrada");
  });
});
