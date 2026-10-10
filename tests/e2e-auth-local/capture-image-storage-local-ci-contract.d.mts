import type { CaptureImagePacket } from "./capture-image-storage-contract.mjs";
export const STORAGE_LOCAL_CASE_PHASES: readonly ["prerequisite", "fixture-create", "login", "session-verification", "ordinary-access", "image-construction", "image-pipeline", "object-cleanup", "auth-precheck", "auth-revoke", "auth-delete", "auth-absence", "complete"];
export const STORAGE_LOCAL_CASE_CODES: readonly string[];
export const STORAGE_LOCAL_CASE_CHECKS: readonly ["fixturesBound", "sessionsVerified", "ordinaryAccessVerified", "distinctSessions", "objectCleanupConfirmed", "authCleanupConfirmed"];
export const STORAGE_LOCAL_CI_PHASES: readonly string[];
export const STORAGE_LOCAL_CI_CODES: readonly string[];
export const STORAGE_LOCAL_CI_CHECKS: readonly ["localEnvironment", "sourcesConfirmed", "ownedNamespace", "pg17", "instanceIdentityConfirmed", "servicesNative", "fixedSqlConfirmed", "domainAbsent", "storageMetadataAbsent", "authUsersAbsent", "executionNatural", "ownedNamespaceCleanup", "stackCleanupConfirmed", "privateDirectoriesRemoved"];
export const STORAGE_LOCAL_SDK_VERSIONS: Readonly<{ "@supabase/supabase-js": "2.117.2"; "@supabase/storage-js": "2.117.2"; "@supabase/auth-js": "2.117.2" }>;
export interface StorageLocalCaseReport {
  readonly schemaVersion: 1; readonly scenario: "capture-image-storage-local-case"; readonly status: "passed" | "failed"; readonly code: string;
  readonly phase: typeof STORAGE_LOCAL_CASE_PHASES[number]; readonly cleanupFailurePoint: "auth-precheck" | "auth-revoke" | "auth-delete" | "auth-absence" | null;
  readonly counts: Readonly<{ authRequests: number; fixtureCreated: number; fixtureDeleted: number; sessionsVerified: number }>;
  readonly checks: Readonly<Record<typeof STORAGE_LOCAL_CASE_CHECKS[number], boolean>>;
  readonly captureImage: CaptureImagePacket | null; readonly writeOutcomeUncertain: boolean;
}
export interface StorageLocalCiReport {
  readonly schemaVersion: 1; readonly scenario: "capture-image-storage-local-ci"; readonly status: "passed" | "failed"; readonly code: string; readonly phase: string;
  readonly cleanupStage: "not-started" | "stop-own-project" | "verify-own-project" | "private-directories" | "directories-retained" | "complete";
  readonly cliVersion: "2.120.0"; readonly sourceSha: string | null; readonly sourceHashes: readonly Readonly<{ path: string; sha256: string; bytes: number }>[];
  readonly sdkVersions: typeof STORAGE_LOCAL_SDK_VERSIONS; readonly migrations: number; readonly migrationsApplied: number; readonly catalogueChecks: number;
  readonly checks: Readonly<Record<typeof STORAGE_LOCAL_CI_CHECKS[number], boolean>>; readonly caseReport: StorageLocalCaseReport | null; readonly writeOutcomeUncertain: boolean;
}
export function validateStorageLocalCaseReport(value: unknown): Readonly<StorageLocalCaseReport>;
export function validateStorageLocalCiReport(value: unknown): Readonly<StorageLocalCiReport>;
