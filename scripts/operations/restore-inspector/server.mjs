import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),"../../..");
async function bundle(input) {const build=await rolldown({input,platform:"browser"});try{const result=await build.generate({format:"es"});const chunk=result.output.find(output=>output.type==="chunk");if(!chunk)throw new Error("INSPECTOR_BUILD_FAILED");return chunk.code;}finally{await build.close();}}
/** Static assets only. Packets, password and kit are local File/Form inputs and
 * never requests. The server has no Auth/SQL/Storage handlers or app imports. */
export async function startRestoreInspector() {
 const location=dirname(fileURLToPath(import.meta.url)),assets=new Map([
  ["",["text/html; charset=utf-8",await readFile(resolve(location,"index.html"))]],
  ["style.css",["text/css; charset=utf-8",await readFile(resolve(location,"style.css"))]],
  ["tokens.css",["text/css; charset=utf-8",await readFile(resolve(ROOT,"design-system/tokens/tokens.css"))]],
  ["geist.woff2",["font/woff2",await readFile(resolve(ROOT,"node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2"))]],
  ["inspector.js",["text/javascript; charset=utf-8",await bundle(resolve(location,"inspector.ts"))]],
  ["argon2.worker.ts",["text/javascript; charset=utf-8",await bundle(resolve(ROOT,"src/adapters/crypto/argon2.worker.ts"))]],
 ]),capability=randomBytes(24).toString("base64url");let origin;
 const server=createServer((request,response)=>{const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","X-Frame-Options":"DENY","Referrer-Policy":"no-referrer","Permissions-Policy":"camera=(), microphone=(), geolocation=(), clipboard-read=(), clipboard-write=()","Content-Security-Policy":"default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; font-src 'self'; worker-src 'self'; connect-src 'none'; img-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"};
  const site=request.headers["sec-fetch-site"];
  if(request.method!=="GET"||request.headers.host!==new URL(origin).host||(request.headers.origin&&request.headers.origin!==origin)||(site&&!["same-origin","none"].includes(site))){response.writeHead(403,headers);response.end();return;}
  const url=new URL(request.url,origin),prefix="/"+capability+"/",entry=url.pathname.startsWith(prefix)&&!url.search?assets.get(url.pathname.slice(prefix.length)):null;if(!entry){response.writeHead(404,headers);response.end();return;}response.writeHead(200,{...headers,"Content-Type":entry[0]});response.end(entry[1]);
 });await new Promise((accept,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",accept);});const address=server.address();if(!address||typeof address==="string")throw new Error("INSPECTOR_START_FAILED");origin="http://127.0.0.1:"+address.port;
 return {url:origin+"/"+capability+"/",async close(){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}};
}
