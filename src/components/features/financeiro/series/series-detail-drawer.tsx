"use client";
import type { RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/dialog";
import type { FinanceSeriesDetailView } from "@/core/financeiro/series/series-public-validation";
import { seriesOccurrenceEligibility, validateSeriesRealization } from "@/core/financeiro/series/series-policy";
import { Money } from "../finance-panels";
import { civilLabel } from "../finance-model";
import { TRANSACTION_STATUS } from "../finance-form";
import { SERIES_FREQUENCY_LABELS, SERIES_STATE_LABELS, type SeriesAction } from "./series-ui-model";

export function SeriesDetailDrawer({ detail, hidden, busy, blocked, today, returnFocusRef, onClose, onAction, reveal }: { detail: FinanceSeriesDetailView; hidden: boolean; busy: boolean; blocked: boolean; today: string; returnFocusRef: RefObject<HTMLElement | null>; onClose(): void; onAction(action: SeriesAction, occurrenceId?: string): void; reveal(): void }) {
  const series = detail.series;
  return <Drawer open title={series.template.description} description="Série finita. Os lançamentos já preparados mantêm suas datas e identidades." returnFocusRef={returnFocusRef} onClose={onClose} dismissible={!busy} footer={<Button disabled={busy} onClick={onClose}>Fechar</Button>}>
    <div className="series-detail">
      <dl className="series-review-data"><div><dt>Estado da série</dt><dd>{SERIES_STATE_LABELS[series.state]}</dd></div><div><dt>Frequência</dt><dd>{SERIES_FREQUENCY_LABELS[series.frequency]}</dd></div><div><dt>Âncora original</dt><dd>{civilLabel(series.anchor_on)}</dd></div><div><dt>Posições registráveis</dt><dd>{series.first_index} a {series.total}</dd></div><div><dt>Preparado até</dt><dd>{series.materialized_through ? civilLabel(series.materialized_through) : "Ainda não preparado"}</dd></div><div><dt>Próxima posição</dt><dd>{series.next_index <= series.total ? series.next_index : "Quantidade esgotada"}</dd></div><div><dt>Término</dt><dd>{series.ends_on ? civilLabel(series.ends_on) : "Na última posição"}</dd></div><div><dt>{series.kind === "parcelamento" ? "Total original" : "Valor por ocorrência"}</dt><dd><Money value={series.template.amount_cents} hidden={hidden} /></dd></div></dl>
      <p className="finance-note">Preparar cria previsões por até doze meses. Pausar, editar e encerrar preserva pagamentos e realizações; retomar não recupera exclusões manuais. Nada será gerado ou pago em segundo plano.</p>
      {hidden ? <div className="series-actions"><Button onClick={reveal}>Exibir valores para gerenciar</Button></div> : <div className="series-actions">
        {series.state === "active" && <><Button disabled={busy || blocked || series.next_index > series.total} onClick={() => onAction("materialize")}>Preparar próximos</Button><Button disabled={busy || blocked} onClick={() => onAction("pause")}>Pausar série</Button></>}
        {series.state === "paused" && <Button disabled={busy || blocked} onClick={() => onAction("resume")}>Retomar série</Button>}
        {series.state !== "ended" && <><Button disabled={busy || blocked} onClick={() => onAction("update_future")}>Editar próximas</Button><Button variant="danger" disabled={busy || blocked} onClick={() => onAction("end")}>Encerrar série</Button></>}
      </div>}
      <h3>Ocorrências preparadas</h3>
      {!detail.occurrences.length ? <p className="finance-note">Ainda não há ocorrências preparadas nesta série. Escolha Preparar próximos para conferir o horizonte.</p> : <ul className="series-occurrences" aria-label="Ocorrências da série">{[...detail.occurrences].sort((a, b) => a.index - b.index).map(occurrence => {
        const row = detail.transactions.find(item => item.id === occurrence.transaction_id)!, account = detail.accounts.find(item => item.id === row.account_id)!;
        let canRealize = account.archived_at === null; try { validateSeriesRealization(series, occurrence, row, account, { status: row.status === "reconciled" ? "reconciled" : "confirmed", paid_cents: row.paid_cents }); } catch { canRealize = false; }
        const canCancel = seriesOccurrenceEligibility(series, occurrence, row, account, { action: "cancel", today, from_on: today }).allowed;
        return <li key={occurrence.id}><div><strong>Posição {occurrence.index} · {civilLabel(row.occurred_on)}</strong><Money value={row.amount_cents} hidden={hidden} /></div><p className="finance-note">{account.name}{row.statement_month ? ` · Fatura ${row.statement_month.slice(0, 7).split("-").reverse().join("/")}` : ""} · {hidden ? "Estado oculto" : occurrence.suppression === "manual" ? "Excluída manualmente" : occurrence.suppression === "series_pause" ? "Pausada pela série" : occurrence.suppression === "ended" ? "Encerrada pela série" : TRANSACTION_STATUS[row.status]}</p>
          {!hidden && <div className="series-actions"><Button disabled={busy || blocked || !canRealize} onClick={() => onAction("occurrence.update", occurrence.id)} aria-label={`Registrar realização da posição ${occurrence.index}`}>{account.kind === "credit_card" && row.kind === "expense" ? "Registrar compra realizada" : "Registrar valor realizado"}</Button><Button variant="ghost" disabled={busy || blocked || !canCancel} onClick={() => onAction("occurrence.cancel", occurrence.id)} aria-label={`Excluir posição ${occurrence.index}`}>Excluir esta ocorrência</Button></div>}
        </li>;
      })}</ul>}
      <p className="finance-note">Realizar uma compra de cartão não paga sua fatura. O pagamento da fatura continua na área Contas, com conta de origem e valor explícitos.</p>
    </div>
  </Drawer>;
}
