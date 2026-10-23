import {exigir} from '../../contracts/base';
import type {ContaFinanceira,CategoriaFinanceira,EtiquetaFinanceira,LancamentoFinanceiro} from '../fused';
import {assertSeriesOccurrenceBinding,seriesOccurrenceEligibility} from './series-policy';
import {planSeriesMaterialization} from './series-planning';
import type {ManagedFinanceSeries,ManagedSeriesOccurrence,SeriesHorizon,SeriesStatementAssignment} from './series-types';
export interface BoundSeriesOccurrence {occurrence:ManagedSeriesOccurrence;row:LancamentoFinanceiro;account:ContaFinanceira}
/** Both preview and commit use this plan. A preview alone never authorizes a write. */
export function previewSeriesResume(input:{series:ManagedFinanceSeries;account:ContaFinanceira;categories:readonly CategoriaFinanceira[];tags:readonly EtiquetaFinanceira[];bindings:readonly BoundSeriesOccurrence[];today:string;horizon:SeriesHorizon;statement_assignments:SeriesStatementAssignment[]}){
 exigir(input.series.state==='paused','Somente uma série pausada pode ser retomada.');
 exigir(input.bindings.length<=120,'A retomada deve permanecer finita.');
 const restore=input.bindings.filter(({occurrence,row,account})=>{
  assertSeriesOccurrenceBinding(input.series,occurrence,row,account);
  return seriesOccurrenceEligibility(input.series,occurrence,row,account,{action:'resume',today:input.today,from_on:input.today}).allowed;
 });
 exigir(restore.every(item=>item.account.archived_at===null),'Revise a conta das ocorrências pausadas antes de retomar.');
 const planned=planSeriesMaterialization({series:{...input.series,state:'active'},account:input.account,categories:input.categories,tags:input.tags,existing:input.bindings.map(item=>item.occurrence),horizon:input.horizon,today:input.today,statement_assignments:input.statement_assignments});
 return {restore:structuredClone(restore),planned,summary:{expected_revision:input.series.revision,reactivated_count:restore.length,reactivated_through:restore.map(item=>item.row.occurred_on).sort().at(-1)??null,new_count:planned.occurrences.length,new_through:planned.occurrences.map(item=>item.occurred_on).sort().at(-1)??null,skipped:input.bindings.length-restore.length+planned.skipped_before_horizon.length}};
}
