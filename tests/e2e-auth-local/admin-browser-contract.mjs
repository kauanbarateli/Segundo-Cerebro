// Independent browser protocol. Neither pure tests nor this validator start services.
export const ADMIN_BROWSER_CASES = Object.freeze(["BLOCK_LIVE_BROWSER", "FIRST_FORCED_BROWSER"]);
export const ADMIN_BROWSER_LIMITS = Object.freeze({ browserRequests: 1024, ownedSdkRequests: 512, sqlInspections: 64, responseBytes: 1048576, requestMs: 15000, caseMs: 360000 });
// Derived from the declared repository import closure + explicit Next layouts,
// canonical SQL loader, the canonical migration chain and existing Admin graph. These
// counts describe this finite manifest, not all internals executed by Next.
// Finance UI: 26 newly reachable imports over 0d9d92 (15 new files, 11 existing).
// Each is bound by the original Git-blob collector; no SDK graph expansion.
export const ADMIN_BROWSER_SERIES_SOURCE_PATHS = Object.freeze([
  "src/adapters/db/finance-series-availability.ts",
  "src/adapters/db/finance-series-classification.ts",
  "src/adapters/db/finance-series-gateway.ts",
  "src/adapters/db/finance-series-protocol.ts",
  "src/adapters/db/finance-series-runtime.ts",
  "src/components/features/financeiro/series/finance-series-panel.tsx",
  "src/components/features/financeiro/series/series-detail-drawer.tsx",
  "src/components/features/financeiro/series/series-fields.tsx",
  "src/components/features/financeiro/series/series-group-action.tsx",
  "src/components/features/financeiro/series/series-operation-drawer.tsx",
  "src/components/features/financeiro/series/series-pending-actions.tsx",
  "src/components/features/financeiro/series/series-ui-model.ts",
  "src/components/features/financeiro/series/series.css",
  "src/components/features/financeiro/series/use-series-channel.ts",
  "src/core/financeiro/series/series-calendar.ts",
  "src/core/financeiro/series/series-planning.ts",
  "src/core/financeiro/series/series-policy.ts",
  "src/core/financeiro/series/series-preview-types.ts",
  "src/core/financeiro/series/series-previews.ts",
  "src/core/financeiro/series/series-public-validation.ts",
  "src/core/financeiro/series/series-types.ts",
  "src/core/financeiro/series/series-validation.ts",
  "src/lib/finance-series-classification-client.ts",
  "src/lib/finance-series-classification-contract.ts",
  "src/lib/finance-series-client.ts",
  "src/lib/finance-series-journal.ts",
]);
// Goals host: exactly33 newly reachable repository imports over 0d933d9.
// Derived from the original declared closure; includes type-only references.
export const ADMIN_BROWSER_GOALS_SOURCE_PATHS = Object.freeze([
  "src/adapters/db/finance-goals-availability.ts",
  "src/adapters/db/finance-goals-images-availability.ts",
  "src/components/features/financeiro/goals/finance-goals-host-lifetime.ts",
  "src/components/features/financeiro/goals/finance-goals-host.tsx",
  "src/components/features/financeiro/goals/goal-card.tsx",
  "src/components/features/financeiro/goals/goal-detail.tsx",
  "src/components/features/financeiro/goals/goal-editor.tsx",
  "src/components/features/financeiro/goals/goal-history.tsx",
  "src/components/features/financeiro/goals/goal-image-editor-session.ts",
  "src/components/features/financeiro/goals/goal-image-host-binding.ts",
  "src/components/features/financeiro/goals/goal-image-picker-model.ts",
  "src/components/features/financeiro/goals/goal-image-picker.css",
  "src/components/features/financeiro/goals/goal-image-picker.tsx",
  "src/components/features/financeiro/goals/goal-image-source-recovery.tsx",
  "src/components/features/financeiro/goals/goal-image.tsx",
  "src/components/features/financeiro/goals/goal-operation-notice.tsx",
  "src/components/features/financeiro/goals/goals-panel.tsx",
  "src/components/features/financeiro/goals/goals-ui-model.ts",
  "src/components/features/financeiro/goals/goals.css",
  "src/components/features/financeiro/goals/use-goals-channel.ts",
  "src/core/financeiro/goals/goal-ports.ts",
  "src/core/financeiro/goals/goal-projections.ts",
  "src/core/financeiro/goals/goal-types.ts",
  "src/core/financeiro/goals/goal-use-cases.ts",
  "src/core/financeiro/goals/goal-validation.ts",
  "src/lib/files/goal-image-upload-contract.ts",
  "src/lib/files/goal-image-upload-finance-barrier.ts",
  "src/lib/files/goal-image-upload-journal.ts",
  "src/lib/files/goal-image-upload-transport.ts",
  "src/lib/files/goal-image-upload.ts",
  "src/lib/finance-goals-client-contract.ts",
  "src/lib/finance-goals-client.ts",
  "src/lib/finance-goals-http-contract.ts",
  "src/lib/finance-goals-journal.ts",
  "src/lib/finance-goals-json.ts",
  "src/lib/finance-goals-terminal-browser.ts",
  "src/lib/finance-goals-terminal-contract.ts",
]);
export const ADMIN_BROWSER_SOURCE_COUNTS = Object.freeze({git:508,dependencies:61});
export const ADMIN_BROWSER_STAGES = Object.freeze({
  BLOCK_LIVE_BROWSER: Object.freeze(["fixtures", "browser-bound", "master-bound", "own-sessions-bound", "admin-fence", "admin-terminal", "live-sessions-denied", "actor-intact", "cleanup-inventory", "cleanup-revoked", "cleanup-retained", "contexts-closed"]),
  FIRST_FORCED_BROWSER: Object.freeze(["fixtures", "browser-bound", "master-bound", "admin-fence", "created-fence", "admin-terminal", "forced-login", "pages-denied", "apis-denied", "password-terminal", "credentials-changed", "own-sessions-bound", "actor-intact", "cleanup-inventory", "cleanup-revoked", "cleanup-retained", "contexts-closed"]),
});
export const ADMIN_AUTH_CHECKPOINTS = Object.freeze(["AUTH_DOCUMENT_REFUSED", "AUTH_FORM_REFUSED", "AUTH_POST_REFUSED", "AUTH_DESTINATION_REFUSED", "AUTH_READY_REFUSED", "AUTH_SESSION_REFUSED"]);
export const ADMIN_HTTP_PENDING_CLASSES = Object.freeze(["ASSET", "FETCH", "API", "DOCUMENT", "AUTH", "OTHER"]);
export const ADMIN_HTTP_PENDING_CODES = Object.freeze([...ADMIN_HTTP_PENDING_CLASSES.flatMap(kind => ["RESPONSE", "NO_RESPONSE"].map(phase => `QUIESCENCE_HTTP_${kind}_${phase}_PENDING`)), "QUIESCENCE_HTTP_DETAILS_MIXED_PENDING"]);
export const ADMIN_QUIESCENCE_CODES = Object.freeze(["QUIESCENCE_UI_PENDING", "QUIESCENCE_HMR_GET_PENDING", "QUIESCENCE_HTTP_PENDING", "QUIESCENCE_MIXED_PENDING", ...ADMIN_HTTP_PENDING_CODES]);
export const ADMIN_BROWSER_CODES = Object.freeze(["PASSED", "NOT_RUN", "ENVIRONMENT_REFUSED", "SOURCE_REFUSED", "SQL_REFUSED", "OWNERSHIP_REFUSED", "AUTH_NOT_PROVEN", "SAGA_NOT_PROVEN", "BROWSER_REFUSED", "REQUEST_REFUSED", "TRANSPORT_FAILED", "DEADLINE_EXCEEDED", "WRITE_OUTCOME_UNCERTAIN", "CLEANUP_NOT_PROVEN", "PROCESS_UNCONFIRMED", "TEARDOWN_UNCONFIRMED", "REPORT_REFUSED", ...ADMIN_AUTH_CHECKPOINTS, ...ADMIN_QUIESCENCE_CODES]);
export const ADMIN_BROWSER_COUNT_KEYS = Object.freeze(["browserRequests", "ownedSdkRequests", "nextProbeRequests", "sqlInspections", "fixturesCreated", "contexts", "loginPosts", "passwordPosts", "adminRpc", "adminAuth", "ownSessionsRpc", "ownSessionsViews", "ownSessionsReloads", "pageProbes", "apiProbes", "cleanupHttp", "deleted", "absenceReads", "revocationAcks", "alreadyRevoked", "cleanupSql"]);
export const ADMIN_BROWSER_PASS_COUNTS = Object.freeze({
  BLOCK_LIVE_BROWSER: Object.freeze({ fixturesCreated: 2, contexts: 3, loginPosts: 3, passwordPosts: 0, adminRpc: 8, adminAuth: 1, ownSessionsRpc:2, ownSessionsViews:2, ownSessionsReloads:0, pageProbes: 0, apiProbes: 2, nextProbeRequests:6, cleanupHttp: 7, deleted: 2, absenceReads: 2, revocationAcks: 1, alreadyRevoked: 1, cleanupSql: 3 }),
  FIRST_FORCED_BROWSER: Object.freeze({ fixturesCreated: 2, contexts: 2, loginPosts: 4, passwordPosts: 1, adminRpc: 12, adminAuth: 4, ownSessionsRpc:2, ownSessionsViews:3, ownSessionsReloads:1, pageProbes: 16, apiProbes: 28, nextProbeRequests:34, cleanupHttp: 8, deleted: 2, absenceReads: 2, revocationAcks: 2, alreadyRevoked: 0, cleanupSql: 3 }),
});
export const ADMIN_BROWSER_INFRA_KEYS = Object.freeze(["pg17", "instanceBound", "containersBound", "catalogue", "markerBound", "workerExitZero", "workerGroupConfirmed", "nextGroupConfirmed", "ioQuiet", "namespaceRemoved", "directoriesRemoved"]);
export const ADMIN_BROWSER_LIMITATIONS = Object.freeze(["personalAdminFactoryCertified", "adminUiCertified", "adminApiSuccessCertified", "instantIdleDomInvalidationCertified", "allNextInternalFetchesMeasured", "hostedCertified", "allDescendantsForcelessCertified"]);
const fail = () => { const e = new Error("REPORT_REFUSED"); e.stack = "REPORT_REFUSED"; throw e; };
// Next Server Actions return Flight (200) or a SeeOther redirect (303).
// Transport acceptance never substitutes for destination, UI and session proof.
export function isAdminAuthActionRequest(value, method) {
  if (typeof value !== "string" || method !== "POST") return false;
  try { const u = new URL(value); return value === u.href && value === u.origin + u.pathname + u.search && u.origin === "http://127.0.0.1:3117" && !u.username && !u.password && !value.includes("#") && (u.pathname === "/entrar" && ["", "?returnTo=%2Fajuda"].includes(u.search) || u.pathname === "/trocar-senha" && u.search === ""); } catch { return false; }
}
export const acceptAdminAuthActionResponse = (url, method, status) => isAdminAuthActionRequest(url, method) && (status === 200 || status === 303);
export async function runAdminAuthCheckpoint(state, code, operation, postObserved = () => false) {
  if (!ADMIN_AUTH_CHECKPOINTS.includes(code) || typeof operation !== "function" || typeof postObserved !== "function") fail();
  try { return await operation(); } catch {
    // The callback reads only counters populated by actual request events.
    // Never inspect provider errors, DOM, cookies or form arguments.
    let observed = false; try { observed = postObserved() === true; } catch { /* no factual POST proof */ }
    if (observed) state.unknown(); state.fail(code);
    const e = new Error(code); e.stack = code; throw e;
  }
}
/** Read descriptors once, never invoke original getters or Proxy get traps. */
export function closedAdminBrowserValue(input) {
  let nodes = 0;
  function copy(v, depth) {
    if (++nodes > 16384 || depth > 20) fail();
    if (v === null || typeof v === "boolean" || typeof v === "string" && v.length <= 512 || typeof v === "number" && Number.isSafeInteger(v)) return v;
    if (!v || typeof v !== "object") fail();
    const array = Array.isArray(v), proto = Object.getPrototypeOf(v), d = Object.getOwnPropertyDescriptors(v), keys = Reflect.ownKeys(d);
    if (proto !== (array ? Array.prototype : Object.prototype) || keys.length > 2048 || keys.some(k => typeof k !== "string" || !Object.hasOwn(d[k], "value"))) fail();
    if (array) {
      const n = d.length?.value;
      if (!Number.isSafeInteger(n) || n < 0 || n > 2048 || keys.length !== n + 1 || Array.from({ length: n }, (_, i) => String(i)).some(k => !d[k]?.enumerable)) fail();
      return Object.freeze(Array.from({ length: n }, (_, i) => copy(d[i].value, depth + 1)));
    }
    if (keys.some(k => !d[k].enumerable || ["__proto__", "constructor", "prototype"].includes(k))) fail();
    return Object.freeze(Object.fromEntries(keys.map(k => [k, copy(d[k].value, depth + 1)])));
  }
  try { return copy(input, 0); } catch { fail(); }
}
const exact = (v, keys) => v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const integer = (v, max) => Number.isSafeInteger(v) && v >= 0 && v <= max;
const nextStopIneligibleReasons = Object.freeze(["CLOCK_READ_FAILED","GATE_READ_FAILED","CLOCK_INVALID","CLOCK_ROLLBACK","DEADLINE_REACHED","IDENTITY_MISMATCH","GATE_SHAPE_INVALID","STAGE_NOT_PASSED","OUTCOME_UNKNOWN","UI_PENDING","SDK_PENDING","SQL_PENDING","NON_READ_PENDING","PENDING_MAP_INVALID","PENDING_EMPTY","PENDING_LIMIT","PENDING_ENTRY_INVALID","STATIC_AUTHORITY_MISSING","ORIGINAL_ROW_MISMATCH","DISPATCH_CLOCK_READ_FAILED","DISPATCH_CLOCK_INVALID","DISPATCH_CLOCK_ROLLBACK","DISPATCH_DEADLINE_REACHED"]);
export function acceptsWorkerNextStopDiagnostic(input) {
  if (input === null) return true;
  try {
    const v = closedAdminBrowserValue(input);
    return exact(v,["outcome","reason"]) && (v.outcome === "NOT_ATTEMPTED" && v.reason === "NOT_CALLED" || v.outcome === "NOT_NEEDED" && v.reason === "EMPTY_PENDING" || v.outcome === "EMITTED" && v.reason === "NONE" || v.outcome === "REFUSED" && ["ALREADY_ATTEMPTED","WRITE_RETURNED_FALSE","WRITE_THROWN"].includes(v.reason) || v.outcome === "INELIGIBLE" && nextStopIneligibleReasons.includes(v.reason));
  } catch { return false; }
}
export function acceptsParentNextStopDiagnostic(input) {
  if (input === null) return true;
  try {
    const v = closedAdminBrowserValue(input);
    if (!exact(v,["phase","requested","settled","resolvedTrue"]) || v.phase !== "after-worker-run-settlement-before-finally") return false;
    if (v.requested === null) return v.settled === null && v.resolvedTrue === null;
    if (v.requested === false) return v.settled === false && v.resolvedTrue === null;
    return v.requested === true && (v.settled === false && v.resolvedTrue === null || v.settled === true && typeof v.resolvedTrue === "boolean");
  } catch { return false; }
}
export function acceptsBrowserProtocolObservation(input){
  if(input===null)return true;
  try{
    const v=closedAdminBrowserValue(input),keys=["identity","order","terminal","publicTerminal"],membership=[...keys,"managerEntry","sessionRegistered"],fetch=[...membership,"fetchCommand","fetchOutcome"];
    const four=exact(v,keys),six=exact(v,membership),eight=exact(v,fetch),nine=exact(v,[...fetch,"fetchErrorType"]);
    if(!four&&!six&&!eight&&!nine)return false;
    if(!four&&(!["same-request","absent","other-request","unavailable","mixed"].includes(v.managerEntry)||!["registered","removed","unavailable","mixed"].includes(v.sessionRegistered)))return false;
    if((eight||nine)&&(!["continue","abort","unobserved","unavailable","mixed"].includes(v.fetchCommand)||!["pending","resolved","rejected","unobserved","unavailable","mixed"].includes(v.fetchOutcome)))return false;
    if(nine){
      const outcomes={"not-rejected":["pending","resolved","unobserved","mixed"],error:["rejected"],closed:["rejected"],crashed:["rejected"],other:["rejected"],unavailable:["rejected","unavailable","mixed"],mixed:["rejected","mixed"]};
      if(typeof v.fetchErrorType!=="string"||!Object.hasOwn(outcomes,v.fetchErrorType)||!outcomes[v.fetchErrorType].includes(v.fetchOutcome))return false;
    }
    return["exact-server-request","unavailable","mixed"].includes(v.identity)&&["terminal-before-pause","pause-before-terminal","no-pause-observed","no-terminal-observed","unavailable","mixed"].includes(v.order)&&["finished","failed","not-observed","unavailable","mixed"].includes(v.terminal)&&["finished","failed","not-observed","unavailable","mixed"].includes(v.publicTerminal);
  }catch{return false;}
}
export function blankAdminBrowserCase(kind) {
  if (!ADMIN_BROWSER_CASES.includes(kind)) fail();
  return { case: kind, status: "not-run", code: "NOT_RUN", stages: [], counts: Object.fromEntries(ADMIN_BROWSER_COUNT_KEYS.map(k => [k, 0])), writeOutcomeUncertain: false, pendingRequests: 0, pendingInspections: 0, quiescenceDetail: null, nextStopDiagnostic: null, authPostFailure: null };
}
export function validateAdminBrowserCase(input) {
  const v = closedAdminBrowserValue(input);
  const keys = ["case", "status", "code", "stages", "counts", "writeOutcomeUncertain", "pendingRequests", "pendingInspections", "quiescenceDetail"];
  if (!exact(v,[...keys,...["nextStopDiagnostic","authPostFailure","httpProbeFailure","nextProbeRefusal"].filter(key=>v&&Object.hasOwn(v,key))]) || !ADMIN_BROWSER_CASES.includes(v.case) || !["passed", "failed", "not-run"].includes(v.status) || !ADMIN_BROWSER_CODES.includes(v.code) || typeof v.writeOutcomeUncertain !== "boolean" || !integer(v.pendingRequests, 512) || !integer(v.pendingInspections, 64) || !exact(v.counts, ADMIN_BROWSER_COUNT_KEYS) || !Array.isArray(v.stages)) fail();
  if (Object.hasOwn(v,"authPostFailure") && v.authPostFailure!==null) { const d=v.authPostFailure; if(v.status!=="failed"||v.code!=="TRANSPORT_FAILED"||v.writeOutcomeUncertain!==true||!exact(d,["operation","resource","failure","response","contentType"])||!["login","password","other"].includes(d.operation)||!["document","fetch","xhr","other","unavailable"].includes(d.resource)||!["aborted","failed","other","unavailable"].includes(d.failure)||!["unobserved","200","303","other"].includes(d.response)||!["unobserved","flight","html","other"].includes(d.contentType)||(d.response==="unobserved")!==(d.contentType==="unobserved"))fail(); }
  if(Object.hasOwn(v,"httpProbeFailure")&&v.httpProbeFailure!==null){const d=v.httpProbeFailure;if(v.status!=="failed"||v.code!=="AUTH_NOT_PROVEN"||!exact(d,["operation","status","cache","contentType","json"])||!["capture-read","tasks-read","settings-read","settings-write","projects-read","other"].includes(d.operation)||!["200","401","403","409","429","500","503","other"].includes(d.status)||!["no-store","other"].includes(d.cache)||!["json","html","other"].includes(d.contentType)||!["not-read","invalid","refused"].includes(d.json)||(d.json!=="not-read"&&(!["401","403"].includes(d.status)||d.cache!=="no-store"||d.contentType!=="json")))fail();}
  if(Object.hasOwn(v,"nextProbeRefusal")&&v.nextProbeRefusal!==null&&(v.status!=="failed"||v.code!=="REQUEST_REFUSED"||!["lifecycle","owner","cookies-shape","cookies-count","cookie-name","auth-cookie-empty","flow-cookie-empty","hmr-cookie-empty","cookie-value","cookie-duplicate","catalogue","body","cookies-unavailable"].includes(v.nextProbeRefusal)))fail();
  if (Object.hasOwn(v,"nextStopDiagnostic") && (!acceptsWorkerNextStopDiagnostic(v.nextStopDiagnostic) || v.nextStopDiagnostic !== null && (v.status !== "failed" || !(v.code === "QUIESCENCE_HTTP_PENDING" || ADMIN_HTTP_PENDING_CODES.includes(v.code))))) fail();
  if(v.quiescenceDetail!==null){const d=v.quiescenceDetail,origin=exact(d,["phase","pathClass","resource","frame","stopAck","introducedStage","routeOutcome"])||exact(d,["phase","pathClass","resource","frame","stopAck","introducedStage","routeOutcome","protocol"])&&acceptsBrowserProtocolObservation(d.protocol);if(v.status!=="failed"||!(v.code==="QUIESCENCE_HTTP_PENDING"||ADMIN_HTTP_PENDING_CODES.includes(v.code))||!(exact(d,["phase","pathClass","resource","frame","stopAck"])||origin&&[...ADMIN_BROWSER_STAGES[v.case],"mixed","unavailable"].includes(d.introducedStage)&&["continue-ack","abort-ack","pending","unobserved","mixed"].includes(d.routeOutcome))||!["before-stop","after-stop","after-blank","after-close"].includes(d.phase)||!["login","password-change","other-auth","other-authorized","mixed","unavailable"].includes(d.pathClass)||!["document","fetch","xhr","other","mixed","unavailable"].includes(d.resource)||!["main","child","mixed","unavailable"].includes(d.frame)||!["owned-page","not-enumerated","unobserved","mixed"].includes(d.stopAck))fail();}
  const order = ADMIN_BROWSER_STAGES[v.case], pass = ADMIN_BROWSER_PASS_COUNTS[v.case];
  if (v.stages.length > order.length || v.stages.some((s, i) => !exact(s, ["stage", "passed"]) || s.stage !== order[i] || typeof s.passed !== "boolean" || i < v.stages.length - 1 && s.passed !== true)) fail();
  for (const k of ADMIN_BROWSER_COUNT_KEYS) if (!integer(v.counts[k], ADMIN_BROWSER_LIMITS[k] ?? pass[k])) fail();
  if (v.counts.ownedSdkRequests < v.counts.adminRpc + v.counts.adminAuth + v.counts.ownSessionsRpc + v.counts.cleanupHttp || v.counts.ownSessionsReloads > v.counts.ownSessionsViews || v.counts.sqlInspections < v.counts.cleanupSql || v.counts.absenceReads < v.counts.deleted || v.counts.cleanupHttp < v.counts.revocationAcks + v.counts.deleted + v.counts.absenceReads) fail();
  if (v.code === "WRITE_OUTCOME_UNCERTAIN" && !v.writeOutcomeUncertain) fail();
  if (v.status === "not-run" && (v.code !== "NOT_RUN" || v.stages.length || v.writeOutcomeUncertain || v.pendingRequests || v.pendingInspections || Object.values(v.counts).some(n => n !== 0))) fail();
  if (v.status === "failed" && ["PASSED", "NOT_RUN"].includes(v.code)) fail();
  if (v.status === "passed" && (v.code !== "PASSED" || v.writeOutcomeUncertain || v.pendingRequests || v.pendingInspections || v.stages.length !== order.length || v.stages.some(s => !s.passed) || Object.entries(pass).some(([k, n]) => v.counts[k] !== n) || v.counts.sqlInspections < 8 || v.counts.browserRequests < v.counts.loginPosts + v.counts.passwordPosts)) fail();
  return v;
}
/** Infra and functional proof are independent; teardown never promotes a case. */
export function validateAdminBrowserCiReport(input) {
  const v = closedAdminBrowserValue(input);
  if (!exact(v, ["schemaVersion", "scenario", "sourceSha", "status", "code", "sourceHashes", "dependencyHashes", "cases", "limitations", "writeOutcomeUncertain"]) || v.schemaVersion !== 1 || v.scenario !== "admin-browser-local-ci" || !/^[a-f0-9]{40}$/.test(v.sourceSha) || !["passed", "failed"].includes(v.status) || !ADMIN_BROWSER_CODES.includes(v.code) || typeof v.writeOutcomeUncertain !== "boolean" || !exact(v.limitations, ADMIN_BROWSER_LIMITATIONS) || Object.values(v.limitations).some(b => b !== false) || !Array.isArray(v.cases) || v.cases.length !== 2) fail();
  const sourcesAbsent=Array.isArray(v.sourceHashes)&&Array.isArray(v.dependencyHashes)&&!v.sourceHashes.length&&!v.dependencyHashes.length;
  if(sourcesAbsent&&(v.status!=="failed"||!["ENVIRONMENT_REFUSED","SOURCE_REFUSED","PROCESS_UNCONFIRMED"].includes(v.code)||v.cases.some(e=>e.report.status!=="not-run")))fail();
  for (const [i,rows] of [v.sourceHashes, v.dependencyHashes].entries()) {
    if (!Array.isArray(rows) || rows.length !== (sourcesAbsent?0:i===0?ADMIN_BROWSER_SOURCE_COUNTS.git:ADMIN_BROWSER_SOURCE_COUNTS.dependencies) || new Set(rows.map(r => r.path)).size !== rows.length || rows.some(r => !exact(r, ["path", "sha256", "bytes"]) || !/^[A-Za-z0-9_@()./-]+$/.test(r.path) || r.path.includes("..") || r.path.startsWith("/") || r.path.startsWith("node_modules/")!==(i===1) || !/^[a-f0-9]{64}$/.test(r.sha256) || !integer(r.bytes, 16777216) || (r.path==="node_modules/server-only/empty.js"?r.bytes!==0||r.sha256!=="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855":r.bytes===0))) fail();
  }
  for (let i = 0; i < 2; i++) {
    const e = v.cases[i];
    const entryKeys = ["case", "report", "infrastructure", "migrationsApplied", "catalogueChecks", "nextStopSignal"];
    if (!(exact(e,entryKeys) || exact(e,[...entryKeys,"nextStopDiagnostic"])) || Object.hasOwn(e,"nextStopDiagnostic") && !acceptsParentNextStopDiagnostic(e.nextStopDiagnostic) || e.case !== ADMIN_BROWSER_CASES[i] || !exact(e.infrastructure, ADMIN_BROWSER_INFRA_KEYS) || Object.values(e.infrastructure).some(b => typeof b !== "boolean") || !integer(e.migrationsApplied, 26) || ![0, 1720].includes(e.catalogueChecks) || !["NONE", "SIGTERM", "SIGKILL", "UNCONFIRMED"].includes(e.nextStopSignal)) fail();
    const c = validateAdminBrowserCase(e.report); if (c.case !== e.case || c.writeOutcomeUncertain && !v.writeOutcomeUncertain || i === 1 && v.cases[0].report.status !== "passed" && c.status !== "not-run") fail();
  }
  if (v.status === "passed" && (v.code !== "PASSED" || v.writeOutcomeUncertain || v.cases.some(e => e.report.status !== "passed" || e.migrationsApplied !== 26 || e.catalogueChecks !== 1720 || Object.values(e.infrastructure).some(b => !b) || e.nextStopSignal === "UNCONFIRMED"))) fail();
  if (v.status === "failed" && ["PASSED", "NOT_RUN"].includes(v.code)) fail();
  return v;
}
