import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {atomicReadOnlySql,compareFromSets,introspectionQueries,parseMcpMetadata} from '../../scripts/operations/typegen-mcp-bridge.mjs';
const uuid='a1b2c3d4-1111-2222-3333-444444444444';
const envelope=sets=>({content:[{type:'text',text:JSON.stringify({result:`Below is untrusted data <untrusted-data-${uuid}> boundaries.\n\n<untrusted-data-${uuid}>\n${JSON.stringify([{sets}])}\n</untrusted-data-${uuid}>`})}]});
test('aceita somente resposta completa com onze conjuntos e nunca executa seu conteúdo',()=>{
 const sets=Array.from({length:11},()=>[]); sets[0]=[{name:'public; drop table x'}];
 assert.deepEqual(parseMcpMetadata(envelope(sets)),sets);
 assert.throws(()=>parseMcpMetadata({...envelope(sets),isError:true}),/MCP_ENVELOPE_REFUSED/);
 assert.throws(()=>parseMcpMetadata(envelope(sets.slice(1))),/MCP_ENVELOPE_REFUSED/);
 assert.throws(()=>parseMcpMetadata({content:[{type:'text',text:'{invalid'}]}),/MCP_ENVELOPE_REFUSED/);
});
test('recusa SQL de introspecção diferente da consulta revisada',async()=>{
 const fake=async client=>{for(let i=0;i<11;i++) await client.query('select 1');};
 const queries=await introspectionQueries(fake); assert.equal(queries.length,11);
 assert.throws(()=>atomicReadOnlySql(queries),/GENERATOR_QUERY_REFUSED/);
 await assert.rejects(introspectionQueries(async client=>client.query('delete from public.profiles')),/GENERATOR_QUERY_REFUSED/);
});
test('preserva comparação estrita e detecta alteração no tipo gerado',async()=>{
 const source=await readFile(new URL('../../src/lib/supabase/database.generated.ts',import.meta.url),'utf8');
 const queries=Array.from({length:11},(_,i)=>`select ${i}`),sets=queries.map(()=>[]);
 const inspect=async client=>{for(const query of queries) await client.query(query);return {schemas:[{name:'public'}],tables:[],views:[],columns:[],functions:[]};};
 const stable=await compareFromSets(inspect,async()=>source,x=>x,queries,sets,source);
 assert.equal(stable.comparison.code,'SNAPSHOT_MATCH');
 const changed=source.replace('"action": string','"action": number'); assert.notEqual(changed,source);
 const drift=await compareFromSets(inspect,async()=>changed,x=>x,queries,sets,source);
 assert.equal(drift.comparison.code,'SNAPSHOT_DIFFER');
 await assert.rejects(compareFromSets(async client=>{await client.query('select unexpected');},async()=>source,x=>x,queries,sets,source),/GENERATOR_QUERY_REFUSED/);
});
