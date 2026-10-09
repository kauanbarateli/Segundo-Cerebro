import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsRateLimitError } from "../../src/core/configuracoes";
vi.mock("server-only", () => ({}));
const seams = vi.hoisted(() => ({ config: vi.fn(), services: vi.fn(), port: vi.fn(), load: vi.fn(), commit: vi.fn() }));
vi.mock("../../src/lib/auth/config", () => ({ readAuthConfiguration: seams.config }));
vi.mock("../../src/lib/auth/runtime", () => ({ requestAuthServices: seams.services }));
vi.mock("../../src/adapters/db/settings-runtime", () => ({ settingsForRequest: seams.port }));
import { GET, POST } from "../../src/app/api/settings/route";
const id = "10000000-0000-4000-8000-000000000001", origin = "http://127.0.0.1:3000";
const actor = { userId: id, sessionId: id, mustChangePassword: false, entitlements: {} };
const command = { command: "settings.profile.update", input: { client_id: "stable-request", display_name: "Nome pessoal" } };
const request = (body: unknown = command, headers: Record<string, string> = {}) => new Request(origin + "/api/settings", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json", "X-Expected-User-ID": id, ...headers }, body: JSON.stringify(body) });
beforeEach(() => {
  vi.resetAllMocks(); seams.config.mockReturnValue({ mode: "supabase", appOrigin: origin });
  seams.services.mockResolvedValue({ gateway: { readIdentity: async () => actor } });
  seams.load.mockResolvedValue({ user_id: id }); seams.commit.mockResolvedValue({ user_id: id }); seams.port.mockReturnValue({ load: seams.load, commit: seams.commit });
});
describe("Configurações HTTP", () => {
  it("usa sessão verificada e passa identificador estável sem mudar payload", async () => {
    const response = await POST(request()); expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toContain("no-store");
    expect(seams.port).toHaveBeenCalledWith(expect.anything(), actor); expect(seams.commit).toHaveBeenCalledWith(command);
  });
  it.each([null, { ...actor, mustChangePassword: true }, { ...actor, entitlements: { configuracoes: false } }])("fecha sessão sem privilégio %j", async identity => {
    seams.services.mockResolvedValue({ gateway: { readIdentity: async () => identity } });
    expect([401, 403]).toContain((await POST(request())).status); expect(seams.port).not.toHaveBeenCalled();
  });
  it("recusa CSRF antes de ler Auth", async () => {
    expect((await POST(request(command, { Origin: "https://foreign.example.invalid" }))).status).toBe(403); expect(seams.services).not.toHaveBeenCalled();
  });
  it("recusa uma página de outra conta", async () => {
    expect((await POST(request(command, { "X-Expected-User-ID": "other" }))).status).toBe(409); expect(seams.port).not.toHaveBeenCalled();
  });
  it.each([{ ...command, input: { ...command.input, user_id: "other" } }, { ...command, input: { ...command.input, role: "master" } }, { command: "settings.preferences.update", input: { client_id: "stable-request", patch: { entitlement: true } } }])("não entrega elevação ou dono ao commit %j", async value => {
    expect((await POST(request(value))).status).toBe(400); expect(seams.commit).not.toHaveBeenCalled();
  });
  it("limita streaming a 16 KiB e requer JSON", async () => {
    expect((await POST(request({ ...command, input: { ...command.input, display_name: "a".repeat(17000) } }))).status).toBe(400);
    expect((await POST(request(command, { "Content-Type": "text/plain" }))).status).toBe(400); expect(seams.commit).not.toHaveBeenCalled();
  });
  it("traduz limite SQL sem uma segunda cobrança HTTP", async () => {
    seams.commit.mockRejectedValue(new SettingsRateLimitError()); const response = await POST(request());
    expect(response.status).toBe(429); expect(response.headers.get("retry-after")).toBe("60");
  });
  it("leitura privada não grava e não expõe diagnósticos", async () => {
    const read = () => GET(new Request(origin + "/api/settings", { headers: { "X-Expected-User-ID": id } }));
    expect((await read()).status).toBe(200); expect(seams.commit).not.toHaveBeenCalled();
    seams.load.mockRejectedValue(new Error("PRIVATE_SQL_CANARY")); const response = await read(); expect(response.status).toBe(503); expect(await response.text()).not.toContain("PRIVATE_SQL_CANARY");
  });
});
