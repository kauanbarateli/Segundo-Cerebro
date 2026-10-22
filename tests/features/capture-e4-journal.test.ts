import { describe, expect, it, vi } from "vitest";
import { createConnectedApplication } from "../../src/lib/demo/connected-application";
import { createDemoFixture } from "../../src/lib/demo/fixtures";
import { journalBrowser } from "./helpers/journal-browser";
const owner = "10000000-0000-4000-8000-000000000001", id = "10000000-0000-4000-8000-000000000002";
const document = { type: "doc" as const, content: [{ type: "paragraph", attrs: { textAlign: "center" }, content: [{ type: "text", text: "Formatado", marks: [{ type: "bold" }] }] }] };
const input = { client_id: "rich-create-original", title: "Nota", type: "note" as const, category_id: null, project_id: null, document };
const saved = { ...createDemoFixture(undefined, owner).initial.capture![0]!, id, user_id: owner, client_id: input.client_id, title: input.title, category_id: null, project_id: null, type: input.type, status: "inbox" as const, converted_task_id: null, organized_at: null, archived_at: null, deleted_at: null, document, document_version: 1, content: "Formatado", linked_capture_ids: [] };
const json = (value: unknown) => new Response(JSON.stringify(value));
const read = () => json({ items: [], categories: [], projects: [] });
describe("E4 original durable journal", () => {
  it("restores rich creation after response loss and sends exactly the same intention", async () => {
    const browser = journalBrowser(), bodies: string[] = [];
    const failed = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => { if (init?.method !== "POST") return read(); bodies.push(String(init.body)); throw new Error("response lost"); });
    const first = createConnectedApplication(owner, { journal: browser.tab().journal, fetch: failed });
    try { await expect(first.commands.captures.create(input)).rejects.toMatchObject({ outcomeUnknown: true }); expect(browser.entries()).toHaveLength(1); } finally { first.dispose(); }
    const success = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => { if (init?.method !== "POST") return read(); bodies.push(String(init.body)); return json({ ok: true, result: saved }); });
    const resumed = createConnectedApplication(owner, { journal: browser.tab().journal, fetch: success });
    try { await resumed.retryPendingCommand(); expect(bodies).toHaveLength(2); expect(bodies[1]).toBe(bodies[0]); expect(JSON.parse(bodies[1]!).input).toEqual(input); expect(browser.entries()).toHaveLength(0); } finally { resumed.dispose(); }
  });
  it.each([{ document_version: 2 }, { title: "Outra nota" }, { status: "archived" }, { content: "cache forjado" }, { document: { type: "doc", content: [] } }])("does not settle a creation on a different ACK %#", async delta => {
    const browser = journalBrowser(), bodies: string[] = [];
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => { if (init?.method !== "POST") return read(); bodies.push(String(init.body)); return json({ ok: true, result: bodies.length === 1 ? { ...saved, ...delta } : saved }); });
    const app = createConnectedApplication(owner, { journal: browser.tab().journal, fetch: fetcher });
    try { await expect(app.commands.captures.create(input)).rejects.toMatchObject({ outcomeUnknown: true }); expect(browser.entries()).toHaveLength(1); await app.retryPendingCommand(); expect(bodies[1]).toBe(bodies[0]); expect(browser.entries()).toHaveLength(0); } finally { app.dispose(); }
  });
  it("closes the old account on a foreign ACK instead of publishing it or retrying as that owner", async () => {
    const browser = journalBrowser(), fetcher = vi.fn<typeof fetch>().mockResolvedValue(json({ ok: true, result: { ...saved, user_id: id } }));
    const app = createConnectedApplication(owner, { journal: browser.tab().journal, fetch: fetcher });
    try { await expect(app.commands.captures.create(input)).rejects.toMatchObject({ code: "SESSION_CHANGED" }); expect(app.getSnapshot("captures")).toMatchObject({ status: "idle", data: null }); await expect(app.retryPendingCommand()).rejects.toMatchObject({ code: "SESSION_CHANGED" }); expect(fetcher).toHaveBeenCalledTimes(1); } finally { app.dispose(); }
  });
  const linkedId = "10000000-0000-4000-8000-000000000003", historicalId = "10000000-0000-4000-8000-000000000004";
  const linkedDocument = { type: "doc" as const, content: [{ type: "paragraph", content: [{ type: "text", text: "Formatado " }, { type: "captureLink", attrs: { target_id: linkedId, alias: "Destino" } }] }] };
  const update = { id, client_id: "rich-update-derived", expected_content: { kind: "rich" as const, document_version: 1 }, patch: { document: linkedDocument } };
  const updated = { ...saved, document: linkedDocument, document_version: 2, content: "Formatado Destino", linked_capture_ids: [linkedId, historicalId] };
  it.each([{ linked_capture_ids: [] }, { linked_capture_ids: undefined }])("does not settle a rich update whose ACK omits its typed Capture ID (%#)", async ({ linked_capture_ids }) => {
    const browser = journalBrowser(), bodies: string[] = [];
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
      if (init?.method !== "POST") return read(); bodies.push(String(init.body));
      return json({ ok: true, result: bodies.length === 1 ? { ...updated, linked_capture_ids } : updated });
    });
    const app = createConnectedApplication(owner, { journal: browser.tab().journal, fetch: fetcher });
    try {
      await expect(app.commands.captures.update(update)).rejects.toMatchObject({ outcomeUnknown: true });
      expect(browser.entries()).toHaveLength(1); expect(app.getCommandSnapshot()).toMatchObject({ status: "pending" });
      await app.retryPendingCommand();
      expect(bodies).toHaveLength(2); expect(bodies[1]).toBe(bodies[0]); expect(JSON.parse(bodies[1]!).input).toEqual(update);
      expect(browser.entries()).toHaveLength(0); expect(app.getCommandSnapshot()).toMatchObject({ status: "confirmed", clientId: update.client_id });
    } finally { app.dispose(); }
  });
  it("accepts a rich update with every typed ID and preserved historical links when the intention omits the list", async () => {
    const browser = journalBrowser(), bodies: string[] = [];
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
      if (init?.method !== "POST") return read(); bodies.push(String(init.body)); return json({ ok: true, result: updated });
    });
    const app = createConnectedApplication(owner, { journal: browser.tab().journal, fetch: fetcher });
    try {
      expect(Object.hasOwn(update.patch, "linked_capture_ids")).toBe(false);
      expect(await app.commands.captures.update(update)).toEqual(updated);
      expect(JSON.parse(bodies[0]!).input).toEqual(update); expect(bodies).toHaveLength(1); expect(browser.entries()).toHaveLength(0);
    } finally { app.dispose(); }
  });
});
