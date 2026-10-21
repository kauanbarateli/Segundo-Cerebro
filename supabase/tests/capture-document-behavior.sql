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
-- Missing optional legacy keys must not become a documentary intent via SQL
-- NULL. Explicit documentary markers still enter the strict validation path.
do $$ declare legacy jsonb:=jsonb_build_object('id',current_setting('capture_document.id'),'client_id','intent-legacy');
 doc jsonb:='{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Rico"}]}]}';
 intent jsonb;input jsonb;
begin
 intent:=legacy||jsonb_build_object('expected_content',jsonb_build_object('kind','legacy','content','  literal  '),'patch',jsonb_build_object('document',doc));
 foreach input in array array[null::jsonb,'null'::jsonb,legacy,legacy||'{"patch":{}}'::jsonb,legacy||'{"patch":null}'::jsonb,legacy||'{"patch":{"title":"Metadata"}}'::jsonb] loop
  perform pg_temp.assert_document(app_private.capture_document_intent('capture.update',input) is false);
  if input is not null then
   perform pg_temp.assert_document(app_private.capture_document_fingerprint_limit('capture.update',jsonb_build_object('fingerprint',input::text))=1048576);
  end if;
 end loop;
 perform pg_temp.assert_document(app_private.capture_document_intent(null,intent) is false);
 perform pg_temp.assert_document(app_private.capture_document_intent('task.update',intent) is false);
 perform pg_temp.assert_document(app_private.capture_document_intent('capture.update',intent) is true);
 perform pg_temp.assert_document(app_private.capture_document_intent('capture.update',intent||'{"expected_content":{"kind":"rich","document_version":1}}'::jsonb) is true);
 perform pg_temp.assert_document(app_private.capture_document_fingerprint_limit('capture.update',jsonb_build_object('fingerprint',intent::text))=2097152);
 foreach input in array array[legacy||'{"expected_content":null}'::jsonb,legacy||jsonb_build_object('patch',jsonb_build_object('document',doc)),intent||'{"patch":{"document":null,"title":"Mixed"}}'::jsonb] loop
  perform pg_temp.document_error(format('select app_private.capture_document_intent(''capture.update'',%L::jsonb)',input::text),'22023');
 end loop;
end $$;
-- The row stores a JSON STRING. Padding its parsed JSON with ASCII whitespace
-- sets an exact escaped byte boundary without introducing any extra intent key.
create function pg_temp.receipt_request_bytes(fingerprint text,bytes integer) returns jsonb language plpgsql as $$
declare remaining integer:=bytes-octet_length(to_jsonb(fingerprint)::text);result jsonb;
begin
 if remaining<0 then raise exception 'Physical receipt fixture is too large.';end if;
 result:=to_jsonb(fingerprint||repeat(' ',remaining));
 perform pg_temp.assert_document(octet_length(result::text)=bytes);return result;
end $$;
create function pg_temp.receipt_physical_probe(p_command text,p_client text,p_request jsonb,p_result jsonb,p_reject boolean,p_update boolean) returns void language plpgsql as $$
declare actual text;violated text;receipt_count bigint;revisions jsonb;
begin
 select count(*) into receipt_count from app_private.command_receipts where user_id=current_setting('capture_document.user')::uuid;
 select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) into revisions from app_private.capture_task_revisions r where user_id=current_setting('capture_document.user')::uuid;
 begin
  if p_update then
   insert into app_private.command_receipts(user_id,command,client_id,request,result) values(current_setting('capture_document.user')::uuid,p_command,p_client,'{}'::jsonb,'null'::jsonb);
   update app_private.command_receipts r set request=p_request,result=p_result
    where r.user_id=current_setting('capture_document.user')::uuid and r.command=p_command and r.client_id=p_client;
  else
   insert into app_private.command_receipts(user_id,command,client_id,request,result) values(current_setting('capture_document.user')::uuid,p_command,p_client,p_request,p_result);
  end if;
  -- Roll back even a successful boundary probe, including revision triggers.
  raise exception 'Physical receipt accepted; rollback probe.' using errcode='ZX001';
 exception when sqlstate 'ZX001' then
  if p_reject then raise exception 'Expected physical receipt rejection, statement succeeded.';end if;
 when others then
  get stacked diagnostics actual=returned_sqlstate,violated=constraint_name;
  if not p_reject or actual is distinct from '23514' or violated is distinct from 'command_receipts_check' then
   raise exception 'Unexpected physical receipt failure: %, constraint %',actual,violated;
  end if;
 end;
 perform pg_temp.assert_document((select count(*)=receipt_count from app_private.command_receipts where user_id=current_setting('capture_document.user')::uuid));
 perform pg_temp.assert_document((select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb)=revisions from app_private.capture_task_revisions r where user_id=current_setting('capture_document.user')::uuid));
end $$;
insert into auth.users(id,aud,role,email,is_anonymous,created_at,updated_at) values
 (current_setting('capture_document.user')::uuid,'authenticated','authenticated','capture-document-'||current_setting('capture_document.user')||'@example.invalid',false,now(),now()),
 (current_setting('capture_document.other_user')::uuid,'authenticated','authenticated','capture-document-'||current_setting('capture_document.other_user')||'@example.invalid',false,now(),now());
insert into auth.sessions(id,user_id,created_at,updated_at) values
 (current_setting('capture_document.session')::uuid,current_setting('capture_document.user')::uuid,now(),now()),
 (current_setting('capture_document.other_session')::uuid,current_setting('capture_document.other_user')::uuid,now(),now());
insert into public.captures(payload) values(pg_temp.document_row());

-- Privileged INSERT/UPDATE probes exercise the PHYSICAL constraint itself,
-- independently of the RPC. Both SQLSTATE and constraint name must match.
do $$ declare doc jsonb:='{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Rico"}]}]}';intent jsonb;legacy jsonb;bad jsonb;update_mode boolean;
 small_request jsonb:=to_jsonb('{}'::text);request_1m jsonb:=to_jsonb(repeat('x',1048574));result_1m jsonb:=to_jsonb(repeat('x',1048574));result_over jsonb:=to_jsonb(repeat('x',1048575));
begin
 intent:=jsonb_build_object('id',current_setting('capture_document.id'),'client_id','physical-proof','expected_content',jsonb_build_object('kind','legacy','content','  literal  '),'patch',jsonb_build_object('document',doc));
 legacy:=jsonb_build_object('id',current_setting('capture_document.id'),'client_id','physical-proof','patch',jsonb_build_object('content','plain'));
 perform pg_temp.assert_document(octet_length(request_1m::text)=1048576 and octet_length(result_1m::text)=1048576 and octet_length(result_over::text)=1048577);
 foreach update_mode in array array[false,true] loop
  -- Existing small request shapes and result boundaries keep their old rules.
  perform pg_temp.receipt_physical_probe('task.update','physical-proof',request_1m,result_1m,false,update_mode);
  if not update_mode then
   -- DIAGNOSTIC ONLY: same synthetic fixture and pure stages as the predicate.
   -- Keep the physical positive/negatives below unchanged. Never emit states,
   -- identifiers, client_id, error messages/context or SQL in this NOTICE.
   declare probe_small jsonb:=to_jsonb(intent::text);probe_large jsonb:=pg_temp.receipt_request_bytes(intent::text,1048577);
    decoded jsonb;probe_doc jsonb;probe_content text;intent_allowed boolean:=false;small_allowed boolean:=false;large_allowed boolean:=false;
    stage_codes jsonb:='{}'::jsonb;stage_code text;
   begin
    begin decoded:=(probe_large#>>'{}')::jsonb;stage_code:='00000';
    exception when others then get stacked diagnostics stage_code=returned_sqlstate;end;
    stage_codes:=stage_codes||jsonb_build_object('decode',stage_code);probe_doc:=decoded#>'{patch,document}';
    begin intent_allowed:=app_private.capture_document_intent('capture.update',decoded);stage_code:='00000';
    exception when others then get stacked diagnostics stage_code=returned_sqlstate;end;
    stage_codes:=stage_codes||jsonb_build_object('intent',stage_code);
    begin perform app_private.capture_document_validate_schema(probe_doc);stage_code:='00000';
    exception when others then get stacked diagnostics stage_code=returned_sqlstate;end;
    stage_codes:=stage_codes||jsonb_build_object('schema',stage_code);
    begin probe_content:=nullif(app_private.capture_document_trim(app_private.knowledge_document_text(probe_doc)),'');stage_code:='00000';
    exception when others then get stacked diagnostics stage_code=returned_sqlstate;end;
    stage_codes:=stage_codes||jsonb_build_object('projection',stage_code);
    begin perform app_private.capture_document_validate(jsonb_build_object('document',probe_doc,'document_version',1,'content',probe_content));stage_code:='00000';
    exception when others then get stacked diagnostics stage_code=returned_sqlstate;end;
    stage_codes:=stage_codes||jsonb_build_object('validate',stage_code);
    begin small_allowed:=app_private.capture_document_receipt_request_allowed('capture.update','physical-proof',probe_small);stage_code:='00000';
    exception when others then get stacked diagnostics stage_code=returned_sqlstate;end;
    stage_codes:=stage_codes||jsonb_build_object('predicate_small',stage_code);
    begin large_allowed:=app_private.capture_document_receipt_request_allowed('capture.update','physical-proof',probe_large);stage_code:='00000';
    exception when others then get stacked diagnostics stage_code=returned_sqlstate;end;
    stage_codes:=stage_codes||jsonb_build_object('predicate_large',stage_code);
    raise notice 'Capture receipt physical diagnostic: %',jsonb_build_object(
     'schemaVersion',1,'scenario','capture-document-receipt-diagnostic',
     'sizes',jsonb_build_object('request_small',octet_length(probe_small::text),'request_large',octet_length(probe_large::text),'result',octet_length('null'::jsonb::text)),
     'preconditions',jsonb_build_object('small_is_string',jsonb_typeof(probe_small)='string','large_is_string',jsonb_typeof(probe_large)='string',
      'large_above_1m',octet_length(probe_large::text)>1048576,'large_within_2m',octet_length(probe_large::text)<=2097152,
      'result_within_1m',octet_length('null'::jsonb::text)<=1048576,'decoded_is_object',coalesce(jsonb_typeof(decoded)='object',false),
      'client_matches',coalesce(decoded->>'client_id'='physical-proof',false),'id_canonical',coalesce(decoded->>'id'~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',false),
      'roundtrip_equal',coalesce(decoded=intent,false),'document_equal',coalesce(probe_doc=doc,false)),
     'stages',stage_codes,'intent_allowed',coalesce(intent_allowed,false),'predicate_small',coalesce(small_allowed,false),'predicate_large',coalesce(large_allowed,false));
   end;
  end if;
  perform pg_temp.receipt_physical_probe('capture.update','physical-proof',pg_temp.receipt_request_bytes(intent::text,1048577),'null'::jsonb,false,update_mode);
  perform pg_temp.receipt_physical_probe('capture.update','physical-proof',pg_temp.receipt_request_bytes(intent::text,2097152),result_1m,false,update_mode);
  perform pg_temp.receipt_physical_probe('capture.update','physical-proof',pg_temp.receipt_request_bytes(intent::text,2097153),'null'::jsonb,true,update_mode);
  perform pg_temp.receipt_physical_probe('task.update','physical-proof',pg_temp.receipt_request_bytes(intent::text,1048577),'null'::jsonb,true,update_mode);
  perform pg_temp.receipt_physical_probe('capture.update','other-client',pg_temp.receipt_request_bytes(intent::text,1048577),'null'::jsonb,true,update_mode);
  perform pg_temp.receipt_physical_probe('capture.update','physical-proof',pg_temp.receipt_request_bytes(legacy::text,1048577),'null'::jsonb,true,update_mode);
  perform pg_temp.receipt_physical_probe('capture.update','physical-proof',pg_temp.receipt_request_bytes('{"unfinished":',1048577),'null'::jsonb,true,update_mode);
  perform pg_temp.receipt_physical_probe('capture.update','physical-proof',jsonb_build_object('padding',repeat('x',1048576)),'null'::jsonb,true,update_mode);
  perform pg_temp.receipt_physical_probe('task.update','physical-proof',small_request,result_over,true,update_mode);
  perform pg_temp.receipt_physical_probe('capture.update','physical-proof',pg_temp.receipt_request_bytes(intent::text,2097152),result_over,true,update_mode);
  for bad in select value from jsonb_array_elements(jsonb_build_array(
   'null'::jsonb,
   intent-'expected_content',
   intent||'{"expected_content":null}'::jsonb,
   intent||'{"expected_content":{"kind":"legacy"}}'::jsonb,
   intent||'{"expected_content":{"kind":"rich","document_version":null}}'::jsonb,
   intent||'{"expected_content":{"kind":"rich","document_version":0}}'::jsonb,
   jsonb_set(intent,'{patch,document}','null'::jsonb),
   jsonb_set(intent,'{patch,document}',to_jsonb('<p>HTML is not TipTap JSON</p>'::text)),
   jsonb_set(intent,'{patch,document}','{"type":"doc"}'::jsonb),
   jsonb_set(intent,'{patch,document}','{"type":"doc","content":[{"type":"wikiLink","attrs":{"alias":"Página","target_id":null}}]}'::jsonb),
   jsonb_set(intent,'{patch,title}','"mixed"'::jsonb),
   intent||'{"user_id":"foreign"}'::jsonb
  )) loop
   perform pg_temp.receipt_physical_probe('capture.update','physical-proof',pg_temp.receipt_request_bytes(bad::text,1048577),'null'::jsonb,true,update_mode);
  end loop;
 end loop;
end $$;

do $$ declare base jsonb:=pg_temp.document_row();doc jsonb:='{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Rico","marks":[{"type":"bold"}]}]}]}';row jsonb;bad jsonb;begin
 row:=base||jsonb_build_object('document',doc,'document_version',1,'content','Rico');perform app_private.capture_document_validate(row);
 perform app_private.capture_document_validate(base||jsonb_build_object('document',jsonb_set(doc,'{content,0,content,0,marks}','[{"type":"link","attrs":{"href":"https://example.invalid/"}}]'),'document_version',1,'content','Rico'));
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
  jsonb_set(doc,'{content,0,content,0,marks}','[{"type":"link","attrs":{"href":"https://example.invalid/","unreviewed":true}}]'),
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
 -- This is the raw RPC, whose owner is checked and removed by the gateway.
 perform pg_temp.assert_document(item?&array['id','user_id','occurred_at','entity_type','entity_id','action','canal','title','changed_fields']
  and item-array['id','user_id','occurred_at','entity_type','entity_id','action','canal','title','changed_fields']='{}'::jsonb);
 perform pg_temp.assert_document(item->>'user_id'=current_setting('capture_document.user'));
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
