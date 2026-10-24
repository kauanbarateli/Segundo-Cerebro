import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter, once } from "node:events";
import { PassThrough, Writable } from "node:stream";
import { runBoundedProcess } from "../../scripts/verification/auth-local-ci.mjs";

// A real Writable supplies finish. No test emits finish or replaces end's
// implementation; only its original argument list is observed.
function fixture({ rejectEmptyWrite = false, failFinal = false } = {}) {
  const child = new EventEmitter(), facts = { starts: 0, finishes: 0, finals: 0, stdoutEnds: 0, stderrEnds: 0, exits: 0, closes: 0, groups: 0 };
  const calls = [], chunks = [];
  let observerInstalled = false, closing = false;
  child.pid = 2001;
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  async function closeNaturally() {
    if (closing) return;
    closing = true;
    const ended = Promise.all([once(child.stdout, "end"), once(child.stderr, "end")]);
    child.stdout.end("synthetic-public-metadata");
    child.stderr.end();
    await ended;
    child.emit("exit", 0, null);
    child.emit("close", 0, null);
  }
  child.stdin = new Writable({
    write(chunk, encoding, done) {
      if (rejectEmptyWrite && chunk.byteLength === 0) return done(new Error("SYNTHETIC_PRIVATE_CANARY"));
      chunks.push(Buffer.from(chunk));
      done();
    },
    final(done) {
      facts.finals++;
      done(failFinal ? new Error("SYNTHETIC_PRIVATE_CANARY") : undefined);
    },
  });
  const originalEnd = child.stdin.end;
  child.stdin.end = function (...args) {
    assert.equal(observerInstalled, true, "original observers precede closing stdin");
    calls.push(args);
    return Reflect.apply(originalEnd, this, args);
  };
  child.stdin.on("finish", () => { void closeNaturally(); });
  child.stdin.on("error", () => { void closeNaturally(); });
  const stdoutObserver = {
    start(observed) {
      assert.equal(observed, child);
      facts.starts++;
      child.stdin.on("finish", () => { facts.finishes++; });
      child.stdout.on("end", () => { facts.stdoutEnds++; });
      child.stderr.on("end", () => { facts.stderrEnds++; });
      child.on("exit", (code, signal) => { facts.exits++; assert.equal(code, 0); assert.equal(signal, null); });
      child.on("close", (code, signal) => { facts.closes++; assert.equal(code, 0); assert.equal(signal, null); });
      observerInstalled = true;
      return true;
    },
    data() { return true; },
    end() { return true; },
  };
  return {
    facts, calls, chunks,
    async run(inputOptions = {}) {
      return runBoundedProcess("synthetic-only", [], {
        env: {}, timeoutMs: 1000, maxBytes: 1024, capture: false, stdoutObserver, ...inputOptions,
      }, {
        spawnProcess(command, args, options) {
          assert.equal(command, "synthetic-only"); assert.deepEqual(args, []);
          assert.equal(options.shell, false); assert.equal(options.detached, true);
          assert.deepEqual(options.stdio, ["pipe", "pipe", "pipe"]); assert.deepEqual(options.env, {});
          return child;
        },
        async terminateGroup(observed) { assert.equal(observed, child); facts.groups++; return true; },
      });
    },
    dispose() { child.stdin.destroy(); child.stdout.destroy(); child.stderr.destroy(); },
  };
}

test("absent, undefined, null and empty string close stdin without submitting a zero-byte write", async () => {
  for (const options of [{}, { input: undefined }, { input: null }, { input: "" }]) {
    const owned = fixture({ rejectEmptyWrite: true });
    try {
      assert.deepEqual(await owned.run(options), { stdout: "", groupConfirmed: true });
      assert.equal(owned.calls.length, 1); assert.equal(owned.calls[0].length, 0);
      assert.equal(owned.chunks.length, 0);
      assert.deepEqual(owned.facts, { starts: 1, finishes: 1, finals: 1, stdoutEnds: 1, stderrEnds: 1, exits: 1, closes: 1, groups: 1 });
    } finally { owned.dispose(); }
  }
});

test("nonempty text and binary inputs keep their original argument identity and complete byte content", async () => {
  for (const input of ["ação\nsynthetic", Buffer.from([0, 255, 1]), new Uint8Array([0, 128, 2])]) {
    const owned = fixture();
    try {
      await owned.run({ input });
      assert.equal(owned.calls.length, 1); assert.equal(owned.calls[0].length, 1);
      assert.equal(owned.calls[0][0], input);
      assert.deepEqual(Buffer.concat(owned.chunks), Buffer.from(input));
      assert.equal(owned.facts.finishes, 1); assert.equal(owned.facts.finals, 1); assert.equal(owned.facts.groups, 1);
    } finally { owned.dispose(); }
  }
});

test("explicit empty binary input retains the existing one-argument path without truthiness normalization", async () => {
  for (const input of [Buffer.alloc(0), new Uint8Array(0)]) {
    const owned = fixture();
    try {
      await owned.run({ input });
      assert.equal(owned.calls.length, 1); assert.equal(owned.calls[0].length, 1);
      assert.equal(owned.calls[0][0], input); assert.equal(Buffer.concat(owned.chunks).byteLength, 0);
      assert.equal(owned.facts.finishes, 1);
    } finally { owned.dispose(); }
  }
});

test("a failed original final never synthesizes stdin finish from a successful process or group", async () => {
  const owned = fixture({ failFinal: true });
  try {
    // The generic helper never certified stdin finish. Native consumers must
    // still require their own five terminal observations before accepting.
    const generic = await owned.run();
    assert.equal(generic.groupConfirmed, true);
    assert.equal(owned.facts.exits, 1); assert.equal(owned.facts.closes, 1);
    assert.equal(owned.facts.finishes, 0); assert.equal(owned.facts.finals, 1);
    assert.ok(!JSON.stringify(generic).includes("SYNTHETIC_PRIVATE_CANARY"));
  } finally { owned.dispose(); }
});
