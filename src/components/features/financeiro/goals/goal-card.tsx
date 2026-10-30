"use client";

import { Button } from "@/components/ui/button";
import { projectGoalProgress } from "@/core/financeiro/goals/goal-projections";
import type { GoalListItem } from "@/lib/finance-goals-client-contract";
import { goalDeadline, goalMoney } from "./goals-ui-model";
import { GoalImage } from "./goal-image";

export function GoalProgressView({ item, hidden }: { item: GoalListItem; hidden: boolean }) {
  const progress = projectGoalProgress(item.goal, item.totals.saved_cents);
  return <div className="fg-progress-summary"><p className="fg-value"><strong>{goalMoney(progress.saved_cents, hidden)}</strong><span>de {goalMoney(progress.target_cents, hidden)}</span></p>
    {hidden ? <p className="fg-progress-hidden">Progresso oculto</p> : <div className="fg-progress-row"><progress max={10000} value={progress.bar_basis_points} aria-label={`Progresso da meta ${item.goal.name}`} /><span>{new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(progress.saved_cents / progress.target_cents * 100)}%</span></div>}
    {item.goal.deadline && <p className="fg-deadline">Até {goalDeadline(item.goal.deadline)}</p>}</div>;
}
export function GoalCard({ item, compact, hidden, disabled, open, edit }: { item: GoalListItem; compact: boolean; hidden: boolean; disabled: boolean; open(trigger: HTMLElement): void; edit(trigger: HTMLElement): void }) {
  return <article className={`fg-card${compact ? " is-compact" : ""}`}>
    {item.goal.image_file_id && <Button variant="ghost" className="fg-cover" aria-label={`Abrir meta ${item.goal.name}`} onClick={event => open(event.currentTarget)} disabled={disabled}>
      <GoalImage ownerId={item.goal.user_id} goalId={item.goal.id} fileId={item.goal.image_file_id} />
    </Button>}
    <div className="fg-card-body"><h3><Button variant="ghost" className="fg-title-button" onClick={event => open(event.currentTarget)} disabled={disabled}>{item.goal.name}</Button></h3>
      <GoalProgressView item={item} hidden={hidden} />
      <div className="fg-card-actions"><Button onClick={event => open(event.currentTarget)} disabled={disabled}>Adicionar valor</Button><Button onClick={event => edit(event.currentTarget)} disabled={disabled} aria-label={`Editar meta ${item.goal.name}`}>Editar</Button></div>
    </div>
  </article>;
}
