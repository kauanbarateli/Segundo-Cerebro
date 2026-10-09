-- T016 catalogue assertions, prepared for supervised owner execution.
-- No remote execution is claimed. Existing users/data are allowed. ROLLBACK only.
begin;
set local statement_timeout='30s';
create function pg_temp.assert_true(ok boolean,message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'T016 catalogue: %',message; end if; end $$;
select pg_temp.assert_true(current_user='postgres','owner required');
do $$ declare s text; f record; signature regprocedure; begin
  foreach s in array array['public','app_private'] loop
    signature:=to_regprocedure(s||'.activity_page(uuid,uuid,integer,timestamptz,uuid)');
    perform pg_temp.assert_true(signature is not null,'function exists: '||s);
    select p.prosecdef,p.proconfig,p.pronargdefaults,p.prorettype into strict f from pg_proc p where p.oid=signature;
    perform pg_temp.assert_true(f.prosecdef=(s='app_private'),'public invoker/private definer: '||s);
    perform pg_temp.assert_true(f.pronargdefaults=3 and f.prorettype='jsonb'::regtype,'defaults and result: '||s);
    perform pg_temp.assert_true(exists(select 1 from unnest(f.proconfig) c where c in ('search_path=""','search_path=')),'empty search_path: '||s);
    perform pg_temp.assert_true(has_function_privilege('service_role',signature,'EXECUTE'),'service can call: '||s);
    perform pg_temp.assert_true(not has_function_privilege('anon',signature,'EXECUTE') and not has_function_privilege('authenticated',signature,'EXECUTE'),'API user roles cannot call: '||s);
    perform pg_temp.assert_true(not exists(select 1 from pg_proc p,
      lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
      where p.oid=signature and acl.grantee=0 and acl.privilege_type='EXECUTE'),'PUBLIC cannot call: '||s);
  end loop;
end $$;
select pg_temp.assert_true((select relrowsecurity from pg_class where oid='public.domain_events'::regclass),'events retain RLS');
select pg_temp.assert_true(not has_table_privilege('authenticated','public.domain_events','SELECT') and has_column_privilege('authenticated','public.domain_events','id','SELECT') and has_column_privilege('authenticated','public.domain_events','occurred_at','SELECT'),'owner event metadata read preserved');
select pg_temp.assert_true(not has_column_privilege('authenticated','public.domain_events','before','SELECT') and not has_column_privilege('authenticated','public.domain_events','after','SELECT') and not has_column_privilege('authenticated','public.domain_events','capture_task_payload','SELECT'),'event content has no direct grant');
select pg_temp.assert_true(not has_table_privilege('authenticated','public.domain_events','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'),'owner events append-only');
select pg_temp.assert_true(not has_table_privilege('anon','public.domain_events','SELECT,INSERT,UPDATE,DELETE'),'anonymous events closed');
select pg_temp.assert_true(not has_table_privilege('service_role','public.domain_events','SELECT,INSERT,UPDATE,DELETE'),'service uses projected RPC only');
select pg_temp.assert_true((select count(*)=1 and bool_and(polcmd='r') from pg_policy where polrelid='public.domain_events'::regclass),'only SELECT event policy');
select pg_temp.assert_true((select pg_get_expr(polqual,polrelid) like '%current_user_active%' and pg_get_expr(polqual,polrelid) like '%has_feature%activity_projection_feature%' from pg_policy where polrelid='public.domain_events'::regclass and polname='own_read'),'direct own metadata reads enforce active session and expanded source feature');
select pg_temp.assert_true(exists(select 1 from pg_index where indexrelid='public.domain_events_capture_task_idx'::regclass and indisvalid),'T015 keyset index available');
select pg_temp.assert_true((select count(*)=2 from pg_trigger where tgname='capture_task_access_lock' and tgrelid in ('public.user_moderation'::regclass,'public.user_entitlements'::regclass)),'authorization shares per-user lock');
select pg_temp.assert_true(has_function_privilege('service_role','public.capture_task_commit(uuid,uuid,text,jsonb)','EXECUTE'),'writer RPC preserved');
rollback;
