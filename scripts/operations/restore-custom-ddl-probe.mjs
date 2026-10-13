import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { BackupError } from './backup-format.mjs';
import { queryPostgres } from './postgres-process.mjs';
import { restoreConfiguration } from './restore-target.mjs';

// Target-only capability proof. All DDL is rolled back, then its absence is
// asserted in the SAME connection. No original custom object is touched.
export const CUSTOM_DDL_PROBE_SQL = `begin;
set local statement_timeout = '10s';
set local lock_timeout = '3s';
set local search_path = pg_catalog;
set local row_security = off;
do $sc_custom_probe$
declare
  empty_target boolean;
  created_function boolean := false;
  created_identity boolean := false;
  created_admin boolean := false;
  created_objects boolean := false;
  created_buckets boolean := false;
begin
  if current_user <> session_user then raise sqlstate '55000'; end if;
  select not exists(select 1 from auth.users)
    and not exists(select 1 from storage.objects)
    and not exists(select 1 from storage.buckets)
    and not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname in ('public','app_private') and c.relkind in ('r','p')
      and not exists(select 1 from pg_depend d where d.classid='pg_class'::regclass and d.objid=c.oid and d.deptype='e'))
    into empty_target;
  if not empty_target then raise sqlstate '55000'; end if;
  if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='second_brain_restore_qualification_trigger_v1')
    or exists(select 1 from pg_trigger where tgrelid='auth.users'::regclass
      and tgname in ('second_brain_restore_qualification_identity_v1','second_brain_restore_qualification_admin_v1'))
    or exists(select 1 from pg_policy where polrelid in ('storage.objects'::regclass,'storage.buckets'::regclass)
      and polname='second_brain_restore_qualification_policy_v1')
    then raise sqlstate '55000'; end if;
  begin
    execute $ddl$create function public.second_brain_restore_qualification_trigger_v1()
      returns trigger language plpgsql set search_path=pg_catalog as 'begin return new; end'$ddl$;
    created_function := true;
  exception when insufficient_privilege then null;
  end;
  if created_function then
    begin
      execute 'create trigger second_brain_restore_qualification_identity_v1 after insert on auth.users
        for each row execute function public.second_brain_restore_qualification_trigger_v1()';
      created_identity := true;
    exception when insufficient_privilege then null;
    end;
    begin
      execute 'create constraint trigger second_brain_restore_qualification_admin_v1
        after insert on auth.users deferrable initially deferred
        for each row execute function public.second_brain_restore_qualification_trigger_v1()';
      created_admin := true;
    exception when insufficient_privilege then null;
    end;
  end if;
  begin
    execute 'create policy second_brain_restore_qualification_policy_v1 on storage.objects
      for all using (false) with check (false)';
    created_objects := true;
  exception when insufficient_privilege then null;
  end;
  begin
    execute 'create policy second_brain_restore_qualification_policy_v1 on storage.buckets
      for all using (false) with check (false)';
    created_buckets := true;
  exception when insufficient_privilege then null;
  end;
  perform set_config('second_brain_operator.custom_ddl_report',jsonb_build_object(
    'version',1,'sameActor',current_user=session_user,'targetEmpty',empty_target,
    'probesInitiallyAbsent',true,'functionCreated',created_function,
    'identityTriggerCreated',created_identity,'adminConstraintTriggerCreated',created_admin,
    'objectsPolicyCreated',created_objects,'bucketsPolicyCreated',created_buckets)::text,true);
end
$sc_custom_probe$;
select current_setting('second_brain_operator.custom_ddl_report')::jsonb as report;
rollback;
-- This postcondition executes only after ROLLBACK in the original connection.
-- Failure aborts the transport, so pre-rollback JSON alone cannot pass.
do $sc_custom_absent$
begin
  if current_user <> session_user
    or current_setting('transaction_read_only') <> 'off'
    or exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='second_brain_restore_qualification_trigger_v1')
    or exists(select 1 from pg_trigger where tgrelid='auth.users'::regclass
      and tgname in ('second_brain_restore_qualification_identity_v1','second_brain_restore_qualification_admin_v1'))
    or exists(select 1 from pg_policy where polrelid in ('storage.objects'::regclass,'storage.buckets'::regclass)
      and polname='second_brain_restore_qualification_policy_v1')
    or nullif(current_setting('second_brain_operator.custom_ddl_report',true),'') is not null
    then raise sqlstate '55000'; end if;
end
$sc_custom_absent$;`;

const keys=['version','sameActor','targetEmpty','probesInitiallyAbsent','functionCreated','identityTriggerCreated','adminConstraintTriggerCreated','objectsPolicyCreated','bucketsPolicyCreated'];
export function validateCustomDdlProbe(input) {
  const refuse=()=>{throw new BackupError('RESTORE_CUSTOM_DDL_REPORT_INVALID');};
  if(!input || typeof input!=='object' || Array.isArray(input)) refuse();
  let descriptors;try{descriptors=Object.getOwnPropertyDescriptors(input);}catch{refuse();}
  if(Reflect.ownKeys(descriptors).length!==keys.length || Reflect.ownKeys(descriptors).some(key=>!keys.includes(key))) refuse();
  const value=Object.create(null);
  for(const key of keys){const descriptor=descriptors[key];if(!descriptor?.enumerable || !Object.hasOwn(descriptor,'value'))refuse();value[key]=descriptor.value;}
  if(value.version!==1)refuse();
  for(const key of keys.slice(1))if(typeof value[key]!=='boolean')refuse();
  if(!value.sameActor || !value.targetEmpty || !value.probesInitiallyAbsent || !value.functionCreated && (value.identityTriggerCreated || value.adminConstraintTriggerCreated))refuse();
  return Object.freeze(value);
}
const closedCodes=new Set(['INVALID_ARGUMENTS','RESTORE_CUSTOM_DDL_REPORT_INVALID','ISOLATED_RESTORE_TARGET_REQUIRED','ISOLATED_STORAGE_CONFIGURATION_REQUIRED','RESTORE_ABSOLUTE_EXECUTABLES_REQUIRED','PERSONAL_POSTGRES_CONFIGURATION_REQUIRED','PSQL_UNAVAILABLE','PSQL_FAILED','PSQL_TIMEOUT','PSQL_OUTPUT_LIMIT','PSQL_INVALID_REPORT']);
function closedError(error){try{const descriptor=Object.getOwnPropertyDescriptor(error,'code');if(error instanceof BackupError && descriptor && Object.hasOwn(descriptor,'value') && closedCodes.has(descriptor.value))return descriptor.value;}catch{/* No exception text or getter. */}return 'RESTORE_CUSTOM_DDL_UNAVAILABLE';}
export async function runCustomDdlProbe(argv,env,output=value=>process.stdout.write(JSON.stringify(value)+'\n'),dependencies={}) {
  try{
    if(!Array.isArray(argv))throw new BackupError('INVALID_ARGUMENTS');
    if(argv.length===0 || argv.length===1 && argv[0]==='--help'){output({version:1,targetOnly:true,transactionalDdl:true,rollbackRequired:true,archiveRead:false,restoreAccepted:false});return 0;}
    if(argv.length!==1 || argv[0]!=='check')throw new BackupError('INVALID_ARGUMENTS');
    const config=restoreConfiguration(env);
    const query=dependencies.query??((request,options)=>queryPostgres(config.psql,config.pg,request,dependencies.spawn,options));
    const facts=validateCustomDdlProbe(await query({sql:CUSTOM_DDL_PROBE_SQL},{timeoutMs:15000}));
    output({version:1,operation:'restore_custom_ddl_probe',facts,rollbackAndProbeAbsenceAssertedInSameConnection:true,persistentMutation:false,archiveRead:false,restoreAccepted:false});
    return 0;
  }catch(error){output({ok:false,error:closedError(error)});return 1;}
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href)process.exitCode=await runCustomDdlProbe(process.argv.slice(2),process.env);
