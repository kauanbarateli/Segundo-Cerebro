begin;
set local statement_timeout='30s';
create function pg_temp.routine_assert(ok boolean,message text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'T023 catalogue: %',message;end if;end $$;
do $$ declare t text;f record;signature regprocedure;begin
 foreach t in array array['habits','habit_entries','habit_pauses','drive_folders'] loop
  perform pg_temp.routine_assert((select relrowsecurity from pg_class where oid=to_regclass('public.'||t)),'RLS '||t);
  perform pg_temp.routine_assert(has_table_privilege('authenticated','public.'||t,'SELECT'),'owner SELECT '||t);
  perform pg_temp.routine_assert(not has_table_privilege('anon','public.'||t,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') and not has_table_privilege('authenticated','public.'||t,'INSERT,UPDATE,DELETE,TRUNCATE') and not has_table_privilege('service_role','public.'||t,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'),'no direct writes '||t);
  perform pg_temp.routine_assert((select count(*)=1 and bool_and(polcmd='r') from pg_policy where polrelid=to_regclass('public.'||t)),'SELECT only '||t);
  perform pg_temp.routine_assert(exists(select 1 from pg_trigger where tgrelid=to_regclass('public.'||t) and tgname='projects_habits_revision'),'CAS participation '||t);
 end loop;
 for f in select p.oid,p.proname,p.prosecdef,p.proconfig,n.nspname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','app_private') and (p.proname like 'projects_habits_%' or p.proname in ('project_container_record','project_live_owner')) loop
  signature:=f.oid::regprocedure;perform pg_temp.routine_assert(not has_function_privilege('anon',signature,'EXECUTE') and not has_function_privilege('authenticated',signature,'EXECUTE'),'browser RPC closed '||signature);
  perform pg_temp.routine_assert(exists(select 1 from unnest(f.proconfig) s where s in ('search_path=""','search_path=')),'empty path '||signature);
  if f.proname in ('projects_habits_snapshot','projects_habits_commit','projects_habits_receipt') then perform pg_temp.routine_assert(f.prosecdef=(f.nspname='app_private'),'public invoker/private endpoint definer '||signature);end if;
  perform pg_temp.routine_assert(has_function_privilege('service_role',signature,'EXECUTE')=(f.proname in ('projects_habits_snapshot','projects_habits_commit','projects_habits_receipt')),'exact service boundary '||signature);
 end loop;
 foreach t in array array['captures','tasks','knowledge_notebooks','drive_folders'] loop perform pg_temp.routine_assert(exists(select 1 from pg_trigger where tgrelid=to_regclass('public.'||t) and tgname='zz_project_live_owner'),'live project guard '||t);end loop;
end $$;
select pg_temp.routine_assert(exists(select 1 from pg_constraint where conrelid='public.habit_entries'::regclass and contype='u' and pg_get_constraintdef(oid) like '%user_id, habit_id, done_on%'),'one mark per day');
select pg_temp.routine_assert(not has_table_privilege('authenticated','app_private.projects_habits_revisions','SELECT,INSERT,UPDATE,DELETE'),'private revisions');
rollback;
