import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { decodeCaptureTaskRequest, executeCaptureTaskCommand } from "../../src/adapters/db/capture-task-commands";
import { criarAdapterMemoria } from "../../src/adapters/memory";

const actor = "10000000-0000-4000-8000-000000000001";
const id = "10000000-0000-4000-8000-000000000002";
const fields = { client_id: "stable-command", type: "note", title: "Captura", content: "Conteúdo", category_id: null, project_id: null };
describe("Authenticated command input", () => {
  it.each([
    { command: "capture.create", input: fields, user_id: actor },
    { command: "capture.create", input: { ...fields, user_id: actor } },
    { command: "capture.update", input: { id, client_id: "edit", patch: { user_id: actor } } },
    { command: "capture.update", input: { id: "not-a-uuid", client_id: "edit", patch: {} } },
    { command: "capture.create", input: { ...fields, attachments: [{ id }] } },
    { command: "capture.organize", input: { id, client_id: "organize", destination: "knowledge" } },
    { command: "arbitrary.batch", input: fields },
    { command: "task.update", input: { id, client_id: "edit", patch: null } },
    { command: "task.status", input: { id, client_id: "status" } },
    { command: "task.status", input: { id, client_id: "status", status: null } },
    { command: "task.status", input: { id, client_id: "status", status: "unknown" } },
  ])("refuses authority, malformed fields and unavailable operations", value => {
    expect(() => decodeCaptureTaskRequest(value)).toThrow();
  });
  it("reuses the domain core and fixes the actor/channel on server", async () => {
    let next = 2;
    const deps = { clock: { now: () => "2026-10-07T12:00:00.000Z" }, ids: { next: () => `10000000-0000-4000-8000-${String(next++).padStart(12, "0")}` } };
    const store = criarAdapterMemoria(deps), context = { user_id: actor, canal: "web" as const };
    const request = decodeCaptureTaskRequest({ command: "capture.create", input: fields });
    const first = await executeCaptureTaskCommand(store, deps, context, request);
    expect(first).toMatchObject({ user_id: actor, title: "Captura" });
    expect(await executeCaptureTaskCommand(store, deps, context, request)).toEqual(first);
    const events = await store.read(actor).eventos.list();
    expect(events).toHaveLength(1); expect(events[0]).toMatchObject({ user_id: actor, canal: "web" });
  });
  it("allows returning a capture to inbox without simulating a knowledge page", () => {
    expect(decodeCaptureTaskRequest({ command: "capture.organize", input: { id, client_id: "inbox", destination: "inbox" } })).toMatchObject({ command: "capture.organize" });
  });
});
