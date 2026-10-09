begin;
create function pg_temp.search_assert(ok boolean,message text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'T026 catalogue: %',message;end if;end $$;
select pg_temp.search_assert((select extnamespace='extensions'::regnamespace from pg_extension where extname='pg_trgm'),'pg_trgm in extensions');
do $$declare t text;f record;begin
 foreach t in array array['tasks','captures','knowledge_pages','fin_transactions','drive_files','projects','habits'] loop
  perform pg_temp.search_assert((select count(*)=2 and bool_and(attgenerated='s') from pg_attribute where attrelid=to_regclass('public.'||t) and attname in ('search_document','search_terms')),'generated owner search columns '||t);
  perform pg_temp.search_assert(to_regclass('public.'||t||'_global_search_idx') is not null and to_regclass('public.'||t||'_global_substring_idx') is not null,'FTS/trigram indexes '||t);
  perform pg_temp.search_assert((select relrowsecurity from pg_class where oid=to_regclass('public.'||t)),'source RLS '||t);
 end loop;
 select p.* into f from pg_proc p where p.oid='public.global_search(uuid,uuid,text)'::regprocedure;
 perform pg_temp.search_assert(f.prosecdef and exists(select 1 from unnest(f.proconfig) s where s in ('search_path=""','search_path=')),'closed search path definer');
 perform pg_temp.search_assert(has_function_privilege('service_role',f.oid,'EXECUTE') and not has_function_privilege('anon',f.oid,'EXECUTE') and not has_function_privilege('authenticated',f.oid,'EXECUTE'),'service-only guarded search');
end $$;
rollback;
