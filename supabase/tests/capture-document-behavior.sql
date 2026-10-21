-- SPEC-08 #75: synthetic, disposable SQL proof; all changes roll back.
begin;
set local statement_timeout='60s';
set local lock_timeout='5s';
select set_config('capture_document.user',gen_random_uuid()::text,true),set_config('capture_document.session',gen_random_uuid()::text,true),set_config('capture_document.id',gen_random_uuid()::text,true),
 set_config('capture_document.other_user',gen_random_uuid()::text,true),set_config('capture_document.other_session',gen_random_uuid()::text,true);
create function pg_temp.assert_document(ok boolean) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'Capture document assertion failed.';end if;end $$;
create function pg_temp.document_error(command text,expected text) returns void language plpgsql as $$declare actual text;begin
 begin execute command;exception when others then get stacked diagnostics actual=returned_sqlstate;if actual<>expected then raise exception 'Expected %, got %',expected,actual;end if;return;end;
 raise exception 'Expected %, command succeeded',expected;
end $$;
create function pg_temp.document_row() returns jsonb language sql as $$
 select jsonb_build_object('id',current_setting('capture_document.id'),'user_id',current_setting('capture_document.user'),'client_id','legacy','project_id',null,'type','note','title','Original','content','  literal  ',
  'status','inbox','category_id',null,'converted_task_id',null,'captured_at','2026-10-21T12:00:00.000Z','organized_at',null,'archived_at',null,'deleted_at',null,'created_at','2026-10-21T12:00:00.000Z','updated_at','2026-10-21T12:00:00.000Z');
$$;
create function pg_temp.document_batch(b jsonb,a jsonb,client text,expected jsonb,event_id uuid default gen_random_uuid()) returns jsonb language sql as $$
 select jsonb_build_object('expectedRevision',public.capture_task_revision(current_setting('capture_document.user')::uuid,current_setting('capture_document.session')::uuid,'capture.update'),
  'context',jsonb_build_object('user_id',current_setting('capture_document.user'),'canal','web'),
  'changes',jsonb_build_array(jsonb_build_object('type','capture','before',b,'after',a)),
  'events',jsonb_build_array(jsonb_build_object('id',event_id,'user_id',current_setting('capture_document.user'),'entity_type','capture','entity_id',current_setting('capture_document.id'),'action','updated','canal','web','occurred_at','2026-10-21T12:00:00.000Z','before',b,'after',a)),
  'receipt',jsonb_build_object('user_id',current_setting('capture_document.user'),'command','capture.update','client_id',client,'fingerprint',jsonb_build_object('id',current_setting('capture_document.id'),'client_id',client,'expected_content',expected,'patch',jsonb_build_object('document',a->'document'))::text,'result',a));
$$;
create function pg_temp.document_commit(request jsonb) returns jsonb language sql as $$
 select public.capture_task_commit(current_setting('capture_document.user')::uuid,current_setting('capture_document.session')::uuid,'capture.update',request);
$$;
insert into auth.users(id,aud,role,email,is_anonymous,created_at,updated_at) values
 (current_setting('capture_document.user')::uuid,'authenticated','authenticated','capture-document-'||current_setting('capture_document.user')||'@example.invalid',false,now(),now()),
 (current_setting('capture_document.other_user')::uuid,'authenticated','authenticated','capture-document-'||current_setting('capture_document.other_user')||'@example.invalid',false,now(),now());
insert into auth.sessions(id,user_id,created_at,updated_at) values
 (current_setting('capture_document.session')::uuid,current_setting('capture_document.user')::uuid,now(),now()),
 (current_setting('capture_document.other_session')::uuid,current_setting('capture_document.other_user')::uuid,now(),now());
insert into public.captures(payload) values(pg_temp.document_row());

do $$ declare base jsonb:=pg_temp.document_row();doc jsonb:='{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Rico","marks":[{"type":"bold"}]}]}]}';row jsonb;bad jsonb;begin
 row:=base||jsonb_build_object('document',doc,'document_version',1,'content','Rico');perform app_private.capture_document_validate(row);
 for bad in select value from jsonb_array_elements(jsonb_build_array(row-'document',row-'document_version',row||'{"document_version":0}',row||'{"document":null}',row||'{"content":"forged"}')) loop
  perform pg_temp.document_error(format('update public.captures set payload=%L::jsonb where id=%L::uuid',bad::text,current_setting('capture_document.id')),'22023');
  perform pg_temp.assert_document((select payload=base from public.captures where id=current_setting('capture_document.id')::uuid));end loop;
 for bad in select value from jsonb_array_elements(jsonb_build_array(
  jsonb_set(doc,'{content,0,content,0,marks}','[{}]'),
  jsonb_set(doc,'{content,0,content,0,marks}','[{"type":null}]'),
  jsonb_set(doc,'{content,0,content,0,marks}','[{"type":"unsafe"}]'),
  jsonb_set(doc,'{content,0,content,0,marks}','[{"type":"link"}]'),
  jsonb_set(doc,'{content,0,content,0,marks}','[{"type":"link","attrs":{"target":"_blank"}}]'),
  jsonb_set(doc,'{content,0,content,0,marks}','[{"type":"link","attrs":{"href":null}}]'),
  jsonb_set(doc,'{content,0,content,0,marks}','[{"type":"link","attrs":{"href":5}}]'),
  '{"type":"doc","content":[{"type":"heading","attrs":{},"content":[{"type":"text","text":"Rico"}]}]}'::jsonb,
  '{"type":"doc","content":[{"type":"heading","attrs":{"level":null},"content":[{"type":"text","text":"Rico"}]}]}'::jsonb
 )) loop
  perform pg_temp.document_error(format('update public.captures set payload=%L::jsonb where id=%L::uuid',(base||jsonb_build_object('document',bad,'document_version',1,'content','Rico'))::text,current_setting('capture_document.id')),'22023');
  perform pg_temp.assert_document((select payload=base from public.captures where id=current_setting('capture_document.id')::uuid));end loop;
 perform pg_temp.assert_document(app_private.capture_document_utf16_length('a😀')=3);
 perform pg_temp.assert_document(app_private.capture_document_trim(E'\t\n'||'Rico'||U&'\00A0\FEFF')='Rico');
 perform pg_temp.assert_document(app_private.capture_document_fingerprint_limit('capture.update',jsonb_build_object('fingerprint',jsonb_build_object('id',base->>'id','client_id','doc','expected_content',jsonb_build_object('kind','legacy','content',base->'content'),'patch',jsonb_build_object('document',doc))::text))=2097152);
 perform pg_temp.assert_document(app_private.capture_document_fingerprint_limit('capture.update',jsonb_build_object('fingerprint','{"id":"x","client_id":"old","patch":{"content":"plain"}}'))=1048576);
end $$;
do $$ declare schema_name text;begin select nspname into schema_name from pg_namespace where oid=pg_my_temp_schema();execute format('grant usage on schema %I to service_role',schema_name);execute format('grant execute on all functions in schema %I to service_role',schema_name);end $$;

set local role service_role;
do $$ declare b jsonb:=pg_temp.document_row();doc jsonb:='{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Rico","marks":[{"type":"bold"}]}]}]}';a jsonb;request jsonb;next_request jsonb;revision text;event_id uuid;projection jsonb;item jsonb;begin
 a:=b||jsonb_build_object('document',doc,'document_version',1,'content','Rico');
 request:=pg_temp.document_batch(b,a,'document-write',jsonb_build_object('kind','legacy','content',b->'content'));
 perform pg_temp.assert_document(pg_temp.document_commit(request)=jsonb_build_object('status','committed','result',a));
 revision:=public.capture_task_revision(current_setting('capture_document.user')::uuid,current_setting('capture_document.session')::uuid,'capture.update');
 perform pg_temp.assert_document(pg_temp.document_commit(request)=jsonb_build_object('status','replayed','result',a));
 perform pg_temp.assert_document(public.capture_task_revision(current_setting('capture_document.user')::uuid,current_setting('capture_document.session')::uuid,'capture.update')=revision);
 perform pg_temp.assert_document((public.capture_task_snapshot(current_setting('capture_document.user')::uuid,current_setting('capture_document.session')::uuid,'read.captures')->'captures'->0)=a);
 perform pg_temp.assert_document((public.capture_task_snapshot(current_setting('capture_document.other_user')::uuid,current_setting('capture_document.other_session')::uuid,'read.captures')->'captures')='[]'::jsonb);
 perform pg_temp.document_error(format('select public.capture_task_snapshot(%L::uuid,%L::uuid,''read.captures'')',current_setting('capture_document.user'),current_setting('capture_document.other_session')),'42501');
 next_request:=pg_temp.document_batch(a,a||'{"document_version":2}','stale-literal',jsonb_build_object('kind','legacy','content',b->'content'));
 perform pg_temp.document_error(format('select pg_temp.document_commit(%L::jsonb)',next_request::text),'40001');
 event_id:=(request#>>'{events,0,id}')::uuid;
 next_request:=pg_temp.document_batch(a,a||'{"document_version":2}','event-rollback',jsonb_build_object('kind','rich','document_version',1),event_id);
 perform pg_temp.document_error(format('select pg_temp.document_commit(%L::jsonb)',next_request::text),'23505');
 perform pg_temp.assert_document(public.capture_task_revision(current_setting('capture_document.user')::uuid,current_setting('capture_document.session')::uuid,'capture.update')=revision);
 perform pg_temp.assert_document((public.capture_task_snapshot(current_setting('capture_document.user')::uuid,current_setting('capture_document.session')::uuid,'read.captures')->'captures'->0)=a);
 perform pg_temp.assert_document(public.capture_task_receipt(current_setting('capture_document.user')::uuid,current_setting('capture_document.session')::uuid,'capture.update','capture.update','event-rollback') is null);
 next_request:=pg_temp.document_batch(a,a||jsonb_build_object('document',jsonb_set(doc,'{content,0,content,0,marks}','[{"type":"italic"}]'),'document_version',2),'formatting-only',jsonb_build_object('kind','rich','document_version',1));
 perform pg_temp.assert_document(pg_temp.document_commit(next_request)->>'status'='committed');
 projection:=public.activity_page(current_setting('capture_document.user')::uuid,current_setting('capture_document.session')::uuid,20);
 select value into item from jsonb_array_elements(projection->'items') where value->>'id'=next_request#>>'{events,0,id}';
 perform pg_temp.assert_document(item->'changed_fields'='["document","document_version"]'::jsonb);
 perform pg_temp.assert_document(item-array['id','occurred_at','entity_type','entity_id','action','canal','title','changed_fields']='{}'::jsonb);
 perform set_config('capture_document.request',request::text,true);
end $$;
reset role;
do $$ declare row jsonb;begin
 select payload into row from public.captures where id=current_setting('capture_document.id')::uuid;
 perform pg_temp.document_error(format('update public.captures set payload=%L::jsonb where id=%L::uuid',(row-array['document','document_version'])::text,current_setting('capture_document.id')),'23514');
 perform pg_temp.document_error(format('update public.captures set payload=%L::jsonb where id=%L::uuid',(row||'{"document_version":9}')::text,current_setting('capture_document.id')),'23514');
 perform pg_temp.assert_document((select count(*)=2 from public.domain_events where user_id=current_setting('capture_document.user')::uuid and entity_type='capture'));
 perform pg_temp.assert_document((select count(*)=2 from app_private.command_receipts where user_id=current_setting('capture_document.user')::uuid and command='capture.update'));
 insert into public.user_entitlements(user_id,feature_key,allowed) values(current_setting('capture_document.user')::uuid,'capturar',false) on conflict(user_id,feature_key) do update set allowed=false;
end $$;
set local role service_role;
select pg_temp.document_error(format('select pg_temp.document_commit(%L::jsonb)',current_setting('capture_document.request')),'42501');
reset role;
rollback;
