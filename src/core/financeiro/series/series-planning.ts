import {exigir} from '../../contracts/base';
import type {ContaFinanceira,CategoriaFinanceira,EtiquetaFinanceira} from '../fused';
import {normalizarPagamento} from '../fused';
import {faturaDe,parcelas} from '../credit';
import {seriesDayAt,validateSeriesHorizon} from './series-calendar';
import {validateManagedOccurrence,validateManagedSeries,validateSeriesAssignments} from './series-validation';
import type {ManagedFinanceSeries,ManagedSeriesOccurrence,SeriesDefinition,SeriesHorizon,SeriesMaterializationPlan,SeriesStatementAssignment} from './series-types';

export function definitionOfSeries(series:ManagedFinanceSeries):SeriesDefinition {
 const {kind,frequency,anchor_on,first_index,total,ends_on,template}=series;
 return {kind,frequency,anchor_on,first_index,total,ends_on,template:structuredClone(template)};
}
function assertReferences(series:ManagedFinanceSeries,account:ContaFinanceira,categories:readonly CategoriaFinanceira[],tags:readonly EtiquetaFinanceira[]){
 const template=series.template;
 exigir(account.id===template.account_id&&account.user_id===series.user_id&&account.currency==='BRL'&&account.archived_at===null,'Selecione uma conta ativa do mesmo Usuário.');
 if(template.category_id!==null){const category=categories.find(item=>item.id===template.category_id);exigir(category&&category.user_id===series.user_id&&category.kind===template.kind,'A categoria precisa corresponder à natureza e ao Usuário.');}
 for(const id of template.tag_ids)exigir(tags.some(tag=>tag.id===id&&tag.user_id===series.user_id),'Etiqueta fora do Usuário.');
 exigir(account.kind==='credit_card'?template.statement_mode!=='none':template.statement_mode==='none','A competência precisa corresponder ao tipo da conta.');
}
/** Produces a finite intent, not entity IDs or any effect. Existing rows never move. */
export function planSeriesMaterialization(input:{series:ManagedFinanceSeries;account:ContaFinanceira;categories:readonly CategoriaFinanceira[];tags:readonly EtiquetaFinanceira[];existing:readonly ManagedSeriesOccurrence[];horizon:SeriesHorizon;today:string;statement_assignments:SeriesStatementAssignment[]}):SeriesMaterializationPlan {
 const {series,account,horizon}=input;
 exigir(series.version===2&&series.state==='active','Somente uma série ativa pode preparar novas ocorrências.');
 validateManagedSeries(series);validateSeriesHorizon(horizon,input.today);validateSeriesAssignments(input.statement_assignments);assertReferences(series,account,input.categories,input.tags);
 exigir(Number.isInteger(series.next_index)&&series.next_index>=series.first_index&&series.next_index<=series.total+1,'Cursor de série inválido.');
 const seen=new Map<number,ManagedSeriesOccurrence>(),transactionIds=new Set<string>();
 for(const occurrence of input.existing){
  validateManagedOccurrence(occurrence);
  exigir(occurrence.user_id===series.user_id&&occurrence.series_id===series.id&&!seen.has(occurrence.index)&&!transactionIds.has(occurrence.transaction_id),'Ocorrência repetida ou fora da série.');
  exigir(occurrence.occurred_on===seriesDayAt(series,occurrence.index),'A data da ocorrência existente diverge da âncora.');
  seen.set(occurrence.index,occurrence);transactionIds.add(occurrence.transaction_id);
 }
 const assignments=new Map(input.statement_assignments.map(row=>[row.index,row.statement_month]));
 exigir(series.template.statement_mode==='explicit'||assignments.size===0,'Atribuições manuais não pertencem ao modo de competência escolhido.');
 const amounts=series.kind==='parcelamento'?parcelas(series.template.amount_cents,series.total):null;
 const result:SeriesMaterializationPlan={...horizon,occurrences:[],skipped_before_horizon:[],already_materialized:[],next_index:series.next_index,exhausted:false};
 let stoppedAtEnd=false;
 for(let index=series.next_index;index<=series.total;index++){
  const occurred_on=seriesDayAt(series,index);
  if(series.ends_on!==null&&occurred_on>series.ends_on){result.next_index=index;stoppedAtEnd=true;break;}
  if(occurred_on>=horizon.until_exclusive)break;
  result.next_index=index+1;
  if(seen.has(index)){result.already_materialized.push(index);continue;}
  if(occurred_on<horizon.from_on){result.skipped_before_horizon.push(index);continue;}
  let statement_month:string|null=null;
  if(account.kind==='credit_card'){
   if(series.template.statement_mode==='account_cycle'){
    exigir(account.statement_closing_day!==null,'O fechamento do cartão é obrigatório.');statement_month=faturaDe(occurred_on,account.statement_closing_day);
   }else{statement_month=assignments.get(index)??null;exigir(statement_month!==null,'Confirme a competência de cada nova ocorrência do cartão.');assignments.delete(index);}
  }
  const amount_cents=amounts?.[index-1]??series.template.amount_cents;
  const projected=normalizarPagamento({account_id:account.id,kind:series.template.kind,amount_cents,paid_cents:0},account);
  result.occurrences.push({index,occurred_on,amount_cents,paid_cents:projected.paid_cents,status:'planned',statement_month});
 }
 exigir(assignments.size===0,'Uma competência foi atribuída a ocorrência que não será criada nesta ação.');
 exigir(result.occurrences.length<=53,'O horizonte da ação excede a contagem finita permitida.');
 // A temporary date end does not consume an ordinal that was never materialized.
 result.exhausted=result.next_index>series.total||stoppedAtEnd;
 return result;
}
