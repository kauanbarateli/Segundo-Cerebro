/** React/browser fixture; no Auth, actual endpoint, hosted services or SQL. */
import { expect, test } from "@playwright/test";
import { resolve } from "node:path";
import { rolldown } from "rolldown";
const origin="https://signup-inline.test";
let bundle:string;
test.use({serviceWorkers:"block"});
test.beforeAll(async()=>{
 const build=await rolldown({input:resolve("tests/e2e/fixtures/signup-utm-inline.tsx"),platform:"browser",tsconfig:false,resolve:{alias:{"@":resolve("src")}},transform:{jsx:"react-jsx",define:{"process.env.NODE_ENV":'"production"'}},onwarn(w,warn){if(w.code!=="MODULE_LEVEL_DIRECTIVE")warn(w);},plugins:[{name:"inline-signup",resolveId(source){if(source.endsWith(".css"))return "\0css";if(source==="next/link")return "\0link";},load(id){if(id==="\0css")return "export {};";if(id==="\0link")return 'import React from "react";export default function Link({children,href,...props}){return React.createElement("a",{href,...props},children)}';}}]});
 try{const result=await build.generate({format:"iife",codeSplitting:false}),chunk=result.output[0];if(result.output.length!==1||chunk?.type!=="chunk"||chunk.imports.length||chunk.dynamicImports.length)throw Error("closed fixture required");bundle=chunk.code;}finally{await build.close();}
});
test("erro conhecido mantém origem consentida sem navegação ou storage adicional",async({page})=>{
 const bodies:string[]=[], referrers:(string | undefined)[]=[], url=origin+"/cadastro?utm_source=busca&utm_campaign=campanha";
 await page.context().route("**/*",async route=>{const req=route.request(),u=new URL(req.url());if(u.origin!==origin){await route.abort();return;}if(req.isNavigationRequest()){await route.fulfill({contentType:"text/html",body:'<main id="signup"></main>'});return;}if(u.pathname==="/auth/preparar-cadastro"&&req.method()==="POST"){await route.fulfill({contentType:"application/json",body:JSON.stringify({ok:true,attempt:"a".repeat(64)})});return;}if(u.pathname==="/auth/iniciar-cadastro"&&req.method()==="POST"){bodies.push(req.postData()??"");referrers.push(req.headers()["referer"]);await route.fulfill({contentType:"application/json",body:JSON.stringify({status:"invalid"})});return;}await route.abort();});
 await page.goto(url);await page.addScriptTag({content:bundle});await page.evaluate(()=>(globalThis as unknown as {__mountSignup():void}).__mountSignup());
 await page.getByLabel("E-mail").fill("pessoa@example.invalid");await page.getByLabel("Senha",{exact:true}).fill("senha-sintetica-123");await page.getByRole("checkbox",{name:/Li e concordo/}).check();await page.getByRole("checkbox",{name:/Permitir o uso da origem/}).check();
 const before=await page.evaluate(()=>({length:history.length,local:Object.keys(localStorage),session:Object.keys(sessionStorage)}));await page.getByRole("button",{name:"Criar conta"}).click();
 await expect(page.getByRole("alert")).toContainText("Confira");expect(page.url()).toBe(url);expect(new URLSearchParams(bodies[0]).get("utm_source")).toBe("busca");expect(referrers[0]).toBeUndefined();await expect(page.getByRole("checkbox",{name:/Permitir o uso da origem/})).toBeChecked();
 expect(await page.evaluate(()=>({length:history.length,local:Object.keys(localStorage),session:Object.keys(sessionStorage)}))).toEqual(before);
 await page.getByRole("checkbox",{name:/Permitir o uso da origem/}).uncheck();await page.getByRole("button",{name:"Criar conta"}).click();await expect.poll(()=>bodies.length).toBe(2);
 expect(new URLSearchParams(bodies[1]).has("utm_source")).toBe(false);expect(new URLSearchParams(bodies[1]).has("consentedOrigin")).toBe(false);
});
