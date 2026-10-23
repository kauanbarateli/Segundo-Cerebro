-- Inert proposal; run only after review/promotion against isolated onboarding schema.
begin;
do $draft_only$ begin raise exception 'DRAFT_ONLY: review catalog assertions before authorized isolated execution.';end $draft_only$;
set local statement_timeout='15s';
do $$ declare t text;role_name text;fn regprocedure;definition text;guard text;target record;begin
 foreach t in array array['profile_focus','project_contexts','onboarding_entries','onboarding_rounds','onboarding_intents','onboarding_commands','onboarding_oauth','onboarding_write_permits','onboarding_retention_state'] loop
  if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='app_private' and c.relname=t and c.relrowsecurity) then raise exception 'Missing private RLS: %',t;end if;
  foreach role_name in array array['anon','authenticated','service_role'] loop
   if has_table_privilege(role_name,format('app_private.%I',t),'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then raise exception 'Private table grant: % %',role_name,t;end if;
  end loop;
 end loop;
 fn:='public.onboarding_call(uuid,uuid,text,jsonb)'::regprocedure;
 if (select prosecdef from pg_proc where oid=fn) then raise exception 'Public wrapper must be invoker.';end if;
 if not has_function_privilege('service_role',fn,'EXECUTE') or has_function_privilege('anon',fn,'EXECUTE') or has_function_privilege('authenticated',fn,'EXECUTE') then raise exception 'Unexpected public RPC privilege.';end if;
 fn:='app_private.onboarding_call(uuid,uuid,text,jsonb)'::regprocedure;
 if not (select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid=fn) then raise exception 'Private RPC must use fixed empty path.';end if;
 if has_function_privilege('anon',fn,'EXECUTE') or has_function_privilege('authenticated',fn,'EXECUTE') then raise exception 'Private RPC exposed.';end if;
 if not exists(select 1 from pg_trigger where tgname='onboarding_verified_admin_completion' and tgrelid='app_private.admin_operations'::regclass and not tgisinternal) then raise exception 'Verified cohort trigger absent.';end if;
 if exists(select 1 from information_schema.columns where table_schema='public' and (table_name='profiles' and column_name='focus' or table_name='projects' and column_name='context')) then raise exception 'v1 snapshot widened instead of explicit v2 extension.';end if;
 for target in select p.oid,p.proname,p.prosecdef,p.proconfig,p.proowner from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='app_private' and p.proname like 'onboarding\_%' escape '\' loop
  if pg_get_userbyid(target.proowner)<>'postgres' or not target.proconfig @> array['search_path=""'] then raise exception 'Unexpected onboarding owner/path.';end if;
  foreach role_name in array array['anon','authenticated','service_role'] loop
   if target.proname<>'onboarding_call' and has_function_privilege(role_name,target.oid,'EXECUTE') then raise exception 'Helper exposed: %',target.proname;end if;
  end loop;
 end loop;
 if exists(select 1 from app_private.onboarding_write_permits) or exists(select 1 from app_private.onboarding_oauth where permit_backend_pid is not null or permit_xact_id is not null) then raise exception 'Residual permit.';end if;
 foreach t in array array['onboarding_permit_zero','onboarding_oauth_permit_zero'] loop
  if not exists(select 1 from pg_trigger x join pg_constraint c on c.oid=x.tgconstraint where x.tgname=t and c.condeferrable and c.condeferred) then raise exception 'Deferred zero-permit constraint missing.';end if;
 end loop;
 for target in select * from (values
  ('app_private.projects_habits_commit(uuid,uuid,text,jsonb)','onboarding_reserved_guard'),
  ('app_private.capture_task_commit(uuid,uuid,text,jsonb)','onboarding_reserved_guard'),
  ('app_private.knowledge_commit(uuid,uuid,text,jsonb)','onboarding_reserved_guard'),
  ('public.settings_commit(uuid,uuid,jsonb)','onboarding_settings_reserved_guard'),
  ('app_private.google_calendar_call(uuid,uuid,text,jsonb,boolean,uuid)','onboarding_oauth_reserved_guard')
 ) checks(signature,guard) loop
  definition:=pg_get_functiondef(target.signature::regprocedure);guard:=target.guard;
  if position('app_private.'||guard||'(' in definition)=0 then raise exception 'Historical namespace fence missing.';end if;
 end loop;
 fn:='app_private.onboarding_retention_sweep()'::regprocedure;
 if (select prosecdef from pg_proc where oid=fn) then raise exception 'Native sweep must be invoker.';end if;
end $$;
rollback;
