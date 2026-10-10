import type { AdminNativeCase } from "./admin-native-backend-contract.mjs";
import type { AdminNativeTransport, AdminNativeSqlInspector, AdminNativeContext, AdminNativeOptions, AdminNativeAcceptance } from "./admin-native-backend-case.mjs";
import type { AdminLocalCaseReport } from "./admin-native-backend-local-ci-contract.mjs";
export const ADMIN_SETUP_LIMITS: Readonly<{ requests: 8; bytes: 1048576; timeoutMs: 15000 }>;
export type AdminLocalContext = Readonly<{
  ci: true; githubActions: true; localAdminRun: true; supabaseUrl: "http://127.0.0.1:54321";
  case: AdminNativeCase; sourceSha: string; namespace: string; systemIdentifier: string;
  publishableKey: string; serverSecretKey: string; commitmentSecret: string;
}>;
export type AdminLocalActors = Readonly<{ a: Readonly<{ id: string; sessionId: string; marker: string }>; b: Readonly<{ id: string; sessionId: string; marker: string }> }>;
export type AdminLocalOptions = Readonly<{
  transport: AdminNativeTransport;
  registerActors(actors: AdminLocalActors): Promise<void> | void;
  inspectSql: AdminNativeSqlInspector;
  retainedSql(): Promise<boolean>;
  cleanupAllowed(): boolean;
  /** Explicit seam for pure caller tests. Never establishes native provenance. */
  createAcceptance?(context: AdminNativeContext, options: AdminNativeOptions): Promise<AdminNativeAcceptance>;
}>;
export function validateAdminLocalSetup(context: AdminLocalContext, options: AdminLocalOptions): void;
/** Only JWT hints; SDK and fixed local SQL must establish owner/SID identity. */
export function adminSessionHint(token: string, owner: string): Readonly<{ accessToken: string; sessionId: string; expiresAt: number }>;
export function runAdminLocalCase(context: AdminLocalContext, options: AdminLocalOptions): Promise<AdminLocalCaseReport>;
