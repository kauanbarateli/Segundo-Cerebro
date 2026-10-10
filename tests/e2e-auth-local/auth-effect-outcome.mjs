// CI protocol ledger. No IO, env, browser, SDK or default transport.
import { performance } from "node:perf_hooks";
const APP = "http://127.0.0.1:3117";
const OPERATIONS = Object.freeze({
  login: { path: "/entrar", redirect: "/offline;push" },
  "password-change": { path: "/trocar-senha", redirect: "/entrar?notice=password-updated;push" },
  "old-password": { path: "/entrar", redirect: null },
});
const RECEIPTS = new WeakMap(); // Contains operation/transport only, no Request or Auth material.
const refused = () => { throw new Error("AUTH_EFFECT_PROTOCOL_REFUSED"); };
function exact(value, keys) {
  if (!value || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) refused();
  const found = Reflect.ownKeys(value), descriptors = Object.getOwnPropertyDescriptors(value);
  if (found.length !== keys.length || found.some(key => typeof key !== "string" || !keys.includes(key)) ||
      keys.some(key => !Object.hasOwn(descriptors, key) || !Object.hasOwn(descriptors[key], "value"))) refused();
}
function readFailure(request) {
  try { const read = request.failure; return typeof read === "function" ? read.call(request) : undefined; }
  catch { return undefined; }
}
function literalAbort(value) {
  try { exact(value, ["errorText"]); const descriptor = Object.getOwnPropertyDescriptor(value, "errorText"); return typeof descriptor.value === "string" && descriptor.value === "net::ERR_ABORTED"; }
  catch { return false; }
}
const unknown = code => Object.freeze({ status: "unknown", code });

/** Await this before clicking. The prerequisite is an explicit, real caller
 * read: clean actor/no seeded session for login/negative; verified A1 for PW.
 * It performs no login and returns true only after that precondition is proven.
 */
export async function prepareAuthEffectObservation(options) {
  exact(options, Object.hasOwn(options ?? {}, "timeoutMs") ? ["page", "operation", "prerequisite", "timeoutMs"] : ["page", "operation", "prerequisite"]);
  const { page, operation, prerequisite, timeoutMs = 15_000 } = options;
  if (!Object.hasOwn(OPERATIONS, operation) || typeof prerequisite !== "function" || !page ||
      ["url", "on", "off"].some(key => typeof page[key] !== "function") || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 15_000) refused();
  const spec = OPERATIONS[operation];
  try {
    const current = () => { const url = new URL(page.url()); return url.origin === APP && url.pathname === spec.path && !url.username && !url.password && !url.hash; };
    if (!current() || await prerequisite() !== true || !current()) refused();
  }
  catch { refused(); }
  const deadline = performance.now() + timeoutMs;
  let request = null, transport = null, failure = null, entered = false, completed = false, released = false, timer;
  let settle, settleFailure; const terminal = new Promise(resolve => { settle = resolve; });
  const failureSignal = new Promise(resolve => { settleFailure = resolve; });
  const handlers = new Map();
  function fail(code) { if (failure === null) failure = code; settle(false); settleFailure({ refused: true }); release(); }
  function release() {
    if (released) return; released = true; clearTimeout(timer);
    for (const [event, handler] of handlers) { try { page.off(event, handler); } catch { failure ??= "OBSERVATION_REFUSED"; } }
    handlers.clear();
  }
  function timely() { if (performance.now() >= deadline) { fail("COMPLETION_TIMEOUT"); return false; } return failure === null; }
  function matching(value) {
    if (!value || typeof value.method !== "function" || typeof value.url !== "function") refused();
    const url = new URL(value.url());
    return value.method() === "POST" && url.origin === APP && url.pathname === spec.path && !url.username && !url.password && !url.hash;
  }
  const guarded = action => value => { if (released) return; try { action(value); } catch { fail("OBSERVATION_REFUSED"); } };
  handlers.set("request", guarded(value => {
    if (!matching(value) || !timely()) return;
    if (request) { fail("OBSERVATION_REFUSED"); return; } request = value;
  }));
  function terminalEvent(value, finished) {
    if (!matching(value) || !timely()) return;
    if (value !== request || transport !== null) { fail("OBSERVATION_REFUSED"); return; }
    const observed = readFailure(value);
    if (finished && observed === null) { transport = "finished"; clearTimeout(timer); settle(true); return; }
    if (!finished && operation !== "old-password" && literalAbort(observed)) { transport = "aborted-candidate"; settle(true); return; }
    fail("REQUEST_FAILED");
  }
  handlers.set("requestfinished", guarded(value => terminalEvent(value, true)));
  handlers.set("requestfailed", guarded(value => terminalEvent(value, false)));
  try { for (const [event, handler] of handlers) page.on(event, handler); timer = setTimeout(() => fail("COMPLETION_TIMEOUT"), timeoutMs); }
  catch { fail("OBSERVATION_REFUSED"); refused(); }

  async function observe(expectedRequest, response) {
    if (entered) return unknown("OBSERVATION_REFUSED"); entered = true;
    try {
      if (!request || expectedRequest !== request) fail("OBSERVATION_REFUSED");
      if (failure === null) await terminal;
      if (failure === null) {
        const captured = readFailure(expectedRequest);
        if (transport === "finished" && captured !== null || transport === "aborted-candidate" && !literalAbort(captured)) fail("REQUEST_FAILED");
      }
      if (failure === null) {
        if (!response || typeof response.request !== "function" || response.request() !== request || typeof response.status !== "function" ||
            typeof response.url !== "function" || !matching({ method: () => "POST", url: () => response.url() })) fail("RESPONSE_REFUSED");
        else {
          const status = response.status();
          if (!Number.isInteger(status) || (operation === "old-password" ? status !== 200 : status < 200 || status >= 400)) fail("RESPONSE_REFUSED");
        }
      }
      if (failure === null && transport === "aborted-candidate") {
        if (!timely() || typeof response.allHeaders !== "function") fail("RESPONSE_REFUSED");
        else {
          let bound, headerOutcome;
          try {
            headerOutcome = await Promise.race([
              Promise.resolve().then(() => response.allHeaders()).then(value => ({ value }), () => ({ refused: true })),
              failureSignal,
              new Promise(resolve => { bound = setTimeout(() => resolve({ refused: true }), Math.max(0, deadline - performance.now())); }),
            ]);
          } finally { clearTimeout(bound); }
          if (!timely() || headerOutcome.refused) fail("RESPONSE_REFUSED");
          else {
            const headers = headerOutcome.value;
            if (!headers || typeof headers !== "object" || Object.getPrototypeOf(headers) !== Object.prototype) fail("RESPONSE_REFUSED");
            else {
              const descriptor = Object.getOwnPropertyDescriptor(headers, "x-action-redirect");
              if (!descriptor || !Object.hasOwn(descriptor, "value") || descriptor.value !== spec.redirect) fail("RESPONSE_REFUSED");
            }
          }
        }
      }
      release(); request = null; completed = true;
      if (failure !== null || transport === null) return unknown(failure ?? "OBSERVATION_REFUSED");
      const receipt = Object.freeze({ status: "observed", operation, transport });
      RECEIPTS.set(receipt, { operation, transport }); return receipt;
    } catch { fail("OBSERVATION_REFUSED"); request = null; completed = true; return unknown(failure); }
  }
  function dispose() { if (!completed && failure === null) fail("OBSERVATION_REFUSED"); release(); request = null; }
  return Object.freeze({ observe, dispose });
}

const LOGIN_ORACLES = ["destination", "newSessionIdentityAndAccess", "protectedSameSession"];
export const PASSWORD_EFFECT_CHECKPOINTS = Object.freeze(["terminal-notice-and-cookies", "old-a-denied", "b-intact", "old-password-denied", "new-password-login", "new-session-distinct", "new-a-protected"]);
/** This is a protocol ledger, not an Auth implementation or evidence producer.
 * Real callbacks must reuse exact GUI/cookie/getUser/RPC/guard checks. Fakes
 * prove ordering/refusal/sticky bits only, never real identity or persistence.
 */
export function createAuthEffectLedger() {
  let authUnknown = false, passwordPending = false, active = null, progress = 0, failed = false, disposed = false, busy = false;
  const rejected = () => { failed = true; authUnknown = true; return unknown("ORACLE_REFUSED"); };
  function begin(operation) {
    if (disposed || failed || authUnknown || busy || !Object.hasOwn(OPERATIONS, operation)) return rejected();
    if (operation === "password-change" && passwordPending) return rejected();
    authUnknown = true; active = operation;
    if (operation === "password-change") { passwordPending = true; progress = 0; }
    return Object.freeze({ status: "armed" });
  }
  function take(receipt, operation) {
    const stored = RECEIPTS.get(receipt);
    if (disposed || failed || active !== operation || !authUnknown || !stored || stored.operation !== operation) return false;
    RECEIPTS.delete(receipt); return true;
  }
  async function verify(callback) {
    try { return typeof callback === "function" && await callback() === true && !disposed && !failed; }
    catch { return false; }
  }
  async function confirmLogin(receipt, oracles) {
    if (!take(receipt, "login")) return rejected();
    try { exact(oracles, LOGIN_ORACLES); } catch { return rejected(); }
    for (const key of LOGIN_ORACLES) if (!await verify(oracles[key])) return rejected();
    authUnknown = false; active = null;
    if (passwordPending && progress === 4) progress = 5;
    return Object.freeze({ status: "known", operation: "login" });
  }
  async function confirmPasswordTerminal(receipt, terminalNoticeAndCookies) {
    if (!take(receipt, "password-change") || !passwordPending || progress !== 0 || !await verify(terminalNoticeAndCookies)) return rejected();
    authUnknown = false; active = null; progress = 1;
    return Object.freeze({ status: "pending-password-effect" });
  }
  async function confirmOldPasswordRefusal(receipt, genericRefusalAndNoSession) {
    const stored = RECEIPTS.get(receipt);
    if (!stored || stored.transport !== "finished" || !take(receipt, "old-password") || !passwordPending || progress !== 3 ||
        !await verify(genericRefusalAndNoSession)) return rejected();
    authUnknown = false; active = null; progress = 4;
    return Object.freeze({ status: "known", operation: "old-password" });
  }
  async function checkpoint(name, oracle) {
    if (disposed || failed || authUnknown || !passwordPending || ![1, 2, 5, 6].includes(progress) ||
        PASSWORD_EFFECT_CHECKPOINTS[progress] !== name || !await verify(oracle)) return rejected();
    progress++;
    if (progress === PASSWORD_EFFECT_CHECKPOINTS.length) passwordPending = false;
    return Object.freeze({ status: passwordPending ? "pending-password-effect" : "known", operation: "password-change" });
  }
  function metadata() { return Object.freeze({ authWriteOutcomeUncertain: authUnknown, pendingPasswordEffect: passwordPending, passwordCheckpoints: progress, failed, disposed }); }
  function cleanupMayProceed(rlsOutcomeUncertain) {
    if (typeof rlsOutcomeUncertain !== "boolean") return false;
    return !authUnknown && !passwordPending && !rlsOutcomeUncertain && !failed && !disposed && !busy;
  }
  async function exclusive(action) { if (busy) return rejected(); busy = true; try { return await action(); } finally { busy = false; } }
  function dispose() { disposed = true; if (authUnknown || passwordPending || active !== null) { failed = true; authUnknown = true; } active = null; }
  return Object.freeze({ begin, confirmLogin: (receipt, oracles) => exclusive(() => confirmLogin(receipt, oracles)),
    confirmPasswordTerminal: (receipt, oracle) => exclusive(() => confirmPasswordTerminal(receipt, oracle)),
    confirmOldPasswordRefusal: (receipt, oracle) => exclusive(() => confirmOldPasswordRefusal(receipt, oracle)),
    checkpoint: (name, oracle) => exclusive(() => checkpoint(name, oracle)), metadata, cleanupMayProceed, dispose });
}
