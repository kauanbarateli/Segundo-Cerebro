import { describe, expect, it } from 'vitest';
import { criarAdapterMemoria, type PontoDeFalha } from '../../src/adapters/memory';
import { salvarOrcamentoFinanceiro, type SalvarOrcamentoFinanceiro } from '../../src/core/financeiro';
import { createDemoFixture, DEMO_NOW, DEMO_USER_ID } from '../../src/lib/demo/fixtures';

const context = {user_id:DEMO_USER_ID,canal:'web' as const};
function setup(duplicateBudget=false) {
  let id=0, point:PontoDeFalha|null=null, target=0, count=0;
  const deps={clock:{now:()=>DEMO_NOW},ids:{next:()=>`budget-repeat-${++id}`}};
  const initial=createDemoFixture().initial;
  if(duplicateBudget)initial.finance_budget=[...initial.finance_budget!,{...initial.finance_budget![0]!,id:'duplicate-budget-slot'}];
  const store=criarAdapterMemoria({...deps,initial,beforeOperation(value){if(value===point&&++count===target)throw new Error('INJECTED_ATOMIC_FAILURE');}});
  return {store,deps,read:store.read(DEMO_USER_ID),fail(value:PontoDeFalha,n:number){point=value;target=n;count=0;}};
}
const input:SalvarOrcamentoFinanceiro={client_id:'repeat-total',category_id:null,month:'2026-10-01',limit_cents:450000,repeat_months:12};
describe('T053-A: orçamento total e repetição atômica',()=>{
  it('omite repeat_months no fingerprint legado e conserva resultado v1',async()=>{
    const h=setup(), legacy={client_id:'legacy-budget',category_id:null,month:'2026-10-01',limit_cents:450000};
    const row=await salvarOrcamentoFinanceiro(h.store,h.deps,context,legacy);
    expect(row).toMatchObject({category_id:null,month:'2026-10-01',limit_cents:450000});
    expect(await salvarOrcamentoFinanceiro(h.store,h.deps,context,legacy)).toEqual(row);
    await h.store.transaction(context,async tx=>{const receipt=await tx.recibos.get('finance.budget.save',legacy.client_id);expect(receipt!.fingerprint).not.toContain('repeat_months');expect(receipt!.result).toEqual(row);});
    expect((await h.read.eventos.list()).filter(event=>event.entity_type==='finance_budget')).toHaveLength(1);
  });
  it('grava12 competências consecutivas, um recibo e nenhum lançamento/saldo novo',async()=>{
    const h=setup(), accounts=await h.read.financeiro.contas.list(), ledger=await h.read.financeiro.lancamentos.list({includeDeleted:true});
    const first=await salvarOrcamentoFinanceiro(h.store,h.deps,context,input);
    const rows=(await h.read.financeiro.orcamentos.list()).filter(row=>row.category_id===null).sort((a,b)=>a.month.localeCompare(b.month));
    expect(rows.map(row=>row.month)).toEqual(['2026-10-01','2026-11-01','2026-12-01','2027-01-01','2027-02-01','2027-03-01','2027-04-01','2027-05-01','2027-06-01','2027-07-01','2027-08-01','2027-09-01']);
    expect(rows.every(row=>row.limit_cents===450000)).toBe(true);expect(first).toEqual(rows[0]);
    expect(await h.read.eventos.list()).toHaveLength(12);expect(await h.read.financeiro.contas.list()).toEqual(accounts);expect(await h.read.financeiro.lancamentos.list({includeDeleted:true})).toEqual(ledger);
    expect(await salvarOrcamentoFinanceiro(h.store,h.deps,context,input)).toEqual(first);expect(await h.read.eventos.list()).toHaveLength(12);
    await expect(salvarOrcamentoFinanceiro(h.store,h.deps,context,{...input,limit_cents:450001})).rejects.toMatchObject({code:'CONFLICT'});
  });
  it('preserva IDs/criação dos limites substituídos e todas as outras categorias',async()=>{
    const h=setup(), before=await h.read.financeiro.orcamentos.list(), original=before[0]!;
    const saved=await salvarOrcamentoFinanceiro(h.store,h.deps,context,{...input,category_id:original.category_id,month:original.month});
    expect(saved).toMatchObject({id:original.id,created_at:original.created_at,limit_cents:450000});
    const after=await h.read.financeiro.orcamentos.list();
    for(const row of before.filter(row=>row.category_id!==original.category_id))expect(after.find(item=>item.id===row.id)).toEqual(row);
    expect(after.filter(row=>row.category_id===original.category_id)).toHaveLength(12);
  });
  it.each([0,2,11,13,120,null,'12'])('recusa repetição inválida %s antes de qualquer escrita',async repeat=>{
    const h=setup(), before=await h.read.financeiro.orcamentos.list();
    await expect(salvarOrcamentoFinanceiro(h.store,h.deps,context,{...input,repeat_months:repeat as 12})).rejects.toMatchObject({code:'VALIDATION'});
    expect(await h.read.financeiro.orcamentos.list()).toEqual(before);expect(await h.read.eventos.list()).toEqual([]);
  });
  it('recusa intervalo além de9999 e categoria alheia sem deixar lote parcial',async()=>{
    const h=setup(), before=await h.read.financeiro.orcamentos.list();
    await expect(salvarOrcamentoFinanceiro(h.store,h.deps,context,{...input,month:'9999-12-01'})).rejects.toMatchObject({code:'VALIDATION'});
    await expect(salvarOrcamentoFinanceiro(h.store,h.deps,context,{...input,month:'0000-01-01'})).rejects.toMatchObject({code:'VALIDATION'});
    await expect(salvarOrcamentoFinanceiro(h.store,h.deps,context,{...input,month:'2026-00-01'})).rejects.toMatchObject({code:'VALIDATION'});
    await expect(salvarOrcamentoFinanceiro(h.store,h.deps,context,{...input,month:'2026-13-01'})).rejects.toMatchObject({code:'VALIDATION'});
    await expect(salvarOrcamentoFinanceiro(h.store,h.deps,context,{...input,category_id:'category-owned-by-other'})).rejects.toThrow();
    expect(await h.read.financeiro.orcamentos.list()).toEqual(before);expect(await h.read.eventos.list()).toEqual([]);
  });
  it('recusa origem inconsistente com dois limites da mesma categoria/competência',async()=>{
    const h=setup(true),before=await h.read.financeiro.orcamentos.list(),original=before[0]!;
    await expect(salvarOrcamentoFinanceiro(h.store,h.deps,context,{...input,category_id:original.category_id,month:original.month})).rejects.toMatchObject({code:'VALIDATION'});
    expect(await h.read.financeiro.orcamentos.list()).toEqual(before);expect(await h.read.eventos.list()).toEqual([]);
  });
  it.each([['write',11],['event',11],['write',13],['commit',1]] as const)('falha tardia %s/%s reverte orçamentos/eventos/recibo',async(point,n)=>{
    const h=setup(), before=await h.read.financeiro.orcamentos.list();h.fail(point,n);
    await expect(salvarOrcamentoFinanceiro(h.store,h.deps,context,input)).rejects.toThrow('INJECTED_ATOMIC_FAILURE');
    expect(await h.read.financeiro.orcamentos.list()).toEqual(before);expect(await h.read.eventos.list()).toEqual([]);
    await h.store.transaction(context,async tx=>{expect(await tx.recibos.get('finance.budget.save',input.client_id)).toBeNull();});
  });
  it('duplo envio concorrente usa o mesmo recibo; duas intenções preservam unicidade',async()=>{
    const h=setup();const [a,b]=await Promise.all([salvarOrcamentoFinanceiro(h.store,h.deps,context,input),salvarOrcamentoFinanceiro(h.store,h.deps,context,input)]);
    expect(a).toEqual(b);expect(await h.read.eventos.list()).toHaveLength(12);
    await Promise.all([salvarOrcamentoFinanceiro(h.store,h.deps,context,{...input,client_id:'competing-1',limit_cents:300000}),salvarOrcamentoFinanceiro(h.store,h.deps,context,{...input,client_id:'competing-2',limit_cents:400000})]);
    const rows=(await h.read.financeiro.orcamentos.list()).filter(row=>row.category_id===null);
    expect(rows).toHaveLength(12);expect(new Set(rows.map(row=>row.month)).size).toBe(12);expect(new Set(rows.map(row=>row.limit_cents)).size).toBe(1);expect(await h.read.eventos.list()).toHaveLength(36);
  });
});
