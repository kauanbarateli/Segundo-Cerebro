-- Prepared manual assertions. NOT executed by this delivery. No migration application here.
begin;
create function pg_temp.finance_assert(ok boolean,message text) returns void language plpgsql as $$ begin
 if ok is distinct from true then raise exception 'Financial catalog: %',message; end if; end $$;
select pg_temp.finance_assert((select count(*)=6 and bool_and(relrowsecurity) from pg_class where oid=any(array['public.fin_accounts'::regclass,'public.fin_categories'::regclass,'public.fin_tags'::regclass,'public.fin_transactions'::regclass,'public.fin_transaction_tags'::regclass,'public.fin_budgets'::regclass])),'all exposed finance tables have RLS');
select pg_temp.finance_assert((select attgenerated='s' from pg_attribute where attrelid='public.fin_transactions'::regclass and attname='is_paid'),'is_paid is stored generated');
select pg_temp.finance_assert((select count(*)=1 from pg_trigger where tgrelid='public.fin_transactions'::regclass and tgname='finance_project' and not tgisinternal),'one card exception BEFORE trigger');
select pg_temp.finance_assert((select reloptions @> array['security_invoker=true'] from pg_class where oid='public.fin_account_balances'::regclass),'balance projection observes RLS');
do $$ declare name text; signature regprocedure; table_name text; begin
 foreach name in array array['finance_snapshot','finance_revision','finance_commit','transfer','pay_statement','create_series','close_account'] loop
  signature:=to_regprocedure(format('public.%I(uuid,uuid,text%s)',name,case when name in ('finance_snapshot','finance_revision') then '' else ',jsonb' end));
  perform pg_temp.finance_assert(signature is not null,'RPC exists: '||name);
  perform pg_temp.finance_assert(has_function_privilege('service_role',signature,'EXECUTE'),'server RPC grant: '||name);
  perform pg_temp.finance_assert(not has_function_privilege('authenticated',signature,'EXECUTE') and not has_function_privilege('anon',signature,'EXECUTE'),'RPC denied to browser: '||name);
  perform pg_temp.finance_assert((select not prosecdef from pg_proc where oid=signature),'public wrapper is invoker: '||name);
 end loop;
 foreach table_name in array array['fin_accounts','fin_categories','fin_tags','fin_transactions','fin_transaction_tags','fin_budgets'] loop
  perform pg_temp.finance_assert(not has_table_privilege('authenticated','public.'||table_name,'INSERT,UPDATE,DELETE') and not has_table_privilege('anon','public.'||table_name,'SELECT'),'direct finance mutations unavailable: '||table_name);
 end loop;
end $$;
rollback;
