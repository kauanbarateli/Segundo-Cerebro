-- DRAFT T049. Disposable database only, AFTER the reviewed proposal body.
-- Not a migration and not an operator command. No personal/hosted connection.
do $draft$ begin raise exception 'DRAFT_NOT_AUTHORIZED_FOR_APPLICATION' using errcode='P0001'; end $draft$;
-- BEGIN DISPOSABLE ASSERTIONS
begin;
do $$ declare p jsonb; candidate jsonb; begin
 p:=jsonb_build_object('name','Pessoa','email','person@example.invalid','response_status','accepted','self',false,'organizer',false,'optional',false,'resource',false);
 if app_private.calendar_attendee_pair_valid('{}') is distinct from true
  or app_private.calendar_attendee_pair_valid('{"attendees":null,"attendees_omitted":null}') is distinct from true
  or app_private.calendar_attendee_pair_valid('{"attendees":[],"attendees_omitted":false}') is distinct from true
  or app_private.calendar_attendee_pair_valid('{"attendees":[],"attendees_omitted":true}') is distinct from true
 then raise exception 'T049_VALID_PAIR_REFUSED';end if;
 foreach candidate in array array[
  'null'::jsonb,'[]'::jsonb,'{"attendees":[]}'::jsonb,'{"attendees_omitted":false}'::jsonb,
  '{"attendees":[],"attendees_omitted":null}'::jsonb,'{"attendees":null,"attendees_omitted":false}'::jsonb,
  jsonb_build_object('attendees',jsonb_build_array(p||'{"photo":"PRIVATE_CANARY"}'::jsonb),'attendees_omitted',false),
  jsonb_build_object('attendees',jsonb_build_array(p||'{"self":null}'::jsonb),'attendees_omitted',false),
  jsonb_build_object('attendees',jsonb_build_array(p||'{"response_status":"future"}'::jsonb),'attendees_omitted',false),
  jsonb_build_object('attendees',jsonb_build_array(p||jsonb_build_object('name',repeat('n',256))),'attendees_omitted',false)
 ] loop
  if app_private.calendar_attendee_pair_valid(candidate) is distinct from false then raise exception 'T049_INVALID_PAIR_ACCEPTED';end if;
 end loop;
 if app_private.calendar_attendee_pair_valid(jsonb_build_object('attendees',(select jsonb_agg(p) from generate_series(1,200)),'attendees_omitted',true)) is distinct from true
  or app_private.calendar_attendee_pair_valid(jsonb_build_object('attendees',(select jsonb_agg(p) from generate_series(1,201)),'attendees_omitted',false)) is distinct from false
 then raise exception 'T049_PAIR_BOUND_REFUSED';end if;
 if exists(select 1 from pg_proc f join pg_namespace n on n.oid=f.pronamespace where n.nspname='app_private' and f.proname='calendar_attendee_pair_valid' and (f.provolatile<>'i' or f.prosecdef or f.proconfig is distinct from array['search_path=""']::text[])) then raise exception 'T049_PAIR_AUTHORITY_REFUSED';end if;
 if has_function_privilege('anon','app_private.calendar_attendee_pair_valid(jsonb)','EXECUTE') or has_function_privilege('authenticated','app_private.calendar_attendee_pair_valid(jsonb)','EXECUTE') or has_function_privilege('service_role','app_private.calendar_attendee_pair_valid(jsonb)','EXECUTE') then raise exception 'T049_PAIR_ACL_REFUSED';end if;
end $$;
rollback;
