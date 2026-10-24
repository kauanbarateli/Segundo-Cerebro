/** Local resource lifetime controls only; no React renderer, browser or SDK. */
import assert from "node:assert/strict";
import test from "node:test";
import { openGoalsHostLifetime } from "../../src/components/features/financeiro/goals/finance-goals-host-lifetime.ts";

const binding = () => ({ ownerId: "79f10000-0000-4000-8000-000000000001", providerEpoch: 1, mode: "connected", closing: false, sender: () => undefined, initialize: () => undefined, commandSnapshot: () => undefined, refresh: async () => undefined });
function deferred() {
  let resolve;
  const promise = new Promise(yes => { resolve = yes; });
  return { promise, resolve };
}
function resource() {
  const calls = { dispose: 0, revoke: 0, clear: 0 };
  return { calls, client: { dispose() { calls.dispose++; }, revokeIdentity() { calls.revoke++; }, clear() { calls.clear++; } } };
}

test("opens once across provider object rerenders and disposes once without revoking journals", async () => {
  let latest = binding(), opens = 0; const value = resource();
  const lifetime = openGoalsHostLifetime(latest, () => latest, async () => { opens++; return value.client; });
  assert.equal(await lifetime.ready, value.client); latest = { ...latest };
  assert.equal(lifetime.current(), true); assert.equal(opens, 1);
  lifetime.close(); lifetime.close();
  assert.equal(lifetime.current(), false); assert.deepEqual(value.calls, { dispose: 1, revoke: 0, clear: 0 });
});

test("does not call the factory when closed before its queued admission", async () => {
  const current = binding(); let opens = 0;
  const lifetime = openGoalsHostLifetime(current, () => current, async () => { opens++; return resource().client; }); lifetime.close();
  assert.equal(await lifetime.ready, null); assert.equal(opens, 0);
});

test("a close during journal opening disposes the late resource and never publishes it", async () => {
  const current = binding(), value = resource(), wait = deferred(); let opens = 0;
  const lifetime = openGoalsHostLifetime(current, () => current, async () => { opens++; return wait.promise; });
  await Promise.resolve(); assert.equal(opens, 1); lifetime.close(); wait.resolve(value.client);
  assert.equal(await lifetime.ready, null); assert.deepEqual(value.calls, { dispose: 1, revoke: 0, clear: 0 });
});

test("every owner, epoch, mode, closing and service change fences a late opening", async () => {
  const changes = [
    value => ({ ...value, ownerId: "79f10000-0000-4000-8000-000000000002" }), value => ({ ...value, providerEpoch: 2 }),
    value => ({ ...value, mode: "demo" }), value => ({ ...value, closing: true }), value => ({ ...value, sender: () => undefined }),
    value => ({ ...value, initialize: () => undefined }), value => ({ ...value, commandSnapshot: () => undefined }), value => ({ ...value, refresh: async () => undefined }),
  ];
  for (const change of changes) {
    let latest = binding(); const value = resource(), wait = deferred(), guards = [];
    const lifetime = openGoalsHostLifetime(latest, () => latest, async (_owner, guard) => { guards.push(guard); return wait.promise; });
    await Promise.resolve(); latest = change(latest); assert.equal(guards[0](), false); wait.resolve(value.client);
    assert.equal(await lifetime.ready, null); assert.deepEqual(value.calls, { dispose: 1, revoke: 0, clear: 0 }); lifetime.close(); assert.equal(value.calls.dispose, 1);
  }
});

test("an opening failure propagates once without retry or synthetic resource", async () => {
  const current = binding(), error = new Error("LOCAL_OPEN_REFUSED"); let opens = 0;
  const lifetime = openGoalsHostLifetime(current, () => current, async () => { opens++; throw error; });
  await assert.rejects(lifetime.ready, error); lifetime.close(); assert.equal(opens, 1); assert.equal(lifetime.current(), false);
});

test("demo, closing and malformed provider epochs are never admitted", async () => {
  const current = binding();
  for (const value of [{ ...current, mode: "demo" }, { ...current, closing: true }, { ...current, providerEpoch: -1 }, { ...current, providerEpoch: NaN }]) {
    let opens = 0;
    const lifetime = openGoalsHostLifetime(value, () => value, async () => { opens++; return resource().client; });
    assert.equal(await lifetime.ready, null); assert.equal(opens, 0); lifetime.close();
  }
});
