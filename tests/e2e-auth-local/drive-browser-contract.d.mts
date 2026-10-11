export type DriveAuthCheckpoint="AUTH_DOCUMENT_REFUSED"|"AUTH_FORM_REFUSED"|"AUTH_POST_REFUSED"|"AUTH_DESTINATION_REFUSED"|"AUTH_READY_REFUSED"|"AUTH_SESSION_REFUSED";
export type DriveAuthPostStageCode="AUTH_POST_RESPONSE_REFUSED"|"AUTH_POST_CLICK_REFUSED"|"AUTH_POST_FINISH_REFUSED";
export type DriveAuthRequestFailureCode="AUTH_POST_REQUEST_FAILED"|"AUTH_POST_ABORTED"|"AUTH_POST_CONNECTION_RESET"|"AUTH_POST_CONNECTION_REFUSED"|"AUTH_POST_NETWORK_FAILED";
export type DriveAuthPostCode=DriveAuthPostStageCode|DriveAuthRequestFailureCode;
export type DriveCode="PASSED"|"NOT_RUN"|"ENVIRONMENT_REFUSED"|"SOURCE_REFUSED"|"REPORT_REFUSED"|"PROCESS_UNCONFIRMED"|"REQUEST_REFUSED"|"RESPONSE_REFUSED"|"AUTH_NOT_PROVEN"|"SQL_REFUSED"|"OWNERSHIP_REFUSED"|"BROWSER_REFUSED"|"DRIVE_NOT_PROVEN"|"CLEANUP_NOT_PROVEN"|"TRANSPORT_FAILED"|"DEADLINE_EXCEEDED"|"WRITE_OUTCOME_UNCERTAIN"|DriveAuthCheckpoint|DriveAuthPostCode;
export type DriveStage="fixture"|"browser-bound"|"folders-created"|"uploads-persisted"|"download-verified"|"server-rejections"|"moves-cycle"|"trash-restored"|"usage-verified"|"contexts-closed"|"storage-absent"|"auth-revoked"|"auth-absent"|"final-sql";
export type DriveCount="fixturesCreated"|"contexts"|"loginPosts"|"pickerUploads"|"dropUploads"|"filesFinalized"|"persistenceChecks"|"downloads"|"serverOversize"|"serverExecutable"|"foldersCreated"|"fileMoves"|"folderMoves"|"cycleGuiChecks"|"cycleApiDenials"|"trash"|"restore"|"usageChecks"|"storageDeletes"|"storageAbsenceReads"|"authRevocations"|"authDeletes"|"authAbsenceReads"|"browserRequests"|"ownedSdkRequests"|"nextProbeRequests"|"sqlInspections";
export type DriveLimitation="hostedVerified"|"httpsCookieVerified"|"signedGetCookieAbsenceCertified"|"exifBrowserCertified"|"allNextInternalFetchesMeasured"|"allDescendantsForcelessCertified";
export interface DriveCase{schemaVersion:1;scenario:"drive-browser-local-case";status:"not-run"|"failed"|"passed";code:DriveCode;stages:DriveStage[];counts:Record<DriveCount,number>;writeOutcomeUncertain:boolean;pendingRequests:number;pendingInspections:number;limitations:Record<DriveLimitation,false>}
export interface DriveState{readonly value:DriveCase;active():void;fail(code:string):void;unknown():void;count(key:DriveCount):void;stage(stage:DriveStage):void;finish(requests:number,inspections:number):DriveCase}
export const DRIVE_CODES:readonly DriveCode[];
export const DRIVE_AUTH_CHECKPOINTS:readonly DriveAuthCheckpoint[];
export const DRIVE_AUTH_POST_CODES:readonly DriveAuthPostCode[];
export function isDriveAuthActionRequest(url:unknown,method:unknown):boolean;
export function acceptDriveActionResponse(url:unknown,method:unknown,expected:unknown,actual:unknown):boolean;
export function runDriveAuthCheckpoint<T>(state:{fail(code:string):void;unknown():void},code:DriveAuthCheckpoint,operation:()=>Promise<T>,postObserved?:()=>boolean):Promise<T>;
export const DRIVE_STAGES:readonly DriveStage[];
export const DRIVE_PASS_COUNTS:Readonly<Partial<Record<DriveCount,number>>>;
export const DRIVE_LIMITS:Readonly<Record<DriveCount|"requestMs"|"responseBytes"|"caseMs",number>>;
export const DRIVE_LIMITATIONS:readonly DriveLimitation[];
export const DRIVE_INFRA_KEYS:readonly string[];
export const DRIVE_SOURCE_COUNTS:Readonly<{git:226;dependencies:50}>;
export function driveRefuse(code:string):never;
export function closedDriveValue(value:unknown):unknown;
export function blankDriveCase():DriveCase;
export function validateDriveCase(value:unknown):DriveCase;
export function validateDriveCiReport(value:unknown):unknown;
