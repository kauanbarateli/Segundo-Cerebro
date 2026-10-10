import type { CaptureImageReport, CaptureImagePassed, CaptureImageCleanupReport, CaptureImageCleanupPassed, CAPTURE_IMAGE_STAGES, CAPTURE_IMAGE_CHECKS, CAPTURE_IMAGE_CLEANUP_STAGES, CAPTURE_IMAGE_FAILURE_CODES, CAPTURE_IMAGE_PASS_COUNTS, CAPTURE_IMAGE_CLEANUP_PASS_COUNTS } from "./capture-image-storage-support.mjs";
export const CAPTURE_IMAGE_REPORT_KEYS: readonly ["schemaVersion", "scenario", "status", "code", "failurePoint", "stages", "counts", "checks", "measurements", "writeOutcomeUncertain"];
export const CAPTURE_IMAGE_CLEANUP_KEYS: readonly ["schemaVersion", "scenario", "status", "code", "failurePoint", "stages", "counts", "exactInventory", "objectsAbsent", "authDeletionAllowed", "writeOutcomeUncertain"];
export const CAPTURE_IMAGE_PACKET_KEYS: readonly ["schemaVersion", "scenario", "status", "code", "pipeline", "cleanup", "writeOutcomeUncertain", "authDeletionAllowed"];
export const CAPTURE_IMAGE_CONTRACT_STAGES: typeof CAPTURE_IMAGE_STAGES;
export const CAPTURE_IMAGE_CONTRACT_CHECKS: typeof CAPTURE_IMAGE_CHECKS;
export const CAPTURE_IMAGE_CONTRACT_CLEANUP_STAGES: typeof CAPTURE_IMAGE_CLEANUP_STAGES;
export const CAPTURE_IMAGE_CONTRACT_FAILURE_CODES: typeof CAPTURE_IMAGE_FAILURE_CODES;
export const CAPTURE_IMAGE_CONTRACT_PASS_COUNTS: typeof CAPTURE_IMAGE_PASS_COUNTS;
export const CAPTURE_IMAGE_CONTRACT_CLEANUP_COUNTS: typeof CAPTURE_IMAGE_CLEANUP_PASS_COUNTS;
export type CaptureImageAssembly = Readonly<{ pipeline: CaptureImageReport | null; cleanup: CaptureImageCleanupReport | null; writeOutcomeUncertain: boolean }>;
/** Standalone protocol packet; matching values are not native run provenance. */
type PacketBase = Readonly<{ schemaVersion: 1; scenario: "capture-image-storage" }>;
export type CaptureImagePacket = PacketBase & (
  Readonly<{ status: "passed"; code: "PASSED"; pipeline: CaptureImagePassed; cleanup: CaptureImageCleanupPassed; writeOutcomeUncertain: false; authDeletionAllowed: true }> |
  Readonly<{ status: "failed"; code: "PIPELINE_FAILED" | "CLEANUP_FAILED" | "WRITE_OUTCOME_UNCERTAIN"; pipeline: CaptureImageReport | null; cleanup: CaptureImageCleanupReport | null; writeOutcomeUncertain: boolean; authDeletionAllowed: boolean }> |
  Readonly<{ status: "not-run"; code: "DEPENDENCY_NOT_RUN"; pipeline: CaptureImageReport | null; cleanup: CaptureImageCleanupReport | null; writeOutcomeUncertain: false; authDeletionAllowed: false }>
);
export function validateCaptureImageStorageReport(value: unknown): CaptureImageReport;
export function validateCaptureImageCleanupReport(value: unknown): CaptureImageCleanupReport;
export function assembleCaptureImageStoragePacket(value: CaptureImageAssembly): CaptureImagePacket;
export function validateCaptureImageStoragePacket(value: unknown): CaptureImagePacket;
