-- T015 catalogue assertions. Manual owner execution AFTER the reviewed migration.
-- No remote execution is claimed. Does not require an empty project. ROLLBACK only.
begin;
set local statement_timeout='30s';
create function pg_temp.assert_true(ok boolean,message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'T015 catalogue: %',message; end if; end $$;
select pg_temp.assert_true(current_user='postgres','owner required');
do $$ declare t text; f record; signature regprocedure; begin
  foreach t in array array['captures','tasks','categories','projects','capture_links'] loop
    perform pg_temp.assert_true((select relrowsecurity from pg_class where oid=to_regclass('public.'||t)),'RLS: '||t);
    perform pg_temp.assert_true(has_table_privilege('authenticated','public.'||t,'SELECT'),'owner SELECT: '||t);
    perform pg_temp.assert_true(not has_table_privilege('authenticated','public.'||t,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'),'no direct owner write: '||t);
    perform pg_temp.assert_true(not has_table_privilege('anon','public.'||t,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'),'anon denied: '||t);
    perform pg_temp.assert_true(not has_table_privilege('service_role','public.'||t,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'),'service uses RPC only: '||t);
    perform pg_temp.assert_true((select count(*)=1 and bool_and(polcmd='r') from pg_policy where polrelid=to_regclass('public.'||t)),'SELECT policy only: '||t);
    perform pg_temp.assert_true(exists(select 1 from pg_trigger where tgrelid=to_regclass('public.'||t) and tgname='capture_task_revision' and not tgisinternal),'revision trigger: '||t);
  end loop;
  perform pg_temp.assert_true((select relrowsecurity from pg_class where oid='app_private.capture_task_revisions'::regclass),'private revision RLS');
  perform pg_temp.assert_true(not exists(select 1 from pg_policy where polrelid='app_private.capture_task_revisions'::regclass),'private revision has no policy');
  perform pg_temp.assert_true(not has_table_privilege('authenticated','app_private.capture_task_revisions','SELECT,INSERT,UPDATE,DELETE'),'revision private');
  perform pg_temp.assert_true(not has_table_privilege('service_role','app_private.capture_task_revisions','SELECT,INSERT,UPDATE,DELETE'),'revision RPC only');
  for f in select p.oid,p.proname,p.prosecdef,p.proconfig,n.nspname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','app_private') and p.proname like 'capture_task_%' loop
    signature:=f.oid::regprocedure;
    perform pg_temp.assert_true(not has_function_privilege('anon',signature,'EXECUTE') and not has_function_privilege('authenticated',signature,'EXECUTE'),'API roles cannot call '||signature);
    perform pg_temp.assert_true(exists(select 1 from unnest(f.proconfig) s where s in ('search_path=""','search_path=')),'empty search_path: '||signature);
    if f.proname in ('capture_task_snapshot','capture_task_revision','capture_task_receipt','capture_task_commit') then
      perform pg_temp.assert_true(has_function_privilege('service_role',signature,'EXECUTE'),'service wrapper/helper: '||signature);
      perform pg_temp.assert_true(f.prosecdef=(f.nspname='app_private'),'public invoker/private definer: '||signature);
    else perform pg_temp.assert_true(not has_function_privilege('service_role',signature,'EXECUTE'),'helper is not standalone API: '||signature); end if;
  end loop;
end $$;
select pg_temp.assert_true((select count(*)=2 and bool_and(condeferrable and condeferred) from pg_constraint
  where contype='f' and ((conrelid='public.captures'::regclass and confrelid='public.tasks'::regclass) or (conrelid='public.tasks'::regclass and confrelid='public.captures'::regclass))),'deferred conversion cycle');
select pg_temp.assert_true((select count(*)=3 and bool_and(tgdeferrable and tginitdeferred) from pg_trigger where tgname='capture_task_integrity'),'deferred reciprocal/link integrity');
select pg_temp.assert_true((select count(*)=2 from pg_trigger where tgname='capture_task_access_lock' and tgrelid in ('public.user_moderation'::regclass,'public.user_entitlements'::regclass)),'veto and moderation serialize with commands');
select pg_temp.assert_true(not has_table_privilege('service_role','public.domain_events','SELECT'),'no admin event content read grant');
select pg_temp.assert_true((select pg_get_expr(polqual,polrelid) like '%has_feature%capturar%' and pg_get_expr(polqual,polrelid) like '%has_feature%tarefas%' from pg_policy where polrelid='public.domain_events'::regclass and polname='own_read'),'event content obeys entitlement');
select pg_temp.assert_true(to_regprocedure('public.my_access_state()') is not null and has_function_privilege('authenticated','public.my_access_state()','EXECUTE'),'identity access preserved');
select pg_temp.assert_true(has_function_privilege('service_role','public.complete_password_change(uuid,uuid,text)','EXECUTE'),'password completion preserved');
rollback;
