-- SPEC08 / T050 / #75. Rich creation and integral Capture-to-Page promotion.
-- Prepared from the peer-reviewed E4 candidate, with separate rollback assertions.
-- OP-009: personal project only, after reviewed backup, restore and writer cutover.
-- No tables, resets, seeds, generic uploads or Drive surface are introduced.
begin;
set local lock_timeout='5s';set local statement_timeout='60s';
do $$ begin
 if current_user<>'postgres' or to_regprocedure('app_private.capture_document_commit_transition(text,jsonb,jsonb)') is null
  or to_regprocedure('app_private.entity_image_referenced(uuid,uuid)') is null
  or to_regprocedure('app_private.capture_document_event_pair_allowed(uuid,uuid,text,uuid,text,text,timestamptz,jsonb,jsonb,jsonb)') is null
  or to_regprocedure('app_private.capture_e4_validate_document(jsonb)') is not null then
  raise exception 'Reviewed 022 foundation required; inspect candidate order.';
 end if;
end $$;

-- One neutral grammar, two existing validator entry points. Limits are unchanged.
create function app_private.capture_e4_validate_document(p_doc jsonb) returns void language plpgsql immutable set search_path='' as $$
declare entry record;n jsonb;a jsonb;m jsonb;kind text;allowed text[];
begin
 if jsonb_typeof(p_doc) is distinct from 'object' or p_doc->>'type' is distinct from 'doc'
  or jsonb_typeof(p_doc->'content') is distinct from 'array' or app_private.capture_document_compact_bytes(p_doc)>524288 then
  raise exception 'Invalid document.' using errcode='22023';end if;
 for entry in with recursive nodes(n,depth) as (select p_doc,0 union all
  select c.value,nodes.depth+1 from nodes cross join lateral jsonb_array_elements(case when jsonb_typeof(nodes.n->'content')='array' then nodes.n->'content' else '[]'::jsonb end) c where nodes.depth<33)
  select nodes.n,nodes.depth,count(*) over() total from nodes loop
  n:=entry.n;kind:=n->>'type';
  if entry.depth>32 or entry.total>10000 or jsonb_typeof(n) is distinct from 'object' or n-array['type','text','attrs','marks','content']<>'{}'::jsonb
   or not coalesce(kind=any(array['doc','paragraph','text','heading','bulletList','orderedList','listItem','taskList','taskItem','blockquote','codeBlock','hardBreak','horizontalRule','wikiLink','captureLink']),false)
   or entry.depth>0 and kind='doc' then raise exception 'Invalid document node.' using errcode='22023';end if;
  if kind='text' then
   if jsonb_typeof(n->'text') is distinct from 'string' or char_length(n->>'text')=0 or n?'content' then raise exception 'Invalid text.' using errcode='22023';end if;
  elsif n?'text' then raise exception 'Text outside text node.' using errcode='22023';end if;
  if n?'content' and (jsonb_typeof(n->'content') is distinct from 'array' or kind=any(array['text','wikiLink','captureLink','hardBreak','horizontalRule'])) then raise exception 'Invalid child nodes.' using errcode='22023';end if;
  if n?'attrs' then
   a:=n->'attrs';allowed:=case when kind in ('wikiLink','captureLink') then array['target_id','alias'] when kind='heading' then array['level','textAlign'] when kind='paragraph' then array['textAlign'] when kind='taskItem' then array['checked'] when kind='orderedList' then array['start','type'] when kind='codeBlock' then array['language'] else array[]::text[] end;
   if jsonb_typeof(a) is distinct from 'object' or a-allowed<>'{}'::jsonb then raise exception 'Invalid node attributes.' using errcode='22023';end if;
   if kind='heading' and (jsonb_typeof(a->'level') is distinct from 'number' or a->>'level' not in ('1','2','3')) then raise exception 'Invalid heading.' using errcode='22023';end if;
   if kind in ('paragraph','heading') and a?'textAlign' and a->'textAlign'<>'null'::jsonb
    and (jsonb_typeof(a->'textAlign') is distinct from 'string' or a->>'textAlign' not in ('left','center','right','justify')) then raise exception 'Invalid alignment.' using errcode='22023';end if;
   if kind='orderedList' and a?'start' and (jsonb_typeof(a->'start') is distinct from 'number' or a->>'start' !~ '^[1-9][0-9]*$' or (a->>'start')::numeric>9007199254740991) then raise exception 'Invalid list start.' using errcode='22023';end if;
   if kind in ('wikiLink','captureLink') and (not a?&array['target_id','alias'] or jsonb_typeof(a->'alias') is distinct from 'string'
    or app_private.capture_document_utf16_length(a->>'alias') not between 1 and 200 or char_length(app_private.capture_document_trim(a->>'alias'))=0
    or a->'target_id'<>'null'::jsonb and (jsonb_typeof(a->'target_id') is distinct from 'string' or a->>'target_id' !~ case when kind='wikiLink' then '^[0-9a-fA-F-]{36}$' else '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' end)) then raise exception 'Invalid reference.' using errcode='22023';end if;
   if kind='taskItem' and jsonb_typeof(a->'checked') is distinct from 'boolean' then raise exception 'Invalid checklist state.' using errcode='22023';end if;
   if kind='codeBlock' and a?'language' and a->'language'<>'null'::jsonb and (jsonb_typeof(a->'language') is distinct from 'string' or app_private.capture_document_utf16_length(a->>'language')>40) then raise exception 'Invalid code language.' using errcode='22023';end if;
  elsif kind in ('wikiLink','captureLink','taskItem') then raise exception 'Missing node attributes.' using errcode='22023';end if;
  if kind='taskList' and (jsonb_typeof(n->'content') is distinct from 'array' or jsonb_array_length(n->'content')=0
   or exists(select 1 from jsonb_array_elements(n->'content') c where c->>'type' is distinct from 'taskItem')) then raise exception 'Invalid checklist.' using errcode='22023';end if;
  if kind='taskItem' and (jsonb_typeof(n->'content') is distinct from 'array' or jsonb_array_length(n->'content')=0 or n#>>'{content,0,type}' is distinct from 'paragraph') then raise exception 'Invalid checklist item.' using errcode='22023';end if;
  if n?'marks' then
   if kind not in ('text','wikiLink','captureLink') or jsonb_typeof(n->'marks') is distinct from 'array' or jsonb_array_length(n->'marks')>6 then raise exception 'Invalid marks.' using errcode='22023';end if;
   for m in select value from jsonb_array_elements(n->'marks') loop
    if jsonb_typeof(m) is distinct from 'object' or m-array['type','attrs']<>'{}'::jsonb or not coalesce(m->>'type'=any(array['bold','italic','strike','code','underline','link']),false)
     or kind<>'text' and m->>'type'='link' then raise exception 'Invalid mark.' using errcode='22023';end if;
    if m?'attrs' and (m->>'type'<>'link' or jsonb_typeof(m->'attrs') is distinct from 'object' or (m->'attrs')-array['href','target','rel','class']<>'{}'::jsonb
     or jsonb_typeof(m#>'{attrs,href}') is distinct from 'string' or m#>>'{attrs,href}' !~* '^https?://[^/?#[:space:]]+'
     or m#>>'{attrs,href}' ~* '^https?://[^/?#]*@' or app_private.capture_document_utf16_length(m#>>'{attrs,href}')>2048) then raise exception 'Invalid external link.' using errcode='22023';end if;
   end loop;
  end if;
 end loop;
end $$;
create or replace function app_private.knowledge_validate_document(p_doc jsonb) returns void language plpgsql immutable set search_path='' as $$begin perform app_private.capture_e4_validate_document(p_doc);end $$;
create or replace function app_private.capture_document_validate_schema(p_doc jsonb) returns void language plpgsql immutable set search_path='' as $$begin perform app_private.capture_e4_validate_document(p_doc);end $$;
do $$ declare definition text;needle text;begin
 select pg_get_functiondef('app_private.knowledge_document_text(jsonb,integer)'::regprocedure) into definition;
 needle:=$s$if kind='wikiLink' then$s$;if strpos(definition,needle)=0 then raise exception 'Text projection drift.';end if;
 definition:=replace(definition,needle,$s$if kind in ('wikiLink','captureLink') then$s$);
 needle:=$s$('doc','bulletList','orderedList','listItem','blockquote')$s$;if strpos(definition,needle)=0 then raise exception 'Text separators drift.';end if;
 execute replace(definition,needle,$s$('doc','bulletList','orderedList','listItem','taskList','taskItem','blockquote')$s$);
 -- Keep the Capture-specific no-Page-namespace/cache/limits validation intact.
end $$;

create function app_private.capture_e4_metadata(p jsonb) returns void language plpgsql immutable set search_path='' as $$
declare k text;v jsonb;item jsonb;field text;number_value numeric;ids text[]:='{}';
begin
 if jsonb_typeof(p) is distinct from 'object' then raise exception 'Invalid metadata.' using errcode='22023';end if;
 for k,v in select key,value from jsonb_each(p-'document') loop
  if k='type' then if jsonb_typeof(v) is distinct from 'string' or v#>>'{}' not in ('note','idea','task','reminder') then raise exception 'Invalid type.' using errcode='22023';end if;
  elsif k='title' then if jsonb_typeof(v) not in ('null','string') or app_private.capture_document_utf16_length(v#>>'{}')>200 then raise exception 'Invalid title.' using errcode='22023';end if;
  elsif k in ('category_id','project_id') then if v<>'null'::jsonb and (jsonb_typeof(v) is distinct from 'string' or v#>>'{}' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then raise exception 'Invalid organization.' using errcode='22023';end if;
  elsif k='linked_capture_ids' then
   if jsonb_typeof(v) is distinct from 'array' or jsonb_array_length(v)>1000 or (select count(*)<>count(distinct value) from jsonb_array_elements(v)) then raise exception 'Invalid Capture IDs.' using errcode='22023';end if;
   for item in select value from jsonb_array_elements(v) loop if jsonb_typeof(item) is distinct from 'string' or item#>>'{}' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'Invalid Capture ID.' using errcode='22023';end if;end loop;
  elsif k='attachments' then
   if jsonb_typeof(v) is distinct from 'array' or jsonb_array_length(v)>6 then raise exception 'Invalid image list.' using errcode='22023';end if;
   for item in select value from jsonb_array_elements(v) loop
    if jsonb_typeof(item) is distinct from 'object' or not item?&array['id','name','mime','width','height','bytes'] or item-array['id','name','mime','width','height','bytes']<>'{}'::jsonb
     or jsonb_typeof(item->'id') is distinct from 'string' or item->>'id' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or item->>'id'=any(ids)
     or jsonb_typeof(item->'name') is distinct from 'string' or char_length(btrim(item->>'name'))=0 or app_private.capture_document_utf16_length(item->>'name')>200
     or jsonb_typeof(item->'mime') is distinct from 'string' or item->>'mime' not in ('image/png','image/jpeg') then raise exception 'Invalid image DTO.' using errcode='22023';end if;
    foreach field in array array['width','height','bytes'] loop
     if jsonb_typeof(item->field) is distinct from 'number' then raise exception 'Invalid image number.' using errcode='22023';end if;
     number_value:=(item->>field)::numeric;if number_value<=0 or number_value<>trunc(number_value) or number_value>9007199254740991 then raise exception 'Invalid image integer.' using errcode='22023';end if;
    end loop;
    if (item->>'width')::numeric*(item->>'height')::numeric>24000000 or (item->>'bytes')::numeric>8388608 then raise exception 'Image exceeds metadata limit.' using errcode='22023';end if;
    ids:=array_append(ids,item->>'id');
   end loop;
   -- Current finalized/owner checks still execute on the resulting Capture.
  else raise exception 'Unexpected metadata.' using errcode='22023';end if;
 end loop;
end $$;

-- Preserve the old parser for legacy commands and the exact expected-content contract.
do $$ declare definition text;begin
 select pg_get_functiondef('app_private.capture_document_intent(text,jsonb)'::regprocedure) into definition;
 execute replace(definition,'FUNCTION app_private.capture_document_intent(','FUNCTION app_private.capture_e4_previous_intent(');
end $$;
create or replace function app_private.capture_document_intent(p_operation text,p_input jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare metadata jsonb;legacy_intent jsonb;
begin
 if p_operation='capture.create' and coalesce(p_input?'document',false) then
  if jsonb_typeof(p_input) is distinct from 'object' or not p_input?&array['client_id','document','type','title','category_id','project_id']
   or p_input-array['client_id','document','status','type','title','category_id','project_id','linked_capture_ids','attachments']<>'{}'::jsonb
   or jsonb_typeof(p_input->'client_id') is distinct from 'string' or char_length(btrim(p_input->>'client_id')) not between 1 and 200
   or p_input?'status' and (jsonb_typeof(p_input->'status') is distinct from 'string' or p_input->>'status' not in ('inbox','draft')) then raise exception 'Invalid rich creation.' using errcode='22023';end if;
  perform app_private.capture_e4_metadata(p_input-array['client_id','status']);perform app_private.capture_document_validate_schema(p_input->'document');return true;
 elsif p_operation='capture.update' and coalesce(p_input?'expected_content' or (p_input->'patch')?'document',false) then
  metadata:=(p_input->'patch')-'document';perform app_private.capture_e4_metadata(metadata);
  legacy_intent:=jsonb_set(p_input,'{patch}',jsonb_build_object('document',p_input#>'{patch,document}'),false);
  return app_private.capture_e4_previous_intent(p_operation,legacy_intent);
 end if;
 return app_private.capture_e4_previous_intent(p_operation,p_input);
end $$;
create or replace function app_private.capture_document_receipt_request_allowed(p_command text,p_client_id text,p_request jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare intent jsonb;document jsonb;content text;
begin
 if not coalesce(p_command=any(array['capture.create','capture.update']),false) or jsonb_typeof(p_request) is distinct from 'string' or octet_length(p_request::text)>2097152 then return false;end if;
 intent:=(p_request#>>'{}')::jsonb;
 if app_private.capture_document_intent(p_command,intent) is not true or intent->>'client_id' is distinct from p_client_id then return false;end if;
 document:=case when p_command='capture.create' then intent->'document' else intent#>'{patch,document}' end;
 content:=nullif(app_private.capture_document_trim(app_private.knowledge_document_text(document)),'');
 perform app_private.capture_document_validate(jsonb_build_object('document',document,'document_version',1,'content',content));return true;
exception when others then return false;end $$;

create or replace function app_private.capture_document_commit_transition(p_operation text,p_input jsonb,p_changes jsonb) returns void language plpgsql immutable set search_path='' as $$
declare documentary boolean:=app_private.capture_document_intent(p_operation,p_input);change jsonb;b jsonb;a jsonb;expected jsonb;intended jsonb;key text;target text;supplied jsonb;
begin
 if documentary and jsonb_array_length(p_changes)<>1 then raise exception 'Document command changes one Capture.' using errcode='23514';end if;
 for change in select value from jsonb_array_elements(p_changes) loop
  if change->>'type'<>'capture' then continue;end if;b:=nullif(change->'before','null'::jsonb);a:=change->'after';
  if documentary then
   intended:=case when p_operation='capture.create' then p_input else p_input->'patch' end;
   if a->'document' is distinct from intended->'document' then raise exception 'Document differs from intent.' using errcode='23514';end if;
   if p_operation='capture.create' then
    if b is not null or a->>'document_version' is distinct from '1' or a->>'client_id' is distinct from p_input->>'client_id' or a->>'status' is distinct from coalesce(p_input->>'status','inbox') then raise exception 'Invalid rich creation transition.' using errcode='23514';end if;
   else
    expected:=p_input->'expected_content';
    if b is null or a->>'id' is distinct from p_input->>'id' or (a-array['document','document_version','content','title','type','category_id','project_id','linked_capture_ids','attachments','updated_at']) is distinct from (b-array['document','document_version','content','title','type','category_id','project_id','linked_capture_ids','attachments','updated_at']) then raise exception 'Document edit changed lifecycle/identity.' using errcode='23514';end if;
    if expected->>'kind'='legacy' and (b?'document' or b->'content' is distinct from expected->'content') or expected->>'kind'='rich' and (not b?'document' or b->'document_version' is distinct from expected->'document_version') then raise exception 'Capture content changed.' using errcode='40001';end if;
    if a->>'document_version' is distinct from ((case when b?'document' then (b->>'document_version')::numeric else 0 end)+1)::text then raise exception 'Invalid next revision.' using errcode='23514';end if;
   end if;
   for key in select unnest(array['title','type','category_id','project_id','attachments']) loop
    supplied:=case when intended?key then intended->key else b->key end;
    if key='title' then supplied:=coalesce(to_jsonb(nullif(app_private.capture_document_trim(supplied#>>'{}'),'')),'null'::jsonb);end if;
    if a->key is distinct from supplied then raise exception 'Metadata differs from intention.' using errcode='23514';end if;
   end loop;
   -- The server derives typed inline links; no caller can introduce an extra ID.
   supplied:=coalesce(intended->'linked_capture_ids',b->'linked_capture_ids','[]'::jsonb);
   for target in with recursive nodes(n) as (select a->'document' union all select c.value from nodes cross join lateral jsonb_array_elements(coalesce(n->'content','[]'::jsonb)) c)
    select distinct n#>>'{attrs,target_id}' from nodes where n->>'type'='captureLink' and n#>'{attrs,target_id}'<>'null'::jsonb loop
    if not supplied @> jsonb_build_array(target) then supplied:=supplied||jsonb_build_array(target);end if;
   end loop;
   if (select coalesce(jsonb_agg(v order by v),'[]'::jsonb) from jsonb_array_elements(supplied) v) is distinct from (select coalesce(jsonb_agg(v order by v),'[]'::jsonb) from jsonb_array_elements(coalesce(a->'linked_capture_ids','[]'::jsonb)) v) then raise exception 'Capture links differ from intention.' using errcode='23514';end if;
   perform app_private.capture_document_validate(a);
  else
   if a->'document' is distinct from b->'document' or a->'document_version' is distinct from b->'document_version' then raise exception 'Document transition requires rich intent.' using errcode='23514';end if;
   if p_operation='capture.update' and b?'document' and (p_input->'patch')?|array['title','content'] then raise exception 'Old editor cannot overwrite rich content.' using errcode='40001';end if;
  end if;
 end loop;
end $$;

-- In-place changes preserve identities/ACLs, including all old-command guards.
do $$ declare definition text;needle text;begin
 select pg_get_functiondef('app_private.capture_document_row()'::regprocedure) into definition;
 needle:=$s$if old.payload?'document' and new.payload->'title' is distinct from old.payload->'title' then raise exception 'Rich Capture rename requires its own contract.' using errcode='23514';end if;$s$;
 if strpos(definition,needle)=0 then raise exception 'Capture row source drift.';end if;
 execute replace(definition,needle,$s$if old.payload?'document' and new.payload->'title' is distinct from old.payload->'title' and (new.payload->>'document_version')::numeric<>(old.payload->>'document_version')::numeric+1 then raise exception 'Rich rename requires next revision.' using errcode='23514';end if;$s$);
 select pg_get_functiondef('app_private.capture_document_event_pair_allowed(uuid,uuid,text,uuid,text,text,timestamptz,jsonb,jsonb,jsonb)'::regprocedure) into definition;
 needle:=$s$if p_before->'title' is distinct from p_after->'title' then return false;end if;$s$;
 if strpos(definition,needle)=0 then raise exception 'Capture event source drift.';end if;
 definition:=replace(definition,needle,'');
 needle:=$s$array['document','document_version','content','updated_at']$s$;
 if length(definition)-length(replace(definition,needle,''))<>2*length(needle) then raise exception 'Capture event transition drift.';end if;
 execute replace(definition,needle,$s$array['document','document_version','content','title','type','category_id','project_id','linked_capture_ids','attachments','updated_at']$s$);
 -- No increase: each state1MiB, pair2MiB only existing validated Capture family.
 select pg_get_functiondef('app_private.knowledge_commit(uuid,uuid,text,jsonb)'::regprocedure) into definition;
 needle:=$s$if before_row?'document' or before_row?'document_version' then raise exception 'Rich Capture promotion is not enabled.' using errcode='40001';end if;$s$;
 if strpos(definition,needle)=0 then raise exception 'Knowledge promotion source drift.';end if;
 execute replace(definition,needle,'');
 -- A formatting-only change must not bypass the old title/text historical
 -- origin guard. Metadata lifecycle commands may retain the pair literally.
 select pg_get_functiondef('app_private.knowledge_promoted_capture()'::regprocedure) into definition;
 needle:=$s$new.payload->'title' is distinct from old.payload->'title' or new.payload->'content' is distinct from old.payload->'content'$s$;
 if strpos(definition,needle)=0 then raise exception 'Historical Capture guard drift.';end if;
 execute replace(definition,needle,needle||$s$ or new.payload->'document' is distinct from old.payload->'document' or new.payload->'document_version' is distinct from old.payload->'document_version'$s$);
end $$;

-- The projection consumes explicit Capture IDs. A Page is resolved exclusively
-- by its persisted origin, never by its title. No table/clock/authority in these
-- pure routines. Arrays preserve text, block, mark and checklist order.
create function app_private.capture_e4_promoted_node(p_node jsonb,p_captures jsonb,p_pages jsonb,p_linked jsonb,p_depth integer default 0) returns jsonb language plpgsql immutable set search_path='' as $$
declare result jsonb:='[]';children jsonb:='[]';child jsonb;node jsonb;rest text;parts text[];alias text;token text;offset_start integer;search_start integer:=1;capture_id text;page_id text;marks jsonb;
begin
 if p_depth>32 then raise exception 'Projection depth exceeded.' using errcode='22023';end if;
 if p_node->>'type'='captureLink' then
  capture_id:=p_node#>>'{attrs,target_id}';
  if capture_id is not null and not exists(select 1 from jsonb_array_elements(p_captures) c where c->>'id'=capture_id) then raise exception 'Foreign Capture reference.' using errcode='42501';end if;
  select p->>'id' into page_id from jsonb_array_elements(p_pages) p where p->>'origin_capture_id'=capture_id;
  return jsonb_build_array(case when page_id is null then p_node else jsonb_set(jsonb_set(p_node,'{type}','"wikiLink"'),'{attrs,target_id}',to_jsonb(page_id),false) end);
 elsif p_node->>'type'='text' then
  rest:=p_node->>'text';
  loop
   parts:=regexp_match(substr(rest,search_start),E'\\[\\[([^\\]\\n]{1,200})\\]\\]');exit when parts is null;
   alias:=parts[1];token:='[['||alias||']]';offset_start:=strpos(substr(rest,search_start),token)+search_start-1;
   -- JS without /u bounds aliases by UTF16 units. Do not consume an oversized
   -- Unicode candidate: a valid nested/later [[ token may still match in JS.
   if app_private.capture_document_utf16_length(alias)>200 or app_private.capture_document_trim(alias)='' then search_start:=offset_start+1;continue;end if;
   if offset_start>1 then result:=result||jsonb_build_array(jsonb_set(p_node,'{text}',to_jsonb(substr(rest,1,offset_start-1)),false));end if;
   capture_id:=null;page_id:=null;
   select case when count(*)=1 then min(c->>'id') end into capture_id from jsonb_array_elements(p_captures) c where p_linked? (c->>'id') and c->>'title'=alias;
   select p->>'id' into page_id from jsonb_array_elements(p_pages) p where p->>'origin_capture_id'=capture_id;
   node:=jsonb_build_object('type',case when page_id is null then 'captureLink' else 'wikiLink' end,'attrs',jsonb_build_object('target_id',coalesce(page_id,capture_id),'alias',alias));
   if p_node?'marks' then select coalesce(jsonb_agg(m order by n),'[]'::jsonb) into marks from jsonb_array_elements(p_node->'marks') with ordinality e(m,n) where m->>'type'<>'link';node:=node||jsonb_build_object('marks',marks);end if;
   result:=result||jsonb_build_array(node);rest:=substr(rest,offset_start+char_length(token));search_start:=1;
  end loop;
  if result='[]'::jsonb then return jsonb_build_array(p_node);end if;
  if rest<>'' then result:=result||jsonb_build_array(jsonb_set(p_node,'{text}',to_jsonb(rest),false));end if;return result;
 end if;
 node:=p_node;
 if p_node?'content' then
  for child in select value from jsonb_array_elements(p_node->'content') loop children:=children||app_private.capture_e4_promoted_node(child,p_captures,p_pages,p_linked,p_depth+1);end loop;
  node:=jsonb_set(node,'{content}',children,false);
 end if;return jsonb_build_array(node);
end $$;
create function app_private.capture_e4_promoted_document(p_capture jsonb,p_captures jsonb,p_pages jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare document jsonb;paragraphs jsonb;result jsonb;begin
 perform app_private.capture_document_validate(p_capture);
 if p_capture?'document' then document:=p_capture->'document';else
  select coalesce(jsonb_agg(case when line='' then jsonb_build_object('type','paragraph') else jsonb_build_object('type','paragraph','content',jsonb_build_array(jsonb_build_object('type','text','text',line))) end order by n),'[]'::jsonb)
   into paragraphs from unnest(case when coalesce(p_capture->>'content','')='' then array[''] else string_to_array(p_capture->>'content',E'\n') end) with ordinality e(line,n);
  document:=jsonb_build_object('type','doc','content',paragraphs);
 end if;
 result:=app_private.capture_e4_promoted_node(document,p_captures,p_pages,coalesce(p_capture->'linked_capture_ids','[]'::jsonb))->0;
 perform app_private.knowledge_validate_document(result);return result;
end $$;
create function app_private.capture_e4_resolve_node(p_node jsonb,p_capture uuid,p_page uuid,p_depth integer default 0) returns jsonb language plpgsql immutable set search_path='' as $$
declare result jsonb:=p_node;children jsonb:='[]';child jsonb;begin
 if p_depth>32 then raise exception 'Resolution depth exceeded.' using errcode='22023';end if;
 if p_node->>'type'='captureLink' and p_node#>>'{attrs,target_id}'=p_capture::text then
  return jsonb_set(jsonb_set(p_node,'{type}','"wikiLink"'),'{attrs,target_id}',to_jsonb(p_page::text),false);
 end if;
 if p_node?'content' then
  for child in select value from jsonb_array_elements(p_node->'content') loop children:=children||jsonb_build_array(app_private.capture_e4_resolve_node(child,p_capture,p_page,p_depth+1));end loop;
  result:=jsonb_set(result,'{content}',children,false);
 end if;return result;
end $$;

-- Metadata holder is the existing explicit Page->file link and immutable origin.
-- Trashed Pages retain their files for restoration; only live Pages can read.
create function app_private.capture_e4_image_holder(p_user uuid,p_file uuid,p_page uuid default null,p_live boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.links l join public.knowledge_pages p on p.user_id=l.user_id and p.id=l.from_id
  join public.knowledge_notebooks n on n.user_id=p.user_id and n.id=p.notebook_id
  join public.drive_files f on f.user_id=l.user_id and f.id=l.to_id
  where l.user_id=p_user and l.from_type='page' and l.to_type='file' and l.to_id=p_file and l.deleted_at is null
   and (p_page is null or p.id=p_page) and p.origin_capture_id is not null and f.kind='capture_image'
   and (not p_live or p.deleted_at is null and n.deleted_at is null) and f.purged_at is null);
$$;
do $$ declare definition text;begin
 select pg_get_functiondef('app_private.entity_image_referenced(uuid,uuid)'::regprocedure) into definition;
 execute replace(definition,'FUNCTION app_private.entity_image_referenced(','FUNCTION app_private.capture_e4_previous_image_referenced(');
 select pg_get_functiondef('app_private.knowledge_entity(uuid,text,uuid,boolean)'::regprocedure) into definition;
 execute replace(definition,'FUNCTION app_private.knowledge_entity(','FUNCTION app_private.capture_e4_previous_entity(');
 select pg_get_functiondef('app_private.knowledge_targets(uuid)'::regprocedure) into definition;
 execute replace(definition,'FUNCTION app_private.knowledge_targets(','FUNCTION app_private.capture_e4_previous_targets(');
end $$;
create or replace function app_private.entity_image_referenced(p_user uuid,p_file uuid) returns boolean language sql stable security definer set search_path='' as $$
 select app_private.capture_e4_previous_image_referenced(p_user,p_file) or app_private.capture_e4_image_holder(p_user,p_file);
$$;
do $$ declare definition text;needle text;begin
 select replace(pg_get_functiondef('app_private.file_cleanup_ack(uuid)'::regprocedure),chr(13)||chr(10),chr(10)) into definition;
 needle:=$source$and not exists(select 1 from public.profiles p where p.user_id=reservation.user_id and p.avatar_file_id=reservation.file_id)
  and not exists(select 1 from public.capture_file_links l where l.user_id=reservation.user_id and l.file_id=reservation.file_id)$source$;
 if strpos(definition,needle)=0 then raise exception 'Cleanup ACK source drift.';end if;
 execute replace(definition,needle,'and not app_private.entity_image_referenced(reservation.user_id,reservation.file_id)');
end $$;
create or replace function app_private.knowledge_entity(p_user uuid,p_type text,p_id uuid,p_live boolean default true) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare file_row public.drive_files;begin
 if p_type='file' and not exists(select 1 from public.user_entitlements where user_id=p_user and feature_key='conhecimento' and not allowed) then
  select f.* into file_row from public.drive_files f where f.user_id=p_user and f.id=p_id and f.kind='capture_image' and f.purged_at is null and (not p_live or f.deleted_at is null);
  if found and (app_private.capture_e4_image_holder(p_user,p_id,null,p_live) or exists(
   select 1 from public.knowledge_pages p join public.captures c on c.user_id=p.user_id and c.id=p.origin_capture_id
    where p.user_id=p_user and (not p_live or p.deleted_at is null) and coalesce(c.payload->'attachments','[]'::jsonb) @> jsonb_build_array(jsonb_build_object('id',p_id::text)))) then return file_row.payload;end if;
 end if;return app_private.capture_e4_previous_entity(p_user,p_type,p_id,p_live);
end $$;
create or replace function app_private.knowledge_targets(p_user uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;images jsonb;begin
 select coalesce(jsonb_agg(case when t->>'type'='file' then t||jsonb_build_object('file_kind','drive') else t end order by ordinality),'[]'::jsonb) into result
  from jsonb_array_elements(app_private.capture_e4_previous_targets(p_user)) with ordinality e(t,ordinality);
 if not exists(select 1 from public.user_entitlements where user_id=p_user and feature_key='conhecimento' and not allowed) then
  select coalesce(jsonb_agg(jsonb_build_object('type','file','id',f.id,'title',f.name,'file_kind','capture_image','href','/conhecimento?note='||holder.page_id::text) order by f.id),'[]'::jsonb) into images
   from public.drive_files f cross join lateral(select min(p.id::text)::uuid page_id from public.links l join public.knowledge_pages p on p.user_id=l.user_id and p.id=l.from_id join public.knowledge_notebooks n on n.user_id=p.user_id and n.id=p.notebook_id
    where l.user_id=f.user_id and l.to_type='file' and l.to_id=f.id and l.from_type='page' and l.deleted_at is null and p.origin_capture_id is not null and p.deleted_at is null and n.deleted_at is null) holder
   where f.user_id=p_user and f.kind='capture_image' and f.deleted_at is null and f.purged_at is null and holder.page_id is not null;
  result:=result||images;
 end if;return result;
end $$;

-- Authority and original snapshot CAS have already run in knowledge_commit.
-- Every modified Page was compared literally with its before row under the
-- same user lock; the following check binds only the permitted ID projection.
create function app_private.capture_e4_knowledge_transition(p_user uuid,p_operation text,p_request jsonb) returns void language plpgsql security definer set search_path='' as $$
declare change jsonb;b jsonb;a jsonb;source jsonb;destination jsonb;captures jsonb;pages jsonb;expected jsonb;item jsonb;target_page uuid;source_id uuid;destination_id uuid;file_row public.drive_files;
begin
 for change in select value from jsonb_array_elements(p_request->'changes') where value->>'type'='knowledge_page' loop
  b:=nullif(change->'before','null'::jsonb);a:=change->'after';
  for item in with recursive nodes(n) as(select a->'document' union all select c.value from nodes cross join lateral jsonb_array_elements(coalesce(n->'content','[]'::jsonb)) c)
   select n from nodes where n->>'type'='captureLink' and n#>'{attrs,target_id}'<>'null'::jsonb loop
   if not exists(select 1 from public.captures c where c.user_id=p_user and c.id=(item#>>'{attrs,target_id}')::uuid) then raise exception 'Foreign inline Capture.' using errcode='42501';end if;
  end loop;
 end loop;
 -- A generic create/restore link cannot manufacture a new Capture-image holder.
 for change in select value from jsonb_array_elements(p_request->'changes') where value->>'type'='knowledge_link' loop
  b:=nullif(change->'before','null'::jsonb);a:=change->'after';
  if a->'deleted_at'='null'::jsonb and (b is null or b->'deleted_at'<>'null'::jsonb) then
   if (a->>'from_type'='file' and exists(select 1 from public.drive_files f where f.user_id=p_user and f.id=(a->>'from_id')::uuid and f.kind='capture_image'))
    or (a->>'to_type'='file' and exists(select 1 from public.drive_files f where f.user_id=p_user and f.id=(a->>'to_id')::uuid and f.kind='capture_image')) then
    if p_operation<>'knowledge.page.promote-capture' or a->>'from_type'<>'page' or a->>'to_type'<>'file' then raise exception 'Capture images require origin promotion.' using errcode='42501';end if;
   end if;
  end if;
 end loop;
 if p_operation<>'knowledge.page.promote-capture' then return;end if;
 select nullif(c->'before','null'::jsonb) into source from jsonb_array_elements(p_request->'changes') c where c->>'type'='capture';
 if source is null then
  if jsonb_array_length(p_request->'changes')<>0 then raise exception 'Replay cannot mutate Pages.' using errcode='23514';end if;return;
 end if;source_id:=(source->>'id')::uuid;
 if source->'deleted_at' is distinct from 'null'::jsonb then raise exception 'Deleted Capture cannot be promoted.' using errcode='42501';end if;
 select c->'after' into destination from jsonb_array_elements(p_request->'changes') c where c->>'type'='knowledge_page' and c->'before'='null'::jsonb and c#>>'{after,origin_capture_id}'=source_id::text;
 if destination is null then raise exception 'Missing origin Page.' using errcode='23514';end if;destination_id:=(destination->>'id')::uuid;
 select coalesce(jsonb_agg(c.payload order by c.id),'[]'::jsonb) into captures from public.captures c where c.user_id=p_user;
 select coalesce(jsonb_agg(p.payload order by p.id),'[]'::jsonb) into pages from public.knowledge_pages p where p.user_id=p_user and p.id<>destination_id;
 expected:=app_private.capture_e4_promoted_document(source,captures,pages);
 if destination->'document' is distinct from expected or destination->>'content_text' is distinct from app_private.knowledge_document_text(expected)
  or destination->>'title' is distinct from coalesce(nullif(app_private.capture_document_trim(source->>'title'),''),'Captura sem título')
  or p_request#>'{receipt,result}' is distinct from jsonb_build_object('page',destination,'capture_id',source_id) then raise exception 'Promotion lost or replaced original content.' using errcode='23514';end if;
 for change in select value from jsonb_array_elements(p_request->'changes') where value->>'type'='knowledge_page' loop
  b:=nullif(change->'before','null'::jsonb);a:=change->'after';if a->>'id'=destination_id::text then continue;end if;
  if b is null then raise exception 'Promotion created unrelated Page.' using errcode='23514';end if;
  expected:=app_private.capture_e4_resolve_node(b->'document',source_id,destination_id);
  if a->'document' is distinct from expected or expected=b->'document' or a->>'content_text' is distinct from app_private.knowledge_document_text(expected)
   or (a-array['document','content_text','version','updated_at']) is distinct from (b-array['document','content_text','version','updated_at']) then raise exception 'Promotion modified unrelated Page state.' using errcode='23514';end if;
 end loop;
 for change in select value from jsonb_array_elements(p_request->'changes') where value->>'type'='knowledge_link' loop
  b:=nullif(change->'before','null'::jsonb);a:=change->'after';
  if a->>'from_type'<>'page' then raise exception 'Invalid promotion link source.' using errcode='23514';end if;
  if a->>'from_id'=destination_id::text then
   if a->'deleted_at'<>'null'::jsonb then raise exception 'Promotion cannot delete its new links.' using errcode='23514';end if;
   if a->>'to_type'='file' then
    select f.* into file_row from public.drive_files f join app_private.upload_reservations r on r.user_id=f.user_id and r.id=f.id and r.file_id=f.id and r.status='finalized'
     where f.user_id=p_user and f.id=(a->>'to_id')::uuid and f.kind='capture_image' and f.deleted_at is null and f.purged_at is null;
    if not found or not coalesce(source->'attachments','[]'::jsonb) @> jsonb_build_array(jsonb_build_object('id',a->>'to_id')) then raise exception 'Foreign or unfinalized image.' using errcode='42501';end if;
   elsif a->>'to_type'='capture' then
    if not coalesce(source->'linked_capture_ids','[]'::jsonb)?(a->>'to_id') or exists(select 1 from public.knowledge_pages p where p.user_id=p_user and p.origin_capture_id=(a->>'to_id')::uuid) then raise exception 'Capture link differs from origin.' using errcode='23514';end if;
   elsif a->>'to_type'='page' then
    if not exists(select 1 from public.knowledge_pages p where p.user_id=p_user and p.id=(a->>'to_id')::uuid and coalesce(source->'linked_capture_ids','[]'::jsonb)?p.origin_capture_id::text) then raise exception 'Page link has no origin Capture.' using errcode='23514';end if;
   else raise exception 'Unrelated promotion link.' using errcode='23514';end if;
  else
   if not exists(select 1 from public.knowledge_pages p where p.user_id=p_user and p.id=(a->>'from_id')::uuid and p.origin_capture_id is not null) then raise exception 'Pending link has no promoted origin.' using errcode='23514';end if;
   if a->>'to_type'='capture' and a->>'to_id'=source_id::text then
    if b is null or b->'deleted_at'<>'null'::jsonb or a->'deleted_at'='null'::jsonb then raise exception 'Expected pending edge deletion.' using errcode='23514';end if;
   elsif a->>'to_type'='page' and a->>'to_id'=destination_id::text and a->'deleted_at'='null'::jsonb then
    if not exists(select 1 from jsonb_array_elements(p_request->'changes') c where c->>'type'='knowledge_link' and c#>>'{before,from_id}'=a->>'from_id' and c#>>'{before,to_type}'='capture' and c#>>'{before,to_id}'=source_id::text and c#>'{before,deleted_at}'='null'::jsonb and c#>'{after,deleted_at}'<>'null'::jsonb) then raise exception 'Missing replaced Capture edge.' using errcode='23514';end if;
   else raise exception 'Promotion touched unrelated edge.' using errcode='23514';end if;
  end if;
 end loop;
 for item in select value from jsonb_array_elements(coalesce(source->'attachments','[]'::jsonb)) loop
  if not app_private.capture_e4_image_holder(p_user,(item->>'id')::uuid,destination_id,true) then raise exception 'Promoted image holder missing.' using errcode='23514';end if;
 end loop;
 for item in select value from jsonb_array_elements(coalesce(source->'linked_capture_ids','[]'::jsonb)) loop
  select p.id into target_page from public.knowledge_pages p where p.user_id=p_user and p.origin_capture_id=(item#>>'{}')::uuid;
  if target_page is distinct from destination_id and not exists(select 1 from public.links l where l.user_id=p_user and l.from_type='page' and l.from_id=destination_id and l.deleted_at is null and l.to_type=case when target_page is null then 'capture' else 'page' end and l.to_id=coalesce(target_page,(item#>>'{}')::uuid)) then raise exception 'Promoted explicit link missing.' using errcode='23514';end if;
 end loop;
end $$;
do $$ declare definition text;needle text;begin
 select pg_get_functiondef('app_private.knowledge_commit(uuid,uuid,text,jsonb)'::regprocedure) into definition;
 needle:='perform app_private.knowledge_integrity(p_user);';
 if length(definition)-length(replace(definition,needle,''))<>length(needle) then raise exception 'Knowledge transition boundary drift.';end if;
 execute replace(definition,needle,'perform app_private.capture_e4_knowledge_transition(p_user,p_operation,p_request);'||chr(10)||'  '||needle);
end $$;

-- A new page-bound read has its own gate. The original Capture/Drive read and
-- its entitlement remain unchanged; revoking Knowledge cuts this route even
-- if the same file is still readable as a Capture attachment.
create function app_private.knowledge_image_read_metadata(p_user uuid,p_session uuid,p_page uuid,p_file uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare file_row public.drive_files;begin
 perform app_private.knowledge_guard(p_user,p_session,'read.knowledge');
 if not app_private.capture_e4_image_holder(p_user,p_file,p_page,true) then raise exception 'Page image unavailable.' using errcode='42501';end if;
 select f.* into file_row from public.drive_files f join app_private.upload_reservations r on r.user_id=f.user_id and r.id=f.id and r.file_id=f.id and r.status='finalized'
  where f.user_id=p_user and f.id=p_file and f.kind='capture_image' and f.deleted_at is null and f.purged_at is null;
 if not found then raise exception 'Finalized Page image unavailable.' using errcode='42501';end if;
 return jsonb_build_object('version',1,'user_id',p_user,'page_id',p_page,'file',file_row.payload,'storage_path',file_row.storage_path);
end $$;
create function public.knowledge_image_read_metadata(p_user uuid,p_session uuid,p_page uuid,p_file uuid) returns jsonb language sql security invoker set search_path='' as $$select app_private.knowledge_image_read_metadata(p_user,p_session,p_page,p_file);$$;

revoke all on function app_private.capture_e4_validate_document(jsonb),app_private.capture_e4_metadata(jsonb),app_private.capture_e4_previous_intent(text,jsonb),app_private.capture_e4_promoted_node(jsonb,jsonb,jsonb,jsonb,integer),app_private.capture_e4_promoted_document(jsonb,jsonb,jsonb),app_private.capture_e4_resolve_node(jsonb,uuid,uuid,integer),app_private.capture_e4_image_holder(uuid,uuid,uuid,boolean),app_private.capture_e4_previous_image_referenced(uuid,uuid),app_private.capture_e4_previous_entity(uuid,text,uuid,boolean),app_private.capture_e4_previous_targets(uuid),app_private.capture_e4_knowledge_transition(uuid,text,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.knowledge_image_read_metadata(uuid,uuid,uuid,uuid),app_private.knowledge_image_read_metadata(uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.knowledge_image_read_metadata(uuid,uuid,uuid,uuid),app_private.knowledge_image_read_metadata(uuid,uuid,uuid,uuid) to service_role;
comment on constraint command_receipts_check on app_private.command_receipts is 'Request/result remain1MiB; only strict capture.create/update documentary JSON-string fingerprints may reach2MiB escaped bytes. Result always1MiB. No replay authority changed.';
-- Replaced functions keep their original OIDs, owners and closed ACLs. No
-- direct table grant, reset, seed, Storage policy or upload endpoint is added.
commit;
