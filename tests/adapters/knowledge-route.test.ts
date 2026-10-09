import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const seams = vi.hoisted(() => ({ config: vi.fn(), services: vi.fn(), gateway: vi.fn() }));
vi.mock("../../src/lib/auth/config", () => ({ readAuthConfiguration: seams.config }));
vi.mock("../../src/lib/auth/runtime", () => ({ requestAuthServices: seams.services }));
vi.mock("../../src/adapters/db/knowledge-runtime", () => ({ knowledgeGatewayForRequest: seams.gateway }));
import { GET, POST } from "../../src/app/api/knowledge/route";
const actor = "10000000-0000-4000-8000-000000000001", session = "10000000-0000-4000-8000-000000000002", origin = "http://127.0.0.1:3000";
const identity = { userId: actor, sessionId: session, mustChangePassword: false, role: "user", entitlements: {} };
const command = { command: "knowledge.notebook.create", input: { name: "Caderno", client_id: "stable" } };
const write = (value: unknown, requestOrigin = origin) => new Request(origin + "/api/knowledge", { method: "POST", headers: { Origin: requestOrigin, "Content-Type": "application/json", "X-Expected-User-ID": actor }, body: JSON.stringify(value) });
const read = () => new Request(origin + "/api/knowledge", { headers: { "X-Expected-User-ID": actor } });
const commit = vi.fn();
beforeEach(() => {
  vi.resetAllMocks(); seams.config.mockReturnValue({ mode: "supabase", appOrigin: origin }); seams.services.mockResolvedValue({ gateway: { readIdentity: async () => identity } });
  commit.mockImplementation(async value => ({ status: "committed", result: value.receipt.result }));
  seams.gateway.mockReturnValue({ actorId: actor, snapshot: async () => ({ revision: "0", notebooks: [], pages: [], refs: [], links: [], targets: [], captures: [], receipts: [{ user_id: actor, command: "knowledge.notebook.create", client_id: "private-receipt", fingerprint: "private", result: "secret" }] }), commit, receipt: async () => null });
});
describe("Conhecimento HTTP", () => {
  it("recusa visitante sem instanciar cliente privilegiado", async () => { seams.services.mockResolvedValue({ gateway: { readIdentity: async () => null } }); const reply = await GET(read()); expect(reply.status).toBe(401); expect(seams.gateway).not.toHaveBeenCalled(); expect(reply.headers.get("cache-control")).toContain("no-store"); });
  it("veto e troca obrigatória impedem consulta ao adapter", async () => { seams.services.mockResolvedValue({ gateway: { readIdentity: async () => ({ ...identity, entitlements: { conhecimento: false } }) } }); expect((await GET(read())).status).toBe(403); expect(seams.gateway).not.toHaveBeenCalled(); });
  it("DTO público não contém recibos nem capturas privadas", async () => { const reply = await GET(read()); expect(reply.status).toBe(200); expect(await reply.json()).toEqual({ revision: "0", notebooks: [], pages: [], refs: [], links: [], targets: [] }); });
  it("origem estrangeira é recusada antes de autenticar e ler body", async () => { expect((await POST(write(command, "https://other.invalid"))).status).toBe(403); expect(seams.services).not.toHaveBeenCalled(); });
  it("owner injetado é recusado; comando válido usa contexto do servidor", async () => { expect((await POST(write({ ...command, input: { ...command.input, user_id: session } }))).status).toBe(400); expect(commit).not.toHaveBeenCalled(); const reply = await POST(write(command)); expect(reply.status).toBe(200); expect(commit).toHaveBeenCalledWith(expect.objectContaining({ context: { user_id: actor, canal: "web" }, events: [expect.objectContaining({ entity_type: "knowledge_notebook", user_id: actor })] })); });
  it("promoção exige Capturar além de Conhecimento", async () => { seams.services.mockResolvedValue({ gateway: { readIdentity: async () => ({ ...identity, entitlements: { capturar: false } }) } }); expect((await POST(write({ command: "knowledge.page.promote-capture", input: { capture_id: actor, notebook_id: session, client_id: "promote" } }))).status).toBe(403); expect(seams.gateway).not.toHaveBeenCalled(); });
  it("troca de conta e limite do body não chegam ao commit", async () => { seams.services.mockResolvedValueOnce({ gateway: { readIdentity: async () => ({ ...identity, userId: session }) } }); expect((await POST(write(command))).status).toBe(409); expect((await POST(write({ command: "knowledge.notebook.create", input: { name: "x".repeat(610 * 1024), client_id: "too-big" } }))).status).toBe(400); expect(commit).not.toHaveBeenCalled(); });
  it("erro privado não é serializado para o navegador", async () => { seams.gateway.mockImplementation(() => { throw new Error("token-SQL-canary"); }); const reply = await GET(read()); expect(reply.status).toBe(503); expect(await reply.text()).not.toContain("canary"); });
});
