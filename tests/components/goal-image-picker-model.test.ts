import { describe, expect, it } from "vitest";
import {
  chooseGoalImageCandidate, createGoalImageDraft, goalImageDecision, invalidateGoalImageDraft, removeGoalImageChoice, undoGoalImageChoice,
  type GoalImageCandidate, type GoalImageDraftScope,
} from "../../src/components/features/financeiro/goals/goal-image-picker-model";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const scope = (): GoalImageDraftScope => ({ ownerId: id(1), epoch: id(2), editorKey: "editor-local-1", goalId: id(3), goalRevision: "4", baselineFileId: id(5) });
const file = (generation = 1): GoalImageCandidate => ({ generation, name: "paisagem.png", size: 4200, mime: "image/png" });
describe("Meta — local image choice before upload and financial review", () => {
  it("preserves the captured existing photo through replacement, removal and undo", () => {
    const context = scope(), original = createGoalImageDraft(context);
    let draft = chooseGoalImageCandidate(original, context, file());
    expect(goalImageDecision(draft, context)).toMatchObject({ kind: "needs-upload", candidate: file() });
    draft = chooseGoalImageCandidate(draft, context, { ...file(2), name: "outra.jpeg", mime: "image/jpeg" });
    expect(draft.choice).toMatchObject({ kind: "selected", candidate: { generation: 2, name: "outra.jpeg" } });
    draft = removeGoalImageChoice(draft, context);
    expect(goalImageDecision(draft, context)).toEqual({ kind: "remove", imageFileId: null });
    draft = undoGoalImageChoice(draft, context);
    expect(goalImageDecision(draft, context)).toEqual({ kind: "unchanged", persistence: "omit" });
    expect(draft.scope.baselineFileId).toBe(id(5)); expect(original.choice).toEqual({ kind: "preserve" });
    expect(chooseGoalImageCandidate(draft, context, file(2)).error).toBe("format");
    expect(chooseGoalImageCandidate(draft, context, file(3)).choice.kind).toBe("selected");
  });
  it("blocks a new goal's selected photo instead of silently replacing it with null", () => {
    const context = { ...scope(), goalId: null, goalRevision: null, baselineFileId: null };
    const initial = createGoalImageDraft(context);
    expect(goalImageDecision(initial, context)).toEqual({ kind: "unchanged", persistence: "default-null" });
    const selected = chooseGoalImageCandidate(initial, context, file());
    expect(goalImageDecision(selected, context)).toEqual({ kind: "needs-upload", candidate: file() });
    expect(goalImageDecision(selected, context)).not.toHaveProperty("imageFileId");
    expect(goalImageDecision(selected, context)).not.toHaveProperty("persistence");
    expect(goalImageDecision(selected, context)).not.toHaveProperty("ready");
    expect(goalImageDecision(undoGoalImageChoice(selected, context), context)).toEqual({ kind: "unchanged", persistence: "default-null" });
  });
  it("native chooser cancellation is a no-op even after an invalid replacement", () => {
    const context = scope(), selected = chooseGoalImageCandidate(createGoalImageDraft(context), context, file());
    const invalid = chooseGoalImageCandidate(selected, context, { ...file(2), mime: "application/pdf" });
    expect(invalid.error).toBe("format"); expect(invalid.choice).toEqual(selected.choice);
    expect(chooseGoalImageCandidate(invalid, context, null)).toEqual(invalid);
    const removal = removeGoalImageChoice(invalid, context);
    expect(chooseGoalImageCandidate(removal, context, null)).toEqual(removal);
  });
  it("refuses empty/oversize files without losing a previous selection, accepts the exact 8MiB boundary", () => {
    const context = scope(), selected = chooseGoalImageCandidate(createGoalImageDraft(context), context, file());
    for (const size of [0, -1, 0.5, 8388609, Number.NaN, Number.POSITIVE_INFINITY, "12"]) {
      const next = chooseGoalImageCandidate(selected, context, { ...file(2), size });
      expect(next.error).toBe("size"); expect(next.choice).toEqual(selected.choice);
    }
    expect(chooseGoalImageCandidate(selected, context, { ...file(2), size: 8388608 }).choice).toMatchObject({ kind: "selected", candidate: { size: 8388608 } });
  });
  it("uses the existing safe-file-name rule, never treating metadata as validated bytes", () => {
    const context = scope(), initial = createGoalImageDraft(context);
    for (const name of ["", " ", "../photo.png", "bad\\photo.png", "image.svg", "hidden.js", "a".repeat(201), "bad\u0000name.png"]) {
      expect(chooseGoalImageCandidate(initial, context, { ...file(), name })).toMatchObject({ error: "name", choice: { kind: "preserve" } });
    }
    const selected = chooseGoalImageCandidate(initial, context, { ...file(), name: "  cafe\u0301.png  " });
    expect(goalImageDecision(selected, context)).toMatchObject({ kind: "needs-upload", candidate: { name: "café.png" } });
    // A declared MIME is only local convenience; even metadata accepted here cannot become a ready file.
    for (const mime of ["image/jpeg", "image/png", "image/webp", "image/gif"]) expect(goalImageDecision(chooseGoalImageCandidate(initial, context, { ...file(), mime }), context).kind).toBe("needs-upload");
  });
  it("rejects new owner, epoch, editor, goal, revision or baseline before any reusable selection", () => {
    const context = scope(), selected = chooseGoalImageCandidate(createGoalImageDraft(context), context, file());
    for (const change of [{ ownerId: id(91) }, { epoch: id(92) }, { editorKey: "other-editor" }, { goalId: id(93) }, { goalRevision: "5" }, { baselineFileId: id(95) }]) {
      const changed = { ...context, ...change };
      expect(goalImageDecision(selected, changed)).toEqual({ kind: "stale" });
      const fenced = chooseGoalImageCandidate(selected, changed, file(2));
      expect(fenced).toMatchObject({ error: "stale", choice: { kind: "preserve" } });
      expect(goalImageDecision(undoGoalImageChoice(fenced, context), context)).toEqual({ kind: "stale" });
      expect(removeGoalImageChoice(selected, changed).error).toBe("stale");
    }
    expect(goalImageDecision(invalidateGoalImageDraft(selected), context)).toEqual({ kind: "stale" });
  });
  it("captures independent immutable scope, candidate and projection copies", () => {
    const context = scope(), metadata = file(), initial = createGoalImageDraft(context);
    const selected = chooseGoalImageCandidate(initial, context, metadata), projection = goalImageDecision(selected, context);
    context.baselineFileId = id(90); metadata.name = "mutated.png";
    expect(selected.scope.baselineFileId).toBe(id(5)); expect(selected.choice).toMatchObject({ candidate: { name: "paisagem.png" } });
    expect(Object.isFrozen(selected)).toBe(true); expect(Object.isFrozen(selected.scope)).toBe(true); expect(Object.isFrozen(selected.choice)).toBe(true);
    if (selected.choice.kind !== "selected" || projection.kind !== "needs-upload") throw Error("Expected a local selection.");
    expect(Object.isFrozen(selected.choice.candidate)).toBe(true); expect(Object.isFrozen(projection.candidate)).toBe(true);
    expect(projection.candidate).not.toBe(selected.choice.candidate); expect(selected.scope).not.toBe(initial.scope);
    const candidate = selected.choice.candidate;
    expect(() => Object.assign(candidate, { name: "injected.png" })).toThrow();
  });
  it("refuses scope corruption and accessor metadata without evaluating getters", () => {
    for (const change of [{ ownerId: "bad" }, { epoch: "" }, { editorKey: " " }, { editorKey: "a".repeat(129) }, { goalRevision: "04" }, { goalRevision: "9223372036854775808" }, { goalId: null }, { extra: true }]) expect(() => createGoalImageDraft({ ...scope(), ...change })).toThrow();
    let reads = 0;
    const evilScope = { ...scope(), get ownerId() { reads++; return id(1); } };
    expect(() => createGoalImageDraft(evilScope)).toThrow(); expect(reads).toBe(0);
    const context = scope(), draft = createGoalImageDraft(context), candidate = { ...file(), get name() { reads++; return "photo.png"; } };
    expect(chooseGoalImageCandidate(draft, context, candidate).error).toBe("format"); expect(reads).toBe(0);
    expect(chooseGoalImageCandidate(draft, context, { ...file(), finalized: true, fileId: id(100) }).error).toBe("format");
  });
  it("never wraps or reuses local generations after a selection has been undone", () => {
    const context = scope(), initial = createGoalImageDraft(context);
    for (const generation of [0, -1, 1.5, 2147483648, Number.NaN, "1"]) expect(chooseGoalImageCandidate(initial, context, { ...file(), generation }).error).toBe("format");
    const last = chooseGoalImageCandidate(initial, context, file(2147483647)), undone = undoGoalImageChoice(last, context);
    expect(undone.lastGeneration).toBe(2147483647);
    expect(chooseGoalImageCandidate(undone, context, file()).error).toBe("format");
    expect(goalImageDecision(undone, context)).toEqual({ kind: "unchanged", persistence: "omit" });
  });
});
