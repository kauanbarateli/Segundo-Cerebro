-- PROPOSAL ONLY. Root promotes after the exact migration is reviewed.
-- Disposable canonical PostgreSQL only. Never a hosted/project SQL Editor test.
do $draft$ begin raise exception 'DRAFT_NOT_AUTHORIZED_FOR_APPLICATION';end $draft$;
-- BEGIN PROPOSED DISPOSABLE ASSERTIONS (always rollback).
begin;
set local statement_timeout='60s';
set local lock_timeout='5s';
create function pg_temp.e7_assert(ok boolean,code text) returns void language plpgsql as $$begin
 if ok is distinct from true then raise exception '%',code;end if;end $$;
create function pg_temp.e7_error(sql text,expected text) returns void language plpgsql as $$declare actual text;begin
 begin execute sql;exception when others then get stacked diagnostics actual=returned_sqlstate;
  if actual<>expected then raise exception 'T053_EXPECTED_%_GOT_%',expected,actual;end if;return;end;
 raise exception 'T053_ERROR_NOT_OBSERVED_%',expected;end $$;
do $$begin
 perform pg_temp.e7_assert(current_user='postgres' and not exists(select 1 from auth.users),'T053_EMPTY_DISPOSABLE_REQUIRED');
 perform pg_temp.e7_assert(position('T053_INVALID_BUDGET_REPEAT' in (select prosrc from pg_proc where oid='app_private.finance_commit(uuid,uuid,text,jsonb)'::regprocedure))>0,'T053_REVIEWED_MIGRATION_REQUIRED');
end $$;
select set_config('t053.owner','78000000-0000-4000-8000-000000000001',true),set_config('t053.session','78000000-0000-4000-8000-000000000002',true),
 set_config('t053.other','78000000-0000-4000-8000-000000000003',true),set_config('t053.other_session','78000000-0000-4000-8000-000000000004',true);
insert into auth.users(id,aud,role,email) values(current_setting('t053.owner')::uuid,'authenticated','authenticated','owner-t053@example.invalid'),(current_setting('t053.other')::uuid,'authenticated','authenticated','other-t053@example.invalid');
insert into auth.sessions(id,user_id) values(current_setting('t053.session')::uuid,current_setting('t053.owner')::uuid),(current_setting('t053.other_session')::uuid,current_setting('t053.other')::uuid);
-- A valid alternative owned expense category makes the migration attack pass
-- every existing row/FK/owner check; only immutable budget-slot guards stop it.
insert into public.fin_categories(id,user_id,payload) values('78000000-0000-4000-8000-000000000005',current_setting('t053.owner')::uuid,
 jsonb_build_object('id','78000000-0000-4000-8000-000000000005','user_id',current_setting('t053.owner'),'name','Categoria sintética','normalized_name','categoria sintética','kind','expense','parent_id',null,'color_key','fin-1','created_at','2026-10-23T12:00:00.000Z','updated_at','2026-10-23T12:00:00.000Z'));
create function pg_temp.e7_snapshot() returns jsonb language sql as $$select jsonb_build_object(
 'budgets',coalesce((select jsonb_agg(payload order by id) from public.fin_budgets),'[]'),
 'events',coalesce((select jsonb_agg(to_jsonb(e) order by id) from public.domain_events e),'[]'),
 'receipts',coalesce((select jsonb_agg(to_jsonb(r) order by user_id,command,client_id) from app_private.command_receipts r),'[]'),
 'revision',public.finance_revision(current_setting('t053.owner')::uuid,current_setting('t053.session')::uuid,'finance.budget.save'));$$;
create function pg_temp.e7_request(cid text,start_month date,repetitions integer) returns jsonb language plpgsql as $$
declare changes jsonb:='[]';events jsonb:='[]';before_row jsonb;after_row jsonb;first_row jsonb;target date;input jsonb;begin
 for idx in 0..repetitions-1 loop
  target:=(start_month+make_interval(months=>idx))::date;
  select payload into before_row from public.fin_budgets where user_id=current_setting('t053.owner')::uuid and category_id is null and month=target;
  after_row:=jsonb_build_object('id',coalesce(before_row->>'id',gen_random_uuid()::text),'user_id',current_setting('t053.owner'),
   'category_id',null,'month',target::text,'limit_cents',450000,'created_at',coalesce(before_row->>'created_at','2026-10-23T12:00:00.000Z'),'updated_at','2026-10-23T12:00:00.000Z');
  if idx=0 then first_row:=after_row;end if;
  changes:=changes||jsonb_build_array(jsonb_build_object('type','finance_budget','before',before_row,'after',after_row));
  events:=events||jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'user_id',current_setting('t053.owner'),'entity_type','finance_budget','entity_id',after_row->>'id',
   'action',case when before_row is null then 'created' else 'updated' end,'canal','web','occurred_at','2026-10-23T12:00:00.000Z','before',before_row,'after',after_row));
 end loop;
 input:=jsonb_build_object('client_id',cid,'category_id',null,'month',start_month::text,'limit_cents',450000,'repeat_months',12);
 return jsonb_build_object('expectedRevision',public.finance_revision(current_setting('t053.owner')::uuid,current_setting('t053.session')::uuid,'finance.budget.save'),
  'context',jsonb_build_object('user_id',current_setting('t053.owner'),'canal','web'),'changes',changes,'events',events,
  'receipt',jsonb_build_object('user_id',current_setting('t053.owner'),'command','finance.budget.save','client_id',cid,'fingerprint',input::text,'result',first_row));
end $$;
create function pg_temp.e7_invoke(request jsonb) returns jsonb language sql as $$select public.finance_commit(current_setting('t053.owner')::uuid,current_setting('t053.session')::uuid,'finance.budget.save',request);$$;
-- Fully coherent malicious request: current BEFOREs, preserved id/created_at,
-- valid destination AFTERs, exact paired events and matching intent/result.
create function pg_temp.e7_move_slots(mode text) returns jsonb language plpgsql as $$
declare req jsonb;changes jsonb:='[]';events jsonb:='[]';before_row jsonb;after_row jsonb;event_row jsonb;intent jsonb;begin
 if mode not in ('category','month') then raise exception 'T053_ATTACK_MODE';end if;
 req:=pg_temp.e7_request('move-'||mode,case when mode='category' then '2026-10-01'::date else '2028-01-01'::date end,12);
 intent:=(req#>>'{receipt,fingerprint}')::jsonb;
 if mode='category' then intent:=jsonb_set(intent,'{category_id}','"78000000-0000-4000-8000-000000000005"');end if;
 for idx in 0..11 loop
  select payload into strict before_row from public.fin_budgets where user_id=current_setting('t053.owner')::uuid and category_id is null and month=('2026-10-01'::date+make_interval(months=>idx))::date;
  after_row:=req#>array['changes',idx::text,'after'];
  after_row:=after_row||jsonb_build_object('id',before_row->>'id','created_at',before_row->>'created_at','category_id',intent->'category_id');
  event_row:=req#>array['events',idx::text];event_row:=event_row||jsonb_build_object('entity_id',after_row->>'id','action','updated','before',before_row,'after',after_row);
  changes:=changes||jsonb_build_array(jsonb_build_object('type','finance_budget','before',before_row,'after',after_row));events:=events||jsonb_build_array(event_row);
 end loop;
 return req||jsonb_build_object('changes',changes,'events',events,'receipt',(req->'receipt')||jsonb_build_object('fingerprint',intent::text,'result',changes#>'{0,after}'));
end $$;
do $$declare req jsonb;snap jsonb;response jsonb;bad jsonb;begin
 req:=pg_temp.e7_request('copy-twelve','2026-10-01',12);response:=pg_temp.e7_invoke(req);
 perform pg_temp.e7_assert(response->>'status'='committed','T053_COMMIT');
 perform pg_temp.e7_assert((select count(*)=12 and min(month)='2026-10-01' and max(month)='2027-09-01' and count(distinct month)=12 from public.fin_budgets),'T053_TWELVE_MONTHS');
 perform pg_temp.e7_assert((select count(*)=12 from public.domain_events where entity_type='finance_budget'),'T053_TWELVE_EVENTS');
 perform pg_temp.e7_assert((select count(*)=1 from app_private.command_receipts where command='finance.budget.save'),'T053_ONE_RECEIPT');
 perform pg_temp.e7_assert((select count(*)=0 from public.fin_transactions),'T053_NO_LEDGER_EFFECT');
 snap:=pg_temp.e7_snapshot();perform pg_temp.e7_assert(pg_temp.e7_invoke(req)->>'status'='replayed','T053_REPLAY');perform pg_temp.e7_assert(pg_temp.e7_snapshot()=snap,'T053_REPLAY_UNCHANGED');
 -- A repeat cannot relocate twelve already existing limits from another slot.
 bad:=pg_temp.e7_move_slots('category');
 perform pg_temp.e7_assert(jsonb_array_length(bad->'changes')=12 and not exists(select 1 from jsonb_array_elements(bad->'changes') c where c->'before'='null'::jsonb or c#>>'{before,id}' is distinct from c#>>'{after,id}' or c#>>'{before,created_at}' is distinct from c#>>'{after,created_at}'),'T053_CATEGORY_ATTACK_COHERENT');
 perform pg_temp.e7_error(format('select pg_temp.e7_invoke(%L::jsonb)',bad),'23514');perform pg_temp.e7_assert(pg_temp.e7_snapshot()=snap,'T053_OTHER_CATEGORY_BEFORE_NO_EFFECT');
 bad:=pg_temp.e7_move_slots('month');
 perform pg_temp.e7_assert(jsonb_array_length(bad->'changes')=12 and not exists(select 1 from jsonb_array_elements(bad->'changes') c where c->'before'='null'::jsonb or c#>>'{before,id}' is distinct from c#>>'{after,id}' or c#>>'{before,created_at}' is distinct from c#>>'{after,created_at}'),'T053_MONTH_ATTACK_COHERENT');
 perform pg_temp.e7_error(format('select pg_temp.e7_invoke(%L::jsonb)',bad),'23514');perform pg_temp.e7_assert(pg_temp.e7_snapshot()=snap,'T053_OTHER_MONTH_BEFORE_NO_EFFECT');
 -- Stale CAS is rejected as stale before any batch write; same UUID/body still replays.
 bad:=pg_temp.e7_request('stale','2028-01-01',12)||'{"expectedRevision":"0"}';perform pg_temp.e7_assert(pg_temp.e7_invoke(bad)->>'status'='stale','T053_STALE');perform pg_temp.e7_assert(pg_temp.e7_snapshot()=snap,'T053_STALE_NO_EFFECT');
 -- Incomplete/excessive/discontinuous/privileged batches cannot use this opening.
 for bad in select * from (values(pg_temp.e7_request('eleven','2028-01-01',11)),(pg_temp.e7_request('thirteen','2028-01-01',13))) cases(v) loop
  perform pg_temp.e7_error(format('select pg_temp.e7_invoke(%L::jsonb)',bad),'23514');perform pg_temp.e7_assert(pg_temp.e7_snapshot()=snap,'T053_BAD_SIZE_ROLLBACK');
 end loop;
 bad:=pg_temp.e7_request('repeat-month','2028-01-01',12);bad:=jsonb_set(bad,'{changes,11,after,month}','"2028-01-01"');
 perform pg_temp.e7_error(format('select pg_temp.e7_invoke(%L::jsonb)',bad),'23514');perform pg_temp.e7_assert(pg_temp.e7_snapshot()=snap,'T053_DISCONTINUOUS_ROLLBACK');
 bad:=pg_temp.e7_request('foreign-session','2028-01-01',12);
 perform pg_temp.e7_error(format('select public.finance_commit(%L::uuid,%L::uuid,%L,%L::jsonb)',current_setting('t053.owner'),current_setting('t053.other_session'),'finance.budget.save',bad),'42501');
 perform pg_temp.e7_assert(pg_temp.e7_snapshot()=snap,'T053_FOREIGN_SESSION_NO_EFFECT');
end $$;
-- Prove rollback after eleven staged budgets, then after all budgets AND events.
create function pg_temp.e7_fail_budget() returns trigger language plpgsql as $$begin
 if new.payload->>'month'='2028-11-01' then raise exception 'T053_INJECTED_ELEVENTH' using errcode='P0001';end if;return new;end $$;
create trigger t053_fail_budget before insert or update on public.fin_budgets for each row execute function pg_temp.e7_fail_budget();
do $$declare snap jsonb;req jsonb;begin
 snap:=pg_temp.e7_snapshot();req:=pg_temp.e7_request('late-failure','2028-01-01',12);
 perform pg_temp.e7_error(format('select pg_temp.e7_invoke(%L::jsonb)',req),'P0001');perform pg_temp.e7_assert(pg_temp.e7_snapshot()=snap,'T053_LATE_BUDGET_ROLLBACK');
end $$;
drop trigger t053_fail_budget on public.fin_budgets;
create function pg_temp.e7_fail_receipt() returns trigger language plpgsql as $$begin
 if new.command='finance.budget.save' and new.client_id='receipt-failure' then
  perform pg_temp.e7_assert((select count(*)=24 from public.fin_budgets),'T053_ALL_ROWS_STAGED');
  perform pg_temp.e7_assert((select count(*)=24 from public.domain_events where entity_type='finance_budget'),'T053_ALL_EVENTS_STAGED');
  raise exception 'T053_INJECTED_RECEIPT' using errcode='P0001';end if;return new;end $$;
create trigger t053_fail_receipt before insert on app_private.command_receipts for each row execute function pg_temp.e7_fail_receipt();
do $$declare snap jsonb;req jsonb;begin
 snap:=pg_temp.e7_snapshot();req:=pg_temp.e7_request('receipt-failure','2028-01-01',12);
 perform pg_temp.e7_error(format('select pg_temp.e7_invoke(%L::jsonb)',req),'P0001');perform pg_temp.e7_assert(pg_temp.e7_snapshot()=snap,'T053_RECEIPT_ROLLBACK');
end $$;
rollback;
-- Concurrent SQL barrier tests belong to the dedicated native runner after Root
-- promotion. No single-session fixture or Promise.all above claims that proof.
