import type { createCaptureTaskGateway, parseCaptureTaskSnapshot } from "../../src/adapters/db/capture-task-gateway";
import type { createCaptureTaskStore, CommitOutcomeUnknown } from "../../src/adapters/db/capture-task-store";
import type { decodeCaptureTaskRequest, executeCaptureTaskCommand } from "../../src/adapters/db/capture-task-commands";
import type { ErroDeDominio } from "../../src/core/contracts/base";
import type { AuthGuardError } from "../../src/lib/auth/types";

export const CAPTURE_NATIVE_API: "http://127.0.0.1:54321";
export const CAPTURE_NATIVE_APP: "http://127.0.0.1:3117";
export const CAPTURE_NATIVE_MODULES: readonly [
  "tests/e2e-auth-local/capture-task-persistence.entry.ts", "src/adapters/db/capture-task-gateway.ts", "src/adapters/db/capture-task-store.ts", "src/adapters/db/capture-task-commands.ts",
  "src/lib/auth/types.ts", "src/core/contracts/base.ts", "src/core/contracts/index.ts", "src/core/contracts/modules.ts", "src/core/contracts/unit-of-work.ts", "src/core/contracts/operations.ts",
  "src/core/capturas/index.ts", "src/core/capturas/types.ts", "src/core/capturas/use-cases.ts", "src/core/capturas/wiki.ts", "src/core/capturas/attachments.ts",
  "src/core/tarefas/index.ts", "src/core/tarefas/types.ts", "src/core/tarefas/use-cases.ts", "src/core/tarefas/model.ts", "node_modules/server-only/empty.js",
];
export type CaptureNativeModule = typeof CAPTURE_NATIVE_MODULES[number];
export const CAPTURE_NATIVE_STAGES: readonly ["BASELINE", "CREATE", "UPDATE", "CONVERT", "CORE_REPLAY", "RPC_REPLAY", "TASK_DELETE", "TASK_RESTORE", "CAPTURE_DELETE", "CAPTURE_RESTORE", "FINAL"];
export type CaptureNativeStage = typeof CAPTURE_NATIVE_STAGES[number];
export type CaptureNativeCode = "SETUP_REFUSED" | "GRAPH_REFUSED" | "STATE_REFUSED" | "RESPONSE_REFUSED" | "DEADLINE_EXCEEDED" | "TRANSPORT_FAILED" | "OWNERSHIP_REFUSED" | "SNAPSHOT_CHANGED" | "DOMAIN_REFUSED" | "COMMIT_UNCONFIRMED" | "REPLAY_NOT_PROVEN" | "EVENT_NOT_PROVEN" | "TOKEN_LIFETIME_REFUSED" | "CALL_LIMIT_REFUSED";
export type CaptureNativeActor = Readonly<{ id: string; accessToken: string; sessionId: string; expiresAt: number }>;
/** Must already be verified by the caller through GUI/getUser/ordinary access.
 * Decoded JWT claims in this helper are binding hints, not identity authority. */
export type CaptureNativeContext = Readonly<{
  runtime: Readonly<{ ci: true; githubActions: true; localAuthRun: true; appUrl: typeof CAPTURE_NATIVE_APP; supabaseUrl: typeof CAPTURE_NATIVE_API }>;
  publishableKey: string; serverSecretKey: string; a: CaptureNativeActor; b: CaptureNativeActor;
}>;
export type CaptureNativeRequest = Readonly<{
  method: "GET" | "POST";
  headers: Readonly<{ apikey: string; Authorization: string; Accept: "application/json"; "Content-Type"?: "application/json" }>;
  body?: string; redirect: "error"; cache: "no-store"; signal: AbortSignal;
}>;
/** Mandatory caller-owned finite HTTP transport. There is no default fetch/SDK. */
export type CaptureNativeTransport = (url: string, request: CaptureNativeRequest) => Promise<Response>;
export type CaptureNativeOptions = Readonly<{ transport: CaptureNativeTransport; timeoutMs?: number }>;
export type CaptureNativeCounts = Readonly<{
  requests: number; rpcRequests: number; publicRequests: number; coreCommands: number; commitAttempts: number;
  committedReplies: number; replayedReplies: number; events: number; receipts: number;
}>;
export type CaptureNativeChecks = Readonly<{
  freshOwnBaseline: boolean; createPersisted: boolean; updatePersisted: boolean; conversionLinked: boolean;
  coreReplayUnchanged: boolean; rpcReplayUnchanged: boolean; taskTrashPreserved: boolean; taskRestored: boolean;
  captureTrashPreserved: boolean; captureRestored: boolean; publicOwnAndForeign: boolean; eventsAndReceiptsAtomic: boolean;
}>;
type CaptureNativeReportBase = Readonly<{
  schemaVersion: 1; scenario: "capture-task-persistence";
  stages: readonly Readonly<{ name: CaptureNativeStage; passed: boolean }>[];
  counts: CaptureNativeCounts; checks: CaptureNativeChecks;
}>;
/** Protocol PASS only. Native provenance is established by the own CI envelope. */
export type CaptureNativeReport = CaptureNativeReportBase & (
  Readonly<{ status: "passed"; code: "PASSED"; failurePoint: null; writeOutcomeUncertain: false }> |
  Readonly<{ status: "failed"; code: CaptureNativeCode; failurePoint: "PREREQUISITE" | CaptureNativeStage; writeOutcomeUncertain: boolean }>
);
export type CaptureNativeMetadata = Readonly<{
  state: "prepared" | "running" | "passed" | "failed" | "disposed";
  passed: boolean; writeOutcomeUncertain: boolean; moduleCount: number;
}>;
export type CaptureNativeAcceptance = Readonly<{
  run(): Promise<CaptureNativeReport>; metadata(): CaptureNativeMetadata; dispose(): void;
}>;
export type CaptureNativeActualCore = Readonly<{
  createCaptureTaskGateway: typeof createCaptureTaskGateway; parseCaptureTaskSnapshot: typeof parseCaptureTaskSnapshot;
  createCaptureTaskStore: typeof createCaptureTaskStore; CommitOutcomeUnknown: typeof CommitOutcomeUnknown;
  decodeCaptureTaskRequest: typeof decodeCaptureTaskRequest; executeCaptureTaskCommand: typeof executeCaptureTaskCommand;
  ErroDeDominio: typeof ErroDeDominio; AuthGuardError: typeof AuthGuardError;
}>;
export function validateCaptureNativeInventory(paths: unknown): readonly CaptureNativeModule[];
export function loadCaptureNativeCore(): Promise<Readonly<{ core: CaptureNativeActualCore; modules: readonly CaptureNativeModule[] }>>;
export function createCaptureTaskNativeAcceptance(context: CaptureNativeContext, options: CaptureNativeOptions): Promise<CaptureNativeAcceptance>;

export const CAPTURE_NATIVE_CHECKS: readonly (keyof CaptureNativeChecks)[];
export const CAPTURE_NATIVE_FAILURE_CODES: readonly CaptureNativeCode[];
export const CAPTURE_NATIVE_PASS_COUNTS: Readonly<{ requests: 45; rpcRequests: 29; publicRequests: 16; coreCommands: 8; commitAttempts: 9; committedReplies: 7; replayedReplies: 2; events: 8; receipts: 7 }>;
export const CAPTURE_NATIVE_COUNT_LIMITS: Readonly<{ requests: 64; rpcRequests: 64; publicRequests: 64; coreCommands: 8; commitAttempts: 9; committedReplies: 7; replayedReplies: 2; events: 8; receipts: 7 }>;
