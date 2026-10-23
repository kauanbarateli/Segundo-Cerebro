import type {ContaFinanceira,CategoriaFinanceira,LancamentoFinanceiro} from '../../src/core/financeiro/fused';
import {seriesDayAt,type ManagedFinanceSeries,type ManagedSeriesOccurrence} from '../../src/core/financeiro/series';
export const seriesId=(n:number)=>`78000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export const SERIES_OWNER=seriesId(1),SERIES_NOW='2026-10-23T12:00:00.000Z';
export const seriesAccount:ContaFinanceira={id:seriesId(2),user_id:SERIES_OWNER,name:'Conta sintética',kind:'checking',institution:null,currency:'BRL',opening_balance_cents:0,color_key:'fin-1',archived_at:null,credit_limit_cents:null,statement_closing_day:null,payment_due_day:null,created_at:SERIES_NOW,updated_at:SERIES_NOW};
export const seriesCategory:CategoriaFinanceira={id:seriesId(3),user_id:SERIES_OWNER,name:'Categoria sintética',normalized_name:'categoria sintética',kind:'expense',parent_id:null,color_key:'fin-1',created_at:SERIES_NOW,updated_at:SERIES_NOW};
export function managedSeries(patch:Partial<ManagedFinanceSeries>={}):ManagedFinanceSeries{
 return {version:2,id:seriesId(4),user_id:SERIES_OWNER,kind:'recorrencia',frequency:'monthly',anchor_on:'2026-10-23',first_index:1,total:12,ends_on:null,state:'active',revision:'0',next_index:1,materialized_through:null,
  template:{account_id:seriesAccount.id,category_id:seriesCategory.id,kind:'expense',amount_cents:10000,description:'Previsão sintética',payee:null,notes:null,tag_ids:[],statement_mode:'none'},created_at:SERIES_NOW,updated_at:SERIES_NOW,...structuredClone(patch)};
}
export function managedOccurrence(series:ManagedFinanceSeries,index=1):{occurrence:ManagedSeriesOccurrence;row:LancamentoFinanceiro}{
 const occurred_on=seriesDayAt(series,index),transaction_id=seriesId(100+index);
 return {occurrence:{id:seriesId(200+index),user_id:series.user_id,series_id:series.id,index,transaction_id,occurred_on,suppression:'none',configuration_revision:series.revision,created_at:SERIES_NOW,updated_at:SERIES_NOW},
  row:{id:transaction_id,user_id:series.user_id,account_id:series.template.account_id,category_id:series.template.category_id,kind:series.template.kind,amount_cents:series.template.amount_cents,paid_cents:0,description:series.template.description,payee:null,notes:null,occurred_on,statement_month:null,installment_group_id:series.id,installment_no:index,installment_total:series.total,serie_tipo:series.kind,transfer_group_id:null,status:'planned',source:'recurring',due_date:null,deleted_at:null,tag_ids:[],created_at:SERIES_NOW,updated_at:SERIES_NOW}};
}
