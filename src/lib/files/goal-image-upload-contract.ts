/** Metadata only. Structurally compatible with the local B2a scope/candidate;
 * no component, File, capability, GoalCommand or finalization proof lives here. */
import { nomeSeguroArquivo } from "../../core/drive/rules";
export const GOAL_IMAGE_UPLOAD_METADATA_BYTES = 8 * 1024;
export interface GoalImageUploadScope {
  ownerId: string; epoch: string; editorKey: string;
  goalId: string | null; goalRevision: string | null; baselineFileId: string | null;
}
export interface GoalImageUploadSelection {
  generation: number; name: string; size: number;
  mime: "image/png" | "image/jpeg" | "image/webp" | "image/gif"; sha256: string;
}
export const GOAL_IMAGE_UPLOAD_PHASES = ["prepared", "reserving", "reserved", "put-uncertain", "put-confirmed", "finalizing", "ready-unbound"] as const;
export type GoalImageUploadPhase = typeof GOAL_IMAGE_UPLOAD_PHASES[number];
export interface GoalImageUploadMetadata {
  version: 1; purpose: "finance_goal_image"; scope: GoalImageUploadScope;
  selection: GoalImageUploadSelection; uploadClientId: string;
  uploadId: string | null; phase: GoalImageUploadPhase;
}
export interface GoalImageUploadJournalSnapshot {
  version: 2; ownerId: string; epoch: string; revision: string;
  state: "empty" | "active" | "retirement-review";
  attempt: GoalImageUploadMetadata | null;
}
export class GoalImageUploadContractError extends Error {
  constructor() { super("Invalid Goal image upload metadata."); this.name = "GoalImageUploadContractError"; }
}
function invalid(): never { throw new GoalImageUploadContractError(); }
export function goalImageUploadRecord(value: unknown, fields: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  const prototype = Object.getPrototypeOf(value); if (prototype !== Object.prototype && prototype !== null) return invalid();
  const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(descriptors);
  if (keys.length !== fields.length || keys.some(key => typeof key !== "string" || !fields.includes(key))) return invalid();
  const result: Record<string, unknown> = Object.create(null);
  for (const key of fields) { const descriptor = descriptors[key]; if (!descriptor || !Object.hasOwn(descriptor, "value")) return invalid(); result[key] = descriptor.value; }
  return result;
}
export function goalImageUploadUuid(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) return invalid();
  return value.toLowerCase();
}
export function decodeGoalImageUploadScope(value: unknown): GoalImageUploadScope {
  const row = goalImageUploadRecord(value, ["ownerId", "epoch", "editorKey", "goalId", "goalRevision", "baselineFileId"]);
  const ownerId = goalImageUploadUuid(row.ownerId), epoch = goalImageUploadUuid(row.epoch), goalId = row.goalId === null ? null : goalImageUploadUuid(row.goalId), baselineFileId = row.baselineFileId === null ? null : goalImageUploadUuid(row.baselineFileId);
  if (typeof row.editorKey !== "string" || !row.editorKey.trim() || row.editorKey.length > 128 || /[\u0000-\u001f\u007f]/.test(row.editorKey)) return invalid();
  if (goalId === null ? row.goalRevision !== null || baselineFileId !== null : typeof row.goalRevision !== "string" || !/^(?:0|[1-9][0-9]{0,18})$/.test(row.goalRevision) || BigInt(row.goalRevision) > 9223372036854775807n) return invalid();
  return { ownerId, epoch, editorKey: row.editorKey, goalId, goalRevision: row.goalRevision as string | null, baselineFileId };
}
export function decodeGoalImageUploadMetadata(value: unknown): GoalImageUploadMetadata {
  const row = goalImageUploadRecord(value, ["version", "purpose", "scope", "selection", "uploadClientId", "uploadId", "phase"]);
  const scope = decodeGoalImageUploadScope(row.scope), selected = goalImageUploadRecord(row.selection, ["generation", "name", "size", "mime", "sha256"]);
  if (row.version !== 1 || row.purpose !== "finance_goal_image" || typeof row.phase !== "string" || !GOAL_IMAGE_UPLOAD_PHASES.some(phase => phase === row.phase)) return invalid();
  if (typeof selected.generation !== "number" || !Number.isInteger(selected.generation) || selected.generation < 1 || selected.generation > 2147483647 || typeof selected.size !== "number" || !Number.isInteger(selected.size) || selected.size < 1 || selected.size > 8 * 1024 * 1024 || typeof selected.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(selected.sha256)) return invalid();
  if (selected.mime !== "image/png" && selected.mime !== "image/jpeg" && selected.mime !== "image/webp" && selected.mime !== "image/gif") return invalid();
  let name: string; try { name = nomeSeguroArquivo(selected.name); } catch { return invalid(); }
  // The source name has already been canonicalized by the local picker. Do not
  // silently change a retained reserveBody while reading durable metadata.
  if (name !== selected.name) return invalid();
  const uploadClientId = goalImageUploadUuid(row.uploadClientId), uploadId = row.uploadId === null ? null : goalImageUploadUuid(row.uploadId);
  if ((row.phase === "prepared" || row.phase === "reserving") ? uploadId !== null : uploadId === null) return invalid();
  const result: GoalImageUploadMetadata = { version: 1, purpose: "finance_goal_image", scope, selection: { generation: selected.generation, name, size: selected.size, mime: selected.mime, sha256: selected.sha256 }, uploadClientId, uploadId, phase: row.phase as GoalImageUploadPhase };
  if (new TextEncoder().encode(JSON.stringify(result)).length > GOAL_IMAGE_UPLOAD_METADATA_BYTES) return invalid();
  return result;
}
export function serializeGoalImageUploadMetadata(value: unknown): string { return JSON.stringify(decodeGoalImageUploadMetadata(value)); }
/** One closed local record, never a finalization/financial proof. The initial
 * empty state cannot be reconstructed from a missing or partially cleared key. */
export function decodeGoalImageUploadJournalState(value: unknown): GoalImageUploadJournalSnapshot {
  const row = goalImageUploadRecord(value, ["version", "ownerId", "epoch", "revision", "state", "attempt"]);
  const ownerId = goalImageUploadUuid(row.ownerId), epoch = goalImageUploadUuid(row.epoch);
  if (row.version !== 2 || typeof row.revision !== "string" || !/^(?:0|[1-9][0-9]{0,18})$/.test(row.revision) || BigInt(row.revision) > 9223372036854775807n || (row.state !== "empty" && row.state !== "active" && row.state !== "retirement-review")) return invalid();
  const attempt = row.attempt === null ? null : decodeGoalImageUploadMetadata(row.attempt);
  if (row.state === "empty" ? attempt !== null || row.revision !== "0" : attempt === null || row.revision === "0") return invalid();
  if (attempt && (attempt.scope.ownerId !== ownerId || attempt.scope.epoch !== epoch || row.state === "retirement-review" && attempt.phase !== "ready-unbound")) return invalid();
  const result: GoalImageUploadJournalSnapshot = { version: 2, ownerId, epoch, revision: row.revision, state: row.state, attempt };
  if (new TextEncoder().encode(JSON.stringify(result)).length > GOAL_IMAGE_UPLOAD_METADATA_BYTES) return invalid();
  return result;
}
export function serializeGoalImageUploadJournalState(value: unknown): string { return JSON.stringify(decodeGoalImageUploadJournalState(value)); }
/** This transition records local observation only. ready-unbound is explicitly
 * NOT a receipt, a file DTO, or permission to bind a financial Goal. */
export function mayAdvanceGoalImageUpload(before: GoalImageUploadPhase, after: GoalImageUploadPhase): boolean {
  const transitions: Readonly<Record<GoalImageUploadPhase, readonly GoalImageUploadPhase[]>> = { prepared: ["reserving"], reserving: ["reserved"], reserved: ["put-uncertain"], "put-uncertain": ["put-confirmed", "finalizing"], "put-confirmed": ["finalizing"], finalizing: ["ready-unbound"], "ready-unbound": [] };
  return before === after || transitions[before].includes(after);
}
