import { describe, expect, it } from "vitest";
import { createDemoApplication } from "../../src/lib/demo/application";
import { executeDemoDomainCommand } from "../../src/lib/demo/domain-commands";
describe("criar aqui abre a mesma fonte na demonstração", () => {
  it("materializa Capturar e mantém vincular/desvincular e edição coerentes", async () => {
    const app = createDemoApplication({ initial: {} });
    const project = await app.commands.projects.create({ client_id: "project", name: "Contexto", description: null, color_key: "neutral", position: 0 });
    const row = await app.commands.projects.containers.create({ client_id: "source", kind: "capture", name: "Uma nota", project_id: project.id });
    await app.load("captures"); expect(app.getSnapshot("captures").data?.items.find(item => item.id === row.id)).toMatchObject({ title: "Uma nota", project_id: project.id, status: "inbox" });
    await app.commands.captures.update({ id: row.id, client_id: "edit", patch: { title: "Nota editada", content: "Conteúdo próprio" } });
    await app.load("projects", true); expect(app.getSnapshot("projects").data?.containers?.find(item => item.id === row.id)?.name).toBe("Nota editada");
    await executeDemoDomainCommand(app, "project.container.unlink", { id: row.id, client_id: "unlink" });
    await app.load("captures", true); expect(app.getSnapshot("captures").data?.items.find(item => item.id === row.id)).toMatchObject({ content: "Conteúdo próprio", project_id: null });
    app.dispose();
  });
  it("materializa caderno e pasta na fonte que seus links abrem", async () => {
    const app = createDemoApplication({ initial: {} });
    const project = await app.commands.projects.create({ client_id: "project", name: "Contexto", description: null, color_key: "neutral", position: 0 });
    for (const kind of ["notebook", "folder"] as const) await executeDemoDomainCommand(app, "project.container.create", { kind, name: "Fonte " + kind, project_id: project.id, client_id: kind });
    await app.load("knowledge"); await app.load("drive");
    expect(app.getSnapshot("knowledge").data?.notebooks[0]).toMatchObject({ name: "Fonte notebook", project_id: project.id });
    expect(app.getSnapshot("drive").data?.folders[0]).toMatchObject({ name: "Fonte folder", project_id: project.id });
    app.dispose();
  });
});
