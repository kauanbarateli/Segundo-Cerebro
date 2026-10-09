begin;
create function pg_temp.settings_assert(ok boolean,message text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'T027 catalogue: %',message;end if;end $$;
do $$declare f record;begin
 for f in select p.oid,p.prosecdef,p.proconfig,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('settings_snapshot','settings_commit') loop
  perform pg_temp.settings_assert(f.prosecdef,'service-only definer endpoint');perform pg_temp.settings_assert(exists(select 1 from unnest(f.proconfig) s where s in ('search_path=""','search_path=')),'empty search path');
  perform pg_temp.settings_assert(has_function_privilege('service_role',f.oid,'EXECUTE') and not has_function_privilege('anon',f.oid,'EXECUTE') and not has_function_privilege('authenticated',f.oid,'EXECUTE'),'exact server endpoint grants');
 end loop;
end $$;
select pg_temp.settings_assert((select count(*)=2 from information_schema.columns where table_schema='public' and table_name='user_preferences' and column_name in ('meeting_reminders_enabled','meeting_reminder_minutes')),'meeting preferences fields');
select pg_temp.settings_assert(exists(select 1 from pg_constraint where conrelid='public.profiles'::regclass and conname='profiles_avatar_file_owner_fk'),'avatar owned file FK');
select pg_temp.settings_assert(not has_table_privilege('authenticated','public.user_preferences','INSERT,UPDATE,DELETE') and not has_table_privilege('authenticated','public.profiles','INSERT,UPDATE,DELETE') and not has_table_privilege('authenticated','public.user_modules','INSERT,UPDATE,DELETE'),'no direct settings writes');
rollback;
