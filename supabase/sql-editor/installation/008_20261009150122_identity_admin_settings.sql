-- T017 administrative MVP. Prepared only; manual application remains deferred.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
do $$ begin
 if current_user<>'postgres' or to_regclass('auth.sessions') is null or to_regclass('auth.refresh_tokens') is null or to_regclass('public.user_moderation') is null then raise exception 'Review identity/Auth schema before applying T017.'; end if;
 if not exists(select 1 from information_schema.columns where table_schema='auth' and table_name='refresh_tokens' and column_name='user_id') then raise exception 'Auth refresh-token owner column unavailable.'; end if;
end $$;
create table app_private.admin_operations (
 operation_id uuid primary key default gen_random_uuid(), actor_user_id uuid not null, target_user_id uuid not null,
 command text not null check(command in ('admin.user.create','admin.user.block','admin.user.unblock','admin.user.force_password','admin.user.role','admin.user.entitlement')),
 client_id text not null check(char_length(btrim(client_id)) between 1 and 200), commitment text not null check(commitment~'^[a-f0-9]{64}$'),
 phase text not null check(phase in ('reserved','auth_applied','revoked','complete','needs_reconciliation')),
 role text check(role in ('user','master')), feature_key text, allowed boolean,
 prior_status text not null check(prior_status in ('active','blocked')), prior_must_change_password boolean not null,
 active_execution uuid,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(actor_user_id,command,client_id)
);
create unique index admin_operation_pending_target_idx on app_private.admin_operations(target_user_id) where phase<>'complete';
create table public.admin_audit_events (
 id uuid primary key default gen_random_uuid(), actor_user_id uuid not null, target_user_id uuid not null, operation_id uuid not null,
 action text not null check(action in ('admin.user.create','admin.user.block','admin.user.unblock','admin.user.force_password','admin.user.role','admin.user.entitlement')),
 phase text not null check(phase in ('reserved','auth_applied','revoked','complete','needs_reconciliation')), occurred_at timestamptz not null default now()
);
create index admin_audit_order_idx on public.admin_audit_events(occurred_at desc,id desc);
alter table app_private.admin_operations enable row level security;
alter table public.admin_audit_events enable row level security;
revoke all on app_private.admin_operations,public.admin_audit_events from public,anon,authenticated,service_role;

create function app_private.admin_master_lock() returns void language sql security definer set search_path='' as $$
 select pg_advisory_xact_lock(hashtextextended('second-brain:usable-masters',0));
$$;
create function app_private.admin_require_master(p_actor uuid,p_session uuid) returns void language plpgsql security definer set search_path='' as $$ begin
 perform app_private.admin_master_lock();
 perform 1 from auth.users where id=p_actor for share;
 perform 1 from auth.sessions where id=p_session and user_id=p_actor for share;
 perform app_private.capture_task_lock(p_actor);
 perform app_private.require_actor(p_actor,p_session);
 if not exists(select 1 from public.user_roles where user_id=p_actor and role='master') or exists(select 1 from public.user_entitlements where user_id=p_actor and feature_key='admin' and not allowed) then raise exception 'Master required.' using errcode='42501'; end if;
end $$;
create function app_private.admin_usable_master(p_user uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users u join public.user_roles r on r.user_id=u.id join public.user_moderation m on m.user_id=u.id
 where u.id=p_user and r.role='master' and m.status='active' and not m.must_change_password and not u.is_anonymous and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now())
 and not exists(select 1 from public.user_entitlements where user_id=u.id and feature_key='admin' and not allowed));
$$;
create function app_private.admin_preserve_master(p_target uuid) returns void language plpgsql security definer set search_path='' as $$ begin
 if app_private.admin_usable_master(p_target) and not exists(select 1 from public.user_roles where role='master' and user_id<>p_target and app_private.admin_usable_master(user_id)) then raise exception 'Last usable master is protected.' using errcode='23514'; end if;
end $$;
create function app_private.admin_operation_json(p app_private.admin_operations) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('operation_id',p.operation_id,'client_id',p.client_id,'actor_user_id',p.actor_user_id,'target_user_id',p.target_user_id,'command',p.command,'phase',p.phase,'role',p.role,'feature_key',p.feature_key,'allowed',p.allowed,'created_at',p.created_at,'updated_at',p.updated_at);
$$;
create function app_private.admin_audit(p_actor uuid,p app_private.admin_operations) returns void language plpgsql security definer set search_path='' as $$ begin
 insert into public.admin_audit_events(actor_user_id,target_user_id,operation_id,action,phase) values(p_actor,p.target_user_id,p.operation_id,p.command,p.phase);
 perform app_private.append_event(p_actor,'authentication',p_actor,'updated','web',null,jsonb_build_object('operation','admin_operation','operation_id',p.operation_id,'target_user_id',p.target_user_id,'action',p.command,'phase',p.phase));
end $$;

-- Provisioning recognizes only a reservation tied to an exact Auth UUID. Metadata never grants roles.
create or replace function app_private.on_auth_user_created() returns trigger language plpgsql security definer set search_path='' as $$
declare op app_private.admin_operations; begin
 perform app_private.provision_user(new.id);
 select * into op from app_private.admin_operations where target_user_id=new.id and command='admin.user.create' and phase<>'complete';
 if found then
  if new.raw_app_meta_data->>'sc_admin_operation' is distinct from op.operation_id::text then raise exception 'Auth creation outside reserved operation.' using errcode='23514'; end if;
  update public.user_moderation set status='blocked',must_change_password=true,changed_by=op.actor_user_id,changed_at=now(),reason='admin_creation_pending' where user_id=new.id;
  perform app_private.append_event(new.id,'moderation',new.id,'status_changed','api',null,jsonb_build_object('user_id',new.id,'status','blocked','must_change_password',true));
 end if;
 return new;
end $$;

create function app_private.admin_snapshot(p_actor uuid,p_session uuid) returns jsonb language plpgsql security definer set search_path='' as $$ begin
 perform app_private.admin_require_master(p_actor,p_session);
 return jsonb_build_object('users',coalesce((select jsonb_agg(jsonb_build_object('user_id',u.id,'email',u.email,'created_at',u.created_at,'last_sign_in_at',u.last_sign_in_at,
 'role',r.role,'status',case when m.status='blocked' or u.banned_until>now() then 'blocked' else m.status end,'must_change_password',m.must_change_password,'admin_allowed',not exists(select 1 from public.user_entitlements where user_id=u.id and feature_key='admin' and not allowed),
 'active_sessions',(select count(*) from auth.sessions where user_id=u.id and (not_after is null or not_after>now())),
 'pending_operation',(select operation_id from app_private.admin_operations where target_user_id=u.id and phase<>'complete')) order by u.created_at,u.id)
 from auth.users u join public.user_roles r on r.user_id=u.id join public.user_moderation m on m.user_id=u.id where u.deleted_at is null and not u.is_anonymous),'[]'::jsonb),
 'audit',coalesce((select jsonb_agg(to_jsonb(a) order by a.occurred_at desc,a.id desc) from (select id,actor_user_id,target_user_id,operation_id,action,phase,occurred_at from public.admin_audit_events order by occurred_at desc,id desc limit 200) a),'[]'::jsonb),
 'operations',coalesce((select jsonb_agg(app_private.admin_operation_json(o) order by o.created_at desc,o.operation_id) from app_private.admin_operations o where phase<>'complete'),'[]'::jsonb));
end $$;

create function app_private.admin_reserve(p_actor uuid,p_session uuid,p_intent jsonb,p_execution uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare op app_private.admin_operations; cmd text; target uuid; before_state jsonb; after_state jsonb; moderation public.user_moderation; result jsonb; begin
 -- Global master-set and pending-operation checks precede all Auth parent locks.
 perform app_private.admin_master_lock();
 cmd:=p_intent->>'command';
 select * into op from app_private.admin_operations where actor_user_id=p_actor and command=cmd and client_id=p_intent->>'client_id' for update;
 perform app_private.admin_require_master(p_actor,p_session);
 if p_execution is null then raise exception 'Server execution required.' using errcode='22023'; end if;
 if jsonb_typeof(p_intent) is distinct from 'object' or not p_intent ?& array['command','client_id','commitment'] or p_intent-array['command','client_id','commitment','target_user_id','role','feature_key','allowed']<>'{}'::jsonb then raise exception 'Invalid admin intention.' using errcode='22023'; end if;
 if op.operation_id is not null then
  if op.commitment is distinct from p_intent->>'commitment' then raise exception 'client_id reused.' using errcode='23505'; end if;
  if op.phase<>'complete' then
   if op.active_execution is not null and op.active_execution<>p_execution then raise exception 'Execution remains claimed; do not overlap Auth mutations.' using errcode='40001'; end if;
   update app_private.admin_operations set active_execution=p_execution,updated_at=now() where operation_id=op.operation_id returning * into op;
  end if;
  return app_private.admin_operation_json(op);
 end if;
 if cmd not in ('admin.user.create','admin.user.block','admin.user.unblock','admin.user.force_password','admin.user.role','admin.user.entitlement') or cmd is null or jsonb_typeof(p_intent->'client_id') is distinct from 'string' or char_length(btrim(p_intent->>'client_id')) not between 1 and 200 or jsonb_typeof(p_intent->'commitment') is distinct from 'string' or p_intent->>'commitment' !~ '^[a-f0-9]{64}$' then raise exception 'Invalid administrative command.' using errcode='22023'; end if;
 if cmd='admin.user.create' then
  if p_intent-array['command','client_id','commitment']<>'{}'::jsonb then raise exception 'Creation accepts no role or target.' using errcode='22023'; end if;
 elsif jsonb_typeof(p_intent->'target_user_id') is distinct from 'string' then raise exception 'Target required.' using errcode='22023'; end if;
 if cmd='admin.user.role' then
  if p_intent-array['command','client_id','commitment','target_user_id','role']<>'{}'::jsonb or jsonb_typeof(p_intent->'role') is distinct from 'string' or p_intent->>'role' not in ('user','master') then raise exception 'Role required.' using errcode='22023'; end if;
 elsif cmd='admin.user.entitlement' then
  if p_intent-array['command','client_id','commitment','target_user_id','feature_key','allowed']<>'{}'::jsonb or jsonb_typeof(p_intent->'allowed') is distinct from 'boolean' or jsonb_typeof(p_intent->'feature_key') is distinct from 'string' or p_intent->>'feature_key' not in ('inicio','capturar','tarefas','calendario','conhecimento','drive','projetos','habitos','financeiro','cofre','configuracoes','integracoes','admin') then raise exception 'Entitlement required.' using errcode='22023'; end if;
 elsif cmd<>'admin.user.create' and p_intent-array['command','client_id','commitment','target_user_id']<>'{}'::jsonb then raise exception 'Fields outside command.' using errcode='22023'; end if;
 target:=case when cmd='admin.user.create' then gen_random_uuid() else (p_intent->>'target_user_id')::uuid end;
 if target is null then raise exception 'Target required.' using errcode='22023'; end if;
 if exists(select 1 from app_private.admin_operations where target_user_id=target and phase<>'complete') then raise exception 'Target has pending reconciliation.' using errcode='40001'; end if;
 if cmd<>'admin.user.create' then
  perform 1 from auth.users where id=target and deleted_at is null and not is_anonymous for share;
  if not found then raise exception 'Target unavailable.' using errcode='23503'; end if;
  perform app_private.capture_task_lock(target);
  select * into strict moderation from public.user_moderation where user_id=target;
  if target=p_actor and cmd in ('admin.user.block','admin.user.unblock','admin.user.force_password','admin.user.role') then raise exception 'Self administrative mutation forbidden. Use Settings to change your own password.' using errcode='23514'; end if;
  if cmd='admin.user.force_password' and (moderation.status<>'active' or exists(select 1 from auth.users where id=target and banned_until>now())) then raise exception 'Unblock before forcing password change.' using errcode='23514'; end if;
  if cmd in ('admin.user.block','admin.user.force_password') or (cmd='admin.user.role' and p_intent->>'role'='user') or (cmd='admin.user.entitlement' and p_intent->>'feature_key'='admin' and p_intent->'allowed'='false'::jsonb) then perform app_private.admin_preserve_master(target); end if;
  if cmd='admin.user.entitlement' and target=p_actor and p_intent->>'feature_key'='admin' and p_intent->'allowed'='false'::jsonb then raise exception 'Self admin veto forbidden.' using errcode='23514'; end if;
 end if;
 if not (app_private.consume_rate_limit_at('identity_write',encode(sha256(convert_to(p_actor::text,'UTF8')),'hex'),p_actor,null)->>'allowed')::boolean then raise exception 'Administrative limit reached.' using errcode='PT429'; end if;
 insert into app_private.admin_operations(actor_user_id,target_user_id,command,client_id,commitment,phase,role,feature_key,allowed,prior_status,prior_must_change_password,active_execution)
 values(p_actor,target,cmd,p_intent->>'client_id',p_intent->>'commitment','reserved',p_intent->>'role',p_intent->>'feature_key',(p_intent->>'allowed')::boolean,coalesce(moderation.status,'blocked'),coalesce(moderation.must_change_password,true),p_execution) returning * into op;
 if cmd='admin.user.role' then
  if p_intent->>'role' not in ('user','master') or p_intent->>'role' is null then raise exception 'Role required.' using errcode='22023'; end if;
  select jsonb_build_object('user_id',user_id,'role',role) into before_state from public.user_roles where user_id=target;
  update public.user_roles set role=p_intent->>'role',granted_by=p_actor,granted_at=now() where user_id=target;
  after_state:=jsonb_build_object('user_id',target,'role',p_intent->>'role'); perform app_private.append_event(target,'role',target,'updated','web',before_state,after_state);
 elsif cmd='admin.user.entitlement' then
  if jsonb_typeof(p_intent->'allowed') is distinct from 'boolean' or p_intent->>'feature_key' not in ('inicio','capturar','tarefas','calendario','conhecimento','drive','projetos','habitos','financeiro','cofre','configuracoes','integracoes','admin') or p_intent->>'feature_key' is null then raise exception 'Entitlement required.' using errcode='22023'; end if;
  select jsonb_build_object('user_id',user_id,'feature_key',feature_key,'allowed',allowed) into before_state from public.user_entitlements where user_id=target and feature_key=p_intent->>'feature_key';
  insert into public.user_entitlements(user_id,feature_key,allowed,granted_by) values(target,p_intent->>'feature_key',(p_intent->>'allowed')::boolean,p_actor) on conflict(user_id,feature_key) do update set allowed=excluded.allowed,granted_by=p_actor,granted_at=now();
  after_state:=jsonb_build_object('user_id',target,'feature_key',p_intent->>'feature_key','allowed',(p_intent->>'allowed')::boolean); perform app_private.append_event(target,'entitlement',target,'updated','web',before_state,after_state);
 elsif cmd<>'admin.user.create' then
  before_state:=jsonb_build_object('user_id',target,'status',moderation.status,'must_change_password',moderation.must_change_password);
  update public.user_moderation set status='blocked',must_change_password=must_change_password or cmd='admin.user.force_password',changed_by=p_actor,changed_at=now(),reason='admin_operation_pending' where user_id=target;
  after_state:=jsonb_build_object('user_id',target,'status','blocked','must_change_password',moderation.must_change_password or cmd='admin.user.force_password'); perform app_private.append_event(target,'moderation',target,'status_changed','web',before_state,after_state);
 end if;
 if cmd in ('admin.user.role','admin.user.entitlement') then update app_private.admin_operations set phase='complete',active_execution=null,updated_at=now() where operation_id=op.operation_id returning * into op; end if;
 perform app_private.admin_audit(p_actor,op);
 result:=app_private.admin_operation_json(op);
 if op.phase='complete' then insert into app_private.command_receipts(user_id,command,client_id,request,result) values(p_actor,cmd,op.client_id,jsonb_build_object('commitment',op.commitment),result); end if;
 return result;
exception when invalid_text_representation then raise exception 'Invalid admin input.' using errcode='22023'; end $$;

create function app_private.admin_lock_operation(p_actor uuid,p_session uuid,p_operation uuid,p_execution uuid,p_claim boolean default false) returns app_private.admin_operations language plpgsql security definer set search_path='' as $$
declare op app_private.admin_operations; begin
 perform app_private.admin_master_lock();
 select * into op from app_private.admin_operations where operation_id=p_operation for update;
 perform app_private.admin_require_master(p_actor,p_session);
 if op.operation_id is null then raise exception 'Operation unavailable.' using errcode='23503'; end if;
 if p_execution is null then raise exception 'Server execution required.' using errcode='22023'; end if;
 if op.phase<>'complete' then
  if p_claim then
   if op.active_execution is not null and op.active_execution<>p_execution then raise exception 'Execution remains claimed; operational proof of termination required.' using errcode='40001'; end if;
   update app_private.admin_operations set active_execution=p_execution,updated_at=now() where operation_id=op.operation_id returning * into op;
  elsif op.active_execution is distinct from p_execution then raise exception 'Exact execution claim required.' using errcode='40001'; end if;
 end if;
 if exists(select 1 from auth.users where id=op.target_user_id) then perform 1 from auth.users where id=op.target_user_id for share; perform app_private.capture_task_lock(op.target_user_id); end if;
 return op;
end $$;
create function app_private.admin_claim(p_actor uuid,p_session uuid,p_operation uuid,p_execution uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare op app_private.admin_operations; begin op:=app_private.admin_lock_operation(p_actor,p_session,p_operation,p_execution,true); return app_private.admin_operation_json(op); end $$;
create function app_private.admin_operation_guard(p_actor uuid,p_session uuid,p_operation uuid,p_execution uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare op app_private.admin_operations; begin op:=app_private.admin_lock_operation(p_actor,p_session,p_operation,p_execution); return app_private.admin_operation_json(op); end $$;
create function app_private.admin_transition(p_actor uuid,p_session uuid,p_operation uuid,p_phase text,p_execution uuid,p_release boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare op app_private.admin_operations; begin
 op:=app_private.admin_lock_operation(p_actor,p_session,p_operation,p_execution); if op.phase='complete' then return app_private.admin_operation_json(op); end if;
 if p_phase not in ('auth_applied','revoked','needs_reconciliation') or p_phase is null then raise exception 'Invalid admin transition.' using errcode='22023'; end if;
 if p_phase<>'needs_reconciliation' then
  if not exists(select 1 from auth.users where id=op.target_user_id and deleted_at is null) then raise exception 'Auth target unavailable.' using errcode='23503'; end if;
  if op.command='admin.user.create' and not exists(select 1 from auth.users where id=op.target_user_id and raw_app_meta_data->>'sc_admin_operation'=op.operation_id::text) then raise exception 'Creation marker differs.' using errcode='23514'; end if;
  if op.command in ('admin.user.block','admin.user.force_password') and not exists(select 1 from auth.users where id=op.target_user_id and banned_until>now()) then raise exception 'Auth ban not confirmed.' using errcode='23514'; end if;
  if p_phase='revoked' then
   if op.phase not in ('auth_applied','revoked') then raise exception 'Auth effect must precede revocation.' using errcode='23514'; end if;
   delete from auth.sessions where user_id=op.target_user_id;
   delete from auth.refresh_tokens where user_id::text=op.target_user_id::text;
  end if;
 end if;
 -- A transport failure/unknown response keeps its claim indefinitely: no automatic TTL.
 update app_private.admin_operations set phase=p_phase,active_execution=case when p_phase='needs_reconciliation' and p_release is true then null else active_execution end,updated_at=now() where operation_id=op.operation_id returning * into op;
 perform app_private.admin_audit(p_actor,op); return app_private.admin_operation_json(op);
end $$;
create function app_private.admin_complete(p_actor uuid,p_session uuid,p_operation uuid,p_execution uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare op app_private.admin_operations; before_state jsonb; after_state jsonb; v_status text; forced boolean; result jsonb; begin
 op:=app_private.admin_lock_operation(p_actor,p_session,p_operation,p_execution); if op.phase='complete' then return app_private.admin_operation_json(op); end if;
 if op.phase<>'revoked' or exists(select 1 from auth.sessions where user_id=op.target_user_id) or exists(select 1 from auth.refresh_tokens where user_id::text=op.target_user_id::text) then raise exception 'All target sessions must be revoked.' using errcode='23514'; end if;
 if op.command='admin.user.block' then
  if not exists(select 1 from auth.users where id=op.target_user_id and banned_until>now()) then raise exception 'Auth ban pending.' using errcode='23514'; end if; v_status:='blocked';
 else
  if not exists(select 1 from auth.users where id=op.target_user_id and deleted_at is null and (banned_until is null or banned_until<=now())) then raise exception 'Auth unban pending.' using errcode='23514'; end if; v_status:='active';
 end if;
 forced:=op.prior_must_change_password or op.command in ('admin.user.create','admin.user.force_password');
 select jsonb_build_object('user_id',m.user_id,'status',m.status,'must_change_password',m.must_change_password) into before_state from public.user_moderation m where m.user_id=op.target_user_id;
 if before_state is null then raise exception 'Moderation unavailable.' using errcode='23503'; end if;
 update public.user_moderation set status=v_status,must_change_password=forced,changed_by=p_actor,changed_at=now(),reason=case when v_status='blocked' then 'admin_block' else null end where user_id=op.target_user_id;
 after_state:=jsonb_build_object('user_id',op.target_user_id,'status',v_status,'must_change_password',forced);
 perform app_private.append_event(op.target_user_id,'moderation',op.target_user_id,'status_changed','web',before_state,after_state);
 update app_private.admin_operations set phase='complete',active_execution=null,updated_at=now() where operation_id=op.operation_id returning * into op; perform app_private.admin_audit(p_actor,op);
 result:=app_private.admin_operation_json(op);
 insert into app_private.command_receipts(user_id,command,client_id,request,result) values(op.actor_user_id,op.command,op.client_id,jsonb_build_object('commitment',op.commitment),result);
 return result;
end $$;

create function public.admin_snapshot(p_actor uuid,p_session uuid) returns jsonb language sql security invoker set search_path='' as $$ select app_private.admin_snapshot(p_actor,p_session) $$;
create function public.admin_reserve(p_actor uuid,p_session uuid,p_intent jsonb,p_execution uuid) returns jsonb language sql security invoker set search_path='' as $$ select app_private.admin_reserve(p_actor,p_session,p_intent,p_execution) $$;
create function public.admin_claim(p_actor uuid,p_session uuid,p_operation uuid,p_execution uuid) returns jsonb language sql security invoker set search_path='' as $$ select app_private.admin_claim(p_actor,p_session,p_operation,p_execution) $$;
create function public.admin_operation_guard(p_actor uuid,p_session uuid,p_operation uuid,p_execution uuid) returns jsonb language sql security invoker set search_path='' as $$ select app_private.admin_operation_guard(p_actor,p_session,p_operation,p_execution) $$;
create function public.admin_transition(p_actor uuid,p_session uuid,p_operation uuid,p_phase text,p_execution uuid,p_release boolean default false) returns jsonb language sql security invoker set search_path='' as $$ select app_private.admin_transition(p_actor,p_session,p_operation,p_phase,p_execution,p_release) $$;
create function public.admin_complete(p_actor uuid,p_session uuid,p_operation uuid,p_execution uuid) returns jsonb language sql security invoker set search_path='' as $$ select app_private.admin_complete(p_actor,p_session,p_operation,p_execution) $$;
do $$ declare f record; begin
 for f in select p.oid::regprocedure signature,p.proname,n.nspname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','app_private') and p.proname like 'admin_%' loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
  if f.proname in ('admin_snapshot','admin_reserve','admin_claim','admin_operation_guard','admin_transition','admin_complete') then execute format('grant execute on function %s to service_role',f.signature); end if;
 end loop;
end $$;
comment on table public.admin_audit_events is 'Metadata-only append-only administrative history. No e-mail, password, credential or personal module content.';
comment on table app_private.admin_operations is 'Fail-closed Auth saga reservations. Stores keyed commitment only; no password/e-mail/ciphertext. UUID and marker reconcile unknown creation.';
commit;
