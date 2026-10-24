import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { assinatura } from "../../src/core/contracts/base";
import type { GoalCommand } from "../../src/core/financeiro/goals/goal-types";
import { captureGoalTerminalBrowserAttempt, goalTerminalBrowserIntent, inspectGoalTerminalProof, receiveGoalTerminalBrowserOutcome, type GoalTerminalDigest } from "../../src/lib/finance-goals-terminal-browser";
import { FinanceGoalsBrowserClient } from "../../src/lib/finance-goals-client";
import { FinanceGoalsJournal, type GoalsJournalEnvironment } from "../../src/lib/finance-goals-journal";
import { GOAL_TERMINAL_HTTP_PATHS } from "../../src/lib/finance-goals-terminal-contract";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`, owner = id(1), epoch = id(2);
const command = (): Extract<GoalCommand, { command: "finance.goal.create" }> => ({ command: "finance.goal.create", input: { client_id: id(3), expected_finance_revision: "0", name: "Synthetic terminal goal", target_cents: 10000, deadline: null, image_file_id: null } });
const digest: GoalTerminalDigest = async (_, bytes) => Uint8Array.from(createHash("sha256").update(new Uint8Array(bytes)).digest()).buffer;
function binding(intent: GoalCommand) { return { version: 2, user_id: owner, command: intent.command, client_id: intent.input.client_id, canonicalization_version: 1, input_digest: createHash("sha256").update(assinatura(intent.input), "utf8").digest("hex") }; }
function closed(intent: GoalCommand) { const bound = binding(intent); return { version: 2, kind: "closed", binding: bound, disposition: { ...bound, id: id(4), closed_at: "2026-10-23T12:00:00.000Z" } }; }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(yes => { resolve = yes; }); return { promise, resolve }; }
afterEach(() => vi.useRealTimers());
async function harness(cryptoPort: GoalTerminalDigest = digest) {
  const values = new Map<string, string>(), calls: { path: string; body: GoalCommand; phase: string | null }[] = []; let sequence = 100, current = true;
  const env: GoalsJournalEnvironment = { uuid: () => id(++sequence), storage: { keys: () => [...values.keys()], getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); }, removeItem: key => { values.delete(key); } }, exclusive: async (_, work) => work() };
  const journal = new FinanceGoalsJournal(owner, env); await journal.open(); await journal.exclusive(async lease => { lease.stage(command()); });
  let respond: (intent: GoalCommand) => Promise<Response> = async intent => Response.json({ ok: true, result: closed(intent) });
  const client = new FinanceGoalsBrowserClient(owner, journal, { terminalDigest: cryptoPort, timeoutMs: 500, isCurrent: () => current, origin: "https://synthetic.invalid", fetcher: async (path, init) => { const body = JSON.parse(String(init.body)) as GoalCommand; calls.push({ path, body, phase: journal.snapshot().pending?.phase ?? null }); return respond(body); } });
  await client.loadPending();
  return { client, journal, calls, values, env, respond: (fn: typeof respond) => { respond = fn; }, revoke: () => { current = false; } };
}
describe("terminal browser — public fake transport, not a SQL/hosted proof", () => {
  it("captures original bytes before digest, clones RPC data and never adopts aliases", async () => {
    const input = command(), wait = deferred<ArrayBuffer>(), controller = new AbortController();
    const pending = captureGoalTerminalBrowserAttempt(owner, epoch, input, controller.signal, () => undefined, () => wait.promise);
    input.input.client_id = id(99); input.input.name = "Mutated";
    wait.resolve(Uint8Array.from(createHash("sha256").update(assinatura(command().input)).digest()).buffer);
    const capture = await pending, copy = goalTerminalBrowserIntent(capture); copy.input.client_id = id(98);
    expect(goalTerminalBrowserIntent(capture)).toEqual(command()); expect(capture.binding).toEqual(binding(command()));
    const outcome = await receiveGoalTerminalBrowserOutcome(capture, async () => ({ ok: true, result: closed(command()) }), controller.signal, () => undefined);
    if (!outcome.proof) throw Error("Expected proof"); expect(inspectGoalTerminalProof(outcome.proof, owner, epoch, command())).toEqual(closed(command()));
    expect(() => inspectGoalTerminalProof({ kind: "goal-terminal-positive" }, owner, epoch, command())).toThrow();
  });
  it("does not dispatch after epoch change during a delayed digest", async () => {
    const input = command(), wait = deferred<ArrayBuffer>(), abort = new AbortController(); let active = true, sends = 0;
    const guard = () => { if (!active) throw Error("epoch changed"); };
    const capture = captureGoalTerminalBrowserAttempt(owner, epoch, input, abort.signal, guard, () => wait.promise);
    await Promise.resolve(); active = false; wait.resolve(new ArrayBuffer(32));
    await expect(capture.then(value => receiveGoalTerminalBrowserOutcome(value, async () => { sends++; return {}; }, abort.signal, guard))).rejects.toThrow(); expect(sends).toBe(0);
  });
  it("rejects digest errors, wrong output and mutated input bytes without a fallback", async () => {
    const abort = new AbortController();
    const cases: GoalTerminalDigest[] = [async () => { throw Error("crypto unavailable"); }, async () => new ArrayBuffer(31), async (_, bytes) => { new Uint8Array(bytes)[0] = 0; return new ArrayBuffer(32); }];
    for (const port of cases) await expect(captureGoalTerminalBrowserAttempt(owner, epoch, command(), abort.signal, () => undefined, port)).rejects.toThrow();
  });
  it("abort before digest and a timed-out digest never reach HTTP, even after late completion", async () => {
    const abort = new AbortController(); abort.abort(); let digests = 0;
    await expect(captureGoalTerminalBrowserAttempt(owner, epoch, command(), abort.signal, () => undefined, async () => { digests++; return new ArrayBuffer(32); })).rejects.toThrow(); expect(digests).toBe(0);
    vi.useFakeTimers(); const wait = deferred<ArrayBuffer>(), h = await harness(() => wait.promise), pending = h.client.terminal.settle(command());
    await vi.advanceTimersByTimeAsync(501); expect(await pending).toMatchObject({ ok: false, code: "uncertain" });
    wait.resolve(new ArrayBuffer(32)); await Promise.resolve(); await Promise.resolve(); expect(h.calls).toHaveLength(0); expect(h.journal.snapshot().pending?.intent).toEqual(command());
  });
  it("wire accessors are refused without invoking them or issuing a proof", async () => {
    const abort = new AbortController(), capture = await captureGoalTerminalBrowserAttempt(owner, epoch, command(), abort.signal, () => undefined, digest); let reads = 0;
    await expect(receiveGoalTerminalBrowserOutcome(capture, async () => ({ ok: true, get result() { reads++; return closed(command()); } }), abort.signal, () => undefined)).rejects.toThrow(); expect(reads).toBe(0);
  });
  it("settle marks durable uncertainty before one request, works without availability, and never executes a financial command", async () => {
    const h = await harness(), reply = await h.client.terminal.settle(command());
    expect(reply).toMatchObject({ ok: true, result: { reply: { kind: "closed" } } });
    expect(h.calls).toEqual([{ path: GOAL_TERMINAL_HTTP_PATHS.settle, body: command(), phase: "uncertain" }]);
    expect(h.journal.snapshot()).toMatchObject({ pending: null, reconfirmRequired: true });
    await expect(h.journal.exclusive(async lease => { lease.stage(command()); })).rejects.toMatchObject({ code: "RECONFIRM" });
  });
  it("uncertain status preserves staged body; status never falls back to settle or execute", async () => {
    const h = await harness(); h.respond(async intent => Response.json({ ok: true, result: { version: 2, kind: "uncertain", binding: binding(intent) } }));
    expect(await h.client.terminal.status(command())).toMatchObject({ ok: true, result: { reply: { kind: "uncertain" }, proof: null } });
    expect(h.journal.snapshot().pending).toEqual({ intent: command(), phase: "staged" }); expect(h.calls.map(row => row.path)).toEqual([GOAL_TERMINAL_HTTP_PATHS.status]);
  });
  it("a failed durable uncertain write prevents the settle POST", async () => {
    const h = await harness(); h.env.storage.setItem = () => { throw Error("Synthetic quota"); };
    expect(await h.client.terminal.settle(command())).toMatchObject({ ok: false, code: "uncertain" }); expect(h.calls).toHaveLength(0); expect(h.journal.snapshot().pending).toEqual({ intent: command(), phase: "staged" });
  });
  it("rejects mismatched bindings, extra/V1 envelopes, invalid result and unknown versions without removing pending", async () => {
    const h = await harness(), original = closed(command());
    const invalid: unknown[] = [
      { ok: true, binding: { version: 1 }, result: original }, { ok: true, result: { ...original, version: 1 } },
      ...["user_id", "command", "client_id", "canonicalization_version", "input_digest"].map(field => ({ ok: true, result: { ...original, binding: { ...original.binding, [field]: "wrong" } } })),
      { ok: true, result: { version: 2, kind: "confirmed", binding: binding(command()), result: { version: 1 } } },
    ];
    for (const body of invalid) { h.respond(async () => Response.json(body)); expect(await h.client.terminal.status(command())).toMatchObject({ ok: false, code: "uncertain" }); expect(h.journal.snapshot().pending?.intent).toEqual(command()); }
  });
  it("rejects raw duplicate and escaped-equivalent keys before trusting the parsed response", async () => {
    const h = await harness();
    for (const raw of ['{"ok":true,"ok":false,"result":{}}', '{"ok":true,"result":{},"resu\\u006ct":{}}', '{"ok":true,"result":', "["]) {
      h.respond(async () => new Response(raw, { headers: { "Content-Type": "application/json" } }));
      expect(await h.client.terminal.status(command())).toMatchObject({ ok: false, code: "uncertain" }); expect(h.journal.snapshot().pending?.intent).toEqual(command());
    }
  });
  it("timeout, unfinished body and late callbacks never clean up or emit another request", async () => {
    vi.useFakeTimers(); const h = await harness(); let cancellations = 0;
    h.respond(async () => new Response(new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new TextEncoder().encode('{"ok":true,')); }, cancel() { cancellations++; } }), { headers: { "Content-Type": "application/json" } }));
    const pending = h.client.terminal.settle(command()); await vi.advanceTimersByTimeAsync(501);
    expect(await pending).toMatchObject({ ok: false, code: "uncertain" }); expect(cancellations).toBeGreaterThan(0); expect(h.calls).toHaveLength(1); expect(h.journal.snapshot().pending).toEqual({ intent: command(), phase: "uncertain" });
  });
  it("dispose or owner change while waiting prevents late positive cleanup", async () => {
    const h = await harness(), wait = deferred<Response>(); h.respond(() => wait.promise);
    const pending = h.client.terminal.settle(command()); await Promise.resolve(); await Promise.resolve(); h.client.dispose(); h.revoke(); wait.resolve(Response.json({ ok: true, result: closed(command()) }));
    expect(await pending).toMatchObject({ ok: false, code: "session-changed" }); expect(h.values.size).toBeGreaterThan(0);
    expect(h.journal.snapshot().pending?.intent).toEqual(command());
  });
  it("body beyond quota, malformed UTF8, unexpected path and closed HTTP failures preserve the original", async () => {
    const h = await harness();
    const foreign = Response.json({ ok: true, result: closed(command()) }); Object.defineProperty(foreign, "url", { value: "https://foreign.invalid/api/finance/goals/attempt/status" });
    const redirected = Response.json({ ok: true, result: closed(command()) }); Object.defineProperty(redirected, "redirected", { value: true });
    const responses = [foreign, redirected, new Response("x".repeat(1024 * 1024 + 1), { headers: { "Content-Type": "application/json" } }), new Response(new Uint8Array([0xff]), { headers: { "Content-Type": "application/json" } }), Response.json({ ok: false, code: "forbidden", message: "REMOTE_CANARY" }, { status: 403 }), Response.json({ ok: false, code: "unavailable", message: "REMOTE_CANARY" }, { status: 503 })];
    for (const response of responses) { h.respond(async () => response); const result = await h.client.terminal.status(command()); expect(result).toMatchObject({ ok: false, code: "uncertain" }); expect(JSON.stringify(result)).not.toContain("REMOTE_CANARY"); expect(h.journal.snapshot().pending?.intent).toEqual(command()); }
  });
});
