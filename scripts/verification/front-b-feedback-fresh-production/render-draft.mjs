// Offline draft generator. It preserves fatal guards and never connects to a database.
import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const sourceHash='62d32577c5946474895c6e6e485b68d0de4fac034442b4b296430b6b09b85f0b';
const sha=value=>createHash('sha256').update(value).digest('hex');
function once(input, search, value) {
 if (input.split(search).length!==2) throw Error('FEEDBACK_SOURCE_MISMATCH');
 return input.replace(search,()=>value);
}
export function render(source) {
 if (!Buffer.isBuffer(source)||sha(source)!==sourceHash) throw Error('FEEDBACK_SOURCE_HASH_MISMATCH');
 const text=source.toString('utf8'); if (!Buffer.from(text).equals(source)) throw Error('FEEDBACK_SOURCE_ENCODING');
 const marker="set local lock_timeout='5s';\nset local statement_timeout='60s';";
 const guarded=`${marker}
 -- The pinned catalog observation is point-in-time and does not identify the project.
-- The two fatal guards above remain in force; this is not a migration.
LOCK TABLE public.domain_events IN ACCESS EXCLUSIVE MODE;
DO $catalog_preflight$
DECLARE c pg_catalog.pg_constraint; observed text; expression_hash text;
BEGIN
 IF pg_catalog.current_setting('server_version_num') <> '170011' THEN
  RAISE EXCEPTION 'FEEDBACK_SERVER_VERSION_REFUSED';
 END IF;
 SELECT * INTO STRICT c FROM pg_catalog.pg_constraint
  WHERE conrelid='public.domain_events'::pg_catalog.regclass AND conname='domain_events_entity_type_check';
 observed := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.pg_get_constraintdef(c.oid),'UTF8')),'hex');
 expression_hash := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.pg_get_expr(c.conbin,c.conrelid),'UTF8')),'hex');
 IF c.contype IS DISTINCT FROM 'c' OR c.convalidated IS DISTINCT FROM true OR
   c.condeferrable IS DISTINCT FROM false OR c.condeferred IS DISTINCT FROM false OR c.connoinherit IS DISTINCT FROM false OR
   observed IS DISTINCT FROM '803504cb5f1c0ab40e7334eea9dc43e263ef54c04669c9ca7c0f76ba212280d3' OR
   expression_hash IS DISTINCT FROM 'c73df7bd615743224694fa48233fb75e5c28f44e2c9793c8843a207d9d878533' OR
   NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class r WHERE r.oid=c.conrelid AND r.relkind='r' AND r.relrowsecurity AND pg_catalog.pg_get_userbyid(r.relowner)='postgres') THEN
  RAISE EXCEPTION 'FEEDBACK_EVENT_CONTRACT_REFUSED';
 END IF;
 IF EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname IN ('app_private','public') AND p.proname IN
    ('feedback_list','feedback_submit','feedback_barrier_submit','feedback_barrier_status','feedback_barrier_cancel',
     'draft_feedback_lock','draft_feedback_actor','draft_feedback_submit','draft_feedback_status','draft_feedback_cancel')) THEN
  RAISE EXCEPTION 'FEEDBACK_EXISTING_FUNCTION_REFUSED';
 END IF;
END $catalog_preflight$;`;
 return Buffer.from(once(text,marker,guarded));
}
async function main() {
 const source=await readFile(new URL('../../../supabase/operations/candidates/feedback-reconciliation-fresh.guarded.sql.txt',import.meta.url));
 const result=render(source);
 const output=new URL('./fresh-feedback-production.DRAFT.guarded.sql.txt',import.meta.url);
 await writeFile(output,result,{flag:'wx'});
 process.stdout.write(JSON.stringify({sha256:sha(result),guarded:true})+'\n');
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url) main().catch(error=>{process.stderr.write(error.message+'\n');process.exitCode=1;});
