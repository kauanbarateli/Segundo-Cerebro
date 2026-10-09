-- T017 SQL behavior specification. Future manual run only in an EMPTY dedicated test database.
-- Auth rows below simulate SDK effects; no password, real token, SDK or remote service is used.
-- This serial test does not prove Postgres concurrent locking or real Auth logout propagation.
begin;
set local statement_timeout='30s';
set local app.admin_a='17000000-0000-4000-8000-000000000001';
set local app.admin_b='17000000-0000-4000-8000-000000000002';
set local app.admin_c='17000000-0000-4000-8000-000000000003';
set local app.admin_sa='17000000-0000-4000-8000-000000000011';
set local app.admin_sb='17000000-0000-4000-8000-000000000012';
set local app.admin_sc='17000000-0000-4000-8000-000000000013';
set local app.admin_exec='17000000-0000-4000-8000-000000000021';
create function pg_temp.assert_admin(ok boolean,message text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'T017: %',message; end if; end $$;
create function pg_temp.admin_error(command text,expected text) returns void language plpgsql as $$ declare actual text; begin begin execute command; exception when others then get stacked diagnostics actual=returned_sqlstate; if actual<>expected then raise exception 'Expected %, got %: %',expected,actual,sqlerrm; end if; return; end; raise exception 'Expected failure %: %',expected,command; end $$;
do $$ declare temp_schema text; begin select nspname into strict temp_schema from pg_namespace where oid=pg_my_temp_schema(); execute format('grant usage on schema %I to anon,authenticated,service_role',temp_schema); end $$;
grant execute on function pg_temp.assert_admin(boolean,text),pg_temp.admin_error(text,text) to anon,authenticated,service_role;
select pg_temp.assert_admin(not exists(select 1 from auth.users),'empty Auth test database required');
insert into auth.users(id,aud,role,email,is_anonymous,created_at,updated_at,raw_app_meta_data) values
 (current_setting('app.admin_a')::uuid,'authenticated','authenticated','t017-a@example.invalid',false,now(),now(),'{}'),
 (current_setting('app.admin_b')::uuid,'authenticated','authenticated','t017-b@example.invalid',false,now(),now(),'{}'),
 (current_setting('app.admin_c')::uuid,'authenticated','authenticated','t017-c@example.invalid',false,now(),now(),'{"role":"master"}');
insert into auth.sessions(id,user_id,created_at,updated_at) values
 (current_setting('app.admin_sa')::uuid,current_setting('app.admin_a')::uuid,now(),now()),
 (current_setting('app.admin_sb')::uuid,current_setting('app.admin_b')::uuid,now(),now()),
 (current_setting('app.admin_sc')::uuid,current_setting('app.admin_c')::uuid,now(),now());
select pg_temp.assert_admin((select role='user' from public.user_roles where user_id=current_setting('app.admin_c')::uuid),'editable marker does not grant master');
update public.user_roles set role='master' where user_id in (current_setting('app.admin_a')::uuid,current_setting('app.admin_b')::uuid);
-- Auth's current ban participates in the metadata projection even when app moderation is active.
update auth.users set banned_until=now()+interval '1 day' where id=current_setting('app.admin_c')::uuid;
set local role service_role;
select pg_temp.assert_admin(exists(select 1 from jsonb_array_elements(public.admin_snapshot(current_setting('app.admin_a')::uuid,current_setting('app.admin_sa')::uuid)->'users') u where u->>'user_id'=current_setting('app.admin_c') and u->>'status'='blocked'),'snapshot reflects current Auth banned_until');
reset role;
update auth.users set banned_until=now()-interval '1 second' where id=current_setting('app.admin_c')::uuid;
set local role service_role;
select pg_temp.assert_admin(exists(select 1 from jsonb_array_elements(public.admin_snapshot(current_setting('app.admin_a')::uuid,current_setting('app.admin_sa')::uuid)->'users') u where u->>'user_id'=current_setting('app.admin_c') and u->>'status'='active'),'expired Auth ban is not a permanent application block');
reset role;
update auth.users set banned_until=null where id=current_setting('app.admin_c')::uuid;
set local role authenticated;
select pg_temp.admin_error('select public.admin_snapshot(current_setting(''app.admin_a'')::uuid,current_setting(''app.admin_sa'')::uuid)','42501');
select pg_temp.admin_error('select * from public.admin_audit_events','42501');
reset role;
set local role service_role;
select pg_temp.admin_error('select public.admin_snapshot(current_setting(''app.admin_c'')::uuid,current_setting(''app.admin_sc'')::uuid)','42501');
select pg_temp.admin_error($q$select public.admin_reserve(current_setting('app.admin_a')::uuid,current_setting('app.admin_sa')::uuid,jsonb_build_object('command','admin.user.unblock','client_id','self-unblock','commitment',repeat('a',64),'target_user_id',current_setting('app.admin_a')),current_setting('app.admin_exec')::uuid)$q$,'23514');
select pg_temp.admin_error($q$select public.admin_reserve(current_setting('app.admin_a')::uuid,current_setting('app.admin_sa')::uuid,jsonb_build_object('command','admin.user.role','client_id','self-role','commitment',repeat('a',64),'target_user_id',current_setting('app.admin_a'),'role','user'),current_setting('app.admin_exec')::uuid)$q$,'23514');
select set_config('app.admin_block_op',(public.admin_reserve(current_setting('app.admin_a')::uuid,current_setting('app.admin_sa')::uuid,jsonb_build_object('command','admin.user.block','client_id','block-b','commitment',repeat('b',64),'target_user_id',current_setting('app.admin_b')),current_setting('app.admin_exec')::uuid)->>'operation_id'),true);
-- B had a live session before reservation; moderation rejects it before SDK effects.
select pg_temp.admin_error($q$select public.admin_claim(current_setting('app.admin_a')::uuid,current_setting('app.admin_sa')::uuid,current_setting('app.admin_block_op')::uuid,'17000000-0000-4000-8000-000000000022'::uuid)$q$,'40001');
select public.admin_transition(current_setting('app.admin_a')::uuid,current_setting('app.admin_sa')::uuid,current_setting('app.admin_block_op')::uuid,'needs_reconciliation',current_setting('app.admin_exec')::uuid,false);
select pg_temp.admin_error($q$select public.admin_claim(current_setting('app.admin_a')::uuid,current_setting('app.admin_sa')::uuid,current_setting('app.admin_block_op')::uuid,'17000000-0000-4000-8000-000000000022'::uuid)$q$,'40001');
reset role;
select pg_temp.assert_admin((select active_execution=current_setting('app.admin_exec')::uuid from app_private.admin_operations where operation_id=current_setting('app.admin_block_op')::uuid),'uncertain execution remains claimed indefinitely');
-- Explicit fixture clearance: this serial SQL test has no SDK request in flight.
-- Production must never clear this field without operational evidence of termination.
update app_private.admin_operations set active_execution=null where operation_id=current_setting('app.admin_block_op')::uuid and phase='needs_reconciliation';
set local role service_role;
select public.admin_claim(current_setting('app.admin_a')::uuid,current_setting('app.admin_sa')::uuid,current_setting('app.admin_block_op')::uuid,current_setting('app.admin_exec')::uuid);
select pg_temp.admin_error('select public.admin_snapshot(current_setting(''app.admin_b'')::uuid,current_setting(''app.admin_sb'')::uuid)','42501');
select pg_temp.admin_error($q$select public.admin_reserve(current_setting('app.admin_b')::uuid,current_setting('app.admin_sb')::uuid,jsonb_build_object('command','admin.user.block','client_id','reciprocal-block','commitment',repeat('b',64),'target_user_id',current_setting('app.admin_a')),current_setting('app.admin_exec')::uuid)$q$,'42501');
select pg_temp.admin_error($q$select public.admin_transition(current_setting('app.admin_a')::uuid,current_setting('app.admin_sa')::uuid,current_setting('app.admin_block_op')::uuid,'auth_applied',current_setting('app.admin_exec')::uuid)$q$,'23514');
reset role;
select pg_temp.assert_admin(not app_private.session_active(current_setting('app.admin_b')::uuid,current_setting('app.admin_sb')::uuid),'live blocked session loses application access');
select pg_temp.admin_error('select app_private.admin_preserve_master(current_setting(''app.admin_a'')::uuid)','23514');
update auth.users set banned_until=now()+interval '1 day' where id=current_setting('app.admin_b')::uuid;
set local role service_role;
select public.admin_transition(current_setting('app.admin_a')::uuid,current_setting('app.admin_sa')::uuid,current_setting('app.admin_block_op')::uuid,'auth_applied',current_setting('app.admin_exec')::uuid);
select public.admin_transition(current_setting('app.admin_a')::uuid,current_setting('app.admin_sa')::uuid,current_setting('app.admin_block_op')::uuid,'revoked',current_setting('app.admin_exec')::uuid);
select public.admin_complete(current_setting('app.admin_a')::uuid,current_setting('app.admin_sa')::uuid,current_setting('app.admin_block_op')::uuid,current_setting('app.admin_exec')::uuid);
select pg_temp.assert_admin((public.admin_reserve(current_setting('app.admin_a')::uuid,current_setting('app.admin_sa')::uuid,jsonb_build_object('command','admin.user.block','client_id','block-b','commitment',repeat('b',64),'target_user_id',current_setting('app.admin_b')),current_setting('app.admin_exec')::uuid)->>'phase')='complete','same reserved operation replays without mutation');
select pg_temp.admin_error($q$select public.admin_reserve(current_setting('app.admin_a')::uuid,current_setting('app.admin_sa')::uuid,jsonb_build_object('command','admin.user.block','client_id','block-b','commitment',repeat('c',64),'target_user_id',current_setting('app.admin_b')),current_setting('app.admin_exec')::uuid)$q$,'23505');
reset role;
select pg_temp.assert_admin(not exists(select 1 from auth.sessions where user_id=current_setting('app.admin_b')::uuid),'all B sessions revoked');
select pg_temp.assert_admin((select status='blocked' from public.user_moderation where user_id=current_setting('app.admin_b')::uuid),'complete block retains moderation');

-- Reserved UUID + exact operation marker provisions forced password BEFORE any login.
set local role service_role;
select set_config('app.admin_create_op',(public.admin_reserve(current_setting('app.admin_a')::uuid,current_setting('app.admin_sa')::uuid,jsonb_build_object('command','admin.user.create','client_id','create-d','commitment',repeat('d',64)),current_setting('app.admin_exec')::uuid)->>'operation_id'),true);
reset role;
select set_config('app.admin_d',(select target_user_id::text from app_private.admin_operations where operation_id=current_setting('app.admin_create_op')::uuid),true);
select pg_temp.admin_error(format($q$insert into auth.users(id,aud,role,email,is_anonymous,created_at,updated_at,raw_app_meta_data) values(%L::uuid,'authenticated','authenticated','t017-wrong@example.invalid',false,now(),now(),'{}')$q$,current_setting('app.admin_d')),'23514');
insert into auth.users(id,aud,role,email,is_anonymous,created_at,updated_at,banned_until,raw_app_meta_data) values(current_setting('app.admin_d')::uuid,'authenticated','authenticated','t017-d@example.invalid',false,now(),now(),now()+interval '1 day',jsonb_build_object('sc_admin_operation',current_setting('app.admin_create_op'),'role','master'));
select pg_temp.assert_admin((select status='blocked' and must_change_password from public.user_moderation where user_id=current_setting('app.admin_d')::uuid),'creation starts protected');
select pg_temp.assert_admin((select role='user' from public.user_roles where user_id=current_setting('app.admin_d')::uuid),'role marker still cannot promote reserved user');
set local role service_role;
select public.admin_transition(current_setting('app.admin_a')::uuid,current_setting('app.admin_sa')::uuid,current_setting('app.admin_create_op')::uuid,'auth_applied',current_setting('app.admin_exec')::uuid);
select public.admin_transition(current_setting('app.admin_a')::uuid,current_setting('app.admin_sa')::uuid,current_setting('app.admin_create_op')::uuid,'revoked',current_setting('app.admin_exec')::uuid);
select pg_temp.admin_error('select public.admin_complete(current_setting(''app.admin_a'')::uuid,current_setting(''app.admin_sa'')::uuid,current_setting(''app.admin_create_op'')::uuid,current_setting(''app.admin_exec'')::uuid)','23514');
reset role;
update auth.users set banned_until=null where id=current_setting('app.admin_d')::uuid;
set local role service_role;
select public.admin_complete(current_setting('app.admin_a')::uuid,current_setting('app.admin_sa')::uuid,current_setting('app.admin_create_op')::uuid,current_setting('app.admin_exec')::uuid);
reset role;
select pg_temp.assert_admin((select status='active' and must_change_password from public.user_moderation where user_id=current_setting('app.admin_d')::uuid),'only forced login released');
select pg_temp.assert_admin((select request=jsonb_build_object('commitment',repeat('d',64)) from app_private.command_receipts where user_id=current_setting('app.admin_a')::uuid and command='admin.user.create' and client_id='create-d'),'receipt contains no e-mail or password');

-- Failed audit insertion rolls back reservation, moderation and rate-limit effect.
create function pg_temp.reject_admin_audit() returns trigger language plpgsql as $$ begin raise exception 'injected audit failure' using errcode='P0001'; end $$;
create trigger t017_reject_audit before insert on public.admin_audit_events for each row execute function pg_temp.reject_admin_audit();
set local role service_role;
select pg_temp.admin_error($q$select public.admin_reserve(current_setting('app.admin_a')::uuid,current_setting('app.admin_sa')::uuid,jsonb_build_object('command','admin.user.block','client_id','audit-rollback','commitment',repeat('e',64),'target_user_id',current_setting('app.admin_c')),current_setting('app.admin_exec')::uuid)$q$,'P0001');
reset role;
drop trigger t017_reject_audit on public.admin_audit_events;
select pg_temp.assert_admin((select status='active' from public.user_moderation where user_id=current_setting('app.admin_c')::uuid),'audit failure rolls back moderation');
select pg_temp.assert_admin(not exists(select 1 from app_private.admin_operations where client_id='audit-rollback'),'audit failure rolls back operation');

-- Current role/veto is checked before a completed replay, not only at reservation time.
update public.user_roles set role='user' where user_id=current_setting('app.admin_a')::uuid;
set local role service_role;
select pg_temp.admin_error($q$select public.admin_reserve(current_setting('app.admin_a')::uuid,current_setting('app.admin_sa')::uuid,jsonb_build_object('command','admin.user.block','client_id','block-b','commitment',repeat('b',64),'target_user_id',current_setting('app.admin_b')),current_setting('app.admin_exec')::uuid)$q$,'42501');
reset role;
update public.user_roles set role='master' where user_id=current_setting('app.admin_a')::uuid;
insert into public.user_entitlements(user_id,feature_key,allowed) values(current_setting('app.admin_a')::uuid,'admin',false);
set local role service_role;
select pg_temp.admin_error('select public.admin_operation_guard(current_setting(''app.admin_a'')::uuid,current_setting(''app.admin_sa'')::uuid,current_setting(''app.admin_block_op'')::uuid,current_setting(''app.admin_exec'')::uuid)','42501');
reset role;
-- All synthetic users, sessions, history and operations are removed by rollback.
rollback;
