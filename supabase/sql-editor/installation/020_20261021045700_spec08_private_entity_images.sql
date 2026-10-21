-- SPEC-08 / #72. Prepared locally; supervised application only. No Storage job.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
do $$ begin
 if current_user<>'postgres' or to_regprocedure('app_private.file_guard(uuid,uuid,text)') is null then
  raise exception 'Reviewed 019 foundation required.';
 end if;
end $$;

alter table public.drive_files drop constraint drive_files_kind_check;
alter table public.drive_files add constraint drive_files_kind_check check(kind in ('drive','capture_image','avatar','project_cover','habit_image','finance_goal_image','home_focus_image'));
alter table app_private.upload_reservations drop constraint upload_reservations_kind_check;
alter table app_private.upload_reservations add constraint upload_reservations_kind_check check(kind in ('drive','capture_image','avatar','project_cover','habit_image','finance_goal_image','home_focus_image'));
alter table public.projects add column cover_file_id uuid;
alter table public.projects add constraint projects_cover_file_owner_fk foreign key(user_id,cover_file_id) references public.drive_files(user_id,id) deferrable initially deferred;
alter table public.user_preferences add column home_focus_file_id uuid;
alter table public.user_preferences add constraint preferences_focus_file_owner_fk foreign key(user_id,home_focus_file_id) references public.drive_files(user_id,id) deferrable initially deferred;

create function app_private.file_feature(p_kind text) returns text language sql immutable set search_path='' as $$
 select case p_kind when 'drive' then 'drive' when 'capture_image' then 'capturar' when 'avatar' then 'configuracoes'
 when 'project_cover' then 'projetos' when 'habit_image' then 'habitos' when 'finance_goal_image' then 'financeiro' when 'home_focus_image' then 'inicio' end;
$$;
create or replace function app_private.file_guard(p_user uuid,p_session uuid,p_kind text) returns void language plpgsql security definer set search_path='' as $$
declare feature text;begin
 perform 1 from auth.users u where u.id=p_user for share;
 perform 1 from auth.sessions s where s.id=p_session and s.user_id=p_user for share;
 perform app_private.capture_task_lock(p_user);perform app_private.require_actor(p_user,p_session);
 feature:=app_private.file_feature(p_kind);
 if feature is null or exists(select 1 from public.user_entitlements e where e.user_id=p_user and e.feature_key=feature and not e.allowed) then
  raise exception 'File functionality unavailable.' using errcode='42501';end if;
end $$;

create function app_private.require_entity_image(p_user uuid,p_file uuid,p_purpose text) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_purpose not in ('project_cover','home_focus_image','habit_image','finance_goal_image') then raise exception 'Invalid image purpose.' using errcode='22023';end if;
 if p_file is not null and not exists(
  select 1 from public.drive_files f join app_private.upload_reservations r on r.user_id=f.user_id and r.file_id=f.id
  where f.user_id=p_user and f.id=p_file and f.kind=p_purpose and f.deleted_at is null and f.purged_at is null
   and r.kind=p_purpose and r.status='finalized' and f.folder_id is null and f.mime in ('image/png','image/jpeg')
   and f.bytes<=8388608 and f.width::bigint*f.height::bigint<=24000000
 ) then raise exception 'Finalized owner image required.' using errcode='23514';end if;
end $$;

-- Preserve installed capture/attachment validation and its OID. Old projects
-- have no key; updates preserve whatever optional key was read in the snapshot.
do $$ declare definition text;begin
 select pg_get_functiondef('app_private.capture_task_validate_payload(text,jsonb)'::regprocedure) into definition;
 execute replace(definition,'FUNCTION app_private.capture_task_validate_payload(','FUNCTION app_private.capture_task_validate_payload_spec08_previous(');
end $$;
create or replace function app_private.capture_task_validate_payload(p_kind text,p jsonb) returns void language plpgsql stable set search_path='' as $$
begin
 if p_kind='project' and p?'cover_file_id' then
  perform app_private.capture_task_validate_payload_spec08_previous(p_kind,p-'cover_file_id');
  if p->'cover_file_id'<>'null'::jsonb and (jsonb_typeof(p->'cover_file_id') is distinct from 'string' or p->>'cover_file_id' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then raise exception 'Invalid cover.' using errcode='22023';end if;
  perform app_private.require_entity_image((p->>'user_id')::uuid,(p->>'cover_file_id')::uuid,'project_cover');
 else perform app_private.capture_task_validate_payload_spec08_previous(p_kind,p);end if;
end $$;
create function app_private.project_image_column() returns trigger language plpgsql security definer set search_path='' as $$
begin new.cover_file_id:=(new.payload->>'cover_file_id')::uuid;return new;end $$;
create trigger project_image_column before insert or update on public.projects for each row execute function app_private.project_image_column();

create function app_private.file_entity_image_get(p_user uuid,p_session uuid,p_purpose text,p_entity uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare file_id uuid;begin
 if p_purpose not in ('project_cover','home_focus_image') then raise exception 'Image destination unavailable.' using errcode='22023';end if;
 perform app_private.file_guard(p_user,p_session,p_purpose);
 if p_purpose='project_cover' then
  select p.cover_file_id into file_id from public.projects p where p.user_id=p_user and p.id=p_entity and p.deleted_at is null;
 else
  if p_entity<>p_user then raise exception 'Image outside owner.' using errcode='42501';end if;
  select p.home_focus_file_id into file_id from public.user_preferences p where p.user_id=p_user;
 end if;
 if not found then raise exception 'Image destination unavailable.' using errcode='42501';end if;
 perform app_private.require_entity_image(p_user,file_id,p_purpose);
 return jsonb_build_object('version',1,'user_id',p_user,'id',p_entity,'purpose',p_purpose,'file_id',file_id);
end $$;
create function app_private.file_entity_image_set(p_user uuid,p_session uuid,p_request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare purpose text;entity uuid;file_id uuid;client_id text;receipt jsonb;before_row jsonb;after_row jsonb;begin
 if jsonb_typeof(p_request) is distinct from 'object' or not p_request?&array['version','purpose','entity_id','file_id','expected_file_id','client_id'] or p_request-array['version','purpose','entity_id','file_id','expected_file_id','client_id']<>'{}'::jsonb or p_request->'version' is distinct from '1'::jsonb
  or p_request->>'purpose' not in ('project_cover','home_focus_image') or jsonb_typeof(p_request->'client_id') is distinct from 'string' or char_length(btrim(p_request->>'client_id')) not between 1 and 200
  or jsonb_typeof(p_request->'entity_id') is distinct from 'string' or (p_request->'file_id'<>'null'::jsonb and jsonb_typeof(p_request->'file_id') is distinct from 'string') or (p_request->'expected_file_id'<>'null'::jsonb and jsonb_typeof(p_request->'expected_file_id') is distinct from 'string') then raise exception 'Invalid image binding.' using errcode='22023';end if;
 purpose:=p_request->>'purpose';entity:=(p_request->>'entity_id')::uuid;file_id:=(p_request->>'file_id')::uuid;client_id:=p_request->>'client_id';
 perform app_private.file_guard(p_user,p_session,purpose);
 -- Authority is rechecked before replay, including after a suspension/veto.
 receipt:=app_private.command_replay(p_user,'file.entity-image.set',client_id,p_request);if receipt is not null then return receipt;end if;
 perform app_private.require_entity_image(p_user,file_id,purpose);
 if purpose='project_cover' then
  select p.payload into before_row from public.projects p where p.user_id=p_user and p.id=entity and p.deleted_at is null for update;
  if not found then raise exception 'Project unavailable.' using errcode='42501';end if;
  if coalesce(before_row->'cover_file_id','null'::jsonb) is distinct from p_request->'expected_file_id' then raise exception 'Cover changed.' using errcode='40001';end if;
  after_row:=before_row||jsonb_build_object('cover_file_id',file_id,'updated_at',now());
  update public.projects p set payload=after_row where p.user_id=p_user and p.id=entity;
  perform app_private.append_event(p_user,'project',entity,'updated','web',before_row,after_row);
 else
  if entity<>p_user then raise exception 'Image outside owner.' using errcode='42501';end if;
  select to_jsonb(p.*) into before_row from public.user_preferences p where p.user_id=p_user for update;
  if not found then raise exception 'Preferences unavailable.' using errcode='42501';end if;
  if before_row->'home_focus_file_id' is distinct from p_request->'expected_file_id' then raise exception 'Focus image changed.' using errcode='40001';end if;
  update public.user_preferences p set home_focus_file_id=file_id,updated_at=now() where p.user_id=p_user returning to_jsonb(p.*) into after_row;
  perform app_private.append_event(p_user,'preference',p_user,'updated','web',before_row,after_row);
 end if;
 receipt:=app_private.file_entity_image_get(p_user,p_session,purpose,entity);
 insert into app_private.command_receipts(user_id,command,client_id,request,result) values(p_user,'file.entity-image.set',client_id,p_request,receipt);
 return receipt;
exception when invalid_text_representation then raise exception 'Invalid image identifier.' using errcode='22023';
end $$;

create or replace function app_private.file_read_metadata(p_user uuid,p_session uuid,p_file uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare file_row public.drive_files;begin
 select f.* into file_row from public.drive_files f where f.user_id=p_user and f.id=p_file;
 if not found then raise exception 'File unavailable.' using errcode='42501';end if;
 perform app_private.file_guard(p_user,p_session,file_row.kind);
 if file_row.deleted_at is not null or file_row.purged_at is not null then raise exception 'File trashed/expired.' using errcode='22023';end if;
 if file_row.kind in ('project_cover','home_focus_image','habit_image','finance_goal_image') then perform app_private.require_entity_image(p_user,p_file,file_row.kind);end if;
 return jsonb_build_object('file',file_row.payload,'storage_path',file_row.storage_path);
end $$;
create function public.file_entity_image_get(p_user uuid,p_session uuid,p_purpose text,p_entity uuid) returns jsonb language sql security invoker set search_path='' as $$select app_private.file_entity_image_get(p_user,p_session,p_purpose,p_entity);$$;
create function public.file_entity_image_set(p_user uuid,p_session uuid,p_request jsonb) returns jsonb language sql security invoker set search_path='' as $$select app_private.file_entity_image_set(p_user,p_session,p_request);$$;

drop policy files_owner_read on public.drive_files;
create policy files_owner_read on public.drive_files for select to authenticated using(user_id=(select auth.uid()) and purged_at is null and
 ((kind='drive' and (select app_private.has_feature('drive'))) or (kind='capture_image' and (select app_private.has_feature('capturar'))) or (kind='avatar' and (select app_private.has_feature('configuracoes')))
 or (kind='project_cover' and (select app_private.has_feature('projetos'))) or (kind='habit_image' and (select app_private.has_feature('habitos')))
 or (kind='finance_goal_image' and (select app_private.has_feature('financeiro'))) or (kind='home_focus_image' and (select app_private.has_feature('inicio')))));

create function app_private.entity_image_referenced(p_user uuid,p_file uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p where p.user_id=p_user and p.avatar_file_id=p_file)
 or exists(select 1 from public.capture_file_links l where l.user_id=p_user and l.file_id=p_file)
 or exists(select 1 from public.projects p where p.user_id=p_user and p.cover_file_id=p_file)
 or exists(select 1 from public.user_preferences p where p.user_id=p_user and p.home_focus_file_id=p_file);
$$;
-- Retain fair ordering, parent lock, recheck and ACK behavior of 015. Both the
-- candidate selection and locked deletion recheck must protect every live link.
do $$ declare definition text;changed text;begin
 select pg_get_functiondef('app_private.file_cleanup_candidates()'::regprocedure) into definition;
 definition:=replace(definition,chr(13)||chr(10),chr(10));
 changed:=replace(definition,
  'and not exists(select 1 from public.profiles p where p.user_id=r.user_id and p.avatar_file_id=f.id)'||chr(10)||'    and not exists(select 1 from public.capture_file_links l where l.user_id=r.user_id and l.file_id=f.id)',
  'and not app_private.entity_image_referenced(r.user_id,f.id)');
 changed:=replace(changed,
  'and not exists(select 1 from public.profiles p where p.user_id=reservation.user_id and p.avatar_file_id=file_row.id)'||chr(10)||'      and not exists(select 1 from public.capture_file_links l where l.user_id=reservation.user_id and l.file_id=file_row.id)',
  'and not app_private.entity_image_referenced(reservation.user_id,file_row.id)');
 if changed=definition or position('not exists(select 1 from public.profiles' in changed)>0 then raise exception 'Cleanup definition drift; review before applying.';end if;
 execute changed;
end $$;
-- Domain observation with Auth/advisory locks, not STABLE/transaction READ ONLY.
-- It never renews a reservation, acquires/releases a lease or settles a command.
create function app_private.file_entity_image_upload_observe(p_user uuid,p_session uuid,p_upload uuid,p_kind text,p_client_id text) returns jsonb language plpgsql security definer set search_path='' as $$
declare reservation app_private.upload_reservations;observed timestamptz;file_data jsonb;begin
 if p_user is null or p_session is null or p_upload is null or p_kind is null or p_kind not in ('project_cover','home_focus_image','habit_image','finance_goal_image')
  or p_client_id is null or char_length(btrim(p_client_id)) not between 1 and 200 or char_length(p_client_id)>200 then raise exception 'Invalid upload observation.' using errcode='22023';end if;
 perform app_private.file_guard(p_user,p_session,p_kind);
 select r.* into reservation from app_private.upload_reservations r
  where r.user_id=p_user and r.id=p_upload and r.kind=p_kind and r.client_id=p_client_id for share;
 if not found then raise exception 'Upload unavailable.' using errcode='42501';end if;
 observed:=clock_timestamp();
 if reservation.status='reserved' and (reservation.lease_id is not null or reservation.lease_until is not null or reservation.file_id is not null)
  or reservation.status='processing' and (reservation.lease_id is null or reservation.lease_until is null or reservation.file_id is not null) then
  raise exception 'Inconsistent upload.' using errcode='23514';end if;
 if reservation.status='finalized' then
  if reservation.file_id is distinct from p_upload then raise exception 'Invalid finalized upload.' using errcode='23514';end if;
  perform app_private.require_entity_image(p_user,p_upload,p_kind);
  select f.payload into file_data from public.drive_files f where f.user_id=p_user and f.id=p_upload and f.kind=p_kind and f.deleted_at is null and f.purged_at is null;
  if file_data is null or file_data->>'id' is distinct from p_upload::text or file_data->>'user_id' is distinct from p_user::text or file_data->>'kind' is distinct from p_kind
   or file_data-array['id','user_id','kind','folder_id','name','mime','bytes','sha256','width','height','starred','deleted_at','deletion_batch_id','created_at','updated_at','modified_at']<>'{}'::jsonb then
   raise exception 'Finalized image unavailable.' using errcode='23514';end if;
 end if;
 return jsonb_build_object('version',1,'user_id',p_user,'upload_id',p_upload,'kind',p_kind,'status',reservation.status,'observed_at',observed,
  'expires_at',reservation.expires_at,'processing',reservation.status='processing' and reservation.lease_until>observed,'file',file_data);
end $$;
create function public.file_entity_image_upload_observe(p_user uuid,p_session uuid,p_upload uuid,p_kind text,p_client_id text) returns jsonb language sql security invoker set search_path='' as $$select app_private.file_entity_image_upload_observe(p_user,p_session,p_upload,p_kind,p_client_id);$$;
revoke all on function app_private.file_entity_image_upload_observe(uuid,uuid,uuid,text,text),public.file_entity_image_upload_observe(uuid,uuid,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function app_private.file_entity_image_upload_observe(uuid,uuid,uuid,text,text),public.file_entity_image_upload_observe(uuid,uuid,uuid,text,text) to service_role;
revoke all on function app_private.file_feature(text),app_private.require_entity_image(uuid,uuid,text),app_private.project_image_column(),app_private.capture_task_validate_payload_spec08_previous(text,jsonb),app_private.entity_image_referenced(uuid,uuid),app_private.file_entity_image_get(uuid,uuid,text,uuid),app_private.file_entity_image_set(uuid,uuid,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.file_entity_image_get(uuid,uuid,text,uuid),public.file_entity_image_set(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.file_entity_image_get(uuid,uuid,text,uuid),public.file_entity_image_set(uuid,uuid,jsonb),app_private.file_entity_image_get(uuid,uuid,text,uuid),app_private.file_entity_image_set(uuid,uuid,jsonb) to service_role;
commit;
