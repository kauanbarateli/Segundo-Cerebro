-- SPEC-08 #75: prepared, disposable capacity proof; never a remote migration.
-- Run only on the isolated SQL runner after the reviewed draft. No runtime
-- result is implied by this source. Every fixture and helper rolls back.
begin;
set local statement_timeout='90s';
set local lock_timeout='5s';

create function pg_temp.capture_capacity_assert(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Capture event capacity: %',label;end if;end $$;
create temporary table capture_capacity_actors(user_id uuid primary key,session_id uuid not null,capture_id uuid not null);
insert into capture_capacity_actors values(gen_random_uuid(),gen_random_uuid(),gen_random_uuid()),(gen_random_uuid(),gen_random_uuid(),gen_random_uuid());
insert into auth.users(id,aud,role,email,is_anonymous,created_at,updated_at)
 select user_id,'authenticated','authenticated','capture-capacity-'||user_id::text||'@example.invalid',false,now(),now() from capture_capacity_actors;
insert into auth.sessions(id,user_id,created_at,updated_at)
 select session_id,user_id,now(),now() from capture_capacity_actors;
select set_config('capture_capacity.user',user_id::text,true),set_config('capture_capacity.session',session_id::text,true),set_config('capture_capacity.id',capture_id::text,true)
 from capture_capacity_actors order by user_id limit 1;

create function pg_temp.capture_capacity_row() returns jsonb language sql as $$
 select jsonb_build_object('id',current_setting('capture_capacity.id'),'user_id',current_setting('capture_capacity.user'),'client_id','capacity-fixture',
  'project_id',null,'type','note','title','Capacity fixture','content','  literal  ','status','inbox','category_id',null,'converted_task_id',null,
  'captured_at','2026-10-21T12:00:00.000Z','organized_at',null,'archived_at',null,'deleted_at',null,
  'created_at','2026-10-21T12:00:00.000Z','updated_at','2026-10-21T12:00:00.000Z');
$$;
create function pg_temp.capture_capacity_event(b jsonb,a jsonb,action text default 'updated',kind text default 'capture',event_id uuid default gen_random_uuid()) returns jsonb language sql as $$
 select jsonb_build_object('id',event_id,'user_id',current_setting('capture_capacity.user'),'entity_type',kind,'entity_id',current_setting('capture_capacity.id'),
  'action',action,'canal','web','occurred_at','2026-10-21T12:00:00.000Z','before',b,'after',a);
$$;
create function pg_temp.capture_capacity_batch(b jsonb,a jsonb,operation text,client text,action text,expected jsonb default null,event_id uuid default gen_random_uuid()) returns jsonb language plpgsql as $$
declare input jsonb:=jsonb_build_object('id',current_setting('capture_capacity.id'),'client_id',client);
begin
 if expected is not null then input:=input||jsonb_build_object('expected_content',expected,'patch',jsonb_build_object('document',a->'document'));
 elsif operation='capture.update' then input:=input||jsonb_build_object('patch',jsonb_build_object('type',a->'type'));end if;
 return jsonb_build_object('expectedRevision',public.capture_task_revision(current_setting('capture_capacity.user')::uuid,current_setting('capture_capacity.session')::uuid,operation),
  'context',jsonb_build_object('user_id',current_setting('capture_capacity.user'),'canal','web'),
  'changes',jsonb_build_array(jsonb_build_object('type','capture','before',b,'after',a)),
  'events',jsonb_build_array(pg_temp.capture_capacity_event(b,a,action,'capture',event_id)),
  'receipt',jsonb_build_object('user_id',current_setting('capture_capacity.user'),'command',operation,'client_id',client,'fingerprint',input::text,'result',a));
end $$;
create function pg_temp.capture_capacity_commit(operation text,request jsonb) returns jsonb language sql as $$
 select public.capture_task_commit(current_setting('capture_capacity.user')::uuid,current_setting('capture_capacity.session')::uuid,operation,request);
$$;
-- Full physical rows, not just counters. Read AFTER an exception subtransaction
-- to prove rollback of data, events, receipts, CAS, rate limits and file links.
create function pg_temp.capture_capacity_state() returns jsonb language sql as $$
 select jsonb_build_object(
  'captures',(select coalesce(jsonb_agg(to_jsonb(r) order by r.id),'[]'::jsonb) from public.captures r where r.user_id in(select user_id from pg_temp.capture_capacity_actors)),
  'events',(select coalesce(jsonb_agg(to_jsonb(r) order by r.id),'[]'::jsonb) from public.domain_events r where r.user_id in(select user_id from pg_temp.capture_capacity_actors)),
  'receipts',(select coalesce(jsonb_agg(to_jsonb(r) order by r.user_id,r.command,r.client_id),'[]'::jsonb) from app_private.command_receipts r where r.user_id in(select user_id from pg_temp.capture_capacity_actors)),
  'revisions',(select coalesce(jsonb_agg(to_jsonb(r) order by r.user_id),'[]'::jsonb) from app_private.capture_task_revisions r where r.user_id in(select user_id from pg_temp.capture_capacity_actors)),
  'rate_limits',(select coalesce(jsonb_agg(to_jsonb(r) order by r.scope,r.subject_hash),'[]'::jsonb) from app_private.rate_limits r where r.user_id in(select user_id from pg_temp.capture_capacity_actors)),
  'capture_links',(select coalesce(jsonb_agg(to_jsonb(r) order by r.user_id,r.source_id,r.target_id),'[]'::jsonb) from public.capture_links r where r.user_id in(select user_id from pg_temp.capture_capacity_actors)),
  'file_links',(select coalesce(jsonb_agg(to_jsonb(r) order by r.user_id,r.capture_id,r.file_id),'[]'::jsonb) from public.capture_file_links r where r.user_id in(select user_id from pg_temp.capture_capacity_actors)));
$$;
-- Provisioning already emits identity events. Preserve every physical field
-- while counting only the additional Capture writes, without a fixed baseline.
create function pg_temp.capture_capacity_events_match(p_user uuid,p_baseline jsonb,p_capture_count integer) returns boolean language sql as $$
 select count(*)=jsonb_array_length(p_baseline)+p_capture_count
  and count(*) filter(where e.entity_type='capture')=p_capture_count
  and coalesce(jsonb_agg(to_jsonb(e) order by e.id) filter(where e.entity_type is distinct from 'capture'),'[]'::jsonb)=p_baseline
 from public.domain_events e where e.user_id=p_user;
$$;

-- The active event trigger rejects malformed states BEFORE CHECK evaluation.
-- Copy ONLY the installed byte CHECK to a typed temporary table to isolate its
-- physical negative cases. No trigger/FK/RLS/grant is disabled on a real table.
create temporary table capture_capacity_event_probe(like public.domain_events);
create temporary table capture_capacity_catalog(event_trigger_oid oid not null,event_trigger_definition text not null,size_name text not null,size_expression text not null);
do $$ declare size_name text;expression text;matches integer;trigger_oid oid;trigger_definition text;definition text;
begin
 select count(*),min(c.conname::text) into matches,size_name from pg_constraint c
  where c.conrelid='public.domain_events'::regclass and c.contype='c' and c.convalidated
   and strpos(pg_get_expr(c.conbin,c.conrelid),'capture_document_event_pair_allowed(')>0;
 perform pg_temp.capture_capacity_assert(matches=1,'one installed discriminated event CHECK');
 select pg_get_expr(c.conbin,c.conrelid) into expression from pg_constraint c where c.conrelid='public.domain_events'::regclass and c.conname=size_name;
 perform pg_temp.capture_capacity_assert(strpos(expression,'2097152')>0 and strpos(expression,'1048576')>0 and strpos(expression,'IS TRUE')>0,'1MiB/2MiB fail-closed expression');
 perform pg_temp.capture_capacity_assert(not exists(
  select 1 from pg_attribute original join pg_attribute copied on copied.attrelid='pg_temp.capture_capacity_event_probe'::regclass and copied.attname=original.attname and not copied.attisdropped
  where original.attrelid='public.domain_events'::regclass and original.attname=any(array['id','user_id','entity_type','entity_id','action','canal','occurred_at','before','after','capture_task_payload'])
   and not original.attisdropped and (original.atttypid,original.atttypmod,original.attnotnull) is distinct from (copied.atttypid,copied.atttypmod,copied.attnotnull)),'temporary seam preserves field types and nullability');
 perform pg_temp.capture_capacity_assert((select count(*)=10 from pg_attribute where attrelid='pg_temp.capture_capacity_event_probe'::regclass and attname=any(array['id','user_id','entity_type','entity_id','action','canal','occurred_at','before','after','capture_task_payload']) and not attisdropped),'all ten physical inputs copied');
 execute format('alter table pg_temp.capture_capacity_event_probe add constraint %I check (%s)',size_name,expression);
 perform pg_temp.capture_capacity_assert((select pg_get_expr(c.conbin,c.conrelid)=expression from pg_constraint c where c.conrelid='pg_temp.capture_capacity_event_probe'::regclass and c.conname=size_name),'temporary CHECK equals installed expression');
 select t.oid,pg_get_triggerdef(t.oid) into trigger_oid,trigger_definition from pg_trigger t where t.tgrelid='public.domain_events'::regclass and t.tgname='capture_task_event' and not t.tgisinternal and t.tgenabled='O';
 perform pg_temp.capture_capacity_assert(trigger_oid is not null,'real event trigger remains enabled');
 insert into capture_capacity_catalog values(trigger_oid,trigger_definition,size_name,expression);
 perform pg_temp.capture_capacity_assert(not has_function_privilege('service_role','app_private.capture_document_event_pair_allowed(uuid,uuid,text,uuid,text,text,timestamptz,jsonb,jsonb,jsonb)','execute')
  and not has_function_privilege('authenticated','app_private.capture_document_event_pair_allowed(uuid,uuid,text,uuid,text,text,timestamptz,jsonb,jsonb,jsonb)','execute')
  and not has_function_privilege('anon','app_private.capture_document_event_pair_allowed(uuid,uuid,text,uuid,text,text,timestamptz,jsonb,jsonb,jsonb)','execute'),'new predicate has no client grant');
 perform pg_temp.capture_capacity_assert(not has_function_privilege('service_role','app_private.capture_document_event_state(jsonb)','execute')
  and not has_function_privilege('authenticated','app_private.capture_document_event_state(jsonb)','execute')
  and not has_function_privilege('anon','app_private.capture_document_event_state(jsonb)','execute'),'historical state helper has no client grant');
 perform pg_temp.capture_capacity_assert((select bool_and(provolatile='i' and not prosecdef) and count(*)=2 from pg_proc
  where oid in('app_private.capture_document_event_state(jsonb)'::regprocedure,'app_private.capture_document_event_pair_allowed(uuid,uuid,text,uuid,text,text,timestamptz,jsonb,jsonb,jsonb)'::regprocedure)),'capacity validators are immutable/invoker');
 perform pg_temp.capture_capacity_assert(app_private.capture_document_event_pair_allowed(null,null,null,null,null,null,null,null,null,null) is false,'predicate is total for SQL NULL');
 select pg_get_functiondef('app_private.capture_task_commit(uuid,uuid,text,jsonb)'::regprocedure) into definition;
 perform pg_temp.capture_capacity_assert(strpos(definition,'octet_length(p_request::text)>8388608')>0 and strpos(definition,'octet_length((r->''result'')::text)>1048576')>0,'batch and result limits unchanged');
 select pg_get_functiondef('app_private.capture_task_snapshot(uuid,uuid,text)'::regprocedure) into definition;
 perform pg_temp.capture_capacity_assert(strpos(definition,'octet_length(result::text)>8388608')>0,'snapshot limit unchanged');
end $$;

create temporary table capture_capacity_document(document jsonb not null,cache text not null);
do $$ declare nodes jsonb;doc jsonb;filler integer;cache text;
begin
 select jsonb_agg(jsonb_build_object('type','text','text','x','marks',jsonb_build_array(jsonb_build_object('type','link','attrs',jsonb_build_object('href','https://example.invalid/'||repeat('a',2024))))) order by i)
  into nodes from generate_series(1,243) i;
 doc:=jsonb_build_object('type','doc','content',jsonb_build_array(jsonb_build_object('type','paragraph','content',nodes||jsonb_build_array(jsonb_build_object('type','text','text','')))));
 filler:=(524288-app_private.capture_document_compact_bytes(doc))::integer;
 perform pg_temp.capture_capacity_assert(filler=8800,'analytical filler confirmed by SQL compact size');
 doc:=jsonb_set(doc,'{content,0,content,243,text}',to_jsonb(repeat('z',filler)));
 cache:=nullif(app_private.capture_document_trim(app_private.knowledge_document_text(doc)),'');
 perform pg_temp.capture_capacity_assert(app_private.capture_document_compact_bytes(doc)=524288 and octet_length(doc::text)=526727,'exact compact/JSONB document budgets');
 perform pg_temp.capture_capacity_assert(app_private.capture_document_utf16_length(cache)=9043,'cache budget');
 insert into capture_capacity_document values(doc,cache);
end $$;

-- Real RPC/table proof: upgrade, same-document resave, metadata and replay.
-- This fixture uses the privileged SQL-runner role for setup/inspection; the
-- RPC itself still checks the synthetic actor/session. It is not an ACL test.
insert into public.captures(payload) values(pg_temp.capture_capacity_row());
do $$ declare legacy jsonb:=pg_temp.capture_capacity_row();doc jsonb;cache text;rich1 jsonb;rich2 jsonb;rich3 jsonb;metadata jsonb;
 upgrade_request jsonb;resave_request jsonb;request jsonb;metrics jsonb;response jsonb;state_before jsonb;snapshot_before jsonb;
 revision_after_upgrade text;revision_before text;actual text;violated text;rejected boolean:=false;snapshot_bytes bigint;size_constraint text;historical_event jsonb;provision_events jsonb;
begin
 select coalesce(jsonb_agg(to_jsonb(e) order by e.id),'[]'::jsonb) into provision_events
  from public.domain_events e where e.user_id=current_setting('capture_capacity.user')::uuid;
 perform pg_temp.capture_capacity_assert(not exists(select 1 from public.domain_events where user_id=current_setting('capture_capacity.user')::uuid and entity_type='capture'),'upgrade fixture starts with no Capture events');
 select document,d.cache into doc,cache from capture_capacity_document d;
 rich1:=legacy||jsonb_build_object('document',doc,'document_version',1,'content',cache);
 rich2:=rich1||jsonb_build_object('document_version',2);
 perform app_private.capture_task_validate_payload('capture',rich1);perform app_private.capture_task_validate_payload('capture',rich2);
 upgrade_request:=pg_temp.capture_capacity_batch(legacy,rich1,'capture.update','capacity-upgrade','updated',jsonb_build_object('kind','legacy','content',legacy->'content'));
 perform pg_temp.capture_capacity_assert(octet_length(legacy::text)+octet_length(rich1::text)<=1048576,'first event fits historical pair cap');
 perform pg_temp.capture_capacity_assert(pg_temp.capture_capacity_commit('capture.update',upgrade_request)=jsonb_build_object('status','committed','result',rich1),'legacy upgrade commits exact result');
 perform pg_temp.capture_capacity_assert((select payload=rich1 from public.captures where id=current_setting('capture_capacity.id')::uuid),'upgrade document/cache stored intact');
 perform pg_temp.capture_capacity_assert((select id=(upgrade_request#>>'{events,0,id}')::uuid and user_id=current_setting('capture_capacity.user')::uuid
  and entity_type='capture' and entity_id=current_setting('capture_capacity.id')::uuid and "before"=legacy and "after"=rich1 and capture_task_payload=upgrade_request#>'{events,0}'
  from public.domain_events where id=(upgrade_request#>>'{events,0,id}')::uuid),'upgrade event holds exact id/owner/states/envelope');
 perform pg_temp.capture_capacity_assert(pg_temp.capture_capacity_events_match(current_setting('capture_capacity.user')::uuid,provision_events,1),'one upgrade event preserves every provisioning event');
 perform pg_temp.capture_capacity_assert((select count(*)=1 from app_private.command_receipts where user_id=current_setting('capture_capacity.user')::uuid),'one upgrade receipt');
 revision_after_upgrade:=public.capture_task_revision(current_setting('capture_capacity.user')::uuid,current_setting('capture_capacity.session')::uuid,'capture.update');
 -- Build only AFTER the upgrade: current CAS, fresh event ID and client ID.
 resave_request:=pg_temp.capture_capacity_batch(rich1,rich2,'capture.update','capacity-resave','updated',jsonb_build_object('kind','rich','document_version',1));
 perform pg_temp.capture_capacity_assert(resave_request->>'expectedRevision'=revision_after_upgrade and resave_request->>'expectedRevision'<>upgrade_request->>'expectedRevision','resave uses current CAS');
 perform pg_temp.capture_capacity_assert(resave_request#>>'{events,0,id}'<>upgrade_request#>>'{events,0,id}','resave event ID is fresh');
 metrics:=jsonb_build_object(
  'document_compact_bytes',app_private.capture_document_compact_bytes(doc),'document_jsonb_bytes',octet_length(doc::text),
  'cache_utf16',app_private.capture_document_utf16_length(cache),'cache_jsonb_bytes',octet_length(to_jsonb(cache)::text),
  'metadata_base_bytes',octet_length((rich1-array['document','document_version','content'])::text),
  'payload1_bytes',octet_length(rich1::text),'payload2_bytes',octet_length(rich2::text),
  'residual_fields_structure_bytes',octet_length(rich1::text)-octet_length(doc::text)-octet_length(to_jsonb(cache)::text),
  'upgrade_pair_bytes',octet_length(legacy::text)+octet_length(rich1::text),'resave_pair_bytes',octet_length(rich1::text)+octet_length(rich2::text),
  'upgrade_envelope_bytes',octet_length(upgrade_request::text),'resave_envelope_bytes',octet_length(resave_request::text),
  'event_envelope_bytes',octet_length((resave_request#>'{events,0}')::text),
  'upgrade_receipt_request_bytes',octet_length((upgrade_request#>'{receipt,fingerprint}')::text),'receipt_request_bytes',octet_length((resave_request#>'{receipt,fingerprint}')::text),
  'upgrade_result_bytes',octet_length((upgrade_request#>'{receipt,result}')::text),'result_bytes',octet_length((resave_request#>'{receipt,result}')::text));
 raise notice 'Capture event capacity metrics: %',metrics;
 perform pg_temp.capture_capacity_assert((metrics->>'payload1_bytes')::bigint<=1048576 and (metrics->>'payload2_bytes')::bigint<=1048576,'individual payload caps unchanged');
 perform pg_temp.capture_capacity_assert((metrics->>'resave_pair_bytes')::bigint>1048576 and (metrics->>'resave_pair_bytes')::bigint<=2097152,'real pair requires only narrow exception');
 perform pg_temp.capture_capacity_assert((metrics->>'upgrade_envelope_bytes')::bigint<=8388608 and (metrics->>'resave_envelope_bytes')::bigint<=8388608,'both batch envelopes fit 8MiB');
 perform pg_temp.capture_capacity_assert((metrics->>'upgrade_receipt_request_bytes')::bigint<=1048576 and (metrics->>'receipt_request_bytes')::bigint<=1048576,'receipt exception is not needed for this case');
 perform pg_temp.capture_capacity_assert((metrics->>'upgrade_result_bytes')::bigint<=1048576 and (metrics->>'result_bytes')::bigint<=1048576,'results remain within 1MiB');
 perform pg_temp.capture_capacity_assert(pg_temp.capture_capacity_commit('capture.update',resave_request)=jsonb_build_object('status','committed','result',rich2),'same-document resave advances once');
 perform pg_temp.capture_capacity_assert((select payload=rich2 from public.captures where id=current_setting('capture_capacity.id')::uuid),'resave row exact');
 perform pg_temp.capture_capacity_assert((select "before"=rich1 and "after"=rich2 and capture_task_payload=resave_request#>'{events,0}' from public.domain_events where id=(resave_request#>>'{events,0,id}')::uuid),'real event holds exact states/envelope');
 perform pg_temp.capture_capacity_assert((select request=resave_request#>'{receipt,fingerprint}' and result=rich2 and octet_length(request::text)<=1048576 from app_private.command_receipts where user_id=current_setting('capture_capacity.user')::uuid and command='capture.update' and client_id='capacity-resave'),'real receipt stays within ordinary cap');
 perform pg_temp.capture_capacity_assert(pg_temp.capture_capacity_events_match(current_setting('capture_capacity.user')::uuid,provision_events,2) and (select count(*)=2 from app_private.command_receipts where user_id=current_setting('capture_capacity.user')::uuid),'two writes, two events/receipts preserve provisioning');
 snapshot_bytes:=octet_length(public.capture_task_snapshot(current_setting('capture_capacity.user')::uuid,current_setting('capture_capacity.session')::uuid,'read.captures')::text);
 raise notice 'Capture snapshot after resave bytes: %',snapshot_bytes;
 perform pg_temp.capture_capacity_assert(snapshot_bytes<=8388608,'resave snapshot fits existing limit');

 -- Failure AFTER capture DML: reuse an existing event primary key. Assert the
 -- exact failure, then compare full state OUTSIDE the exception subtransaction.
 rich3:=rich2||jsonb_build_object('document_version',3);
 request:=pg_temp.capture_capacity_batch(rich2,rich3,'capture.update','capacity-rollback','updated',jsonb_build_object('kind','rich','document_version',2),(upgrade_request#>>'{events,0,id}')::uuid);
 state_before:=pg_temp.capture_capacity_state();snapshot_before:=public.capture_task_snapshot(current_setting('capture_capacity.user')::uuid,current_setting('capture_capacity.session')::uuid,'read.captures');
 revision_before:=public.capture_task_revision(current_setting('capture_capacity.user')::uuid,current_setting('capture_capacity.session')::uuid,'capture.update');
 begin response:=pg_temp.capture_capacity_commit('capture.update',request);
 exception when others then
  get stacked diagnostics actual=returned_sqlstate,violated=constraint_name;
  if actual is distinct from '23505' or violated is distinct from 'domain_events_pkey' then raise exception 'Unexpected rollback failure: %, constraint %',actual,violated;end if;
  rejected:=true;
 end;
 perform pg_temp.capture_capacity_assert(rejected,'duplicate event must reject after data write');
 perform pg_temp.capture_capacity_assert(pg_temp.capture_capacity_state()=state_before,'data/events/receipts/revision/rate/file-links rolled back');
 perform pg_temp.capture_capacity_assert(public.capture_task_snapshot(current_setting('capture_capacity.user')::uuid,current_setting('capture_capacity.session')::uuid,'read.captures')=snapshot_before,'snapshot unchanged after rollback');
 perform pg_temp.capture_capacity_assert(public.capture_task_revision(current_setting('capture_capacity.user')::uuid,current_setting('capture_capacity.session')::uuid,'capture.update')=revision_before,'CAS unchanged after rollback');
 perform pg_temp.capture_capacity_assert(public.capture_task_receipt(current_setting('capture_capacity.user')::uuid,current_setting('capture_capacity.session')::uuid,'capture.update','capture.update','capacity-rollback') is null,'failed write has no receipt');

 metadata:=rich2||jsonb_build_object('type','idea');
 -- A valid metadata row/envelope with an incompatible action reaches the new
 -- physical CHECK after Capture DML; distinguish it from the PK case above.
 request:=pg_temp.capture_capacity_batch(rich2,metadata,'capture.update','capacity-check-rollback','deleted');
 state_before:=pg_temp.capture_capacity_state();rejected:=false;
 select size_name into size_constraint from capture_capacity_catalog;
 begin response:=pg_temp.capture_capacity_commit('capture.update',request);
 exception when others then
  get stacked diagnostics actual=returned_sqlstate,violated=constraint_name;
  if actual is distinct from '23514' or violated is distinct from size_constraint then raise exception 'Unexpected capacity rollback failure: %, constraint %',actual,violated;end if;
  rejected:=true;
 end;
 perform pg_temp.capture_capacity_assert(rejected,'incompatible event action must reach/reject physical capacity CHECK');
 perform pg_temp.capture_capacity_assert(pg_temp.capture_capacity_state()=state_before,'capacity CHECK failure rolls back every physical row/ledger');
 perform pg_temp.capture_capacity_assert(public.capture_task_snapshot(current_setting('capture_capacity.user')::uuid,current_setting('capture_capacity.session')::uuid,'read.captures')=snapshot_before,'capacity failure preserves snapshot/CAS');
 perform pg_temp.capture_capacity_assert(public.capture_task_receipt(current_setting('capture_capacity.user')::uuid,current_setting('capture_capacity.session')::uuid,'capture.update','capture.update','capacity-check-rollback') is null,'capacity failure leaves no receipt');

 request:=pg_temp.capture_capacity_batch(rich2,metadata,'capture.update','capacity-metadata','updated');
 perform pg_temp.capture_capacity_assert(pg_temp.capture_capacity_commit('capture.update',request)=jsonb_build_object('status','committed','result',metadata),'metadata command preserves rich state');
 perform pg_temp.capture_capacity_assert((select payload=metadata from public.captures where id=current_setting('capture_capacity.id')::uuid),'metadata stored with same document/revision');
 snapshot_bytes:=octet_length(public.capture_task_snapshot(current_setting('capture_capacity.user')::uuid,current_setting('capture_capacity.session')::uuid,'read.captures')::text);
 raise notice 'Capture snapshot after metadata bytes: %',snapshot_bytes;
 perform pg_temp.capture_capacity_assert(snapshot_bytes<=8388608,'metadata snapshot fits existing limit');

 -- Confirm a later revision with a SMALL document, conserving the global
 -- snapshot cap. The original v1->v2 historical event must still validate
 -- independently of the current Capture (which now differs from both states).
 rich3:=metadata||jsonb_build_object('document','{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Later document"}]}]}'::jsonb,'document_version',3,'content','Later document');
 request:=pg_temp.capture_capacity_batch(metadata,rich3,'capture.update','capacity-continuation','updated',jsonb_build_object('kind','rich','document_version',2));
 perform pg_temp.capture_capacity_assert(pg_temp.capture_capacity_commit('capture.update',request)=jsonb_build_object('status','committed','result',rich3),'later revision 3 commits');
 perform pg_temp.capture_capacity_assert((select payload=rich3 and payload is distinct from rich1 and payload is distinct from rich2 from public.captures where id=current_setting('capture_capacity.id')::uuid),'current state differs from both historical states');
 snapshot_bytes:=octet_length(public.capture_task_snapshot(current_setting('capture_capacity.user')::uuid,current_setting('capture_capacity.session')::uuid,'read.captures')::text);
 raise notice 'Capture snapshot after continuation bytes: %',snapshot_bytes;
 perform pg_temp.capture_capacity_assert(snapshot_bytes<=8388608,'small continuation preserves 8MiB snapshot cap');
 historical_event:=(resave_request#>'{events,0}')||jsonb_build_object('id',gen_random_uuid());
 state_before:=pg_temp.capture_capacity_state();
 begin
  insert into public.domain_events(id,user_id,entity_type,entity_id,action,canal,occurred_at,"before","after",capture_task_payload)
   values((historical_event->>'id')::uuid,(historical_event->>'user_id')::uuid,'capture',(historical_event->>'entity_id')::uuid,'updated','web',(historical_event->>'occurred_at')::timestamptz,historical_event->'before',historical_event->'after',historical_event);
  perform pg_temp.capture_capacity_assert((select "before"=rich1 and "after"=rich2 and capture_task_payload=historical_event from public.domain_events where id=(historical_event->>'id')::uuid),'historical pair reinserted with real trigger/CHECK at current v3');
  raise exception 'Historical event accepted; rollback fixture.' using errcode='ZX003';
 exception when sqlstate 'ZX003' then null;
 end;
 perform pg_temp.capture_capacity_assert(pg_temp.capture_capacity_state()=state_before,'historical reinsert and revision trigger fully rolled back');
 state_before:=pg_temp.capture_capacity_state();
 perform pg_temp.capture_capacity_assert(pg_temp.capture_capacity_commit('capture.update',upgrade_request)=jsonb_build_object('status','replayed','result',rich1),'old upgrade replays original result before CAS');
 perform pg_temp.capture_capacity_assert(pg_temp.capture_capacity_state()=state_before,'replay changes no physical state');
end $$;

-- A second synthetic owner keeps lifecycle history below the unchanged 8MiB
-- snapshot cap. This is fixture setup, not a new rich-creation command.
select set_config('capture_capacity.user',user_id::text,true),set_config('capture_capacity.session',session_id::text,true),set_config('capture_capacity.id',capture_id::text,true)
 from capture_capacity_actors order by user_id desc limit 1;
insert into public.captures(payload)
 select pg_temp.capture_capacity_row()||jsonb_build_object('document',document,'document_version',1,'content',cache) from capture_capacity_document;
do $$ declare current_row jsonb;next_row jsonb;request jsonb;operation text;action text;step integer;snapshot_bytes bigint;provision_events jsonb;
begin
 select coalesce(jsonb_agg(to_jsonb(e) order by e.id),'[]'::jsonb) into provision_events
  from public.domain_events e where e.user_id=current_setting('capture_capacity.user')::uuid;
 perform pg_temp.capture_capacity_assert(not exists(select 1 from public.domain_events where user_id=current_setting('capture_capacity.user')::uuid and entity_type='capture'),'lifecycle fixture starts with no Capture events');
 select payload into current_row from public.captures where id=current_setting('capture_capacity.id')::uuid;
 for step in 1..4 loop
  if step=1 then operation:='capture.archive';action:='status_changed';next_row:=current_row||jsonb_build_object('status','archived','archived_at','2026-10-21T12:01:00.000Z');
  elsif step=2 then operation:='capture.unarchive';action:='status_changed';next_row:=current_row||jsonb_build_object('status','inbox','archived_at',null);
  elsif step=3 then operation:='capture.delete';action:='deleted';next_row:=current_row||jsonb_build_object('deleted_at','2026-10-21T12:02:00.000Z');
  else operation:='capture.restore';action:='restored';next_row:=current_row||jsonb_build_object('deleted_at',null);end if;
  request:=pg_temp.capture_capacity_batch(current_row,next_row,operation,'capacity-lifecycle-'||step::text,action);
  perform pg_temp.capture_capacity_assert(octet_length(current_row::text)+octet_length(next_row::text)>1048576,'lifecycle uses rich pair exception');
  perform pg_temp.capture_capacity_assert(octet_length((request#>'{receipt,fingerprint}')::text)<=1048576 and octet_length((request#>'{receipt,result}')::text)<=1048576,'lifecycle ordinary receipt/result caps');
  perform pg_temp.capture_capacity_assert(pg_temp.capture_capacity_commit(operation,request)=jsonb_build_object('status','committed','result',next_row),'lifecycle command commits exact result');
  perform pg_temp.capture_capacity_assert((select payload=next_row from public.captures where id=current_setting('capture_capacity.id')::uuid),'lifecycle persists exact document/revision/cache');
  perform pg_temp.capture_capacity_assert((select "before"=current_row and "after"=next_row and capture_task_payload=request#>'{events,0}' from public.domain_events where id=(request#>>'{events,0,id}')::uuid),'lifecycle event matches physical states');
  snapshot_bytes:=octet_length(public.capture_task_snapshot(current_setting('capture_capacity.user')::uuid,current_setting('capture_capacity.session')::uuid,'read.captures')::text);
  raise notice 'Capture lifecycle step % snapshot bytes: %',step,snapshot_bytes;
  perform pg_temp.capture_capacity_assert(snapshot_bytes<=8388608,'isolated lifecycle snapshot fits existing cap');
  current_row:=next_row;
 end loop;
 perform pg_temp.capture_capacity_assert(pg_temp.capture_capacity_events_match(current_setting('capture_capacity.user')::uuid,provision_events,4) and (select count(*)=4 from app_private.command_receipts where user_id=current_setting('capture_capacity.user')::uuid),'lifecycle exactly four events/receipts preserves provisioning');
end $$;

-- Each accepted/rejected INSERT and UPDATE on the temporary physical seam is
-- rolled back in its own subtransaction. Require the precise size CHECK name.
create function pg_temp.capture_capacity_probe(row_event jsonb,reject boolean,update_mode boolean,label text) returns void language plpgsql as $$
declare actual text;violated text;expected_constraint text;
begin
 select size_name into expected_constraint from capture_capacity_catalog;
 begin
  if update_mode then
   insert into pg_temp.capture_capacity_event_probe(id,user_id,entity_type,entity_id,action,canal,occurred_at,"before","after",capture_task_payload)
    values((row_event->>'id')::uuid,(row_event->>'user_id')::uuid,'capture',(row_event->>'entity_id')::uuid,'updated','web','2026-10-21T12:00:00Z','{}'::jsonb,'{}'::jsonb,null);
   update pg_temp.capture_capacity_event_probe set id=(row_event->>'id')::uuid,user_id=(row_event->>'user_id')::uuid,entity_type=row_event->>'entity_type',entity_id=(row_event->>'entity_id')::uuid,
    action=row_event->>'action',canal=row_event->>'canal',occurred_at=(row_event->>'occurred_at')::timestamptz,"before"=row_event->'before',"after"=row_event->'after',capture_task_payload=row_event->'capture_task_payload';
  else
   insert into pg_temp.capture_capacity_event_probe(id,user_id,entity_type,entity_id,action,canal,occurred_at,"before","after",capture_task_payload)
    values((row_event->>'id')::uuid,(row_event->>'user_id')::uuid,row_event->>'entity_type',(row_event->>'entity_id')::uuid,row_event->>'action',row_event->>'canal',(row_event->>'occurred_at')::timestamptz,row_event->'before',row_event->'after',row_event->'capture_task_payload');
  end if;
  raise exception 'Accepted physical capacity probe; rollback.' using errcode='ZX002';
 exception when sqlstate 'ZX002' then
  if reject then raise exception 'Expected physical size rejection: %',label;end if;
 when others then
  get stacked diagnostics actual=returned_sqlstate,violated=constraint_name;
  if not reject or actual is distinct from '23514' or violated is distinct from expected_constraint then raise exception 'Unexpected physical probe %: %, constraint %',label,actual,violated;end if;
 end;
 perform pg_temp.capture_capacity_assert(not exists(select 1 from pg_temp.capture_capacity_event_probe),label||': temporary probe rolled back');
end $$;
create function pg_temp.capture_capacity_physical(b jsonb,a jsonb,action text default 'updated',kind text default 'capture') returns jsonb language sql as $$
 select e||jsonb_build_object('capture_task_payload',e) from(select pg_temp.capture_capacity_event(b,a,action,kind) e) fixture;
$$;

do $$ declare base jsonb:=pg_temp.capture_capacity_row();doc jsonb;cache text;rich1 jsonb;rich2 jsonb;bad jsonb;pair jsonb;event jsonb;large_legacy jsonb;links jsonb;
 update_mode boolean;size_boundary jsonb;size_over jsonb;padded jsonb;state_before jsonb:=pg_temp.capture_capacity_state();attachment jsonb;bad_attachments jsonb;
begin
 select document,d.cache into doc,cache from capture_capacity_document d;
 rich1:=base||jsonb_build_object('document',doc,'document_version',1,'content',cache);rich2:=rich1||jsonb_build_object('document_version',2);
 -- Valid legacy states can exceed 1MiB as a PAIR through escaped control text
 -- plus reference metadata. They must not receive the documentary exception.
 select jsonb_agg(to_jsonb('00000000-0000-4000-8000-'||lpad(i::text,12,'0')) order by i) into links from generate_series(1,9000) i;
 large_legacy:=base||jsonb_build_object('content',repeat(chr(1),30000),'linked_capture_ids',links);
 perform app_private.capture_task_validate_payload('capture',large_legacy);
 perform pg_temp.capture_capacity_assert(octet_length(large_legacy::text)<=1048576 and 2*octet_length(large_legacy::text)>1048576,'valid legacy pair exceeds historical cap');
 size_boundary:=jsonb_build_object('padding','');
 size_boundary:=jsonb_build_object('padding',repeat('x',1048576-octet_length(size_boundary::text)));
 size_over:=jsonb_set(size_boundary,'{padding}',to_jsonb((size_boundary->>'padding')||'x'));
 perform pg_temp.capture_capacity_assert(octet_length(size_boundary::text)=1048576 and octet_length(size_over::text)=1048577,'exact ordinary physical byte boundaries');
 attachment:=jsonb_build_object('id',gen_random_uuid(),'name','Historical image','mime','image/png','width',1.0::numeric,'height',1.0::numeric,'bytes',1.0::numeric);
 perform pg_temp.capture_capacity_assert(not exists(select 1 from public.drive_files where id=(attachment->>'id')::uuid),'historical DTO deliberately has no current file lookup target');
 foreach update_mode in array array[false,true] loop
  perform pg_temp.capture_capacity_probe(pg_temp.capture_capacity_physical(rich1,rich2),false,update_mode,'valid rich pair above 1MiB');
  perform pg_temp.capture_capacity_probe(pg_temp.capture_capacity_physical(rich1||jsonb_build_object('attachments',jsonb_build_array(attachment)),rich2||jsonb_build_object('attachments',jsonb_build_array(attachment))),false,update_mode,'historical attachment DTO is valid independently of current file catalogue');
  for bad_attachments in select value from jsonb_array_elements(jsonb_build_array(
   'null'::jsonb,jsonb_build_array(attachment,attachment),jsonb_build_array(attachment,attachment,attachment,attachment,attachment,attachment,attachment),
   jsonb_build_array(attachment-'mime'),jsonb_build_array(attachment||'{"extra":true}'::jsonb),
   jsonb_build_array(attachment||'{"id":"AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA"}'::jsonb),
   jsonb_build_array(attachment||jsonb_build_object('name',U&'\00A0\FEFF')),
   jsonb_build_array(attachment||jsonb_build_object('name',repeat(U&'\+01F600',101))),
   jsonb_build_array(attachment||'{"mime":5}'::jsonb),jsonb_build_array(attachment||'{"width":"1"}'::jsonb),
   jsonb_build_array(attachment||'{"width":0}'::jsonb),jsonb_build_array(attachment||'{"width":1.5}'::jsonb),
   jsonb_build_array(attachment||'{"width":9007199254740992}'::jsonb),jsonb_build_array(attachment||'{"width":6000,"height":4001}'::jsonb),
   jsonb_build_array(attachment||'{"bytes":8388609}'::jsonb)
  )) loop
   perform pg_temp.capture_capacity_probe(pg_temp.capture_capacity_physical(rich1||jsonb_build_object('attachments',bad_attachments),rich2||jsonb_build_object('attachments',bad_attachments)),true,update_mode,'invalid historical attachment DTO');
  end loop;
  event:=pg_temp.capture_capacity_physical(size_boundary,null,'updated','profile')-'after';
  perform pg_temp.capture_capacity_probe(event,false,update_mode,'ordinary pair exactly 1MiB');
  event:=pg_temp.capture_capacity_physical(size_over,null,'updated','profile')-'after';
  perform pg_temp.capture_capacity_probe(event,true,update_mode,'ordinary pair over 1MiB');
  perform pg_temp.capture_capacity_probe(pg_temp.capture_capacity_physical(large_legacy,large_legacy),true,update_mode,'valid legacy pair over 1MiB');
  pair:=pg_temp.capture_capacity_physical(rich1,rich2);
  perform pg_temp.capture_capacity_probe(pair||jsonb_build_object('entity_type','task'),true,update_mode,'foreign entity cannot claim Capture exception');
  perform pg_temp.capture_capacity_probe(pair||jsonb_build_object('entity_id',gen_random_uuid()),true,update_mode,'physical entity ID mismatch');
  perform pg_temp.capture_capacity_probe(pair||jsonb_build_object('user_id',gen_random_uuid()),true,update_mode,'physical owner mismatch');
  perform pg_temp.capture_capacity_probe(pair||jsonb_build_object('id',gen_random_uuid()),true,update_mode,'physical event ID mismatch');
  perform pg_temp.capture_capacity_probe(pair||jsonb_build_object('canal','api'),true,update_mode,'physical channel mismatch');
  perform pg_temp.capture_capacity_probe(pair||jsonb_build_object('occurred_at','2026-10-21T12:00:01.000Z'),true,update_mode,'physical timestamp mismatch');
  perform pg_temp.capture_capacity_probe(pair||jsonb_build_object('capture_task_payload',null),true,update_mode,'JSON-null envelope');
  perform pg_temp.capture_capacity_probe(pair-'capture_task_payload',true,update_mode,'SQL-null envelope');
  perform pg_temp.capture_capacity_probe(jsonb_set(pair,'{capture_task_payload,extra}','true'),true,update_mode,'mixed envelope');
  for bad in select value from jsonb_array_elements(jsonb_build_array(
   rich2-'document_version',rich2||'{"document_version":0}'::jsonb,rich2||'{"document_version":9}'::jsonb,
   rich2||'{"content":"forged"}'::jsonb,rich2||'{"client_id":"changed"}'::jsonb,rich2||'{"title":"changed"}'::jsonb,
   rich2||'{"created_at":"2026-10-21T12:00:01.000Z"}'::jsonb,rich2||'{"captured_at":"2026-10-21T12:00:01.000Z"}'::jsonb,
   rich2||jsonb_build_object('id',gen_random_uuid()),rich2||jsonb_build_object('user_id',gen_random_uuid()),
   jsonb_set(rich2,'{document,content,0,content,0,text}','"y"')||jsonb_build_object('content','y'||substr(cache,2),'document_version',1)
  )) loop
   perform pg_temp.capture_capacity_assert(octet_length(rich1::text)+octet_length(bad::text)>1048576,'invalid pair exercises exception branch');
   perform pg_temp.capture_capacity_probe(pg_temp.capture_capacity_physical(rich1,bad),true,update_mode,'invalid state/immutable/revision/cache');
  end loop;
  perform pg_temp.capture_capacity_probe(pg_temp.capture_capacity_physical(rich2,rich1),true,update_mode,'document revision cannot move backwards');
  perform pg_temp.capture_capacity_probe(pg_temp.capture_capacity_physical(rich1,rich2,'status_changed'),true,update_mode,'lifecycle cannot advance document revision');
  perform pg_temp.capture_capacity_probe(pg_temp.capture_capacity_physical(rich1,rich1||'{"deleted_at":"2026-10-21T12:03:00.000Z"}'::jsonb),true,update_mode,'updated cannot perform delete');
  perform pg_temp.capture_capacity_probe(pg_temp.capture_capacity_physical(rich1,rich1,'restored'),true,update_mode,'restore requires deleted before state');
  padded:=rich2||jsonb_build_object('padding',repeat('x',1048576));
  perform pg_temp.capture_capacity_assert(octet_length(rich1::text)+octet_length(padded::text)>2097152,'over-2MiB pair fixture');
  perform pg_temp.capture_capacity_probe(pg_temp.capture_capacity_physical(rich1,padded),true,update_mode,'pair over 2MiB');
  padded:=rich2||jsonb_build_object('padding',repeat('x',550000));
  perform pg_temp.capture_capacity_assert(octet_length(padded::text)>1048576 and octet_length(rich1::text)+octet_length(padded::text)<=2097152,'individual cap fixture isolated from pair cap');
  perform pg_temp.capture_capacity_probe(pg_temp.capture_capacity_physical(rich1,padded),true,update_mode,'individual state over 1MiB');
  event:=pg_temp.capture_capacity_physical(null,padded)-'before';
  perform pg_temp.capture_capacity_probe(event,true,update_mode,'SQL-null before cannot grant exception');
  perform pg_temp.capture_capacity_probe(pg_temp.capture_capacity_physical('null'::jsonb,padded),true,update_mode,'JSON-null before cannot grant exception');
  event:=pg_temp.capture_capacity_physical(padded,null)-'after';
  perform pg_temp.capture_capacity_probe(event,true,update_mode,'SQL-null after cannot grant exception');
  perform pg_temp.capture_capacity_probe(pg_temp.capture_capacity_physical(padded,'null'::jsonb),true,update_mode,'JSON-null after cannot grant exception');
 end loop;
 -- A null document shrinks this pair BELOW 1MiB, so it is not a physical
 -- capacity negative. Assert denial by the predicate; the unchanged active
 -- event/payload validator remains responsible for malformed small events.
 event:=pg_temp.capture_capacity_event(rich1,rich2||'{"document":null}'::jsonb);
 perform pg_temp.capture_capacity_assert(app_private.capture_document_event_pair_allowed((event->>'id')::uuid,(event->>'user_id')::uuid,'capture',(event->>'entity_id')::uuid,'updated','web',(event->>'occurred_at')::timestamptz,event->'before',event->'after',event) is false,'null document cannot claim capacity exception');
 perform pg_temp.capture_capacity_assert(pg_temp.capture_capacity_state()=state_before,'temporary physical probes leave all real rows/ledgers unchanged');
end $$;

do $$ begin
 perform pg_temp.capture_capacity_assert((select t.oid=c.event_trigger_oid and pg_get_triggerdef(t.oid)=c.event_trigger_definition and t.tgenabled='O'
  from pg_trigger t cross join capture_capacity_catalog c where t.tgrelid='public.domain_events'::regclass and t.tgname='capture_task_event' and not t.tgisinternal),'real trigger OID/body/enabled state preserved');
 perform pg_temp.capture_capacity_assert((select pg_get_expr(p.conbin,p.conrelid)=c.size_expression
  from pg_constraint p cross join capture_capacity_catalog c where p.conrelid='public.domain_events'::regclass and p.conname=c.size_name),'installed CHECK unchanged by temporary probes');
end $$;
rollback;
