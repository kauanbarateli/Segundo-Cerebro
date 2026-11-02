/** Real WorkspaceShell and CSS with synthetic Auth/Next and unrelated-dialog seams.
 * SSR geometry/keyboard only: does not prove hosted Auth, hydration or clickable dialogs. */
import { expect, test } from '@playwright/test';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { rolldown } from 'rolldown';
const origin='https://updates-shell.test', require=createRequire(import.meta.url);
let html:string,htmlWithoutUpdates:string,css:string;
test.use({serviceWorkers:'block',trace:'off',video:'off'});
test.beforeAll(async()=>{
 const modules:Record<string,string>={
  'next/navigation':`export const usePathname=()=>'/atualizacoes'; export const useRouter=()=>({push(){},replace(){},refresh(){}}); export const useSearchParams=()=>new URLSearchParams();`,
  'next/link':`import React from 'react'; export default function Link({children,...props}){return React.createElement('a',props,children);}`,
  '@/lib/navigation/demo-access-provider':`export const useDemoAccess=()=>({connected:true,policy:{entitlements:{},preferences:{},isAdmin:false}});`,
  '@/lib/demo/demo-provider':`export const useDemoApplication=()=>({userId:'10000000-0000-4000-8000-000000000001',logout(){}});`,
  '@/components/features/capturar/quick-capture':`import React from 'react'; export const QuickCapture=()=>React.createElement('button',{type:'button',className:'shell-capture','aria-label':'Capturar','aria-haspopup':'dialog'},React.createElement('svg',{width:17,height:17}),React.createElement('span',null,'Capturar'));`,
  '@/components/theme/theme-selector':`export const ThemeSelector=()=>null; export const useThemeChoice=()=>({resolvedTheme:'light',choose(){}});`,
  './command-palette':`export const CommandPalette=()=>null;`,
  './calendar-meeting-reminders':`export const CalendarMeetingReminders=()=>null;`,
  './connected-command-feedback':`export const ConnectedCommandFeedback=({children})=>children;`,
  './account-avatar':`export const AccountAvatar=()=>null;`,
 };
 const plugin={name:'shell-synthetic-seams',resolveId(source:string,importer:string|undefined){
  if(source.endsWith('.css'))return '\0shell-css';
  if(source==='./theme-selector' && importer?.replaceAll('\\','/').endsWith('/components/theme/theme-toggle.tsx'))return '\0shell:@/components/theme/theme-selector';
  if(Object.hasOwn(modules,source) && (!source.startsWith('./') || importer?.replaceAll('\\','/').endsWith('/components/layout/workspace-shell.tsx')))return '\0shell:'+source;
 },load(id:string){if(id==='\0shell-css')return 'export {};';if(id.startsWith('\0shell:'))return modules[id.slice(7)];}};
 const server=await rolldown({input:resolve('tests/e2e/fixtures/updates-shell-geometry-ssr.tsx'),platform:'node',tsconfig:false,resolve:{alias:{'@':resolve('src')}},transform:{jsx:'react-jsx',define:{'process.env.NODE_ENV':'"production"'}},external:['react','react/jsx-runtime','react-dom/server'],plugins:[plugin]});
 try{const result=await server.generate({format:'cjs',codeSplitting:false}),chunk=result.output[0];if(result.output.length!==1||chunk?.type!=='chunk'||chunk.dynamicImports.length)throw Error('closed SSR bundle required');const m={exports:{} as {renderShell?:(updates?:boolean)=>string}};new Function('require','module','exports',chunk.code)(require,m,m.exports);if(typeof m.exports.renderShell!=='function')throw Error('missing render');html=m.exports.renderShell();htmlWithoutUpdates=m.exports.renderShell(false);}finally{await server.close();}
 const files=['design-system/tokens/tokens.css','src/components/ui/aliases.css','src/components/ui/button.css','src/components/theme/theme-toggle.css','src/components/layout/workspace-shell.css','src/components/layout/desktop-dock.css'];
 css='*{box-sizing:border-box}body{margin:0}svg{flex-shrink:0}'+(await Promise.all(files.map(f=>readFile(f,'utf8')))).join('\n');
});
for(const width of [320,390])test(`shell conectado SSR ${width}px: ações sem sobreposição e foco`,async({browser})=>{
 const context=await browser.newContext({javaScriptEnabled:false,viewport:{width,height:844}});
 try{
  await context.route('**/*',async route=>{const request=route.request(),url=new URL(request.url());if(request.method()!=='GET'||!request.isNavigationRequest()||url.origin!==origin||url.pathname!=='/atualizacoes'){await route.abort();return;}await route.fulfill({contentType:'text/html; charset=utf-8',body:`<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body>${html}</body></html>`});});
  const page=await context.newPage();await page.goto(origin+'/atualizacoes');
  await expect(page.locator('.shell-breadcrumb-current')).toHaveText('Atualizações');
  await expect(page.getByRole('link',{name:'Atualizações',exact:true})).toHaveAttribute('aria-current','page');
  const controls=page.locator('.shell-topbar button:visible, .shell-topbar a:visible'); const count=await controls.count();expect(count).toBe(7);
  const boxes=[];for(let i=0;i<count;i++){const control=controls.nth(i);await expect(control).toBeVisible();const box=await control.boundingBox();expect(box).not.toBeNull();if(!box)throw Error('missing box');expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width);boxes.push(box);}
  for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i]!,b=boxes[j]!;expect(Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)<=0.5 || Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)<=0.5).toBe(true);}
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBe(0);
  for(let i=0;i<count;i++){const target=controls.nth(i);let found=false;for(let step=0;step<40;step++){if(await target.evaluate(element=>document.activeElement===element)){found=true;break;}await page.keyboard.press('Tab');}expect(found).toBe(true);}
 }finally{await context.close();}
});

test('sem atualizações preserva cabeçalho anterior de uma linha',async({browser})=>{
 const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:320,height:844}});
 try{
  await context.route('**/*',async route=>{const request=route.request(),url=new URL(request.url());if(request.method()!=='GET'||!request.isNavigationRequest()||url.origin!==origin||url.pathname!=='/atualizacoes'){await route.abort();return;}await route.fulfill({contentType:'text/html; charset=utf-8',body:`<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body>${htmlWithoutUpdates}</body></html>`});});
  const page=await context.newPage();await page.goto(origin+'/atualizacoes');const top=page.locator('.shell-topbar');
  await expect(top).not.toHaveClass(/shell-topbar--updates/);await expect(page.getByRole('link',{name:'Atualizações',exact:true})).toHaveCount(0);
  expect(await top.evaluate(element=>getComputedStyle(element).flexWrap)).toBe('nowrap');
 }finally{await context.close();}
});
