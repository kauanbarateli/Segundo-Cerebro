export type AdminBrowserKind = "BLOCK_LIVE_BROWSER" | "FIRST_FORCED_BROWSER";
export type AdminAuthCheckpoint = "AUTH_DOCUMENT_REFUSED" | "AUTH_FORM_REFUSED" | "AUTH_POST_REFUSED" | "AUTH_DESTINATION_REFUSED" | "AUTH_READY_REFUSED" | "AUTH_SESSION_REFUSED";
export type AdminHttpPendingClass = "ASSET" | "FETCH" | "API" | "DOCUMENT" | "AUTH" | "OTHER";
export type AdminHttpPendingCode = `QUIESCENCE_HTTP_${AdminHttpPendingClass}_${"RESPONSE" | "NO_RESPONSE"}_PENDING` | "QUIESCENCE_HTTP_DETAILS_MIXED_PENDING";
export type AdminQuiescenceCode = "QUIESCENCE_UI_PENDING" | "QUIESCENCE_HMR_GET_PENDING" | "QUIESCENCE_HTTP_PENDING" | "QUIESCENCE_MIXED_PENDING" | AdminHttpPendingCode;
export type AdminBrowserCode = "PASSED" | "NOT_RUN" | "ENVIRONMENT_REFUSED" | "SOURCE_REFUSED" | "SQL_REFUSED" | "OWNERSHIP_REFUSED" | "AUTH_NOT_PROVEN" | "SAGA_NOT_PROVEN" | "BROWSER_REFUSED" | "REQUEST_REFUSED" | "TRANSPORT_FAILED" | "DEADLINE_EXCEEDED" | "WRITE_OUTCOME_UNCERTAIN" | "CLEANUP_NOT_PROVEN" | "PROCESS_UNCONFIRMED" | "TEARDOWN_UNCONFIRMED" | "REPORT_REFUSED" | AdminAuthCheckpoint | AdminQuiescenceCode;
export interface AdminBrowserCounts { browserRequests:number; ownedSdkRequests:number; nextProbeRequests:number; sqlInspections:number; fixturesCreated:number; contexts:number; loginPosts:number; passwordPosts:number; adminRpc:number; adminAuth:number; pageProbes:number; apiProbes:number; cleanupHttp:number; deleted:number; absenceReads:number; revocationAcks:number; alreadyRevoked:number; cleanupSql:number; }
export interface AdminBrowserCase { readonly case:AdminBrowserKind; readonly status:"passed"|"failed"|"not-run"; readonly code:AdminBrowserCode; readonly stages:readonly {readonly stage:string; readonly passed:boolean}[]; readonly counts:Readonly<AdminBrowserCounts>; readonly writeOutcomeUncertain:boolean; readonly pendingRequests:number; readonly pendingInspections:number; }
export interface AdminBrowserHash {readonly path:string; readonly sha256:string; readonly bytes:number;}
export interface AdminBrowserCiReport {readonly schemaVersion:1; readonly scenario:"admin-browser-local-ci"; readonly sourceSha:string; readonly status:"passed"|"failed"; readonly code:AdminBrowserCode; readonly sourceHashes:readonly AdminBrowserHash[]; readonly dependencyHashes:readonly AdminBrowserHash[]; readonly cases:readonly {readonly case:AdminBrowserKind; readonly report:AdminBrowserCase; readonly infrastructure:Readonly<Record<string,boolean>>; readonly migrationsApplied:number; readonly catalogueChecks:0|1254; readonly nextStopSignal:"NONE"|"SIGTERM"|"SIGKILL"|"UNCONFIRMED"}[]; readonly limitations:Readonly<Record<string,false>>; readonly writeOutcomeUncertain:boolean; }
export const ADMIN_BROWSER_CASES:readonly AdminBrowserKind[];
export const ADMIN_BROWSER_LIMITS:Readonly<{browserRequests:1024;ownedSdkRequests:512;sqlInspections:64;responseBytes:1048576;requestMs:15000;caseMs:360000}>;
export const ADMIN_BROWSER_SOURCE_COUNTS:Readonly<{git:338;dependencies:50}>;
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
