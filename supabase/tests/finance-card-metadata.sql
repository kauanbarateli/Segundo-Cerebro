-- T052 / #77. Separate disposable assertions; explicit rollback is mandatory.
begin;
set local statement_timeout='60s';
set local lock_timeout='5s';
create function pg_temp.e6_assert(ok boolean,code text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception '%',code using errcode='P0001'; end if; end $$;
create function pg_temp.e6_error(command text,expected text) returns void language plpgsql as $$
declare actual text;
begin
 begin execute command; exception when others then
  get stacked diagnostics actual=returned_sqlstate;
  if actual is distinct from expected then raise exception 'T052_SQLSTATE_EXPECTED_%_GOT_%',expected,actual; end if;
  return;
 end;
 raise exception 'T052_EXPECTED_ERROR_%',expected;
end $$;
do $$ begin
 perform pg_temp.e6_assert(current_user='postgres','T052_POSTGRES_REQUIRED');
 perform pg_temp.e6_assert(not exists(select 1 from auth.users),'T052_EMPTY_AUTH_REQUIRED');
 perform pg_temp.e6_assert(exists(select 1 from pg_constraint where conrelid='public.fin_accounts'::regclass
  and conname='fin_accounts_default_payment_owner_fk' and contype='f' and condeferrable and condeferred
  and array_length(conkey,1)=2 and array_length(confkey,1)=2),'T052_COMPOSITE_FK_REQUIRED');
 perform pg_temp.e6_assert(not has_function_privilege('anon','app_private.finance_card_metadata_guard()','EXECUTE')
  and not has_function_privilege('authenticated','app_private.finance_card_metadata_guard()','EXECUTE')
  and not has_function_privilege('service_role','app_private.finance_card_metadata_guard()','EXECUTE'),'T052_TRIGGER_ACL');
 perform pg_temp.e6_assert(not has_function_privilege('anon','public.finance_commit(uuid,uuid,text,jsonb)','EXECUTE')
  and not has_function_privilege('authenticated','public.finance_commit(uuid,uuid,text,jsonb)','EXECUTE'),'T052_RPC_ACL');
end $$;
select set_config('t052.owner','77000000-0000-4000-8000-000000000001',true),
 set_config('t052.other','77000000-0000-4000-8000-000000000002',true),
 set_config('t052.session','77000000-0000-4000-8000-000000000003',true),
 set_config('t052.other_session','77000000-0000-4000-8000-000000000004',true),
 set_config('t052.bank','77000000-0000-4000-8000-000000000005',true),
 set_config('t052.card','77000000-0000-4000-8000-000000000006',true),
 set_config('t052.foreign_bank','77000000-0000-4000-8000-000000000007',true),
 set_config('t052.archived_bank','77000000-0000-4000-8000-000000000008',true);
insert into auth.users(id,aud,role,email) values
 (current_setting('t052.owner')::uuid,'authenticated','authenticated','owner-t052@example.invalid'),
 (current_setting('t052.other')::uuid,'authenticated','authenticated','other-t052@example.invalid');
insert into auth.sessions(id,user_id) values
 (current_setting('t052.session')::uuid,current_setting('t052.owner')::uuid),
 (current_setting('t052.other_session')::uuid,current_setting('t052.other')::uuid);
create function pg_temp.e6_account(p_id uuid,p_owner uuid,p_card boolean) returns jsonb language sql as $$
 select jsonb_build_object('id',p_id,'user_id',p_owner,'name',case when p_card then 'Cartão sintético' else 'Banco sintético' end,
 'kind',case when p_card then 'credit_card' else 'checking' end,'institution',null,'currency','BRL','opening_balance_cents',0,
 'color_key','fin-1','archived_at',null,'credit_limit_cents',case when p_card then 100000 else null end,
 'statement_closing_day',case when p_card then 20 else null end,'payment_due_day',case when p_card then 5 else null end,
 'created_at','2026-10-01T12:00:00.000Z','updated_at','2026-10-01T12:00:00.000Z');
$$;
create function pg_temp.e6_snapshot() returns jsonb language sql as $$
 select jsonb_build_object(
  'accounts',coalesce((select jsonb_agg(payload order by id) from public.fin_accounts where user_id=current_setting('t052.owner')::uuid),'[]'::jsonb),
  'transactions',coalesce((select jsonb_agg(payload order by id) from public.fin_transactions where user_id=current_setting('t052.owner')::uuid),'[]'::jsonb),
  'events',coalesce((select jsonb_agg(to_jsonb(e) order by id) from public.domain_events e where user_id=current_setting('t052.owner')::uuid),'[]'::jsonb),
  'receipts',coalesce((select jsonb_agg(to_jsonb(r) order by command,client_id) from app_private.command_receipts r where user_id=current_setting('t052.owner')::uuid),'[]'::jsonb),
  'revision',public.finance_revision(current_setting('t052.owner')::uuid,current_setting('t052.session')::uuid,'finance.account.update'));
$$;
create function pg_temp.e6_request(b jsonb,a jsonb,p_client text) returns jsonb language plpgsql as $$
declare op text; input jsonb;
begin
 op:=case when b is null or b='null'::jsonb then 'finance.account.create' else 'finance.account.update' end;
 input:=jsonb_build_object('id',a->>'id','client_id',p_client,'patch',a-array['id','user_id','created_at','updated_at']);
 return jsonb_build_object('expectedRevision',public.finance_revision(current_setting('t052.owner')::uuid,current_setting('t052.session')::uuid,op),
  'context',jsonb_build_object('user_id',current_setting('t052.owner'),'canal','web'),
  'changes',jsonb_build_array(jsonb_build_object('type','finance_account','before',b,'after',a)),
  'events',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'user_id',current_setting('t052.owner'),'entity_type','finance_account','entity_id',a->>'id',
   'action',case when b is null or b='null'::jsonb then 'created' else 'updated' end,'canal','web','occurred_at','2026-10-01T12:00:00.000Z','before',b,'after',a)),
  'receipt',jsonb_build_object('user_id',current_setting('t052.owner'),'command',op,'client_id',p_client,'fingerprint',input::text,'result',a));
end $$;
insert into public.fin_accounts(payload) values
 (pg_temp.e6_account(current_setting('t052.bank')::uuid,current_setting('t052.owner')::uuid,false)),
 (pg_temp.e6_account(current_setting('t052.card')::uuid,current_setting('t052.owner')::uuid,true)),
 (pg_temp.e6_account(current_setting('t052.foreign_bank')::uuid,current_setting('t052.other')::uuid,false)),
 (pg_temp.e6_account(current_setting('t052.archived_bank')::uuid,current_setting('t052.owner')::uuid,false)||'{"archived_at":"2026-10-02T12:00:00.000Z"}'::jsonb);
-- Legacy absence is preserved in JSON, while generated columns are nullable.
select pg_temp.e6_assert((select not payload ? 'last_four' and not payload ? 'default_payment_account_id'
 and last_four is null and default_payment_account_id is null from public.fin_accounts where id=current_setting('t052.card')::uuid),'T052_LEGACY_PRESERVED');
do $$ declare b jsonb; a jsonb; request jsonb; snap jsonb; result jsonb; candidate jsonb; expected text;
begin
 select payload into b from public.fin_accounts where id=current_setting('t052.card')::uuid;
 -- Null clears a preference; it does not become an empty string or fake digits.
 a:=b||'{"last_four":null,"default_payment_account_id":null}'::jsonb;
 update public.fin_accounts set payload=a where id=current_setting('t052.card')::uuid;
 perform pg_temp.e6_assert((select payload=a and last_four is null and default_payment_account_id is null from public.fin_accounts where id=current_setting('t052.card')::uuid),'T052_NULL_PRESERVED');
 b:=a;
 a:=b||jsonb_build_object('last_four','0042','default_payment_account_id',current_setting('t052.bank'));
 request:=pg_temp.e6_request(b,a,'metadata');
 result:=public.finance_commit(current_setting('t052.owner')::uuid,current_setting('t052.session')::uuid,'finance.account.update',request);
 perform pg_temp.e6_assert(result->>'status'='committed' and result->'result'=a,'T052_METADATA_COMMIT');
 perform pg_temp.e6_assert((select last_four='0042' and default_payment_account_id=current_setting('t052.bank')::uuid and payload=a from public.fin_accounts where id=current_setting('t052.card')::uuid),'T052_GENERATED_COLUMNS');
 snap:=pg_temp.e6_snapshot();
 perform pg_temp.e6_assert(public.finance_commit(current_setting('t052.owner')::uuid,current_setting('t052.session')::uuid,'finance.account.update',request)->>'status'='replayed','T052_REPLAY');
 perform pg_temp.e6_assert(pg_temp.e6_snapshot()=snap,'T052_REPLAY_NO_DUPLICATES');
 perform pg_temp.e6_assert((select count(*)=1 from app_private.command_receipts where user_id=current_setting('t052.owner')::uuid and command='finance.account.update' and client_id='metadata'),'T052_ONE_RECEIPT');
 perform pg_temp.e6_assert((select count(*)=1 from public.domain_events where user_id=current_setting('t052.owner')::uuid and entity_type='finance_account' and entity_id=current_setting('t052.card')::uuid and "before"=b and "after"=a),'T052_EXACT_EVENT');
 perform pg_temp.e6_assert((select count(*)=0 from public.fin_transactions),'T052_NO_AUTOPAY');
 -- Each rejection also proves account/event/receipt/revision rollback.
 for candidate,expected in select * from (values
  (a||'{"last_four":"12345"}'::jsonb,'22023'),(a||'{"last_four":"１２３４"}'::jsonb,'22023'),
  (a||'{"last_four":1234}'::jsonb,'22023'),(a||'{"pan":"SYNTHETIC_CANARY"}'::jsonb,'22023'),
  (a||'{"cvv":"SYNTHETIC_CANARY"}'::jsonb,'22023'),
  (a||jsonb_build_object('default_payment_account_id',gen_random_uuid()),'23503'),
  (a||jsonb_build_object('default_payment_account_id',current_setting('t052.foreign_bank')),'23503'),
  (a||jsonb_build_object('default_payment_account_id',current_setting('t052.card')),'23503'),
  (a||jsonb_build_object('default_payment_account_id',current_setting('t052.archived_bank')),'23514'),
  -- BRL-only foundation rejects incompatible currency before the trigger.
  (a||'{"currency":"USD"}'::jsonb,'22023')) as negatives(payload,code)
 loop
  request:=pg_temp.e6_request(a,candidate,'negative-'||expected||md5(candidate::text));
  perform pg_temp.e6_error(format('select public.finance_commit(%L::uuid,%L::uuid,%L,%L::jsonb)',current_setting('t052.owner'),current_setting('t052.session'),'finance.account.update',request),expected);
  perform pg_temp.e6_assert(pg_temp.e6_snapshot()=snap,'T052_INVALID_ROLLBACK');
 end loop;
 -- The original session and compare-and-swap guards remain authoritative.
 request:=pg_temp.e6_request(a,a||'{"last_four":"0043"}'::jsonb,'stale');
 perform pg_temp.e6_error(format('select public.finance_commit(%L::uuid,%L::uuid,%L,%L::jsonb)',current_setting('t052.owner'),current_setting('t052.other_session'),'finance.account.update',request),'42501');
 perform pg_temp.e6_assert(pg_temp.e6_snapshot()=snap,'T052_FOREIGN_SESSION_ROLLBACK');
 update public.fin_accounts set payload=jsonb_set(payload,'{name}','"Banco renomeado"'::jsonb) where id=current_setting('t052.bank')::uuid;
 snap:=pg_temp.e6_snapshot();
 perform pg_temp.e6_assert(public.finance_commit(current_setting('t052.owner')::uuid,current_setting('t052.session')::uuid,'finance.account.update',request)->>'status'='stale','T052_STALE');
 perform pg_temp.e6_assert(pg_temp.e6_snapshot()=snap,'T052_STALE_NO_WRITES');
end $$;
-- A later archive does not invalidate history or force an unrelated rename to
-- assign another bank. New suggestions to that archived bank are still refused.
update public.fin_accounts set payload=payload||'{"archived_at":"2026-10-03T12:00:00.000Z"}'::jsonb where id=current_setting('t052.bank')::uuid;
update public.fin_accounts set payload=payload||'{"name":"Cartão renomeado"}'::jsonb where id=current_setting('t052.card')::uuid;
select pg_temp.e6_assert((select default_payment_account_id=current_setting('t052.bank')::uuid from public.fin_accounts where id=current_setting('t052.card')::uuid),'T052_ARCHIVED_REFERENCE_PRESERVED');
select pg_temp.e6_error(format('do $negative$ begin delete from public.fin_accounts where id=%L::uuid; set constraints fin_accounts_default_payment_owner_fk immediate; end $negative$',current_setting('t052.bank')),'23503');
select pg_temp.e6_assert(exists(select 1 from public.fin_accounts where id=current_setting('t052.bank')::uuid),'T052_FK_DELETE_ROLLBACK');
-- Deliberately fail AFTER the new row and its matching event are visible in the
-- same transaction. A failed receipt must roll all of them back, including CAS.
create function pg_temp.e6_receipt_failure() returns trigger language plpgsql as $$
begin
 if new.client_id='receipt-failure' then
  perform pg_temp.e6_assert(exists(select 1 from public.fin_accounts where user_id=new.user_id and id=current_setting('t052.card')::uuid and last_four='0099'),'T052_RECEIPT_ROW_NOT_OBSERVED');
  perform pg_temp.e6_assert(exists(select 1 from public.domain_events where user_id=new.user_id and entity_type='finance_account' and entity_id=current_setting('t052.card')::uuid and "after"->>'last_four'='0099'),'T052_RECEIPT_EVENT_NOT_OBSERVED');
  raise exception 'T052_RECEIPT_BOUNDARY_OBSERVED' using errcode='P5211';
 end if;
 return new;
end $$;
create trigger t052_receipt_failure before insert on app_private.command_receipts for each row execute function pg_temp.e6_receipt_failure();
do $$ declare b jsonb; request jsonb; snap jsonb;
begin
 select payload into b from public.fin_accounts where id=current_setting('t052.card')::uuid;
 request:=pg_temp.e6_request(b,b||'{"last_four":"0099"}'::jsonb,'receipt-failure');
 snap:=pg_temp.e6_snapshot();
 perform pg_temp.e6_error(format('select public.finance_commit(%L::uuid,%L::uuid,%L,%L::jsonb)',current_setting('t052.owner'),current_setting('t052.session'),'finance.account.update',request),'P5211');
 perform pg_temp.e6_assert(pg_temp.e6_snapshot()=snap,'T052_LATE_FAILURE_ROLLBACK');
 perform pg_temp.e6_assert((select count(*)=0 from public.fin_transactions),'T052_NO_LEDGER_CHANGE');
end $$;
rollback;
