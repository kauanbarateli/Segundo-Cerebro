-- Local/manual database assertions. They do not validate hosted Storage objects.
begin;
set local statement_timeout='30s';
create function pg_temp.drive_assert(ok boolean,message text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'Drive catalogue: %',message;end if;end $$;
select pg_temp.drive_assert(current_user='postgres','owner required');
select pg_temp.drive_assert((select count(*)=2 and bool_and(not public and file_size_limit=26214400) from storage.buckets where id in ('second-brain-staging','second-brain-files')),'private bounded buckets');
select pg_temp.drive_assert((select count(*)=2 and bool_and(not polpermissive) from pg_policy where polname in ('second_brain_private_objects','second_brain_private_buckets')),'restrictive Storage closure');
do $$ declare t text;fn record;signature regprocedure;begin
 foreach t in array array['drive_files','capture_file_links'] loop
  perform pg_temp.drive_assert((select relrowsecurity from pg_class where oid=to_regclass('public.'||t)),'RLS '||t);
  perform pg_temp.drive_assert(has_table_privilege('authenticated','public.'||t,'SELECT'),'owner SELECT '||t);
  perform pg_temp.drive_assert(not has_table_privilege('authenticated','public.'||t,'INSERT,UPDATE,DELETE,TRUNCATE'),'no direct owner writes '||t);
  perform pg_temp.drive_assert(not has_table_privilege('anon','public.'||t,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'),'anon denied '||t);
  perform pg_temp.drive_assert(not has_table_privilege('service_role','public.'||t,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'),'service RPC only '||t);
  perform pg_temp.drive_assert((select count(*)=1 and bool_and(polcmd='r') from pg_policy where polrelid=to_regclass('public.'||t)),'SELECT only policy '||t);
 end loop;
 for fn in select p.oid,p.proname,p.prosecdef,p.proconfig,n.nspname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','app_private') and (p.proname like 'drive_%' or p.proname like 'file_%') loop
  signature:=fn.oid::regprocedure;
  perform pg_temp.drive_assert(not has_function_privilege('anon',signature,'EXECUTE') and not has_function_privilege('authenticated',signature,'EXECUTE'),'RPC denied to browser '||signature);
  perform pg_temp.drive_assert(exists(select 1 from unnest(fn.proconfig) setting where setting in ('search_path=""','search_path=')),'empty search path '||signature);
  if fn.proname in ('drive_snapshot','drive_commit','drive_receipt','file_upload_reserve','file_upload_claim','file_upload_release','file_upload_complete','file_upload_status','file_read_metadata','file_avatar_set','file_cleanup_candidates','file_cleanup_ack','file_cleanup_log') then
   perform pg_temp.drive_assert(has_function_privilege('service_role',signature,'EXECUTE'),'service endpoint '||signature);
   perform pg_temp.drive_assert(fn.prosecdef=(fn.nspname='app_private'),'public invoker/private definer '||signature);
  else perform pg_temp.drive_assert(not has_function_privilege('service_role',signature,'EXECUTE'),'helper private '||signature);end if;
 end loop;
end $$;
select pg_temp.drive_assert((select count(*)=2 and bool_and(tgdeferrable and tginitdeferred) from pg_trigger where tgname='drive_integrity'),'deferred live tree');
select pg_temp.drive_assert(exists(select 1 from pg_constraint where conrelid='public.profiles'::regclass and conname='profiles_avatar_file_owner_fk'),'same-owner avatar FK');
select pg_temp.drive_assert(exists(select 1 from pg_trigger where tgrelid='public.captures'::regclass and tgname='capture_files_sync'),'attachment link persistence');
select pg_temp.drive_assert(not exists(select 1 from pg_attribute where attrelid='app_private.upload_reservations'::regclass and not attisdropped and (attname like '%token%' or attname like '%url%')),'no signed credentials stored');
rollback;
