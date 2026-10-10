import type { AdminOperation } from "../../src/core/admin";
import type { AdminNativeCase, AdminNativeReport, AdminNativeCleanup, AdminNativeSqlQuery } from "./admin-native-backend-contract.mjs";
export const ADMIN_NATIVE_API: "http://127.0.0.1:54321";
export const ADMIN_NATIVE_MODULES: readonly string[];
export type AdminNativeActor = Readonly<{ id: string; sessionId: string; accessToken: string; expiresAt: number; email: string }>;
export type AdminNativeContext = Readonly<{
  case: AdminNativeCase; sourceSha: string; publishableKey: string; serverSecretKey: string; commitmentSecret: string;
  runtime: Readonly<{ ci: true; githubActions: true; localAdminRun: true; supabaseUrl: typeof ADMIN_NATIVE_API; namespace: string; systemIdentifier: string }>;
  a: AdminNativeActor; b: AdminNativeActor;
}>;
export type AdminNativeRequest = Readonly<{ method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; headers: Readonly<Record<string, string>>; body?: string; signal: AbortSignal; redirect: "error"; cache: "no-store"; credentials: "omit" }>;
export type AdminNativeTransport = (url: string, request: AdminNativeRequest) => Promise<Response>;
/** Fixed caller-owned queries only. executionId and operationId have distinct
 * meanings; creation target/operation remain null before the real SQL reserve.
 * This DTO, JWT decoding and pure doubles cannot attest namespace provenance. */
export type AdminNativeSqlRequest = Readonly<{
  query: AdminNativeSqlQuery; case: AdminNativeCase; sourceSha: string; namespace: string; systemIdentifier: string;
  actorId: string; targetId: string | null; executionId: string; operationId: string | null; signal: AbortSignal;
}>;
export type AdminNativeSqlUser = Readonly<{ id: string; email: string; app_metadata: Readonly<Record<string, unknown>>; banned_until: string | null; deleted_at: string | null; is_anonymous: boolean }>;
export type AdminNativeSqlOperation = AdminOperation & Readonly<{ commitment: string; prior_status: "active" | "blocked"; prior_must_change_password: boolean; active_execution: string | null }>;
export type AdminNativeSqlEvent = Readonly<{ id: string; user_id: string; entity_type: string; entity_id: string; action: string; canal: "web" | "api"; occurred_at: string; before: unknown; after: unknown }>;
export type AdminNativeSqlProof = Readonly<{
  provenance: Readonly<{ namespace: string; sourceSha: string; systemIdentifier: string; database: "postgres"; currentUser: "postgres"; serverVersion: number; markerRows: readonly [Readonly<{ namespace: string; sourceSha: string; systemIdentifier: string }>] }>;
  users: readonly AdminNativeSqlUser[];
  sessions: readonly Readonly<{ id: string; user_id: string; not_after: string | null }>[];
  refreshTokens: readonly Readonly<{ user_id: string; revoked: boolean }>[];
  roles: readonly Readonly<{ user_id: string; role: "user" | "master" }>[];
  moderation: readonly Readonly<{ user_id: string; status: "active" | "blocked"; must_change_password: boolean }>[];
  entitlements: readonly Readonly<{ user_id: string; feature_key: string; allowed: boolean }>[];
  operations: readonly AdminNativeSqlOperation[];
  audit: readonly Readonly<{ id: string; actor_user_id: string; target_user_id: string; operation_id: string; action: string; phase: string; occurred_at: string }>[];
  receipts: readonly Readonly<{ user_id: string; command: string; client_id: string; request: Readonly<{ commitment: string }>; result: AdminOperation; created_at: string }>[];
  events: readonly AdminNativeSqlEvent[];
  usableMasters: readonly string[];
  preserveSqlState: "23514" | null;
  personalRows: 0;
}>;
export type AdminNativeSqlInspector = (request: AdminNativeSqlRequest) => Promise<AdminNativeSqlProof>;
export type AdminNativeOptions = Readonly<{ transport: AdminNativeTransport; inspectSql: AdminNativeSqlInspector; timeoutMs?: number }>;
export type AdminNativeMetadata = Readonly<{ case: AdminNativeCase; state: "prepared" | "running" | "passed" | "failed" | "cleaning" | "disposed"; pipelinePassed: boolean; terminalKnown: boolean; authCleanupConfirmed: boolean; authDeletionAllowed: boolean; writeOutcomeUncertain: boolean; pendingRequests: number; pendingInspections: number; moduleCount: number }>;
export type AdminNativeAcceptance = Readonly<{ run(): Promise<AdminNativeReport>; cleanupAuth(): Promise<AdminNativeCleanup>; metadata(): AdminNativeMetadata; dispose(): void }>;
export function loadAdminNativeBackend(): Promise<Readonly<{ product: typeof import("./admin-native-backend.entry"); modules: readonly string[] }>>;
export function createAdminNativeBackendAcceptance(context: AdminNativeContext, options: AdminNativeOptions): Promise<AdminNativeAcceptance>;
