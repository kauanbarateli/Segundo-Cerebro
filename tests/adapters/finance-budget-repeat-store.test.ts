import {describe,expect,it,vi} from 'vitest';
vi.mock('server-only',()=>({}));
import {assinatura,ErroDeDominio,type ReciboIdempotente} from '../../src/core/contracts';
import {salvarOrcamentoFinanceiro} from '../../src/core/financeiro';
import {createFinanceStore,type FinanceCommit,type FinanceGateway,type FinanceSnapshot} from '../../src/adapters/db/finance-store';
import {CommitOutcomeUnknown} from '../../src/adapters/db/capture-task-store';
import {FINANCE_ACTOR,FINANCE_NOW} from '../fixtures/finance-regression';

/** Atomic injected transport only: CAS/reconciliation coverage, not PostgreSQL proof. */
class BudgetTransport implements FinanceGateway {
 readonly actorId=FINANCE_ACTOR;
 state:FinanceSnapshot={revision:'0',accounts:[],categories:[],transactions:[],budgets:[],tags:[],events:[],receipts:[]};
 calls:FinanceCommit[]=[];loseResponse=false;receiptUnavailable=false;failAt=-1;
 async snapshot(){return structuredClone(this.state);}
 async currentRevision(){return this.state.revision;}
 async receipt(command:string,clientId:string):Promise<ReciboIdempotente|null>{
  if(this.receiptUnavailable)throw new Error('INJECTED_RECEIPT_UNAVAILABLE');
  return structuredClone(this.state.receipts.find(row=>row.command===command&&row.client_id===clientId)??null);
 }
 async commit(request:FinanceCommit){
  this.calls.push(structuredClone(request));
  const receipt=this.state.receipts.find(row=>row.command===request.receipt.command&&row.client_id===request.receipt.client_id);
  if(receipt){if(receipt.fingerprint!==request.receipt.fingerprint)throw new ErroDeDominio('CONFLICT','Different intent');return {status:'replayed' as const,result:structuredClone(receipt.result)};}
  if(request.expectedRevision!==this.state.revision)return {status:'stale' as const};
  const draft=structuredClone(this.state);
  for(const [index,change]of request.changes.entries()){
   if(index===this.failAt)throw new Error('INJECTED_ELEVENTH_FAILURE');
   if(change.type!=='finance_budget')throw new Error('NON_BUDGET_CHANGE');
   const at=draft.budgets.findIndex(row=>row.id===change.after.id);
   if(assinatura(at<0?null:draft.budgets[at])!==assinatura(change.before))throw new Error('STALE_BEFORE');
   const row=change.after as FinanceSnapshot['budgets'][number];
   if(at<0)draft.budgets.push(structuredClone(row));else draft.budgets[at]=structuredClone(row);
  }
  draft.events.push(...structuredClone(request.events));draft.receipts.push(structuredClone(request.receipt));
  draft.revision=String(BigInt(draft.revision)+1n);this.state=draft;
  if(this.loseResponse){this.loseResponse=false;throw new CommitOutcomeUnknown();}
  return {status:'committed' as const,result:structuredClone(request.receipt.result)};
 }
}
function setup(){let next=0;const gateway=new BudgetTransport(),store=createFinanceStore(gateway);return {gateway,store,deps:{clock:{now:()=>FINANCE_NOW},ids:{next:()=>`repeat-store-${++next}`}}};}
const context={user_id:FINANCE_ACTOR,canal:'web' as const};
const input={client_id:'repeat-store',category_id:null,month:'2026-10-01',limit_cents:450000,repeat_months:12 as const};

describe('T053-A: batch através do adapter financeiro real e transporte injetado',()=>{
 it('envia12 mudanças/eventos num único CAS e reconcilia resposta perdida sem reaplicar',async()=>{
  const h=setup();h.gateway.loseResponse=true;
  const first=await salvarOrcamentoFinanceiro(h.store,h.deps,context,input);
  expect(h.gateway.calls).toHaveLength(1);expect(h.gateway.calls[0]!.changes).toHaveLength(12);expect(h.gateway.calls[0]!.events).toHaveLength(12);
  expect(h.gateway.state.budgets).toHaveLength(12);expect(h.gateway.state.events).toHaveLength(12);expect(h.gateway.state.receipts).toHaveLength(1);
  expect(first).toEqual(h.gateway.state.receipts[0]!.result);
  expect(await salvarOrcamentoFinanceiro(h.store,h.deps,context,input)).toEqual(first);expect(h.gateway.state.events).toHaveLength(12);
 });
 it('dois comandos com snapshot igual refazem o CAS e preservam12 slots sem lote híbrido',async()=>{
  const h=setup();await Promise.all([salvarOrcamentoFinanceiro(h.store,h.deps,context,input),salvarOrcamentoFinanceiro(h.store,h.deps,context,{...input,client_id:'competing',limit_cents:700000})]);
  expect(h.gateway.calls.length).toBeGreaterThan(2);expect(h.gateway.state.budgets).toHaveLength(12);
  expect(new Set(h.gateway.state.budgets.map(row=>row.month)).size).toBe(12);expect(new Set(h.gateway.state.budgets.map(row=>row.limit_cents)).size).toBe(1);
  expect(h.gateway.state.events).toHaveLength(24);expect(h.gateway.state.receipts).toHaveLength(2);
 });
 it('falha na11ª mudança não confirma nada e reenvio explícito usa a intenção original',async()=>{
  const h=setup();h.gateway.failAt=10;
  await expect(salvarOrcamentoFinanceiro(h.store,h.deps,context,input)).rejects.toThrow('INJECTED_ELEVENTH_FAILURE');
  expect(h.gateway.state.budgets).toEqual([]);expect(h.gateway.state.events).toEqual([]);expect(h.gateway.state.receipts).toEqual([]);
  h.gateway.failAt=-1;await salvarOrcamentoFinanceiro(h.store,h.deps,context,input);
  expect(h.gateway.calls.map(call=>call.receipt.client_id)).toEqual([input.client_id,input.client_id]);expect(h.gateway.state.budgets).toHaveLength(12);
 });
 it('commit incerto sem consulta de recibo não recebe retry automático e conserva recuperação por mesmo UUID',async()=>{
  const h=setup();h.gateway.loseResponse=true;h.gateway.receiptUnavailable=true;
  await expect(salvarOrcamentoFinanceiro(h.store,h.deps,context,input)).rejects.toBeInstanceOf(CommitOutcomeUnknown);
  expect(h.gateway.calls).toHaveLength(1);expect(h.gateway.state.events).toHaveLength(12);
  h.gateway.receiptUnavailable=false;const result=await salvarOrcamentoFinanceiro(h.store,h.deps,context,input);
  expect(result).toEqual(h.gateway.state.receipts[0]!.result);expect(h.gateway.state.events).toHaveLength(12);expect(h.gateway.state.receipts).toHaveLength(1);
 });
});
