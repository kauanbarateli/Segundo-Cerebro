#!/usr/bin/env node
/** Offline bridge for operator-supplied, read-only Supabase MCP metadata.
 * It does not connect, establish provenance or validate freshness. */
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {isAbsolute,join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {compareDatabaseTypeSources} from './check-database-types.mjs';

const PACKAGE_VERSION='0.4.0', MAX_METADATA_BYTES=2*1024*1024;
export const REVIEWED_QUERY_SHA256='63dc9d23e86180ad79998a0e8cdd3a4e8f4c8eb4f419939e6465351afae118d8';
const baseline=fileURLToPath(new URL('../../src/lib/supabase/database.generated.ts',import.meta.url));
export function parseMcpMetadata(value, expected=11) {
 if(!value || typeof value!=='object' || value.isError || !Array.isArray(value.content) || value.content.length!==1 || value.content[0]?.type!=='text') throw new Error('MCP_ENVELOPE_REFUSED');
 let inner; try {inner=JSON.parse(value.content[0].text);} catch {throw new Error('MCP_ENVELOPE_REFUSED');}
 const match=typeof inner.result==='string' && inner.result.match(/<untrusted-data-([a-f0-9-]+)>\n\s*([\s\S]*?)\s*<\/untrusted-data-\1>/);
 if(!match) throw new Error('MCP_ENVELOPE_REFUSED');
 let rows; try {rows=JSON.parse(match[2]);} catch {throw new Error('MCP_ENVELOPE_REFUSED');}
 if(!Array.isArray(rows) || rows.length!==1 || !Array.isArray(rows[0]?.sets) || rows[0].sets.length!==expected || rows[0].sets.some(set=>!Array.isArray(set))) throw new Error('MCP_ENVELOPE_REFUSED');
 return rows[0].sets;
}
export async function introspectionQueries(introspect) {
 const queries=[];
 await introspect({query:async sql=>{queries.push(sql);return {rows:[]};}},{includedSchemas:['public']});
 if(queries.length!==11 || queries.some(sql=>typeof sql!=='string' || !/^(?:\s|--[^\n]*\n)*(select|with)\b/i.test(sql))) throw new Error('GENERATOR_QUERY_REFUSED');
 return queries;
}
export function atomicReadOnlySql(queries) {
 if(!Array.isArray(queries) || queries.length!==11) throw new Error('GENERATOR_QUERY_REFUSED');
 const sets=queries.map(sql=>`(select coalesce(jsonb_agg(to_jsonb(sc_row)),'[]'::jsonb) from (${sql.replace(/;\s*$/,'')}) sc_row)`).join(',\n');
 const sql=`begin transaction read only; set local statement_timeout='30s';\nselect jsonb_build_array(${sets}) as sets;\nrollback;`;
 if(createHash('sha256').update(sql).digest('hex')!==REVIEWED_QUERY_SHA256) throw new Error('GENERATOR_QUERY_REFUSED');
 return sql;
}
async function packageModules(directory) {
 if(!isAbsolute(directory)) throw new Error('PACKAGE_PATH_REFUSED');
 const manifest=JSON.parse(await readFile(join(directory,'package.json'),'utf8'));
 if(manifest.name!=='@supabase/postgrest-typegen' || manifest.version!==PACKAGE_VERSION) throw new Error('PACKAGE_VERSION_REFUSED');
 const introspection=await import(pathToFileURL(join(directory,'dist/introspection/index.js')).href);
 const generation=await import(pathToFileURL(join(directory,'dist/generation/index.js')).href);
 return {introspect:introspection.introspect,generate:generation.generateTypescript,sort:generation.sortGeneratorMetadata};
}
export async function compareFromSets(introspect,generate,sort,queries,sets,source) {
 let position=0;
 const metadata=await introspect({query:async sql=>{const index=position++;if(sql!==queries[index] || !sets[index]) throw new Error('GENERATOR_QUERY_REFUSED');return {rows:sets[index]};}},{includedSchemas:['public']});
 if(position!==11 || metadata.schemas.length!==1 || metadata.schemas[0].name!=='public') throw new Error('METADATA_SCOPE_REFUSED');
 const snapshot=await generate(sort(metadata),{detectOneToOneRelationships:true,format:async value=>value});
 return {generator:`@supabase/postgrest-typegen@${PACKAGE_VERSION}`,sha256:createHash('sha256').update(snapshot).digest('hex'),bytes:Buffer.byteLength(snapshot),counts:{tables:metadata.tables.length,views:metadata.views.length,columns:metadata.columns.length,functions:metadata.functions.length},comparison:compareDatabaseTypeSources(source,snapshot)};
}
async function main(args) {
 const [command,...tail]=args;
 if(!['prepare','compare'].includes(command) || tail.length%2 || tail.some((value,index)=>index%2===0 && !['--package','--metadata'].includes(value))) throw new Error('USAGE_REFUSED');
 const entries=[];for(let i=0;i<tail.length;i+=2) entries.push([tail[i],tail[i+1]]);
 const options=new Map(entries);if(options.size!==entries.length || !options.has('--package') || (command==='compare')!==options.has('--metadata')) throw new Error('USAGE_REFUSED');
 const {introspect,generate,sort}=await packageModules(options.get('--package'));
 const queries=await introspectionQueries(introspect),sql=atomicReadOnlySql(queries);
 const querySha256=createHash('sha256').update(sql).digest('hex');
 if(command==='prepare') return {operation:'typegen_metadata_prepare',network:false,querySha256,sql};
 const input=options.get('--metadata');if(!isAbsolute(input)) throw new Error('METADATA_PATH_REFUSED');
 const bytes=await readFile(input);if(bytes.length>MAX_METADATA_BYTES) throw new Error('METADATA_LIMIT_EXCEEDED');
 const sets=parseMcpMetadata(JSON.parse(bytes.toString('utf8')));
 return {operation:'typegen_metadata_compare',network:false,provenance_verified:false,freshness_verified:false,querySha256,...await compareFromSets(introspect,generate,sort,queries,sets,await readFile(baseline,'utf8'))};
}
if(process.argv[1] && pathToFileURL(resolve(process.argv[1])).href===import.meta.url) {
 try {console.log(JSON.stringify(await main(process.argv.slice(2))));}
 catch(error) {console.error(JSON.stringify({ok:false,code:error instanceof Error && /^[A-Z_]+$/.test(error.message)?error.message:'INPUT_REFUSED'}));process.exitCode=1;}
}
