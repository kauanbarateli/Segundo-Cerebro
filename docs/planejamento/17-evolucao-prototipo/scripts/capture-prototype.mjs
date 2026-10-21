// Captures the reference in an isolated, offline browser. Never opens a real account.
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || '@playwright/test');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'capturas');
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{})});
const context=await browser.newContext({viewport:{width:1440,height:1000},offline:true,reducedMotion:'reduce',locale:'pt-BR'});
const page=await context.newPage(),errors=[],shots=[];
page.on('pageerror',e=>errors.push(e.message));
const ready=()=>page.evaluate(async()=>{await document.fonts.ready;document.querySelectorAll('img').forEach(i=>i.loading='eager');await Promise.race([Promise.all([...document.images].map(i=>i.decode().catch(()=>{}))),new Promise(r=>setTimeout(r,3000))]);await new Promise(requestAnimationFrame);});
async function capture(name){
  await ready();await page.mouse.move(0,0);
  const metrics=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,theme:document.documentElement.dataset.theme,route:location.hash}));
  await page.screenshot({path:path.join(out,name+'.png'),fullPage:true,animations:'disabled'});
  shots.push({file:name+'.png',...metrics});
}
try {
  await page.goto(pathToFileURL(path.join(root,'prototipo/index.html')).href+'#/inicio');
  for(const width of [1440,390]) for(const theme of ['light','dark']) {
    await page.setViewportSize({width,height:width===390?844:1000});
    await page.evaluate(theme=>App.setTheme(theme),theme);
    for(const route of ['inicio','capturar','tarefas','calendario','projetos','habitos','financeiro','configuracoes','conheca','checkout']){
      await page.evaluate(route=>App.go(route),route);
      if(route==='tarefas') await page.locator('[data-action="task-view"][data-value="kanban"]').click();
      await capture(`${route}-${width}-${theme}`);
    }
    await page.evaluate(()=>{App.state.onboarding=App.onboarding.createDraft('');App.state.onboarding.step=3;App.go('onboarding');});
    await page.locator('#ob-habitCadence').selectOption('weekdays');
    await capture(`onboarding-habitos-${width}-${theme}`);
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.evaluate(()=>{App.setTheme('light');App.go('financeiro');});
  const states=[['lancamento','life-transaction-new'],['cartao','fc-new'],['recorrencia','fn-recurrence-new'],['limite','fn-budget-edit'],['meta','fg-open'],['fatura','fc-open'],['periodo','fn-period-picker']];
  for(const [name,action] of states){
    await page.locator(`[data-action="${action}"]`).first().click();await capture('financeiro-'+name);
    await page.keyboard.press('Escape');
  }
  await page.locator('[data-action="fn-tab"][data-tab="ledger"]').first().click();await capture('financeiro-lancamentos');
  await page.locator('[data-action="fn-tab"][data-tab="planning"]').first().click();await capture('financeiro-planejamento');
  await page.evaluate(()=>App.go('inicio'));await page.locator('[data-action="toggle-sidebar"]').click();await capture('inicio-recolhido-light');
  await page.evaluate(()=>App.setTheme('dark'));await capture('inicio-recolhido-dark');
} finally {
  await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify({kind:'Prototype reference captures; not production E2E',capturedAt:new Date().toISOString(),errors,shots},null,2)+'\n');
  await browser.close();
}
console.log(JSON.stringify({screens:shots.length,errors,overflow:shots.filter(x=>x.scrollWidth>x.width).map(x=>x.file)}));
if(errors.length || shots.some(x=>x.scrollWidth>x.width))process.exitCode=1;
