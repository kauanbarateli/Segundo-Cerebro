import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const seams = vi.hoisted(() => ({ config: vi.fn(), auth: vi.fn(), services: vi.fn(), reserve: vi.fn(), finalize: vi.fn(), avatar: vi.fn(), read: vi.fn(), cleanup: vi.fn() }));
vi.mock("../../src/lib/auth/config", () => ({ readAuthConfiguration: seams.config }));
vi.mock("../../src/lib/auth/runtime", () => ({ requestAuthServices: seams.auth }));
vi.mock("../../src/adapters/db/files-runtime", () => ({ filesServicesForRequest: seams.services, cleanupFiles: seams.cleanup }));
import { GET, POST } from "../../src/app/api/files/route";
import { POST as reserve } from "../../src/app/api/files/uploads/route";
import { GET as read } from "../../src/app/api/files/read/route";
import { GET as cleanupGet, POST as cleanup } from "../../src/app/api/files/cleanup/route";
const user = "10000000-0000-4000-8000-000000000001", id = "10000000-0000-4000-8000-000000000002", origin = "http://127.0.0.1:3000";
const identity = { userId: user, sessionId: id, mustChangePassword: false, role: "user", entitlements: {} };
const write = (body: unknown, from = origin) => new Request(origin + "/api/files", { method: "POST", headers: { Origin: from, "Content-Type": "application/json", "X-Expected-User-ID": user }, body: JSON.stringify(body) });
beforeEach(() => { vi.resetAllMocks(); seams.config.mockReturnValue({ mode: "supabase", appOrigin: origin }); seams.auth.mockResolvedValue({ gateway: { readIdentity: async () => identity } }); seams.reserve.mockResolvedValue({ id, upload_url: "ephemeral", token: "ephemeral", expires_at: "future" }); seams.read.mockResolvedValue({ url: "https://rishenjoikgmfubmnfiu.supabase.co/private?token=temporary" }); seams.services.mockReturnValue({ reserve: seams.reserve, finalize: seams.finalize, avatar: seams.avatar, signedRead: seams.read, gateway: () => ({ actorId: user, snapshot: async () => ({ revision: "0", folders: [], files: [], projects: [], receipts: [{ user_id: user, secret: "private" }], usage_bytes: 50, capacity_bytes: 100, max_file_bytes: 50 }) }) }); });
afterEach(() => { vi.unstubAllEnvs(); });
describe("Private files HTTP boundary", () => {
  it("visitor, veto, password change, stale user are denied before privileged adapter", async () => {
    for (const actor of [null, { ...identity, entitlements: { drive: false } }, { ...identity, mustChangePassword: true }, { ...identity, userId: id }]) {
      seams.auth.mockResolvedValueOnce({ gateway: { readIdentity: async () => actor } }); const reply = await GET(new Request(origin + "/api/files", { headers: { "X-Expected-User-ID": user } })); expect([401, 403, 409]).toContain(reply.status);
    } expect(seams.services).not.toHaveBeenCalled();
  });
  it("DTO excludes receipts and responses do not cache", async () => {
    const reply = await GET(new Request(origin + "/api/files", { headers: { "X-Expected-User-ID": user } })); expect(reply.status).toBe(200); expect(reply.headers.get("cache-control")).toContain("no-store"); expect(await reply.text()).not.toContain("private");
  });
  it("cross-origin writes and owner injection are denied", async () => {
    expect((await reserve(write({ kind: "drive", name: "A.txt", client_id: "a" }, "https://foreign.invalid"))).status).toBe(403); expect(seams.auth).not.toHaveBeenCalled();
    expect((await reserve(write({ kind: "drive", name: "A.txt", client_id: "a", user_id: id }))).status).toBe(400); expect(seams.reserve).not.toHaveBeenCalled();
  });
  it("each reserve uses its own Entitlement and image uploads cannot use folders", async () => {
    for (const [kind, feature] of [["drive", "drive"], ["capture_image", "capturar"], ["avatar", "configuracoes"]]) {
      seams.auth.mockResolvedValueOnce({ gateway: { readIdentity: async () => ({ ...identity, entitlements: { [feature!]: false } }) } }); expect((await reserve(write({ kind, name: "A.png", client_id: kind }))).status).toBe(403);
    } expect(seams.reserve).not.toHaveBeenCalled(); expect((await reserve(write({ kind: "avatar", name: "A.png", client_id: "x", folder_id: id }))).status).toBe(400);
  });
  it("finalize accepts only IDs; avatar remove rejects hidden file field", async () => {
    expect((await POST(write({ command: "file.upload.finalize", input: { upload_id: id, client_id: "x", bytes: 5 } }))).status).toBe(400); expect(seams.finalize).not.toHaveBeenCalled();
    expect((await POST(write({ command: "avatar.remove", input: { file_id: id, client_id: "x" } }))).status).toBe(400); expect(seams.avatar).not.toHaveBeenCalled();
  });
  it("read is guarded by httpOnly identity and returns short private redirect", async () => {
    const reply = await read(new Request(`${origin}/api/files/read?id=${id}&user=${user}&download=1`)); expect(reply.status).toBe(302); expect(reply.headers.get("cache-control")).toContain("no-store"); expect(seams.read).toHaveBeenCalledWith(id, true);
    expect((await read(new Request(`${origin}/api/files/read?id=${id}&user=${id}`))).status).toBe(409);
  });
  it("cron authentication precedes privileged configuration/cleanup", async () => {
    vi.stubEnv("CRON_SECRET", "a".repeat(40)); expect((await cleanup(new Request(origin + "/api/files/cleanup", { method: "POST" }))).status).toBe(403); expect(seams.config).not.toHaveBeenCalled(); expect(seams.cleanup).not.toHaveBeenCalled(); vi.unstubAllEnvs();
  });
});

describe("Files cleanup cron transport", () => {
  const secret = "x".repeat(40);
  function request(method = "GET", authorization: string | null = "Bearer " + secret) {
    return new Request(origin + "/api/files/cleanup", { method, headers: authorization === null ? {} : { Authorization: authorization } });
  }
  function privateResponse(response: Response) {
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("pragma")).toBe("no-cache");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  }
  it.each(["GET", "POST"])("%s shares the authorized cleanup handler", async method => {
    vi.stubEnv("CRON_SECRET", secret);
    seams.cleanup.mockResolvedValue({ removed: 2, failed: 0 });
    const response = await (method === "GET" ? cleanupGet : cleanup)(request(method));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ removed: 2, failed: 0 });
    expect(seams.cleanup).toHaveBeenCalledOnce();
    expect(seams.cleanup).toHaveBeenCalledWith({ mode: "supabase", appOrigin: origin });
    expect(seams.auth).not.toHaveBeenCalled();
    privateResponse(response);
  });
  it.each([
    ["GET", { removed: 2, failed: 1 }],
    ["GET", { removed: 0, failed: 3 }],
    ["POST", { removed: 2, failed: 1 }],
    ["POST", { removed: 0, failed: 3 }],
  ] as const)("%s signals partial or total cleanup failure without changing the counters %#", async (method, counters) => {
    vi.stubEnv("CRON_SECRET", secret);
    seams.cleanup.mockResolvedValue(counters);
    const response = await (method === "GET" ? cleanupGet : cleanup)(request(method));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual(counters);
    expect(seams.cleanup).toHaveBeenCalledOnce();
    privateResponse(response);
  });
  it.each([null, "Bearer wrong", "Bearer " + secret + "x"])("rejects missing or mismatched bearer before configuration %#", async authorization => {
    vi.stubEnv("CRON_SECRET", secret);
    const response = await cleanupGet(request("GET", authorization));
    expect(response.status).toBe(403);
    expect(seams.config).not.toHaveBeenCalled();
    expect(seams.cleanup).not.toHaveBeenCalled();
    privateResponse(response);
  });
  it.each([undefined, "", "x".repeat(31)])("fails closed for absent or short configured secret %#", async configured => {
    vi.stubEnv("CRON_SECRET", configured);
    const response = await cleanupGet(request());
    expect(response.status).toBe(503);
    expect(seams.config).not.toHaveBeenCalled();
    expect(seams.cleanup).not.toHaveBeenCalled();
    privateResponse(response);
  });
  it("rejects an otherwise matching header above 1024 characters before configuration", async () => {
    const oversized = "x".repeat(1018);
    vi.stubEnv("CRON_SECRET", oversized);
    const response = await cleanupGet(request("GET", "Bearer " + oversized));
    expect(response.status).toBe(403);
    expect(seams.config).not.toHaveBeenCalled();
    expect(seams.cleanup).not.toHaveBeenCalled();
  });
  it("accepts the exact 1024-character authorization boundary", async () => {
    const bounded = "x".repeat(1017);
    vi.stubEnv("CRON_SECRET", bounded);
    seams.cleanup.mockResolvedValue({ removed: 0, failed: 0 });
    const response = await cleanupGet(request("GET", "Bearer " + bounded));
    expect(response.status).toBe(200);
    expect(seams.cleanup).toHaveBeenCalledOnce();
  });
  it.each(["GET", "POST"])("%s keeps backend errors private without echoing provider details", async method => {
    vi.stubEnv("CRON_SECRET", secret);
    const canary = "provider-private-detail-canary";
    seams.cleanup.mockRejectedValue(new Error(canary));
    const response = await (method === "GET" ? cleanupGet : cleanup)(request(method));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, code: "UNAVAILABLE", message: "Não foi possível concluir o arquivo. Tente novamente." });
    privateResponse(response);
  });
  it("refuses demo configuration before invoking cleanup", async () => {
    vi.stubEnv("CRON_SECRET", secret);
    seams.config.mockReturnValue({ mode: "demo" });
    const response = await cleanupGet(request());
    expect(response.status).toBe(503);
    expect(seams.cleanup).not.toHaveBeenCalled();
  });
});
