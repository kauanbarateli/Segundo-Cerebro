-- SPEC08 / #76. Root reservation. Prepared only; supervised application.
-- Calendar 20261021050931 precedes this file in the combined publication.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
do $$ begin
 if current_user<>'postgres' or to_regprocedure('app_private.require_entity_image(uuid,uuid,text)') is null then
  raise exception 'Reviewed 020 foundation required.';
 end if;
end $$;
alter table public.habits add column image_file_id uuid;
alter table public.habits add constraint habits_image_owner_fk foreign key(user_id,image_file_id) references public.drive_files(user_id,id) deferrable initially deferred;

create function app_private.habit_frequency_tuple(p jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare days jsonb;target integer;begin
 if jsonb_typeof(p) is distinct from 'object' or p->>'schedule_kind' is null or p->>'schedule_kind' not in ('daily','weekdays','weekly_target')
  or jsonb_typeof(p->'weekdays') is distinct from 'array' or not p?'weekly_target' then raise exception 'Invalid frequency.' using errcode='22023';end if;
 if exists(select 1 from jsonb_array_elements(p->'weekdays') d where jsonb_typeof(d) is distinct from 'number' or d::text !~ '^[0-6]$')
  or jsonb_array_length(p->'weekdays')<>(select count(distinct d) from jsonb_array_elements(p->'weekdays') d) then raise exception 'Invalid frequency days.' using errcode='22023';end if;
 select coalesce(jsonb_agg(d order by d),'[]'::jsonb) into days from jsonb_array_elements(p->'weekdays') d;
 if (p->>'schedule_kind'='weekdays' and jsonb_array_length(days)=0) or (p->>'schedule_kind'<>'weekdays' and days<>'[]'::jsonb) then raise exception 'Days outside cadence.' using errcode='23514';end if;
 if p->>'schedule_kind'='weekly_target' then
  if jsonb_typeof(p->'weekly_target') is distinct from 'number' or (p->>'weekly_target') !~ '^[1-7]$' then raise exception 'Invalid weekly target.' using errcode='22023';end if;
  target:=(p->>'weekly_target')::integer;
 elsif p->'weekly_target' is distinct from 'null'::jsonb then raise exception 'Target outside cadence.' using errcode='23514';end if;
 return jsonb_build_object('schedule_kind',p->'schedule_kind','weekdays',days,'weekly_target',target);
end $$;

create function app_private.habit_frequency_state(p jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare state jsonb;row jsonb;previous date;first_day date;start_day date;frequency jsonb;begin
 start_day:=app_private.finance_date(p->>'started_on');frequency:=app_private.habit_frequency_tuple(p);
 if jsonb_typeof(p->'started_on') is distinct from 'string' or start_day is null then raise exception 'Habit baseline date required.' using errcode='22023';end if;
 if not p?'frequency_history' then
  return jsonb_build_object('version',1,'baseline_origin','legacy_known_frequency','changes',jsonb_build_array(
   jsonb_build_object('version',1,'habit_id',p->'id','user_id',p->'user_id','effective_from',p->'started_on')||frequency));
 end if;
 state:=p->'frequency_history';
 if jsonb_typeof(state) is distinct from 'object' or not state?&array['version','baseline_origin','changes'] or state-array['version','baseline_origin','changes']<>'{}'::jsonb
  or state->'version' is distinct from '1'::jsonb or jsonb_typeof(state->'baseline_origin') is distinct from 'string' or state->>'baseline_origin' not in ('legacy_known_frequency','created_frequency')
  or jsonb_typeof(state->'changes') is distinct from 'array' or jsonb_array_length(state->'changes')=0 then raise exception 'Invalid frequency history.' using errcode='22023';end if;
 for row in select value from jsonb_array_elements(state->'changes') loop
  if jsonb_typeof(row) is distinct from 'object' or not row?&array['version','habit_id','user_id','effective_from','schedule_kind','weekdays','weekly_target']
   or row-array['version','habit_id','user_id','effective_from','schedule_kind','weekdays','weekly_target']<>'{}'::jsonb or row->'version' is distinct from '1'::jsonb
   or row->'habit_id' is distinct from p->'id' or row->'user_id' is distinct from p->'user_id' or jsonb_typeof(row->'effective_from') is distinct from 'string' or app_private.finance_date(row->>'effective_from') is null then raise exception 'Frequency outside owner, habit or civil date.' using errcode='23514';end if;
  if app_private.finance_date(row->>'effective_from')<start_day or (previous is not null and app_private.finance_date(row->>'effective_from')<=previous)
   or (row-array['version','habit_id','user_id','effective_from']) is distinct from app_private.habit_frequency_tuple(row) then raise exception 'Noncanonical frequency history.' using errcode='23514';end if;
  previous:=app_private.finance_date(row->>'effective_from');first_day:=coalesce(first_day,previous);
 end loop;
 if first_day is distinct from start_day or app_private.habit_frequency_tuple(row) is distinct from frequency then raise exception 'Missing baseline or divergent current cadence.' using errcode='23514';end if;
 return state;
end $$;

create function app_private.habit_frequency_expected(b jsonb,a jsonb,p_day date) returns jsonb language plpgsql immutable set search_path='' as $$
declare state jsonb;rows jsonb;frequency jsonb;last_row jsonb;start_day date;begin
 frequency:=app_private.habit_frequency_tuple(a);start_day:=app_private.finance_date(a->>'started_on');
 if b is null then return jsonb_build_object('version',1,'baseline_origin','created_frequency','changes',jsonb_build_array(
  jsonb_build_object('version',1,'habit_id',a->'id','user_id',a->'user_id','effective_from',a->'started_on')||frequency));end if;
 state:=app_private.habit_frequency_state(b);
 if app_private.finance_date(b->>'started_on') is distinct from start_day then raise exception 'Habit start immutable.' using errcode='23514';end if;
 if app_private.habit_frequency_tuple(b)=frequency then return b->'frequency_history';end if;
 if exists(select 1 from jsonb_array_elements(state->'changes') c where app_private.finance_date(c->>'effective_from')>p_day and c->>'effective_from' is distinct from a->>'started_on') then raise exception 'Future change unavailable.' using errcode='23514';end if;
 if start_day>=p_day then rows:='[]'::jsonb;
 else select coalesce(jsonb_agg(c order by c->>'effective_from'),'[]'::jsonb) into rows from jsonb_array_elements(state->'changes') c where app_private.finance_date(c->>'effective_from')<p_day;end if;
 last_row:=rows->(jsonb_array_length(rows)-1);
 if last_row is null or app_private.habit_frequency_tuple(last_row) is distinct from frequency then
  rows:=rows||jsonb_build_array(jsonb_build_object('version',1,'habit_id',a->'id','user_id',a->'user_id','effective_from',greatest(start_day,p_day))||frequency);
 end if;
 return jsonb_build_object('version',1,'baseline_origin',state->'baseline_origin','changes',rows);
end $$;

create function app_private.habit_frequency_at(p jsonb,p_day date) returns jsonb language plpgsql immutable set search_path='' as $$
declare state jsonb;result jsonb;begin
 state:=app_private.habit_frequency_state(p);
 select c into result from jsonb_array_elements(state->'changes') c where app_private.finance_date(c->>'effective_from')<=p_day order by c->>'effective_from' desc limit 1;
 return result;
end $$;

-- One post-lock capture in the commit function. New row/event timestamps must
-- describe that same civil day. A midnight mismatch is atomic CONFLICT.
create function app_private.habit_check_attempt_clock(p_request jsonb,p_observed timestamptz) returns void language plpgsql immutable set search_path='' as $$
declare c jsonb;e jsonb;a jsonb;day date;stamp timestamptz;begin
 day:=(p_observed at time zone 'America/Sao_Paulo')::date;
 for e in select value from jsonb_array_elements(p_request->'events') loop
  stamp:=app_private.capture_task_timestamp(e->'occurred_at');
  if (stamp at time zone 'America/Sao_Paulo')::date is distinct from day then raise exception 'Attempt crossed civil day.' using errcode='40001';end if;
 end loop;
 for c in select value from jsonb_array_elements(p_request->'changes') loop
  a:=nullif(c->'after','null'::jsonb);
  if a is not null then
   stamp:=app_private.capture_task_timestamp(case when c->>'type'='habit' then a->'updated_at' else a->'created_at' end);
   if (stamp at time zone 'America/Sao_Paulo')::date is distinct from day or exists(select 1 from jsonb_array_elements(p_request->'events') event where app_private.capture_task_timestamp(event->'occurred_at') is distinct from stamp) then raise exception 'Attempt clock differs.' using errcode='40001';end if;
  end if;
 end loop;
end $$;

-- The remaining function changes preserve installed OIDs and ACLs. Their
-- source substitutions are asserted; drift aborts the whole migration.
do $migration$ declare definition text;before_text text;after_text text;begin
 select replace(pg_get_functiondef('app_private.projects_habits_row()'::regprocedure),chr(13)||chr(10),chr(10)) into definition;
 before_text:='h public.habits;begin';after_text:='h public.habits;frequency jsonb;expected_history jsonb;begin';
 if position(before_text in definition)=0 then raise exception 'Habit row declaration drift.';end if;definition:=replace(definition,before_text,after_text);
 before_text:='if jsonb_typeof(p) is distinct from ''object'' or not p ?& required';
 after_text:=$source$if tg_table_name='habits' then
  if p?'frequency_history' then required:=required||array['frequency_history'];end if;
  if p?'image_file_id' then required:=required||array['image_file_id'];end if;
 end if;
 if jsonb_typeof(p) is distinct from 'object' or not p ?& required$source$;
 if position(before_text in definition)=0 then raise exception 'Habit row shape drift.';end if;definition:=replace(definition,before_text,after_text);
 before_text:='if tg_op=''UPDATE'' and new.started_on<>old.started_on then raise exception ''Habit start immutable.'' using errcode=''23514'';end if;';
 after_text:=before_text||$source$
  perform app_private.habit_frequency_state(p);
  if p?'image_file_id' and p->'image_file_id'<>'null'::jsonb and (jsonb_typeof(p->'image_file_id') is distinct from 'string' or p->>'image_file_id' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then raise exception 'Invalid habit image.' using errcode='22023';end if;
  new.image_file_id:=(p->>'image_file_id')::uuid;
  perform app_private.require_entity_image(new.user_id,new.image_file_id,'habit_image');
  if p?'frequency_history' and exists(select 1 from jsonb_array_elements(p#>'{frequency_history,changes}') c where app_private.finance_date(c->>'effective_from')>(new.updated_at at time zone 'America/Sao_Paulo')::date and c->>'effective_from' is distinct from p->>'started_on') then raise exception 'Future habit change unavailable.' using errcode='23514';end if;
  if tg_op='UPDATE' then
   expected_history:=app_private.habit_frequency_expected(old.payload,p,(new.updated_at at time zone 'America/Sao_Paulo')::date);
   if p->'frequency_history' is distinct from expected_history then raise exception 'History transition differs.' using errcode='23514';end if;
  end if;
 $source$;
 if position(before_text in definition)=0 then raise exception 'Habit immutable start drift.';end if;definition:=replace(definition,before_text,after_text);
 before_text:='if not found or h.archived_at is not null or new.done_on<h.started_on';
 after_text:='if found then frequency:=app_private.habit_frequency_at(h.payload,new.done_on);end if;'||chr(10)||'  if not found or h.archived_at is not null or new.done_on<h.started_on';
 if position(before_text in definition)=0 then raise exception 'Habit entry guard drift.';end if;definition:=replace(definition,before_text,after_text);
 -- RPC writes reuse the trusted post-lock capture via a transaction-local
 -- internal context. There is no browser/SQL parameter for this context and
 -- no direct table write grant. Administrative DML captures its own real day.
 before_text:='new.done_on>(current_timestamp at time zone ''America/Sao_Paulo'')::date';
 after_text:='new.done_on>coalesce(nullif(current_setting(''app.spec08_habit_attempt_day'',true),'''')::date,(clock_timestamp() at time zone ''America/Sao_Paulo'')::date)';
 if position(before_text in definition)=0 then raise exception 'Habit entry date drift.';end if;definition:=replace(definition,before_text,after_text);
 before_text:='(h.schedule_kind=''weekdays'' and not extract(dow from new.done_on)::integer=any(h.weekdays))';
 after_text:='(frequency->>''schedule_kind''=''weekdays'' and not (frequency->''weekdays'') @> to_jsonb(array[extract(dow from new.done_on)::integer]))';
 if position(before_text in definition)=0 then raise exception 'Habit entry cadence drift.';end if;definition:=replace(definition,before_text,after_text);
 execute definition;
end $migration$;

-- Existing image consumers retain their exact implementation and privileges.
do $$ declare definition text;begin
 select pg_get_functiondef('app_private.file_entity_image_get(uuid,uuid,text,uuid)'::regprocedure) into definition;
 execute replace(definition,'FUNCTION app_private.file_entity_image_get(','FUNCTION app_private.file_entity_image_get_habit_previous(');
 select pg_get_functiondef('app_private.file_entity_image_set(uuid,uuid,jsonb)'::regprocedure) into definition;
 execute replace(definition,'FUNCTION app_private.file_entity_image_set(','FUNCTION app_private.file_entity_image_set_habit_previous(');
end $$;
create or replace function app_private.file_entity_image_get(p_user uuid,p_session uuid,p_purpose text,p_entity uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare file_id uuid;begin
 if p_purpose is distinct from 'habit_image' then return app_private.file_entity_image_get_habit_previous(p_user,p_session,p_purpose,p_entity);end if;
 if p_user is null or p_session is null or p_entity is null then raise exception 'Image destination unavailable.' using errcode='22023';end if;
 perform app_private.file_guard(p_user,p_session,p_purpose);
 select h.image_file_id into file_id from public.habits h where h.user_id=p_user and h.id=p_entity;
 if not found then raise exception 'Habit unavailable.' using errcode='42501';end if;
 perform app_private.require_entity_image(p_user,file_id,p_purpose);
 return jsonb_build_object('version',1,'user_id',p_user,'id',p_entity,'purpose',p_purpose,'file_id',file_id);
end $$;
create or replace function app_private.file_entity_image_set(p_user uuid,p_session uuid,p_request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare entity uuid;file_id uuid;client_id text;receipt jsonb;before_row jsonb;after_row jsonb;observed timestamptz;begin
 if p_request->>'purpose' is distinct from 'habit_image' then return app_private.file_entity_image_set_habit_previous(p_user,p_session,p_request);end if;
 if jsonb_typeof(p_request) is distinct from 'object' or not p_request?&array['version','purpose','entity_id','file_id','expected_file_id','client_id']
  or p_request-array['version','purpose','entity_id','file_id','expected_file_id','client_id']<>'{}'::jsonb or p_request->'version' is distinct from '1'::jsonb
  or jsonb_typeof(p_request->'client_id') is distinct from 'string' or char_length(btrim(p_request->>'client_id')) not between 1 and 200 or char_length(p_request->>'client_id')>200
  or jsonb_typeof(p_request->'entity_id') is distinct from 'string' or (p_request->'file_id'<>'null'::jsonb and jsonb_typeof(p_request->'file_id') is distinct from 'string')
  or (p_request->'expected_file_id'<>'null'::jsonb and jsonb_typeof(p_request->'expected_file_id') is distinct from 'string') then raise exception 'Invalid habit image binding.' using errcode='22023';end if;
 entity:=(p_request->>'entity_id')::uuid;file_id:=(p_request->>'file_id')::uuid;client_id:=p_request->>'client_id';
 perform app_private.file_guard(p_user,p_session,'habit_image');
 receipt:=app_private.command_replay(p_user,'file.entity-image.set',client_id,p_request);if receipt is not null then return receipt;end if;
 observed:=clock_timestamp();
 perform app_private.require_entity_image(p_user,file_id,'habit_image');
 select h.payload into before_row from public.habits h where h.user_id=p_user and h.id=entity and h.archived_at is null for update;
 if not found then raise exception 'Habit unavailable.' using errcode='42501';end if;
 if coalesce(before_row->'image_file_id','null'::jsonb) is distinct from p_request->'expected_file_id' then raise exception 'Habit image changed.' using errcode='40001';end if;
 after_row:=before_row||jsonb_build_object('image_file_id',file_id,'updated_at',observed);
 update public.habits h set payload=after_row where h.user_id=p_user and h.id=entity;
 insert into public.domain_events(user_id,entity_type,entity_id,action,canal,occurred_at,before,after) values(p_user,'habit',entity,'updated','web',observed,before_row,after_row);
 receipt:=app_private.file_entity_image_get(p_user,p_session,'habit_image',entity);
 insert into app_private.command_receipts(user_id,command,client_id,request,result) values(p_user,'file.entity-image.set',client_id,p_request,receipt);
 -- A binding adds a Habit event to the complete bounded snapshot. Recheck in
 -- this transaction so a successful write can never make the module unreadable.
 perform app_private.projects_habits_snapshot(p_user,p_session,'read.habits');
 return receipt;
exception when invalid_text_representation then raise exception 'Invalid habit image identifier.' using errcode='22023';end $$;

create or replace function app_private.entity_image_referenced(p_user uuid,p_file uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p where p.user_id=p_user and p.avatar_file_id=p_file)
 or exists(select 1 from public.capture_file_links l where l.user_id=p_user and l.file_id=p_file)
 or exists(select 1 from public.projects p where p.user_id=p_user and p.cover_file_id=p_file)
 or exists(select 1 from public.user_preferences p where p.user_id=p_user and p.home_focus_file_id=p_file)
 or exists(select 1 from public.habits h where h.user_id=p_user and h.image_file_id=p_file);
$$;

-- No new RPC or public helper. Keep both wrappers service-only and deny all
-- direct execution of pure helpers/previous bodies, including service_role.
revoke all on function app_private.habit_frequency_tuple(jsonb),app_private.habit_frequency_state(jsonb),app_private.habit_frequency_expected(jsonb,jsonb,date),app_private.habit_frequency_at(jsonb,date),app_private.habit_check_attempt_clock(jsonb,timestamptz),app_private.file_entity_image_get_habit_previous(uuid,uuid,text,uuid),app_private.file_entity_image_set_habit_previous(uuid,uuid,jsonb) from public,anon,authenticated,service_role;
comment on column public.habits.image_file_id is 'Private finalized habit_image owned by the same User; archives retain the live link.';
comment on function app_private.habit_frequency_expected(jsonb,jsonb,date) is 'Canonical v1 history from before, server fields and authoritative post-lock civil day; no backfill of unknown edits.';

do $migration$ declare definition text;before_text text;after_text text;begin
 select replace(pg_get_functiondef('app_private.projects_habits_commit(uuid,uuid,text,jsonb)'::regprocedure),chr(13)||chr(10),chr(10)) into definition;
 before_text:='stored app_private.command_receipts;begin';after_text:='stored app_private.command_receipts;observed timestamptz;expected_history jsonb;previous_attempt_day text;begin';
 if position(before_text in definition)=0 then raise exception 'Routine commit declaration drift.';end if;definition:=replace(definition,before_text,after_text);
 before_text:='if coalesce((select revision::text from app_private.projects_habits_revisions';
 after_text:='observed:=clock_timestamp();'||chr(10)||' previous_attempt_day:=current_setting(''app.spec08_habit_attempt_day'',true);'||chr(10)||' if p_operation like ''habit.%'' then perform app_private.habit_check_attempt_clock(p_request,observed);perform set_config(''app.spec08_habit_attempt_day'',(observed at time zone ''America/Sao_Paulo'')::date::text,true);end if;'||chr(10)||' if coalesce((select revision::text from app_private.projects_habits_revisions';
 if position(before_text in definition)=0 then raise exception 'Routine replay/revision boundary drift.';end if;definition:=replace(definition,before_text,after_text);
 before_text:='(a-array[''id'',''user_id'',''deleted_at'',''archived_at'',''created_at'',''updated_at''])';
 after_text:='(a-(array[''id'',''user_id'',''deleted_at'',''archived_at'',''created_at'',''updated_at'']||case when kind=''habit'' then array[''frequency_history'',''image_file_id''] else array[]::text[] end))';
 if position(before_text in definition)=0 then raise exception 'Routine creation intention drift.';end if;definition:=replace(definition,before_text,after_text);
 before_text:='if p_operation in (''project.update'',''habit.update'') then';
 after_text:=$source$if p_operation='habit.create' and (a->'frequency_history' is distinct from app_private.habit_frequency_expected(null,a,(observed at time zone 'America/Sao_Paulo')::date) or a->'image_file_id' is distinct from 'null'::jsonb or a->'created_at' is distinct from a->'updated_at') then raise exception 'New habit requires canonical baseline.' using errcode='23514';end if;
  if p_operation in ('project.update','habit.update') then$source$;
 if position(before_text in definition)=0 then raise exception 'Routine update intention drift.';end if;definition:=replace(definition,before_text,after_text);
 before_text:='if a is distinct from expected then raise exception ''Update outside intention.''';
 after_text:=$source$if kind='habit' then
    expected_history:=app_private.habit_frequency_expected(b,expected,(observed at time zone 'America/Sao_Paulo')::date);
    expected:=expected-'frequency_history';
    if expected_history is not null then expected:=expected||jsonb_build_object('frequency_history',expected_history);end if;
   end if;
   if a is distinct from expected then raise exception 'Update outside intention.'$source$;
 if position(before_text in definition)=0 then raise exception 'Routine expected aggregate drift.';end if;definition:=replace(definition,before_text,after_text);
 if position('(current_timestamp at time zone ''America/Sao_Paulo'')::date' in definition)=0 then raise exception 'Routine mark day drift.';end if;
 definition:=replace(definition,'(current_timestamp at time zone ''America/Sao_Paulo'')::date','(observed at time zone ''America/Sao_Paulo'')::date');
 before_text:='return jsonb_build_object(''status'',''committed'',''result'',r->''result'');';
 after_text:='if p_operation like ''habit.%'' then perform set_config(''app.spec08_habit_attempt_day'',coalesce(previous_attempt_day,''''),true);end if;'||chr(10)||' '||before_text;
 if position(before_text in definition)=0 then raise exception 'Routine terminal result drift.';end if;definition:=replace(definition,before_text,after_text);
 before_text:='then return jsonb_build_object(''status'',''stale'');end if;';
 after_text:='then if p_operation like ''habit.%'' then perform set_config(''app.spec08_habit_attempt_day'',coalesce(previous_attempt_day,''''),true);end if;return jsonb_build_object(''status'',''stale'');end if;';
 if position(before_text in definition)=0 then raise exception 'Routine stale result drift.';end if;definition:=replace(definition,before_text,after_text);
 execute definition;
end $migration$;
commit;
