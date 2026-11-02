// Offline guarded proposal only. No connections, no automatic migration.
import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const PIN='25f765a5743512ad16aa3100e1959c9d74c7dee03726156da2af56e478c1ded2';
const sha=x=>createHash('sha256').update(x).digest('hex');
export function renderDeleteCascade(source){
 if(!Buffer.isBuffer(source)||sha(source)!==PIN)throw Error('FEEDBACK_SOURCE_REFUSED');
 let s=source.toString('utf8');if(!Buffer.from(s).equals(source))throw Error('FEEDBACK_ENCODING_REFUSED');
 const needle='CREATE TABLE app_private.feedback_barriers_draft (\n user_id uuid NOT NULL,\n';
 const target='CREATE TABLE app_private.feedback_barriers_draft (\n user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,\n';
 if(s.split(needle).length!==2)throw Error('FEEDBACK_SOURCE_MISMATCH');
 s=s.replace(needle,()=>target);
 for(const guard of ["DO $scratch_guard$ BEGIN RAISE EXCEPTION 'UNREVIEWED SCRATCH SQL: DO NOT APPLY'; END $scratch_guard$;","DO $event_contract_guard$ BEGIN RAISE EXCEPTION 'DOMAIN_EVENT_CONTRACT_NOT_QUALIFIED'; END $event_contract_guard$;"]){if(s.split(guard).length!==2)throw Error('FEEDBACK_GUARD_REFUSED');}
 return Buffer.from(s);
}
async function main(){const source=await readFile(new URL('./fresh-feedback-production.DRAFT.guarded.sql.txt',import.meta.url));const out=renderDeleteCascade(source);await writeFile(new URL('./fresh-feedback-delete-cascade.DRAFT.guarded.sql.txt',import.meta.url),out,{flag:'wx'});process.stdout.write(JSON.stringify({sha256:sha(out),guarded:true})+'\n');}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)main().catch(()=>{process.stderr.write('FEEDBACK_CASCADE_REFUSED\n');process.exitCode=1;});
