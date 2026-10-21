export type AdminBrowserKind = "BLOCK_LIVE_BROWSER" | "FIRST_FORCED_BROWSER";
export type WorkerNextStopReason = "NOT_CALLED"|"EMPTY_PENDING"|"NONE"|"ALREADY_ATTEMPTED"|"CLOCK_READ_FAILED"|"GATE_READ_FAILED"|"CLOCK_INVALID"|"CLOCK_ROLLBACK"|"DEADLINE_REACHED"|"IDENTITY_MISMATCH"|"GATE_SHAPE_INVALID"|"STAGE_NOT_PASSED"|"OUTCOME_UNKNOWN"|"UI_PENDING"|"SDK_PENDING"|"SQL_PENDING"|"NON_READ_PENDING"|"PENDING_MAP_INVALID"|"PENDING_EMPTY"|"PENDING_LIMIT"|"PENDING_ENTRY_INVALID"|"STATIC_AUTHORITY_MISSING"|"ORIGINAL_ROW_MISMATCH"|"DISPATCH_CLOCK_READ_FAILED"|"DISPATCH_CLOCK_INVALID"|"DISPATCH_CLOCK_ROLLBACK"|"DISPATCH_DEADLINE_REACHED"|"WRITE_RETURNED_FALSE"|"WRITE_THROWN";
export interface WorkerNextStopDiagnostic {readonly outcome:"NOT_ATTEMPTED"|"NOT_NEEDED"|"INELIGIBLE"|"EMITTED"|"REFUSED";readonly reason:WorkerNextStopReason;}
/** Original stop Promise state, observed after the worker run settled; no EOF proof. */
export interface ParentNextStopDiagnostic {readonly phase:"after-worker-run-settlement-before-finally";readonly requested:boolean|null;readonly settled:boolean|null;readonly resolvedTrue:boolean|null;}
export function acceptsWorkerNextStopDiagnostic(input:unknown):boolean;
export function acceptsParentNextStopDiagnostic(input:unknown):boolean;
export type AdminAuthCheckpoint = "AUTH_DOCUMENT_REFUSED" | "AUTH_FORM_REFUSED" | "AUTH_POST_REFUSED" | "AUTH_DESTINATION_REFUSED" | "AUTH_READY_REFUSED" | "AUTH_SESSION_REFUSED";
export type AdminHttpPendingClass = "ASSET" | "FETCH" | "API" | "DOCUMENT" | "AUTH" | "OTHER";
export type AdminHttpPendingCode = `QUIESCENCE_HTTP_${AdminHttpPendingClass}_${"RESPONSE" | "NO_RESPONSE"}_PENDING` | "QUIESCENCE_HTTP_DETAILS_MIXED_PENDING";
export type AdminQuiescenceCode = "QUIESCENCE_UI_PENDING" | "QUIESCENCE_HMR_GET_PENDING" | "QUIESCENCE_HTTP_PENDING" | "QUIESCENCE_MIXED_PENDING" | AdminHttpPendingCode;
export type AdminBrowserCode = "PASSED" | "NOT_RUN" | "ENVIRONMENT_REFUSED" | "SOURCE_REFUSED" | "SQL_REFUSED" | "OWNERSHIP_REFUSED" | "AUTH_NOT_PROVEN" | "SAGA_NOT_PROVEN" | "BROWSER_REFUSED" | "REQUEST_REFUSED" | "TRANSPORT_FAILED" | "DEADLINE_EXCEEDED" | "WRITE_OUTCOME_UNCERTAIN" | "CLEANUP_NOT_PROVEN" | "PROCESS_UNCONFIRMED" | "TEARDOWN_UNCONFIRMED" | "REPORT_REFUSED" | AdminAuthCheckpoint | AdminQuiescenceCode;
export interface AdminBrowserCounts { browserRequests:number; ownedSdkRequests:number; nextProbeRequests:number; sqlInspections:number; fixturesCreated:number; contexts:number; loginPosts:number; passwordPosts:number; adminRpc:number; adminAuth:number; ownSessionsRpc:number; ownSessionsViews:number; ownSessionsReloads:number; pageProbes:number; apiProbes:number; cleanupHttp:number; deleted:number; absenceReads:number; revocationAcks:number; alreadyRevoked:number; cleanupSql:number; }
interface BrowserProtocolObservationBase {readonly identity:"exact-server-request"|"unavailable"|"mixed";readonly order:"terminal-before-pause"|"pause-before-terminal"|"no-pause-observed"|"no-terminal-observed"|"unavailable"|"mixed";readonly terminal:"finished"|"failed"|"not-observed"|"unavailable"|"mixed";readonly publicTerminal:"finished"|"failed"|"not-observed"|"unavailable"|"mixed";}
interface BrowserProtocolMembership {readonly managerEntry:"same-request"|"absent"|"other-request"|"unavailable"|"mixed";readonly sessionRegistered:"registered"|"removed"|"unavailable"|"mixed";}
export type BrowserProtocolObservation = BrowserProtocolObservationBase | (BrowserProtocolObservationBase & BrowserProtocolMembership) | (BrowserProtocolObservationBase & BrowserProtocolMembership & {readonly fetchCommand:"continue"|"abort"|"unobserved"|"unavailable"|"mixed";readonly fetchOutcome:"pending"|"resolved"|"rejected"|"unobserved"|"unavailable"|"mixed"});
export function acceptsBrowserProtocolObservation(input:unknown):boolean;
export type AdminQuiescenceDetail = AdminQuiescenceDetailBase | (AdminQuiescenceDetailBase & {readonly introducedStage:string;readonly routeOutcome:"continue-ack"|"abort-ack"|"pending"|"unobserved"|"mixed";readonly protocol?:BrowserProtocolObservation|null});
export interface AdminQuiescenceDetailBase { readonly phase:"before-stop"|"after-stop"|"after-blank"|"after-close"; readonly pathClass:"login"|"password-change"|"other-auth"|"other-authorized"|"mixed"|"unavailable"; readonly resource:"document"|"fetch"|"xhr"|"other"|"mixed"|"unavailable"; readonly frame:"main"|"child"|"mixed"|"unavailable"; readonly stopAck:"owned-page"|"not-enumerated"|"unobserved"|"mixed"; }
export interface AdminAuthPostFailure {readonly operation:"login"|"password"|"other";readonly resource:"document"|"fetch"|"xhr"|"other"|"unavailable";readonly failure:"aborted"|"failed"|"other"|"unavailable";readonly response:"unobserved"|"200"|"303"|"other";readonly contentType:"unobserved"|"flight"|"html"|"other";}
export interface AdminHttpProbeFailure {readonly operation:"capture-read"|"tasks-read"|"settings-read"|"settings-write"|"projects-read"|"other";readonly status:"200"|"401"|"403"|"409"|"429"|"500"|"503"|"other";readonly cache:"no-store"|"other";readonly contentType:"json"|"html"|"other";readonly json:"not-read"|"invalid"|"refused";}
export type AdminNextProbeRefusal="lifecycle"|"owner"|"cookies-shape"|"cookies-count"|"cookie-name"|"auth-cookie-empty"|"flow-cookie-empty"|"hmr-cookie-empty"|"cookie-value"|"cookie-duplicate"|"catalogue"|"body"|"cookies-unavailable";
export interface AdminBrowserCase { readonly case:AdminBrowserKind; readonly status:"passed"|"failed"|"not-run"; readonly code:AdminBrowserCode; readonly stages:readonly {readonly stage:string; readonly passed:boolean}[]; readonly counts:Readonly<AdminBrowserCounts>; readonly writeOutcomeUncertain:boolean; readonly pendingRequests:number; readonly pendingInspections:number; readonly quiescenceDetail:AdminQuiescenceDetail|null; readonly nextStopDiagnostic?:WorkerNextStopDiagnostic|null; readonly authPostFailure?:AdminAuthPostFailure|null;readonly httpProbeFailure?:AdminHttpProbeFailure|null;readonly nextProbeRefusal?:AdminNextProbeRefusal|null; }
export interface AdminBrowserHash {readonly path:string; readonly sha256:string; readonly bytes:number;}
export interface AdminBrowserCiReport {readonly schemaVersion:1; readonly scenario:"admin-browser-local-ci"; readonly sourceSha:string; readonly status:"passed"|"failed"; readonly code:AdminBrowserCode; readonly sourceHashes:readonly AdminBrowserHash[]; readonly dependencyHashes:readonly AdminBrowserHash[]; readonly cases:readonly {readonly case:AdminBrowserKind; readonly report:AdminBrowserCase; readonly infrastructure:Readonly<Record<string,boolean>>; readonly migrationsApplied:number; readonly catalogueChecks:0|1269; readonly nextStopSignal:"NONE"|"SIGTERM"|"SIGKILL"|"UNCONFIRMED";readonly nextStopDiagnostic?:ParentNextStopDiagnostic|null}[]; readonly limitations:Readonly<Record<string,false>>; readonly writeOutcomeUncertain:boolean; }
export const ADMIN_BROWSER_CASES:readonly AdminBrowserKind[];
export const ADMIN_BROWSER_LIMITS:Readonly<{browserRequests:1024;ownedSdkRequests:512;sqlInspections:64;responseBytes:1048576;requestMs:15000;caseMs:360000}>;
export const ADMIN_BROWSER_SOURCE_COUNTS:Readonly<{git:379;dependencies:61}>;
export const ADMIN_BROWSER_STAGES:Readonly<Record<AdminBrowserKind,readonly string[]>>;
export const ADMIN_BROWSER_CODES:readonly AdminBrowserCode[];
export const ADMIN_AUTH_CHECKPOINTS:readonly AdminAuthCheckpoint[];
export const ADMIN_QUIESCENCE_CODES:readonly AdminQuiescenceCode[];
export const ADMIN_HTTP_PENDING_CLASSES:readonly AdminHttpPendingClass[];
export const ADMIN_HTTP_PENDING_CODES:readonly AdminHttpPendingCode[];
export function isAdminAuthActionRequest(url:unknown,method:unknown):boolean;
export function acceptAdminAuthActionResponse(url:unknown,method:unknown,status:unknown):boolean;
export function runAdminAuthCheckpoint<T>(state:{fail(code:string):void;unknown():void},code:AdminAuthCheckpoint,operation:()=>Promise<T>,postObserved?:()=>boolean):Promise<T>;
export const ADMIN_BROWSER_COUNT_KEYS:readonly (keyof AdminBrowserCounts)[];
export const ADMIN_BROWSER_PASS_COUNTS:Readonly<Record<AdminBrowserKind,Readonly<Partial<AdminBrowserCounts>>>>;
export const ADMIN_BROWSER_INFRA_KEYS:readonly string[];
export const ADMIN_BROWSER_LIMITATIONS:readonly string[];
export function closedAdminBrowserValue(value:unknown):unknown;
export function blankAdminBrowserCase(kind:AdminBrowserKind):AdminBrowserCase;
export function validateAdminBrowserCase(value:unknown):AdminBrowserCase;
export function validateAdminBrowserCiReport(value:unknown):AdminBrowserCiReport;
