import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CaptureTaskGateway } from "../../src/adapters/db/capture-task-store";
vi.mock("server-only", () => ({}));
const seams = vi.hoisted(() => ({ config: vi.fn(), services: vi.fn(), gateway: vi.fn() }));
vi.mock("../../src/lib/auth/config", () => ({ readAuthConfiguration: seams.config }));
vi.mock("../../src/lib/auth/runtime", () => ({ requestAuthServices: seams.services }));
vi.mock("../../src/adapters/db/capture-task-runtime", () => ({ captureTaskGatewayForRequest: seams.gateway }));
import { GET, POST } from "../../src/app/api/capture-tasks/route";
import { CommitOutcomeUnknown } from "../../src/adapters/db/capture-task-store";

const actor = "10000000-0000-4000-8000-000000000001";
const session = "10000000-0000-4000-8000-000000000002";
const origin = "http://127.0.0.1:3000";
const identity = { userId: actor, sessionId: session, mustChangePassword: false, role: "user", entitlements: {} };
const input = { client_id: "stable", type: "note", title: "Nota", content: "Texto", category_id: null, project_id: null };
const writeRequest = (body: unknown, requestOrigin = origin, expectedUser = actor) => new Request(origin + "/api/capture-tasks", { method: "POST", headers: { Origin: requestOrigin, "Content-Type": "application/json", "X-Expected-User-ID": expectedUser }, body: JSON.stringify(body) });
const readRequest = (expectedUser = actor) => new Request(origin + "/api/capture-tasks?query=captures", { headers: { "X-Expected-User-ID": expectedUser } });
let commit = vi.fn<CaptureTaskGateway["commit"]>();
beforeEach(() => {
  vi.resetAllMocks();
  seams.config.mockReturnValue({ mode: "supabase", appOrigin: origin });
  seams.services.mockResolvedValue({ gateway: { readIdentity: async () => structuredClone(identity) } });
  commit = vi.fn<CaptureTaskGateway["commit"]>(async request => ({ status: "committed", result: request.receipt.result }));
  const gateway: CaptureTaskGateway = {
    actorId: actor,
    snapshot: async () => ({ revision: "0", captures: [], tasks: [], categories: [], projects: [], events: [], receipts: [] }),
    currentRevision: async () => "0", receipt: async () => null, commit,
  };
  seams.gateway.mockReturnValue({ ...gateway, presentation: async () => ({ snapshot: { captures: [], tasks: [{ privateTask: true }], categories: [], projects: [{ deleted_at: null, privateProject: true }], events: [{ secretEvent: true }], receipts: [] }, projectsVisible: false }) });
});
describe("Capture/task HTTP channel", () => {
  it("variante documental conserva veto Capturar e sessão vinculada antes do gateway", async () => {
    const value = { command: "capture.update", input: { id: actor, client_id: "doc-denied", expected_content: { kind: "legacy", content: null }, patch: { document: { type: "doc", content: [{ type: "paragraph" }] } } } };
    seams.services.mockResolvedValue({ gateway: { readIdentity: async () => ({ ...identity, entitlements: { capturar: false } }) } });
    expect((await POST(writeRequest(value))).status).toBe(403); expect(seams.gateway).not.toHaveBeenCalled(); expect(commit).not.toHaveBeenCalled();
    seams.services.mockResolvedValue({ gateway: { readIdentity: async () => ({ ...identity, userId: session }) } });
    expect((await POST(writeRequest(value))).status).toBe(409); expect(seams.gateway).not.toHaveBeenCalled();
  });
  it("admite até768KiB apenas na variante documental, inclusive escaping, e mantém256KiB nos demais", async () => {
    const now = "2026-10-21T12:00:00.000Z", captureId = "10000000-0000-4000-8000-000000000003";
    const legacy = { ...input, type: "note" as const, id: captureId, user_id: actor, content: "\u0001".repeat(30000), status: "inbox" as const, converted_task_id: null, captured_at: now, organized_at: null, archived_at: null, deleted_at: null, created_at: now, updated_at: now };
    const gateway: CaptureTaskGateway = { actorId: actor, snapshot: async () => ({ revision: "0", captures: [legacy], tasks: [], categories: [], projects: [], events: [], receipts: [] }), currentRevision: async () => "0", receipt: async () => null, commit };
    seams.gateway.mockReturnValue(gateway);
    const document = { type: "doc", content: [{ type: "paragraph", content: Array.from({ length: 126 }, () => ({ type: "text", text: "x", marks: [{ type: "link", attrs: { href: "https://example.invalid/" + "\\".repeat(2000) } }] })) }] };
    const value = { command: "capture.update", input: { id: captureId, client_id: "large-doc", expected_content: { kind: "legacy", content: legacy.content }, patch: { document } } };
    const serialized = JSON.stringify(value), size = Buffer.byteLength(serialized);
    expect(size).toBeGreaterThan(256 * 1024); expect(size).toBeLessThan(768 * 1024);
    const raw = (body: string) => new Request(origin + "/api/capture-tasks", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json", "X-Expected-User-ID": actor }, body });
    const response = await POST(raw(serialized + " ".repeat(768 * 1024 - size)));
    expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ result: { document, document_version: 1, content: "x".repeat(126) } });
    expect(commit).toHaveBeenCalledTimes(1);
    seams.gateway.mockClear(); commit.mockClear();
    expect((await POST(raw(serialized + " ".repeat(768 * 1024 - size + 1)))).status).toBe(400);
    const ordinary = JSON.stringify({ command: "capture.create", input });
    expect((await POST(raw(ordinary + " ".repeat(256 * 1024 - Buffer.byteLength(ordinary) + 1)))).status).toBe(400);
    expect((await POST(writeRequest({ ...value, input: { ...value.input, patch: { document, content: "fake-discriminator" } } }))).status).toBe(400);
    expect(seams.gateway).not.toHaveBeenCalled(); expect(commit).not.toHaveBeenCalled();
  });
  it("unauthenticated reads never instantiate a privileged gateway", async () => {
    seams.services.mockResolvedValue({ gateway: { readIdentity: async () => null } });
    const response = await GET(readRequest());
    expect(response.status).toBe(401); expect(seams.gateway).not.toHaveBeenCalled();
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("read DTO excludes the other module, events, receipts and vetoed project content", async () => {
    const response = await GET(readRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ items: [], categories: [], projects: [] });
    expect(seams.gateway).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ userId: actor, sessionId: session }), "read.captures");
  });
  it("entitlement veto refuses a read before database transport", async () => {
    seams.services.mockResolvedValue({ gateway: { readIdentity: async () => ({ ...identity, entitlements: { capturar: false } }) } });
    expect((await GET(readRequest())).status).toBe(403);
    expect(seams.gateway).not.toHaveBeenCalled();
  });
  it("foreign-origin mutations are refused before authentication/database", async () => {
    expect((await POST(writeRequest({ command: "capture.create", input }, "https://foreign.example.invalid"))).status).toBe(403);
    expect(seams.services).not.toHaveBeenCalled(); expect(commit).not.toHaveBeenCalled();
  });
  it("public owner injection cannot reach the privileged write", async () => {
    const response = await POST(writeRequest({ command: "capture.create", input: { ...input, user_id: session } }));
    expect(response.status).toBe(400); expect(commit).not.toHaveBeenCalled(); expect(seams.gateway).not.toHaveBeenCalled();
  });
  it("domain writes use the authenticated actor, server IDs and web channel", async () => {
    const response = await POST(writeRequest({ command: "capture.create", input }));
    expect(response.status).toBe(200);
    const value = await response.json();
    expect(value.result).toMatchObject({ user_id: actor, client_id: "stable", title: "Nota" });
    expect(value.result.id).toMatch(/^[a-f0-9-]{36}$/);
    expect(commit).toHaveBeenCalledWith(expect.objectContaining({ context: { user_id: actor, canal: "web" }, events: [expect.objectContaining({ entity_type: "capture", canal: "web", user_id: actor })] }));
  });
  it("a status transition requires a status before database access", async () => {
    const response = await POST(writeRequest({ command: "task.status", input: { id: actor, client_id: "status" } }));
    expect(response.status).toBe(400); expect(commit).not.toHaveBeenCalled(); expect(seams.gateway).not.toHaveBeenCalled();
  });
  it("a stale page cannot save into a different authenticated account", async () => {
    seams.services.mockResolvedValue({ gateway: { readIdentity: async () => ({ ...identity, userId: session }) } });
    const response = await POST(writeRequest({ command: "capture.create", input }));
    expect(response.status).toBe(409); expect(await response.json()).toMatchObject({ code: "SESSION_CHANGED" });
    expect(seams.gateway).not.toHaveBeenCalled(); expect(commit).not.toHaveBeenCalled();
  });
  it("reads also refuse data from a different current account", async () => {
    expect((await GET(readRequest(session))).status).toBe(409);
    expect(seams.gateway).not.toHaveBeenCalled();
  });
  it("the account precondition must be present before a write", async () => {
    expect((await POST(writeRequest({ command: "capture.create", input }, origin, ""))).status).toBe(400);
    expect(seams.gateway).not.toHaveBeenCalled(); expect(commit).not.toHaveBeenCalled();
  });
  it("conversion also requires Task access", async () => {
    seams.services.mockResolvedValue({ gateway: { readIdentity: async () => ({ ...identity, entitlements: { tarefas: false } }) } });
    const response = await POST(writeRequest({ command: "capture.convert", input: { capture_id: actor, client_id: "convert" } }));
    expect(response.status).toBe(403); expect(commit).not.toHaveBeenCalled();
  });
  it("a lost confirmation has an explicit retryable outcome without provider leakage", async () => {
    commit.mockRejectedValue(new CommitOutcomeUnknown());
    const response = await POST(writeRequest({ command: "capture.create", input }));
    expect(response.status).toBe(503); expect(await response.json()).toMatchObject({ ok: false, code: "COMMIT_UNKNOWN" });
  });
  it("bounded request reading refuses oversized payload before staging", async () => {
    const response = await POST(writeRequest({ command: "capture.create", input: { ...input, content: "x".repeat(256 * 1024) } }));
    expect(response.status).toBe(400); expect(commit).not.toHaveBeenCalled();
  });
  it("unexpected transport errors are not serialized into HTTP responses", async () => {
    seams.gateway.mockImplementation(() => { throw new Error("SQL secret-key-and-token-canary"); });
    const response = await GET(readRequest());
    expect(response.status).toBe(503); expect(await response.text()).not.toContain("canary");
  });
});
