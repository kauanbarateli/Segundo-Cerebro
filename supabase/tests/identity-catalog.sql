-- T013: ASSERCOES DE CATALOGO PARA EXECUCAO MANUAL FUTURA EM BANCO.
-- NAO EXECUTADO. Requer 20261007082811_identity_foundation.sql aplicado em projeto novo autorizado.
-- Nao aplicar via CI/build/deploy. Este arquivo termina com ROLLBACK.
begin;
set local statement_timeout = '30s';

create function pg_temp.assert_true(ok boolean, message text) returns void
language plpgsql as $$ begin
  if ok is distinct from true then raise exception 'T013: %',message; end if;
end $$;

select pg_temp.assert_true((select count(*)=9 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where c.relkind='r' and ((n.nspname='public' and c.relname=any(array['profiles','user_preferences','user_modules','user_roles','user_moderation','user_entitlements','domain_events']))
  or (n.nspname='app_private' and c.relname=any(array['command_receipts','rate_limits'])))), 'nove tabelas do recorte existem');

do $$ declare t record; begin
  for t in select c.oid,c.relname,c.relrowsecurity,n.nspname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where c.relkind='r' and ((n.nspname='public' and c.relname=any(array['profiles','user_preferences','user_modules','user_roles','user_moderation','user_entitlements','domain_events']))
    or n.nspname='app_private') loop
    perform pg_temp.assert_true(t.relrowsecurity,'RLS em '||t.relname);
    perform pg_temp.assert_true(not has_table_privilege('anon',t.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'),'anon fechado: '||t.relname);
    perform pg_temp.assert_true(not has_table_privilege('authenticated',t.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'),'dono sem DML direto: '||t.relname);
    perform pg_temp.assert_true(not has_table_privilege('service_role',t.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'),'service sem DML direto: '||t.relname);
    if t.nspname='app_private' or t.relname='user_moderation' then
      perform pg_temp.assert_true(not has_table_privilege('authenticated',t.oid,'SELECT'),'leitura privada: '||t.relname);
      perform pg_temp.assert_true(not exists(select 1 from pg_policy where polrelid=t.oid),'tabela privada sem policies: '||t.relname);
    else
      perform pg_temp.assert_true(has_table_privilege('authenticated',t.oid,'SELECT'),'leitura do dono: '||t.relname);
      perform pg_temp.assert_true((select count(*)=1 from pg_policy where polrelid=t.oid and polname='own_read' and polcmd='r'),'uma policy SELECT: '||t.relname);
      perform pg_temp.assert_true(not exists(select 1 from pg_policy where polrelid=t.oid and (polcmd<>'r' or polname<>'own_read')),'sem policy adicional: '||t.relname);
    end if;
  end loop;
end $$;
select pg_temp.assert_true(not has_table_privilege('service_role','public.domain_events','SELECT'),'admin sem leitura de conteudo de eventos');
select pg_temp.assert_true(not has_table_privilege('service_role','app_private.command_receipts','SELECT'),'recibos privados');
select pg_temp.assert_true(not has_table_privilege('service_role','app_private.rate_limits','SELECT'),'limites por RPC');

do $$ declare f record; begin
  for f in select p.oid,p.proname,p.prosecdef,p.proconfig,n.nspname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='app_private' or (n.nspname='public' and p.proname=any(array['update_identity','my_access_state','bootstrap_master','consume_rate_limit','prune_operational_data'])) loop
    perform pg_temp.assert_true(not has_function_privilege('anon',f.oid,'EXECUTE'),'anon sem EXECUTE: '||f.proname);
    perform pg_temp.assert_true(exists(select 1 from unnest(f.proconfig) s where s in ('search_path=""','search_path=')),'search_path vazio: '||f.proname);
    perform pg_temp.assert_true(f.prosecdef=(f.nspname='app_private'),'definer somente privado: '||f.proname);
  end loop;
end $$;
select pg_temp.assert_true(has_function_privilege('authenticated','public.update_identity(text,jsonb,text,text)','EXECUTE'),'RPC identidade concedida');
select pg_temp.assert_true(has_function_privilege('authenticated','app_private.current_user_active()','EXECUTE'),'helper RLS executavel pelo dono');
select pg_temp.assert_true(not has_function_privilege('authenticated','app_private.append_event(uuid,text,uuid,text,text,jsonb,jsonb)','EXECUTE'),'dono nao fabrica eventos');
select pg_temp.assert_true(to_regprocedure('public.admin_identity(uuid,uuid,uuid,text,jsonb,text)') is null,'administracao avancada fica para T017');
select pg_temp.assert_true(not has_function_privilege('authenticated','public.bootstrap_master(uuid)','EXECUTE'),'dono nao escolhe master');
select pg_temp.assert_true(not has_function_privilege('service_role','app_private.consume_rate_limit_at(text,text,uuid,timestamp with time zone)','EXECUTE'),'relogio do limiter nao vem do canal');
select pg_temp.assert_true(has_function_privilege('service_role','public.consume_rate_limit(text,text,uuid,uuid)','EXECUTE'),'limiter operacional concedido');
select pg_temp.assert_true(exists(select 1 from pg_trigger where tgrelid='auth.users'::regclass and tgname='second_brain_identity_created' and not tgisinternal),'provisionamento Auth instalado');
select pg_temp.assert_true(exists(select 1 from pg_indexes where schemaname='public' and indexname='domain_events_user_time_idx'),'indice dono/tempo');
select pg_temp.assert_true(exists(select 1 from pg_indexes where schemaname='public' and indexname='domain_events_retention_idx'),'indice retencao');

-- Objetos descartaveis conferem defaults efetivos globais E por schema do owner.
create table public.t013_acl_probe (value text);
create function public.t013_acl_probe() returns boolean language sql set search_path='' as $$ select true; $$;
select pg_temp.assert_true(not has_table_privilege('anon','public.t013_acl_probe','SELECT,INSERT,UPDATE,DELETE'),'default tabela fecha anon');
select pg_temp.assert_true(not has_table_privilege('authenticated','public.t013_acl_probe','SELECT,INSERT,UPDATE,DELETE'),'default tabela fecha authenticated');
select pg_temp.assert_true(not has_table_privilege('service_role','public.t013_acl_probe','SELECT,INSERT,UPDATE,DELETE'),'default tabela fecha service');
select pg_temp.assert_true(not has_function_privilege('anon','public.t013_acl_probe()','EXECUTE'),'default funcao fecha PUBLIC/anon');
select pg_temp.assert_true(not has_function_privilege('authenticated','public.t013_acl_probe()','EXECUTE'),'default funcao fecha authenticated');
select pg_temp.assert_true(not has_function_privilege('service_role','public.t013_acl_probe()','EXECUTE'),'default funcao fecha service');

-- Isto nao testa RLS em execucao. Execute identity-behavior.sql separadamente,
-- somente quando autorizado. Qualquer erro acima invalida a revisao do catalogo.
rollback;
