"use client";
import { useState, type CSSProperties } from "react";
import { desempenhoDoHabito, desempenhoDosHabitos, segundaDaSemana, somarDias } from "@/core/habitos";
import { instanteValido } from "@/core/contracts/base";
import type { HabitoDoUsuario, PausaDoUsuario } from "@/core/contracts";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Icons } from "@/components/ui/icons";

const label = (day: string) => new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
const weekday = (day: string) => new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
function monthStart(day: string, offset = 0) { const date = new Date(`${day.slice(0, 7)}-01T12:00:00Z`); date.setUTCMonth(date.getUTCMonth() + offset); return date.toISOString().slice(0, 10); }
export function HabitPerformance({ habits, marks, pauses, today, archivedIndividual = false }: { habits: HabitoDoUsuario[]; marks: Map<string, Set<string>>; pauses: PausaDoUsuario[]; today: string; archivedIndividual?: boolean }) {
  const [mode, setMode] = useState<"week" | "month">("month"), [anchor, setAnchor] = useState(today);
  const from = mode === "week" ? segundaDaSemana(anchor) : monthStart(anchor);
  const through = mode === "week" ? somarDias(from, 6) : somarDias(monthStart(anchor, 1), -1);
  const active = desempenhoDosHabitos(habits, marks, from, through, today, pauses);
  const individual = archivedIndividual && habits.length === 1 ? desempenhoDoHabito(habits[0]!, marks.get(habits[0]!.id) ?? new Set(), from, through, today, pauses) : null;
  const result = individual ? { ...individual, porHabito: [individual] } : active;
  const max = Math.max(1, ...result.dias.map(day => day.registros));
  const ticks = max <= 5 ? Array.from({ length: max + 1 }, (_, n) => n) : [0, Math.floor(max / 2), max];
  const earliest = habits.reduce((day, habit) => habit.started_on < day ? habit.started_on : day, today);
  const next = mode === "week" ? somarDias(from, 7) : monthStart(anchor, 1);
  function move(delta: number) { setAnchor(mode === "week" ? somarDias(from, delta * 7) : monthStart(anchor, delta)); }
  function choose(value: string) {
    const day = mode === "month" ? `${value}-01` : value;
    if (/^\d{4}-\d{2}-\d{2}$/.test(day) && instanteValido(`${day}T00:00:00Z`) && day <= today) setAnchor(day);
  }
  return <section className="habits-panel habits-performance" aria-labelledby="habits-performance-title">
    <header className="habits-panel-head habits-performance-head"><h2 id="habits-performance-title">Desempenho</h2><div className="habits-performance-tools">
      <div className="habits-segment" role="group" aria-label="Visão do desempenho"><Button aria-pressed={mode === "week"} onClick={() => setMode("week")}>Semana</Button><Button aria-pressed={mode === "month"} onClick={() => setMode("month")}>Mês</Button></div>
      <Field type={mode === "month" ? "month" : "date"} label={mode === "month" ? "Mês do desempenho" : "Data da semana"} visuallyHiddenLabel value={mode === "month" ? anchor.slice(0, 7) : anchor} max={mode === "month" ? today.slice(0, 7) : today} onChange={event => choose(event.target.value)} />
      <div className="habits-actions"><Button aria-label="Período anterior" disabled={from <= earliest} onClick={() => move(-1)}><Icons.ChevronLeft /></Button><Button aria-label="Próximo período" disabled={next > today} onClick={() => move(1)}><Icons.ChevronRight /></Button></div>
    </div></header>
    <div className="habits-performance-body"><div className="habits-chart"><div className="habits-chart-heading"><div><h3>Registros {mode === "month" ? "no mês" : "na semana"}</h3><p>{result.registros} {result.registros === 1 ? "registro" : "registros"}</p></div><span>Até {label(through < today ? through : today)}</span></div>
      <div className="habits-chart-visual" role="img" aria-label={`${result.registros} registros de ${label(from)} a ${label(through)}. Valores diários disponíveis abaixo.`}>
        <div className="habits-chart-axis" aria-hidden="true">{ticks.map(n => <span key={n} style={{ bottom: `${100 * n / max}%` }}>{n}</span>)}</div>
        <div className="habits-bars" aria-hidden="true" style={{ "--habit-columns": result.dias.length } as CSSProperties}>{result.dias.map((day, index) => <div className={`habits-bar-slot${day.futuro ? " is-future" : ""}${day.day === today ? " is-today" : ""}`} key={day.day} title={`${label(day.day)}: ${day.futuro ? "Data futura" : `${day.registros} registros`}`}><div className="habits-bar-track"><span style={{ blockSize: `${100 * day.registros / max}%` }} /></div><span className="habits-bar-date">{mode === "week" ? weekday(day.day) : index === 0 || (index + 1) % 5 === 0 && index < result.dias.length - 3 || index === result.dias.length - 1 ? day.day.slice(8) : ""}</span></div>)}</div>
      </div>
      <details className="habits-chart-data"><summary>Ver registros por dia</summary><div className="habits-data-scroll" role="region" tabIndex={0} aria-label="Dados do gráfico"><table><caption>Registros do período</caption><thead><tr><th scope="col">Data</th><th scope="col">Registros</th></tr></thead><tbody>{result.dias.map(day => <tr key={day.day}><th scope="row">{label(day.day)}</th><td>{day.futuro ? "Data futura" : day.registros}</td></tr>)}</tbody></table></div></details>
    </div><div className="habits-consistency"><h3>Consistência {mode === "month" ? "no mês" : "na semana"}</h3><p className="habits-score"><strong>{result.taxa === null ? "—" : `${result.taxa}%`}</strong><span>{result.esperados ? `${result.cumpridos} de ${result.esperados} práticas previstas` : "Sem práticas previstas neste período"}</span></p>
      <div className="habits-breakdown">{result.porHabito.map(row => <div key={row.habit_id}><span>{habits.find(habit => habit.id === row.habit_id)?.name}</span><progress max={Math.max(1, row.esperados)} value={row.cumpridos} aria-label={`${habits.find(habit => habit.id === row.habit_id)?.name}: ${row.cumpridos} de ${row.esperados} práticas previstas`} /><span>{row.cumpridos} / {row.esperados}</span></div>)}</div>
      <details className="habits-method"><summary>Como é calculado?</summary><p>As barras mostram os registros reais. A consistência considera cadências e pausas conhecidas até hoje, limitada à expectativa de cada semana e vigência. Uma marca preservada conta uma vez no seu grupo, até esse limite. Meta semanal usa o menor valor entre a meta e os dias disponíveis no recorte. As razões são somadas antes do percentual.</p><p>Arquivo e restauração não permitem reconstruir períodos antigos de atividade. Sequências usam dias elegíveis ou semanas e reiniciam quando a unidade muda; são uma métrica diferente.</p></details>
    </div></div>
  </section>;
}
