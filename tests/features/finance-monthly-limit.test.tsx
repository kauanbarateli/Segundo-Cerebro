import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it} from 'vitest';
import {FinanceMonthlyLimit} from '../../src/components/features/financeiro/finance-panels';
import {budgetDraft,budgetFields,FinanceFormError,TOTAL_MONTHLY_BUDGET} from '../../src/components/features/financeiro/finance-form';
import {accounts,categories,transactions,FINANCE_ACTOR,FINANCE_NOW} from '../fixtures/finance-regression';
import type {OrcamentoFinanceiro} from '../../src/core/financeiro';
const budget=(id:string,category_id:string|null,limit_cents:number):OrcamentoFinanceiro=>({id,user_id:FINANCE_ACTOR,category_id,limit_cents,month:'2026-07-01',created_at:FINANCE_NOW,updated_at:FINANCE_NOW});
const render=(budgets:OrcamentoFinanceiro[],hidden=false)=>renderToStaticMarkup(<FinanceMonthlyLimit data={{accounts,categories,transactions,budgets,tags:[]}} month="2026-07-01" hidden={hidden} edit={()=>undefined}/>);
describe('T053-A: plano total independente e máscara',()=>{
 it('categoria não preenche um limite total ausente e null não significa zero',()=>{
  const html=render([budget('category-budget','food',450000)]);
  expect(html).toContain('Limite total não definido');expect(html).toContain('Definir limite total');expect(html).not.toContain('aria-valuenow');
  expect(html).toContain('R$ 4.500,00'); // category allocation remains visible separately
 });
 it('total explícito diverge da soma e sobrealocação é informativa',()=>{
  const html=render([budget('total',null,100000),budget('food-budget','food',150000)]);
  expect(html).toContain('Ajustar limite');expect(html).toContain('As categorias somam mais que o limite total');expect(html).toContain('Alocação acima do total');
  expect(html).toContain('R$ 1.000,00');expect(html).toContain('R$ 1.500,00');expect(html).toContain('R$ 500,00');
 });
 it('ocultar suprime valores, percentual, faixa/sobrealocação e geometria',()=>{
  const html=render([budget('total',null,100000),budget('food-budget','food',150000)],true);
  expect(html).toContain('R$ ••••');expect(html).not.toContain('1.000,00');expect(html).not.toContain('1.500,00');expect(html).not.toContain('500,00');
  expect(html).not.toContain('aria-valuenow');expect(html).not.toContain('aria-valuetext');expect(html).not.toMatch(/width:|finance-progress--(?:normal|atencao|limite)/);expect(html).not.toContain('Alocação acima do total');
 });
 it('total é seleção explícita; vazio continua inválido e categoria real é preservada',()=>{
  const total=budget('total',null,123456);
  expect(budgetDraft('2026-07-01',total).category).toBe(TOTAL_MONTHLY_BUDGET);
  expect(budgetFields(budgetDraft('2026-07-01',total))).toEqual({category_id:null,month:'2026-07-01',limit_cents:123456});
  expect(()=>budgetFields({...budgetDraft('2026-07-01'),limit:'1.000,00'})).toThrow(FinanceFormError);
  expect(budgetFields({category:'food',month:'2026-07',limit:'100,00'}).category_id).toBe('food');
 });
});
