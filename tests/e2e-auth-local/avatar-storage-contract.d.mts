export type AvatarStage = "FIXTURES" | "BASELINE" | "SIGNED_UPLOAD" | "FINALIZE" | "SIGNED_READ" | "ISOLATION" | "PROFILE_SET" | "PROFILE_REMOVE" | "OBJECT_CLEANUP" | "AUTH_CLEANUP" | "FINAL_SQL";
export interface AvatarStorageReport {
  readonly schemaVersion: 1;
  readonly scenario: "avatar-storage-local-case";
  readonly status: "passed" | "failed";
  readonly code: "PASSED" | "SETUP_REFUSED" | "SOURCE_REFUSED" | "OWNERSHIP_REFUSED" | "TRANSPORT_REFUSED" | "RESPONSE_REFUSED" | "MEDIA_NOT_PROVEN" | "SQL_NOT_PROVEN" | "CLEANUP_NOT_PROVEN" | "DEADLINE_EXCEEDED" | "WRITE_OUTCOME_UNCERTAIN" | "CASE_FAILED";
  readonly failurePoint: AvatarStage | null;
  readonly stages: Readonly<Record<AvatarStage, boolean>>;
  readonly counts: Readonly<Record<"authRequests" | "rpcRequests" | "publicRequests" | "storageRequests" | "sqlInspections" | "fixtureCreated" | "fixtureDeleted" | "sessionsVerified" | "objectsCreated" | "objectsRemoved" | "events" | "receipts", number>>;
  readonly measurements: Readonly<Record<"sourceBytes" | "finalBytes" | "sourceWidth" | "sourceHeight" | "finalWidth" | "finalHeight", number>>;
  readonly writeOutcomeUncertain: boolean;
  readonly pendingRequests: number;
  readonly pendingInspections: number;
  readonly deadlineRefused: boolean;
  readonly limitations: Readonly<Record<"hostedSupabase" | "nextHandlers" | "browserUpload" | "originalPersonalFactories" | "cleanupCron" | "automaticIssueAcceptance", false>>;
}
export const AVATAR_STAGES: readonly AvatarStage[];
export const AVATAR_CODES: readonly AvatarStorageReport["code"][];
export const AVATAR_LIMITS: Readonly<{ caseMs: 360000; ioMs: 15000; responseBytes: 1048576; requests: 88; inspections: 16 }>;
export const AVATAR_PASS_COUNTS: AvatarStorageReport["counts"];
export const AVATAR_LIMITATIONS: readonly (keyof AvatarStorageReport["limitations"])[];
export function validateAvatarStorageReport(value: unknown): AvatarStorageReport;
