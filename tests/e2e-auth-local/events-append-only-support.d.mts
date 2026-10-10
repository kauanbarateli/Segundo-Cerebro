/** Disposable CI only. Actors must already be verified by real getUser and
 * ordinary my_access_state. Token decoding is a routing hint, not authority. */
import type { IdentityRlsContext } from "./identity-rls-support.mjs";
import type { EventAppendOnlyReport } from "./identity-data-api-contract.mjs";
export const EVENT_LOCAL_API: "http://127.0.0.1:54321";
export const EVENT_LOCAL_APP: "http://127.0.0.1:3117";
export const EVENT_METADATA: readonly ["id", "user_id", "entity_type", "entity_id", "action", "canal", "occurred_at"];
export const EVENT_STAGES: readonly ["A_BASELINE", "B_BASELINE", "EVENT_RPC", "A_DELTA", "B_FOREIGN_BEFORE", "EVENT_UPDATE", "EVENT_AFTER_UPDATE", "EVENT_DELETE", "EVENT_AFTER_DELETE", "A_FINAL", "B_FINAL", "B_FOREIGN_AFTER"];
export type EventAppendOnlyContext = IdentityRlsContext;
export type EventAppendOnlyRequestInit = Readonly<{
  method: "GET" | "POST" | "PATCH" | "DELETE";
  headers: Readonly<{ apikey: string; Authorization: string; Accept: "application/json"; "Content-Type"?: "application/json"; Prefer?: "return=minimal" }>;
  body?: string; redirect: "error"; cache: "no-store"; signal: AbortSignal;
}>;
/** Finite paths and bodies belong to the helper; no arbitrary endpoint exists. */
export type EventAppendOnlyTransport = (url: string, init: EventAppendOnlyRequestInit) => Promise<Response>;
export type EventAppendOnlyOptions = Readonly<{
  transport: EventAppendOnlyTransport;
  /** Caller generates one UUID in RAM; never reuse another run's write marker. */
  clientId: string;
  /** Runtime checks 1..15000ms; no default transport is provided. */
  timeoutMs?: number;
}>;
export type EventAppendOnlyState = "prepared" | "running" | "passed" | "failed" | "disposed";
export type EventAppendOnlyMetadata = Readonly<{ state: EventAppendOnlyState; passed: boolean; writeOutcomeUncertain: boolean }>;
export type EventAppendOnlyAcceptance = Readonly<{
  run(): Promise<EventAppendOnlyReport>;
  metadata(): EventAppendOnlyMetadata;
  /** Clears owned references. Running operations refuse; no server rollback claim. */
  dispose(): void;
}>;
export function createEventAppendOnlyAcceptance(context: EventAppendOnlyContext, options: EventAppendOnlyOptions): EventAppendOnlyAcceptance;
