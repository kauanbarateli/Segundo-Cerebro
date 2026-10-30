import type { Buffer } from "node:buffer";
export type CanonicalMigrationSource = Readonly<{ file: string; source: Buffer }>;
export const CURRENT27_CANONICAL_REVIEW: readonly Readonly<{ file: string; bytes: number; sha256: string }>[];
export class CanonicalReleaseSourceError extends Error {
  readonly code: "SOURCE_FILE_REFUSED" | "MIGRATION_MANIFEST_REFUSED" | "MIGRATION_INTEGRITY_FAILED";
}
/** File/manifest bytes only; Git/catalogue/types/installation are separate gates. */
export function readCurrent27CanonicalMigrations(root?: string): Promise<readonly CanonicalMigrationSource[]>;
/** Validates the entire CURRENT27 before returning the exact fixed 001–026 prefix. */
export function readHistorical026CanonicalMigrations(root?: string): Promise<readonly CanonicalMigrationSource[]>;
