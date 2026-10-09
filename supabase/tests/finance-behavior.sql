-- Prepared manual behavior assertions. NOT run by this delivery. Always ROLLBACK.
begin;
set local statement_timeout='60s';
set local lock_timeout='5s';
select set_config('t018.user',gen_random_uuid()::text,true),set_config('t018.other',gen_random_uuid()::text,true),
 set_config('t018.session',gen_random_uuid()::text,true),set_config('t018.other_session',gen_random_uuid()::text,true),
 set_config('t018.cash',gen_random_uuid()::text,true),set_config('t018.card',gen_random_uuid()::text,true),set_config('t018.group',gen_random_uuid()::text,true);
create function pg_temp.finance_assert(ok boolean,message text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'T018: %',message; end if; end $$;
create function pg_temp.finance_error(command text,expected text) returns void language plpgsql as $$ declare actual text; detail text; context text; begin
 begin execute command; exception when others then get stacked diagnostics actual=returned_sqlstate,detail=message_text,context=pg_exception_context; if actual<>expected then raise exception 'Expected %, got %: % / %',expected,actual,detail,context; end if; return; end;
 raise exception 'Expected error %, command succeeded',expected;
end $$;
create function pg_temp.finance_account(p_id uuid,p_card boolean) returns jsonb language sql as $$
 select jsonb_build_object('id',p_id,'user_id',current_setting('t018.user'),'name',case when p_card then 'Cartão sintético' else 'Conta sintética' end,
 'kind',case when p_card then 'credit_card' else 'checking' end,'institution',null,'currency','BRL','opening_balance_cents',case when p_card then 0 else 500000 end,
 'color_key','fin-1','archived_at',null,'credit_limit_cents',case when p_card then 1000000 else null end,'statement_closing_day',case when p_card then 15 else null end,
 'payment_due_day',case when p_card then 25 else null end,'created_at','2026-07-10T12:00:00.000Z','updated_at','2026-07-10T12:00:00.000Z');
$$;
create function pg_temp.finance_transaction(p_id uuid,p_account uuid,p_kind text,p_amount bigint,p_paid bigint,p_group uuid,p_statement text) returns jsonb language sql as $$
 select jsonb_build_object('id',p_id,'user_id',current_setting('t018.user'),'account_id',p_account,'category_id',null,'kind',p_kind,'amount_cents',p_amount,'paid_cents',p_paid,
 'description','Massa sintética','payee',null,'occurred_on','2026-07-10','transfer_group_id',p_group,'notes',null,'installment_group_id',null,'installment_no',null,'installment_total',null,
 'serie_tipo',null,'statement_month',p_statement,'status','confirmed','source','manual','due_date',null,'deleted_at',null,'tag_ids','[]'::jsonb,'created_at','2026-07-10T12:00:00.000Z','updated_at','2026-07-10T12:00:00.000Z');
$$;
create function pg_temp.finance_batch(op text,input jsonb,changes jsonb,result jsonb) returns jsonb language plpgsql as $$ declare events jsonb:='[]'; c jsonb; begin
 for c in select value from jsonb_array_elements(changes) loop
  events:=events||jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'user_id',current_setting('t018.user'),'entity_type',c->>'type','entity_id',c#>>'{after,id}',
   'action',case when c->'before'='null'::jsonb then 'created' else 'updated' end,'canal','web','occurred_at','2026-07-10T12:00:00.000Z','before',c->'before','after',c->'after'));
 end loop;
 return jsonb_build_object('expectedRevision',public.finance_revision(current_setting('t018.user')::uuid,current_setting('t018.session')::uuid,op),
  'context',jsonb_build_object('user_id',current_setting('t018.user'),'canal','web'),'changes',changes,'events',events,
  'receipt',jsonb_build_object('user_id',current_setting('t018.user'),'command',op,'client_id',input->>'client_id','fingerprint',input::text,'result',result));
end $$;
create function pg_temp.finance_fail_second() returns trigger language plpgsql as $$ begin
 if current_setting('t018.fail',true)='true' and new.kind='income' then raise exception 'Injected failure on second leg.' using errcode='23514'; end if; return new;
end $$;
do $$ declare schema_name text; begin
 perform pg_temp.finance_assert(current_user='postgres','owner required'); select nspname into schema_name from pg_namespace where oid=pg_my_temp_schema();
 execute format('grant usage on schema %I to authenticated,service_role',schema_name); execute format('grant execute on all functions in schema %I to authenticated,service_role',schema_name);
end $$;
insert into auth.users(id,aud,role,email,is_anonymous,created_at,updated_at) values
 (current_setting('t018.user')::uuid,'authenticated','authenticated','t018-'||current_setting('t018.user')||'@example.invalid',false,now(),now()),
 (current_setting('t018.other')::uuid,'authenticated','authenticated','t018-'||current_setting('t018.other')||'@example.invalid',false,now(),now());
insert into auth.sessions(id,user_id,created_at,updated_at) values
 (current_setting('t018.session')::uuid,current_setting('t018.user')::uuid,now(),now()),(current_setting('t018.other_session')::uuid,current_setting('t018.other')::uuid,now(),now());
-- Operator-only synthetic fixtures. No seed or installation file contains domain data.
insert into public.fin_accounts(payload) values(pg_temp.finance_account(current_setting('t018.cash')::uuid,false)),(pg_temp.finance_account(current_setting('t018.card')::uuid,true));
insert into public.fin_transactions(payload) values(pg_temp.finance_transaction(gen_random_uuid(),current_setting('t018.card')::uuid,'expense',100000,0,null,'2026-07-01'));
select pg_temp.finance_assert((select paid_cents=100000 and is_paid from public.fin_transactions where user_id=current_setting('t018.user')::uuid),'card purchase born paid by one trigger');
select pg_temp.finance_error(format('update public.fin_transactions set is_paid=false where user_id=%L::uuid',current_setting('t018.user')),'428C9');
create trigger zz_finance_injected_failure before insert on public.fin_transactions for each row execute function pg_temp.finance_fail_second();
set local role service_role;
do $$ declare debit jsonb; credit jsonb; input jsonb; result jsonb; request jsonb; snapshot jsonb; before_revision text; begin
 input:=jsonb_build_object('client_id','partial','from_account_id',current_setting('t018.cash'),'card_account_id',current_setting('t018.card'),'statement_month','2026-07-01','amount_cents',40000,'occurred_on','2026-07-10');
 debit:=pg_temp.finance_transaction(gen_random_uuid(),current_setting('t018.cash')::uuid,'expense',40000,40000,current_setting('t018.group')::uuid,null);
 credit:=pg_temp.finance_transaction(gen_random_uuid(),current_setting('t018.card')::uuid,'income',40000,40000,current_setting('t018.group')::uuid,'2026-07-01');
 result:=jsonb_build_object('group_id',current_setting('t018.group'),'transactions',jsonb_build_array(debit,credit),'charges',null);
 request:=pg_temp.finance_batch('finance.statement.pay',input,jsonb_build_array(jsonb_build_object('type','finance_transaction','before',null,'after',debit),jsonb_build_object('type','finance_transaction','before',null,'after',credit)),result);
 before_revision:=public.finance_revision(current_setting('t018.user')::uuid,current_setting('t018.session')::uuid,'finance.statement.pay');
 perform set_config('t018.fail','true',true);
 perform pg_temp.finance_error(format('select public.pay_statement(%L::uuid,%L::uuid,%L,%L::jsonb)',current_setting('t018.user'),current_setting('t018.session'),'finance.statement.pay',request),'23514');
 snapshot:=public.finance_snapshot(current_setting('t018.user')::uuid,current_setting('t018.session')::uuid,'read.finance');
 perform pg_temp.finance_assert(jsonb_array_length(snapshot->'transactions')=1 and snapshot->'receipts'='[]'::jsonb and snapshot->'events'='[]'::jsonb,'failure leaves no leg/event/receipt');
 perform pg_temp.finance_assert(snapshot->>'revision'=before_revision,'failure leaves revision unchanged');
 perform set_config('t018.fail','false',true);
 perform pg_temp.finance_error(format('select public.pay_statement(%L::uuid,%L::uuid,%L,%L::jsonb)',current_setting('t018.user'),current_setting('t018.session'),'finance.statement.pay',jsonb_set(request,'{expectedRevision}','null'::jsonb)),'22023');
 perform pg_temp.finance_assert(public.pay_statement(current_setting('t018.user')::uuid,current_setting('t018.session')::uuid,'finance.statement.pay',request)->>'status'='committed','partial payment commits');
 perform pg_temp.finance_assert(public.pay_statement(current_setting('t018.user')::uuid,current_setting('t018.session')::uuid,'finance.statement.pay',request)->>'status'='replayed','replay precedes CAS');
 snapshot:=public.finance_snapshot(current_setting('t018.user')::uuid,current_setting('t018.session')::uuid,'read.finance');
 perform pg_temp.finance_assert(jsonb_array_length(snapshot->'transactions')=3 and jsonb_array_length(snapshot->'events')=2 and jsonb_array_length(snapshot->'receipts')=1,'one atomic payment and two events');
 perform pg_temp.finance_error(format('select public.finance_snapshot(%L::uuid,%L::uuid,%L)',current_setting('t018.user'),current_setting('t018.other_session'),'read.finance'),'42501');
end $$;
reset role;
select pg_temp.finance_assert((select balance_cents=460000 from public.fin_account_balances where account_id=current_setting('t018.cash')::uuid),'cash balance after partial payment');
select pg_temp.finance_assert((select balance_cents=-60000 from public.fin_account_balances where account_id=current_setting('t018.card')::uuid),'card debt after partial payment');
set local role service_role;
do $$ declare b jsonb; a jsonb; request jsonb; begin
 b:=pg_temp.finance_account(current_setting('t018.cash')::uuid,false); a:=b||jsonb_build_object('archived_at','2026-07-11T12:00:00.000Z','updated_at','2026-07-11T12:00:00.000Z');
 request:=pg_temp.finance_batch('finance.account.close',jsonb_build_object('client_id','close','id',current_setting('t018.cash')),jsonb_build_array(jsonb_build_object('type','finance_account','before',b,'after',a)),a);
 perform pg_temp.finance_assert(public.close_account(current_setting('t018.user')::uuid,current_setting('t018.session')::uuid,'finance.account.close',request)->>'status'='committed','close archives account');
end $$;
reset role;
select pg_temp.finance_assert((select count(*)=2 from public.fin_transactions where user_id=current_setting('t018.user')::uuid and transfer_group_id=current_setting('t018.group')::uuid),'close preserves both transfer legs');
set local role authenticated;
select pg_temp.finance_error(format('select public.finance_snapshot(%L::uuid,%L::uuid,%L)',current_setting('t018.user'),current_setting('t018.session'),'read.finance'),'42501');
reset role;
rollback;
