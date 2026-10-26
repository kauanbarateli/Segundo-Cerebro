"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import type { FinancialGoal, GoalCommand } from "@/core/financeiro/goals/goal-types";
import { goalRevision, goalUuid } from "@/core/financeiro/goals/goal-validation";
import { goalEditorDraft, goalFields, goalIntent } from "./goals-ui-model";
import { GoalImageEditorSession, goalImageLocalPhaseMessage, type GoalImageEditorCapability, type GoalImageEditorView } from "./goal-image-editor-session";
import { createGoalImageDraft, removeGoalImageChoice } from "./goal-image-picker-model";

interface GoalEditorProps {
  goal: FinancialGoal | null; financeRevision: string; hidden: boolean; reveal(): void; blocked: boolean; busy: boolean;
  createId(): string; prepare(intent: GoalCommand): Promise<void>; cancel(): void; children: ReactNode;
  /** Optional local capability. No host/Workspace is activated by this component. */
  imageUpload?: GoalImageEditorCapability;
  /** Presentation only: the channel's current review, never an upload proof. */
  reviewing?: boolean;
}
type NoNewImageChoice = Parameters<GoalImageEditorSession["reviewWithoutNewImage"]>[0];
export function GoalEditor(props: GoalEditorProps) {
  const identity = props.imageUpload ? JSON.stringify(props.imageUpload.scope) : "without-image-upload";
  return <Editor key={identity} {...props} />;
}
function Editor({ goal, financeRevision, hidden, reveal, blocked, busy, createId, prepare, cancel, children, imageUpload, reviewing = false }: GoalEditorProps) {
  const ImagePicker = imageUpload?.Picker;
  const [draft, setDraft] = useState(() => goalEditorDraft(goal)), [error, setError] = useState<string | null>(null), errorRef = useRef<HTMLParagraphElement>(null);
  const [imageView, setImageView] = useState<GoalImageEditorView | null>(null), session = useRef<GoalImageEditorSession | null>(null), acting = useRef(false);
  const pickerLifetime = useRef(0);
  const [removalSelected, setRemovalSelected] = useState(false);
  const legacyIntent = useRef<{ basis: string; intent: GoalCommand } | null>(null), legacyAction = useRef<object | null>(null);
  const reviewTrigger = useRef<HTMLButtonElement>(null), previousReviewing = useRef(reviewing);
  const latest = useRef({ goal, financeRevision, draft, hidden, imageUpload });
  latest.current = { goal, financeRevision, draft, hidden, imageUpload };
  useLayoutEffect(() => () => { legacyAction.current = null; legacyIntent.current = null; }, []);
  useLayoutEffect(() => {
    // A frame can run before React commits the alert; focus its mounted node.
    if (error && !hidden && !reviewing) errorRef.current?.focus({ preventScroll: true });
  }, [error, hidden, reviewing]);
  useLayoutEffect(() => {
    const returning = previousReviewing.current && !reviewing;
    previousReviewing.current = reviewing;
    if (returning && !hidden && !busy && !blocked) reviewTrigger.current?.focus({ preventScroll: true });
  }, [reviewing, hidden, busy, blocked]);
  useLayoutEffect(() => {
    if (!imageUpload || hidden || !imageUpload.isCurrent()) { setImageView(null); return; }
    const scope = imageUpload.scope;
    if (scope.goalId !== (goal?.id ?? null) || scope.goalRevision !== (goal?.revision ?? null) || scope.baselineFileId !== (goal?.image_file_id ?? null)) return;
    const own = new GoalImageEditorSession(imageUpload, () => latest.current.imageUpload === imageUpload && !latest.current.hidden);
    session.current = own; pickerLifetime.current++; setRemovalSelected(false); setImageView(own.view());
    return () => { own.dispose(); if (session.current === own) { session.current = null; acting.current = false; } };
    // Scope/goal identity is the keyed editor. Capture this instance for cleanup.
  }, [imageUpload, hidden, goal?.id, goal?.revision, goal?.image_file_id]);
  const imageWorking = imageView?.status === "working", unavailable = !!imageUpload && (!session.current || !imageView);
  const newImagesEnabled = imageUpload?.newImagesEnabled !== false;
  const locked = busy || imageWorking || !!imageView?.selectionLocked;
  function imageError() { setError("Não foi possível concluir esta etapa. Consulte o envio original antes de trocar a foto ou preparar outra tentativa. Esta mensagem não confirma nem desfaz uma meta."); }
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
      let recorded: NoNewImageChoice | null;
      try { recorded = session.current?.view().noNewImageChoice ?? null; } catch { imageError(); return; }
      await reviewImage(recorded); return;
    }
    let intent: GoalCommand;
    try { const fields = goalFields(structuredClone(draft)); goalRevision(financeRevision); if (goal) { goalUuid(goal.id); goalRevision(goal.revision); }
      const basis = JSON.stringify({ fields, financeRevision, goalId: goal?.id ?? null, goalRevision: goal?.revision ?? null });
      const captured = legacyIntent.current;
      if (captured && captured.basis !== basis) { setError("Feche esta revisão e reabra a meta com os dados atuais antes de preparar outra intenção."); return; }
      if (captured) intent = structuredClone(captured.intent);
      else {
        const common = { client_id: createId(), expected_finance_revision: financeRevision };
        intent = goal ? goalIntent("finance.goal.update", { ...common, goal_id: goal.id, expected_revision: goal.revision, patch: fields }) : goalIntent("finance.goal.create", { ...common, ...fields, image_file_id: null });
        legacyIntent.current = { basis, intent: structuredClone(intent) };
      }
    } catch { setError("Confira nome, valor com até duas casas decimais e prazo válido."); return; }
    const token = {}, originalPrepare = prepare, captured = legacyIntent.current;
    const currentBasis = () => {
      const value = latest.current;
      if (!captured || legacyIntent.current !== captured || value.hidden) return false;
      try {
        const fields = goalFields(structuredClone(value.draft)); goalRevision(value.financeRevision);
        if (value.goal) { goalUuid(value.goal.id); goalRevision(value.goal.revision); }
        return JSON.stringify({ fields, financeRevision: value.financeRevision, goalId: value.goal?.id ?? null, goalRevision: value.goal?.revision ?? null }) === captured.basis;
      } catch { return false; }
    };
    legacyAction.current = token;
    setError(null); acting.current = true;
    try { await originalPrepare(structuredClone(intent)); }
    catch { if (legacyAction.current === token && currentBasis()) setError("Não foi possível preparar a revisão. Confira a sessão e os dados atuais antes de tentar novamente."); }
    finally { if (legacyAction.current === token) { legacyAction.current = null; acting.current = false; } }
  }
  async function reviewImage(choice: NoNewImageChoice | null) {
    if (!imageUpload || blocked || busy || hidden || acting.current) return;
    const own = session.current; if (!own) { imageError(); return; }
    // Validate and clone form/revision before the first await or upload.
    let captured: typeof draft;
    try { captured = structuredClone(draft); goalFields(captured); }
    catch { setError("Confira nome, valor com até duas casas decimais e prazo válido."); return; }
    const originalGoal = goal?.id ?? null, originalRevision = goal?.revision ?? null, basis = JSON.stringify(captured);
    const input = { draft: captured, financeRevision, createId, prepare,
      stillCurrent: () => session.current === own && latest.current.financeRevision === financeRevision && (latest.current.goal?.id ?? null) === originalGoal && (latest.current.goal?.revision ?? null) === originalRevision && JSON.stringify(latest.current.draft) === basis,
      onChoiceClaimed: () => { if (session.current === own) setImageView(own.view()); } };
    await imageAction(instance => choice === null ? instance.review(input) : instance.reviewWithoutNewImage(choice, input));
  }
  return <div className="fg-editor">{hidden ? <div className="fg-reveal"><p>Exiba os valores para editar a meta.</p><Button onClick={reveal}>Exibir valores</Button></div> : <form onSubmit={event => { event.preventDefault(); void submit(); }}>
    {error && <p className="fg-form-error" role="alert" tabIndex={-1} ref={errorRef}>{error}</p>}
    <Field label="Nome da meta" value={draft.name} maxLength={160} onChange={event => setDraft(value => ({ ...value, name: event.target.value }))} placeholder="Ex.: Viagem dos sonhos" required disabled={blocked || locked} />
    <div className="fg-form-grid"><Field label="Quanto quer guardar?" value={draft.target} inputMode="decimal" autoComplete="off" onChange={event => setDraft(value => ({ ...value, target: event.target.value }))} placeholder="0,00" required disabled={blocked || locked} />
      <Field label="Prazo (opcional)" type="date" value={draft.deadline} onChange={event => setDraft(value => ({ ...value, deadline: event.target.value }))} disabled={blocked || locked} /></div>
    {imageUpload && ImagePicker ? <>
      {imageView?.noNewImageChoice ? <p className="fg-edit-hint" role="status">{imageView.noNewImageChoice === "create-null" || imageView.noNewImageChoice === "update-omit" && !goal?.image_file_id ? "Você escolheu continuar sem foto. A prévia não será usada nesta meta; o envio anterior continua protegido." : imageView.noNewImageChoice === "update-omit" ? "Você escolheu manter a foto atual. A prévia não será usada nesta revisão; o envio anterior continua protegido." : "Você escolheu remover a foto atual. A remoção exige a confirmação financeira; o envio anterior continua protegido."}</p> : !newImagesEnabled ? <><p className="fg-edit-hint">Novas fotos estão desativadas. {removalSelected ? "A remoção está marcada somente nesta edição; confirme a operação financeira para salvar." : "A foto atual será mantida. Os envios anteriores continuam protegidos."}</p>{goal?.image_file_id && <Button disabled={blocked || locked || unavailable} onClick={() => { try { const own = session.current; if (!own) return; own.choose(removeGoalImageChoice(createGoalImageDraft(imageUpload.scope), imageUpload.scope), null); setRemovalSelected(true); setImageView(own.view()); } catch { imageError(); } }}>Marcar remoção da foto atual</Button>}</> : <ImagePicker key={pickerLifetime.current} scope={imageUpload.scope} disabled={blocked || locked || unavailable} reviewing={reviewing}
        generationFloor={imageView?.generationFloor ?? 0}
        onLocalSelection={(choice, file) => { try { session.current?.choose(choice, file); setError(null); } catch { imageError(); } }} />}
      <p className="fg-edit-hint" role="status">{imageView?.status === "working" ? "Conferindo esta etapa. Aguarde para revisar a meta." : imageView?.status === "reviewed" ? imageView.noNewImageChoice ? "Revisão preparada sem usar o envio pendente. Confirme a operação financeira para salvar." : "Foto preparada para revisão. A meta só muda na confirmação financeira." : imageView?.upload?.state === "retirement-review" ? "O envio anterior está protegido. Escolha outra foto e confirme a troca abaixo; esta etapa não altera a meta." : imageView?.upload?.attempt ? "Há um envio protegido. Revisar retoma o envio original; se solicitado, escolha o mesmo arquivo. Para substituir, conclua primeiro a recuperação explícita." : "Ao revisar, uma nova foto só será enviada se estiver selecionada. A meta só muda na confirmação."}</p>
      {imageView && imageView.status !== "working" && (error || imageView.diagnostic.phase !== "unknown" && imageView.status !== "reviewed") && <div className="fg-edit-hint">
        <p role="status" aria-atomic="true">{goalImageLocalPhaseMessage(imageView.diagnostic.phase)}</p>
        <details className="fg-more"><summary>Detalhes desta etapa</summary><dl>
          <dt>Estado local</dt><dd>{imageView.diagnostic.status}</dd>
          <dt>Fase do registro local</dt><dd>{imageView.diagnostic.phase}</dd>
          <dt>Última falha registrada nesta janela</dt><dd>{imageView.diagnostic.code}</dd>
          <dt>Etapa dessa falha</dt><dd>{imageView.diagnostic.stage}</dd>
        </dl><p>Este registro local não comprova o estado no servidor. UNKNOWN não recupera a causa de uma falha anterior.</p></details>
      </div>}      {!imageView?.noNewImageChoice && <div className="fg-actions" hidden={reviewing} style={{ display: reviewing ? "none" : undefined }}>
        <Button disabled={busy || imageWorking || blocked} onClick={() => void imageAction(own => own.inspect())}>Consultar envio da foto</Button>
        {imageView?.upload?.attempt && <>
          <Button disabled={busy || imageWorking || blocked} onClick={() => void imageAction(own => own.recover("discard"))}>Concluir envio anterior para trocar</Button>
          <Button disabled={busy || imageWorking || blocked} onClick={() => void imageAction(own => own.recover("linked"))}>Reconhecer foto salva na meta</Button>
        </>}
        {imageView?.upload?.state === "retirement-review" && newImagesEnabled && <Button disabled={busy || imageWorking || blocked || !!imageView.selectionLocked} onClick={() => void imageAction(own => own.replace())}>Usar nova foto nesta edição</Button>}
      </div>}
      {imageView?.upload?.attempt && !imageView.noNewImageChoice && <div hidden={reviewing} style={{ display: reviewing ? "none" : "contents" }}>
        <p className="fg-edit-hint">Você também pode revisar esta meta sem usar o envio pendente. Ele será mantido, sem cancelamento ou substituição.</p>
        <div className="fg-actions"><Button disabled={blocked || locked || unavailable} onClick={() => void reviewImage(goal ? "update-omit" : "create-null")}>{goal?.image_file_id ? "Manter foto atual e revisar" : "Continuar sem nova foto"}</Button>
          {goal?.image_file_id && <Button disabled={blocked || locked || unavailable} onClick={() => void reviewImage("update-remove")}>Remover foto atual e revisar</Button>}</div>
      </div>}
    </> : <p className="fg-edit-hint">Imagens de metas ainda não estão disponíveis nesta versão.</p>}
    {goal && <p className="fg-edit-hint">Seus aportes são mantidos ao editar a meta.</p>}
    <div className="fg-actions" hidden={reviewing} style={{ display: reviewing ? "none" : undefined }}><Button onClick={cancel} disabled={busy || imageWorking}>Cancelar</Button><Button ref={reviewTrigger} type="submit" variant="primary" loading={busy || imageWorking} disabled={blocked || unavailable}>{imageView?.noNewImageChoice ? imageView.noNewImageChoice === "update-remove" ? "Revisar remoção da foto" : "Revisar sem nova foto" : goal ? "Revisar alteração" : "Revisar nova meta"}</Button></div>
  </form>}{children}</div>;
}
