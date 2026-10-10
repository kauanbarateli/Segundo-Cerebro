-- Disposable local tests for 017. Auth is a dedicated empty local stub only.
-- Uses current finance_commit/snapshot/receipt guards; never historical SQL.
-- Not a migration, seed, hosted Auth or application/browser acceptance.
begin;
set local statement_timeout='60s';set local lock_timeout='5s';
do $$ begin
 if current_user<>'postgres' or to_regclass('auth.sessions') is null or exists(select 1 from auth.users) then
  raise exception 'Monthly plan tests require a dedicated empty disposable Auth fixture.';
 end if;
end $$;
select set_config('fin_plan.user','f1910000-0000-4000-8000-000000000001',true),
 set_config('fin_plan.other','f1910000-0000-4000-8000-000000000002',true),
 set_config('fin_plan.session','f1910000-0000-4000-8000-000000000011',true),
 set_config('fin_plan.other_session','f1910000-0000-4000-8000-000000000012',true);
create function pg_temp.fin_plan_assert(ok boolean,message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Monthly plan: %',message;end if;end $$;
create function pg_temp.fin_plan_error(command text,expected text) returns void language plpgsql as $$
declare actual text;begin
 begin execute command;exception when others then get stacked diagnostics actual=returned_sqlstate;
  if actual<>expected then raise exception 'Expected SQLSTATE %, got %',expected,actual;end if;return;
 end;raise exception 'Expected SQLSTATE %, statement succeeded',expected;
end $$;
create function pg_temp.fin_plan_budget(p_id uuid,p_owner uuid,p_category uuid,p_limit bigint,p_month date default '2026-07-01') returns jsonb language sql as $$
 select jsonb_build_object('id',p_id,'user_id',p_owner,'category_id',p_category,'month',p_month,'limit_cents',p_limit,
  'created_at','2026-07-01T12:00:00.000Z','updated_at','2026-07-01T12:00:00.000Z') $$;
create function pg_temp.fin_plan_request(p_user uuid,p_session uuid,p_before jsonb,p_after jsonb,p_client text,p_event uuid) returns jsonb language sql as $$
 select jsonb_build_object('expectedRevision',public.finance_revision(p_user,p_session,'finance.budget.save'),
  'context',jsonb_build_object('user_id',p_user,'canal','web'),
  'changes',jsonb_build_array(jsonb_build_object('type','finance_budget','before',p_before,'after',p_after)),
  'events',jsonb_build_array(jsonb_build_object('id',p_event,'user_id',p_user,'entity_type','finance_budget','entity_id',p_after->>'id',
   'action',case when p_before is null then 'created' else 'updated' end,'canal','web','occurred_at','2026-07-01T12:00:00.000Z','before',p_before,'after',p_after)),
  'receipt',jsonb_build_object('user_id',p_user,'command','finance.budget.save','client_id',p_client,
   'fingerprint',jsonb_build_object('client_id',p_client,'category_id',p_after->'category_id','month',p_after->'month','limit_cents',p_after->'limit_cents')::text,'result',p_after)) $$;
do $$ declare temp_schema text;begin
 select nspname into temp_schema from pg_namespace where oid=pg_my_temp_schema();
 execute format('grant usage on schema %I to authenticated,service_role',temp_schema);
 execute format('grant execute on all functions in schema %I to authenticated,service_role',temp_schema);
end $$;
insert into auth.users(id,aud,role,email,is_anonymous,created_at,updated_at) values
 (current_setting('fin_plan.user')::uuid,'authenticated','authenticated','monthly-plan-owner@example.invalid',false,now(),now()),
 (current_setting('fin_plan.other')::uuid,'authenticated','authenticated','monthly-plan-other@example.invalid',false,now(),now());
insert into auth.sessions(id,user_id,created_at,updated_at) values
 (current_setting('fin_plan.session')::uuid,current_setting('fin_plan.user')::uuid,now(),now()),
 (current_setting('fin_plan.other_session')::uuid,current_setting('fin_plan.other')::uuid,now(),now());
insert into public.fin_categories(payload)
 select jsonb_build_object('id',id,'user_id',owner,'name',name,'normalized_name',normalized,'kind',kind,'parent_id',null,'color_key','fin-1',
  'created_at','2026-07-01T12:00:00.000Z','updated_at','2026-07-01T12:00:00.000Z')
 from (values
  ('f1910000-0000-4000-8000-000000000201',current_setting('fin_plan.user'),'Despesa A','despesa a','expense'),
  ('f1910000-0000-4000-8000-000000000202',current_setting('fin_plan.user'),'Receita A','receita a','income'),
  ('f1910000-0000-4000-8000-000000000203',current_setting('fin_plan.other'),'Despesa B','despesa b','expense'),
  ('11111111-1111-4111-8111-111111111111',current_setting('fin_plan.user'),'UUID numérico','uuid numerico','expense')
 ) r(id,owner,name,normalized,kind);

set local role service_role;
do $$ declare owner uuid:=current_setting('fin_plan.user')::uuid; session uuid:=current_setting('fin_plan.session')::uuid;
 other_owner uuid:=current_setting('fin_plan.other')::uuid; other_session uuid:=current_setting('fin_plan.other_session')::uuid;
 plan jsonb; changed jsonb; category_budget jsonb; candidate jsonb; request jsonb; response jsonb; snapshot jsonb; before_snapshot jsonb; receipt jsonb;
begin
 plan:=pg_temp.fin_plan_budget('f1910000-0000-4000-8000-000000000301',owner,null,350000);
 request:=pg_temp.fin_plan_request(owner,session,null,plan,'plan-create','f1910000-0000-4000-8000-000000000401');
 response:=public.finance_commit(owner,session,'finance.budget.save',request);
 perform pg_temp.fin_plan_assert(response=jsonb_build_object('status','committed','result',plan),'NULL category total plan commits with exact result');
 snapshot:=public.finance_snapshot(owner,session,'read.finance');
 perform pg_temp.fin_plan_assert(snapshot->'budgets'=jsonb_build_array(plan) and jsonb_array_length(snapshot->'events')=1 and jsonb_array_length(snapshot->'receipts')=1,'plan, event and receipt persist atomically');
 receipt:=public.finance_receipt(owner,session,'finance.budget.save','finance.budget.save','plan-create');
 perform pg_temp.fin_plan_assert(receipt->'result'=plan and ((receipt->>'fingerprint')::jsonb)->'category_id'='null'::jsonb,'receipt retains exact NULL category fingerprint/result');
 perform pg_temp.fin_plan_assert(public.finance_commit(owner,session,'finance.budget.save',request)=jsonb_build_object('status','replayed','result',plan),'same NULL plan request replays before stale CAS');
 perform pg_temp.fin_plan_assert(public.finance_snapshot(owner,session,'read.finance')=snapshot,'replay adds no plan/event/receipt/revision');

 changed:=plan||jsonb_build_object('limit_cents',400000,'updated_at','2026-07-02T12:00:00.000Z');
 request:=pg_temp.fin_plan_request(owner,session,plan,changed,'plan-update','f1910000-0000-4000-8000-000000000402');
 perform pg_temp.fin_plan_assert(public.finance_commit(owner,session,'finance.budget.save',request)=jsonb_build_object('status','committed','result',changed),'existing plan updates with same identity and NULL category');
 snapshot:=public.finance_snapshot(owner,session,'read.finance');
 perform pg_temp.fin_plan_assert(snapshot->'budgets'=jsonb_build_array(changed) and jsonb_array_length(snapshot->'events')=2 and jsonb_array_length(snapshot->'receipts')=2,'updated plan and second event/receipt are exact');

 category_budget:=pg_temp.fin_plan_budget('f1910000-0000-4000-8000-000000000302',owner,'f1910000-0000-4000-8000-000000000201',200000);
 request:=pg_temp.fin_plan_request(owner,session,null,category_budget,'category-create','f1910000-0000-4000-8000-000000000403');
 perform pg_temp.fin_plan_assert(public.finance_commit(owner,session,'finance.budget.save',request)=jsonb_build_object('status','committed','result',category_budget),'ordinary category budget coexists with total plan');
 before_snapshot:=public.finance_snapshot(owner,session,'read.finance');
 candidate:=pg_temp.fin_plan_budget('f1910000-0000-4000-8000-000000000303',owner,null,500000);
 request:=pg_temp.fin_plan_request(owner,session,null,candidate,'plan-duplicate','f1910000-0000-4000-8000-000000000404');
 perform pg_temp.fin_plan_error(format('select public.finance_commit(%L::uuid,%L::uuid,%L,%L::jsonb)',owner,session,'finance.budget.save',request),'23505');
 perform pg_temp.fin_plan_assert(public.finance_snapshot(owner,session,'read.finance')=before_snapshot,'duplicate owner/month total plan rolls back row/event/receipt/revision');
 candidate:=pg_temp.fin_plan_budget('f1910000-0000-4000-8000-000000000303',owner,'f1910000-0000-4000-8000-000000000201',250000);
 request:=pg_temp.fin_plan_request(owner,session,null,candidate,'category-duplicate','f1910000-0000-4000-8000-000000000404');
 perform pg_temp.fin_plan_error(format('select public.finance_commit(%L::uuid,%L::uuid,%L,%L::jsonb)',owner,session,'finance.budget.save',request),'23505');
 perform pg_temp.fin_plan_assert(public.finance_snapshot(owner,session,'read.finance')=before_snapshot,'existing per-category uniqueness and rollback stay intact');

 candidate:=pg_temp.fin_plan_budget('f1910000-0000-4000-8000-000000000303',owner,'f1910000-0000-4000-8000-000000000202',1000);
 request:=pg_temp.fin_plan_request(owner,session,null,candidate,'income-category','f1910000-0000-4000-8000-000000000404');
 perform pg_temp.fin_plan_error(format('select public.finance_commit(%L::uuid,%L::uuid,%L,%L::jsonb)',owner,session,'finance.budget.save',request),'23514');
 candidate:=pg_temp.fin_plan_budget('f1910000-0000-4000-8000-000000000303',owner,'f1910000-0000-4000-8000-000000000203',1000);
 request:=pg_temp.fin_plan_request(owner,session,null,candidate,'foreign-category','f1910000-0000-4000-8000-000000000404');
 perform pg_temp.fin_plan_error(format('select public.finance_commit(%L::uuid,%L::uuid,%L,%L::jsonb)',owner,session,'finance.budget.save',request),'23503');
 candidate:=pg_temp.fin_plan_budget('f1910000-0000-4000-8000-000000000303',other_owner,null,1000);
 request:=pg_temp.fin_plan_request(owner,session,null,candidate,'foreign-owner','f1910000-0000-4000-8000-000000000404');
 perform pg_temp.fin_plan_error(format('select public.finance_commit(%L::uuid,%L::uuid,%L,%L::jsonb)',owner,session,'finance.budget.save',request),'42501');
 perform pg_temp.fin_plan_error(format('select public.finance_snapshot(%L::uuid,%L::uuid,%L)',owner,other_session,'read.finance'),'42501');
 perform pg_temp.fin_plan_assert(public.finance_snapshot(owner,session,'read.finance')=before_snapshot,'expense-category/owner/session refusals preserve complete state');

 -- JSON numeric UUID could otherwise pass ->> plus uuid cast and the own FK.
 -- Preserve the required-key/closed-key checks while only allowing string/null.
 candidate:=pg_temp.fin_plan_budget('f1910000-0000-4000-8000-000000000303',owner,null,1000,'2026-08-01');
 request:=pg_temp.fin_plan_request(owner,session,null,candidate-'category_id','missing-category','f1910000-0000-4000-8000-000000000404');
 perform pg_temp.fin_plan_error(format('select public.finance_commit(%L::uuid,%L::uuid,%L,%L::jsonb)',owner,session,'finance.budget.save',request),'22023');
 request:=pg_temp.fin_plan_request(owner,session,null,candidate||'{"include_planned":false}'::jsonb,'unknown-key','f1910000-0000-4000-8000-000000000404');
 perform pg_temp.fin_plan_error(format('select public.finance_commit(%L::uuid,%L::uuid,%L,%L::jsonb)',owner,session,'finance.budget.save',request),'22023');
 request:=pg_temp.fin_plan_request(owner,session,null,jsonb_set(candidate,'{category_id}','11111111111141118111111111111111'::jsonb),'numeric-category','f1910000-0000-4000-8000-000000000404');
 perform pg_temp.fin_plan_error(format('select public.finance_commit(%L::uuid,%L::uuid,%L,%L::jsonb)',owner,session,'finance.budget.save',request),'23514');
 request:=pg_temp.fin_plan_request(owner,session,null,jsonb_set(candidate,'{limit_cents}','0'::jsonb),'zero-limit','f1910000-0000-4000-8000-000000000404');
 perform pg_temp.fin_plan_error(format('select public.finance_commit(%L::uuid,%L::uuid,%L,%L::jsonb)',owner,session,'finance.budget.save',request),'22023');
 request:=pg_temp.fin_plan_request(owner,session,null,jsonb_set(candidate,'{month}','"2026-08-02"'::jsonb),'non-month','f1910000-0000-4000-8000-000000000404');
 perform pg_temp.fin_plan_error(format('select public.finance_commit(%L::uuid,%L::uuid,%L,%L::jsonb)',owner,session,'finance.budget.save',request),'22023');
 perform pg_temp.fin_plan_assert(public.finance_snapshot(owner,session,'read.finance')=before_snapshot,'invalid categories/extra keys/centavos/month leave no data/event/receipt');

 candidate:=changed||jsonb_build_object('limit_cents',450000,'updated_at','2026-07-03T12:00:00.000Z');
 request:=pg_temp.fin_plan_request(owner,session,changed,candidate,'plan-stale','f1910000-0000-4000-8000-000000000404');
 perform pg_temp.fin_plan_assert(public.finance_commit(owner,session,'finance.budget.save',jsonb_set(request,'{expectedRevision}','"0"'::jsonb))=jsonb_build_object('status','stale'),
  'stale total-plan CAS is refused before writing');
 request:=pg_temp.fin_plan_request(owner,session,changed,candidate,'plan-update','f1910000-0000-4000-8000-000000000404');
 perform pg_temp.fin_plan_error(format('select public.finance_commit(%L::uuid,%L::uuid,%L,%L::jsonb)',owner,session,'finance.budget.save',request),'23505');
 perform pg_temp.fin_plan_assert(public.finance_snapshot(owner,session,'read.finance')=before_snapshot,'stale CAS and different fingerprint/client_id reuse preserve complete state');

 candidate:=pg_temp.fin_plan_budget('f1910000-0000-4000-8000-000000000303',other_owner,null,600000);
 request:=pg_temp.fin_plan_request(other_owner,other_session,null,candidate,'other-plan','f1910000-0000-4000-8000-000000000404');
 perform pg_temp.fin_plan_assert(public.finance_commit(other_owner,other_session,'finance.budget.save',request)=jsonb_build_object('status','committed','result',candidate),'different owner can have own total plan in same month');
 perform pg_temp.fin_plan_assert(public.finance_snapshot(owner,session,'read.finance')=before_snapshot,'other owner total plan never enters first owner snapshot');
 perform pg_temp.fin_plan_assert(public.finance_snapshot(other_owner,other_session,'read.finance')->'budgets'=jsonb_build_array(candidate),'other snapshot returns only its exact plan');

 candidate:=pg_temp.fin_plan_budget('f1910000-0000-4000-8000-000000000304',owner,null,450000,'2026-08-01');
 request:=pg_temp.fin_plan_request(owner,session,null,candidate,'next-month-plan','f1910000-0000-4000-8000-000000000405');
 perform pg_temp.fin_plan_assert(public.finance_commit(owner,session,'finance.budget.save',request)=jsonb_build_object('status','committed','result',candidate),
  'same owner can have a separate NULL total plan in another month');
end $$;
reset role;
select pg_temp.fin_plan_assert((select count(*)=2 from public.fin_budgets where category_id is null and month='2026-07-01'),'one NULL plan per each owner, same month');
select pg_temp.fin_plan_assert((select count(*)=1 and min(limit_cents)=450000 from public.fin_budgets
 where user_id=current_setting('fin_plan.user')::uuid and category_id is null and month='2026-08-01'),'owner/month uniqueness preserves independent future plan');
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('fin_plan.user'),'session_id',current_setting('fin_plan.session'),'role','authenticated')::text,true);
set local role authenticated;
select pg_temp.fin_plan_assert((select count(*)=3 and count(*) filter(where category_id is null)=2 and bool_and(user_id=current_setting('fin_plan.user')::uuid) from public.fin_budgets),
 'RLS authenticated owner sees own two monthly plans and category only');
select pg_temp.fin_plan_error('insert into public.fin_budgets(payload) values(''{}''::jsonb)','42501');
select pg_temp.fin_plan_error('update public.fin_budgets set limit_cents=1','42501');
select pg_temp.fin_plan_error('delete from public.fin_budgets','42501');
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('fin_plan.other'),'session_id',current_setting('fin_plan.other_session'),'role','authenticated')::text,true);
select pg_temp.fin_plan_assert((select count(*)=1 and bool_and(category_id is null and user_id=current_setting('fin_plan.other')::uuid) from public.fin_budgets),
 'other authenticated actor sees only own total plan');
reset role;
rollback;
