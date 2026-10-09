import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const seams = vi.hoisted(() => ({ config: vi.fn(), services: vi.fn(), admin: vi.fn(), identity: vi.fn() }));
vi.mock("../../src/lib/auth/config", () => ({ readAuthConfiguration: seams.config }));
vi.mock("../../src/lib/auth/runtime", () => ({ requestAuthServices: seams.services }));
vi.mock("../../src/adapters/db/admin-runtime", () => ({ adminServicesForRequest: seams.admin }));
import { GET, POST } from "../../src/app/api/admin/route";
const actor = "10000000-0000-4000-8000-000000000001", session = "10000000-0000-4000-8000-000000000002", origin = "http://127.0.0.1:3000";
const identity = { userId: actor, sessionId: session, mustChangePassword: false, role: "master", entitlements: {} };
const request = { command: "admin.user.create", input: { client_id: "original", email: "p@example.invalid", temporary_password: "Temporary private 123" } };
const write = (value: unknown, headers: Record<string, string> = {}) => new Request(origin + "/api/admin", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json", "X-Expected-User-ID": actor, ...headers }, body: JSON.stringify(value) });
const read = () => new Request(origin + "/api/admin", { headers: { "X-Expected-User-ID": actor } });
const reserve = vi.fn(), master = vi.fn();
beforeEach(() => {
 vi.resetAllMocks(); seams.config.mockReturnValue({ mode: "supabase", appOrigin: origin }); seams.identity.mockResolvedValue(identity); seams.services.mockResolvedValue({ gateway: { readIdentity: seams.identity } });
 reserve.mockResolvedValue({ phase: "complete", operation_id: actor, target_user_id: session }); seams.admin.mockReturnValue({ port: { requireMaster: master, snapshot: async () => ({ users: [], audit: [], operations: [] }), reserve }, auth: {}, commitment: () => "a".repeat(64) });
});
describe("Admin private HTTP entry requires master first", () => {
 it.each(["GET", "POST"])("visitor %s cannot instantiate privileged runtime", async method => { seams.identity.mockResolvedValue(null); const reply = await (method === "GET" ? GET(read()) : POST(write(request))); expect(reply.status).toBe(401); expect(seams.admin).not.toHaveBeenCalled(); expect(reply.headers.get("cache-control")).toContain("no-store"); });
 it.each([{ role: "user" }, { mustChangePassword: true }, { entitlements: { admin: false } }])("role/veto/forced state denial %# happens before adapter or body", async patch => { seams.identity.mockResolvedValue({ ...identity, ...patch }); const req = write(request); const body = vi.spyOn(req.body!, "getReader"); expect((await POST(req)).status).toBe(403); expect(body).not.toHaveBeenCalled(); expect(seams.admin).not.toHaveBeenCalled(); });
 it("master is read before Origin check, body access or privileged construction", async () => { const req = write(request, { Origin: "https://foreign.invalid" }), body = vi.spyOn(req.body!, "getReader"); expect((await POST(req)).status).toBe(403); expect(seams.identity).toHaveBeenCalledTimes(1); expect(body).not.toHaveBeenCalled(); expect(seams.admin).not.toHaveBeenCalled(); });
 it("missing Origin and ExpectedUser are fail-closed", async () => { expect((await POST(write(request, { Origin: "" }))).status).toBe(403); expect((await POST(write(request, { "X-Expected-User-ID": session }))).status).toBe(409); expect((await GET(new Request(origin + "/api/admin"))).status).toBe(409); expect(reserve).not.toHaveBeenCalled(); });
 it("connected snapshot returns only the dedicated metadata DTO", async () => { const reply = await GET(read()); expect(reply.status).toBe(200); expect(await reply.json()).toEqual({ users: [], audit: [], operations: [] }); expect(seams.admin).toHaveBeenCalledWith(expect.anything(), identity); });
 it("checks current master again through SQL before reserving; credentials never enter reserve", async () => { const reply = await POST(write(request)); expect(reply.status).toBe(200); expect(master).toHaveBeenCalledTimes(1); expect(reserve).toHaveBeenCalledWith({ command: request.command, client_id: "original", commitment: "a".repeat(64) }); expect(JSON.stringify(reserve.mock.calls)).not.toContain(request.input.temporary_password); });
 it("cannot inject actor or initial master role through creation", async () => { expect((await POST(write({ ...request, input: { ...request.input, role: "master" } }))).status).toBe(400); expect((await POST(write({ ...request, actor_user_id: session }))).status).toBe(400); expect(reserve).not.toHaveBeenCalled(); });
 it("rejects content type and bounded-body abuse before reserve", async () => { expect((await POST(write(request, { "Content-Type": "text/plain" }))).status).toBe(400); expect((await POST(write({ ...request, input: { ...request.input, email: "x".repeat(70 * 1024) } }))).status).toBe(400); expect(reserve).not.toHaveBeenCalled(); });
 it("does not return raw SDK/Auth/SQL details, e-mail or password on failure", async () => { reserve.mockRejectedValue(new Error(request.input.temporary_password + " private SQL canary " + request.input.email)); const reply = await POST(write(request)), text = await reply.text(); expect(reply.status).toBe(503); expect(text).not.toContain("canary"); expect(text).not.toContain(request.input.temporary_password); expect(text).not.toContain(request.input.email); expect(text).toContain("permanece protegida"); });
});
