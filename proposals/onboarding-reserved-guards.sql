-- INERT companion to onboarding-foundation.sql. Root promotes into NEW026 only.
-- Do not edit/reapply001-025. Catalog SHA-256 values MUST be independently read
-- and reviewed after homolog025. Empty pins deliberately abort unchanged.
begin;
do $draft_only$ begin raise exception 'DRAFT_ONLY: reviewed catalog pins required.';end $draft_only$;
do $guard_install$
declare target record;definition text;source text;anchor text;guard text;observed text;begin
 for target in select * from (values
  ('app_private.projects_habits_commit(uuid,uuid,text,jsonb)','', 'perform app_private.projects_habits_guard(p_user,p_session,p_operation);',
    'perform app_private.onboarding_reserved_guard(p_user,p_session,p_operation,p_request);'),
  ('app_private.capture_task_commit(uuid,uuid,text,jsonb)','', 'perform app_private.capture_task_guard(p_user,p_session,p_operation);',
    'perform app_private.onboarding_reserved_guard(p_user,p_session,p_operation,p_request);'),
  ('app_private.knowledge_commit(uuid,uuid,text,jsonb)','', 'perform app_private.knowledge_guard(p_user,p_session,p_operation);',
    'perform app_private.onboarding_reserved_guard(p_user,p_session,p_operation,p_request);'),
  ('public.settings_commit(uuid,uuid,jsonb)','', 'v_command:=p_request->>''command''; v_input:=p_request->''input''; v_client:=v_input->>''client_id'';',
    'perform app_private.onboarding_settings_reserved_guard(p_request);'),
  ('app_private.google_calendar_call(uuid,uuid,text,jsonb,boolean,uuid)','', 'perform app_private.calendar_actor(p_user,p_session,p_cron);',
    'perform app_private.onboarding_oauth_reserved_guard(p_user,p_session,p_command,p_input);')
 ) pins(signature,expected_sha256,anchor,guard) loop
  if target.expected_sha256 !~ '^[a-f0-9]{64}$' then raise exception 'Missing reviewed catalog pin.' using errcode='23514';end if;
  select pg_get_functiondef(p.oid),p.prosrc into strict definition,source from pg_proc p where p.oid=target.signature::regprocedure;
  observed:=encode(sha256(convert_to(definition,'UTF8')),'hex');
  if observed<>target.expected_sha256 then raise exception 'Historical definition diverged.' using errcode='23514';end if;
  anchor:=target.anchor;guard:=target.guard;
  -- Count exact occurrences in the function body AND full definition. A pin
  -- never authorizes fuzzy/case-insensitive substitution or an extra guard.
  if (length(source)-length(replace(source,anchor,'')))/length(anchor)<>1
   or (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1
   or position(guard in definition)>0 then raise exception 'Historical guard anchor diverged.' using errcode='23514';end if;
  execute replace(definition,anchor,anchor||E'\n '||guard);
 end loop;
end $guard_install$;
-- All five install or NONE install. Existing grants/SECURITY DEFINER settings
-- remain the original function's; pg_get_functiondef preserves its declaration.
rollback;
