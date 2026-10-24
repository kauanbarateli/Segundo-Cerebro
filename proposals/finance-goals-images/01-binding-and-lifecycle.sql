-- INERT E1 companion: no canonical migration, Storage action or hosted rollout.
do $draft_only$ begin raise exception 'DRAFT_ONLY: Goal images require review, lifecycle/race proof and supervised promotion.';end $draft_only$;
begin;
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
rollback;
