"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { EntityImagePicker } from "@/components/layout/entity-image-picker";
import { PrivateImagePreview } from "@/components/layout/private-image";
import { useImagePreview } from "@/components/layout/use-image-preview";
import {
  chooseGoalImageCandidate, createGoalImageDraft, goalImageDecision, removeGoalImageChoice, undoGoalImageChoice,
  type GoalImageDecision, type GoalImageDraft, type GoalImageDraftScope,
} from "./goal-image-picker-model";
import "./goal-image-picker.css";

export interface GoalImagePickerProps {
  scope: GoalImageDraftScope;
  disabled?: boolean;
  /** Keeps local File/URL mounted; changes only which controls are presented. */
  reviewing?: boolean;
  /** Local immutable metadata only: never an upload proof, File or GoalCommand. */
  onChange?(draft: GoalImageDraft, decision: GoalImageDecision): void;
  /** Private editor seam: RAM only. Never forward this File to metadata callbacks. */
  onLocalSelection?(draft: GoalImageDraft, file: File | null): void;
  /** A recovered same-scope A keeps its generation; a human B must advance it. */
  generationFloor?: number;
}

/** Local presenter; an optional editor may inject it without changing the default host. */
export function GoalImagePicker({ scope, disabled = false, reviewing = false, onChange, onLocalSelection, generationFloor = 0 }: GoalImagePickerProps) {
  let initial: GoalImageDraft;
  try { initial = createGoalImageDraft(scope); } catch { return <div className="fg-image-picker"><p role="alert">Reabra a edição para escolher uma foto nesta sessão.</p></div>; }
  // Identity changes discard ONLY this local, never-submitted File. The old URL is revoked by the shared hook.
  return <LocalPicker key={JSON.stringify(initial.scope)} initial={initial} disabled={disabled} reviewing={reviewing} onChange={onChange} onLocalSelection={onLocalSelection} generationFloor={generationFloor} />;
}
function LocalPicker({ initial, disabled, reviewing, onChange, onLocalSelection, generationFloor }: { initial: GoalImageDraft; disabled: boolean; reviewing: boolean; onChange?: GoalImagePickerProps["onChange"]; onLocalSelection?: GoalImagePickerProps["onLocalSelection"]; generationFloor: number }) {
  const [local, setLocal] = useState<{ draft: GoalImageDraft; file: File | null }>({ draft: initial, file: null });
  const current = useRef(local), generation = useRef(0), alive = useRef(false), input = useRef<HTMLInputElement>(null), id = useId();
  const preview = useImagePreview(local.file), decision = goalImageDecision(local.draft, initial.scope);
  useLayoutEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  function publish(draft: GoalImageDraft, file: File | null) {
    if (disabled || !alive.current) return;
    const next = { draft, file }; current.current = next; setLocal(next); onLocalSelection?.(draft, file); onChange?.(draft, goalImageDecision(draft, initial.scope));
  }
  function choose(file: File | null) {
    if (disabled || !alive.current || file === null) return;
    if (!Number.isInteger(generationFloor) || generationFloor < 0 || generationFloor > 2147483647) return;
    generation.current = Math.max(generation.current, generationFloor);
    if (generation.current === 2147483647) return; // Never wrap or reuse a selection identity.
    const next = chooseGoalImageCandidate(current.current.draft, initial.scope, { generation: ++generation.current, name: file.name, size: file.size, mime: file.type });
    publish(next, next.error === null ? file : current.current.file);
  }
  function focusPicker() { if (input.current) { input.current.value = ""; input.current.focus(); } }
  function undo() { if (!disabled) { publish(undoGoalImageChoice(current.current.draft, initial.scope), null); focusPicker(); } }
  function remove() { if (!disabled) { publish(removeGoalImageChoice(current.current.draft, initial.scope), null); focusPicker(); } }
  const status = decision.kind === "needs-upload" ? "Prévia local da imagem escolhida. A foto só será vinculada à meta após a confirmação financeira."
    : decision.kind === "remove" ? "Remoção marcada apenas nesta edição. A foto atual ainda não foi alterada."
      : initial.scope.baselineFileId ? "A foto atual será mantida. Ela não é carregada nesta prévia local." : "Nenhuma foto escolhida.";
  const error = local.draft.error === "name" ? "O nome do arquivo não é permitido. Escolha outro arquivo."
    : local.draft.error === "size" ? "Escolha uma imagem maior que zero e com até 8 MiB."
      : local.draft.error ? "Escolha uma imagem PNG, JPEG, WebP ou GIF válida." : null;
  return <section className="fg-image-picker" aria-label="Imagem da meta (opcional)" aria-describedby={`${id}-status`}>
    {local.file && <div className="fg-image-picker__preview"><PrivateImagePreview source={preview} label="Prévia local da imagem da meta" /></div>}
    <div hidden={reviewing} style={{ display: reviewing ? "none" : "contents" }}>
      <EntityImagePicker inputRef={input} label="Imagem da meta (opcional)" hint="PNG, JPEG, WebP ou GIF, até 8 MiB. Escolher um arquivo prepara uma prévia neste dispositivo. O envio e o vínculo à meta são etapas separadas."
        disabled={disabled} onChange={event => { choose(event.target.files?.[0] ?? null); event.target.value = ""; }} />
    </div>
    <p className="fg-image-picker__status" id={`${id}-status`} role="status">{status}</p>
    {local.draft.choice.kind === "selected" && <p className="fg-image-picker__name">{local.draft.choice.candidate.name}</p>}
    {error && <p className="fg-image-picker__error" role="alert">{error} A escolha anterior foi mantida.</p>}
    <div className="fg-image-picker__actions" hidden={reviewing} style={{ display: reviewing ? "none" : undefined }}>
      {initial.scope.baselineFileId && local.draft.choice.kind !== "remove" && <Button disabled={disabled} onClick={remove}>Marcar remoção da foto</Button>}
      {local.draft.choice.kind !== "preserve" && <Button variant="ghost" disabled={disabled} onClick={undo}>Desfazer escolha</Button>}
    </div>
  </section>;
}
