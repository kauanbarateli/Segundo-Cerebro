-- INERT proposal. Root composes a NEW migration after peer/catalog/gates.
do $draft_only$ begin raise exception 'DRAFT_ONLY: Goals server persistence is not a migration or rollout.';end $draft_only$;
begin;
set local lock_timeout='5s';set local statement_timeout='60s';
create function app_private.fg_object(p jsonb,required text[],optional text[] default '{}') returns void language plpgsql immutable set search_path='' as $$ begin
 if jsonb_typeof(p) is distinct from 'object' or not p ?& required or p-(required||optional)<>'{}'::jsonb then raise exception 'Invalid goal object.' using errcode='22023';end if;
end $$;
create function app_private.fg_uuid(p jsonb) returns uuid language plpgsql immutable set search_path='' as $$ begin
 if jsonb_typeof(p) is distinct from 'string' or p#>>'{}' !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' then raise exception 'Invalid goal UUID.' using errcode='22023';end if;return (p#>>'{}')::uuid;
end $$;
create function app_private.fg_revision(p jsonb) returns bigint language plpgsql immutable set search_path='' as $$ begin
 if jsonb_typeof(p) is distinct from 'string' or p#>>'{}' !~ '^(0|[1-9][0-9]{0,18})$' or (p#>>'{}')::numeric>9223372036854775807 then raise exception 'Invalid goal revision.' using errcode='22023';end if;return (p#>>'{}')::bigint;
end $$;
create function app_private.fg_cents(p numeric,minimum numeric default 0) returns bigint language plpgsql immutable set search_path='' as $$ begin
 if p is null or p<>trunc(p) or p<minimum or p>9007199254740991 or p< -9007199254740991 then raise exception 'Goal total exceeds safe integer.' using errcode='22023';end if;return p::bigint;
end $$;
create function app_private.fg_number(p jsonb,minimum numeric default 0) returns bigint language plpgsql immutable set search_path='' as $$ begin
 if jsonb_typeof(p) is distinct from 'number' then raise exception 'Goal numeric cents required.' using errcode='22023';end if;return app_private.fg_cents((p#>>'{}')::numeric,minimum);
end $$;
create function app_private.fg_day(p jsonb) returns date language plpgsql immutable set search_path='' as $$ declare d date;begin
 if jsonb_typeof(p) is distinct from 'string' then raise exception 'Goal civil date required.' using errcode='22023';end if;d:=app_private.finance_date(p#>>'{}');
 if d is null or d<'0001-01-01'::date or d>'9999-12-31'::date then raise exception 'Invalid goal date.' using errcode='22023';end if;return d;
end $$;
create function app_private.fg_trim(p text) returns text language sql immutable set search_path='' as $$
 select btrim(p,chr(9)||chr(10)||chr(11)||chr(12)||chr(13)||chr(32)||chr(160)||chr(5760)||chr(8192)||chr(8193)||chr(8194)||chr(8195)||chr(8196)||chr(8197)||chr(8198)||chr(8199)||chr(8200)||chr(8201)||chr(8202)||chr(8232)||chr(8233)||chr(8239)||chr(8287)||chr(12288)||chr(65279));
$$;
create function app_private.fg_name(p jsonb) returns text language plpgsql immutable set search_path='' as $$ declare n integer;begin
 if jsonb_typeof(p) is distinct from 'string' then raise exception 'Goal name required.' using errcode='22023';end if;
 select coalesce(sum(case when ascii(ch)>65535 then 2 else 1 end),0) into n from regexp_split_to_table(p#>>'{}','') ch;
 if n>160 or length(app_private.fg_trim(p#>>'{}'))=0 then raise exception 'Invalid goal name length.' using errcode='22023';end if;return app_private.fg_trim(p#>>'{}');
end $$;
create function app_private.fg_fields(p jsonb) returns void language plpgsql immutable set search_path='' as $$ begin
 if p ? 'name' then perform app_private.fg_name(p->'name');end if;
 if p ? 'target_cents' then perform app_private.fg_number(p->'target_cents',1);end if;
 if p ? 'deadline' and p->'deadline'<>'null'::jsonb then perform app_private.fg_day(p->'deadline');end if;
 if p ? 'image_file_id' and p->'image_file_id'<>'null'::jsonb then perform app_private.fg_uuid(p->'image_file_id');end if;
end $$;
create function app_private.fg_command(p jsonb) returns jsonb language plpgsql immutable set search_path='' as $$ declare input jsonb;op text;common text[]:=array['client_id','expected_finance_revision'];existing text[]:=common||array['goal_id','expected_revision'];begin
 perform app_private.fg_object(p,array['command','input']);op:=p->>'command';input:=p->'input';
 if op='finance.goal.create' then perform app_private.fg_object(input,common||array['name','target_cents','deadline','image_file_id']);perform app_private.fg_fields(input);
 elsif op='finance.goal.update' then perform app_private.fg_object(input,existing||array['patch']);perform app_private.fg_object(input->'patch','{}',array['name','target_cents','deadline','image_file_id']);if input->'patch'='{}'::jsonb then raise exception 'Empty goal patch.' using errcode='22023';end if;perform app_private.fg_fields(input->'patch');
 elsif op in ('finance.goal.archive','finance.goal.restore') then perform app_private.fg_object(input,existing);
 elsif op='finance.goal.highlight' then perform app_private.fg_object(input,common||array['goal_id','expected_highlight_revision']);if input->'goal_id'<>'null'::jsonb then perform app_private.fg_uuid(input->'goal_id');end if;perform app_private.fg_revision(input->'expected_highlight_revision');
 elsif op='finance.goal.contribute' then perform app_private.fg_object(input,existing||array['account_id','amount_cents','occurred_on']);perform app_private.fg_uuid(input->'account_id');perform app_private.fg_number(input->'amount_cents',1);perform app_private.fg_day(input->'occurred_on');
 elsif op='finance.goal.release' then perform app_private.fg_object(input,common||array['reservation_id','amount_cents','occurred_on']);perform app_private.fg_uuid(input->'reservation_id');perform app_private.fg_number(input->'amount_cents',1);perform app_private.fg_day(input->'occurred_on');
 else raise exception 'Unknown goal command.' using errcode='22023';end if;
 perform app_private.fg_uuid(input->'client_id');perform app_private.fg_revision(input->'expected_finance_revision');if input ? 'expected_revision' then perform app_private.fg_uuid(input->'goal_id');perform app_private.fg_revision(input->'expected_revision');end if;return input;
end $$;
create function app_private.fg_row(kind text,p jsonb) returns void language plpgsql immutable set search_path='' as $$ declare fields text[]:=array['version','id','user_id','created_at'];begin
 if kind='finance_goal' then perform app_private.fg_object(p,fields||array['name','target_cents','deadline','image_file_id','archived_at','revision','updated_at']);perform app_private.fg_fields(p);perform app_private.fg_revision(p->'revision');perform app_private.capture_task_timestamp(p->'updated_at');perform app_private.capture_task_timestamp(p->'archived_at',true);
 elsif kind='finance_goal_reservation' then perform app_private.fg_object(p,fields||array['goal_id','account_id','amount_cents','occurred_on','client_id']);perform app_private.fg_uuid(p->'goal_id');perform app_private.fg_uuid(p->'account_id');
 elsif kind='finance_goal_release' then perform app_private.fg_object(p,fields||array['reservation_id','amount_cents','occurred_on','client_id']);perform app_private.fg_uuid(p->'reservation_id');
 elsif kind='finance_goal_highlight' then perform app_private.fg_object(p,fields||array['goal_id','revision','updated_at']);if p->'goal_id'<>'null'::jsonb then perform app_private.fg_uuid(p->'goal_id');end if;perform app_private.fg_revision(p->'revision');perform app_private.capture_task_timestamp(p->'updated_at');if p->'id' is distinct from p->'user_id' then raise exception 'Highlight singleton owner mismatch.' using errcode='23514';end if;
 else raise exception 'Unknown goal record.' using errcode='22023';end if;
 if p->'version' is distinct from '1'::jsonb then raise exception 'Invalid goal version.' using errcode='22023';end if;perform app_private.fg_uuid(p->'id');perform app_private.fg_uuid(p->'user_id');perform app_private.capture_task_timestamp(p->'created_at');
 if kind in ('finance_goal_reservation','finance_goal_release') then perform app_private.fg_uuid(p->'client_id');perform app_private.fg_number(p->'amount_cents',1);perform app_private.fg_day(p->'occurred_on');end if;
end $$;

create table app_private.finance_goals(id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,payload jsonb not null,archived_at timestamptz,unique(user_id,id));
create table app_private.finance_goal_reservations(id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,goal_id uuid not null,account_id uuid not null,amount_cents bigint not null check(amount_cents between 1 and 9007199254740991),created_at timestamptz not null,payload jsonb not null,unique(user_id,id),
 foreign key(user_id,goal_id) references app_private.finance_goals(user_id,id) deferrable initially deferred,
 foreign key(user_id,account_id) references public.fin_accounts(user_id,id) deferrable initially deferred);
create table app_private.finance_goal_releases(id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,reservation_id uuid not null,amount_cents bigint not null check(amount_cents between 1 and 9007199254740991),created_at timestamptz not null,payload jsonb not null,unique(user_id,id),foreign key(user_id,reservation_id) references app_private.finance_goal_reservations(user_id,id) deferrable initially deferred);
create table app_private.finance_goal_highlights(id uuid primary key,user_id uuid not null unique references auth.users(id) on delete cascade,payload jsonb not null,check(id=user_id));
create index finance_goals_owner_page on app_private.finance_goals(user_id,id);
create index finance_goal_reservations_goal_page on app_private.finance_goal_reservations(user_id,goal_id,created_at,id);
create index finance_goal_reservations_account_total on app_private.finance_goal_reservations(user_id,account_id,id) include(amount_cents);
create index finance_goal_releases_total_page on app_private.finance_goal_releases(user_id,reservation_id,created_at,id) include(amount_cents);
create function app_private.fg_project() returns trigger language plpgsql security definer set search_path='' as $$ declare kind text;begin
 kind:=case tg_table_name when 'finance_goals' then 'finance_goal' when 'finance_goal_reservations' then 'finance_goal_reservation' when 'finance_goal_releases' then 'finance_goal_release' else 'finance_goal_highlight' end;
 if tg_op='DELETE' then if not exists(select 1 from auth.users where id=old.user_id) then return old;end if;raise exception 'Goal records are not deleted by domain commands.' using errcode='42501';end if;
 perform app_private.fg_row(kind,new.payload);new.id:=(new.payload->>'id')::uuid;new.user_id:=(new.payload->>'user_id')::uuid;
 perform app_private.capture_task_lock(new.user_id);
 if tg_op='UPDATE' then
  if kind in ('finance_goal_reservation','finance_goal_release') then raise exception 'Original goal allocations are insert only.' using errcode='42501';end if;
  if new.id<>old.id or new.user_id<>old.user_id or new.payload->'created_at' is distinct from old.payload->'created_at' then raise exception 'Goal owner/id/creation immutable.' using errcode='23514';end if;
 end if;
 if kind='finance_goal' then new.archived_at:=app_private.capture_task_timestamp(new.payload->'archived_at',true);
 elsif kind='finance_goal_reservation' then new.goal_id:=(new.payload->>'goal_id')::uuid;new.account_id:=(new.payload->>'account_id')::uuid;new.amount_cents:=app_private.fg_number(new.payload->'amount_cents',1);new.created_at:=app_private.capture_task_timestamp(new.payload->'created_at');
 elsif kind='finance_goal_release' then new.reservation_id:=(new.payload->>'reservation_id')::uuid;new.amount_cents:=app_private.fg_number(new.payload->'amount_cents',1);new.created_at:=app_private.capture_task_timestamp(new.payload->'created_at');end if;return new;
end $$;
do $tables$ declare t text;begin foreach t in array array['finance_goals','finance_goal_reservations','finance_goal_releases','finance_goal_highlights'] loop
 execute format('alter table app_private.%I enable row level security',t);execute format('revoke all on app_private.%I from public,anon,authenticated,service_role',t);
 execute format('create trigger goal_project before insert or update or delete on app_private.%I for each row execute function app_private.fg_project()',t);
 execute format('create trigger goal_finance_revision after insert or update or delete on app_private.%I for each row execute function app_private.finance_bump()',t);
end loop;end $tables$;
-- Preserve the complete existing event check; add ONLY these four new species.
do $event_types$ declare expression text;begin
 select pg_get_expr(conbin,conrelid) into strict expression from pg_constraint where conrelid='public.domain_events'::regclass and conname='domain_events_entity_type_check';
 alter table public.domain_events drop constraint domain_events_entity_type_check;
 execute format('alter table public.domain_events add constraint domain_events_entity_type_check check ((%s) or entity_type in (''finance_goal'',''finance_goal_reservation'',''finance_goal_release'',''finance_goal_highlight''))',expression);
end $event_types$;
-- Private functions have zero direct grants, including the service key role.
do $permissions$ declare f record;begin for f in select oid::regprocedure signature from pg_proc where pronamespace='app_private'::regnamespace and proname like 'fg\_%' escape '\' loop execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);end loop;end $permissions$;
rollback;
