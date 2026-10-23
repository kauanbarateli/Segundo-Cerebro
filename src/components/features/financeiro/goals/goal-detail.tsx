"use client";

import { useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import type { GoalCommand } from "@/core/financeiro/goals/goal-types";
import type { GoalAccountChoice, GoalDetailView, GoalReview } from "@/lib/finance-goals-client-contract";
import { GoalProgressView } from "./goal-card";
import { eligibleGoalAccounts, goalAmount, goalContributionPreview, goalIntent, goalMoney } from "./goals-ui-model";

export function GoalDetail({ detail, review, accounts, today, hidden, reveal, blocked, busy, createId, prepare, edit, history, secondary, children }: {
  detail: GoalDetailView; review: GoalReview | null; accounts: readonly GoalAccountChoice[]; today: string; hidden: boolean; reveal(): void; blocked: boolean; busy: boolean;
  createId(): string; prepare(intent: GoalCommand): Promise<void>; edit(): void; history(): void; secondary(command: "finance.goal.archive" | "finance.goal.restore" | "finance.goal.highlight"): void; children: ReactNode;
}) {
  const [amount, setAmount] = useState(""), [date, setDate] = useState(today), [account, setAccount] = useState(""), [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null), choices = eligibleGoalAccounts(accounts), archived = detail.goal.archived_at !== null;
  const projection = goalContributionPreview(detail, review);
  async function submit() {
    if (blocked || busy || hidden || archived) return; let intent: GoalCommand;
    try { const cents = goalAmount(amount, date, today); if (!choices.some(value => value.id === account)) throw new Error("account");
      intent = goalIntent("finance.goal.contribute", { client_id: createId(), expected_finance_revision: detail.finance_revision, goal_id: detail.goal.id, expected_revision: detail.goal.revision, account_id: account, amount_cents: cents, occurred_on: date });
    } catch { setError("Confira o valor, a data até hoje e uma conta ativa de origem, sem cartão."); requestAnimationFrame(() => errorRef.current?.focus()); return; }
    setError(null); await prepare(intent);
  }
  return <div className="fg-detail"><header className="fg-detail-heading"><h3>{detail.goal.name}</h3><Button onClick={edit} disabled={busy || blocked}>Editar meta</Button></header>
    <GoalProgressView item={detail} hidden={hidden} />
    {archived && <p>Meta arquivada. Os valores reservados foram mantidos.</p>}
    {!archived && (hidden ? <div className="fg-reveal"><p>Exiba os valores para registrar um aporte.</p><Button onClick={reveal}>Exibir valores</Button></div> : <form className="fg-contribution" onSubmit={event => { event.preventDefault(); void submit(); }}>
      <h4>Adicionar valor</h4>{error && <p className="fg-form-error" role="alert" tabIndex={-1} ref={errorRef}>{error}</p>}
      <div className="fg-form-grid"><Field label="Valor" value={amount} inputMode="decimal" autoComplete="off" placeholder="0,00" onChange={event => setAmount(event.target.value)} required disabled={blocked || busy} /><Field label="Data" type="date" max={today} value={date} onChange={event => setDate(event.target.value)} required disabled={blocked || busy} /></div>
      <Field as="select" label="Conta de origem" value={account} onChange={event => setAccount(event.target.value)} required disabled={blocked || busy || !choices.length}><option value="">Escolha uma conta</option>{choices.map(value => <option key={value.id} value={value.id}>{value.name}</option>)}</Field>
      {!choices.length && <p>Nenhuma conta de origem disponível. Cadastre uma conta ativa em reais, sem cartão.</p>}
      <p className="fg-transfer-note">O valor será reservado da conta escolhida, sem contar como despesa.</p>
      <div className="fg-actions"><Button type="submit" variant="primary" loading={busy} disabled={blocked || !choices.length}>Revisar aporte</Button></div>
    </form>)}
    {projection && <div className="fg-after-contribution"><p className="fg-transfer-note">Após o aporte: {goalMoney(projection.saved_cents, hidden)}{!hidden && ` · ${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(projection.saved_cents / projection.target_cents * 100)}%`}</p><p className="fg-transfer-note">Prévia desta revisão, a reconferir pelo servidor ao confirmar.</p></div>}
    {children}
    <details className="fg-more"><summary>Histórico e outras ações</summary><div className="fg-actions"><Button onClick={history} disabled={busy}>Ver aportes e liberações</Button><Button onClick={() => secondary(archived ? "finance.goal.restore" : "finance.goal.archive")} disabled={busy || blocked}>{archived ? "Restaurar meta" : "Arquivar meta"}</Button>{!archived && <Button onClick={() => secondary("finance.goal.highlight")} disabled={busy || blocked}>{detail.highlight?.goal_id === detail.goal.id ? "Remover destaque" : "Destacar meta"}</Button>}</div></details>
  </div>;
}
