"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { GoalFailure, GoalJournalView, GoalReview } from "@/lib/finance-goals-client-contract";
import { GOAL_LABELS, goalMoney } from "./goals-ui-model";

type Resolution = "confirmed" | "closed";

function ResolutionFeedback({ kind }: { kind: Resolution }) {
  const status = useRef<HTMLParagraphElement>(null);
  useLayoutEffect(() => { status.current?.focus({ preventScroll: true }); }, [kind]);
  return <p className="fg-resolution" role="status" tabIndex={-1} ref={status}>{kind === "closed"
    ? "Tentativa encerrada. Este encerramento não desfaz valores já registrados. Atualize e confira os dados atuais antes de continuar."
    : "O resultado desta tentativa foi confirmado. Atualize e confira os dados atuais antes de continuar."}</p>;
}

function PendingAttemptNotice({ failure, busy, reconcile, settle }: {
  failure: GoalFailure | null; busy: boolean; reconcile(): void; settle?: () => void;
}) {
  const [confirming, setConfirming] = useState(false), title = useRef<HTMLHeadingElement>(null), status = useRef<HTMLParagraphElement>(null), trigger = useRef<HTMLButtonElement>(null), consultTrigger = useRef<HTMLButtonElement>(null), restoreFocus = useRef(false), titleId = useId();
  const canSettle = typeof settle === "function";
  useLayoutEffect(() => {
    if (confirming && canSettle) title.current?.focus({ preventScroll: true });
    else if (restoreFocus.current) { (trigger.current ?? consultTrigger.current)?.focus({ preventScroll: true }); restoreFocus.current = false; }
  }, [confirming, canSettle]);
  function consult() { if (!busy) { status.current?.focus({ preventScroll: true }); reconcile(); } }
  function submitSettlement() { if (!busy && settle) { title.current?.focus({ preventScroll: true }); settle(); } }
  return <section className="fg-notice" aria-label="Tentativa pendente">
    <p role="status" tabIndex={-1} ref={status}>O resultado desta tentativa ainda precisa ser confirmado. Não inicie outra operação.</p>
    {failure && <p className="fg-form-error" role="alert">{failure.message}</p>}
    {confirming && settle ? <div className="fg-terminal-confirmation" role="group" aria-labelledby={titleId}>
      <h3 id={titleId} aria-describedby={`${titleId}-description`} tabIndex={-1} ref={title}>Encerrar esta tentativa?</h3>
      <p id={`${titleId}-description`}>Se a operação já foi concluída, mostraremos o resultado. Caso contrário, impediremos que esta tentativa seja concluída depois. Isso não desfaz valores já registrados.</p>
      <div className="fg-actions"><Button disabled={busy} onClick={() => { if (!busy) { restoreFocus.current = true; setConfirming(false); } }}>Voltar</Button><Button variant="primary" loading={busy} onClick={submitSettlement}>Confirmar encerramento</Button></div>
    </div> : <div className="fg-actions"><Button ref={consultTrigger} onClick={consult} loading={busy}>Consultar tentativa</Button>{settle && <Button ref={trigger} disabled={busy} onClick={() => { if (!busy) setConfirming(true); }}>Encerrar esta tentativa</Button>}</div>}
  </section>;
}

function ReviewNotice({ review, busy, hidden, confirm, cancel }: {
  review: GoalReview; busy: boolean; hidden: boolean; confirm(): void; cancel(): void;
}) {
  const back = useRef<HTMLButtonElement>(null), focusOnMount = useRef(true);
  useLayoutEffect(() => {
    if (focusOnMount.current && !busy) {
      back.current?.focus({ preventScroll: true });
      focusOnMount.current = false;
    }
  }, [busy]);
  return <section className="fg-review" aria-label="Revisar operação"><h3>{GOAL_LABELS[review.intent.command]}</h3>
      {"amount_cents" in review.intent.input && <p>Valor: {goalMoney(review.intent.input.amount_cents, hidden)}</p>}
      {review.account && <dl className="fg-account-totals"><div><dt>Saldo real</dt><dd>{goalMoney(review.account.realBalance, hidden)}</dd></div><div><dt>Reservado</dt><dd>{goalMoney(review.account.reserved, hidden)}</dd></div><div><dt>Disponível após reservas</dt><dd>{goalMoney(review.account.available, hidden)}</dd></div></dl>}
      {review.intent.command === "finance.goal.archive" && <p>As reservas serão mantidas. Se esta meta estiver em destaque, o destaque será removido.</p>}
      {review.intent.command === "finance.goal.restore" && <p>A meta voltará a aceitar aportes. O destaque não será alterado automaticamente.</p>}
      <div className="fg-actions"><Button ref={back} onClick={cancel} disabled={busy}>Voltar à edição</Button><Button variant="primary" onClick={confirm} disabled={hidden} loading={busy}>{GOAL_LABELS[review.intent.command]}</Button></div>
    </section>;
}

export function GoalOperationNotice({ failure, journal, review, busy, hidden, success, resolution = null, canAcknowledge, confirm, cancel, reconcile, settle, acknowledge }: {
  failure: GoalFailure | null; journal: GoalJournalView | null; review: GoalReview | null; busy: boolean; hidden: boolean; success: boolean;
  resolution?: Resolution | null; canAcknowledge: boolean; confirm(): void; cancel(): void; reconcile(): void; settle?: () => void; acknowledge(): void;
}) {
  if (journal?.pending || failure?.code === "uncertain") return <PendingAttemptNotice key={journal?.pending ? `${journal.pending.intent.command}:${journal.pending.intent.input.client_id}` : "unresolved"} failure={failure} busy={busy} reconcile={reconcile} settle={journal?.pending ? settle : undefined} />;
  const feedback = resolution ? <ResolutionFeedback kind={resolution} /> : success ? <p role="status">Operação confirmada. Atualize a lista para conferir os dados atuais.</p> : null;
  if (journal?.reconfirmRequired) return <>{feedback}<section className="fg-notice">{failure && <p className="fg-form-error" role="alert">{failure.message}</p>}<p>Atualize e confira os dados atuais antes de preparar uma nova operação. Isso não desfaz uma tentativa anterior.</p><Button onClick={acknowledge} disabled={busy || !canAcknowledge}>Conferi os dados atuais</Button></section></>;
  return <>{failure && <p className="fg-form-error" role="alert">{failure.message}</p>}{feedback}
    {review && <ReviewNotice review={review} busy={busy} hidden={hidden} confirm={confirm} cancel={cancel} />}
  </>;
}
