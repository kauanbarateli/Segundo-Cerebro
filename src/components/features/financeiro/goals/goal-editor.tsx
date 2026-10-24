"use client";

import { useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import type { FinancialGoal, GoalCommand } from "@/core/financeiro/goals/goal-types";
import { goalEditorDraft, goalFields, goalIntent } from "./goals-ui-model";

export function GoalEditor({ goal, financeRevision, hidden, reveal, blocked, busy, createId, prepare, cancel, children }: {
  goal: FinancialGoal | null; financeRevision: string; hidden: boolean; reveal(): void; blocked: boolean; busy: boolean;
  createId(): string; prepare(intent: GoalCommand): Promise<void>; cancel(): void; children: ReactNode;
}) {
  const [draft, setDraft] = useState(() => goalEditorDraft(goal)), [error, setError] = useState<string | null>(null), errorRef = useRef<HTMLParagraphElement>(null);
  async function submit() {
    if (blocked || busy || hidden) return;
    let intent: GoalCommand;
    try { const fields = goalFields(draft), common = { client_id: createId(), expected_finance_revision: financeRevision };
      intent = goal ? goalIntent("finance.goal.update", { ...common, goal_id: goal.id, expected_revision: goal.revision, patch: fields }) : goalIntent("finance.goal.create", { ...common, ...fields, image_file_id: null });
    } catch { setError("Confira nome, valor com até duas casas decimais e prazo válido."); requestAnimationFrame(() => errorRef.current?.focus()); return; }
    setError(null); await prepare(intent);
  }
  return <div className="fg-editor">{hidden ? <div className="fg-reveal"><p>Exiba os valores para editar a meta.</p><Button onClick={reveal}>Exibir valores</Button></div> : <form onSubmit={event => { event.preventDefault(); void submit(); }}>
    {error && <p className="fg-form-error" role="alert" tabIndex={-1} ref={errorRef}>{error}</p>}
    <Field label="Nome da meta" value={draft.name} maxLength={160} onChange={event => setDraft(value => ({ ...value, name: event.target.value }))} placeholder="Ex.: Viagem dos sonhos" required disabled={blocked || busy} />
    <div className="fg-form-grid"><Field label="Quanto quer guardar?" value={draft.target} inputMode="decimal" autoComplete="off" onChange={event => setDraft(value => ({ ...value, target: event.target.value }))} placeholder="0,00" required disabled={blocked || busy} />
      <Field label="Prazo (opcional)" type="date" value={draft.deadline} onChange={event => setDraft(value => ({ ...value, deadline: event.target.value }))} disabled={blocked || busy} /></div>
    <p className="fg-edit-hint">Imagens de metas ainda não estão disponíveis nesta versão.</p>
    {goal && <p className="fg-edit-hint">Seus aportes são mantidos ao editar a meta.</p>}
    <div className="fg-actions"><Button onClick={cancel} disabled={busy}>Cancelar</Button><Button type="submit" variant="primary" loading={busy} disabled={blocked}>{goal ? "Revisar alteração" : "Revisar nova meta"}</Button></div>
  </form>}{children}</div>;
}
