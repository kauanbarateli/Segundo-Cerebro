-- Local disposable port of the ORIGINAL eighteen-row v2 regression mass.
-- Source: kauanbarateli/segundo_cerebro, commit a9422bcb90dc8965de4695570c9d338881e78975,
-- src/lib/regressao-financeira.test.ts; SHA256 a188e2b48b315bcb59e3e69c5556452c585c8f5df008d765f6b08502b8e1f868.
-- No historical module or migration is imported/executed. D-006 payment/status
-- rules run through the CURRENT installed schema, snapshot RPC and RLS view.
-- Identity UUIDs, empty timestamps, normalized names and color tokens are adapted;
-- literal amounts, dates, descriptions, kinds, grouping, lifecycle and deletion stay.
-- is_paid true/false maps to paid_cents amount/0; g1 becomes serie_tipo parcelamento.
-- Historical SALDOS is independent input, NOT a product of these eighteen rows.
-- The total monthly plan is installed by 017; its aggregate below remains a
-- reference query, not a claim that an aggregate SQL RPC or UI was exercised.
-- Dedicated EMPTY local Auth stub only; not a migration/seed or hosted proof.
begin;
set local statement_timeout='60s';
set local lock_timeout='5s';
do $$ begin
 if current_user<>'postgres' or to_regclass('auth.sessions') is null
    or exists(select 1 from auth.users) then
  raise exception 'Legacy financial regression requires a dedicated empty disposable Auth fixture.';
 end if;
end $$;
select set_config('fin_v2.user','f1900000-0000-4000-8000-000000000001',true),
 set_config('fin_v2.other','f1900000-0000-4000-8000-000000000002',true),
 set_config('fin_v2.session','f1900000-0000-4000-8000-000000000011',true),
 set_config('fin_v2.other_session','f1900000-0000-4000-8000-000000000012',true);
create function pg_temp.fin_v2_assert(ok boolean,message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Installed legacy v2 mass: %',message;end if;end $$;
create function pg_temp.fin_v2_error(command text,expected text) returns void language plpgsql as $$
declare actual text;begin
 begin execute command;exception when others then get stacked diagnostics actual=returned_sqlstate;
  if actual<>expected then raise exception 'Expected SQLSTATE %, got %',expected,actual;end if;return;
 end;raise exception 'Expected SQLSTATE %, statement succeeded',expected;
end $$;
create temp table fin_v2_ids(key text primary key,id uuid not null unique) on commit drop;
insert into fin_v2_ids values
 ('conta-corrente','f1900000-0000-4000-8000-000000000101'),('conta-poupanca','f1900000-0000-4000-8000-000000000102'),('cartao-nubank','f1900000-0000-4000-8000-000000000103'),
 ('cat-alimentacao','f1900000-0000-4000-8000-000000000201'),('cat-transporte','f1900000-0000-4000-8000-000000000202'),('cat-salario','f1900000-0000-4000-8000-000000000203'),
 ('b1','f1900000-0000-4000-8000-000000000301'),('b2','f1900000-0000-4000-8000-000000000302'),('plano','f1900000-0000-4000-8000-000000000303'),
 ('g1','f1900000-0000-4000-8000-000000000401'),('tg1','f1900000-0000-4000-8000-000000000402'),('tg2','f1900000-0000-4000-8000-000000000403'),
 ('r1','f1900000-0000-4000-8000-000000000501'),('r2','f1900000-0000-4000-8000-000000000502'),
 ('d1','f1900000-0000-4000-8000-000000000503'),('d2','f1900000-0000-4000-8000-000000000504'),('d3','f1900000-0000-4000-8000-000000000505'),
 ('e1','f1900000-0000-4000-8000-000000000506'),('c1','f1900000-0000-4000-8000-000000000507'),('c2','f1900000-0000-4000-8000-000000000508'),('c3','f1900000-0000-4000-8000-000000000509'),
 ('p1','f1900000-0000-4000-8000-000000000510'),('p2','f1900000-0000-4000-8000-000000000511'),('p3','f1900000-0000-4000-8000-000000000512'),
 ('t1','f1900000-0000-4000-8000-000000000513'),('t2','f1900000-0000-4000-8000-000000000514'),('f1','f1900000-0000-4000-8000-000000000515'),('f2','f1900000-0000-4000-8000-000000000516'),
 ('x1','f1900000-0000-4000-8000-000000000517'),('pl1','f1900000-0000-4000-8000-000000000518');
create function pg_temp.fin_v2_id(p_key text) returns uuid language sql stable strict as $$
 select id from pg_temp.fin_v2_ids where key=p_key $$;
create function pg_temp.fin_v2_base(p_key text) returns jsonb language sql stable strict as $$
 select jsonb_build_object('id',pg_temp.fin_v2_id(p_key),'user_id',current_setting('fin_v2.user'),
  'created_at','2026-07-01T12:00:00.000Z','updated_at','2026-07-01T12:00:00.000Z') $$;

-- The eighteen historical source rows remain visible as literal input data.
-- Missing fields in the original lanc/lancCartao helpers were null/manual/confirmed.
create temp table fin_v2_source(
 position smallint not null unique,key text primary key,account_key text not null,
 category_key text,kind text not null,amount bigint not null,occurred date not null,
 description text not null,legacy_is_paid boolean not null,status text not null,
 statement date,transfer_key text,installment_key text,installment_no smallint,
 installment_total smallint,deleted_stamp text
) on commit drop;
insert into fin_v2_source values
 (1,'r1','conta-corrente','cat-salario','income',800000,'2026-07-05','Salário',true,'confirmed',null,null,null,null,null,null),
 (2,'r2','conta-corrente',null,'income',50000,'2026-07-20','Freela',true,'confirmed',null,null,null,null,null,null),
 (3,'d1','conta-corrente','cat-alimentacao','expense',120000,'2026-07-03','Mercado',true,'confirmed',null,null,null,null,null,null),
 (4,'d2','conta-corrente','cat-transporte','expense',30000,'2026-07-08','Combustível',true,'confirmed',null,null,null,null,null,null),
 (5,'d3','conta-corrente',null,'expense',45000,'2026-07-15','Sem categoria',true,'confirmed',null,null,null,null,null,null),
 (6,'e1','conta-corrente','cat-alimentacao','income',20000,'2026-07-12','Estorno do mercado',true,'confirmed',null,null,null,null,null,null),
 (7,'c1','cartao-nubank','cat-alimentacao','expense',8490,'2026-06-25','Padaria',true,'confirmed','2026-07-01',null,null,null,null,null),
 (8,'c2','cartao-nubank','cat-transporte','expense',15000,'2026-07-10','Uber',true,'confirmed','2026-07-01',null,null,null,null,null),
 (9,'c3','cartao-nubank','cat-alimentacao','expense',30000,'2026-07-25','Restaurante',true,'confirmed','2026-08-01',null,null,null,null,null),
 (10,'p1','cartao-nubank',null,'expense',33333,'2026-07-02','Geladeira (1/3)',true,'confirmed','2026-07-01',null,'g1',1,3,null),
 (11,'p2','cartao-nubank',null,'expense',33333,'2026-07-02','Geladeira (2/3)',true,'confirmed','2026-08-01',null,'g1',2,3,null),
 (12,'p3','cartao-nubank',null,'expense',33334,'2026-07-02','Geladeira (3/3)',true,'confirmed','2026-09-01',null,'g1',3,3,null),
 (13,'t1','conta-corrente',null,'expense',200000,'2026-07-18','Para poupança',true,'confirmed',null,'tg1',null,null,null,null),
 (14,'t2','conta-poupanca',null,'income',200000,'2026-07-18','Da corrente',true,'confirmed',null,'tg1',null,null,null,null),
 (15,'f1','conta-corrente',null,'expense',40000,'2026-07-05','Pagamento da fatura',true,'confirmed',null,'tg2',null,null,null,null),
 (16,'f2','cartao-nubank',null,'income',40000,'2026-07-05','Pagamento da fatura',true,'confirmed','2026-07-01','tg2',null,null,null,null),
 (17,'x1','conta-corrente','cat-alimentacao','expense',99900,'2026-07-11','Excluído por engano',true,'confirmed',null,null,null,null,null,'2026-07-11T12:00:00Z'),
 (18,'pl1','conta-corrente','cat-transporte','expense',70000,'2026-07-28','Revisão do carro',false,'planned',null,null,null,null,null,null);
create temp table fin_v2_cases(position smallint not null unique,key text primary key,payload jsonb not null,expected_is_paid boolean not null) on commit drop;
insert into fin_v2_cases
 select position,key,pg_temp.fin_v2_base(key)||jsonb_build_object(
  'account_id',pg_temp.fin_v2_id(account_key),'category_id',pg_temp.fin_v2_id(category_key),'kind',kind,
  'amount_cents',amount,'paid_cents',case when legacy_is_paid then amount else 0 end,
  'description',description,'payee',null,'occurred_on',occurred,
  'transfer_group_id',pg_temp.fin_v2_id(transfer_key),'installment_group_id',pg_temp.fin_v2_id(installment_key),
  'installment_no',installment_no,'installment_total',installment_total,
  'serie_tipo',case when installment_key is not null then 'parcelamento' end,
  'statement_month',statement,'source','manual','status',status,'deleted_at',deleted_stamp,
  'due_date',null,'notes',null,'tag_ids','[]'::jsonb),legacy_is_paid
 from pg_temp.fin_v2_source order by position;
create temp table fin_v2_entities(kind text not null,key text not null,payload jsonb not null,primary key(kind,key)) on commit drop;
insert into fin_v2_entities
 select 'accounts',key,pg_temp.fin_v2_base(key)||jsonb_build_object('name',name,'kind',kind,'institution',null,'currency','BRL',
 'opening_balance_cents',0,'color_key','fin-1','archived_at',null,
 'credit_limit_cents',case when kind='credit_card' then 500000 end,
 'statement_closing_day',case when kind='credit_card' then 22 end,
 'payment_due_day',case when kind='credit_card' then 5 end)
 from (values ('conta-corrente','Conta corrente','checking'),('conta-poupanca','Poupança','savings'),('cartao-nubank','Nubank','credit_card')) r(key,name,kind);
insert into fin_v2_entities
 select 'categories',key,pg_temp.fin_v2_base(key)||jsonb_build_object('name',name,'normalized_name',normalized,'kind',kind,'parent_id',null,'color_key','fin-1')
 from (values ('cat-alimentacao','Alimentação','alimentacao','expense'),('cat-transporte','Transporte','transporte','expense'),('cat-salario','Salário','salario','income')) r(key,name,normalized,kind);
-- Preserve b1/b2 and the total plan. Legacy options were false; there is no new
-- rollover/include_planned product option in this port.
create temp table fin_v2_budgets(key text primary key,category_key text,month date not null,limit_cents bigint not null,rollover_enabled boolean not null,include_planned boolean not null) on commit drop;
insert into fin_v2_budgets values
 ('b1','cat-alimentacao','2026-07-01',200000,false,false),
 ('b2','cat-transporte','2026-07-01',50000,false,false),
 ('plano',null,'2026-07-01',400000,false,false);
insert into fin_v2_entities
 select 'budgets',key,pg_temp.fin_v2_base(key)||jsonb_build_object('category_id',pg_temp.fin_v2_id(category_key),'month',month,'limit_cents',limit_cents)
 from pg_temp.fin_v2_budgets;
create temp table fin_v2_legacy_balances(account_key text primary key,balance_cents bigint not null) on commit drop;
insert into fin_v2_legacy_balances values ('conta-corrente',1000000),('conta-poupanca',500000),('cartao-nubank',-120157);

insert into auth.users(id,aud,role,email,is_anonymous,created_at,updated_at) values
 (current_setting('fin_v2.user')::uuid,'authenticated','authenticated','legacy-v2-owner@example.invalid',false,now(),now()),
 (current_setting('fin_v2.other')::uuid,'authenticated','authenticated','legacy-v2-other@example.invalid',false,now(),now());
insert into auth.sessions(id,user_id,created_at,updated_at) values
 (current_setting('fin_v2.session')::uuid,current_setting('fin_v2.user')::uuid,now(),now()),
 (current_setting('fin_v2.other_session')::uuid,current_setting('fin_v2.other')::uuid,now(),now());
insert into public.fin_accounts(payload) select payload from pg_temp.fin_v2_entities where kind='accounts';
insert into public.fin_categories(payload) select payload from pg_temp.fin_v2_entities where kind='categories';
insert into public.fin_transactions(payload) select payload from pg_temp.fin_v2_cases order by position;
insert into public.fin_budgets(payload) select payload from pg_temp.fin_v2_entities where kind='budgets';
select pg_temp.fin_v2_assert((select count(*)=18 from public.fin_transactions where user_id=current_setting('fin_v2.user')::uuid),'eighteen historical rows reached installed triggers');
select pg_temp.fin_v2_assert(not exists(select 1 from pg_temp.fin_v2_cases c left join public.fin_transactions t on t.id=(c.payload->>'id')::uuid
 where t.id is null or t.user_id<>current_setting('fin_v2.user')::uuid or t.payload<>c.payload
 or t.paid_cents<>(c.payload->>'paid_cents')::bigint or t.is_paid<>c.expected_is_paid),'original payloads, lifecycle, deletion and mapped payments remain exact');
select pg_temp.fin_v2_assert((select count(*) filter(where is_paid)=17 and count(*) filter(where not is_paid)=1
 from public.fin_transactions where user_id=current_setting('fin_v2.user')::uuid),'generated flags: seventeen paid, only planned pl1 unpaid');
select pg_temp.fin_v2_assert((select deleted_at='2026-07-11T12:00:00Z'::timestamptz and payload->>'deleted_at'='2026-07-11T12:00:00Z'
 from public.fin_transactions where id=pg_temp.fin_v2_id('x1')),'soft-deleted original remains in the complete snapshot, outside real aggregates');
select pg_temp.fin_v2_assert((select status='planned' and paid_cents=0 and not is_paid and amount_cents=70000
 from public.fin_transactions where id=pg_temp.fin_v2_id('pl1')),'planned source remains planned, zero paid, without status/payment synchronization');
select pg_temp.fin_v2_assert((select count(*)=3 and sum(amount_cents)=100000 and array_agg(amount_cents order by installment_no)=array[33333,33333,33334]::bigint[]
 and bool_and(serie_tipo='parcelamento') and min(installment_total)=3 and max(installment_total)=3
 from public.fin_transactions where installment_group_id=pg_temp.fin_v2_id('g1')),'original three installments preserve one-cent remainder and grouping');

create temp table fin_v2_snapshot(payload jsonb not null) on commit drop;
do $$ declare temp_schema text;begin
 select nspname into temp_schema from pg_namespace where oid=pg_my_temp_schema();
 execute format('grant usage on schema %I to authenticated,service_role',temp_schema);
 execute format('grant execute on all functions in schema %I to authenticated,service_role',temp_schema);
end $$;
grant select on pg_temp.fin_v2_ids,pg_temp.fin_v2_cases,pg_temp.fin_v2_entities to authenticated,service_role;
grant select,insert on pg_temp.fin_v2_snapshot to service_role;
set local role service_role;
insert into pg_temp.fin_v2_snapshot select public.finance_snapshot(current_setting('fin_v2.user')::uuid,current_setting('fin_v2.session')::uuid,'read.finance');
select pg_temp.fin_v2_assert((select jsonb_array_length(payload->'accounts')=3 and jsonb_array_length(payload->'categories')=3
 and jsonb_array_length(payload->'transactions')=18 and jsonb_array_length(payload->'budgets')=3
 and payload->'tags'='[]'::jsonb and payload->'events'='[]'::jsonb and payload->'receipts'='[]'::jsonb and payload->>'revision' ~ '^[1-9][0-9]*$'
 from pg_temp.fin_v2_snapshot),'owner/session-bound snapshot contains exact v2 mass; no command-event/receipt claims');
select pg_temp.fin_v2_assert(not exists(select 1 from pg_temp.fin_v2_snapshot s cross join lateral jsonb_array_elements(s.payload->'transactions') t
 left join pg_temp.fin_v2_cases c on t->>'id'=c.payload->>'id' where c.key is null or t<>c.payload or t ? 'is_paid')
 and not exists(select 1 from pg_temp.fin_v2_snapshot s cross join pg_temp.fin_v2_cases c
 where (select count(*) from jsonb_array_elements(s.payload->'transactions') p where p->>'id'=c.payload->>'id')<>1),
 'snapshot transactions bijective and exact: all eighteen IDs once, no generated is_paid input');
select pg_temp.fin_v2_assert(not exists(select 1 from pg_temp.fin_v2_snapshot s cross join pg_temp.fin_v2_entities e
 where (select count(*) from jsonb_array_elements(s.payload->e.kind) p where p->>'id'=e.payload->>'id' and p=e.payload)<>1)
 and not exists(select 1 from pg_temp.fin_v2_snapshot s cross join (values('accounts'),('categories'),('budgets')) kinds(kind)
 cross join lateral jsonb_array_elements(s.payload->kinds.kind) p
 left join pg_temp.fin_v2_entities e on e.kind=kinds.kind and e.payload->>'id'=p->>'id'
 where e.key is null or e.payload<>p),
 'snapshot accounts/categories/budgets bijective and equal to original mapped inputs');
select pg_temp.fin_v2_error(format('select public.finance_snapshot(%L::uuid,%L::uuid,%L)',current_setting('fin_v2.user'),current_setting('fin_v2.other_session'),'read.finance'),'42501');
reset role;

select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('fin_v2.user'),'session_id',current_setting('fin_v2.session'),'role','authenticated')::text,true);
set local role authenticated;
select pg_temp.fin_v2_assert((select count(*)=3 from public.fin_account_balances),'security-invoker view sees three owned historical accounts');
select pg_temp.fin_v2_assert((select balance_cents=435000 from public.fin_account_balances where account_id=pg_temp.fin_v2_id('conta-corrente')),
 'installed cash: 800000+50000+20000-120000-30000-45000-200000-40000=435000');
select pg_temp.fin_v2_assert((select balance_cents=200000 from public.fin_account_balances where account_id=pg_temp.fin_v2_id('conta-poupanca')),'installed savings: incoming transfer200000');
select pg_temp.fin_v2_assert((select balance_cents=-113490 from public.fin_account_balances where account_id=pg_temp.fin_v2_id('cartao-nubank')),
 'installed card: -8490-15000-30000-33333-33333-33334+40000=-113490');
select pg_temp.fin_v2_assert((select sum(balance_cents)=635000 from public.fin_account_balances where kind<>'credit_card'),
 'installed wealth635000; historical supplied wealth1500000 was independent input');
select pg_temp.fin_v2_assert((select -sum(balance_cents)=113490 from public.fin_account_balances where kind='credit_card'),'installed card debt113490 differs from independent legacy SALDOS120157');
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('fin_v2.other'),'session_id',current_setting('fin_v2.other_session'),'role','authenticated')::text,true);
select pg_temp.fin_v2_assert((select count(*)=0 from public.fin_account_balances),'other local Auth actor cannot read these balances');
reset role;

-- Reference aggregates over installed columns, NOT product SQL aggregate RPCs.
create temp view fin_v2_visible as
 select t.*,a.kind account_kind,a.statement_closing_day,
  case when a.kind='credit_card' then t.statement_month else date_trunc('month',t.occurred_on)::date end competence
 from public.fin_transactions t join public.fin_accounts a on a.user_id=t.user_id and a.id=t.account_id
 where t.user_id=current_setting('fin_v2.user')::uuid and t.deleted_at is null;
create temp view fin_v2_real as select * from pg_temp.fin_v2_visible where status in ('confirmed','reconciled');
select pg_temp.fin_v2_assert((select sum(amount_cents) filter(where kind='income')=870000
 and sum(amount_cents) filter(where kind='expense')=251823
 and sum(case when kind='income' then amount_cents else -amount_cents end)=618177 and count(*)=9
 from pg_temp.fin_v2_real where transfer_group_id is null and competence='2026-07-01'),
 'D-006 July realized: income870000, expense251823, result618177, excludes planned70000');
select pg_temp.fin_v2_assert((select sum(amount_cents) filter(where kind='income')=870000
 and sum(amount_cents) filter(where kind='expense')=321823
 and sum(case when kind='income' then amount_cents else -amount_cents end)=548177 and count(*)=10
 from pg_temp.fin_v2_visible where transfer_group_id is null and competence='2026-07-01'),
 'separate legacy window/forecast oracle: expense321823 and result548177 include pl1; never the current realized expectation');
select pg_temp.fin_v2_assert((select count(*)=0 from pg_temp.fin_v2_real where transfer_group_id is null and competence='2026-06-01'),
 'June25 card purchase belongs to July assigned statement');
select pg_temp.fin_v2_assert((select sum(amount_cents)=63333 and count(*)=2 from pg_temp.fin_v2_real where transfer_group_id is null and competence='2026-08-01'),
 'August preserves c3 restaurant30000 and p2 installment33333');
select pg_temp.fin_v2_assert((select sum(amount_cents)=33334 and count(*)=1 from pg_temp.fin_v2_real where transfer_group_id is null and competence='2026-09-01'),
 'September preserves p3 remainder33334');
select pg_temp.fin_v2_assert((select sum(amount_cents)=348490 and count(*)=9 from pg_temp.fin_v2_real
 where kind='expense' and transfer_group_id is null and competence between '2026-07-01' and '2026-09-01'),
 'real quarter348490 = July251823+August63333+September33334');
select pg_temp.fin_v2_assert((select sum(amount_cents)=99900 and count(*)=1 from public.fin_transactions
 where user_id=current_setting('fin_v2.user')::uuid and deleted_at is not null)
 and not exists(select 1 from pg_temp.fin_v2_real where id=pg_temp.fin_v2_id('x1')),
 'deleted99900 is preserved in storage/snapshot but absent from real rows');
select pg_temp.fin_v2_assert((select count(*)=0 from pg_temp.fin_v2_real where account_kind='credit_card' and transfer_group_id is null and statement_month is null),
 'this original eighteen-row mass contains no actual orphan; do not invent an extra historical row');
select pg_temp.fin_v2_assert((select sum(amount_cents) filter(where transfer_group_id is null and kind='expense')=56823
 and sum(paid_cents) filter(where transfer_group_id is not null and kind='income')=40000
 and sum(case when transfer_group_id is null then case when kind='expense' then amount_cents else -amount_cents end when kind='income' then -paid_cents else 0 end)=16823
 and count(*)=4 from pg_temp.fin_v2_real where account_kind='credit_card' and statement_month='2026-07-01'),
 'July card statement: three purchases56823, payment40000, open16823');
select pg_temp.fin_v2_assert((select count(*)=2 and sum(case when kind='income' then paid_cents else -paid_cents end)=0
 from pg_temp.fin_v2_real where transfer_group_id=pg_temp.fin_v2_id('tg1')),
 'original savings transfer200000 cancels in wealth, excluded from income/expense');
select pg_temp.fin_v2_assert((select count(*)=2 and sum(case when kind='income' then paid_cents else -paid_cents end)=0
 from pg_temp.fin_v2_real where transfer_group_id=pg_temp.fin_v2_id('tg2')),
 'statement payment40000 retains cash/card legs without becoming revenue or expense');
create temp view fin_v2_spent as
 select t.category_id,sum(case when t.kind='expense' then t.amount_cents else -t.amount_cents end) spent_cents
 from pg_temp.fin_v2_real t join public.fin_categories c on c.user_id=t.user_id and c.id=t.category_id
 where t.transfer_group_id is null and t.competence='2026-07-01' and c.kind='expense' group by t.category_id;
select pg_temp.fin_v2_assert((select spent_cents=108490 from pg_temp.fin_v2_spent where category_id=pg_temp.fin_v2_id('cat-alimentacao')),
 'R1 expense-category refund: food120000+8490-20000=108490, salary/freela do not offset budget');
select pg_temp.fin_v2_assert((select spent_cents=45000 from pg_temp.fin_v2_spent where category_id=pg_temp.fin_v2_id('cat-transporte')),
 'R2 transport30000+15000=45000, excludes planned70000');
select pg_temp.fin_v2_assert((select s.spent_cents::numeric/b.limit_cents=0.9 and s.spent_cents<b.limit_cents
 from pg_temp.fin_v2_spent s join public.fin_budgets b on b.category_id=s.category_id and b.user_id=current_setting('fin_v2.user')::uuid
 where s.category_id=pg_temp.fin_v2_id('cat-transporte')),'transport budget ratio90percent, attention range80..<100, below limit');

-- Installed total-plan input; aggregate is an independent reference query,
-- not a SQL aggregate RPC, command execution or rollover/include_planned proof.
create temp view fin_v2_plan_reference as
 select (select limit_cents from public.fin_budgets where user_id=current_setting('fin_v2.user')::uuid and category_id is null and month='2026-07-01') total_cents,
  (select sum(limit_cents) from public.fin_budgets where user_id=current_setting('fin_v2.user')::uuid and category_id is not null and month='2026-07-01') allocated_cents,
  (select sum(case when t.kind='expense' then t.amount_cents when c.kind='expense' then -t.amount_cents else 0 end)
   from pg_temp.fin_v2_real t left join public.fin_categories c on c.user_id=t.user_id and c.id=t.category_id
   where t.transfer_group_id is null and t.competence='2026-07-01') used_cents;
select pg_temp.fin_v2_assert((select total_cents=400000 and used_cents=231823 and total_cents-used_cents=168177
 and allocated_cents=250000 and total_cents-allocated_cents=150000 from pg_temp.fin_v2_plan_reference),
 'installed historical total-plan input:400000-231823=168177; allocated250000/reserve150000; reference aggregate only');
select pg_temp.fin_v2_assert((select sum(balance_cents) filter(where account_key<>'cartao-nubank')=1500000
 and -sum(balance_cents) filter(where account_key='cartao-nubank')=120157
 and sum(balance_cents)=1379843 from pg_temp.fin_v2_legacy_balances),
 'independent original SALDOS input: wealth1500000/debt120157/net1379843; never assert installed view has these values');
rollback;
