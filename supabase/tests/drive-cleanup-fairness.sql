-- Disposable metadata regression for migration 015. No Storage HTTP/bytes.
-- ACK below simulates successful removal; this does not attest hosted cleanup.
begin;
set local statement_timeout='60s';set local lock_timeout='5s';
select set_config('fair.baseline_users',(select count(*)::text from auth.users),true),
 set_config('fair.baseline_reservations',(select count(*)::text from app_private.upload_reservations),true),
 set_config('fair.baseline_files',(select count(*)::text from public.drive_files),true),
 set_config('fair.baseline_events',(select count(*)::text from public.domain_events),true);
create function pg_temp.cleanup_assert(ok boolean,message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Cleanup fairness: %',message;end if;end $$;
create function pg_temp.cleanup_error(command text,expected text) returns void language plpgsql as $$
declare actual text;begin
 begin execute command;exception when others then
  get stacked diagnostics actual=returned_sqlstate;
  if actual<>expected then raise exception 'Expected %, got %',expected,actual;end if;return;
 end;raise exception 'Expected %, succeeded',expected;
end $$;
create function pg_temp.cleanup_file(id uuid,kind text) returns jsonb language sql as $$
 select jsonb_build_object('id',id,'user_id',current_setting('fair.user'),'kind',kind,'folder_id',null,
  'name','Synthetic.png','mime',case when kind='drive' then 'text/plain' else 'image/png' end,
  'bytes',10,'sha256',repeat('a',64),'width',case when kind='drive' then null else 20 end,
  'height',case when kind='drive' then null else 40 end,'starred',false,'deleted_at',null,'deletion_batch_id',null,
  'created_at',now()-interval '2 days','updated_at',now()-interval '2 days','modified_at',now()-interval '2 days');
$$;
create function pg_temp.cleanup_capture() returns jsonb language sql as $$
 select jsonb_build_object('id',current_setting('fair.capture'),'user_id',current_setting('fair.user'),
  'client_id','fair-linked-capture','type','note','title','Synthetic attachment','content','Local assertion',
  'status','inbox','category_id',null,'project_id',null,'converted_task_id',null,'captured_at',now(),
  'organized_at',null,'archived_at',null,'deleted_at',null,'created_at',now(),'updated_at',now(),
  'attachments',jsonb_build_array(jsonb_build_object('id',current_setting('fair.linked'),'name','Synthetic.png',
   'mime','image/png','bytes',10,'width',20,'height',40)));
$$;
create function pg_temp.cleanup_no_residue() returns void language plpgsql as $$ begin
 perform pg_temp.cleanup_assert((select count(*)::text=current_setting('fair.baseline_users') from auth.users),'Auth baseline restored');
 perform pg_temp.cleanup_assert((select count(*)::text=current_setting('fair.baseline_reservations') from app_private.upload_reservations),'reservation baseline restored');
 perform pg_temp.cleanup_assert((select count(*)::text=current_setting('fair.baseline_files') from public.drive_files),'file baseline restored');
 perform pg_temp.cleanup_assert((select count(*)::text=current_setting('fair.baseline_events') from public.domain_events),'event baseline restored');
end $$;
do $$ declare schema_name text;begin
 perform pg_temp.cleanup_assert(current_user='postgres','owner required');
 select nspname into schema_name from pg_namespace where oid=pg_my_temp_schema();
 execute format('grant usage on schema %I to service_role',schema_name);
 execute format('grant execute on all functions in schema %I to service_role',schema_name);
end $$;
savepoint synthetic_scenario;

-- A daily batch used to revisit the same oldest 100 forever. Use 150 here.
select set_config('fair.user',gen_random_uuid()::text,true),set_config('fair.session',gen_random_uuid()::text,true),
 set_config('fair.drive',gen_random_uuid()::text,true),set_config('fair.avatar',gen_random_uuid()::text,true),
 set_config('fair.linked',gen_random_uuid()::text,true),set_config('fair.image_orphan',gen_random_uuid()::text,true),
 set_config('fair.stage_orphan',gen_random_uuid()::text,true),set_config('fair.capture',gen_random_uuid()::text,true);
insert into auth.users(id,aud,role,email,is_anonymous) values(current_setting('fair.user')::uuid,'authenticated','authenticated','fair-'||current_setting('fair.user')||'@example.invalid',false);
insert into auth.sessions(id,user_id) values(current_setting('fair.session')::uuid,current_setting('fair.user')::uuid);
set local role service_role;
do $$ declare fixture record;lease uuid;u uuid:=current_setting('fair.user')::uuid;s uuid:=current_setting('fair.session')::uuid;begin
 for fixture in select * from (values
  (current_setting('fair.drive')::uuid,'drive'),(current_setting('fair.avatar')::uuid,'avatar'),
  (current_setting('fair.linked')::uuid,'capture_image'),(current_setting('fair.image_orphan')::uuid,'capture_image')) f(id,kind) loop
  lease:=gen_random_uuid();
  perform public.file_upload_reserve(u,s,fixture.kind,'Synthetic.png',null,'reserve-'||fixture.id,fixture.id,1000,1048576,now()+interval '150 minutes');
  perform public.file_upload_claim(u,s,fixture.id,lease,'finalize-'||fixture.id);
  perform public.file_upload_complete(u,s,fixture.id,lease,'finalize-'||fixture.id,pg_temp.cleanup_file(fixture.id,fixture.kind),1048576);
 end loop;
 perform public.file_avatar_set(u,s,current_setting('fair.avatar')::uuid,'fair-avatar');
 perform public.file_upload_reserve(u,s,'drive','Abandoned.txt',null,'fair-stage-orphan',current_setting('fair.stage_orphan')::uuid,1000,1048576,now()+interval '150 minutes');
end $$;
reset role;
insert into public.captures(id,user_id,client_id,payload,status,created_at,updated_at)
 values(current_setting('fair.capture')::uuid,current_setting('fair.user')::uuid,'fair-linked-capture',pg_temp.cleanup_capture(),'inbox',now(),now());
do $$ declare event jsonb;begin
 event:=jsonb_build_object('id',gen_random_uuid(),'user_id',current_setting('fair.user'),'entity_type','capture',
  'entity_id',current_setting('fair.capture'),'action','created','canal','web','occurred_at',now(),'before',null,'after',pg_temp.cleanup_capture());
 insert into public.domain_events(id,user_id,entity_type,entity_id,action,canal,occurred_at,before,after,capture_task_payload)
  values((event->>'id')::uuid,current_setting('fair.user')::uuid,'capture',current_setting('fair.capture')::uuid,'created','web',now(),null,pg_temp.cleanup_capture(),event);
end $$;
update app_private.upload_reservations set expires_at=now()-interval '1 minute' where user_id=current_setting('fair.user')::uuid;
insert into app_private.upload_reservations(id,user_id,kind,name,client_id,staging_path,final_path,max_bytes,quota_bytes,expires_at,status,created_at,cleaned_at)
 select id,current_setting('fair.user')::uuid,'drive','Old.txt','old-'||n,current_setting('fair.user')||'/'||id,
  current_setting('fair.user')||'/'||id,10,1048576,now()-interval '100 days'+n*interval '1 minute','expired',now()-interval '101 days',now()-interval '2 days'
 from (select n,gen_random_uuid() id from generate_series(1,150) n) rows;
set local role service_role;
do $$ declare batch jsonb;candidate jsonb;begin
 batch:=public.file_cleanup_candidates();perform set_config('fair.first_batch',batch::text,true);
 perform pg_temp.cleanup_assert(jsonb_array_length(batch)=100,'first batch is bounded at 100');
 perform pg_temp.cleanup_assert(not exists(select 1 from jsonb_array_elements(batch) c where c->>'id'=current_setting('fair.stage_orphan')),'older due revisits precede recent first cleanup');
 perform pg_temp.cleanup_assert(public.drive_snapshot(current_setting('fair.user')::uuid,current_setting('fair.session')::uuid,'read.drive',1048576,1000)->>'usage_bytes'='40','quota unchanged by candidates');
 for candidate in select value from jsonb_array_elements(batch) loop perform public.file_cleanup_ack((candidate->>'id')::uuid);end loop;
end $$;
reset role;
select pg_temp.cleanup_assert((select count(*)=100 from app_private.upload_reservations where user_id=current_setting('fair.user')::uuid and cleaned_at=now()),'100 successful ACKs advance reconciliation');
-- now() is fixed in the transaction: age the scheduler clocks by 25h to model
-- the next daily invocation. Every already-ACKed expired row is eligible again.
update app_private.upload_reservations set expires_at=expires_at-interval '25 hours',
 created_at=created_at-interval '25 hours',cleaned_at=cleaned_at-interval '25 hours'
 where user_id=current_setting('fair.user')::uuid;
select pg_temp.cleanup_assert((select count(*)=150 from app_private.upload_reservations where user_id=current_setting('fair.user')::uuid and status='expired' and cleaned_at<now()-interval '1 day'),'all 150 revisits eligible again');
set local role service_role;
do $$ declare batch jsonb;candidate jsonb;begin
 batch:=public.file_cleanup_candidates();perform set_config('fair.second_batch',batch::text,true);
 perform pg_temp.cleanup_assert(jsonb_array_length(batch)=100,'second daily batch remains bounded');
 perform pg_temp.cleanup_assert(exists(select 1 from jsonb_array_elements(batch) c where c->>'id'=current_setting('fair.stage_orphan') and (c->>'remove_final')::boolean),'new abandoned upload progresses on second daily batch');
 perform pg_temp.cleanup_assert(exists(select 1 from jsonb_array_elements(batch) c where c->>'id'=current_setting('fair.image_orphan') and (c->>'remove_final')::boolean),'unlinked old image progresses');
 perform pg_temp.cleanup_assert((select count(*)=3 from jsonb_array_elements(batch) c where c->>'id' in(current_setting('fair.drive'),current_setting('fair.avatar'),current_setting('fair.linked')) and not(c->>'remove_final')::boolean),'Drive/avatar/linked image only remove staging');
 perform pg_temp.cleanup_assert(public.drive_snapshot(current_setting('fair.user')::uuid,current_setting('fair.session')::uuid,'read.drive',1048576,1000)->>'usage_bytes'='40','deletion scheduling retains quota until Storage ACK');
 for candidate in select value from jsonb_array_elements(batch) loop perform public.file_cleanup_ack((candidate->>'id')::uuid);end loop;
 perform public.file_cleanup_ack(current_setting('fair.image_orphan')::uuid);
 perform pg_temp.cleanup_assert(public.drive_snapshot(current_setting('fair.user')::uuid,current_setting('fair.session')::uuid,'read.drive',1048576,1000)->>'usage_bytes'='30','only orphan quota released after ACK');
end $$;
reset role;
select pg_temp.cleanup_assert((select purged_at is not null and deleted_at is not null from public.drive_files where id=current_setting('fair.image_orphan')::uuid),'orphan purged after ACK');
select pg_temp.cleanup_assert((select count(*)=3 and bool_and(purged_at is null and deleted_at is null) from public.drive_files where id in(current_setting('fair.drive')::uuid,current_setting('fair.avatar')::uuid,current_setting('fair.linked')::uuid)),'protected final objects remain intact');
select pg_temp.cleanup_assert(exists(select 1 from public.profiles where user_id=current_setting('fair.user')::uuid and avatar_file_id=current_setting('fair.avatar')::uuid),'avatar reference preserved');
select pg_temp.cleanup_assert(exists(select 1 from public.capture_file_links where user_id=current_setting('fair.user')::uuid and capture_id=current_setting('fair.capture')::uuid and file_id=current_setting('fair.linked')::uuid),'capture link preserved');
rollback to savepoint synthetic_scenario;
select pg_temp.cleanup_no_residue();

-- The reverse direction matters too: 150 new first cleanups cannot displace
-- 50 older due revisits, as unconditional NULLS FIRST would do.
select set_config('fair.user',gen_random_uuid()::text,true);
insert into auth.users(id,aud,role,email,is_anonymous) values(current_setting('fair.user')::uuid,'authenticated','authenticated','fair-'||current_setting('fair.user')||'@example.invalid',false);
insert into app_private.upload_reservations(id,user_id,kind,name,client_id,staging_path,final_path,max_bytes,quota_bytes,expires_at,status,created_at,cleaned_at)
 select id,current_setting('fair.user')::uuid,'drive','Old.txt','old-'||n,current_setting('fair.user')||'/'||id,
  current_setting('fair.user')||'/'||id,10,1048576,now()-interval '100 days','expired',now()-interval '101 days',now()-interval '2 days'
 from (select n,gen_random_uuid() id from generate_series(1,50) n) rows;
insert into app_private.upload_reservations(id,user_id,kind,name,client_id,staging_path,final_path,max_bytes,quota_bytes,expires_at,status,created_at)
 select id,current_setting('fair.user')::uuid,'drive','New.txt','new-'||n,current_setting('fair.user')||'/'||id,
  current_setting('fair.user')||'/'||id,10,1048576,now()-interval '1 minute','reserved',now()-interval '3 hours'
 from (select n,gen_random_uuid() id from generate_series(1,150) n) rows;
set local role service_role;
select set_config('fair.reverse_batch',public.file_cleanup_candidates()::text,true);
select pg_temp.cleanup_assert(public.file_cleanup_candidates()=current_setting('fair.reverse_batch')::jsonb,'unconfirmed attempts do not advance the ordering clock');
reset role;
select pg_temp.cleanup_assert((select count(*)=50 from jsonb_array_elements(current_setting('fair.reverse_batch')::jsonb) c join app_private.upload_reservations r on r.id=(c->>'id')::uuid where r.cleaned_at is not null),'all 50 overdue revisits progress despite 150 newcomers');
select pg_temp.cleanup_assert((select count(*)=50 from jsonb_array_elements(current_setting('fair.reverse_batch')::jsonb) c join app_private.upload_reservations r on r.id=(c->>'id')::uuid where r.cleaned_at is null),'first cleanup also progresses in reverse scenario');
set local role service_role;
do $$ declare candidate jsonb;begin for candidate in select value from jsonb_array_elements(current_setting('fair.reverse_batch')::jsonb) loop perform public.file_cleanup_ack((candidate->>'id')::uuid);end loop;end $$;
reset role;
select pg_temp.cleanup_assert((select count(*)=100 from app_private.upload_reservations where user_id=current_setting('fair.user')::uuid and cleaned_at=now()),'ACK advances both classes of work');
rollback to savepoint synthetic_scenario;
select pg_temp.cleanup_no_residue();

-- Ordering never overrides an active finalize lease or future expiration.
select set_config('fair.user',gen_random_uuid()::text,true),set_config('fair.session',gen_random_uuid()::text,true),
 set_config('fair.active_upload',gen_random_uuid()::text,true),set_config('fair.active_lease',gen_random_uuid()::text,true),set_config('fair.future_upload',gen_random_uuid()::text,true);
insert into auth.users(id,aud,role,email,is_anonymous) values(current_setting('fair.user')::uuid,'authenticated','authenticated','fair-'||current_setting('fair.user')||'@example.invalid',false);
insert into auth.sessions(id,user_id) values(current_setting('fair.session')::uuid,current_setting('fair.user')::uuid);
set local role service_role;
select public.file_upload_reserve(current_setting('fair.user')::uuid,current_setting('fair.session')::uuid,'drive','Lease.txt',null,'fair-active',current_setting('fair.active_upload')::uuid,1000,1048576,now()+interval '150 minutes');
select public.file_upload_claim(current_setting('fair.user')::uuid,current_setting('fair.session')::uuid,current_setting('fair.active_upload')::uuid,current_setting('fair.active_lease')::uuid,'fair-active-finalize');
select public.file_upload_reserve(current_setting('fair.user')::uuid,current_setting('fair.session')::uuid,'drive','Future.txt',null,'fair-future',current_setting('fair.future_upload')::uuid,1000,1048576,now()+interval '150 minutes');
reset role;
update app_private.upload_reservations set expires_at=now()-interval '1 minute' where id=current_setting('fair.active_upload')::uuid;
set local role service_role;
select pg_temp.cleanup_assert(public.file_cleanup_candidates()='[]'::jsonb,'active lease and future expiration excluded');
select pg_temp.cleanup_error(format('select public.file_cleanup_ack(%L)',current_setting('fair.active_upload')),'40001');
select pg_temp.cleanup_error(format('select public.file_cleanup_ack(%L)',current_setting('fair.future_upload')),'40001');
reset role;
select pg_temp.cleanup_assert((select status='processing' and lease_id=current_setting('fair.active_lease')::uuid and lease_until>now() and cleaned_at is null from app_private.upload_reservations where id=current_setting('fair.active_upload')::uuid),'active claim preserved');
rollback to savepoint synthetic_scenario;
select pg_temp.cleanup_no_residue();
rollback;
