-- Prepared manual assertions; transaction always rolls back. No remote execution in this delivery.
begin;
create function pg_temp.vault_assert(ok boolean,message text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'T024 catalog: %',message;end if;end $$;
select pg_temp.vault_assert((select count(*)=3 and bool_and(relrowsecurity) from pg_class where oid=any(array['public.vault_master_keys'::regclass,'public.vault_items'::regclass,'app_private.vault_revisions'::regclass])),'RLS on all vault tables');
select pg_temp.vault_assert(not exists(select 1 from pg_policy where polrelid=any(array['public.vault_master_keys'::regclass,'public.vault_items'::regclass])),'no JWT policies for keys or cipher items');
do $$declare t text;f text;signature regprocedure;begin
 foreach t in array array['public.vault_master_keys','public.vault_items','app_private.vault_revisions'] loop
  perform pg_temp.vault_assert(not has_table_privilege('authenticated',t,'SELECT,INSERT,UPDATE,DELETE') and not has_table_privilege('anon',t,'SELECT,INSERT,UPDATE,DELETE') and not has_table_privilege('service_role',t,'SELECT,INSERT,UPDATE,DELETE'),'no direct grants: '||t);
 end loop;
 foreach f in array array['vault_snapshot','vault_commit','vault_receipt'] loop
  signature:=to_regprocedure(format('public.%I(uuid,uuid,text%s)',f,case when f='vault_snapshot' then '' else ',jsonb' end));
  perform pg_temp.vault_assert(signature is not null and has_function_privilege('service_role',signature,'EXECUTE') and not has_function_privilege('authenticated',signature,'EXECUTE') and not has_function_privilege('anon',signature,'EXECUTE'),'server-only wrapper: '||f);
  perform pg_temp.vault_assert((select not prosecdef from pg_proc where oid=signature),'public wrapper invoker: '||f);
 end loop;
end $$;
select pg_temp.vault_assert(exists(select 1 from pg_constraint where conrelid='public.domain_events'::regclass and conname='vault_metadata_only'),'DB metadata-only audit guard');
select pg_temp.vault_assert(exists(select 1 from pg_constraint where conrelid='app_private.command_receipts'::regclass and conname='vault_receipt_digest_only'),'DB digest-only receipt guard');
rollback;
