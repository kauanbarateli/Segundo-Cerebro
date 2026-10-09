-- Synthetic identities/events only, never persistent data. Calendar fixtures
-- run when its migration is present; an absent WIP integration is explicit.
begin;
set local statement_timeout='60s';
select set_config('activity.user',gen_random_uuid()::text,true),set_config('activity.other',gen_random_uuid()::text,true),set_config('activity.session',gen_random_uuid()::text,true);
create function pg_temp.activity_assert(ok boolean,message text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'Expanded activity behavior: %',message;end if;end $$;
create function pg_temp.activity_error(command text,expected text) returns void language plpgsql as $$declare actual text;detail text;begin begin execute command;exception when others then get stacked diagnostics actual=returned_sqlstate,detail=message_text;if actual<>expected then raise exception 'Expected %, got %: %',expected,actual,detail;end if;return;end;raise exception 'Expected %, succeeded',expected;end $$;
create temp table activity_fixtures(id uuid primary key,kind text not null,expected_fields jsonb not null,expected_title text,visible boolean not null);
create function pg_temp.activity_add(p_kind text,p_before jsonb,p_after jsonb,p_visible boolean default true,p_time timestamptz default '2026-10-09T12:00:00.123456Z') returns uuid language plpgsql as $$
declare event_id uuid:=gen_random_uuid();u uuid:=current_setting('activity.user')::uuid;entity_id uuid:=coalesce(p_after->>'id',p_after->>'account_id',p_after->>'calendar_id',p_after->>'event_id',p_after->>'run_id')::uuid;action text:=case when p_before is null then 'created' else 'updated' end;expected jsonb;
begin
 insert into public.domain_events(id,user_id,entity_type,entity_id,action,canal,occurred_at,before,after,capture_task_payload) values(event_id,u,p_kind,entity_id,action,'web',p_time,p_before,p_after,
  case when p_kind in ('capture','task') then jsonb_build_object('id',event_id,'user_id',u,'entity_type',p_kind,'entity_id',entity_id,'action',action,'canal','web','occurred_at',to_char(p_time at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'before',p_before,'after',p_after) else null end);
 select coalesce(jsonb_agg(f.name order by f.position),'[]'::jsonb) into expected from unnest(app_private.activity_projection_fields(p_kind)) with ordinality f(name,position) where coalesce(p_before->f.name,'null'::jsonb) is distinct from coalesce(p_after->f.name,'null'::jsonb);
 insert into pg_temp.activity_fixtures values(event_id,p_kind,expected,case when p_kind='vault_metadata' or starts_with(p_kind,'finance_') then null else left(coalesce(p_after->>'title',p_after->>'name',p_before->>'title',p_before->>'name'),200) end,p_visible);
 return event_id;
end $$;
create function pg_temp.activity_page(p_limit integer default 50,p_time timestamptz default null,p_id uuid default null) returns jsonb language sql as $$select public.activity_page(current_setting('activity.user')::uuid,current_setting('activity.session')::uuid,p_limit,p_time,p_id);$$;
do $$declare schema_name text;begin select nspname into schema_name from pg_namespace where oid=pg_my_temp_schema();execute format('grant usage on schema %I to service_role,authenticated,anon',schema_name);execute format('grant execute on all functions in schema %I to service_role,authenticated,anon',schema_name);grant select on pg_temp.activity_fixtures to service_role,authenticated;end $$;
insert into auth.users(id,aud,role,email,is_anonymous,created_at,updated_at) values(current_setting('activity.user')::uuid,'authenticated','authenticated','activity-'||current_setting('activity.user')||'@example.invalid',false,now(),now()),(current_setting('activity.other')::uuid,'authenticated','authenticated','activity-'||current_setting('activity.other')||'@example.invalid',false,now(),now());
insert into auth.sessions(id,user_id,created_at,updated_at) values(current_setting('activity.session')::uuid,current_setting('activity.user')::uuid,now(),now());
select pg_temp.activity_assert(jsonb_array_length(pg_temp.activity_page()->'items')=4 and not exists(select 1 from jsonb_array_elements(pg_temp.activity_page()->'items') x where x->>'entity_type' not in ('profile','preference','role','moderation')),'expanded history includes four safe provisioning events');
-- Clear only these random fixtures to make the keyset clock independent of the
-- machine date. No pre-existing account or event can match these UUIDs.
delete from public.domain_events where user_id in (current_setting('activity.user')::uuid,current_setting('activity.other')::uuid);
do $$declare kind text;u uuid:=current_setting('activity.user')::uuid;id uuid;p jsonb;b jsonb;has_calendar boolean:=to_regclass('public.calendar_accounts') is not null;begin
 foreach kind in array array['finance_account','finance_category','finance_tag','finance_transaction','finance_budget','knowledge_notebook','knowledge_page','knowledge_link','project','project_container','habit','habit_entry','habit_pause','drive_folder','drive_file','profile','preference','module_preference','moderation','role','entitlement','calendar_account','calendar_source','calendar_event','calendar_sync'] loop
  if starts_with(kind,'calendar_') and not has_calendar then continue;end if;
  if starts_with(kind,'calendar_') then
   id:=gen_random_uuid();
   b:=case kind when 'calendar_account' then jsonb_build_object('account_id',id,'status','connected','operation','oauth_started') when 'calendar_source' then jsonb_build_object('calendar_id',id,'selected',false) when 'calendar_event' then jsonb_build_object('event_id',id,'linked_capture_id',null) when 'calendar_sync' then jsonb_build_object('run_id',id,'status','running','calendar_count',0,'event_count',0) end;
   p:=b||case kind when 'calendar_account' then jsonb_build_object('status','reauthorize','operation','oauth_failed') when 'calendar_source' then jsonb_build_object('selected',true,'received_count',1) when 'calendar_event' then jsonb_build_object('linked_capture_id',gen_random_uuid()) when 'calendar_sync' then jsonb_build_object('status','complete','calendar_count',1,'event_count',2) end;
   perform pg_temp.activity_add(kind,b,p);continue;
  end if;
  id:=gen_random_uuid();b:=jsonb_build_object('id',id,'user_id',u,'title','Título anterior','name','Nome anterior','kind',case when kind='drive_file' then 'drive' when kind='project_container' then 'folder' else 'checking' end);
  p:=b||jsonb_build_object('title',case when starts_with(kind,'finance_') then 'FINANCIAL_TITLE_CANARY' else 'Título permitido '||kind end,'name','Nome permitido','unknown_secret','PRIVATE_BODY_CANARY','content','PRIVATE_BODY_CANARY','token','PRIVATE_TOKEN_CANARY','password','PRIVATE_PASSWORD_CANARY','amount_cents',987654321,'archived_at','2026-10-09T12:00:00Z','color_key','work','limit_cents',987654321,'project_id',gen_random_uuid(),'document',jsonb_build_object('private','PRIVATE_DOCUMENT_CANARY'),'to_id',gen_random_uuid(),'description','PRIVATE_DESCRIPTION_CANARY','weekdays',jsonb_build_array(1,3),'done_on','2026-10-08','starts_on','2026-10-08','parent_id',gen_random_uuid(),'starred',true,'avatar_file_id',gen_random_uuid(),'meeting_reminder_minutes',30,'module_key','drive','must_change_password',true,'role','master','allowed',false,'operation','linked','selected',true,'linked_capture_id',gen_random_uuid(),'event_count',2);
  perform pg_temp.activity_add(kind,b,p);
 end loop;
 -- Capture/Task events satisfy their real closed payload validators.
 id:=gen_random_uuid();b:=jsonb_build_object('id',id,'user_id',u,'client_id',id::text,'type','note','title','Captura anterior','content','PRIVATE_BEFORE_CANARY','category_id',null,'project_id',null,'status','inbox','converted_task_id',null,'captured_at','2026-10-09T10:00:00.000Z','organized_at',null,'archived_at',null,'deleted_at',null,'created_at','2026-10-09T10:00:00.000Z','updated_at','2026-10-09T10:00:00.000Z');p:=b||jsonb_build_object('title',repeat('T',200),'content','PRIVATE_AFTER_CANARY','updated_at','2026-10-09T12:00:00.000Z');perform pg_temp.activity_add('capture',b,p,true,'2026-10-09T12:00:00.123457Z');
 id:=gen_random_uuid();b:=jsonb_build_object('id',id,'user_id',u,'client_id',id::text,'title','Tarefa anterior','description','PRIVATE_DESCRIPTION_CANARY','category_id',null,'project_id',null,'status','todo','priority','medium','due_at',null,'scheduled_start_at',null,'scheduled_end_at',null,'all_day',false,'estimated_minutes',null,'board_position',null,'source','manual','origin_capture_id',null,'completed_at',null,'archived_at',null,'deleted_at',null,'created_at','2026-10-09T10:00:00.000Z','updated_at','2026-10-09T10:00:00.000Z');p:=b||jsonb_build_object('title','Tarefa permitida','priority','high');perform pg_temp.activity_add('task',b,p);
 id:=gen_random_uuid();p:=jsonb_build_object('id',id,'user_id',u,'operation','created','version',1,'occurred_at','2026-10-09T12:00:00.123456Z');perform pg_temp.activity_add('vault_metadata',null,p);
 perform pg_temp.activity_add('drive_file',null,jsonb_build_object('id',gen_random_uuid(),'user_id',u,'kind','capture_image','name','PRIVATE_ATTACHMENT_NAME_CANARY'),false);
 perform pg_temp.activity_add('drive_file',null,jsonb_build_object('id',gen_random_uuid(),'user_id',u,'kind','avatar','name','PRIVATE_AVATAR_NAME_CANARY'),false);
 perform pg_temp.activity_add('project_container',null,jsonb_build_object('id',gen_random_uuid(),'user_id',u,'kind','capture','name','Capture container','project_id',gen_random_uuid()));
 perform pg_temp.activity_add('project_container',null,jsonb_build_object('id',gen_random_uuid(),'user_id',u,'kind','notebook','name','Notebook container','project_id',gen_random_uuid()));
 insert into public.domain_events(user_id,entity_type,entity_id,action,canal,occurred_at,after) values(current_setting('activity.other')::uuid,'project',gen_random_uuid(),'created','web','2026-10-09T13:00:00Z','{"name":"FOREIGN_TITLE_CANARY","content":"FOREIGN_BODY_CANARY"}');
 perform pg_temp.activity_assert((select count(distinct f.kind)=case when has_calendar then 28 else 24 end from pg_temp.activity_fixtures f),'all installed event types have fixtures');
 if not has_calendar then raise notice 'Calendar migration absent: 24 installed types exercised; four Calendar types require the full chain.';end if;
 if has_calendar then perform pg_temp.activity_error($q$select pg_temp.activity_add('calendar_event',null,jsonb_build_object('event_id',gen_random_uuid(),'title','PRIVATE_CALENDAR_BODY_CANARY'))$q$,'23514');end if;
end $$;
set local role service_role;
do $$declare p jsonb;c jsonb;item jsonb;fixture record;seen uuid[]:='{}';rounds integer:=0;begin
 loop
  p:=pg_temp.activity_page(7,(c->>'occurred_at')::timestamptz,(c->>'id')::uuid);rounds:=rounds+1;perform pg_temp.activity_assert(rounds<=10,'keyset pagination terminates');
  perform pg_temp.activity_assert(p-array['items','next_cursor']='{}'::jsonb and p::text not like '%CANARY%' and p::text not like '%987654321%','closed page omits values and private bodies');
  for item in select value from jsonb_array_elements(p->'items') loop
   perform pg_temp.activity_assert(item ?& array['id','user_id','entity_type','entity_id','action','canal','occurred_at','title','changed_fields'] and item-array['id','user_id','entity_type','entity_id','action','canal','occurred_at','title','changed_fields']='{}'::jsonb,'closed item metadata only');
   perform pg_temp.activity_assert(item->>'user_id'=current_setting('activity.user') and item->>'occurred_at'~'^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{6}Z$','owner/UTC microseconds');
   perform pg_temp.activity_assert(not (item->>'id')::uuid=any(seen),'pagination has no duplicates');seen:=array_append(seen,(item->>'id')::uuid);
   select * into fixture from pg_temp.activity_fixtures f where f.id=(item->>'id')::uuid;
   if found then perform pg_temp.activity_assert(fixture.visible and item->'changed_fields'=fixture.expected_fields and item->>'title' is not distinct from fixture.expected_title,'fixture fields/title/kind: '||fixture.kind);end if;
  end loop;
  c:=p->'next_cursor';exit when c='null'::jsonb;
 end loop;
 perform pg_temp.activity_assert(not exists(select 1 from pg_temp.activity_fixtures f where f.visible and not f.id=any(seen)) and not exists(select 1 from pg_temp.activity_fixtures f where not f.visible and f.id=any(seen)),'every permitted fixture once; no private attachment/avatar event');
 p:=pg_temp.activity_page(1);c:=p->'next_cursor';perform pg_temp.activity_assert(c->>'occurred_at'='2026-10-09T12:00:00.123457Z' and char_length(p->'items'->0->>'title')=200,'cursor preserves adjacent microseconds; title bounded200');
end $$;
select pg_temp.activity_error(format('select public.activity_page(%L,%L)',current_setting('activity.other'),current_setting('activity.session')),'42501');
select pg_temp.activity_error('select pg_temp.activity_page(0)','22023');
select pg_temp.activity_error('select pg_temp.activity_page(20,now(),null)','22023');
reset role;
-- Hidden preference does not veto metadata; origin veto does, including proxy.
insert into public.user_modules(user_id,module_key,visible) values(current_setting('activity.user')::uuid,'drive',false) on conflict(user_id,module_key) do update set visible=false;
select pg_temp.activity_assert(exists(select 1 from jsonb_array_elements(pg_temp.activity_page()->'items') x where x->>'entity_type'='drive_file'),'hidden preference remains available');
insert into public.user_entitlements(user_id,feature_key,allowed) values(current_setting('activity.user')::uuid,'drive',false),(current_setting('activity.user')::uuid,'financeiro',false),(current_setting('activity.user')::uuid,'capturar',false);
set local role service_role;
do $$declare p jsonb:=pg_temp.activity_page();begin
 perform pg_temp.activity_assert(not exists(select 1 from jsonb_array_elements(p->'items') x where x->>'entity_type' in ('drive_file','drive_folder','capture') or starts_with(x->>'entity_type','finance_')),'source veto removes events');
 perform pg_temp.activity_assert(not exists(select 1 from jsonb_array_elements(p->'items') x join pg_temp.activity_fixtures f on f.id=(x->>'id')::uuid where f.kind='project_container' and f.expected_title in ('Capture container','Título permitido project_container')) and exists(select 1 from jsonb_array_elements(p->'items') x where x->>'title'='Notebook container'),'proxy respects source Entitlement as well as Projetos');
end $$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('activity.user'),'role','authenticated','session_id',current_setting('activity.session'))::text,true);
set local role authenticated;
select pg_temp.activity_error('select pg_temp.activity_page()','42501');
select pg_temp.activity_error('select before from public.domain_events','42501');
select pg_temp.activity_error('select after from public.domain_events','42501');
select pg_temp.activity_error('select capture_task_payload from public.domain_events','42501');
select pg_temp.activity_assert(exists(select 1 from public.domain_events e where e.user_id=current_setting('activity.user')::uuid and e.entity_type='task') and exists(select 1 from public.domain_events e where e.entity_type='project_container' and e.id in (select f.id from pg_temp.activity_fixtures f where f.expected_title='Notebook container')),'allowed direct metadata remains readable');
select pg_temp.activity_assert(not exists(select 1 from public.domain_events e where e.user_id<>current_setting('activity.user')::uuid or starts_with(e.entity_type,'finance_') or e.entity_type in ('drive_file','drive_folder','capture')),'direct JWT reads also enforce source owner/veto');
select pg_temp.activity_assert(not exists(select 1 from public.domain_events e join pg_temp.activity_fixtures f on f.id=e.id where e.entity_type='project_container' and f.expected_title in ('Capture container','Título permitido project_container')),'direct JWT proxy reads enforce origin veto');
reset role;
delete from public.user_entitlements where user_id=current_setting('activity.user')::uuid;
insert into public.user_entitlements(user_id,feature_key,allowed) values(current_setting('activity.user')::uuid,'inicio',false);
set local role service_role;
select pg_temp.activity_error('select pg_temp.activity_page()','42501');
reset role;
delete from public.user_entitlements where user_id=current_setting('activity.user')::uuid;
update public.user_moderation set must_change_password=true where user_id=current_setting('activity.user')::uuid;
set local role service_role;
select pg_temp.activity_error('select pg_temp.activity_page()','42501');
reset role;
update public.user_moderation set must_change_password=false,status='blocked' where user_id=current_setting('activity.user')::uuid;
set local role service_role;
select pg_temp.activity_error('select pg_temp.activity_page()','42501');
reset role;
update public.user_moderation set status='active' where user_id=current_setting('activity.user')::uuid;
update auth.sessions set not_after=now()-interval '1 second' where id=current_setting('activity.session')::uuid;
set local role service_role;
select pg_temp.activity_error('select pg_temp.activity_page()','42501');
reset role;
select pg_temp.activity_assert(not exists(select 1 from app_private.command_receipts r where r.user_id=current_setting('activity.user')::uuid),'reading never writes receipts');
rollback;
