-- T013: ASSERCOES DE CATALOGO PARA EXECUCAO MANUAL FUTURA EM BANCO.
-- Requer todas as migrations versionadas aplicadas em projeto novo autorizado.
-- Hosted execution remains manual; CI may use the disposable fixture runner.
-- Regression of the identity slice; release-catalog.sql covers the full schema.
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
      if t.relname='domain_events' then
        perform pg_temp.assert_true(not has_table_privilege('authenticated',t.oid,'SELECT') and has_column_privilege('authenticated',t.oid,'id','SELECT') and has_column_privilege('authenticated',t.oid,'occurred_at','SELECT'),'leitura de metadados do dono');
        perform pg_temp.assert_true(not has_column_privilege('authenticated',t.oid,'before','SELECT') and not has_column_privilege('authenticated',t.oid,'after','SELECT'),'conteudo de eventos sem grant direto');
      else perform pg_temp.assert_true(has_table_privilege('authenticated',t.oid,'SELECT'),'leitura do dono: '||t.relname); end if;
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
    where (n.nspname='app_private' and p.proname=any(array['session_active','current_user_active','require_actor','command_replay','append_event','provision_user','on_auth_user_created','update_identity','has_feature','my_access_state','bootstrap_master','consume_rate_limit_at','consume_rate_limit','prune_operational_data'])) or (n.nspname='public' and p.proname=any(array['update_identity','my_access_state','bootstrap_master','consume_rate_limit','prune_operational_data'])) loop
    perform pg_temp.assert_true(not has_function_privilege('anon',f.oid,'EXECUTE'),'anon sem EXECUTE: '||f.proname);
    perform pg_temp.assert_true(exists(select 1 from unnest(f.proconfig) s where s in ('search_path=""','search_path=')),'search_path vazio: '||f.proname);
    perform pg_temp.assert_true(f.prosecdef=(f.nspname='app_private'),'definer somente privado: '||f.proname);
  end loop;
end $$;
select pg_temp.assert_true(has_function_privilege('authenticated','public.update_identity(text,jsonb,text,text)','EXECUTE'),'RPC identidade concedida');
select pg_temp.assert_true(has_function_privilege('authenticated','app_private.current_user_active()','EXECUTE'),'helper RLS executavel pelo dono');
select pg_temp.assert_true(not has_function_privilege('authenticated','app_private.append_event(uuid,text,uuid,text,text,jsonb,jsonb)','EXECUTE'),'dono nao fabrica eventos');
select pg_temp.assert_true(to_regprocedure('public.admin_identity(uuid,uuid,uuid,text,jsonb,text)') is null,'endpoint legado administrativo ausente; T017 usa RPCs guardadas próprias');
select pg_temp.assert_true(not has_function_privilege('authenticated','public.bootstrap_master(uuid)','EXECUTE'),'dono nao escolhe master');
select pg_temp.assert_true(not has_function_privilege('service_role','app_private.consume_rate_limit_at(text,text,uuid,timestamp with time zone)','EXECUTE'),'relogio do limiter nao vem do canal');
select pg_temp.assert_true(has_function_privilege('service_role','public.consume_rate_limit(text,text,uuid,uuid)','EXECUTE'),'limiter operacional concedido');
select pg_temp.assert_true(exists(select 1 from pg_trigger where tgrelid='auth.users'::regclass and tgname='second_brain_identity_created' and not tgisinternal),'provisionamento Auth instalado');
select pg_temp.assert_true(exists(select 1 from pg_indexes where schemaname='public' and indexname='domain_events_user_time_idx'),'indice dono/tempo');
select pg_temp.assert_true(exists(select 1 from pg_indexes where schemaname='public' and indexname='domain_events_retention_idx'),'indice retencao');

-- Helper preexistente conserva o evento automatico, mas nao e endpoint da API.
select pg_temp.assert_true(not has_function_privilege('anon','public.rls_auto_enable()','EXECUTE'),'helper RLS fecha PUBLIC/anon');
select pg_temp.assert_true(not has_function_privilege('authenticated','public.rls_auto_enable()','EXECUTE'),'helper RLS fecha authenticated');
select pg_temp.assert_true(not has_function_privilege('service_role','public.rls_auto_enable()','EXECUTE'),'helper RLS fecha service');
select pg_temp.assert_true(exists(select 1 from pg_event_trigger where evtname='ensure_rls'
  and evtfoid='public.rls_auto_enable()'::regprocedure and evtevent='ddl_command_end' and evtenabled='O'),
  'event trigger RLS continua ativo e vinculado a mesma funcao');

-- Objetos descartaveis conferem defaults efetivos globais E por schema do owner.
create table public.t013_acl_probe (value text);
select pg_temp.assert_true((select relrowsecurity from pg_class where oid='public.t013_acl_probe'::regclass),'event trigger continua habilitando RLS apos revoke');
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
