-- Hardening do helper de infraestrutura preexistente observado no projeto pessoal.
-- Mantem funcao/OID/corpo/owner/search_path e o event trigger ensure_rls intactos.
-- Nao cria, desabilita ou substitui event triggers; nao concede acesso ao aplicativo.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $$
declare v_function oid := to_regprocedure('public.rls_auto_enable()');
begin
  if current_user <> 'postgres' then
    raise exception 'Hardening exige owner postgres.';
  end if;
  if v_function is null or not exists (
    select 1 from pg_proc p where p.oid=v_function
      and p.prorettype='event_trigger'::regtype and p.prosecdef
      and pg_get_userbyid(p.proowner)='postgres'
      and p.proconfig @> array['search_path=pg_catalog']
  ) then
    raise exception 'Helper RLS preexistente difere do contrato revisado.';
  end if;
  if not exists (
    select 1 from pg_event_trigger e where e.evtname='ensure_rls'
      and e.evtfoid=v_function and e.evtevent='ddl_command_end'
      and e.evtenabled='O' and pg_get_userbyid(e.evtowner)='postgres'
      and e.evttags @> array['CREATE TABLE','CREATE TABLE AS','SELECT INTO']
      and cardinality(e.evttags)=3
  ) then
    raise exception 'Event trigger RLS preexistente difere do contrato revisado.';
  end if;
end;
$$;

-- EventTriggerInvoke (PG17) chama a funcao pelo OID/contexto do evento; nao depende
-- de EXECUTE concedido aos papeis da API. O owner postgres conserva seu privilegio.
revoke execute on function public.rls_auto_enable()
  from public,anon,authenticated,service_role;

do $$ begin
  if has_function_privilege('anon','public.rls_auto_enable()','EXECUTE')
    or has_function_privilege('authenticated','public.rls_auto_enable()','EXECUTE')
    or has_function_privilege('service_role','public.rls_auto_enable()','EXECUTE') then
    raise exception 'Helper RLS ainda concede EXECUTE a um papel da API.';
  end if;
end $$;
commit;
