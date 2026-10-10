/** Private protocol prototype. Claims decoded by the implementation are routing
 * hints, not authentication. The caller must already verify the exact actors
 * through real getUser and my_access_state before a future authorized adoption.
 * This type API performs no IO and provides no default network transport. */
import type { IdentityRlsBefore, IdentityRlsAfter } from "./identity-data-api-contract.mjs";

export const RLS_LOCAL_API: "http://127.0.0.1:54321";
export const RLS_LOCAL_APP: "http://127.0.0.1:3117";
export type IdentityRlsRuntime = Readonly<{
  ci: true;
  githubActions: true;
  localAuthRun: true;
  appUrl: typeof RLS_LOCAL_APP;
  supabaseUrl: typeof RLS_LOCAL_API;
}>;
/** IDs/SIDs/expiry and JWT binding are checked at runtime. A structural actor
 * type deliberately does not claim verified identity or token authority. */
export type IdentityRlsActor = Readonly<{
  id: string;
  accessToken: string;
  sessionId: string;
  /** Integer Unix timestamp in milliseconds; token must have >60s remaining. */
  expiresAt: number;
}>;
export type IdentityRlsContext = Readonly<{
  runtime: IdentityRlsRuntime;
  /** Modern publishable key only; runtime rejects service/secret credentials. */
  publishableKey: string;
  a: IdentityRlsActor;
  b: IdentityRlsActor;
}>;
export type IdentityRlsRequestInit = Readonly<{
  method: "GET" | "PATCH" | "POST";
  headers: Readonly<{
    apikey: string;
    Authorization: string;
    Accept: "application/json";
    "Content-Type"?: "application/json";
    Prefer?: "return=minimal";
  }>;
  body?: string;
  redirect: "error";
  cache: "no-store";
  signal: AbortSignal;
}>;
/** The helper itself selects a finite operation/URL/body set. No caller URL,
 * SQL, owner override or endpoint selector exists in the acceptance API. */
export type IdentityRlsTransport = (url: string, init: IdentityRlsRequestInit) => Promise<Response>;
export type IdentityRlsOptions = Readonly<{
  transport: IdentityRlsTransport;
  /** Optional 1..15000ms checked at runtime; transport is always required. */
  timeoutMs?: number;
}>;
export type IdentityRlsState = "prepared" | "before-running" | "before-passed" | "before-failed" | "after-running" | "after-passed" | "after-failed" | "disposed";
export type IdentityRlsMetadata = Readonly<{
  state: IdentityRlsState;
  beforePassed: boolean;
  afterPassed: boolean;
  writeOutcomeUncertain: boolean;
}>;
export type IdentityRlsAcceptance = Readonly<{
  before(): Promise<IdentityRlsBefore>;
  after(): Promise<IdentityRlsAfter>;
  metadata(): IdentityRlsMetadata;
  /** Clears helper-owned references; running operations cause closed refusal.
   * This is not server-side cancellation, revocation or rollback. */
  dispose(): void;
}>;
export function createIdentityRlsAcceptance(context: IdentityRlsContext, options: IdentityRlsOptions): IdentityRlsAcceptance;
