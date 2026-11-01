import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,rmdir,unlink,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {FRONT_B_RPC_CONTRACT,parseFrontBTypes,compareFrontBTypes} from '../../scripts/operations/diagnose-front-b-typegen.mjs';

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
