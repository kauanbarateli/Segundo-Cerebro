-- INERT M1. No canonical migration, HTTP, rollout or restore authorization.
do $draft_only$ begin raise exception 'DRAFT_ONLY: terminal fences require codec, native races and recovery-preservation gates.';end $draft_only$;
begin;
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
rollback;
