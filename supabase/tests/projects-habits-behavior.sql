-- Disposable metadata fixtures; no SDK/remote Auth, serial behavior only.
begin;
set local statement_timeout='60s';
select set_config('t023.user',gen_random_uuid()::text,true),set_config('t023.other',gen_random_uuid()::text,true),set_config('t023.session',gen_random_uuid()::text,true),set_config('t023.project',gen_random_uuid()::text,true),set_config('t023.folder',gen_random_uuid()::text,true),set_config('t023.habit',gen_random_uuid()::text,true);
create function pg_temp.routine_assert(ok boolean,message text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'T023 behavior: %',message;end if;end $$;
create function pg_temp.routine_error(command text,expected text) returns void language plpgsql as $$ declare actual text;detail text;context text;begin begin execute command;exception when others then get stacked diagnostics actual=returned_sqlstate,detail=message_text,context=pg_exception_context;if actual<>expected then raise exception 'Expected %, got %: % / %',expected,actual,detail,left(context,350);end if;return;end;raise exception 'Expected %, succeeded',expected;end $$;
create function pg_temp.routine_batch(command text,kind text,before_row jsonb,after_row jsonb,input jsonb) returns jsonb language sql as $$ select jsonb_build_object('expectedRevision',public.projects_habits_snapshot(current_setting('t023.user')::uuid,current_setting('t023.session')::uuid,command)->>'revision','context',jsonb_build_object('user_id',current_setting('t023.user'),'canal','web'),'changes',jsonb_build_array(jsonb_build_object('type',kind,'before',before_row,'after',after_row)),'events',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'user_id',current_setting('t023.user'),'entity_type',kind,'entity_id',coalesce(after_row,before_row)->>'id','action',case when before_row is null then 'created' when after_row is null or command in ('project.delete','habit.archive') then 'deleted' when command in ('project.restore','habit.restore') then 'restored' else 'updated' end,'canal','web','occurred_at',now(),'before',before_row,'after',after_row)),'receipt',jsonb_build_object('user_id',current_setting('t023.user'),'command',command,'client_id',input->>'client_id','fingerprint',input::text,'result',after_row));$$;
create function pg_temp.project() returns jsonb language sql as $$select jsonb_build_object('id',current_setting('t023.project'),'user_id',current_setting('t023.user'),'name','Plano pessoal','description',null,'color_key','work','position',0,'deleted_at',null,'created_at',now(),'updated_at',now());$$;
create function pg_temp.habit() returns jsonb language sql as $$select jsonb_build_object('id',current_setting('t023.habit'),'user_id',current_setting('t023.user'),'name','Leitura diária','schedule_kind','daily','weekdays','[]'::jsonb,'weekly_target',null,'started_on',((current_timestamp at time zone 'America/Sao_Paulo')::date-150)::text,'color_key','personal','icon_key',null,'position',0,'archived_at',null,'created_at',now(),'updated_at',now());$$;
do $$declare schema_name text;begin select nspname into schema_name from pg_namespace where oid=pg_my_temp_schema();execute format('grant usage on schema %I to service_role,authenticated',schema_name);execute format('grant execute on all functions in schema %I to service_role,authenticated',schema_name);end $$;
insert into auth.users(id,aud,role,email,is_anonymous,created_at,updated_at) values(current_setting('t023.user')::uuid,'authenticated','authenticated','t023-'||current_setting('t023.user')||'@example.invalid',false,now(),now()),(current_setting('t023.other')::uuid,'authenticated','authenticated','t023-'||current_setting('t023.other')||'@example.invalid',false,now(),now());
insert into auth.sessions(id,user_id,created_at,updated_at) values(current_setting('t023.session')::uuid,current_setting('t023.user')::uuid,now(),now());
set local role service_role;
do $$declare u uuid:=current_setting('t023.user')::uuid;s uuid:=current_setting('t023.session')::uuid;p jsonb;h jsonb;input jsonb;request jsonb;revision text;begin
 p:=pg_temp.project();input:=p-array['id','user_id','deleted_at','created_at','updated_at']||'{"client_id":"create-project"}'::jsonb;request:=pg_temp.routine_batch('project.create','project',null,p,input);
 perform pg_temp.routine_assert(public.projects_habits_commit(u,s,'project.create',request)->>'status'='committed','project metadata/event/receipt');revision:=public.projects_habits_snapshot(u,s,'read.projects')->>'revision';
 perform pg_temp.routine_assert(public.projects_habits_commit(u,s,'project.create',request)->>'status'='replayed','exact replay before stale');perform pg_temp.routine_assert(public.projects_habits_snapshot(u,s,'read.projects')->>'revision'=revision,'replay no revision');
 perform pg_temp.routine_error(format('select public.projects_habits_commit(%L,%L,''project.create'',%L::jsonb)',u,s,jsonb_set(request,'{receipt,fingerprint}',to_jsonb((input||'{"name":"Other"}'::jsonb)::text))::text),'23505');
 request:=pg_temp.routine_batch('project.update','project',p,p||'{"name":"Changed"}'::jsonb,jsonb_build_object('id',p->'id','patch','{"name":"Changed"}'::jsonb,'client_id','without-event'));request:=jsonb_set(request,'{events}','[]');perform pg_temp.routine_error(format('select public.projects_habits_commit(%L,%L,''project.update'',%L::jsonb)',u,s,request::text),'23514');
 h:=pg_temp.habit();input:=h-array['id','user_id','archived_at','created_at','updated_at']||'{"client_id":"create-habit"}'::jsonb;perform public.projects_habits_commit(u,s,'habit.create',pg_temp.routine_batch('habit.create','habit',null,h,input));
 perform pg_temp.routine_error(format('select public.projects_habits_snapshot(%L,%L,''read.projects'')',current_setting('t023.other'),s),'42501');
end $$;
reset role;
-- Persisted Drive names up to 200 remain linkable through the metadata proxy.
insert into public.drive_folders(payload) values(jsonb_build_object('id',current_setting('t023.folder'),'user_id',current_setting('t023.user'),'name',repeat('N',200),'parent_id',null,'project_id',null,'position',0,'deleted_at',null,'deletion_batch_id',null,'created_at',now(),'updated_at',now()));
set local role service_role;
do $$declare u uuid:=current_setting('t023.user')::uuid;s uuid:=current_setting('t023.session')::uuid;b jsonb;a jsonb;p jsonb;begin
 b:=public.projects_habits_snapshot(u,s,'read.projects')->'containers'->0;a:=b||jsonb_build_object('project_id',current_setting('t023.project'));perform public.projects_habits_commit(u,s,'project.container.link',pg_temp.routine_batch('project.container.link','project_container',b,a,jsonb_build_object('id',b->'id','project_id',a->'project_id','client_id','long-folder-link')));
 p:=pg_temp.project();perform public.projects_habits_commit(u,s,'project.delete',pg_temp.routine_batch('project.delete','project',p,p||jsonb_build_object('deleted_at',now()),jsonb_build_object('id',p->'id','client_id','delete-project')));
 perform pg_temp.routine_assert((public.projects_habits_snapshot(u,s,'read.projects')->'containers'->0)=a,'project deletion preserves source and link');
 perform public.projects_habits_commit(u,s,'project.restore',pg_temp.routine_batch('project.restore','project',p||jsonb_build_object('deleted_at',now()),p,jsonb_build_object('id',p->'id','client_id','restore-project')));
 perform pg_temp.routine_assert((public.projects_habits_snapshot(u,s,'read.projects')->'containers'->0)=a,'restore preserves exact source');
end $$;
reset role;
-- Complete history: 120 marks exceed heatmap display windows.
select set_config('t023.capture',gen_random_uuid()::text,true);
insert into public.captures(payload) values(jsonb_build_object('id',current_setting('t023.capture'),'user_id',current_setting('t023.user'),'client_id','long-capture-source','type','note','title',repeat('C',200),'content','Conteúdo privado preservado','status','inbox','category_id',null,'project_id',null,'converted_task_id',null,'captured_at',now(),'organized_at',null,'archived_at',null,'deleted_at',null,'created_at',now(),'updated_at',now()));
set local role service_role;
do $$declare u uuid:=current_setting('t023.user')::uuid;s uuid:=current_setting('t023.session')::uuid;b jsonb;a jsonb;begin
 select c into b from jsonb_array_elements(public.projects_habits_snapshot(u,s,'read.projects')->'containers') c where c->>'id'=current_setting('t023.capture');a:=b||jsonb_build_object('project_id',current_setting('t023.project'));perform public.projects_habits_commit(u,s,'project.container.link',pg_temp.routine_batch('project.container.link','project_container',b,a,jsonb_build_object('id',b->'id','project_id',a->'project_id','client_id','long-capture-link')));
end $$;
reset role;
select pg_temp.routine_assert((select payload->>'content'='Conteúdo privado preservado' and char_length(payload->>'title')=200 from public.captures where id=current_setting('t023.capture')::uuid),'200-character capture links without content rewrite');
set local role service_role;
do $$declare u uuid:=current_setting('t023.user')::uuid;s uuid:=current_setting('t023.session')::uuid;a jsonb;begin
 a:=jsonb_build_object('id',gen_random_uuid(),'user_id',u,'kind','notebook','name','Caderno criado aqui','project_id',current_setting('t023.project'),'parent_id',null,'deleted_at',null,'created_at',now(),'updated_at',now());perform public.projects_habits_commit(u,s,'project.container.create',pg_temp.routine_batch('project.container.create','project_container',null,a,jsonb_build_object('kind','notebook','name',a->'name','project_id',a->'project_id','client_id','create-notebook-here')));
end $$;
reset role;
select pg_temp.routine_assert(exists(select 1 from public.knowledge_notebooks where user_id=current_setting('t023.user')::uuid and payload->>'name'='Caderno criado aqui' and project_id=current_setting('t023.project')::uuid),'create-here notebook supplies physical identity');
-- Failure after the source UPDATE still rolls back row, Event and receipt.
create function pg_temp.reject_project_event() returns trigger language plpgsql as $$begin if new.entity_type='project' then raise exception 'injected project event failure' using errcode='P0001';end if;return new;end $$;
create trigger t023_reject_event before insert on public.domain_events for each row execute function pg_temp.reject_project_event();
do $$declare p jsonb;request jsonb;begin p:=pg_temp.project();request:=pg_temp.routine_batch('project.update','project',p,p||'{"name":"Não persistir"}'::jsonb,jsonb_build_object('id',p->'id','patch','{"name":"Não persistir"}'::jsonb,'client_id','atomic-failure'));perform pg_temp.routine_error(format('select public.projects_habits_commit(%L,%L,''project.update'',%L::jsonb)',current_setting('t023.user'),current_setting('t023.session'),request::text),'P0001');end $$;
drop trigger t023_reject_event on public.domain_events;
select pg_temp.routine_assert((select payload->>'name'='Plano pessoal' from public.projects where id=current_setting('t023.project')::uuid) and not exists(select 1 from app_private.command_receipts where user_id=current_setting('t023.user')::uuid and client_id='atomic-failure'),'event failure rolls back source and receipt');
insert into public.habit_entries(payload) select jsonb_build_object('id',gen_random_uuid(),'user_id',current_setting('t023.user'),'habit_id',current_setting('t023.habit'),'done_on',((current_timestamp at time zone 'America/Sao_Paulo')::date-g)::text,'note',null,'created_at',now()) from generate_series(1,120) g;
select pg_temp.routine_assert(jsonb_array_length(public.projects_habits_snapshot(current_setting('t023.user')::uuid,current_setting('t023.session')::uuid,'read.habits')->'entries')=120,'snapshot retains 120+ history inputs');
select pg_temp.routine_error(format('insert into public.habit_entries(payload) values(%L::jsonb)',jsonb_build_object('id',gen_random_uuid(),'user_id',current_setting('t023.user'),'habit_id',current_setting('t023.habit'),'done_on',((current_timestamp at time zone 'America/Sao_Paulo')::date+1)::text,'note',null,'created_at',now())::text),'23514');
insert into public.habit_pauses(payload) values(jsonb_build_object('id',gen_random_uuid(),'user_id',current_setting('t023.user'),'habit_id',null,'starts_on',(current_timestamp at time zone 'America/Sao_Paulo')::date::text,'ends_on',null,'reason',null,'created_at',now()));
select pg_temp.routine_error(format('insert into public.habit_entries(payload) values(%L::jsonb)',jsonb_build_object('id',gen_random_uuid(),'user_id',current_setting('t023.user'),'habit_id',current_setting('t023.habit'),'done_on',(current_timestamp at time zone 'America/Sao_Paulo')::date::text,'note',null,'created_at',now())::text),'23514');
insert into public.user_entitlements(user_id,feature_key,allowed) values(current_setting('t023.user')::uuid,'habitos',false);
select pg_temp.routine_error(format('select public.projects_habits_snapshot(%L,%L,''read.habits'')',current_setting('t023.user'),current_setting('t023.session')),'42501');
update public.user_moderation set must_change_password=true where user_id=current_setting('t023.user')::uuid;
select pg_temp.routine_error(format('select public.projects_habits_snapshot(%L,%L,''read.projects'')',current_setting('t023.user'),current_setting('t023.session')),'42501');
update public.user_moderation set must_change_password=false,status='blocked' where user_id=current_setting('t023.user')::uuid;
select pg_temp.routine_error(format('select public.projects_habits_snapshot(%L,%L,''read.projects'')',current_setting('t023.user'),current_setting('t023.session')),'42501');
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('t023.other'),'session_id',current_setting('t023.session'),'role','authenticated')::text,true);
select pg_temp.routine_assert(not exists(select 1 from public.habits where user_id=current_setting('t023.user')::uuid),'other owner cannot SELECT');
rollback;
