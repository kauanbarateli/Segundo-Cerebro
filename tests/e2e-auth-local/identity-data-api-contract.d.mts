/** Pure metadata contract. Does not establish run provenance or authority. */
export const AUTH_IDENTITY_REPORT_FILE: "auth-local-ci-report.json";
export const AUTH_IDENTITY_REPORT_KEYS: readonly ["schemaVersion", "scenario", "status", "code", "failurePoint", "cleanupFailurePoint", "stages", "counts", "checks", "cleanupConfirmed"];
export const AUTH_IDENTITY_STAGES: readonly ["fixtures-created", "login-a1", "login-a2", "login-b", "protected-a1", "protected-a2", "protected-b", "distinct-a-sessions", "logout-global-a", "old-a-denied", "b-intact", "fixture-cleanup"];
export const AUTH_IDENTITY_CHECKS: readonly ["loginA1", "loginA2", "loginB", "protectedA1", "protectedA2", "protectedB", "distinctASessions", "logoutGlobalA", "oldADenied", "bIntact", "cleanupConfirmed"];
export const AUTH_IDENTITY_COUNT_LIMITS: Readonly<{ fixtureCreated: 2; fixtureDeleted: 2; browserContexts: 3 }>;
export const AUTH_IDENTITY_CODES: readonly ["PASSED", "ENVIRONMENT_REFUSED", "FIXTURE_CREATE_FAILED", "LOGIN_FAILED", "PROTECTED_SESSION_FAILED", "SESSION_ISOLATION_FAILED", "LOGOUT_FAILED", "OLD_SESSION_ACCEPTED", "OTHER_ACCOUNT_CHANGED", "CLEANUP_UNCONFIRMED", "REPORT_WRITE_FAILED", "ACCEPTANCE_FAILED"];
export const AUTH_IDENTITY_FAILURE_POINTS: readonly ["FIXTURE_CREATE", "BROWSER_CONTEXT_CREATE", "LOGIN_DOCUMENT", "LOGIN_FORM", "LOGIN_FIELDS", "LOGIN_SUBMIT_NAVIGATION", "LOGIN_DESTINATION", "SESSION_COOKIE_POLICY", "SESSION_COOKIE_HINT", "SESSION_USER_VERIFICATION", "SESSION_ACCESS_STATE", "SESSION_SCRIPT_COOKIE_ISOLATION", "SESSION_NETWORK_ISOLATION", "PROTECTED_PAGE", "DISTINCT_SESSIONS", "LOGOUT_DOCUMENT", "LOGOUT_SUBMIT_NAVIGATION", "LOGOUT_RESPONSE_POLICY", "LOGOUT_STATUS", "LOGOUT_LOCATION", "LOGOUT_PRIVATE_CACHE", "LOGOUT_NO_STORE_CACHE", "LOGOUT_CSP", "LOGOUT_NOSNIFF", "LOGOUT_STORAGE_CLEARANCE", "LOGOUT_COOKIE_CLEARANCE", "OLD_A_TOKEN_LIFETIME", "OLD_A_ACCESS_STATE", "OLD_A_PAGE_GUARD", "OTHER_B_SESSION_INTACT", "FIXTURE_CLEANUP", "IDENTITY_RLS_BEFORE", "EVENT_APPEND_ONLY", "IDENTITY_RLS_AFTER", "CAPTURE_TASK_PERSISTENCE"];
export const AUTH_IDENTITY_CLEANUP_FAILURE_POINTS: readonly ["OUTCOME_UNCERTAIN", "CONTEXT_CLOSE", "FIXTURE_PRECHECK", "SESSION_REVOCATION", "FIXTURE_DELETE_ACK", "FIXTURE_ABSENCE"];
export type IdentityAuthStage = typeof AUTH_IDENTITY_STAGES[number];
export type IdentityAuthCode = typeof AUTH_IDENTITY_CODES[number];
export type IdentityAuthFailurePoint = typeof AUTH_IDENTITY_FAILURE_POINTS[number];
export type IdentityAuthCleanupFailurePoint = typeof AUTH_IDENTITY_CLEANUP_FAILURE_POINTS[number];
export type IdentityAuthCounts = Readonly<Record<keyof typeof AUTH_IDENTITY_COUNT_LIMITS, number>>;
export type IdentityAuthChecks = Readonly<Record<typeof AUTH_IDENTITY_CHECKS[number], boolean>>;
type IdentityAuthBase = Readonly<{
  schemaVersion: 3; scenario: "identity-data-api"; counts: IdentityAuthCounts; checks: IdentityAuthChecks;
  stages: readonly Readonly<{ name: IdentityAuthStage; passed: boolean }>[];
}>;
export type IdentityAuthReport = IdentityAuthBase & (
  | Readonly<{ status: "passed"; code: "PASSED"; failurePoint: null; cleanupFailurePoint: null; cleanupConfirmed: true }>
  | Readonly<{ status: "failed"; code: Exclude<IdentityAuthCode, "PASSED">; failurePoint: IdentityAuthFailurePoint; cleanupFailurePoint: IdentityAuthCleanupFailurePoint | null; cleanupConfirmed: boolean }>
);
export function validateIdentityAuthReport(value: unknown): IdentityAuthReport;

export const IDENTITY_RLS_PACKET_FILE: "auth-local-ci-identity-rls-report.json";
export const IDENTITY_RLS_PACKET_KEYS: readonly ["schemaVersion", "scenario", "status", "code", "failurePhase", "before", "after", "writeOutcomeUncertain"];
export const IDENTITY_RLS_PACKET_STATUSES: readonly ["passed", "failed", "not-run"];
export const IDENTITY_RLS_PACKET_CODES: readonly ["PASSED", "BEFORE_FAILED", "AFTER_FAILED", "DEPENDENCY_NOT_RUN", "AFTER_NOT_RUN", "WRITE_OUTCOME_UNCERTAIN"];
export const IDENTITY_RLS_PHASE_KEYS: readonly ["schemaVersion", "scenario", "status", "code", "failurePoint", "counts", "checks", "writeOutcomeUncertain"];
export const IDENTITY_RLS_PHASE_FAILURE_CODES: readonly ["SETUP_REFUSED", "STATE_REFUSED", "RESPONSE_REFUSED", "DEADLINE_EXCEEDED", "TRANSPORT_FAILED", "OWNERSHIP_REFUSED", "SQL_REFUSAL_NOT_PROVEN", "SNAPSHOT_CHANGED", "ACCESS_STATE_REFUSED", "TOKEN_LIFETIME_REFUSED"];
export const IDENTITY_RLS_COUNT_KEYS: readonly ["requests", "directWriteAttempts", "sqlRefusals"];
export const IDENTITY_RLS_BEFORE_CHECKS: readonly ["ownA", "foreignA", "ownB", "foreignB", "anonClosed", "moderationUnreadable", "moderationUnwritable", "profileUnwritable", "ownSnapshotsPreserved", "ordinaryAccessPreserved"];
export const IDENTITY_RLS_AFTER_CHECKS: readonly ["oldAUnexpired", "oldAOwnHidden", "oldARpcDenied", "bOwnUnchanged", "bOrdinaryAccessIntact"];
export const IDENTITY_RLS_BEFORE_POINTS: readonly ["OWN_A", "FOREIGN_A", "OWN_B", "FOREIGN_B", "ANON_PROFILES", "MODERATION_READ", "MODERATION_WRITE", "PROFILE_WRITE", "REREAD_A", "REREAD_B", "ACCESS_A", "ACCESS_B", "PREREQUISITE"];
export const IDENTITY_RLS_AFTER_POINTS: readonly ["OLD_A_LIFETIME", "OLD_A_PROFILES", "OLD_A_RPC", "B_PROFILES", "B_RPC", "PREREQUISITE"];
export const IDENTITY_RLS_BEFORE_COUNTS: Readonly<{ requests: 12; directWriteAttempts: 2; sqlRefusals: 4 }>;
export const IDENTITY_RLS_AFTER_COUNTS: Readonly<{ requests: 4; directWriteAttempts: 0; sqlRefusals: 1 }>;

export type IdentityRlsPhaseFailureCode = typeof IDENTITY_RLS_PHASE_FAILURE_CODES[number];
export type IdentityRlsBeforeCheck = typeof IDENTITY_RLS_BEFORE_CHECKS[number];
export type IdentityRlsAfterCheck = typeof IDENTITY_RLS_AFTER_CHECKS[number];
export type IdentityRlsBeforePoint = typeof IDENTITY_RLS_BEFORE_POINTS[number];
export type IdentityRlsAfterPoint = typeof IDENTITY_RLS_AFTER_POINTS[number];
export type IdentityRlsCounts = Readonly<{ requests: number; directWriteAttempts: number; sqlRefusals: number }>;
type PhaseBase<Scenario extends string, Check extends string> = Readonly<{
  schemaVersion: 1; scenario: Scenario; counts: IdentityRlsCounts; checks: Readonly<Record<Check, boolean>>;
}>;
type PassedPhase<Scenario extends string, Check extends string> = PhaseBase<Scenario, Check> & Readonly<{
  status: "passed"; code: "PASSED"; failurePoint: null; writeOutcomeUncertain: false;
}>;
type FailedPhase<Scenario extends string, Check extends string, Point extends string> = PhaseBase<Scenario, Check> & Readonly<{
  status: "failed"; code: IdentityRlsPhaseFailureCode; failurePoint: Point; writeOutcomeUncertain: boolean;
}>;
export type IdentityRlsBeforePassed = PassedPhase<"identity-rls-before", IdentityRlsBeforeCheck>;
export type IdentityRlsAfterPassed = PassedPhase<"identity-rls-after", IdentityRlsAfterCheck>;
export type IdentityRlsBeforeFailed = FailedPhase<"identity-rls-before", IdentityRlsBeforeCheck, IdentityRlsBeforePoint>;
export type IdentityRlsAfterFailed = FailedPhase<"identity-rls-after", IdentityRlsAfterCheck, IdentityRlsAfterPoint>;
export type IdentityRlsBefore = IdentityRlsBeforePassed | IdentityRlsBeforeFailed;
export type IdentityRlsAfter = IdentityRlsAfterPassed | IdentityRlsAfterFailed;
type PacketBase = Readonly<{ schemaVersion: 1; scenario: "identity-data-api" }>;
export type IdentityRlsPacket = PacketBase & (
  | Readonly<{ status: "passed"; code: "PASSED"; failurePhase: null; before: IdentityRlsBeforePassed; after: IdentityRlsAfterPassed; writeOutcomeUncertain: false }>
  | Readonly<{ status: "failed"; code: "BEFORE_FAILED"; failurePhase: "before"; before: IdentityRlsBeforeFailed; after: null; writeOutcomeUncertain: boolean }>
  | Readonly<{ status: "failed"; code: "AFTER_FAILED"; failurePhase: "after"; before: IdentityRlsBeforePassed; after: IdentityRlsAfterFailed; writeOutcomeUncertain: boolean }>
  | Readonly<{ status: "failed"; code: "WRITE_OUTCOME_UNCERTAIN"; failurePhase: null; before: IdentityRlsBeforePassed | null; after: IdentityRlsAfterPassed | null; writeOutcomeUncertain: true }>
  | Readonly<{ status: "not-run"; code: "DEPENDENCY_NOT_RUN"; failurePhase: null; before: null; after: null; writeOutcomeUncertain: false }>
  | Readonly<{ status: "not-run"; code: "AFTER_NOT_RUN"; failurePhase: null; before: IdentityRlsBeforePassed; after: null; writeOutcomeUncertain: false }>
);
export type IdentityRlsAssembly = Readonly<{
  before: IdentityRlsBefore | null; after: IdentityRlsAfter | null;
  /** Sticky caller bit; cannot be cleared by a phase or another Auth operation. */
  writeOutcomeUncertain: boolean;
}>;
export function assembleIdentityRlsPacket(value: IdentityRlsAssembly): IdentityRlsPacket;
export function validateIdentityRlsPacket(value: unknown): IdentityRlsPacket;

export const EVENT_PACKET_FILE: "auth-local-ci-events-report.json";
export const EVENT_PACKET_KEYS: readonly ["schemaVersion", "scenario", "status", "code", "report", "writeOutcomeUncertain"];
export const EVENT_PACKET_CODES: readonly ["PASSED", "EVENT_FAILED", "DEPENDENCY_NOT_RUN", "WRITE_OUTCOME_UNCERTAIN"];
export const EVENT_REPORT_KEYS: readonly ["schemaVersion", "scenario", "status", "code", "failurePoint", "stages", "counts", "checks", "writeOutcomeUncertain"];
export const EVENT_STAGES: readonly ["A_BASELINE", "B_BASELINE", "EVENT_RPC", "A_DELTA", "B_FOREIGN_BEFORE", "EVENT_UPDATE", "EVENT_AFTER_UPDATE", "EVENT_DELETE", "EVENT_AFTER_DELETE", "A_FINAL", "B_FINAL", "B_FOREIGN_AFTER"];
export const EVENT_CHECKS: readonly ["ownANonempty", "ownBNonempty", "legitimateEventCreated", "metadataOnly", "updateDenied", "deleteDenied", "eventUnchanged", "bUnchanged", "foreignHidden"];
export const EVENT_COUNT_LIMITS: Readonly<{ requests: 12; readRequests: 9; rpcWriteAttempts: 1; directWriteAttempts: 2; sqlRefusals: 2; baselineARecords: 64; baselineBRecords: 64; eventCreated: 1 }>;
export const EVENT_FAILURE_CODES: readonly ["SETUP_REFUSED", "STATE_REFUSED", "RESPONSE_REFUSED", "DEADLINE_EXCEEDED", "TRANSPORT_FAILED", "OWNERSHIP_REFUSED", "SQL_REFUSAL_NOT_PROVEN", "SNAPSHOT_CHANGED", "EVENT_CREATION_REFUSED", "RPC_ACK_REFUSED", "TOKEN_LIFETIME_REFUSED"];
export const EVENT_FAILURE_POINTS: readonly [...typeof EVENT_STAGES, "PREREQUISITE"];
export type EventAppendOnlyStage = typeof EVENT_STAGES[number];
export type EventAppendOnlyCode = typeof EVENT_FAILURE_CODES[number];
export type EventAppendOnlyFailurePoint = typeof EVENT_FAILURE_POINTS[number];
export type EventAppendOnlyCounts = Readonly<Record<keyof typeof EVENT_COUNT_LIMITS, number>>;
export type EventAppendOnlyChecks = Readonly<Record<typeof EVENT_CHECKS[number], boolean>>;
type EventReportBase = Readonly<{
  schemaVersion: 1; scenario: "events-append-only"; counts: EventAppendOnlyCounts; checks: EventAppendOnlyChecks;
  stages: readonly Readonly<{ name: EventAppendOnlyStage; passed: boolean }>[];
}>;
export type EventAppendOnlyPassed = EventReportBase & Readonly<{ status: "passed"; code: "PASSED"; failurePoint: null; writeOutcomeUncertain: false }>;
export type EventAppendOnlyFailed = EventReportBase & Readonly<{ status: "failed"; code: EventAppendOnlyCode; failurePoint: EventAppendOnlyFailurePoint; writeOutcomeUncertain: boolean }>;
export type EventAppendOnlyReport = EventAppendOnlyPassed | EventAppendOnlyFailed;
type EventsPacketBase = Readonly<{ schemaVersion: 1; scenario: "identity-data-api" }>;
export type EventsPacket = EventsPacketBase & (
  | Readonly<{ status: "passed"; code: "PASSED"; report: EventAppendOnlyPassed; writeOutcomeUncertain: false }>
  | Readonly<{ status: "failed"; code: "EVENT_FAILED"; report: EventAppendOnlyFailed; writeOutcomeUncertain: boolean }>
  | Readonly<{ status: "failed"; code: "WRITE_OUTCOME_UNCERTAIN"; report: EventAppendOnlyPassed | null; writeOutcomeUncertain: true }>
  | Readonly<{ status: "not-run"; code: "DEPENDENCY_NOT_RUN"; report: null; writeOutcomeUncertain: false }>
);
export type EventsAssembly = Readonly<{ report: EventAppendOnlyReport | null; writeOutcomeUncertain: boolean }>;
export function assembleEventsPacket(value: EventsAssembly): EventsPacket;
export function validateEventsPacket(value: unknown): EventsPacket;
