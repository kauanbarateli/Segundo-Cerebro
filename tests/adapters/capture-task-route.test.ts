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
