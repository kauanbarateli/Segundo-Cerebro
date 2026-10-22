export type DriveAuthCheckpoint="AUTH_DOCUMENT_REFUSED"|"AUTH_FORM_REFUSED"|"AUTH_POST_REFUSED"|"AUTH_DESTINATION_REFUSED"|"AUTH_READY_REFUSED"|"AUTH_SESSION_REFUSED";
export type DriveAuthPostStageCode="AUTH_POST_RESPONSE_REFUSED"|"AUTH_POST_CLICK_REFUSED"|"AUTH_POST_FINISH_REFUSED";
export type DriveAuthRequestFailureCode="AUTH_POST_REQUEST_FAILED"|"AUTH_POST_ABORTED"|"AUTH_POST_CONNECTION_RESET"|"AUTH_POST_CONNECTION_REFUSED"|"AUTH_POST_NETWORK_FAILED";
export type DriveAuthPostCode=DriveAuthPostStageCode|DriveAuthRequestFailureCode;
export type DriveAuthFormCode="AUTH_EMPTY_BASELINE_REFUSED"|"AUTH_EMPTY_REVEAL_REFUSED"|"AUTH_EMPTY_CONCEAL_REFUSED"|"AUTH_FORM_FILL_REFUSED";
export type DriveEmptyAuthState="hidden"|"shown"|"unready";
export type DriveTextResponseCode="AUTH_REDIRECT_HEADER_REFUSED"|"TEXT_BODY_READ_REFUSED"|"TEXT_BODY_DEADLINE_REFUSED";
export type DriveAuthActionRedirect="none"|"drive-push"|"drive-replace"|"other"|"unavailable";
export type DriveAuthContentType="none"|"rsc"|"html"|"plain"|"other"|"unavailable";
export type DriveAuthDocumentAfterResponse="none"|"login"|"drive"|"other"|"unavailable";
export type DriveAuthMainFrameAfterResponse="none"|"login"|"drive"|"other"|"unavailable";
export type DriveQuiescenceCode="QUIESCENCE_UI_PENDING"|"QUIESCENCE_HMR_GET_PENDING"|"QUIESCENCE_HTTP_PENDING"|"QUIESCENCE_MIXED_PENDING";
export type DriveCode="PASSED"|"NOT_RUN"|"ENVIRONMENT_REFUSED"|"SOURCE_REFUSED"|"REPORT_REFUSED"|"PROCESS_UNCONFIRMED"|"REQUEST_REFUSED"|"RESPONSE_REFUSED"|"AUTH_NOT_PROVEN"|"SQL_REFUSED"|"OWNERSHIP_REFUSED"|"BROWSER_REFUSED"|"DRIVE_NOT_PROVEN"|"CLEANUP_NOT_PROVEN"|"TRANSPORT_FAILED"|"DEADLINE_EXCEEDED"|"WRITE_OUTCOME_UNCERTAIN"|DriveAuthCheckpoint|DriveAuthPostCode|DriveAuthFormCode|DriveTextResponseCode|DriveQuiescenceCode;
export type DriveStage="fixture"|"browser-bound"|"folders-created"|"uploads-persisted"|"download-verified"|"server-rejections"|"moves-cycle"|"trash-restored"|"usage-verified"|"contexts-closed"|"storage-absent"|"auth-revoked"|"auth-absent"|"final-sql";
export type DriveCount="fixturesCreated"|"contexts"|"loginPosts"|"pickerUploads"|"dropUploads"|"filesFinalized"|"persistenceChecks"|"downloads"|"serverOversize"|"serverExecutable"|"foldersCreated"|"fileMoves"|"folderMoves"|"cycleGuiChecks"|"cycleApiDenials"|"trash"|"restore"|"usageChecks"|"storageDeletes"|"storageAbsenceReads"|"authRevocations"|"authDeletes"|"authAbsenceReads"|"browserRequests"|"ownedSdkRequests"|"nextProbeRequests"|"sqlInspections";
export type DriveLimitation="hostedVerified"|"httpsCookieVerified"|"signedGetCookieAbsenceCertified"|"exifBrowserCertified"|"allNextInternalFetchesMeasured"|"allDescendantsForcelessCertified";
// Page fields describe events before the first failure, not cancellation cause or navigation authority.
export interface DriveAuthPostFailure{resourceType:"document"|"fetch"|"xhr"|"other";observedResponseStatus:"none"|"200"|"303"|"other";location:"login"|"drive"|"other";redirectedFrom:boolean;redirectedTo:boolean;closeAttempted:boolean;routeAbortAttempted:boolean;actionRedirect:DriveAuthActionRedirect;contentType:DriveAuthContentType;documentAfterResponse:DriveAuthDocumentAfterResponse;pageClosedAfterResponse:boolean|null;pageCrashedAfterResponse:boolean|null;mainFrameAfterResponse:DriveAuthMainFrameAfterResponse}
// Closed response/request buckets explain the first read failure, never its cause.
// unavailable means the resource type was not observed; it gives no transport authority.
export interface DriveTextReadFailure{phase:"headers"|"body"|"timer";responseClass:"auth-post"|"asset"|"page"|"api"|"other-authorized";statusBucket:"2xx"|"3xx"|"other";requestMethod:"GET"|"POST"|"other";route:"login"|"drive"|"design-system"|"other-authorized";resourceType:"document"|"fetch"|"xhr"|"other"|"unavailable"}
// A separately qualified CDP event may arrive after the original failure snapshot.
// bodyProgress none means no positive byte progress observed with coverage, not an empty RSC body.
export interface DriveAuthNetworkFailure{observedAt:"before-first-failure"|"after-first-failure";canceled:boolean;blockedReason:"none"|"csp"|"inspector"|"other";bodyProgress:"none"|"some"}
export interface DriveCase{schemaVersion:1;scenario:"drive-browser-local-case";status:"not-run"|"failed"|"passed";code:DriveCode;stages:DriveStage[];counts:Record<DriveCount,number>;writeOutcomeUncertain:boolean;pendingRequests:number;pendingInspections:number;authPostFailure:DriveAuthPostFailure|null;textReadFailure:DriveTextReadFailure|null;authNetworkFailure:DriveAuthNetworkFailure|null;limitations:Record<DriveLimitation,false>}
export interface DriveState{readonly value:DriveCase;active():void;fail(code:string):void;unknown():void;count(key:DriveCount):void;stage(stage:DriveStage):void;finish(requests:number,inspections:number):DriveCase}
export const DRIVE_CODES:readonly DriveCode[];
export const DRIVE_AUTH_CHECKPOINTS:readonly DriveAuthCheckpoint[];
export const DRIVE_AUTH_POST_CODES:readonly DriveAuthPostCode[];
export const DRIVE_AUTH_FORM_CODES:readonly DriveAuthFormCode[];
export const DRIVE_TEXT_RESPONSE_CODES:readonly DriveTextResponseCode[];
export const DRIVE_AUTH_ACTION_REDIRECT_VALUES:readonly DriveAuthActionRedirect[];
export const DRIVE_AUTH_CONTENT_TYPE_VALUES:readonly DriveAuthContentType[];
export const DRIVE_AUTH_DOCUMENT_AFTER_RESPONSE_VALUES:readonly DriveAuthDocumentAfterResponse[];
export const DRIVE_AUTH_MAIN_FRAME_AFTER_RESPONSE_VALUES:readonly DriveAuthMainFrameAfterResponse[];
export const DRIVE_AUTH_NETWORK_OBSERVED_AT_VALUES:readonly DriveAuthNetworkFailure["observedAt"][];
export const DRIVE_AUTH_NETWORK_BLOCKED_REASON_VALUES:readonly DriveAuthNetworkFailure["blockedReason"][];
export const DRIVE_QUIESCENCE_CODES:readonly DriveQuiescenceCode[];
export function isDriveAuthActionRequest(url:unknown,method:unknown):boolean;
export function acceptDriveActionResponse(url:unknown,method:unknown,expected:unknown,actual:unknown):boolean;
export function runDriveAuthCheckpoint<T>(state:{fail(code:string):void;unknown():void},code:DriveAuthCheckpoint,operation:()=>Promise<T>,postObserved?:()=>boolean):Promise<T>;
export const DRIVE_STAGES:readonly DriveStage[];
export const DRIVE_PASS_COUNTS:Readonly<Partial<Record<DriveCount,number>>>;
export const DRIVE_LIMITS:Readonly<Record<DriveCount|"requestMs"|"responseBytes"|"caseMs",number>>;
export const DRIVE_LIMITATIONS:readonly DriveLimitation[];
export const DRIVE_INFRA_KEYS:readonly string[];
export const DRIVE_SOURCE_COUNTS:Readonly<{git:262;dependencies:50}>;
export function driveRefuse(code:string):never;
export function closedDriveValue(value:unknown):unknown;
export function blankDriveCase():DriveCase;
export function validateDriveCase(value:unknown):DriveCase;
export function validateDriveCiReport(value:unknown):unknown;
