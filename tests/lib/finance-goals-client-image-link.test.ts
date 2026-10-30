import { afterEach, describe, expect, it, vi } from "vitest";
import type { FinancialGoal, GoalCommand } from "../../src/core/financeiro/goals/goal-types";
import { consumeGoalImageLinkedProof, FinanceGoalsBrowserClient, inspectGoalImageLinkedProof } from "../../src/lib/finance-goals-client";
import { FinanceGoalsJournal, type GoalsJournalEnvironment } from "../../src/lib/finance-goals-journal";
import { GOAL_HTTP_PATHS } from "../../src/lib/finance-goals-http-contract";
import { GOAL_TERMINAL_HTTP_PATHS } from "../../src/lib/finance-goals-terminal-contract";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`, owner = id(1), epoch = id(2), image = id(9);
const create = (): Extract<GoalCommand, { command: "finance.goal.create" }> => ({ command: "finance.goal.create", input: { client_id: id(3), expected_finance_revision: "0", name: "Synthetic image", target_cents: 10000, deadline: null, image_file_id: image } });
const update = (): Extract<GoalCommand, { command: "finance.goal.update" }> => ({ command: "finance.goal.update", input: { client_id: id(4), expected_finance_revision: "1", goal_id: id(5), expected_revision: "3", patch: { image_file_id: image } } });
function saved(intent: GoalCommand): FinancialGoal {
  if (intent.command !== "finance.goal.create" && intent.command !== "finance.goal.update") throw Error("Synthetic command");
  const fields = intent.command === "finance.goal.create" ? intent.input : intent.input.patch;
  return { version: 1, id: id(5), user_id: owner, name: fields.name ?? "Synthetic image", target_cents: fields.target_cents ?? 10000, deadline: fields.deadline ?? null,
    image_file_id: Object.hasOwn(fields, "image_file_id") ? fields.image_file_id ?? null : id(8), archived_at: null,
    revision: intent.command === "finance.goal.create" ? "0" : (BigInt(intent.input.expected_revision) + 1n).toString(), created_at: "2026-10-24T00:00:00Z", updated_at: "2026-10-24T00:00:00Z" };
}
function terminal(intent: GoalCommand, kind: "confirmed" | "closed" | "uncertain" = "confirmed") {
  const binding = { version: 2, user_id: owner, command: intent.command, client_id: intent.input.client_id, canonicalization_version: 1, input_digest: "aa".repeat(32) };
  return kind === "confirmed" ? { version: 2, kind, binding, result: { version: 1, goal: saved(intent) } } : kind === "closed" ? { version: 2, kind, binding, disposition: { ...binding, id: id(30), closed_at: "2026-10-24T00:00:00Z" } } : { version: 2, kind, binding };
}
async function harness() {
  const values = new Map<string, string>(), calls: { path: string; input: GoalCommand | null }[] = [], queues = new Map<string, Promise<void>>(); let current = true;
  const env: GoalsJournalEnvironment = { uuid: () => epoch, storage: { keys: () => [...values.keys()], getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); }, removeItem: key => { values.delete(key); } },
    exclusive: async (name, work) => { let release!: () => void; const prior = queues.get(name) ?? Promise.resolve(); queues.set(name, new Promise<void>(done => { release = done; })); await prior; try { return await work(); } finally { release(); } } };
  const journal = new FinanceGoalsJournal(owner, env); await journal.open();
  let respond = async (path: string, intent: GoalCommand | null): Promise<Response> => {
    if (path === GOAL_HTTP_PATHS.availability) return Response.json({ ok: true, result: { available: true } });
    if (!intent) throw Error("Missing synthetic intent");
    if (path === GOAL_TERMINAL_HTTP_PATHS.status || path === GOAL_TERMINAL_HTTP_PATHS.settle) return Response.json({ ok: true, result: terminal(intent) });
    return Response.json({ ok: true, binding: { version: 1, command: intent.command, client_id: intent.input.client_id }, result: { version: 1, goal: saved(intent) } });
  };
  const client = new FinanceGoalsBrowserClient(owner, journal, { origin: "https://synthetic.invalid", timeoutMs: 1000, isCurrent: () => current,
    terminalDigest: async () => new Uint8Array(32).fill(0xaa).buffer, fetcher: async (path, init) => { const intent = init.body ? JSON.parse(String(init.body)) as GoalCommand : null; calls.push({ path, input: structuredClone(intent) }); return respond(path, intent); } });
  await client.loadPending(); await client.availability();
  return { client, journal, values, env, calls, stale: () => { current = false; }, respond: (next: typeof respond) => { respond = next; } };
}
afterEach(() => vi.useRealTimers());
describe("Goal image linked receiver — real client with synthetic HTTP/Storage, no connected authority", () => {
  it.each(["create", "update"] as const)("issues one minimal nominal proof after exact %s, without storing money or an input", async kind => {
    const h = await harness(), intent = kind === "create" ? create() : update(); await h.client.stage(intent); expect((await h.client.execute(intent)).ok).toBe(true);
    const proof = h.client.imageUploadLinks.current(); if (!proof) throw Error("Expected private observation");
    const stored = [...h.values], count = h.calls.length, observed = inspectGoalImageLinkedProof(proof, h.client);
    expect(observed).toMatchObject({ ownerId: owner, epoch, command: intent.command, clientId: intent.input.client_id, goalId: id(5), imageFileId: image, goalRevision: kind === "create" ? "0" : "4" });
    expect(JSON.stringify(observed)).not.toMatch(/target_cents|name|canonical_input|fingerprint|10000/); expect(JSON.stringify(proof)).toBe("{}");
    expect(h.client.imageUploadLinks.current()).toBe(proof); expect(h.calls).toHaveLength(count);
    expect(consumeGoalImageLinkedProof(proof, h.client)).toEqual(observed); expect(h.client.imageUploadLinks.current()).toBeNull();
    expect(() => inspectGoalImageLinkedProof(proof, h.client)).toThrow(); expect(() => consumeGoalImageLinkedProof(proof, h.client)).toThrow(); expect([...h.values]).toEqual(stored);
  });
  it("captures the complete original before awaiting the journal, despite caller mutation", async () => {
    const h = await harness(), intent = update(), original = structuredClone(intent); await h.client.stage(intent);
    const pending = h.client.execute(intent); intent.input.client_id = id(99); intent.input.patch.image_file_id = id(98);
    expect((await pending).ok).toBe(true); const proof = h.client.imageUploadLinks.current(); if (!proof) throw Error("Expected proof");
    expect(inspectGoalImageLinkedProof(proof, h.client)).toMatchObject({ clientId: original.input.client_id, imageFileId: image }); expect(h.calls.at(-1)?.input).toEqual(original);
  });
  it.each(["omit", "null", "revision", "owner", "image"] as const)("never mints from %s or a non-exact successor/result", async mode => {
    const h = await harness(), intent = update(); if (mode === "omit") intent.input.patch = { name: "Synthetic changed" }; if (mode === "null") intent.input.patch.image_file_id = null;
    h.respond(async (_path, captured) => { if (!captured) throw Error("Missing intent"); const goal = saved(captured); if (mode === "revision") goal.revision = "8"; if (mode === "owner") goal.user_id = id(99); if (mode === "image") goal.image_file_id = id(99);
      return Response.json({ ok: true, binding: { version: 1, command: captured.command, client_id: captured.input.client_id }, result: { version: 1, goal } }); });
    await h.client.stage(intent); await h.client.execute(intent); expect(h.client.imageUploadLinks.current()).toBeNull();
  });
  it("does not accept a DTO, clone or proxy as proof, without invoking hooks", async () => {
    const h = await harness(); await h.client.stage(create()); await h.client.execute(create()); const proof = h.client.imageUploadLinks.current(); if (!proof) throw Error("Expected proof");
    let hooks = 0; const proxy = new Proxy({}, { get: () => { hooks++; return true; }, ownKeys: () => { hooks++; return []; }, getPrototypeOf: () => { hooks++; return null; } });
    for (const value of [structuredClone(proof), saved(create()), proxy]) expect(() => Reflect.apply(inspectGoalImageLinkedProof, undefined, [value, h.client])).toThrow();
    expect(hooks).toBe(0); const other = await harness(); expect(() => inspectGoalImageLinkedProof(proof, other.client)).toThrow(); expect(h.client.imageUploadLinks.current()).toBe(proof);
  });
  it("a partial financial acknowledgement produces no proof; only a new original terminal positive recovers it", async () => {
    const h = await harness(), intent = create(); await h.client.stage(intent); const remove = h.env.storage.removeItem;
    h.env.storage.removeItem = key => { remove(key); if (key.includes(":pending:")) throw Error("Synthetic partial clear"); };
    expect((await h.client.execute(intent)).ok).toBe(false); expect(h.client.imageUploadLinks.current()).toBeNull(); h.env.storage.removeItem = remove;
    expect((await h.client.terminal.status(intent)).ok).toBe(true); const proof = h.client.imageUploadLinks.current(); if (!proof) throw Error("Expected new original positive"); consumeGoalImageLinkedProof(proof, h.client);
    expect(h.client.imageUploadLinks.current()).toBeNull(); expect((await h.client.terminal.status(intent)).ok).toBe(true);
    expect(h.client.imageUploadLinks.current()).not.toBe(proof);
  });
  it("reconcile and flag-off terminal recovery can issue fresh positives; closed/uncertain never do", async () => {
    const h = await harness(), intent = create(); await h.client.stage(intent); await h.journal.exclusive(async lease => { lease.uncertain(intent); });
    expect((await h.client.reconcile(intent)).ok).toBe(true); expect(h.client.imageUploadLinks.current()).not.toBeNull();
    for (const kind of ["closed", "uncertain"] as const) {
      h.respond(async () => Response.json({ ok: true, result: terminal(intent, kind) })); await h.client.terminal.status(intent); expect(h.client.imageUploadLinks.current()).toBeNull();
    }
    h.respond(async path => path === GOAL_HTTP_PATHS.availability ? Response.json({ ok: true, result: { available: false } }) : Response.json({ ok: true, result: terminal(intent) }));
    await h.client.availability(); expect((await h.client.terminal.status(intent)).ok).toBe(true); expect(h.client.imageUploadLinks.current()).not.toBeNull();
  });
  it("preview-confirmed or detail are not issuers, and dispose/owner change revoke existing proof", async () => {
    const h = await harness(), intent = create();
    h.respond(async () => Response.json({ ok: true, binding: { version: 1, command: intent.command, client_id: intent.input.client_id }, result: { kind: "confirmed", intent, result: { version: 1, goal: saved(intent) } } }));
    expect((await h.client.prepare(intent)).ok).toBe(true); expect(h.client.imageUploadLinks.current()).toBeNull();
    h.respond(async () => Response.json({ ok: true, result: terminal(intent) })); await h.client.terminal.status(intent); const proof = h.client.imageUploadLinks.current(); if (!proof) throw Error("Expected proof");
    h.stale(); expect(() => inspectGoalImageLinkedProof(proof, h.client)).toThrow(); h.client.dispose(); expect(() => h.client.imageUploadLinks.current()).toThrow();
  });
  it("a late success after timeout cannot mint a link proof or dispatch another request", async () => {
    vi.useFakeTimers(); const h = await harness(), intent = create(); await h.client.stage(intent); let release!: () => void, enter!: () => void;
    const delayed = new Promise<void>(done => { release = done; }), entered = new Promise<void>(done => { enter = done; });
    h.respond(async () => { enter(); await delayed; return Response.json({ ok: true, binding: { version: 1, command: intent.command, client_id: intent.input.client_id }, result: { version: 1, goal: saved(intent) } }); });
    const pending = h.client.execute(intent); await entered; await vi.advanceTimersByTimeAsync(1001); expect((await pending).ok).toBe(false);
    const count = h.calls.length; release(); await Promise.resolve(); expect(h.client.imageUploadLinks.current()).toBeNull(); expect(h.calls).toHaveLength(count); expect(h.journal.snapshot().pending?.phase).toBe("uncertain");
  });
});
