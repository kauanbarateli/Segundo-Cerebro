-- T021 behavioral assertions: PREPARED, NEVER EXECUTED by this delivery.
-- Run manually in an approved isolated test project AFTER migrations.
-- Synthetic transaction-only users/sessions; always ROLLBACK, never COMMIT.
begin;
set local statement_timeout='60s';
set local lock_timeout='5s';
select set_config('t021.user',gen_random_uuid()::text,true),set_config('t021.other',gen_random_uuid()::text,true),set_config('t021.session',gen_random_uuid()::text,true),set_config('t021.notebook',gen_random_uuid()::text,true),set_config('t021.page',gen_random_uuid()::text,true);
create function pg_temp.assert_true(ok boolean,message text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'T021: %',message;end if;end $$;
create function pg_temp.expect_error(command text,expected text) returns void language plpgsql as $$ declare actual text; detail text; context text;begin begin execute command;exception when others then get stacked diagnostics actual=returned_sqlstate,detail=message_text,context=pg_exception_context;if actual<>expected then raise exception 'Expected %, got %: % / %',expected,actual,detail,left(context,400);end if;return;end;raise exception 'Expected %, command succeeded',expected;end $$;
create function pg_temp.notebook() returns jsonb language sql as $$ select jsonb_build_object('id',current_setting('t021.notebook'),'user_id',current_setting('t021.user'),'name','Caderno','project_id',null,'position',0,'deleted_at',null,'deletion_batch_id',null,'created_at','2026-10-09T14:00:00Z','updated_at','2026-10-09T14:00:00Z');$$;
create function pg_temp.batch(command text,kind text,before_row jsonb,after_row jsonb,client text) returns jsonb language sql as $$
  select jsonb_build_object('expected_revision',(public.knowledge_snapshot(current_setting('t021.user')::uuid,current_setting('t021.session')::uuid,command))->>'revision',
    'context',jsonb_build_object('user_id',current_setting('t021.user'),'canal','web'),
    'changes',jsonb_build_array(jsonb_build_object('type',kind,'before',before_row,'after',after_row)),'refs','[]'::jsonb,
    'events',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'user_id',current_setting('t021.user'),'entity_type',kind,'entity_id',after_row->>'id','action',case when before_row is null then 'created' else 'updated' end,'canal','web','occurred_at','2026-10-09T14:00:00Z','before',before_row,'after',after_row)),
    'receipt',jsonb_build_object('user_id',current_setting('t021.user'),'command',command,'client_id',client,'fingerprint',encode(sha256(convert_to(client,'UTF8')),'hex'),'result',after_row));
$$;
do $$ declare schema_name text;begin
  perform pg_temp.assert_true(current_user='postgres','owner required');select nspname into schema_name from pg_namespace where oid=pg_my_temp_schema();execute format('grant usage on schema %I to service_role,authenticated,anon',schema_name);execute format('grant execute on all functions in schema %I to service_role,authenticated,anon',schema_name);
end $$;
insert into auth.users(id,aud,role,email,is_anonymous,created_at,updated_at) values
  (current_setting('t021.user')::uuid,'authenticated','authenticated','t021-'||current_setting('t021.user')||'@example.invalid',false,now(),now()),
  (current_setting('t021.other')::uuid,'authenticated','authenticated','t021-'||current_setting('t021.other')||'@example.invalid',false,now(),now());
insert into auth.sessions(id,user_id,created_at,updated_at) values(current_setting('t021.session')::uuid,current_setting('t021.user')::uuid,now(),now());
set local role service_role;
do $$ declare row jsonb;request jsonb;revision text;result jsonb;begin
  row:=pg_temp.notebook();request:=pg_temp.batch('knowledge.notebook.create','knowledge_notebook',null,row,'create');
  result:=public.knowledge_commit(current_setting('t021.user')::uuid,current_setting('t021.session')::uuid,'knowledge.notebook.create',request);
  perform pg_temp.assert_true(result=jsonb_build_object('status','committed','result',row),'atomic create');
  revision:=public.knowledge_snapshot(current_setting('t021.user')::uuid,current_setting('t021.session')::uuid,'read.knowledge')->>'revision';
  perform pg_temp.assert_true(public.knowledge_commit(current_setting('t021.user')::uuid,current_setting('t021.session')::uuid,'knowledge.notebook.create',request)->>'status'='replayed','receipt before stale revision');
  perform pg_temp.assert_true(public.knowledge_snapshot(current_setting('t021.user')::uuid,current_setting('t021.session')::uuid,'read.knowledge')->>'revision'=revision,'replay has no mutation');
  perform pg_temp.expect_error(format('select public.knowledge_snapshot(%L::uuid,%L::uuid,''read.knowledge'')',current_setting('t021.other'),current_setting('t021.session')),'42501');
  perform pg_temp.expect_error(format('select public.knowledge_commit(%L::uuid,%L::uuid,''knowledge.notebook.create'',%L::jsonb)',current_setting('t021.user'),current_setting('t021.session'),jsonb_set(request,'{receipt,fingerprint}','"changed"'::jsonb)::text),'23505');
  request:=pg_temp.batch('knowledge.notebook.update','knowledge_notebook',row,jsonb_set(row,'{name}','"Alterado"'::jsonb),'update');
  request:=jsonb_set(request,'{events}','[]'::jsonb);
  perform pg_temp.expect_error(format('select public.knowledge_commit(%L::uuid,%L::uuid,''knowledge.notebook.update'',%L::jsonb)',current_setting('t021.user'),current_setting('t021.session'),request::text),'23514');
  perform pg_temp.assert_true((public.knowledge_snapshot(current_setting('t021.user')::uuid,current_setting('t021.session')::uuid,'read.knowledge')->'notebooks'->0->>'name')='Caderno','event failure rolls back data');
end $$;
reset role;
select pg_temp.assert_true(app_private.knowledge_normalize('  AÇÃO   diária ')='acao diaria','normalization agrees with core');
select pg_temp.assert_true(app_private.knowledge_document_text('{"type":"doc","content":[{"type":"paragraph"},{"type":"paragraph","content":[{"type":"text","text":"Texto"}]}]}'::jsonb)=E'\nTexto','blank paragraphs preserved');
select pg_temp.expect_error('select app_private.knowledge_validate_document(''{"type":"doc","content":[{"type":"iframe"}]}''::jsonb)','22023');
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('t021.other'),'role','authenticated','session_id',current_setting('t021.session'))::text,true);
select pg_temp.assert_true(not exists(select 1 from public.knowledge_notebooks where user_id=current_setting('t021.user')::uuid),'other user cannot read');
select pg_temp.expect_error(format('select public.knowledge_snapshot(%L::uuid,%L::uuid,''read.knowledge'')',current_setting('t021.user'),current_setting('t021.session')),'42501');
rollback;
