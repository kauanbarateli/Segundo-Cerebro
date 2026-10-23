-- PROPOSAL: synthetic catalogue fixtures, serial only, entire fixture rolls back.
-- Run only through the explicit candidate helper after review; never hosted.
begin;
do $draft_only$ begin raise exception 'DRAFT_ONLY: onboarding serial assertions require explicit reviewed candidate helper.';end $draft_only$;
set local statement_timeout='30s';
select set_config('onb26.user',gen_random_uuid()::text,true),set_config('onb26.session',gen_random_uuid()::text,true),set_config('onb26.other',gen_random_uuid()::text,true),set_config('onb26.other_session',gen_random_uuid()::text,true),set_config('onb26.project',gen_random_uuid()::text,true),set_config('onb26.task',gen_random_uuid()::text,true),set_config('onb26.execution',gen_random_uuid()::text,true);
create function pg_temp.onb_assert(ok boolean,message text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'Onboarding026: %',message;end if;end$$;
create function pg_temp.onb_error(command text,expected text) returns void language plpgsql as $$declare actual text;begin begin execute command;exception when others then get stacked diagnostics actual=returned_sqlstate;if actual<>expected then raise exception 'Expected %, got %',expected,actual;end if;return;end;raise exception 'Expected refusal, command succeeded';end$$;
create function pg_temp.onb_call(operation text,request jsonb default '{}') returns jsonb language sql as $$select public.onboarding_call(current_setting('onb26.user')::uuid,current_setting('onb26.session')::uuid,operation,request)$$;
create function pg_temp.onb_round() returns jsonb language sql as $$select pg_temp.onb_call('snapshot')->'round'$$;
create function pg_temp.onb_input(cid uuid) returns jsonb language sql as $$select jsonb_build_object('roundId',pg_temp.onb_round()->>'id','expectedRevision',pg_temp.onb_round()->>'revision','clientId',cid)$$;
create function pg_temp.onb_draft(name text) returns jsonb language sql as $$select jsonb_build_object('profile','{}'::jsonb,'habits','[]'::jsonb,'projects',jsonb_build_array(jsonb_build_object('key',current_setting('onb26.project'),'name',name)),'tasks',jsonb_build_array(jsonb_build_object('key',current_setting('onb26.task'),'title','Dependente','project',jsonb_build_object('kind','draft','key',current_setting('onb26.project')),'due',jsonb_build_object('kind','none'))),'notes',null)$$;
create function pg_temp.onb_plan() returns jsonb language plpgsql as $$declare r text:=pg_temp.onb_round()->>'id';p text:=current_setting('onb26.project');t text:=current_setting('onb26.task');begin return jsonb_build_array(
 jsonb_build_object('slot','project:'||p,'itemKey',p,'kind','project','command','project.create','input',jsonb_build_object('name','Projeto temporário','description',null,'color_key','work','position',0,'client_id','onb:'||r||':project:'||p||':v1'),'choice',jsonb_build_object('kind','project','name','Projeto temporário','context',null),'bindings','[]'::jsonb,'extras','{}'::jsonb,'ordinal',0),
 jsonb_build_object('slot','task:'||t,'itemKey',t,'kind','task','command','task.create','input',jsonb_build_object('title','Dependente','description',null,'category_id',null,'project_id',null,'status','todo','priority','medium','due_at',null,'scheduled_start_at',null,'scheduled_end_at',null,'all_day',false,'estimated_minutes',null,'board_position',null,'client_id','onb:'||r||':task:'||t||':v1'),'choice',jsonb_build_object('kind','task','title','Dependente','project',jsonb_build_object('kind','draft','key',p),'due',jsonb_build_object('kind','none')),'bindings',jsonb_build_array(jsonb_build_object('field','project_id','slot','project:'||p)),'extras','{}'::jsonb,'ordinal',1));end$$;
do $$declare ns text;begin select nspname into strict ns from pg_namespace where oid=pg_my_temp_schema();execute format('grant usage on schema %I to service_role',ns);execute format('grant execute on all functions in schema %I to service_role',ns);end$$;
select pg_temp.onb_assert(not exists(select 1 from auth.users),'empty disposable fixture required');
insert into auth.users(id,aud,role,email) values(current_setting('onb26.user')::uuid,'authenticated','authenticated','onb26-owner@example.invalid'),(current_setting('onb26.other')::uuid,'authenticated','authenticated','onb26-other@example.invalid');
insert into auth.sessions(id,user_id) values(current_setting('onb26.session')::uuid,current_setting('onb26.user')::uuid),(current_setting('onb26.other_session')::uuid,current_setting('onb26.other')::uuid);
set local role service_role;
select pg_temp.onb_assert(pg_temp.onb_call('snapshot')->'eligibility'->>'kind'='existing_opt_in','no absence/created_at heuristic');
select pg_temp.onb_call('start',jsonb_build_object('clientId',gen_random_uuid()));
select pg_temp.onb_call('save',pg_temp.onb_input(gen_random_uuid())||jsonb_build_object('step','projects','draft',pg_temp.onb_draft('')));
select pg_temp.onb_assert(pg_temp.onb_round()->'draft'->'projects'->0->>'name'='','partial draft survives');
select pg_temp.onb_assert((pg_temp.onb_round()->>'expiresAt')::timestamptz-(pg_temp.onb_round()->>'editedAt')::timestamptz=interval '720 hours','exact elapsed retention');
select pg_temp.onb_error(format('select pg_temp.onb_call(''prepare'',%L::jsonb)',(pg_temp.onb_input(gen_random_uuid())||jsonb_build_object('plan',pg_temp.onb_plan()))::text),'22023');
select pg_temp.onb_call('save',pg_temp.onb_input(gen_random_uuid())||jsonb_build_object('step','summary','draft',pg_temp.onb_draft('Projeto temporário')));
select set_config('onb26.prepare',(pg_temp.onb_input(gen_random_uuid())||jsonb_build_object('plan',pg_temp.onb_plan()))::text,true);
select pg_temp.onb_call('prepare',current_setting('onb26.prepare')::jsonb);
select pg_temp.onb_call('prepare',current_setting('onb26.prepare')::jsonb);
select pg_temp.onb_assert(jsonb_array_length(pg_temp.onb_round()->'receipts')=2,'confirmation replay no duplicate intents');
select set_config('onb26.parent',pg_temp.onb_round()->'receipts'->0->>'intentId',true),set_config('onb26.child',pg_temp.onb_round()->'receipts'->1->>'intentId',true);
select pg_temp.onb_assert(pg_temp.onb_call('snapshot')->'recovery'->0->'dependentIntentIds'=jsonb_build_array(current_setting('onb26.child')),'exact active dependency projection');
-- Explicit replacement versions both parent and still-unconfirmed dependent.
select set_config('onb26.amend',(pg_temp.onb_input(gen_random_uuid())||jsonb_build_object('intentId',current_setting('onb26.parent'),'change',jsonb_build_object('kind','replace','value',jsonb_build_object('kind','project','name','Corrigido','context','study')),'plan',(pg_temp.onb_plan()->0)||jsonb_build_object('input',(pg_temp.onb_plan()->0->'input')||jsonb_build_object('name','Corrigido','client_id','onb:'||(pg_temp.onb_round()->>'id')||':project:'||current_setting('onb26.project')||':v2'),'choice',jsonb_build_object('kind','project','name','Corrigido','context','study'),'extras',jsonb_build_object('context','study'))))::text,true);
select pg_temp.onb_call('amend',current_setting('onb26.amend')::jsonb);
select pg_temp.onb_call('amend',current_setting('onb26.amend')::jsonb);
select pg_temp.onb_error(format('select pg_temp.onb_call(''amend'',%L::jsonb)',jsonb_set(current_setting('onb26.amend')::jsonb,'{change,value,name}','"Outro"'::jsonb)::text),'23505');
reset role;
select pg_temp.onb_assert((select count(*)=2 and bool_and(intent_version=2) from app_private.onboarding_intents where user_id=current_setting('onb26.user')::uuid and active),'one version2 per slot, no replay v3');
select pg_temp.onb_assert((select count(*)=2 and bool_and(status='not_committed' and input is null and bound_input is null and choice is null) from app_private.onboarding_intents where user_id=current_setting('onb26.user')::uuid and not active),'prior versions sealed/scrubbed');
select pg_temp.onb_assert(not exists(select 1 from public.projects where user_id=current_setting('onb26.user')::uuid),'metadata plan does not fabricate module effects');
set local role service_role;
select set_config('onb26.parent',pg_temp.onb_round()->'receipts'->0->>'intentId',true),set_config('onb26.child',pg_temp.onb_round()->'receipts'->1->>'intentId',true);
select pg_temp.onb_error(format('select pg_temp.onb_call(''amend'',%L::jsonb)',(pg_temp.onb_input(gen_random_uuid())||jsonb_build_object('intentId',current_setting('onb26.parent'),'change',jsonb_build_object('kind','omit','dependents','deny','dependentIntentIds','[]'::jsonb),'plan',null))::text),'40001');
select pg_temp.onb_call('amend',pg_temp.onb_input(gen_random_uuid())||jsonb_build_object('intentId',current_setting('onb26.parent'),'change',jsonb_build_object('kind','omit','dependents','omit_selected','dependentIntentIds',jsonb_build_array(current_setting('onb26.child'))),'plan',null));
select pg_temp.onb_assert(pg_temp.onb_round()->>'status'='complete' and pg_temp.onb_call('snapshot')->'recovery'='[]'::jsonb,'explicit omission completes without pretending creation');
select pg_temp.onb_error(format('select public.onboarding_call(%L::uuid,%L::uuid,''snapshot'',''{}'')',current_setting('onb26.other'),current_setting('onb26.session')),'42501');
-- A fresh pending version qualifies permit tests; all effects remain absent.
select pg_temp.onb_call('start',jsonb_build_object('clientId',gen_random_uuid()));
select pg_temp.onb_call('save',pg_temp.onb_input(gen_random_uuid())||jsonb_build_object('step','summary','draft',pg_temp.onb_draft('Projeto temporário')));
select pg_temp.onb_call('prepare',pg_temp.onb_input(gen_random_uuid())||jsonb_build_object('plan',pg_temp.onb_plan()));
select set_config('onb26.pending',pg_temp.onb_call('peek_intent',jsonb_build_object('roundId',pg_temp.onb_round()->>'id','clientId',gen_random_uuid()))::text,true);
select pg_temp.onb_call('bind_intent',(current_setting('onb26.pending')::jsonb)-array['slot','itemKey','kind','command','input','choice','bindings','extras','ordinal']||jsonb_build_object('canonicalInput',(current_setting('onb26.pending')::jsonb->'input')::text));
reset role;
select pg_temp.onb_error(format('select app_private.onboarding_reserved_guard(%L,%L,''project.create'',%L::jsonb)',current_setting('onb26.user'),current_setting('onb26.session'),jsonb_build_object('receipt',jsonb_build_object('client_id',current_setting('onb26.pending')::jsonb->'input'->>'client_id','fingerprint',(current_setting('onb26.pending')::jsonb->'input')::text))::text),'42501');
select pg_temp.onb_error($q$insert into app_private.onboarding_write_permits(user_id,session_id,round_id,generation,intent_id,intent_version,command,client_id,fingerprint,backend_pid,xact_id)
 select i.user_id,current_setting('onb26.session')::uuid,i.round_id,r.generation,i.id,i.intent_version,i.command,i.bound_input->>'client_id',i.expected_fingerprint,pg_backend_pid(),pg_current_xact_id() from app_private.onboarding_intents i join app_private.onboarding_rounds r on r.id=i.round_id where i.id=(current_setting('onb26.pending')::jsonb->>'intentId')::uuid;
 set constraints app_private.onboarding_permit_zero immediate$q$,'23514');
select pg_temp.onb_assert(not exists(select 1 from app_private.onboarding_write_permits),'unconsumed permit rejection rolls back its insertion');
insert into app_private.onboarding_write_permits(user_id,session_id,round_id,generation,intent_id,intent_version,command,client_id,fingerprint,backend_pid,xact_id)
select i.user_id,current_setting('onb26.session')::uuid,i.round_id,r.generation,i.id,i.intent_version,i.command,i.bound_input->>'client_id',i.expected_fingerprint,pg_backend_pid(),pg_current_xact_id() from app_private.onboarding_intents i join app_private.onboarding_rounds r on r.id=i.round_id where i.id=(current_setting('onb26.pending')::jsonb->>'intentId')::uuid;
select app_private.onboarding_reserved_guard(current_setting('onb26.user')::uuid,current_setting('onb26.session')::uuid,'project.create',jsonb_build_object('receipt',jsonb_build_object('client_id',current_setting('onb26.pending')::jsonb->'input'->>'client_id','fingerprint',(current_setting('onb26.pending')::jsonb->'input')::text)));
select pg_temp.onb_assert(not exists(select 1 from app_private.onboarding_write_permits),'single-use permit consumed');
select pg_temp.onb_error(format('select app_private.onboarding_reserved_guard(%L,%L,''project.create'',%L::jsonb)',current_setting('onb26.user'),current_setting('onb26.session'),jsonb_build_object('receipt',jsonb_build_object('client_id',current_setting('onb26.pending')::jsonb->'input'->>'client_id','fingerprint',(current_setting('onb26.pending')::jsonb->'input')::text))::text),'42501');
-- Unknown diagnostic cannot outlive the personal payload deadline.
set local role service_role;
select pg_temp.onb_call('record',jsonb_build_object('roundId',current_setting('onb26.pending')::jsonb->>'roundId','intentId',current_setting('onb26.pending')::jsonb->>'intentId','intentVersion',1,'roundGeneration',current_setting('onb26.pending')::jsonb->>'roundGeneration','outcome','unknown','reason','commit_unknown'));
-- Amending a different slot changes generation without replacing this unknown.
select pg_temp.onb_call('amend',pg_temp.onb_input(gen_random_uuid())||jsonb_build_object('intentId',pg_temp.onb_round()->'receipts'->1->>'intentId','change',jsonb_build_object('kind','replace','value',(pg_temp.onb_plan()->1->'choice')||jsonb_build_object('title','Dependente corrigido')),'plan',(pg_temp.onb_plan()->1)||jsonb_build_object('input',(pg_temp.onb_plan()->1->'input')||jsonb_build_object('title','Dependente corrigido','client_id','onb:'||(pg_temp.onb_round()->>'id')||':task:'||current_setting('onb26.task')||':v2'),'choice',(pg_temp.onb_plan()->1->'choice')||jsonb_build_object('title','Dependente corrigido'))));
select pg_temp.onb_call('record',jsonb_build_object('roundId',current_setting('onb26.pending')::jsonb->>'roundId','intentId',current_setting('onb26.pending')::jsonb->>'intentId','intentVersion',1,'roundGeneration',current_setting('onb26.pending')::jsonb->>'roundGeneration','outcome','failed','reason','conflict'));
reset role;
select pg_temp.onb_assert((select status='unknown' from app_private.onboarding_intents where id=(current_setting('onb26.pending')::jsonb->>'intentId')::uuid),'late diagnostic from old generation is ignored without receipt');
update app_private.onboarding_rounds set expires_at=clock_timestamp()-interval '1 second' where id=(current_setting('onb26.pending')::jsonb->>'roundId')::uuid;
update public.user_moderation set status='blocked',must_change_password=true where user_id=current_setting('onb26.user')::uuid;
select app_private.onboarding_retention_sweep();
select pg_temp.onb_assert((select status='expired' and draft is null from app_private.onboarding_rounds where id=(current_setting('onb26.pending')::jsonb->>'roundId')::uuid),'expiry independent of login and blocked account');
select pg_temp.onb_assert(not exists(select 1 from app_private.onboarding_intents i join app_private.onboarding_rounds r on r.id=i.round_id where r.status='expired' and (i.input is not null or i.bound_input is not null or i.choice is not null or i.extras<>'{}' or i.bindings<>'[]')),'all versions physically scrubbed including unknown');
select pg_temp.onb_assert((app_private.onboarding_retention_health()->>'expiredPayloadCount')::integer=0 and (app_private.onboarding_retention_health()->>'residualPermitCount')::integer=0,'health observes payload and permits');
-- The real Admin completion trigger is the only automatic new cohort source.
update public.user_roles set role='master' where user_id=current_setting('onb26.other')::uuid;
set local role service_role;
select set_config('onb26.create_op',(public.admin_reserve(current_setting('onb26.other')::uuid,current_setting('onb26.other_session')::uuid,jsonb_build_object('command','admin.user.create','client_id','onb26-create','commitment',repeat('a',64)),current_setting('onb26.execution')::uuid)->>'operation_id'),true);
reset role;
select set_config('onb26.new',(select target_user_id::text from app_private.admin_operations where operation_id=current_setting('onb26.create_op')::uuid),true);
insert into auth.users(id,aud,role,email,banned_until,raw_app_meta_data) values(current_setting('onb26.new')::uuid,'authenticated','authenticated','onb26-new@example.invalid',now()+interval '1 day',jsonb_build_object('sc_admin_operation',current_setting('onb26.create_op')));
set constraints auth.second_brain_admin_creation_final immediate;
set constraints auth.second_brain_admin_creation_final deferred;
set local role service_role;
select public.admin_transition(current_setting('onb26.other')::uuid,current_setting('onb26.other_session')::uuid,current_setting('onb26.create_op')::uuid,'auth_applied',current_setting('onb26.execution')::uuid);
select public.admin_transition(current_setting('onb26.other')::uuid,current_setting('onb26.other_session')::uuid,current_setting('onb26.create_op')::uuid,'revoked',current_setting('onb26.execution')::uuid);
reset role;
update auth.users set banned_until=null where id=current_setting('onb26.new')::uuid;
set local role service_role;
select public.admin_complete(current_setting('onb26.other')::uuid,current_setting('onb26.other_session')::uuid,current_setting('onb26.create_op')::uuid,current_setting('onb26.execution')::uuid);
reset role;
select pg_temp.onb_assert((select offer_pending and source_operation=current_setting('onb26.create_op')::uuid from app_private.onboarding_entries where user_id=current_setting('onb26.new')::uuid),'verified Admin new explicit cohort');
select pg_temp.onb_assert((select count(*)=1 from public.domain_events where user_id=current_setting('onb26.new')::uuid and entity_type='onboarding_entry' and action='created'),'cohort event in real Admin transaction');
select pg_temp.onb_assert(not exists(select 1 from app_private.onboarding_entries where user_id=current_setting('onb26.user')::uuid),'existing/manual remains outside auto cohort');
select pg_temp.onb_assert(not has_function_privilege('service_role','app_private.onboarding_retention_sweep()','EXECUTE') and not has_table_privilege('service_role','app_private.onboarding_write_permits','SELECT,INSERT,UPDATE,DELETE'),'application cannot mint permits or sweep');
rollback;
