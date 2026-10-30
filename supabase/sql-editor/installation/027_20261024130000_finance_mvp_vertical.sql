begin;
-- PROPOSAL ONLY / T-053 #78-A. Not a numbered migration or SQL Editor install.
-- Root must review/promote the exact body and assign an ID after onboarding026.
-- No build, deploy or CI may apply this file to a hosted database.
-- BEGIN PROPOSED MIGRATION BODY.
set local lock_timeout='5s';
set local statement_timeout='60s';

-- Preserve the reviewed effective financial commit, rather than transplanting an
-- older full definition. Any source drift aborts before replacement. CRLF/LF is
-- the sole normalization; the pin includes every existing guard and body byte.
do $patch$
declare body text; patched text; anchor text; replacement text;
begin
 if current_user<>'postgres' then raise exception 'T053_POSTGRES_REQUIRED'; end if;
 select replace(p.prosrc,E'\r\n',E'\n') into body from pg_proc p
 where p.oid=to_regprocedure('app_private.finance_commit(uuid,uuid,text,jsonb)')
 and p.prosecdef and p.provolatile='v' and p.proconfig @> array['search_path=""']
 and p.proowner=(select oid from pg_roles where rolname='postgres');
 if body is null or encode(sha256(convert_to(body,'UTF8')),'hex')<>'eac90c8853a494ff7c9ccfb5d7ac4663dfdede42733d0c5d3715019573cc245c' then
  raise exception 'T053_FINANCE_COMMIT_SOURCE_DIVERGED';
 end if;
 anchor:=$old$(p_operation not in ('finance.transfer.create','finance.statement.pay','finance.series.create','finance.series.stop') and n>1)$old$;
 if (length(body)-length(replace(body,anchor,'')))/length(anchor)<>1 then raise exception 'T053_BATCH_ANCHOR_DIVERGED'; end if;
 patched:=replace(body,anchor,$new$(p_operation not in ('finance.transfer.create','finance.statement.pay','finance.series.create','finance.series.stop','finance.budget.save') and n>1)$new$);
 anchor:=$old$ n:=jsonb_array_length(p_request->'changes');$old$;
 if (length(patched)-length(replace(patched,anchor,'')))/length(anchor)<>1 then raise exception 'T053_INSERT_ANCHOR_DIVERGED'; end if;
 replacement:=anchor||$guard$
 -- A budget batch is a closed repetition of one explicit intent, never a
 -- generic batch or twelve independent requests. Legacy omission still means1.
 if p_operation='finance.budget.save' then
  if jsonb_typeof(input) is distinct from 'object'
   or not input ?& array['client_id','category_id','month','limit_cents']
   or input-array['client_id','category_id','month','limit_cents','repeat_months']<>'{}'::jsonb
   or (input ? 'repeat_months' and (jsonb_typeof(input->'repeat_months') is distinct from 'number' or input->'repeat_months' not in ('1'::jsonb,'12'::jsonb)))
   or jsonb_typeof(input->'month') is distinct from 'string' or input->>'month' !~ '^[0-9]{4}-(0[1-9]|1[0-2])-01$'
   or app_private.finance_date(input->>'month')<'0001-01-01'::date
   or extract(year from (app_private.finance_date(input->>'month')+make_interval(months=>coalesce((input->>'repeat_months')::integer,1)-1)))>9999
   or app_private.finance_cents(input->'limit_cents')<1
   or n<>coalesce((input->>'repeat_months')::integer,1)
   or (input->'category_id'<>'null'::jsonb and (jsonb_typeof(input->'category_id') is distinct from 'string'
    or not exists(select 1 from public.fin_categories fc where fc.user_id=p_user and fc.id=(input->>'category_id')::uuid and fc.kind='expense')))
   or r#>>'{result,month}' is distinct from input->>'month'
   or r#>'{result,category_id}' is distinct from input->'category_id'
   or r#>'{result,limit_cents}' is distinct from input->'limit_cents' then
   raise exception 'T053_INVALID_BUDGET_REPEAT' using errcode='23514';
  end if;
  if exists(select 1 from jsonb_array_elements(p_request->'changes') bc
   where bc->>'type' is distinct from 'finance_budget'
   or bc#>'{after,category_id}' is distinct from input->'category_id'
   or bc#>'{after,limit_cents}' is distinct from input->'limit_cents'
   or (bc->'before' is distinct from 'null'::jsonb and (bc#>'{before,category_id}' is distinct from input->'category_id'
    or bc#>'{before,month}' is distinct from bc#>'{after,month}'))
   or jsonb_typeof(bc#>'{after,month}') is distinct from 'string'
   or bc#>>'{after,month}' !~ '^[0-9]{4}-(0[1-9]|1[0-2])-01$'
   or app_private.finance_date(bc#>>'{after,month}')<app_private.finance_date(input->>'month')
   or app_private.finance_date(bc#>>'{after,month}')>(app_private.finance_date(input->>'month')+make_interval(months=>coalesce((input->>'repeat_months')::integer,1)-1))::date)
   or exists(select 1 from jsonb_array_elements(p_request->'changes') bc group by bc#>>'{after,month}' having count(*)<>1) then
   raise exception 'T053_BUDGET_REPEAT_NOT_CONTIGUOUS' using errcode='23514';
  end if;
 end if;
$guard$;
 patched:=replace(patched,anchor,replacement);
 if patched=body then raise exception 'T053_PATCH_NO_EFFECT'; end if;
 execute format('create or replace function app_private.finance_commit(p_user uuid,p_session uuid,p_operation text,p_request jsonb) returns jsonb language plpgsql security definer set search_path=%L as %L','',patched);
end $patch$;
-- CREATE OR REPLACE preserves owner/ACL/signature. Do not grant new callers.
do $acl$
begin
 if has_function_privilege('anon','public.finance_commit(uuid,uuid,text,jsonb)','EXECUTE')
  or has_function_privilege('authenticated','public.finance_commit(uuid,uuid,text,jsonb)','EXECUTE')
  or not has_function_privilege('service_role','public.finance_commit(uuid,uuid,text,jsonb)','EXECUTE') then
  raise exception 'T053_FINANCE_COMMIT_ACL_DIVERGED';
 end if;
end $acl$;


-- INERT proposal. Root reviews/composes a NEW migration; never reapply001–025.
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


-- INERT companion. No hosted execution or activation from CI/build/deploy.
create function app_private.fsv2_guard(p_user uuid,p_session uuid) returns void language plpgsql security definer set search_path='' as $$ begin
 -- Existing order: Auth parent -> session -> SAME common advisory -> actor/feature.
 perform app_private.finance_guard(p_user,p_session,'read.finance');
end $$;
create function app_private.fsv2_finance_revision(p_user uuid) returns text language sql stable security definer set search_path='' as $$
 select coalesce((select revision::text from app_private.finance_revisions where user_id=p_user),'0');
$$;
create function app_private.fsv2_aggregate(p_user uuid,p_series uuid,p_requested_template jsonb default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s jsonb;maps jsonb;rows jsonb;accounts jsonb;categories jsonb;tags jsonb;result jsonb;account_ids uuid[];category_ids uuid[];tag_ids uuid[];begin
 select payload into s from app_private.finance_series where user_id=p_user and id=p_series;
 select coalesce(jsonb_agg(payload order by ordinal),'[]') into maps from app_private.finance_series_occurrences where user_id=p_user and series_id=p_series;
 if jsonb_array_length(maps)>120 or s is null and maps<>'[]'::jsonb then raise exception 'Invalid finite series map.' using errcode='23514';end if;
 select coalesce(jsonb_agg(t.payload order by m.ordinal),'[]') into rows from app_private.finance_series_occurrences m
 join public.fin_transactions t on t.user_id=m.user_id and t.id=m.transaction_id where m.user_id=p_user and m.series_id=p_series;
 if jsonb_array_length(rows)<>jsonb_array_length(maps) then raise exception 'Mapped ledger missing.' using errcode='23514';end if;
 -- EXACT union of historical row references + current and requested templates.
 select coalesce(array_agg(distinct id order by id),'{}') into account_ids from (
  select (r->>'account_id')::uuid id from jsonb_array_elements(rows) r
  union select (s#>>'{template,account_id}')::uuid where s is not null
  union select (p_requested_template->>'account_id')::uuid where p_requested_template is not null
 ) wanted where id is not null;
 select coalesce(array_agg(distinct id order by id),'{}') into category_ids from (
  select (r->>'category_id')::uuid id from jsonb_array_elements(rows) r
  union select (s#>>'{template,category_id}')::uuid where s is not null
  union select (p_requested_template->>'category_id')::uuid where p_requested_template is not null
 ) wanted where id is not null;
 select coalesce(array_agg(distinct id order by id),'{}') into tag_ids from (
  select (tag#>>'{}')::uuid id from jsonb_array_elements(rows) r cross join lateral jsonb_array_elements(coalesce(r->'tag_ids','[]')) tag
  union select (tag#>>'{}')::uuid from jsonb_array_elements(coalesce(s#>'{template,tag_ids}','[]')) tag
  union select (tag#>>'{}')::uuid from jsonb_array_elements(coalesce(p_requested_template->'tag_ids','[]')) tag
 ) wanted where id is not null;
 if cardinality(account_ids)>122 or cardinality(category_ids)>122 or cardinality(tag_ids)>3660 then raise exception 'Series references exceed finite bound.' using errcode='54000';end if;
 select coalesce(jsonb_agg(payload order by id),'[]') into accounts from public.fin_accounts where user_id=p_user and id=any(account_ids);
 select coalesce(jsonb_agg(payload order by id),'[]') into categories from public.fin_categories where user_id=p_user and id=any(category_ids);
 select coalesce(jsonb_agg(payload order by id),'[]') into tags from public.fin_tags where user_id=p_user and id=any(tag_ids);
 result:=jsonb_build_object('version',2,'finance_revision',app_private.fsv2_finance_revision(p_user),'series',case when s is null then '[]'::jsonb else jsonb_build_array(s) end,
  'occurrences',maps,'transactions',rows,'accounts',accounts,'categories',categories,'tags',tags);
 if octet_length(result::text)>4194304 then raise exception 'Complete series aggregate exceeds byte quota.' using errcode='54000';end if;return result;
end $$;
create function app_private.fsv2_saved_receipt(p_user uuid,p_command text,p_input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$ declare stored app_private.command_receipts;fp text;counts jsonb;v jsonb;begin
 select * into stored from app_private.command_receipts where user_id=p_user and command=p_command and client_id=p_input->>'client_id';
 if not found then return null;end if;
 fp:=stored.request#>>'{}';
 if fp is null or jsonb_typeof(stored.request)<>'string' then raise exception 'Corrupt series receipt.' using errcode='23514';end if;
 if fp::jsonb is distinct from p_input then raise exception 'Series client_id reused.' using errcode='23505';end if;
 perform app_private.fsv2_object(stored.result,array['version','series','affected']);
 if stored.result->'version' is distinct from '2'::jsonb then raise exception 'Corrupt result version.' using errcode='23514';end if;
 perform app_private.fsv2_series(stored.result->'series');
 if stored.result#>>'{series,user_id}' is distinct from p_user::text then raise exception 'Foreign series receipt.' using errcode='42501';end if;
 counts:=stored.result->'affected';perform app_private.fsv2_object(counts,array['created','updated','suppressed','restored','skipped']);
 for v in select value from jsonb_each(counts) loop perform app_private.fsv2_int(v,0,120);end loop;
 return jsonb_build_object('user_id',p_user,'command',p_command,'client_id',p_input->>'client_id','fingerprint',fp,'result',stored.result);
exception when invalid_text_representation then raise exception 'Invalid stored series receipt.' using errcode='23514';end $$;
create function app_private.fsv2_snapshot(p_user uuid,p_session uuid,p_request jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$ declare input jsonb;receipt jsonb;result jsonb;wanted jsonb;series_id uuid;begin
 perform app_private.fsv2_guard(p_user,p_session);
 if octet_length(p_request::text)>65536 then raise exception 'Series intent exceeds quota.' using errcode='54000';end if;
 input:=app_private.fsv2_command(p_request);receipt:=app_private.fsv2_saved_receipt(p_user,p_request->>'command',input);
 -- Receipt-first is AFTER authorization, BEFORE current refs/CAS. Never make a
 -- valid replay depend on a now-archived account/category/template.
 if receipt is not null then return jsonb_build_object('version',2,'finance_revision',app_private.fsv2_finance_revision(p_user),
  'series','[]'::jsonb,'occurrences','[]'::jsonb,'transactions','[]'::jsonb,'accounts','[]'::jsonb,'categories','[]'::jsonb,'tags','[]'::jsonb,'receipt',receipt);end if;
 if p_request->>'command'='finance.recurring.create' then wanted:=input#>'{definition,template}';series_id:=null;
 else series_id:=app_private.fsv2_uuid(input->'series_id');wanted:=case when p_request->>'command'='finance.recurring.update_future' then input#>'{patch,template}' else null end;end if;
 result:=app_private.fsv2_aggregate(p_user,series_id,wanted)||jsonb_build_object('receipt',null);
 if octet_length(result::text)>4194304 then raise exception 'Series snapshot exceeds quota.' using errcode='54000';end if;return result;
end $$;
create function app_private.fsv2_detail(p_user uuid,p_session uuid,p_series_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$ declare result jsonb;begin
 perform app_private.fsv2_guard(p_user,p_session);if p_series_id is null then raise exception 'Series identifier required.' using errcode='22023';end if;
 result:=app_private.fsv2_aggregate(p_user,p_series_id,null);if result->'series'='[]'::jsonb then return null;end if;
 if jsonb_array_length(result->'accounts')>121 or jsonb_array_length(result->'categories')>121 or jsonb_array_length(result->'tags')>3630 then raise exception 'Detail references exceed finite bound.' using errcode='54000';end if;
 return jsonb_set(result,'{series}',result->'series'->0);
end $$;
create function app_private.fsv2_page(p_user uuid,p_session uuid,p_cursor uuid,p_limit integer) returns jsonb
language plpgsql security definer set search_path='' as $$ declare items jsonb;begin
 perform app_private.fsv2_guard(p_user,p_session);if p_limit is null or p_limit not between 1 and 50 then raise exception 'Invalid series page limit.' using errcode='22023';end if;
 select coalesce(jsonb_agg(payload order by id),'[]') into items from (select id,payload from app_private.finance_series where user_id=p_user and (p_cursor is null or id>p_cursor) order by id limit p_limit+1) page;
 return jsonb_build_object('version',2,'finance_revision',app_private.fsv2_finance_revision(p_user),
  'items',case when jsonb_array_length(items)>p_limit then items-p_limit else items end,'next_cursor',case when jsonb_array_length(items)>p_limit then items->(p_limit-1)->>'id' else null end);
end $$;
create function public.finance_series_snapshot(p_user uuid,p_session uuid,p_request jsonb) returns jsonb language sql security invoker set search_path='' as $$select app_private.fsv2_snapshot(p_user,p_session,p_request);$$;
create function public.finance_series_detail(p_user uuid,p_session uuid,p_series_id uuid) returns jsonb language sql security invoker set search_path='' as $$select app_private.fsv2_detail(p_user,p_session,p_series_id);$$;
create function public.finance_series_page(p_user uuid,p_session uuid,p_cursor uuid,p_limit integer) returns jsonb language sql security invoker set search_path='' as $$select app_private.fsv2_page(p_user,p_session,p_cursor,p_limit);$$;
do $$ declare f record;begin
 for f in select p.oid::regprocedure signature,n.nspname,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app_private' and p.proname like 'fsv2_%' or n.nspname='public' and p.proname in ('finance_series_snapshot','finance_series_detail','finance_series_page') loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
  if f.proname in ('fsv2_snapshot','fsv2_detail','fsv2_page','finance_series_snapshot','finance_series_detail','finance_series_page') then execute format('grant execute on function %s to service_role',f.signature);end if;
 end loop;
end $$;


-- INERT independent effects oracle; no arbitrary batch validation by AFTER alone.
create function app_private.fsv2_normal_template(t jsonb) returns jsonb language sql immutable set search_path='' as $$
 select t||jsonb_build_object('description',app_private.fsv2_trim(t->>'description'),'payee',nullif(app_private.fsv2_trim(t->>'payee'),''),'notes',nullif(app_private.fsv2_trim(t->>'notes'),''));
$$;
create function app_private.fsv2_template_refs(p_user uuid,t jsonb) returns jsonb language plpgsql security definer set search_path='' as $$ declare account jsonb;begin
 select payload into account from public.fin_accounts where user_id=p_user and id=(t->>'account_id')::uuid;
 if account is null or account->'archived_at'<>'null'::jsonb or account->>'currency'<>'BRL' then raise exception 'Series account unavailable.' using errcode='23503';end if;
 if (account->>'kind'='credit_card') is distinct from (t->>'statement_mode'<>'none') then raise exception 'Statement mode outside account kind.' using errcode='23514';end if;
 if t->'category_id'<>'null'::jsonb and not exists(select 1 from public.fin_categories where user_id=p_user and id=(t->>'category_id')::uuid and kind=t->>'kind') then raise exception 'Series category unavailable.' using errcode='23503';end if;
 if exists(select 1 from jsonb_array_elements_text(t->'tag_ids') tag where not exists(select 1 from public.fin_tags where user_id=p_user and id=tag::uuid)) then raise exception 'Series tag unavailable.' using errcode='23503';end if;return account;
end $$;
create function app_private.fsv2_bound_map(s jsonb) returns void language plpgsql security definer set search_path='' as $$ declare m record;r jsonb;a jsonb;last_day date;seen integer:=0;begin
 for m in select * from app_private.finance_series_occurrences where user_id=(s->>'user_id')::uuid and series_id=(s->>'id')::uuid order by ordinal loop
  seen:=seen+1;if seen>120 then raise exception 'Series map exceeds bound.' using errcode='23514';end if;
  select payload into r from public.fin_transactions where user_id=m.user_id and id=m.transaction_id;select payload into a from public.fin_accounts where user_id=m.user_id and id=(r->>'account_id')::uuid;
  if r is null or a is null or r->>'user_id' is distinct from s->>'user_id' or r->>'installment_group_id' is distinct from s->>'id'
   or r->>'installment_no' is distinct from m.ordinal::text or r->'installment_total' is distinct from s->'total' or r->'serie_tipo' is distinct from s->'kind'
   or r->>'kind' is distinct from s#>>'{template,kind}' or r->'transfer_group_id'<>'null'::jsonb or r->>'occurred_on' is distinct from to_char(m.occurred_on,'YYYY-MM-DD')
   or m.occurred_on<>app_private.fsv2_day_at(s,m.ordinal) or (m.suppression='none') is distinct from (r->'deleted_at'='null'::jsonb)
   or m.ordinal>=(s->>'next_index')::integer or app_private.fsv2_revision(m.payload->'configuration_revision')>app_private.fsv2_revision(s->'revision') then raise exception 'Series/occurrence/ledger binding diverged.' using errcode='23514';end if;
  last_day:=greatest(last_day,m.occurred_on);
 end loop;
 if to_jsonb(to_char(last_day,'YYYY-MM-DD')) is distinct from nullif(s->'materialized_through','null'::jsonb) then raise exception 'Materialized cursor diverged.' using errcode='23514';end if;
end $$;
create function app_private.fsv2_eligible(s jsonb,m jsonb,r jsonb,a jsonb,action text,today date,boundary date) returns boolean language plpgsql immutable set search_path='' as $$ declare card_projection boolean;begin
 if boundary<today then raise exception 'Series boundary precedes today.' using errcode='23514';end if;
 if s->>'state'='ended' or action='pause' and s->>'state'<>'active' or action='resume' and s->>'state'<>'paused' or app_private.fsv2_day(r->>'occurred_on')<boundary
  or r->>'status' in ('confirmed','reconciled','cancelled') then return false;end if;
 card_projection:=a->>'kind'='credit_card' and r->>'kind'='expense' and r->>'status' in ('planned','pending') and r->'paid_cents'=r->'amount_cents';
 if (r->>'paid_cents')::bigint<>0 and not card_projection then return false;end if;
 if action='resume' then return m->>'suppression'='series_pause';end if;
 return m->>'suppression'='none' or m->>'suppression'='series_pause' and s->>'state'='paused' and action in ('update_future','end','cancel');
end $$;
create function app_private.fsv2_amount(s jsonb,idx integer) returns bigint language sql immutable set search_path='' as $$
 select case when s->>'kind'='parcelamento' then (case when idx=(s->>'total')::integer then (s#>>'{template,amount_cents}')::bigint-((s#>>'{template,amount_cents}')::bigint/(s->>'total')::integer)*((s->>'total')::integer-1) else (s#>>'{template,amount_cents}')::bigint/(s->>'total')::integer end) else (s#>>'{template,amount_cents}')::bigint end;
$$;
create function app_private.fsv2_statement(day date,closing_day integer) returns text language plpgsql immutable set search_path='' as $$ declare month date;last_n integer;begin
 if closing_day is null or closing_day not between 1 and 31 then raise exception 'Card closing day required.' using errcode='23514';end if;
 month:=make_date(extract(year from day)::integer,extract(month from day)::integer,1);
 last_n:=extract(day from (month+interval '1 month'-interval '1 day'))::integer;
 if extract(day from day)>=least(closing_day,last_n) then month:=app_private.fsv2_months(month,1);end if;return to_char(month,'YYYY-MM-DD');
end $$;
create function app_private.fsv2_change(changes jsonb,kind text,b jsonb,a jsonb) returns jsonb language sql immutable set search_path='' as $$
 select case when b is not distinct from a then changes else changes||jsonb_build_array(jsonb_build_object('type',kind,'before',b,'after',a)) end;
$$;

-- Builds the WHOLE expected effect set, including eligible rows a malicious
-- batch could omit. Only new UUID identities are borrowed from the submitted
-- map at an exact required ordinal; all other fields derive from intent/DB.
create function app_private.fsv2_expected(p_user uuid,operation text,input jsonb,submitted jsonb,submitted_result jsonb,at_text text,today date) returns jsonb
language plpgsql security definer set search_path='' as $$
<<effect_plan>>
declare before_s jsonb;s jsonb;t jsonb;current_t jsonb;account jsonb;old_account jsonb;row_b jsonb;row_a jsonb;map_b jsonb;map_a jsonb;
 expected jsonb:='[]';counts jsonb:=jsonb_build_object('created',0,'updated',0,'suppressed',0,'restored',0,'skipped',0);
 maps record;idx integer;next_idx integer;day date;boundary date;last_day date;end_day date;statement text;assignments jsonb;assignment jsonb;remaining jsonb:='[]';amount bigint;eligible boolean;
 series_id uuid;row_id uuid;map_id uuid;new_revision text;changed boolean:=false;will_touch boolean:=false;plan_new boolean:=false;restoring boolean:=false;template_changed boolean:=false;n integer;pick jsonb;
begin
 perform app_private.fsv2_object(submitted_result,array['version','series','affected']);if submitted_result->'version' is distinct from '2'::jsonb then raise exception 'Invalid series result version.' using errcode='23514';end if;
 perform app_private.fsv2_series(submitted_result->'series');series_id:=app_private.fsv2_uuid(submitted_result#>'{series,id}');
 if operation='finance.recurring.create' then
  if exists(select 1 from app_private.finance_series where id=series_id) or exists(select 1 from public.fin_transactions where installment_group_id=series_id) then raise exception 'New series identity already used.' using errcode='23505';end if;
  s:=input->'definition';s:=s||jsonb_build_object('template',app_private.fsv2_normal_template(s->'template'),'version',2,'id',series_id,'user_id',p_user,'state','active','revision','0','next_index',(s->>'first_index')::integer,'materialized_through',null,'created_at',at_text,'updated_at',at_text);
  before_s:=null;plan_new:=true;account:=app_private.fsv2_template_refs(p_user,s->'template');
 else
  if series_id<>app_private.fsv2_uuid(input->'series_id') then raise exception 'Result identifies another series.' using errcode='23514';end if;
  select payload into before_s from app_private.finance_series where user_id=p_user and id=series_id for update;
  if before_s is null then raise exception 'Series unavailable.' using errcode='23503';end if;
  if before_s->>'revision' is distinct from input->>'expected_revision' then raise exception 'Series revision changed.' using errcode='40001';end if;
  perform app_private.fsv2_bound_map(before_s);s:=before_s;
  if operation='finance.recurring.materialize' then
   if s->>'state'<>'active' then raise exception 'Series is not active.' using errcode='23514';end if;plan_new:=true;account:=app_private.fsv2_template_refs(p_user,s->'template');
  elsif operation='finance.recurring.resume' then
   if s->>'state'<>'paused' then raise exception 'Series is not paused.' using errcode='23514';end if;
   s:=s||jsonb_build_object('state','active');restoring:=true;plan_new:=true;account:=app_private.fsv2_template_refs(p_user,s->'template');
  elsif operation in ('finance.recurring.pause','finance.recurring.end') then
   if operation='finance.recurring.pause' and s->>'state'<>'active' or operation='finance.recurring.end' and s->>'state'='ended' then raise exception 'Series state refuses suppression.' using errcode='23514';end if;
   boundary:=app_private.fsv2_day(input->>'from_on');if boundary<today then raise exception 'Series boundary precedes today.' using errcode='23514';end if;
   s:=s||jsonb_build_object('state',case when operation='finance.recurring.pause' then 'paused' else 'ended' end);
  elsif operation='finance.recurring.update_future' then
   boundary:=app_private.fsv2_day(input->>'from_on');if s->>'state'='ended' or boundary<today then raise exception 'Future edit outside permitted state/day.' using errcode='23514';end if;
   t:=case when (input->'patch') ? 'template' then app_private.fsv2_normal_template(input#>'{patch,template}') else s->'template' end;
   if t->'kind' is distinct from s#>'{template,kind}' or s->>'kind'='parcelamento' and t->'amount_cents' is distinct from s#>'{template,amount_cents}' then raise exception 'Series kind/original installment total immutable.' using errcode='23514';end if;
   if (input->'patch') ? 'ends_on' then s:=jsonb_set(s,'{ends_on}',input#>'{patch,ends_on}');end if;
   if s->'ends_on'<>'null'::jsonb and app_private.fsv2_day(s->>'ends_on')<boundary then raise exception 'End precedes future-edit boundary.' using errcode='23514';end if;
   template_changed:=(input->'patch') ? 'template';s:=jsonb_set(s,'{template}',t);
   if template_changed then account:=app_private.fsv2_template_refs(p_user,t);end if;
   assignments:=input->'statement_assignments';
   if assignments<>'[]'::jsonb and (not template_changed or t->>'statement_mode'<>'explicit') then raise exception 'Assignments outside explicit template edit.' using errcode='23514';end if;
   remaining:=assignments;
  end if;
 end if;
 current_t:=s->'template';
 if restoring or operation in ('finance.recurring.pause','finance.recurring.end','finance.recurring.update_future','finance.recurring.occurrence.cancel','finance.recurring.occurrence.update') then
  if operation like 'finance.recurring.occurrence.%' and not exists(select 1 from app_private.finance_series_occurrences o where o.user_id=p_user and o.series_id=effect_plan.series_id and o.id=(input->>'occurrence_id')::uuid) then raise exception 'Occurrence unavailable.' using errcode='23503';end if;
  for maps in select o.payload from app_private.finance_series_occurrences o where o.user_id=p_user and o.series_id=effect_plan.series_id order by o.ordinal loop
   map_b:=maps.payload;select payload into row_b from public.fin_transactions where user_id=p_user and id=(map_b->>'transaction_id')::uuid;
   select payload into old_account from public.fin_accounts where user_id=p_user and id=(row_b->>'account_id')::uuid;
   row_a:=row_b;map_a:=map_b;
   if restoring then
    eligible:=app_private.fsv2_eligible(before_s,map_b,row_b,old_account,'resume',today,today);
    if eligible then
     if old_account->'archived_at'<>'null'::jsonb then raise exception 'Paused occurrence account archived.' using errcode='23503';end if;
     row_a:=row_b||jsonb_build_object('deleted_at',null,'updated_at',at_text);map_a:=map_b||jsonb_build_object('suppression','none','updated_at',at_text);
     counts:=jsonb_set(counts,'{restored}',to_jsonb((counts->>'restored')::integer+1));
    else counts:=jsonb_set(counts,'{skipped}',to_jsonb((counts->>'skipped')::integer+1));end if;
   elsif operation in ('finance.recurring.pause','finance.recurring.end') then
    eligible:=app_private.fsv2_eligible(before_s,map_b,row_b,old_account,case when operation='finance.recurring.pause' then 'pause' else 'end' end,today,boundary);
    if eligible then
     if row_b->'deleted_at'='null'::jsonb then row_a:=row_b||jsonb_build_object('deleted_at',at_text,'updated_at',at_text);counts:=jsonb_set(counts,'{suppressed}',to_jsonb((counts->>'suppressed')::integer+1));end if;
     map_a:=map_b||jsonb_build_object('suppression',case when operation='finance.recurring.pause' then 'series_pause' else 'ended' end,'updated_at',at_text);
    else counts:=jsonb_set(counts,'{skipped}',to_jsonb((counts->>'skipped')::integer+1));end if;
   elsif operation='finance.recurring.update_future' then
    eligible:=app_private.fsv2_eligible(before_s,map_b,row_b,old_account,'update_future',today,boundary);
    end_day:=case when s->'ends_on'<>'null'::jsonb then app_private.fsv2_day(s->>'ends_on') else null end;
    if end_day is not null and app_private.fsv2_day(row_b->>'occurred_on')>end_day and map_b->>'suppression'='none' and not eligible then raise exception 'End would remove protected history.' using errcode='23514';end if;
    if not eligible then counts:=jsonb_set(counts,'{skipped}',to_jsonb((counts->>'skipped')::integer+1));
    elsif end_day is not null and app_private.fsv2_day(row_b->>'occurred_on')>end_day then
     if row_b->'deleted_at'='null'::jsonb then row_a:=row_b||jsonb_build_object('deleted_at',at_text,'updated_at',at_text);counts:=jsonb_set(counts,'{suppressed}',to_jsonb((counts->>'suppressed')::integer+1));end if;
     map_a:=map_b||jsonb_build_object('suppression','ended','updated_at',at_text);
    elsif not template_changed then counts:=jsonb_set(counts,'{skipped}',to_jsonb((counts->>'skipped')::integer+1));
    else
     statement:=row_b->>'statement_month';assignment:=null;
     select value into assignment from jsonb_array_elements(remaining) a where a->'index'=map_b->'index';
     if account->>'kind'<>'credit_card' then statement:=null;
     elsif assignment is not null then statement:=assignment->>'statement_month';remaining:=coalesce((select jsonb_agg(value order by (value->>'index')::integer) from jsonb_array_elements(remaining) a where a->'index'<>map_b->'index'),'[]');
     elsif account->>'id' is distinct from row_b->>'account_id' then
      if current_t->>'statement_mode'<>'account_cycle' then raise exception 'Changed card requires explicit statement assignments.' using errcode='23514';end if;
      statement:=app_private.fsv2_statement(app_private.fsv2_day(row_b->>'occurred_on'),(account->>'statement_closing_day')::integer);
     end if;
     if account->>'kind'='credit_card' and statement is null then raise exception 'Card statement required.' using errcode='23514';end if;
     amount:=app_private.fsv2_amount(s,(map_b->>'index')::integer);
     row_a:=row_b||jsonb_build_object('account_id',current_t->'account_id','category_id',current_t->'category_id','description',current_t->'description','payee',current_t->'payee','notes',current_t->'notes','tag_ids',current_t->'tag_ids','amount_cents',amount,'paid_cents',case when account->>'kind'='credit_card' and current_t->>'kind'='expense' then amount else 0 end,'statement_month',statement);
     if row_a is distinct from row_b then
      row_a:=row_a||jsonb_build_object('updated_at',at_text);map_a:=map_b||jsonb_build_object('configuration_revision',(app_private.fsv2_revision(before_s->'revision')+1)::text,'updated_at',at_text);
      counts:=jsonb_set(counts,'{updated}',to_jsonb((counts->>'updated')::integer+1));
     end if;
    end if;
   elsif map_b->'id'=input->'occurrence_id' then
    if operation='finance.recurring.occurrence.cancel' then
     if map_b->>'suppression'='manual' then counts:=jsonb_set(counts,'{skipped}','1');
     else
      if not app_private.fsv2_eligible(before_s,map_b,row_b,old_account,'cancel',today,today) then raise exception 'Protected occurrence cannot be cancelled.' using errcode='23514';end if;
      if row_b->'deleted_at'='null'::jsonb then row_a:=row_b||jsonb_build_object('deleted_at',at_text,'updated_at',at_text);counts:=jsonb_set(counts,'{suppressed}','1');end if;
      map_a:=map_b||jsonb_build_object('suppression','manual','updated_at',at_text);
     end if;
    else
     if old_account->'archived_at'<>'null'::jsonb or map_b->>'suppression'<>'none' or row_b->'deleted_at'<>'null'::jsonb or row_b->>'status'='cancelled'
      or (input#>>'{patch,paid_cents}')::bigint<(row_b->>'paid_cents')::bigint or (input#>>'{patch,paid_cents}')::bigint>(row_b->>'amount_cents')::bigint
      or row_b->>'status'='reconciled' and input#>>'{patch,status}'<>'reconciled'
      or old_account->>'kind'='credit_card' and row_b->>'kind'='expense' and input#>'{patch,paid_cents}' is distinct from row_b->'amount_cents' then raise exception 'Realization changes protected payment.' using errcode='23514';end if;
     row_a:=row_b||(input->'patch');if row_a is distinct from row_b then row_a:=row_a||jsonb_build_object('updated_at',at_text);counts:=jsonb_set(counts,'{updated}','1');end if;
    end if;
   end if;
   expected:=app_private.fsv2_change(expected,'finance_transaction',row_b,row_a);expected:=app_private.fsv2_change(expected,'finance_series_occurrence',map_b,map_a);
  end loop;
  if operation='finance.recurring.update_future' and remaining<>'[]'::jsonb then raise exception 'Statement assignment targets protected/nonexistent occurrence.' using errcode='23514';end if;
 end if;
 if plan_new then
  if app_private.fsv2_day(input#>>'{horizon,from_on}')<today then raise exception 'Creation horizon precedes today.' using errcode='23514';end if;
  assignments:=input->'statement_assignments';remaining:=assignments;
  if current_t->>'statement_mode'<>'explicit' and remaining<>'[]'::jsonb then raise exception 'Assignments outside explicit statement mode.' using errcode='23514';end if;
  next_idx:=(s->>'next_index')::integer;last_day:=case when s->'materialized_through'<>'null'::jsonb then app_private.fsv2_day(s->>'materialized_through') else null end;
  while next_idx<=(s->>'total')::integer loop
   idx:=next_idx;day:=app_private.fsv2_day_at(s,idx);
   exit when s->'ends_on'<>'null'::jsonb and day>app_private.fsv2_day(s->>'ends_on');
   exit when day>=app_private.fsv2_day(input#>>'{horizon,until_exclusive}');
   next_idx:=idx+1;
   if day<app_private.fsv2_day(input#>>'{horizon,from_on}') then counts:=jsonb_set(counts,'{skipped}',to_jsonb((counts->>'skipped')::integer+1));continue;end if;
   select count(*),jsonb_agg(c->'after')->0 into n,pick from jsonb_array_elements(submitted) c where c->>'type'='finance_series_occurrence' and c#>'{after,index}'=to_jsonb(idx) and c#>>'{after,series_id}'=series_id::text;
   if n<>1 then raise exception 'Required finite occurrence omitted/repeated.' using errcode='23514';end if;
   map_id:=app_private.fsv2_uuid(pick->'id');row_id:=app_private.fsv2_uuid(pick->'transaction_id');statement:=null;
   if account->>'kind'='credit_card' then
    if current_t->>'statement_mode'='account_cycle' then statement:=app_private.fsv2_statement(day,(account->>'statement_closing_day')::integer);
    else
     select value into assignment from jsonb_array_elements(remaining) a where a->>'index'=idx::text;
     if assignment is null then raise exception 'Explicit card statement missing.' using errcode='23514';end if;statement:=assignment->>'statement_month';
     remaining:=coalesce((select jsonb_agg(value order by (value->>'index')::integer) from jsonb_array_elements(remaining) a where a->>'index'<>idx::text),'[]');
    end if;
   end if;
   amount:=app_private.fsv2_amount(s,idx);
   row_a:=jsonb_build_object('id',row_id,'user_id',p_user,'account_id',current_t->'account_id','category_id',current_t->'category_id','kind',current_t->'kind','amount_cents',amount,'paid_cents',case when account->>'kind'='credit_card' and current_t->>'kind'='expense' then amount else 0 end,
    'description',current_t->'description','payee',current_t->'payee','notes',current_t->'notes','tag_ids',current_t->'tag_ids','occurred_on',to_char(day,'YYYY-MM-DD'),'due_date',to_char(day,'YYYY-MM-DD'),'statement_month',statement,'status','planned','source',case when s->>'kind'='recorrencia' then 'recurring' else 'manual' end,
    'installment_group_id',series_id,'installment_no',idx,'installment_total',s->'total','serie_tipo',s->'kind','transfer_group_id',null,'deleted_at',null,'created_at',at_text,'updated_at',at_text);
   map_a:=jsonb_build_object('id',map_id,'user_id',p_user,'series_id',series_id,'index',idx,'transaction_id',row_id,'occurred_on',to_char(day,'YYYY-MM-DD'),'suppression','none','configuration_revision',case when before_s is null then '0' else (app_private.fsv2_revision(before_s->'revision')+1)::text end,'created_at',at_text,'updated_at',at_text);
   expected:=app_private.fsv2_change(expected,'finance_transaction',null,row_a);expected:=app_private.fsv2_change(expected,'finance_series_occurrence',null,map_a);
   last_day:=greatest(last_day,day);counts:=jsonb_set(counts,'{created}',to_jsonb((counts->>'created')::integer+1));
  end loop;
  if remaining<>'[]'::jsonb or (counts->>'created')::integer>53 then raise exception 'Unexpected statement assignment/materialization count.' using errcode='23514';end if;
  s:=s||jsonb_build_object('next_index',next_idx,'materialized_through',to_char(last_day,'YYYY-MM-DD'));
 end if;
 if before_s is not null and (s is distinct from before_s or expected<>'[]'::jsonb) then s:=s||jsonb_build_object('revision',(app_private.fsv2_revision(before_s->'revision')+1)::text,'updated_at',at_text);end if;
 -- New maps must carry the FINAL configuration revision. A materialization can
 -- advance the cursor without creating rows; history remains at its own revision.
 if plan_new then expected:=coalesce((select jsonb_agg(case when e->>'type'='finance_series_occurrence' and e->'before'='null'::jsonb then jsonb_set(e,'{after,configuration_revision}',s->'revision') else e end order by ord) from jsonb_array_elements(expected) with ordinality items(e,ord)),'[]');end if;
 expected:=app_private.fsv2_change(expected,'finance_series',before_s,s);
 if submitted_result is distinct from jsonb_build_object('version',2,'series',s,'affected',counts) then raise exception 'Series result/counts differ from exact effects.' using errcode='23514';end if;
 return jsonb_build_object('changes',expected,'result',submitted_result);
end $$;
do $$ declare f record;begin for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app_private' and p.proname like 'fsv2_%' and p.proname not in ('fsv2_snapshot','fsv2_detail','fsv2_page') loop execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);end loop;end $$;


-- INERT. Does not activate v1 guards or authorize a hosted operation.
create function app_private.fsv2_record(p_user uuid,kind text,p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$ declare p jsonb;begin
 if kind='finance_series' then select payload into p from app_private.finance_series where user_id=p_user and id=p_id;
 elsif kind='finance_series_occurrence' then select payload into p from app_private.finance_series_occurrences where user_id=p_user and id=p_id;
 elsif kind='finance_transaction' then select payload into p from public.fin_transactions where user_id=p_user and id=p_id;
 else raise exception 'Unknown series effect type.' using errcode='22023';end if;return p;
end $$;
create function app_private.fsv2_identity_used(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from app_private.finance_series where id=p_id)
  or exists(select 1 from app_private.finance_series_occurrences where id=p_id)
  or exists(select 1 from public.fin_transactions where id=p_id)
  or exists(select 1 from public.fin_accounts where id=p_id)
  or exists(select 1 from public.fin_categories where id=p_id)
  or exists(select 1 from public.fin_tags where id=p_id)
  or exists(select 1 from public.fin_budgets where id=p_id)
  or exists(select 1 from public.domain_events where id=p_id);
$$;
create function app_private.fsv2_effect_action(kind text,b jsonb,a jsonb) returns text language sql immutable set search_path='' as $$
 select case when b is null then 'created'
  when kind='finance_series' then (case when b->'state'=a->'state' then 'updated' else 'status_changed' end)
  when kind='finance_series_occurrence' then (case when b->'suppression'=a->'suppression' then 'updated' else 'status_changed' end)
  when b->'deleted_at'='null'::jsonb and a->'deleted_at'<>'null'::jsonb then 'deleted'
  when b->'deleted_at'<>'null'::jsonb and a->'deleted_at'='null'::jsonb then 'restored'
  when b->'status'=a->'status' then 'updated' else 'status_changed' end;
$$;
create function app_private.fsv2_commit(p_user uuid,p_session uuid,p_operation text,p_request jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
<<series_commit>>
declare input jsonb;r jsonb;stored jsonb;expected jsonb;ordered_expected jsonb;ordered_submitted jsonb;c jsonb;b jsonb;a jsonb;e jsonb;
 context jsonb;kind text;id uuid;series_id uuid;at_text text;at_time timestamptz;today date;n integer;found_n integer;table_name text;result jsonb;
begin
 perform app_private.fsv2_guard(p_user,p_session);
 perform app_private.fsv2_object(p_request,array['request','expected_finance_revision','context','changes','events','receipt']);
 if octet_length(p_request::text)>8388608 or octet_length((p_request->'request')::text)>65536 then raise exception 'Series request exceeds quota.' using errcode='54000';end if;
 input:=app_private.fsv2_command(p_request->'request');
 if p_operation is distinct from p_request#>>'{request,command}' or p_request->'expected_finance_revision' is distinct from input->'expected_finance_revision' then raise exception 'Series command/revision envelope changed.' using errcode='22023';end if;
 context:=p_request->'context';perform app_private.fsv2_object(context,array['user_id','canal']);
 if context->>'user_id' is distinct from p_user::text or jsonb_typeof(context->'canal') is distinct from 'string' or context->>'canal' not in ('web','api','cron') then raise exception 'Series context outside actor.' using errcode='42501';end if;
 r:=p_request->'receipt';perform app_private.fsv2_object(r,array['user_id','command','client_id','fingerprint','result']);
 if r->>'user_id' is distinct from p_user::text or r->>'command' is distinct from p_operation or r->'client_id' is distinct from input->'client_id' or jsonb_typeof(r->'fingerprint') is distinct from 'string'
  or (r->>'fingerprint')::jsonb is distinct from input then raise exception 'Series receipt outside exact intent.' using errcode='23514';end if;
 -- Access precedes every replay. Replaying after a race can legitimately return
 -- the winner's UUIDs, not this loser's freshly planned IDs. No batch/CAS/ref
 -- revalidation is allowed to replace or invalidate that authentic receipt.
 stored:=app_private.fsv2_saved_receipt(p_user,p_operation,input);
 if stored is not null then
  if stored->'fingerprint' is distinct from r->'fingerprint' then raise exception 'Series fingerprint changed.' using errcode='23505';end if;
  return jsonb_build_object('status','replayed','result',stored->'result');
 end if;
 if app_private.fsv2_finance_revision(p_user) is distinct from p_request->>'expected_finance_revision' then return jsonb_build_object('status','stale');end if;
 if jsonb_typeof(p_request->'changes') is distinct from 'array' or jsonb_typeof(p_request->'events') is distinct from 'array' then raise exception 'Series effects arrays required.' using errcode='22023';end if;
 n:=jsonb_array_length(p_request->'changes');if n>241 or n<>jsonb_array_length(p_request->'events') then raise exception 'Series effects exceed finite bound.' using errcode='23514';end if;
 if exists(select 1 from jsonb_array_elements(p_request->'changes') as effect(value) group by effect.value->>'type',effect.value#>>'{after,id}' having count(*)>1)
  or exists(select 1 from jsonb_array_elements(p_request->'changes') as effect(value) group by effect.value#>>'{after,id}' having count(*)>1)
  or exists(select 1 from jsonb_array_elements(p_request->'events') as event(value) group by event.value->>'id' having count(*)>1)
  or exists(select 1 from jsonb_array_elements(p_request->'events') as event(value) join jsonb_array_elements(p_request->'changes') as effect(value) on event.value->'id'=effect.value#>'{after,id}') then raise exception 'Repeated/colliding series effect/event.' using errcode='23514';end if;
 for c in select value from jsonb_array_elements(p_request->'changes') loop
  perform app_private.fsv2_object(c,array['type','before','after']);a:=c->'after';b:=nullif(c->'before','null'::jsonb);kind:=c->>'type';
  if kind='finance_series' then perform app_private.fsv2_series(a);
  elsif kind='finance_series_occurrence' then perform app_private.fsv2_occurrence(a);
  elsif kind='finance_transaction' then perform app_private.finance_validate(kind,a);
  else raise exception 'Effect type outside series.' using errcode='23514';end if;
  id:=app_private.fsv2_uuid(a->'id');
  if a->>'user_id' is distinct from p_user::text or b is not null and (b->>'id' is distinct from a->>'id' or b->>'user_id' is distinct from p_user::text or b->'created_at' is distinct from a->'created_at') then raise exception 'Effect owner/identity changed.' using errcode='42501';end if;
  if app_private.fsv2_record(p_user,kind,id) is distinct from b then raise exception 'Series BEFORE changed.' using errcode='40001';end if;
  if b is null and app_private.fsv2_identity_used(id) then raise exception 'New series identity already used.' using errcode='23505';end if;
 end loop;
 today:=(clock_timestamp() at time zone 'America/Sao_Paulo')::date;
 if n>0 then
  at_text:=p_request#>>'{events,0,occurred_at}';at_time:=app_private.capture_task_timestamp(to_jsonb(at_text));
  if abs(extract(epoch from(clock_timestamp()-at_time)))>=300 or (at_time at time zone 'America/Sao_Paulo')::date<>today then raise exception 'Series server clock requires a fresh review.' using errcode='40001';end if;
 else at_text:=r#>>'{result,series,updated_at}';end if;
 expected:=app_private.fsv2_expected(p_user,p_operation,input,p_request->'changes',r->'result',at_text,today);
 select coalesce(jsonb_agg(value order by value->>'type',value#>>'{after,id}'),'[]') into ordered_expected from jsonb_array_elements(expected->'changes');
 select coalesce(jsonb_agg(value order by value->>'type',value#>>'{after,id}'),'[]') into ordered_submitted from jsonb_array_elements(p_request->'changes');
 if ordered_expected is distinct from ordered_submitted then raise exception 'Submitted effects omit/add/change the exact series plan.' using errcode='23514';end if;
 for c in select value from jsonb_array_elements(expected->'changes') loop
  a:=c->'after';b:=nullif(c->'before','null'::jsonb);kind:=c->>'type';
  select count(*) into found_n from jsonb_array_elements(p_request->'events') ev where ev->>'entity_type'=kind and ev->'entity_id'=a->'id' and ev->'before' is not distinct from coalesce(b,'null'::jsonb) and ev->'after'=a;
  if found_n<>1 then raise exception 'Exact series event required.' using errcode='23514';end if;
 end loop;
 for e in select value from jsonb_array_elements(p_request->'events') loop
  perform app_private.fsv2_object(e,array['id','user_id','entity_type','entity_id','action','canal','occurred_at','before','after']);perform app_private.fsv2_uuid(e->'id');perform app_private.fsv2_uuid(e->'entity_id');
  if app_private.fsv2_identity_used((e->>'id')::uuid) then raise exception 'New event identity already used.' using errcode='23505';end if;
  if e->>'user_id' is distinct from p_user::text or e->'canal' is distinct from context->'canal' or e->>'occurred_at' is distinct from at_text
   or e->>'action' is distinct from app_private.fsv2_effect_action(e->>'entity_type',nullif(e->'before','null'::jsonb),e->'after') then raise exception 'Series event metadata differs.' using errcode='23514';end if;
 end loop;
 if not (app_private.consume_rate_limit_at('capture_task_write',encode(sha256(convert_to(p_user::text,'UTF8')),'hex'),p_user,null)->>'allowed')::boolean then raise exception 'Series write limit reached.' using errcode='PT429';end if;
 -- Create/update the selected metadata first, ledger second and map third.
 -- FKs stay deferred; guards consume each exact ledger permit before integrity.
 -- A preceding command in this SAME transaction may have made all constraints
 -- immediate. Re-defer only our residual check; never relax a legacy FK/check.
 set constraints app_private.finance_series_permit_zero deferred;
 for c in select value from jsonb_array_elements(expected->'changes') order by (case value->>'type' when 'finance_series' then 0 when 'finance_transaction' then 1 else 2 end),value#>>'{after,id}' loop
  a:=c->'after';b:=nullif(c->'before','null'::jsonb);kind:=c->>'type';id:=app_private.fsv2_uuid(a->'id');
  if kind='finance_transaction' then
   series_id:=app_private.fsv2_uuid(a->'installment_group_id');
   insert into app_private.finance_series_permits(row_id,user_id,series_id,command,client_id,before_hash,after_hash,backend_pid,xact_id)
    values(id,p_user,series_id,p_operation,(input->>'client_id')::uuid,encode(sha256(convert_to(coalesce(b,'null'::jsonb)::text,'UTF8')),'hex'),encode(sha256(convert_to(a::text,'UTF8')),'hex'),pg_backend_pid(),pg_current_xact_id());
   if b is null then insert into public.fin_transactions(payload) values(a);else update public.fin_transactions set payload=a where user_id=p_user and public.fin_transactions.id=series_commit.id;end if;
   if exists(select 1 from app_private.finance_series_permits p where p.row_id=series_commit.id) then raise exception 'Series permit was not consumed.' using errcode='23514';end if;
  elsif kind='finance_series' then
   if b is null then insert into app_private.finance_series(payload) values(a);else update app_private.finance_series set payload=a where user_id=p_user and app_private.finance_series.id=series_commit.id;end if;
  else
   if b is null then insert into app_private.finance_series_occurrences(payload) values(a);else update app_private.finance_series_occurrences set payload=a where user_id=p_user and app_private.finance_series_occurrences.id=series_commit.id;end if;
  end if;
  if app_private.fsv2_record(p_user,kind,id) is distinct from a then raise exception 'Series projection differs from effect.' using errcode='23514';end if;
 end loop;
 if exists(select 1 from app_private.finance_series_permits where user_id=p_user and backend_pid=pg_backend_pid() and xact_id=pg_current_xact_id()) then raise exception 'Residual series permit.' using errcode='23514';end if;
 perform app_private.finance_integrity(p_user);
 set constraints all immediate;
 for e in select value from jsonb_array_elements(p_request->'events') loop
  insert into public.domain_events(id,user_id,entity_type,entity_id,action,canal,occurred_at,before,after)
   values((e->>'id')::uuid,p_user,e->>'entity_type',(e->>'entity_id')::uuid,e->>'action',e->>'canal',app_private.capture_task_timestamp(e->'occurred_at'),nullif(e->'before','null'::jsonb),e->'after');
 end loop;
 result:=r->'result';series_id:=app_private.fsv2_uuid(result#>'{series,id}');
 if app_private.fsv2_record(p_user,'finance_series',series_id) is distinct from result->'series' then raise exception 'Series result differs from stored metadata.' using errcode='23514';end if;
 perform app_private.fsv2_bound_map(result->'series');
 insert into app_private.command_receipts(user_id,command,client_id,request,result) values(p_user,p_operation,r->>'client_id',to_jsonb(r->>'fingerprint'),result);
 return jsonb_build_object('status','committed','result',result);
exception when invalid_text_representation or numeric_value_out_of_range then raise exception 'Invalid series commit value.' using errcode='22023';end $$;
create function public.finance_series_commit(p_user uuid,p_session uuid,p_operation text,p_request jsonb) returns jsonb language sql security invoker set search_path='' as $$select app_private.fsv2_commit(p_user,p_session,p_operation,p_request);$$;
revoke all on function app_private.fsv2_record(uuid,text,uuid),app_private.fsv2_identity_used(uuid),app_private.fsv2_effect_action(text,jsonb,jsonb),app_private.fsv2_commit(uuid,uuid,text,jsonb),public.finance_series_commit(uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function app_private.fsv2_commit(uuid,uuid,text,jsonb),public.finance_series_commit(uuid,uuid,text,jsonb) to service_role;


-- INERT. In particular, do NOT install this ledger guard without B3 payment UX.
-- A permit is inserted only by fsv2_commit, with zero direct table/function
-- grants. It is consumed inside BEFORE, never as a reusable session flag.
create function app_private.fsv2_ledger_guard() returns trigger
language plpgsql security definer set search_path='' as $$
<<ledger_guard>>
declare owner_id uuid;row_id uuid;group_id uuid;before_value jsonb;after_value jsonb;permit app_private.finance_series_permits;managed boolean;begin
 if tg_op='DELETE' then owner_id:=old.user_id;row_id:=old.id;group_id:=old.installment_group_id;before_value:=old.payload;after_value:='null'::jsonb;
 else owner_id:=new.user_id;row_id:=new.id;group_id:=new.installment_group_id;after_value:=new.payload;before_value:=case when tg_op='UPDATE' then old.payload else 'null'::jsonb end;end if;
 -- Auth FK deletion runs AFTER the parent's removal. This narrow exception
 -- preserves authorized identity erasure; it cannot authorize an ordinary row
 -- DELETE while that user's Auth identity still exists. No GUC/role/depth flag.
 if tg_op='DELETE' and not exists(select 1 from auth.users where id=owner_id) then return old;end if;
 managed:=exists(select 1 from app_private.finance_series_occurrences m where m.transaction_id=row_id)
  or exists(select 1 from app_private.finance_series s where s.id=group_id);
 if tg_op='UPDATE' then managed:=managed or exists(select 1 from app_private.finance_series s where s.id=old.installment_group_id);end if;
 if not managed then if tg_op='DELETE' then return old;else return new;end if;end if;
 if tg_op='DELETE' or group_id is null or not exists(select 1 from app_private.finance_series s where s.user_id=owner_id and s.id=group_id) then raise exception 'Managed occurrence requires its dedicated command.' using errcode='42501';end if;
 delete from app_private.finance_series_permits p where p.row_id=ledger_guard.row_id and p.user_id=owner_id and p.series_id=group_id
  and p.backend_pid=pg_backend_pid() and p.xact_id=pg_current_xact_id()
  and p.command in ('finance.recurring.create','finance.recurring.materialize','finance.recurring.pause','finance.recurring.resume','finance.recurring.update_future','finance.recurring.end','finance.recurring.occurrence.cancel','finance.recurring.occurrence.update')
  and p.before_hash=encode(sha256(convert_to(before_value::text,'UTF8')),'hex') and p.after_hash=encode(sha256(convert_to(after_value::text,'UTF8')),'hex') returning p.* into permit;
 if not found then raise exception 'Managed occurrence has no exact unused permit.' using errcode='42501';end if;
 -- DELETE RETURNING is the authority: a second entry, even with identical data,
 -- fails. The row is already absent when legacy SET CONSTRAINTS runs. Any later
 -- failure rolls the deletion and every financial effect back in one transaction.
 return new;
end $$;
create function app_private.fsv2_permit_zero() returns trigger
language plpgsql security definer set search_path='' as $$ begin
 if exists(select 1 from app_private.finance_series_permits p where p.row_id=new.row_id) then raise exception 'Unconsumed managed occurrence permit.' using errcode='23514';end if;return null;
end $$;
create constraint trigger finance_series_permit_zero after insert or update on app_private.finance_series_permits
 deferrable initially deferred for each row execute function app_private.fsv2_permit_zero();
-- Alphabetical BEFORE order matters: finance_project establishes validated
-- scalar columns and normalizes the existing credit-card projection first.
-- This guard then hashes exactly the payload the table would persist.
create trigger finance_series_guard before insert or update or delete on public.fin_transactions
 for each row execute function app_private.fsv2_ledger_guard();

-- Account kind is ALREADY immutable for every account in finance_project.
-- Do not weaken/reimplement that historical guard. Its original test and the
-- mapped-account negative fixture remain mandatory in this candidate's QA.

-- Narrow v1 event projection only. prosrc hash comes from the ORIGINAL001–025
-- canonical chain, not a PGlite rendering or an observed untrusted deployment.
-- Root must independently confirm the hosted catalog before promotion. A
-- different source/security/owner/path aborts before replacing anything.
do $legacy_projection$
declare definition text;source text;anchor text:='entity_type like ''finance_%''';replacement text:='entity_type in (''finance_account'',''finance_category'',''finance_tag'',''finance_transaction'',''finance_budget'')';p record;begin
 select pg_get_functiondef(f.oid) definition,f.prosrc,f.prosecdef,f.proconfig,r.rolname into strict p
  from pg_proc f join pg_roles r on r.oid=f.proowner where f.oid='app_private.finance_snapshot(uuid,uuid,text)'::regprocedure;
 source:=p.prosrc;definition:=p.definition;
 if encode(sha256(convert_to(source,'UTF8')),'hex')<>'855cff15825d78f988a87f0d017e802d33b1a4808060cd9c546091a9d0e539bb'
  or not p.prosecdef or p.rolname<>'postgres' or p.proconfig is distinct from array['search_path=""']::text[]
  or (length(source)-length(replace(source,anchor,'')))/length(anchor)<>1
  or (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1
  or position(replacement in source)>0 then raise exception 'Historical Finance snapshot source diverged.' using errcode='23514';end if;
 execute replace(definition,anchor,replacement);
end $legacy_projection$;
revoke all on function app_private.fsv2_ledger_guard(),app_private.fsv2_permit_zero() from public,anon,authenticated,service_role;


-- INERT proposal. Root composes a NEW migration after peer/catalog/gates.
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


-- INERT. Complete indexed aggregates and finite pages; no historical seed.
create function app_private.fg_guard(p_user uuid,p_session uuid) returns void language plpgsql security definer set search_path='' as $$ begin
 perform app_private.finance_guard(p_user,p_session,'read.finance');
end $$;
create function app_private.fg_finance_revision(p_user uuid) returns text language sql stable security definer set search_path='' as $$
 select coalesce((select revision::text from app_private.finance_revisions where user_id=p_user),'0');
$$;
create function app_private.fg_bound(p jsonb) returns jsonb language plpgsql immutable set search_path='' as $$ begin if octet_length(p::text)>524288 then raise exception 'Goal read exceeds finite transport quota.' using errcode='54000';end if;return p;end $$;
create function app_private.fg_released(p_user uuid,p_reservation uuid) returns bigint language sql stable security definer set search_path='' as $$
 select app_private.fg_cents(coalesce(sum(amount_cents::numeric),0)) from app_private.finance_goal_releases where user_id=p_user and reservation_id=p_reservation;
$$;
create function app_private.fg_reserved(p_user uuid,p_account uuid default null,p_goal uuid default null) returns bigint language sql stable security definer set search_path='' as $$
 select app_private.fg_cents(coalesce(sum(r.amount_cents::numeric-coalesce(released.amount,0)),0))
 from app_private.finance_goal_reservations r left join lateral (
  select sum(l.amount_cents::numeric) amount from app_private.finance_goal_releases l where l.user_id=r.user_id and l.reservation_id=r.id
 ) released on true where r.user_id=p_user and (p_account is null or r.account_id=p_account) and (p_goal is null or r.goal_id=p_goal);
$$;
create function app_private.fg_goal_totals(p_user uuid,p_goal uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('user_id',p_user,'goal_id',p_goal,'finance_revision',app_private.fg_finance_revision(p_user),'saved_cents',app_private.fg_reserved(p_user,null,p_goal));
$$;
create function app_private.fg_release_totals(p_user uuid,p_reservation uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('user_id',p_user,'reservation_id',p_reservation,'finance_revision',app_private.fg_finance_revision(p_user),'released_cents',app_private.fg_released(p_user,p_reservation));
$$;
create function app_private.fg_account_totals(p_user uuid,p_account uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$ declare a public.fin_accounts;real_value numeric;begin
 select * into a from public.fin_accounts where user_id=p_user and id=p_account;if not found then return null;end if;
 -- Exact equivalent of saldosFinanceiros/fin_account_balances. No reserve or
 -- invoice is deducted from the real balance. Partial paid values are preserved.
 select a.opening_balance_cents::numeric+coalesce(sum((case when t.kind='income' then 1 else -1 end)::numeric*(case when a.kind='credit_card' then t.amount_cents else t.paid_cents end)::numeric),0)
 into real_value from public.fin_transactions t where t.user_id=p_user and t.account_id=p_account and t.deleted_at is null and t.status in ('confirmed','reconciled');
 return jsonb_build_object('user_id',p_user,'account_id',p_account,'finance_revision',app_private.fg_finance_revision(p_user),'real_balance_cents',app_private.fg_cents(real_value,-9007199254740991),'reserved_cents',app_private.fg_reserved(p_user,p_account,null));
end $$;
-- Explicit fail-closed media boundary. Existing file kinds are drive,
-- capture_image/avatar; none proves finance_goal_image. No fabricated metadata.
-- A later reviewed media package must replace this lookup with its exact,
-- owner/finalization/deletion-aware source before non-null new images can pass.
create function app_private.fg_image(p_user uuid,p_file uuid) returns jsonb language sql stable security definer set search_path='' as $$ select null::jsonb; $$;
create function app_private.fg_saved_receipt(p_user uuid,p_command text,p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$ declare saved app_private.command_receipts;fp text;begin
 select * into saved from app_private.command_receipts where user_id=p_user and command=p_command and client_id=p_input->>'client_id';if not found then return null;end if;
 if jsonb_typeof(saved.request) is distinct from 'string' then raise exception 'Malformed goal receipt.' using errcode='23514';end if;fp:=saved.request#>>'{}';
 if fp::jsonb is distinct from p_input then raise exception 'Goal client_id reused with different input.' using errcode='23505';end if;
 -- Full command/result binding is checked by fg_result (03), independent of
 -- current Meta/Conta/image/CAS. This is safe even after references change.
 perform app_private.fg_result(p_user,p_command,p_input,saved.result);
 return jsonb_build_object('user_id',p_user,'command',p_command,'client_id',p_input->>'client_id','fingerprint',fp,'result',saved.result);
end $$;
create function app_private.fg_snapshot(p_user uuid,p_session uuid,p_request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare input jsonb;op text;receipt jsonb;g jsonb;r jsonb;h jsonb;a jsonb;image jsonb;result jsonb;goal_id uuid;image_id uuid;begin
 perform app_private.fg_guard(p_user,p_session);if octet_length(p_request::text)>65536 then raise exception 'Goal intent exceeds quota.' using errcode='54000';end if;
 input:=app_private.fg_command(p_request);op:=p_request->>'command';receipt:=app_private.fg_saved_receipt(p_user,op,input);
 result:=jsonb_build_object('version',1,'finance_revision',app_private.fg_finance_revision(p_user),'goals','[]'::jsonb,'reservations','[]'::jsonb,'highlights','[]'::jsonb,'accounts','[]'::jsonb,'images','[]'::jsonb,'account_totals','[]'::jsonb,'goal_totals','[]'::jsonb,'release_totals','[]'::jsonb,'receipt',receipt);
 if receipt is not null then return app_private.fg_bound(result);end if;
 if op='finance.goal.release' then
  select payload into r from app_private.finance_goal_reservations where user_id=p_user and id=(input->>'reservation_id')::uuid;
  if r is not null then result:=result||jsonb_build_object('reservations',jsonb_build_array(r),'release_totals',jsonb_build_array(app_private.fg_release_totals(p_user,(r->>'id')::uuid)));end if;
  return app_private.fg_bound(result);
 end if;
 goal_id:=(input->>'goal_id')::uuid;if goal_id is not null then select payload into g from app_private.finance_goals where user_id=p_user and id=goal_id;end if;
 if g is not null then result:=jsonb_set(result,'{goals}',jsonb_build_array(g));end if;
 if op in ('finance.goal.archive','finance.goal.restore','finance.goal.highlight') then
  select payload into h from app_private.finance_goal_highlights where user_id=p_user;if h is not null then result:=jsonb_set(result,'{highlights}',jsonb_build_array(h));end if;
 end if;
 if op='finance.goal.contribute' then
  select jsonb_build_object('id',id,'user_id',user_id,'kind',kind,'currency',currency,'archived_at',payload->'archived_at') into a from public.fin_accounts where user_id=p_user and id=(input->>'account_id')::uuid;
  if a is not null then result:=result||jsonb_build_object('accounts',jsonb_build_array(a),'account_totals',jsonb_build_array(app_private.fg_account_totals(p_user,(a->>'id')::uuid)));end if;
  if g is not null then result:=jsonb_set(result,'{goal_totals}',jsonb_build_array(app_private.fg_goal_totals(p_user,goal_id)));end if;
 end if;
 if op='finance.goal.create' then image_id:=(input->>'image_file_id')::uuid;
 elsif op='finance.goal.update' and input->'patch' ? 'image_file_id' and input#>'{patch,image_file_id}' is distinct from g->'image_file_id' then image_id:=(input#>>'{patch,image_file_id}')::uuid;end if;
 if image_id is not null then image:=app_private.fg_image(p_user,image_id);if image is not null then result:=jsonb_set(result,'{images}',jsonb_build_array(image));end if;end if;
 return app_private.fg_bound(result);
end $$;
create function app_private.fg_page(p_user uuid,p_session uuid,p_cursor uuid,p_limit integer,p_archived text) returns jsonb language plpgsql security definer set search_path='' as $$ declare rows jsonb;items jsonb;h jsonb;next_id uuid;begin
 perform app_private.fg_guard(p_user,p_session);if p_limit not between 1 and 50 or p_limit is null or p_archived is null or p_archived not in ('active','archived','all') then raise exception 'Invalid goal page.' using errcode='22023';end if;
 select coalesce(jsonb_agg(q.payload order by q.id),'[]') into rows from (select id,payload from app_private.finance_goals where user_id=p_user and (p_cursor is null or id>p_cursor) and (p_archived='all' or (archived_at is null)=(p_archived='active')) order by id limit p_limit+1) q;
 if jsonb_array_length(rows)>p_limit then rows:=rows-(jsonb_array_length(rows)-1);next_id:=(rows#>>array[(p_limit-1)::text,'id'])::uuid;end if;
 select coalesce(jsonb_agg(jsonb_build_object('goal',g.value,'totals',app_private.fg_goal_totals(p_user,(g.value->>'id')::uuid)) order by g.value->>'id'),'[]') into items from jsonb_array_elements(rows) g(value);
 select payload into h from app_private.finance_goal_highlights where user_id=p_user;
 return app_private.fg_bound(jsonb_build_object('version',1,'finance_revision',app_private.fg_finance_revision(p_user),'items',items,'highlight',h,'next_cursor',next_id));
end $$;
create function app_private.fg_detail(p_user uuid,p_session uuid,p_goal uuid) returns jsonb language plpgsql security definer set search_path='' as $$ declare g jsonb;h jsonb;begin
 perform app_private.fg_guard(p_user,p_session);select payload into g from app_private.finance_goals where user_id=p_user and id=p_goal;if g is null then return null;end if;
 select payload into h from app_private.finance_goal_highlights where user_id=p_user;return app_private.fg_bound(jsonb_build_object('version',1,'finance_revision',app_private.fg_finance_revision(p_user),'goal',g,'totals',app_private.fg_goal_totals(p_user,p_goal),'highlight',h));
end $$;
create function app_private.fg_history(p_user uuid,p_session uuid,p_id uuid,p_cursor jsonb,p_limit integer,p_release boolean) returns jsonb language plpgsql security definer set search_path='' as $$ declare since timestamptz;since_id uuid;rows jsonb;items jsonb;next_cursor jsonb;begin
 perform app_private.fg_guard(p_user,p_session);if p_limit not between 1 and 50 or p_limit is null or p_id is null or p_release is null then raise exception 'Invalid goal history page.' using errcode='22023';end if;
 if p_cursor is not null and p_cursor<>'null'::jsonb then perform app_private.fg_object(p_cursor,array['created_at','id']);since:=app_private.capture_task_timestamp(p_cursor->'created_at');since_id:=app_private.fg_uuid(p_cursor->'id');end if;
 if p_release then
  select coalesce(jsonb_agg(q.payload order by q.created_at,q.id),'[]') into rows from (select id,created_at,payload from app_private.finance_goal_releases where user_id=p_user and reservation_id=p_id and (since is null or (created_at,id)>(since,since_id)) order by created_at,id limit p_limit+1) q;
 else
  select coalesce(jsonb_agg(q.payload order by q.created_at,q.id),'[]') into rows from (select id,created_at,payload from app_private.finance_goal_reservations where user_id=p_user and goal_id=p_id and (since is null or (created_at,id)>(since,since_id)) order by created_at,id limit p_limit+1) q;
 end if;
 if jsonb_array_length(rows)>p_limit then rows:=rows-(jsonb_array_length(rows)-1);next_cursor:=jsonb_build_object('created_at',rows#>array[(p_limit-1)::text,'created_at'],'id',rows#>array[(p_limit-1)::text,'id']);end if;
 if p_release then items:=rows;else
  select coalesce(jsonb_agg(jsonb_build_object('reservation',r.value,'totals',app_private.fg_release_totals(p_user,(r.value->>'id')::uuid)) order by app_private.capture_task_timestamp(r.value->'created_at'),r.value->>'id'),'[]') into items from jsonb_array_elements(rows) r(value);
 end if;
 return app_private.fg_bound(jsonb_build_object('version',1,'finance_revision',app_private.fg_finance_revision(p_user),'items',items,'next_cursor',next_cursor));
end $$;
create function public.finance_goals_snapshot(p_user uuid,p_session uuid,p_request jsonb) returns jsonb language sql security definer set search_path='' as $$ select app_private.fg_snapshot(p_user,p_session,p_request); $$;
create function public.finance_goals_page(p_user uuid,p_session uuid,p_cursor uuid,p_limit integer,p_archived text) returns jsonb language sql security definer set search_path='' as $$ select app_private.fg_page(p_user,p_session,p_cursor,p_limit,p_archived); $$;
create function public.finance_goal_detail(p_user uuid,p_session uuid,p_goal uuid) returns jsonb language sql security definer set search_path='' as $$ select app_private.fg_detail(p_user,p_session,p_goal); $$;
create function public.finance_goal_reservations_page(p_user uuid,p_session uuid,p_goal uuid,p_cursor jsonb,p_limit integer) returns jsonb language sql security definer set search_path='' as $$ select app_private.fg_history(p_user,p_session,p_goal,p_cursor,p_limit,false); $$;
create function public.finance_goal_releases_page(p_user uuid,p_session uuid,p_reservation uuid,p_cursor jsonb,p_limit integer) returns jsonb language sql security definer set search_path='' as $$ select app_private.fg_history(p_user,p_session,p_reservation,p_cursor,p_limit,true); $$;
revoke all on function public.finance_goals_snapshot(uuid,uuid,jsonb),public.finance_goals_page(uuid,uuid,uuid,integer,text),public.finance_goal_detail(uuid,uuid,uuid),public.finance_goal_reservations_page(uuid,uuid,uuid,jsonb,integer),public.finance_goal_releases_page(uuid,uuid,uuid,jsonb,integer) from public,anon,authenticated,service_role;
grant execute on function public.finance_goals_snapshot(uuid,uuid,jsonb),public.finance_goals_page(uuid,uuid,uuid,integer,text),public.finance_goal_detail(uuid,uuid,uuid),public.finance_goal_reservations_page(uuid,uuid,uuid,jsonb,integer),public.finance_goal_releases_page(uuid,uuid,uuid,jsonb,integer) to service_role;
do $permissions$ declare f record;begin for f in select oid::regprocedure signature from pg_proc where pronamespace='app_private'::regnamespace and proname like 'fg\_%' escape '\' loop execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);end loop;end $permissions$;


-- INERT. Independent SQL oracle for all SEVEN closed Core commands.
create function app_private.fg_result(p_user uuid,op text,input jsonb,result jsonb) returns void language plpgsql immutable set search_path='' as $$ declare r jsonb;g jsonb;h jsonb;k text;v jsonb;begin
 if op='finance.goal.contribute' then
  perform app_private.fg_object(result,array['version','reservation']);r:=result->'reservation';perform app_private.fg_row('finance_goal_reservation',r);
  if r->'goal_id' is distinct from input->'goal_id' or r->'account_id' is distinct from input->'account_id' then raise exception 'Reservation outside intent.' using errcode='23514';end if;
 elsif op='finance.goal.release' then
  perform app_private.fg_object(result,array['version','release']);r:=result->'release';perform app_private.fg_row('finance_goal_release',r);
  if r->'reservation_id' is distinct from input->'reservation_id' then raise exception 'Release outside intent.' using errcode='23514';end if;
 elsif op='finance.goal.highlight' then
  perform app_private.fg_object(result,array['version','highlight']);h:=nullif(result->'highlight','null'::jsonb);
  if h is not null then perform app_private.fg_row('finance_goal_highlight',h);if h->>'user_id' is distinct from p_user::text then raise exception 'Foreign highlight result.' using errcode='42501';end if;end if;
  if coalesce(h->'goal_id','null'::jsonb) is distinct from input->'goal_id' then raise exception 'Highlight outside intent.' using errcode='23514';end if;
 else
  perform app_private.fg_object(result,array['version','goal'],case when op in ('finance.goal.archive','finance.goal.restore') then array['highlight'] else '{}'::text[] end);
  if op in ('finance.goal.archive','finance.goal.restore') and not result ? 'highlight' then raise exception 'Highlight result required.' using errcode='23514';end if;
  g:=result->'goal';perform app_private.fg_row('finance_goal',g);if g->>'user_id' is distinct from p_user::text then raise exception 'Foreign goal result.' using errcode='42501';end if;
  if op<>'finance.goal.create' and g->'id' is distinct from input->'goal_id' then raise exception 'Result of another goal.' using errcode='23514';end if;
  if op in ('finance.goal.create','finance.goal.update') then
   for k,v in select key,value from jsonb_each(case when op='finance.goal.create' then input-array['client_id','expected_finance_revision'] else input->'patch' end) loop
    if g->k is distinct from (case when k='name' then to_jsonb(app_private.fg_name(v)) else v end) then raise exception 'Goal result differs from requested field.' using errcode='23514';end if;
   end loop;
   if op='finance.goal.create' and (g->'revision'<>'"0"'::jsonb or g->'archived_at'<>'null'::jsonb) then raise exception 'Invalid new goal state.' using errcode='23514';end if;
  elsif op in ('finance.goal.archive','finance.goal.restore') then
   h:=nullif(result->'highlight','null'::jsonb);if h is not null then perform app_private.fg_row('finance_goal_highlight',h);if h->>'user_id' is distinct from p_user::text then raise exception 'Foreign highlight result.' using errcode='42501';end if;end if;
   if op='finance.goal.archive' and (g->'archived_at'='null'::jsonb or h->'goal_id'=g->'id') or op='finance.goal.restore' and g->'archived_at'<>'null'::jsonb then raise exception 'Goal archive result differs.' using errcode='23514';end if;
  else raise exception 'Unknown goal result command.' using errcode='22023';end if;
 end if;
 if result->'version' is distinct from '1'::jsonb then raise exception 'Invalid goal result version.' using errcode='23514';end if;
 if r is not null and (r->>'user_id' is distinct from p_user::text or r->'client_id' is distinct from input->'client_id' or r->'amount_cents' is distinct from input->'amount_cents' or r->'occurred_on' is distinct from input->'occurred_on') then raise exception 'Allocation result differs from intent/owner.' using errcode='23514';end if;
end $$;
create function app_private.fg_effect(kind text,b jsonb,a jsonb) returns jsonb language sql immutable set search_path='' as $$
 select case when b is not distinct from a then '[]'::jsonb else jsonb_build_array(jsonb_build_object('type',kind,'before',b,'after',a)) end;
$$;
create function app_private.fg_next_revision(p jsonb) returns text language plpgsql immutable set search_path='' as $$ declare n bigint;begin n:=app_private.fg_revision(p);if n=9223372036854775807 then raise exception 'Goal revision exhausted.' using errcode='22023';end if;return (n+1)::text;end $$;
create function app_private.fg_highlight_plan(p_user uuid,b jsonb,desired jsonb,at_text text) returns jsonb language plpgsql immutable set search_path='' as $$ declare a jsonb;begin
 if coalesce(b->'goal_id','null'::jsonb)=desired then return b;end if;
 a:=jsonb_build_object('version',1,'id',p_user,'user_id',p_user,'goal_id',desired,'revision',app_private.fg_next_revision(coalesce(b->'revision','"0"'::jsonb)),'created_at',coalesce(b->'created_at',to_jsonb(at_text)),'updated_at',at_text);return a;
end $$;
create function app_private.fg_expected(p_user uuid,op text,input jsonb,result jsonb,at_text text,today date) returns jsonb language plpgsql security definer set search_path='' as $$
declare b jsonb;a jsonb;h jsonb;next_h jsonb;r jsonb;image jsonb;account public.fin_accounts;totals jsonb;amount bigint;leftover numeric;patch jsonb;expected_result jsonb;effects jsonb:='[]';begin
 perform app_private.fg_result(p_user,op,input,result);
 if op='finance.goal.create' then
  if input->'image_file_id'<>'null'::jsonb then image:=app_private.fg_image(p_user,(input->>'image_file_id')::uuid);if image is null then raise exception 'New goal image is not finalized for this purpose.' using errcode='22023';end if;end if;
  a:=jsonb_build_object('version',1,'id',result#>'{goal,id}','user_id',p_user,'name',app_private.fg_name(input->'name'),'target_cents',input->'target_cents','deadline',input->'deadline','image_file_id',input->'image_file_id','archived_at',null,'revision','0','created_at',at_text,'updated_at',at_text);
  effects:=app_private.fg_effect('finance_goal',null,a);expected_result:=jsonb_build_object('version',1,'goal',a);
 elsif op='finance.goal.release' then
  select payload into r from app_private.finance_goal_reservations where user_id=p_user and id=(input->>'reservation_id')::uuid;if r is null then raise exception 'Owned reservation missing.' using errcode='22023';end if;
  amount:=app_private.fg_number(input->'amount_cents',1);leftover:=(r->>'amount_cents')::numeric-app_private.fg_released(p_user,(r->>'id')::uuid);
  if app_private.fg_day(input->'occurred_on')>today or amount>leftover then raise exception 'Release exceeds current remainder or is future.' using errcode='23514';end if;
  a:=jsonb_build_object('version',1,'id',result#>'{release,id}','user_id',p_user,'reservation_id',input->'reservation_id','amount_cents',amount,'occurred_on',input->'occurred_on','client_id',input->'client_id','created_at',at_text);
  effects:=app_private.fg_effect('finance_goal_release',null,a);expected_result:=jsonb_build_object('version',1,'release',a);
 elsif op='finance.goal.highlight' then
  select payload into h from app_private.finance_goal_highlights where user_id=p_user;
  if coalesce(h->'revision','"0"'::jsonb) is distinct from input->'expected_highlight_revision' then raise exception 'Highlight revision changed.' using errcode='40001';end if;
  if input->'goal_id'<>'null'::jsonb then select payload into b from app_private.finance_goals where user_id=p_user and id=(input->>'goal_id')::uuid;if b is null or b->'archived_at'<>'null'::jsonb then raise exception 'Active owned goal required for highlight.' using errcode='22023';end if;end if;
  next_h:=app_private.fg_highlight_plan(p_user,h,input->'goal_id',at_text);effects:=app_private.fg_effect('finance_goal_highlight',h,next_h);expected_result:=jsonb_build_object('version',1,'highlight',next_h);
 else
  select payload into b from app_private.finance_goals where user_id=p_user and id=(input->>'goal_id')::uuid;if b is null then raise exception 'Owned goal missing.' using errcode='22023';end if;
  if b->'revision' is distinct from input->'expected_revision' then raise exception 'Goal revision changed.' using errcode='40001';end if;
  if op='finance.goal.contribute' then
   select * into account from public.fin_accounts where user_id=p_user and id=(input->>'account_id')::uuid;
   if not found or account.kind='credit_card' or account.currency<>'BRL' or account.archived_at is not null or b->'archived_at'<>'null'::jsonb or app_private.fg_day(input->'occurred_on')>today then raise exception 'Contribution requires active goal and own non-card account.' using errcode='22023';end if;
   amount:=app_private.fg_number(input->'amount_cents',1);totals:=app_private.fg_account_totals(p_user,account.id);
   if (totals->>'real_balance_cents')::numeric-(totals->>'reserved_cents')::numeric<amount then raise exception 'Insufficient unreserved balance.' using errcode='23514';end if;
   perform app_private.fg_cents(app_private.fg_reserved(p_user,null,(b->>'id')::uuid)::numeric+amount);
   a:=jsonb_build_object('version',1,'id',result#>'{reservation,id}','user_id',p_user,'goal_id',input->'goal_id','account_id',input->'account_id','amount_cents',amount,'occurred_on',input->'occurred_on','client_id',input->'client_id','created_at',at_text);
   effects:=app_private.fg_effect('finance_goal_reservation',null,a);expected_result:=jsonb_build_object('version',1,'reservation',a);
  elsif op='finance.goal.update' then
   patch:=input->'patch';if patch ? 'name' then patch:=jsonb_set(patch,'{name}',to_jsonb(app_private.fg_name(patch->'name')));end if;
   if patch ? 'image_file_id' and patch->'image_file_id' is distinct from b->'image_file_id' and patch->'image_file_id'<>'null'::jsonb then image:=app_private.fg_image(p_user,(patch->>'image_file_id')::uuid);if image is null then raise exception 'New goal image proof unavailable.' using errcode='22023';end if;end if;
   a:=b||patch;if a is distinct from b then a:=a||jsonb_build_object('revision',app_private.fg_next_revision(b->'revision'),'updated_at',at_text);end if;
   effects:=app_private.fg_effect('finance_goal',b,a);expected_result:=jsonb_build_object('version',1,'goal',a);
  elsif op in ('finance.goal.archive','finance.goal.restore') then
   select payload into h from app_private.finance_goal_highlights where user_id=p_user;
   a:=jsonb_set(b,'{archived_at}',case when op='finance.goal.restore' then 'null'::jsonb else coalesce(nullif(b->'archived_at','null'::jsonb),to_jsonb(at_text)) end);
   if a is distinct from b then a:=a||jsonb_build_object('revision',app_private.fg_next_revision(b->'revision'),'updated_at',at_text);end if;
   next_h:=case when op='finance.goal.archive' and h->'goal_id'=b->'id' then app_private.fg_highlight_plan(p_user,h,'null'::jsonb,at_text) else h end;
   effects:=app_private.fg_effect('finance_goal',b,a)||app_private.fg_effect('finance_goal_highlight',h,next_h);expected_result:=jsonb_build_object('version',1,'goal',a,'highlight',next_h);
  else raise exception 'Unknown goal plan.' using errcode='22023';end if;
 end if;
 if expected_result is distinct from result then raise exception 'Submitted goal result differs from exact plan.' using errcode='23514';end if;
 return jsonb_build_object('changes',effects,'result',expected_result);
end $$;
do $permissions$ declare f record;begin for f in select oid::regprocedure signature from pg_proc where pronamespace='app_private'::regnamespace and proname like 'fg\_%' escape '\' loop execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);end loop;end $permissions$;


-- INERT. A single exact command/receipt, no callback/write retry.
create function app_private.fg_record(p_user uuid,kind text,p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$ declare row_value jsonb;begin
 if kind='finance_goal' then select payload into row_value from app_private.finance_goals where user_id=p_user and id=p_id;
 elsif kind='finance_goal_reservation' then select payload into row_value from app_private.finance_goal_reservations where user_id=p_user and id=p_id;
 elsif kind='finance_goal_release' then select payload into row_value from app_private.finance_goal_releases where user_id=p_user and id=p_id;
 elsif kind='finance_goal_highlight' then select payload into row_value from app_private.finance_goal_highlights where user_id=p_user and id=p_id;
 else raise exception 'Unknown goal effect type.' using errcode='23514';end if;return row_value;
end $$;
create function app_private.fg_identity_used(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from app_private.finance_goals where id=p_id) or exists(select 1 from app_private.finance_goal_reservations where id=p_id)
  or exists(select 1 from app_private.finance_goal_releases where id=p_id) or exists(select 1 from app_private.finance_goal_highlights where id=p_id)
  or exists(select 1 from public.fin_accounts where id=p_id) or exists(select 1 from public.fin_categories where id=p_id)
  or exists(select 1 from public.fin_tags where id=p_id) or exists(select 1 from public.fin_transactions where id=p_id)
  or exists(select 1 from public.fin_budgets where id=p_id) or exists(select 1 from public.domain_events where id=p_id);
$$;
create function app_private.fg_action(kind text,b jsonb,a jsonb) returns text language sql immutable set search_path='' as $$
 select case when b is null then 'created' when kind='finance_goal' and b->'archived_at' is distinct from a->'archived_at' then 'status_changed' else 'updated' end;
$$;
create function app_private.fg_commit(p_user uuid,p_session uuid,p_operation text,p_request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
<<goal_commit>>
declare input jsonb;context jsonb;receipt jsonb;stored jsonb;change_value jsonb;event_value jsonb;a jsonb;b jsonb;kind text;row_id uuid;n integer;matched integer;at_text text;at_time timestamptz;today date;expected jsonb;ordered_expected jsonb;ordered_submitted jsonb;begin
 -- Parent/session locks -> same financial advisory -> actor/feature. Even a
 -- genuine old receipt never bypasses current Auth/session/Entitlement.
 perform app_private.fg_guard(p_user,p_session);if octet_length(p_request::text)>1048576 then raise exception 'Goal commit exceeds quota.' using errcode='54000';end if;
 perform app_private.fg_object(p_request,array['request','expected_finance_revision','context','changes','events','receipt']);
 input:=app_private.fg_command(p_request->'request');context:=p_request->'context';receipt:=p_request->'receipt';
 perform app_private.fg_object(context,array['user_id','canal']);perform app_private.fg_object(receipt,array['user_id','command','client_id','fingerprint','result']);
 if p_operation is distinct from p_request#>>'{request,command}' or p_request->'expected_finance_revision' is distinct from input->'expected_finance_revision' or context->>'user_id' is distinct from p_user::text or context->>'canal' is distinct from 'web'
  or receipt->>'user_id' is distinct from p_user::text or receipt->>'command' is distinct from p_operation or receipt->'client_id' is distinct from input->'client_id' or jsonb_typeof(receipt->'fingerprint') is distinct from 'string' then raise exception 'Goal envelope outside authenticated intent.' using errcode='42501';end if;
 if (receipt->>'fingerprint')::jsonb is distinct from input then raise exception 'Goal fingerprint differs from exact intent.' using errcode='23505';end if;
 stored:=app_private.fg_saved_receipt(p_user,p_operation,input);
 if stored is not null then
  if stored->'fingerprint' is distinct from receipt->'fingerprint' then raise exception 'Goal fingerprint changed.' using errcode='23505';end if;
  return jsonb_build_object('status','replayed','result',stored->'result');
 end if;
 if app_private.fg_finance_revision(p_user) is distinct from p_request->>'expected_finance_revision' then return jsonb_build_object('status','stale');end if;
 perform app_private.fg_result(p_user,p_operation,input,receipt->'result');
 if jsonb_typeof(p_request->'changes') is distinct from 'array' or jsonb_typeof(p_request->'events') is distinct from 'array' then raise exception 'Goal effect arrays required.' using errcode='23514';end if;
 n:=jsonb_array_length(p_request->'changes');if n>2 or n<>jsonb_array_length(p_request->'events') then raise exception 'Goal effect count differs.' using errcode='23514';end if;
 if exists(select 1 from jsonb_array_elements(p_request->'changes') c(value) group by c.value#>>'{after,id}' having count(*)>1)
  or exists(select 1 from jsonb_array_elements(p_request->'events') e(value) group by e.value->>'id' having count(*)>1)
  or exists(select 1 from jsonb_array_elements(p_request->'changes') c(value) join jsonb_array_elements(p_request->'events') e(value) on c.value#>'{after,id}'=e.value->'id') then raise exception 'Goal effect/event identity reused.' using errcode='23514';end if;
 for change_value in select value from jsonb_array_elements(p_request->'changes') loop
  perform app_private.fg_object(change_value,array['type','before','after']);kind:=change_value->>'type';a:=change_value->'after';b:=nullif(change_value->'before','null'::jsonb);perform app_private.fg_row(kind,a);row_id:=app_private.fg_uuid(a->'id');
  if a->>'user_id' is distinct from p_user::text or b is not null and (b->'id' is distinct from a->'id' or b->>'user_id' is distinct from p_user::text or b->'created_at' is distinct from a->'created_at') then raise exception 'Goal owner/id/creation changed.' using errcode='42501';end if;
  if app_private.fg_record(p_user,kind,row_id) is distinct from b then raise exception 'Goal BEFORE changed.' using errcode='40001';end if;
  if b is null and app_private.fg_identity_used(row_id) then raise exception 'New goal identity already used.' using errcode='23505';end if;
 end loop;
 today:=(clock_timestamp() at time zone 'America/Sao_Paulo')::date;
 if n>0 then at_text:=p_request#>>'{events,0,occurred_at}';at_time:=app_private.capture_task_timestamp(to_jsonb(at_text));
  if abs(extract(epoch from(clock_timestamp()-at_time)))>=300 or (at_time at time zone 'America/Sao_Paulo')::date<>today then raise exception 'Goal server clock requires review.' using errcode='40001';end if;
 else at_text:=to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');end if;
 expected:=app_private.fg_expected(p_user,p_operation,input,receipt->'result',at_text,today);
 select coalesce(jsonb_agg(c.value order by c.value->>'type',c.value#>>'{after,id}'),'[]') into ordered_expected from jsonb_array_elements(expected->'changes') c(value);
 select coalesce(jsonb_agg(c.value order by c.value->>'type',c.value#>>'{after,id}'),'[]') into ordered_submitted from jsonb_array_elements(p_request->'changes') c(value);
 if ordered_expected is distinct from ordered_submitted then raise exception 'Goal changes omit/add/alter exact effects.' using errcode='23514';end if;
 for change_value in select value from jsonb_array_elements(expected->'changes') loop
  select count(*) into matched from jsonb_array_elements(p_request->'events') e(value) where e.value->>'entity_type'=change_value->>'type' and e.value->'entity_id'=change_value#>'{after,id}' and e.value->'before' is not distinct from change_value->'before' and e.value->'after'=change_value->'after';
  if matched<>1 then raise exception 'Exact goal event required for each effect.' using errcode='23514';end if;
 end loop;
 for event_value in select value from jsonb_array_elements(p_request->'events') loop
  perform app_private.fg_object(event_value,array['id','user_id','entity_type','entity_id','action','canal','occurred_at','before','after']);perform app_private.fg_uuid(event_value->'id');perform app_private.fg_uuid(event_value->'entity_id');
  if app_private.fg_identity_used((event_value->>'id')::uuid) then raise exception 'Goal event id already used.' using errcode='23505';end if;
  if event_value->>'user_id' is distinct from p_user::text or event_value->'canal' is distinct from context->'canal' or event_value->>'occurred_at' is distinct from at_text or event_value->>'action' is distinct from app_private.fg_action(event_value->>'entity_type',nullif(event_value->'before','null'::jsonb),event_value->'after') then raise exception 'Goal event metadata differs.' using errcode='23514';end if;
 end loop;
 if not (app_private.consume_rate_limit_at('capture_task_write',encode(sha256(convert_to(p_user::text,'UTF8')),'hex'),p_user,null)->>'allowed')::boolean then raise exception 'Goal write rate reached.' using errcode='PT429';end if;
 for change_value in select value from jsonb_array_elements(expected->'changes') loop
  kind:=change_value->>'type';a:=change_value->'after';b:=nullif(change_value->'before','null'::jsonb);row_id:=app_private.fg_uuid(a->'id');
  if kind='finance_goal' then
   if b is null then insert into app_private.finance_goals(payload) values(a);else update app_private.finance_goals set payload=a where user_id=p_user and id=goal_commit.row_id;end if;
  elsif kind='finance_goal_highlight' then
   if b is null then insert into app_private.finance_goal_highlights(payload) values(a);else update app_private.finance_goal_highlights set payload=a where user_id=p_user and id=goal_commit.row_id;end if;
  elsif kind='finance_goal_reservation' then
   if b is not null then raise exception 'Reservation update refused.' using errcode='42501';end if;insert into app_private.finance_goal_reservations(payload) values(a);
  elsif kind='finance_goal_release' then
   if b is not null then raise exception 'Release update refused.' using errcode='42501';end if;insert into app_private.finance_goal_releases(payload) values(a);
  end if;
  if app_private.fg_record(p_user,kind,row_id) is distinct from a then raise exception 'Goal projection differs from effect.' using errcode='23514';end if;
 end loop;
 set constraints all immediate;
 for event_value in select value from jsonb_array_elements(p_request->'events') loop
  insert into public.domain_events(id,user_id,entity_type,entity_id,action,canal,occurred_at,before,after) values((event_value->>'id')::uuid,p_user,event_value->>'entity_type',(event_value->>'entity_id')::uuid,event_value->>'action',event_value->>'canal',app_private.capture_task_timestamp(event_value->'occurred_at'),nullif(event_value->'before','null'::jsonb),event_value->'after');
 end loop;
 insert into app_private.command_receipts(user_id,command,client_id,request,result) values(p_user,p_operation,input->>'client_id',receipt->'fingerprint',expected->'result');
 return jsonb_build_object('status','committed','result',expected->'result');
end $$;
create function public.finance_goals_commit(p_user uuid,p_session uuid,p_operation text,p_request jsonb) returns jsonb language sql security definer set search_path='' as $$ select app_private.fg_commit(p_user,p_session,p_operation,p_request); $$;
revoke all on function public.finance_goals_commit(uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.finance_goals_commit(uuid,uuid,text,jsonb) to service_role;
do $permissions$ declare f record;begin for f in select oid::regprocedure signature from pg_proc where pronamespace='app_private'::regnamespace and proname like 'fg\_%' escape '\' loop execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);end loop;end $permissions$;


-- INERT. Never replace historical source with an older wrapper/filter.
-- B2 already narrows the v1 snapshot. This package only verifies its exact
-- post-B2 canonical prosrc (derived from Git, not a hosted observation). No
-- CREATE OR REPLACE of finance_snapshot or fsv2_ledger_guard occurs here.
do $existing_source_gate$ declare p record;begin
 select f.prosrc,f.prosecdef,f.proconfig,r.rolname into strict p from pg_proc f join pg_roles r on r.oid=f.proowner where f.oid='app_private.finance_snapshot(uuid,uuid,text)'::regprocedure;
 if encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')<>'3bc2076d42fcfe1d140cf24783de5acd679c52d5ddd47db68ba550a96300f3fb' or not p.prosecdef or p.rolname<>'postgres' or p.proconfig is distinct from array['search_path=""']::text[] then raise exception 'Consolidated Finance snapshot source differs; compose explicitly before installing Goals.' using errcode='23514';end if;
end $existing_source_gate$;
create function app_private.fg_account_close_guard() returns trigger language plpgsql security definer set search_path='' as $$ begin
 -- The existing BEFORE finance_project validates payload, projects NEW and
 -- preserves owner/id/kind. This trigger sorts AFTER it, without rewriting it.
 -- Existing archived accounts are not retroactively rejected or changed.
 if old.archived_at is null and new.archived_at is not null then
  perform app_private.capture_task_lock(new.user_id);
  if app_private.fg_reserved(new.user_id,new.id,null)>0 then raise exception 'Release the account reservations before closing it.' using errcode='23514';end if;
 end if;return new;
end $$;
create trigger finance_reserved_balance_guard before update on public.fin_accounts for each row execute function app_private.fg_account_close_guard();
-- Prove catalog attachment/order rather than relying only on the function name.
do $trigger_gate$ declare names text[];begin
 select array_agg(tgname order by tgname) into names from pg_trigger where tgrelid='public.fin_accounts'::regclass and not tgisinternal and (tgtype&1)=1 and (tgtype&2)=2 and (tgtype&16)=16;
 if array_position(names,'finance_project') is null or array_position(names,'finance_reserved_balance_guard') is null or array_position(names,'finance_project')>=array_position(names,'finance_reserved_balance_guard') then raise exception 'Account projection must run before reservation-close guard.' using errcode='23514';end if;
end $trigger_gate$;
revoke all on function app_private.fg_account_close_guard() from public,anon,authenticated,service_role;


-- INERT E1 companion: no canonical migration, Storage action or hosted rollout.
set local lock_timeout='5s';set local statement_timeout='60s';
-- These hashes derive from Git source bodies, never from a hosted observation.
-- Preserve the complete 023 holder chain, the original financial projection and
-- all existing public wrappers/guards. Unknown compositions must be reconciled.
do $foundation_gate$ declare f record;expected record;candidate text;ack text;begin
 if current_user<>'postgres' or to_regclass('app_private.finance_goals') is null
  or to_regclass('public.drive_files') is null or to_regclass('app_private.upload_reservations') is null then
  raise exception 'Reviewed Goals and private file foundations required.' using errcode='23514';end if;
 for expected in select * from (values
  ('app_private.fg_image(uuid,uuid)','e46b26e5d181a72ec813c0b8b31c2b4c6e286de70ff83c88f9daaded41e069b8'),
  ('app_private.fg_project()','37a3879a3b7447cce65f8e8aff0a775afcc576e9721cf765898a4165999292f8'),
  ('app_private.entity_image_referenced(uuid,uuid)','6ebe4715384343de1aabe797db1abe89faa5de3600a72bdf4473be68dd871ac4'),
  ('app_private.require_entity_image(uuid,uuid,text)','f5fdb013e2101f86bf8e0cb5f4b855783881e24cfc35a0312a2836baba759f67')
 ) reviewed(signature,sha) loop
  select p.oid,p.prosrc,p.prosecdef,p.proconfig,r.rolname into strict f from pg_proc p join pg_roles r on r.oid=p.proowner where p.oid=to_regprocedure(expected.signature);
  if encode(sha256(convert_to(f.prosrc,'UTF8')),'hex')<>expected.sha or not f.prosecdef or f.rolname<>'postgres'
   or f.proconfig is distinct from array['search_path=""']::text[]
   or has_function_privilege('anon',f.oid,'EXECUTE') or has_function_privilege('authenticated',f.oid,'EXECUTE') or has_function_privilege('service_role',f.oid,'EXECUTE') then
   raise exception 'Goal image foundation source or authority differs.' using errcode='23514';end if;
 end loop;
 if not exists(select 1 from pg_trigger where tgrelid='app_private.finance_goals'::regclass and tgname='goal_project'
  and not tgisinternal and tgfoid='app_private.fg_project()'::regprocedure and tgtype=31 and tgenabled='O'
  and tgqual is null and tgattr=''::int2vector and tgargs=''::bytea) then
  raise exception 'Reviewed active Goal projection trigger required.' using errcode='23514';end if;
 if not (select relrowsecurity from pg_class where oid='app_private.finance_goals'::regclass)
  or has_table_privilege('anon','app_private.finance_goals','SELECT,INSERT,UPDATE,DELETE')
  or has_table_privilege('authenticated','app_private.finance_goals','SELECT,INSERT,UPDATE,DELETE')
  or has_table_privilege('service_role','app_private.finance_goals','SELECT,INSERT,UPDATE,DELETE') then
  raise exception 'Goals must remain private with RLS.' using errcode='23514';end if;
 select prosrc into strict candidate from pg_proc where oid='app_private.file_cleanup_candidates()'::regprocedure;
 select prosrc into strict ack from pg_proc where oid='app_private.file_cleanup_ack(uuid)'::regprocedure;
 if strpos(candidate,'not app_private.entity_image_referenced(r.user_id,f.id)')=0
  or strpos(candidate,'not app_private.entity_image_referenced(reservation.user_id,file_row.id)')=0
  or strpos(ack,'not app_private.entity_image_referenced(reservation.user_id,reservation.file_id)')=0 then
  raise exception 'Cleanup must protect every holder at selection, recheck and ACK.' using errcode='23514';end if;
 -- The old fail-closed boundary cannot have legitimately created non-null images.
 -- Do not silently backfill legacy metadata, emit unmatched events or move money.
 if exists(select 1 from app_private.finance_goals where payload->'image_file_id' is distinct from 'null'::jsonb) then
  raise exception 'Existing non-null Goal image needs explicit data review.' using errcode='23514';end if;
end $foundation_gate$;

alter table app_private.finance_goals add column image_file_id uuid;
alter table app_private.finance_goals add constraint finance_goals_image_payload_match check(image_file_id is not distinct from (payload->>'image_file_id')::uuid);
alter table app_private.finance_goals add constraint finance_goals_image_owner_fk foreign key(user_id,image_file_id) references public.drive_files(user_id,id) deferrable initially deferred;
create index finance_goals_owner_image on app_private.finance_goals(user_id,image_file_id) where image_file_id is not null;

-- Runs after goal_project has validated/projected NEW and acquired the shared
-- capture-task:<owner> transaction lock. Cleanup and all financial commits use
-- that same lock. No image check trusts a prior remote snapshot alone.
create function app_private.fgi_project() returns trigger language plpgsql security definer set search_path='' as $$
begin
 new.image_file_id:=(new.payload->>'image_file_id')::uuid;
 if tg_op='INSERT' or new.image_file_id is distinct from old.image_file_id then
  if new.image_file_id is not null and app_private.fg_image(new.user_id,new.image_file_id) is null then
   raise exception 'Finalized owner Goal image required.' using errcode='23514';end if;
 end if;
 return new;
end $$;
create trigger goal_z_image_binding before insert or update on app_private.finance_goals for each row execute function app_private.fgi_project();
do $projection_order$ declare names text[];expected record;begin
 for expected in select * from (values('goal_project','app_private.fg_project()'::regprocedure,31),('goal_z_image_binding','app_private.fgi_project()'::regprocedure,23)) reviewed(name,fn,kind) loop
  if not exists(select 1 from pg_trigger where tgrelid='app_private.finance_goals'::regclass and tgname=expected.name
   and not tgisinternal and tgfoid=expected.fn and tgtype=expected.kind and tgenabled='O'
   and tgqual is null and tgattr=''::int2vector and tgargs=''::bytea) then
   raise exception 'Reviewed active Goal image trigger composition required.' using errcode='23514';end if;
 end loop;
 select array_agg(tgname order by tgname) into names from pg_trigger where tgrelid='app_private.finance_goals'::regclass and not tgisinternal and (tgtype&1)=1 and (tgtype&2)=2 and (tgtype&4)=4 and (tgtype&16)=16;
 if array_position(names,'goal_project') is null or array_position(names,'goal_z_image_binding') is null or array_position(names,'goal_project')>=array_position(names,'goal_z_image_binding') then
  raise exception 'Goal projection/lock must precede image binding.' using errcode='23514';end if;
end $projection_order$;

-- Preserve every existing holder, including archived Habits and Capturar pages.
-- One additional indexed holder protects live and archived Goals alike.
do $preserve_holders$ declare definition text;begin
 if to_regprocedure('app_private.fgi_previous_image_referenced(uuid,uuid)') is not null then raise exception 'Goal image companion already composed.' using errcode='23514';end if;
 select pg_get_functiondef('app_private.entity_image_referenced(uuid,uuid)'::regprocedure) into strict definition;
 execute replace(definition,'FUNCTION app_private.entity_image_referenced(','FUNCTION app_private.fgi_previous_image_referenced(');
end $preserve_holders$;
create or replace function app_private.entity_image_referenced(p_user uuid,p_file uuid) returns boolean language sql stable security definer set search_path='' as $$
 select app_private.fgi_previous_image_referenced(p_user,p_file)
  or exists(select 1 from app_private.finance_goals g where g.user_id=p_user and g.image_file_id=p_file);
$$;

-- Installed LAST in the same transaction as the FK/projection/holder. The
-- existing Core/oracle already consult this exact private lookup for new links.
create or replace function app_private.fg_image(p_user uuid,p_file uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;begin
 if p_user is null or p_file is null then return null;end if;
 begin perform app_private.require_entity_image(p_user,p_file,'finance_goal_image');
 exception when check_violation then return null;end;
 select jsonb_build_object('id',f.id,'user_id',f.user_id,'purpose','finance_goal_image','status','finalized','deleted_at',null) into result
 from public.drive_files f where f.user_id=p_user and f.id=p_file and f.kind='finance_goal_image'
  and f.deleted_at is null and f.purged_at is null and f.folder_id is null and f.mime in ('image/png','image/jpeg')
  and f.bytes between 1 and 8388608 and f.width>0 and f.height>0 and f.width::bigint*f.height::bigint<=24000000
  and exists(select 1 from app_private.upload_reservations r where r.user_id=f.user_id and r.file_id=f.id and r.id=f.id and r.kind='finance_goal_image' and r.status='finalized');
 return result;
end $$;
revoke all on function app_private.fgi_project(),app_private.fgi_previous_image_referenced(uuid,uuid),app_private.entity_image_referenced(uuid,uuid),app_private.fg_image(uuid,uuid) from public,anon,authenticated,service_role;
comment on column app_private.finance_goals.image_file_id is 'Optional finalized private finance_goal_image; archived Goals retain the reference. Payload projection, never a separate binding command.';
-- No grants, public RPCs, bucket/policy changes, finance wrappers or historical
-- source rewrites. Promotion must wrap the whole reviewed companion atomically.


-- INERT M1. No canonical migration, HTTP, rollout or restore authorization.
set local lock_timeout='5s';set local statement_timeout='60s';

-- These hashes are derived from the reviewed public Git sources, not a server.
-- Copy the exact old body; replacing its original identity keeps SQL/planned
-- callers bound to the fenced OID. Do NOT rename the old function away.
do $source_gate$ declare expected record;p record;old_body text;begin
 if current_user<>'postgres' then raise exception 'Terminal owner differs.' using errcode='42501';end if;
 for expected in select * from (values
    ('app_private.fg_commit(uuid,uuid,text,jsonb)','86377bc8865a571c950eea05596531890225f19131c44f5a839c282e679c5ebf'),
  ('app_private.fg_guard(uuid,uuid)','ee8f8f9e611ca8e01279d190311e92c94ee66c9dee4a9741c56e4c916c59a32f'),
  ('public.finance_goals_commit(uuid,uuid,text,jsonb)','498c676f3a28e20e597d4a8c0b62b37811b41a82844f59b32b389d6a31292c6e'),
  ('public.finance_goals_snapshot(uuid,uuid,jsonb)','0fc54ebc025d0f8044eaad3dc31701e39f56fedd84731a5c6b3b8fa8d9953d08'),
  ('public.finance_goals_page(uuid,uuid,uuid,integer,text)','681ecbb4732a5b611c8fb3140b5ebf8754f154feec73181c007da2014ced08c2'),
  ('public.finance_goal_detail(uuid,uuid,uuid)','d344fe3d17f1845b7a92a17fb2be524b825bff776a890dfee51ef829efe73395'),
  ('public.finance_goal_reservations_page(uuid,uuid,uuid,jsonb,integer)','2cd3678d6cb314a1b6d8cf5a859de3e1439263bebccdae332af5799dd405d613'),
  ('public.finance_goal_releases_page(uuid,uuid,uuid,jsonb,integer)','da67dda4bd5e532b9f92c02ceb365799885a8c5555803933bf8f1a592c83f05e')
 ) as pins(signature,sha256) loop
  select f.oid,f.prosrc,f.proowner,f.proacl,f.prosecdef,f.proconfig,f.provolatile,f.proisstrict,f.proretset,f.prokind,f.prorettype,l.lanname,r.rolname into strict p from pg_proc f join pg_roles r on r.oid=f.proowner join pg_language l on l.oid=f.prolang where f.oid=expected.signature::regprocedure;
  if encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')<>expected.sha256 or not p.prosecdef or p.rolname<>'postgres' or p.proconfig is distinct from array['search_path=""']::text[] or p.provolatile<>'v' or p.proisstrict or p.proretset or p.prokind<>'f'
   or p.lanname<>(case when expected.signature like 'public.%' then 'sql' else 'plpgsql' end)
   or p.prorettype<>(case when expected.signature='app_private.fg_guard(uuid,uuid)' then 'void'::regtype else 'jsonb'::regtype end)
   or exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where a.grantor<>p.proowner or a.privilege_type<>'EXECUTE' or (a.grantee<>p.proowner and not(expected.signature like 'public.%' and a.grantee='service_role'::regrole and not a.is_grantable)))
   or (expected.signature like 'public.%' and not has_function_privilege('service_role',p.oid,'EXECUTE')) then raise exception 'Reviewed terminal prerequisite differs.' using errcode='23514';end if;
 end loop;
 if to_regprocedure('app_private.fg_terminal_previous_commit(uuid,uuid,text,jsonb)') is not null then raise exception 'Terminal foundation already present.' using errcode='23514';end if;
 select prosrc into strict old_body from pg_proc where oid='app_private.fg_commit(uuid,uuid,text,jsonb)'::regprocedure;
 execute format('create function app_private.fg_terminal_previous_commit(p_user uuid,p_session uuid,p_operation text,p_request jsonb) returns jsonb language plpgsql security definer set search_path='''' as %L',old_body);
end $source_gate$;

create function app_private.fgt_command(p_command text) returns boolean language sql immutable set search_path='' as $$
 select coalesce(p_command in ('finance.goal.create','finance.goal.update','finance.goal.archive','finance.goal.restore','finance.goal.highlight','finance.goal.contribute','finance.goal.release'),false);
$$;

-- Protocol V2: the trusted SERVER Core decoder/canonicalizer owns inner shape
-- and its namespace binding. SQL validates ONLY the closed outer envelope and
-- actor namespace. canonical_input is opaque transient text, not parsed JSON.
-- The refuted V1 json_each/json extraction helper is deliberately not present.
create function app_private.fgt_request(p jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare canonical text;op text;client uuid;begin
 if p is null or octet_length(p::text)>262144 then raise exception 'Terminal envelope exceeds quota.' using errcode='54000';end if;
 perform app_private.fg_object(p,array['version','canonicalization_version','command','client_id','canonical_input']);
 if p->'version' is distinct from '2'::jsonb or p->'canonicalization_version' is distinct from '1'::jsonb or jsonb_typeof(p->'command') is distinct from 'string' or not app_private.fgt_command(p->>'command') or jsonb_typeof(p->'canonical_input') is distinct from 'string' then raise exception 'Terminal version/command differs.' using errcode='22023';end if;
 client:=app_private.fg_uuid(p->'client_id');canonical:=p->>'canonical_input';op:=p->>'command';
 if octet_length(canonical)>65536 then raise exception 'Terminal input exceeds quota.' using errcode='54000';end if;
 if octet_length(canonical)=0 then raise exception 'Terminal input is empty.' using errcode='22023';end if;
 return jsonb_build_object('version',2,'command',op,'client_id',client::text,'canonicalization_version',1,'input_digest',encode(sha256(convert_to(canonical,'UTF8')),'hex'));
end $$;

create table app_private.finance_goal_dispositions(
 user_id uuid not null references auth.users(id) on delete cascade,command text not null check(app_private.fgt_command(command)),client_id text not null check(client_id~'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'),
 id uuid not null unique default gen_random_uuid(),version integer not null default 2 check(version=2),canonicalization_version integer not null check(canonicalization_version=1),input_digest bytea not null check(octet_length(input_digest)=32),closed_at timestamptz not null default date_trunc('milliseconds',clock_timestamp()),primary key(user_id,command,client_id)
);
alter table app_private.finance_goal_dispositions enable row level security;
revoke all on app_private.finance_goal_dispositions from public,anon,authenticated,service_role;
comment on table app_private.finance_goal_dispositions is 'Permanent command fence until Auth identity cascade. No request/result, temporal pruning or browser grants. Restore must preserve fences or reject old generations before activation.';
create function app_private.fgt_disposition(p app_private.finance_goal_dispositions) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('version',p.version,'id',p.id,'user_id',p.user_id,'command',p.command,'client_id',p.client_id,'canonicalization_version',p.canonicalization_version,'input_digest',encode(p.input_digest,'hex'),'closed_at',to_char(p.closed_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
$$;
create function app_private.fgt_disposition_guard() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if tg_op='DELETE' then if not exists(select 1 from auth.users where id=old.user_id) then return old;end if;raise exception 'Terminal fence cannot expire.' using errcode='42501';end if;
 if tg_op<>'INSERT' then raise exception 'Terminal fence is immutable.' using errcode='42501';end if;
 perform app_private.capture_task_lock(new.user_id);
 if exists(select 1 from app_private.command_receipts where user_id=new.user_id and command=new.command and client_id=new.client_id) then raise exception 'Terminal receipt already exists.' using errcode='23505';end if;return new;
end $$;
create trigger goal_terminal_disposition_guard before insert or update or delete on app_private.finance_goal_dispositions for each row execute function app_private.fgt_disposition_guard();
create function app_private.fgt_receipt_guard() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if tg_op='DELETE' then if app_private.fgt_command(old.command) and exists(select 1 from auth.users where id=old.user_id) then raise exception 'Goal receipt cannot reopen its namespace.' using errcode='42501';end if;return old;end if;
 if tg_op='UPDATE' and (app_private.fgt_command(old.command) or app_private.fgt_command(new.command)) then raise exception 'Goal receipt is immutable.' using errcode='42501';end if;
 if app_private.fgt_command(new.command) then
  perform app_private.capture_task_lock(new.user_id);
  if exists(select 1 from app_private.finance_goal_dispositions where user_id=new.user_id and command=new.command and client_id=new.client_id) then raise exception 'Goal attempt is permanently closed.' using errcode='23505';end if;
 end if;return new;
end $$;
create trigger goal_terminal_receipt_guard before insert or update or delete on app_private.command_receipts for each row execute function app_private.fgt_receipt_guard();

-- Preserve the full preexisting CHECK; append one metadata-only event species.
do $event_types$ declare expression text;begin
 select pg_get_expr(conbin,conrelid) into strict expression from pg_constraint where conrelid='public.domain_events'::regclass and conname='domain_events_entity_type_check';
 alter table public.domain_events drop constraint domain_events_entity_type_check;
 execute format('alter table public.domain_events add constraint domain_events_entity_type_check check ((%s) or entity_type=''finance_goal_disposition'')',expression);
end $event_types$;
create function app_private.fgt_event() returns trigger language plpgsql security definer set search_path='' as $$ begin
 insert into public.domain_events(user_id,entity_type,entity_id,action,canal,occurred_at,before,after) values(new.user_id,'finance_goal_disposition',new.id,'created','web',new.closed_at,null,app_private.fgt_disposition(new));return new;
end $$;
create trigger goal_terminal_event after insert on app_private.finance_goal_dispositions for each row execute function app_private.fgt_event();

-- Shared read path: fg_guard preserves parent/session locks -> common financial
-- lock -> current actor/Entitlement even for a genuine old receipt. No writes.
create function app_private.fgt_status_locked(p_user uuid,p_request jsonb,p_binding jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare receipt app_private.command_receipts;closed app_private.finance_goal_dispositions;found_receipt boolean;found_closed boolean;canonical text:=p_request->>'canonical_input';stored_fingerprint text;input jsonb;begin
 select * into receipt from app_private.command_receipts where user_id=p_user and command=p_binding->>'command' and client_id=p_binding->>'client_id';found_receipt:=found;
 select * into closed from app_private.finance_goal_dispositions where user_id=p_user and command=p_binding->>'command' and client_id=p_binding->>'client_id';found_closed:=found;
 if found_receipt and found_closed then raise exception 'Contradictory goal terminal state.' using errcode='23514';end if;
 if found_receipt then
  if jsonb_typeof(receipt.request) is distinct from 'string' or receipt.request#>>'{}' is distinct from canonical then raise exception 'Terminal receipt fingerprint differs.' using errcode='23505';end if;
  -- Only after exact STRING equality parse the STORED receipt fingerprint.
  -- A legitimate financial receipt passed the old JSONB executor. Corruption
  -- (including an unrepresentable stored fingerprint) must fail, not close.
  stored_fingerprint:=receipt.request#>>'{}';
  input:=app_private.fg_command(jsonb_build_object('command',p_binding->'command','input',stored_fingerprint::jsonb));
  if input->>'client_id' is distinct from p_binding->>'client_id' then raise exception 'Stored receipt namespace differs.' using errcode='23505';end if;
  perform app_private.fg_result(p_user,p_binding->>'command',input,receipt.result);
  return jsonb_build_object('version',2,'kind','confirmed','binding',p_binding,'result',receipt.result);
 end if;
 if found_closed then
  if closed.version<>2 or closed.canonicalization_version<>1 or encode(closed.input_digest,'hex') is distinct from p_binding->>'input_digest' then raise exception 'Terminal namespace bound to another intention.' using errcode='23505';end if;
  return jsonb_build_object('version',2,'kind','closed','binding',p_binding,'disposition',app_private.fgt_disposition(closed));
 end if;return jsonb_build_object('version',2,'kind','uncertain','binding',p_binding);
end $$;
create function app_private.fgt_status(p_user uuid,p_session uuid,p_request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$ declare binding jsonb;begin
 perform app_private.fg_guard(p_user,p_session);binding:=app_private.fgt_request(p_request)||jsonb_build_object('user_id',p_user);
 return app_private.fgt_status_locked(p_user,p_request,binding);
end $$;
create function app_private.fgt_settle(p_user uuid,p_session uuid,p_request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$ declare binding jsonb;state jsonb;closed app_private.finance_goal_dispositions;begin
 perform app_private.fg_guard(p_user,p_session);binding:=app_private.fgt_request(p_request)||jsonb_build_object('user_id',p_user);state:=app_private.fgt_status_locked(p_user,p_request,binding);
 if state->>'kind'<>'uncertain' then return state;end if;
 -- Root delta to frozen M1 V2: only a new permanent fence consumes the
 -- existing shared Goal-write quota (30/min); reads and replay stay free.
 if not (app_private.consume_rate_limit_at('capture_task_write',encode(sha256(convert_to(p_user::text,'UTF8')),'hex'),p_user,null)->>'allowed')::boolean then raise exception 'Goal write rate reached.' using errcode='PT429';end if;
 insert into app_private.finance_goal_dispositions(user_id,command,client_id,canonicalization_version,input_digest) values(p_user,binding->>'command',binding->>'client_id',1,decode(binding->>'input_digest','hex')) returning * into closed;
 return jsonb_build_object('version',2,'kind','closed','binding',binding,'disposition',app_private.fgt_disposition(closed));
end $$;

create or replace function app_private.fg_commit(p_user uuid,p_session uuid,p_operation text,p_request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare input jsonb;has_receipt boolean;has_closed boolean;begin
 perform app_private.fg_guard(p_user,p_session);
 if p_request is null or octet_length(p_request::text)>1048576 then raise exception 'Goal commit exceeds quota.' using errcode='54000';end if;
 perform app_private.fg_object(p_request,array['request','expected_finance_revision','context','changes','events','receipt']);input:=app_private.fg_command(p_request->'request');
 if p_operation is distinct from p_request#>>'{request,command}' then raise exception 'Goal operation differs.' using errcode='42501';end if;
 select exists(select 1 from app_private.command_receipts where user_id=p_user and command=p_operation and client_id=input->>'client_id'),exists(select 1 from app_private.finance_goal_dispositions where user_id=p_user and command=p_operation and client_id=input->>'client_id') into has_receipt,has_closed;
 if has_receipt and has_closed then raise exception 'Contradictory goal terminal state.' using errcode='23514';end if;
 if has_receipt then return app_private.fg_terminal_previous_commit(p_user,p_session,p_operation,p_request);end if;
 -- Absolute namespace fence, regardless of hash/body/version/CAS. Never call
 -- the old executor or allocate effects/IDs before this refusal.
 if has_closed then raise exception 'Goal attempt is permanently closed.' using errcode='23505';end if;
 return app_private.fg_terminal_previous_commit(p_user,p_session,p_operation,p_request);
end $$;
create function public.finance_goal_attempt_status(p_user uuid,p_session uuid,p_request jsonb) returns jsonb language sql security definer set search_path='' as $$ select app_private.fgt_status(p_user,p_session,p_request); $$;
create function public.finance_goal_attempt_settle(p_user uuid,p_session uuid,p_request jsonb) returns jsonb language sql security definer set search_path='' as $$ select app_private.fgt_settle(p_user,p_session,p_request); $$;
revoke all on function public.finance_goal_attempt_status(uuid,uuid,jsonb),public.finance_goal_attempt_settle(uuid,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.finance_goal_attempt_status(uuid,uuid,jsonb),public.finance_goal_attempt_settle(uuid,uuid,jsonb) to service_role;
-- CREATE OR REPLACE preserves the old OID AND its closed ACL; reassert it too.
revoke all on function app_private.fg_commit(uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;
do $permissions$ declare f record;begin for f in select oid::regprocedure signature from pg_proc where pronamespace='app_private'::regnamespace and (proname like 'fgt\_%' escape '\' or proname='fg_terminal_previous_commit') loop execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);end loop;end $permissions$;

commit;
