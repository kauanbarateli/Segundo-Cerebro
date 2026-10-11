import type{DriveState,DriveAuthPostStageCode,DriveAuthRequestFailureCode,DriveAuthActionRedirect,DriveAuthContentType,DriveAuthDocumentAfterResponse,DriveAuthPostFailure,DriveTextReadFailure}from"./drive-browser-contract.mjs";
export{driveRefuse}from"./drive-browser-contract.mjs";
export const DRIVE_APP:"http://127.0.0.1:3117",DRIVE_API:"http://127.0.0.1:54321";
export const DRIVE_MAX_BYTES:4096,DRIVE_QUOTA_BYTES:32768;
export interface DriveContext{namespace:string;sourceSha:string;systemIdentifier:string;projectId:string;publishableKey:string;secretKey:string;reportPath:string}
export interface DriveOwner{id:string;email:string;password:string}
export interface DriveSession{sessionId:string;accessToken:string;expiresAt:number}
export interface DriveFolder{id:string;user_id:string;name:string;parent_id:string|null;deleted_at:string|null;deletion_batch_id:string|null}
export interface DriveFile{id:string;user_id:string;name:string;folder_id:string|null;mime:string;bytes:number;sha256:string;storage_path:string;deleted_at:string|null;deletion_batch_id:string|null;purged_at:null;kind:"drive"}
export interface DriveUpload{id:string;user_id:string;name:string;folder_id:string|null;status:"reserved"|"finalized";staging_path:string;final_path:string;max_bytes:4096;quota_bytes:32768;file_id:string|null;lease_id:null;lease_until:null}
export interface DriveSql{provenance:Record<string,unknown>;users:Array<{id:string;email:string;metadata:Record<string,unknown>;anonymous:false;deleted:null}>;sessions:Array<{id:string;user_id:string}>;refreshUsers:string[];roles:Array<{user_id:string;role:"user"}>;moderation:Array<{user_id:string;status:"active";must_change_password:false}>;profiles:string[];preferences:string[];folders:DriveFolder[];files:DriveFile[];uploads:DriveUpload[];objects:Array<{id:string;bucket_id:string;name:string}>;usageBytes:number;events:Array<{user_id:string;entity_type:string;action:string}>;receipts:Array<{user_id:string;command:string}>;otherRows:0}
export interface DriveCookie{name:string;value:string}
export interface DriveHarness{readonly state:DriveState;readonly owner:DriveOwner|null;fixture():Promise<DriveOwner>;verifySession(hint:DriveSession):Promise<DriveSession>;inspect():Promise<DriveSql>;nextJson(path:string,body:unknown,cookies:DriveCookie[],expected?:number):Promise<unknown>;oversize(cookies:DriveCookie[]):Promise<void>;cleanup():Promise<void>;metadata():{pendingRequests:number;pendingInspections:number};dispose():Promise<void>}
export function driveEnvironment(env:Readonly<Record<string,string|undefined>>,platform?:string):Readonly<DriveContext>;
export function acceptDriveBrowserRequest(value:string,method:string,ownerId?:string):boolean;
export function isDriveBrowserReadCancellationRequest(value:unknown,method:unknown,ownerId?:string):boolean;
export function closedDriveOperation<T>(fn:()=>Promise<T>,code?:string):Promise<T>;
export function classifyDriveAuthRequestFailure(value:unknown):DriveAuthRequestFailureCode;
export function classifyDriveAuthResponseHeaders(actionRedirect:unknown,contentType:unknown):Readonly<{actionRedirect:DriveAuthActionRedirect;contentType:DriveAuthContentType}>;
export function observeDriveAuthMainDocument(previous:unknown,observe:()=>unknown):DriveAuthDocumentAfterResponse;
export interface DriveAuthPageObservation{request(request:object,linked:boolean):void;response(request:object,linked:boolean):void;snapshot(request:object):Readonly<Pick<DriveAuthPostFailure,"pageClosedAfterResponse"|"pageCrashedAfterResponse"|"mainFrameAfterResponse">>}
export function createDriveAuthPageObservation(install:{close:(listener:()=>void)=>void;crash:(listener:()=>void)=>void;frameNavigated:(listener:(observe:()=>unknown)=>void)=>void}):DriveAuthPageObservation;
export function recordDriveAuthRequestFailure(state:DriveState,failureText:unknown,observe:()=>unknown):void;
export function driveEmptyAuthDecision(value:unknown,revealed:unknown):"done"|"show"|"hide"|"wait";
export function isDriveAuthRedirectResponse(url:unknown,method:unknown,status:unknown,location:unknown,actionRedirect:unknown):boolean;
export function classifyDriveTextReadResponse(url:unknown,method:unknown,status:unknown,ownerId?:unknown):Readonly<Omit<DriveTextReadFailure,"phase">>|null;
export function inspectDriveBrowserTextResponse(state:DriveState,ownedOperations:Set<Promise<unknown>>,response:{url:string;method:string;status:number;headers:()=>Promise<unknown>;finished:()=>Promise<unknown>;body:()=>Promise<Buffer>},hasCanary:(value:string)=>boolean,timers?:{setTimer?:(callback:()=>void,milliseconds:number)=>unknown;clearTimer?:(timer:unknown)=>void},ownerId?:string):Promise<void>;
export function runDriveAuthPostStage<T>(state:DriveState,ownedOperations:Set<Promise<unknown>>,code:DriveAuthPostStageCode,operation:()=>Promise<T>,postObserved?:()=>boolean,timers?:{setTimer?:(callback:()=>void,milliseconds:number)=>unknown;clearTimer?:(timer:unknown)=>void}):Promise<T>;
export function sameDriveValue(a:unknown,b:unknown):boolean;
export function driveHash(bytes:Uint8Array):string;
export function createDriveState(options?:{now?:()=>number;caseMs?:number}):DriveState;
export interface DriveIoSpec{mode:"sdk"|"cap"|"next";url:string;method:string;write:boolean;key?:string;token?:string;cookie?:string;ownerId?:string;body?:unknown;checkBody?:(body:unknown,headers:Headers)=>void|Promise<void>;checkResponse?:(status:number,bytes:Buffer,headers:Headers)=>void}
export interface DriveIo{transport(input:string|URL|Request,init?:RequestInit):Promise<Response>;request<T>(spec:DriveIoSpec,operation:()=>Promise<T>):Promise<T>;metadata():{pending:number;permitted:boolean};settle():Promise<boolean>;close():void}
export function createDriveIo(state:DriveState,nativeFetch?:typeof fetch,options?:{requestMs?:number}):DriveIo;
export function driveInspectionSql(ctx:DriveContext):string;
export function acceptDriveSql(input:unknown,ctx:DriveContext,owner:DriveOwner|null):DriveSql;
export function createDriveHarness(ctx:DriveContext,options:{query:(input:string)=>Promise<unknown>;cleanupAllowed:()=>boolean;transport?:typeof fetch}):Promise<DriveHarness>;
