-- T023 versioned preparation. Installation and rollback assertions remain manual.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
create table public.habits (
 id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,payload jsonb not null,
 name text not null,schedule_kind text not null check(schedule_kind in ('daily','weekdays','weekly_target')),
 weekdays integer[] not null,weekly_target integer,started_on date not null,archived_at timestamptz,
 created_at timestamptz not null,updated_at timestamptz not null,unique(user_id,id),
 check((schedule_kind='daily' and cardinality(weekdays)=0 and weekly_target is null)
 or (schedule_kind='weekdays' and cardinality(weekdays) between 1 and 7 and weekdays<@array[0,1,2,3,4,5,6] and weekly_target is null)
 or (schedule_kind='weekly_target' and cardinality(weekdays)=0 and weekly_target is not null and weekly_target between 1 and 7))
);
create table public.habit_entries (
 id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,payload jsonb not null,
 habit_id uuid not null,done_on date not null,created_at timestamptz not null,unique(user_id,id),unique(user_id,habit_id,done_on),
 foreign key(user_id,habit_id) references public.habits(user_id,id) deferrable initially deferred
);
create table public.habit_pauses (
 id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,payload jsonb not null,
 habit_id uuid,starts_on date not null,ends_on date,created_at timestamptz not null,unique(user_id,id),check(ends_on is null or ends_on>=starts_on),
 foreign key(user_id,habit_id) references public.habits(user_id,id) deferrable initially deferred
);
create table public.drive_folders (
 id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,payload jsonb not null,
 name text not null,parent_id uuid,project_id uuid,position integer not null check(position>=0),deleted_at timestamptz,deletion_batch_id uuid,
 created_at timestamptz not null,updated_at timestamptz not null,unique(user_id,id),check(parent_id is distinct from id),
 foreign key(user_id,parent_id) references public.drive_folders(user_id,id) deferrable initially deferred,
 foreign key(user_id,project_id) references public.projects(user_id,id) deferrable initially deferred
);
create index habits_owner_active_idx on public.habits(user_id,created_at,id) where archived_at is null;
create index habit_entries_owner_history_idx on public.habit_entries(user_id,habit_id,done_on,id);
create index habit_pauses_owner_interval_idx on public.habit_pauses(user_id,habit_id,starts_on,ends_on);
create index drive_folders_owner_parent_idx on public.drive_folders(user_id,parent_id,id);
create index drive_folders_owner_project_idx on public.drive_folders(user_id,project_id) where project_id is not null;
create table app_private.projects_habits_revisions(user_id uuid primary key references auth.users(id) on delete cascade,revision bigint not null default 0 check(revision>=0));
do $$ declare expression text; begin
 select pg_get_expr(conbin,conrelid) into strict expression from pg_constraint where conrelid='public.domain_events'::regclass and conname='domain_events_entity_type_check';
 alter table public.domain_events drop constraint domain_events_entity_type_check;
 execute format('alter table public.domain_events add constraint domain_events_entity_type_check check ((%s) or entity_type in (''project'',''habit'',''habit_entry'',''habit_pause'',''project_container''))',expression);
end $$;
create function app_private.projects_habits_command(p text) returns boolean language sql immutable set search_path='' as $$
 select coalesce(p=any(array['project.create','project.update','project.delete','project.restore','project.container.create','project.container.link','project.container.unlink','habit.create','habit.update','habit.archive','habit.restore','habit.mark','habit.pause.create','habit.pause.delete']),false);
$$;
create function app_private.projects_habits_feature(p_user uuid,p_feature text) returns boolean language sql stable security definer set search_path='' as $$
 select not exists(select 1 from public.user_entitlements where user_id=p_user and feature_key=p_feature and not allowed);
$$;
create function app_private.projects_habits_guard(p_user uuid,p_session uuid,p_operation text) returns void language plpgsql security definer set search_path='' as $$
declare feature text;begin
 perform 1 from auth.users where id=p_user for share;perform 1 from auth.sessions where id=p_session and user_id=p_user for share;
 perform app_private.capture_task_lock(p_user);perform app_private.require_actor(p_user,p_session);
 if p_operation is null or (p_operation not in ('read.projects','read.habits') and not app_private.projects_habits_command(p_operation)) then raise exception 'Unknown routine operation.' using errcode='22023';end if;
 feature:=case when p_operation='read.projects' or p_operation like 'project.%' then 'projetos' else 'habitos' end;
 if not app_private.projects_habits_feature(p_user,feature) then raise exception 'Routine unavailable.' using errcode='42501';end if;
end $$;
create function app_private.projects_habits_bump() returns trigger language plpgsql security definer set search_path='' as $$
declare u uuid;begin
 u:=case when tg_op='DELETE' then old.user_id else new.user_id end;
 if tg_table_name='domain_events' then if (case when tg_op='DELETE' then old.entity_type else new.entity_type end) not in ('project','habit','habit_entry','habit_pause','project_container') then return null;end if;end if;
 if tg_table_name='command_receipts' then if not app_private.projects_habits_command(case when tg_op='DELETE' then old.command else new.command end) then return null;end if;end if;
 perform app_private.capture_task_lock(u);if exists(select 1 from auth.users where id=u) then insert into app_private.projects_habits_revisions(user_id,revision) values(u,1) on conflict(user_id) do update set revision=projects_habits_revisions.revision+1;end if;return null;
end $$;
create function app_private.projects_habits_row() returns trigger language plpgsql security definer set search_path='' as $$
declare p jsonb;required text[];k text;v integer;parent uuid;visited uuid[];h public.habits;begin
 p:=new.payload;required:=array['id','user_id','created_at'];
 if tg_table_name='habits' then required:=required||array['name','schedule_kind','weekdays','weekly_target','started_on','archived_at','color_key','icon_key','position','updated_at'];
 elsif tg_table_name='habit_entries' then required:=required||array['habit_id','done_on','note'];
 elsif tg_table_name='habit_pauses' then required:=required||array['habit_id','starts_on','ends_on','reason'];
 else required:=required||array['name','parent_id','project_id','position','deleted_at','deletion_batch_id','updated_at'];end if;
 if jsonb_typeof(p) is distinct from 'object' or not p ?& required or p-required<>'{}'::jsonb then raise exception 'Invalid routine payload.' using errcode='22023';end if;
 new.id:=(p->>'id')::uuid;new.user_id:=(p->>'user_id')::uuid;new.created_at:=app_private.capture_task_timestamp(p->'created_at');
 if tg_op='UPDATE' and (new.id is distinct from old.id or new.user_id is distinct from old.user_id or new.created_at is distinct from old.created_at) then raise exception 'Identity immutable.' using errcode='23514';end if;
 perform app_private.capture_task_lock(new.user_id);
 if tg_table_name='habits' then
  if jsonb_typeof(p->'name') is distinct from 'string' or char_length(btrim(p->>'name')) not between 1 and 120 or jsonb_typeof(p->'weekdays') is distinct from 'array' or jsonb_typeof(p->'position') is distinct from 'number' or (p->>'position') !~ '^(0|[1-9][0-9]*)$' or (p->>'position')::numeric>9007199254740991 or jsonb_typeof(p->'color_key') is distinct from 'string' or (p->>'color_key') !~ '^[a-z][a-z0-9-]{0,39}$' or (p->'icon_key'<>'null'::jsonb and (jsonb_typeof(p->'icon_key') is distinct from 'string' or (p->>'icon_key') !~ '^[A-Za-z][A-Za-z0-9]{0,39}$')) then raise exception 'Invalid habit fields.' using errcode='22023';end if;
  new.name:=p->>'name';new.schedule_kind:=p->>'schedule_kind';new.weekdays:=array(select value::integer from jsonb_array_elements_text(p->'weekdays'));
  if cardinality(new.weekdays)<>(select count(distinct x) from unnest(new.weekdays) x) then raise exception 'Repeated weekdays.' using errcode='23514';end if;
  new.weekly_target:=(p->>'weekly_target')::integer;new.started_on:=app_private.finance_date(p->>'started_on');new.archived_at:=app_private.capture_task_timestamp(p->'archived_at',true);new.updated_at:=app_private.capture_task_timestamp(p->'updated_at');
  if tg_op='UPDATE' and new.started_on<>old.started_on then raise exception 'Habit start immutable.' using errcode='23514';end if;
 elsif tg_table_name='habit_entries' then
  if p->'note'<>'null'::jsonb and jsonb_typeof(p->'note') is distinct from 'string' then raise exception 'Invalid habit note.' using errcode='22023';end if;
  new.habit_id:=(p->>'habit_id')::uuid;new.done_on:=app_private.finance_date(p->>'done_on');select * into h from public.habits where user_id=new.user_id and id=new.habit_id;
  if not found or h.archived_at is not null or new.done_on<h.started_on or new.done_on>(current_timestamp at time zone 'America/Sao_Paulo')::date then raise exception 'Habit date unavailable.' using errcode='23514';end if;
  if exists(select 1 from public.habit_pauses where user_id=new.user_id and (habit_id is null or habit_id=new.habit_id) and starts_on<=new.done_on and (ends_on is null or ends_on>=new.done_on)) or (h.schedule_kind='weekdays' and not extract(dow from new.done_on)::integer=any(h.weekdays)) then raise exception 'Habit day paused or outside cadence.' using errcode='23514';end if;
  if tg_op='UPDATE' then raise exception 'Habit marks immutable.' using errcode='23514';end if;
 elsif tg_table_name='habit_pauses' then
  new.habit_id:=(p->>'habit_id')::uuid;new.starts_on:=app_private.finance_date(p->>'starts_on');new.ends_on:=app_private.finance_date(p->>'ends_on');
  if new.habit_id is not null and not exists(select 1 from public.habits where user_id=new.user_id and id=new.habit_id and archived_at is null and started_on<=new.starts_on) then raise exception 'Habit pause unavailable.' using errcode='23514';end if;
  if p->'reason'<>'null'::jsonb and (jsonb_typeof(p->'reason') is distinct from 'string' or char_length(p->>'reason')>200) then raise exception 'Invalid pause reason.' using errcode='22023';end if;
  if tg_op='UPDATE' then raise exception 'Habit pauses immutable.' using errcode='23514';end if;
 else
  if jsonb_typeof(p->'name') is distinct from 'string' or char_length(btrim(p->>'name')) not between 1 and 200 or jsonb_typeof(p->'position') is distinct from 'number' or (p->>'position') !~ '^(0|[1-9][0-9]*)$' then raise exception 'Invalid folder.' using errcode='22023';end if;
  new.name:=p->>'name';new.parent_id:=(p->>'parent_id')::uuid;new.project_id:=(p->>'project_id')::uuid;new.position:=(p->>'position')::integer;new.deleted_at:=app_private.capture_task_timestamp(p->'deleted_at',true);new.deletion_batch_id:=(p->>'deletion_batch_id')::uuid;new.updated_at:=app_private.capture_task_timestamp(p->'updated_at');
  if new.parent_id is not null and (tg_op='INSERT' or new.parent_id is distinct from old.parent_id) and not exists(select 1 from public.drive_folders where user_id=new.user_id and id=new.parent_id and deleted_at is null) then raise exception 'Folder parent unavailable.' using errcode='23514';end if;
  visited:=array[new.id];parent:=new.parent_id;while parent is not null loop if parent=any(visited) then raise exception 'Folder cycle.' using errcode='23514';end if;visited:=array_append(visited,parent);select parent_id into parent from public.drive_folders where user_id=new.user_id and id=parent;end loop;
 end if;return new;
exception when invalid_text_representation or numeric_value_out_of_range then raise exception 'Invalid routine field.' using errcode='22023';end $$;
-- Existing links survive deletion. New or changed pointers require a live owned project.
create function app_private.project_live_owner() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if new.project_id is not null and (tg_op='INSERT' or new.project_id is distinct from old.project_id) and not exists(select 1 from public.projects where user_id=new.user_id and id=new.project_id and deleted_at is null) then raise exception 'Project must be live and owned.' using errcode='23514';end if;return new;end $$;
do $$ declare t text;begin
 foreach t in array array['habits','habit_entries','habit_pauses','drive_folders'] loop execute format('create trigger projects_habits_row before insert or update on public.%I for each row execute function app_private.projects_habits_row()',t);end loop;
 foreach t in array array['captures','tasks','knowledge_notebooks','drive_folders'] loop execute format('create trigger zz_project_live_owner before insert or update on public.%I for each row execute function app_private.project_live_owner()',t);end loop;
 foreach t in array array['projects','habits','habit_entries','habit_pauses','captures','knowledge_notebooks','drive_folders'] loop execute format('create trigger projects_habits_revision after insert or update or delete on public.%I for each row execute function app_private.projects_habits_bump()',t);end loop;
end $$;
create trigger projects_habits_revision after insert or update or delete on public.domain_events for each row execute function app_private.projects_habits_bump();
create trigger projects_habits_revision after insert or update or delete on app_private.command_receipts for each row execute function app_private.projects_habits_bump();

create function app_private.project_container_record(p_user uuid,p_kind text,p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare p jsonb;begin
 if p_kind='capture' then select payload into p from public.captures where user_id=p_user and id=p_id;
 elsif p_kind='notebook' then select payload into p from public.knowledge_notebooks where user_id=p_user and id=p_id;
 elsif p_kind='folder' then select payload into p from public.drive_folders where user_id=p_user and id=p_id;
 else raise exception 'Unknown container kind.' using errcode='22023';end if;
 if p is null then return null;end if;
 return jsonb_build_object('id',p->'id','user_id',p->'user_id','kind',p_kind,'name',case when p_kind='capture' then coalesce(nullif(p->>'title',''),'Captura sem título') else p->>'name' end,'project_id',p->'project_id','parent_id',case when p_kind='folder' then p->'parent_id' else 'null'::jsonb end,'deleted_at',case when p_kind='capture' and p->'deleted_at'='null'::jsonb then p->'archived_at' else p->'deleted_at' end,'created_at',p->'created_at','updated_at',p->'updated_at');
end $$;
create function app_private.projects_habits_record(p_user uuid,p_kind text,p_id uuid,p_container_kind text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare t text;result jsonb;begin
 if p_kind='project_container' then return app_private.project_container_record(p_user,p_container_kind,p_id);end if;
 t:=case p_kind when 'project' then 'projects' when 'habit' then 'habits' when 'habit_entry' then 'habit_entries' when 'habit_pause' then 'habit_pauses' end;if t is null then raise exception 'Unknown routine record.' using errcode='22023';end if;
 execute format('select payload from public.%I where user_id=$1 and id=$2',t) into result using p_user,p_id;return result;
end $$;
create function app_private.projects_habits_snapshot(p_user uuid,p_session uuid,p_operation text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_snapshot jsonb;project_mode boolean;containers jsonb;begin
 perform app_private.projects_habits_guard(p_user,p_session,p_operation);project_mode:=p_operation='read.projects' or p_operation like 'project.%';
 if project_mode then
  select coalesce(jsonb_agg(app_private.project_container_record(p_user,kind,id) order by kind,id),'[]'::jsonb) into containers from (
   select 'capture'::text kind,id from public.captures where user_id=p_user and app_private.projects_habits_feature(p_user,'capturar')
   union all select 'notebook',id from public.knowledge_notebooks where user_id=p_user and app_private.projects_habits_feature(p_user,'conhecimento')
   union all select 'folder',id from public.drive_folders where user_id=p_user and app_private.projects_habits_feature(p_user,'drive')) c;
 end if;
 select jsonb_build_object('revision',coalesce((select revision::text from app_private.projects_habits_revisions where user_id=p_user),'0'),
 'projects',case when project_mode then coalesce((select jsonb_agg(payload order by created_at,id) from public.projects where user_id=p_user),'[]'::jsonb) else '[]'::jsonb end,
 'containers',coalesce(containers,'[]'::jsonb),
 'habits',case when project_mode then '[]'::jsonb else coalesce((select jsonb_agg(payload order by created_at,id) from public.habits where user_id=p_user),'[]'::jsonb) end,
 'entries',case when project_mode then '[]'::jsonb else coalesce((select jsonb_agg(payload order by done_on,id) from public.habit_entries where user_id=p_user),'[]'::jsonb) end,
 'pauses',case when project_mode then '[]'::jsonb else coalesce((select jsonb_agg(payload order by starts_on,id) from public.habit_pauses where user_id=p_user),'[]'::jsonb) end,
 'events',coalesce((select jsonb_agg(jsonb_build_object('id',id,'user_id',user_id,'entity_type',entity_type,'entity_id',entity_id,'action',action,'canal',canal,'occurred_at',occurred_at,'before',before,'after',after) order by occurred_at,id) from public.domain_events where user_id=p_user and ((project_mode and entity_type in ('project','project_container')) or (not project_mode and entity_type in ('habit','habit_entry','habit_pause')))),'[]'::jsonb),
 'receipts',coalesce((select jsonb_agg(jsonb_build_object('user_id',user_id,'command',command,'client_id',client_id,'fingerprint',request#>>'{}','result',result)) from app_private.command_receipts where user_id=p_user and app_private.projects_habits_command(command) and (case when project_mode then command like 'project.%' else command like 'habit.%' end)),'[]'::jsonb)) into v_snapshot;
 if octet_length(v_snapshot::text)>8388608 or (select sum(jsonb_array_length(v_snapshot->k)) from unnest(array['projects','containers','habits','entries','pauses','events','receipts']) k)>10000 then raise exception 'Complete routine snapshot exceeds limit.' using errcode='54000';end if;return v_snapshot;
end $$;
create function app_private.projects_habits_receipt(p_user uuid,p_session uuid,p_operation text,p_command text,p_client_id text) returns jsonb language plpgsql security definer set search_path='' as $$ begin
 perform app_private.projects_habits_guard(p_user,p_session,p_operation);if p_operation is distinct from p_command or not app_private.projects_habits_command(p_command) then raise exception 'Receipt outside command.' using errcode='22023';end if;
 return(select jsonb_build_object('user_id',user_id,'command',command,'client_id',client_id,'fingerprint',request#>>'{}','result',result) from app_private.command_receipts where user_id=p_user and command=p_command and client_id=p_client_id);end $$;
create function app_private.projects_habits_fields(p_kind text,p jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare result jsonb;begin
 if p_kind='project' then
  return jsonb_build_object('name',btrim(p->>'name'),'description',nullif(btrim(p->>'description'),''),'color_key',p->'color_key','position',p->'position');
 end if;
 result:=jsonb_build_object('name',btrim(p->>'name'),'schedule_kind',p->'schedule_kind','weekdays',case when p->>'schedule_kind'='weekdays' then coalesce((select jsonb_agg(value::integer order by value::integer) from jsonb_array_elements_text(p->'weekdays')),'[]'::jsonb) else '[]'::jsonb end,'weekly_target',case when p->>'schedule_kind'='weekly_target' then p->'weekly_target' else 'null'::jsonb end,'started_on',p->'started_on','color_key',p->'color_key','icon_key',p->'icon_key','position',p->'position');
 return result;
end $$;
create function app_private.projects_habits_commit(p_user uuid,p_session uuid,p_operation text,p_request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r jsonb;input jsonb;c jsonb;a jsonb;b jsonb;row_value jsonb;saved jsonb;e jsonb;source jsonb;new_source jsonb;expected jsonb;kind text;container_kind text;t text;feature text;n integer;expected_action text;h public.habits;stored app_private.command_receipts;begin
 perform app_private.projects_habits_guard(p_user,p_session,p_operation);
 if not app_private.projects_habits_command(p_operation) or jsonb_typeof(p_request) is distinct from 'object' or not p_request ?& array['expectedRevision','context','changes','events','receipt'] or p_request-array['expectedRevision','context','changes','events','receipt']<>'{}'::jsonb or jsonb_typeof(p_request->'expectedRevision') is distinct from 'string' or p_request->>'expectedRevision' !~ '^(0|[1-9][0-9]*)$' or p_request#>>'{context,user_id}' is distinct from p_user::text or coalesce(p_request#>>'{context,canal}','') not in ('web','api','cron') or jsonb_typeof(p_request->'changes') is distinct from 'array' or jsonb_typeof(p_request->'events') is distinct from 'array' or octet_length(p_request::text)>8388608 then raise exception 'Invalid routine envelope.' using errcode='22023';end if;
 r:=p_request->'receipt';if jsonb_typeof(r) is distinct from 'object' or not r ?& array['user_id','command','client_id','fingerprint','result'] or r-array['user_id','command','client_id','fingerprint','result']<>'{}'::jsonb or r->>'user_id' is distinct from p_user::text or r->>'command' is distinct from p_operation or jsonb_typeof(r->'client_id') is distinct from 'string' or char_length(btrim(r->>'client_id')) not between 1 and 200 or jsonb_typeof(r->'fingerprint') is distinct from 'string' then raise exception 'Invalid routine receipt.' using errcode='22023';end if;
 input:=(r->>'fingerprint')::jsonb;if jsonb_typeof(input) is distinct from 'object' or input->>'client_id' is distinct from r->>'client_id' then raise exception 'Fingerprint outside command.' using errcode='22023';end if;
 select * into stored from app_private.command_receipts where user_id=p_user and command=p_operation and client_id=r->>'client_id';if found then if stored.request is distinct from to_jsonb(r->>'fingerprint') then raise exception 'client_id reused.' using errcode='23505';end if;return jsonb_build_object('status','replayed','result',stored.result);end if;
 if coalesce((select revision::text from app_private.projects_habits_revisions where user_id=p_user),'0')<>p_request->>'expectedRevision' then return jsonb_build_object('status','stale');end if;
 n:=jsonb_array_length(p_request->'changes');if n>1 or n<>jsonb_array_length(p_request->'events') then raise exception 'One mutation with exact event required.' using errcode='23514';end if;
 if not (app_private.consume_rate_limit_at('capture_task_write',encode(sha256(convert_to(p_user::text,'UTF8')),'hex'),p_user,null)->>'allowed')::boolean then raise exception 'Write limit reached.' using errcode='PT429';end if;
 for c in select value from jsonb_array_elements(p_request->'changes') loop
  if jsonb_typeof(c) is distinct from 'object' or not c ?& array['type','before','after'] or c-array['type','before','after']<>'{}'::jsonb then raise exception 'Invalid mutation.' using errcode='22023';end if;
  kind:=c->>'type';a:=nullif(c->'after','null'::jsonb);b:=nullif(c->'before','null'::jsonb);row_value:=coalesce(a,b);container_kind:=case when kind='project_container' then row_value->>'kind' else null end;
  if jsonb_typeof(row_value) is distinct from 'object' or row_value->>'user_id' is distinct from p_user::text or (b is not null and (b->>'user_id' is distinct from p_user::text or b->>'id' is distinct from row_value->>'id')) then raise exception 'Mutation outside owner.' using errcode='42501';end if;
  if kind is distinct from (case when p_operation like 'project.container.%' then 'project_container' when p_operation like 'project.%' then 'project' when p_operation like 'habit.pause.%' then 'habit_pause' when p_operation='habit.mark' then 'habit_entry' else 'habit' end) then raise exception 'Mutation outside operation.' using errcode='42501';end if;
  if input ? 'id' and input->>'id' is distinct from row_value->>'id' then raise exception 'Mutation outside target.' using errcode='23514';end if;
  saved:=app_private.projects_habits_record(p_user,kind,(row_value->>'id')::uuid,container_kind);if saved is distinct from b then raise exception 'Before changed.' using errcode='40001';end if;
  if p_operation like '%.create' and (b is not null or a is null) then raise exception 'Create shape invalid.' using errcode='23514';end if;
  if p_operation in ('project.update','project.delete','project.restore','project.container.link','project.container.unlink','habit.update','habit.archive','habit.restore','habit.pause.delete') and b is null then raise exception 'Existing record required.' using errcode='23514';end if;
  if a is null and p_operation not in ('habit.mark','habit.pause.delete') then raise exception 'Physical deletion unavailable.' using errcode='23514';end if;
  if p_operation in ('project.create','habit.create') and ((a-array['id','user_id','deleted_at','archived_at','created_at','updated_at']) is distinct from app_private.projects_habits_fields(kind,input) or coalesce(a->'deleted_at',a->'archived_at') is distinct from 'null'::jsonb) then raise exception 'Create outside intention.' using errcode='23514';end if;
  if p_operation in ('project.update','habit.update') then
   if jsonb_typeof(input->'patch') is distinct from 'object' or (input->'patch')-(case when kind='project' then array['name','description','color_key','position'] else array['name','schedule_kind','weekdays','weekly_target','started_on','color_key','icon_key','position'] end)<>'{}'::jsonb or coalesce(b->'deleted_at',b->'archived_at') is distinct from 'null'::jsonb then raise exception 'Update unavailable.' using errcode='23514';end if;
   expected:=(b||(input->'patch'));expected:=expected||app_private.projects_habits_fields(kind,expected);expected:=jsonb_set(expected,'{updated_at}',a->'updated_at');if a is distinct from expected then raise exception 'Update outside intention.' using errcode='23514';end if;
  end if;
  if p_operation in ('project.delete','project.restore') and (a-'deleted_at'-'updated_at') is distinct from (b-'deleted_at'-'updated_at') then raise exception 'Project deletion changes only project.' using errcode='23514';end if;
  if p_operation in ('habit.archive','habit.restore') and (a-'archived_at'-'updated_at') is distinct from (b-'archived_at'-'updated_at') then raise exception 'Archive preserves habit history.' using errcode='23514';end if;
  if p_operation in ('project.delete','habit.archive') and (coalesce(b->'deleted_at',b->'archived_at') is distinct from 'null'::jsonb or coalesce(a->'deleted_at',a->'archived_at')='null'::jsonb) then raise exception 'Archive outside intention.' using errcode='23514';end if;
  if p_operation in ('project.restore','habit.restore') and (coalesce(b->'deleted_at',b->'archived_at')='null'::jsonb or coalesce(a->'deleted_at',a->'archived_at') is distinct from 'null'::jsonb) then raise exception 'Restore outside intention.' using errcode='23514';end if;
  if p_operation='habit.mark' and (row_value->>'habit_id' is distinct from input->>'habit_id' or row_value->>'done_on' is distinct from input->>'done_on' or jsonb_typeof(input->'done') is distinct from 'boolean' or (input->>'done')::boolean is distinct from (a is not null)) then raise exception 'Mark outside intention.' using errcode='23514';end if;
  if p_operation='habit.mark' then
   select * into h from public.habits where user_id=p_user and id=(input->>'habit_id')::uuid;
   if not found or h.archived_at is not null or input->>'done_on' is null or app_private.finance_date(input->>'done_on')<h.started_on or app_private.finance_date(input->>'done_on')>(current_timestamp at time zone 'America/Sao_Paulo')::date then raise exception 'Habit mark unavailable.' using errcode='23514';end if;
  end if;
  if p_operation='habit.pause.create' and (a->'habit_id' is distinct from input->'habit_id' or a->'starts_on' is distinct from input->'starts_on' or a->'ends_on' is distinct from input->'ends_on' or a->'reason' is distinct from coalesce(to_jsonb(nullif(btrim(input->>'reason'),'')),'null'::jsonb)) then raise exception 'Pause outside intention.' using errcode='23514';end if;
  if p_operation='habit.pause.delete' and a is not null then raise exception 'Pause removal outside intention.' using errcode='23514';end if;
  expected_action:=case when b is null then 'created' when a is null or p_operation in ('project.delete','habit.archive') then 'deleted' when p_operation in ('project.restore','habit.restore') then 'restored' else 'updated' end;
  select count(*) into n from jsonb_array_elements(p_request->'events') ev where ev->>'entity_type'=kind and ev->>'entity_id'=row_value->>'id' and ev->>'action'=expected_action and ev->'before' is not distinct from coalesce(b,'null'::jsonb) and ev->'after' is not distinct from coalesce(a,'null'::jsonb);if n<>1 then raise exception 'Exact matching event required.' using errcode='23514';end if;
  if kind='project_container' then
   if jsonb_typeof(row_value) is distinct from 'object' or not row_value ?& array['id','user_id','kind','name','project_id','parent_id','deleted_at','created_at','updated_at'] or row_value-array['id','user_id','kind','name','project_id','parent_id','deleted_at','created_at','updated_at']<>'{}'::jsonb or container_kind not in ('capture','notebook','folder') or jsonb_typeof(row_value->'name') is distinct from 'string' or char_length(btrim(row_value->>'name')) not between 1 and 200 then raise exception 'Invalid container metadata.' using errcode='22023';end if;
   feature:=case container_kind when 'capture' then 'capturar' when 'notebook' then 'conhecimento' else 'drive' end;if not app_private.projects_habits_feature(p_user,feature) then raise exception 'Container feature unavailable.' using errcode='42501';end if;
   t:=case container_kind when 'capture' then 'captures' when 'notebook' then 'knowledge_notebooks' else 'drive_folders' end;
   if a is null or a->'deleted_at'<>'null'::jsonb then raise exception 'Container must be active.' using errcode='23514';end if;
   if p_operation='project.container.unlink' then if a->'project_id' is distinct from 'null'::jsonb then raise exception 'Unlink must clear project.' using errcode='23514';end if;
   elsif a->>'project_id' is distinct from input->>'project_id' then raise exception 'Container outside selected project.' using errcode='23514';end if;
   if b is null then
    if container_kind is distinct from input->>'kind' or a->>'name' is distinct from btrim(input->>'name') or a->'parent_id' is distinct from coalesce(input->'parent_id','null'::jsonb) then raise exception 'Create outside intention.' using errcode='23514';end if;
    new_source:=a-'kind';
    if container_kind='capture' then new_source:=jsonb_build_object('id',a->'id','user_id',a->'user_id','client_id',r->'client_id','project_id',a->'project_id','type','note','title',a->'name','content','null'::jsonb,'status','inbox','category_id','null'::jsonb,'converted_task_id','null'::jsonb,'captured_at',a->'created_at','organized_at','null'::jsonb,'archived_at','null'::jsonb,'deleted_at','null'::jsonb,'created_at',a->'created_at','updated_at',a->'updated_at');
    elsif container_kind='notebook' then new_source:=a-array['kind','parent_id'];new_source:=new_source||jsonb_build_object('position',0,'deletion_batch_id','null'::jsonb);
    else new_source:=new_source||jsonb_build_object('position',0,'deletion_batch_id','null'::jsonb);end if;
    execute format('insert into public.%I(id,user_id,payload) values(($1->>''id'')::uuid,($1->>''user_id'')::uuid,$1)',t) using new_source;
   else
    if b->'deleted_at'<>'null'::jsonb or (a-'project_id'-'updated_at') is distinct from (b-'project_id'-'updated_at') then raise exception 'Link preserves source content.' using errcode='23514';end if;
    execute format('select payload from public.%I where user_id=$1 and id=$2',t) into source using p_user,(a->>'id')::uuid;
    new_source:=jsonb_set(jsonb_set(source,'{project_id}',a->'project_id'),'{updated_at}',a->'updated_at');execute format('update public.%I set payload=$1 where user_id=$2 and id=$3',t) using new_source,p_user,(a->>'id')::uuid;
   end if;
  else
   t:=case kind when 'project' then 'projects' when 'habit' then 'habits' when 'habit_entry' then 'habit_entries' else 'habit_pauses' end;
   if kind='project' and a is not null then perform app_private.capture_task_validate_payload('project',a);end if;
   if a is null then execute format('delete from public.%I where user_id=$1 and id=$2',t) using p_user,(b->>'id')::uuid;
   elsif b is null then execute format('insert into public.%I(payload) values($1)',t) using a;
   else execute format('update public.%I set payload=$1 where user_id=$2 and id=$3',t) using a,p_user,(a->>'id')::uuid;end if;
  end if;
  if app_private.projects_habits_record(p_user,kind,(row_value->>'id')::uuid,container_kind) is distinct from a then raise exception 'Projection differs.' using errcode='23514';end if;
 end loop;
 if jsonb_array_length(p_request->'changes')=0 then
  if p_operation in ('project.delete','project.restore','habit.archive','habit.restore') then
   kind:=case when p_operation like 'project.%' then 'project' else 'habit' end;saved:=app_private.projects_habits_record(p_user,kind,(input->>'id')::uuid);
   if saved is null or r->'result' is distinct from saved or ((p_operation in ('project.restore','habit.restore')) is distinct from (coalesce(saved->'deleted_at',saved->'archived_at')='null'::jsonb)) then raise exception 'Unchanged result outside intention.' using errcode='23514';end if;
  elsif p_operation in ('project.container.link','project.container.unlink') then
   container_kind:=r#>>'{result,kind}';saved:=app_private.project_container_record(p_user,container_kind,(input->>'id')::uuid);
   feature:=case container_kind when 'capture' then 'capturar' when 'notebook' then 'conhecimento' else 'drive' end;
   if saved is null or saved->'deleted_at' is distinct from 'null'::jsonb or r->'result' is distinct from saved or not app_private.projects_habits_feature(p_user,feature) or saved->'project_id' is distinct from (case when p_operation='project.container.unlink' then 'null'::jsonb else input->'project_id' end) then raise exception 'Unchanged link outside intention.' using errcode='23514';end if;
   if p_operation='project.container.link' and not exists(select 1 from public.projects where user_id=p_user and id=(input->>'project_id')::uuid and deleted_at is null) then raise exception 'Project must be live and owned.' using errcode='23514';end if;
  elsif p_operation='habit.mark' then
   select * into h from public.habits where user_id=p_user and id=(input->>'habit_id')::uuid;
   if not found or h.archived_at is not null or input->>'done_on' is null or app_private.finance_date(input->>'done_on')<h.started_on or app_private.finance_date(input->>'done_on')>(current_timestamp at time zone 'America/Sao_Paulo')::date or jsonb_typeof(input->'done') is distinct from 'boolean' then raise exception 'Unchanged mark unavailable.' using errcode='23514';end if;
   select payload into saved from public.habit_entries where user_id=p_user and habit_id=h.id and done_on=app_private.finance_date(input->>'done_on');
   if ((input->>'done')::boolean is distinct from (saved is not null)) or r->'result' is distinct from coalesce(saved,'null'::jsonb) then raise exception 'Unchanged mark outside intention.' using errcode='23514';end if;
  else raise exception 'Operation requires a mutation.' using errcode='23514';end if;
 end if;
 set constraints all immediate;
 for e in select value from jsonb_array_elements(p_request->'events') loop
  if e->>'user_id' is distinct from p_user::text or e->>'canal' is distinct from p_request#>>'{context,canal}' or e->>'action' not in ('created','updated','deleted','restored','status_changed') then raise exception 'Invalid routine event.' using errcode='23514';end if;
  insert into public.domain_events(id,user_id,entity_type,entity_id,action,canal,occurred_at,before,after) values((e->>'id')::uuid,p_user,e->>'entity_type',(e->>'entity_id')::uuid,e->>'action',e->>'canal',app_private.capture_task_timestamp(e->'occurred_at'),nullif(e->'before','null'::jsonb),nullif(e->'after','null'::jsonb));
 end loop;
 if jsonb_array_length(p_request->'changes')>0 and r->'result' is distinct from coalesce(a,'null'::jsonb) then raise exception 'Result outside persisted mutation.' using errcode='23514';end if;
 insert into app_private.command_receipts(user_id,command,client_id,request,result) values(p_user,p_operation,r->>'client_id',to_jsonb(r->>'fingerprint'),r->'result');perform app_private.projects_habits_snapshot(p_user,p_session,p_operation);
 return jsonb_build_object('status','committed','result',r->'result');
exception when invalid_text_representation or numeric_value_out_of_range then raise exception 'Invalid routine value.' using errcode='22023';end $$;

create function public.projects_habits_snapshot(p_user uuid,p_session uuid,p_operation text) returns jsonb language sql security invoker set search_path='' as $$ select app_private.projects_habits_snapshot(p_user,p_session,p_operation) $$;
create function public.projects_habits_commit(p_user uuid,p_session uuid,p_operation text,p_request jsonb) returns jsonb language sql security invoker set search_path='' as $$ select app_private.projects_habits_commit(p_user,p_session,p_operation,p_request) $$;
create function public.projects_habits_receipt(p_user uuid,p_session uuid,p_operation text,p_command text,p_client_id text) returns jsonb language sql security invoker set search_path='' as $$ select app_private.projects_habits_receipt(p_user,p_session,p_operation,p_command,p_client_id) $$;
do $$ declare t text;f record;feature text;begin
 foreach t in array array['habits','habit_entries','habit_pauses','drive_folders'] loop
  feature:=case when t='drive_folders' then 'drive' else 'habitos' end;execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);execute format('grant select on public.%I to authenticated',t);
  execute format('create policy routine_owner_read on public.%I for select to authenticated using(user_id=(select auth.uid()) and (select app_private.has_feature(%L)))',t,feature);
 end loop;
 for f in select p.oid::regprocedure signature,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='app_private' and (p.proname like 'projects_habits_%' or p.proname in ('project_container_record','project_live_owner'))) or (n.nspname='public' and p.proname in ('projects_habits_snapshot','projects_habits_commit','projects_habits_receipt')) loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);if f.proname in ('projects_habits_snapshot','projects_habits_commit','projects_habits_receipt') then execute format('grant execute on function %s to service_role',f.signature);end if;
 end loop;
end $$;
alter table app_private.projects_habits_revisions enable row level security;
revoke all on app_private.projects_habits_revisions from public,anon,authenticated,service_role;
comment on function public.projects_habits_snapshot(uuid,uuid,text) is 'Complete habit history; display heatmap windows never truncate streak inputs.';
comment on function app_private.project_live_owner() is 'New pointers require live owned projects; project soft deletion preserves existing container pointers.';
commit;
