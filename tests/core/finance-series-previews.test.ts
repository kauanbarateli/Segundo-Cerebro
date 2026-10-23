import {describe,expect,it} from 'vitest';
import {previewSeriesResume} from '../../src/core/financeiro/series/series-previews';
import {managedSeries,managedOccurrence,seriesAccount,seriesCategory,SERIES_NOW} from '../fixtures/finance-series';
function prepared():Parameters<typeof previewSeriesResume>[0]{
 const series=managedSeries({state:'paused',revision:'1',next_index:13,materialized_through:'2027-09-23'});
 const bindings=Array.from({length:12},(_,index)=>{const {occurrence,row}=managedOccurrence(series,index+1);return {occurrence:{...occurrence,configuration_revision:'0',suppression:'series_pause' as const},row:{...row,deleted_at:SERIES_NOW},account:structuredClone(seriesAccount)};});
 return {series,bindings,account:seriesAccount,categories:[seriesCategory],tags:[],today:'2026-10-23',horizon:{from_on:'2026-10-23',until_exclusive:'2026-11-23'},statement_assignments:[]};
}
describe('T053-B2: prévia de retomada não promete só a janela de novas criações',()=>{
 it('discrimina12 reexibições até setembro de2027 e zero novas em horizonte de um mês',()=>{
  const input=prepared(),before=structuredClone(input),preview=previewSeriesResume(input);
  expect(preview.summary).toEqual({expected_revision:'1',reactivated_count:12,reactivated_through:'2027-09-23',new_count:0,new_through:null,skipped:0});expect(input).toEqual(before);
 });
 it('não conta excluída manual, parcial nem ocorrência que passou durante a pausa',()=>{
  const input=prepared();input.bindings[0]!.occurrence.suppression='manual';input.bindings[1]!.row.paid_cents=100;
  input.today='2027-01-23';input.horizon={from_on:'2027-01-23',until_exclusive:'2027-02-23'};
  const preview=previewSeriesResume(input);expect(preview.summary.reactivated_count).toBe(9);expect(preview.restore.every(item=>item.row.occurred_on>='2027-01-23')).toBe(true);expect(preview.summary.new_count).toBe(0);
 });
 it('conta arquivada em ocorrência a reexibir impede a operação antes de qualquer efeito',()=>{
  const input=prepared();input.bindings[0]!.account.archived_at=SERIES_NOW;expect(()=>previewSeriesResume(input)).toThrow('Revise a conta');
 });
});
