// Pure EventEmitter/oracle doubles; no browser, SDK, env, credentials or network.
import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { prepareAuthEffectObservation, createAuthEffectLedger } from "../e2e-auth-local/auth-effect-outcome.mjs";

test("declarations require explicit preconditions, branded receipts and finite phases without executing type fixtures", async () => {
  const filename = fileURLToPath(new URL("./auth-effect-compile-only.mts", import.meta.url)).replaceAll("\\", "/");
  const source = `import { prepareAuthEffectObservation, createAuthEffectLedger, type AuthEffectPage, type AuthEffectReceipt } from "../e2e-auth-local/auth-effect-outcome.mjs";
    declare const page: AuthEffectPage; declare const receipt: AuthEffectReceipt;
    const observer = await prepareAuthEffectObservation({ page, operation: "login", prerequisite: async () => true });
    const ledger = createAuthEffectLedger(); ledger.begin("password-change");
    await ledger.confirmLogin(receipt, { destination: async () => true, newSessionIdentityAndAccess: async () => true, protectedSameSession: async () => true });
    await ledger.checkpoint("old-a-denied", async () => true);
    // @ts-expect-error prerequisite is mandatory; no default Auth read.
    prepareAuthEffectObservation({ page, operation: "login" });
    // @ts-expect-error there is no arbitrary operation or path selector.
    prepareAuthEffectObservation({ page, operation: "signup", prerequisite: async () => true });
    // @ts-expect-error a public shape cannot manufacture the receipt brand.
    const forged: AuthEffectReceipt = { status: "observed", operation: "login", transport: "finished" };
    // @ts-expect-error all three ordered login sources are required.
    ledger.confirmLogin(receipt, { destination: async () => true, newSessionIdentityAndAccess: async () => true });
    // @ts-expect-error old-password proof has its own receipt method, never a generic checkpoint.
    ledger.checkpoint("old-password-denied", async () => true);
    // @ts-expect-error metadata is immutable and cannot clear a latch by mutation.
    ledger.metadata().pendingPasswordEffect = false;
    // @ts-expect-error observing requires the exact Request and Response, not a URL string.
    observer.observe("http://127.0.0.1:3117/entrar", {});
    void forged;`;
  const options = { strict: true, noEmit: true, skipLibCheck: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext };
  const host = ts.createCompilerHost(options), originalGetSource = host.getSourceFile.bind(host), originalExists = host.fileExists.bind(host), originalRead = host.readFile.bind(host);
  host.getSourceFile = (path, language, ...args) => path === filename ? ts.createSourceFile(path, source, language, true) : originalGetSource(path, language, ...args);
  host.fileExists = path => path === filename || originalExists(path);
  host.readFile = path => path === filename ? source : originalRead(path);
  const declarations = await readFile(new URL("../e2e-auth-local/auth-effect-outcome.d.mts", import.meta.url), "utf8");
  assert.equal(declarations.includes("receiptBrand: unique symbol"), true);
  const diagnostics = ts.getPreEmitDiagnostics(ts.createProgram([filename], options, host));
  assert.deepEqual(diagnostics.map(value => value.code), []);
});

const APP = "http://127.0.0.1:3117";
const abort = () => ({ errorText: "net::ERR_ABORTED" });
async function setup(operation = "login", options = {}) {
  const page = new EventEmitter(), path = operation === "password-change" ? "/trocar-senha" : "/entrar?returnTo=%2Foffline";
  page.url = () => options.pageUrl ?? `${APP}${path}`;
  let failure = options.failure ?? null, headerReads = 0, prerequisites = 0;
  const request = { method: () => "POST", url: () => `${APP}${path}`, failure: () => failure };
  const response = { request: () => options.responseRequest ?? request, url: () => options.responseUrl ?? `${APP}${path}`, status: () => options.status ?? 200,
    allHeaders: async () => { headerReads++; if (options.headersThrow) throw new Error("synthetic-private");
      if (options.headersWait) await options.headersWait;
      return options.headers ?? { "x-action-redirect": operation === "password-change" ? "/entrar?notice=password-updated;push" : "/offline;push", "set-cookie": "synthetic-private" }; } };
  const observation = await prepareAuthEffectObservation({ page, operation, timeoutMs: options.timeoutMs ?? 500,
    prerequisite: async () => { prerequisites++; return options.prerequisite ?? true; } });
  return { page, request, response, observation, setFailure: value => { failure = value; }, counts: () => ({ headerReads, prerequisites }) };
}
const listenersGone = page => { for (const name of ["request", "requestfinished", "requestfailed"]) assert.equal(page.listenerCount(name), 0); };
async function receipt(operation = "login", transport = "finished", options = {}) {
  const fake = await setup(operation, options); fake.page.emit("request", fake.request);
  if (transport === "aborted") fake.setFailure(abort());
  fake.page.emit(transport === "aborted" ? "requestfailed" : "requestfinished", fake.request);
  const result = await fake.observation.observe(fake.request, fake.response);
  listenersGone(fake.page); return { fake, result };
}
const loginOracles = () => ({ destination: async () => true, newSessionIdentityAndAccess: async () => true, protectedSameSession: async () => true });
const known = result => assert.equal(result.status, "known");
const unknown = result => { assert.equal(result.status, "unknown"); assert.deepEqual(Object.keys(result), ["status", "code"]); };
async function bounded(promise) {
  let timer; try { return await Promise.race([promise, new Promise(resolve => { timer = setTimeout(() => resolve("UNSETTLED"), 100); })]); }
  finally { clearTimeout(timer); }
}

test("a finished positive POST remains only an observation until all ordered Auth oracles confirm it", async () => {
  const ledger = createAuthEffectLedger(); ledger.begin("login");
  const { fake, result } = await receipt(); assert.equal(result.transport, "finished"); assert.equal(fake.counts().headerReads, 0);
  assert.equal(ledger.metadata().authWriteOutcomeUncertain, true); assert.equal(ledger.cleanupMayProceed(false), false);
  const calls = []; known(await ledger.confirmLogin(result, {
    destination: async () => { calls.push("destination"); return true; },
    newSessionIdentityAndAccess: async () => { calls.push("identity+access"); return true; },
    protectedSameSession: async () => { calls.push("protected-same-sid"); return true; },
  }));
  assert.deepEqual(calls, ["destination", "identity+access", "protected-same-sid"]);
  assert.equal(ledger.metadata().authWriteOutcomeUncertain, false);
});
test("literal aborted positive POST with exact response/redirect can produce a candidate, never Auth success by itself", async () => {
  const ledger = createAuthEffectLedger(); ledger.begin("login");
  const { fake, result } = await receipt("login", "aborted");
  assert.deepEqual(result, { status: "observed", operation: "login", transport: "aborted-candidate" });
  assert.equal(fake.counts().headerReads, 1); assert.equal(ledger.cleanupMayProceed(false), false);
  known(await ledger.confirmLogin(result, loginOracles())); assert.equal(ledger.metadata().authWriteOutcomeUncertain, false);
  assert.deepEqual(Object.keys(result), ["status", "operation", "transport"]);
});

test("requestfinished with a literal abort is contradictory and cannot become a consumable candidate", async () => {
  const ledger = createAuthEffectLedger(); ledger.begin("login");
  const fake = await setup(); fake.page.emit("request", fake.request); fake.setFailure(abort());
  fake.page.emit("requestfinished", fake.request);
  const result = await fake.observation.observe(fake.request, fake.response);
  unknown(result); assert.equal(result.code, "REQUEST_FAILED"); assert.equal(fake.counts().headerReads, 0);
  unknown(await ledger.confirmLogin(result, loginOracles()));
  assert.equal(ledger.metadata().authWriteOutcomeUncertain, true);
  assert.equal(ledger.cleanupMayProceed(false), false); listenersGone(fake.page);
});
test("an aborted candidate never substitutes for a failed destination, verified identity/access or same-SID guard", async () => {
  for (const failed of ["destination", "newSessionIdentityAndAccess", "protectedSameSession"]) {
    const ledger = createAuthEffectLedger(); ledger.begin("login"); const { result } = await receipt("login", "aborted"), calls = [];
    const oracles = Object.fromEntries(Object.keys(loginOracles()).map(name => [name, async () => { calls.push(name); return name !== failed; }]));
    unknown(await ledger.confirmLogin(result, oracles)); assert.equal(ledger.metadata().authWriteOutcomeUncertain, true);
    assert.equal(ledger.cleanupMayProceed(false), false); assert.equal(calls.at(-1), failed);
  }
});
test("URL, response header or fabricated receipts with true callbacks cannot manufacture a known login", async () => {
  const ledger = createAuthEffectLedger(); ledger.begin("login"); let calls = 0;
  unknown(await ledger.confirmLogin({ status: "observed", operation: "login", transport: "aborted-candidate" }, {
    destination: async () => { calls++; return true; }, newSessionIdentityAndAccess: async () => true, protectedSameSession: async () => true,
  }));
  assert.equal(calls, 0); assert.equal(ledger.metadata().authWriteOutcomeUncertain, true);
});
test("candidate requires the same exact Request and a response status in the original range", async () => {
  for (const options of [{ responseRequest: {} }, { responseUrl: `${APP}/api/settings` }, { status: 199 }, { status: 400 }, { status: 200.5 }]) {
    const { result } = await receipt("login", "aborted", options); unknown(result);
  }
  const fake = await setup(); fake.page.emit("request", fake.request); fake.setFailure(abort()); fake.page.emit("requestfailed", fake.request);
  unknown(await fake.observation.observe({}, fake.response)); listenersGone(fake.page);
});
test("candidate requires the exact operation redirect; absolute/other/header loss/read error never become known", async () => {
  for (const options of [{ headers: {} }, { headers: { "x-action-redirect": `${APP}/offline;push` } }, { headers: { "x-action-redirect": "/offline;replace" } },
    { headers: { "x-action-redirect": "/offline;push " } }, { headersThrow: true }]) {
    const { result } = await receipt("login", "aborted", options); unknown(result);
  }
  const { result } = await receipt("password-change", "aborted", { headers: { "x-action-redirect": "/offline;push" } }); unknown(result);
});
test("header accessor is not read, and arbitrary/nonliteral failure text never becomes an abort candidate", async () => {
  let read = false; const headers = {}; Object.defineProperty(headers, "x-action-redirect", { enumerable: true, get: () => { read = true; throw new Error("synthetic-private"); } });
  unknown((await receipt("login", "aborted", { headers })).result); assert.equal(read, false);
  const accessor = {}; Object.defineProperty(accessor, "errorText", { enumerable: true, get: () => { read = true; return "net::ERR_ABORTED"; } });
  for (const value of [{ errorText: "net::ERR_FAILED" }, { errorText: "net::ERR_ABORTED", extra: true }, accessor, null]) {
    const fake = await setup(); fake.page.emit("request", fake.request); fake.setFailure(value); fake.page.emit("requestfailed", fake.request);
    unknown(await fake.observation.observe(fake.request, fake.response)); listenersGone(fake.page);
  }
  assert.equal(read, false);
});
test("old-password negative never receives a redirect/abort alternative", async () => {
  const { result, fake } = await receipt("old-password", "aborted"); unknown(result); assert.equal(fake.counts().headerReads, 0);
  assert.equal(result.code, "REQUEST_FAILED");
  unknown((await receipt("old-password", "finished", { status: 303 })).result);
});
test("no terminal, late abort, duplicate request or duplicate terminal remains closed without retry", async () => {
  const noTerminal = await setup("login", { timeoutMs: 5 }); noTerminal.page.emit("request", noTerminal.request);
  unknown(await noTerminal.observation.observe(noTerminal.request, noTerminal.response));
  noTerminal.setFailure(abort()); noTerminal.page.emit("requestfailed", noTerminal.request); listenersGone(noTerminal.page);
  for (const duplicate of ["request", "requestfailed"]) {
    const fake = await setup(); fake.page.emit("request", fake.request); fake.setFailure(abort());
    if (duplicate === "request") fake.page.emit("request", fake.request);
    else { fake.page.emit("requestfailed", fake.request); fake.page.emit("requestfailed", fake.request); }
    unknown(await fake.observation.observe(fake.request, fake.response)); listenersGone(fake.page);
  }
});
test("bounded missing headers and binding after abort deadline preserve unknown outcome", async () => {
  unknown((await receipt("login", "aborted", { timeoutMs: 8, headersWait: new Promise(() => {}) })).result);
  const fake = await setup("login", { timeoutMs: 5 }); fake.page.emit("request", fake.request); fake.setFailure(abort()); fake.page.emit("requestfailed", fake.request);
  await new Promise(resolve => setTimeout(resolve, 12)); unknown(await fake.observation.observe(fake.request, fake.response)); listenersGone(fake.page);
});
test("dispose resolves pending terminal/header waits, and late resolution cannot certify them", async () => {
  const waiting = await setup(); waiting.page.emit("request", waiting.request);
  const pending = waiting.observation.observe(waiting.request, waiting.response); waiting.observation.dispose();
  unknown(await bounded(pending)); listenersGone(waiting.page);
  let release; const headersWait = new Promise(resolve => { release = resolve; });
  const fake = await setup("login", { headersWait }); fake.page.emit("request", fake.request); fake.setFailure(abort()); fake.page.emit("requestfailed", fake.request);
  const withHeaders = fake.observation.observe(fake.request, fake.response); await Promise.resolve(); await Promise.resolve();
  fake.observation.dispose(); unknown(await bounded(withHeaders)); release(); listenersGone(fake.page);
});
test("strict finished permits its approved late bind but never a changed failure or dispose/resume promotion", async () => {
  const finished = await setup("login", { timeoutMs: 5 }); finished.page.emit("request", finished.request); finished.page.emit("requestfinished", finished.request);
  await new Promise(resolve => setTimeout(resolve, 12));
  assert.equal((await finished.observation.observe(finished.request, finished.response)).transport, "finished"); listenersGone(finished.page);
  const changed = await setup(); changed.page.emit("request", changed.request); changed.page.emit("requestfinished", changed.request); changed.setFailure(abort());
  unknown(await changed.observation.observe(changed.request, changed.response)); listenersGone(changed.page);
  const disposed = await setup(); disposed.page.emit("request", disposed.request);
  const pending = disposed.observation.observe(disposed.request, disposed.response); disposed.page.emit("requestfinished", disposed.request); disposed.observation.dispose();
  unknown(await bounded(pending)); listenersGone(disposed.page);
});
test("a failed prerequisite arms no observer and uses no implicit Auth seed or service", async () => {
  const page = new EventEmitter(); page.url = () => `${APP}/entrar`;
  await assert.rejects(() => prepareAuthEffectObservation({ page, operation: "login", prerequisite: async () => false }), { message: "AUTH_EFFECT_PROTOCOL_REFUSED" }); listenersGone(page);
  await assert.rejects(() => prepareAuthEffectObservation({ page, operation: "login" }), { message: "AUTH_EFFECT_PROTOCOL_REFUSED" }); listenersGone(page);
});

async function passwordTerminal(transport = "aborted") {
  const ledger = createAuthEffectLedger(); ledger.begin("password-change"); const { result } = await receipt("password-change", transport);
  assert.equal((await ledger.confirmPasswordTerminal(result, async () => true)).status, "pending-password-effect");
  return ledger;
}
async function oldNegative(ledger) {
  await ledger.checkpoint("old-a-denied", async () => true); await ledger.checkpoint("b-intact", async () => true);
  ledger.begin("old-password"); const { result } = await receipt("old-password"); known(await ledger.confirmOldPasswordRefusal(result, async () => true));
}
test("PW terminal observation/cookie clearance keeps an independent pending effect latch for both transports", async () => {
  for (const mode of ["finished", "aborted"]) {
    const ledger = await passwordTerminal(mode);
    assert.deepEqual(ledger.metadata(), { authWriteOutcomeUncertain: false, pendingPasswordEffect: true, passwordCheckpoints: 1, failed: false, disposed: false });
    assert.equal(ledger.cleanupMayProceed(false), false);
  }
});
test("an unrelated known login never clears the pending password effect or skips its proof chain", async () => {
  const ledger = await passwordTerminal(); ledger.begin("login"); const { result } = await receipt("login", "aborted"); known(await ledger.confirmLogin(result, loginOracles()));
  assert.equal(ledger.metadata().pendingPasswordEffect, true); assert.equal(ledger.metadata().passwordCheckpoints, 1);
  assert.equal(ledger.cleanupMayProceed(false), false);
});
test("only the entire ordered password proof makes its effect known; RLS is still independent", async () => {
  const ledger = await passwordTerminal(); await oldNegative(ledger);
  assert.equal(ledger.metadata().pendingPasswordEffect, true); assert.equal(ledger.metadata().passwordCheckpoints, 4);
  ledger.begin("login"); const { result } = await receipt("login", "aborted"); known(await ledger.confirmLogin(result, loginOracles()));
  assert.equal(ledger.metadata().passwordCheckpoints, 5); assert.equal(ledger.cleanupMayProceed(false), false);
  await ledger.checkpoint("new-session-distinct", async () => true); assert.equal(ledger.cleanupMayProceed(false), false);
  known(await ledger.checkpoint("new-a-protected", async () => true));
  assert.equal(ledger.metadata().pendingPasswordEffect, false); assert.equal(ledger.metadata().passwordCheckpoints, 7);
  assert.equal(ledger.cleanupMayProceed(true), false); assert.equal(ledger.cleanupMayProceed(false), true);
  // Eligibility is not NEW-A global revoke/ACK/404 or certified fixture deletion.
});
test("failed old-A/B proof, reordered checkpoints or missing new SID cannot release password pending", async () => {
  for (const name of ["old-a-denied", "b-intact"]) {
    const ledger = await passwordTerminal(); if (name === "b-intact") await ledger.checkpoint("old-a-denied", async () => true);
    unknown(await ledger.checkpoint(name, async () => false)); assert.equal(ledger.cleanupMayProceed(false), false);
  }
  const reordered = await passwordTerminal(); unknown(await reordered.checkpoint("new-a-protected", async () => true));
  const missingSid = await passwordTerminal(); await oldNegative(missingSid); missingSid.begin("login");
  const { result } = await receipt(); known(await missingSid.confirmLogin(result, loginOracles()));
  unknown(await missingSid.checkpoint("new-session-distinct", async () => false)); assert.equal(missingSid.metadata().pendingPasswordEffect, true);
});
test("old-password generic/no-session proof remains required and may not use an aborted observation", async () => {
  const ledger = await passwordTerminal(); await ledger.checkpoint("old-a-denied", async () => true); await ledger.checkpoint("b-intact", async () => true);
  ledger.begin("old-password"); const { result } = await receipt("old-password"); unknown(await ledger.confirmOldPasswordRefusal(result, async () => false));
  assert.equal(ledger.metadata().authWriteOutcomeUncertain, true); assert.equal(ledger.metadata().pendingPasswordEffect, true);
});
test("oracle rejection/raw error, receipt replay and extra callbacks never promote or retry an outcome", async () => {
  const ledger = createAuthEffectLedger(); ledger.begin("login"); const { result } = await receipt("login", "aborted");
  const oracles = loginOracles(); oracles.newSessionIdentityAndAccess = async () => { throw new Error("synthetic-private-token"); };
  unknown(await ledger.confirmLogin(result, oracles)); unknown(await ledger.confirmLogin(result, loginOracles()));
  assert.equal(ledger.metadata().authWriteOutcomeUncertain, true);
  const second = createAuthEffectLedger(); second.begin("login"); const fresh = (await receipt()).result;
  unknown(await second.confirmLogin(fresh, { ...loginOracles(), extra: async () => true })); assert.equal(second.cleanupMayProceed(false), false);
});
test("dispose while an Auth oracle is pending never turns its late true into known", async () => {
  let release; const wait = new Promise(resolve => { release = resolve; });
  const ledger = createAuthEffectLedger(); ledger.begin("login"); const { result } = await receipt("login", "aborted"), oracles = loginOracles();
  oracles.newSessionIdentityAndAccess = async () => { await wait; return true; };
  const pending = ledger.confirmLogin(result, oracles); await Promise.resolve(); await Promise.resolve(); ledger.dispose(); release();
  unknown(await pending); assert.equal(ledger.metadata().authWriteOutcomeUncertain, true); assert.equal(ledger.cleanupMayProceed(false), false);
});
test("concurrent duplicate checkpoints cannot skip B or double-advance the proof chain", async () => {
  let release; const wait = new Promise(resolve => { release = resolve; }); const ledger = await passwordTerminal();
  const first = ledger.checkpoint("old-a-denied", async () => { await wait; return true; });
  unknown(await ledger.checkpoint("old-a-denied", async () => true)); release(); unknown(await first);
  assert.equal(ledger.metadata().passwordCheckpoints, 1); assert.equal(ledger.cleanupMayProceed(false), false);
});
