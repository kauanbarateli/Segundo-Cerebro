"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { FinanceSeriesResult } from "@/core/financeiro/series/series-types";
import type { SeriesJournalEntry } from "@/lib/finance-series-journal";
import { civilLabel } from "../finance-model";
import { Money } from "../finance-panels";
import { SERIES_ACTION_LABELS, type SeriesAction } from "./series-ui-model";
import type { SeriesLiveSession, SeriesRun } from "./use-series-channel";

export function SeriesPendingActions({ entry, session, run, busy, hidden, onConfirmed }: { entry: SeriesJournalEntry; session: SeriesLiveSession; run: SeriesRun; busy: boolean; hidden: boolean; onConfirmed(result: FinanceSeriesResult): void }) {
  const [notice, setNotice] = useState<string | null>(null), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const current = () => alive.current && session.current();
  async function inspect() {
    const reply = await run(session, client => client.reconcilePending()); if (!current()) return;
    if (!reply.ok) { setNotice(reply.message); return; }
    if (reply.result.kind === "confirmed") onConfirmed(reply.result.result);
    else setNotice("Ainda não há uma confirmação da tentativa original. Isso não prova que ela foi desfeita. O mesmo conteúdo permanece guardado para consulta ou reenvio.");
  }
  async function resend() { const reply = await run(session, client => client.retryPending()); if (!current()) return; if (reply.ok) onConfirmed(reply.result); else setNotice(reply.message); }
  const action = entry.request.command.slice("finance.recurring.".length) as SeriesAction;
  const request = entry.request, chosenTemplate = request.command === "finance.recurring.create" ? request.input.definition.template : request.command === "finance.recurring.update_future" ? request.input.patch.template : null;
  return <div className="series-recovery" aria-label="Tentativa de série pendente">
    <strong>Confirmação pendente</strong><p className="finance-note">{SERIES_ACTION_LABELS[action]}. O conteúdo original está guardado neste navegador. Não será reenviado automaticamente; confira esta tentativa antes de preparar outra.</p>
    <details className="series-details"><summary>Conferir dados do envio original</summary><dl className="series-review-data">
      {chosenTemplate && <><div><dt>Descrição escolhida</dt><dd>{chosenTemplate.description}</dd></div><div><dt>Valor escolhido</dt><dd><Money value={chosenTemplate.amount_cents} hidden={hidden} /></dd></div></>}
      {request.command === "finance.recurring.create" && <><div><dt>Primeira posição registrada</dt><dd>{request.input.definition.first_index} de {request.input.definition.total} · {civilLabel(request.input.definition.anchor_on)}</dd></div><div><dt>Tipo</dt><dd>{request.input.definition.kind === "parcelamento" ? "Total original dividido em parcelas" : "Valor repetido por ocorrência"}</dd></div></>}
      {(request.command === "finance.recurring.create" || request.command === "finance.recurring.resume" || request.command === "finance.recurring.materialize") && <div><dt>Horizonte de novas criações</dt><dd>{civilLabel(request.input.horizon.from_on)} até {civilLabel(request.input.horizon.until_exclusive)} (fim não incluído)</dd></div>}
      {(request.command === "finance.recurring.pause" || request.command === "finance.recurring.end" || request.command === "finance.recurring.update_future") && <div><dt>Aplicar a partir de</dt><dd>{civilLabel(request.input.from_on)}</dd></div>}
      {request.command === "finance.recurring.occurrence.update" && <><div><dt>Total realizado escolhido</dt><dd><Money value={request.input.patch.paid_cents} hidden={hidden} /></dd></div><div><dt>Estado escolhido no envio</dt><dd>{hidden ? "Estado oculto" : request.input.patch.status === "reconciled" ? "Conciliado" : "Confirmado"}</dd></div></>}
    </dl><p className="finance-note">São escolhas do envio original, não uma confirmação de que ele foi aplicado.</p></details>
    <p className="finance-note">Sair da conta remove o corpo local por privacidade, sem desfazer uma possível operação já enviada. Ao reentrar, será necessário conferir os dados atuais.</p>
    {notice && <p role="status" className="finance-note">{notice}</p>}
    <div className="series-actions"><Button disabled={busy} onClick={() => { void inspect(); }}>Consultar tentativa original</Button><Button disabled={busy} onClick={() => { void resend(); }}>Reenviar o mesmo conteúdo</Button></div>
  </div>;
}
