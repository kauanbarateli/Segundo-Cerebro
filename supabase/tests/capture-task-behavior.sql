-- T015 behaviour assertions; prepared for supervised execution, NOT run here.
-- Existing accounts are allowed. Only random synthetic IDs are touched, no passwords.
-- Never change ROLLBACK to COMMIT. No fixtures persist; no SQL runs from CI/build.
begin;
set local statement_timeout='60s';
set local lock_timeout='5s';
select set_config('t015.user_a',gen_random_uuid()::text,true),set_config('t015.user_b',gen_random_uuid()::text,true),
  set_config('t015.session_a',gen_random_uuid()::text,true),set_config('t015.session_b',gen_random_uuid()::text,true),
  set_config('t015.capture',gen_random_uuid()::text,true),set_config('t015.task',gen_random_uuid()::text,true),
  set_config('t015.project',gen_random_uuid()::text,true),set_config('t015.category',gen_random_uuid()::text,true);
create function pg_temp.assert_true(ok boolean,message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'T015: %',message; end if; end $$;
create function pg_temp.expect_error(command text,expected_state text) returns void language plpgsql security invoker as $$
declare actual text; begin
  begin execute command;
  exception when others then get stacked diagnostics actual=returned_sqlstate;
    if actual<>expected_state then raise exception 'Expected %, got %',expected_state,actual; end if; return;
  end;
  raise exception 'Expected SQLSTATE %, command succeeded',expected_state;
end $$;
create function pg_temp.capture(p_id uuid,p_client text,p_content text default 'Conteúdo') returns jsonb language sql as $$
  select jsonb_build_object('id',p_id,'user_id',current_setting('t015.user_a'),'client_id',p_client,'type','note','title','Original','content',p_content,
    'category_id',null,'project_id',null,'status','inbox','converted_task_id',null,'captured_at','2026-10-07T09:00:00.000-03:00',
    'organized_at',null,'archived_at',null,'deleted_at',null,'created_at','2026-10-07T09:00:00.000-03:00','updated_at','2026-10-07T09:00:00.000-03:00');
$$;
create function pg_temp.task(p_id uuid,p_client text,p_capture uuid default null) returns jsonb language sql as $$
  select jsonb_build_object('id',p_id,'user_id',current_setting('t015.user_a'),'client_id',p_client,'title','Original','description',null,
    'category_id',null,'project_id',null,'status','todo','priority','medium','due_at',null,'scheduled_start_at',null,'scheduled_end_at',null,
    'all_day',false,'estimated_minutes',null,'board_position',null,'source','manual','origin_capture_id',p_capture,'completed_at',null,
    'archived_at',null,'deleted_at',null,'created_at','2026-10-07T12:00:00.000Z','updated_at','2026-10-07T12:00:00.000Z');
$$;
create function pg_temp.change(kind text,b jsonb,a jsonb) returns jsonb language sql as $$
  select jsonb_build_object('type',kind,'before',b,'after',a);
$$;
create function pg_temp.batch(op text,input jsonb,changes jsonb,result jsonb,revision text default null) returns jsonb language plpgsql as $$
declare events jsonb:='[]'; c jsonb; begin
  for c in select value from jsonb_array_elements(changes) loop
    events:=events||jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'user_id',current_setting('t015.user_a'),
      'entity_type',c->>'type','entity_id',c#>>'{after,id}','action',case when c->'before'='null'::jsonb then 'created' else 'updated' end,
      'canal','web','occurred_at','2026-10-07T12:00:00.000Z','before',c->'before','after',c->'after'));
  end loop;
  return jsonb_build_object('expectedRevision',coalesce(revision,public.capture_task_revision(current_setting('t015.user_a')::uuid,current_setting('t015.session_a')::uuid,op)),
    'context',jsonb_build_object('user_id',current_setting('t015.user_a'),'canal','web'),'changes',changes,'events',events,
    'receipt',jsonb_build_object('user_id',current_setting('t015.user_a'),'command',op,'client_id',input->>'client_id','fingerprint',input::text,'result',result));
end $$;
create function pg_temp.commit(op text,request jsonb) returns jsonb language sql security invoker as $$
  select public.capture_task_commit(current_setting('t015.user_a')::uuid,current_setting('t015.session_a')::uuid,op,request);
$$;
do $$ declare s text; begin
  perform pg_temp.assert_true(current_user='postgres','owner required');
  select nspname into s from pg_namespace where oid=pg_my_temp_schema();
  execute format('grant usage on schema %I to anon,authenticated,service_role',s);
  execute format('grant execute on all functions in schema %I to anon,authenticated,service_role',s);
end $$;
insert into auth.users(id,aud,role,email,is_anonymous,created_at,updated_at) values
  (current_setting('t015.user_a')::uuid,'authenticated','authenticated','t015-'||current_setting('t015.user_a')||'@example.invalid',false,now(),now()),
  (current_setting('t015.user_b')::uuid,'authenticated','authenticated','t015-'||current_setting('t015.user_b')||'@example.invalid',false,now(),now());
insert into auth.sessions(id,user_id,created_at,updated_at) values
  (current_setting('t015.session_a')::uuid,current_setting('t015.user_a')::uuid,now(),now()),
  (current_setting('t015.session_b')::uuid,current_setting('t015.user_b')::uuid,now(),now());

set local role service_role;
do $$ declare snapshot jsonb; row jsonb; request jsonb; first_result jsonb; before_revision text; begin
  snapshot:=public.capture_task_snapshot(current_setting('t015.user_a')::uuid,current_setting('t015.session_a')::uuid,'read.captures');
  perform pg_temp.assert_true(snapshot->'captures'='[]'::jsonb and snapshot->'tasks'='[]'::jsonb and snapshot->'events'='[]'::jsonb and snapshot->'receipts'='[]'::jsonb,'snapshot excludes Auth provision events');
  perform pg_temp.assert_true(snapshot->>'revision'='0' and snapshot->'projects_visible'='true'::jsonb,'initial revision and current project entitlement');
  row:=pg_temp.capture(current_setting('t015.capture')::uuid,'create',repeat('a',30000));
  request:=pg_temp.batch('capture.create',jsonb_build_object('client_id','create'),jsonb_build_array(pg_temp.change('capture',null,row)),row);
  first_result:=pg_temp.commit('capture.create',request);
  perform pg_temp.assert_true(first_result=jsonb_build_object('status','committed','result',row),'create result exactly preserved');
  perform set_config('t015.create_request',request::text,true); perform set_config('t015.capture_payload',row::text,true);
  before_revision:=public.capture_task_revision(current_setting('t015.user_a')::uuid,current_setting('t015.session_a')::uuid,'read.captures');
  perform pg_temp.assert_true(pg_temp.commit('capture.create',request)=jsonb_build_object('status','replayed','result',row),'replay precedes stale expectedRevision');
  perform pg_temp.assert_true(public.capture_task_revision(current_setting('t015.user_a')::uuid,current_setting('t015.session_a')::uuid,'read.captures')=before_revision,'replay never changes revision');
  snapshot:=public.capture_task_snapshot(current_setting('t015.user_a')::uuid,current_setting('t015.session_a')::uuid,'read.captures');
  perform pg_temp.assert_true(snapshot->'captures'->0=row and not (snapshot->'captures'->0 ? 'attachments'),'original offset/optional omission preserved');
  perform pg_temp.assert_true(snapshot->'events'->0=request->'events'->0,'original event timestamps preserved');
  perform pg_temp.assert_true(snapshot->'receipts'->0->>'fingerprint'=request->'receipt'->>'fingerprint','fingerprint is the original string');
  perform pg_temp.assert_true(public.capture_task_receipt(current_setting('t015.user_a')::uuid,current_setting('t015.session_a')::uuid,'capture.create','capture.create','absent') is null,'unknown receipt is null');
  perform pg_temp.expect_error(format('select pg_temp.commit(%L,%L::jsonb)','capture.create',jsonb_set(request,'{receipt,fingerprint}',to_jsonb('{"client_id":"create","different":true}'::text))),'23505');
  request:=pg_temp.batch('capture.create',jsonb_build_object('client_id','stale'),jsonb_build_array(pg_temp.change('capture',null,pg_temp.capture(gen_random_uuid(),'stale'))),row,'0');
  perform pg_temp.assert_true(pg_temp.commit('capture.create',request)='{"status":"stale"}'::jsonb,'stale returns no result');
end $$;
reset role;
select pg_temp.assert_true((select count(*)=1 from public.captures where user_id=current_setting('t015.user_a')::uuid),'one capture after replay/stale');
select pg_temp.assert_true((select cardinality(hits)=1 from app_private.rate_limits where scope='capture_task_write' and user_id=current_setting('t015.user_a')::uuid),'replay/stale do not consume limit');

-- Actual two-record conversion, inherited 30k description, and second command replay.
set local role service_role;
do $$ declare before_row jsonb:=current_setting('t015.capture_payload')::jsonb; after_row jsonb; task jsonb; request jsonb; result jsonb; begin
  task:=pg_temp.task(current_setting('t015.task')::uuid,'convert',current_setting('t015.capture')::uuid)||jsonb_build_object('description',before_row->'content');
  after_row:=before_row||jsonb_build_object('status','organized','converted_task_id',current_setting('t015.task'),'organized_at','2026-10-07T12:00:00.000Z','updated_at','2026-10-07T12:00:00.000Z');
  result:=jsonb_build_object('captura',after_row,'tarefa',task);
  request:=pg_temp.batch('capture.convert',jsonb_build_object('client_id','convert','capture_id',current_setting('t015.capture')),jsonb_build_array(pg_temp.change('task',null,task),pg_temp.change('capture',before_row,after_row)),result);
  perform pg_temp.assert_true(pg_temp.commit('capture.convert',request)->>'status'='committed','conversion commits both records');
  perform set_config('t015.capture_payload',after_row::text,true); perform set_config('t015.task_payload',task::text,true);
  request:=pg_temp.batch('capture.convert',jsonb_build_object('client_id','convert-again','capture_id',current_setting('t015.capture')),'[]',result);
  perform pg_temp.assert_true(pg_temp.commit('capture.convert',request)->'result'=result,'second conversion command returns same pair');
end $$;
reset role;
select pg_temp.assert_true((select count(*)=1 and bool_and(origin_capture_id=current_setting('t015.capture')::uuid) from public.tasks where user_id=current_setting('t015.user_a')::uuid),'conversion has one reciprocal task');
select pg_temp.assert_true((select count(*)=3 from public.domain_events where user_id=current_setting('t015.user_a')::uuid and entity_type in ('capture','task')),'conversion emitted exactly two extra events');

-- Malformed envelopes cannot persist a change/event/receipt or normalize dates.
set local role service_role;
do $$ declare b jsonb:=current_setting('t015.capture_payload')::jsonb; a jsonb; request jsonb; field text; task jsonb; begin
  a:=b||'{"title":"Changed"}'::jsonb;
  request:=pg_temp.batch('capture.update',jsonb_build_object('id',b->>'id','client_id','bad'),jsonb_build_array(pg_temp.change('capture',b,a)),a);
  perform pg_temp.expect_error(format('select pg_temp.commit(%L,%L::jsonb)','capture.update',jsonb_set(request,'{events}','[]')),'23514');
  perform pg_temp.expect_error(format('select pg_temp.commit(%L,%L::jsonb)','capture.update',jsonb_set(request,'{events,0,canal}','"api"')),'23514');
  perform pg_temp.expect_error(format('select pg_temp.commit(%L,%L::jsonb)','capture.update',jsonb_set(request,'{changes,0,before,title}','"Stale title"')),'40001');
  a:=b||'{"created_at":"2026-10-06T12:00:00.000Z"}'::jsonb;
  request:=pg_temp.batch('capture.update',jsonb_build_object('id',b->>'id','client_id','immutable'),jsonb_build_array(pg_temp.change('capture',b,a)),a);
  perform pg_temp.expect_error(format('select pg_temp.commit(%L,%L::jsonb)','capture.update',request),'23514');
  foreach field in array array['type','status'] loop
    a:=jsonb_set(b,array[field],'null');
    request:=pg_temp.batch('capture.update',jsonb_build_object('id',b->>'id','client_id','null-'||field),jsonb_build_array(pg_temp.change('capture',b,a)),a);
    perform pg_temp.expect_error(format('select pg_temp.commit(%L,%L::jsonb)','capture.update',request),'22023');
  end loop;
  foreach field in array array['priority','source','status'] loop
    task:=pg_temp.task(gen_random_uuid(),'bad-task'); task:=jsonb_set(task,array[field],'null');
    request:=pg_temp.batch('task.create','{"client_id":"bad-task"}',jsonb_build_array(pg_temp.change('task',null,task)),task);
    perform pg_temp.expect_error(format('select pg_temp.commit(%L,%L::jsonb)','task.create',request),'22023');
  end loop;
  a:=b||'{"updated_at":"2026-10-07T24:00:00Z"}'::jsonb;
  request:=pg_temp.batch('capture.update',jsonb_build_object('id',b->>'id','client_id','time'),jsonb_build_array(pg_temp.change('capture',b,a)),a);
  perform pg_temp.expect_error(format('select pg_temp.commit(%L,%L::jsonb)','capture.update',request),'22023');
  a:=b||'{"attachments":[{"id":"anything"}]}'::jsonb;
  request:=pg_temp.batch('capture.update',jsonb_build_object('id',b->>'id','client_id','image'),jsonb_build_array(pg_temp.change('capture',b,a)),a);
  perform pg_temp.expect_error(format('select pg_temp.commit(%L,%L::jsonb)','capture.update',request),'22023');
  request:=pg_temp.batch('capture.organize',jsonb_build_object('id',b->>'id','client_id','knowledge','destination','knowledge'),'[]',b);
  perform pg_temp.expect_error(format('select pg_temp.commit(%L,%L::jsonb)','capture.organize',request),'22023');
end $$;
reset role;
select pg_temp.assert_true((select payload=current_setting('t015.capture_payload')::jsonb from public.captures where id=current_setting('t015.capture')::uuid),'failed batches did not alter capture');
select pg_temp.assert_true((select count(*)=3 from app_private.command_receipts where user_id=current_setting('t015.user_a')::uuid and command like 'capture.%'),'failed batches did not persist receipts');

-- Organization is read-only to application roles; owner fixtures need no seed.
insert into public.projects(payload) values(jsonb_build_object('id',current_setting('t015.project'),'user_id',current_setting('t015.user_a'),
  'name','Historical project','description',null,'color_key','neutral','position',0,'deleted_at',null,'created_at','2026-10-07T12:00:00Z','updated_at','2026-10-07T12:00:00Z'));
insert into public.categories(payload) values(jsonb_build_object('id',current_setting('t015.category'),'user_id',current_setting('t015.user_b'),
  'name','Foreign category','normalized_name','foreign category','color_key','neutral','is_system',false,'created_at','2026-10-07T12:00:00Z','updated_at','2026-10-07T12:00:00Z'));
set local role service_role;
do $$ declare b jsonb:=current_setting('t015.capture_payload')::jsonb; a jsonb; request jsonb; begin
  a:=b||jsonb_build_object('category_id',current_setting('t015.category'));
  request:=pg_temp.batch('capture.update',jsonb_build_object('id',b->>'id','client_id','foreign-category'),jsonb_build_array(pg_temp.change('capture',b,a)),a);
  perform pg_temp.expect_error(format('select pg_temp.commit(%L,%L::jsonb)','capture.update',request),'23503');
  a:=b||jsonb_build_object('user_id',current_setting('t015.user_b'));
  request:=pg_temp.batch('capture.update',jsonb_build_object('id',b->>'id','client_id','foreign-owner'),jsonb_build_array(pg_temp.change('capture',b,a)),a);
  perform pg_temp.expect_error(format('select pg_temp.commit(%L,%L::jsonb)','capture.update',request),'42501');
  a:=b||jsonb_build_object('project_id',current_setting('t015.project'));
  request:=pg_temp.batch('capture.update',jsonb_build_object('id',b->>'id','client_id','project'),jsonb_build_array(pg_temp.change('capture',b,a)),a);
  perform pg_temp.assert_true(pg_temp.commit('capture.update',request)->>'status'='committed','same-owner live project');
  perform set_config('t015.capture_payload',a::text,true);
  perform set_config('t015.before_project_delete',public.capture_task_revision(current_setting('t015.user_a')::uuid,current_setting('t015.session_a')::uuid,'read.captures'),true);
end $$;
reset role;
update public.projects set payload=payload||'{"deleted_at":"2026-10-07T12:00:00Z"}'::jsonb where id=current_setting('t015.project')::uuid;
set local role service_role;
do $$ declare b jsonb:=current_setting('t015.capture_payload')::jsonb; a jsonb; request jsonb; begin
  perform pg_temp.assert_true(public.capture_task_revision(current_setting('t015.user_a')::uuid,current_setting('t015.session_a')::uuid,'read.captures')<>current_setting('t015.before_project_delete'),'project writes invalidate snapshot');
  a:=b||'{"title":"Rename after project trash"}'::jsonb;
  request:=pg_temp.batch('capture.update',jsonb_build_object('id',b->>'id','client_id','historical'),jsonb_build_array(pg_temp.change('capture',b,a)),a);
  perform pg_temp.assert_true(pg_temp.commit('capture.update',request)->>'status'='committed','historical project survives unrelated edit');
  perform set_config('t015.capture_payload',a::text,true);
  a:=pg_temp.capture(gen_random_uuid(),'deleted-project')||jsonb_build_object('project_id',current_setting('t015.project'));
  request:=pg_temp.batch('capture.create','{"client_id":"deleted-project"}',jsonb_build_array(pg_temp.change('capture',null,a)),a);
  perform pg_temp.expect_error(format('select pg_temp.commit(%L,%L::jsonb)','capture.create',request),'23503');
  b:=current_setting('t015.capture_payload')::jsonb; a:=b||'{"status":"inbox","organized_at":null}'::jsonb;
  request:=pg_temp.batch('capture.organize',jsonb_build_object('id',b->>'id','client_id','inbox','destination','inbox'),jsonb_build_array(pg_temp.change('capture',b,a)),a);
  perform pg_temp.assert_true(pg_temp.commit('capture.organize',request)->>'status'='committed','return to inbox permitted');
  perform set_config('t015.capture_payload',a::text,true);
end $$;
reset role;

-- Rename of two records rolls back BOTH if the second event fails.
set local role service_role;
do $$ declare main jsonb:=current_setting('t015.capture_payload')::jsonb; other jsonb; updated_main jsonb; updated_other jsonb; request jsonb; rev text; begin
  other:=pg_temp.capture(gen_random_uuid(),'related','Leia [[Rename after project trash]].')||jsonb_build_object('title','Related','linked_capture_ids',jsonb_build_array(main->>'id'));
  request:=pg_temp.batch('capture.create','{"client_id":"related"}',jsonb_build_array(pg_temp.change('capture',null,other)),other);
  perform pg_temp.commit('capture.create',request);
  perform set_config('t015.related_payload',other::text,true);
  updated_main:=main||'{"title":"New title"}'::jsonb;
  updated_other:=other||'{"content":"Leia [[New title]]."}'::jsonb;
  request:=pg_temp.batch('capture.update',jsonb_build_object('id',main->>'id','client_id','rename-atomic'),
    jsonb_build_array(pg_temp.change('capture',main,updated_main),pg_temp.change('capture',other,updated_other)),updated_main);
  rev:=public.capture_task_revision(current_setting('t015.user_a')::uuid,current_setting('t015.session_a')::uuid,'read.captures');
  perform pg_temp.expect_error(format('select pg_temp.commit(%L,%L::jsonb)','capture.update',jsonb_set(request,'{events,1,canal}','"api"')),'23514');
  perform pg_temp.assert_true(public.capture_task_revision(current_setting('t015.user_a')::uuid,current_setting('t015.session_a')::uuid,'read.captures')=rev,'failed second event rolls revision back');
  perform pg_temp.assert_true(pg_temp.commit('capture.update',request)->>'status'='committed','same request succeeds after failure');
  perform set_config('t015.capture_payload',updated_main::text,true); perform set_config('t015.related_payload',updated_other::text,true);
end $$;
reset role;
select pg_temp.assert_true((select payload=current_setting('t015.related_payload')::jsonb from public.captures where id=(current_setting('t015.related_payload')::jsonb->>'id')::uuid),'rename rewrote related content');

-- Gate BEFORE replay; RLS denies peer and vetoed content, including event payloads.
insert into public.user_entitlements(user_id,feature_key,allowed) values
  (current_setting('t015.user_a')::uuid,'capturar',false),(current_setting('t015.user_a')::uuid,'projetos',false);
set local role service_role;
select pg_temp.expect_error(format('select pg_temp.commit(%L,%L::jsonb)','capture.create',current_setting('t015.create_request')),'42501');
select pg_temp.expect_error(format('select public.capture_task_revision(%L,%L,%L)',current_setting('t015.user_a'),current_setting('t015.session_a'),'read.captures'),'42501');
select pg_temp.expect_error(format('select public.capture_task_receipt(%L,%L,%L,%L,%L)',current_setting('t015.user_a'),current_setting('t015.session_a'),'capture.create','capture.create','create'),'42501');
select pg_temp.expect_error(format('select public.capture_task_snapshot(%L,%L,%L)',current_setting('t015.user_a'),current_setting('t015.session_b'),'read.tasks'),'42501');
select pg_temp.assert_true((public.capture_task_snapshot(current_setting('t015.user_a')::uuid,current_setting('t015.session_a')::uuid,'read.tasks')->'projects_visible')='false'::jsonb,'project veto recalculated in SQL');
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('t015.user_a'),'session_id',current_setting('t015.session_a'),'role','authenticated')::text,true);
set local role authenticated;
select pg_temp.assert_true(not exists(select 1 from public.captures),'capture veto blocks direct SELECT');
select pg_temp.assert_true(not exists(select 1 from public.capture_links),'capture veto blocks links');
select pg_temp.assert_true(not exists(select 1 from public.projects),'project veto blocks direct SELECT');
select pg_temp.assert_true(not exists(select 1 from public.domain_events where entity_type='capture'),'capture veto blocks event content');
select pg_temp.assert_true((select count(*)=1 from public.tasks),'task access remains independent');
select pg_temp.assert_true(not exists(select 1 from public.categories),'foreign organization denied');
select pg_temp.expect_error(format('select public.capture_task_snapshot(%L,%L,%L)',current_setting('t015.user_a'),current_setting('t015.session_a'),'read.tasks'),'42501');
select pg_temp.expect_error('update public.tasks set payload=payload','42501');
select pg_temp.expect_error('delete from public.domain_events where entity_type=''capture''','42501');
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('t015.user_b'),'session_id',current_setting('t015.session_b'),'role','authenticated')::text,true);
set local role authenticated;
select pg_temp.assert_true(not exists(select 1 from public.captures) and not exists(select 1 from public.tasks),'peer sees no records');
reset role;
update public.user_entitlements set allowed=true where user_id=current_setting('t015.user_a')::uuid and feature_key='capturar';
update public.user_moderation set must_change_password=true where user_id=current_setting('t015.user_a')::uuid;
set local role service_role;
select pg_temp.expect_error(format('select public.capture_task_snapshot(%L,%L,%L)',current_setting('t015.user_a'),current_setting('t015.session_a'),'read.tasks'),'42501');
reset role;
update public.user_moderation set must_change_password=false,status='blocked' where user_id=current_setting('t015.user_a')::uuid;
set local role service_role;
select pg_temp.expect_error(format('select public.capture_task_snapshot(%L,%L,%L)',current_setting('t015.user_a'),current_setting('t015.session_a'),'read.tasks'),'42501');
reset role;
update public.user_moderation set status='active' where user_id=current_setting('t015.user_a')::uuid;

-- Accepted writes persist the budget; denied calls and old receipts consume none.
do $$ declare u uuid:=current_setting('t015.user_a')::uuid; key text; i integer; begin
  key:=encode(sha256(convert_to(u::text,'UTF8')),'hex');
  for i in 1..30 loop perform app_private.consume_rate_limit_at('capture_task_write',key,u,null); end loop;
end $$;
set local role service_role;
do $$ declare b jsonb:=current_setting('t015.capture_payload')::jsonb; request jsonb; begin
  request:=pg_temp.batch('capture.update',jsonb_build_object('id',b->>'id','client_id','limited'),jsonb_build_array(pg_temp.change('capture',b,b)),b);
  perform pg_temp.expect_error(format('select pg_temp.commit(%L,%L::jsonb)','capture.update',request),'PT429');
  request:=current_setting('t015.create_request')::jsonb;
  -- Receipt-only replay is what executarComando produces from a current snapshot.
  request:=jsonb_set(jsonb_set(request,'{changes}','[]'),'{events}','[]');
  perform pg_temp.assert_true(pg_temp.commit('capture.create',request)->>'status'='replayed','receipt-only replay works even while limited');
end $$;
reset role;
select pg_temp.assert_true((select cardinality(hits)=30 from app_private.rate_limits where scope='capture_task_write' and user_id=current_setting('t015.user_a')::uuid),'denial/replay leaves thirty accepted hits');

-- Explicit snapshot limits, never LIMIT/truncation. Subtransactions remove probes.
do $$ declare u uuid:=current_setting('t015.user_a')::uuid; s uuid:=current_setting('t015.session_a')::uuid; caught boolean:=false; begin
  begin
    insert into app_private.command_receipts(user_id,command,client_id,request,result)
      select u,'capture.create','size-'||i,to_jsonb('fixture'::text),pg_temp.capture(gen_random_uuid(),'size-'||i,repeat('😀',30000)) from generate_series(1,80) i;
    perform public.capture_task_snapshot(u,s,'read.captures');
  exception when program_limit_exceeded then caught:=true;
  end;
  perform pg_temp.assert_true(caught,'8 MiB limit rejects explicitly');
  caught:=false;
  begin
    insert into app_private.command_receipts(user_id,command,client_id,request,result)
      select u,'capture.create','count-'||i,to_jsonb('fixture'::text),'{}'::jsonb from generate_series(1,10001) i;
    perform public.capture_task_snapshot(u,s,'read.captures');
  exception when program_limit_exceeded then caught:=true;
  end;
  perform pg_temp.assert_true(caught,'10000 row limit rejects explicitly');
end $$;
set constraints all immediate;

-- Revoked sessions fail even for old receipts. Final exact-ID cascade check.
delete from auth.sessions where id=current_setting('t015.session_a')::uuid;
set local role service_role;
select pg_temp.expect_error(format('select pg_temp.commit(%L,%L::jsonb)','capture.create',current_setting('t015.create_request')),'42501');
reset role;
delete from auth.users where id in (current_setting('t015.user_a')::uuid,current_setting('t015.user_b')::uuid);
select pg_temp.assert_true(not exists(select 1 from public.captures where user_id in (current_setting('t015.user_a')::uuid,current_setting('t015.user_b')::uuid)),'Auth deletion cascades captures');
select pg_temp.assert_true(not exists(select 1 from public.tasks where user_id=current_setting('t015.user_a')::uuid),'Auth deletion cascades tasks');
select pg_temp.assert_true(not exists(select 1 from app_private.command_receipts where user_id=current_setting('t015.user_a')::uuid),'Auth deletion cascades receipts');
select pg_temp.assert_true(not exists(select 1 from app_private.capture_task_revisions where user_id=current_setting('t015.user_a')::uuid),'Auth deletion cascades revision');
rollback;
