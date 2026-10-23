import {exigir} from '../../contracts/base';
import type {ContaFinanceira,LancamentoFinanceiro} from '../fused';
import {seriesDay,seriesDayAt} from './series-calendar';
import {validateManagedOccurrence,validateManagedSeries} from './series-validation';
import type {ManagedFinanceSeries,ManagedSeriesOccurrence,SeriesEligibility} from './series-types';

export function assertSeriesOccurrenceBinding(series:ManagedFinanceSeries,occurrence:ManagedSeriesOccurrence,row:LancamentoFinanceiro,account:ContaFinanceira):void {
 validateManagedSeries(series);validateManagedOccurrence(occurrence);
 exigir(series.version===2&&occurrence.user_id===series.user_id&&row.user_id===series.user_id&&account.user_id===series.user_id,'A ocorrência não pertence ao Usuário da série.');
 exigir(occurrence.series_id===series.id&&occurrence.transaction_id===row.id&&row.account_id===account.id&&row.installment_group_id===series.id&&row.installment_no===occurrence.index&&row.installment_total===series.total&&row.serie_tipo===series.kind,'Vínculo de ocorrência incompatível.');
 exigir(row.transfer_group_id===null&&row.occurred_on===occurrence.occurred_on&&row.occurred_on===seriesDayAt(series,occurrence.index),'A identidade e a data da ocorrência são imutáveis.');
 exigir(occurrence.suppression==='none'?row.deleted_at===null:row.deleted_at!==null,'A exclusão e o motivo da ocorrência divergem.');
 exigir(['none','series_pause','manual','ended'].includes(occurrence.suppression),'Motivo de supressão desconhecido.');
}
/** One rule for every series-level change; paid/recorded history is never rewritten. */
export function seriesOccurrenceEligibility(series:ManagedFinanceSeries,occurrence:ManagedSeriesOccurrence,row:LancamentoFinanceiro,account:ContaFinanceira,options:{today:string;from_on:string;action:'pause'|'resume'|'update_future'|'end'|'cancel'}):SeriesEligibility {
 assertSeriesOccurrenceBinding(series,occurrence,row,account);seriesDay(options.today);seriesDay(options.from_on);
 exigir(options.from_on>=options.today,'A alteração da série preserva ocorrências passadas.');
 const denied=(reason:SeriesEligibility['reason']):SeriesEligibility=>({allowed:false,reason});
 if(series.state==='ended')return denied('series_ended');
 if(options.action==='pause'&&series.state!=='active')return denied('series_not_active');
 if(options.action==='resume'&&series.state!=='paused')return denied('series_not_paused');
 if(row.occurred_on<options.from_on)return denied('before_boundary');
 if(row.status==='cancelled')return denied('cancelled');
 if(row.status==='confirmed'||row.status==='reconciled')return denied('recorded');
 const cardProjection=account.kind==='credit_card'&&row.kind==='expense'&&['planned','pending'].includes(row.status)&&row.paid_cents===row.amount_cents;
 if(row.paid_cents!==0&&!cardProjection)return denied('paid_or_partial');
 if(options.action==='resume'){
  if(occurrence.suppression!=='series_pause')return denied('not_paused_by_series');
 }else if(occurrence.suppression!=='none'&&!(occurrence.suppression==='series_pause'&&series.state==='paused'&&['update_future','end','cancel'].includes(options.action)))return denied('already_suppressed');
 return {allowed:true,reason:'eligible'};
}

/** Realization is explicit and separate from payment of a credit-card invoice. */
export function validateSeriesRealization(series:ManagedFinanceSeries,occurrence:ManagedSeriesOccurrence,row:LancamentoFinanceiro,account:ContaFinanceira,patch:{status:'confirmed'|'reconciled';paid_cents:number}):void {
 assertSeriesOccurrenceBinding(series,occurrence,row,account);
 exigir(occurrence.suppression==='none'&&row.deleted_at===null&&row.status!=='cancelled','Uma ocorrência suprimida não pode ser realizada.');
 exigir(patch.status==='confirmed'||patch.status==='reconciled','Escolha uma realização confirmada ou conciliada.');
 exigir(Number.isSafeInteger(patch.paid_cents)&&patch.paid_cents>=row.paid_cents&&patch.paid_cents<=row.amount_cents,'A realização preserva pagamentos já registrados e não ultrapassa o valor.');
 exigir(row.status!=='reconciled'||patch.status==='reconciled','Uma realização conciliada não volta a confirmada por este comando.');
 if(account.kind==='credit_card'&&row.kind==='expense')exigir(patch.paid_cents===row.amount_cents,'Realizar uma compra não é pagar a fatura do cartão.');
}
