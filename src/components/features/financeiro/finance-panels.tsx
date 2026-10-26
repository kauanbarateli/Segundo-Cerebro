"use client";

import type { ReactNode } from "react";
import { despesasPorCategoriaFinanceiras, isTransfer, faturaFinanceira, faturasFinanceirasQueVencemEm, fechamentoDaFatura, patrimonioFinanceiro, planoDoMesFinanceiro, progressoOrcamentosFinanceiros, ROTULO_DO_STATUS_DA_FATURA, saldosFinanceiros, somaMeses, statusDaFatura, totaisFinanceiros, totalAPagarEm, vencimentoDaFatura, type LancamentoFinanceiro } from "@/core/financeiro";
import { formatBRL } from "@/core/dinheiro";
import type { DemoQueries } from "@/lib/demo/types";
import { useDemoApplication } from "@/lib/demo/demo-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { ACCOUNT_KINDS } from "./finance-form";
import { civilLabel, financeMonthLabel, sumFinanceValues } from "./finance-model";
import type { FinanceEditorTarget } from "./finance-editors";
import { FinanceCompetenceChart } from "./finance-competence-chart";

interface PanelProps { data: DemoQueries["finance"]; month: string; today: string; hidden: boolean; edit(target: FinanceEditorTarget, trigger: HTMLElement): void; history(accountId: string): void }
export function Money({ value, hidden, className = "" }: { value: number; hidden: boolean; className?: string }) { return <span className={`finance-money ${className}`}>{formatBRL(value, { hidden })}</span>; }
function Card({ title, children, className = "", action }: { title: string; children: ReactNode; className?: string; action?: ReactNode }) { return <section className={`finance-card ${className}`} aria-label={title}>{action ? <div className="finance-card-head"><h2>{title}</h2>{action}</div> : <h2>{title}</h2>}{children}</section>; }
const colorClass = (key: string | null) => /^fin-[1-6]$/.test(key ?? "") ? `finance-color--${key}` : "finance-color--fin-1";

/** Direction sign stays outside the masked value: hidden values never reveal kind or size. */
export function SignedMoney({ row, hidden }: { row: LancamentoFinanceiro; hidden: boolean }) {
  const kind = isTransfer(row) ? "transfer" : row.kind === "income" ? "income" : "expense";
  return <span className={`finance-amount finance-amount--${kind}`}>{!hidden && kind !== "transfer" && <span aria-hidden="true">{kind === "income" ? "+ " : "− "}</span>}<Money value={row.amount_cents} hidden={hidden} /></span>;
}
export function TransactionSymbol({ row }: { row: LancamentoFinanceiro }) {
  const kind = isTransfer(row) ? "transfer" : row.kind === "income" ? "income" : "expense";
  return <span className={`finance-symbol finance-symbol--${kind}`} aria-hidden="true">{kind === "transfer" ? <Icons.Repeat /> : <Icons.ArrowUpRight />}</span>;
}

export function FinanceDashboard({ data, month, today, hidden, edit, rows, openTransactions, openTab, select, retry, revealValues, quickEntry, openCard, goals }: PanelProps & { rows: LancamentoFinanceiro[]; openTransactions(): void; openTab(tab: "orcamentos" | "lancamentos" | "cartoes"): void; quickEntry: ReactNode; goals?: ReactNode; openCard(cardId: string, trigger: HTMLElement): void; select(row: LancamentoFinanceiro, trigger: HTMLElement): void; retry(): void; revealValues(): void }) {
  const wealth = patrimonioFinanceiro(data.transactions, data.accounts);
  const net = sumFinanceValues([wealth.patrimonioCents, -wealth.dividaCents]);
  const due = faturasFinanceirasQueVencemEm(data.transactions, data.accounts, month);
  const categoryTotals = despesasPorCategoriaFinanceiras(rows, data.categories, [month], data.accounts);
  if (hidden) categoryTotals.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const months = Array.from({ length: 6 }, (_, index) => somaMeses(month, index - 5));
  const history = months.map((item) => ({ month: item, value: totaisFinanceiros(data.transactions, data.accounts, [item]).balanceCents }));
  const largest = Math.max(1, ...history.map((item) => Math.abs(item.value)));
  const points = history.map((item, index) => `${10 + index * 36},${45 - item.value / largest * 32}`).join(" ");
  let offset = 0;
  const debts = due.filter((item) => item.openCents > 0);
  const pending = data.transactions.filter((row) => row.deleted_at === null && row.kind === "expense" && (row.status === "pending" || row.status === "planned") && row.due_date?.slice(0, 7) === month.slice(0, 7) && data.accounts.some((account) => account.id === row.account_id && account.kind !== "credit_card"));
  const recent = [...rows].sort((a, b) => b.occurred_on.localeCompare(a.occurred_on) || b.id.localeCompare(a.id)).slice(0, 3);
  const categoryName = (row: LancamentoFinanceiro) => isTransfer(row) ? "Transferência" : data.categories.find((item) => item.id === row.category_id)?.name ?? "Sem categoria";
  return <div className="finance-dashboard"><div className="finance-dashboard-main">
    <div className="finance-overview">
      <Card title="Patrimônio líquido" className="finance-card--cash"><dl className="finance-balances"><div><dt>Saldo nas contas</dt><dd><Money value={wealth.patrimonioCents} hidden={hidden} /></dd></div><div><dt>Dívida nos cartões</dt><dd><Money value={wealth.dividaCents} hidden={hidden} /></dd></div><div className="finance-available"><dt>Após descontar as dívidas</dt><dd><Money value={net} hidden={hidden} /></dd></div></dl><p className="finance-footnote">Posição atual das contas ativas · {civilLabel(today)}. Compras no cartão só saem da conta ao pagar a fatura.</p></Card>

    </div>
    {quickEntry}
    <div className="finance-month-analysis"><FinanceCompetenceChart transactions={rows} accounts={data.accounts} month={month} hidden={hidden} retry={retry} revealValues={revealValues} openTransactions={openTransactions} /><FinanceMonthlyLimit data={data} month={month} hidden={hidden} edit={edit} compact /></div>
    <Card title="Lançamentos recentes" className="finance-card--ledger" action={<Button onClick={() => openTab("lancamentos")}>Ver todos</Button>}>{recent.length ? <div className="finance-recent-wrap"><table className="finance-recent"><thead><tr><th scope="col">Lançamento</th><th scope="col">Data</th><th scope="col">Conta</th><th scope="col" className="finance-number">Valor</th><th scope="col"><span className="finance-sr">Ações</span></th></tr></thead><tbody>{recent.map((row) => <tr key={row.id}>
      <td><div className="finance-recent-title"><TransactionSymbol row={row} /><span><strong>{row.description}</strong><small>{categoryName(row)}</small></span></div></td>
      <td className="finance-muted">{civilLabel(row.occurred_on)}</td><td>{data.accounts.find((account) => account.id === row.account_id)?.name ?? "Conta indisponível"}</td>
      <td className="finance-number"><SignedMoney row={row} hidden={hidden} /></td>
      <td className="finance-row-action"><Button aria-label={`Detalhes de ${row.description}`} onClick={(event) => select(row, event.currentTarget)}><Icons.Dots /></Button></td></tr>)}</tbody></table></div>
      : <p className="finance-empty">Nenhum lançamento realizado nesta competência com os filtros atuais.</p>}</Card>
    </div><aside className="finance-dashboard-side" aria-label={goals ? "Metas e cartões" : "Seus cartões"}>{goals}<FinanceCardOverview data={data} month={month} hidden={hidden} edit={edit} openCard={openCard} allCards={() => openTab("cartoes")} /></aside>
    <details className="finance-details finance-extra-analysis"><summary>Análises e compromissos do mês</summary><div className="finance-trio">
      <Card title="Faturas a pagar" className="finance-card--due"><p className="finance-kpi"><Money value={totalAPagarEm(due)} hidden={hidden} /></p><p className="finance-note">Vencimentos em {financeMonthLabel(month)}.</p>
        {debts.length ? <ul className="finance-list">{debts.map((item) => <li key={`${item.cardId}-${item.mesFatura}`}><span><strong>{data.accounts.find((account) => account.id === item.cardId)?.name ?? "Cartão"}</strong><small>Vence {civilLabel(item.vence)}</small></span><Money value={item.openCents} hidden={hidden} /></li>)}</ul> : <p className="finance-note">Nenhuma fatura em aberto vence neste mês.</p>}
        {pending.length > 0 && <details className="finance-details"><summary>Pendências fora dos cartões</summary><ul className="finance-list">{pending.map((row) => <li key={row.id}><span>{row.description}<small>Vence {civilLabel(row.due_date!)} · ainda não realizada</small></span><Money value={row.amount_cents} hidden={hidden} /></li>)}</ul></details>}
      </Card>
      <Card title="Despesas por categoria"><figure className="finance-chart"><figcaption className="finance-note">Saídas realizadas na competência selecionada.</figcaption>{hidden ? <div className="finance-chart-hidden" role="img" aria-label="Distribuição com valores ocultos" /> : categoryTotals.length ? <svg viewBox="0 0 120 120" className="finance-donut" aria-hidden="true">{categoryTotals.map((item) => { const start = offset; offset += item.share * 100; return <circle key={item.categoryId ?? "none"} cx="60" cy="60" r="42" pathLength="100" fill="none" strokeWidth="12" strokeDasharray={`${item.share * 100} ${100 - item.share * 100}`} strokeDashoffset={-start} className={colorClass(item.colorKey)} />; })}</svg> : <p className="finance-empty">Nenhuma saída realizada neste recorte.</p>}
        <ul className="finance-list">{categoryTotals.map((item) => <li key={item.categoryId ?? "none"}><span><i className={`finance-dot ${colorClass(item.colorKey)}`} aria-hidden="true" />{item.name}</span><Money value={item.totalCents} hidden={hidden} /></li>)}</ul></figure></Card>
      <Card title="Resultado por competência"><figure className="finance-chart"><figcaption className="finance-note">Resultado nos últimos seis meses, até {financeMonthLabel(month)}. Sem lançamentos, o resultado é zero.</figcaption>{hidden ? <div className="finance-chart-hidden finance-chart-hidden--line" role="img" aria-label="Histórico com valores ocultos" /> : <svg className="finance-line" viewBox="0 0 200 90" aria-hidden="true"><line x1="10" y1="45" x2="190" y2="45" className="finance-line-zero" /><polyline points={points} fill="none" vectorEffect="non-scaling-stroke" /></svg>}<details className="finance-details"><summary>Ver resumo do gráfico</summary><dl className="finance-list">{history.map((item) => <div key={item.month}><dt>{financeMonthLabel(item.month)}</dt><dd><Money value={item.value} hidden={hidden} /></dd></div>)}</dl></details></figure></Card>
    </div></details>
  </div>;
}

export function FinanceMonthlyLimit({ data, month, hidden, edit, compact = false }: Pick<PanelProps, "data" | "month" | "hidden" | "edit"> & { compact?: boolean }) {
  const plan = planoDoMesFinanceiro(data.budgets, data.transactions, data.categories, month, data.accounts);
  const total = data.budgets.find(item => item.category_id === null && item.month === month);
  const ratio = plan.orcadoCents === null ? null : plan.usadoCents / plan.orcadoCents;
  const percent = ratio === null ? null : Math.round(ratio * 100);
  const band = ratio === null || ratio < 0.8 ? "normal" : ratio < 1 ? "atencao" : "limite";
  const action = <Button onClick={event => edit({ kind: "budget", ...(total ? { row: total } : { initialTotal: true }) }, event.currentTarget)}>{total ? "Ajustar limite" : "Definir limite total"}</Button>;
  const values = <p className="finance-budget-total"><strong><Money value={plan.usadoCents} hidden={hidden} /></strong><span>{plan.orcadoCents === null ? "Limite total não definido" : <>de <Money value={plan.orcadoCents} hidden={hidden} /></>}</span></p>;
  const progress = ratio !== null && (hidden ? <div className="finance-progress finance-progress--hidden" role="img" aria-label="Consumo com valores ocultos" /> : <div className={`finance-progress finance-progress--${band}`} role="progressbar" aria-label="Consumo do plano do mês" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.max(0, Math.min(100, percent!))} aria-valuetext={`${percent}% do plano`}><span style={{ width: `${Math.max(0, Math.min(100, ratio * 100))}%` }} /></div>);
  const caption = plan.disponivelCents !== null && <div className="finance-budget-caption"><span>{hidden ? "Uso oculto" : `${percent}% utilizado · ${band === "normal" ? "dentro do plano" : band === "atencao" ? "atenção a partir de 80%" : "limite atingido"}`}</span><span>{hidden ? "Disponível do plano: " : plan.disponivelCents < 0 ? "Acima do limite em " : "Ainda disponível: "}<Money value={Math.abs(plan.disponivelCents)} hidden={hidden} /></span></div>;
  const distribution = <details className="finance-details"><summary>Ver distribuição do limite</summary><dl className="finance-list"><div><dt>Alocado em categorias</dt><dd><Money value={plan.alocadoCents} hidden={hidden} /></dd></div><div><dt>{hidden ? "Diferença entre total e categorias" : plan.sobrealocado ? "Alocação acima do total" : "Ainda não alocado"}</dt><dd>{plan.reservaCents === null ? "Total não definido" : <Money value={Math.abs(plan.reservaCents)} hidden={hidden} />}</dd></div></dl><p className="finance-note">{hidden ? "Os valores e a situação da alocação ficam ocultos." : plan.sobrealocado ? "As categorias somam mais que o limite total. Você pode ajustar a distribuição; nenhum lançamento foi alterado." : "Categorias são limites independentes. Você pode defini-las mesmo sem um limite total."}</p></details>;
  if (compact) return <section className="finance-month-limit-compact" aria-label="Plano do mês">
    <div className="finance-month-limit-heading"><h2>Plano do mês</h2>{values}{ratio === null && action}</div>
    {ratio !== null && <div className="finance-month-limit-controls">{progress}{caption}{action}</div>}
    {distribution}
  </section>;
  return <Card title="Plano do mês" className="finance-card--budget" action={action}>
    <p className="finance-note">Limite total de {financeMonthLabel(month)}, independente das categorias. Consumo por competência, com estornos; planejados e pendentes não contam.</p>
    {values}{progress}{caption}{distribution}
  </Card>;
}

export function FinanceCardOverview({ data, month, hidden, edit, openCard, allCards, allCardsLabel = "Ver todos os cartões" }: Pick<PanelProps, "data" | "month" | "hidden" | "edit"> & { openCard(cardId: string, trigger: HTMLElement): void; allCards(): void; allCardsLabel?: string }) {
  const cards = data.accounts.filter((account) => account.kind === "credit_card" && account.archived_at === null);
  const statements = cards.map((card) => ({ card, invoice: faturaFinanceira(data.transactions, card, month) }));
  return <Card title="Meus cartões" className="finance-card-overview" action={<Button aria-label="Adicionar cartão" onClick={(event) => edit({ kind: "account", initialKind: "credit_card" }, event.currentTarget)}><Icons.Capture />Adicionar</Button>}>
    <p className="finance-note">Faturas de {financeMonthLabel(month)}.</p>
    {statements.length ? <ul className="finance-card-links">{statements.map(({ card, invoice }) => <li key={card.id}><button type="button" className="finance-card-link" aria-label={"Detalhes do cartão " + card.name} onClick={(event) => openCard(card.id, event.currentTarget)}>
      <span className={"finance-card-mark " + colorClass(card.color_key)} aria-hidden="true"><Icons.Wallet /></span>
      <span className="finance-card-link-name"><strong>{card.name}</strong><small>{hidden ? "Final oculto" : card.last_four ? "Final " + card.last_four : card.institution || "Cartão de crédito"}</small></span>
      <span className="finance-card-link-amount"><Money value={invoice.openCents} hidden={hidden} /><small>{card.payment_due_day !== null && card.statement_closing_day !== null ? "Vence " + civilLabel(vencimentoDaFatura(month, card.payment_due_day, card.statement_closing_day)) : "Ciclo não definido"}</small></span>
      <Icons.ChevronRight aria-hidden="true" />
    </button></li>)}</ul> : <p className="finance-empty">Adicione um cartão para acompanhar suas compras e faturas.</p>}
    <div className="finance-card-overview-total"><div><p className="finance-note">Em aberto nesta competência</p><strong><Money value={sumFinanceValues(statements.map(({ invoice }) => invoice.openCents))} hidden={hidden} /></strong></div><Button onClick={allCards}>{allCardsLabel}</Button></div>
  </Card>;
}

export function FinanceAccounts({ data, month, today, hidden, edit, history, openCard }: PanelProps & { openCard(cardId: string, trigger: HTMLElement): void }) {
  const app = useDemoApplication();
  const balances = saldosFinanceiros(data.transactions, data.accounts);
  const active = data.accounts.filter((account) => account.archived_at === null);
  const archived = data.accounts.filter((account) => account.archived_at !== null);
  return <div className="finance-tab-content"><div className="finance-section-heading"><h2>Contas e cartões</h2><Button onClick={(event) => edit({ kind: "account" }, event.currentTarget)}>Nova conta</Button></div><p className="finance-note">Saldos atuais consideram todo o histórico realizado. A fatura usa a competência selecionada.</p>
    {active.length === 0 ? <p className="finance-empty">Nenhuma conta cadastrada. Crie uma conta para começar.</p> : <div className="finance-account-grid">{active.map((account) => {
      const balance = balances.find((item) => item.account_id === account.id)!;
      const isCard = account.kind === "credit_card" && account.statement_closing_day !== null && account.payment_due_day !== null;
      const invoice = isCard ? faturaFinanceira(data.transactions, account, month) : null;
      const status = invoice ? statusDaFatura({ hoje: today, mesFatura: month, diaFechamento: account.statement_closing_day!, diaVencimento: account.payment_due_day!, resumo: invoice }) : null;
      return <section key={account.id} className={`finance-card ${isCard ? "finance-card--credit" : ""}`} aria-label={`Conta ${account.name}`}><div className="finance-section-heading"><h3><i className={`finance-dot ${colorClass(account.color_key)}`} aria-hidden="true" />{account.name}</h3><Button variant="ghost" aria-label={`Editar conta ${account.name}`} onClick={(event) => edit({ kind: "account", row: account }, event.currentTarget)}>Editar</Button></div><p className="finance-note">{ACCOUNT_KINDS[account.kind]}{account.institution && account.institution !== account.name ? ` · ${account.institution}` : ""}</p>
        <p className="finance-kpi"><Money value={isCard ? balance.debt_cents : balance.balance_cents} hidden={hidden} /></p><p className="finance-note">{isCard ? "Dívida atual do cartão" : "Saldo atual da conta"}</p>
        {invoice && <><div className="finance-cycle"><span>Fecha {civilLabel(fechamentoDaFatura(month, account.statement_closing_day!))}</span><span aria-hidden="true">→</span><span>Vence {civilLabel(vencimentoDaFatura(month, account.payment_due_day!, account.statement_closing_day!))}</span></div><p className="finance-note">Fatura de {financeMonthLabel(month)}</p><Badge>{hidden ? "Valores ocultos" : ROTULO_DO_STATUS_DA_FATURA[status!]}</Badge><dl className="finance-detail-list"><div><dt>Compras da fatura</dt><dd><Money value={invoice.totalCents} hidden={hidden} /></dd></div><div><dt>Pago na fatura</dt><dd><Money value={invoice.paidCents} hidden={hidden} /></dd></div><div><dt>Em aberto</dt><dd><Money value={invoice.openCents} hidden={hidden} /></dd></div><div><dt>Limite do cartão</dt><dd><Money value={account.credit_limit_cents ?? 0} hidden={hidden} /></dd></div><div><dt>Disponível agora</dt><dd><Money value={balance.available_cents ?? 0} hidden={hidden} /></dd></div></dl><p className="finance-note">Estado da fatura derivado em {civilLabel(today)}.{app.mode === "demo" ? " Pagamentos vinculados do exemplo já entram no cálculo." : " Os pagamentos registrados já entram no cálculo."}</p></>}
        <div className="finance-account-actions">{invoice && <><Button onClick={(event) => openCard(account.id, event.currentTarget)} aria-label={"Detalhes do cartão " + account.name}>Ver cartão</Button><Button onClick={(event) => edit({ kind: "statement", row: account }, event.currentTarget)} aria-label={"Pagar fatura de " + account.name}>Pagar fatura</Button></>}<Button variant="ghost" onClick={(event) => edit({ kind: "close-account", row: account }, event.currentTarget)} aria-label={"Arquivar conta " + account.name}>Arquivar</Button></div>
      </section>;
    })}</div>}
    {archived.length > 0 && <details className="finance-details"><summary>Contas arquivadas ({archived.length})</summary><ul className="finance-list">{archived.map((account) => <li key={account.id}><span><strong>{account.name}</strong><small>{ACCOUNT_KINDS[account.kind]} · histórico preservado</small></span><Button variant="ghost" aria-label={`Ver histórico de ${account.name}`} onClick={() => history(account.id)}>Ver histórico</Button></li>)}</ul></details>}
  </div>;
}
export function FinanceCategories({ data, month, hidden, edit }: PanelProps) {
  return <div className="finance-tab-content"><div className="finance-section-heading"><h2>Categorias financeiras</h2><Button onClick={(event) => edit({ kind: "category" }, event.currentTarget)}>Nova categoria</Button></div><p className="finance-note">Valores realizados em {financeMonthLabel(month)}. Categorias de despesa também recebem estornos.</p><div className="finance-account-grid">{(["expense", "income"] as const).map((kind) => {
    const categories = data.categories.filter((category) => category.kind === kind);
    return <Card title={kind === "expense" ? "Despesas" : "Receitas"} key={kind}>{categories.length ? <ul className="finance-list">{categories.map((category) => { const totals = totaisFinanceiros(data.transactions.filter((row) => row.category_id === category.id), data.accounts, [month]); return <li key={category.id}><span><strong><i className={`finance-dot ${colorClass(category.color_key)}`} aria-hidden="true" />{category.name}</strong><small>{totals.transactionCount} {totals.transactionCount === 1 ? "lançamento realizado" : "lançamentos realizados"}</small></span><div className="finance-list-end"><Money value={kind === "expense" ? totals.expenseCents : totals.incomeCents} hidden={hidden} /><Button variant="ghost" aria-label={`Editar categoria ${category.name}`} onClick={(event) => edit({ kind: "category", row: category }, event.currentTarget)}>Editar</Button></div></li>; })}</ul> : <p className="finance-empty">Ainda não há categorias de {kind === "expense" ? "despesa" : "receita"}.</p>}</Card>;
  })}</div><div className="finance-section-heading"><h2>Etiquetas financeiras</h2><Button onClick={(event) => edit({ kind: "tag" }, event.currentTarget)}>Nova etiqueta</Button></div><p className="finance-note">Etiquetas ajudam a encontrar lançamentos sem alterar sua categoria.</p>{data.tags?.length ? <ul className="finance-list">{data.tags.map((tag) => <li key={tag.id}><strong>{tag.name}</strong><Button variant="ghost" aria-label={`Editar etiqueta ${tag.name}`} onClick={(event) => edit({ kind: "tag", row: tag }, event.currentTarget)}>Editar</Button></li>)}</ul> : <p className="finance-empty">Ainda não há etiquetas. Crie uma para organizar seus lançamentos.</p>}</div>;
}
export function FinanceBudgets({ data, month, hidden, edit }: PanelProps) {
  const progress = progressoOrcamentosFinanceiros(data.budgets, data.transactions, data.categories, month, data.accounts);
  const planned = sumFinanceValues(progress.map((item) => item.budget.limit_cents));
  const spent = sumFinanceValues(progress.map((item) => item.spentCents));
  return <div className="finance-tab-content"><div className="finance-section-heading"><h2>Planejamento mensal</h2><Button onClick={(event) => edit({ kind: "budget" }, event.currentTarget)}>Novo orçamento</Button></div><div className="finance-month-plan"><FinanceMonthlyLimit data={data} month={month} hidden={hidden} edit={edit} /><Card title={`Orçamentos de ${financeMonthLabel(month)}`} className="finance-budget-distribution"><dl className="finance-metrics"><div><dt>Alocado em categorias</dt><dd><Money value={planned} hidden={hidden} /></dd></div><div><dt>Usado nas categorias</dt><dd><Money value={spent} hidden={hidden} /></dd></div><div><dt>Disponível nas categorias</dt><dd><Money value={sumFinanceValues([planned, -spent])} hidden={hidden} /></dd></div></dl><p className="finance-note">A soma das categorias não define o limite total. Estornos reduzem o gasto; planejados e pendentes não contam como usados.</p>
    {progress.length ? <div className="finance-budget-allocations">{progress.map((item) => <section className="finance-budget-allocation" key={item.budget.id} aria-label={`Orçamento ${item.categoryName}`}><h3>{item.categoryName}</h3><p className="finance-budget-value"><Money value={item.spentCents} hidden={hidden} /><span>de <Money value={item.budget.limit_cents} hidden={hidden} /></span></p>
      {hidden ? <div className="finance-progress finance-progress--hidden" role="img" aria-label="Consumo com valores ocultos" /> : <div className={`finance-progress finance-progress--${item.faixa}`} role="progressbar" aria-label={`Consumo de ${item.categoryName}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.max(0, Math.min(100, item.ratio * 100)))} aria-valuetext={`${Math.round(item.ratio * 100)}% do orçamento`}><span style={{ width: `${Math.max(0, Math.min(100, item.ratio * 100))}%` }} /></div>}
      <p className="finance-note">{hidden ? "Valores ocultos" : `${Math.round(item.ratio * 100)}% usado · ${item.faixa === "normal" ? "dentro do plano" : item.faixa === "atencao" ? "atenção a partir de 80%" : "limite atingido"}`}</p><Button variant="ghost" aria-label={`Editar orçamento ${item.categoryName}`} onClick={(event) => edit({ kind: "budget", row: item.budget }, event.currentTarget)}>Editar</Button></section>)}</div> : <p className="finance-empty">Nenhum orçamento neste mês. Defina um limite para uma categoria de despesa.</p>}
    </Card></div></div>;
}
