import {describe,expect,it} from 'vitest';
import {assertSeriesOccurrenceBinding,seriesOccurrenceEligibility,validateSeriesRealization} from '../../src/core/financeiro/series';
import {managedSeries,managedOccurrence,seriesAccount,seriesId,SERIES_NOW} from '../fixtures/finance-series';

describe('T053-B1: elegibilidade de pausa/retomada/edição futura',()=>{
 it('exceção de paid_cents do cartão planned não significa pagamento real',()=>{
  const series=managedSeries(),{occurrence,row}=managedOccurrence(series),card={...seriesAccount,kind:'credit_card' as const,statement_closing_day:20,payment_due_day:5};
  expect(seriesOccurrenceEligibility(series,occurrence,{...row,paid_cents:row.amount_cents},card,{action:'pause',today:row.occurred_on,from_on:row.occurred_on})).toEqual({allowed:true,reason:'eligible'});
  expect(seriesOccurrenceEligibility(series,occurrence,{...row,status:'confirmed',paid_cents:row.amount_cents},card,{action:'pause',today:row.occurred_on,from_on:row.occurred_on})).toMatchObject({allowed:false,reason:'recorded'});
 });
 it.each([{status:'planned' as const,paid_cents:1,reason:'paid_or_partial'},{status:'confirmed' as const,paid_cents:0,reason:'recorded'},{status:'reconciled' as const,paid_cents:10000,reason:'recorded'},{status:'cancelled' as const,paid_cents:0,reason:'cancelled'}])('conserva %j',patch=>{
  const series=managedSeries(),{occurrence,row}=managedOccurrence(series);
  expect(seriesOccurrenceEligibility(series,occurrence,{...row,status:patch.status,paid_cents:patch.paid_cents},seriesAccount,{action:'update_future',today:row.occurred_on,from_on:row.occurred_on})).toEqual({allowed:false,reason:patch.reason});
 });
 it('retoma somente supressão da própria série, nunca exclusão manual ou término',()=>{
  const series=managedSeries({state:'paused'}),{occurrence,row}=managedOccurrence(series);const deleted={...row,deleted_at:SERIES_NOW};
  for(const suppression of ['none','manual','ended'] as const){
   const target={...occurrence,suppression};const targetRow=suppression==='none'?row:deleted;
   expect(seriesOccurrenceEligibility(series,target,targetRow,seriesAccount,{action:'resume',today:row.occurred_on,from_on:row.occurred_on})).toMatchObject({allowed:false,reason:'not_paused_by_series'});
  }
  expect(seriesOccurrenceEligibility(series,{...occurrence,suppression:'series_pause'},deleted,seriesAccount,{action:'resume',today:row.occurred_on,from_on:row.occurred_on})).toEqual({allowed:true,reason:'eligible'});
  expect(seriesOccurrenceEligibility(series,{...occurrence,suppression:'series_pause'},deleted,seriesAccount,{action:'end',today:row.occurred_on,from_on:row.occurred_on}).allowed).toBe(true);
 });
 it('não retoma uma ocorrência que passou durante a pausa',()=>{
  const series=managedSeries({state:'paused'}),{occurrence,row}=managedOccurrence(series);
  expect(seriesOccurrenceEligibility(series,{...occurrence,suppression:'series_pause'},{...row,deleted_at:SERIES_NOW},seriesAccount,{action:'resume',today:'2026-10-24',from_on:'2026-10-24'})).toEqual({allowed:false,reason:'before_boundary'});
 });
 it('recusa dono, grupo, índice, data, conta, exclusão ou transferência adulterados',()=>{
  const series=managedSeries(),{occurrence,row}=managedOccurrence(series);
  for(const patch of [{user_id:seriesId(999)},{installment_group_id:seriesId(999)},{installment_no:2},{occurred_on:'2026-10-24'},{account_id:seriesId(999)},{deleted_at:SERIES_NOW},{transfer_group_id:seriesId(999)}])expect(()=>assertSeriesOccurrenceBinding(series,occurrence,{...row,...patch},seriesAccount)).toThrow();
 });
 it('estado encerrado não volta a ativo por elegibilidade e pausa exige série ativa',()=>{
  const series=managedSeries({state:'ended'}),{occurrence,row}=managedOccurrence(series);
  expect(seriesOccurrenceEligibility(series,occurrence,row,seriesAccount,{action:'resume',today:row.occurred_on,from_on:row.occurred_on})).toMatchObject({reason:'series_ended',allowed:false});
  expect(seriesOccurrenceEligibility({...series,state:'paused'},occurrence,row,seriesAccount,{action:'pause',today:row.occurred_on,from_on:row.occurred_on})).toMatchObject({reason:'series_not_active',allowed:false});
 });
 it('realização é explícita, não reduz parcial e não paga fatura automaticamente',()=>{
  const series=managedSeries(),{occurrence,row}=managedOccurrence(series);
  expect(()=>validateSeriesRealization(series,occurrence,{...row,paid_cents:500},seriesAccount,{status:'confirmed',paid_cents:499})).toThrow();
  expect(()=>validateSeriesRealization(series,occurrence,{...row,paid_cents:500},seriesAccount,{status:'confirmed',paid_cents:10000})).not.toThrow();
  expect(()=>validateSeriesRealization(series,occurrence,row,seriesAccount,{status:'confirmed',paid_cents:10001})).toThrow();
  const card={...seriesAccount,kind:'credit_card' as const};
  expect(()=>validateSeriesRealization(series,occurrence,{...row,paid_cents:10000},card,{status:'confirmed',paid_cents:0})).toThrow();
 });
});
