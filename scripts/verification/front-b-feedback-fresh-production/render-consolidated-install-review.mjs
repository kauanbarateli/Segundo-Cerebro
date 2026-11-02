// Offline review preparation only. Output is executable; never send it to a database.
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const sha=b=>createHash('sha256').update(b).digest('hex');
const PIN='d6c3ad7958e1c9dcbeeedaf741ba86794fde4e03e4c97424fa728f6b9fae4bbf';
const guards=[
 "DO $scratch_guard$ BEGIN RAISE EXCEPTION 'UNREVIEWED SCRATCH SQL: DO NOT APPLY'; END $scratch_guard$;\n",
 "DO $manual_guard$ BEGIN RAISE EXCEPTION 'STOP: feedback release not qualified or authorized'; END $manual_guard$;\n",
 "DO $pt409_guard$ BEGIN RAISE EXCEPTION 'STOP: PT409 preservation not yet qualified'; END $pt409_guard$;\n",
 "DO $event_contract_guard$ BEGIN RAISE EXCEPTION 'DOMAIN_EVENT_CONTRACT_NOT_QUALIFIED'; END $event_contract_guard$;\n",
];
export function renderReview(source){
 if(!Buffer.isBuffer(source)||sha(source)!==PIN)throw Error('REVIEW_SOURCE_REFUSED');
 let result=source.toString('utf8');if(!Buffer.from(result).equals(source))throw Error('REVIEW_ENCODING_REFUSED');
 const lock='LOCK TABLE public.domain_events IN ACCESS EXCLUSIVE MODE;';
 for(const guard of guards){if(result.split(guard).length!==2||result.indexOf(guard)>result.indexOf(lock))throw Error('REVIEW_GUARD_REFUSED');result=result.replace(guard,()=> '');}
 if(result.split(lock).length!==2||!result.trimEnd().endsWith('COMMIT;'))throw Error('REVIEW_STRUCTURE_REFUSED');
 return Buffer.from(result);
}
async function main(){const source=await readFile(new URL('./consolidated-feedback-install.DRAFT.guarded.sql.txt',import.meta.url));
 const out=renderReview(source);await writeFile(new URL('./consolidated-feedback-install.production-review.sql.txt',import.meta.url),out,{flag:'wx'});
 process.stdout.write(JSON.stringify({sha256:sha(out),executable:true,authorized:false})+'\n');}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)main().catch(()=>{process.stderr.write('REVIEW_SOURCE_REFUSED\n');process.exitCode=1;});
