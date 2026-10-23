import {expect,test} from '@playwright/test';
import {selectFinancePeriod} from './helpers/finance-period';
import {describeVisualFailures,inspectVisualGuards} from './helpers/visual-guards';

for(const theme of ['light','dark'] as const)for(const width of [320,390])test(`T053-A: total independente, confirmação de cópia e máscara em ${width}px/${theme}`,async({page},testInfo)=>{
 await page.setViewportSize({width,height:900});await page.emulateMedia({reducedMotion:'reduce',colorScheme:theme});await page.goto('/financeiro?tab=orcamentos&month=2026-09');
 await page.getByLabel('Tema',{exact:true}).selectOption(theme);await expect(page.locator('html')).toHaveAttribute('data-theme',theme);
 const plan=page.getByRole('region',{name:'Plano do mês',exact:true});
 await expect(plan).toContainText('Limite total não definido');
 const categoryText=await page.locator('.finance-tab-content .finance-account-grid').textContent();
 await plan.getByRole('button',{name:'Definir limite total',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Novo orçamento',exact:true});
 await expect(dialog.getByLabel('Categoria do orçamento',{exact:true})).toHaveValue('__monthly_total__');
 await dialog.getByLabel('Limite do orçamento (R$)',{exact:true}).fill('4.500,00');
 await dialog.getByRole('checkbox',{name:'Aplicar a este mês e aos próximos 11 meses',exact:true}).click();
 await expect(dialog).toContainText('setembro de 2026');
 await expect(dialog).toContainText('agosto de 2027');
 await dialog.getByRole('button',{name:'Salvar orçamento',exact:true}).click();
 await expect(dialog.getByRole('alert').filter({hasText:'Confirme a substituição'})).toBeVisible();
 await expect(plan).toContainText('Limite total não definido');
 await dialog.getByRole('checkbox',{name:/Confirmo substituir os limites/}).click();
 const visual=await inspectVisualGuards(page);for(const gate of ['overflow','targets','fields'] as const)expect(visual[gate],describeVisualFailures(visual,gate)).toEqual([]);
 await dialog.getByRole('button',{name:'Salvar orçamento',exact:true}).click();await expect(dialog).toBeHidden();
 await expect(plan).toContainText('4.500,00');expect(await page.locator('.finance-tab-content .finance-account-grid').textContent()).toBe(categoryText);
 await testInfo.attach(`finance-monthly-plan-${theme}-${width}`,{body:await page.screenshot({fullPage:true}),contentType:'image/png'});
 await selectFinancePeriod(page,'2027-08');await expect(plan).toContainText('4.500,00');
 await selectFinancePeriod(page,'2027-09');await expect(plan).toContainText('Limite total não definido');
 await selectFinancePeriod(page,'2026-09');await page.getByRole('button',{name:'Ocultar valores',exact:true}).click();
 await expect(plan).toContainText('R$ ••••');await expect(plan).not.toContainText('4.500,00');await expect(plan.locator('[aria-valuenow],[aria-valuetext]')).toHaveCount(0);
});

test('T053-A: mudar valor após o aceite exige confirmar novamente e cancelar preserva limites',async({page})=>{
 await page.goto('/financeiro?tab=orcamentos&month=2026-09');
 const plan=page.getByRole('region',{name:'Plano do mês',exact:true});await plan.getByRole('button',{name:'Definir limite total',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Novo orçamento',exact:true});await dialog.getByLabel('Limite do orçamento (R$)',{exact:true}).fill('4.500,00');
 await dialog.getByRole('checkbox',{name:'Aplicar a este mês e aos próximos 11 meses',exact:true}).click();
 const consent=dialog.getByRole('checkbox',{name:/Confirmo substituir os limites/});await consent.click();await expect(consent).toHaveAttribute('aria-checked','true');
 await dialog.getByLabel('Limite do orçamento (R$)',{exact:true}).fill('5.000,00');await expect(consent).toHaveAttribute('aria-checked','false');
 await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();await expect(dialog).toBeHidden();await expect(plan).toContainText('Limite total não definido');
});
