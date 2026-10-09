-- T017 catalog assertions for a future authorized, dedicated database. Not run remotely.
begin;
set local statement_timeout='30s';
create function pg_temp.assert_admin(ok boolean,message text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'T017: %',message; end if; end $$;
do $$ declare t record; f record; begin
 for t in select c.oid,c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where (n.nspname='app_private' and c.relname='admin_operations') or (n.nspname='public' and c.relname='admin_audit_events') loop
  perform pg_temp.assert_admin(t.relrowsecurity,'RLS: '||t.relname);
  perform pg_temp.assert_admin(not exists(select 1 from pg_policy where polrelid=t.oid),'no direct-content policies: '||t.relname);
  perform pg_temp.assert_admin(not has_table_privilege('anon',t.oid,'SELECT,INSERT,UPDATE,DELETE'),'anon closed: '||t.relname);
  perform pg_temp.assert_admin(not has_table_privilege('authenticated',t.oid,'SELECT,INSERT,UPDATE,DELETE'),'browser closed: '||t.relname);
  perform pg_temp.assert_admin(not has_table_privilege('service_role',t.oid,'SELECT,INSERT,UPDATE,DELETE'),'service uses guarded RPC only: '||t.relname);
 end loop;
 for f in select p.oid,p.proname,p.prosecdef,p.proconfig,n.nspname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','app_private') and p.proname like 'admin_%' loop
  perform pg_temp.assert_admin(f.prosecdef=(f.nspname='app_private'),'private definer, public invoker: '||f.proname);
  perform pg_temp.assert_admin(exists(select 1 from unnest(f.proconfig) s where s in ('search_path=""','search_path=')),'empty search_path: '||f.proname);
  perform pg_temp.assert_admin(not has_function_privilege('anon',f.oid,'EXECUTE') and not has_function_privilege('authenticated',f.oid,'EXECUTE'),'browser cannot execute: '||f.proname);
  perform pg_temp.assert_admin(has_function_privilege('service_role',f.oid,'EXECUTE')=(f.proname in ('admin_snapshot','admin_reserve','admin_claim','admin_operation_guard','admin_transition','admin_complete')),'exact service boundary: '||f.proname);
 end loop;
end $$;
select pg_temp.assert_admin((select count(*)=7 from information_schema.columns where table_schema='public' and table_name='admin_audit_events'),'fixed metadata audit schema');
select pg_temp.assert_admin(not exists(select 1 from information_schema.columns where (table_schema='public' and table_name='admin_audit_events' and column_name not in ('id','actor_user_id','target_user_id','operation_id','action','phase','occurred_at')) or (table_schema='app_private' and table_name='admin_operations' and column_name not in ('operation_id','actor_user_id','target_user_id','command','client_id','commitment','phase','role','feature_key','allowed','prior_status','prior_must_change_password','active_execution','created_at','updated_at'))),'fixed metadata only, without credential/e-mail/content columns');
select pg_temp.assert_admin((select data_type='boolean' from information_schema.columns where table_schema='app_private' and table_name='admin_operations' and column_name='prior_must_change_password'),'password-change checkpoint is a boolean flag, never a credential');
select pg_temp.assert_admin(exists(select 1 from pg_indexes where schemaname='app_private' and indexname='admin_operation_pending_target_idx' and indexdef like '%UNIQUE%' and indexdef like '%WHERE%'),'one unfinished operation per target');
select pg_temp.assert_admin(not has_table_privilege('service_role','public.domain_events','SELECT'),'admin cannot read personal domain history');
rollback;
