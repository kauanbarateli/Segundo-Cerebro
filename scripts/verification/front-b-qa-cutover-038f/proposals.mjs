// Pure local proposal generation. Never connects to or changes a database.
import {createHash} from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex');
export const COMPOSITION_SHA='038f7a9fa96eaebcdee44b8974e41a1b13dd796651ca5d0fe12a56dcec7fb652';
export const QUARANTINE_GUARD="do $quarantine_guard$ begin raise exception 'REVIEW_AND_QA_AUTHORIZATION_REQUIRED'; end $quarantine_guard$;";
export const CUTOVER_GUARD="do $cutover_guard$ begin raise exception 'REVIEW_AND_QA_AUTHORIZATION_REQUIRED'; end $cutover_guard$;";
export const DRAIN_GUARD="do $drain_guard$ begin raise exception 'EXTERNAL_DRAIN_NOT_PROVEN'; end $drain_guard$;";
export const SCRATCH_GUARD="DO $scratch_guard$ BEGIN RAISE EXCEPTION 'UNREVIEWED SCRATCH SQL: DO NOT APPLY'; END $scratch_guard$;";
export const ROLLOUT_GUARD="DO $rollout_block$ BEGIN RAISE EXCEPTION 'CLEANUP_WRITERS_NOT_PROVEN_PAUSED_AND_DRAINED'; END $rollout_block$;";
const signatures=[
 ['app_private.signup_prune()','cbd79d7ec1fbb93605616e7aa742c8b20ec741e098b7058b244f559add32d726','3d9f5a4a6279fcf97d6e5f3dba8e88932ab2f9f05f35d7e52e0e09afccc99ebe','plpgsql',true],
 ['public.signup_prune()','83a63ed59363fc48cf51dc9265cac25106f0df60eec2a262963cdec1d1843f92','83a63ed59363fc48cf51dc9265cac25106f0df60eec2a262963cdec1d1843f92','sql',false],
 ['app_private.signup_recover_verified_intent(uuid,uuid,text,text,text)','a26121c44a358eeacbeb768b1516f759fd04d14f3772f55925306ea9207da12f','1a43a95c1b473d2b33ca9605553535d4d155d5d33faea851872be89c4fbf6411','plpgsql',true],
 ['public.signup_recover_verified_intent(uuid,uuid,text,text,text)','1c44bc50a684573383162d126641c9afac6e1abf3b5e3507d7400b16ddd8895e','1c44bc50a684573383162d126641c9afac6e1abf3b5e3507d7400b16ddd8895e','sql',false],
];
const functionList=signatures.map(([signature])=>signature).join(',');
const lock=`set local lock_timeout='5s';set local statement_timeout='60s';
lock table cron.job,auth.users,app_private.signup_settings,app_private.user_admission,app_private.signup_intents,app_private.signup_completion_fences_draft in share row exclusive mode;`;
const environment=`do $environment$ begin
 if current_user<>'postgres' or current_database()<>'postgres'
  or (select count(*) from supabase_migrations.schema_migrations where version='20261101172256')<>1
  or not exists(select 1 from app_private.signup_settings where singleton and enabled is false)
  or exists(select 1 from app_private.signup_intents)
  or exists(select 1 from app_private.signup_completion_fences_draft)
  or exists(select 1 from cron.job where lower(jobname) like 'sc-signup-%' or lower(command) like '%signup_prune%' or lower(command) like '%signup_browser_prune%')
  then raise exception 'QA_BASELINE_REFUSED'; end if;
end $environment$;`;
function aclCheck(stage,enabled){
 const values=signatures.map(([name,before,after,lang,definer])=>`('${name}','${stage==='post'?after:before}','${lang}',${definer})`).join(',\n  ');
 return `do $acl_check$ declare e record;ok boolean;begin
 for e in select * from (values ${values}) as v(signature,body_hash,language_name,security_definer) loop
  select coalesce(bool_and(pg_catalog.pg_get_userbyid(p.proowner)='postgres' and p.prokind='f'
   and pg_catalog.pg_get_function_result(p.oid)='jsonb' and p.prosecdef=e.security_definer and not p.proisstrict
   and p.proconfig=ARRAY['search_path=""']::text[] and l.lanname=e.language_name
   and pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.replace(p.prosrc,E'\\r\\n',E'\\n'),'UTF8')),'hex')=e.body_hash
   and pg_catalog.has_function_privilege(pg_catalog.to_regrole('anon'),p.oid,'EXECUTE') is false
   and pg_catalog.has_function_privilege(pg_catalog.to_regrole('authenticated'),p.oid,'EXECUTE') is false
   and pg_catalog.has_function_privilege(pg_catalog.to_regrole('service_role'),p.oid,'EXECUTE') is ${enabled?'true':'false'}
   and (select count(*) from pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
    where a.privilege_type='EXECUTE' and not a.is_grantable and a.grantor=p.proowner and (a.grantee=p.proowner${enabled?" or a.grantee=pg_catalog.to_regrole('service_role')::oid":''}))=${enabled?2:1}
   and not exists(select 1 from pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
    where a.privilege_type<>'EXECUTE' or a.is_grantable or a.grantor<>p.proowner or (a.grantee<>p.proowner${enabled?" and a.grantee<>pg_catalog.to_regrole('service_role')::oid":''}))),false)
   into ok from pg_catalog.pg_proc p join pg_catalog.pg_language l on l.oid=p.prolang where p.oid=pg_catalog.to_regprocedure(e.signature);
  if ok is distinct from true then raise exception 'QA_ACL_OR_BODY_REFUSED'; end if;
 end loop;end $acl_check$;`;
}
export function quarantineProposal(){
 return `-- GUARDED QA proposal. No external drain, project identity or approval is implied.\nbegin;\n${QUARANTINE_GUARD}\n${lock}\n${environment}\n${aclCheck('before',true)}\nrevoke execute on function ${functionList} from service_role;\n${aclCheck('before',false)}\nrollback;\n`;
}
export function cutoverProposal(bytes){
 if(!Buffer.isBuffer(bytes)||sha(bytes)!==COMPOSITION_SHA)throw Error('COMPOSITION_REFUSED');
 const source=bytes.toString('utf8');const begin='BEGIN;\n',end='COMMIT;';
 if(source.split(begin).length!==2||!source.trimEnd().endsWith(end)||source.split(SCRATCH_GUARD).length!==2||source.split(ROLLOUT_GUARD).length!==2)throw Error('COMPOSITION_REFUSED');
 const start=source.indexOf(begin)+begin.length,finish=source.lastIndexOf(end),candidate=source.slice(start,finish);
 return `-- GUARDED QA proposal. Source 038f remains unchanged. No remote authorization is implied.\nbegin;\n${CUTOVER_GUARD}\n${DRAIN_GUARD}\n${lock}\n${environment}\n${aclCheck('before',false)}\ngrant execute on function ${functionList} to service_role;\n${aclCheck('before',true)}\n${candidate}\n${aclCheck('post',true)}\nrollback;\n`;
}
