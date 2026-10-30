import {describe,expect,it} from 'vitest';
import {decodeFinanceSeriesCommand,definitionOfSeries,validateSeriesDefinition,validateSeriesTemplate} from '../../src/core/financeiro/series';
import {managedSeries,seriesId} from '../fixtures/finance-series';
const create=()=>({command:'finance.recurring.create',input:{client_id:seriesId(10),expected_finance_revision:'0',definition:definitionOfSeries(managedSeries()),horizon:{from_on:'2026-10-23',until_exclusive:'2027-10-23'},statement_assignments:[]}});
const common={client_id:seriesId(10),expected_finance_revision:'0',series_id:seriesId(4),expected_revision:'0'};
describe('T053-B1: DTO v2 fechado',()=>{
 it('clona a intenção sem SDK/batches/dono e mantém os campos imutáveis da definição',()=>{
  const request=create(),decoded=decodeFinanceSeriesCommand(request);expect(decoded).toEqual(request);expect(decoded).not.toBe(request);request.input.definition.template.description='alterado depois';expect(decoded.input).not.toEqual(request.input);
 });
 it.each(['user_id','session_id','changes','events','receipts','role','payment','paid_cents'])('recusa campo arbitrário %s no comando',field=>expect(()=>decodeFinanceSeriesCommand({...create(),input:{...create().input,[field]:'injected'}})).toThrow());
 it.each([1,121,0,-1,2.5])('recusa total inválido %s',total=>expect(()=>validateSeriesDefinition({...definitionOfSeries(managedSeries()),total})).toThrow());
 it('aceita posição1 ou final, sem permitir posição0/acima do total ou parcela menor que um centavo',()=>{
  const definition=definitionOfSeries(managedSeries());expect(()=>validateSeriesDefinition({...definition,first_index:12})).not.toThrow();
  expect(()=>validateSeriesDefinition({...definition,first_index:0})).toThrow();expect(()=>validateSeriesDefinition({...definition,first_index:13})).toThrow();
  expect(()=>validateSeriesDefinition({...definition,kind:'parcelamento',template:{...definition.template,amount_cents:11}})).toThrow();
 });
 it('editar próximas não aceita frequência, âncora, grupo nem marcação de pagamento',()=>{
  for(const field of ['frequency','anchor_on','first_index','total','paid_cents','status','installment_group_id'])expect(()=>decodeFinanceSeriesCommand({command:'finance.recurring.update_future',input:{...common,from_on:'2026-10-23',patch:{[field]:'injected'},statement_assignments:[]}})).toThrow();
  expect(()=>decodeFinanceSeriesCommand({command:'finance.recurring.update_future',input:{...common,from_on:'2026-10-23',patch:{ends_on:null},statement_assignments:[]}})).not.toThrow();
 });
 it('UUID, revisão e enums não sofrem coerção de tipos',()=>{
  expect(()=>decodeFinanceSeriesCommand({command:'finance.recurring.pause',input:{...common,expected_revision:0,from_on:'2026-10-23'}})).toThrow();
  expect(()=>decodeFinanceSeriesCommand({command:'finance.recurring.pause',input:{...common,client_id:'not-a-uuid',from_on:'2026-10-23'}})).toThrow();
  expect(()=>validateSeriesTemplate({...managedSeries().template,statement_mode:['none']})).toThrow();expect(()=>validateSeriesDefinition({...definitionOfSeries(managedSeries()),frequency:['monthly']})).toThrow();
 });
 it('competências exigem dia1 e posição única; realização não pode alterar valor/data/conta',()=>{
  const base=create();expect(()=>decodeFinanceSeriesCommand({...base,input:{...base.input,statement_assignments:[{index:1,statement_month:'2026-10-01'},{index:1,statement_month:'2026-11-01'}]}})).toThrow();
  expect(()=>decodeFinanceSeriesCommand({...base,input:{...base.input,statement_assignments:[{index:1,statement_month:'2026-10-02'}]}})).toThrow();
  const update={command:'finance.recurring.occurrence.update',input:{...common,occurrence_id:seriesId(201),patch:{status:'confirmed',paid_cents:10000}}};expect(()=>decodeFinanceSeriesCommand(update)).not.toThrow();
  for(const field of ['amount_cents','occurred_on','account_id','statement_month'])expect(()=>decodeFinanceSeriesCommand({...update,input:{...update.input,patch:{...update.input.patch,[field]:'injected'}}})).toThrow();
 });
 it.each([undefined,0,'00','-1','1.0','9223372036854775808'])('revisão financeira inválida %s é recusada em qualquer operação',expected_finance_revision=>{
  const request=create();expect(()=>decodeFinanceSeriesCommand({...request,input:{...request.input,expected_finance_revision}})).toThrow();
  expect(()=>decodeFinanceSeriesCommand({command:'finance.recurring.pause',input:{...common,expected_finance_revision,from_on:'2026-10-23'}})).toThrow();
 });
 it('revisão acima do inteiro seguro JS continua texto exato, sem coerção por Number',()=>{
  const request=create(),revision='9007199254740993';expect(decodeFinanceSeriesCommand({...request,input:{...request.input,expected_finance_revision:revision}}).input.expected_finance_revision).toBe(revision);
 });
});
