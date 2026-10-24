import {assinatura,ErroDeDominio,exigir,instanteValido,naoEncontrado,type ContextoDeEscrita,type DependenciasDeDominio} from '../../contracts/base';
import {diaCivilDe} from '../../tempo';
import {normalizarPagamento,type LancamentoFinanceiro} from '../fused';
import {faturaDe,parcelas} from '../credit';
import type {FinanceSeriesTransaction,FinanceSeriesUnitOfWork} from './series-ports';
import {planSeriesMaterialization} from './series-planning';
import {seriesDay} from './series-calendar';
import {assertSeriesOccurrenceBinding,seriesOccurrenceEligibility,validateSeriesRealization} from './series-policy';
import {previewSeriesResume} from './series-previews';
import {decodeFinanceSeriesCommand,validateManagedOccurrence,validateManagedSeries} from './series-validation';
import type {FinanceSeriesCommand,FinanceSeriesResult,ManagedFinanceSeries,ManagedSeriesOccurrence,SeriesDefinition,SeriesHorizon,SeriesMaterializationPlan,SeriesStatementAssignment,SeriesTemplate} from './series-types';

type Affected=FinanceSeriesResult['affected'];
const affected=():Affected=>({created:0,updated:0,suppressed:0,restored:0,skipped:0});
const result=(series:ManagedFinanceSeries,counts:Affected):FinanceSeriesResult=>({version:2,series:structuredClone(series),affected:{...counts}});
function template(value:SeriesTemplate):SeriesTemplate{return {...structuredClone(value),description:value.description.trim(),payee:value.payee?.trim()||null,notes:value.notes?.trim()||null};}
function now(deps:DependenciasDeDominio):string{const value=deps.clock.now();exigir(typeof value==='string'&&instanteValido(value),'Relógio da série inválido.');return value;}
function nextSeries(before:ManagedFinanceSeries,patch:Partial<ManagedFinanceSeries>,at:string,touch=false):ManagedFinanceSeries{
 const next={...structuredClone(before),...structuredClone(patch)};
 if(!touch&&assinatura(next)===assinatura(before))return next;
 next.revision=String(BigInt(before.revision)+1n);next.updated_at=at;validateManagedSeries(next);return next;
}
async function emitSeries(tx:FinanceSeriesTransaction,deps:DependenciasDeDominio,context:ContextoDeEscrita,before:ManagedFinanceSeries|null,after:ManagedFinanceSeries,at:string){
 await tx.events.append({id:deps.ids.next(),user_id:context.user_id,entity_type:'finance_series',entity_id:after.id,action:before===null?'created':before.state===after.state?'updated':'status_changed',canal:context.canal,occurred_at:at,before,after});
}
async function emitOccurrence(tx:FinanceSeriesTransaction,deps:DependenciasDeDominio,context:ContextoDeEscrita,before:ManagedSeriesOccurrence|null,after:ManagedSeriesOccurrence,at:string){
 await tx.events.append({id:deps.ids.next(),user_id:context.user_id,entity_type:'finance_series_occurrence',entity_id:after.id,action:before===null?'created':before.suppression===after.suppression?'updated':'status_changed',canal:context.canal,occurred_at:at,before,after});
}
async function emitRow(tx:FinanceSeriesTransaction,deps:DependenciasDeDominio,context:ContextoDeEscrita,before:LancamentoFinanceiro|null,after:LancamentoFinanceiro,at:string){
 const action=before===null?'created':before.deleted_at===null&&after.deleted_at!==null?'deleted':before.deleted_at!==null&&after.deleted_at===null?'restored':before.status===after.status?'updated':'status_changed';
 await tx.events.append({id:deps.ids.next(),user_id:context.user_id,entity_type:'finance_transaction',entity_id:after.id,action,canal:context.canal,occurred_at:at,before,after});
}
async function saveSeries(tx:FinanceSeriesTransaction,deps:DependenciasDeDominio,context:ContextoDeEscrita,before:ManagedFinanceSeries|null,after:ManagedFinanceSeries,at:string){
 validateManagedSeries(after);if(before!==null&&assinatura(before)===assinatura(after))return;
 if(before===null)await tx.series.insert(after);else await tx.series.replace(after);await emitSeries(tx,deps,context,before,after,at);
}
async function replaceOccurrence(tx:FinanceSeriesTransaction,deps:DependenciasDeDominio,context:ContextoDeEscrita,before:ManagedSeriesOccurrence,after:ManagedSeriesOccurrence,at:string){
 validateManagedOccurrence(after);if(assinatura(before)===assinatura(after))return;
 await tx.occurrences.replace(after);await emitOccurrence(tx,deps,context,before,after,at);
}
async function replaceRow(tx:FinanceSeriesTransaction,deps:DependenciasDeDominio,context:ContextoDeEscrita,before:LancamentoFinanceiro,after:LancamentoFinanceiro,at:string){
 if(assinatura(before)===assinatura(after))return;
 await tx.transactions.replace(after);await emitRow(tx,deps,context,before,after,at);
}
async function ownedSeries(tx:FinanceSeriesTransaction,owner:string,id:string,revision:string){
 const series=await tx.series.get(id);if(!series||series.user_id!==owner)naoEncontrado();validateManagedSeries(series);
 if(series.revision!==revision)throw new ErroDeDominio('CONFLICT','A série mudou. Confira a versão atual antes de reenviar.');return series;
}
async function references(tx:FinanceSeriesTransaction,series:ManagedFinanceSeries){
 const account=await tx.accounts.get(series.template.account_id);if(!account||account.user_id!==series.user_id)naoEncontrado();
 exigir(account.archived_at===null&&account.currency==='BRL','Selecione uma conta ativa em reais.');
 exigir(account.kind==='credit_card'?series.template.statement_mode!=='none':series.template.statement_mode==='none','A competência precisa corresponder ao tipo de conta.');
 const categories=[];if(series.template.category_id!==null){const category=await tx.categories.get(series.template.category_id);if(!category||category.user_id!==series.user_id)naoEncontrado();exigir(category.kind===series.template.kind,'A categoria deve corresponder à natureza da série.');categories.push(category);}
 const tags=[];for(const id of series.template.tag_ids){const tag=await tx.tags.get(id);if(!tag||tag.user_id!==series.user_id)naoEncontrado();tags.push(tag);}
 return {account,categories,tags};
}
async function boundOccurrences(tx:FinanceSeriesTransaction,series:ManagedFinanceSeries){
 const occurrences=await tx.occurrences.forSeries(series.id);exigir(occurrences.length<=120,'A série excede o limite finito de ocorrências.');
 const indices=new Set<number>(),ids=new Set<string>();const result=[];
 for(const occurrence of occurrences){
  const row=await tx.transactions.get(occurrence.transaction_id);if(!row)naoEncontrado();const account=await tx.accounts.get(row.account_id);if(!account)naoEncontrado();
  assertSeriesOccurrenceBinding(series,occurrence,row,account);exigir(!indices.has(occurrence.index)&&!ids.has(row.id),'Mapa de ocorrência repetido.');indices.add(occurrence.index);ids.add(row.id);result.push({occurrence,row,account});
 }
 const last=occurrences.map(row=>row.occurred_on).sort().at(-1)??null;
 exigir(last===series.materialized_through&&occurrences.every(row=>row.index<series.next_index&&BigInt(row.configuration_revision)<=BigInt(series.revision)),'O cursor ou horizonte persistido diverge do mapa da série.');
 return result.sort((a,b)=>a.occurrence.index-b.occurrence.index);
}
async function plan(tx:FinanceSeriesTransaction,series:ManagedFinanceSeries,horizon:SeriesHorizon,today:string,statement_assignments:SeriesStatementAssignment[],existing?:ManagedSeriesOccurrence[]):Promise<SeriesMaterializationPlan>{
 const refs=await references(tx,series);return planSeriesMaterialization({series,...refs,existing:existing??await tx.occurrences.forSeries(series.id),horizon,today,statement_assignments});
}
function lastMaterialized(before:ManagedFinanceSeries,planned:SeriesMaterializationPlan):string|null{
 const dates=planned.occurrences.map(row=>row.occurred_on);if(before.materialized_through)dates.push(before.materialized_through);return dates.sort().at(-1)??null;
}
async function insertPlanned(tx:FinanceSeriesTransaction,deps:DependenciasDeDominio,context:ContextoDeEscrita,series:ManagedFinanceSeries,planned:SeriesMaterializationPlan,at:string){
 for(const item of planned.occurrences){
  const row:LancamentoFinanceiro={id:deps.ids.next(),user_id:series.user_id,account_id:series.template.account_id,category_id:series.template.category_id,kind:series.template.kind,amount_cents:item.amount_cents,paid_cents:item.paid_cents,description:series.template.description,payee:series.template.payee,notes:series.template.notes,tag_ids:[...series.template.tag_ids],occurred_on:item.occurred_on,due_date:item.occurred_on,statement_month:item.statement_month,status:'planned',source:series.kind==='recorrencia'?'recurring':'manual',installment_group_id:series.id,installment_no:item.index,installment_total:series.total,serie_tipo:series.kind,transfer_group_id:null,deleted_at:null,created_at:at,updated_at:at};
  const occurrence:ManagedSeriesOccurrence={id:deps.ids.next(),user_id:series.user_id,series_id:series.id,index:item.index,transaction_id:row.id,occurred_on:item.occurred_on,suppression:'none',configuration_revision:series.revision,created_at:at,updated_at:at};
  validateManagedOccurrence(occurrence);await tx.transactions.insert(row);await emitRow(tx,deps,context,null,row,at);await tx.occurrences.insert(occurrence);await emitOccurrence(tx,deps,context,null,occurrence,at);
 }
}
async function create(tx:FinanceSeriesTransaction,deps:DependenciasDeDominio,context:ContextoDeEscrita,input:Extract<FinanceSeriesCommand,{command:'finance.recurring.create'}>['input'],at:string){
 const definition:SeriesDefinition={...structuredClone(input.definition),template:template(input.definition.template)};
 const before:ManagedFinanceSeries={...definition,version:2,id:deps.ids.next(),user_id:context.user_id,state:'active',revision:'0',next_index:definition.first_index,materialized_through:null,created_at:at,updated_at:at};validateManagedSeries(before);
 const planned=await plan(tx,before,input.horizon,diaCivilDe(at),input.statement_assignments,[]),after={...before,next_index:planned.next_index,materialized_through:lastMaterialized(before,planned)};
 await saveSeries(tx,deps,context,null,after,at);await insertPlanned(tx,deps,context,after,planned,at);
 return result(after,{...affected(),created:planned.occurrences.length,skipped:planned.skipped_before_horizon.length});
}
async function materialize(tx:FinanceSeriesTransaction,deps:DependenciasDeDominio,context:ContextoDeEscrita,before:ManagedFinanceSeries,input:{horizon:SeriesHorizon;statement_assignments:SeriesStatementAssignment[]},at:string){
 await boundOccurrences(tx,before);const planned=await plan(tx,before,input.horizon,diaCivilDe(at),input.statement_assignments);
 const after=nextSeries(before,{next_index:planned.next_index,materialized_through:lastMaterialized(before,planned)},at,planned.occurrences.length>0);
 await saveSeries(tx,deps,context,before,after,at);await insertPlanned(tx,deps,context,after,planned,at);
 return result(after,{...affected(),created:planned.occurrences.length,skipped:planned.skipped_before_horizon.length});
}
async function suppress(tx:FinanceSeriesTransaction,deps:DependenciasDeDominio,context:ContextoDeEscrita,before:ManagedFinanceSeries,action:'pause'|'end',from_on:string,at:string){
 const today=diaCivilDe(at);seriesDay(from_on);exigir(from_on>=today,'O encerramento e a pausa preservam o passado.');
 exigir(action==='pause'?before.state==='active':before.state!=='ended','O estado atual não permite esta ação.');
 const counts=affected(),after=nextSeries(before,{state:action==='pause'?'paused':'ended'},at);
 for(const {occurrence,row,account}of await boundOccurrences(tx,before)){
  if(!seriesOccurrenceEligibility(before,occurrence,row,account,{action,today,from_on}).allowed){counts.skipped++;continue;}
  if(row.deleted_at===null){await replaceRow(tx,deps,context,row,{...row,deleted_at:at,updated_at:at},at);counts.suppressed++;}
  await replaceOccurrence(tx,deps,context,occurrence,{...occurrence,suppression:action==='pause'?'series_pause':'ended',updated_at:at},at);
 }
 await saveSeries(tx,deps,context,before,after,at);return result(after,counts);
}
async function resume(tx:FinanceSeriesTransaction,deps:DependenciasDeDominio,context:ContextoDeEscrita,before:ManagedFinanceSeries,input:{horizon:SeriesHorizon;statement_assignments:SeriesStatementAssignment[]},at:string){
 exigir(before.state==='paused','Somente uma série pausada pode ser retomada.');const today=diaCivilDe(at),bound=await boundOccurrences(tx,before);
 const refs=await references(tx,before),preview=previewSeriesResume({series:before,...refs,bindings:bound,today,horizon:input.horizon,statement_assignments:input.statement_assignments}),eligible=preview.restore,planned=preview.planned;
 const after=nextSeries(before,{state:'active',next_index:planned.next_index,materialized_through:lastMaterialized(before,planned)},at);
 // Restoring existing finite identities is separate from creating <=12 months.
 for(const {occurrence,row}of eligible){
  await replaceRow(tx,deps,context,row,{...row,deleted_at:null,updated_at:at},at);
  await replaceOccurrence(tx,deps,context,occurrence,{...occurrence,suppression:'none',updated_at:at},at);
 }
 await saveSeries(tx,deps,context,before,after,at);await insertPlanned(tx,deps,context,after,planned,at);
 return result(after,{...affected(),created:planned.occurrences.length,restored:eligible.length,skipped:preview.summary.skipped});
}
async function updateFuture(tx:FinanceSeriesTransaction,deps:DependenciasDeDominio,context:ContextoDeEscrita,before:ManagedFinanceSeries,input:Extract<FinanceSeriesCommand,{command:'finance.recurring.update_future'}>['input'],at:string){
 const today=diaCivilDe(at);exigir(before.state!=='ended'&&input.from_on>=today,'A edição futura preserva o passado e séries encerradas.');
 const nextTemplate=input.patch.template?template(input.patch.template):structuredClone(before.template);
 exigir(nextTemplate.kind===before.template.kind,'Para mudar a natureza financeira, crie uma nova série explicitamente.');
 exigir(before.kind!=='parcelamento'||nextTemplate.amount_cents===before.template.amount_cents,'O total original do parcelamento é imutável. Uma mudança de total exige nova série explícita.');
 const ends_on=Object.hasOwn(input.patch,'ends_on')?input.patch.ends_on??null:before.ends_on;
 if(ends_on!==null)exigir(ends_on>=input.from_on,'O novo término deve respeitar a fronteira da edição futura.');
 const definition={...before,template:nextTemplate,ends_on};validateManagedSeries(definition);
 const refs=input.patch.template?await references(tx,definition):null;
 exigir(input.statement_assignments.length===0||input.patch.template&&nextTemplate.statement_mode==='explicit','Atribuições de competência exigem uma alteração explícita do template.');
 const assignments=new Map(input.statement_assignments.map(item=>[item.index,item.statement_month])),counts=affected();
 const changes:{occurrence:ManagedSeriesOccurrence;row:LancamentoFinanceiro;afterRow:LancamentoFinanceiro;suppression:ManagedSeriesOccurrence['suppression'];configurationChanged:boolean}[]=[];
 const amounts=before.kind==='parcelamento'?parcelas(before.template.amount_cents,before.total):null;
 for(const {occurrence,row,account}of await boundOccurrences(tx,before)){
  const eligible=seriesOccurrenceEligibility(before,occurrence,row,account,{action:'update_future',today,from_on:input.from_on}).allowed;
  if(ends_on!==null&&row.occurred_on>ends_on&&occurrence.suppression==='none')exigir(eligible,'O término não pode remover uma ocorrência paga, parcial ou realizada.');
  if(!eligible){counts.skipped++;continue;}
  if(ends_on!==null&&row.occurred_on>ends_on){
   changes.push({occurrence,row,afterRow:row.deleted_at===null?{...row,deleted_at:at,updated_at:at}:row,suppression:'ended',configurationChanged:false});if(row.deleted_at===null)counts.suppressed++;continue;
  }
  if(!refs){counts.skipped++;continue;}
  let statement_month=row.statement_month;
  if(refs.account.kind!=='credit_card')statement_month=null;
  else if(assignments.has(occurrence.index)){statement_month=assignments.get(occurrence.index)!;assignments.delete(occurrence.index);}
  else if(refs.account.id!==row.account_id){
   exigir(nextTemplate.statement_mode==='account_cycle'&&refs.account.statement_closing_day!==null,'Confirme a competência de cada ocorrência que muda de cartão.');statement_month=faturaDe(row.occurred_on,refs.account.statement_closing_day);
  }
  if(refs.account.kind==='credit_card')exigir(statement_month!==null,'A ocorrência do cartão precisa de competência explícita.');
  const amount_cents=amounts?.[occurrence.index-1]??nextTemplate.amount_cents,projected=normalizarPagamento({account_id:refs.account.id,kind:nextTemplate.kind,amount_cents,paid_cents:0},refs.account);
  const afterRow={...row,account_id:refs.account.id,category_id:nextTemplate.category_id,description:nextTemplate.description,payee:nextTemplate.payee,notes:nextTemplate.notes,tag_ids:[...nextTemplate.tag_ids],amount_cents,paid_cents:projected.paid_cents,statement_month};
  if(assinatura(afterRow)!==assinatura(row)){changes.push({occurrence,row,afterRow:{...afterRow,updated_at:at},suppression:occurrence.suppression,configurationChanged:true});counts.updated++;}
 }
 exigir(assignments.size===0,'Uma competência foi atribuída a ocorrência protegida, inexistente ou fora desta edição.');
 const after=nextSeries(before,{template:nextTemplate,ends_on},at,changes.length>0);
 for(const change of changes){
  await replaceRow(tx,deps,context,change.row,change.afterRow,at);
  await replaceOccurrence(tx,deps,context,change.occurrence,{...change.occurrence,suppression:change.suppression,configuration_revision:change.configurationChanged?after.revision:change.occurrence.configuration_revision,updated_at:at},at);
 }
 await saveSeries(tx,deps,context,before,after,at);return result(after,counts);
}
async function occurrenceCommand(tx:FinanceSeriesTransaction,deps:DependenciasDeDominio,context:ContextoDeEscrita,before:ManagedFinanceSeries,input:Extract<FinanceSeriesCommand,{command:'finance.recurring.occurrence.update'|'finance.recurring.occurrence.cancel'}>,at:string){
 await boundOccurrences(tx,before);
 const occurrence=await tx.occurrences.get(input.input.occurrence_id);if(!occurrence||occurrence.user_id!==context.user_id||occurrence.series_id!==before.id)naoEncontrado();
 const row=await tx.transactions.get(occurrence.transaction_id);if(!row)naoEncontrado();const account=await tx.accounts.get(row.account_id);if(!account)naoEncontrado();assertSeriesOccurrenceBinding(before,occurrence,row,account);
 const counts=affected();let touched=false;
 if(input.command==='finance.recurring.occurrence.cancel'){
  if(occurrence.suppression==='manual')return result(before,{...counts,skipped:1});
  const today=diaCivilDe(at);exigir(seriesOccurrenceEligibility(before,occurrence,row,account,{action:'cancel',from_on:today,today}).allowed,'Esta ocorrência não pode ser excluída pela série.');
  if(row.deleted_at===null){await replaceRow(tx,deps,context,row,{...row,deleted_at:at,updated_at:at},at);counts.suppressed++;}
  await replaceOccurrence(tx,deps,context,occurrence,{...occurrence,suppression:'manual',updated_at:at},at);touched=true;
 }else{
  exigir(account.archived_at===null,'Revise a conta arquivada antes de registrar uma realização.');
  validateSeriesRealization(before,occurrence,row,account,input.input.patch);
  if(row.status!==input.input.patch.status||row.paid_cents!==input.input.patch.paid_cents){await replaceRow(tx,deps,context,row,{...row,...input.input.patch,updated_at:at},at);counts.updated++;touched=true;}
 }
 const after=nextSeries(before,{},at,touched);await saveSeries(tx,deps,context,before,after,at);return result(after,counts);
}

/** Receipt handling runs inside the adapter transaction, after its current-access guard. */
export async function executeFinanceSeriesCommand(store:FinanceSeriesUnitOfWork,deps:DependenciasDeDominio,context:ContextoDeEscrita,command:FinanceSeriesCommand):Promise<FinanceSeriesResult>{
 const request=decodeFinanceSeriesCommand(command),actor={...context},fingerprint=assinatura(request.input);
 return store.transaction(actor,async tx=>{
  const receipt=await tx.receipts.get(request.command,request.input.client_id);
  if(receipt){
   exigir(receipt.user_id===actor.user_id&&receipt.command===request.command&&receipt.client_id===request.input.client_id,'Recibo de série fora do Usuário.');
   if(receipt.fingerprint!==fingerprint)throw new ErroDeDominio('CONFLICT','client_id já usado com outro conteúdo.');
   const saved=receipt.result as FinanceSeriesResult;
   exigir(saved!==null&&typeof saved==='object'&&!Array.isArray(saved)&&Object.keys(saved).sort().join(',')==='affected,series,version'&&saved.version===2&&saved.series?.user_id===actor.user_id,'Recibo de série inválido.');
   validateManagedSeries(saved.series);
   exigir(saved.affected!==null&&typeof saved.affected==='object'&&!Array.isArray(saved.affected)&&Object.keys(saved.affected).sort().join(',')==='created,restored,skipped,suppressed,updated'&&Object.values(saved.affected).every(value=>Number.isInteger(value)&&value>=0&&value<=120),'Contagem de recibo inválida.');return structuredClone(saved);
  }
  if(tx.financeRevision!==request.input.expected_finance_revision)throw new ErroDeDominio('CONFLICT','Os dados financeiros mudaram. Confira a prévia atual antes de reenviar.');
  const at=now(deps);let saved:FinanceSeriesResult;
  if(request.command==='finance.recurring.create')saved=await create(tx,deps,actor,request.input,at);
  else{
   const before=await ownedSeries(tx,actor.user_id,request.input.series_id,request.input.expected_revision);
   if(request.command==='finance.recurring.materialize')saved=await materialize(tx,deps,actor,before,request.input,at);
   else if(request.command==='finance.recurring.resume')saved=await resume(tx,deps,actor,before,request.input,at);
   else if(request.command==='finance.recurring.pause'||request.command==='finance.recurring.end')saved=await suppress(tx,deps,actor,before,request.command==='finance.recurring.pause'?'pause':'end',request.input.from_on,at);
   else if(request.command==='finance.recurring.update_future')saved=await updateFuture(tx,deps,actor,before,request.input,at);
   else if(request.command==='finance.recurring.occurrence.cancel'||request.command==='finance.recurring.occurrence.update')saved=await occurrenceCommand(tx,deps,actor,before,request,at);
   else throw new ErroDeDominio('VALIDATION','Comando de série não permitido.');
  }
  await tx.receipts.insert({user_id:actor.user_id,command:request.command,client_id:request.input.client_id,fingerprint,result:saved});return structuredClone(saved);
 });
}
