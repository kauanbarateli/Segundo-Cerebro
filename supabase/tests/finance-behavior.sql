-- Prepared manual behavior assertions. NOT run by this delivery. Always ROLLBACK.
begin;
set local statement_timeout='60s';
set local lock_timeout='5s';
select set_config('t018.user',gen_random_uuid()::text,true),set_config('t018.other',gen_random_uuid()::text,true),
 set_config('t018.session',gen_random_uuid()::text,true),set_config('t018.other_session',gen_random_uuid()::text,true),
 set_config('t018.cash',gen_random_uuid()::text,true),set_config('t018.card',gen_random_uuid()::text,true),set_config('t018.group',gen_random_uuid()::text,true),
 set_config('t018.transfer_target',gen_random_uuid()::text,true),set_config('t018.transfer_group',gen_random_uuid()::text,true);
create function pg_temp.finance_assert(ok boolean,message text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'T018: %',message; end if; end $$;
create function pg_temp.finance_error(command text,expected text,expected_message text default null) returns void language plpgsql as $$ declare actual text; detail text; context text; begin
 begin execute command; exception when others then get stacked diagnostics actual=returned_sqlstate,detail=message_text,context=pg_exception_context; if actual<>expected or (expected_message is not null and detail is distinct from expected_message) then raise exception 'Expected %, got %: % / %',expected,actual,detail,context; end if; return; end;
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
 if current_setting('t018.fail_transfer',true)='true' and new.kind='income' then
  if new.user_id is distinct from current_setting('t018.user')::uuid
   or new.transfer_group_id is distinct from current_setting('t018.transfer_group')::uuid
   or new.account_id is distinct from current_setting('t018.transfer_target')::uuid
   or (select count(*) from public.fin_transactions where user_id=new.user_id and transfer_group_id=new.transfer_group_id)<>1
   or not exists(select 1 from public.fin_transactions where user_id=new.user_id and transfer_group_id=new.transfer_group_id
    and kind='expense' and payload=current_setting('t018.transfer_debit')::jsonb) then
   raise exception 'Transfer failure did not observe the exact first leg.' using errcode='P1801';
  end if;
  raise exception 'T018_TRANSFER_SECOND_LEG_OBSERVED' using errcode='23514';
 end if;
 if current_setting('t018.fail',true)='true' and new.kind='income' then raise exception 'Injected failure on second leg.' using errcode='23514'; end if; return new;
end $$;
do $$ declare schema_name text; begin
 perform pg_temp.finance_assert(current_user='postgres','owner required');
 perform pg_temp.finance_assert(not exists(select 1 from auth.users),'Auth must be empty before local financial fixtures');
 select nspname into schema_name from pg_namespace where oid=pg_my_temp_schema();
 execute format('grant usage on schema %I to authenticated,service_role',schema_name); execute format('grant execute on all functions in schema %I to authenticated,service_role',schema_name);
end $$;
insert into auth.users(id,aud,role,email,is_anonymous,created_at,updated_at) values
 (current_setting('t018.user')::uuid,'authenticated','authenticated','t018-'||current_setting('t018.user')||'@example.invalid',false,now(),now()),
 (current_setting('t018.other')::uuid,'authenticated','authenticated','t018-'||current_setting('t018.other')||'@example.invalid',false,now(),now());
insert into auth.sessions(id,user_id,created_at,updated_at) values
 (current_setting('t018.session')::uuid,current_setting('t018.user')::uuid,now(),now()),(current_setting('t018.other_session')::uuid,current_setting('t018.other')::uuid,now(),now());
-- Operator-only synthetic fixtures. No seed or installation file contains domain data.
insert into public.fin_accounts(payload) values(pg_temp.finance_account(current_setting('t018.cash')::uuid,false)),(pg_temp.finance_account(current_setting('t018.card')::uuid,true)),
 (pg_temp.finance_account(current_setting('t018.transfer_target')::uuid,false));
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
-- Independent transfer group and third checking account preserve the payment oracles above.
do $$ declare debit jsonb; credit jsonb; input jsonb; result jsonb; request jsonb;
 before_snapshot jsonb; after_snapshot jsonb; committed_snapshot jsonb; before_revision text; begin
 input:=jsonb_build_object('client_id','transfer-independent','from_account_id',current_setting('t018.cash'),'to_account_id',current_setting('t018.transfer_target'),
  'amount_cents',5000,'occurred_on','2026-07-10','description','Transferência sintética');
 debit:=pg_temp.finance_transaction(gen_random_uuid(),current_setting('t018.cash')::uuid,'expense',5000,5000,current_setting('t018.transfer_group')::uuid,null);
 credit:=pg_temp.finance_transaction(gen_random_uuid(),current_setting('t018.transfer_target')::uuid,'income',5000,5000,current_setting('t018.transfer_group')::uuid,null);
 perform set_config('t018.transfer_debit',debit::text,true);
 perform set_config('t018.transfer_credit',credit::text,true);
 result:=jsonb_build_object('group_id',current_setting('t018.transfer_group'),'transactions',jsonb_build_array(debit,credit));
 request:=pg_temp.finance_batch('finance.transfer.create',input,jsonb_build_array(jsonb_build_object('type','finance_transaction','before',null,'after',debit),
  jsonb_build_object('type','finance_transaction','before',null,'after',credit)),result);
 before_snapshot:=public.finance_snapshot(current_setting('t018.user')::uuid,current_setting('t018.session')::uuid,'read.finance');
 before_revision:=public.finance_revision(current_setting('t018.user')::uuid,current_setting('t018.session')::uuid,'finance.transfer.create');
 perform pg_temp.finance_assert(before_snapshot->>'revision'=before_revision,'transfer baseline revision agrees');
 perform set_config('t018.fail_transfer','true',true);
 -- SQLSTATE alone could match an earlier CHECK; the unique message is emitted only after the exact debit is visible.
 perform pg_temp.finance_error(format('select public.transfer(%L::uuid,%L::uuid,%L,%L::jsonb)',current_setting('t018.user'),current_setting('t018.session'),
  'finance.transfer.create',request),'23514','T018_TRANSFER_SECOND_LEG_OBSERVED');
 after_snapshot:=public.finance_snapshot(current_setting('t018.user')::uuid,current_setting('t018.session')::uuid,'read.finance');
 perform pg_temp.finance_assert(after_snapshot=before_snapshot,'transfer second-leg failure preserves complete snapshot, events and receipts');
 perform pg_temp.finance_assert(public.finance_revision(current_setting('t018.user')::uuid,current_setting('t018.session')::uuid,'finance.transfer.create')=before_revision,
  'transfer second-leg failure preserves revision');
 perform set_config('t018.fail_transfer','false',true);
 perform pg_temp.finance_assert(public.transfer(current_setting('t018.user')::uuid,current_setting('t018.session')::uuid,'finance.transfer.create',request)=
  jsonb_build_object('status','committed','result',result),'transfer succeeds after the observed second-leg failure');
 committed_snapshot:=public.finance_snapshot(current_setting('t018.user')::uuid,current_setting('t018.session')::uuid,'read.finance');
 perform pg_temp.finance_assert(jsonb_array_length(committed_snapshot->'transactions')=jsonb_array_length(before_snapshot->'transactions')+2
  and jsonb_array_length(committed_snapshot->'events')=jsonb_array_length(before_snapshot->'events')+2
  and jsonb_array_length(committed_snapshot->'receipts')=jsonb_array_length(before_snapshot->'receipts')+1
  and (committed_snapshot->>'revision')::bigint=before_revision::bigint+5,'transfer commits two legs, two events and one receipt with their five revision bumps');
 perform pg_temp.finance_assert(exists(select 1 from jsonb_array_elements(committed_snapshot->'transactions') as item(value) where item.value=debit)
  and exists(select 1 from jsonb_array_elements(committed_snapshot->'transactions') as item(value) where item.value=credit),'transfer persists the two exact payloads');
 perform pg_temp.finance_assert(public.transfer(current_setting('t018.user')::uuid,current_setting('t018.session')::uuid,'finance.transfer.create',request)=
  jsonb_build_object('status','replayed','result',result),'transfer replay precedes CAS');
 after_snapshot:=public.finance_snapshot(current_setting('t018.user')::uuid,current_setting('t018.session')::uuid,'read.finance');
 perform pg_temp.finance_assert(after_snapshot=committed_snapshot,'transfer replay changes no data, events, receipt or revision');
end $$;
reset role;
select pg_temp.finance_assert((select balance_cents=455000 from public.fin_account_balances where account_id=current_setting('t018.cash')::uuid),'cash balance after independent transfer');
select pg_temp.finance_assert((select balance_cents=505000 from public.fin_account_balances where account_id=current_setting('t018.transfer_target')::uuid),'third checking receives independent transfer');
set local role service_role;
do $$ declare b jsonb; a jsonb; request jsonb; before_snapshot jsonb; after_snapshot jsonb; begin
 before_snapshot:=public.finance_snapshot(current_setting('t018.user')::uuid,current_setting('t018.session')::uuid,'read.finance');
 b:=pg_temp.finance_account(current_setting('t018.cash')::uuid,false); a:=b||jsonb_build_object('archived_at','2026-07-11T12:00:00.000Z','updated_at','2026-07-11T12:00:00.000Z');
 request:=pg_temp.finance_batch('finance.account.close',jsonb_build_object('client_id','close','id',current_setting('t018.cash')),jsonb_build_array(jsonb_build_object('type','finance_account','before',b,'after',a)),a);
 perform pg_temp.finance_assert(public.close_account(current_setting('t018.user')::uuid,current_setting('t018.session')::uuid,'finance.account.close',request)->>'status'='committed','close archives account');
 after_snapshot:=public.finance_snapshot(current_setting('t018.user')::uuid,current_setting('t018.session')::uuid,'read.finance');
 perform pg_temp.finance_assert(after_snapshot->'transactions'=before_snapshot->'transactions','close preserves exact transaction history from payment and independent transfer');
end $$;
reset role;
select pg_temp.finance_assert((select count(*)=2 from public.fin_transactions where user_id=current_setting('t018.user')::uuid and transfer_group_id=current_setting('t018.group')::uuid),'close preserves both transfer legs');
select pg_temp.finance_assert((select count(*)=2 from public.fin_transactions where user_id=current_setting('t018.user')::uuid and transfer_group_id=current_setting('t018.transfer_group')::uuid),'close preserves both independent transfer legs');
select pg_temp.finance_assert((select payload=current_setting('t018.transfer_credit')::jsonb from public.fin_transactions where user_id=current_setting('t018.user')::uuid
 and id=(current_setting('t018.transfer_credit')::jsonb->>'id')::uuid),'close preserves exact counterpart on surviving checking account');
select pg_temp.finance_assert((select archived_at is null from public.fin_accounts where user_id=current_setting('t018.user')::uuid and id=current_setting('t018.transfer_target')::uuid),
 'closing source does not archive the other checking account');
set local role authenticated;
select pg_temp.finance_error(format('select public.finance_snapshot(%L::uuid,%L::uuid,%L)',current_setting('t018.user'),current_setting('t018.session'),'read.finance'),'42501');
reset role;
rollback;
