import type { CaptureNativeContext } from "./capture-task-persistence-support.mjs";
import type { prepararArquivo } from "../../src/adapters/db/files-processor";
import type { readFilePolicy } from "../../src/adapters/db/files-policy";
import type sharp from "sharp";
import type { Arquivo } from "../../src/core/drive";
import type { Captura } from "../../src/core/capturas";

export const CAPTURE_IMAGE_STAGES: readonly ["BASELINE", "RESERVE", "SIGNED_PUT", "CLAIM", "MEASURE", "PREPARE", "PUBLISH", "COMPLETE", "DOWNLOAD", "CAPTURE", "PUBLIC_FINAL", "SQL_FINAL"];
export const CAPTURE_IMAGE_CHECKS: readonly ["ordinaryOwnBaseline", "reservationBound", "signedPutWithoutCredentials", "leaseBound", "serverBytesMeasured", "originalProcessorUsed", "finalObjectPublished", "finalizedReceiptProven", "finalBytesExifFree", "captureAttachmentAtomic", "publicOwnAndForeign", "sqlAtomicLedger"];
export const CAPTURE_IMAGE_CLEANUP_STAGES: readonly ["STAGING_REMOVE", "STAGING_ABSENT", "FINAL_REMOVE", "FINAL_ABSENT"];
export const CAPTURE_IMAGE_FAILURE_CODES: readonly ["SETUP_REFUSED", "GRAPH_REFUSED", "STATE_REFUSED", "TOKEN_LIFETIME_REFUSED", "CALL_LIMIT_REFUSED", "TRANSPORT_REFUSED", "TRANSPORT_FAILED", "DEADLINE_EXCEEDED", "RESPONSE_REFUSED", "OWNERSHIP_REFUSED", "SQL_REFUSED", "MEDIA_NOT_PROVEN", "PERSISTENCE_NOT_PROVEN", "COMMIT_UNCONFIRMED", "CLEANUP_NOT_PROVEN", "WRITE_OUTCOME_UNCERTAIN"];
export const CAPTURE_IMAGE_LIMITS: Readonly<{ requests: 48; responseBytes: 1048576; timeoutMs: 15000 }>;
export const CAPTURE_IMAGE_MODULES: readonly string[];
export const CAPTURE_IMAGE_PASS_COUNTS: Readonly<{ requests: 27; rpcRequests: 10; publicRequests: 10; storageRequests: 7; signedPuts: 1; coreCommands: 1; commitAttempts: 1; sqlInspections: 1; events: 2; receipts: 2 }>;
export const CAPTURE_IMAGE_CLEANUP_PASS_COUNTS: Readonly<{ requests: 4; removeRequests: 2; absenceReads: 2; removedObjects: 2 }>;
export type CaptureImageStage = typeof CAPTURE_IMAGE_STAGES[number];
export type CaptureImageCleanupStage = typeof CAPTURE_IMAGE_CLEANUP_STAGES[number];
export type CaptureImageFailureCode = typeof CAPTURE_IMAGE_FAILURE_CODES[number];
export type CaptureImageCounts = Readonly<Record<keyof typeof CAPTURE_IMAGE_PASS_COUNTS, number>>;
export type CaptureImageChecks = Readonly<Record<typeof CAPTURE_IMAGE_CHECKS[number], boolean>>;
export type CaptureImageMeasurements = Readonly<{ sourceBytes: number; finalBytes: number; sourceWidth: number; sourceHeight: number; finalWidth: number; finalHeight: number }>;
export type CaptureImageCleanupCounts = Readonly<Record<keyof typeof CAPTURE_IMAGE_CLEANUP_PASS_COUNTS, number>>;
type ReportBase = Readonly<{ schemaVersion: 1; scenario: "capture-image-storage"; stages: readonly Readonly<{ name: CaptureImageStage; passed: boolean }>[]; counts: CaptureImageCounts; checks: CaptureImageChecks; measurements: CaptureImageMeasurements }>;
/** Protocol only. Own native CI envelope and caller SQL namespace proof required. */
export type CaptureImagePassed = ReportBase & Readonly<{ status: "passed"; code: "PASSED"; failurePoint: null; writeOutcomeUncertain: false }>;
export type CaptureImageFailed = ReportBase & Readonly<{ status: "failed"; code: CaptureImageFailureCode; failurePoint: CaptureImageStage | "PREREQUISITE"; writeOutcomeUncertain: boolean }>;
export type CaptureImageReport = CaptureImagePassed | CaptureImageFailed;
type CleanupBase = Readonly<{ schemaVersion: 1; scenario: "capture-image-storage-cleanup"; stages: readonly Readonly<{ name: CaptureImageCleanupStage; passed: boolean }>[]; counts: CaptureImageCleanupCounts }>;
export type CaptureImageCleanupPassed = CleanupBase & Readonly<{ status: "passed"; code: "PASSED"; failurePoint: null; exactInventory: true; objectsAbsent: true; authDeletionAllowed: true; writeOutcomeUncertain: false }>;
export type CaptureImageCleanupFailed = CleanupBase & Readonly<{ status: "failed"; code: CaptureImageFailureCode; failurePoint: CaptureImageCleanupStage | "PREREQUISITE"; exactInventory: false; objectsAbsent: false; authDeletionAllowed: false; writeOutcomeUncertain: boolean }>;
export type CaptureImageCleanupReport = CaptureImageCleanupPassed | CaptureImageCleanupFailed;
export type CaptureImageRequest = Readonly<{ method: "GET" | "POST" | "PUT" | "DELETE"; headers: Readonly<Record<string, string>>; body?: string | Uint8Array | FormData; signal: AbortSignal; redirect: "error"; cache: "no-store"; credentials: "omit" }>;
export type CaptureImageTransport = (url: string, request: CaptureImageRequest) => Promise<Response>;
export type CaptureImageSqlIds = Readonly<{ ownerId: string; uploadId: string; captureId: string }>;
export type CaptureImageSqlProof = Readonly<{
  file: Readonly<{ id: string; user_id: string; payload: Arquivo; storage_path: string; purged_at: null }>;
  capture: Readonly<{ id: string; user_id: string; payload: Captura }>;
  links: readonly Readonly<{ user_id: string; capture_id: string; file_id: string }>[];
  events: readonly Readonly<{ id: string; user_id: string; entity_type: "drive_file" | "capture"; entity_id: string; action: "created"; canal: "web"; occurred_at: string; before: null; after: Arquivo | Captura }>[];
  receipts: readonly Readonly<{ user_id: string; command: "file.upload.finalize" | "capture.create"; client_id: string; result: Arquivo | Captura }>[];
}>;
/** Mandatory caller-owned FIXED READ ONLY local query. Receives three IDs only,
 * never SQL text. Caller verifies PG17/namespace/fixture and uses statement timeout.
 * This interface and pure doubles do not establish that native provenance. */
export type CaptureImageSqlInspector = (ids: CaptureImageSqlIds) => Promise<CaptureImageSqlProof>;
export type CaptureImageOptions = Readonly<{ transport: CaptureImageTransport; inspectSql: CaptureImageSqlInspector; timeoutMs?: number }>;
export type CaptureImageMetadata = Readonly<{ state: "prepared" | "running" | "cleaning" | "passed" | "failed" | "disposed"; pipelinePassed: boolean; objectsCleanupConfirmed: boolean; writeOutcomeUncertain: boolean; authDeletionAllowed: boolean; moduleCount: number }>;
export type CaptureImageAcceptance = Readonly<{ run(): Promise<CaptureImageReport>; cleanupObjects(): Promise<CaptureImageCleanupReport>; metadata(): CaptureImageMetadata; dispose(): void }>;
export function loadCaptureImageProcessor(): Promise<Readonly<{ processor: Readonly<{ prepararArquivo: typeof prepararArquivo; readFilePolicy: typeof readFilePolicy; sharp: typeof sharp }>; modules: readonly string[] }>>;
export function createCaptureImageStorageAcceptance(context: CaptureNativeContext, options: CaptureImageOptions): Promise<CaptureImageAcceptance>;
