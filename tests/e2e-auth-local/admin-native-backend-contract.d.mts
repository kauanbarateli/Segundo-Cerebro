export const ADMIN_NATIVE_MANIFEST: readonly ["tests/e2e-auth-local/admin-native-backend.entry.ts", "tests/e2e-auth-local/admin-native-backend-case.mjs", "tests/e2e-auth-local/admin-native-backend-case.d.mts", "tests/e2e-auth-local/admin-native-backend-contract.mjs", "tests/e2e-auth-local/admin-native-backend-contract.d.mts", "tests/scripts/admin-native-backend-case.test.mjs", "tests/scripts/admin-native-backend-contract.test.mjs", "tests/scripts/admin-native-backend.types.mts"];
export const ADMIN_NATIVE_CASES: readonly ["BLOCK_OLD_JWT", "SELF_AND_LAST_MASTER", "CREATE_FORCED"];
export type AdminNativeCase = typeof ADMIN_NATIVE_CASES[number];
export const ADMIN_NATIVE_STAGES: Readonly<{
  BLOCK_OLD_JWT: readonly ["BASELINE", "FENCE", "TERMINAL", "REPLAY", "CONFLICT", "PUBLIC_DENIAL", "MASTER_RETAINED", "SQL_FINAL"];
  SELF_AND_LAST_MASTER: readonly ["BASELINE", "SELF_REFUSALS", "SECOND_MASTER", "DEMOTION", "LAST_MASTER", "SQL_FINAL"];
  CREATE_FORCED: readonly ["BASELINE", "FENCE", "CREATED_FENCE", "COMPLETE", "REPLAY", "CONFLICT", "FORCED_LOGIN", "SQL_FINAL"];
}>;
export const ADMIN_NATIVE_CHECKS: Readonly<{
  BLOCK_OLD_JWT: readonly ["identitiesBound", "fenceBeforeAuth", "blockedAndRevoked", "replayWithoutEffect", "alteredIntentRefused", "oldJwtCannotReactivate", "actorStillUsable", "exactSqlMetadata"];
  SELF_AND_LAST_MASTER: readonly ["identitiesBound", "selfMutationsRefused", "secondMasterUsable", "demotionComplete", "lastMasterPreserved", "exactSqlMetadata"];
  CREATE_FORCED: readonly ["identitiesBound", "reservationBeforeCreate", "createdBannedAndForced", "creationComplete", "replayWithoutEffect", "alteredIntentRefused", "forcedSessionDenied", "exactSqlMetadata"];
}>;
export const ADMIN_NATIVE_FAILURE_CODES: readonly ["SETUP_REFUSED", "GRAPH_REFUSED", "STATE_REFUSED", "TOKEN_LIFETIME_REFUSED", "CALL_LIMIT_REFUSED", "TRANSPORT_REFUSED", "TRANSPORT_FAILED", "DEADLINE_EXCEEDED", "RESPONSE_REFUSED", "OWNERSHIP_REFUSED", "SQL_REFUSED", "AUTH_NOT_PROVEN", "PERSISTENCE_NOT_PROVEN", "SAGA_NOT_TERMINAL", "CLEANUP_NOT_PROVEN", "WRITE_OUTCOME_UNCERTAIN"];
export type AdminNativeFailureCode = typeof ADMIN_NATIVE_FAILURE_CODES[number];
export const ADMIN_NATIVE_LIMITS: Readonly<{ requests: 48; cleanupRequests: 16; responseBytes: 1048576; timeoutMs: 15000; sourceBytes: 1048576 }>;
export const ADMIN_NATIVE_PASS_COUNTS: Readonly<Record<AdminNativeCase, Readonly<{ requests: number; adminRpcRequests: number; otherRpcRequests: number; authReadRequests: number; authMutationRequests: number; authLoginRequests: number; publicRequests: number; coreCommands: number; coreSafetyChecks: number; sqlInspections: number; authEffects: number; operations: number; auditEntries: number; receipts: number; events: number }>>>;
export type AdminNativeCounts = Readonly<Record<keyof typeof ADMIN_NATIVE_PASS_COUNTS[AdminNativeCase], number>>;
export const ADMIN_NATIVE_CLEANUP_STAGES: Readonly<{
  BLOCK_OLD_JWT: readonly ["INVENTORY", "REVOKE", "DELETE_A", "ABSENT_A", "DELETE_B", "ABSENT_B", "RETAINED_SQL"];
  SELF_AND_LAST_MASTER: readonly ["INVENTORY", "REVOKE", "DELETE_A", "ABSENT_A", "DELETE_B", "ABSENT_B", "RETAINED_SQL"];
  CREATE_FORCED: readonly ["INVENTORY", "REVOKE", "DELETE_A", "ABSENT_A", "DELETE_B", "ABSENT_B", "DELETE_C", "ABSENT_C", "RETAINED_SQL"];
}>;
export const ADMIN_NATIVE_CLEANUP_COUNTS: Readonly<Record<AdminNativeCase, Readonly<{ requests: number; authReadRequests: number; revokeRequests: number; deleteRequests: number; absenceReads: number; removedUsers: number; sqlInspections: number; retainedOperations: number; retainedAuditEntries: number; receiptsRemaining: number }>>>;
export type AdminNativeCleanupCounts = Readonly<Record<keyof typeof ADMIN_NATIVE_CLEANUP_COUNTS[AdminNativeCase], number>>;
export const ADMIN_NATIVE_SQL_QUERIES: readonly ["BASELINE", "FENCE", "CREATED_FENCE", "TERMINAL", "UNCHANGED", "SECOND_MASTER", "DEMOTION", "ASSERT_LAST_MASTER", "FORCED_SESSION", "FINAL", "CLEANUP_INVENTORY", "CLEANUP_REVOKED", "CLEANUP_RETAINED"];
export type AdminNativeSqlQuery = typeof ADMIN_NATIVE_SQL_QUERIES[number];
export const ADMIN_NATIVE_REPORT_KEYS: readonly string[];
export const ADMIN_NATIVE_CLEANUP_KEYS: readonly string[];
export const ADMIN_NATIVE_PACKET_KEYS: readonly string[];
export type AdminNativeStage = typeof ADMIN_NATIVE_STAGES[AdminNativeCase][number];
export type AdminNativeCleanupStage = typeof ADMIN_NATIVE_CLEANUP_STAGES[AdminNativeCase][number];
export type AdminNativeSourceHash = Readonly<{ path: typeof ADMIN_NATIVE_MANIFEST[number]; sha256: string; bytes: number }>;
type Base = Readonly<{ schemaVersion: 1; scenario: "admin-native-backend"; provenance: "protocol-only"; case: AdminNativeCase; sourceSha: string; sourceHashes: readonly AdminNativeSourceHash[]; stages: readonly Readonly<{ name: AdminNativeStage; passed: boolean }>[]; counts: AdminNativeCounts; checks: Readonly<Partial<Record<typeof ADMIN_NATIVE_CHECKS[AdminNativeCase][number], boolean>>> }>;
/** Closed protocol result, not native verification or either browser literal. */
export type AdminNativeReport = Base & (Readonly<{ status: "passed"; code: "PASSED"; failurePoint: null; terminalKnown: true; writeOutcomeUncertain: false }> | Readonly<{ status: "failed"; code: AdminNativeFailureCode; failurePoint: AdminNativeStage | "PREREQUISITE"; terminalKnown: boolean; writeOutcomeUncertain: boolean }>);
type CleanupBase = Readonly<{ schemaVersion: 1; scenario: "admin-native-backend-cleanup"; provenance: "protocol-only"; case: AdminNativeCase; sourceSha: string; stages: readonly Readonly<{ name: AdminNativeCleanupStage; passed: boolean }>[]; counts: AdminNativeCleanupCounts }>;
export type AdminNativeCleanup = CleanupBase & (Readonly<{ status: "passed"; code: "PASSED"; failurePoint: null; terminalKnown: true; exactInventory: true; accountsAbsent: true; receiptsAbsent: true; retainedAdminMetadataExact: true; writeOutcomeUncertain: false }> | Readonly<{ status: "failed"; code: AdminNativeFailureCode; failurePoint: AdminNativeCleanupStage | "PREREQUISITE"; terminalKnown: boolean; exactInventory: false; accountsAbsent: false; receiptsAbsent: false; retainedAdminMetadataExact: false; writeOutcomeUncertain: boolean }>);
export type AdminNativeCaseEntry = Readonly<{ case: AdminNativeCase; report: AdminNativeReport | null; cleanup: AdminNativeCleanup | null; namespaceCleanup: "not-run" | "confirmed" | "failed" }>;
export type AdminNativePacket = Readonly<{ schemaVersion: 1; scenario: "admin-native-backend"; provenance: "protocol-only"; sourceSha: string; status: "passed" | "failed" | "not-run"; code: "PASSED" | "CASE_FAILED" | "CLEANUP_FAILED" | "NAMESPACE_FAILED" | "DEPENDENCY_NOT_RUN" | "WRITE_OUTCOME_UNCERTAIN"; cases: readonly AdminNativeCaseEntry[]; writeOutcomeUncertain: boolean }>;
export function validateAdminNativeReport(value: unknown): AdminNativeReport;
export function validateAdminNativeCleanup(value: unknown): AdminNativeCleanup;
export function assembleAdminNativePacket(value: Readonly<{ sourceSha: string; cases: readonly AdminNativeCaseEntry[]; writeOutcomeUncertain: boolean }>): AdminNativePacket;
export function validateAdminNativePacket(value: unknown): AdminNativePacket;
