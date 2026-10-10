import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { BackupError } from "../../scripts/operations/backup-format.mjs";
import { queryPostgres, PSQL_OUTPUT_LIMIT_BYTES, PSQL_QUERY_TIMEOUT_MS } from "../../scripts/operations/postgres-process.mjs";

const canary = "SYNTHETIC_PRIVATE_PROCESS_DIAGNOSTIC";
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
function childProcess(stdout = new PassThrough()) {
  return Object.assign(new EventEmitter(), {
    stdout, stderr: new PassThrough(), kills: 0, unrefs: 0,
    kill(signal) { this.kills++; this.lastSignal = signal; return false; },
    unref() { this.unrefs++; },
  });
}
function query(child, options = { timeoutMs: 30 }, onSpawn = () => {}) {
  return queryPostgres("inert-psql", { PGPASSWORD: canary }, { file: "fixed-catalog.sql" }, (...args) => { onSpawn(...args); return child; }, options);
}
async function rejectsClosed(pending, code) {
  let watchdog;
  try {
    await assert.rejects(Promise.race([pending, new Promise((_, reject) => { watchdog = setTimeout(() => reject(new Error("test watchdog: query did not settle")), 1000); })]), error => {
      assert.equal(error instanceof BackupError, true);
      assert.equal(error.code, code);
      assert.equal(error.message, code);
      assert.equal(error.cause, undefined);
      assert.equal(String(error.stack).includes(canary), false);
      return true;
    });
  } finally { clearTimeout(watchdog); }
}
function successfulReply(child, bytes) {
  child.stderr.end(canary);
  child.stdout.end(bytes);
  child.emit("close", 0);
}
function detached(child) {
  assert.equal(child.listenerCount("close"), 0);
  assert.equal(child.listenerCount("exit"), 0);
  // One static guard has no query closure and absorbs late process errors.
  assert.equal(child.listenerCount("error"), 1);
}

test("valid report waits for stdout and zero exit, preserves split UTF-8 and leaves no live deadline", async () => {
  const child = childProcess(), input = Buffer.from('{"ok":true,"label":"ação 🔒"}\n'), original = Buffer.from(input);
  const environment = { PGPASSWORD: canary, PGCONNECT_TIMEOUT: "0", PGCLIENTENCODING: "LATIN1" };
  let seen;
  const pending = queryPostgres("inert-psql", environment, { file: "fixed-catalog.sql" }, (executable, args, options) => { seen = { executable, args, options }; return child; }, { timeoutMs: 100 });
  for (const byte of input) child.stdout.write(Buffer.from([byte]));
  child.stdout.end(); child.stderr.end(canary);
  let settled = false; pending.then(() => { settled = true; });
  await pause(5); assert.equal(settled, false);
  child.emit("close", 0);
  assert.deepEqual(await pending, { ok: true, label: "ação 🔒" });
  assert.deepEqual(input, original);
  assert.equal(seen.args.includes("--no-password"), true);
  assert.equal(JSON.stringify(seen.args).includes(canary), false);
  assert.equal(seen.options.shell, false);
  assert.equal(seen.options.env.PGPASSWORD, canary);
  assert.equal(seen.options.env.PGCONNECT_TIMEOUT, "8");
  assert.equal(seen.options.env.PGCLIENTENCODING, "UTF8");
  assert.equal(environment.PGCONNECT_TIMEOUT, "0");
  assert.equal(environment.PGCLIENTENCODING, "LATIN1");
  detached(child);
  await pause(110);
  assert.equal(child.kills, 0);
  assert.equal(child.unrefs, 0);
});

test("failed close settles even when stdout never ends", async () => {
  const child = childProcess(), pending = query(child, { timeoutMs: 500 });
  child.stderr.write(canary); child.emit("close", 7);
  await rejectsClosed(pending, "PSQL_FAILED");
  assert.equal(child.stdout.destroyed, true); assert.equal(child.stderr.destroyed, true);
  assert.equal(child.kills, 1); assert.equal(child.unrefs, 1); detached(child);
});

test("failed or signalled exit settles before close when a pipe remains open", async () => {
  for (const code of [9, null]) {
    const child = childProcess(), pending = query(child, { timeoutMs: 500 });
    child.stderr.write(canary);
    child.emit("exit", code, code === null ? "SIGTERM" : null);
    await rejectsClosed(pending, "PSQL_FAILED");
    assert.equal(child.stdout.destroyed, true); assert.equal(child.stderr.destroyed, true);
    assert.equal(child.kills, 1); assert.equal(child.unrefs, 1); detached(child);
  }
});

test("zero exit still requires both close zero and complete stdout", async () => {
  for (const first of ["stdout", "close"]) {
    const child = childProcess(), pending = query(child, { timeoutMs: 500 });
    let settled = false;
    pending.then(() => { settled = true; });
    child.emit("exit", 0, null);
    if (first === "stdout") child.stdout.end('{"ok":true}');
    else child.emit("close", 0);
    await pause(5); assert.equal(settled, false);
    if (first === "stdout") child.emit("close", 0);
    else child.stdout.end('{"ok":true}');
    child.stderr.end();
    assert.deepEqual(await pending, { ok: true });
    assert.equal(child.kills, 0); detached(child);
  }
});

test("process error settles without stdout or close and late diagnostics cannot escape", async () => {
  const child = childProcess(), pending = query(child, { timeoutMs: 500 });
  child.emit("error", new Error(canary));
  await rejectsClosed(pending, "PSQL_UNAVAILABLE");
  assert.doesNotThrow(() => { child.emit("error", new Error(canary)); child.stderr.emit("error", new Error(canary)); child.emit("close", 0); });
  assert.equal(child.kills, 1); detached(child);
});

test("complete valid stdout without process close fails at the total deadline", async () => {
  const child = childProcess(), pending = query(child);
  child.stdout.end('{"ok":true}');
  await rejectsClosed(pending, "PSQL_TIMEOUT");
  assert.equal(child.kills, 1); assert.equal(child.unrefs, 1); detached(child);
});

test("zero exit cannot turn unfinished stdout into a success", async () => {
  const child = childProcess(), pending = query(child);
  child.stdout.write('{"ok":true}'); child.emit("close", 0);
  await rejectsClosed(pending, "PSQL_TIMEOUT"); detached(child);
});

test("deadline returns despite an iterator, cancellation and kill that never cooperate", async () => {
  let rejectRead, returns = 0, destroys = 0, attempts = 0;
  const iterator = { next() { return new Promise((_, reject) => { rejectRead = reject; }); }, return() { returns++; return new Promise(() => {}); } };
  const stdout = { [Symbol.asyncIterator]() { return iterator; }, destroy() { destroys++; } };
  const child = childProcess(stdout);
  child.kill = function () { this.kills++; throw new Error(canary); };
  const observed = [];
  const listener = error => observed.push(error);
  process.on("unhandledRejection", listener);
  try {
    await rejectsClosed(query(child, { timeoutMs: 20 }, () => { attempts++; }), "PSQL_TIMEOUT");
    assert.equal(attempts, 1); assert.equal(returns, 1); assert.equal(destroys, 1);
    assert.equal(child.kills, 1); assert.equal(child.unrefs, 1); detached(child);
    rejectRead(new Error(canary));
    child.emit("error", new Error(canary)); child.emit("close", 0);
    await pause(10); assert.deepEqual(observed, []);
  } finally { process.removeListener("unhandledRejection", listener); }
});

test("a stream of empty immediately resolved chunks cannot starve the deadline timer", async () => {
  let reads = 0;
  const stdout = { [Symbol.asyncIterator]() { return { next() { reads++; return Promise.resolve({ done: false, value: Buffer.alloc(0) }); }, return() { return Promise.resolve({ done: true }); } }; }, destroy() {} };
  const child = childProcess(stdout), pending = query(child, { timeoutMs: 20 });
  child.emit("close", 0);
  await rejectsClosed(pending, "PSQL_TIMEOUT");
  assert.ok(reads > 1); assert.equal(child.kills, 1); detached(child);
});

test("a spawn double returning after the deadline cannot declare success", async () => {
  const child = childProcess();
  await rejectsClosed(queryPostgres("inert-psql", {}, { file: "fixed-catalog.sql" }, () => {
    const until = performance.now() + 15;
    while (performance.now() < until) { /* Only a short offline double blocks here. */ }
    return child;
  }, { timeoutMs: 5 }), "PSQL_TIMEOUT");
  assert.equal(child.kills, 1); assert.equal(child.unrefs, 1); detached(child);
});

test("a synchronous spawn exception has no raw diagnostic and no retry", async () => {
  let attempts = 0;
  await rejectsClosed(queryPostgres("inert-psql", {}, { sql: "fixed readonly SQL" }, () => { attempts++; throw new Error(canary); }, { timeoutMs: 20 }), "PSQL_UNAVAILABLE");
  await pause(30); assert.equal(attempts, 1);
});

test("missing stdout and a throwing kill still return the original closed failure", async () => {
  const child = childProcess(null);
  child.kill = function () { this.kills++; this.emit("error", new Error(canary)); throw new Error(canary); };
  await rejectsClosed(query(child), "PSQL_UNAVAILABLE");
  assert.equal(child.kills, 1); assert.equal(child.unrefs, 1); detached(child);
});

test("stream exceptions, including foreign BackupError codes, remain closed when cleanup also throws", async () => {
  for (const thrown of [new Error(canary), new BackupError(canary)]) {
    const stdout = { [Symbol.asyncIterator]() { return { next() { throw thrown; }, return() { throw new Error(canary); } }; }, destroy() { throw new Error(canary); } };
    const child = childProcess(stdout);
    child.kill = function () { this.kills++; throw new Error(canary); };
    child.unref = function () { this.unrefs++; throw new Error(canary); };
    await rejectsClosed(query(child), "PSQL_INVALID_REPORT");
    assert.equal(child.kills, 1); assert.equal(child.unrefs, 1); detached(child);
  }
});

test("byte limit fails before process close and cancels both pipes", async () => {
  const child = childProcess(), pending = query(child);
  child.stdout.write(Buffer.alloc(PSQL_OUTPUT_LIMIT_BYTES + 1, 32));
  await rejectsClosed(pending, "PSQL_OUTPUT_LIMIT");
  assert.equal(child.stdout.destroyed, true); assert.equal(child.stderr.destroyed, true);
  assert.equal(child.kills, 1); detached(child);
});

test("the exact byte ceiling remains accepted without changing source buffers", async () => {
  const child = childProcess(), padding = "x".repeat(PSQL_OUTPUT_LIMIT_BYTES - Buffer.byteLength('{"padding":""}'));
  const bytes = Buffer.from(JSON.stringify({ padding })), pending = query(child, { timeoutMs: 500 });
  assert.equal(bytes.length, PSQL_OUTPUT_LIMIT_BYTES);
  successfulReply(child, bytes);
  assert.equal((await pending).padding.length, padding.length);
  assert.equal(bytes[0], 123); assert.equal(child.kills, 0); detached(child);
});

test("malformed JSON, nonobjects, extra reports and invalid UTF-8 are rejected", async () => {
  for (const bytes of [Buffer.from(""), Buffer.from('{"ok":'), Buffer.from("null"), Buffer.from("true"), Buffer.from("1"), Buffer.from("[]"), Buffer.from('{}\n{}'), Buffer.from('\uFEFF{}'), Buffer.concat([Buffer.from('{"value":"'), Buffer.from([0xc0, 0xaf]), Buffer.from('"}')])]) {
    const child = childProcess(), pending = query(child);
    successfulReply(child, bytes);
    await rejectsClosed(pending, "PSQL_INVALID_REPORT");
    assert.equal(child.kills, 1); detached(child);
  }
});

test("unexpected string chunks cannot bypass validation through coercion", async () => {
  const child = childProcess({ async *[Symbol.asyncIterator]() { yield '{"ok":true}'; }, destroy() {} });
  await rejectsClosed(query(child), "PSQL_INVALID_REPORT"); detached(child);
});

test("the first terminal process event wins and does not leak later errors", async () => {
  for (const first of ["error", "close"]) {
    const child = childProcess(), pending = query(child);
    if (first === "error") { child.emit("error", new Error(canary)); child.emit("close", 0); }
    else { child.emit("close", 1); child.emit("error", new Error(canary)); }
    await rejectsClosed(pending, first === "error" ? "PSQL_UNAVAILABLE" : "PSQL_FAILED");
    await pause(40); assert.equal(child.kills, 1); detached(child);
  }
});

test("offline deadline injection can shorten but never disable or extend the production maximum", async () => {
  assert.equal(PSQL_QUERY_TIMEOUT_MS, 45000);
  for (const timeoutMs of [0, -1, Infinity, NaN, 1.5, PSQL_QUERY_TIMEOUT_MS + 1, "20"]) {
    let spawned = false;
    await rejectsClosed(queryPostgres("inert-psql", {}, { sql: "fixed readonly SQL" }, () => { spawned = true; }, { timeoutMs }), "PSQL_UNAVAILABLE");
    assert.equal(spawned, false);
  }
});
