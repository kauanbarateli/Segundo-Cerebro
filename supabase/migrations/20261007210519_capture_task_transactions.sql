-- T015 versioned migration; supervised application only under OP-009.
-- Execution evidence belongs to the implementation report, not this file.
-- Created with Supabase CLI 2.117.0 migration new capture_task_transactions.
-- Apply only to the authorized personal project after review. No seed/reset.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$ begin
  if current_user <> 'postgres' or to_regprocedure('app_private.require_actor(uuid,uuid)') is null
    or to_regclass('app_private.command_receipts') is null then
    raise exception 'Apply reviewed T013/T014 foundation as postgres first.';
  end if;
  if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where (n.nspname='public' and c.relname=any(array['captures','tasks','categories','projects','capture_links']))
      or (n.nspname='app_private' and c.relname='capture_task_revisions')) then
    raise exception 'T015 tables already exist; inspect drift before applying.';
  end if;
end $$;

-- The original JSON is the transport contract, including optional-key omission,
-- timestamp spelling/offsets and long descriptions inherited by conversion.
-- Relational columns are derived by a BEFORE trigger; they never rewrite JSON.
-- Later storage/editor schemas require their own reviewed migrations.
create table public.categories (
  id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null, created_at timestamptz not null, updated_at timestamptz not null,
  unique(user_id,id)
);
create table public.projects (
  id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null, deleted_at timestamptz, created_at timestamptz not null, updated_at timestamptz not null,
  unique(user_id,id)
);
create table public.captures (
  id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null, payload jsonb not null, category_id uuid, project_id uuid, converted_task_id uuid,
  status text not null, deleted_at timestamptz, archived_at timestamptz,
  created_at timestamptz not null, updated_at timestamptz not null,
  unique(user_id,id), unique(user_id,client_id), unique(user_id,converted_task_id),
  foreign key(user_id,category_id) references public.categories(user_id,id) deferrable initially deferred,
  foreign key(user_id,project_id) references public.projects(user_id,id) deferrable initially deferred
);
create table public.tasks (
  id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null, payload jsonb not null, category_id uuid, project_id uuid, origin_capture_id uuid,
  status text not null, deleted_at timestamptz, archived_at timestamptz,
  created_at timestamptz not null, updated_at timestamptz not null,
  unique(user_id,id), unique(user_id,client_id), unique(user_id,origin_capture_id),
  foreign key(user_id,category_id) references public.categories(user_id,id) deferrable initially deferred,
  foreign key(user_id,project_id) references public.projects(user_id,id) deferrable initially deferred,
  foreign key(user_id,origin_capture_id) references public.captures(user_id,id) deferrable initially deferred
);
alter table public.captures add constraint captures_converted_task_fk
  foreign key(user_id,converted_task_id) references public.tasks(user_id,id) deferrable initially deferred;
create table public.capture_links (
  user_id uuid not null references auth.users(id) on delete cascade,
  source_id uuid not null, target_id uuid not null,
  primary key(user_id,source_id,target_id), check(source_id<>target_id),
  foreign key(user_id,source_id) references public.captures(user_id,id) on delete cascade deferrable initially deferred,
  foreign key(user_id,target_id) references public.captures(user_id,id) on delete cascade deferrable initially deferred
);
create table app_private.capture_task_revisions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 0 check(revision>=0)
);
create index captures_user_created_idx on public.captures(user_id,created_at,id);
create index tasks_user_created_idx on public.tasks(user_id,created_at,id);
create index captures_category_idx on public.captures(user_id,category_id) where category_id is not null;
create index captures_project_idx on public.captures(user_id,project_id) where project_id is not null;
create index tasks_category_idx on public.tasks(user_id,category_id) where category_id is not null;
create index tasks_project_idx on public.tasks(user_id,project_id) where project_id is not null;
create index capture_links_target_idx on public.capture_links(user_id,target_id,source_id);

alter table public.domain_events drop constraint domain_events_entity_type_check;
alter table public.domain_events add constraint domain_events_entity_type_check
  check(entity_type in ('profile','preference','module_preference','role','moderation','entitlement','authentication','capture','task'));
alter table public.domain_events add column capture_task_payload jsonb;
alter table public.domain_events add constraint domain_events_capture_task_payload_check
  check((entity_type in ('capture','task')) = (capture_task_payload is not null));
create index domain_events_capture_task_idx on public.domain_events(user_id,occurred_at,id)
  where entity_type in ('capture','task');

create function app_private.capture_task_lock(p_user uuid) returns void
language sql security definer set search_path='' as $$
  select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('capture-task:'||p_user::text,0));
$$;
create function app_private.capture_task_command(p_command text) returns boolean
language sql immutable set search_path='' as $$
  select coalesce(p_command=any(array['capture.create','capture.update','capture.archive','capture.unarchive',
    'capture.delete','capture.restore','capture.organize','capture.convert','task.create','task.update','task.status','task.delete','task.restore']),false);
$$;
create function app_private.capture_task_guard(p_user uuid,p_session uuid,p_operation text) returns void
language plpgsql security definer set search_path='' as $$
declare v_features text[];
begin
  -- Lock Auth parents before the per-user lock: concurrent Auth DELETE/cascades
  -- may wait, but cannot invalidate a checked session midway through this RPC.
  perform 1 from auth.users where id=p_user for share;
  perform 1 from auth.sessions where id=p_session and user_id=p_user for share;
  perform app_private.capture_task_lock(p_user);
  perform app_private.require_actor(p_user,p_session);
  if p_operation='capture.convert' then v_features:=array['capturar','tarefas'];
  elsif p_operation='read.captures' or p_operation like 'capture.%' and app_private.capture_task_command(p_operation) then v_features:=array['capturar'];
  elsif p_operation='read.tasks' or p_operation like 'task.%' and app_private.capture_task_command(p_operation) then v_features:=array['tarefas'];
  else raise exception 'Unknown operation.' using errcode='22023'; end if;
  if exists(select 1 from public.user_entitlements where user_id=p_user and feature_key=any(v_features) and not allowed) then
    raise exception 'Functionality unavailable.' using errcode='42501';
  end if;
end $$;

-- Existing or newly inserted vetoes/moderation changes share the command lock.
-- Do not take row locks on these tables in capture_task_guard after this lock.
create function app_private.capture_task_access_lock() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_op='UPDATE' and new.user_id<>old.user_id then
    raise exception 'Authorization owner is immutable.' using errcode='23514';
  end if;
  perform app_private.capture_task_lock(case when tg_op='DELETE' then old.user_id else new.user_id end);
  if tg_op='DELETE' then return old; end if; return new;
end $$;
create trigger capture_task_access_lock before insert or update or delete on public.user_entitlements
  for each row execute function app_private.capture_task_access_lock();
create trigger capture_task_access_lock before insert or update or delete on public.user_moderation
  for each row execute function app_private.capture_task_access_lock();

create function app_private.capture_task_timestamp(p_value jsonb,p_nullable boolean default false) returns timestamptz
language plpgsql immutable set search_path='' as $$
begin
  if p_nullable and p_value='null'::jsonb then return null; end if;
  if jsonb_typeof(p_value) is distinct from 'string' or (p_value#>>'{}') !~
    '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$' then
    raise exception 'Timestamp with explicit zone required.' using errcode='22023';
  end if;
  if substring(p_value#>>'{}' from 12 for 2)::integer>=24 or substring(p_value#>>'{}' from 15 for 2)::integer>=60
    or substring(p_value#>>'{}' from 18 for 2)::integer>=60 then
    raise exception 'Invalid timestamp clock fields.' using errcode='22023';
  end if;
  return (p_value#>>'{}')::timestamptz;
exception when datetime_field_overflow or invalid_datetime_format then
  raise exception 'Invalid timestamp.' using errcode='22023';
end $$;

create function app_private.capture_task_validate_payload(p_kind text,p jsonb) returns void
language plpgsql immutable set search_path='' as $$
declare required text[]; optional text[]:='{}'; k text; v jsonb; ids uuid[]:='{}'; parsed uuid;
begin
  if p_kind='capture' then
    required:=array['id','user_id','client_id','project_id','type','title','content','status','category_id','converted_task_id','captured_at','organized_at','archived_at','deleted_at','created_at','updated_at'];
    optional:=array['linked_capture_ids','attachments'];
  elsif p_kind='task' then
    required:=array['id','user_id','client_id','title','description','category_id','project_id','status','priority','due_at','scheduled_start_at','scheduled_end_at','all_day','estimated_minutes','board_position','source','origin_capture_id','completed_at','archived_at','deleted_at','created_at','updated_at'];
  elsif p_kind='category' then required:=array['id','user_id','name','normalized_name','color_key','is_system','created_at','updated_at'];
  elsif p_kind='project' then required:=array['id','user_id','name','description','color_key','position','deleted_at','created_at','updated_at'];
  else raise exception 'Invalid record kind.' using errcode='22023'; end if;
  if jsonb_typeof(p) is distinct from 'object' or not p ?& required or p-(required||optional)<>'{}'::jsonb
    or octet_length(p::text)>1048576 then raise exception 'Invalid record shape.' using errcode='22023'; end if;
  foreach k in array array['id','user_id'] loop
    if jsonb_typeof(p->k) is distinct from 'string' or (p->>k)::uuid::text is distinct from p->>k then
      raise exception 'Canonical UUID required.' using errcode='22023'; end if;
  end loop;
  perform app_private.capture_task_timestamp(p->'created_at'); perform app_private.capture_task_timestamp(p->'updated_at');
  if p_kind in ('capture','task') then
    if jsonb_typeof(p->'client_id') is distinct from 'string' or char_length(btrim(p->>'client_id')) not between 1 and 200 then
      raise exception 'Invalid client_id.' using errcode='22023'; end if;
    foreach k in array array['category_id','project_id',case when p_kind='capture' then 'converted_task_id' else 'origin_capture_id' end] loop
      if p->k<>'null'::jsonb and (jsonb_typeof(p->k) is distinct from 'string' or (p->>k)::uuid::text is distinct from p->>k) then
        raise exception 'Invalid reference.' using errcode='22023'; end if;
    end loop;
    foreach k in array array['deleted_at','archived_at'] loop perform app_private.capture_task_timestamp(p->k,true); end loop;
  end if;
  if p_kind='capture' then
    if jsonb_typeof(p->'type') is distinct from 'string' or jsonb_typeof(p->'status') is distinct from 'string'
      or p->>'type' not in ('idea','task','note','reminder') or p->>'status' not in ('draft','inbox','organized','archived')
      or (p->'title'<>'null'::jsonb and (jsonb_typeof(p->'title')<>'string' or char_length(p->>'title')>200))
      or (p->'content'<>'null'::jsonb and (jsonb_typeof(p->'content')<>'string' or char_length(p->>'content')>30000))
      or coalesce(nullif(btrim(p->>'title'),''),nullif(btrim(p->>'content'),'')) is null then
      raise exception 'Invalid capture.' using errcode='22023'; end if;
    perform app_private.capture_task_timestamp(p->'captured_at'); perform app_private.capture_task_timestamp(p->'organized_at',true);
    if p ? 'attachments' and p->'attachments'<>'[]'::jsonb then raise exception 'Uploads are not enabled in this slice.' using errcode='22023'; end if;
    if p ? 'linked_capture_ids' then
      if jsonb_typeof(p->'linked_capture_ids')<>'array' then raise exception 'Invalid capture links.' using errcode='22023'; end if;
      for v in select value from jsonb_array_elements(p->'linked_capture_ids') loop
        if jsonb_typeof(v)<>'string' then raise exception 'Invalid capture link.' using errcode='22023'; end if;
        parsed:=(v#>>'{}')::uuid;
        if parsed::text<>v#>>'{}' or parsed=(p->>'id')::uuid or parsed=any(ids) then raise exception 'Duplicate/self capture link.' using errcode='22023'; end if;
        ids:=array_append(ids,parsed);
      end loop;
    end if;
  elsif p_kind='task' then
    if jsonb_typeof(p->'status') is distinct from 'string' or jsonb_typeof(p->'priority') is distinct from 'string' or jsonb_typeof(p->'source') is distinct from 'string'
      or jsonb_typeof(p->'title')<>'string' or char_length(btrim(p->>'title')) not between 1 and 200
      or (p->'description'<>'null'::jsonb and (jsonb_typeof(p->'description')<>'string' or char_length(p->>'description')>30000))
      or p->>'status' not in ('todo','in_progress','done','archived') or p->>'priority' not in ('low','medium','high','urgent')
      or p->>'source'<>'manual' or jsonb_typeof(p->'all_day')<>'boolean'
      or (p->'estimated_minutes'<>'null'::jsonb and (jsonb_typeof(p->'estimated_minutes')<>'number' or (p->>'estimated_minutes') !~ '^[1-9][0-9]*$' or (p->>'estimated_minutes')::numeric>9007199254740991))
      or (p->'board_position'<>'null'::jsonb and jsonb_typeof(p->'board_position')<>'number') then
      raise exception 'Invalid task.' using errcode='22023'; end if;
    foreach k in array array['due_at','scheduled_start_at','scheduled_end_at','completed_at'] loop perform app_private.capture_task_timestamp(p->k,true); end loop;
    if app_private.capture_task_timestamp(p->'scheduled_end_at',true)<app_private.capture_task_timestamp(p->'scheduled_start_at',true) then
      raise exception 'Invalid task interval.' using errcode='22023'; end if;
    if ((p->>'status'='done') is distinct from (p->'completed_at'<>'null'::jsonb)) then raise exception 'Invalid completion state.' using errcode='22023'; end if;
  else
    if jsonb_typeof(p->'name')<>'string' or char_length(btrim(p->>'name')) not between 1 and 200
      or jsonb_typeof(p->'color_key')<>'string' or char_length(p->>'color_key') not between 1 and 80 then
      raise exception 'Invalid organization record.' using errcode='22023'; end if;
    if p_kind='category' then
      if jsonb_typeof(p->'normalized_name')<>'string' or char_length(p->>'normalized_name') not between 1 and 200 or jsonb_typeof(p->'is_system')<>'boolean' then raise exception 'Invalid category.' using errcode='22023'; end if;
    else
      perform app_private.capture_task_timestamp(p->'deleted_at',true);
      if (p->'description'<>'null'::jsonb and (jsonb_typeof(p->'description')<>'string' or char_length(p->>'description')>30000)) or jsonb_typeof(p->'position')<>'number' then raise exception 'Invalid project.' using errcode='22023'; end if;
    end if;
  end if;
exception when invalid_text_representation or numeric_value_out_of_range then
  raise exception 'Invalid typed field.' using errcode='22023';
end $$;

create function app_private.capture_task_row() returns trigger
language plpgsql security definer set search_path='' as $$
declare kind text;
begin
  kind:=case tg_table_name when 'captures' then 'capture' when 'tasks' then 'task' when 'categories' then 'category' when 'projects' then 'project' end;
  perform app_private.capture_task_validate_payload(kind,new.payload);
  if tg_op='UPDATE' and (new.payload->'id' is distinct from old.payload->'id' or new.payload->'user_id' is distinct from old.payload->'user_id'
    or new.payload->'created_at' is distinct from old.payload->'created_at' or new.payload->'client_id' is distinct from old.payload->'client_id') then
    raise exception 'Record identity is immutable.' using errcode='23514'; end if;
  if tg_op='UPDATE' and kind='capture' and (new.payload->'captured_at' is distinct from old.payload->'captured_at'
    or (old.payload->'converted_task_id'<>'null'::jsonb and new.payload->'converted_task_id' is distinct from old.payload->'converted_task_id')) then
    raise exception 'Capture origin is immutable.' using errcode='23514'; end if;
  if tg_op='UPDATE' and kind='task' and (new.payload->'source' is distinct from old.payload->'source' or new.payload->'origin_capture_id' is distinct from old.payload->'origin_capture_id') then
    raise exception 'Task origin is immutable.' using errcode='23514'; end if;
  new.id:=(new.payload->>'id')::uuid; new.user_id:=(new.payload->>'user_id')::uuid;
  new.created_at:=app_private.capture_task_timestamp(new.payload->'created_at'); new.updated_at:=app_private.capture_task_timestamp(new.payload->'updated_at');
  perform app_private.capture_task_lock(new.user_id);
  if kind in ('capture','task') then
    new.client_id:=new.payload->>'client_id'; new.category_id:=(new.payload->>'category_id')::uuid; new.project_id:=(new.payload->>'project_id')::uuid;
    new.status:=new.payload->>'status'; new.deleted_at:=app_private.capture_task_timestamp(new.payload->'deleted_at',true); new.archived_at:=app_private.capture_task_timestamp(new.payload->'archived_at',true);
    if kind='capture' then new.converted_task_id:=(new.payload->>'converted_task_id')::uuid; else new.origin_capture_id:=(new.payload->>'origin_capture_id')::uuid; end if;
  elsif kind='project' then new.deleted_at:=app_private.capture_task_timestamp(new.payload->'deleted_at',true); end if;
  return new;
end $$;
create trigger capture_task_row before insert or update on public.captures for each row execute function app_private.capture_task_row();
create trigger capture_task_row before insert or update on public.tasks for each row execute function app_private.capture_task_row();
create trigger capture_task_row before insert or update on public.categories for each row execute function app_private.capture_task_row();
create trigger capture_task_row before insert or update on public.projects for each row execute function app_private.capture_task_row();

create function app_private.capture_task_bump() returns trigger
language plpgsql security definer set search_path='' as $$
declare u uuid;
begin
  u:=case when tg_op='DELETE' then old.user_id else new.user_id end;
  if tg_table_name='domain_events' then
    if (case when tg_op='DELETE' then old.entity_type else new.entity_type end) not in ('capture','task') then return null; end if;
  elsif tg_table_name='command_receipts' then
    if not app_private.capture_task_command(case when tg_op='DELETE' then old.command else new.command end) then return null; end if;
  end if;
  perform app_private.capture_task_lock(u);
  -- Auth deletion may cascade through these triggers after its parent vanished.
  if exists(select 1 from auth.users where id=u) then
    insert into app_private.capture_task_revisions(user_id,revision) values(u,1)
      on conflict(user_id) do update set revision=capture_task_revisions.revision+1;
  end if;
  return null;
end $$;
do $$ declare t text; begin
  foreach t in array array['captures','tasks','categories','projects','capture_links','domain_events'] loop
    execute format('create trigger capture_task_revision after insert or update or delete on public.%I for each row execute function app_private.capture_task_bump()',t);
  end loop;
end $$;
create trigger capture_task_revision after insert or update or delete on app_private.command_receipts for each row execute function app_private.capture_task_bump();

create function app_private.capture_task_sync_links() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  delete from public.capture_links where user_id=new.user_id and source_id=new.id
    and target_id not in(select value::uuid from jsonb_array_elements_text(coalesce(new.payload->'linked_capture_ids','[]'::jsonb)));
  insert into public.capture_links(user_id,source_id,target_id)
    select new.user_id,new.id,value::uuid from jsonb_array_elements_text(coalesce(new.payload->'linked_capture_ids','[]'::jsonb))
    on conflict do nothing;
  return null;
end $$;
create trigger capture_task_sync_links after insert or update on public.captures for each row execute function app_private.capture_task_sync_links();

create function app_private.capture_task_integrity(p_user uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from auth.users where id=p_user) then return; end if;
  if exists(select 1 from public.captures c left join public.tasks t on t.user_id=c.user_id and t.id=c.converted_task_id
      where c.user_id=p_user and c.converted_task_id is not null and (t.id is null or t.origin_capture_id is distinct from c.id))
    or exists(select 1 from public.tasks t left join public.captures c on c.user_id=t.user_id and c.id=t.origin_capture_id
      where t.user_id=p_user and t.origin_capture_id is not null and (c.id is null or c.converted_task_id is distinct from t.id)) then
    raise exception 'Conversion references must be reciprocal.' using errcode='23514';
  end if;
  if exists(select 1 from (select user_id,category_id,project_id from public.captures where user_id=p_user
      union all select user_id,category_id,project_id from public.tasks where user_id=p_user) r
    where (r.category_id is not null and not exists(select 1 from public.categories x where x.user_id=r.user_id and x.id=r.category_id))
      or (r.project_id is not null and not exists(select 1 from public.projects x where x.user_id=r.user_id and x.id=r.project_id))) then
    raise exception 'Organization reference outside owner.' using errcode='23503';
  end if;
  if exists(select 1 from public.captures c cross join lateral jsonb_array_elements_text(coalesce(c.payload->'linked_capture_ids','[]'::jsonb)) j
    where c.user_id=p_user and not exists(select 1 from public.capture_links l where l.user_id=c.user_id and l.source_id=c.id and l.target_id=j.value::uuid))
    or exists(select 1 from public.capture_links l left join public.captures s on s.user_id=l.user_id and s.id=l.source_id
      left join public.captures t on t.user_id=l.user_id and t.id=l.target_id where l.user_id=p_user and
      (s.id is null or t.id is null or not coalesce(s.payload->'linked_capture_ids','[]'::jsonb) ? l.target_id::text)) then
    raise exception 'Capture links differ from payload or owner.' using errcode='23503';
  end if;
end $$;
create function app_private.capture_task_deferred_integrity() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  perform app_private.capture_task_integrity(case when tg_op='DELETE' then old.user_id else new.user_id end);
  return null;
end $$;
do $$ declare t text; begin
  foreach t in array array['captures','tasks','capture_links'] loop
    execute format('create constraint trigger capture_task_integrity after insert or update or delete on public.%I deferrable initially deferred for each row execute function app_private.capture_task_deferred_integrity()',t);
  end loop;
end $$;

create function app_private.capture_task_event() returns trigger
language plpgsql security definer set search_path='' as $$
declare p jsonb:=new.capture_task_payload; v jsonb;
begin
  if new.entity_type not in ('capture','task') then return new; end if;
  if jsonb_typeof(p) is distinct from 'object' or not p ?& array['id','user_id','entity_type','entity_id','action','canal','occurred_at','before','after']
    or p-array['id','user_id','entity_type','entity_id','action','canal','occurred_at','before','after']<>'{}'::jsonb
    or p->>'id' is distinct from new.id::text or p->>'user_id' is distinct from new.user_id::text
    or p->>'entity_type' is distinct from new.entity_type or p->>'entity_id' is distinct from new.entity_id::text
    or p->>'action' is distinct from new.action or p->>'canal' is distinct from new.canal
    or app_private.capture_task_timestamp(p->'occurred_at') is distinct from new.occurred_at
    or p->'before' is distinct from coalesce(new.before,'null'::jsonb) or p->'after' is distinct from coalesce(new.after,'null'::jsonb) then
    raise exception 'Event differs from domain payload.' using errcode='23514'; end if;
  if new.after is null or (new.action='created') is distinct from (new.before is null) then raise exception 'Invalid event lifecycle.' using errcode='23514'; end if;
  foreach v in array array[new.before,new.after] loop
    if v is not null then
      perform app_private.capture_task_validate_payload(new.entity_type,v);
      if v->>'id' is distinct from new.entity_id::text or v->>'user_id' is distinct from new.user_id::text then raise exception 'Event record outside context.' using errcode='23514'; end if;
    end if;
  end loop;
  return new;
end $$;
create trigger capture_task_event before insert or update on public.domain_events for each row execute function app_private.capture_task_event();

-- New scope only. Existing login/identity semantics and limits stay intact.
alter table app_private.rate_limits drop constraint rate_limits_scope_check;
alter table app_private.rate_limits add constraint rate_limits_scope_check check(scope in ('login','identity_write','capture_task_write'));
create or replace function app_private.consume_rate_limit_at(p_scope text,p_subject_hash text,p_user uuid,p_now timestamptz) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_limit integer; v_hits timestamptz[]; v_saved_user uuid; v_wait integer;
begin
  v_limit:=case p_scope when 'login' then 5 when 'identity_write' then 30 when 'capture_task_write' then 30 end;
  if v_limit is null or p_subject_hash is null or p_subject_hash !~ '^[a-f0-9]{64}$' then raise exception 'Chave de limite invalida.' using errcode='22023'; end if;
  insert into app_private.rate_limits(scope,subject_hash,user_id) values(p_scope,p_subject_hash,p_user) on conflict do nothing;
  select hits,user_id into strict v_hits,v_saved_user from app_private.rate_limits where scope=p_scope and subject_hash=p_subject_hash for update;
  p_now:=coalesce(p_now,clock_timestamp());
  if v_saved_user is distinct from p_user then raise exception 'Escopo de limite incompatível.' using errcode='22023'; end if;
  select coalesce(array_agg(hit order by hit),'{}'::timestamptz[]) into v_hits from unnest(v_hits) hit where hit > p_now-interval '1 minute';
  if cardinality(v_hits)>=v_limit then
    v_wait:=greatest(1,ceil(extract(epoch from (v_hits[1]+interval '1 minute'-p_now))*1000)::integer);
    update app_private.rate_limits set hits=v_hits,updated_at=p_now where scope=p_scope and subject_hash=p_subject_hash;
    return jsonb_build_object('allowed',false,'remaining',0,'retry_after_ms',v_wait);
  end if;
  v_hits:=array_append(v_hits,p_now);
  update app_private.rate_limits set hits=v_hits,updated_at=p_now where scope=p_scope and subject_hash=p_subject_hash;
  return jsonb_build_object('allowed',true,'remaining',v_limit-cardinality(v_hits),'retry_after_ms',0);
end $$;

create function app_private.capture_task_snapshot(p_user uuid,p_session uuid,p_operation text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; rows_count bigint;
begin
  perform app_private.capture_task_guard(p_user,p_session,p_operation);
  -- One statement/MVCC snapshot, with the same lock all supported writers take.
  select jsonb_build_object(
    'revision',coalesce((select revision::text from app_private.capture_task_revisions where user_id=p_user),'0'),
    'captures',coalesce((select jsonb_agg(payload order by created_at,id) from public.captures where user_id=p_user),'[]'::jsonb),
    'tasks',coalesce((select jsonb_agg(payload order by created_at,id) from public.tasks where user_id=p_user),'[]'::jsonb),
    'categories',coalesce((select jsonb_agg(payload order by created_at,id) from public.categories where user_id=p_user),'[]'::jsonb),
    'projects',coalesce((select jsonb_agg(payload order by created_at,id) from public.projects where user_id=p_user),'[]'::jsonb),
    'events',coalesce((select jsonb_agg(capture_task_payload order by occurred_at,id) from public.domain_events where user_id=p_user and entity_type in ('capture','task')),'[]'::jsonb),
    'receipts',coalesce((select jsonb_agg(jsonb_build_object('user_id',rr.user_id,'command',rr.command,'client_id',rr.client_id,'fingerprint',rr.request#>>'{}','result',rr.result) order by rr.created_at,rr.command,rr.client_id)
      from app_private.command_receipts rr where rr.user_id=p_user and app_private.capture_task_command(rr.command)),'[]'::jsonb),
    'projects_visible',coalesce((select allowed from public.user_entitlements where user_id=p_user and feature_key='projetos'),true)
  ) into result;
  select sum(jsonb_array_length(result->k)) into rows_count from unnest(array['captures','tasks','categories','projects','events','receipts']) k;
  if rows_count>10000 or octet_length(result::text)>8388608 then raise exception 'Snapshot exceeds supported size.' using errcode='54000'; end if;
  return result;
end $$;
create function app_private.capture_task_revision(p_user uuid,p_session uuid,p_operation text) returns text
language plpgsql security definer set search_path='' as $$
begin
  perform app_private.capture_task_guard(p_user,p_session,p_operation);
  return coalesce((select revision::text from app_private.capture_task_revisions where user_id=p_user),'0');
end $$;
create function app_private.capture_task_receipt(p_user uuid,p_session uuid,p_operation text,p_command text,p_client_id text) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  perform app_private.capture_task_guard(p_user,p_session,p_operation);
  if p_command is distinct from p_operation or not app_private.capture_task_command(p_command) or p_client_id is null or char_length(btrim(p_client_id)) not between 1 and 200 then
    raise exception 'Receipt outside operation.' using errcode='22023'; end if;
  return (select jsonb_build_object('user_id',user_id,'command',command,'client_id',client_id,'fingerprint',request#>>'{}','result',result)
    from app_private.command_receipts where user_id=p_user and command=p_command and client_id=p_client_id);
end $$;

create function app_private.capture_task_commit(p_user uuid,p_session uuid,p_operation text,p_request jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  r jsonb; input jsonb; c jsonb; e jsonb; b jsonb; a jsonb; saved jsonb; receipt app_private.command_receipts;
  current_revision text; kind text; record_id uuid; rate jsonb; n integer; result jsonb; link_id text;
begin
  perform app_private.capture_task_guard(p_user,p_session,p_operation);
  if not app_private.capture_task_command(p_operation) or jsonb_typeof(p_request) is distinct from 'object'
    or not p_request ?& array['expectedRevision','context','changes','events','receipt']
    or p_request-array['expectedRevision','context','changes','events','receipt']<>'{}'::jsonb
    or octet_length(p_request::text)>8388608 then raise exception 'Invalid command envelope.' using errcode='22023'; end if;
  if jsonb_typeof(p_request->'context') is distinct from 'object' or (p_request->'context')-array['user_id','canal']<>'{}'::jsonb
    or p_request#>>'{context,user_id}' is distinct from p_user::text or coalesce(p_request#>>'{context,canal}','') not in ('web','api','cron')
    or jsonb_typeof(p_request->'expectedRevision') is distinct from 'string' or p_request->>'expectedRevision' !~ '^(0|[1-9][0-9]*)$'
    or jsonb_typeof(p_request->'changes') is distinct from 'array' or jsonb_typeof(p_request->'events') is distinct from 'array' then
    raise exception 'Invalid command context.' using errcode='22023'; end if;
  if jsonb_array_length(p_request->'changes')>10000 or jsonb_array_length(p_request->'events')<>jsonb_array_length(p_request->'changes') then
    raise exception 'Each change requires exactly one event.' using errcode='23514'; end if;
  r:=p_request->'receipt';
  if jsonb_typeof(r) is distinct from 'object' or not r ?& array['user_id','command','client_id','fingerprint','result']
    or r-array['user_id','command','client_id','fingerprint','result']<>'{}'::jsonb or r->>'user_id' is distinct from p_user::text
    or r->>'command' is distinct from p_operation or jsonb_typeof(r->'client_id') is distinct from 'string'
    or char_length(btrim(r->>'client_id')) not between 1 and 200 or jsonb_typeof(r->'fingerprint') is distinct from 'string'
    or char_length(r->>'fingerprint')=0 or octet_length((r->'fingerprint')::text)>1048576 or octet_length((r->'result')::text)>1048576 then
    raise exception 'Invalid command receipt.' using errcode='22023'; end if;
  begin input:=(r->>'fingerprint')::jsonb;
  exception when invalid_text_representation then raise exception 'Invalid command fingerprint.' using errcode='22023'; end;
  if jsonb_typeof(input) is distinct from 'object' or input->>'client_id' is distinct from r->>'client_id' then
    raise exception 'Fingerprint outside command.' using errcode='22023'; end if;
  -- Knowledge promotion is a separate persistent entity/editor workflow in T021.
  if p_operation='capture.organize' and input->>'destination' is distinct from 'inbox' then
    raise exception 'Knowledge promotion is not available in T015.' using errcode='22023'; end if;
  -- Permission is checked BEFORE replay; replay is checked BEFORE CAS or limits.
  select * into receipt from app_private.command_receipts where user_id=p_user and command=p_operation and client_id=r->>'client_id';
  if found then
    if receipt.request is distinct from to_jsonb(r->>'fingerprint') then raise exception 'client_id reused with different content.' using errcode='23505'; end if;
    return jsonb_build_object('status','replayed','result',receipt.result);
  end if;
  current_revision:=coalesce((select revision::text from app_private.capture_task_revisions where user_id=p_user),'0');
  if current_revision<>p_request->>'expectedRevision' then return jsonb_build_object('status','stale'); end if;
  if (p_operation in ('capture.create','task.create','task.update','task.status','capture.organize') and jsonb_array_length(p_request->'changes')<>1)
    or (p_operation='capture.update' and jsonb_array_length(p_request->'changes')<1)
    or (p_operation='capture.convert' and jsonb_array_length(p_request->'changes') not in (0,2))
    or (p_operation in ('capture.archive','capture.unarchive','capture.delete','capture.restore','task.delete','task.restore') and jsonb_array_length(p_request->'changes')>1) then
    raise exception 'Batch size outside operation.' using errcode='23514'; end if;
  rate:=app_private.consume_rate_limit_at('capture_task_write',encode(sha256(convert_to(p_user::text,'UTF8')),'hex'),p_user,null);
  if not (rate->>'allowed')::boolean then raise exception 'Write limit reached.' using errcode='PT429'; end if;

  if exists(select 1 from jsonb_array_elements(p_request->'changes') x group by x->>'type',x#>>'{after,id}' having count(*)>1)
    or exists(select 1 from jsonb_array_elements(p_request->'events') x group by x->>'id' having count(*)>1) then
    raise exception 'Duplicate records/events in batch.' using errcode='23514'; end if;
  for c in select value from jsonb_array_elements(p_request->'changes') loop
    if jsonb_typeof(c) is distinct from 'object' or not c ?& array['type','before','after'] or c-array['type','before','after']<>'{}'::jsonb
      or coalesce(c->>'type','') not in ('capture','task') then raise exception 'Invalid change.' using errcode='22023'; end if;
    kind:=c->>'type'; b:=nullif(c->'before','null'::jsonb); a:=c->'after';
    if (p_operation like 'task.%' and kind<>'task') or (p_operation like 'capture.%' and p_operation<>'capture.convert' and kind<>'capture') then
      raise exception 'Change outside authorized operation.' using errcode='42501'; end if;
    perform app_private.capture_task_validate_payload(kind,a);
    if a->>'user_id' is distinct from p_user::text then raise exception 'Change outside actor.' using errcode='42501'; end if;
    record_id:=(a->>'id')::uuid;
    if b is not null then
      perform app_private.capture_task_validate_payload(kind,b);
      if b->>'id' is distinct from a->>'id' or b->>'user_id' is distinct from p_user::text then raise exception 'Invalid before state.' using errcode='23514'; end if;
    end if;
    if kind='capture' then select payload into saved from public.captures where user_id=p_user and id=record_id;
    else select payload into saved from public.tasks where user_id=p_user and id=record_id; end if;
    if saved is distinct from b then raise exception 'Before state changed.' using errcode='40001'; end if;
    if b is null then
      if p_operation not in ('capture.create','task.create','capture.convert') or (p_operation='capture.convert' and kind<>'task')
        or a->>'client_id' is distinct from r->>'client_id' then raise exception 'Unexpected insertion.' using errcode='23514'; end if;
      if exists(select 1 from public.captures where id=record_id) or exists(select 1 from public.tasks where id=record_id)
        or exists(select 1 from public.categories where id=record_id) or exists(select 1 from public.projects where id=record_id)
        or exists(select 1 from public.domain_events where id=record_id) then raise exception 'Identifier already used.' using errcode='23505'; end if;
      if kind='capture' and (a->>'status' not in ('draft','inbox') or a->'converted_task_id'<>'null'::jsonb) then raise exception 'Invalid initial capture state.' using errcode='23514'; end if;
      if kind='task' and p_operation='task.create' and a->'origin_capture_id'<>'null'::jsonb then raise exception 'Task origin requires conversion.' using errcode='23514'; end if;
    elsif p_operation in ('capture.create','task.create') then raise exception 'Create cannot replace records.' using errcode='23514'; end if;
    if kind='capture' and a->>'status'='organized' and a->'converted_task_id'='null'::jsonb then raise exception 'Knowledge promotion requires T021.' using errcode='23514'; end if;
    if (b is null or a->'project_id' is distinct from b->'project_id') and a->'project_id'<>'null'::jsonb
      and not exists(select 1 from public.projects where user_id=p_user and id=(a->>'project_id')::uuid and deleted_at is null) then
      raise exception 'Project unavailable.' using errcode='23503'; end if;
    if kind='capture' then
      for link_id in select value from jsonb_array_elements_text(coalesce(a->'linked_capture_ids','[]'::jsonb)) loop
        if not coalesce(b->'linked_capture_ids','[]'::jsonb) ? link_id and not exists(select 1 from public.captures where user_id=p_user and id=link_id::uuid and deleted_at is null) then
          raise exception 'New capture link is unavailable.' using errcode='23503'; end if;
      end loop;
    end if;
    select count(*) into n from jsonb_array_elements(p_request->'events') ev
      where ev->>'entity_type'=kind and ev->>'entity_id'=a->>'id' and ev->'before' is not distinct from coalesce(b,'null'::jsonb) and ev->'after'=a;
    if n<>1 then raise exception 'Missing or duplicate matching event.' using errcode='23514'; end if;
    if kind='capture' then
      if b is null then insert into public.captures(payload) values(a); else update public.captures set payload=a where user_id=p_user and id=record_id; end if;
    else
      if b is null then insert into public.tasks(payload) values(a); else update public.tasks set payload=a where user_id=p_user and id=record_id; end if;
    end if;
  end loop;
  perform app_private.capture_task_integrity(p_user);
  for e in select value from jsonb_array_elements(p_request->'events') loop
    if e->>'user_id' is distinct from p_user::text or e->>'canal' is distinct from p_request#>>'{context,canal}' then raise exception 'Event outside actor/channel.' using errcode='23514'; end if;
    record_id:=(e->>'id')::uuid;
    if exists(select 1 from public.captures where id=record_id) or exists(select 1 from public.tasks where id=record_id)
      or exists(select 1 from public.categories where id=record_id) or exists(select 1 from public.projects where id=record_id) then raise exception 'Event identifier already used.' using errcode='23505'; end if;
    insert into public.domain_events(id,user_id,entity_type,entity_id,action,canal,occurred_at,before,after,capture_task_payload)
      values(record_id,p_user,e->>'entity_type',(e->>'entity_id')::uuid,e->>'action',e->>'canal',app_private.capture_task_timestamp(e->'occurred_at'),nullif(e->'before','null'::jsonb),nullif(e->'after','null'::jsonb),e);
  end loop;
  result:=r->'result';
  if p_operation='capture.convert' then
    if jsonb_typeof(result) is distinct from 'object' or not result ?& array['captura','tarefa'] or result-array['captura','tarefa']<>'{}'::jsonb
      or result#>>'{captura,id}' is distinct from input->>'capture_id'
      or not exists(select 1 from public.captures where user_id=p_user and payload=result->'captura' and converted_task_id=(result#>>'{tarefa,id}')::uuid)
      or not exists(select 1 from public.tasks where user_id=p_user and payload=result->'tarefa' and origin_capture_id=(input->>'capture_id')::uuid) then
      raise exception 'Conversion result differs from persisted records.' using errcode='23514'; end if;
  else
    if p_operation not in ('capture.create','task.create') and result->>'id' is distinct from input->>'id' then raise exception 'Result outside requested record.' using errcode='23514'; end if;
    if p_operation like 'capture.%' then
      if not exists(select 1 from public.captures where user_id=p_user and payload=result) then raise exception 'Result differs from capture.' using errcode='23514'; end if;
    else
      if not exists(select 1 from public.tasks where user_id=p_user and payload=result) then raise exception 'Result differs from task.' using errcode='23514'; end if;
    end if;
  end if;
  insert into app_private.command_receipts(user_id,command,client_id,request,result)
    values(p_user,p_operation,r->>'client_id',to_jsonb(r->>'fingerprint'),result);
  -- Fail rather than commit data that the complete-snapshot adapter cannot read.
  perform app_private.capture_task_snapshot(p_user,p_session,p_operation);
  return jsonb_build_object('status','committed','result',result);
exception when invalid_text_representation or numeric_value_out_of_range then
  raise exception 'Invalid typed command field.' using errcode='22023';
end $$;

create function public.capture_task_snapshot(p_user uuid,p_session uuid,p_operation text) returns jsonb
language sql security invoker set search_path='' as $$ select app_private.capture_task_snapshot(p_user,p_session,p_operation); $$;
create function public.capture_task_revision(p_user uuid,p_session uuid,p_operation text) returns text
language sql security invoker set search_path='' as $$ select app_private.capture_task_revision(p_user,p_session,p_operation); $$;
create function public.capture_task_receipt(p_user uuid,p_session uuid,p_operation text,p_command text,p_client_id text) returns jsonb
language sql security invoker set search_path='' as $$ select app_private.capture_task_receipt(p_user,p_session,p_operation,p_command,p_client_id); $$;
create function public.capture_task_commit(p_user uuid,p_session uuid,p_operation text,p_request jsonb) returns jsonb
language sql security invoker set search_path='' as $$ select app_private.capture_task_commit(p_user,p_session,p_operation,p_request); $$;

do $$ declare t text; gate text; fn record; begin
  foreach t in array array['captures','tasks','categories','projects','capture_links'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
    gate:=case t when 'captures' then '(select app_private.has_feature(''capturar''))'
      when 'tasks' then '(select app_private.has_feature(''tarefas''))'
      when 'projects' then '(select app_private.has_feature(''projetos''))'
      when 'capture_links' then '(select app_private.has_feature(''capturar''))'
      else '((select app_private.has_feature(''capturar'')) or (select app_private.has_feature(''tarefas'')))' end;
    execute format('create policy own_read on public.%I for select to authenticated using ((select auth.uid())=user_id and %s)',t,gate);
    execute format('grant select on public.%I to authenticated',t);
  end loop;
  for fn in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','app_private') and p.proname like 'capture_task_%' loop
    execute format('revoke all on function %s from public,anon,authenticated,service_role',fn.signature);
  end loop;
end $$;
alter table app_private.capture_task_revisions enable row level security;
revoke all on app_private.capture_task_revisions from public,anon,authenticated,service_role;
-- Event SELECT cannot leak capture/task content after that feature is vetoed.
drop policy own_read on public.domain_events;
create policy own_read on public.domain_events for select to authenticated using (
  (select auth.uid())=user_id and (select app_private.current_user_active())
  and case entity_type when 'capture' then (select app_private.has_feature('capturar')) when 'task' then (select app_private.has_feature('tarefas')) else true end
);
grant execute on function public.capture_task_snapshot(uuid,uuid,text),public.capture_task_revision(uuid,uuid,text),
  public.capture_task_receipt(uuid,uuid,text,text,text),public.capture_task_commit(uuid,uuid,text,jsonb),
  app_private.capture_task_snapshot(uuid,uuid,text),app_private.capture_task_revision(uuid,uuid,text),
  app_private.capture_task_receipt(uuid,uuid,text,text,text),app_private.capture_task_commit(uuid,uuid,text,jsonb) to service_role;
comment on table public.captures is 'T015 domain JSON preserved verbatim; relational columns are derived/validated by trigger. No direct application DML or uploads yet.';
comment on table public.tasks is 'T015 tasks; capture conversion and original timestamp strings are preserved. Physical removal only via privileged lifecycle.';
comment on table public.categories is 'Organization reader only in T015. No seed or create/update RPC until its own domain commands exist.';
comment on table public.projects is 'Organization reader only; deleted_at preserves historical references. No seed or mutating API in T015.';
comment on table app_private.capture_task_revisions is 'Per-user CAS covers all capture/task/reference/event/receipt writes. Owner operations must use the same lock ordering.';
comment on function public.capture_task_snapshot(uuid,uuid,text) is 'Service-only complete internal snapshot; never return whole payload to a browser. Apply current entitlement to every presentation DTO.';
comment on function public.capture_task_commit(uuid,uuid,text,jsonb) is 'Service-only server-computed batch. Auth/session/entitlement, receipt before CAS, 30 accepted writes/min, data+events+receipt atomic. Not a public client API.';
commit;
