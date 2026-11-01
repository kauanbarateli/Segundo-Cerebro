// Inert QA review proposal. No connection, authority or drain is implied.
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {makeProposals as makeBarrier} from '../front-b-qa-cutover-app-barrier-draft/proposals.mjs';
const BASE='708335d582c77d6c7e2510bb97a48bd64a36286ee1033042dfbb59c4fbc93ddc';
const hash=b=>createHash('sha256').update(b).digest('hex');
const body="\nbegin\n raise exception 'QA_CUTOVER_PERSISTENT_WRITE_FREEZE' using errcode='55000';\nend;\n";
const bodyHash=hash(Buffer.from(body));
const guard="do $freeze_guard$ begin raise exception 'FREEZE_DRAIN_AND_QA_AUTHORIZATION_NOT_PROVEN'; end $freeze_guard$;";
const install=`
-- Persist beyond the transaction; this deliberately blocks all DML/TRUNCATE.
CREATE FUNCTION app_private.sc_cutover_freeze_038f() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $freeze_body$${body}$freeze_body$;
REVOKE ALL ON FUNCTION app_private.sc_cutover_freeze_038f() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER sc_cutover_freeze_038f BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON app_private.signup_intents FOR EACH STATEMENT EXECUTE FUNCTION app_private.sc_cutover_freeze_038f();
CREATE TRIGGER sc_cutover_freeze_038f BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON app_private.signup_origins FOR EACH STATEMENT EXECUTE FUNCTION app_private.sc_cutover_freeze_038f();
ALTER TABLE app_private.signup_intents ENABLE ALWAYS TRIGGER sc_cutover_freeze_038f;
ALTER TABLE app_private.signup_origins ENABLE ALWAYS TRIGGER sc_cutover_freeze_038f;`;
const check=`
do $freeze_check$ declare fn oid; begin
 fn:=pg_catalog.to_regprocedure('app_private.sc_cutover_freeze_038f()');
 if fn is null or not exists(select 1 from pg_catalog.pg_proc p join pg_catalog.pg_language l on l.oid=p.prolang
  where p.oid=fn and pg_catalog.pg_get_userbyid(p.proowner)='postgres' and p.prokind='f' and not p.prosecdef and not p.proisstrict and p.proconfig=ARRAY['search_path=""']::text[] and l.lanname='plpgsql' and pg_catalog.pg_get_function_result(p.oid)='trigger'
   and pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.replace(p.prosrc,E'\\r\\n',E'\\n'),'UTF8')),'hex')='${bodyHash}'
   and not pg_catalog.has_function_privilege(pg_catalog.to_regrole('anon'),p.oid,'EXECUTE')
   and not pg_catalog.has_function_privilege(pg_catalog.to_regrole('authenticated'),p.oid,'EXECUTE')
   and not pg_catalog.has_function_privilege(pg_catalog.to_regrole('service_role'),p.oid,'EXECUTE')
   and not exists(select 1 from pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a where a.privilege_type<>'EXECUTE' or a.is_grantable or a.grantor<>p.proowner or a.grantee<>p.proowner))
  or (select count(*) from pg_catalog.pg_trigger t where t.tgfoid=fn and not t.tgisinternal)<>2
  or not exists(select 1 from pg_catalog.pg_trigger t where t.tgname='sc_cutover_freeze_038f' and t.tgrelid='app_private.signup_intents'::regclass and t.tgfoid=fn and t.tgtype=62 and t.tgenabled='A' and t.tgqual is null and t.tgnargs=0 and t.tgattr=''::pg_catalog.int2vector and t.tgconstraint=0 and not t.tgisinternal)
  or not exists(select 1 from pg_catalog.pg_trigger t where t.tgname='sc_cutover_freeze_038f' and t.tgrelid='app_private.signup_origins'::regclass and t.tgfoid=fn and t.tgtype=62 and t.tgenabled='A' and t.tgqual is null and t.tgnargs=0 and t.tgattr=''::pg_catalog.int2vector and t.tgconstraint=0 and not t.tgisinternal)
 then raise exception 'PERSISTENT_FREEZE_NOT_PROVEN'; end if;
end $freeze_check$;`;
const verifierSha='e7596b4d031c20bd1a367ad838524c536965e7dc9f5c52ad8a638ce5400e1514';
async function integrity(){
 const raw=await readFile(new URL('../../../supabase/operations/verify-onboarding-conflict-code.sql',import.meta.url));
 if(hash(raw)!==verifierSha)throw Error('PT409_SOURCE_REFUSED');
 const sql=raw.toString('utf8'),start=sql.indexOf('coalesce((select'),end=sql.indexOf(', false)\n);',start);
 if(start<0||end<0||sql.indexOf('coalesce((select',start+1)!==-1)throw Error('PT409_EXTRACT_REFUSED');
 const expression=sql.slice(start,end)+', false)';
 return `\ndo $integrity_028_pt409$ declare old_path text:=pg_catalog.current_setting('search_path'); begin
 perform pg_catalog.set_config('search_path','pg_catalog, public',true);
 if not coalesce((select count(*)=1 and bool_and(name='m028_front_b_signup_feedback_metrics_qa' and cardinality(statements)=1 and array_lower(statements,1)=1 and encode(sha256(convert_to(statements[1],'UTF8')),'hex')='bbb652684f1c526f4601c33b575c8d1cf6338feba34ab9a2d58166646faba4d7') from supabase_migrations.schema_migrations where version='20261101172256'),false)
  or (${expression}) is distinct from true then raise exception 'LEDGER_028_OR_PT409_REFUSED'; end if;
 perform pg_catalog.set_config('search_path',old_path,true);
end $integrity_028_pt409$;`;
}
function once(s,a,b){if(s.split(a).length!==2)throw Error('EXACT_TRANSFORM_REFUSED');return s.replace(a,b);}
export async function makeProposals(bytes){
 const source=await readFile(new URL('../front-b-qa-cutover-app-barrier-draft/proposals.mjs',import.meta.url));if(hash(source)!==BASE)throw Error('SOURCE_REFUSED');
 const prior=await makeBarrier(bytes),acl='revoke execute on function app_private.signup_prune(),public.signup_prune(),app_private.signup_recover_verified_intent(uuid,uuid,text,text,text),public.signup_recover_verified_intent(uuid,uuid,text,text,text) from service_role;',grant='grant execute on function app_private.signup_prune(),public.signup_prune(),app_private.signup_recover_verified_intent(uuid,uuid,text,text,text),public.signup_recover_verified_intent(uuid,uuid,text,text,text) to service_role;';
 const proof=await integrity();
 const quarantine=once(prior.quarantine,acl,proof+'\n'+guard+'\n'+install+'\n'+check+'\n'+acl);
 const cutover=once(prior.cutover,grant,proof+'\n'+guard+'\n'+check+'\n'+grant);
 const checks=[...prior.quarantine.matchAll(/do \$acl_check\$[\s\S]*?end \$acl_check\$;/g)].map(x=>x[0]);
 const finalChecks=[...cutover.matchAll(/do \$acl_check\$[\s\S]*?end \$acl_check\$;/g)].map(x=>x[0]);
 if(checks.length!==2||finalChecks.length!==3)throw Error('ACL_EXTRACT_REFUSED');
 const prefix=`-- GUARDED REVIEW ONLY. Owner/worker drain, QA identity and authorization are external.\nbegin;\n${guard}\nset local lock_timeout='5s';set local statement_timeout='60s';\nlock table app_private.signup_settings,app_private.user_admission,app_private.signup_intents,app_private.signup_origins,app_private.signup_completion_fences_draft in share row exclusive mode;\ndo $thaw_preflight$ begin if not exists(select 1 from app_private.signup_settings where singleton and enabled is false) or exists(select 1 from app_private.signup_intents) or exists(select 1 from app_private.signup_origins) or exists(select 1 from app_private.signup_completion_fences_draft) then raise exception 'THAW_BASELINE_REFUSED'; end if; end $thaw_preflight$;\n${proof}\n${check}\n`;
 const remove=`DROP TRIGGER sc_cutover_freeze_038f ON app_private.signup_intents;\nDROP TRIGGER sc_cutover_freeze_038f ON app_private.signup_origins;\nDROP FUNCTION app_private.sc_cutover_freeze_038f();\nrollback;\n`;
 // The service assigns the cutover version and the final bytes are not yet known.
 // An unconditional blocker prevents a fabricated ledger digest from being accepted.
 const thaw=prefix+`do $cutover_attestation_guard$ begin raise exception 'CUTOVER_VERSION_AND_FINAL_SQL_DIGEST_NOT_YET_FIXED'; end $cutover_attestation_guard$;\n`+
  `do $cutover_ledger_check$ begin if not coalesce((select count(*)=1 and bool_and(version ~ '^[0-9]{14}$' and version<>'20261101172256' and cardinality(statements)=1 and array_lower(statements,1)=1 and encode(sha256(convert_to(statements[1],'UTF8')),'hex')='REPLACE_WITH_REVIEWED_FINAL_SHA256') from supabase_migrations.schema_migrations where name='m029_front_b_signup_browser_cutover_038f_qa'),false) then raise exception 'CUTOVER_LEDGER_REFUSED'; end if; end $cutover_ledger_check$;\n`+
  `do $cutover_catalog$ begin if pg_catalog.to_regclass('app_private.signup_browser_attempts') is null or pg_catalog.to_regclass('app_private.signup_browser_legal_versions') is null or not exists(select 1 from pg_catalog.pg_attribute where attrelid='app_private.user_admission'::regclass and attname='signup_created_after_cutover' and not attisdropped) then raise exception 'CUTOVER_CATALOG_REFUSED'; end if; end $cutover_catalog$;\n`+finalChecks[2]+'\n'+remove;
 const cancel=prefix+`do $cancel_guard$ begin raise exception 'CANCEL_REQUIRES_PROOF_CUTOVER_NEVER_COMMITTED_AND_SEPARATE_REVIEW'; end $cancel_guard$;\n`+
  `do $cancel_catalog$ begin if pg_catalog.to_regclass('app_private.signup_browser_attempts') is not null or pg_catalog.to_regclass('app_private.signup_browser_legal_versions') is not null or exists(select 1 from pg_catalog.pg_attribute where attrelid='app_private.user_admission'::regclass and attname='signup_created_after_cutover' and not attisdropped) then raise exception 'CANCEL_CATALOG_REFUSED'; end if; end $cancel_catalog$;\n`+checks[1]+'\n'+grant+'\n'+checks[0]+'\n'+remove;
 return Object.freeze({quarantine,cutover,thaw,cancel});
}
