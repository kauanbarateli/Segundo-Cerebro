"use client";
import { RelatedPanel } from "@/components/layout/related-panel";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cartoesDe, foraDeCompetenciaFinanceira, isTransfer, mesDeCompetencia, somaMeses, type LancamentoFinanceiro } from "@/core/financeiro";
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
import { FinanceEditor, type FinanceEditorTarget } from "./finance-editors";
import { TRANSACTION_STATUS } from "./finance-form";
import { FinanceAccounts, FinanceBudgets, FinanceCategories, FinanceDashboard, Money } from "./finance-panels";
import { civilLabel, financeMonthLabel, financePeriodSummary, financeRows, independentTransaction, probableFinanceDuplicates } from "./finance-model";
import { FINANCE_TABS, financeHref, financeNavigationGuard, parseFinanceRoute, type FinanceRouteState, type FinanceTab } from "./finance-route";
import "./finance.css";

const TAB_LABELS: Record<FinanceTab, string> = { painel: "Painel", lancamentos: "Lançamentos", contas: "Contas", categorias: "Categorias", orcamentos: "Orçamentos" };
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
    { id: "description", header: "Lançamento", accessor: (row) => `${row.description} ${row.payee ?? ""}`, render: (row) => <div className="finance-title-cell"><Button variant="ghost" className="finance-title-button" disabled={pending} onClick={(event) => { actionTrigger.current = event.currentTarget; setFailure(null); setSelected(row); }}>{row.description}</Button>{row.payee && <small className="finance-note">{row.payee}</small>}{row.serie_tipo && <small className="finance-note">{row.serie_tipo === "parcelamento" ? "Parcela" : "Ocorrência"} {row.installment_no} de {row.installment_total}</small>}{duplicates.has(row.id) && <Badge>Possível duplicidade</Badge>}</div> },
    { id: "occurred_on", header: "Data", accessor: (row) => row.occurred_on, render: (row) => <span>{civilLabel(row.occurred_on)}{cards.has(row.account_id) && <small className="finance-note finance-block">Fatura {row.statement_month ? row.statement_month.slice(0, 7).split("-").reverse().join("/") : "não definida"}</small>}</span> },
    { id: "account", header: "Conta", accessor: accountName },
    { id: "category", header: "Categoria", accessor: categoryName },
    { id: "kind", header: "Tipo", accessor: kindLabel },
    { id: "status", header: "Estado", accessor: (row) => TRANSACTION_STATUS[row.status], render: (row) => <Badge>{row.deleted_at ? "Na lixeira" : TRANSACTION_STATUS[row.status]}</Badge> },
    { id: "amount_cents", header: "Valor", accessor: (row) => row.amount_cents, searchable: false, sortable: !hidden, render: (row) => <Money value={row.amount_cents} hidden={hidden} /> },
    { id: "actions", header: "Ações", accessor: () => "", sortable: false, searchable: false, render: (row) => <Button variant="ghost" disabled={pending} aria-label={`Ações de ${row.description}`} onClick={(event) => { actionTrigger.current = event.currentTarget; setFailure(null); setSelected(row); }}>Ações</Button> },
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
    const tab: FinanceTab = kind === "account" || kind === "close-account" || kind === "statement" ? "contas" : kind === "category" || kind === "tag" ? "categorias" : kind === "budget" ? "orcamentos" : "lancamentos";
    navigate({ ...state, tab, month: month ?? state.month, search: "", kind: "all", status: "all", account: "", category: "", page: 1 }); toast({ message });
  }
  const panelProps = { data, month: state.month, today, hidden, edit: openEditor, history: (accountId: string) => navigate({ ...state, tab: "lancamentos", account: accountId, category: "", search: "", kind: "all", status: "all", page: 1 }) };
  const hasFilters = Boolean(state.search || state.account || state.category || state.kind !== "all" || state.status !== "all");

  return <section className="finance-workspace" data-access="allowed" aria-label="Gestão financeira" ref={regionRef} tabIndex={-1}>
    <div className="finance-toolbar"><div className="finance-month-controls"><Button variant="ghost" aria-label="Mês anterior" onClick={() => navigate({ ...state, month: somaMeses(state.month, -1), page: 1 })}>Anterior</Button><Field label="Competência selecionada" type="month" value={state.month.slice(0, 7)} onChange={(event) => { const value = event.target.value; if (/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) navigate({ ...state, month: `${value}-01`, page: 1 }); }} /><Button variant="ghost" aria-label="Próximo mês" onClick={() => navigate({ ...state, month: somaMeses(state.month, 1), page: 1 })}>Próximo</Button></div><div className="finance-toolbar-actions"><Button aria-pressed={hidden} onClick={() => privacy.setValuesHidden(!hidden)}>{hidden ? "Exibir valores" : "Ocultar valores"}</Button><Button disabled={pending} onClick={(event) => openEditor({ kind: "transfer" }, event.currentTarget)}>Transferir</Button><Button variant="primary" disabled={pending} onClick={(event) => openEditor({ kind: "transaction" }, event.currentTarget)}><Icons.Capture />Novo lançamento</Button></div></div>
    <p className="finance-note">{app.mode === "demo" ? `Dia de exemplo: ${civilLabel(today)}. Alterações valem nesta sessão; recarregar restaura os exemplos.` : `Posição em ${civilLabel(today)}. Alterações são salvas na sua conta.`}</p>
    <nav className="finance-tabs" aria-label="Seções financeiras">{FINANCE_TABS.map((tab) => <Link key={tab} className={state.tab === tab ? "finance-tab finance-tab--active" : "finance-tab"} href={financeHref({ ...state, tab })} aria-current={state.tab === tab ? "page" : undefined}>{TAB_LABELS[tab]}</Link>)}</nav>
    {error && <div className="finance-error" role="alert"><p>{error}</p><Button onClick={retry}>Tentar novamente</Button></div>}
    {failure && !selected && !removing && <p role="alert" className="finance-error">{failure}</p>}
    {orphans.quantidade > 0 && <details className="finance-details"><summary>Definir competência dos lançamentos de cartão ({orphans.quantidade})</summary><p className="finance-note">Sem competência, estes lançamentos ficam fora dos totais mensais: <Money value={orphans.totalCents} hidden={hidden} />.</p><ul className="finance-list">{orphanRows.map((row) => <li key={row.id}><span><strong>{row.description}</strong><small>{accountName(row)} · {civilLabel(row.occurred_on)}</small></span>{independentTransaction(row) ? <Button disabled={pending} onClick={(event) => openEditor({ kind: "statement-month", row }, event.currentTarget)} aria-label={`Definir competência de ${row.description}`}>Definir competência</Button> : <span className="finance-note">Competência de grupo exige correção conjunta.</span>}</li>)}</ul></details>}
    {state.tab === "painel" && <FinanceDashboard {...panelProps} rows={matching} openTransactions={() => navigate({ ...state, tab: "lancamentos", page: 1 })} />}
    {state.tab === "contas" && <FinanceAccounts {...panelProps} />}
    {state.tab === "categorias" && <FinanceCategories {...panelProps} />}
    {state.tab === "orcamentos" && <FinanceBudgets {...panelProps} />}
    {state.tab === "lancamentos" && <div className="finance-tab-content"><div className="finance-section-heading"><h2>Lançamentos de {financeMonthLabel(state.month)}</h2>{hasFilters && <Button variant="ghost" onClick={() => filter({ search: "", account: "", category: "", status: "all", kind: "all" })}>Limpar filtros</Button>}</div>
      <div className="finance-filters" role="group" aria-label="Filtros financeiros"><Field as="select" label="Filtrar tipo" value={state.kind} onChange={(event) => filter({ kind: event.target.value as FinanceRouteState["kind"] })}><option value="all">Todos os tipos</option><option value="income">Entradas</option><option value="expense">Saídas</option><option value="transfer">Transferências</option></Field><Field as="select" label="Filtrar conta" value={state.account} onChange={(event) => filter({ account: event.target.value })}><option value="">Todas as contas</option>{data.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}{account.archived_at ? " · arquivada" : ""}</option>)}</Field><Field as="select" label="Filtrar categoria" value={state.category} onChange={(event) => filter({ category: event.target.value })}><option value="">Todas as categorias</option><option value="none">Sem categoria</option>{data.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</Field><Field as="select" label="Filtrar estado" value={state.status} onChange={(event) => filter({ status: event.target.value as FinanceRouteState["status"] })}><option value="all">Todos os estados ativos</option>{Object.entries(TRANSACTION_STATUS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}<option value="trash">Lixeira</option></Field></div>
      <dl className="finance-metrics finance-list-summary" aria-label="Totais realizados do recorte"><div><dt>Entradas</dt><dd><Money value={totals.incomeCents} hidden={hidden} /></dd></div><div><dt>Saídas</dt><dd><Money value={totals.expenseCents} hidden={hidden} /></dd></div><div><dt>Resultado</dt><dd><Money value={totals.balanceCents} hidden={hidden} /></dd></div></dl><p className="finance-note">Totais antes da paginação, somente confirmados e conciliados. Transferências movimentam saldos e não entram no resultado.</p>
      <DataTable label="Lista de lançamentos" rows={rows} columns={columns} getRowId={(row) => row.id} searchLabel="Buscar lançamentos" pageSize={5} state={{ search: state.search, sort: state.sort, page: state.page }} onStateChange={(next) => navigate({ ...state, search: next.search, sort: next.sort, page: next.page }, next.search !== state.search)} emptyMessage={data.transactions.length === 0 ? "Ainda não há lançamentos. Crie o primeiro para acompanhar seu dinheiro." : hasFilters ? "Nenhum lançamento corresponde aos filtros escolhidos. Limpe os filtros para ver o mês." : "Nenhum lançamento nesta competência. Consulte outro mês ou crie um lançamento."} />
    </div>}
    {editor && (!hidden || editor.kind === "category" || editor.kind === "tag") && <FinanceEditor key={`${editor.kind}-${editor.row?.id ?? "new"}`} target={editor} data={data} today={today} month={state.month} returnFocusRef={editorTrigger} onClose={() => setEditor(null)} onSaved={onSaved} />}
    {reveal && <ConfirmDialog open destructive={false} title="Exibir valores para editar?" description="O formulário mostra valores financeiros. Exiba-os para continuar." confirmLabel="Exibir valores e continuar" returnFocusRef={editorTrigger} onClose={() => setReveal(null)} onConfirm={() => { privacy.setValuesHidden(false); setEditor(reveal); setReveal(null); }} />}
    {selected && <BottomSheet open title="Detalhes do lançamento" description={selected.description} returnFocusRef={actionTrigger} onClose={() => setSelected(null)} dismissible={!pending}><div className="finance-action-menu">{failure && <p className="finance-error" role="alert">{failure}</p>}<dl className="finance-detail-list"><div><dt>Valor</dt><dd><Money value={selected.amount_cents} hidden={hidden} /></dd></div><div><dt>Conta</dt><dd>{accountName(selected)}</dd></div><div><dt>Categoria</dt><dd>{categoryName(selected)}</dd></div><div><dt>Estado</dt><dd>{TRANSACTION_STATUS[selected.status]}</dd></div><div><dt>Data</dt><dd>{civilLabel(selected.occurred_on)}</dd></div>{selected.due_date && <div><dt>Vencimento</dt><dd>{civilLabel(selected.due_date)}</dd></div>}</dl>
      {duplicates.has(selected.id) && <p className="finance-note">Há outro lançamento semelhante nesta conta e data. Revise antes de alterar; este aviso não bloqueia suas ações.</p>}
      {!independentTransaction(selected) ? <><p className="finance-note">Este lançamento faz parte de uma transferência ou série. Os registros vinculados são mantidos juntos.</p>{selected.installment_group_id && selected.serie_tipo === "recorrencia" && !selected.deleted_at && <Button disabled={pending} onClick={() => { const row = selected; setSelected(null); openEditor({ kind: "stop-series", row }, actionTrigger.current ?? regionRef.current!); }}>Encerrar recorrência</Button>}</> : selected.deleted_at ? <Button loading={pending} onClick={() => { void action(selected, "restore"); }}>Restaurar lançamento</Button> : <><Button disabled={pending} onClick={() => { const row = selected; setSelected(null); openEditor({ kind: "transaction", row }, actionTrigger.current ?? regionRef.current!); }}>Editar lançamento</Button><Button disabled={pending} onClick={() => { const row = selected; setSelected(null); openEditor({ kind: "duplicate", row }, actionTrigger.current ?? regionRef.current!); }}>Duplicar lançamento</Button><Button variant="danger" disabled={pending} onClick={() => { setRemoving(selected); setSelected(null); setFailure(null); }}>Excluir lançamento</Button></>}
      <RelatedPanel type="transaction" id={selected.id} /></div></BottomSheet>}
    {removing && <ConfirmDialog open title="Mover lançamento para a lixeira?" description={`“${removing.description}” sairá dos totais e poderá ser restaurado depois.`} confirmLabel="Mover para a lixeira" loading={pending} error={failure ?? undefined} returnFocusRef={actionTrigger} onClose={() => setRemoving(null)} onConfirm={() => { void action(removing, "remove"); }} />}
  </section>;
}
