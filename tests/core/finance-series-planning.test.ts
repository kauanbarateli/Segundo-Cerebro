import {describe,expect,it} from 'vitest';
import {planSeriesMaterialization,type ManagedFinanceSeries,type SeriesHorizon,type SeriesStatementAssignment} from '../../src/core/financeiro/series';
import {managedSeries,managedOccurrence,seriesAccount,seriesCategory,seriesId} from '../fixtures/finance-series';

function plan(series:ManagedFinanceSeries,options:{horizon?:SeriesHorizon;statement_assignments?:SeriesStatementAssignment[];account?:typeof seriesAccount;existing?:ReturnType<typeof managedOccurrence>['occurrence'][]}={}){
 return planSeriesMaterialization({series,account:options.account??seriesAccount,categories:[seriesCategory],tags:[],existing:options.existing??[],horizon:options.horizon??{from_on:'2026-10-23',until_exclusive:'2027-10-23'},today:'2026-10-23',statement_assignments:options.statement_assignments??[]});
}
describe('T053-B1: materialização finita pura',()=>{
 it('prepara12 mensais, mantém status planned e não gera IDs/efeitos',()=>{
  const series=managedSeries(),before=structuredClone(series),result=plan(series);
  expect(result.occurrences).toHaveLength(12);expect(result.occurrences[0]).toMatchObject({index:1,occurred_on:'2026-10-23',status:'planned',paid_cents:0,statement_month:null});
  expect(result.occurrences.at(-1)!.occurred_on).toBe('2027-09-23');expect(result.next_index).toBe(13);expect(result.exhausted).toBe(true);expect(series).toEqual(before);
  expect(result.occurrences.every(row=>!Object.hasOwn(row,'id')&&!Object.hasOwn(row,'user_id'))).toBe(true);
 });
 it('semanal tem horizonte finito e anual materializa uma posição por doze meses',()=>{
  const weekly=plan(managedSeries({frequency:'weekly',total:120}));expect(weekly.occurrences).toHaveLength(53);expect(weekly.next_index).toBe(54);expect(weekly.exhausted).toBe(false);
  const annual=plan(managedSeries({frequency:'yearly',total:12}));expect(annual.occurrences).toHaveLength(1);expect(annual.next_index).toBe(2);expect(annual.exhausted).toBe(false);
 });
 it('parcela atual5 não inventa1…4 pagas; resto continua na12ª parcela original',()=>{
  const base=managedSeries(),series=managedSeries({kind:'parcelamento',first_index:5,next_index:5,template:{...base.template,amount_cents:10000}}),result=plan(series);
  expect(result.occurrences.map(row=>row.index)).toEqual([5,6,7,8,9,10,11,12]);expect(result.occurrences[0]!.occurred_on).toBe(series.anchor_on);
  expect(result.occurrences.slice(0,-1).every(row=>row.amount_cents===833&&row.paid_cents===0&&row.status==='planned')).toBe(true);expect(result.occurrences.at(-1)!.amount_cents).toBe(837);
 });
 it('datas puladas antes da fronteira não viram passado pago; o término limita a geração',()=>{
  const series=managedSeries({anchor_on:'2026-01-23',ends_on:'2026-12-23'}),result=plan(series);
  expect(result.skipped_before_horizon).toEqual([1,2,3,4,5,6,7,8,9]);expect(result.occurrences.map(row=>row.index)).toEqual([10,11,12]);expect(result.occurrences.every(row=>row.paid_cents===0)).toBe(true);
 });
 it('mapas existentes, incluindo exclusão manual, nunca ganham nova ocorrência',()=>{
  const series=managedSeries(),{occurrence}=managedOccurrence(series);const manual={...occurrence,suppression:'manual' as const};
  const result=plan(series,{existing:[manual]});expect(result.already_materialized).toEqual([1]);expect(result.occurrences.map(row=>row.index)).not.toContain(1);expect(manual.suppression).toBe('manual');
  expect(()=>plan(series,{existing:[manual,{...manual,id:seriesId(999)}]})).toThrow();
 });
 it('cartão semanal usa data e fechamento, sem deslocar competência por índice',()=>{
  const base=managedSeries(),series=managedSeries({frequency:'weekly',template:{...base.template,statement_mode:'account_cycle'}}),card={...seriesAccount,kind:'credit_card' as const,statement_closing_day:28,payment_due_day:5};
  const result=plan(series,{account:card,horizon:{from_on:'2026-10-23',until_exclusive:'2026-11-15'}});
  expect(result.occurrences.map(row=>row.statement_month)).toEqual(['2026-10-01','2026-11-01','2026-11-01','2026-11-01']);
  expect(result.occurrences.every(row=>row.paid_cents===row.amount_cents&&row.status==='planned')).toBe(true);
 });
 it('cartão anual não salta doze faturas pelo número da parcela e aceita decisão explícita',()=>{
  const base=managedSeries(),series=managedSeries({frequency:'yearly',first_index:5,next_index:5,template:{...base.template,statement_mode:'explicit'}}),card={...seriesAccount,kind:'credit_card' as const,statement_closing_day:20,payment_due_day:5};
  expect(()=>plan(series,{account:card})).toThrow('Confirme a competência');
  const result=plan(series,{account:card,statement_assignments:[{index:5,statement_month:'2026-12-01'}]});expect(result.occurrences).toHaveLength(1);expect(result.occurrences[0]!.statement_month).toBe('2026-12-01');
  expect(()=>plan(series,{account:card,statement_assignments:[{index:5,statement_month:'2026-12-01'},{index:6,statement_month:'2027-12-01'}]})).toThrow();
 });
 it('recusa série inativa, cursor inválido, conta arquivada/alheia, categoria e etiqueta alheias',()=>{
  const series=managedSeries();expect(()=>plan({...series,state:'paused'})).toThrow();expect(()=>plan({...series,next_index:0})).toThrow();
  expect(()=>plan(series,{account:{...seriesAccount,user_id:seriesId(999)}})).toThrow();expect(()=>plan(series,{account:{...seriesAccount,archived_at:'2026-10-23T12:00:00.000Z'}})).toThrow();
  expect(()=>plan({...series,template:{...series.template,category_id:seriesId(999)}})).toThrow();expect(()=>plan({...series,template:{...series.template,tag_ids:[seriesId(999)]}})).toThrow();
 });
 it('contador/esgotamento não dependem de leitura para criar novas linhas',()=>{
  const series=managedSeries({next_index:13});const result=plan(series);expect(result.occurrences).toEqual([]);expect(result.next_index).toBe(13);expect(result.exhausted).toBe(true);
 });
 it('cortar e estender término conserva o primeiro ordinal futuro e nunca regenera mapas existentes',()=>{
  const cut=managedSeries({total:24,ends_on:'2026-12-23'}),first=plan(cut);
  expect(first.occurrences.map(row=>row.index)).toEqual([1,2,3]);expect(first.next_index).toBe(4);expect(first.exhausted).toBe(true);
  const existing=[1,2,3].map(index=>managedOccurrence(cut,index).occurrence);
  const extended={...cut,ends_on:null,next_index:first.next_index,materialized_through:'2026-12-23'};
  const next=plan(extended,{existing,horizon:{from_on:'2027-01-23',until_exclusive:'2028-01-23'}});
  expect(next.occurrences.map(row=>row.index)).toEqual([4,5,6,7,8,9,10,11,12,13,14,15]);expect(next.next_index).toBe(16);
  const all=Array.from({length:15},(_,offset)=>managedOccurrence(extended,offset+1).occurrence);
  const replay=plan({...extended,next_index:16,materialized_through:'2027-12-23'},{existing:all,horizon:{from_on:'2027-01-23',until_exclusive:'2028-01-23'}});
  expect(replay.occurrences).toEqual([]);expect(replay.next_index).toBe(16);expect(new Set(all.map(row=>row.transaction_id)).size).toBe(15);
 });
});
