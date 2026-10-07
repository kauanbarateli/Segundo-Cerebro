import { describe, expect, it } from "vitest";
import { criarAdapterMemoria } from "../../src/adapters/memory";
import { arquivarCaptura, converterCapturaEmTarefa, criarCaptura, desarquivarCaptura, editarCaptura, excluirCaptura, organizarCaptura, restaurarCaptura, type AnexoCaptura, type NovaCaptura } from "../../src/core/capturas";
const context = { user_id: "notes-user", canal: "web" as const };
const input = (client_id: string, extra: Partial<NovaCaptura> = {}): NovaCaptura => ({ client_id, type: "note", title: "Nota de contrato", content: "Corpo", category_id: null, project_id: null, ...extra });
function setup() {
  let id = 0; let failEvent = 0;
  const deps = { clock: { now: () => "2026-10-07T12:00:00Z" }, ids: { next: () => `notes-${++id}` } };
  return { deps, store: criarAdapterMemoria({ ...deps, beforeOperation(point) { if (point === "event" && failEvent > 0 && --failEvent === 0) throw new Error("event failed"); } }), fail: (at = 1) => { failEvent = at; } };
}
const attachment: AnexoCaptura = { id: "image", name: "Imagem de contrato.png", mime: "image/png", width: 2, height: 3, bytes: 50 };
describe("T009: notas conectadas no contrato de captura", () => {
  it("amplia texto para 30 mil preservando captura sem título e ausência de metadados", async () => {
    const h = setup(); const created = await criarCaptura(h.store, h.deps, context, input("create", { title: null, content: "x".repeat(30_000) }));
    expect(created.content).toHaveLength(30_000); expect(created).not.toHaveProperty("attachments"); expect(created).not.toHaveProperty("linked_capture_ids");
    const converted = await converterCapturaEmTarefa(h.store, h.deps, context, { capture_id: created.id, client_id: "convert" });
    expect(converted.tarefa.description).toBe(created.content);
    await expect(criarCaptura(h.store, h.deps, context, input("too-long", { content: "x".repeat(30_001) }))).rejects.toMatchObject({ code: "VALIDATION" });
  });
  it("grava vínculos e apenas metadados de imagem junto ao evento", async () => {
    const h = setup(); const target = await criarCaptura(h.store, h.deps, context, input("target"));
    const created = await criarCaptura(h.store, h.deps, context, input("source", { linked_capture_ids: [target.id], attachments: [{ ...attachment, blob: new Blob(["private source"]) } as AnexoCaptura] }));
    expect(created.attachments).toEqual([attachment]);
    const events = await h.store.read(context.user_id).eventos.list();
    expect(events.at(-1)?.after).toEqual(created); expect(events.at(-1)?.after).not.toHaveProperty("attachments.0.blob");
  });
  it("rejeita links alheios, repetidos e para si, revertendo a edição", async () => {
    const h = setup(); const own = await criarCaptura(h.store, h.deps, context, input("own"));
    const target = await criarCaptura(h.store, h.deps, context, input("target"));
    const foreign = await criarCaptura(h.store, h.deps, { ...context, user_id: "another" }, input("foreign"));
    for (const ids of [[foreign.id], ["missing"], [own.id], [target.id, target.id]]) {
      await expect(editarCaptura(h.store, h.deps, context, { id: own.id, client_id: `links-${ids.join()}`, patch: { linked_capture_ids: ids } })).rejects.toHaveProperty("code");
    }
    expect(await h.store.read(context.user_id).capturas.get(own.id)).toEqual(own);
  });
  it("vínculo histórico sobrevive ao arquivo/lixeira sem bloquear edição não relacionada", async () => {
    const h = setup(); const target = await criarCaptura(h.store, h.deps, context, input("target"));
    const source = await criarCaptura(h.store, h.deps, context, input("source", { linked_capture_ids: [target.id] }));
    await excluirCaptura(h.store, h.deps, context, { id: target.id, client_id: "delete-target" });
    expect((await editarCaptura(h.store, h.deps, context, { id: source.id, client_id: "rename", patch: { title: "Renomeada" } })).linked_capture_ids).toEqual([target.id]);
    await expect(criarCaptura(h.store, h.deps, context, input("new-link", { linked_capture_ids: [target.id] }))).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it.each([
    Array.from({ length: 7 }, (_, index) => ({ ...attachment, id: String(index) })),
    [attachment, attachment], [{ ...attachment, bytes: 8 * 1024 * 1024 + 1 }],
    [{ ...attachment, width: 0 }], [{ ...attachment, mime: "image/svg+xml" }],
  ])("rejeita metadados de imagem inválidos atomicamente", async (...args) => {
    const h = setup(); const attachments = args as AnexoCaptura[];
    await expect(criarCaptura(h.store, h.deps, context, input("invalid", { attachments }))).rejects.toMatchObject({ code: "VALIDATION" });
    expect(await h.store.read(context.user_id).capturas.list()).toEqual([]);
  });
  it("organizar mantém identidade, conteúdo e vínculos; replay não gera evento", async () => {
    const h = setup(); const before = await criarCaptura(h.store, h.deps, context, input("new", { attachments: [attachment] }));
    const operation = { id: before.id, client_id: "organize", destination: "knowledge" as const };
    const after = await organizarCaptura(h.store, h.deps, context, operation);
    expect(after).toMatchObject({ id: before.id, content: before.content, attachments: [attachment], status: "organized", organized_at: h.deps.clock.now() });
    expect(await organizarCaptura(h.store, h.deps, context, operation)).toEqual(after);
    expect(await h.store.read(context.user_id).eventos.list()).toHaveLength(2);
    await expect(organizarCaptura(h.store, h.deps, context, { ...operation, destination: "inbox" })).rejects.toMatchObject({ code: "CONFLICT" });
    expect((await organizarCaptura(h.store, h.deps, context, { ...operation, client_id: "undo", destination: "inbox" })).status).toBe("inbox");
  });
  it.each(["inbox", "organized", "converted"])("desarquivar retoma destino %s sem perder origem", async (state) => {
    const h = setup(); let capture = await criarCaptura(h.store, h.deps, context, input("new"));
    if (state === "organized") capture = await organizarCaptura(h.store, h.deps, context, { id: capture.id, client_id: "organize", destination: "knowledge" });
    if (state === "converted") capture = (await converterCapturaEmTarefa(h.store, h.deps, context, { capture_id: capture.id, client_id: "convert" })).captura;
    await arquivarCaptura(h.store, h.deps, context, { id: capture.id, client_id: "archive" });
    const restored = await desarquivarCaptura(h.store, h.deps, context, { id: capture.id, client_id: "unarchive" });
    expect(restored).toEqual(capture);
    if (state === "converted") expect(await h.store.read(context.user_id).tarefas.list()).toHaveLength(1);
  });
  it("falha de evento desfaz organização e permite repetir o mesmo client_id", async () => {
    const h = setup(); const before = await criarCaptura(h.store, h.deps, context, input("new")); h.fail();
    const operation = { id: before.id, client_id: "organize", destination: "knowledge" as const };
    await expect(organizarCaptura(h.store, h.deps, context, operation)).rejects.toThrow("event failed");
    expect(await h.store.read(context.user_id).capturas.get(before.id)).toEqual(before);
    expect((await organizarCaptura(h.store, h.deps, context, operation)).status).toBe("organized");
  });
  it("renomeia referências próprias, ativas, arquivadas e na lixeira em um só comando", async () => {
    const h = setup();
    const target = await criarCaptura(h.store, h.deps, context, input("target", { title: "Plano", content: "Índice [[PLANO]] e [[Outra nota]]." }));
    const linked = await criarCaptura(h.store, h.deps, context, input("linked", { title: "Ligada", content: "Antes [[ plano ]] depois.", linked_capture_ids: [target.id], attachments: [attachment] }));
    const archived = await criarCaptura(h.store, h.deps, context, input("archived", { title: "Arquivada", content: "[[Plano]]" }));
    const trash = await criarCaptura(h.store, h.deps, context, input("trash", { title: "Lixeira", content: "Restaurar [[Plano]]" }));
    const archivedBefore = await arquivarCaptura(h.store, h.deps, context, { id: archived.id, client_id: "archive" });
    const trashBefore = await excluirCaptura(h.store, h.deps, context, { id: trash.id, client_id: "delete" });
    const foreignContext = { ...context, user_id: "other-user" };
    const foreign = await criarCaptura(h.store, h.deps, foreignContext, input("foreign", { title: "Plano", content: "[[Plano]]" }));
    const beforeEvents = await h.store.read(context.user_id).eventos.list();
    const updated = await editarCaptura(h.store, h.deps, context, { id: target.id, client_id: "rename", patch: { title: "Plano atualizado" } });
    const view = h.store.read(context.user_id);
    expect(updated.content).toBe("Índice [[Plano atualizado]] e [[Outra nota]].");
    expect(await view.capturas.get(linked.id)).toEqual({ ...linked, content: "Antes [[Plano atualizado]] depois." });
    expect(await view.capturas.get(archived.id)).toEqual({ ...archivedBefore, content: "[[Plano atualizado]]" });
    expect(await view.capturas.get(trash.id)).toEqual({ ...trashBefore, content: "Restaurar [[Plano atualizado]]" });
    expect(await h.store.read(foreignContext.user_id).capturas.get(foreign.id)).toEqual(foreign);
    const events = (await view.eventos.list()).slice(beforeEvents.length);
    expect(events).toHaveLength(4);
    expect(events.every((event) => event.action === "updated")).toBe(true);
    const restored = await restaurarCaptura(h.store, h.deps, context, { id: trash.id, client_id: "restore" });
    expect(restored.content).toBe("Restaurar [[Plano atualizado]]");
  });
  it("falha no segundo evento reverte título, referências e recibo; retry e replay são atômicos", async () => {
    const h = setup(); const target = await criarCaptura(h.store, h.deps, context, input("target", { title: "Origem" }));
    await criarCaptura(h.store, h.deps, context, input("linked", { title: "Ligada", content: "Texto [[Origem]]", linked_capture_ids: [target.id] }));
    const view = h.store.read(context.user_id); const before = await view.capturas.list(); const events = await view.eventos.list();
    const command = { id: target.id, client_id: "rename", patch: { title: "Destino" } };
    h.fail(2);
    await expect(editarCaptura(h.store, h.deps, context, command)).rejects.toThrow("event failed");
    expect(await view.capturas.list()).toEqual(before); expect(await view.eventos.list()).toEqual(events);
    const saved = await editarCaptura(h.store, h.deps, context, command);
    expect(saved.title).toBe("Destino"); expect(await view.eventos.list()).toHaveLength(events.length + 2);
    expect(await editarCaptura(h.store, h.deps, context, command)).toEqual(saved);
    expect(await view.eventos.list()).toHaveLength(events.length + 2);
    expect((await view.capturas.list()).find((item) => item.id !== target.id)).toMatchObject({ content: "Texto [[Destino]]", linked_capture_ids: [target.id] });
  });
  it.each(["own", "related"])("rejeita expansão além de 30 mil no corpo %s sem qualquer escrita", async (location) => {
    const h = setup(); const full = "[[A]]" + "x".repeat(29_995);
    const target = await criarCaptura(h.store, h.deps, context, input("target", { title: "A", content: location === "own" ? full : "Corpo" }));
    if (location === "related") await criarCaptura(h.store, h.deps, context, input("related", { title: "Relacionada", content: full }));
    const view = h.store.read(context.user_id); const before = await view.capturas.list(); const events = await view.eventos.list();
    await expect(editarCaptura(h.store, h.deps, context, { id: target.id, client_id: "rename", patch: { title: "Título maior" } })).rejects.toMatchObject({ code: "VALIDATION", message: expect.stringContaining("30.000") });
    expect(await view.capturas.list()).toEqual(before); expect(await view.eventos.list()).toEqual(events);
  });
  it.each(["pláno", "NOVO TÍTULO"])("rejeita nome legado ambíguo %s antes de reescrever referências", async (duplicateTitle) => {
    const h = setup(); const target = await criarCaptura(h.store, h.deps, context, input("target", { title: "Plano" }));
    await criarCaptura(h.store, h.deps, context, input("duplicate", { title: duplicateTitle }));
    await criarCaptura(h.store, h.deps, context, input("linked", { title: "Ligada", content: "[[Plano]]" }));
    const view = h.store.read(context.user_id); const before = await view.capturas.list(); const events = await view.eventos.list();
    await expect(editarCaptura(h.store, h.deps, context, { id: target.id, client_id: "rename", patch: { title: "Novo título" } })).rejects.toMatchObject({ code: "CONFLICT", message: expect.stringContaining("ambíguas") });
    expect(await view.capturas.list()).toEqual(before); expect(await view.eventos.list()).toEqual(events);
  });
});
