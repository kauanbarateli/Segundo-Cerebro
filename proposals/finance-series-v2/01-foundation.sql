-- INERT proposal. Root reviews/composes a NEW migration; never reapply001–025.
do $draft_only$ begin raise exception 'DRAFT_ONLY: Finance series v2 requires Core/channel/UI, pins and supervised promotion.';end $draft_only$;
begin;
set local lock_timeout='5s';set local statement_timeout='60s';

create function app_private.fsv2_object(p jsonb,required text[],optional text[] default '{}') returns void
language plpgsql immutable set search_path='' as $$ begin
 if jsonb_typeof(p) is distinct from 'object' or not p ?& required or p-(required||optional)<>'{}'::jsonb then raise exception 'Invalid series object.' using errcode='22023';end if;
end $$;
create function app_private.fsv2_uuid(p jsonb) returns uuid language plpgsql immutable set search_path='' as $$ begin
 if jsonb_typeof(p) is distinct from 'string' or p#>>'{}' !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' then raise exception 'Invalid series UUID.' using errcode='22023';end if;return (p#>>'{}')::uuid;
end $$;
create function app_private.fsv2_revision(p jsonb) returns bigint language plpgsql immutable set search_path='' as $$ begin
 if jsonb_typeof(p) is distinct from 'string' or p#>>'{}' !~ '^(0|[1-9][0-9]{0,18})$' or (p#>>'{}')::numeric>9223372036854775807 then raise exception 'Invalid series revision.' using errcode='22023';end if;return (p#>>'{}')::bigint;
end $$;
create function app_private.fsv2_day(p text) returns date language plpgsql immutable set search_path='' as $$ declare d date;begin
 d:=app_private.finance_date(p);if d is null or d<'0001-01-01'::date or d>'9999-12-31'::date then raise exception 'Invalid series day.' using errcode='22023';end if;return d;
end $$;
create function app_private.fsv2_trim(p text) returns text language sql immutable set search_path='' as $$
 select btrim(p,chr(9)||chr(10)||chr(11)||chr(12)||chr(13)||chr(32)||chr(160)||chr(5760)||chr(8192)||chr(8193)||chr(8194)||chr(8195)||chr(8196)||chr(8197)||chr(8198)||chr(8199)||chr(8200)||chr(8201)||chr(8202)||chr(8232)||chr(8233)||chr(8239)||chr(8287)||chr(12288)||chr(65279));
$$;
create function app_private.fsv2_text_length(p text) returns integer language sql immutable set search_path='' as $$
 -- JavaScript string.length counts supplementary Unicode as TWO UTF-16 units.
 -- Counting PostgreSQL codepoints alone would accept values Core cannot read.
 select coalesce(sum(case when ascii(ch)>65535 then 2 else 1 end),0)::integer from regexp_split_to_table(p,'') ch;
$$;
create function app_private.fsv2_text(p jsonb,maximum integer,nullable boolean default false) returns void language plpgsql immutable set search_path='' as $$ begin
 if nullable and p='null'::jsonb then return;end if;
 if jsonb_typeof(p) is distinct from 'string' or app_private.fsv2_text_length(p#>>'{}')>maximum or not nullable and char_length(app_private.fsv2_trim(p#>>'{}'))=0 then raise exception 'Invalid series text.' using errcode='22023';end if;
end $$;
create function app_private.fsv2_int(p jsonb,minimum bigint,maximum bigint) returns bigint language plpgsql immutable set search_path='' as $$ declare n bigint;begin
 n:=app_private.finance_cents(p);if n<minimum or n>maximum then raise exception 'Invalid series integer.' using errcode='22023';end if;return n;
end $$;
create function app_private.fsv2_months(p date,n integer) returns date language plpgsql immutable set search_path='' as $$ declare serial integer;y integer;m integer;last_day integer;begin
 serial:=(extract(year from p)::integer-1)*12+extract(month from p)::integer-1+n;y:=serial/12+1;m:=serial%12+1;
 if y not between 1 and 9999 or m not between 1 and 12 then raise exception 'Series date overflow.' using errcode='22023';end if;
 last_day:=case m when 2 then (case when y%400=0 or y%4=0 and y%100<>0 then 29 else 28 end) when 4 then 30 when 6 then 30 when 9 then 30 when 11 then 30 else 31 end;
 return make_date(y,m,least(extract(day from p)::integer,last_day));
end $$;
create function app_private.fsv2_day_at(s jsonb,ordinal integer) returns date language plpgsql immutable set search_path='' as $$ declare anchor date;offset_n integer;d date;begin
 anchor:=app_private.fsv2_day(s->>'anchor_on');offset_n:=ordinal-(s->>'first_index')::integer;
 if offset_n<0 or ordinal>(s->>'total')::integer then raise exception 'Series ordinal outside definition.' using errcode='22023';end if;
 d:=case s->>'frequency' when 'weekly' then anchor+7*offset_n when 'monthly' then app_private.fsv2_months(anchor,offset_n) when 'yearly' then app_private.fsv2_months(anchor,offset_n*12) end;
 return app_private.fsv2_day(to_char(d,'YYYY-MM-DD'));
end $$;
create function app_private.fsv2_template(p jsonb) returns void language plpgsql immutable set search_path='' as $$ declare tag jsonb;begin
 perform app_private.fsv2_object(p,array['account_id','category_id','kind','amount_cents','description','payee','notes','tag_ids','statement_mode']);
 perform app_private.fsv2_uuid(p->'account_id');if p->'category_id'<>'null'::jsonb then perform app_private.fsv2_uuid(p->'category_id');end if;
 if jsonb_typeof(p->'kind') is distinct from 'string' or p->>'kind' not in ('income','expense') or jsonb_typeof(p->'statement_mode') is distinct from 'string' or p->>'statement_mode' not in ('none','account_cycle','explicit') then raise exception 'Invalid series template enum.' using errcode='22023';end if;
 perform app_private.fsv2_int(p->'amount_cents',1,9007199254740991);perform app_private.fsv2_text(p->'description',200);perform app_private.fsv2_text(p->'payee',200,true);perform app_private.fsv2_text(p->'notes',4000,true);
 if jsonb_typeof(p->'tag_ids') is distinct from 'array' or jsonb_array_length(p->'tag_ids')>30 or exists(select 1 from jsonb_array_elements(p->'tag_ids') t group by t having count(*)>1) then raise exception 'Invalid series tags.' using errcode='22023';end if;
 for tag in select value from jsonb_array_elements(p->'tag_ids') loop perform app_private.fsv2_uuid(tag);end loop;
end $$;
create function app_private.fsv2_definition(p jsonb) returns void language plpgsql immutable set search_path='' as $$ declare first_n integer;total_n integer;d date;idx integer;begin
 perform app_private.fsv2_object(p,array['kind','frequency','anchor_on','first_index','total','ends_on','template']);
 first_n:=app_private.fsv2_int(p->'first_index',1,120);total_n:=app_private.fsv2_int(p->'total',2,120);
 if first_n>total_n or jsonb_typeof(p->'kind') is distinct from 'string' or p->>'kind' not in ('recorrencia','parcelamento') or jsonb_typeof(p->'frequency') is distinct from 'string' or p->>'frequency' not in ('weekly','monthly','yearly') then raise exception 'Invalid series definition.' using errcode='22023';end if;
 perform app_private.fsv2_day(p->>'anchor_on');perform app_private.fsv2_template(p->'template');
 if p->>'kind'='parcelamento' and (p#>>'{template,amount_cents}')::bigint<total_n then raise exception 'Installment total too small.' using errcode='22023';end if;
 if p->'ends_on'<>'null'::jsonb and app_private.fsv2_day(p->>'ends_on')<app_private.fsv2_day(p->>'anchor_on') then raise exception 'End precedes anchor.' using errcode='22023';end if;
 for idx in first_n..total_n loop d:=app_private.fsv2_day_at(p,idx);exit when p->'ends_on'<>'null'::jsonb and d>app_private.fsv2_day(p->>'ends_on');end loop;
end $$;
create function app_private.fsv2_series(p jsonb) returns void language plpgsql immutable set search_path='' as $$ begin
 perform app_private.fsv2_object(p,array['version','id','user_id','kind','frequency','anchor_on','first_index','total','ends_on','template','state','revision','next_index','materialized_through','created_at','updated_at']);
 if p->'version' is distinct from '2'::jsonb or jsonb_typeof(p->'state') is distinct from 'string' or p->>'state' not in ('active','paused','ended') then raise exception 'Invalid series version/state.' using errcode='22023';end if;
 perform app_private.fsv2_uuid(p->'id');perform app_private.fsv2_uuid(p->'user_id');perform app_private.fsv2_revision(p->'revision');
 perform app_private.fsv2_definition(p-array['version','id','user_id','state','revision','next_index','materialized_through','created_at','updated_at']);
 perform app_private.fsv2_int(p->'next_index',(p->>'first_index')::integer,(p->>'total')::integer+1);
 if p->'materialized_through'<>'null'::jsonb and app_private.fsv2_day(p->>'materialized_through')<app_private.fsv2_day(p->>'anchor_on') then raise exception 'Invalid materialized date.' using errcode='22023';end if;
 perform app_private.capture_task_timestamp(p->'created_at');perform app_private.capture_task_timestamp(p->'updated_at');
end $$;
create function app_private.fsv2_occurrence(p jsonb) returns void language plpgsql immutable set search_path='' as $$ begin
 perform app_private.fsv2_object(p,array['id','user_id','series_id','index','transaction_id','occurred_on','suppression','configuration_revision','created_at','updated_at']);
 perform app_private.fsv2_uuid(p->'id');perform app_private.fsv2_uuid(p->'user_id');perform app_private.fsv2_uuid(p->'series_id');perform app_private.fsv2_uuid(p->'transaction_id');
 perform app_private.fsv2_int(p->'index',1,120);perform app_private.fsv2_revision(p->'configuration_revision');perform app_private.fsv2_day(p->>'occurred_on');
 if jsonb_typeof(p->'suppression') is distinct from 'string' or p->>'suppression' not in ('none','series_pause','manual','ended') then raise exception 'Invalid suppression.' using errcode='22023';end if;
 perform app_private.capture_task_timestamp(p->'created_at');perform app_private.capture_task_timestamp(p->'updated_at');
end $$;
create function app_private.fsv2_horizon(p jsonb) returns void language plpgsql immutable set search_path='' as $$ begin
 perform app_private.fsv2_object(p,array['from_on','until_exclusive']);
 if app_private.fsv2_day(p->>'until_exclusive')<=app_private.fsv2_day(p->>'from_on') then raise exception 'Invalid finite horizon.' using errcode='22023';end if;
 if extract(year from app_private.fsv2_day(p->>'from_on'))<9999 and app_private.fsv2_day(p->>'until_exclusive')>app_private.fsv2_months(app_private.fsv2_day(p->>'from_on'),12) then raise exception 'Invalid finite horizon.' using errcode='22023';end if;
end $$;
create function app_private.fsv2_assignments(p jsonb) returns void language plpgsql immutable set search_path='' as $$ declare row jsonb;d date;begin
 if jsonb_typeof(p) is distinct from 'array' or jsonb_array_length(p)>53 then raise exception 'Invalid statement assignments.' using errcode='22023';end if;
 if exists(select 1 from jsonb_array_elements(p) a group by a->>'index' having count(*)>1) then raise exception 'Repeated statement ordinal.' using errcode='22023';end if;
 for row in select value from jsonb_array_elements(p) loop perform app_private.fsv2_object(row,array['index','statement_month']);perform app_private.fsv2_int(row->'index',1,120);d:=app_private.fsv2_day(row->>'statement_month');if extract(day from d)<>1 then raise exception 'Statement month required.' using errcode='22023';end if;end loop;
end $$;
create function app_private.fsv2_command(request jsonb) returns jsonb language plpgsql immutable set search_path='' as $$ declare input jsonb;cmd text;common text[]:=array['client_id','expected_finance_revision','series_id','expected_revision'];begin
 perform app_private.fsv2_object(request,array['command','input']);input:=request->'input';cmd:=request->>'command';
 perform app_private.fsv2_uuid(input->'client_id');perform app_private.fsv2_revision(input->'expected_finance_revision');
 if cmd='finance.recurring.create' then
  perform app_private.fsv2_object(input,array['client_id','expected_finance_revision','definition','horizon','statement_assignments']);perform app_private.fsv2_definition(input->'definition');perform app_private.fsv2_horizon(input->'horizon');perform app_private.fsv2_assignments(input->'statement_assignments');
 else
  perform app_private.fsv2_uuid(input->'series_id');perform app_private.fsv2_revision(input->'expected_revision');
  if cmd in ('finance.recurring.materialize','finance.recurring.resume') then perform app_private.fsv2_object(input,common||array['horizon','statement_assignments']);perform app_private.fsv2_horizon(input->'horizon');perform app_private.fsv2_assignments(input->'statement_assignments');
  elsif cmd in ('finance.recurring.pause','finance.recurring.end') then perform app_private.fsv2_object(input,common||array['from_on']);perform app_private.fsv2_day(input->>'from_on');
  elsif cmd='finance.recurring.update_future' then
   perform app_private.fsv2_object(input,common||array['from_on','patch','statement_assignments']);perform app_private.fsv2_day(input->>'from_on');perform app_private.fsv2_object(input->'patch','{}',array['template','ends_on']);
   if input->'patch'='{}'::jsonb then raise exception 'Empty future patch.' using errcode='22023';end if;
   if (input->'patch') ? 'template' then perform app_private.fsv2_template(input#>'{patch,template}');end if;
   if (input->'patch') ? 'ends_on' and input#>'{patch,ends_on}'<>'null'::jsonb then perform app_private.fsv2_day(input#>>'{patch,ends_on}');end if;perform app_private.fsv2_assignments(input->'statement_assignments');
  elsif cmd='finance.recurring.occurrence.cancel' then perform app_private.fsv2_object(input,common||array['occurrence_id']);perform app_private.fsv2_uuid(input->'occurrence_id');
  elsif cmd='finance.recurring.occurrence.update' then
   perform app_private.fsv2_object(input,common||array['occurrence_id','patch']);perform app_private.fsv2_uuid(input->'occurrence_id');perform app_private.fsv2_object(input->'patch',array['status','paid_cents']);
   if jsonb_typeof(input#>'{patch,status}') is distinct from 'string' or input#>>'{patch,status}' not in ('confirmed','reconciled') then raise exception 'Invalid realization status.' using errcode='22023';end if;perform app_private.fsv2_int(input#>'{patch,paid_cents}',0,9007199254740991);
  else raise exception 'Unknown series command.' using errcode='22023';end if;
 end if;return input;
end $$;

create table app_private.finance_series (
 id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,payload jsonb not null,
 state text not null check(state in ('active','paused','ended')),revision bigint not null check(revision>=0),
 unique(user_id,id)
);
create table app_private.finance_series_occurrences (
 id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,series_id uuid not null,ordinal smallint not null check(ordinal between 1 and 120),transaction_id uuid not null,occurred_on date not null,
 suppression text not null check(suppression in ('none','series_pause','manual','ended')),payload jsonb not null,
 unique(user_id,id),unique(user_id,series_id,ordinal),unique(user_id,transaction_id),
 foreign key(user_id,series_id) references app_private.finance_series(user_id,id) on delete cascade deferrable initially deferred,
 foreign key(user_id,transaction_id) references public.fin_transactions(user_id,id) on delete cascade deferrable initially deferred
);
create index finance_series_owner_page on app_private.finance_series(user_id,id);
create index finance_series_map_order on app_private.finance_series_occurrences(user_id,series_id,ordinal);
-- The ledger id is globally unique already. The guard must detect a mapped id
-- even in a forged foreign-owner request without scanning every user's maps.
create unique index finance_series_transaction_guard on app_private.finance_series_occurrences(transaction_id);
create table app_private.finance_series_permits (
 row_id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,series_id uuid not null,command text not null,client_id uuid not null,
 before_hash text not null check(before_hash~'^[a-f0-9]{64}$'),after_hash text not null check(after_hash~'^[a-f0-9]{64}$'),backend_pid integer not null,xact_id xid8 not null,
 foreign key(user_id,series_id) references app_private.finance_series(user_id,id) on delete cascade deferrable initially deferred
);
create function app_private.fsv2_project() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if tg_table_name='finance_series' then
  perform app_private.fsv2_series(new.payload);new.id:=app_private.fsv2_uuid(new.payload->'id');new.user_id:=app_private.fsv2_uuid(new.payload->'user_id');new.state:=new.payload->>'state';new.revision:=app_private.fsv2_revision(new.payload->'revision');
  if tg_op='UPDATE' and (new.id<>old.id or new.user_id<>old.user_id or (new.payload-array['template','state','revision','next_index','materialized_through','ends_on','updated_at']) is distinct from (old.payload-array['template','state','revision','next_index','materialized_through','ends_on','updated_at'])) then raise exception 'Immutable series identity/anchor changed.' using errcode='23514';end if;
 else
  perform app_private.fsv2_occurrence(new.payload);new.id:=app_private.fsv2_uuid(new.payload->'id');new.user_id:=app_private.fsv2_uuid(new.payload->'user_id');new.series_id:=app_private.fsv2_uuid(new.payload->'series_id');new.ordinal:=app_private.fsv2_int(new.payload->'index',1,120);new.transaction_id:=app_private.fsv2_uuid(new.payload->'transaction_id');new.occurred_on:=app_private.fsv2_day(new.payload->>'occurred_on');new.suppression:=new.payload->>'suppression';
  if tg_op='UPDATE' and (new.payload-array['suppression','configuration_revision','updated_at']) is distinct from (old.payload-array['suppression','configuration_revision','updated_at']) then raise exception 'Immutable occurrence identity changed.' using errcode='23514';end if;
 end if;return new;
end $$;
create trigger finance_series_project before insert or update on app_private.finance_series for each row execute function app_private.fsv2_project();
create trigger finance_series_project before insert or update on app_private.finance_series_occurrences for each row execute function app_private.fsv2_project();
create trigger finance_revision after insert or update or delete on app_private.finance_series for each row execute function app_private.finance_bump();
create trigger finance_revision after insert or update or delete on app_private.finance_series_occurrences for each row execute function app_private.finance_bump();

do $$ declare t text;expression text;begin
 foreach t in array array['finance_series','finance_series_occurrences','finance_series_permits'] loop execute format('alter table app_private.%I enable row level security',t);execute format('revoke all on app_private.%I from public,anon,authenticated,service_role',t);end loop;
 select pg_get_expr(conbin,conrelid) into strict expression from pg_constraint where conrelid='public.domain_events'::regclass and conname='domain_events_entity_type_check';
 alter table public.domain_events drop constraint domain_events_entity_type_check;
 execute format('alter table public.domain_events add constraint domain_events_entity_type_check check ((%s) or entity_type in (''finance_series'',''finance_series_occurrence''))',expression);
end $$;
-- Helpers are private, including validation functions created before the tables.
do $$ declare f record;begin for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app_private' and p.proname like 'fsv2_%' loop execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);end loop;end $$;
rollback;
