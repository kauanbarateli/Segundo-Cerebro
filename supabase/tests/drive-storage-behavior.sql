-- Synthetic RPC metadata assertions in a rollback transaction. Actual bytes,
-- signed Storage capabilities, real Auth and parallel races need hosted tests.
begin;
set local statement_timeout='60s';set local lock_timeout='5s';
select set_config('t022.user',gen_random_uuid()::text,true),set_config('t022.other',gen_random_uuid()::text,true),set_config('t022.session',gen_random_uuid()::text,true),set_config('t022.folder',gen_random_uuid()::text,true),set_config('t022.upload',gen_random_uuid()::text,true),set_config('t022.lease',gen_random_uuid()::text,true),set_config('t022.image',gen_random_uuid()::text,true);
create function pg_temp.drive_assert(ok boolean,message text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'Drive behavior: %',message;end if;end $$;
create function pg_temp.drive_error(command text,expected text) returns void language plpgsql as $$ declare actual text;detail text;context text;begin begin execute command;exception when others then get stacked diagnostics actual=returned_sqlstate,detail=message_text,context=pg_exception_context;if actual<>expected then raise exception 'Expected %, got %: % / %',expected,actual,detail,left(context,400);end if;return;end;raise exception 'Expected %, succeeded',expected;end $$;
create function pg_temp.folder() returns jsonb language sql as $$ select jsonb_build_object('id',current_setting('t022.folder'),'user_id',current_setting('t022.user'),'name','Documentos','parent_id',null,'project_id',null,'position',0,'deleted_at',null,'deletion_batch_id',null,'created_at','2026-10-09T14:00:00Z','updated_at','2026-10-09T14:00:00Z');$$;
create function pg_temp.drive_batch(command text,kind text,before_row jsonb,after_row jsonb,client text) returns jsonb language sql as $$ select jsonb_build_object(
 'expected_revision',public.drive_snapshot(current_setting('t022.user')::uuid,current_setting('t022.session')::uuid,command,100000,1000)->>'revision','context',jsonb_build_object('user_id',current_setting('t022.user'),'canal','web'),
 'changes',jsonb_build_array(jsonb_build_object('type',kind,'before',before_row,'after',after_row)),
 'events',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'user_id',current_setting('t022.user'),'entity_type',kind,'entity_id',after_row->>'id','action',case when before_row is null then 'created' else 'updated' end,'canal','web','occurred_at','2026-10-09T14:00:00Z','before',before_row,'after',after_row)),
 'receipt',jsonb_build_object('user_id',current_setting('t022.user'),'command',command,'client_id',client,'fingerprint',encode(sha256(convert_to(client,'UTF8')),'hex'),'result',after_row));$$;
create function pg_temp.file_row(id uuid,kind text) returns jsonb language sql as $$ select jsonb_build_object('id',id,'user_id',current_setting('t022.user'),'kind',kind,'folder_id',case when kind='drive' then current_setting('t022.folder')::uuid else null end,'name',case when kind='drive' then 'Texto.txt' else 'Imagem.png' end,'mime',case when kind='drive' then 'text/plain' else 'image/png' end,'bytes',10,'sha256',repeat('a',64),'width',case when kind='drive' then null else 20 end,'height',case when kind='drive' then null else 20 end,'starred',false,'deleted_at',null,'deletion_batch_id',null,'created_at',now(),'updated_at',now(),'modified_at',now());$$;
do $$ declare schema_name text;begin perform pg_temp.drive_assert(current_user='postgres','owner required');select nspname into schema_name from pg_namespace where oid=pg_my_temp_schema();execute format('grant usage on schema %I to service_role,authenticated,anon',schema_name);execute format('grant execute on all functions in schema %I to service_role,authenticated,anon',schema_name);end $$;
insert into auth.users(id,aud,role,email,is_anonymous,created_at,updated_at) values(current_setting('t022.user')::uuid,'authenticated','authenticated','t022-'||current_setting('t022.user')||'@example.invalid',false,now(),now()),(current_setting('t022.other')::uuid,'authenticated','authenticated','t022-'||current_setting('t022.other')||'@example.invalid',false,now(),now());
insert into auth.sessions(id,user_id,created_at,updated_at) values(current_setting('t022.session')::uuid,current_setting('t022.user')::uuid,now(),now());
set local role service_role;
do $$ declare u uuid:=current_setting('t022.user')::uuid;s uuid:=current_setting('t022.session')::uuid;upload uuid:=current_setting('t022.upload')::uuid;lease uuid:=current_setting('t022.lease')::uuid;row jsonb;request jsonb;reply jsonb;revision text;begin
 row:=pg_temp.folder();request:=pg_temp.drive_batch('drive.folder.create','drive_folder',null,row,'folder-create');reply:=public.drive_commit(u,s,'drive.folder.create',request);
 perform pg_temp.drive_assert(reply->>'status'='committed','folder atomic metadata/event/receipt');perform pg_temp.drive_assert(public.drive_commit(u,s,'drive.folder.create',request)->>'status'='replayed','folder replay');
 request:=pg_temp.drive_batch('drive.folder.update','drive_folder',row,jsonb_set(row,'{name}','"Renomeada"'),'no-event');request:=jsonb_set(request,'{events}','[]');perform pg_temp.drive_error(format('select public.drive_commit(%L,%L,''drive.folder.update'',%L::jsonb)',u,s,request::text),'23514');
 reply:=public.file_upload_reserve(u,s,'drive','Texto.txt',current_setting('t022.folder')::uuid,'reserve',upload,1000,100000,now()+interval '150 minutes');
 perform pg_temp.drive_assert(reply->>'staging_path'=u::text||'/'||upload::text,'server unique owner stage path');perform pg_temp.drive_assert(not reply?'upload_url','no signed token in DB');
 perform pg_temp.drive_assert(public.file_upload_reserve(u,s,'drive','Texto.txt',current_setting('t022.folder')::uuid,'reserve',gen_random_uuid(),1000,100000,now()+interval '150 minutes')->>'id'=upload::text,'stable reservation replay');
 perform pg_temp.drive_error(format('select public.file_upload_claim(%L,%L,%L,%L,''foreign'')',current_setting('t022.other'),s,upload,lease),'42501');
 reply:=public.file_upload_claim(u,s,upload,lease,'finalize');perform pg_temp.drive_assert(reply->'file'='null'::jsonb and reply->'reservation'->>'status'='processing','exclusive lease');
 perform pg_temp.drive_error(format('select public.file_upload_claim(%L,%L,%L,%L,''second'')',u,s,upload,gen_random_uuid()),'40001');
 row:=pg_temp.file_row(upload,'drive');reply:=public.file_upload_complete(u,s,upload,lease,'finalize',row,100000);perform pg_temp.drive_assert(reply=row,'measured metadata publication');
 revision:=public.drive_snapshot(u,s,'read.drive',100000,1000)->>'revision';
 perform pg_temp.drive_assert(public.file_upload_claim(u,s,upload,gen_random_uuid(),'finalize')->'file'=row,'lost-response receipt');perform pg_temp.drive_assert(public.drive_snapshot(u,s,'read.drive',100000,1000)->>'revision'=revision,'replay has no duplicate mutation');
 perform pg_temp.drive_assert(public.drive_snapshot(u,s,'read.drive',100000,1000)->>'usage_bytes'='10','quota uses finalized bytes');
 perform pg_temp.drive_error(format('select public.file_upload_reserve(%L,%L,''drive'',''Other.txt'',null,''quota'',%L,1024,1024,now()+interval ''150 minutes'')',u,s,gen_random_uuid()),'23514');
 request:=pg_temp.drive_batch('drive.file.update','drive_file',row,jsonb_set(row,'{bytes}','11'),'immutable');perform pg_temp.drive_error(format('select public.drive_commit(%L,%L,''drive.file.update'',%L::jsonb)',u,s,request::text),'23514');
 perform pg_temp.drive_assert(public.file_read_metadata(u,s,upload)->'file'=row,'private read metadata');
 reply:=public.file_upload_reserve(u,s,'avatar','Imagem.png',null,'avatar-reserve',current_setting('t022.image')::uuid,1000,100000,now()+interval '150 minutes');perform public.file_upload_claim(u,s,current_setting('t022.image')::uuid,lease,'avatar-finalize');perform public.file_upload_complete(u,s,current_setting('t022.image')::uuid,lease,'avatar-finalize',pg_temp.file_row(current_setting('t022.image')::uuid,'avatar'),100000);
 perform pg_temp.drive_assert(public.file_avatar_set(u,s,current_setting('t022.image')::uuid,'avatar-set')->>'avatar_file_id'=current_setting('t022.image'),'avatar ID publication');perform pg_temp.drive_assert(public.file_avatar_set(u,s,null,'avatar-remove')->'avatar_file_id'='null'::jsonb,'avatar removal');
 upload:=gen_random_uuid(); perform set_config('t022.capture_image',upload::text,true);
 perform public.file_upload_reserve(u,s,'capture_image','Imagem.png',null,'capture-reserve',upload,1000,100000,now()+interval '150 minutes');
 perform public.file_upload_claim(u,s,upload,lease,'capture-finalize');
 perform public.file_upload_complete(u,s,upload,lease,'capture-finalize',pg_temp.file_row(upload,'capture_image'),100000);
end $$;
reset role;
select pg_temp.drive_assert(app_private.knowledge_entity(current_setting('t022.user')::uuid,'file',current_setting('t022.upload')::uuid) is not null,'Drive file can be related');
select pg_temp.drive_assert(app_private.knowledge_entity(current_setting('t022.user')::uuid,'file',current_setting('t022.image')::uuid) is null,'avatar never becomes a Drive target');
select pg_temp.drive_assert(app_private.knowledge_entity(current_setting('t022.user')::uuid,'file',current_setting('t022.capture_image')::uuid) is null,'capture image never becomes a Drive target');
select pg_temp.drive_assert(not exists(select 1 from jsonb_array_elements(app_private.knowledge_targets(current_setting('t022.user')::uuid)) row where row->>'id' in (current_setting('t022.image'),current_setting('t022.capture_image'))),'target list excludes private non-Drive metadata');
insert into public.user_entitlements(user_id,feature_key,allowed) values(current_setting('t022.user')::uuid,'drive',false);
select pg_temp.drive_assert(app_private.knowledge_entity(current_setting('t022.user')::uuid,'file',current_setting('t022.upload')::uuid) is null,'Drive veto also closes related source');
select pg_temp.drive_assert(not exists(select 1 from jsonb_array_elements(app_private.knowledge_targets(current_setting('t022.user')::uuid)) row where row->>'type'='file'),'Drive veto closes all file targets');
select pg_temp.drive_assert((select count(*)=1 from public.domain_events where user_id=current_setting('t022.user')::uuid and entity_type='drive_file' and entity_id=current_setting('t022.upload')::uuid),'exactly one file creation event');
select pg_temp.drive_assert((select count(*)=1 from app_private.command_receipts where user_id=current_setting('t022.user')::uuid and command='file.upload.finalize' and client_id='finalize'),'exactly one finalize receipt');
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('t022.other'),'role','authenticated','session_id',current_setting('t022.session'))::text,true);
select pg_temp.drive_assert(not exists(select 1 from public.drive_files where user_id=current_setting('t022.user')::uuid),'other user cannot read');
select pg_temp.drive_error(format('select public.file_read_metadata(%L,%L,%L)',current_setting('t022.user'),current_setting('t022.session'),current_setting('t022.upload')),'42501');
rollback;
