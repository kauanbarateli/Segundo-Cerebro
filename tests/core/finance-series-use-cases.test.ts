import {describe,expect,it} from 'vitest';
import {executeFinanceSeriesCommand} from '../../src/core/financeiro/series/series-use-cases';
import {decodeFinanceSeriesCommand,definitionOfSeries,type FinanceSeriesCommand} from '../../src/core/financeiro/series';
import {SeriesMemoryFixture} from '../fixtures/finance-series-store';
import {managedSeries,seriesAccount,seriesId,SERIES_OWNER,SERIES_NOW} from '../fixtures/finance-series';
const context={user_id:SERIES_OWNER,canal:'web' as const};
type WithOptionalFinanceRevision<C>=C extends {command:infer K;input:infer I}?{command:K;input:Omit<I,'expected_finance_revision'>&{expected_finance_revision?:string}}:never;
type TestSeriesCommand=WithOptionalFinanceRevision<FinanceSeriesCommand>;
const create=(client=10):TestSeriesCommand=>({command:'finance.recurring.create',input:{client_id:seriesId(client),definition:definitionOfSeries(managedSeries()),horizon:{from_on:'2026-10-23',until_exclusive:'2027-10-23'},statement_assignments:[]}});
function setup(options:ConstructorParameters<typeof SeriesMemoryFixture>[0]={}){
 let id=1000,clock=SERIES_NOW;const store=new SeriesMemoryFixture(options),deps={ids:{next:()=>seriesId(++id)},clock:{now:()=>clock}},pins=new Map<string,string>();
 const prepare=(request:TestSeriesCommand)=>{const key=`${request.command}:${request.input.client_id}`,revision=request.input.expected_finance_revision??pins.get(key)??store.state.revision;const decoded=decodeFinanceSeriesCommand({...request,input:{...request.input,expected_finance_revision:revision}});if(!pins.has(key))pins.set(key,revision);return decoded;};
 return {store,deps,prepare,setNow(value:string){clock=value;},run:(request:TestSeriesCommand)=>executeFinanceSeriesCommand(store,deps,context,prepare(request))};
}
describe('T053-B2: casos de uso sobre port v2 atômico injetado',()=>{
 it('cria série/mapas/linhas com eventos exatos e um recibo; duplo envio não duplica',async()=>{
  const h=setup(),[a,b]=await Promise.all([h.run(create()),h.run(create())]);expect(a).toEqual(b);expect(a.affected.created).toBe(12);
  expect(h.store.state.series).toHaveLength(1);expect(h.store.state.transactions).toHaveLength(12);expect(h.store.state.occurrences).toHaveLength(12);expect(h.store.state.events).toHaveLength(25);expect(h.store.state.receipts).toHaveLength(1);
  expect(h.store.state.transactions.every(row=>row.status==='planned'&&row.paid_cents===0)).toBe(true);
  const changed=create();if(changed.command==='finance.recurring.create')changed.input.definition.template.amount_cents=20000;
  await expect(h.run(changed)).rejects.toMatchObject({code:'CONFLICT'});expect(h.store.state.transactions).toHaveLength(12);
 });
 it.each([['write',11],['event',11],['receipt',1],['commit',1]] as const)('falha %s/%s reverte linhas/mapas/metadados/eventos/recibo',async(point,n)=>{
  const h=setup(),before=structuredClone(h.store.state);h.store.fail(point,n);await expect(h.run(create())).rejects.toThrow('INJECTED_');expect(h.store.state).toEqual(before);
 });
 it('materialização concorrente conflitante não duplica ordinais e preserva recibo original',async()=>{
  const h=setup(),initial=create();if(initial.command==='finance.recurring.create')initial.input.definition.total=24;const created=await h.run(initial);
  const request:TestSeriesCommand={command:'finance.recurring.materialize',input:{client_id:seriesId(11),series_id:created.series.id,expected_revision:'0',horizon:{from_on:'2027-10-23',until_exclusive:'2028-10-23'},statement_assignments:[]}};
  const [a,b]=await Promise.allSettled([h.run(request),h.run({...request,input:{...request.input,client_id:seriesId(12)}})]);
  expect([a,b].filter(row=>row.status==='fulfilled')).toHaveLength(1);expect([a,b].filter(row=>row.status==='rejected')).toHaveLength(1);
  expect(h.store.state.transactions).toHaveLength(24);expect(new Set(h.store.state.occurrences.map(row=>row.index)).size).toBe(24);
  await expect(h.run(request)).resolves.toMatchObject({affected:{created:12}});expect(h.store.state.transactions).toHaveLength(24);
 });
 it('pausa conserva realização parcial e encerramento não recria excluídas manualmente',async()=>{
  const h=setup(),created=await h.run(create());const first=h.store.state.occurrences[0]!,second=h.store.state.occurrences[1]!;
  const paid=await h.run({command:'finance.recurring.occurrence.update',input:{client_id:seriesId(11),series_id:created.series.id,expected_revision:'0',occurrence_id:first.id,patch:{status:'confirmed',paid_cents:500}}});
  const cancelled=await h.run({command:'finance.recurring.occurrence.cancel',input:{client_id:seriesId(12),series_id:created.series.id,expected_revision:paid.series.revision,occurrence_id:second.id}});
  const paused=await h.run({command:'finance.recurring.pause',input:{client_id:seriesId(13),series_id:created.series.id,expected_revision:cancelled.series.revision,from_on:'2026-10-23'}});
  expect(paused.series.state).toBe('paused');expect(paused.affected.suppressed).toBe(10);
  expect(h.store.state.transactions.find(row=>row.id===first.transaction_id)).toMatchObject({paid_cents:500,status:'confirmed',deleted_at:null});
  expect(h.store.state.occurrences.find(row=>row.id===second.id)!.suppression).toBe('manual');
  const ended=await h.run({command:'finance.recurring.end',input:{client_id:seriesId(14),series_id:created.series.id,expected_revision:paused.series.revision,from_on:'2026-10-23'}});
  expect(ended.series.state).toBe('ended');expect(h.store.state.occurrences.find(row=>row.id===second.id)!.suppression).toBe('manual');
  expect(h.store.state.transactions.find(row=>row.id===first.transaction_id)!.paid_cents).toBe(500);
 });
 it('ator diferente e revisão antiga não escrevem nem recebem resultado alheio',async()=>{
  const h=setup(),created=await h.run(create()),before=structuredClone(h.store.state);
  await expect(executeFinanceSeriesCommand(h.store,h.deps,{...context,user_id:seriesId(999)},h.prepare(create()))).rejects.toThrow();expect(h.store.state).toEqual(before);
  await expect(h.run({command:'finance.recurring.pause',input:{client_id:seriesId(15),series_id:created.series.id,expected_revision:'99',from_on:'2026-10-23'}})).rejects.toMatchObject({code:'CONFLICT'});expect(h.store.state).toEqual(before);
 });
 it('resume restaura todas as previstas elegíveis além do horizonte de novas criações',async()=>{
  const h=setup(),created=await h.run(create()),original=structuredClone(h.store.state.transactions);
  const paused=await h.run({command:'finance.recurring.pause',input:{client_id:seriesId(11),series_id:created.series.id,expected_revision:'0',from_on:'2026-10-23'}});
  const resumed=await h.run({command:'finance.recurring.resume',input:{client_id:seriesId(12),series_id:created.series.id,expected_revision:paused.series.revision,horizon:{from_on:'2026-10-23',until_exclusive:'2026-11-23'},statement_assignments:[]}});
  expect(resumed.affected).toMatchObject({restored:12,created:0});expect(resumed.series.state).toBe('active');expect(h.store.state.transactions).toHaveLength(12);
  expect(h.store.state.transactions.map(row=>({id:row.id,date:row.occurred_on,amount:row.amount_cents,status:row.status,paid:row.paid_cents}))).toEqual(original.map(row=>({id:row.id,date:row.occurred_on,amount:row.amount_cents,status:row.status,paid:row.paid_cents})));
  expect(h.store.state.transactions.every(row=>row.deleted_at===null)).toBe(true);expect(h.store.state.occurrences.every(row=>row.suppression==='none')).toBe(true);
 });
 it('resume não traz meses que passaram durante a pausa nem exclusão manual',async()=>{
  const h=setup(),request=create();if(request.command==='finance.recurring.create')request.input.definition.total=24;const created=await h.run(request);
  const manual=h.store.state.occurrences[4]!;
  const cancelled=await h.run({command:'finance.recurring.occurrence.cancel',input:{client_id:seriesId(11),series_id:created.series.id,expected_revision:'0',occurrence_id:manual.id}});
  const paused=await h.run({command:'finance.recurring.pause',input:{client_id:seriesId(12),series_id:created.series.id,expected_revision:cancelled.series.revision,from_on:'2026-10-23'}});
  h.setNow('2027-01-23T12:00:00.000Z');
  const resumed=await h.run({command:'finance.recurring.resume',input:{client_id:seriesId(13),series_id:created.series.id,expected_revision:paused.series.revision,horizon:{from_on:'2027-01-23',until_exclusive:'2028-01-23'},statement_assignments:[]}});
  expect(resumed.affected).toMatchObject({restored:8,created:3});
  expect(h.store.state.occurrences.filter(row=>row.index<=3).every(row=>row.suppression==='series_pause')).toBe(true);expect(h.store.state.occurrences.find(row=>row.id===manual.id)!.suppression).toBe('manual');
  expect(h.store.state.transactions.filter(row=>row.deleted_at===null).every(row=>row.occurred_on>='2027-01-23'&&row.status==='planned'&&row.paid_cents===0)).toBe(true);
 });
 it('edição de recorrência altera só futuras elegíveis e replay não reemite eventos',async()=>{
  const h=setup(),created=await h.run(create()),first=h.store.state.occurrences[0]!,second=h.store.state.occurrences[1]!;
  const paid=await h.run({command:'finance.recurring.occurrence.update',input:{client_id:seriesId(11),series_id:created.series.id,expected_revision:'0',occurrence_id:first.id,patch:{status:'confirmed',paid_cents:500}}});
  const cancelled=await h.run({command:'finance.recurring.occurrence.cancel',input:{client_id:seriesId(12),series_id:created.series.id,expected_revision:paid.series.revision,occurrence_id:second.id}});
  const request:TestSeriesCommand={command:'finance.recurring.update_future',input:{client_id:seriesId(13),series_id:created.series.id,expected_revision:cancelled.series.revision,from_on:'2026-10-23',patch:{template:{...created.series.template,description:'Nova descrição',amount_cents:20000}},statement_assignments:[]}};
  const saved=await h.run(request),events=h.store.state.events.length;expect(saved.affected).toMatchObject({updated:10,skipped:2});
  expect(h.store.state.transactions.find(row=>row.id===first.transaction_id)).toMatchObject({amount_cents:10000,paid_cents:500,status:'confirmed'});expect(h.store.state.transactions.find(row=>row.id===second.transaction_id)!.amount_cents).toBe(10000);
  expect(h.store.state.transactions.filter(row=>row.deleted_at===null&&row.status==='planned').every(row=>row.amount_cents===20000&&row.paid_cents===0)).toBe(true);
  expect(await h.run(request)).toEqual(saved);expect(h.store.state.events).toHaveLength(events);
 });
 it('parcelamento mantém total original e resto; aceita editar descrição sem redividir pagos',async()=>{
  const h=setup(),request=create();if(request.command==='finance.recurring.create'){request.input.definition.kind='parcelamento';request.input.definition.template.amount_cents=10000;}const created=await h.run(request),before=structuredClone(h.store.state);
  await expect(h.run({command:'finance.recurring.update_future',input:{client_id:seriesId(11),series_id:created.series.id,expected_revision:'0',from_on:'2026-10-23',patch:{template:{...created.series.template,amount_cents:12000}},statement_assignments:[]}})).rejects.toThrow('total original');expect(h.store.state).toEqual(before);
  await h.run({command:'finance.recurring.update_future',input:{client_id:seriesId(12),series_id:created.series.id,expected_revision:'0',from_on:'2026-10-23',patch:{template:{...created.series.template,description:'Descrição revisada'}},statement_assignments:[]}});
  expect(h.store.state.transactions.map(row=>row.amount_cents)).toEqual(before.transactions.map(row=>row.amount_cents));expect(h.store.state.transactions.at(-1)!.amount_cents).toBe(837);
 });
 it('estender corte ainda não materializado preserva cursor, IDs anteriores e replay',async()=>{
  const h=setup(),request=create();if(request.command==='finance.recurring.create'){request.input.definition.total=24;request.input.definition.ends_on='2026-12-23';}const created=await h.run(request),ids=h.store.state.transactions.map(row=>row.id);expect(created.series.next_index).toBe(4);
  const extended=await h.run({command:'finance.recurring.update_future',input:{client_id:seriesId(11),series_id:created.series.id,expected_revision:'0',from_on:'2026-10-23',patch:{ends_on:null},statement_assignments:[]}});
  const generate:TestSeriesCommand={command:'finance.recurring.materialize',input:{client_id:seriesId(12),series_id:created.series.id,expected_revision:extended.series.revision,horizon:{from_on:'2027-01-23',until_exclusive:'2028-01-23'},statement_assignments:[]}};
  const saved=await h.run(generate);expect(saved.affected.created).toBe(12);expect(h.store.state.transactions.slice(0,3).map(row=>row.id)).toEqual(ids);
  const events=h.store.state.events.length;expect(await h.run(generate)).toEqual(saved);expect(h.store.state.events).toHaveLength(events);expect(new Set(h.store.state.occurrences.map(row=>row.index)).size).toBe(15);
 });
 it('novo término não remove realizado/partial e extensão não restaura encerradas existentes',async()=>{
  const h=setup(),created=await h.run(create()),future=h.store.state.occurrences[10]!;
  const paid=await h.run({command:'finance.recurring.occurrence.update',input:{client_id:seriesId(11),series_id:created.series.id,expected_revision:'0',occurrence_id:future.id,patch:{status:'confirmed',paid_cents:100}}});const before=structuredClone(h.store.state);
  await expect(h.run({command:'finance.recurring.update_future',input:{client_id:seriesId(12),series_id:created.series.id,expected_revision:paid.series.revision,from_on:'2026-10-23',patch:{ends_on:'2026-12-23'},statement_assignments:[]}})).rejects.toThrow('término');expect(h.store.state).toEqual(before);
  const other=setup(),fresh=await other.run(create());
  const shortened=await other.run({command:'finance.recurring.update_future',input:{client_id:seriesId(11),series_id:fresh.series.id,expected_revision:'0',from_on:'2026-10-23',patch:{ends_on:'2026-12-23'},statement_assignments:[]}});expect(shortened.affected.suppressed).toBe(9);
  await other.run({command:'finance.recurring.update_future',input:{client_id:seriesId(12),series_id:fresh.series.id,expected_revision:shortened.series.revision,from_on:'2026-10-23',patch:{ends_on:null},statement_assignments:[]}});
  expect(other.store.state.occurrences.filter(row=>row.suppression==='ended')).toHaveLength(9);expect(other.store.state.transactions.filter(row=>row.deleted_at===null)).toHaveLength(3);
 });
 it('editar descrição de cartão conserva competência já atribuída mesmo após mudar o fechamento',async()=>{
  const card={...seriesAccount,kind:'credit_card' as const,credit_limit_cents:100000,statement_closing_day:20,payment_due_day:5},h=setup({accounts:[card]}),request=create();if(request.command==='finance.recurring.create')request.input.definition.template.statement_mode='account_cycle';
  const created=await h.run(request),months=h.store.state.transactions.map(row=>row.statement_month);expect(months[0]).toBe('2026-11-01');h.store.accounts[0]!.statement_closing_day=28;
  await h.run({command:'finance.recurring.update_future',input:{client_id:seriesId(11),series_id:created.series.id,expected_revision:'0',from_on:'2026-10-23',patch:{template:{...created.series.template,description:'Texto revisado'}},statement_assignments:[]}});
  expect(h.store.state.transactions.map(row=>row.statement_month)).toEqual(months);expect(h.store.state.transactions.every(row=>row.status==='planned'&&row.paid_cents===row.amount_cents)).toBe(true);
 });
 it.each(['resume','update'] as const)('falha no recibo de %s reverte também estado, motivo e configuração',async action=>{
  const h=setup(),created=await h.run(create());let request:TestSeriesCommand;
  if(action==='resume'){
   const paused=await h.run({command:'finance.recurring.pause',input:{client_id:seriesId(11),series_id:created.series.id,expected_revision:'0',from_on:'2026-10-23'}});
   request={command:'finance.recurring.resume',input:{client_id:seriesId(12),series_id:created.series.id,expected_revision:paused.series.revision,horizon:{from_on:'2026-10-23',until_exclusive:'2027-10-23'},statement_assignments:[]}};
  }else request={command:'finance.recurring.update_future',input:{client_id:seriesId(12),series_id:created.series.id,expected_revision:'0',from_on:'2026-10-23',patch:{template:{...created.series.template,amount_cents:25000}},statement_assignments:[]}};
  const before=structuredClone(h.store.state);h.store.fail('receipt',1);await expect(h.run(request)).rejects.toThrow('INJECTED_RECEIPT');expect(h.store.state).toEqual(before);
 });
 it('quitar ocorrência comum é explícito; conta arquivada não recebe realização nova',async()=>{
  const h=setup(),created=await h.run(create()),first=h.store.state.occurrences[0]!,second=h.store.state.occurrences[1]!;
  const paid=await h.run({command:'finance.recurring.occurrence.update',input:{client_id:seriesId(11),series_id:created.series.id,expected_revision:'0',occurrence_id:first.id,patch:{status:'confirmed',paid_cents:10000}}});
  expect(h.store.state.transactions.find(row=>row.id===first.transaction_id)).toMatchObject({paid_cents:10000,status:'confirmed'});expect(h.store.state.transactions.find(row=>row.id===second.transaction_id)).toMatchObject({paid_cents:0,status:'planned'});
  h.store.accounts[0]!.archived_at=SERIES_NOW;const before=structuredClone(h.store.state);
  await expect(h.run({command:'finance.recurring.occurrence.update',input:{client_id:seriesId(12),series_id:created.series.id,expected_revision:paid.series.revision,occurrence_id:second.id,patch:{status:'confirmed',paid_cents:10000}}})).rejects.toThrow('conta arquivada');expect(h.store.state).toEqual(before);
 });
 it('prévia de cartão perde CAS após mudar fechamento; replay original continua válido após outra mudança',async()=>{
  const card={...seriesAccount,kind:'credit_card' as const,credit_limit_cents:100000,statement_closing_day:20,payment_due_day:5},h=setup({accounts:[card]}),initial=create();if(initial.command==='finance.recurring.create'){initial.input.definition.total=24;initial.input.definition.template.statement_mode='account_cycle';}const created=await h.run(initial);
  const intent=h.prepare({command:'finance.recurring.materialize',input:{client_id:seriesId(11),series_id:created.series.id,expected_revision:'0',horizon:{from_on:'2027-10-23',until_exclusive:'2028-10-23'},statement_assignments:[]}});
  if(intent.command!=='finance.recurring.materialize')throw new Error('Expected materialization fixture');
  // Synthetic equivalent of an independently committed v1 account change.
  h.store.accounts[0]!.statement_closing_day=28;h.store.state.revision=String(BigInt(h.store.state.revision)+1n);const before=structuredClone(h.store.state);
  await expect(h.run(intent)).rejects.toMatchObject({code:'CONFLICT'});expect(h.store.state).toEqual(before);expect(h.store.state.transactions).toHaveLength(12);
  const refreshed={...intent,input:{...intent.input,client_id:seriesId(12),expected_finance_revision:h.store.state.revision}},saved=await h.run(refreshed);
  expect(saved.affected.created).toBe(12);expect(h.store.state.transactions[12]!.statement_month).toBe('2027-10-01');
  h.store.accounts[0]!.statement_closing_day=20;h.store.state.revision=String(BigInt(h.store.state.revision)+1n);const afterExternalChange=structuredClone(h.store.state);
  expect(await h.run(refreshed)).toEqual(saved);expect(h.store.state).toEqual(afterExternalChange);
 });
});
