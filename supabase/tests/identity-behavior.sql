-- T013: TESTES DE COMPORTAMENTO PARA EXECUCAO MANUAL FUTURA. NAO EXECUTADO.
-- Somente projeto NOVO/dedicado preparado manualmente; nunca VOE/producao.
-- Cria usuarios/sessoes sinteticos SEM senha e termina com ROLLBACK.
-- Requer conexao SQL owner/postgres capaz de SET ROLE; nao usar Data API.
begin;
set local statement_timeout='30s';
set local app.test_user_a='13000000-0000-4000-8000-000000000001';
set local app.test_user_b='13000000-0000-4000-8000-000000000002';
set local app.test_session_a='13000000-0000-4000-8000-000000000011';
set local app.test_session_b='13000000-0000-4000-8000-000000000012';

create function pg_temp.assert_true(ok boolean, message text) returns void
language plpgsql as $$ begin
  if ok is distinct from true then raise exception 'T013: %',message; end if;
end $$;
create function pg_temp.expect_error(command text, expected_state text) returns void
language plpgsql security invoker as $$ declare actual text; begin
  begin execute command;
  exception when others then
    get stacked diagnostics actual=returned_sqlstate;
    if actual<>expected_state then raise exception 'SQLSTATE esperado %, recebido %: %',expected_state,actual,sqlerrm; end if;
    return;
  end;
  raise exception 'Comando deveria falhar com %: %',expected_state,command;
end $$;
do $$ declare temp_schema text; begin
  select nspname into strict temp_schema from pg_namespace where oid=pg_my_temp_schema();
  execute format('grant usage on schema %I to anon,authenticated,service_role',temp_schema);
end $$;
grant execute on function pg_temp.assert_true(boolean,text),pg_temp.expect_error(text,text) to anon,authenticated,service_role;

select pg_temp.assert_true(not exists(select 1 from auth.users),'exige ambiente Auth sem contas, antes do bootstrap real');

-- IDs fixos sao intencionais e detectam colisao; nunca ON CONFLICT sobrescreve dados.
insert into auth.users(id,aud,role,email,is_anonymous,created_at,updated_at) values
  (current_setting('app.test_user_a')::uuid,'authenticated','authenticated','t013-a@example.invalid',false,now(),now()),
  (current_setting('app.test_user_b')::uuid,'authenticated','authenticated','t013-b@example.invalid',false,now(),now());
insert into auth.sessions(id,user_id,created_at,updated_at) values
  (current_setting('app.test_session_a')::uuid,current_setting('app.test_user_a')::uuid,now(),now()),
  (current_setting('app.test_session_b')::uuid,current_setting('app.test_user_b')::uuid,now(),now());
select pg_temp.assert_true((select count(*)=8 from public.domain_events where user_id in (current_setting('app.test_user_a')::uuid,current_setting('app.test_user_b')::uuid)),'quatro eventos de provisionamento por usuario');
select pg_temp.assert_true((select count(*)=2 from public.user_roles where user_id in (current_setting('app.test_user_a')::uuid,current_setting('app.test_user_b')::uuid) and role='user'),'metadata nao promove papel');

set local role anon;
select pg_temp.expect_error('select * from public.profiles','42501');
select pg_temp.expect_error('select public.my_access_state()','42501');
reset role;

select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('app.test_user_a'),'role','authenticated','session_id',current_setting('app.test_session_a'),'is_anonymous',false)::text,true);
set local role authenticated;
select pg_temp.assert_true((select count(*)=1 from public.profiles),'A le somente proprio perfil');
select pg_temp.assert_true((select count(*)=0 from public.profiles where user_id=current_setting('app.test_user_b')::uuid),'A nao ve B');
select pg_temp.assert_true((select count(*)=4 from public.domain_events),'A le somente eventos proprios');
select pg_temp.assert_true(app_private.has_feature('capturar'),'Plano Pessoal permite ausencia de entitlement');
select pg_temp.assert_true(not app_private.has_feature('admin'),'usuario comum nao recebe admin implicito');
select pg_temp.expect_error('select * from public.user_moderation','42501');
select pg_temp.expect_error('update public.profiles set display_name=''DML proibido''','42501');
select pg_temp.expect_error('delete from public.domain_events','42501');
select pg_temp.expect_error('update public.user_roles set role=''master''','42501');
select pg_temp.expect_error('select * from app_private.command_receipts','42501');
select public.update_identity('profile','{"display_name":"Exemplo A"}','replay-1');
select public.update_identity('profile','{"display_name":"Exemplo A"}','replay-1');
select pg_temp.assert_true((select count(*)=5 from public.domain_events),'replay nao duplica evento');
select pg_temp.expect_error($q$select public.update_identity('profile','{"display_name":"Outro"}','replay-1')$q$,'23505');
select public.update_identity('preference','{"theme":"dark","values_hidden":true}','replay-1');
select pg_temp.assert_true((select count(*)=6 from public.domain_events),'client_id por comando');
select pg_temp.expect_error($q$select public.update_identity('profile','{"role":"master"}','bad-field')$q$,'22023');
select pg_temp.expect_error($q$select public.update_identity('profile','{"display_name":42}','bad-type')$q$,'22023');
select pg_temp.expect_error($q$select public.update_identity('module_preference','{"module_key":"drive","visible":false,"sort_order":2.5}','bad-order')$q$,'22023');
select pg_temp.expect_error($q$select public.update_identity('module_preference','{"module_key":"capturar","visible":false,"sort_order":3}','hide-essential')$q$,'23514');
select pg_temp.expect_error($q$select public.update_identity('module_preference','{"module_key":"admin","visible":true,"sort_order":3}','no-admin-preference')$q$,'42501');
select public.update_identity('module_preference','{"module_key":"drive","visible":false,"sort_order":3}','hide-drive');
select pg_temp.assert_true(app_private.has_feature('drive'),'preferencia oculta nao revoga entitlement');
reset role;

-- Veto posterior tambem recusa replay de um comando antes autorizado.
insert into public.user_entitlements(user_id,feature_key,allowed) values(current_setting('app.test_user_a')::uuid,'drive',false);
set local role authenticated;
select pg_temp.expect_error($q$select public.update_identity('module_preference','{"module_key":"drive","visible":false,"sort_order":3}','hide-drive')$q$,'42501');
reset role;
delete from public.user_entitlements where user_id=current_setting('app.test_user_a')::uuid and feature_key='drive';

-- Atomicidade: falha de evento deve desfazer dado, recibo e consumo do limite.
create function pg_temp.reject_test_event() returns trigger language plpgsql as $$ begin
  if current_setting('app.reject_test_event',true)='on' then raise exception 'falha de evento injetada' using errcode='P0001'; end if;
  return new;
end $$;
create trigger t013_reject_test_event before insert on public.domain_events for each row execute function pg_temp.reject_test_event();
set local app.reject_test_event='on';
set local role authenticated;
select pg_temp.expect_error($q$select public.update_identity('profile','{"display_name":"Nao deve persistir"}','rollback-1')$q$,'P0001');
select pg_temp.assert_true((select display_name='Exemplo A' from public.profiles),'falha do evento preserva perfil anterior');
reset role;
set local app.reject_test_event='off';
select pg_temp.assert_true(not exists(select 1 from app_private.command_receipts where user_id=current_setting('app.test_user_a')::uuid and client_id='rollback-1'),'falha nao cria recibo');
select pg_temp.assert_true((select cardinality(hits)=3 from app_private.rate_limits where user_id=current_setting('app.test_user_a')::uuid and scope='identity_write'),'falha nao consome limite de escrita confirmada');
set local role authenticated;
select public.update_identity('profile','{"display_name":"Retentativa A"}','rollback-1');
reset role;

-- Mesmo client_id de A e B e independente, inclusive retorno e filtro RLS.
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('app.test_user_b'),'role','authenticated','session_id',current_setting('app.test_session_b'),'is_anonymous',false)::text,true);
set local role authenticated;
select public.update_identity('profile','{"display_name":"Exemplo B"}','replay-1');
select pg_temp.assert_true((select count(*)=1 from public.profiles),'B le somente B');
select pg_temp.assert_true((select display_name='Exemplo B' from public.profiles),'B nao recebe recibo de A');
reset role;

-- Bootstrap minimo nao aceita troca de titular e e idempotente.
update auth.users set deleted_at=now() where id=current_setting('app.test_user_b')::uuid;
select pg_temp.assert_true(not app_private.session_active(current_setting('app.test_user_b')::uuid,current_setting('app.test_session_b')::uuid),'soft delete Auth fecha sessao');
set local role service_role;
select pg_temp.expect_error('select public.bootstrap_master(current_setting(''app.test_user_b'')::uuid)','22023');
reset role;
update auth.users set deleted_at=null where id=current_setting('app.test_user_b')::uuid;
set local role service_role;
select public.bootstrap_master(current_setting('app.test_user_a')::uuid);
select public.bootstrap_master(current_setting('app.test_user_a')::uuid);
select pg_temp.expect_error('select public.bootstrap_master(current_setting(''app.test_user_b'')::uuid)','42501');
select pg_temp.expect_error('select * from public.domain_events','42501');
reset role;

-- Somente fixtures de teste como owner: T013 nao expoe RPC administrativa.
-- Estes UPDATEs nao pretendem validar comandos T017 nem seu protocolo com Auth.
insert into public.user_entitlements(user_id,feature_key,allowed) values(current_setting('app.test_user_b')::uuid,'capturar',false);
set local role authenticated;
select pg_temp.assert_true(not app_private.has_feature('capturar'),'veto corrente tem precedencia');
select pg_temp.assert_true((select count(*)=0 from public.user_modules),'veto nao altera preferencia de B');
select pg_temp.expect_error($q$select public.update_identity('module_preference','{"module_key":"capturar","visible":true,"sort_order":3}','denied-preference')$q$,'42501');
reset role;
update public.user_moderation set status='blocked',reason='Motivo privado de teste' where user_id=current_setting('app.test_user_b')::uuid;
set local role authenticated;
select pg_temp.assert_true((select count(*)=0 from public.profiles),'sessao ja viva bloqueada pelo estado atual');
select pg_temp.expect_error('select public.my_access_state()','42501');
select pg_temp.expect_error($q$select public.update_identity('profile','{"display_name":"Bloqueado"}','blocked-write')$q$,'42501');
reset role;
update public.user_moderation set status='active',must_change_password=true where user_id=current_setting('app.test_user_b')::uuid;
set local role authenticated;
select pg_temp.assert_true((public.my_access_state()->>'must_change_password')::boolean,'estado minimo permite redirecionar troca obrigatoria');
select pg_temp.assert_true(public.my_access_state()-array['user_id','must_change_password']='{}'::jsonb,'troca obrigatoria nao retorna papeis ou entitlements');
select pg_temp.assert_true((select count(*)=0 from public.profiles),'senha provisoria nao abre RLS');
select pg_temp.assert_true(not app_private.has_feature('tarefas'),'troca obrigatoria bloqueia modulos');
select pg_temp.expect_error($q$select public.update_identity('profile','{"display_name":"Nao trocar antes"}','must-change')$q$,'42501');
reset role;

-- Ban/Auth/session expirados nao dependem de claims de perfil desatualizadas.
update auth.users set banned_until=now()+interval '1 day' where id=current_setting('app.test_user_a')::uuid;
select pg_temp.assert_true(not app_private.session_active(current_setting('app.test_user_a')::uuid,current_setting('app.test_session_a')::uuid),'ban Auth corrente');
update auth.users set banned_until=null where id=current_setting('app.test_user_a')::uuid;
update auth.sessions set not_after=now()-interval '1 second' where id=current_setting('app.test_session_a')::uuid;
select pg_temp.assert_true(not app_private.session_active(current_setting('app.test_user_a')::uuid,current_setting('app.test_session_a')::uuid),'sessao expirada');
update auth.sessions set not_after=null where id=current_setting('app.test_session_a')::uuid;
delete from auth.sessions where id=current_setting('app.test_session_b')::uuid;
set local role authenticated;
select pg_temp.assert_true((select count(*)=0 from public.profiles),'JWT cuja sessao foi revogada nao abre RLS');
reset role;

-- Janela exata: 5 tentativas permitidas, sexta negada, limite no instante exato.
do $$ declare i integer; result jsonb; hash text:=repeat('a',64); begin
  for i in 0..4 loop
    result:=app_private.consume_rate_limit_at('login',hash,null,'2026-10-07T12:00:00Z'::timestamptz + i*interval '1 second');
    perform pg_temp.assert_true((result->>'allowed')::boolean,'login permitido '||i);
  end loop;
  result:=app_private.consume_rate_limit_at('login',hash,null,'2026-10-07T12:00:05Z');
  perform pg_temp.assert_true(not (result->>'allowed')::boolean and (result->>'retry_after_ms')::integer=55000,'sexta tentativa negada');
  result:=app_private.consume_rate_limit_at('login',hash,null,'2026-10-07T12:01:00Z');
  perform pg_temp.assert_true((result->>'allowed')::boolean and (result->>'remaining')::integer=0,'fronteira de 60s remove primeira tentativa');
  result:=app_private.consume_rate_limit_at('login',repeat('b',64),null,'2026-10-07T12:00:05Z');
  perform pg_temp.assert_true((result->>'allowed')::boolean,'chaves independentes');
end $$;
select pg_temp.expect_error($q$select app_private.consume_rate_limit_at('login','email@exemplo',null,now())$q$,'22023');
set local role authenticated;
select pg_temp.expect_error($q$select public.consume_rate_limit('login',repeat('a',64))$q$,'42501');
reset role;

-- Retencao operacional: dono nao exclui eventos; operacao permitida remove >90d.
insert into public.domain_events(user_id,entity_type,entity_id,action,canal,occurred_at,after) values
  (current_setting('app.test_user_a')::uuid,'profile',current_setting('app.test_user_a')::uuid,'updated','cron',now()-interval '91 days','{"test":"retention"}');
set local role service_role;
select public.prune_operational_data();
reset role;
select pg_temp.assert_true(not exists(select 1 from public.domain_events where after='{"test":"retention"}'::jsonb),'retencao remove evento antigo');
select pg_temp.assert_true(exists(select 1 from app_private.command_receipts where user_id=current_setting('app.test_user_a')::uuid and client_id='replay-1'),'retencao nao apaga idempotencia');

-- Tudo acima, inclusive users/sessions/trigger temporario, deve ser desfeito.
rollback;
