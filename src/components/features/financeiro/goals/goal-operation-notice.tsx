"use client";

import { Button } from "@/components/ui/button";
import type { GoalFailure, GoalJournalView, GoalReview } from "@/lib/finance-goals-client-contract";
import { GOAL_LABELS, goalMoney } from "./goals-ui-model";

export function GoalOperationNotice({ failure, journal, review, busy, hidden, success, canAcknowledge, confirm, cancel, reconcile, acknowledge }: {
  failure: GoalFailure | null; journal: GoalJournalView | null; review: GoalReview | null; busy: boolean; hidden: boolean; success: boolean;
  canAcknowledge: boolean; confirm(): void; cancel(): void; reconcile(): void; acknowledge(): void;
}) {
  if (journal?.pending || failure?.code === "uncertain") return <section className="fg-notice" aria-label="Tentativa pendente"><p role="status">O resultado desta tentativa ainda precisa ser confirmado. Não inicie outra operação.</p><Button onClick={reconcile} loading={busy}>Consultar tentativa</Button></section>;
  if (journal?.reconfirmRequired) return <section className="fg-notice"><p>Atualize e confira os dados atuais antes de preparar uma nova operação. Isso não desfaz uma tentativa anterior.</p><Button onClick={acknowledge} disabled={busy || !canAcknowledge}>Conferi os dados atuais</Button></section>;
  return <>{failure && <p className="fg-form-error" role="alert">{failure.message}</p>}{success && <p role="status">Operação confirmada. Atualize a lista para conferir os dados atuais.</p>}
    {review && <section className="fg-review" aria-label="Revisar operação"><h3>{GOAL_LABELS[review.intent.command]}</h3>
      {"amount_cents" in review.intent.input && <p>Valor: {goalMoney(review.intent.input.amount_cents, hidden)}</p>}
      {review.account && <dl className="fg-account-totals"><div><dt>Saldo real</dt><dd>{goalMoney(review.account.realBalance, hidden)}</dd></div><div><dt>Reservado</dt><dd>{goalMoney(review.account.reserved, hidden)}</dd></div><div><dt>Disponível após reservas</dt><dd>{goalMoney(review.account.available, hidden)}</dd></div></dl>}
      {review.intent.command === "finance.goal.archive" && <p>As reservas serão mantidas. Se esta meta estiver em destaque, o destaque será removido.</p>}
      {review.intent.command === "finance.goal.restore" && <p>A meta voltará a aceitar aportes. O destaque não será alterado automaticamente.</p>}
      <div className="fg-actions"><Button onClick={cancel} disabled={busy}>Voltar à edição</Button><Button variant="primary" onClick={confirm} disabled={hidden} loading={busy}>{GOAL_LABELS[review.intent.command]}</Button></div>
    </section>}
  </>;
}
