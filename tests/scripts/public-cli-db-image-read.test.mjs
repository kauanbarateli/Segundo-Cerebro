/** Real adapter + synthetic child/base; owned temp files only, never Docker. */
import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtemp, rm, readFile, writeFile, symlink, realpath, lstat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, basename } from "node:path";
import { createHash } from "node:crypto";
import { readPublicDbImageOnce, bridgePublicDbImageOwnedRun } from "../helpers/public-cli-db-image-read.mjs";
import { PUBLIC_DB_IMAGE_FORMAT } from "../helpers/public-cli-db-image-metadata.mjs";

const imageId = "sha256:" + "a".repeat(64), sourceSha = "b".repeat(40);
const metadata = { repoDigests: ["public.example.invalid/postgres@sha256:" + "c".repeat(64)], os: "linux", architecture: "amd64", imageId };
const text = JSON.stringify(metadata) + "\n";
async function owned(operation) {
  const parent = await realpath(tmpdir());
  const directory = await realpath(await mkdtemp(join(parent, "sc-public-image-pure-")));
  try { await operation({ directory, cwd: directory, imageId, sourceSha, environment: { PATH: "synthetic-path", HOME: "NOT_FORWARDED", SUPABASE_SECRET_KEY: "NOT_FORWARDED", GH_TOKEN: "NOT_FORWARDED" } }); }
  finally {
    // Check the canonical, one-level mkdtemp target before recursive removal.
    const current = await realpath(directory);
    assert.equal(current, directory); assert.equal(dirname(current), parent);
    assert.notEqual(current, parent); assert.match(basename(current), /^sc-public-image-pure-[A-Za-z0-9]+$/);
    assert.equal((await lstat(current)).isSymbolicLink(), false);
    await rm(current, { recursive: true, force: true });
  }
}
function base(script = () => {}, finish = {}) {
  let calls = 0, kills = 0;
  return {
    calls: () => calls, kills: () => kills,
    killGroup(child) { assert.equal(child.pid, 424242); kills++; },
    async runProcess(command, args, options) {
      calls++;
      assert.equal(command, "docker"); assert.deepEqual(args, ["image", "inspect", "--format", PUBLIC_DB_IMAGE_FORMAT, imageId]);
      assert.equal(options.capture, false); assert.equal(options.maxBytes, 69632); assert.ok(options.timeoutMs > 0 && options.timeoutMs <= 12000);
      assert.deepEqual(Object.keys(options.env).sort(), ["LANG", "LC_ALL", "NO_COLOR", "PATH", "TZ"]);
      const child = new EventEmitter(); child.pid = 424242;
      child.stdout = new EventEmitter(); child.stderr = new EventEmitter(); child.stdin = new EventEmitter();
      const observer = options.stdoutObserver;
      const started = observer.start(child); assert.equal(started, true);
      const emit = (name, ...args) => {
        if (name === "out") return observer.data(Buffer.from(args[0]));
        if (name === "err") return child.stderr.emit("data", Buffer.from(args[0]));
        if (name === "stdoutEnd") return child.stdout.emit("end");
        if (name === "stderrEnd") return child.stderr.emit("end");
        if (name === "finish") return child.stdin.emit("finish");
        return child.emit(name, ...args);
      };
      const natural = () => { emit("spawn"); emit("out", text); emit("finish"); emit("stdoutEnd"); emit("stderrEnd"); emit("exit", 0, null); emit("close", 0, null); };
      await script({ emit, natural, observer, options, child });
      observer.end();
      return { stdout: "", groupConfirmed: true, ...finish };
    },
  };
}
const run = (options, fixture, extra = {}) => readPublicDbImageOnce(options, { runProcess: fixture.runProcess, killGroup: fixture.killGroup, ...extra });
const refused = value => { assert.equal(value.status, "refused"); assert.equal(value.observed, null); assert.equal(Object.hasOwn(value, "candidate"), false); assert.equal(value.normativeQualified, false); };

test("actual adapter writes one exclusive file, durable marker before base, separate receipt and nonnormative companion", async () => owned(async options => {
  const fixture = base(({ natural }) => { assert.ok(existsSync(join(options.directory, "public-db-image.attempt.json"))); natural(); });
  const ownedRun = (program, args, timeoutMs, ownedOptions) => {
    assert.equal(typeof timeoutMs, "number"); assert.equal(timeoutMs, ownedOptions.timeoutMs);
    assert.equal(ownedOptions.capture, false); assert.equal(ownedOptions.maxBytes, 69632);
    assert.equal(typeof ownedOptions.stdoutObserver.start, "function");
    return fixture.runProcess(program, args, ownedOptions);
  };
  const runnerSource = await readFile(new URL("../../scripts/verification/avatar-storage-local-ci.mjs", import.meta.url), "utf8");
  assert.match(runnerSource, /runProcess: bridgePublicDbImageOwnedRun\(run\)/);
  const value = await readPublicDbImageOnce(options, { runProcess: bridgePublicDbImageOwnedRun(ownedRun), killGroup: fixture.killGroup });
  assert.equal(value.status, "observed"); assert.equal(value.sourceSha, sourceSha); assert.equal(fixture.calls(), 1); assert.equal(fixture.kills(), 0);
  assert.deepEqual(value.candidate.observed, metadata); assert.equal(value.candidate.normativeQualified, false);
  assert.equal(value.receipt.stdoutBytes, Buffer.byteLength(text)); assert.equal(value.receipt.stderrBytes, 0);
  assert.equal(value.receipt.stdoutSha256, createHash("sha256").update(text).digest("hex"));
  assert.equal(value.receipt.naturalStdoutEof, true); assert.equal(value.receipt.naturalStderrEof, true); assert.equal(value.receipt.exitCode, 0); assert.equal(value.receipt.closeCode, 0);
  assert.equal(await readFile(join(options.directory, "public-db-image.original.json"), "utf8"), text);
  assert.equal(JSON.stringify(value).includes("NOT_FORWARDED"), false);
}));

test("durable existing marker refuses a second real adapter call before another base invocation", async () => owned(async options => {
  const fixture = base(({ natural }) => natural());
  assert.equal((await run(options, fixture)).status, "observed");
  refused(await run(options, fixture)); assert.equal(fixture.calls(), 1);
  assert.equal(await readFile(join(options.directory, "public-db-image.original.json"), "utf8"), text);
}));

test("bad ID/source and existing output cannot invoke base or overwrite a prior file", async () => {
  for (const patch of [{ imageId: "postgres:17" }, { imageId: "--all" }, { sourceSha: "HEAD" }, { sourceSha: sourceSha + "\n" }]) await owned(async options => {
    const fixture = base(({ natural }) => natural()); refused(await run({ ...options, ...patch }, fixture)); assert.equal(fixture.calls(), 0);
  });
  await owned(async options => { await writeFile(join(options.directory, "public-db-image.original.json"), "PRESERVE"); const fixture = base(); refused(await run(options, fixture)); assert.equal(fixture.calls(), 0); assert.equal(await readFile(join(options.directory, "public-db-image.original.json"), "utf8"), "PRESERVE"); });
});

test("64KiB stdout and 4KiB stderr are independent refusal caps; only original group is signalled", async () => {
  for (const [channel, count, code] of [["out", 65537, "STDOUT_LIMIT"], ["err", 4097, "STDERR_LIMIT"]]) await owned(async options => {
    const fixture = base(({ emit }) => { emit("spawn"); emit(channel, Buffer.alloc(count, 120)); emit("finish"); emit("stdoutEnd"); emit("stderrEnd"); emit("exit", 0, null); emit("close", 0, null); });
    const value = await run(options, fixture); refused(value); assert.equal(value.code, code); assert.equal(fixture.calls(), 1); assert.equal(fixture.kills(), 1);
    assert.ok((await readFile(join(options.directory, "public-db-image.original.json"))).byteLength <= 65536);
  });
});

test("each missing natural EOF/exit/close/finish/spawn refuses despite base groupConfirmed true", async () => {
  for (const missing of ["spawn", "finish", "stdoutEnd", "stderrEnd", "exit", "close"]) await owned(async options => {
    const fixture = base(({ emit }) => { if (missing !== "spawn") emit("spawn"); emit("out", text); for (const name of ["finish", "stdoutEnd", "stderrEnd", "exit", "close"]) if (name !== missing) emit(name, ...(name === "exit" || name === "close" ? [0, null] : [])); });
    const value = await run(options, fixture); refused(value); assert.equal(fixture.calls(), 1);
    if (missing === "spawn") assert.equal(value.processStarted, false);
  });
});

test("late EOF after close and duplicate exit/close/end cannot cure the first refusal", async () => {
  for (const duplicate of ["stdoutEnd", "stderrEnd", "exit", "close"]) await owned(async options => {
    const fixture = base(({ emit, natural }) => { natural(); emit(duplicate, ...(duplicate === "exit" || duplicate === "close" ? [0, null] : [])); }); refused(await run(options, fixture));
  });
  await owned(async options => { const fixture = base(({ emit }) => { emit("spawn"); emit("out", text); emit("finish"); emit("exit", 0, null); emit("close", 0, null); emit("stdoutEnd"); emit("stderrEnd"); }); refused(await run(options, fixture)); });
});

test("nonzero exit, signal, stream error and unconfirmed group never produce candidate metadata", async () => {
  for (const [code, signal] of [[1, null], [0, "SIGTERM"]]) await owned(async options => {
    const fixture = base(({ emit }) => { emit("spawn"); emit("out", text); emit("finish"); emit("stdoutEnd"); emit("stderrEnd"); emit("exit", code, signal); emit("close", code, signal); }); refused(await run(options, fixture));
  });
  await owned(async options => { const fixture = base(({ natural }) => natural(), { groupConfirmed: false }); const value = await run(options, fixture); refused(value); assert.equal(value.groupConfirmed, false); });
  await owned(async options => { const fixture = base(({ child, natural }) => { child.stdout.emit("error", Error("PRIVATE_CANARY")); natural(); }); const value = await run(options, fixture); refused(value); assert.equal(value.code, "STREAM_REFUSED"); assert.equal(JSON.stringify(value).includes("PRIVATE_CANARY"), false); });
});

test("rejected original error/accessor/Proxy is not inspected and never rethrown as async data", async () => owned(async options => {
  let reads = 0; const error = new Proxy({}, { get() { reads++; throw Error("PRIVATE_CANARY"); }, getOwnPropertyDescriptor() { reads++; throw Error("PRIVATE_CANARY"); } });
  const fixture = { runProcess() { throw error; }, killGroup() {} };
  const value = await run(options, fixture); refused(value); assert.equal(reads, 0); assert.equal(value.groupConfirmed, false); assert.equal(JSON.stringify(value).includes("PRIVATE_CANARY"), false);
}));

test("invocation or observer start is not a natural spawn fact on executor refusal", async () => {
  await owned(async options => {
    let calls = 0;
    const value = await readPublicDbImageOnce(options, { runProcess() { calls++; throw Error("PRIVATE_CANARY"); }, killGroup() {} });
    refused(value); assert.equal(value.code, "READ_REFUSED"); assert.equal(value.processStarted, false);
    assert.equal(value.logicalAttempt, 1); assert.equal(value.groupConfirmed, false); assert.equal(calls, 1);
  });
  await owned(async options => {
    const fixture = base(() => { throw Error("PRIVATE_CANARY"); }); // start hook ran; no spawn event.
    const value = await run(options, fixture);
    refused(value); assert.equal(value.code, "READ_REFUSED"); assert.equal(value.processStarted, false);
    assert.equal(value.logicalAttempt, 1); assert.equal(value.groupConfirmed, false); assert.equal(fixture.calls(), 1);
    assert.equal(JSON.stringify(value).includes("PRIVATE_CANARY"), false);
  });
});

test("time spent before/after command and before final admission belongs to one 15s budget", async () => owned(async options => {
  let now = 0; const fixture = base(({ natural }) => { natural(); now = 15000; });
  const value = await run(options, fixture, { clock: () => now }); refused(value); assert.equal(value.code, "DEADLINE_REFUSED"); assert.equal(fixture.calls(), 1);
}));

test("expiry at the real adapter's last post-process clock read cannot admit an already built observation", async () => {
  let postReads = 0, finished = false;
  await owned(async options => {
    const fixture = base(({ natural }) => { natural(); finished = true; });
    const value = await run(options, fixture, { clock: () => { if (finished) postReads++; return 0; } });
    assert.equal(value.status, "observed"); assert.ok(postReads > 1);
  });
  const lastRead = postReads; postReads = 0; finished = false;
  await owned(async options => {
    const fixture = base(({ natural }) => { natural(); finished = true; });
    const value = await run(options, fixture, { clock: () => { if (finished && ++postReads >= lastRead) return 15000; return 0; } });
    refused(value); assert.equal(value.code, "DEADLINE_REFUSED"); assert.equal(fixture.calls(), 1);
  });
});

test("duplicate/escaped JSON keys, bad UTF8, extra fields and malformed JSON preserve refusal and original file", async () => {
  const bad = [text.replace('"os":"linux"', '"os":"linux","os":"linux"'), text.replace('"os":"linux"', '"os":"linux","\\u006fs":"linux"'), "{", JSON.stringify({ ...metadata, Env: "PRIVATE_CANARY" }), Buffer.from([255])];
  for (const bytes of bad) await owned(async options => {
    const fixture = base(({ emit }) => { emit("spawn"); emit("out", bytes); emit("finish"); emit("stdoutEnd"); emit("stderrEnd"); emit("exit", 0, null); emit("close", 0, null); });
    const value = await run(options, fixture); refused(value); assert.equal(JSON.stringify(value).includes("PRIVATE_CANARY"), false); assert.equal(fixture.calls(), 1);
  });
});

test("symlink directory is refused before marker, output or process", async () => owned(async options => {
  const link = join(options.directory, "link"); await symlink(options.directory, link, process.platform === "win32" ? "junction" : "dir");
  const fixture = base(); refused(await run({ ...options, directory: link }, fixture)); assert.equal(fixture.calls(), 0); assert.equal(existsSync(join(options.directory, "public-db-image.attempt.json")), false);
}));
