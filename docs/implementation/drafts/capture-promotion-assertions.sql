-- E4 assertions AFTER the canonical loader includes the new migration ONCE.
-- Do not apply the draft migration again here. Disposable synthetic DB only.
-- Every mutation below rolls back. Storage bytes/processor/URL issuance are
-- not tested by SQL metadata fixtures and need the separate application gate.
do $draft$ begin raise exception 'DRAFT_NOT_AUTHORIZED_FOR_APPLICATION';end $draft$;
begin;
set local statement_timeout='60s';set local lock_timeout='5s';
select set_config('e4.user',gen_random_uuid()::text,true),set_config('e4.session',gen_random_uuid()::text,true),set_config('e4.other',gen_random_uuid()::text,true),
 set_config('e4.a',gen_random_uuid()::text,true),set_config('e4.b',gen_random_uuid()::text,true),set_config('e4.page_a',gen_random_uuid()::text,true),set_config('e4.page_b',gen_random_uuid()::text,true),set_config('e4.book',gen_random_uuid()::text,true),set_config('e4.file',gen_random_uuid()::text,true);
create function pg_temp.e4_assert(ok boolean) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'E4 assertion failed.';end if;end $$;
create function pg_temp.e4_error(statement text,expected text) returns void language plpgsql as $$declare code text;begin
 begin execute statement;exception when others then get stacked diagnostics code=returned_sqlstate;if code is distinct from expected then raise exception 'E4 SQLSTATE mismatch: %',code;end if;return;end;raise exception 'E4 expected rejection.';
end $$;
create function pg_temp.e4_doc(with_reference boolean) returns jsonb language sql as $$
 select jsonb_build_object('type','doc','content',jsonb_build_array(
  jsonb_build_object('type','heading','attrs',jsonb_build_object('level',2,'textAlign','center'),'content',jsonb_build_array(jsonb_build_object('type','text','text','Literal <b>','marks',jsonb_build_array(jsonb_build_object('type','bold'))))),
  jsonb_build_object('type','taskList','content',jsonb_build_array(jsonb_build_object('type','taskItem','attrs',jsonb_build_object('checked',true),'content',jsonb_build_array(jsonb_build_object('type','paragraph','content',jsonb_build_array(jsonb_build_object('type','text','text','Concluído')))))))
 )||case when with_reference then jsonb_build_array(jsonb_build_object('type','paragraph','content',jsonb_build_array(jsonb_build_object('type','captureLink','attrs',jsonb_build_object('target_id',current_setting('e4.b'),'alias','B original'))))) else '[]'::jsonb end);
$$;
-- UTF16 scanner parity: oversized candidates remain literal, while a later
-- or nested valid token still resolves. No limit is widened to codepoints.
do $$ declare input text;expected text;result jsonb;alias text:=repeat('🧠',100);begin
 result:=app_private.capture_e4_promoted_document(jsonb_build_object('content','[['||alias||']]'),'[]'::jsonb,'[]'::jsonb);
 perform pg_temp.e4_assert(result#>>'{content,0,content,0,type}'='captureLink' and result#>>'{content,0,content,0,attrs,alias}'=alias);
 foreach input in array array['[['||repeat('🧠',101)||']]', '[['||repeat('🧠',101)||']] [[B]]', '[['||repeat('🧠',101)||'[[B]]'] loop
  expected:=case when right(input,5)='[[B]]' then left(input,char_length(input)-5)||'B' else input end;
  result:=app_private.capture_e4_promoted_document(jsonb_build_object('content',input),'[]'::jsonb,'[]'::jsonb);
  perform pg_temp.e4_assert(app_private.knowledge_document_text(result)=expected);
  if right(input,5)='[[B]]' then perform pg_temp.e4_assert(result#>>'{content,0,content,0,text}'=left(input,char_length(input)-5));else perform pg_temp.e4_assert(result#>>'{content,0,content,0,text}'=input);end if;
 end loop;
end $$;
create function pg_temp.e4_capture(record_id text,title text,doc jsonb) returns jsonb language sql as $$
 select jsonb_build_object('id',record_id,'user_id',current_setting('e4.user'),'client_id',record_id,'project_id',null,'type','note','title',title,'content',app_private.knowledge_document_text(doc),'document',doc,'document_version',1,
  'status','inbox','category_id',null,'converted_task_id',null,'captured_at','2026-10-22T12:00:00Z','organized_at',null,'archived_at',null,'deleted_at',null,'created_at','2026-10-22T12:00:00Z','updated_at','2026-10-22T12:00:00Z','linked_capture_ids','[]'::jsonb);
$$;
-- Test the installed event predicate itself. The source guard must replace
-- all four before/after operands, without widening lifecycle or revision rules.
create function pg_temp.e4_event_pair(b jsonb,a jsonb,action text) returns boolean language sql as $$
 with event as(select jsonb_build_object('id',gen_random_uuid(),'user_id',current_setting('e4.user'),'entity_type','capture','entity_id',a->>'id',
  'action',action,'canal','web','occurred_at','2026-10-22T12:00:00Z','before',b,'after',a) payload)
 select app_private.capture_document_event_pair_allowed((payload->>'id')::uuid,current_setting('e4.user')::uuid,'capture',(a->>'id')::uuid,action,'web','2026-10-22T12:00:00Z'::timestamptz,b,a,payload) from event;
$$;
do $$ declare definition text;expanded text;rich jsonb;legacy jsonb;next_row jsonb;next_doc jsonb;archived jsonb;begin
 definition:=pg_get_functiondef('app_private.capture_document_event_pair_allowed(uuid,uuid,text,uuid,text,text,timestamptz,jsonb,jsonb,jsonb)'::regprocedure);
 expanded:=$operand$array['document','document_version','content','title','type','category_id','project_id','linked_capture_ids','attachments','updated_at']$operand$;
 perform pg_temp.e4_assert(length(definition)-length(replace(definition,expanded,''))=4*length(expanded));
 perform pg_temp.e4_assert(strpos(definition,$operand$array['document','document_version','content','updated_at']$operand$)=0);
 rich:=pg_temp.e4_capture(gen_random_uuid()::text,'Título rico',pg_temp.e4_doc(false));
 legacy:=(rich-array['document','document_version'])||jsonb_build_object('title','Título legado','content','Texto legado');
 perform pg_temp.e4_assert(pg_temp.e4_event_pair(legacy,rich,'updated'));
 next_doc:=jsonb_set(rich->'document','{content,0,attrs,textAlign}','"right"');
 next_row:=rich||jsonb_build_object('title','Título seguinte','document',next_doc,'document_version',2,'content',app_private.knowledge_document_text(next_doc));
 perform pg_temp.e4_assert(pg_temp.e4_event_pair(rich,next_row,'updated'));
 archived:=rich||jsonb_build_object('status','archived','archived_at','2026-10-22T12:00:00Z');
 perform pg_temp.e4_assert(pg_temp.e4_event_pair(rich,archived,'status_changed'));
 perform pg_temp.e4_assert(pg_temp.e4_event_pair(rich,rich||jsonb_build_object('type','idea'),'updated'));
 perform pg_temp.e4_assert(pg_temp.e4_event_pair(rich,rich||jsonb_build_object('title','Sem próxima revisão'),'updated') is false);
 perform pg_temp.e4_assert(pg_temp.e4_event_pair(rich,rich||jsonb_build_object('document',next_doc),'updated') is false);
 perform pg_temp.e4_assert(pg_temp.e4_event_pair(legacy,rich||jsonb_build_object('status','archived','archived_at','2026-10-22T12:00:00Z'),'updated') is false);
 perform pg_temp.e4_assert(pg_temp.e4_event_pair(rich,next_row||jsonb_build_object('status','archived','archived_at','2026-10-22T12:00:00Z'),'updated') is false);
 perform pg_temp.e4_assert(pg_temp.e4_event_pair(rich,next_row,'status_changed') is false);
end $$;
create function pg_temp.e4_page(record_id text,title text,capture_id text,doc jsonb) returns jsonb language sql as $$
 select jsonb_build_object('id',record_id,'user_id',current_setting('e4.user'),'notebook_id',current_setting('e4.book'),'parent_id',null,'origin_capture_id',capture_id,'title',title,'normalized_title',app_private.knowledge_normalize(title),'document',doc,'content_text',app_private.knowledge_document_text(doc),'version',1,'position',0,'archived_at',null,'deleted_at',null,'deletion_batch_id',null,'created_at','2026-10-22T12:00:00Z','updated_at','2026-10-22T12:00:00Z');
$$;
create function pg_temp.e4_change(kind text,b jsonb,a jsonb) returns jsonb language sql as $$select jsonb_build_object('type',kind,'before',b,'after',a);$$;
create function pg_temp.e4_link(source_id text,target_type text,target_id text) returns jsonb language sql as $$
 select jsonb_build_object('id',gen_random_uuid(),'user_id',current_setting('e4.user'),'from_type','page','from_id',source_id,'to_type',target_type,'to_id',target_id,'deleted_at',null,'created_at','2026-10-22T12:00:00Z','updated_at','2026-10-22T12:00:00Z');
$$;
create function pg_temp.e4_events(changes jsonb) returns jsonb language sql as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',gen_random_uuid(),'user_id',current_setting('e4.user'),'entity_type',c->>'type','entity_id',c#>>'{after,id}',
  'action',case when c->'before'='null'::jsonb then 'created' when c->>'type'='capture' then 'status_changed' when c#>'{after,deleted_at}'<>'null'::jsonb and c#>'{before,deleted_at}'='null'::jsonb then 'deleted' else 'updated' end,
  'canal','web','occurred_at','2026-10-22T12:00:00Z','before',c->'before','after',c->'after') order by ordinal),'[]'::jsonb) from jsonb_array_elements(changes) with ordinality e(c,ordinal);
$$;
create function pg_temp.e4_promotion(changes jsonb,refs jsonb,client text,page jsonb,capture_id text) returns jsonb language sql as $$
 select jsonb_build_object('expected_revision',public.knowledge_snapshot(current_setting('e4.user')::uuid,current_setting('e4.session')::uuid,'knowledge.page.promote-capture')->>'revision',
  'context',jsonb_build_object('user_id',current_setting('e4.user'),'canal','web'),'changes',changes,'refs',refs,'events',pg_temp.e4_events(changes),
  'receipt',jsonb_build_object('user_id',current_setting('e4.user'),'command','knowledge.page.promote-capture','client_id',client,'fingerprint',encode(sha256(convert_to(client,'UTF8')),'hex'),'result',jsonb_build_object('page',page,'capture_id',capture_id)));
$$;
insert into auth.users(id,aud,role,email,is_anonymous,created_at,updated_at) values
 (current_setting('e4.user')::uuid,'authenticated','authenticated','e4-'||current_setting('e4.user')||'@example.invalid',false,now(),now()),
 (current_setting('e4.other')::uuid,'authenticated','authenticated','e4-'||current_setting('e4.other')||'@example.invalid',false,now(),now());
insert into auth.sessions(id,user_id,created_at,updated_at) values(current_setting('e4.session')::uuid,current_setting('e4.user')::uuid,now(),now());
-- Privileged metadata setup only; no claim that an image processor was run.
do $$ declare f jsonb;book jsonb;attachment jsonb;begin
 f:=jsonb_build_object('id',current_setting('e4.file'),'user_id',current_setting('e4.user'),'kind','capture_image','folder_id',null,'name','Imagem.png','mime','image/png','bytes',50,'width',2,'height',2,'sha256',repeat('a',64),'starred',false,'deleted_at',null,'deletion_batch_id',null,'created_at',(now()-interval '3 days'),'updated_at',(now()-interval '3 days'),'modified_at',(now()-interval '3 days'));
 insert into public.drive_files(id,user_id,payload,kind,name,mime,bytes,sha256,storage_path,created_at,updated_at) values((f->>'id')::uuid,(f->>'user_id')::uuid,f,'capture_image','Imagem.png','image/png',50,repeat('a',64),current_setting('e4.user')||'/'||current_setting('e4.file'),now()-interval '3 days',now()-interval '3 days');
 insert into app_private.upload_reservations(id,user_id,kind,name,client_id,staging_path,final_path,max_bytes,quota_bytes,expires_at,status,file_id) values(current_setting('e4.file')::uuid,current_setting('e4.user')::uuid,'capture_image','Imagem.png','image-fixture',current_setting('e4.user')||'/'||current_setting('e4.file'),current_setting('e4.user')||'/'||current_setting('e4.file'),8388608,104857600,now()-interval '2 days','finalized',current_setting('e4.file')::uuid);
 attachment:=jsonb_build_object('id',current_setting('e4.file'),'name','Imagem.png','mime','image/png','width',2,'height',2,'bytes',50);
 insert into public.captures(payload) values(pg_temp.e4_capture(current_setting('e4.b'),'B',pg_temp.e4_doc(false)));
 insert into public.captures(payload) values(pg_temp.e4_capture(current_setting('e4.a'),'A',pg_temp.e4_doc(true))||jsonb_build_object('linked_capture_ids',jsonb_build_array(current_setting('e4.b')),'attachments',jsonb_build_array(attachment)));
 book:=jsonb_build_object('id',current_setting('e4.book'),'user_id',current_setting('e4.user'),'name','Caderno','project_id',null,'position',0,'deleted_at',null,'deletion_batch_id',null,'created_at','2026-10-22T12:00:00Z','updated_at','2026-10-22T12:00:00Z');
 insert into public.knowledge_notebooks(id,user_id,payload,created_at,updated_at) values(current_setting('e4.book')::uuid,current_setting('e4.user')::uuid,book,'2026-10-22T12:00:00Z','2026-10-22T12:00:00Z');
end $$;
-- Real rich create + atomic title/document update through the original RPC.
do $$ declare row jsonb;input jsonb;request jsonb;changes jsonb;result jsonb;before_row jsonb;next_doc jsonb;begin
 row:=pg_temp.e4_capture(gen_random_uuid()::text,'Nova rica',pg_temp.e4_doc(false))||jsonb_build_object('client_id','sql-rich-create');
 input:=jsonb_build_object('client_id','sql-rich-create','type','note','title',chr(9)||'Nova rica'||chr(160),'category_id',null,'project_id',null,'document',row->'document');
 changes:=jsonb_build_array(pg_temp.e4_change('capture',null,row));
 request:=jsonb_build_object('expectedRevision',public.capture_task_revision(current_setting('e4.user')::uuid,current_setting('e4.session')::uuid,'capture.create'),'context',jsonb_build_object('user_id',current_setting('e4.user'),'canal','web'),'changes',changes,'events',pg_temp.e4_events(changes),
  'receipt',jsonb_build_object('user_id',current_setting('e4.user'),'command','capture.create','client_id','sql-rich-create','fingerprint',input::text,'result',row));
 result:=public.capture_task_commit(current_setting('e4.user')::uuid,current_setting('e4.session')::uuid,'capture.create',request);
 perform pg_temp.e4_assert(result=jsonb_build_object('status','committed','result',row));
 perform pg_temp.e4_assert(public.capture_task_commit(current_setting('e4.user')::uuid,current_setting('e4.session')::uuid,'capture.create',request)->>'status'='replayed');
 before_row:=row;next_doc:=jsonb_set(row->'document','{content,0,attrs,textAlign}','"right"');
 row:=row||jsonb_build_object('title','Renomeada atomicamente','document',next_doc,'document_version',2);
 input:=jsonb_build_object('id',row->>'id','client_id','sql-rich-edit','expected_content',jsonb_build_object('kind','rich','document_version',1),'patch',jsonb_build_object('title',chr(9)||(row->>'title')||chr(160),'document',next_doc));
 changes:=jsonb_build_array(pg_temp.e4_change('capture',before_row,row));
 request:=jsonb_build_object('expectedRevision',public.capture_task_revision(current_setting('e4.user')::uuid,current_setting('e4.session')::uuid,'capture.update'),'context',jsonb_build_object('user_id',current_setting('e4.user'),'canal','web'),'changes',changes,'events',jsonb_set(pg_temp.e4_events(changes),'{0,action}','"updated"'),
  'receipt',jsonb_build_object('user_id',current_setting('e4.user'),'command','capture.update','client_id','sql-rich-edit','fingerprint',input::text,'result',row));
 perform pg_temp.e4_assert(public.capture_task_commit(current_setting('e4.user')::uuid,current_setting('e4.session')::uuid,'capture.update',request)->>'status'='committed');
 perform pg_temp.e4_assert((select payload=row from public.captures where id=(row->>'id')::uuid));
 perform pg_temp.e4_assert(app_private.capture_document_intent('capture.update',null) is false and app_private.capture_document_intent(null,input) is false);
 perform pg_temp.e4_error(format('select app_private.capture_document_intent(''capture.create'',%L::jsonb)',jsonb_build_object('client_id','bad-create','document',next_doc,'type','note','title','Invalid','category_id',null,'project_id',null,'content','forged')::text),'22023');
end $$;
-- Deleted origin is refused by the real public transaction, rolling back its
-- provisional destination/event/receipt while preserving the deleted source.
do $$ declare source jsonb;destination jsonb;request jsonb;begin
 source:=pg_temp.e4_capture(gen_random_uuid()::text,'Excluída',pg_temp.e4_doc(false))||jsonb_build_object('deleted_at','2026-10-22T12:00:00Z');
 insert into public.captures(payload) values(source);
 destination:=pg_temp.e4_page(gen_random_uuid()::text,'Excluída',source->>'id',source->'document');
 request:=pg_temp.e4_promotion(jsonb_build_array(pg_temp.e4_change('knowledge_page',null,destination),pg_temp.e4_change('capture',source,source||jsonb_build_object('status','archived','archived_at','2026-10-22T12:00:00Z','organized_at','2026-10-22T12:00:00Z'))),'[]'::jsonb,'deleted-origin',destination,source->>'id');
 perform pg_temp.e4_error(format('select public.knowledge_commit(%L::uuid,%L::uuid,''knowledge.page.promote-capture'',%L::jsonb)',current_setting('e4.user'),current_setting('e4.session'),request::text),'42501');
 perform pg_temp.e4_assert(not exists(select 1 from public.knowledge_pages where id=(destination->>'id')::uuid));
 perform pg_temp.e4_assert(not exists(select 1 from app_private.command_receipts where user_id=current_setting('e4.user')::uuid and command='knowledge.page.promote-capture' and client_id='deleted-origin'));
 perform pg_temp.e4_assert((select payload=source from public.captures where id=(source->>'id')::uuid));
end $$;
-- Real original public commit: rich A with image + typed pending B.
do $$ declare b jsonb;a jsonb;p jsonb;changes jsonb;request jsonb;result jsonb;bad jsonb;baseline jsonb;begin
 select payload into b from public.captures where id=current_setting('e4.a')::uuid;
 a:=b||jsonb_build_object('status','archived','archived_at','2026-10-22T12:00:00Z','organized_at','2026-10-22T12:00:00Z');
 p:=pg_temp.e4_page(current_setting('e4.page_a'),'A',current_setting('e4.a'),pg_temp.e4_doc(true));
 changes:=jsonb_build_array(pg_temp.e4_change('knowledge_page',null,p),pg_temp.e4_change('knowledge_link',null,pg_temp.e4_link(p->>'id','capture',current_setting('e4.b'))),pg_temp.e4_change('knowledge_link',null,pg_temp.e4_link(p->>'id','file',current_setting('e4.file'))),pg_temp.e4_change('capture',b,a));
 request:=pg_temp.e4_promotion(changes,'[]'::jsonb,'promote-a',p,b->>'id');
 bad:=jsonb_set(request,'{changes,0,after,document,content,0,content,0,text}','"replacement"');bad:=jsonb_set(bad,'{events}',pg_temp.e4_events(bad->'changes'));bad:=jsonb_set(bad,'{changes,0,after,content_text}',to_jsonb(app_private.knowledge_document_text(bad#>'{changes,0,after,document}')));bad:=jsonb_set(bad,'{events}',pg_temp.e4_events(bad->'changes'));
 select jsonb_build_object('revision',revision,'captures',(select jsonb_agg(payload order by id) from public.captures where user_id=current_setting('e4.user')::uuid),'receipts',(select count(*) from app_private.command_receipts where user_id=current_setting('e4.user')::uuid)) into baseline from app_private.capture_task_revisions where user_id=current_setting('e4.user')::uuid;
 perform pg_temp.e4_error(format('select public.knowledge_commit(%L::uuid,%L::uuid,''knowledge.page.promote-capture'',%L::jsonb)',current_setting('e4.user'),current_setting('e4.session'),bad::text),'23514');
 perform pg_temp.e4_assert(not exists(select 1 from public.knowledge_pages where origin_capture_id=current_setting('e4.a')::uuid));
 perform pg_temp.e4_assert((select jsonb_build_object('revision',revision,'captures',(select jsonb_agg(payload order by id) from public.captures where user_id=current_setting('e4.user')::uuid),'receipts',(select count(*) from app_private.command_receipts where user_id=current_setting('e4.user')::uuid))=baseline from app_private.capture_task_revisions where user_id=current_setting('e4.user')::uuid));
 result:=public.knowledge_commit(current_setting('e4.user')::uuid,current_setting('e4.session')::uuid,'knowledge.page.promote-capture',request);
 perform pg_temp.e4_assert(result=jsonb_build_object('status','committed','result',jsonb_build_object('page',p,'capture_id',b->>'id')));
 perform pg_temp.e4_assert(public.knowledge_commit(current_setting('e4.user')::uuid,current_setting('e4.session')::uuid,'knowledge.page.promote-capture',request)->>'status'='replayed');
 perform pg_temp.e4_assert((select payload->'document'=b->'document' and payload->'document_version'=b->'document_version' from public.captures where id=(b->>'id')::uuid));
 perform pg_temp.e4_assert(app_private.capture_e4_image_holder(current_setting('e4.user')::uuid,current_setting('e4.file')::uuid,(p->>'id')::uuid,true));
 perform pg_temp.e4_assert(public.knowledge_image_read_metadata(current_setting('e4.user')::uuid,current_setting('e4.session')::uuid,(p->>'id')::uuid,current_setting('e4.file')::uuid)->>'page_id'=p->>'id');
 perform pg_temp.e4_error(format('select public.knowledge_image_read_metadata(%L::uuid,%L::uuid,%L::uuid,%L::uuid)',current_setting('e4.other'),current_setting('e4.session'),p->>'id',current_setting('e4.file')),'42501');
 insert into public.user_entitlements(user_id,feature_key,allowed) values(current_setting('e4.user')::uuid,'conhecimento',false) on conflict(user_id,feature_key) do update set allowed=false;
 perform pg_temp.e4_error(format('select public.knowledge_image_read_metadata(%L::uuid,%L::uuid,%L::uuid,%L::uuid)',current_setting('e4.user'),current_setting('e4.session'),p->>'id',current_setting('e4.file')),'42501');
 perform pg_temp.e4_error(format('select public.knowledge_commit(%L::uuid,%L::uuid,''knowledge.page.promote-capture'',%L::jsonb)',current_setting('e4.user'),current_setting('e4.session'),request::text),'42501');
 perform pg_temp.e4_assert(public.file_read_metadata(current_setting('e4.user')::uuid,current_setting('e4.session')::uuid,current_setting('e4.file')::uuid)#>>'{file,id}'=current_setting('e4.file'));
 delete from public.user_entitlements where user_id=current_setting('e4.user')::uuid and feature_key='conhecimento';
 -- Stale before-row cannot overwrite a concurrent Page edit; original CAS wins.
 perform pg_temp.e4_assert(public.knowledge_commit(current_setting('e4.user')::uuid,current_setting('e4.session')::uuid,'knowledge.page.promote-capture',jsonb_set(request,'{receipt,client_id}','"different-stale"'))->>'status'='stale');
end $$;
-- Late promotion B resolves A by ID, preserving all A blocks/marks/checklist.
do $$ declare b jsonb;a jsonb;p jsonb;page_before jsonb;page_after jsonb;old_link jsonb;new_link jsonb;changes jsonb;refs jsonb;request jsonb;begin
 select payload into b from public.captures where id=current_setting('e4.b')::uuid;
 select payload into page_before from public.knowledge_pages where id=current_setting('e4.page_a')::uuid;
 a:=b||jsonb_build_object('status','archived','archived_at','2026-10-22T12:00:00Z','organized_at','2026-10-22T12:00:00Z');
 p:=pg_temp.e4_page(current_setting('e4.page_b'),'B',current_setting('e4.b'),pg_temp.e4_doc(false));
 page_after:=jsonb_set(jsonb_set(page_before,'{document,content,2,content,0,type}','"wikiLink"'),'{document,content,2,content,0,attrs,target_id}',to_jsonb(current_setting('e4.page_b')))||jsonb_build_object('version',2);
 page_after:=jsonb_set(page_after,'{content_text}',to_jsonb(app_private.knowledge_document_text(page_after->'document')));
 select payload into old_link from public.links where user_id=current_setting('e4.user')::uuid and from_id=(page_before->>'id')::uuid and to_type='capture' and to_id=(b->>'id')::uuid;
 new_link:=pg_temp.e4_link(page_before->>'id','page',p->>'id');
 changes:=jsonb_build_array(pg_temp.e4_change('knowledge_page',null,p),pg_temp.e4_change('knowledge_page',page_before,page_after),pg_temp.e4_change('knowledge_link',old_link,old_link||jsonb_build_object('deleted_at','2026-10-22T12:00:00Z')),pg_temp.e4_change('knowledge_link',null,new_link),pg_temp.e4_change('capture',b,a));
 refs:=jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'user_id',current_setting('e4.user'),'page_id',page_before->>'id','target_id',p->>'id','alias','B original','normalized_alias','b original','created_at','2026-10-22T12:00:00Z'));
 request:=pg_temp.e4_promotion(changes,refs,'promote-b',p,b->>'id');
 perform pg_temp.e4_assert(public.knowledge_commit(current_setting('e4.user')::uuid,current_setting('e4.session')::uuid,'knowledge.page.promote-capture',request)->>'status'='committed');
 perform pg_temp.e4_assert((select document->'content'->0=page_before#>'{document,content,0}' and document->'content'->1=page_before#>'{document,content,1}' and document#>>'{content,2,content,0,attrs,target_id}'=p->>'id' and version=2 from public.knowledge_pages where id=(page_before->>'id')::uuid));
 perform pg_temp.e4_assert((select count(*)=1 from public.page_refs where user_id=current_setting('e4.user')::uuid and page_id=(page_before->>'id')::uuid and target_id=(p->>'id')::uuid));
end $$;
-- Holder protects trash/restore and cleanup ACK independently of the Capture.
-- The synthetic physical deletion below isolates this holder; it is privileged
-- fixture setup, not a newly exposed app command to erase a promoted origin.
do $$ declare candidates jsonb;definition text;p jsonb;begin
 definition:=pg_get_functiondef('app_private.knowledge_guard(uuid,uuid,text)'::regprocedure);
 perform pg_temp.e4_assert(strpos(definition,'capture_task_lock(p_user)')>0);
 definition:=pg_get_functiondef('app_private.file_cleanup_candidates()'::regprocedure);
 perform pg_temp.e4_assert(strpos(definition,'capture_task_lock(candidate.user_id)')<strpos(definition,'where r.id=candidate.id for update') and strpos(definition,'not app_private.entity_image_referenced(reservation.user_id,file_row.id)')>0);
 delete from public.capture_file_links where user_id=current_setting('e4.user')::uuid and file_id=current_setting('e4.file')::uuid;
 perform pg_temp.e4_assert(app_private.entity_image_referenced(current_setting('e4.user')::uuid,current_setting('e4.file')::uuid));
 candidates:=public.file_cleanup_candidates();
 perform pg_temp.e4_assert(not exists(select 1 from jsonb_array_elements(candidates) c where c->>'id'=current_setting('e4.file') and (c->>'remove_final')::boolean));
 select payload into p from public.knowledge_pages where id=current_setting('e4.page_a')::uuid;
 update public.knowledge_pages set payload=p||jsonb_build_object('deleted_at','2026-10-22T12:00:00Z','deletion_batch_id',gen_random_uuid(),'version',3) where id=(p->>'id')::uuid;
 perform pg_temp.e4_assert(app_private.entity_image_referenced(current_setting('e4.user')::uuid,current_setting('e4.file')::uuid));
 perform pg_temp.e4_error(format('select public.knowledge_image_read_metadata(%L::uuid,%L::uuid,%L::uuid,%L::uuid)',current_setting('e4.user'),current_setting('e4.session'),p->>'id',current_setting('e4.file')),'42501');
 update public.drive_files set payload=payload||jsonb_build_object('deleted_at','2026-10-22T12:00:00Z','deletion_batch_id',gen_random_uuid()) where user_id=current_setting('e4.user')::uuid and id=current_setting('e4.file')::uuid;
 perform public.file_cleanup_ack(current_setting('e4.file')::uuid);
 perform pg_temp.e4_assert((select purged_at is null from public.drive_files where id=current_setting('e4.file')::uuid));
end $$;
select pg_temp.e4_assert(not has_function_privilege('anon','public.knowledge_image_read_metadata(uuid,uuid,uuid,uuid)','execute') and not has_function_privilege('authenticated','public.knowledge_image_read_metadata(uuid,uuid,uuid,uuid)','execute') and has_function_privilege('service_role','public.knowledge_image_read_metadata(uuid,uuid,uuid,uuid)','execute'));
rollback;
