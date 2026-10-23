import {assinatura,ErroDeDominio,type ContextoDeEscrita,type ReciboIdempotente} from '../../src/core/contracts';
import type {ContaFinanceira,EtiquetaFinanceira,LancamentoFinanceiro} from '../../src/core/financeiro/fused';
import type {FinanceSeriesRead,FinanceSeriesTransaction,FinanceSeriesUnitOfWork} from '../../src/core/financeiro/series/series-ports';
import type {FinanceSeriesEvent,ManagedFinanceSeries,ManagedSeriesOccurrence} from '../../src/core/financeiro/series/series-types';
import {SERIES_OWNER,seriesAccount,seriesCategory} from './finance-series';

export interface SeriesFixtureState {series:ManagedFinanceSeries[];occurrences:ManagedSeriesOccurrence[];transactions:LancamentoFinanceiro[];events:FinanceSeriesEvent[];receipts:ReciboIdempotente[];revision:string}
type Point='write'|'event'|'receipt'|'commit';
type MetaRow=ManagedFinanceSeries|ManagedSeriesOccurrence|LancamentoFinanceiro;
/** Disposable, serializable injected port. It never proves SQL/RLS/hosted durability. */
export class SeriesMemoryFixture implements FinanceSeriesUnitOfWork {
 readonly accounts:ContaFinanceira[];
 constructor(options:{accounts?:ContaFinanceira[]}={}){this.accounts=structuredClone(options.accounts??[seriesAccount]);}
 state:SeriesFixtureState={series:[],occurrences:[],transactions:[],events:[],receipts:[],revision:'0'};
 private queue:Promise<void>=Promise.resolve();private fault:{point:Point;n:number;seen:number}|null=null;
 fail(point:Point,n:number){this.fault={point,n,seen:0};}
 private check(point:Point){if(this.fault?.point===point&&++this.fault.seen===this.fault.n)throw new Error(`INJECTED_${point.toUpperCase()}`);}
 read(userId:string):FinanceSeriesRead {
  if(userId!==SERIES_OWNER)throw new ErroDeDominio('VALIDATION','Wrong reader');
  const get=<T extends {id:string;user_id:string}>(rows:()=>T[])=>({async get(id:string){return structuredClone(rows().find(row=>row.id===id&&row.user_id===userId)??null);}});
  return {series:{...get(()=>this.state.series),page:async({limit})=>({version:2,finance_revision:this.state.revision,items:structuredClone(this.state.series.slice(0,Math.min(50,limit))),next_cursor:null})},occurrences:{...get(()=>this.state.occurrences),forSeries:async id=>structuredClone(this.state.occurrences.filter(row=>row.series_id===id&&row.user_id===userId))},transactions:get(()=>this.state.transactions),accounts:get(()=>this.accounts),categories:get(()=>[seriesCategory]),tags:get<EtiquetaFinanceira>(()=>[])};
 }
 async transaction<T>(context:ContextoDeEscrita,work:(tx:FinanceSeriesTransaction)=>Promise<T>):Promise<T>{
  const previous=this.queue;let release!:()=>void;this.queue=new Promise<void>(resolve=>{release=resolve;});await previous;
  const draft=structuredClone(this.state),changes:{type:FinanceSeriesEvent['entity_type'];before:MetaRow|null;after:MetaRow}[]=[],events:FinanceSeriesEvent[]=[];
  let active=true;const guard=()=>{if(!active)throw new ErroDeDominio('TRANSACTION_CLOSED','Closed');if(context.user_id!==SERIES_OWNER)throw new ErroDeDominio('VALIDATION','Wrong actor');};
  const repo=<T extends MetaRow>(rows:T[],type:FinanceSeriesEvent['entity_type'])=>({
   async get(id:string){guard();return structuredClone(rows.find(row=>row.id===id&&row.user_id===context.user_id)??null);},
   insert:async(row:T)=>{guard();this.check('write');if(row.user_id!==context.user_id||[...draft.series,...draft.occurrences,...draft.transactions,...draft.events].some(other=>other.id===row.id))throw new Error('ROW_ID_OR_OWNER');rows.push(structuredClone(row));changes.push({type,before:null,after:structuredClone(row)});},
   replace:async(row:T)=>{guard();this.check('write');const index=rows.findIndex(item=>item.id===row.id&&item.user_id===context.user_id);if(index<0)throw new Error('ROW_MISSING');const before=rows[index]!;if(before.created_at!==row.created_at)throw new Error('CREATION_CHANGED');rows[index]=structuredClone(row);changes.push({type,before:structuredClone(before),after:structuredClone(row)});},
  });
  const lookup=<T extends {id:string;user_id:string}>(rows:T[])=>({async get(id:string){guard();return structuredClone(rows.find(row=>row.id===id&&row.user_id===context.user_id)??null);}});
  const tx:FinanceSeriesTransaction={financeRevision:draft.revision,series:repo(draft.series,'finance_series'),occurrences:{...repo(draft.occurrences,'finance_series_occurrence'),async forSeries(id){guard();return structuredClone(draft.occurrences.filter(row=>row.series_id===id&&row.user_id===context.user_id));}},transactions:repo(draft.transactions,'finance_transaction'),accounts:lookup(this.accounts),categories:lookup([seriesCategory]),tags:lookup<EtiquetaFinanceira>([]),
   events:{append:async event=>{guard();this.check('event');if(event.user_id!==context.user_id||event.canal!==context.canal||draft.events.some(other=>other.id===event.id))throw new Error('EVENT_CONTEXT');draft.events.push(structuredClone(event));events.push(structuredClone(event));}},
   receipts:{get:async(command,clientId)=>{guard();return structuredClone(draft.receipts.find(row=>row.user_id===context.user_id&&row.command===command&&row.client_id===clientId)??null);},insert:async receipt=>{guard();this.check('receipt');if(receipt.user_id!==context.user_id||draft.receipts.some(row=>row.command===receipt.command&&row.client_id===receipt.client_id))throw new Error('RECEIPT_CONTEXT');draft.receipts.push(structuredClone(receipt));}},
  };
  try{
   guard();const answer=await work(tx);active=false;
   for(const change of changes){const matching=events.filter(event=>event.entity_type===change.type&&event.entity_id===change.after.id&&assinatura(event.before)===assinatura(change.before)&&assinatura(event.after)===assinatura(change.after));if(matching.length!==1)throw new Error('EXACT_EVENT_REQUIRED');}
   if(events.length!==changes.length)throw new Error('ORPHAN_EVENT');
   const keys=new Set<string>(),transactionIds=new Set<string>();
   for(const occurrence of draft.occurrences){const key=`${occurrence.user_id}:${occurrence.series_id}:${occurrence.index}`;if(keys.has(key)||transactionIds.has(occurrence.transaction_id)||!draft.series.some(row=>row.id===occurrence.series_id&&row.user_id===occurrence.user_id)||!draft.transactions.some(row=>row.id===occurrence.transaction_id&&row.user_id===occurrence.user_id))throw new Error('OCCURRENCE_CONSTRAINT');keys.add(key);transactionIds.add(occurrence.transaction_id);}
   this.check('commit');if(changes.length||draft.receipts.length!==this.state.receipts.length)draft.revision=String(BigInt(draft.revision)+1n);this.state=draft;return structuredClone(answer);
  }finally{active=false;release();}
 }
}
