"use client";

import { useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { activeReservationAmount } from "@/core/financeiro/goals/goal-projections";
import type { GoalCommand } from "@/core/financeiro/goals/goal-types";
import type { GoalReleasesView, GoalReservationsView } from "@/lib/finance-goals-client-contract";
import { goalAmount, goalDate, goalIntent, goalMoney } from "./goals-ui-model";

export function GoalHistory({ page, releases, hidden, reveal, today, busy, blocked, createId, prepare, more, showReleases, children }: {
  page: GoalReservationsView; releases: { id: string; page: GoalReleasesView } | null; hidden: boolean; reveal(): void; today: string; busy: boolean; blocked: boolean;
  createId(): string; prepare(intent: GoalCommand): Promise<void>; more(): void; showReleases(id: string, next: boolean): void; children: ReactNode;
}) {
  const [selected, setSelected] = useState<string | null>(null), [amount, setAmount] = useState(""), [date, setDate] = useState(today), [error, setError] = useState<string | null>(null), errorRef = useRef<HTMLParagraphElement>(null);
  const entry = page.items.find(item => item.reservation.id === selected);
  async function submit() {
    if (!entry || hidden || busy || blocked) return; let intent: GoalCommand;
    try { const cents = goalAmount(amount, date, today); if (cents > activeReservationAmount(entry.reservation, entry.totals.released_cents)) throw new Error("remaining");
      intent = goalIntent("finance.goal.release", { client_id: createId(), expected_finance_revision: page.finance_revision, reservation_id: entry.reservation.id, amount_cents: cents, occurred_on: date });
    } catch { setError("Informe um valor até o remanescente desta reserva e uma data até hoje."); requestAnimationFrame(() => errorRef.current?.focus()); return; }
    setError(null); await prepare(intent);
  }
  return <div className="fg-history"><p>Liberações preservam o aporte original e não criam uma despesa ou transferência.</p>
    {!page.items.length ? <p>Nenhum aporte registrado nesta meta.</p> : <ul className="fg-history-list">{page.items.map(item => {
      const remaining = activeReservationAmount(item.reservation, item.totals.released_cents);
      return <li key={item.reservation.id}><h3>Aporte de {goalDate(item.reservation.occurred_on)}</h3><dl><div><dt>Original</dt><dd>{goalMoney(item.reservation.amount_cents, hidden)}</dd></div><div><dt>Liberado</dt><dd>{goalMoney(item.totals.released_cents, hidden)}</dd></div><div><dt>Remanescente</dt><dd>{goalMoney(remaining, hidden)}</dd></div></dl>
        <div className="fg-actions"><Button onClick={() => { setSelected(item.reservation.id); setError(null); }} disabled={busy || blocked || hidden || remaining === 0} aria-label={`Liberar valor do aporte de ${goalDate(item.reservation.occurred_on)}`}>Liberar valor</Button><Button onClick={() => showReleases(item.reservation.id, false)} disabled={busy}>Ver liberações</Button></div></li>;
    })}</ul>}
    {page.next_cursor && <Button onClick={more} loading={busy}>Carregar mais aportes</Button>}
    {releases && <section aria-label="Liberações da reserva"><h3>Liberações</h3>{releases.page.items.length ? <ul>{releases.page.items.map(row => <li key={row.id}>{goalDate(row.occurred_on)} · {goalMoney(row.amount_cents, hidden)}</li>)}</ul> : <p>Nenhuma liberação registrada nesta reserva.</p>}{releases.page.next_cursor && <Button onClick={() => showReleases(releases.id, true)} disabled={busy}>Carregar mais liberações</Button>}</section>}
    {entry && (hidden ? <div className="fg-reveal"><p>Exiba os valores para liberar uma reserva.</p><Button onClick={reveal}>Exibir valores</Button></div> : <form onSubmit={event => { event.preventDefault(); void submit(); }}><h3>Liberar valor</h3>{error && <p className="fg-form-error" role="alert" tabIndex={-1} ref={errorRef}>{error}</p>}
      <div className="fg-form-grid"><Field label="Valor a liberar" inputMode="decimal" autoComplete="off" value={amount} onChange={event => setAmount(event.target.value)} disabled={busy || blocked} required /><Field label="Data da liberação" type="date" max={today} value={date} onChange={event => setDate(event.target.value)} disabled={busy || blocked} required /></div><Button type="submit" variant="primary" disabled={blocked} loading={busy}>Revisar liberação</Button></form>)}
    {children}
  </div>;
}
