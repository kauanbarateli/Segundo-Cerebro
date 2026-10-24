import {describe,expect,it,vi} from 'vitest';
vi.mock('server-only',()=>({}));
import {decodeFinanceRequest} from '../../src/adapters/db/finance-commands';
import {validDomainCommandInput} from '../../src/lib/demo/client-command-specs';

const input={client_id:'budget-repeat',category_id:null,month:'2026-10-01',limit_cents:450000};
describe('T053-A: extensão fechada do comando financeiro v1',()=>{
 it('preserva ausência legada e aceita repetição somente como campo da intenção',()=>{
  expect(decodeFinanceRequest({command:'finance.budget.save',input})).toEqual({command:'finance.budget.save',input});
  expect(Object.hasOwn(decodeFinanceRequest({command:'finance.budget.save',input}).input,'repeat_months')).toBe(false);
  const repeated={...input,repeat_months:12};
  expect(decodeFinanceRequest({command:'finance.budget.save',input:repeated})).toEqual({command:'finance.budget.save',input:repeated});
  expect(validDomainCommandInput('finance.budget.save',repeated)).toBe(true);
 });
 it.each([{user_id:'10000000-0000-4000-8000-000000000001'},{budgets:[]},{changes:[]},{events:[]},{months:['2026-10-01']},{role:'master'}])('não transforma a extensão em batch/dono/moderação do navegador: %j',extra=>{
  expect(()=>decodeFinanceRequest({command:'finance.budget.save',input:{...input,...extra}})).toThrow();
  expect(validDomainCommandInput('finance.budget.save',{...input,...extra})).toBe(false);
 });
});
