import { describe, expect, it } from "vitest";
import { criarAdapterMemoria } from "../../src/adapters/memory";
import { criarCaptura } from "../../src/core/capturas";
import { adapterContract, type ContractFactory, type ContractSeed } from "./adapter-contract";

const factory: ContractFactory = async (initial) => {
  let sequence = 0;
  let now = "2026-10-07T12:00:00.000Z";
  let failure: "read" | "write" | "event" | "commit" | null = null;
  const deps = { clock: { now: () => now }, ids: { next: () => `generated-${++sequence}` } };
  const store = criarAdapterMemoria({ ...deps, initial, beforeOperation(point) { if (failure === point) { failure = null; throw new Error("Falha injetada"); } } });
  return { store, deps, failNext(point) { failure = point; }, setTime(iso) { now = iso; } };
};

adapterContract("Memória", factory);

describe("ciclo de vida do adapter em memória", () => {
  it("não compartilha estado entre instâncias", async () => {
    const first = await factory(); const second = await factory();
    await criarCaptura(first.store, first.deps, { user_id: "a", canal: "web" }, { client_id: "client", type: "note", title: "Contrato", content: null, category_id: null, project_id: null });
    expect(await second.store.read("a").capturas.list()).toEqual([]);
  });

  it("copia o estado inicial e rejeita colisão entre seus tipos", async () => {
    const initial: ContractSeed = { project: [{ id: "project", user_id: "a", name: "Original", description: null, color_key: "blue", position: 0, deleted_at: null, created_at: "2026-10-07T12:00:00Z", updated_at: "2026-10-07T12:00:00Z" }] };
    const h = await factory(initial); initial.project![0]!.name = "Mutação";
    expect((await h.store.read("a").projetos.get("project"))?.name).toBe("Original");
    initial.category = [{ id: "project", user_id: "a", name: "Colisão", normalized_name: "colisao", color_key: "blue", is_system: false, created_at: "2026-10-07T12:00:00Z", updated_at: "2026-10-07T12:00:00Z" }];
    await expect(factory(initial)).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
