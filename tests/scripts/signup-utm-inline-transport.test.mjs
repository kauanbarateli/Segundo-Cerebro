import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {createRequire} from "node:module";
const require=createRequire(new URL("../../package.json",import.meta.url)),ts=require("typescript");
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const url=s=>"data:text/javascript;base64,"+Buffer.from(s).toString("base64");
const react=url('export const useState=(...a)=>globalThis.__h.useState(...a);export const useRef=(...a)=>globalThis.__h.useRef(...a);export const useEffect=(...a)=>globalThis.__h.useEffect(...a);');
const jsx=url('export const jsx=(type,props)=>({type,props});export const jsxs=jsx;export const Fragment=Symbol.for("fragment");');
const ui=url('export function Button(){};export function Field(){};export function SignupLegal(){};export function SignupOriginChoice(){};export function SignupPassword(){};export default function Link(){};');
const core=url(compile(await readFile(new URL("../../src/components/features/auth/signup-response.ts",import.meta.url),"utf8")));
const code=compile(await readFile(new URL("../../src/components/features/auth/signup-form.tsx",import.meta.url),"utf8"))
 .replace(/from ["\x27]react\/jsx-runtime["\x27]/g,`from "${jsx}"`).replace(/from ["\x27]react["\x27]/g,`from "${react}"`)
 .replace(/from ["\x27](?:next\/link|@\/components\/ui\/button|@\/components\/ui\/field|\.\/signup-fields)["\x27]/g,`from "${ui}"`)
 .replace(/from ["\x27]\.\/signup-response["\x27]/g,`from "${core}"`);
const {SignupForm}=await import(url(code));
function hookHarness(){let si=0,ri=0,ei=0;const states=[],refs=[],effects=[];let pending=[];return{
 begin(){si=ri=ei=0;},flush(){for(const f of pending.splice(0))f();},
 useState(v){const i=si++;if(!(i in states))states[i]=typeof v==="function"?v():v;return[states[i],x=>{states[i]=typeof x==="function"?x(states[i]):x;}];},
 useRef(v){const i=ri++;return refs[i]??={current:v};},
 useEffect(fn,deps){const i=ei++,old=effects[i];if(!old||deps.some((v,j)=>!Object.is(v,old[j]))){effects[i]=deps;pending.push(fn);}},
};}
function find(n,fn){if(Array.isArray(n)){for(const x of n){const found=find(x,fn);if(found)return found;}return;}if(!n||typeof n!=="object")return;if(fn(n))return n;return find(n.props?.children,fn);}
function setup(initialSent=false){const h=hookHarness();globalThis.__h=h;return {render(){h.begin();const tree=SignupForm({termsVersion:"v1",privacyVersion:"v2",initialMessage:initialSent?"Enviado":undefined,initialSent});h.flush();return tree;}};}
const saved={fetch:globalThis.fetch,FormData:globalThis.FormData};
test.after(()=>{globalThis.fetch=saved.fetch;globalThis.FormData=saved.FormData;});
const formValues=[['email','person@example.invalid'],['password','synthetic-password'],['acceptedLegal','yes'],['consentedOrigin','yes'],['utm_source','busca']];
globalThis.FormData=class {constructor(){return formValues;}};
const event=()=>({preventDefault(){},currentTarget:{}});
const submit=tree=>find(tree,n=>n.type==='form').props.onSubmit;
const outcome=(status)=>new Response(JSON.stringify({status}),{status:200});

test('submissão tradicional enviada esconde formulário no primeiro render',()=>{const app=setup(true),tree=app.render();assert.equal(find(tree,n=>n.type==='form'),undefined);assert.equal(find(tree,n=>n.props?.role==='status').props.children.props.children,'Enviado');});
test('dois submits concorrentes enviam uma única requisição, com consentimento',async()=>{let finish, count=0,requestBody;globalThis.fetch=async(_url,init)=>{count++;requestBody=init.body;return new Promise(r=>finish=r);};const app=setup(),tree=app.render(),fn=submit(tree);const a=fn(event()),b=fn(event());assert.equal(count,1);assert.equal(requestBody.get('utm_source'),'busca');assert.equal(requestBody.get('consentedOrigin'),'yes');finish(outcome('sent'));await Promise.all([a,b]);const done=app.render();assert.equal(find(done,n=>n.type==='form'),undefined);const status=find(done,n=>n.props?.role==='status');assert.equal(status.props.tabIndex,-1);});
test('timeout fecha nova tentativa da instância e expõe aviso focável',async()=>{let count=0;globalThis.fetch=async()=>{count++;throw new DOMException('timeout','TimeoutError');};const app=setup();await submit(app.render())(event());let tree=app.render();assert.equal(find(tree,n=>n.props?.role==='alert').props.tabIndex,-1);assert.equal(find(tree,n=>n.type==='fieldset').props.disabled,true);await submit(tree)(event());assert.equal(count,1);});
test('erro conhecido permite correção e segunda tentativa',async()=>{let count=0;globalThis.fetch=async()=>outcome(++count===1?'invalid':'sent');const app=setup();await submit(app.render())(event());let tree=app.render();assert.equal(find(tree,n=>n.type==='fieldset').props.disabled,false);await submit(tree)(event());tree=app.render();assert.equal(count,2);assert.equal(find(tree,n=>n.type==='form'),undefined);});
