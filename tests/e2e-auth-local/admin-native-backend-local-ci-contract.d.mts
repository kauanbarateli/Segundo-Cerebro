import type { AdminNativeCase, AdminNativeReport, AdminNativeCleanup, AdminNativePacket } from "./admin-native-backend-contract.mjs";
export const ADMIN_LOCAL_CASE_CHECKS: readonly ["ordinaryVerified", "actorsRegistered", "masterBootstrapVerified", "pipelinePassed", "sdkCleanupConfirmed", "retainedSqlConfirmed"];
export const ADMIN_LOCAL_INFRA_CHECKS: readonly ["ownedNamespace", "pg17", "instanceIdentity", "services", "catalogue", "markerBound", "groupsQuiescent", "namespaceCleanup", "directoriesRemoved"];
export const ADMIN_LOCAL_PHASES: readonly ["not-run", "environment", "sources", "ports", "private-directories", "cli-help", "stack-start", "local-status", "database-preflight", "local-infrastructure", "migrations", "catalogue", "marker", "schema-reload", "fixture-create", "login", "session-verification", "ordinary-access", "bootstrap", "protocol", "auth-cleanup", "retained-sql", "teardown", "complete"];
export const ADMIN_LOCAL_CODES: readonly ["PASSED", "NOT_RUN", "ENVIRONMENT_REFUSED", "SOURCE_REFUSED", "PORT_REFUSED", "COMMAND_FAILED", "COMMAND_UNAVAILABLE", "COMMAND_TIMEOUT", "COMMAND_OUTPUT_LIMIT", "COMMAND_GROUP_UNCONFIRMED", "LOCAL_NAMESPACE_REFUSED", "LOCAL_DATABASE_REFUSED", "LOCAL_SQL_REFUSED", "FIXTURE_CREATE_FAILED", "LOGIN_FAILED", "SESSION_REFUSED", "ORDINARY_ACCESS_REFUSED", "BOOTSTRAP_REFUSED", "PROTOCOL_FAILED", "AUTH_CLEANUP_UNCONFIRMED", "RETAINED_SQL_REFUSED", "WRITE_OUTCOME_UNCERTAIN", "TEARDOWN_UNCONFIRMED", "CASE_FAILED"];
export const ADMIN_LOCAL_LIMITATIONS: readonly ["hostedSupabaseVerified", "originalFactoriesVerified", "nextHandlersVerified", "browserContextsVerified", "forcedFirstEntryGuiVerified", "automaticIssueAcceptance"];
export const ADMIN_LOCAL_NEW_PATHS: readonly string[];
export const ADMIN_LOCAL_SOURCE_PATHS: readonly string[];
export const ADMIN_LOCAL_DEPENDENCY_PATHS: readonly string[];
export const ADMIN_LOCAL_SDK_VERSIONS: Readonly<{ "@supabase/supabase-js": "2.117.2"; "server-only": "0.0.1" }>;
export type AdminLocalCode = typeof ADMIN_LOCAL_CODES[number];
export type AdminLocalPhase = typeof ADMIN_LOCAL_PHASES[number];
export type AdminLocalSourceHash = Readonly<{ path: string; sha256: string; bytes: number }>;
export type AdminLocalCaseReport = Readonly<{
  schemaVersion: 1; scenario: "admin-native-backend-local-case"; case: AdminNativeCase; sourceSha: string;
  status: "passed" | "failed"; code: AdminLocalCode; phase: AdminLocalPhase;
  counts: Readonly<{ setupRequests: number; fixtureCreated: number; sessionsVerified: number; fixtureRemoved: number }>;
  checks: Readonly<Record<typeof ADMIN_LOCAL_CASE_CHECKS[number], boolean>>;
  pipeline: AdminNativeReport | null; cleanup: AdminNativeCleanup | null;
  writeOutcomeUncertain: boolean; pendingRequests: number; pendingInspections: number;
}>;
export type AdminLocalInfraCase = Readonly<{
  case: AdminNativeCase; status: "passed" | "failed" | "not-run"; code: AdminLocalCode; phase: AdminLocalPhase;
  migrationsApplied: number; catalogueChecks: number; checks: Readonly<Record<typeof ADMIN_LOCAL_INFRA_CHECKS[number], boolean>>;
  report: AdminLocalCaseReport | null; writeOutcomeUncertain: boolean;
}>;
export type AdminLocalCiReport = Readonly<{
  schemaVersion: 1; scenario: "admin-native-backend-local-ci"; status: "passed" | "failed"; code: AdminLocalCode; phase: AdminLocalPhase;
  sourceSha: string | null; sourceHashes: readonly AdminLocalSourceHash[]; dependencyHashes: readonly AdminLocalSourceHash[];
  sdkVersions: typeof ADMIN_LOCAL_SDK_VERSIONS; cliVersion: "2.120.0"; checks: Readonly<{ environment: boolean; sources: boolean }>;
  cases: readonly AdminLocalInfraCase[]; packet: AdminNativePacket | null;
  limitations: Readonly<Record<typeof ADMIN_LOCAL_LIMITATIONS[number], false>>; writeOutcomeUncertain: boolean;
}>;
export function validateAdminLocalCaseReport(value: unknown): AdminLocalCaseReport;
export function validateAdminLocalCiReport(value: unknown): AdminLocalCiReport;
