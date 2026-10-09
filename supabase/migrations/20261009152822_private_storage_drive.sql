-- T022/T027. New private Storage pipeline; manual application only.
-- Depends on identity, capture/task, account preferences and T023 drive_folders.
begin;
set local lock_timeout='5s';set local statement_timeout='60s';
do $$ begin
 if current_user<>'postgres' or to_regclass('public.drive_folders') is null or to_regclass('storage.buckets') is null or to_regclass('storage.objects') is null then raise exception 'Reviewed foundation/T023 and hosted Storage required.';end if;
 if to_regclass('public.drive_files') is not null then raise exception 'Drive already installed; inspect drift.';end if;
end $$;
insert into storage.buckets(id,name,public,file_size_limit) values('second-brain-staging','second-brain-staging',false,26214400),('second-brain-files','second-brain-files',false,26214400);
-- Authenticated users never directly access either bucket. Signed capabilities
-- are minted server-side for one staging path; URLs are temporary, not one-use.
create policy second_brain_private_objects on storage.objects as restrictive for all to anon,authenticated
 using(bucket_id not in ('second-brain-staging','second-brain-files')) with check(bucket_id not in ('second-brain-staging','second-brain-files'));
create policy second_brain_private_buckets on storage.buckets as restrictive for all to anon,authenticated
 using(id not in ('second-brain-staging','second-brain-files')) with check(id not in ('second-brain-staging','second-brain-files'));
create table public.drive_files(
 id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,payload jsonb not null,
 kind text not null check(kind in ('drive','capture_image','avatar')),folder_id uuid,name text not null,mime text not null,
 bytes bigint not null check(bytes>0 and bytes<=26214400),sha256 text not null check(sha256~'^[a-f0-9]{64}$'),width integer,height integer,
 storage_path text not null,deleted_at timestamptz,deletion_batch_id uuid,purged_at timestamptz,created_at timestamptz not null,updated_at timestamptz not null,
 unique(user_id,id),unique(storage_path),foreign key(user_id,folder_id) references public.drive_folders(user_id,id) deferrable initially deferred,
 check(storage_path=user_id::text||'/'||id::text),check((deleted_at is null)=(deletion_batch_id is null)),
 check((width is null)=(height is null)),check(width is null or width>0 and height>0),check(kind='drive' or folder_id is null),
 check(kind='drive' or mime in ('image/png','image/jpeg') and width is not null and bytes<=8388608)
);
create index drive_files_folder_idx on public.drive_files(user_id,folder_id,deleted_at,id);
create index drive_files_search_idx on public.drive_files using gin(to_tsvector('portuguese',name));
create table app_private.upload_reservations(
 id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,kind text not null check(kind in ('drive','capture_image','avatar')),
 name text not null,folder_id uuid,client_id text not null,staging_path text not null,final_path text not null,
 max_bytes bigint not null check(max_bytes between 1 and 26214400),quota_bytes bigint not null,
 expires_at timestamptz not null,status text not null default 'reserved' check(status in ('reserved','processing','finalized','expired')),
 lease_id uuid,lease_until timestamptz,file_id uuid,created_at timestamptz not null default now(),cleaned_at timestamptz,
 unique(user_id,kind,client_id),unique(staging_path),unique(final_path),
 foreign key(user_id,folder_id) references public.drive_folders(user_id,id),foreign key(user_id,file_id) references public.drive_files(user_id,id),
 check(staging_path=user_id::text||'/'||id::text and final_path=staging_path),check((lease_id is null)=(lease_until is null))
);
create index upload_reservations_cleanup_idx on app_private.upload_reservations(expires_at,cleaned_at);
create table app_private.file_cleanup_runs(id uuid primary key default gen_random_uuid(),started_at timestamptz not null default now(),removed integer not null check(removed>=0),failed integer not null check(failed>=0));
alter table public.profiles add constraint profiles_avatar_file_owner_fk foreign key(user_id,avatar_file_id) references public.drive_files(user_id,id) deferrable initially deferred;
create table public.capture_file_links(user_id uuid not null references auth.users(id) on delete cascade,capture_id uuid not null,file_id uuid not null,
 primary key(user_id,capture_id,file_id),foreign key(user_id,capture_id) references public.captures(user_id,id) on delete cascade deferrable initially deferred,
 foreign key(user_id,file_id) references public.drive_files(user_id,id) deferrable initially deferred);

do $$ declare expression text;begin select pg_get_expr(c.conbin,c.conrelid) into strict expression from pg_constraint c where c.conrelid='public.domain_events'::regclass and c.conname='domain_events_entity_type_check';
 alter table public.domain_events drop constraint domain_events_entity_type_check;execute format('alter table public.domain_events add constraint domain_events_entity_type_check check ((%s) or entity_type in (''drive_folder'',''drive_file''))',expression);end $$;
create function app_private.file_guard(p_user uuid,p_session uuid,p_kind text) returns void language plpgsql security definer set search_path='' as $$
declare feature text;begin
 perform 1 from auth.users u where u.id=p_user for share;perform 1 from auth.sessions s where s.id=p_session and s.user_id=p_user for share;perform app_private.capture_task_lock(p_user);perform app_private.require_actor(p_user,p_session);
 feature:=case p_kind when 'drive' then 'drive' when 'capture_image' then 'capturar' when 'avatar' then 'configuracoes' end;
 if feature is null or exists(select 1 from public.user_entitlements e where e.user_id=p_user and e.feature_key=feature and not e.allowed) then raise exception 'File functionality unavailable.' using errcode='42501';end if;
end $$;
create function app_private.drive_guard(p_user uuid,p_session uuid,p_operation text) returns void language plpgsql security definer set search_path='' as $$ begin
 perform app_private.file_guard(p_user,p_session,'drive');if p_operation not in ('read.drive','drive.folder.create','drive.folder.update','drive.folder.move','drive.folder.delete','drive.folder.restore','drive.file.update','drive.file.move','drive.file.delete','drive.file.restore','drive.file.star') then raise exception 'Unknown drive operation.' using errcode='22023';end if;end $$;
create function app_private.drive_file_row() returns trigger language plpgsql security definer set search_path='' as $$
declare p jsonb:=new.payload;begin
 perform app_private.capture_task_lock(new.user_id);
 if jsonb_typeof(p) is distinct from 'object' or not p?&array['id','user_id','kind','folder_id','name','mime','bytes','sha256','width','height','starred','deleted_at','deletion_batch_id','created_at','updated_at','modified_at'] or p-array['id','user_id','kind','folder_id','name','mime','bytes','sha256','width','height','starred','deleted_at','deletion_batch_id','created_at','updated_at','modified_at']<>'{}'::jsonb or p->>'id' is distinct from new.id::text or p->>'user_id' is distinct from new.user_id::text
   or jsonb_typeof(p->'name') is distinct from 'string' or char_length(btrim(p->>'name')) not between 1 and 200 or jsonb_typeof(p->'starred') is distinct from 'boolean' then raise exception 'Invalid file metadata.' using errcode='22023';end if;
 if tg_op='UPDATE' then
  if new.id<>old.id or new.user_id<>old.user_id or p-array['name','folder_id','starred','deleted_at','deletion_batch_id','updated_at','modified_at'] is distinct from old.payload-array['name','folder_id','starred','deleted_at','deletion_batch_id','updated_at','modified_at'] then raise exception 'File content and identity immutable.' using errcode='23514';end if;
 end if;
 new.kind:=p->>'kind';new.folder_id:=(p->>'folder_id')::uuid;new.name:=p->>'name';new.mime:=p->>'mime';new.bytes:=(p->>'bytes')::bigint;new.sha256:=p->>'sha256';new.width:=(p->>'width')::integer;new.height:=(p->>'height')::integer;
 new.deleted_at:=app_private.capture_task_timestamp(p->'deleted_at',true);new.deletion_batch_id:=(p->>'deletion_batch_id')::uuid;new.created_at:=app_private.capture_task_timestamp(p->'created_at');new.updated_at:=app_private.capture_task_timestamp(p->'updated_at');
 if new.folder_id is not null then
  if tg_op='INSERT' then if not exists(select 1 from public.drive_folders f where f.user_id=new.user_id and f.id=new.folder_id and f.deleted_at is null) then raise exception 'Folder unavailable.' using errcode='23514';end if;
  elsif new.folder_id is distinct from old.folder_id then if not exists(select 1 from public.drive_folders f where f.user_id=new.user_id and f.id=new.folder_id and f.deleted_at is null) then raise exception 'Folder unavailable.' using errcode='23514';end if;end if;
 end if;return new;
end $$;
create trigger drive_file_row before insert or update on public.drive_files for each row execute function app_private.drive_file_row();
create trigger drive_revision after insert or update or delete on public.drive_files for each row execute function app_private.capture_task_bump();
create trigger drive_revision after insert or update or delete on public.drive_folders for each row execute function app_private.capture_task_bump();
create trigger drive_revision after insert or update or delete on public.capture_file_links for each row execute function app_private.capture_task_bump();
create function app_private.drive_integrity(p_user uuid) returns void language plpgsql security definer set search_path='' as $$ begin
 if exists(select 1 from public.drive_folders child join public.drive_folders parent on parent.id=child.parent_id where child.user_id=p_user and child.deleted_at is null and parent.deleted_at is not null)
 or exists(select 1 from public.drive_files f join public.drive_folders p on p.id=f.folder_id where f.user_id=p_user and f.deleted_at is null and p.deleted_at is not null) then raise exception 'Live content under trashed folder.' using errcode='23514';end if;end $$;
create function app_private.drive_integrity_trigger() returns trigger language plpgsql security definer set search_path='' as $$ begin perform app_private.drive_integrity(case when tg_op='DELETE' then old.user_id else new.user_id end);return null;end $$;
create constraint trigger drive_integrity after insert or update or delete on public.drive_folders deferrable initially deferred for each row execute function app_private.drive_integrity_trigger();
create constraint trigger drive_integrity after insert or update or delete on public.drive_files deferrable initially deferred for each row execute function app_private.drive_integrity_trigger();

create function app_private.drive_snapshot(p_user uuid,p_session uuid,p_operation text,p_quota bigint,p_max_bytes bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare snapshot jsonb;begin perform app_private.drive_guard(p_user,p_session,p_operation);
 select jsonb_build_object('revision',coalesce((select r.revision::text from app_private.capture_task_revisions r where r.user_id=p_user),'0'),
  'folders',coalesce((select jsonb_agg(f.payload order by f.created_at,f.id) from public.drive_folders f where f.user_id=p_user),'[]'::jsonb),
  'files',coalesce((select jsonb_agg(f.payload order by f.created_at,f.id) from public.drive_files f where f.user_id=p_user and f.purged_at is null),'[]'::jsonb),
  'usage_bytes',coalesce((select sum(f.bytes) from public.drive_files f where f.user_id=p_user and f.purged_at is null),0),'capacity_bytes',p_quota,'max_file_bytes',p_max_bytes,
  'projects',case when app_private.projects_habits_feature(p_user,'projetos') then coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.payload->>'name') order by p.id) from public.projects p where p.user_id=p_user and p.deleted_at is null),'[]'::jsonb) else '[]'::jsonb end,
  'receipts',coalesce((select jsonb_agg(jsonb_build_object('user_id',r.user_id,'command',r.command,'client_id',r.client_id,'fingerprint',r.request->'receipt'->>'fingerprint','result',r.result)) from app_private.command_receipts r where r.user_id=p_user and r.command like 'drive.%'),'[]'::jsonb)) into snapshot;
 if octet_length(snapshot::text)>8388608 then raise exception 'Drive snapshot limit.' using errcode='54000';end if;return snapshot;end $$;
create function app_private.drive_receipt(p_user uuid,p_session uuid,p_operation text,p_command text,p_client_id text) returns jsonb language plpgsql security definer set search_path='' as $$ begin
 perform app_private.drive_guard(p_user,p_session,p_operation);if p_command<>p_operation then raise exception 'Invalid receipt operation.' using errcode='22023';end if;
 return(select jsonb_build_object('user_id',r.user_id,'command',r.command,'client_id',r.client_id,'fingerprint',r.request->'receipt'->>'fingerprint','result',r.result) from app_private.command_receipts r where r.user_id=p_user and r.command=p_command and r.client_id=p_client_id);end $$;
create function app_private.drive_commit(p_user uuid,p_session uuid,p_operation text,p_request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare rec jsonb;saved app_private.command_receipts;c jsonb;e jsonb;b jsonb;a jsonb;existing jsonb;table_name text;row_id uuid;kind text;matching integer;begin
 perform app_private.drive_guard(p_user,p_session,p_operation);
 if jsonb_typeof(p_request) is distinct from 'object' or p_request-array['expected_revision','context','changes','events','receipt']<>'{}'::jsonb or p_request->'context'->>'user_id' is distinct from p_user::text or p_request->'context'->>'canal' not in ('web','api','cron') or jsonb_typeof(p_request->'changes') is distinct from 'array' or jsonb_typeof(p_request->'events') is distinct from 'array' or octet_length(p_request::text)>2097152 then raise exception 'Invalid drive commit.' using errcode='22023';end if;
 rec:=p_request->'receipt';if rec->>'user_id' is distinct from p_user::text or rec->>'command' is distinct from p_operation or char_length(btrim(rec->>'client_id')) not between 1 and 200 then raise exception 'Invalid receipt.' using errcode='22023';end if;
 select r.* into saved from app_private.command_receipts r where r.user_id=p_user and r.command=p_operation and r.client_id=rec->>'client_id';if found then if saved.request->'receipt'->>'fingerprint' is distinct from rec->>'fingerprint' then raise exception 'Replay conflict.' using errcode='23505';end if;return jsonb_build_object('status','replayed','result',saved.result);end if;
 if p_request->>'expected_revision' is distinct from coalesce((select r.revision::text from app_private.capture_task_revisions r where r.user_id=p_user),'0') then return jsonb_build_object('status','stale');end if;
 if not (app_private.consume_rate_limit_at('capture_task_write',encode(sha256(convert_to(p_user::text,'UTF8')),'hex'),p_user,null)->>'allowed')::boolean then raise exception 'Rate limited.' using errcode='PT429';end if;
 if jsonb_array_length(p_request->'changes')<>jsonb_array_length(p_request->'events') then raise exception 'Every mutation requires event.' using errcode='23514';end if;
 for c in select value from jsonb_array_elements(p_request->'changes') loop
  kind:=c->>'type';table_name:=case kind when 'drive_folder' then 'drive_folders' when 'drive_file' then 'drive_files' end;b:=nullif(c->'before','null'::jsonb);a:=nullif(c->'after','null'::jsonb);if table_name is null or a is null or a->>'user_id' is distinct from p_user::text then raise exception 'Change outside owner.' using errcode='22023';end if;row_id:=(a->>'id')::uuid;
  select count(*) into matching from jsonb_array_elements(p_request->'events') event where event->>'entity_type'=kind and event->>'entity_id'=row_id::text and nullif(event->'before','null'::jsonb) is not distinct from b and nullif(event->'after','null'::jsonb) is not distinct from a;if matching<>1 then raise exception 'Mutation event mismatch.' using errcode='23514';end if;
  execute format('select t.payload from public.%I t where t.user_id=$1 and t.id=$2 for update',table_name) into existing using p_user,row_id;if existing is distinct from b then raise exception 'Stale/foreign row.' using errcode='40001';end if;
  if kind='drive_file' and (b is null or a->>'kind'<>'drive') then raise exception 'Files are created by measured upload only.' using errcode='23514';end if;
  if b is null then insert into public.drive_folders(id,user_id,payload,name,position,created_at,updated_at) values(row_id,p_user,a,a->>'name',(a->>'position')::integer,app_private.capture_task_timestamp(a->'created_at'),app_private.capture_task_timestamp(a->'updated_at'));
  else execute format('update public.%I set payload=$3 where user_id=$1 and id=$2',table_name) using p_user,row_id,a;end if;
 end loop;perform app_private.drive_integrity(p_user);
 for e in select value from jsonb_array_elements(p_request->'events') loop
  if e->>'user_id' is distinct from p_user::text or e->>'canal' is distinct from p_request->'context'->>'canal' or e->>'action' not in ('created','updated','deleted','restored') then raise exception 'Invalid event.' using errcode='23514';end if;
  insert into public.domain_events(id,user_id,entity_type,entity_id,action,canal,occurred_at,before,after) values((e->>'id')::uuid,p_user,e->>'entity_type',(e->>'entity_id')::uuid,e->>'action',e->>'canal',app_private.capture_task_timestamp(e->'occurred_at'),nullif(e->'before','null'::jsonb),e->'after');
 end loop;insert into app_private.command_receipts(user_id,command,client_id,request,result) values(p_user,p_operation,rec->>'client_id',jsonb_build_object('receipt',rec-'result'),rec->'result');return jsonb_build_object('status','committed','result',rec->'result');end $$;

create function app_private.file_upload_reserve(p_user uuid,p_session uuid,p_kind text,p_name text,p_folder uuid,p_client_id text,p_upload uuid,p_max_bytes bigint,p_quota bigint,p_expires timestamptz) returns jsonb language plpgsql security definer set search_path='' as $$
declare reservation app_private.upload_reservations;used bigint;pending bigint;begin
 perform app_private.file_guard(p_user,p_session,p_kind);
 if char_length(btrim(p_client_id)) not between 1 and 200 or char_length(btrim(p_name)) not between 1 and 200 or p_name~'[\x00-\x1f\\/]' or p_max_bytes not between 1 and (case when p_kind='drive' then 26214400 else 8388608 end) or p_quota not between 1024 and 10737418240 or p_expires<now() or p_expires>now()+interval '151 minutes' or p_kind<>'drive' and p_folder is not null then raise exception 'Invalid upload reservation.' using errcode='22023';end if;
 if p_folder is not null and not exists(select 1 from public.drive_folders f where f.user_id=p_user and f.id=p_folder and f.deleted_at is null) then raise exception 'Upload folder unavailable.' using errcode='23514';end if;
 select r.* into reservation from app_private.upload_reservations r where r.user_id=p_user and r.kind=p_kind and r.client_id=p_client_id for update;
 if found then
  if reservation.name<>p_name or reservation.folder_id is distinct from p_folder then raise exception 'Reservation replay conflict.' using errcode='23505';end if;
  if reservation.status not in ('reserved','processing') or reservation.expires_at<now() then raise exception 'Reservation expired/finalized.' using errcode='22023';end if;
  update app_private.upload_reservations r set expires_at=greatest(r.expires_at,p_expires) where r.id=reservation.id returning r.* into reservation;return to_jsonb(reservation);
 end if;
 if (select count(*) from app_private.upload_reservations r where r.user_id=p_user and r.created_at>now()-interval '1 minute')>=12 or (select count(*) from app_private.upload_reservations r where r.user_id=p_user and r.status in ('reserved','processing') and r.expires_at>now())>=12 then raise exception 'Upload rate/pending limit.' using errcode='PT429';end if;
 select coalesce(sum(f.bytes),0) into used from public.drive_files f where f.user_id=p_user and f.purged_at is null;
 select coalesce(sum(r.max_bytes),0) into pending from app_private.upload_reservations r where r.user_id=p_user and r.status in ('reserved','processing') and r.expires_at>now();
 if used+pending+p_max_bytes>p_quota then raise exception 'Storage quota exceeded.' using errcode='23514';end if;
 insert into app_private.upload_reservations(id,user_id,kind,name,folder_id,client_id,staging_path,final_path,max_bytes,quota_bytes,expires_at)
 values(p_upload,p_user,p_kind,p_name,p_folder,p_client_id,p_user::text||'/'||p_upload::text,p_user::text||'/'||p_upload::text,p_max_bytes,p_quota,p_expires) returning * into reservation;
 return to_jsonb(reservation);end $$;
create function app_private.file_upload_claim(p_user uuid,p_session uuid,p_upload uuid,p_lease uuid,p_client_id text) returns jsonb language plpgsql security definer set search_path='' as $$
declare reservation app_private.upload_reservations;receipt jsonb;file_row jsonb;begin
 select r.* into reservation from app_private.upload_reservations r where r.user_id=p_user and r.id=p_upload;if not found then raise exception 'Upload unavailable.' using errcode='42501';end if;
 perform app_private.file_guard(p_user,p_session,reservation.kind);
 receipt:=app_private.command_replay(p_user,'file.upload.finalize',p_client_id,jsonb_build_object('upload_id',p_upload,'client_id',p_client_id));
 if receipt is not null then return jsonb_build_object('reservation',null,'file',receipt);end if;
 select r.* into reservation from app_private.upload_reservations r where r.id=p_upload and r.user_id=p_user for update;
 if reservation.status='finalized' then select f.payload into file_row from public.drive_files f where f.user_id=p_user and f.id=reservation.file_id and f.purged_at is null;
  if file_row is null then raise exception 'Finalized file unavailable.' using errcode='22023';end if;
  insert into app_private.command_receipts(user_id,command,client_id,request,result) values(p_user,'file.upload.finalize',p_client_id,jsonb_build_object('upload_id',p_upload,'client_id',p_client_id),file_row);
  return jsonb_build_object('reservation',null,'file',file_row);
 end if;
 if reservation.status='expired' or reservation.expires_at<now() then raise exception 'Upload expired.' using errcode='22023';end if;
 if reservation.status='processing' and reservation.lease_until>now() then raise exception 'Upload processing.' using errcode='40001';end if;
 update app_private.upload_reservations r set status='processing',lease_id=p_lease,lease_until=now()+interval '5 minutes' where r.user_id=p_user and r.id=p_upload returning r.* into reservation;
 return jsonb_build_object('reservation',to_jsonb(reservation),'file',null);end $$;
create function app_private.file_upload_release(p_user uuid,p_session uuid,p_upload uuid,p_lease uuid) returns void language plpgsql security definer set search_path='' as $$
declare reservation app_private.upload_reservations;begin select r.* into reservation from app_private.upload_reservations r where r.user_id=p_user and r.id=p_upload;if not found then return;end if;perform app_private.file_guard(p_user,p_session,reservation.kind);update app_private.upload_reservations r set status='reserved',lease_id=null,lease_until=null where r.user_id=p_user and r.id=p_upload and r.lease_id=p_lease and r.status='processing';end $$;
create function app_private.file_upload_complete(p_user uuid,p_session uuid,p_upload uuid,p_lease uuid,p_client_id text,p_file jsonb,p_quota bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare reservation app_private.upload_reservations;receipt jsonb;used bigint;pending bigint;begin
 select r.* into reservation from app_private.upload_reservations r where r.user_id=p_user and r.id=p_upload;if not found then raise exception 'Upload unavailable.' using errcode='42501';end if;perform app_private.file_guard(p_user,p_session,reservation.kind);
 receipt:=app_private.command_replay(p_user,'file.upload.finalize',p_client_id,jsonb_build_object('upload_id',p_upload,'client_id',p_client_id));if receipt is not null then return receipt;end if;
 select r.* into reservation from app_private.upload_reservations r where r.user_id=p_user and r.id=p_upload for update;
 if reservation.status<>'processing' or reservation.lease_id is distinct from p_lease or reservation.lease_until<now() or reservation.expires_at<now() then raise exception 'Upload lease unavailable.' using errcode='40001';end if;
 if p_file->>'id' is distinct from p_upload::text or p_file->>'user_id' is distinct from p_user::text or p_file->>'kind' is distinct from reservation.kind or (p_file->>'folder_id')::uuid is distinct from reservation.folder_id or (p_file->>'bytes')::bigint not between 1 and reservation.max_bytes or p_file->>'mime' not in ('image/png','image/jpeg','application/pdf','application/zip','text/plain','audio/wav','audio/ogg','audio/mpeg','video/mp4') or p_file->'deleted_at'<>'null'::jsonb or p_file->'deletion_batch_id'<>'null'::jsonb or p_file->'starred'<>'false'::jsonb then raise exception 'Invalid measured upload metadata.' using errcode='22023';end if;
 select coalesce(sum(f.bytes),0) into used from public.drive_files f where f.user_id=p_user and f.purged_at is null;
 select coalesce(sum(r.max_bytes),0) into pending from app_private.upload_reservations r where r.user_id=p_user and r.id<>p_upload and r.status in ('reserved','processing') and r.expires_at>now();
 if used+pending+(p_file->>'bytes')::bigint>least(p_quota,reservation.quota_bytes) then raise exception 'Storage quota exceeded.' using errcode='23514';end if;
 insert into public.drive_files(id,user_id,payload,kind,name,mime,bytes,sha256,storage_path,created_at,updated_at) values(p_upload,p_user,p_file,reservation.kind,p_file->>'name',p_file->>'mime',(p_file->>'bytes')::bigint,p_file->>'sha256',reservation.final_path,app_private.capture_task_timestamp(p_file->'created_at'),app_private.capture_task_timestamp(p_file->'updated_at'));
 perform app_private.append_event(p_user,'drive_file',p_upload,'created','web',null,p_file);
 update app_private.upload_reservations r set status='finalized',file_id=p_upload,lease_id=null,lease_until=null where r.user_id=p_user and r.id=p_upload;
 insert into app_private.command_receipts(user_id,command,client_id,request,result) values(p_user,'file.upload.finalize',p_client_id,jsonb_build_object('upload_id',p_upload,'client_id',p_client_id),p_file);return p_file;end $$;
create function app_private.file_upload_status(p_user uuid,p_session uuid,p_upload uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare reservation app_private.upload_reservations;begin select r.* into reservation from app_private.upload_reservations r where r.user_id=p_user and r.id=p_upload;if not found then raise exception 'Upload unavailable.' using errcode='42501';end if;perform app_private.file_guard(p_user,p_session,reservation.kind);return jsonb_build_object('status',reservation.status,'file',(select f.payload from public.drive_files f where f.user_id=p_user and f.id=reservation.file_id and f.purged_at is null));end $$;
create function app_private.file_read_metadata(p_user uuid,p_session uuid,p_file uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare file_row public.drive_files;begin select f.* into file_row from public.drive_files f where f.user_id=p_user and f.id=p_file;if not found then raise exception 'File unavailable.' using errcode='42501';end if;perform app_private.file_guard(p_user,p_session,file_row.kind);if file_row.deleted_at is not null or file_row.purged_at is not null then raise exception 'File trashed/expired.' using errcode='22023';end if;return jsonb_build_object('file',file_row.payload,'storage_path',file_row.storage_path);end $$;
create function app_private.file_avatar_set(p_user uuid,p_session uuid,p_file uuid,p_client_id text) returns jsonb language plpgsql security definer set search_path='' as $$
declare receipt jsonb;before_row jsonb;after_row jsonb;begin
 perform app_private.file_guard(p_user,p_session,'avatar');receipt:=app_private.command_replay(p_user,case when p_file is null then 'avatar.remove' else 'avatar.set' end,p_client_id,jsonb_build_object('file_id',p_file,'client_id',p_client_id));if receipt is not null then return receipt;end if;
 if p_file is not null and not exists(select 1 from public.drive_files f where f.user_id=p_user and f.id=p_file and f.kind='avatar' and f.deleted_at is null and f.purged_at is null) then raise exception 'Avatar unavailable.' using errcode='23514';end if;
 select to_jsonb(p.*) into before_row from public.profiles p where p.user_id=p_user for update;update public.profiles p set avatar_file_id=p_file,avatar_url=null,updated_at=now() where p.user_id=p_user returning to_jsonb(p.*) into after_row;
 perform app_private.append_event(p_user,'profile',p_user,'updated','web',before_row,after_row);receipt:=jsonb_build_object('avatar_file_id',p_file);
 insert into app_private.command_receipts(user_id,command,client_id,request,result) values(p_user,case when p_file is null then 'avatar.remove' else 'avatar.set' end,p_client_id,jsonb_build_object('file_id',p_file,'client_id',p_client_id),receipt);return receipt;end $$;

-- Reuse the entire installed validator without altering historical migrations.
-- CREATE OR REPLACE preserves its OID for already compiled caller functions.
do $$ declare definition text;begin select pg_get_functiondef('app_private.capture_task_validate_payload(text,jsonb)'::regprocedure) into definition;execute replace(definition,'FUNCTION app_private.capture_task_validate_payload(','FUNCTION app_private.capture_task_validate_payload_v1(');end $$;
create or replace function app_private.capture_task_validate_payload(p_kind text,p jsonb) returns void language plpgsql set search_path='' as $$
declare attachment jsonb;file_row public.drive_files;ids uuid[]:='{}';begin
 if p_kind<>'capture' or not p?'attachments' then perform app_private.capture_task_validate_payload_v1(p_kind,p);return;end if;
 perform app_private.capture_task_validate_payload_v1(p_kind,jsonb_set(p,'{attachments}','[]'::jsonb));
 if jsonb_typeof(p->'attachments') is distinct from 'array' or jsonb_array_length(p->'attachments')>6 then raise exception 'Six capture images maximum.' using errcode='22023';end if;
 for attachment in select value from jsonb_array_elements(p->'attachments') loop
  if attachment-array['id','name','mime','width','height','bytes']<>'{}'::jsonb or not attachment?&array['id','name','mime','width','height','bytes'] then raise exception 'Invalid attachment metadata.' using errcode='22023';end if;
  select f.* into file_row from public.drive_files f where f.user_id=(p->>'user_id')::uuid and f.id=(attachment->>'id')::uuid and f.kind='capture_image' and f.deleted_at is null and f.purged_at is null;
  if not found or file_row.id=any(ids) then raise exception 'Capture file must be owned/finalized/unique.' using errcode='23514';end if;
  if attachment is distinct from jsonb_build_object('id',file_row.id,'name',file_row.name,'mime',file_row.mime,'width',file_row.width,'height',file_row.height,'bytes',file_row.bytes) then raise exception 'Attachment metadata differs from measured file.' using errcode='23514';end if;ids:=array_append(ids,file_row.id);
 end loop;end $$;
create function app_private.capture_files_sync() returns trigger language plpgsql security definer set search_path='' as $$ begin
 delete from public.capture_file_links l where l.user_id=new.user_id and l.capture_id=new.id and l.file_id not in(select(a->>'id')::uuid from jsonb_array_elements(coalesce(new.payload->'attachments','[]'::jsonb)) a);
 insert into public.capture_file_links(user_id,capture_id,file_id) select new.user_id,new.id,(a->>'id')::uuid from jsonb_array_elements(coalesce(new.payload->'attachments','[]'::jsonb)) a on conflict do nothing;return new;end $$;
create trigger capture_files_sync after insert or update on public.captures for each row execute function app_private.capture_files_sync();

create function app_private.file_cleanup_candidates() returns jsonb language plpgsql security definer set search_path='' as $$
declare candidate record;reservation app_private.upload_reservations;file_row public.drive_files;before_row jsonb;after_row jsonb;remove_final boolean;result_rows jsonb:='[]'::jsonb;begin
 for candidate in select r.id,r.user_id from app_private.upload_reservations r where r.expires_at<now() and (r.lease_until is null or r.lease_until<now()) and
  (r.cleaned_at is null or r.status='expired' and r.cleaned_at<now()-interval '1 day' or r.status='finalized' and exists(select 1 from public.drive_files f where f.id=r.file_id and f.user_id=r.user_id and f.kind<>'drive' and f.purged_at is null and f.created_at<now()-interval '1 day'
    and not exists(select 1 from public.profiles p where p.user_id=r.user_id and p.avatar_file_id=f.id)
    and not exists(select 1 from public.capture_file_links l where l.user_id=r.user_id and l.file_id=f.id))) order by r.expires_at,r.id limit 100 loop
  perform 1 from auth.users u where u.id=candidate.user_id for share;perform app_private.capture_task_lock(candidate.user_id);
  select r.* into reservation from app_private.upload_reservations r where r.id=candidate.id for update;if not found or reservation.expires_at>=now() or reservation.lease_until>now() then continue;end if;
  remove_final:=reservation.file_id is null;
  if reservation.file_id is not null then
   select f.* into file_row from public.drive_files f where f.user_id=reservation.user_id and f.id=reservation.file_id for update;
   if found then
    if file_row.kind<>'drive' and file_row.purged_at is null and file_row.created_at<now()-interval '1 day'
      and not exists(select 1 from public.profiles p where p.user_id=reservation.user_id and p.avatar_file_id=file_row.id)
      and not exists(select 1 from public.capture_file_links l where l.user_id=reservation.user_id and l.file_id=file_row.id) then
      remove_final:=true;
      if file_row.deleted_at is null then before_row:=file_row.payload;after_row:=before_row||jsonb_build_object('deleted_at',now(),'deletion_batch_id',gen_random_uuid(),'updated_at',now(),'modified_at',now());
       update public.drive_files f set payload=after_row where f.id=file_row.id;perform app_private.append_event(reservation.user_id,'drive_file',file_row.id,'deleted','cron',before_row,after_row);
      end if;
    end if;
   end if;
  else update app_private.upload_reservations r set status='expired',lease_id=null,lease_until=null where r.id=reservation.id;end if;
  result_rows:=result_rows||jsonb_build_array(jsonb_build_object('id',reservation.id,'staging_path',reservation.staging_path,'final_path',reservation.final_path,'remove_final',remove_final));
 end loop;return result_rows;end $$;
create function app_private.file_cleanup_ack(p_upload uuid) returns void language plpgsql security definer set search_path='' as $$
declare reservation app_private.upload_reservations;begin
 select r.* into reservation from app_private.upload_reservations r where r.id=p_upload;if not found then return;end if;
 perform 1 from auth.users u where u.id=reservation.user_id for share;perform app_private.capture_task_lock(reservation.user_id);select r.* into reservation from app_private.upload_reservations r where r.id=p_upload for update;
 if reservation.expires_at>=now() or reservation.lease_until>now() then raise exception 'Cleanup raced active lease.' using errcode='40001';end if;
 if reservation.file_id is not null and exists(select 1 from public.drive_files f where f.id=reservation.file_id and f.kind<>'drive' and f.deleted_at is not null)
  and not exists(select 1 from public.profiles p where p.user_id=reservation.user_id and p.avatar_file_id=reservation.file_id)
  and not exists(select 1 from public.capture_file_links l where l.user_id=reservation.user_id and l.file_id=reservation.file_id) then update public.drive_files f set purged_at=now() where f.id=reservation.file_id;end if;
 update app_private.upload_reservations r set cleaned_at=now() where r.id=p_upload;end $$;
create function app_private.file_cleanup_log(p_removed integer,p_failed integer) returns void language sql security definer set search_path='' as $$ insert into app_private.file_cleanup_runs(removed,failed) values(p_removed,p_failed);$$;

create function public.drive_snapshot(p_user uuid,p_session uuid,p_operation text,p_quota bigint,p_max_bytes bigint) returns jsonb language sql security invoker set search_path='' as $$select app_private.drive_snapshot(p_user,p_session,p_operation,p_quota,p_max_bytes);$$;
create function public.drive_commit(p_user uuid,p_session uuid,p_operation text,p_request jsonb) returns jsonb language sql security invoker set search_path='' as $$select app_private.drive_commit(p_user,p_session,p_operation,p_request);$$;
create function public.drive_receipt(p_user uuid,p_session uuid,p_operation text,p_command text,p_client_id text) returns jsonb language sql security invoker set search_path='' as $$select app_private.drive_receipt(p_user,p_session,p_operation,p_command,p_client_id);$$;
create function public.file_upload_reserve(p_user uuid,p_session uuid,p_kind text,p_name text,p_folder uuid,p_client_id text,p_upload uuid,p_max_bytes bigint,p_quota bigint,p_expires timestamptz) returns jsonb language sql security invoker set search_path='' as $$select app_private.file_upload_reserve(p_user,p_session,p_kind,p_name,p_folder,p_client_id,p_upload,p_max_bytes,p_quota,p_expires);$$;
create function public.file_upload_claim(p_user uuid,p_session uuid,p_upload uuid,p_lease uuid,p_client_id text) returns jsonb language sql security invoker set search_path='' as $$select app_private.file_upload_claim(p_user,p_session,p_upload,p_lease,p_client_id);$$;
create function public.file_upload_release(p_user uuid,p_session uuid,p_upload uuid,p_lease uuid) returns void language sql security invoker set search_path='' as $$select app_private.file_upload_release(p_user,p_session,p_upload,p_lease);$$;
create function public.file_upload_complete(p_user uuid,p_session uuid,p_upload uuid,p_lease uuid,p_client_id text,p_file jsonb,p_quota bigint) returns jsonb language sql security invoker set search_path='' as $$select app_private.file_upload_complete(p_user,p_session,p_upload,p_lease,p_client_id,p_file,p_quota);$$;
create function public.file_upload_status(p_user uuid,p_session uuid,p_upload uuid) returns jsonb language sql security invoker set search_path='' as $$select app_private.file_upload_status(p_user,p_session,p_upload);$$;
create function public.file_read_metadata(p_user uuid,p_session uuid,p_file uuid) returns jsonb language sql security invoker set search_path='' as $$select app_private.file_read_metadata(p_user,p_session,p_file);$$;
create function public.file_avatar_set(p_user uuid,p_session uuid,p_file uuid,p_client_id text) returns jsonb language sql security invoker set search_path='' as $$select app_private.file_avatar_set(p_user,p_session,p_file,p_client_id);$$;
create function public.file_cleanup_candidates() returns jsonb language sql security invoker set search_path='' as $$select app_private.file_cleanup_candidates();$$;
create function public.file_cleanup_ack(p_upload uuid) returns void language sql security invoker set search_path='' as $$select app_private.file_cleanup_ack(p_upload);$$;
create function public.file_cleanup_log(p_removed integer,p_failed integer) returns void language sql security invoker set search_path='' as $$select app_private.file_cleanup_log(p_removed,p_failed);$$;

alter table public.drive_files enable row level security;alter table public.capture_file_links enable row level security;
revoke all on public.drive_files,public.capture_file_links from public,anon,authenticated,service_role;
grant select on public.drive_files,public.capture_file_links to authenticated;
create policy files_owner_read on public.drive_files for select to authenticated using(user_id=(select auth.uid()) and purged_at is null and
 ((kind='drive' and (select app_private.has_feature('drive'))) or(kind='capture_image' and (select app_private.has_feature('capturar'))) or(kind='avatar' and (select app_private.has_feature('configuracoes')))));
create policy capture_files_owner_read on public.capture_file_links for select to authenticated using(user_id=(select auth.uid()) and (select app_private.has_feature('capturar')));
alter table app_private.upload_reservations enable row level security;alter table app_private.file_cleanup_runs enable row level security;
revoke all on app_private.upload_reservations,app_private.file_cleanup_runs from public,anon,authenticated,service_role;
do $$declare fn record;begin for fn in select p.oid::regprocedure::text signature,p.proname,n.nspname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('public','app_private') and (p.proname like 'drive_%' or p.proname like 'file_%' or p.proname in ('capture_files_sync','capture_task_validate_payload_v1')) loop
 execute format('revoke all on function %s from public,anon,authenticated,service_role',fn.signature);
 if fn.proname in ('drive_snapshot','drive_commit','drive_receipt','file_upload_reserve','file_upload_claim','file_upload_release','file_upload_complete','file_upload_status','file_read_metadata','file_avatar_set','file_cleanup_candidates','file_cleanup_ack','file_cleanup_log') then execute format('grant execute on function %s to service_role',fn.signature);end if;
 end loop;end $$;
comment on table app_private.upload_reservations is 'Server-only owner lease/quota accounting. Signed URLs/tokens never stored, emitted or journaled.';
comment on table public.drive_files is 'Measured immutable final metadata. Trash keeps quota until orphan purge acknowledgment; no direct owner writes.';
commit;
