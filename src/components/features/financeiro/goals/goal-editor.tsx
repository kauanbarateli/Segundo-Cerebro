"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import type { FinancialGoal, GoalCommand } from "@/core/financeiro/goals/goal-types";
import { goalEditorDraft, goalFields, goalIntent } from "./goals-ui-model";
import { GoalImageEditorSession, type GoalImageEditorCapability, type GoalImageEditorView } from "./goal-image-editor-session";

interface GoalEditorProps {
  goal: FinancialGoal | null; financeRevision: string; hidden: boolean; reveal(): void; blocked: boolean; busy: boolean;
  createId(): string; prepare(intent: GoalCommand): Promise<void>; cancel(): void; children: ReactNode;
  /** Optional local capability. No host/Workspace is activated by this component. */
  imageUpload?: GoalImageEditorCapability;
}
export function GoalEditor(props: GoalEditorProps) {
  const identity = props.imageUpload ? JSON.stringify(props.imageUpload.scope) : "without-image-upload";
  return <Editor key={identity} {...props} />;
}
function Editor({ goal, financeRevision, hidden, reveal, blocked, busy, createId, prepare, cancel, children, imageUpload }: GoalEditorProps) {
  const ImagePicker = imageUpload?.Picker;
  const [draft, setDraft] = useState(() => goalEditorDraft(goal)), [error, setError] = useState<string | null>(null), errorRef = useRef<HTMLParagraphElement>(null);
  const [imageView, setImageView] = useState<GoalImageEditorView | null>(null), session = useRef<GoalImageEditorSession | null>(null), acting = useRef(false);
  const pickerLifetime = useRef(0);
  const latest = useRef({ goal, financeRevision, draft, hidden, imageUpload });
  latest.current = { goal, financeRevision, draft, hidden, imageUpload };
  useLayoutEffect(() => {
    if (!imageUpload || hidden) return;
    const scope = imageUpload.scope;
    if (scope.goalId !== (goal?.id ?? null) || scope.goalRevision !== (goal?.revision ?? null) || scope.baselineFileId !== (goal?.image_file_id ?? null)) return;
    const own = new GoalImageEditorSession(imageUpload, () => latest.current.imageUpload === imageUpload && !latest.current.hidden);
    session.current = own; pickerLifetime.current++; setImageView(own.view());
    return () => { own.dispose(); if (session.current === own) { session.current = null; acting.current = false; } };
    // Scope/goal identity is the keyed editor. Capture this instance for cleanup.
  }, [imageUpload, hidden, goal?.id, goal?.revision, goal?.image_file_id]);
  const imageWorking = imageView?.status === "working", unavailable = !!imageUpload && (!session.current || !imageView);
  const locked = busy || imageWorking || !!imageView?.selectionLocked;
  function imageError() { const own = session.current; setError("Não foi possível concluir esta etapa. Consulte o envio original antes de trocar a foto ou preparar outra tentativa. Esta mensagem não confirma nem desfaz uma meta."); requestAnimationFrame(() => { if (session.current === own) errorRef.current?.focus(); }); }
  async function imageAction(work: (own: GoalImageEditorSession) => Promise<unknown>) {
    const own = session.current; if (!own || acting.current || blocked || busy || hidden) return;
    acting.current = true; setError(null);
    try { const pending = work(own); setImageView(own.view()); await pending; if (session.current === own) setImageView(own.view()); }
    catch { if (session.current === own) { try { setImageView(own.view()); } catch { /* A revoked session cannot publish its view. */ } imageError(); } }
    finally { if (session.current === own) acting.current = false; }
  }
  async function submit() {
    if (blocked || busy || hidden || acting.current) return;
    if (imageUpload) {
      const own = session.current; if (!own) { imageError(); return; }
      // Validate and clone form/revision before the first await or upload.
      let captured: typeof draft;
      try { captured = structuredClone(draft); goalFields(captured); }
      catch { setError("Confira nome, valor com até duas casas decimais e prazo válido."); requestAnimationFrame(() => errorRef.current?.focus()); return; }
      const originalGoal = goal?.id ?? null, originalRevision = goal?.revision ?? null, basis = JSON.stringify(captured);
      await imageAction(instance => instance.review({ draft: captured, financeRevision, createId, prepare,
        stillCurrent: () => session.current === own && latest.current.financeRevision === financeRevision && (latest.current.goal?.id ?? null) === originalGoal && (latest.current.goal?.revision ?? null) === originalRevision && JSON.stringify(latest.current.draft) === basis }));
      return;
    }
    let intent: GoalCommand;
    try { const fields = goalFields(draft), common = { client_id: createId(), expected_finance_revision: financeRevision };
      intent = goal ? goalIntent("finance.goal.update", { ...common, goal_id: goal.id, expected_revision: goal.revision, patch: fields }) : goalIntent("finance.goal.create", { ...common, ...fields, image_file_id: null });
    } catch { setError("Confira nome, valor com até duas casas decimais e prazo válido."); requestAnimationFrame(() => errorRef.current?.focus()); return; }
    setError(null); acting.current = true; try { await prepare(intent); } finally { acting.current = false; }
  }
  return <div className="fg-editor">{hidden ? <div className="fg-reveal"><p>Exiba os valores para editar a meta.</p><Button onClick={reveal}>Exibir valores</Button></div> : <form onSubmit={event => { event.preventDefault(); void submit(); }}>
    {error && <p className="fg-form-error" role="alert" tabIndex={-1} ref={errorRef}>{error}</p>}
    <Field label="Nome da meta" value={draft.name} maxLength={160} onChange={event => setDraft(value => ({ ...value, name: event.target.value }))} placeholder="Ex.: Viagem dos sonhos" required disabled={blocked || locked} />
    <div className="fg-form-grid"><Field label="Quanto quer guardar?" value={draft.target} inputMode="decimal" autoComplete="off" onChange={event => setDraft(value => ({ ...value, target: event.target.value }))} placeholder="0,00" required disabled={blocked || locked} />
      <Field label="Prazo (opcional)" type="date" value={draft.deadline} onChange={event => setDraft(value => ({ ...value, deadline: event.target.value }))} disabled={blocked || locked} /></div>
    {imageUpload && ImagePicker ? <>
      <ImagePicker key={pickerLifetime.current} scope={imageUpload.scope} disabled={blocked || locked || unavailable}
        generationFloor={imageView?.generationFloor ?? 0}
        onLocalSelection={(choice, file) => { try { session.current?.choose(choice, file); setError(null); } catch { imageError(); } }} />
      <p className="fg-edit-hint" role="status">{imageView?.status === "working" ? "Preparando a foto. Aguarde para revisar a meta." : imageView?.status === "reviewed" ? "Foto preparada para revisão. A meta só muda na confirmação financeira." : imageView?.upload?.state === "retirement-review" ? "O envio anterior está protegido. Escolha outra foto e confirme a troca abaixo; esta etapa não altera a meta." : imageView?.upload?.attempt ? "Há um envio protegido. Revisar retoma o envio original; se solicitado, escolha o mesmo arquivo. Para substituir, conclua primeiro a recuperação explícita." : "A foto será enviada ao revisar. Salvar a meta exige uma confirmação separada."}</p>
      <div className="fg-actions">
        <Button disabled={busy || imageWorking || blocked} onClick={() => void imageAction(own => own.inspect())}>Consultar envio da foto</Button>
        {imageView?.upload?.attempt && <>
          <Button disabled={busy || imageWorking || blocked} onClick={() => void imageAction(own => own.recover("discard"))}>Concluir envio anterior para trocar</Button>
          <Button disabled={busy || imageWorking || blocked} onClick={() => void imageAction(own => own.recover("linked"))}>Reconhecer foto salva na meta</Button>
        </>}
        {imageView?.upload?.state === "retirement-review" && <Button disabled={busy || imageWorking || blocked || !!imageView.selectionLocked} onClick={() => void imageAction(own => own.replace())}>Usar nova foto nesta edição</Button>}
      </div>
    </> : <p className="fg-edit-hint">Imagens de metas ainda não estão disponíveis nesta versão.</p>}
    {goal && <p className="fg-edit-hint">Seus aportes são mantidos ao editar a meta.</p>}
    <div className="fg-actions"><Button onClick={cancel} disabled={busy || imageWorking}>Cancelar</Button><Button type="submit" variant="primary" loading={busy || imageWorking} disabled={blocked || unavailable}>{goal ? "Revisar alteração" : "Revisar nova meta"}</Button></div>
  </form>}{children}</div>;
}
