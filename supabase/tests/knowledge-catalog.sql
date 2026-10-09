-- T021 catalogue assertions. Prepared only; manual AFTER migration, ROLLBACK.
begin;
set local statement_timeout='30s';
create function pg_temp.assert_true(ok boolean,message text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'T021 catalogue: %',message;end if;end $$;
select pg_temp.assert_true(current_user='postgres','owner required');
do $$ declare t text;fn record;signature regprocedure;begin
  foreach t in array array['knowledge_notebooks','knowledge_pages','page_refs','links'] loop
    perform pg_temp.assert_true((select relrowsecurity from pg_class where oid=to_regclass('public.'||t)),'RLS '||t);
    perform pg_temp.assert_true(has_table_privilege('authenticated','public.'||t,'SELECT'),'owner SELECT '||t);
    perform pg_temp.assert_true(not has_table_privilege('authenticated','public.'||t,'INSERT,UPDATE,DELETE,TRUNCATE'),'no owner DML '||t);
    perform pg_temp.assert_true(not has_table_privilege('anon','public.'||t,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'),'anon denied '||t);
    perform pg_temp.assert_true(not has_table_privilege('service_role','public.'||t,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'),'service RPC only '||t);
    perform pg_temp.assert_true((select count(*)=1 and bool_and(polcmd='r') from pg_policy where polrelid=to_regclass('public.'||t)),'SELECT policy only '||t);
    perform pg_temp.assert_true(exists(select 1 from pg_trigger where tgrelid=to_regclass('public.'||t) and tgname='knowledge_revision'),'CAS trigger '||t);
  end loop;
  for fn in select p.oid,p.proname,p.prosecdef,p.proconfig,n.nspname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','app_private') and p.proname like 'knowledge_%' loop
    signature:=fn.oid::regprocedure;
    perform pg_temp.assert_true(not has_function_privilege('anon',signature,'EXECUTE') and not has_function_privilege('authenticated',signature,'EXECUTE'),'no public privileged RPC '||signature);
    perform pg_temp.assert_true(exists(select 1 from unnest(fn.proconfig) setting where setting in ('search_path=""','search_path=')),'empty search path '||signature);
    if fn.proname in ('knowledge_snapshot','knowledge_commit','knowledge_receipt','knowledge_capture_origins') then perform pg_temp.assert_true(has_function_privilege('service_role',signature,'EXECUTE'),'service endpoint '||signature);perform pg_temp.assert_true(fn.prosecdef=(fn.nspname='app_private'),'invoker wrapper/private definer '||signature);
    else perform pg_temp.assert_true(not has_function_privilege('service_role',signature,'EXECUTE'),'helper private '||signature);end if;
  end loop;
end $$;
select pg_temp.assert_true(exists(select 1 from pg_constraint where conrelid='public.knowledge_pages'::regclass and contype='u' and pg_get_constraintdef(oid) like '%user_id, origin_capture_id%'),'unique capture promotion');
select pg_temp.assert_true(exists(select 1 from pg_trigger where tgrelid='public.captures'::regclass and tgname='knowledge_promoted_capture'),'historical capture immutable');
select pg_temp.assert_true(exists(select 1 from pg_attribute where attrelid='public.knowledge_pages'::regclass and attname='search_vector' and attgenerated='s'),'generated full text index');
select pg_temp.assert_true((select count(*)=2 and bool_and(tgdeferrable and tginitdeferred) from pg_trigger where tgname='knowledge_integrity'),'deferred tree invariant');
select pg_temp.assert_true(to_regclass('public.links_to_idx') is not null and to_regclass('public.links_from_idx') is not null and to_regclass('public.page_refs_backlinks_idx') is not null,'batch related/backlink indexes');
rollback;
