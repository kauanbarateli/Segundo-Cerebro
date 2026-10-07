import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createCaptureTaskGateway, parseCaptureTaskSnapshot, CaptureTaskRateLimitError, type CaptureTaskRpc } from "../../src/adapters/db/capture-task-gateway";
import { CommitOutcomeUnknown, type CaptureTaskCommit } from "../../src/adapters/db/capture-task-store";
import type { Captura } from "../../src/core/capturas";
import { assinatura } from "../../src/core/contracts";
import { AuthGuardError } from "../../src/lib/auth/types";

const actor = "10000000-0000-4000-8000-000000000001";
const session = "10000000-0000-4000-8000-000000000002";
const now = "2026-10-07T12:00:00.000Z";
const row: Captura = { id: "10000000-0000-4000-8000-000000000003", user_id: actor, client_id: "command", type: "note", title: "Nota", content: "Texto", category_id: null, project_id: null, status: "inbox", converted_task_id: null, captured_at: now, organized_at: null, archived_at: null, deleted_at: null, created_at: now, updated_at: now };
const saved = { user_id: actor, command: "capture.create", client_id: "command", fingerprint: assinatura({ client_id: "command" }), result: row };
const snapshot = () => ({ revision: "0", captures: [structuredClone(row)], tasks: [], categories: [], projects: [], events: [], receipts: [structuredClone(saved)], projects_visible: false });
const request = (): CaptureTaskCommit => ({ expectedRevision: "0", context: { user_id: actor, canal: "web" }, changes: [{ type: "capture", before: null, after: row }], events: [], receipt: saved });
describe("Supabase transport boundary", () => {
  it("binds actor/session/operation in every request and strips provider top-level fields", async () => {
    const rpc = vi.fn<CaptureTaskRpc>(async name => ({ data: name === "capture_task_snapshot" ? { ...snapshot(), provider_private: "private-canary" } : name === "capture_task_revision" ? "1" : name === "capture_task_receipt" ? saved : { status: "committed", result: row }, error: null }));
    const gateway = createCaptureTaskGateway(actor, session, "capture.create", rpc);
    const view = await gateway.presentation();
    expect(view.projectsVisible).toBe(false); expect(JSON.stringify(view.snapshot)).not.toContain("private-canary");
    await gateway.currentRevision(); await gateway.receipt("capture.create", "command"); await gateway.commit(request());
    for (const [, args] of rpc.mock.calls) expect(args).toMatchObject({ p_user: actor, p_session: session, p_operation: "capture.create" });
    expect(view.snapshot).not.toHaveProperty("projects_visible");
  });
  it.each([
    { ...snapshot(), revision: 1 }, { ...snapshot(), projects_visible: undefined },
    { ...snapshot(), captures: [{ ...row, user_id: session }] },
    { ...snapshot(), captures: [{ ...row, captured_at: "2026-02-30T12:00:00Z" }] },
    { ...snapshot(), captures: [{ ...row, private_token: "secret-canary" }] },
    { ...snapshot(), receipts: [{ ...saved, result: { ...row, user_id: session } }] },
  ])("refuses malformed or foreign DTOs without echoing provider values", value => {
    expect(() => parseCaptureTaskSnapshot(value, actor)).toThrow(AuthGuardError);
    try { parseCaptureTaskSnapshot(value, actor); } catch (error) { expect(String(error)).not.toContain("canary"); }
  });
  it("does not turn failed reads into successful empty snapshots", async () => {
    const rpc: CaptureTaskRpc = async () => { throw new Error("SQL-and-key-canary"); };
    await expect(createCaptureTaskGateway(actor, session, "read.captures", rpc).snapshot()).rejects.toMatchObject({ code: "unavailable" });
  });
  it("transport failure after commit remains unknown so the store can reconcile", async () => {
    const rpc: CaptureTaskRpc = async () => { throw new Error("raw-provider-canary"); };
    await expect(createCaptureTaskGateway(actor, session, "capture.create", rpc).commit(request())).rejects.toBeInstanceOf(CommitOutcomeUnknown);
  });
  it.each([{ data: null, error: null }, { data: { status: "committed", result: { ...row, user_id: session } }, error: null }])("malformed successful commit requires reconciliation", async response => {
    const rpc: CaptureTaskRpc = async () => response;
    await expect(createCaptureTaskGateway(actor, session, "capture.create", rpc).commit(request())).rejects.toBeInstanceOf(CommitOutcomeUnknown);
  });
  it.each([["42501", "forbidden"], ["23514", "VALIDATION"], ["23505", "CONFLICT"]])("propagates known SQL denial %s", async (code, expected) => {
    const rpc: CaptureTaskRpc = async () => ({ data: null, error: { code } });
    await expect(createCaptureTaskGateway(actor, session, "capture.create", rpc).commit(request())).rejects.toMatchObject({ code: expected });
  });
  it("rate limit produces a clear refusal and never looks committed", async () => {
    const rpc: CaptureTaskRpc = async () => ({ data: null, error: { code: "PT429" } });
    await expect(createCaptureTaskGateway(actor, session, "capture.create", rpc).commit(request())).rejects.toBeInstanceOf(CaptureTaskRateLimitError);
  });
  it("foreign request owner and command are refused before privileged transport", async () => {
    const rpc = vi.fn<CaptureTaskRpc>();
    const gateway = createCaptureTaskGateway(actor, session, "capture.create", rpc);
    await expect(gateway.commit({ ...request(), context: { user_id: session, canal: "web" } })).rejects.toBeInstanceOf(AuthGuardError);
    await expect(gateway.commit({ ...request(), receipt: { ...saved, command: "task.create" } })).rejects.toBeInstanceOf(AuthGuardError);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("receipt lookup refuses a different operation key", async () => {
    const rpc: CaptureTaskRpc = async () => ({ data: saved, error: null });
    await expect(createCaptureTaskGateway(actor, session, "capture.create", rpc).receipt("capture.create", "another")).rejects.toBeInstanceOf(AuthGuardError);
  });
});
