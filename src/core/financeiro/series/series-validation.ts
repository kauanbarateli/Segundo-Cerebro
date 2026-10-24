import {exigir,instanteValido} from '../../contracts/base';
import {seriesDay,seriesDayAt,seriesMonth} from './series-calendar';
import type {FinanceSeriesCommand,ManagedFinanceSeries,ManagedSeriesOccurrence,SeriesDefinition,SeriesHorizon,SeriesStatementAssignment,SeriesTemplate} from './series-types';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
function record(value:unknown):asserts value is Record<string,unknown>{exigir(!!value&&typeof value==='object'&&!Array.isArray(value),'Informe uma operação de série válida.');}
function keys(value:Record<string,unknown>,required:readonly string[],optional:readonly string[]=[]){exigir(required.every(key=>Object.hasOwn(value,key))&&Object.keys(value).every(key=>[...required,...optional].includes(key)),'Campos de série não permitidos ou incompletos.');}
function id(value:unknown){exigir(typeof value==='string'&&UUID.test(value),'Identificador de série inválido.');}
function positive(value:unknown){exigir(typeof value==='number'&&Number.isSafeInteger(value)&&value>0,'Informe centavos inteiros positivos.');}
function revision(value:unknown){exigir(typeof value==='string'&&/^(0|[1-9][0-9]{0,18})$/.test(value)&&BigInt(value)<=9223372036854775807n,'Informe uma revisão decimal canônica dentro do intervalo bigint.');}
function timestamp(value:unknown){exigir(typeof value==='string'&&instanteValido(value),'Instante da série inválido.');}
function text(value:unknown,max:number,nullable=false){exigir(nullable&&value===null||typeof value==='string'&&value.length<=max&&(nullable||value.trim().length>0),'Texto de série inválido.');}
export function validateSeriesTemplate(value:unknown):asserts value is SeriesTemplate {
 record(value);keys(value,['account_id','category_id','kind','amount_cents','description','payee','notes','tag_ids','statement_mode']);id(value.account_id);if(value.category_id!==null)id(value.category_id);
 exigir(value.kind==='income'||value.kind==='expense','Natureza financeira inválida.');positive(value.amount_cents);text(value.description,200);text(value.payee,200,true);text(value.notes,4000,true);
 exigir(Array.isArray(value.tag_ids)&&value.tag_ids.length<=30,'Selecione até trinta etiquetas.');value.tag_ids.forEach(id);exigir(new Set(value.tag_ids).size===value.tag_ids.length,'Não repita etiquetas.');
 exigir(typeof value.statement_mode==='string'&&['none','account_cycle','explicit'].includes(value.statement_mode),'Escolha como atribuir a competência.');
}
export function validateSeriesDefinition(value:unknown):asserts value is SeriesDefinition {
 record(value);keys(value,['kind','frequency','anchor_on','first_index','total','ends_on','template']);
 exigir(value.kind==='recorrencia'||value.kind==='parcelamento','Tipo de série inválido.');exigir(typeof value.frequency==='string'&&['weekly','monthly','yearly'].includes(value.frequency),'Frequência inválida.');
 seriesDay(value.anchor_on);exigir(Number.isInteger(value.total)&&Number(value.total)>=2&&Number(value.total)<=120,'A série precisa de 2 a 120 posições.');
 exigir(Number.isInteger(value.first_index)&&Number(value.first_index)>=1&&Number(value.first_index)<=Number(value.total),'A posição inicial precisa pertencer à série.');
 if(value.ends_on!==null){seriesDay(value.ends_on);exigir(String(value.ends_on)>=String(value.anchor_on),'O término não pode preceder a âncora.');}
 validateSeriesTemplate(value.template);exigir(value.kind!=='parcelamento'||value.template.amount_cents>=Number(value.total),'O total deve permitir ao menos um centavo por parcela.');
 // Validate every reachable date now, respecting an earlier explicit end date.
 for(let index=Number(value.first_index);index<=Number(value.total);index++){
  const day=seriesDayAt(value as unknown as SeriesDefinition,index);if(value.ends_on!==null&&day>String(value.ends_on))break;
 }
}
export function validateManagedSeries(value:unknown):asserts value is ManagedFinanceSeries {
 record(value);keys(value,['version','id','user_id','kind','frequency','anchor_on','first_index','total','ends_on','template','state','revision','next_index','materialized_through','created_at','updated_at']);
 exigir(value.version===2,'Versão de série desconhecida.');id(value.id);id(value.user_id);
 const {kind,frequency,anchor_on,first_index,total,ends_on,template}=value;validateSeriesDefinition({kind,frequency,anchor_on,first_index,total,ends_on,template});
 exigir(typeof value.state==='string'&&['active','paused','ended'].includes(value.state),'Estado de série inválido.');revision(value.revision);
 exigir(Number.isInteger(value.next_index)&&Number(value.next_index)>=Number(first_index)&&Number(value.next_index)<=Number(total)+1,'Cursor de série inválido.');
 if(value.materialized_through!==null){seriesDay(value.materialized_through);exigir(String(value.materialized_through)>=String(anchor_on),'A materialização não pode preceder a âncora.');}
 timestamp(value.created_at);timestamp(value.updated_at);
}
export function validateManagedOccurrence(value:unknown):asserts value is ManagedSeriesOccurrence {
 record(value);keys(value,['id','user_id','series_id','index','transaction_id','occurred_on','suppression','configuration_revision','created_at','updated_at']);
 for(const key of ['id','user_id','series_id','transaction_id'])id(value[key]);
 exigir(Number.isInteger(value.index)&&Number(value.index)>=1&&Number(value.index)<=120,'Posição de ocorrência inválida.');seriesDay(value.occurred_on);
 exigir(typeof value.suppression==='string'&&['none','series_pause','manual','ended'].includes(value.suppression),'Motivo de supressão desconhecido.');
 revision(value.configuration_revision);timestamp(value.created_at);timestamp(value.updated_at);
}
function horizon(value:unknown):asserts value is SeriesHorizon {record(value);keys(value,['from_on','until_exclusive']);seriesDay(value.from_on);seriesDay(value.until_exclusive);exigir(String(value.until_exclusive)>String(value.from_on),'Informe um intervalo não vazio.');}
export function validateSeriesAssignments(value:unknown):asserts value is SeriesStatementAssignment[]{
 exigir(Array.isArray(value)&&value.length<=53,'Uma ação permite até 53 atribuições de competência.');const indices=new Set<number>();
 for(const row of value){record(row);keys(row,['index','statement_month']);exigir(Number.isInteger(row.index)&&Number(row.index)>=1&&Number(row.index)<=120&&!indices.has(Number(row.index)),'Posição de competência inválida ou repetida.');indices.add(Number(row.index));seriesMonth(row.statement_month);}
}
/** Browser sends intent only: no owner, row batches, payment defaults or moderation. */
export function decodeFinanceSeriesCommand(value:unknown):FinanceSeriesCommand {
 record(value);keys(value,['command','input']);record(value.input);const input=value.input;id(input.client_id);revision(input.expected_finance_revision);
 if(value.command==='finance.recurring.create'){
  keys(input,['client_id','expected_finance_revision','definition','horizon','statement_assignments']);validateSeriesDefinition(input.definition);horizon(input.horizon);validateSeriesAssignments(input.statement_assignments);
 }else{
  id(input.series_id);revision(input.expected_revision);
  const common=['client_id','expected_finance_revision','series_id','expected_revision'];
  if(value.command==='finance.recurring.materialize'||value.command==='finance.recurring.resume'){
   keys(input,[...common,'horizon','statement_assignments']);horizon(input.horizon);validateSeriesAssignments(input.statement_assignments);
  }else if(value.command==='finance.recurring.pause'||value.command==='finance.recurring.end'){
   keys(input,[...common,'from_on']);seriesDay(input.from_on);
  }else if(value.command==='finance.recurring.update_future'){
   keys(input,[...common,'from_on','patch','statement_assignments']);seriesDay(input.from_on);record(input.patch);keys(input.patch,[],['template','ends_on']);exigir(Object.keys(input.patch).length>0,'Informe o que deseja alterar.');
   if(Object.hasOwn(input.patch,'template'))validateSeriesTemplate(input.patch.template);if(Object.hasOwn(input.patch,'ends_on')&&input.patch.ends_on!==null)seriesDay(input.patch.ends_on);validateSeriesAssignments(input.statement_assignments);
  }else if(value.command==='finance.recurring.occurrence.cancel'){
   keys(input,[...common,'occurrence_id']);id(input.occurrence_id);
  }else if(value.command==='finance.recurring.occurrence.update'){
   keys(input,[...common,'occurrence_id','patch']);id(input.occurrence_id);record(input.patch);keys(input.patch,['status','paid_cents']);
   exigir(input.patch.status==='confirmed'||input.patch.status==='reconciled','A realização precisa ser confirmada ou conciliada.');exigir(typeof input.patch.paid_cents==='number'&&Number.isSafeInteger(input.patch.paid_cents)&&input.patch.paid_cents>=0,'Informe centavos pagos válidos.');
  }else exigir(false,'Comando de série desconhecido.');
 }
 return structuredClone(value) as FinanceSeriesCommand;
}
