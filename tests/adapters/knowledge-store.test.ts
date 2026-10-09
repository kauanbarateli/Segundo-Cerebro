import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { executarConhecimento, type SnapshotConhecimento } from "../../src/core/conhecimento";
import { createKnowledgeStore, KnowledgeCommitUnknown, type KnowledgeGateway } from "../../src/adapters/db/knowledge-store";
import { decodeKnowledgeCommand } from "../../src/adapters/db/knowledge-commands";
import { createKnowledgeGateway } from "../../src/adapters/db/knowledge-gateway";
const actor = "10000000-0000-4000-8000-000000000001", session = "10000000-0000-4000-8000-000000000002", notebook = "10000000-0000-4000-8000-000000000003", now = "2026-10-09T14:00:00Z";
const empty = (): SnapshotConhecimento => ({ revision: "0", notebooks: [], pages: [], refs: [], links: [], targets: [], captures: [], receipts: [] });
const deps = { clock: { now: () => now }, ids: { next: () => notebook } };
const request = { command: "knowledge.notebook.create" as const, input: { client_id: "stable", name: "Caderno" } };
describe("Knowledge persistence staging", () => {
  it("confirma data, evento e recibo juntos; resposta perdida reconcilia", async () => {
    let receipt: Parameters<KnowledgeGateway["commit"]>[0]["receipt"] | null = null;
    const commit = vi.fn<KnowledgeGateway["commit"]>(async value => { expect(value.changes).toHaveLength(1); expect(value.events).toHaveLength(1); expect(value.events[0]?.entity_type).toBe("knowledge_notebook"); receipt = value.receipt; throw new KnowledgeCommitUnknown(); });
    const gateway: KnowledgeGateway = { actorId: actor, snapshot: async () => empty(), commit, receipt: async () => receipt };
    const result = await executarConhecimento(createKnowledgeStore(gateway), deps, { user_id: actor, canal: "web" }, request);
    expect(result).toMatchObject({ id: notebook, name: "Caderno" }); expect(commit).toHaveBeenCalledTimes(1);
  });
  it("CAS stale repete no Núcleo e não confirma a tentativa anterior", async () => {
    let attempt = 0;
    const gateway: KnowledgeGateway = { actorId: actor, snapshot: async () => empty(), receipt: async () => null, commit: async value => ++attempt === 1 ? { status: "stale" } : { status: "committed", result: value.receipt.result } };
    expect(await executarConhecimento(createKnowledgeStore(gateway), deps, { user_id: actor, canal: "web" }, request)).toMatchObject({ name: "Caderno" }); expect(attempt).toBe(2);
  });
  it("owner diferente é recusado antes de executar o comando", async () => {
    const gateway: KnowledgeGateway = { actorId: actor, snapshot: async () => ({ ...empty(), notebooks: [{ id: notebook, user_id: session } as never] }), receipt: async () => null, commit: vi.fn() };
    await expect(createKnowledgeStore(gateway).snapshot()).rejects.toThrow("usuário"); expect(gateway.commit).not.toHaveBeenCalled();
  });
  it("campo owner/context/batch não passa no protocolo público", () => {
    expect(() => decodeKnowledgeCommand({ ...request, input: { ...request.input, user_id: session } })).toThrow("Campos");
    expect(() => decodeKnowledgeCommand({ ...request, context: { user_id: session } })).toThrow("Comando");
  });
  it("gateway manda ator/sessão vinculados e revalida acesso em todas chamadas", async () => {
    const rpc = vi.fn(async (_name: string, args: unknown) => { expect(args).toMatchObject({ p_user: actor, p_session: session, p_operation: "read.knowledge" }); return { data: empty(), error: null }; });
    const gateway = createKnowledgeGateway(actor, session, "read.knowledge", rpc); await gateway.snapshot(); expect(rpc).toHaveBeenCalledTimes(1);
    rpc.mockResolvedValueOnce({ data: null as never, error: { code: "42501" } as never }); await expect(gateway.snapshot()).rejects.toMatchObject({ code: "forbidden" });
  });
});
