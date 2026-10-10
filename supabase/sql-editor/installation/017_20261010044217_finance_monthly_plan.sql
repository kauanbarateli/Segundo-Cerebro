-- 017 / T018: restore the legacy total monthly plan beside category budgets.
-- Manual application only; preserve 001-016 and existing owner/session guards.
-- NULL means the owner's total plan, never a foreign/unclassified category.
begin;
set local lock_timeout='5s';set local statement_timeout='30s';
do $$ begin
 if current_user<>'postgres' or to_regclass('public.fin_budgets') is null
  or to_regprocedure('app_private.finance_validate(text,jsonb)') is null
  or to_regprocedure('public.finance_commit(uuid,uuid,text,jsonb)') is null then
  raise exception 'Reviewed financial foundation and postgres owner required.';
 end if;
end $$;

-- MATCH SIMPLE on (user_id,category_id) deliberately skips a NULL category.
-- user_id remains NOT NULL with its independent Auth FK and unchanged RLS.
-- Present categories keep the original same-owner FK and expense-kind guard.
alter table public.fin_budgets alter column category_id drop not null;
alter table public.fin_budgets add constraint fin_budgets_category_payload_type
 check(jsonb_typeof(payload->'category_id') in ('string','null'));

-- The existing UNIQUE(user_id,category_id,month) still protects category budgets;
-- ordinary NULL semantics need this second index for one total plan per month.
create unique index fin_budgets_owner_month_plan_uidx
 on public.fin_budgets(user_id,month) where category_id is null;
comment on column public.fin_budgets.category_id is
 'NULL is the owner total monthly plan; a UUID is an expense-category budget of the same owner.';
commit;
