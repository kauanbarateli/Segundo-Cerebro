/** Synthetic SSR/React fixture; does not prove Auth, Next routing or hosted data. */
import { expect, test } from "@playwright/test";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { rolldown } from "rolldown";
import { assertInlineBrowserChunk } from "./helpers/inline-browser-chunk.mjs";
const origin="https://updates-fixture.test",require=createRequire(import.meta.url);
let html:string, script:string, css:string;
test.use({serviceWorkers:"block",trace:"off",video:"off"});
test.beforeAll(async()=>{
  const common={tsconfig:false,resolve:{alias:{"@":resolve("src")}},transform:{jsx:"react-jsx" as const,define:{"process.env.NODE_ENV":'"production"'}},plugins:[{name:"updates-css",resolveId(source:string){if(source.endsWith(".css"))return "\0updates-css";},load(id:string){if(id==="\0updates-css")return "export {};";}}]};
  const server=await rolldown({...common,input:resolve("tests/e2e/fixtures/updates-board-ssr.tsx"),platform:"node",external:["react","react/jsx-runtime","react-dom/server"]});
  try{const result=await server.generate({format:"cjs",codeSplitting:false}),chunk=result.output[0];if(result.output.length!==1||chunk?.type!=="chunk"||chunk.dynamicImports.length)throw Error("closed SSR bundle required");const bundleModule={exports:{} as {renderBoard?:()=>string}};new Function("require","module","exports",chunk.code)(require,bundleModule,bundleModule.exports);if(typeof bundleModule.exports.renderBoard!=="function")throw Error("missing render");html=bundleModule.exports.renderBoard();}finally{await server.close();}
  const client=await rolldown({...common,input:resolve("tests/e2e/fixtures/updates-board-hydrate.tsx"),platform:"browser"});
  try{const result=await client.generate({format:"iife",codeSplitting:false}),chunk=result.output[0];if(result.output.length!==1||chunk?.type!=="chunk")throw Error("closed client bundle required");assertInlineBrowserChunk(chunk);script=chunk.code;}finally{await client.close();}
  css=(await Promise.all([readFile("design-system/tokens/tokens.css","utf8"),readFile("src/components/ui/aliases.css","utf8"),readFile("src/components/ui/field.css","utf8"),readFile("src/components/features/atualizacoes/updates.css","utf8")])).join("\n");
});
async function serve(context:import("@playwright/test").BrowserContext){
 await context.route("**/*",async route=>{const request=route.request(),url=new URL(request.url());if(url.origin!==origin||!request.isNavigationRequest()||url.pathname!=="/"){await route.abort();return;}await route.fulfill({contentType:"text/html",body:`<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body><main id="updates-fixture">${html}</main></body></html>`});});
}
test("sem JavaScript as cinco etapas continuam visíveis no celular",async({browser})=>{
 const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});try{await serve(context);const page=await context.newPage();await page.goto(origin+"/");for(const name of ["Planejado","Em análise","Em andamento","Em fase de testes","Lançado"])await expect(page.getByRole("heading",{name,exact:true})).toBeVisible();await expect(page.getByLabel("Etapa")).toBeHidden();}finally{await context.close();}
});
test("hidratação tardia preserva foco e só filtra após escolha explícita",async({page,context})=>{
 await page.setViewportSize({width:390,height:844});await serve(context);await page.goto(origin+"/");const delivery=page.getByRole("link",{name:"Ver entrega: Entrega sintética"});await delivery.focus();await expect(delivery).toBeFocused();
 await page.addScriptTag({content:script});await page.evaluate(()=>(globalThis as unknown as {__hydrateUpdates():void}).__hydrateUpdates());
 const filter=page.getByLabel("Etapa");await expect(filter).toBeVisible();await expect(filter).toHaveValue("all");await expect(delivery).toBeFocused();for(const name of ["Planejado","Em análise","Em andamento","Em fase de testes","Lançado"])await expect(page.getByRole("heading",{name,exact:true})).toBeVisible();
 await filter.focus();await page.keyboard.press("End");await expect(filter).toHaveValue("released");await expect(page.getByRole("heading",{name:"Lançado",exact:true})).toBeVisible();await expect(page.getByRole("heading",{name:"Planejado",exact:true})).toBeHidden();
 await filter.selectOption("all");await expect(page.getByRole("heading",{name:"Planejado",exact:true})).toBeVisible();
 await filter.selectOption("testing");await filter.focus();await page.setViewportSize({width:1280,height:800});await expect(filter).toBeVisible();await expect(filter).toBeFocused();for(const name of ["Planejado","Em análise","Em andamento","Em fase de testes","Lançado"])await expect(page.getByRole("heading",{name,exact:true})).toBeVisible();
 await page.setViewportSize({width:390,height:844});await expect(filter).toBeFocused();await expect(filter).toHaveValue("testing");await expect(page.getByRole("heading",{name:"Em fase de testes",exact:true})).toBeVisible();await expect(page.getByRole("heading",{name:"Planejado",exact:true})).toBeHidden();
 await page.setViewportSize({width:1280,height:800});await filter.evaluate(element=>(element as HTMLSelectElement).blur());await expect(filter).toBeHidden();
 for(const theme of ["light","dark"]) {await page.evaluate(value=>document.documentElement.setAttribute("data-theme",value),theme);for(const name of ["Planejado","Em análise","Em andamento","Em fase de testes","Lançado"])await expect(page.getByRole("heading",{name,exact:true})).toBeVisible();}
});
