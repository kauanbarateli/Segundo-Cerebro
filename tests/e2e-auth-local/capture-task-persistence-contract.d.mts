/** Pure metadata projection; no authority or execution provenance. */
export const CAPTURE_TASK_PACKET_FILE: "auth-local-ci-capture-task-report.json";
export const CAPTURE_TASK_PACKET_KEYS: readonly ["schemaVersion", "scenario", "status", "code", "report", "writeOutcomeUncertain"];
export const CAPTURE_TASK_PACKET_CODES: readonly ["PASSED", "CAPTURE_TASK_FAILED", "DEPENDENCY_NOT_RUN", "WRITE_OUTCOME_UNCERTAIN"];
export const CAPTURE_TASK_REPORT_KEYS: readonly ["schemaVersion", "scenario", "status", "code", "failurePoint", "stages", "counts", "checks", "writeOutcomeUncertain"];
export const CAPTURE_TASK_STAGES: readonly ["BASELINE", "CREATE", "UPDATE", "CONVERT", "CORE_REPLAY", "RPC_REPLAY", "TASK_DELETE", "TASK_RESTORE", "CAPTURE_DELETE", "CAPTURE_RESTORE", "FINAL"];
export const CAPTURE_TASK_CHECKS: readonly ["freshOwnBaseline", "createPersisted", "updatePersisted", "conversionLinked", "coreReplayUnchanged", "rpcReplayUnchanged", "taskTrashPreserved", "taskRestored", "captureTrashPreserved", "captureRestored", "publicOwnAndForeign", "eventsAndReceiptsAtomic"];
export const CAPTURE_TASK_COUNT_LIMITS: Readonly<{ requests: 64; rpcRequests: 64; publicRequests: 64; coreCommands: 8; commitAttempts: 9; committedReplies: 7; replayedReplies: 2; events: 8; receipts: 7 }>;
export const CAPTURE_TASK_PASS_COUNTS: Readonly<{ requests: 45; rpcRequests: 29; publicRequests: 16; coreCommands: 8; commitAttempts: 9; committedReplies: 7; replayedReplies: 2; events: 8; receipts: 7 }>;
export const CAPTURE_TASK_FAILURE_CODES: readonly ["SETUP_REFUSED", "GRAPH_REFUSED", "STATE_REFUSED", "RESPONSE_REFUSED", "DEADLINE_EXCEEDED", "TRANSPORT_FAILED", "OWNERSHIP_REFUSED", "SNAPSHOT_CHANGED", "DOMAIN_REFUSED", "COMMIT_UNCONFIRMED", "REPLAY_NOT_PROVEN", "EVENT_NOT_PROVEN", "TOKEN_LIFETIME_REFUSED", "CALL_LIMIT_REFUSED"];
export const CAPTURE_TASK_FAILURE_POINTS: readonly [...typeof CAPTURE_TASK_STAGES, "PREREQUISITE"];
export type CaptureTaskPersistenceStage = typeof CAPTURE_TASK_STAGES[number];
export type CaptureTaskPersistenceCode = typeof CAPTURE_TASK_FAILURE_CODES[number];
export type CaptureTaskPersistenceFailurePoint = typeof CAPTURE_TASK_FAILURE_POINTS[number];
export type CaptureTaskPersistenceCounts = Readonly<Record<keyof typeof CAPTURE_TASK_COUNT_LIMITS, number>>;
export type CaptureTaskPersistenceChecks = Readonly<Record<typeof CAPTURE_TASK_CHECKS[number], boolean>>;
type ReportBase = Readonly<{
  schemaVersion: 1; scenario: "capture-task-persistence"; counts: CaptureTaskPersistenceCounts; checks: CaptureTaskPersistenceChecks;
  stages: readonly Readonly<{ name: CaptureTaskPersistenceStage; passed: boolean }>[];
}>;
export type CaptureTaskPersistencePassed = ReportBase & Readonly<{ status: "passed"; code: "PASSED"; failurePoint: null; writeOutcomeUncertain: false }>;
export type CaptureTaskPersistenceFailed = ReportBase & Readonly<{ status: "failed"; code: CaptureTaskPersistenceCode; failurePoint: CaptureTaskPersistenceFailurePoint; writeOutcomeUncertain: boolean }>;
export type CaptureTaskPersistenceReport = CaptureTaskPersistencePassed | CaptureTaskPersistenceFailed;
type PacketBase = Readonly<{ schemaVersion: 1; scenario: "identity-data-api" }>;
export type CaptureTaskPacket = PacketBase & (
  | Readonly<{ status: "passed"; code: "PASSED"; report: CaptureTaskPersistencePassed; writeOutcomeUncertain: false }>
  | Readonly<{ status: "failed"; code: "CAPTURE_TASK_FAILED"; report: CaptureTaskPersistenceFailed; writeOutcomeUncertain: boolean }>
  | Readonly<{ status: "failed"; code: "WRITE_OUTCOME_UNCERTAIN"; report: CaptureTaskPersistencePassed | null; writeOutcomeUncertain: true }>
  | Readonly<{ status: "not-run"; code: "DEPENDENCY_NOT_RUN"; report: null; writeOutcomeUncertain: false }>
);
export type CaptureTaskAssembly = Readonly<{ report: CaptureTaskPersistenceReport | null; writeOutcomeUncertain: boolean }>;
export function validateCaptureTaskPersistenceReport(value: unknown): CaptureTaskPersistenceReport;
export function assembleCaptureTaskPacket(value: CaptureTaskAssembly): CaptureTaskPacket;
export function validateCaptureTaskPacket(value: unknown): CaptureTaskPacket;
