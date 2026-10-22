"use client";

import { useId, useState, type RefObject } from "react";
import { faturaFinanceira, fechamentoDaFatura, isTransfer, ROTULO_DO_STATUS_DA_FATURA, saldosFinanceiros, statusDaFatura, vencimentoDaFatura, type ContaFinanceira } from "@/core/financeiro";
import type { DemoQueries } from "@/lib/demo/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/dialog";
import { Icons } from "@/components/ui/icons";
import type { FinanceEditorTarget } from "./finance-editors";
import { TRANSACTION_STATUS } from "./finance-form";
import { civilLabel, financeMonthLabel } from "./finance-model";
import { Money, SignedMoney } from "./finance-panels";
import { FinancePeriodPicker } from "./finance-period-picker";

const TABS = [{ id: "invoice", label: "Fatura" }, { id: "purchases", label: "Compras" }, { id: "settings", label: "Configurações" }] as const;
type CardTab = typeof TABS[number]["id"];

export function FinanceCardDetails({ card, data, month, today, hidden, navigationKey, changeMonth, returnFocusRef, close, edit, history }: {
  card: ContaFinanceira; data: DemoQueries["finance"]; month: string; today: string; hidden: boolean; navigationKey: string;
  changeMonth(month: string): void; returnFocusRef: RefObject<HTMLElement | null>; close(): void;
  edit(target: FinanceEditorTarget, trigger: HTMLElement): void; history(accountId: string): void;
}) {
  const [tab, setTab] = useState<CardTab>("invoice");
  const id = useId();
  const invoice = faturaFinanceira(data.transactions, card, month);
  const balance = saldosFinanceiros(data.transactions, data.accounts).find((item) => item.account_id === card.id);
  const cycle = card.statement_closing_day !== null && card.payment_due_day !== null;
  const status = cycle ? statusDaFatura({ hoje: today, mesFatura: month, diaFechamento: card.statement_closing_day!, diaVencimento: card.payment_due_day!, resumo: invoice }) : null;
  const purchases = data.transactions.filter((row) => row.account_id === card.id && row.statement_month === month && row.deleted_at === null && !isTransfer(row)).sort((a, b) => b.occurred_on.localeCompare(a.occurred_on) || b.id.localeCompare(a.id));
  function openEditor(target: FinanceEditorTarget, fallback: HTMLElement) { const origin = returnFocusRef.current ?? fallback; close(); edit(target, origin); }
  return <Drawer open title={card.name} description="Compras, fatura e configurações do cartão." returnFocusRef={returnFocusRef} onClose={close} className="finance-card-drawer">
    <div className="finance-card-face" aria-label="Identificação do cartão"><Icons.Wallet aria-hidden="true" /><strong>{card.name}</strong><span>{card.institution || "Cartão de crédito"}</span><span>{hidden ? "Final oculto" : card.last_four ? "Final " + card.last_four : "Final não informado"}</span></div>
    <div className="finance-card-tabs" role="tablist" aria-label="Detalhes do cartão" onKeyDown={(event) => {
      const controls = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("[role='tab']"));
      const current = controls.indexOf(event.target as HTMLButtonElement);
      if (current < 0 || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === "Home" ? 0 : event.key === "End" ? TABS.length - 1 : (current + (event.key === "ArrowRight" ? 1 : -1) + TABS.length) % TABS.length;
      const destination = TABS[next];
      const control = controls[next];
      if (!destination || !control) return;
      setTab(destination.id); control.focus();
    }}>{TABS.map((item) => <Button key={item.id} id={id + "-" + item.id} role="tab" aria-selected={tab === item.id} aria-controls={id + "-panel"} tabIndex={tab === item.id ? 0 : -1} onClick={() => setTab(item.id)}>{item.label}</Button>)}</div>
    <div id={id + "-panel"} className="finance-card-tab-panel" role="tabpanel" aria-labelledby={id + "-" + tab} tabIndex={0}>
      {tab !== "settings" && <FinancePeriodPicker month={month} today={today} navigationKey={navigationKey} onChange={changeMonth} />}
      {tab === "invoice" && <>
        <div className="finance-card-invoice"><h3>Fatura de {financeMonthLabel(month)}</h3><Badge>{hidden ? "Valores ocultos" : status === null ? "Ciclo não definido" : ROTULO_DO_STATUS_DA_FATURA[status]}</Badge><p className="finance-kpi"><Money value={invoice.openCents} hidden={hidden} /></p><p className="finance-note">Em aberto nesta competência. Crédito excedente e pagamentos parciais seguem no cálculo.</p></div>
        <dl className="finance-detail-list"><div><dt>Compras e ajustes</dt><dd><Money value={invoice.totalCents} hidden={hidden} /></dd></div><div><dt>Pago nesta fatura</dt><dd><Money value={invoice.paidCents} hidden={hidden} /></dd></div>{cycle && <><div><dt>Fechamento</dt><dd>{civilLabel(fechamentoDaFatura(month, card.statement_closing_day!))}</dd></div><div><dt>Vencimento</dt><dd>{civilLabel(vencimentoDaFatura(month, card.payment_due_day!, card.statement_closing_day!))}</dd></div></>}<div><dt>Dívida atual de todo o histórico</dt><dd><Money value={balance?.debt_cents ?? 0} hidden={hidden} /></dd></div><div><dt>Limite disponível agora</dt><dd><Money value={balance?.available_cents ?? 0} hidden={hidden} /></dd></div></dl>
        <Button variant="primary" disabled={card.archived_at !== null} onClick={(event) => openEditor({ kind: "statement", row: card }, event.currentTarget)}>Pagar fatura</Button>
        <p className="finance-note">O pagamento é registrado na conta escolhida. Não há débito automático.</p>
      </>}
      {tab === "purchases" && <><h3>Compras e estornos desta competência</h3>{purchases.length ? <ul className="finance-card-purchases">{purchases.map((row) => <li key={row.id}><div><strong>{row.description}</strong><small>{civilLabel(row.occurred_on)} · {TRANSACTION_STATUS[row.status]}{row.serie_tipo ? " · " + (row.serie_tipo === "parcelamento" ? "Parcela " : "Ocorrência ") + row.installment_no + " de " + row.installment_total : ""}</small></div><SignedMoney row={row} hidden={hidden} /></li>)}</ul> : <p className="finance-empty">Nenhuma compra ou estorno nesta competência. Consulte outro mês ou o histórico completo.</p>}<p className="finance-note">A data original é preservada. Transferências e pagamentos de fatura não aparecem como novas compras.</p><Button onClick={() => { close(); history(card.id); }}>Ver lançamentos deste cartão</Button></>}
      {tab === "settings" && <><h3>Configurações do cartão</h3><dl className="finance-detail-list"><div><dt>Instituição</dt><dd>{card.institution || "Não informada"}</dd></div><div><dt>Limite contratado</dt><dd><Money value={card.credit_limit_cents ?? 0} hidden={hidden} /></dd></div><div><dt>Final do cartão</dt><dd>{hidden ? "Final oculto" : card.last_four ?? "Não informado"}</dd></div><div><dt>Conta sugerida</dt><dd>{data.accounts.find(account => account.id === card.default_payment_account_id)?.name ?? "Escolher ao pagar"}</dd></div><div><dt>Dia de fechamento</dt><dd>{card.statement_closing_day ?? "Não informado"}</dd></div><div><dt>Dia de vencimento</dt><dd>{card.payment_due_day ?? "Não informado"}</dd></div></dl><p className="finance-note">Editar o ciclo conserva a competência das compras já registradas.</p><Button onClick={(event) => openEditor({ kind: "account", row: card }, event.currentTarget)}>Editar cartão</Button><Button variant="ghost" disabled={card.archived_at !== null} onClick={(event) => openEditor({ kind: "close-account", row: card }, event.currentTarget)}>Arquivar cartão</Button></>}
    </div>
  </Drawer>;
}
