"use client";

import { useEffect, useId, useRef, useState } from "react";
import { linhaTemporalDaCompetencia, type ContaFinanceira, type LancamentoFinanceiro, type LinhaTemporalDaCompetencia } from "@/core/financeiro";
import { formatBRL } from "@/core/dinheiro";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { civilLabel, financeMonthLabel } from "./finance-model";
import "./finance-competence-chart.css";

interface CompetenceProps {
  transactions: readonly LancamentoFinanceiro[];
  accounts: readonly ContaFinanceira[];
  month: string;
  hidden: boolean;
  retry(): void;
  revealValues(): void;
  openTransactions(): void;
}

/** Presentation only: the Core owns competence, participation and every total. */
export function FinanceCompetenceChart({ transactions, accounts, month, hidden, retry, revealValues, openTransactions }: CompetenceProps) {
  const id = useId();
  const title = useRef<HTMLHeadingElement>(null), revealing = useRef(false);
  useEffect(() => {
    if (!hidden && revealing.current) {
      revealing.current = false;
      title.current?.focus();
    }
  }, [hidden]);
  let analysis: LinhaTemporalDaCompetencia;
  try {
    analysis = linhaTemporalDaCompetencia({ transactions, accounts, month });
  } catch {
    return <section className="finance-card finance-competence" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} ref={title} tabIndex={-1}>Entradas e despesas do mês</h2>
      <div className="finance-competence-state" role="alert"><p>Não foi possível calcular a análise deste mês. Recarregue os dados para tentar novamente.</p><Button onClick={retry}>Recarregar análise</Button></div>
    </section>;
  }
  const totals = analysis.points[analysis.points.length - 1]!;
  const sources = new Map(transactions.map(row => [row.id, row]));
  const names = new Map(accounts.map(account => [account.id, account.name]));
  const money = (value: number) => <span className="finance-money">{formatBRL(value, { hidden })}</span>;
  return <section className="finance-card finance-competence" aria-labelledby={`${id}-title`}>
    <div className="finance-competence-heading"><div><h2 id={`${id}-title`} ref={title} tabIndex={-1}>Entradas e despesas do mês</h2><p className="finance-note">{financeMonthLabel(analysis.month)} · por competência, com os filtros atuais.</p></div>
      {!hidden && <ul className="finance-competence-legend" aria-label="Séries do gráfico"><li><i className="finance-competence-income" aria-hidden="true" />Entradas</li><li><i className="finance-competence-expense" aria-hidden="true" />Despesas</li></ul>}
    </div>
    {hidden ? <div className="finance-competence-state finance-competence-mask"><Icons.EyeOff /><p>Gráfico e dados com valores ocultos.</p><Button onClick={() => { revealing.current = true; revealValues(); }}>Exibir valores da análise</Button></div>
      : totals.transactionCount === 0 ? <div className="finance-competence-state"><p>Nenhuma entrada ou despesa realizada nesta competência com os filtros atuais.</p><Button onClick={openTransactions}>Revisar lançamentos deste recorte</Button></div>
        : <><CompetenceLines analysis={analysis} /><p className="finance-note">Valores acumulados em reais. “Anteriores” reúne datas fora deste mês atribuídas a esta competência, antes do dia 1.</p></>}
    <dl className="finance-competence-totals"><div><dt>Entradas</dt><dd className={hidden ? undefined : "finance-income"}>{money(totals.incomeCents)}</dd></div><div><dt>Saídas</dt><dd>{money(totals.expenseCents)}</dd></div><div><dt>Resultado</dt><dd>{money(totals.balanceCents)}</dd></div></dl>
    {analysis.unassigned.length > 0 && <p className="finance-note">Há lançamentos sem competência neste recorte. Use a correção de competência acima para incluí-los na análise.</p>}
    <div className="finance-competence-foot"><p className="finance-note">Confirmados e conciliados. Compras no cartão contam na competência da fatura; transferências e pagamentos de fatura não duplicam entradas ou despesas. Esta análise não é o saldo das contas.</p><Button variant="ghost" onClick={openTransactions}>Ver lançamentos deste recorte<Icons.ChevronRight /></Button></div>
    {!hidden && <details className="finance-competence-details"><summary>Ver dados e cálculo</summary>
      <p className="finance-note">O Núcleo soma o valor integral dos lançamentos realizados por competência, inclusive pagamentos parciais. Planejados, pendentes, cancelados e itens na lixeira ficam fora. Resultado = entradas − despesas.</p>
      <div className="finance-competence-table" role="region" aria-label="Tabela de valores acumulados" tabIndex={0}><table><caption>Acumulado de {financeMonthLabel(analysis.month)}</caption><thead><tr><th scope="col">Dia da competência</th><th scope="col">Entradas</th><th scope="col">Despesas</th><th scope="col">Resultado</th></tr></thead><tbody>{analysis.points.map(point => <tr key={point.day ?? "initial"}><th scope="row">{point.day ? civilLabel(point.day) : point.label}</th><td>{formatBRL(point.incomeCents)}</td><td>{formatBRL(point.expenseCents)}</td><td>{formatBRL(point.balanceCents)}</td></tr>)}</tbody></table></div>
      <div className="finance-competence-table" role="region" aria-label="Tabela de lançamentos da análise" tabIndex={0}><table><caption>Lançamentos que compõem os totais</caption><thead><tr><th scope="col">Lançamento</th><th scope="col">Data original</th><th scope="col">Competência</th><th scope="col">Conta</th><th scope="col">Tipo</th><th scope="col">Valor</th></tr></thead><tbody>{analysis.rows.map(row => <tr key={row.id}><th scope="row">{sources.get(row.id)!.description}</th><td>{civilLabel(row.occurred_on)}</td><td>{financeMonthLabel(row.competence!)}</td><td>{names.get(row.account_id)}</td><td>{row.kind === "income" ? "Entrada" : "Despesa"}</td><td>{formatBRL(row.amount_cents)}</td></tr>)}</tbody></table></div>
      {analysis.rows.length === 0 && <p className="finance-note">Nenhum lançamento compõe os totais deste recorte.</p>}
    </details>}
  </section>;
}

function CompetenceLines({ analysis }: { analysis: LinhaTemporalDaCompetencia }) {
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const measure = () => setWidth(Math.max(200, element.getBoundingClientRect().width));
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  // Ratios below position pixels only; no financial aggregation is done here.
  const left = 48, right = width - 16, top = 18, bottom = 196;
  const initialGap = width < 400 ? 52 : 76;
  const maximum = Math.max(100, ...analysis.points.flatMap(point => [point.incomeCents, point.expenseCents]));
  const x = (index: number) => index === 0 ? left : left + initialGap + (index - 1) / (analysis.points.length - 2) * (right - left - initialGap);
  const y = (cents: number) => bottom - cents / maximum * (bottom - top);
  const line = (key: "incomeCents" | "expenseCents") => analysis.points.map((point, index) => `${x(index)},${y(point[key])}`).join(" ");
  const lastDay = analysis.points.length - 1;
  const ticks = width < 400 ? [1, 15, lastDay] : [1, 5, 10, 15, 20, 25, lastDay];
  const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
  return <div className="finance-competence-plot" ref={container}>
    <svg viewBox={`0 0 ${width} 240`} width="100%" height="240" aria-hidden="true" focusable="false">
      {[0, 0.5, 1].map(ratio => <g key={ratio}><line className="finance-competence-grid" x1={left} x2={right} y1={y(maximum * ratio)} y2={y(maximum * ratio)} /><text x={left - 8} y={y(maximum * ratio) + 4} textAnchor="end">{compact.format(maximum * ratio / 100)}</text></g>)}
      <line className="finance-competence-initial" x1={left + initialGap / 2} x2={left + initialGap / 2} y1={top} y2={bottom} />
      <polyline className="finance-competence-income" points={line("incomeCents")} fill="none" />
      <polyline className="finance-competence-expense" points={line("expenseCents")} fill="none" />
      {analysis.points.map((point, index) => <g key={point.day ?? "initial"}><circle className="finance-competence-income" cx={x(index)} cy={y(point.incomeCents)} r="2" /><circle className="finance-competence-expense" cx={x(index)} cy={y(point.expenseCents)} r="2" /></g>)}
      <text x={left} y="223" textAnchor="middle">Anteriores</text>
      {ticks.map(day => <text key={day} x={x(day)} y="223" textAnchor="middle">{day}</text>)}
    </svg>
  </div>;
}
