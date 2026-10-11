import type { AdminBrowserKind, AdminBrowserCase, AdminBrowserCounts, AdminBrowserCode, AdminQuiescenceCode } from "./admin-browser-contract.mjs";
import type { Buffer } from "node:buffer";
export const ADMIN_BROWSER_APP:"http://127.0.0.1:3117";
export const ADMIN_BROWSER_API:"http://127.0.0.1:54321";
export const ADMIN_BROWSER_PAGES:readonly string[];
export const ADMIN_BROWSER_PROBES:readonly {readonly method:string;readonly path:string;readonly body:Readonly<Record<string,unknown>>|null}[];
export const ADMIN_BROWSER_AUTOMATIC:readonly {readonly method:string;readonly path:string;readonly authority:string}[];
export const ADMIN_BROWSER_SQL_QUERIES:readonly string[];
export const ADMIN_BROWSER_INSPECTION_ORDER:Readonly<Record<AdminBrowserKind,readonly string[]>>;
export interface AdminBrowserContext {readonly case:AdminBrowserKind;readonly namespace:string;readonly sourceSha:string;readonly projectId:string;readonly systemIdentifier:string;readonly publishableKey:string;readonly secretKey:string;readonly commitmentSecret:string;readonly reportPath:string;}
export interface AdminBrowserSession {id:string;email:string;accessToken:string;sessionId:string;expiresAt:number;}
export interface AdminBrowserOwner {id:string;email:string;password:string;operationId?:string;current?:AdminBrowserSession;}
export interface AdminBrowserState {readonly value:{case:AdminBrowserKind;status:"passed"|"failed"|"not-run";code:AdminBrowserCode;stages:{stage:string;passed:boolean}[];counts:AdminBrowserCounts;writeOutcomeUncertain:boolean;pendingRequests:number;pendingInspections:number};active():void;count(key:keyof AdminBrowserCounts):void;stage(stage:string):void;unknown():void;fail(code:string):void;finish(requests:number,inspections:number):AdminBrowserCase;}
export interface AdminBrowserProof {readonly provenance:Readonly<Record<string,unknown>>;readonly users:readonly Readonly<Record<string,unknown>>[];readonly sessions:readonly {readonly id:string;readonly user_id:string}[];readonly refreshTokens:readonly {readonly user_id:string;readonly session_id:string;readonly revoked:boolean}[];readonly roles:readonly {readonly user_id:string;readonly role:string}[];readonly moderation:readonly {readonly user_id:string;readonly status:string;readonly must_change_password:boolean}[];readonly entitlements:readonly Readonly<Record<string,unknown>>[];readonly operations:readonly Readonly<Record<string,unknown>>[];readonly audit:readonly Readonly<Record<string,unknown>>[];readonly receipts:readonly Readonly<Record<string,unknown>>[];readonly events:readonly Readonly<Record<string,unknown>>[];readonly personalRows:0;}
export function adminBrowserRefuse(code:string):never;
export function closedBrowserOperation<T>(operation:()=>Promise<T>,code?:string):Promise<T>;
export function isAdminCanonicalHmrGet(url:unknown,method:unknown):boolean;
export function isAdminBrowserReadCancellationRequest(url:unknown,method:unknown):boolean;
export interface AdminBrowserPageRelease {readonly ui:number;readonly sdk:number;readonly sql:number;readonly nonRead:number;readonly unknown:boolean;}
export function adminBrowserPageReleaseCode(input:unknown):"WRITE_OUTCOME_UNCERTAIN"|"QUIESCENCE_UI_PENDING"|"PROCESS_UNCONFIRMED"|null;
export interface AdminBrowserPending {readonly ui:number;readonly hmrGet:number;readonly otherHttp:number;}
export function adminBrowserPendingCode(input:unknown):AdminQuiescenceCode|null;
export function waitForAdminBrowserIoQuiet(read:()=>AdminBrowserPending,options?:{timeoutMs?:number;now?:()=>number;pause?:(ms:number)=>Promise<void>}):Promise<AdminQuiescenceCode|null>;
export function adminBrowserEnvironment(env:Readonly<Record<string,string|undefined>>,platform?:string):AdminBrowserContext;
export function acceptAdminBrowserRequest(url:string,method:string):boolean;
export function adminBrowserInspectionInput(context:Pick<AdminBrowserContext,"namespace"|"sourceSha"|"projectId"|"systemIdentifier">,query:string):string;
export function acceptAdminBrowserProof(input:unknown,context:AdminBrowserContext,owners:readonly AdminBrowserOwner[]):AdminBrowserProof;
export function adminBrowserBootstrapInput(context:AdminBrowserContext,owners:readonly AdminBrowserOwner[],sessions:readonly AdminBrowserSession[]):string;
export function createAdminBrowserState(kind:AdminBrowserKind,options?:{now?:()=>number;deadlineMs?:number}):AdminBrowserState;
export interface AdminBrowserTransport {permit(slot:{url:string;method:string;key:string;token:string;check:(body:unknown)=>boolean;write?:boolean;category?:keyof AdminBrowserCounts}):void;transport(input:RequestInfo|URL,init?:RequestInit):Promise<Response>;clearCachedJwksPermit():void;metadata():{pending:number;permitted:boolean;last:{status:number;code:string|null}|null};settle():Promise<boolean>;close():void;}
export function createAdminBrowserTransport(state:AdminBrowserState,nativeFetch?:typeof fetch):AdminBrowserTransport;
export interface AdminBrowserNextRequest {readonly path:string;readonly method:string;readonly body:Readonly<Record<string,unknown>>|null;readonly cookies:readonly {readonly name:string;readonly value:string}[];readonly userId:string;}
export interface AdminBrowserNextTransport {request(input:AdminBrowserNextRequest):Promise<{status:number;contentType:string|null;cacheControl:string|null;location:string|null;bytes:Buffer}>;metadata():{pending:number};close():void;settle():Promise<boolean>;}
export function createAdminBrowserNextTransport(state:AdminBrowserState,nativeFetch?:typeof fetch):AdminBrowserNextTransport;
export function acceptsAdminBrowserDenial(path:string,status:number,value:unknown):boolean;
export function createAdminBrowserHarness(context:AdminBrowserContext,options:{query:(input:string)=>Promise<unknown>;write:(input:string)=>Promise<void>;transport?:typeof fetch;cleanupAllowed:()=>boolean}):Promise<{state:AdminBrowserState;io:AdminBrowserTransport;nextIo:AdminBrowserNextTransport;owners:AdminBrowserOwner[];sessions:AdminBrowserSession[];ordinaryFixture():Promise<AdminBrowserOwner>;verifySession(owner:AdminBrowserOwner,hint:Omit<AdminBrowserSession,"id"|"email">,role:"user"|"master"|"forced"):Promise<AdminBrowserSession>;bootstrap():Promise<void>;runAdmin():Promise<AdminBrowserOwner>;inspect(query:string):Promise<AdminBrowserProof>;deniedToken(session:AdminBrowserSession):Promise<void>;passwordProof(owner:AdminBrowserOwner,prior:AdminBrowserSession):Promise<string>;cleanup():Promise<void>;metadata():{pendingRequests:number;pendingInspections:number;terminalKnown:boolean;inventoryComplete:boolean};dispose():Promise<void>}>;
