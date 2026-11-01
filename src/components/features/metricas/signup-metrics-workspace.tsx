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
 const [identityClosed,setIdentityClosed]=useState(false);
 const generation=useRef(0), closed=useRef(false), currentQuery=useRef<MetricQuery>(defaultQuery());
 const closeIdentity=useCallback(()=>{
  closed.current=true;generation.current++;setIdentityClosed(true);setData(null);setLoading(false);setError('');
 },[]);
 const load=useCallback(async (query:MetricQuery,verifying=false)=>{
  if(closed.current&&!verifying)return;
  const id=++generation.current; setOwner(userId); setLoading(true); setError(''); setData(null);
  try {
   const response=await fetch(`/api/signup-metrics?${new URLSearchParams(query)}`,{cache:'no-store',signal:AbortSignal.timeout(20_000),headers:{'x-expected-user-id':userId}});
   if([401,403,409].includes(response.status)){if(id===generation.current)closeIdentity();return;}
   const body:unknown=await response.json();
   const envelope=body && typeof body==='object' && !Array.isArray(body) ? body as Record<string,unknown> : null;
   const result=envelope && Object.keys(envelope).sort().join(',')==='ok,result' && envelope.ok===true ? parseSignupMetrics(envelope.result,query):null;
   if(!response.ok || !result) throw new Error('unavailable');
   if(id===generation.current) {if(verifying){closed.current=false;setIdentityClosed(false);}setData(result);}
  } catch { if(id===generation.current) setError('Não foi possível carregar as métricas. Tente novamente.'); }
  finally { if(id===generation.current) setLoading(false); }
 },[closeIdentity,userId]);
 useEffect(()=>{ const current=generation; const initial=defaultQuery(); currentQuery.current=initial;setDraft(initial); void load(initial); return ()=>{current.current++;}; },[load]);
 useEffect(()=>{
  const verifyOnReturn=()=>{if(document.visibilityState!=='visible')return;closeIdentity();void load(currentQuery.current,true);};
  window.addEventListener('focus',verifyOnReturn);document.addEventListener('visibilitychange',verifyOnReturn);
  return ()=>{window.removeEventListener('focus',verifyOnReturn);document.removeEventListener('visibilitychange',verifyOnReturn);};
 },[closeIdentity,load]);
 function loadDraft() {
  const query=parseMetricQuery(new URLSearchParams(draft));
  if(!query) { setError('Escolha um período válido de até 366 dias.'); return; }
  currentQuery.current=query;void load(query);
 }
 function submit(event:FormEvent<HTMLFormElement>) { event.preventDefault();loadDraft(); }
 if(identityClosed)return <div className="signup-metrics__panel" role="alert">
  <h2>Confirme sua conta</h2><p>Não foi possível confirmar o acesso às métricas. Entre na conta Master em outra aba e volte para verificar a sessão aqui.</p>
  <a href="/entrar" target="_blank" rel="noopener noreferrer">Entrar em outra aba</a>
  <Button onClick={()=>void load(currentQuery.current,true)} disabled={loading}>{loading?'Verificando…':'Verificar sessão'}</Button>
  {error && <p>Não foi possível verificar agora. Tente novamente.</p>}
 </div>;
 const max=Math.max(1,...(data?.series.map(row=>row.count)??[]));
 return <div className="signup-metrics">
  <form className="signup-metrics__filters" onSubmit={submit}>
   <Field label="De" type="date" required value={draft.start} onChange={event=>setDraft({...draft,start:event.target.value})}/>
   <Field label="Até" type="date" required value={draft.end} onChange={event=>setDraft({...draft,end:event.target.value})}/>
   <Field as="select" label="Agrupar por" value={draft.bucket} onChange={event=>setDraft({...draft,bucket:event.target.value as MetricQuery['bucket']})}><option value="day">Dia</option><option value="week">Semana</option><option value="month">Mês</option></Field>
   <Button type="submit" variant="primary">Aplicar período</Button>
  </form>
  <p className="signup-metrics__note">Fuso: Fortaleza · até 366 dias por consulta.</p>
  {loading || owner!==userId ? <p role="status">Carregando métricas…</p> : error ? <div role="alert"><p>{error}</p><Button onClick={loadDraft}>Tentar novamente</Button></div> : data && <>
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
