// Offline protected proposal only; never apply this output to a remote database.
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = new URL('./',import.meta.url);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const PIN_CANDIDATE='7b1ef35061fdfb04512c63c00065b1bc71398be639e0cf3cd425aed71d6951e6';
const PIN_PREFLIGHT='b080b702c81c0847f7c63a585c102299d06c7e403830969fce9394f79b362790';
const fatal=()=>{throw Error('FEEDBACK_CONSOLIDATION_REFUSED');};
function replaceOnce(text,needle,replacement){if(text.split(needle).length!==2)fatal();return text.replace(needle,()=>replacement);}
export function renderConsolidated(candidate,preflight){
 if(!Buffer.isBuffer(candidate)||!Buffer.isBuffer(preflight)||sha(candidate)!==PIN_CANDIDATE||sha(preflight)!==PIN_PREFLIGHT)fatal();
 let source=candidate.toString('utf8');const checks=preflight.toString('utf8');
 if(!Buffer.from(source).equals(candidate)||!Buffer.from(checks).equals(preflight))fatal();
 const scratch="DO $scratch_guard$ BEGIN RAISE EXCEPTION 'UNREVIEWED SCRATCH SQL: DO NOT APPLY'; END $scratch_guard$;";
 const event="DO $event_contract_guard$ BEGIN RAISE EXCEPTION 'DOMAIN_EVENT_CONTRACT_NOT_QUALIFIED'; END $event_contract_guard$;";
 const manual="DO $manual_guard$ BEGIN RAISE EXCEPTION 'STOP: feedback release not qualified or authorized'; END $manual_guard$;";
 const pt409="DO $pt409_guard$ BEGIN RAISE EXCEPTION 'STOP: PT409 preservation not yet qualified'; END $pt409_guard$;";
 if(source.split(event).length!==2||checks.split(manual).length!==2||checks.split(pt409).length!==2)fatal();
 const start=checks.indexOf('DO $pt409_snapshot$'), endMarker='END $production_snapshot$;';
 const end=checks.indexOf(endMarker,start)+endMarker.length;
 if(start<0||end<start||checks.indexOf(endMarker,end)!==-1)fatal();
 const block=checks.slice(start,end);
 source=replaceOnce(source,scratch+'\n',scratch+'\n'+manual+'\n'+pt409+'\n');
 const lock='LOCK TABLE public.domain_events IN ACCESS EXCLUSIVE MODE;';
 source=replaceOnce(source,lock,'SET LOCAL search_path = pg_catalog, public;\n'+lock+'\n'+block);
 for(const guard of [scratch,event,manual,pt409]) if(source.split(guard).length!==2||source.indexOf(guard)>source.indexOf(lock))fatal();
 if(source.split('BEGIN;').length!==2||source.split('COMMIT;').length!==2||!source.trimEnd().endsWith('COMMIT;'))fatal();
 return Buffer.from(source);
}
async function main(){
 const candidate=await readFile(new URL('fresh-feedback-delete-cascade.DRAFT.guarded.sql.txt',dir));
 const preflight=await readFile(new URL('production-release-preflight.DRAFT.guarded.sql.txt',dir));
 const out=renderConsolidated(candidate,preflight);
 await writeFile(new URL('consolidated-feedback-install.DRAFT.guarded.sql.txt',dir),out,{flag:'wx'});
 process.stdout.write(JSON.stringify({sha256:sha(out),guarded:true})+'\n');
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)main().catch(()=>{process.stderr.write('FEEDBACK_CONSOLIDATION_REFUSED\n');process.exitCode=1;});
