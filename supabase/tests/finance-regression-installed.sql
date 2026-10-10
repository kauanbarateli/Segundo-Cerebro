-- Local disposable regression, not a migration/seed or hosted Auth proof.
-- Field-for-field projection of tests/fixtures/finance-regression.ts: 20 rows.
-- New authored mass; the unavailable historical v2 file is NOT claimed ported.
-- Requires the local runner's empty Auth stub and all installed migrations.
begin;
set local statement_timeout='60s';
set local lock_timeout='5s';
do $$ begin
 if current_user<>'postgres' or to_regclass('auth.sessions') is null
    or exists(select 1 from auth.users) then
  raise exception 'Financial regression requires a dedicated empty disposable Auth fixture.';
 end if;
end $$;
select set_config('fin_reg.user','f1800000-0000-4000-8000-000000000001',true),
 set_config('fin_reg.other','f1800000-0000-4000-8000-000000000002',true),
 set_config('fin_reg.session','f1800000-0000-4000-8000-000000000011',true),
 set_config('fin_reg.other_session','f1800000-0000-4000-8000-000000000012',true);
create function pg_temp.fin_reg_assert(ok boolean,message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Installed financial mass: %',message;end if;end $$;
create function pg_temp.fin_reg_error(command text,expected text) returns void language plpgsql as $$
declare actual text;begin
 begin execute command;exception when others then get stacked diagnostics actual=returned_sqlstate;
  if actual<>expected then raise exception 'Expected SQLSTATE %, got %',expected,actual;end if;return;
 end;raise exception 'Expected SQLSTATE %, statement succeeded',expected;
end $$;
create temp table fin_reg_ids(key text primary key,id uuid not null unique) on commit drop;
insert into fin_reg_ids values
 ('cash','f1800000-0000-4000-8000-000000000101'),('reserve','f1800000-0000-4000-8000-000000000102'),('card','f1800000-0000-4000-8000-000000000103'),
 ('food','f1800000-0000-4000-8000-000000000201'),('bills','f1800000-0000-4000-8000-000000000202'),('salary','f1800000-0000-4000-8000-000000000203'),
 ('food-budget','f1800000-0000-4000-8000-000000000301'),
 ('transfer','f1800000-0000-4000-8000-000000000401'),('payment','f1800000-0000-4000-8000-000000000402'),
 ('installments','f1800000-0000-4000-8000-000000000403'),('recurring','f1800000-0000-4000-8000-000000000404'),
 ('salary-received','f1800000-0000-4000-8000-000000000501'),('food-cash','f1800000-0000-4000-8000-000000000502'),
 ('refund-cash','f1800000-0000-4000-8000-000000000503'),('partial-cash','f1800000-0000-4000-8000-000000000504'),
 ('purchase-card','f1800000-0000-4000-8000-000000000505'),('refund-card','f1800000-0000-4000-8000-000000000506'),
 ('transfer-out','f1800000-0000-4000-8000-000000000507'),('transfer-in','f1800000-0000-4000-8000-000000000508'),
 ('pay-out','f1800000-0000-4000-8000-000000000509'),('pay-in','f1800000-0000-4000-8000-000000000510'),
 ('planned','f1800000-0000-4000-8000-000000000511'),('pending','f1800000-0000-4000-8000-000000000512'),
 ('cancelled','f1800000-0000-4000-8000-000000000513'),('deleted','f1800000-0000-4000-8000-000000000514'),
 ('reconciled','f1800000-0000-4000-8000-000000000515'),('future-installment','f1800000-0000-4000-8000-000000000516'),
 ('future-recurring','f1800000-0000-4000-8000-000000000517'),('orphan','f1800000-0000-4000-8000-000000000518'),
 ('pending-card','f1800000-0000-4000-8000-000000000519'),('deleted-card','f1800000-0000-4000-8000-000000000520'),
 ('card-trigger-control','f1800000-0000-4000-8000-000000000599');
create function pg_temp.fin_reg_id(p_key text) returns uuid language sql stable strict as $$
 select id from pg_temp.fin_reg_ids where key=p_key $$;
create function pg_temp.fin_reg_base(p_key text) returns jsonb language sql stable strict as $$
 select jsonb_build_object('id',pg_temp.fin_reg_id(p_key),'user_id',current_setting('fin_reg.user'),
  'created_at','2026-07-10T12:00:00.000Z','updated_at','2026-07-10T12:00:00.000Z') $$;
create function pg_temp.fin_reg_tx(p_key text,p_amount bigint,p_patch jsonb default '{}') returns jsonb language sql stable as $$
 select pg_temp.fin_reg_base(p_key)||jsonb_build_object('account_id',pg_temp.fin_reg_id('cash'),'category_id',pg_temp.fin_reg_id('food'),
  'kind','expense','amount_cents',p_amount,'paid_cents',p_amount,'description',p_key,'payee',null,'occurred_on','2026-07-10',
  'transfer_group_id',null,'installment_group_id',null,'installment_no',null,'installment_total',null,'serie_tipo',null,
  'statement_month',null,'source','manual','status','confirmed','deleted_at',null,'due_date',null,'notes',null,'tag_ids','[]'::jsonb)||p_patch $$;
create temp table fin_reg_cases(position smallint not null unique,key text primary key,payload jsonb not null,expected_is_paid boolean not null) on commit drop;
insert into fin_reg_cases values
 (1,'salary-received',pg_temp.fin_reg_tx('salary-received',100000,jsonb_build_object('kind','income','category_id',pg_temp.fin_reg_id('salary'))),true),
 (2,'food-cash',pg_temp.fin_reg_tx('food-cash',10000),true),
 (3,'refund-cash',pg_temp.fin_reg_tx('refund-cash',2000,'{"kind":"income"}'),true),
 (4,'partial-cash',pg_temp.fin_reg_tx('partial-cash',5000,'{"paid_cents":2000}'),false),
 (5,'purchase-card',pg_temp.fin_reg_tx('purchase-card',20000,jsonb_build_object('account_id',pg_temp.fin_reg_id('card'),'occurred_on','2026-06-30','statement_month','2026-07-01')),true),
 (6,'refund-card',pg_temp.fin_reg_tx('refund-card',2000,jsonb_build_object('account_id',pg_temp.fin_reg_id('card'),'kind','income','statement_month','2026-07-01')),true),
 (7,'transfer-out',pg_temp.fin_reg_tx('transfer-out',7000,jsonb_build_object('transfer_group_id',pg_temp.fin_reg_id('transfer'),'category_id',null)),true),
 (8,'transfer-in',pg_temp.fin_reg_tx('transfer-in',7000,jsonb_build_object('account_id',pg_temp.fin_reg_id('reserve'),'kind','income','transfer_group_id',pg_temp.fin_reg_id('transfer'),'category_id',null)),true),
 (9,'pay-out',pg_temp.fin_reg_tx('pay-out',5000,jsonb_build_object('transfer_group_id',pg_temp.fin_reg_id('payment'),'category_id',null)),true),
 (10,'pay-in',pg_temp.fin_reg_tx('pay-in',5000,jsonb_build_object('account_id',pg_temp.fin_reg_id('card'),'kind','income','transfer_group_id',pg_temp.fin_reg_id('payment'),'category_id',null,'statement_month','2026-07-01')),true),
 (11,'planned',pg_temp.fin_reg_tx('planned',9000,'{"status":"planned","paid_cents":0}'),false),
 (12,'pending',pg_temp.fin_reg_tx('pending',8000,'{"status":"pending","paid_cents":0}'),false),
 (13,'cancelled',pg_temp.fin_reg_tx('cancelled',7000,'{"status":"cancelled","paid_cents":0}'),false),
 (14,'deleted',pg_temp.fin_reg_tx('deleted',6000,'{"deleted_at":"2026-07-10T12:00:00.000Z"}'),true),
 (15,'reconciled',pg_temp.fin_reg_tx('reconciled',3000,jsonb_build_object('status','reconciled','category_id',pg_temp.fin_reg_id('bills'))),true),
 (16,'future-installment',pg_temp.fin_reg_tx('future-installment',10001,jsonb_build_object('account_id',pg_temp.fin_reg_id('card'),'installment_group_id',pg_temp.fin_reg_id('installments'),'installment_no',1,'installment_total',12,'serie_tipo','parcelamento','statement_month','2026-08-01','occurred_on','2026-08-10')),true),
 (17,'future-recurring',pg_temp.fin_reg_tx('future-recurring',12000,jsonb_build_object('account_id',pg_temp.fin_reg_id('card'),'source','recurring','installment_group_id',pg_temp.fin_reg_id('recurring'),'installment_no',1,'installment_total',12,'serie_tipo','recorrencia','statement_month','2026-09-01','occurred_on','2026-09-10','status','planned')),true),
 (18,'orphan',pg_temp.fin_reg_tx('orphan',4000,jsonb_build_object('account_id',pg_temp.fin_reg_id('card'))),true),
 (19,'pending-card',pg_temp.fin_reg_tx('pending-card',1000,jsonb_build_object('account_id',pg_temp.fin_reg_id('card'),'statement_month','2026-07-01','status','pending')),true),
 (20,'deleted-card',pg_temp.fin_reg_tx('deleted-card',2000,jsonb_build_object('account_id',pg_temp.fin_reg_id('card'),'statement_month','2026-07-01','deleted_at','2026-07-10T12:00:00.000Z')),true);

insert into auth.users(id,aud,role,email,is_anonymous,created_at,updated_at) values
 (current_setting('fin_reg.user')::uuid,'authenticated','authenticated','financial-regression-owner@example.invalid',false,now(),now()),
 (current_setting('fin_reg.other')::uuid,'authenticated','authenticated','financial-regression-other@example.invalid',false,now(),now());
insert into auth.sessions(id,user_id,created_at,updated_at) values
 (current_setting('fin_reg.session')::uuid,current_setting('fin_reg.user')::uuid,now(),now()),
 (current_setting('fin_reg.other_session')::uuid,current_setting('fin_reg.other')::uuid,now(),now());
insert into public.fin_accounts(payload)
 select pg_temp.fin_reg_base(key)||jsonb_build_object('name',name,'kind',kind,'institution',null,'currency','BRL','opening_balance_cents',opening,
 'color_key',color,'archived_at',null,'credit_limit_cents',case when kind='credit_card' then 100000 end,
 'statement_closing_day',case when kind='credit_card' then 15 end,'payment_due_day',case when kind='credit_card' then 25 end)
 from (values ('cash','Conta corrente','checking',100000,'fin-1'),('reserve','Reserva','savings',200000,'fin-2'),('card','Cartão','credit_card',0,'fin-3')) r(key,name,kind,opening,color);
insert into public.fin_categories(payload)
 select pg_temp.fin_reg_base(key)||jsonb_build_object('name',name,'normalized_name',normalized,'kind',kind,'parent_id',null,'color_key',color)
 from (values ('food','Alimentação','alimentacao','expense','fin-1'),('bills','Contas','contas','expense','fin-2'),('salary','Receita','receita','income','fin-3')) r(key,name,normalized,kind,color);
insert into public.fin_transactions(payload) select payload from pg_temp.fin_reg_cases order by position;
insert into public.fin_budgets(payload) values(pg_temp.fin_reg_base('food-budget')||jsonb_build_object('category_id',pg_temp.fin_reg_id('food'),'month','2026-07-01','limit_cents',40000));
select pg_temp.fin_reg_assert((select count(*)=20 from public.fin_transactions where user_id=current_setting('fin_reg.user')::uuid),'all twenty cases reached installed triggers');
select pg_temp.fin_reg_assert(not exists(select 1 from pg_temp.fin_reg_cases c left join public.fin_transactions t on t.id=(c.payload->>'id')::uuid
 where t.id is null or t.payload<>c.payload or t.paid_cents<>(c.payload->>'paid_cents')::bigint or t.is_paid<>c.expected_is_paid),'mass/payment/status unchanged; sixteen paid, four unpaid');
select pg_temp.fin_reg_assert((select count(*) filter(where is_paid)=16 and count(*) filter(where not is_paid)=4 from public.fin_transactions where user_id=current_setting('fin_reg.user')::uuid),'generated payment flags include planned/pending/deleted card expenses independently of lifecycle');
select pg_temp.fin_reg_error(format('update public.fin_transactions set is_paid=false where id=%L::uuid',pg_temp.fin_reg_id('food-cash')),'428C9');
select pg_temp.fin_reg_error(format('update public.fin_transactions set payload=jsonb_set(payload,%L,%L::jsonb) where id=%L::uuid','{is_paid}','true',pg_temp.fin_reg_id('food-cash')),'22023');

-- Separate control: do NOT mutate the twenty original rows to exercise the trigger.
savepoint card_exception_control;
insert into public.fin_transactions(payload) values(pg_temp.fin_reg_tx('card-trigger-control',20000,
 jsonb_build_object('account_id',pg_temp.fin_reg_id('card'),'paid_cents',0,'status','planned','statement_month','2026-07-01')));
select pg_temp.fin_reg_assert((select paid_cents=20000 and is_paid and payload->>'paid_cents'='20000' and status='planned'
 from public.fin_transactions where id=pg_temp.fin_reg_id('card-trigger-control')),'one installed card trigger normalizes payment without changing planned status');
rollback to savepoint card_exception_control;
release savepoint card_exception_control;
select pg_temp.fin_reg_assert((select count(*)=20 from public.fin_transactions where user_id=current_setting('fin_reg.user')::uuid),'control rolled back before measuring original mass');

create temp table fin_reg_snapshot(payload jsonb not null) on commit drop;
do $$ declare temp_schema text;begin
 select nspname into temp_schema from pg_namespace where oid=pg_my_temp_schema();
 execute format('grant usage on schema %I to authenticated,service_role',temp_schema);
 execute format('grant execute on all functions in schema %I to authenticated,service_role',temp_schema);
end $$;
grant select on pg_temp.fin_reg_ids,pg_temp.fin_reg_cases to authenticated,service_role;
grant select,insert on pg_temp.fin_reg_snapshot to service_role;
set local role service_role;
insert into pg_temp.fin_reg_snapshot select public.finance_snapshot(current_setting('fin_reg.user')::uuid,current_setting('fin_reg.session')::uuid,'read.finance');
select pg_temp.fin_reg_assert((select jsonb_array_length(payload->'accounts')=3 and jsonb_array_length(payload->'categories')=3 and jsonb_array_length(payload->'transactions')=20
 and jsonb_array_length(payload->'budgets')=1 and payload->'tags'='[]'::jsonb and payload->'events'='[]'::jsonb and payload->'receipts'='[]'::jsonb and payload->>'revision' ~ '^[1-9][0-9]*$'
 from pg_temp.fin_reg_snapshot),'owner/session-bound snapshot contains exact mass, without command-event/receipt claims');
select pg_temp.fin_reg_assert(not exists(select 1 from pg_temp.fin_reg_snapshot s cross join lateral jsonb_array_elements(s.payload->'transactions') t
 left join pg_temp.fin_reg_cases c on t->>'id'=c.payload->>'id' where c.key is null or t<>c.payload or t ? 'is_paid'),'snapshot retains exact domain payload; generated column is not accepted in domain DTO');
select pg_temp.fin_reg_error(format('select public.finance_snapshot(%L::uuid,%L::uuid,%L)',current_setting('fin_reg.user'),current_setting('fin_reg.other_session'),'read.finance'),'42501');
reset role;
-- Membership + array length alone would accept repeated copies of one valid row.
-- Require the reverse mapping too: every expected ID occurs exactly once.
select pg_temp.fin_reg_assert(
 not exists(select 1 from pg_temp.fin_reg_snapshot s cross join pg_temp.fin_reg_cases c
  where (select count(*) from jsonb_array_elements(s.payload->'transactions') p where p->>'id'=c.payload->>'id')<>1)
 and not exists(select 1 from pg_temp.fin_reg_snapshot s cross join public.fin_accounts a
  where a.user_id=current_setting('fin_reg.user')::uuid and (select count(*) from jsonb_array_elements(s.payload->'accounts') p where p->>'id'=a.id::text)<>1)
 and not exists(select 1 from pg_temp.fin_reg_snapshot s cross join public.fin_categories c
  where c.user_id=current_setting('fin_reg.user')::uuid and (select count(*) from jsonb_array_elements(s.payload->'categories') p where p->>'id'=c.id::text)<>1)
 and not exists(select 1 from pg_temp.fin_reg_snapshot s cross join public.fin_budgets b
  where b.user_id=current_setting('fin_reg.user')::uuid and (select count(*) from jsonb_array_elements(s.payload->'budgets') p where p->>'id'=b.id::text)<>1),
 'snapshot is bijective: each expected transaction/account/category/budget appears once');
select pg_temp.fin_reg_assert(
 not exists(select 1 from pg_temp.fin_reg_snapshot s cross join lateral jsonb_array_elements(s.payload->'accounts') p
  left join public.fin_accounts a on a.user_id=current_setting('fin_reg.user')::uuid and a.id=(p->>'id')::uuid where a.id is null or a.payload<>p)
 and not exists(select 1 from pg_temp.fin_reg_snapshot s cross join lateral jsonb_array_elements(s.payload->'categories') p
  left join public.fin_categories c on c.user_id=current_setting('fin_reg.user')::uuid and c.id=(p->>'id')::uuid where c.id is null or c.payload<>p)
 and not exists(select 1 from pg_temp.fin_reg_snapshot s cross join lateral jsonb_array_elements(s.payload->'budgets') p
  left join public.fin_budgets b on b.user_id=current_setting('fin_reg.user')::uuid and b.id=(p->>'id')::uuid where b.id is null or b.payload<>p),
 'snapshot preserves exact installed account/category/budget payloads');

select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('fin_reg.user'),'session_id',current_setting('fin_reg.session'),'role','authenticated')::text,true);
set local role authenticated;
select pg_temp.fin_reg_assert((select count(*)=3 from public.fin_account_balances),'security-invoker view sees three owned accounts');
select pg_temp.fin_reg_assert((select balance_cents=175000 from public.fin_account_balances where account_id=pg_temp.fin_reg_id('cash')),'cash: 100000+100000+2000-10000-2000-7000-5000-3000=175000');
select pg_temp.fin_reg_assert((select balance_cents=207000 from public.fin_account_balances where account_id=pg_temp.fin_reg_id('reserve')),'reserve: 200000+7000=207000');
select pg_temp.fin_reg_assert((select balance_cents=-27001 from public.fin_account_balances where account_id=pg_temp.fin_reg_id('card')),'card: -20000+2000+5000-10001-4000=-27001; planned/pending/deleted excluded');
select pg_temp.fin_reg_assert((select sum(balance_cents)=382000 from public.fin_account_balances where kind<>'credit_card'),'cash wealth=175000+207000; debt is separate');
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('fin_reg.other'),'session_id',current_setting('fin_reg.other_session'),'role','authenticated')::text,true);
select pg_temp.fin_reg_assert((select count(*)=0 from public.fin_account_balances),'other Auth fixture cannot see first fixture balances');
reset role;

-- Independent, hand-calculated expectations over INSTALLED projected columns.
-- These reference queries do not claim the client aggregate is a SQL RPC/view.
create temp view fin_reg_real as
 select t.*,a.kind account_kind,a.statement_closing_day,
  case when a.kind='credit_card' then t.statement_month else date_trunc('month',t.occurred_on)::date end competence
 from public.fin_transactions t join public.fin_accounts a on a.user_id=t.user_id and a.id=t.account_id
 where t.user_id=current_setting('fin_reg.user')::uuid and t.deleted_at is null and t.status in ('confirmed','reconciled');
select pg_temp.fin_reg_assert((select sum(amount_cents) filter(where kind='income')=104000
 and sum(amount_cents) filter(where kind='expense')=38000
 and sum(case when kind='income' then amount_cents else -amount_cents end)=66000 and count(*)=7
 from pg_temp.fin_reg_real where transfer_group_id is null and competence='2026-07-01'),'July competence: income104000, expense38000, result66000, seven entries');
select pg_temp.fin_reg_assert((select count(*)=0 from pg_temp.fin_reg_real where transfer_group_id is null and competence='2026-06-01'),'June card purchase belongs to July statement, not purchase month');
select pg_temp.fin_reg_assert((select sum(amount_cents)=10001 and count(*)=1 from pg_temp.fin_reg_real where transfer_group_id is null and competence='2026-08-01'),'August installment preserved');
select pg_temp.fin_reg_assert((select count(*)=0 from pg_temp.fin_reg_real where transfer_group_id is null and competence='2026-09-01'),'planned recurring amount never leaks into posted September totals');
select pg_temp.fin_reg_assert((select sum(amount_cents) filter(where kind='expense')=48001 and count(*)=8 from pg_temp.fin_reg_real
 where transfer_group_id is null and competence between '2026-07-01' and '2026-09-01'),'civil-quarter coverage retains July38000+August10001');
select pg_temp.fin_reg_assert((select sum(case when t.kind='expense' then t.amount_cents else -t.amount_cents end)=31000
 from pg_temp.fin_reg_real t join public.fin_categories c on c.user_id=t.user_id and c.id=t.category_id
 where t.transfer_group_id is null and t.competence='2026-07-01' and c.kind='expense' and c.id=pg_temp.fin_reg_id('food')),'food budget: 10000-2000+5000+20000-2000=31000');
select pg_temp.fin_reg_assert((select count(*)=1 and sum(amount_cents)=4000 from pg_temp.fin_reg_real where account_kind='credit_card' and transfer_group_id is null and statement_month is null),'orphan competence is visible: one entry/4000 cents');
create temp view fin_reg_statement as
 select *,coalesce(statement_month,(date_trunc('month',occurred_on)+case when extract(day from occurred_on)>=statement_closing_day then interval '1 month' else interval '0 month' end)::date) statement
 from pg_temp.fin_reg_real where account_kind='credit_card';
select pg_temp.fin_reg_assert((select sum(case when transfer_group_id is null then case when kind='expense' then amount_cents else -amount_cents end else 0 end)=22000
 and sum(case when transfer_group_id is not null and kind='income' then paid_cents else 0 end)=5000
 and sum(case when transfer_group_id is null then case when kind='expense' then amount_cents else -amount_cents end when kind='income' then -paid_cents else 0 end)=17000
 from pg_temp.fin_reg_statement where statement='2026-07-01'),'historical statement fallback includes orphan: total22000, paid5000, open17000');
select pg_temp.fin_reg_assert((select count(*)=2 and sum(case when kind='income' then paid_cents else -paid_cents end)=0 from pg_temp.fin_reg_real where transfer_group_id=pg_temp.fin_reg_id('transfer')),'cash transfer two legs cancel without creating income/expense');
rollback;
