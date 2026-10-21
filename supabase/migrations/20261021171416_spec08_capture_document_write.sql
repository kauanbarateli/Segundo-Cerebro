-- SPEC-08 / #75. DRAFT reserved by Root; supervised application only.
-- Preserves installed wrappers/OIDs, locks, Auth and receipt-before-CAS order.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

do $$ begin
 if current_user<>'postgres' or to_regprocedure('app_private.capture_task_validate_payload_spec08_previous(text,jsonb)') is null
  or to_regprocedure('app_private.knowledge_validate_document(jsonb)') is null
  or to_regprocedure('app_private.capture_document_validate_schema(jsonb)') is not null then
  raise exception 'Reviewed SPEC-08 image/Knowledge foundation required; inspect migration order/drift.';
 end if;
end $$;

create function app_private.capture_document_utf16_length(p_text text) returns bigint language sql immutable set search_path='' as $$
 select char_length(p_text)::bigint+(select count(*) from regexp_matches(p_text,U&'[\+010000-\+10FFFF]','g'));
$$;
create function app_private.capture_document_trim(p_text text) returns text language sql immutable set search_path='' as $$
 select btrim(p_text,U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF');
$$;
create function app_private.capture_document_compact_bytes(p_value jsonb) returns bigint language plpgsql immutable set search_path='' as $$
declare total bigint:=2; item record; count_items bigint:=0;
begin
 if jsonb_typeof(p_value)='array' then
  for item in select value from jsonb_array_elements(p_value) loop
   total:=total+app_private.capture_document_compact_bytes(item.value);count_items:=count_items+1;
  end loop;
 elsif jsonb_typeof(p_value)='object' then
  for item in select key,value from jsonb_each(p_value) loop
   total:=total+octet_length(to_jsonb(item.key)::text)+1+app_private.capture_document_compact_bytes(item.value);count_items:=count_items+1;
  end loop;
 else return octet_length(p_value::text);end if;
 return total+greatest(0,count_items-1);
end $$;

-- Clone the installed neutral schema contract, without replacing Knowledge's
-- validator or its OID. Account for compact JSON bytes just as JSON.stringify.
do $$ declare definition text; original text;begin
 select pg_get_functiondef('app_private.knowledge_validate_document(jsonb)'::regprocedure) into original;
 definition:=replace(original,'FUNCTION app_private.knowledge_validate_document(','FUNCTION app_private.capture_document_validate_schema(');
 if definition=original or strpos(definition,'octet_length(p_doc::text)>524288')=0 then raise exception 'Unexpected Knowledge validator; review drift.';end if;
 definition:=replace(definition,'octet_length(p_doc::text)>524288','app_private.capture_document_compact_bytes(p_doc)>524288');
 execute definition;
end $$;

create function app_private.capture_document_validate(p jsonb) returns void language plpgsql immutable set search_path='' as $$
declare item record; node jsonb; mark jsonb; raw_text text; expected_cache text;
begin
 if (p?'document') is distinct from (p?'document_version') then raise exception 'Incomplete Capture document pair.' using errcode='22023';end if;
 if not p?'document' then return;end if;
 if jsonb_typeof(p->'document_version') is distinct from 'number' or (p->>'document_version') !~ '^[1-9][0-9]*$'
  or (p->>'document_version')::numeric>9007199254740991 or jsonb_typeof(p->'document') is distinct from 'object'
  or octet_length(p::text)>1048576 then raise exception 'Invalid Capture document revision.' using errcode='22023';end if;
 perform app_private.capture_document_validate_schema(p->'document');
 for item in with recursive nodes(n) as (select p->'document' union all
  select child.value from nodes cross join lateral jsonb_array_elements(coalesce(nodes.n->'content','[]'::jsonb)) child)
  select n from nodes loop
  node:=item.n;
  if node->>'type'='wikiLink' then raise exception 'Page references are not Capture references.' using errcode='22023';end if;
  if node->>'type'='heading' and node?'attrs' and (not node->'attrs'?'level' or jsonb_typeof(node#>'{attrs,level}') is distinct from 'number'
   or node#>>'{attrs,level}' not in ('1','2','3')) then raise exception 'Invalid heading level.' using errcode='22023';end if;
  if node->>'type'='orderedList' and node->'attrs'?'start' and (jsonb_typeof(node#>'{attrs,start}') is distinct from 'number'
   or node#>>'{attrs,start}' !~ '^[1-9][0-9]*$' or (node#>>'{attrs,start}')::numeric>9007199254740991) then raise exception 'Invalid list start.' using errcode='22023';end if;
  if node->>'type'='codeBlock' and node->'attrs'?'language' and node#>'{attrs,language}'<>'null'::jsonb
   and (jsonb_typeof(node#>'{attrs,language}') is distinct from 'string' or app_private.capture_document_utf16_length(node#>>'{attrs,language}')>40) then raise exception 'Invalid code language.' using errcode='22023';end if;
  for mark in select value from jsonb_array_elements(coalesce(node->'marks','[]'::jsonb)) loop
   if jsonb_typeof(mark) is distinct from 'object' or jsonb_typeof(mark->'type') is distinct from 'string'
    or mark->>'type' not in ('bold','italic','strike','code','underline','link') then raise exception 'Invalid Capture mark.' using errcode='22023';end if;
   if mark->>'type'='link' and not mark?'attrs' then raise exception 'Capture link requires its destination.' using errcode='22023';end if;
   if mark?'attrs' and (mark->>'type'<>'link' or jsonb_typeof(mark->'attrs') is distinct from 'object'
    or not mark->'attrs'?'href' or jsonb_typeof(mark#>'{attrs,href}') is distinct from 'string'
    or mark#>>'{attrs,href}' !~* '^https?://[^/?#[:space:]]+' or mark#>>'{attrs,href}' ~* '^https?://[^/?#]*@'
    or app_private.capture_document_utf16_length(mark#>>'{attrs,href}')>2048) then raise exception 'Invalid external Capture link.' using errcode='22023';end if;
  end loop;
 end loop;
 raw_text:=app_private.knowledge_document_text(p->'document');
 if app_private.capture_document_utf16_length(raw_text)>30000 then raise exception 'Capture text exceeds limit.' using errcode='22023';end if;
 expected_cache:=nullif(app_private.capture_document_trim(raw_text),'');
 if p->'content' is distinct from to_jsonb(expected_cache) and not (expected_cache is null and p->'content'='null'::jsonb) then
  raise exception 'Capture text cache differs from document.' using errcode='22023';end if;
end $$;

do $$ declare definition text;begin
 select pg_get_functiondef('app_private.capture_task_validate_payload(text,jsonb)'::regprocedure) into definition;
 execute replace(definition,'FUNCTION app_private.capture_task_validate_payload(','FUNCTION app_private.capture_task_validate_payload_capture_document_previous(');
end $$;
create or replace function app_private.capture_task_validate_payload(p_kind text,p jsonb) returns void language plpgsql stable set search_path='' as $$
begin
 if p_kind='capture' then
  perform app_private.capture_document_validate(p);
  perform app_private.capture_task_validate_payload_capture_document_previous(p_kind,p-array['document','document_version']);
 else perform app_private.capture_task_validate_payload_capture_document_previous(p_kind,p);end if;
end $$;

create function app_private.capture_document_row() returns trigger language plpgsql set search_path='' as $$
declare previous_version numeric;next_version numeric;
begin
 perform app_private.capture_document_validate(new.payload);
 -- New rich creation is rejected by the command/RPC intent below. A validated
 -- privileged INSERT can be a supervised restore of an existing rich snapshot.
 if tg_op='UPDATE' then
  perform app_private.capture_document_validate(old.payload);
  if old.payload?'document' and not new.payload?'document' then raise exception 'Capture document downgrade is forbidden.' using errcode='23514';end if;
  if old.payload?'document' and new.payload->'title' is distinct from old.payload->'title' then raise exception 'Rich Capture rename requires its own contract.' using errcode='23514';end if;
  if new.payload?'document' then
   next_version:=(new.payload->>'document_version')::numeric;
   previous_version:=case when old.payload?'document' then (old.payload->>'document_version')::numeric else 0 end;
   if not old.payload?'document' and next_version<>1 or old.payload?'document' and
    (new.payload->'document' is distinct from old.payload->'document' or next_version<>previous_version) and next_version<>previous_version+1 then
    raise exception 'Capture document revision must advance once.' using errcode='23514';end if;
  end if;
 end if;return new;
end $$;
create trigger capture_document_row before insert or update on public.captures for each row execute function app_private.capture_document_row();

create or replace function app_private.knowledge_promoted_capture() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and (new.payload->'title' is distinct from old.payload->'title' or new.payload->'content' is distinct from old.payload->'content'
  or new.payload->'document' is distinct from old.payload->'document' or new.payload->'document_version' is distinct from old.payload->'document_version')
  and exists(select 1 from public.knowledge_pages where user_id=new.user_id and origin_capture_id=new.id) then
  raise exception 'Promoted Capture content is historical; edit the destination page.' using errcode='23514';end if;return new;
end $$;

create function app_private.capture_document_intent(p_operation text,p_input jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare expected jsonb;
begin
 if p_operation<>'capture.update' or not (p_input?'expected_content' or p_input->'patch'?'document') then return false;end if;
 if jsonb_typeof(p_input) is distinct from 'object' or not p_input?&array['id','client_id','expected_content','patch']
  or jsonb_typeof(p_input->'id') is distinct from 'string' or p_input->>'id' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  or jsonb_typeof(p_input->'client_id') is distinct from 'string' or char_length(btrim(p_input->>'client_id')) not between 1 and 200
  or p_input-array['id','client_id','expected_content','patch']<>'{}'::jsonb or jsonb_typeof(p_input->'patch') is distinct from 'object'
  or not p_input->'patch'?'document' or p_input->'patch'-'document'<>'{}'::jsonb then raise exception 'Invalid document intent.' using errcode='22023';end if;
 expected:=p_input->'expected_content';
 if jsonb_typeof(expected) is distinct from 'object' then raise exception 'Invalid expected content.' using errcode='22023';end if;
 if expected->>'kind'='legacy' then
  if not expected?&array['kind','content'] or expected-array['kind','content']<>'{}'::jsonb
   or jsonb_typeof(expected->'content') not in ('null','string') or app_private.capture_document_utf16_length(expected->>'content')>30000 then raise exception 'Invalid legacy expectation.' using errcode='22023';end if;
 elsif expected->>'kind'='rich' then
  if not expected?&array['kind','document_version'] or expected-array['kind','document_version']<>'{}'::jsonb
   or jsonb_typeof(expected->'document_version') is distinct from 'number' or expected->>'document_version' !~ '^[1-9][0-9]*$'
   or (expected->>'document_version')::numeric>9007199254740991 then raise exception 'Invalid rich expectation.' using errcode='22023';end if;
 else raise exception 'Invalid expected content kind.' using errcode='22023';end if;
 return true;
end $$;
create function app_private.capture_document_fingerprint_limit(p_operation text,p_receipt jsonb) returns integer language plpgsql immutable set search_path='' as $$
declare intent jsonb;begin
 begin intent:=(p_receipt->>'fingerprint')::jsonb;exception when invalid_text_representation then raise exception 'Invalid fingerprint.' using errcode='22023';end;
 return case when app_private.capture_document_intent(p_operation,intent) then 2097152 else 1048576 end;
end $$;
create function app_private.capture_document_commit_transition(p_operation text,p_input jsonb,p_changes jsonb) returns void language plpgsql immutable set search_path='' as $$
declare documentary boolean:=app_private.capture_document_intent(p_operation,p_input);change jsonb;b jsonb;a jsonb;expected jsonb;
begin
 if documentary and jsonb_array_length(p_changes)<>1 then raise exception 'Document edit changes one Capture.' using errcode='23514';end if;
 for change in select value from jsonb_array_elements(p_changes) loop
  if change->>'type'<>'capture' then continue;end if;b:=nullif(change->'before','null'::jsonb);a:=change->'after';
  if documentary then
   expected:=p_input->'expected_content';
   if b is null or a->>'id' is distinct from p_input->>'id' or a->'document' is distinct from p_input#>'{patch,document}'
    or (a-array['document','document_version','content','updated_at']) is distinct from (b-array['document','document_version','content','updated_at']) then raise exception 'Document edit changed other fields.' using errcode='23514';end if;
   if expected->>'kind'='legacy' and (b?'document' or b->'content' is distinct from expected->'content')
    or expected->>'kind'='rich' and (not b?'document' or b->'document_version' is distinct from expected->'document_version') then raise exception 'Capture content changed.' using errcode='40001';end if;
   if a->>'document_version' is distinct from ((case when b?'document' then (b->>'document_version')::numeric else 0 end)+1)::text then raise exception 'Invalid next document revision.' using errcode='23514';end if;
   perform app_private.capture_document_validate(a);
  else
   if a->'document' is distinct from b->'document' or a->'document_version' is distinct from b->'document_version' then raise exception 'Document transition requires documentary intent.' using errcode='23514';end if;
   if p_operation='capture.update' and b?'document' and p_input->'patch'?|array['title','content'] then raise exception 'Old editor cannot overwrite rich content.' using errcode='40001';end if;
  end if;
 end loop;
end $$;

-- Modify the installed function bodies in place: keep grants/OIDs, all locks,
-- access-before-replay, replay-before-CAS, 8MiB batch limit and exact ledger.
do $$ declare definition text;original text;needle text;begin
 select pg_get_functiondef('app_private.capture_task_commit(uuid,uuid,text,jsonb)'::regprocedure) into original;definition:=original;
 needle:='octet_length((r->''fingerprint'')::text)>1048576';
 if strpos(definition,needle)=0 then raise exception 'Unexpected receipt limit; review installed commit.';end if;
 definition:=replace(definition,needle,'octet_length((r->''fingerprint'')::text)>app_private.capture_document_fingerprint_limit(p_operation,r)');
 needle:='rate:=app_private.consume_rate_limit_at(''capture_task_write''';
 if strpos(definition,needle)=0 then raise exception 'Unexpected commit boundary; review installed commit.';end if;
 definition:=replace(definition,needle,'perform app_private.capture_document_commit_transition(p_operation,input,p_request->''changes'');'||chr(10)||'  '||needle);
 execute definition;
 select pg_get_functiondef('app_private.knowledge_commit(uuid,uuid,text,jsonb)'::regprocedure) into definition;
 needle:='perform app_private.capture_task_validate_payload(''capture'',after_row);';
 if strpos(definition,needle)=0 then raise exception 'Unexpected Knowledge promotion boundary.';end if;
 definition:=replace(definition,needle,'if before_row?''document'' or before_row?''document_version'' then raise exception ''Rich Capture promotion is not enabled.'' using errcode=''40001'';end if;'||chr(10)||'      '||needle);
 execute definition;
end $$;

-- Extend only Capture metadata names in the ACTIVE projection function. Keep
-- all other entity allowlists, its OID, grants and caller references unchanged.
do $$ declare definition text;needle text;begin
 select pg_get_functiondef('app_private.activity_projection_fields(text)'::regprocedure) into definition;
 needle:='"capture":["title","content","type","status","category_id","project_id","converted_task_id","organized_at","archived_at","deleted_at","linked_capture_ids","attachments"]';
 if length(definition)-length(replace(definition,needle,''))<>length(needle) then raise exception 'Unexpected activity Capture fields; review drift.';end if;
 definition:=replace(definition,needle,left(needle,length(needle)-1)||',"document","document_version"]');
 execute definition;
end $$;

revoke all on function app_private.capture_document_utf16_length(text),app_private.capture_document_trim(text),app_private.capture_document_compact_bytes(jsonb),
 app_private.capture_document_validate_schema(jsonb),app_private.capture_document_validate(jsonb),app_private.capture_task_validate_payload_capture_document_previous(text,jsonb),
 app_private.capture_document_row(),app_private.capture_document_intent(text,jsonb),app_private.capture_document_fingerprint_limit(text,jsonb),app_private.capture_document_commit_transition(text,jsonb,jsonb)
 from public,anon,authenticated,service_role;
comment on function app_private.capture_document_commit_transition(text,jsonb,jsonb) is 'SPEC-08 closed Capture document intent; after access/receipt/CAS, original expected content preserved, no rich promotion.';
commit;
