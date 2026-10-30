import { nomeSeguroArquivo } from "@/core/drive/rules";

/** Local metadata only. None of these values proves upload, ownership or finalization. */
export interface GoalImageDraftScope {
  ownerId: string;
  epoch: string;
  editorKey: string;
  goalId: string | null;
  goalRevision: string | null;
  baselineFileId: string | null;
}
export interface GoalImageCandidate {
  generation: number;
  name: string;
  size: number;
  mime: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
}
export type GoalImageChoice =
  | Readonly<{ kind: "preserve" }>
  | Readonly<{ kind: "remove" }>
  | Readonly<{ kind: "selected"; candidate: Readonly<GoalImageCandidate> }>;
export interface GoalImageDraft {
  readonly scope: Readonly<GoalImageDraftScope>;
  readonly choice: GoalImageChoice;
  readonly lastGeneration: number;
  readonly error: "name" | "size" | "format" | "stale" | null;
}
export type GoalImageDecision =
  | Readonly<{ kind: "unchanged"; persistence: "omit" | "default-null" }>
  | Readonly<{ kind: "remove"; imageFileId: null }>
  | Readonly<{ kind: "needs-upload"; candidate: Readonly<GoalImageCandidate> }>
  | Readonly<{ kind: "stale" }>;

const scopeKeys = ["ownerId", "epoch", "editorKey", "goalId", "goalRevision", "baselineFileId"] as const;
const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const revision = (value: unknown): value is string => typeof value === "string" && /^(?:0|[1-9][0-9]{0,18})$/.test(value) && BigInt(value) <= 9223372036854775807n;

/** Inspect descriptors before values: local metadata must not execute accessors. */
function record(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) throw Error("Invalid local image metadata.");
  const descriptors = Object.getOwnPropertyDescriptors(value), names = Reflect.ownKeys(descriptors);
  if (names.length !== keys.length || names.some(key => typeof key !== "string" || !keys.includes(key))) throw Error("Invalid local image metadata.");
  const entries: [string, unknown][] = [];
  for (const key of keys) {
    const descriptor = descriptors[key];
    if (!descriptor || !Object.hasOwn(descriptor, "value")) throw Error("Invalid local image metadata.");
    entries.push([key, descriptor.value]);
  }
  return Object.fromEntries(entries);
}
function scope(value: unknown): Readonly<GoalImageDraftScope> {
  const row = record(value, scopeKeys);
  if (!uuid(row.ownerId) || !uuid(row.epoch) || typeof row.editorKey !== "string" || row.editorKey.trim().length === 0 || row.editorKey.length > 128 || /[\u0000-\u001f\u007f]/.test(row.editorKey) ||
    (row.goalId !== null && !uuid(row.goalId)) || (row.baselineFileId !== null && !uuid(row.baselineFileId)) ||
    (row.goalId === null ? row.goalRevision !== null || row.baselineFileId !== null : !revision(row.goalRevision))) throw Error("Invalid local image scope.");
  return Object.freeze({ ownerId: row.ownerId.toLowerCase(), epoch: row.epoch.toLowerCase(), editorKey: row.editorKey,
    goalId: row.goalId?.toLowerCase() ?? null, goalRevision: row.goalRevision as string | null, baselineFileId: row.baselineFileId?.toLowerCase() ?? null });
}
function copy(draft: GoalImageDraft, choice: GoalImageChoice = draft.choice, error: GoalImageDraft["error"] = draft.error, lastGeneration = draft.lastGeneration): GoalImageDraft {
  const nextChoice: GoalImageChoice = choice.kind === "selected" ? Object.freeze({ kind: "selected", candidate: Object.freeze({ ...choice.candidate }) }) : Object.freeze({ ...choice });
  return Object.freeze({ scope: Object.freeze({ ...draft.scope }), choice: nextChoice, error, lastGeneration });
}
function matches(draft: GoalImageDraft, expected: unknown): boolean {
  if (draft.error === "stale") return false;
  try { const current = scope(expected); return scopeKeys.every(key => draft.scope[key] === current[key]); } catch { return false; }
}
export function createGoalImageDraft(value: unknown): GoalImageDraft {
  return Object.freeze({ scope: scope(value), choice: Object.freeze({ kind: "preserve" }), error: null, lastGeneration: 0 });
}
export function invalidateGoalImageDraft(draft: GoalImageDraft): GoalImageDraft {
  return copy(draft, { kind: "preserve" }, "stale");
}
export function chooseGoalImageCandidate(draft: GoalImageDraft, expected: unknown, value: unknown | null): GoalImageDraft {
  if (!matches(draft, expected)) return invalidateGoalImageDraft(draft);
  // A native chooser cancelled without a new File changes nothing, including an earlier error.
  if (value === null) return copy(draft);
  let row: Record<string, unknown>;
  try { row = record(value, ["generation", "name", "size", "mime"]); } catch { return copy(draft, draft.choice, "format"); }
  if (!Number.isInteger(row.generation) || Number(row.generation) <= draft.lastGeneration || Number(row.generation) > 2147483647) return copy(draft, draft.choice, "format");
  if (!Number.isInteger(row.size) || Number(row.size) < 1 || Number(row.size) > 8 * 1024 * 1024) return copy(draft, draft.choice, "size");
  if (row.mime !== "image/png" && row.mime !== "image/jpeg" && row.mime !== "image/webp" && row.mime !== "image/gif") return copy(draft, draft.choice, "format");
  let name: string;
  try { name = nomeSeguroArquivo(row.name); } catch { return copy(draft, draft.choice, "name"); }
  return copy(draft, { kind: "selected", candidate: { generation: Number(row.generation), name, size: Number(row.size), mime: row.mime } }, null, Number(row.generation));
}
export function removeGoalImageChoice(draft: GoalImageDraft, expected: unknown): GoalImageDraft {
  return matches(draft, expected) ? copy(draft, { kind: "remove" }, null) : invalidateGoalImageDraft(draft);
}
export function undoGoalImageChoice(draft: GoalImageDraft, expected: unknown): GoalImageDraft {
  return matches(draft, expected) ? copy(draft, { kind: "preserve" }, null) : invalidateGoalImageDraft(draft);
}
/** A selection has NO null/omission fallback and NO ready state in this local-only slice. */
export function goalImageDecision(draft: GoalImageDraft, expected: unknown): GoalImageDecision {
  if (!matches(draft, expected)) return Object.freeze({ kind: "stale" });
  if (draft.choice.kind === "selected") return Object.freeze({ kind: "needs-upload", candidate: Object.freeze({ ...draft.choice.candidate }) });
  if (draft.choice.kind === "remove") return Object.freeze({ kind: "remove", imageFileId: null });
  return Object.freeze({ kind: "unchanged", persistence: draft.scope.goalId === null ? "default-null" : "omit" });
}
