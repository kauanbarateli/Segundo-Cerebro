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
function once(s,a,b){if(s.split(a).length!==2)throw Error('EXACT_TRANSFORM_REFUSED');return s.replace(a,b);}
export async function makeProposals(bytes){
 const source=await readFile(new URL('../front-b-qa-cutover-app-barrier-draft/proposals.mjs',import.meta.url));if(hash(source)!==BASE)throw Error('SOURCE_REFUSED');
 const prior=await makeBarrier(bytes),acl='revoke execute on function app_private.signup_prune(),public.signup_prune(),app_private.signup_recover_verified_intent(uuid,uuid,text,text,text),public.signup_recover_verified_intent(uuid,uuid,text,text,text) from service_role;',grant='grant execute on function app_private.signup_prune(),public.signup_prune(),app_private.signup_recover_verified_intent(uuid,uuid,text,text,text),public.signup_recover_verified_intent(uuid,uuid,text,text,text) to service_role;';
 const quarantine=once(prior.quarantine,acl,guard+'\n'+install+'\n'+check+'\n'+acl);
 const cutover=once(prior.cutover,grant,guard+'\n'+check+'\n'+grant);
 const thaw=`-- GUARDED REVIEW ONLY. Owner/worker drain, QA identity and authorization are external.\nbegin;\n${guard}\nset local lock_timeout='5s';set local statement_timeout='60s';\nlock table app_private.signup_settings,app_private.signup_intents,app_private.signup_origins,app_private.signup_completion_fences_draft in share row exclusive mode;\ndo $thaw_preflight$ begin if not exists(select 1 from app_private.signup_settings where singleton and enabled is false) or exists(select 1 from app_private.signup_intents) or exists(select 1 from app_private.signup_origins) or exists(select 1 from app_private.signup_completion_fences_draft) then raise exception 'THAW_BASELINE_REFUSED'; end if; end $thaw_preflight$;\n${check}\nDROP TRIGGER sc_cutover_freeze_038f ON app_private.signup_intents;\nDROP TRIGGER sc_cutover_freeze_038f ON app_private.signup_origins;\nDROP FUNCTION app_private.sc_cutover_freeze_038f();\nrollback;\n`;
 return Object.freeze({quarantine,cutover,thaw});
}
