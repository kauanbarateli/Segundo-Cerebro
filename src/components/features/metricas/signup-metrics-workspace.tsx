'use client';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { METRIC_DIMENSIONS, parseMetricQuery, parseSignupMetrics, type MetricDimension, type MetricQuery, type SignupMetrics } from '@/core/acquisition/signup-metrics';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import './signup-metrics-workspace.css';

const labels: Record<MetricDimension,string>={utm_source:'Origem',utm_medium:'Meio',utm_campaign:'Campanha',utm_term:'Termo',utm_content:'Conteúdo'};
function defaultQuery(): MetricQuery {
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Fortaleza',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const part=(name:string)=>parts.find(item=>item.type===name)?.value;
 const date=`${part('year')}-${part('month')}-${part('day')}`;
 const start=new Date(`${date}T00:00:00Z`); start.setUTCDate(start.getUTCDate()-29);
 return {start:start.toISOString().slice(0,10),end:date,zone:'America/Fortaleza',bucket:'day'};
}
const displayDate=(date:string)=>new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short',timeZone:'UTC'}).format(new Date(`${date}T00:00:00Z`));
export function SignupMetricsWorkspace({userId}:{userId:string}) {
 const [draft,setDraft]=useState<MetricQuery>(defaultQuery), [data,setData]=useState<SignupMetrics|null>(null), [loading,setLoading]=useState(true), [error,setError]=useState(''), [dimension,setDimension]=useState<MetricDimension>('utm_source');
 const [owner,setOwner]=useState(userId);
 const generation=useRef(0);
 const load=useCallback(async (query:MetricQuery)=>{
  const id=++generation.current; setOwner(userId); setLoading(true); setError(''); setData(null);
  try {
   const response=await fetch(`/api/signup-metrics?${new URLSearchParams(query)}`,{cache:'no-store',headers:{'x-expected-user-id':userId}});
   const body:unknown=await response.json();
   const result=body && typeof body==='object' && 'result' in body ? parseSignupMetrics(body.result,query):null;
   if(!response.ok || !result) throw new Error('unavailable');
   if(id===generation.current) setData(result);
  } catch { if(id===generation.current) setError('Não foi possível carregar as métricas. Tente novamente.'); }
  finally { if(id===generation.current) setLoading(false); }
 },[userId]);
 useEffect(()=>{ const current=generation; const initial=defaultQuery(); setDraft(initial); void load(initial); return ()=>{current.current++;}; },[load]);
 function submit(event:FormEvent<HTMLFormElement>) {
  event.preventDefault(); const query=parseMetricQuery(new URLSearchParams(draft));
  if(!query) { setError('Escolha um período válido de até 366 dias.'); return; }
  void load(query);
 }
 const max=Math.max(1,...(data?.series.map(row=>row.count)??[]));
 return <div className="signup-metrics">
  <form className="signup-metrics__filters" onSubmit={submit}>
   <Field label="De" type="date" required value={draft.start} onChange={event=>setDraft({...draft,start:event.target.value})}/>
   <Field label="Até" type="date" required value={draft.end} onChange={event=>setDraft({...draft,end:event.target.value})}/>
   <Field as="select" label="Agrupar por" value={draft.bucket} onChange={event=>setDraft({...draft,bucket:event.target.value as MetricQuery['bucket']})}><option value="day">Dia</option><option value="week">Semana</option><option value="month">Mês</option></Field>
   <Button type="submit" variant="primary">Aplicar período</Button>
  </form>
  <p className="signup-metrics__note">Fuso: Fortaleza · até 366 dias por consulta.</p>
  {loading || owner!==userId ? <p role="status">Carregando métricas…</p> : error ? <div role="alert"><p>{error}</p><Button onClick={()=>void load(draft)}>Tentar novamente</Button></div> : data && <>
   <div className="signup-metrics__summary"><section><p>Cadastros públicos no período</p><strong>{data.totalPublic.toLocaleString('pt-BR')}</strong></section><section><p>Contas existentes agora</p><strong>{data.stock.total.toLocaleString('pt-BR')}</strong><small>Legadas {data.stock.legacy} · Admin {data.stock.admin} · Públicas {data.stock.public} · Não classificadas {data.stock.unclassified}</small></section></div>
   <section className="signup-metrics__panel" aria-labelledby="metrics-series-title"><h2 id="metrics-series-title">Cadastros ao longo do tempo</h2>
    {data.totalPublic===0 ? <p>Nenhum cadastro público concluído neste período.</p> : <ol className="signup-metrics__series">{data.series.map(row=><li key={row.period}><span>{displayDate(row.period)}</span><span className="signup-metrics__bar"><i style={{width:`${row.count/max*100}%`}} /></span><strong>{row.count}</strong></li>)}</ol>}
   </section>
   <section className="signup-metrics__panel" aria-labelledby="metrics-origin-title"><div className="signup-metrics__panel-heading"><div><h2 id="metrics-origin-title">Origem informada</h2><p>Dados opcionais, mantidos por até 12 meses.</p></div><Field as="select" label="Dimensão" value={dimension} onChange={event=>setDimension(event.target.value as MetricDimension)}>{METRIC_DIMENSIONS.map(key=><option key={key} value={key}>{labels[key]}</option>)}</Field></div>
    {data.totalPublic===0 ? <p>Sem origens para apresentar neste período.</p> : <ul className="signup-metrics__origins">{data.distributions[dimension].map(row=><li key={`${row.kind}:${row.value ?? ''}`}><span>{row.kind==='other'?'Outros':row.kind==='not-informed'?'Não informada':row.value}</span><strong>{row.count}</strong></li>)}</ul>}
    <p className="signup-metrics__note">Grupos com menos de cinco cadastros e resultados além dos 100 maiores aparecem em Outros. Ausência não significa tráfego direto; agrupamentos não garantem anonimato.</p>
   </section>
  </>}
 </div>;
}
