const { chromium } = require('C:/Users/Kauan Sousa Barateli/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { pathToFileURL } = require('url');
const fs = require('fs');
const path = require('path');
(async()=>{
 const browser = await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 const context=await browser.newContext({viewport:{width:1440,height:1000},offline:true});
 const page=await context.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL(path.resolve(__dirname,'../../../index.html')).href+'#/financeiro');
 await page.waitForSelector('.fn-page'); await page.waitForTimeout(400);
 const result={};
 result.themes=[];
 for(const theme of ['light','dark']){
  await page.evaluate(theme=>{App.state.settings.theme=theme; document.documentElement.dataset.theme=theme;},theme); await page.waitForTimeout(400);
  result.themes.push(await page.evaluate(()=>({theme:document.documentElement.dataset.theme,bg:getComputedStyle(document.body).backgroundColor,panel:getComputedStyle(document.querySelector('.fn-flow')).backgroundColor,ink:getComputedStyle(document.querySelector('.fn-flow h2')).color,secondary:getComputedStyle(document.querySelector('.fn-flow p')).color,quickBorder:getComputedStyle(document.querySelector('.fn-quick input[name=title]')).borderColor,quickBackground:getComputedStyle(document.querySelector('.fn-quick input[name=title]')).backgroundColor,placeholder:getComputedStyle(document.querySelector('.fn-quick input[name=title]'),'::placeholder').color})));
 }
 await page.locator('[data-action="fg-open"]').first().click();
 await page.locator('#detail-dialog [data-action="fg-edit"]').click();
 result.goalNestedBefore=await page.evaluate(()=>({active:document.activeElement.outerHTML.slice(0,250),returnFocusConnected:App._returnFocus?.isConnected}));
 await page.keyboard.press('Escape');
 result.goalNestedAfter=await page.evaluate(()=>({active:document.activeElement.outerHTML.slice(0,250)}));
 await page.locator('[data-action="fn-recurrence-new"]').click();
 await page.locator('#fn-rec-title').fill('Internet revisão');await page.locator('#fn-rec-value').fill('99,90');await page.locator('#fn-rec-date').fill('2026-11-10');
 await page.locator('[data-form="fn-recurrence"] button[type=submit]').click();
 await page.locator('[data-action="fn-recurrence-toggle"]').focus();await page.keyboard.press('Space');
 result.recurrenceToggle=await page.evaluate(()=>({active:document.activeElement.outerHTML.slice(0,250),value:App.state.financeRecurrences[0].active}));
 await page.locator('[data-action="life-transaction-new"]').click();await page.locator('#fn-description').fill('Teste futuro');await page.locator('#fn-value').fill('10,00');await page.locator('#fn-date').fill('2026-11-01');await page.locator('[data-form="fn-transaction"] button[type=submit]').click();
 result.futureError=await page.evaluate(()=>({error:document.querySelector('#detail-dialog [data-fn-error]').textContent,options:[...document.querySelector('#fn-status').options].map(x=>x.textContent)}));await page.keyboard.press('Escape');
 await page.locator('[data-action="fc-open"]').first().click();await page.locator('#detail-dialog [data-action="fc-pay"]').click();
 result.cardNested=await page.evaluate(()=>({active:document.activeElement.outerHTML.slice(0,250),inside:document.querySelector('#detail-dialog').contains(document.activeElement)}));await page.keyboard.press('Escape');
 await page.locator('[data-action="fn-period-picker"]').click();await page.keyboard.press('Escape');
 result.periodEscape=await page.evaluate(()=>({active:document.activeElement.outerHTML.slice(0,250)}));
 result.widths=[];
 for(const width of [320,390,768,1024,1440]){await page.setViewportSize({width,height:900});await page.waitForTimeout(100);result.widths.push(await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,chart:[...document.querySelectorAll('.fn-chart')].filter(x=>getComputedStyle(x).display!=='none').map(x=>({width:x.getBoundingClientRect().width,fontSize:getComputedStyle(x.querySelector('text')).fontSize,viewBox:x.getAttribute('viewBox')})),overflow:[...document.querySelectorAll('body *')].filter(x=>x.getBoundingClientRect().right>innerWidth+1&&getComputedStyle(x).visibility==='visible').slice(0,16).map(x=>({tag:x.tagName,cls:x.className,right:x.getBoundingClientRect().right,w:x.getBoundingClientRect().width,overflow:getComputedStyle(x).overflow,minWidth:getComputedStyle(x).minWidth}))})));}
 await page.setViewportSize({width:390,height:900});
 result.containingBlockTest=await page.evaluate(()=>{const before=document.documentElement.scrollWidth;document.querySelectorAll('.fn-table-scroll,.fn-data-scroll,.fc-table-wrap').forEach(e=>e.style.position='relative');return {before,after:document.documentElement.scrollWidth}});
 result.errors=errors;
 fs.writeFileSync(path.join(__dirname,'review-evidence.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
