"use client";
import { RelatedPanel } from "@/components/layout/related-panel";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cartoesDe, foraDeCompetenciaFinanceira, isTransfer, mesDeCompetencia, type LancamentoFinanceiro } from "@/core/financeiro";
import { useDemoApplication, useDemoPrivacy, useDemoQuery } from "@/lib/demo/demo-provider";
import type { DemoQueries } from "@/lib/demo/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { buildTableView } from "@/components/ui/table-model";
import { BottomSheet, ConfirmDialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Icons } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import { FinanceEditor, FinanceQuickEntry, type FinanceEditorTarget } from "./finance-editors";
import { TRANSACTION_STATUS } from "./finance-form";
import { FinanceAccounts, FinanceBudgets, FinanceCardOverview, FinanceCategories, FinanceDashboard, Money, SignedMoney, TransactionSymbol } from "./finance-panels";
import { civilLabel, financeMonthLabel, financePeriodSummary, financeRows, independentTransaction, probableFinanceDuplicates } from "./finance-model";
import { FINANCE_PRIMARY_TABS, financeHref, financeNavigationGuard, parseFinanceRoute, type FinanceRouteState, type FinanceTab } from "./finance-route";
import { financePeriodChange } from "./finance-period";
import { FinancePeriodPicker } from "./finance-period-picker";
import { FinanceCardDetails } from "./finance-card-details";
import { FinanceSeriesPanel, type SeriesOpenRequest } from "./series/finance-series-panel";
import { SeriesGroupAction } from "./series/series-group-action";
import { FinanceGoalsHost } from "./goals/finance-goals-host";
import "./finance.css";

const TAB_LABELS: Record<FinanceTab, string> = { painel: "Visão geral", lancamentos: "Lançamentos", cartoes: "Cartões", contas: "Contas", categorias: "Categorias", orcamentos: "Planejamento" };
function revealFinanceTab(tab: HTMLAnchorElement) {
  const strip = tab.parentElement;
  if (!strip?.classList.contains("finance-tabs") || strip.scrollWidth <= strip.clientWidth) return;
  const viewport = strip.getBoundingClientRect(), bounds = tab.getBoundingClientRect();
  const left = viewport.left + strip.clientLeft, right = left + strip.clientWidth;
  const delta = bounds.left < left ? bounds.left - left : bounds.right > right ? bounds.right - right : 0;
  // Only this strip moves. Keyboard focus must not scroll page ancestors or
  // wait for an animation, including when reduced motion is preferred.
  if (delta) strip.scrollTo({ left: strip.scrollLeft + (delta < 0 ? Math.floor(delta) : Math.ceil(delta)), behavior: "instant" });
}
export function FinanceWorkspace() {
  const query = useDemoQuery("finance");
  if (!query.data) return <section className="finance-state" data-access="allowed" aria-busy={query.status !== "error"}>
    {query.status === "error" ? <><h2>Não foi possível carregar o financeiro</h2><p role="alert">{query.error}</p><Button onClick={query.retry}>Tentar novamente</Button></> : <><p role="status">Carregando seu financeiro…</p><div className="finance-skeleton" aria-hidden="true"><span /><span /><span /></div></>}
  </section>;
  return <FinanceReady data={query.data} error={query.status === "error" ? query.error : null} retry={query.retry} />;
}

function FinanceReady({ data, error, retry }: { data: DemoQueries["finance"]; error: string | null; retry(): void }) {
  const app = useDemoApplication(), privacy = useDemoPrivacy(), params = useSearchParams(), { toast } = useToast();
  const today = app.today(), state = parseFinanceRoute(params, today), hidden = privacy.valuesHidden;
  const [editor, setEditor] = useState<FinanceEditorTarget | null>(null), [reveal, setReveal] = useState<FinanceEditorTarget | null>(null);
  const [selected, setSelected] = useState<LancamentoFinanceiro | null>(null), [removing, setRemoving] = useState<LancamentoFinanceiro | null>(null);
  const [failure, setFailure] = useState<string | null>(null), [pending, setPending] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [seriesOpen, setSeriesOpen] = useState<SeriesOpenRequest | null>(null), seriesOpenSequence = useRef(0);
  const cardTrigger = useRef<HTMLElement | null>(null);
  const editorTrigger = useRef<HTMLElement | null>(null), actionTrigger = useRef<HTMLElement | null>(null), regionRef = useRef<HTMLElement | null>(null);
  const requests = useRef(new Map<string, { action: "remove" | "restore"; id: string }>()), busy = useRef(false);
  const requestedTransaction = params.get("transaction"), openedTransaction = useRef<string | null>(null);
  useEffect(() => {
    if (!requestedTransaction || openedTransaction.current === requestedTransaction) return;
    const row = data.transactions.find(item => item.id === requestedTransaction);
    if (row) { openedTransaction.current = requestedTransaction; setSelected(row); actionTrigger.current = regionRef.current; }
  }, [requestedTransaction, data.transactions]);

  function navigate(next: FinanceRouteState, replace = false) {
    const href = financeHref(next);
    // Next's native history integration updates useSearchParams without a server
    // round trip for each search keystroke; the URL remains the single authority.
    if (replace) window.history.replaceState(null, "", href);
    else window.history.pushState(null, "", href);
  }
  function filter(patch: Partial<FinanceRouteState>) { navigate({ ...state, ...patch, page: 1 }, true); }
  function openEditor(target: FinanceEditorTarget, trigger: HTMLElement) {
    editorTrigger.current = trigger; setFailure(null);
    if (hidden && target.kind !== "category" && target.kind !== "tag") setReveal(target); else setEditor(target);
  }
  useEffect(() => { if (hidden) setEditor((current) => current?.kind === "category" || current?.kind === "tag" ? current : null); }, [hidden]);
  const categoryName = (row: LancamentoFinanceiro) => data.categories.find((item) => item.id === row.category_id)?.name ?? "Sem categoria";
  const accountName = (row: LancamentoFinanceiro) => data.accounts.find((item) => item.id === row.account_id)?.name ?? "Conta indisponível";
  const kindLabel = (row: LancamentoFinanceiro) => isTransfer(row) ? "Transferência" : row.kind === "income" ? "Entrada" : "Saída";
  const cards = cartoesDe(data.accounts);
  const duplicates = probableFinanceDuplicates(data.transactions);
  const columns: DataTableColumn<LancamentoFinanceiro>[] = [
    { id: "description", header: "Lançamento", accessor: (row) => `${row.description} ${row.payee ?? ""}`, render: (row) => <div className="finance-title-cell"><TransactionSymbol row={row} /><div className="finance-title-copy"><Button variant="ghost" className="finance-title-button" disabled={pending} onClick={(event) => { actionTrigger.current = event.currentTarget; setFailure(null); setSelected(row); }}>{row.description}</Button><small className="finance-note">{isTransfer(row) ? kindLabel(row) : `${categoryName(row)} · ${kindLabel(row)}`}</small>{row.payee && <small className="finance-note">{row.payee}</small>}{row.serie_tipo && <small className="finance-note">{row.serie_tipo === "parcelamento" ? "Parcela" : "Ocorrência"} {row.installment_no} de {row.installment_total}</small>}{duplicates.has(row.id) && <Badge>Possível duplicidade</Badge>}</div></div> },
    { id: "occurred_on", header: "Data", accessor: (row) => row.occurred_on, render: (row) => <span>{civilLabel(row.occurred_on)}{cards.has(row.account_id) && <small className="finance-note finance-block">Fatura {row.statement_month ? row.statement_month.slice(0, 7).split("-").reverse().join("/") : "não definida"}</small>}</span> },
    { id: "account", header: "Conta", accessor: accountName },
    { id: "category", header: "Categoria", accessor: categoryName },
    { id: "kind", header: "Tipo", accessor: kindLabel },
    { id: "status", header: "Estado", accessor: (row) => TRANSACTION_STATUS[row.status], render: (row) => <Badge>{row.deleted_at ? "Na lixeira" : TRANSACTION_STATUS[row.status]}</Badge> },
    { id: "amount_cents", header: "Valor", accessor: (row) => row.amount_cents, searchable: false, sortable: !hidden, render: (row) => <SignedMoney row={row} hidden={hidden} /> },
    { id: "actions", header: "Ações", accessor: () => "", sortable: false, searchable: false, render: (row) => <Button variant="ghost" disabled={pending} aria-label={`Ações de ${row.description}`} onClick={(event) => { actionTrigger.current = event.currentTarget; setFailure(null); setSelected(row); }}><Icons.Dots /></Button> },
  ];
  const rows = financeRows(data.transactions, data.accounts, state);
  const matching = buildTableView({ rows, columns, search: state.search, sort: state.sort, pageSize: Math.max(1, rows.length) }).rows;
  const view = buildTableView({ rows, columns, search: state.search, sort: state.sort, page: state.page, pageSize: 5 });
  const totals = financePeriodSummary(matching, data.accounts, state.month);
  const orphans = foraDeCompetenciaFinanceira(data.transactions, data.accounts);
  const orphanRows = data.transactions.filter((row) => row.deleted_at === null && cards.has(row.account_id) && row.statement_month === null && !isTransfer(row));
  const clampedHref = state.tab === "lancamentos" && state.page !== view.page ? financeHref({ ...state, page: view.page }) : null;
  const renderedSearch = params.toString();
  useEffect(() => {
    if (clampedHref) financeNavigationGuard(() => window.location.pathname + "?" + new URLSearchParams(window.location.search).toString(), "/financeiro?" + renderedSearch)(() => window.history.replaceState(null, "", clampedHref));
  }, [clampedHref, renderedSearch]);

  async function action(row: LancamentoFinanceiro, operation: "remove" | "restore") {
    if (busy.current) { if (operation === "restore") toast({ message: "Aguarde a ação atual para restaurar.", action: { label: "Restaurar lançamento", onClick: () => { void action(row, operation); } } }); return; }
    const restoreNavigation = financeNavigationGuard(() => window.location.href);
    let request = requests.current.get(row.id); if (request?.action !== operation) { request = { action: operation, id: crypto.randomUUID() }; requests.current.set(row.id, request); }
    busy.current = true; setPending(true); setFailure(null);
    try {
      const saved = await app.commands.finance.transactions[operation]({ id: row.id, client_id: request.id });
      requests.current.delete(row.id); setSelected(null); setRemoving(null);
      if (operation === "restore") restoreNavigation(() => navigate({ ...state, tab: "lancamentos", month: mesDeCompetencia(saved, cards) ?? state.month, status: "all", kind: "all", account: "", category: "", search: "", page: 1 }));
      toast({ message: operation === "remove" ? "Lançamento movido para a lixeira." : "Lançamento restaurado.", ...(operation === "remove" ? { duration: 8000, action: { label: "Desfazer", onClick: () => { void action(row, "restore"); } } } : {}) });
    } catch (reason) { setFailure(reason instanceof Error ? reason.message : "Não foi possível alterar o lançamento. Tente novamente."); }
    finally { busy.current = false; setPending(false); }
  }
  function onSaved(kind: FinanceEditorTarget["kind"], message: string, month?: string) {
    const cardEditor = editor?.kind === "account" && (editor.row?.kind === "credit_card" || editor.initialKind === "credit_card");
    const tab: FinanceTab = (kind === "account" && cardEditor) || (kind === "statement" && state.tab === "cartoes") ? "cartoes" : kind === "account" || kind === "close-account" || kind === "statement" ? "contas" : kind === "category" || kind === "tag" ? "categorias" : kind === "budget" ? "orcamentos" : "lancamentos";
    navigate({ ...state, tab, month: month ?? state.month, search: "", kind: "all", status: "all", account: "", category: "", page: 1 }); toast({ message });
    requestAnimationFrame(() => { if (!editorTrigger.current?.isConnected) regionRef.current?.focus({ preventScroll: true }); });
  }
  function openCard(cardId: string, trigger: HTMLElement) { cardTrigger.current = trigger; setSelectedCardId(cardId); }
  const selectedCard = data.accounts.find((account) => account.id === selectedCardId && account.kind === "credit_card");
  const panelProps = { openCard, data, month: state.month, today, hidden, edit: openEditor, history: (accountId: string) => navigate({ ...state, tab: "lancamentos", account: accountId, category: "", search: "", kind: "all", status: "all", page: 1 }) };
  const hasFilters = Boolean(state.search || state.account || state.category || state.kind !== "all" || state.status !== "all");
  const advancedLedgerFilters = Boolean(state.category || !state.sort || state.sort.columnId !== "occurred_on" || state.sort.direction !== "desc");
  const [ledgerOptionsOpen, setLedgerOptionsOpen] = useState(advancedLedgerFilters);
  useEffect(() => {
    if (advancedLedgerFilters && state.tab === "lancamentos") setLedgerOptionsOpen(true);
  }, [advancedLedgerFilters, state.tab]);
  const ledgerFilters = <><div className="finance-ledger-toolbar" role="group" aria-label="Filtros financeiros">
    <Field as="select" label="Filtrar tipo" value={state.kind} onChange={(event) => filter({ kind: event.target.value as FinanceRouteState["kind"] })}><option value="all">Todos os tipos</option><option value="income">Entradas</option><option value="expense">Saídas</option><option value="transfer">Transferências</option></Field>
    <Field as="select" label="Filtrar conta" value={state.account} onChange={(event) => filter({ account: event.target.value })}><option value="">Todas as contas</option>{data.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}{account.archived_at ? " · arquivada" : ""}</option>)}</Field>
    <Field as="select" label="Filtrar estado" value={state.status} onChange={(event) => filter({ status: event.target.value as FinanceRouteState["status"] })}><option value="all">Todos os estados ativos</option>{Object.entries(TRANSACTION_STATUS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}<option value="trash">Lixeira</option></Field>
    <Field label="Buscar lançamentos" type="search" value={state.search} onChange={(event) => filter({ search: event.target.value })} />
  </div><details className="finance-ledger-options finance-details" open={ledgerOptionsOpen} onToggle={event => setLedgerOptionsOpen(event.currentTarget.open)}><summary>Mais filtros e ordenação{advancedLedgerFilters && <span className="finance-note"> · personalizados</span>}</summary>
    <div className="finance-ledger-extra-controls"><Field as="select" label="Filtrar categoria" value={state.category} onChange={(event) => filter({ category: event.target.value })}><option value="">Todas as categorias</option><option value="none">Sem categoria</option>{data.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</Field>
      <Field as="select" label="Ordenar por" value={state.sort?.columnId ?? ""} onChange={(event) => navigate({ ...state, sort: event.target.value ? { columnId: event.target.value, direction: "asc" } : null, page: 1 })}><option value="">Ordem original</option>{columns.filter(column => column.sortable !== false).map(column => <option key={column.id} value={column.id}>{column.header}</option>)}</Field>
      <Button disabled={!state.sort} aria-label={state.sort?.direction === "desc" ? "Usar ordem crescente" : "Usar ordem decrescente"} onClick={() => state.sort && navigate({ ...state, sort: { ...state.sort, direction: state.sort.direction === "asc" ? "desc" : "asc" }, page: 1 })}>{state.sort?.direction === "desc" ? "Decrescente" : "Crescente"}</Button>
    </div><p className="finance-note">Totais antes da paginação, somente confirmados e conciliados. Transferências movimentam saldos e não entram no resultado.</p>
  </details></>;

  return <section className="finance-workspace" data-access="allowed" aria-label="Gestão financeira" ref={regionRef} tabIndex={-1}>
    <nav className="finance-navigation" aria-label="Seções financeiras"><div className="finance-tabs-toolbar"><div className="finance-tabs">{FINANCE_PRIMARY_TABS.map((tab) => <Link key={tab} className={state.tab === tab ? "finance-tab finance-tab--active" : "finance-tab"} href={financeHref({ ...state, tab })} onFocus={event => revealFinanceTab(event.currentTarget)} aria-current={state.tab === tab ? "page" : undefined}>{TAB_LABELS[tab]}</Link>)}</div>
      <div className="finance-toolbar-actions">
      <FinancePeriodPicker month={state.month} today={today} navigationKey={renderedSearch} onChange={(month) => {
        financeNavigationGuard(() => window.location.pathname + "?" + new URLSearchParams(window.location.search).toString(), "/financeiro?" + renderedSearch)(() => navigate(financePeriodChange(state, month)));
      }} /><Button variant="primary" disabled={pending} onClick={(event) => openEditor({ kind: "transaction" }, event.currentTarget)}><Icons.Capture />Novo lançamento</Button></div></div>
      <div className="finance-utilities"><div className="finance-management-links">{(["contas", "categorias"] as const).map(tab => <Link key={tab} className="finance-management-link" href={financeHref({ ...state, tab })} aria-current={state.tab === tab ? "page" : undefined}>{TAB_LABELS[tab]}</Link>)}<Button variant="ghost" disabled={pending} onClick={(event) => openEditor({ kind: "transfer" }, event.currentTarget)}><Icons.Repeat />Transferir</Button></div><details className="finance-context"><summary>{app.mode === "demo" ? `Dia de exemplo: ${civilLabel(today)}` : `Posição em ${civilLabel(today)}`}</summary><p className="finance-note">{app.mode === "demo" ? "Alterações valem nesta sessão; recarregar restaura os exemplos." : "Alterações são salvas na sua conta."}</p></details><Button variant="ghost" aria-pressed={hidden} onClick={() => privacy.setValuesHidden(!hidden)}>{hidden ? <Icons.Eye /> : <Icons.EyeOff />}{hidden ? "Exibir valores" : "Ocultar valores"}</Button></div>
    </nav>
    {error && <div className="finance-error" role="alert"><p>{error}</p><Button onClick={retry}>Tentar novamente</Button></div>}
    {failure && !selected && !removing && <p role="alert" className="finance-error">{failure}</p>}
    {orphans.quantidade > 0 && <details className="finance-details"><summary>Definir competência dos lançamentos de cartão ({orphans.quantidade})</summary><p className="finance-note">Sem competência, estes lançamentos ficam fora dos totais mensais: <Money value={orphans.totalCents} hidden={hidden} />.</p><ul className="finance-list">{orphanRows.map((row) => <li key={row.id}><span><strong>{row.description}</strong><small>{accountName(row)} · {civilLabel(row.occurred_on)}</small></span>{independentTransaction(row) ? <Button disabled={pending} onClick={(event) => openEditor({ kind: "statement-month", row }, event.currentTarget)} aria-label={`Definir competência de ${row.description}`}>Definir competência</Button> : <span className="finance-note">Competência de grupo exige correção conjunta.</span>}</li>)}</ul></details>}
    {state.tab === "painel" && <FinanceDashboard {...panelProps} goals={app.mode === "connected" ? <FinanceGoalsHost data={data} compact /> : undefined} quickEntry={<FinanceQuickEntry data={data} today={today} hidden={hidden} review={openEditor} reveal={() => privacy.setValuesHidden(false)} />} rows={matching} retry={retry} revealValues={() => privacy.setValuesHidden(false)} openTransactions={() => navigate({ ...state, tab: "lancamentos", page: 1 })} openTab={(tab) => navigate({ ...state, tab, page: 1 })} select={(row, trigger) => { actionTrigger.current = trigger; setFailure(null); setSelected(row); }} />}
    {state.tab === "painel" && <FinanceSeriesPanel data={data} openRequest={seriesOpen} onOpenHandled={() => setSeriesOpen(null)} />}
    {state.tab === "cartoes" && <FinanceCardOverview {...panelProps} allCardsLabel="Gerenciar contas" allCards={() => navigate({ ...state, tab: "contas", page: 1 })} />}
    {state.tab === "contas" && <FinanceAccounts {...panelProps} />}
    {state.tab === "categorias" && <FinanceCategories {...panelProps} />}
    {state.tab === "orcamentos" && <><FinanceBudgets {...panelProps} /><FinanceGoalsHost data={data} /><FinanceSeriesPanel data={data} openRequest={seriesOpen} onOpenHandled={() => setSeriesOpen(null)} /></>}
    {state.tab === "lancamentos" && <div className="finance-tab-content finance-ledger"><h2 className="finance-sr">Lançamentos de {financeMonthLabel(state.month)}</h2>
      <div className="finance-ledger-summary"><dl className="finance-metrics finance-list-summary" aria-label="Totais realizados do recorte"><div><dt>Entradas</dt><dd><Money value={totals.incomeCents} hidden={hidden} /></dd></div><div><dt>Saídas</dt><dd><Money value={totals.expenseCents} hidden={hidden} /></dd></div><div><dt>Resultado</dt><dd><Money value={totals.balanceCents} hidden={hidden} /></dd></div></dl>{hasFilters && <Button variant="ghost" onClick={() => filter({ search: "", account: "", category: "", status: "all", kind: "all" })}>Limpar filtros</Button>}</div>
      {ledgerFilters}<DataTable label="Lista de lançamentos" rows={rows} columns={columns} getRowId={(row) => row.id} controls={false} pageSize={5} state={{ search: state.search, sort: state.sort, page: state.page }} onStateChange={(next) => navigate({ ...state, search: next.search, sort: next.sort, page: next.page }, next.search !== state.search)} emptyMessage={data.transactions.length === 0 ? "Ainda não há lançamentos. Crie o primeiro para acompanhar seu dinheiro." : hasFilters ? "Nenhum lançamento corresponde aos filtros escolhidos. Limpe os filtros para ver o mês." : "Nenhum lançamento nesta competência. Consulte outro mês ou crie um lançamento."} />
    </div>}
    {selectedCard && <FinanceCardDetails key={selectedCard.id} card={selectedCard} data={data} month={state.month} today={today} hidden={hidden} navigationKey={renderedSearch} changeMonth={(month) => { financeNavigationGuard(() => window.location.pathname + "?" + new URLSearchParams(window.location.search).toString(), "/financeiro?" + renderedSearch)(() => navigate(financePeriodChange(state, month))); }} returnFocusRef={cardTrigger} close={() => setSelectedCardId(null)} edit={openEditor} history={panelProps.history} />}
    {editor && (!hidden || editor.kind === "category" || editor.kind === "tag") && <FinanceEditor key={`${editor.kind}-${editor.row?.id ?? "new"}`} target={editor} data={data} today={today} month={state.month} returnFocusRef={editorTrigger} onClose={() => setEditor(null)} onSaved={onSaved} />}
    {reveal && <ConfirmDialog open destructive={false} title="Exibir valores para editar?" description="O formulário mostra valores financeiros. Exiba-os para continuar." confirmLabel="Exibir valores e continuar" returnFocusRef={editorTrigger} onClose={() => setReveal(null)} onConfirm={() => { privacy.setValuesHidden(false); setEditor(reveal); setReveal(null); }} />}
    {selected && <BottomSheet open title="Detalhes do lançamento" description={selected.description} returnFocusRef={actionTrigger} onClose={() => setSelected(null)} dismissible={!pending}><div className="finance-action-menu">{failure && <p className="finance-error" role="alert">{failure}</p>}<dl className="finance-detail-list"><div><dt>Valor</dt><dd><Money value={selected.amount_cents} hidden={hidden} /></dd></div><div><dt>Conta</dt><dd>{accountName(selected)}</dd></div><div><dt>Categoria</dt><dd>{categoryName(selected)}</dd></div><div><dt>Estado</dt><dd>{TRANSACTION_STATUS[selected.status]}</dd></div><div><dt>Data</dt><dd>{civilLabel(selected.occurred_on)}</dd></div>{selected.due_date && <div><dt>Vencimento</dt><dd>{civilLabel(selected.due_date)}</dd></div>}</dl>
      {duplicates.has(selected.id) && <p className="finance-note">Há outro lançamento semelhante nesta conta e data. Revise antes de alterar; este aviso não bloqueia suas ações.</p>}
      {!independentTransaction(selected) ? <><p className="finance-note">Este lançamento faz parte de uma transferência ou série. Os registros vinculados são mantidos juntos.</p>{selected.installment_group_id && selected.serie_tipo === "recorrencia" && !selected.deleted_at && <SeriesGroupAction groupId={selected.installment_group_id} disabled={pending} onLegacy={() => { const row = selected; setSelected(null); openEditor({ kind: "stop-series", row }, actionTrigger.current ?? regionRef.current!); }} onManaged={seriesId => { setSelected(null); setSeriesOpen({ ownerId: app.userId, providerEpoch: app.epoch, seriesId, sequence: ++seriesOpenSequence.current }); navigate({ ...state, tab: "painel" }); }} />}</> : selected.deleted_at ? <Button loading={pending} onClick={() => { void action(selected, "restore"); }}>Restaurar lançamento</Button> : <><Button disabled={pending} onClick={() => { const row = selected; setSelected(null); openEditor({ kind: "transaction", row }, actionTrigger.current ?? regionRef.current!); }}>Editar lançamento</Button><Button disabled={pending} onClick={() => { const row = selected; setSelected(null); openEditor({ kind: "duplicate", row }, actionTrigger.current ?? regionRef.current!); }}>Duplicar lançamento</Button><Button variant="danger" disabled={pending} onClick={() => { setRemoving(selected); setSelected(null); setFailure(null); }}>Excluir lançamento</Button></>}
      <RelatedPanel type="transaction" id={selected.id} /></div></BottomSheet>}
    {removing && <ConfirmDialog open title="Mover lançamento para a lixeira?" description={`“${removing.description}” sairá dos totais e poderá ser restaurado depois.`} confirmLabel="Mover para a lixeira" loading={pending} error={failure ?? undefined} returnFocusRef={actionTrigger} onClose={() => setRemoving(null)} onConfirm={() => { void action(removing, "remove"); }} />}
  </section>;
}
