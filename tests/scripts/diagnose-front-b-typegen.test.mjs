import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,rmdir,unlink,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {FRONT_B_RPC_CONTRACT,FRONT_B_QA_028_RPC_CONTRACT,parseFrontBTypes,compareFrontBTypes} from '../../scripts/operations/diagnose-front-b-typegen.mjs';

function fixture(contract=FRONT_B_RPC_CONTRACT){
 const entries=Object.entries(contract).map(([name,{args,returns}])=>{
  const fields=Object.entries(args).map(([key,type])=>`"${key}": ${type}`).join('; ');
  return `"${name}": { Args: ${fields ? `{${fields}}` : 'Record<PropertyKey, never>'}; Returns: ${returns} }`;
 });
 return `type Json = string | null; type Database = { public: { Functions: { ${entries.join(';')} } } }`;
}

test('leitor de tipos compara nomes, argumentos, tipos, retorno e nulabilidade de Json',()=>{
 const source=fixture(),parsed=parseFrontBTypes(source);
 assert.equal(compareFrontBTypes(parsed).ok,true);
 const missing={...parsed};delete missing.feedback_list;
 assert.deepEqual(compareFrontBTypes(missing).missing,['feedback_list']);
 const extra={...parsed,signup_unexpected:{args:{},returns:'Json'}};
 assert.deepEqual(compareFrontBTypes(extra).unexpected,['signup_unexpected']);
 const changed=source.replace('"p_before": string','"p_before": number');
 assert.deepEqual(compareFrontBTypes(parseFrontBTypes(changed)).differing,['feedback_list']);
 assert.throws(()=>parseFrontBTypes(source.replace('"p_before": string','"p_before"?: string')),/TYPE_PROPERTY_INVALID/);
 assert.throws(()=>parseFrontBTypes(source.replace('string \x7c null','string')),/JSON_NULL_MISSING/);
});

test('contrato de QA 028 aceita as duas formas de zero argumentos e recusa diferenças reais',()=>{
 const record=fixture(FRONT_B_QA_028_RPC_CONTRACT),never=record.replace('Record<PropertyKey, never>','never');
 assert.equal(Object.keys(FRONT_B_QA_028_RPC_CONTRACT).length,21);
 assert.equal(compareFrontBTypes(parseFrontBTypes(record),FRONT_B_QA_028_RPC_CONTRACT).ok,true);
 assert.equal(compareFrontBTypes(parseFrontBTypes(never),FRONT_B_QA_028_RPC_CONTRACT).ok,true);
 assert.throws(()=>parseFrontBTypes(record.replace('Record<PropertyKey, never>','Record<string, never>')),/RPC_ARGS_INVALID/);
 const changed=never.replace('"p_generation": string','"p_generation": number');
 assert.ok(compareFrontBTypes(parseFrontBTypes(changed),FRONT_B_QA_028_RPC_CONTRACT).differing.includes('signup_fence_ack'));
 const withLegacy={...parseFrontBTypes(never),feedback_submit:FRONT_B_RPC_CONTRACT.feedback_submit};
 assert.deepEqual(compareFrontBTypes(withLegacy,FRONT_B_QA_028_RPC_CONTRACT).unexpected,['feedback_submit']);
 assert.equal(compareFrontBTypes(parseFrontBTypes(fixture())).ok,true,'fixture histórica permanece como padrão');
 assert.ok(compareFrontBTypes(parseFrontBTypes(fixture()),FRONT_B_QA_028_RPC_CONTRACT).missing.includes('feedback_barrier_submit'));
});

test('CLI de snapshot 028 verifica contrato e acusa writer legado',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'sc-front-b-028-')),path=join(dir,'types.ts');
 try{
  const source=fixture(FRONT_B_QA_028_RPC_CONTRACT).replace('Record<PropertyKey, never>','never');
  await writeFile(path,source);
  const script=fileURLToPath(new URL('../../scripts/operations/diagnose-front-b-typegen.mjs',import.meta.url));
  const run=()=>spawnSync(process.execPath,[script,'--snapshot-028',path],{encoding:'utf8'});
  const good=run();assert.equal(good.status,0);assert.equal(JSON.parse(good.stdout).rpc_count,21);
  await writeFile(path,source.replace('"feedback_list":','"feedback_submit": { Args: {}; Returns: Json }; "feedback_list":'));
  const bad=run();assert.equal(bad.status,1);assert.deepEqual(JSON.parse(bad.stdout).unexpected,['feedback_submit']);
 }finally{await unlink(path);await rmdir(dir);}
});

test('a CLI recusa pacote ausente ou caminho relativo antes de carregar código externo',()=>{
 const script=fileURLToPath(new URL('../../scripts/operations/diagnose-front-b-typegen.mjs',import.meta.url));
 for(const args of [[],['--package','relative/package']]){
  const result=spawnSync(process.execPath,[script,...args],{encoding:'utf8'});
  assert.equal(result.status,1);
  assert.match(result.stderr,/caminho absoluto local/);
 }
});

test('a CLI recusa versão divergente antes de importar o pacote',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'sc-front-b-typegen-'));
 try{
  await writeFile(join(dir,'package.json'),JSON.stringify({name:'@supabase/postgrest-typegen',version:'0.4.1'}));
  const script=fileURLToPath(new URL('../../scripts/operations/diagnose-front-b-typegen.mjs',import.meta.url));
  const result=spawnSync(process.execPath,[script,'--package',dir],{encoding:'utf8'});
  assert.equal(result.status,1);
  assert.match(result.stderr,/PACKAGE_VERSION_REFUSED/);
 }finally{
  await unlink(join(dir,'package.json'));
  await rmdir(dir);
 }
});
