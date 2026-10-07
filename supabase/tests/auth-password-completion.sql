-- T014: assercoes preparadas, NAO EXECUTADAS. Somente ambiente de teste pessoal
-- sem contas e com as migrations aplicadas manualmente. Nunca VOE/BlackSheep.
-- Nao testa Auth.updateUser ou email: testa somente a confirmacao SQL privilegiada.
begin;
set local statement_timeout='30s';
set local app.test_user='14000000-0000-4000-8000-000000000001';
set local app.test_session='14000000-0000-4000-8000-000000000011';
set local app.test_other_session='14000000-0000-4000-8000-000000000012';

create function pg_temp.assert_true(ok boolean,message text) returns void language plpgsql as $$ begin
  if ok is distinct from true then raise exception 'T014: %',message; end if;
end $$;
create function pg_temp.expect_error(command text,expected_state text) returns void language plpgsql as $$
declare actual text; begin
  begin execute command;
  exception when others then
    get stacked diagnostics actual=returned_sqlstate;
    if actual<>expected_state then raise exception 'Esperado %, recebido %',expected_state,actual; end if;
    return;
  end;
  raise exception 'Comando deveria falhar: %',command;
end $$;
do $$ declare temp_schema text; begin
  select nspname into strict temp_schema from pg_namespace where oid=pg_my_temp_schema();
  execute format('grant usage on schema %I to anon,authenticated,service_role',temp_schema);
end $$;
grant execute on function pg_temp.assert_true(boolean,text),pg_temp.expect_error(text,text) to anon,authenticated,service_role;

select pg_temp.assert_true(not exists(select 1 from auth.users),'ambiente de teste deve estar vazio');
select pg_temp.assert_true(not has_function_privilege('authenticated','public.complete_password_change(uuid,uuid,text)','EXECUTE'),'dono nao limpa flag');
select pg_temp.assert_true(not has_function_privilege('anon','app_private.complete_password_change(uuid,uuid,text)','EXECUTE'),'helper privado fechado');
insert into auth.users(id,aud,role,email,is_anonymous,created_at,updated_at)
  values(current_setting('app.test_user')::uuid,'authenticated','authenticated','t014@example.invalid',false,now(),now());
insert into auth.sessions(id,user_id,created_at,updated_at) values
  (current_setting('app.test_session')::uuid,current_setting('app.test_user')::uuid,now(),now()),
  (current_setting('app.test_other_session')::uuid,current_setting('app.test_user')::uuid,now(),now());
update public.user_moderation set must_change_password=true where user_id=current_setting('app.test_user')::uuid;

set local role authenticated;
select pg_temp.expect_error($q$select public.complete_password_change(current_setting('app.test_user')::uuid,current_setting('app.test_session')::uuid,'change-1')$q$,'42501');
reset role;

-- Falha do evento nao pode liberar senha provisoria nem gravar recibo.
create function pg_temp.reject_auth_event() returns trigger language plpgsql as $$ begin
  if new.entity_type='authentication' and current_setting('app.reject_auth_event',true)='on' then
    raise exception 'falha injetada' using errcode='P0001';
  end if;
  return new;
end $$;
create trigger t014_reject_auth_event before insert on public.domain_events for each row execute function pg_temp.reject_auth_event();
set local app.reject_auth_event='on';
set local role service_role;
select pg_temp.expect_error($q$select public.complete_password_change(current_setting('app.test_user')::uuid,current_setting('app.test_session')::uuid,'change-1')$q$,'P0001');
reset role;
select pg_temp.assert_true((select must_change_password from public.user_moderation where user_id=current_setting('app.test_user')::uuid),'rollback conserva flag');
select pg_temp.assert_true(not exists(select 1 from app_private.command_receipts where command='auth.password_changed'),'rollback sem recibo');
set local app.reject_auth_event='off';

set local role service_role;
select public.complete_password_change(current_setting('app.test_user')::uuid,current_setting('app.test_session')::uuid,'change-1');
select public.complete_password_change(current_setting('app.test_user')::uuid,current_setting('app.test_session')::uuid,'change-1');
select pg_temp.expect_error($q$select public.complete_password_change(current_setting('app.test_user')::uuid,current_setting('app.test_other_session')::uuid,'change-1')$q$,'23505');
reset role;
select pg_temp.assert_true(not (select must_change_password from public.user_moderation where user_id=current_setting('app.test_user')::uuid),'confirmacao limpa flag');
select pg_temp.assert_true((select count(*)=1 from public.domain_events where entity_type='authentication'),'replay nao duplica evento');
select pg_temp.assert_true((select after='{"operation":"password_changed","forced":true}'::jsonb and before is null
  from public.domain_events where entity_type='authentication'),'evento somente metadados permitidos');
select pg_temp.assert_true((select request=jsonb_build_object('user_id',current_setting('app.test_user')::uuid,'session_id',current_setting('app.test_session')::uuid)
  and result='{"completed":true}'::jsonb from app_private.command_receipts where command='auth.password_changed'),'recibo sem senha ou token');

delete from auth.sessions where id=current_setting('app.test_session')::uuid;
set local role service_role;
select pg_temp.expect_error($q$select public.complete_password_change(current_setting('app.test_user')::uuid,current_setting('app.test_session')::uuid,'change-1')$q$,'42501');
reset role;
rollback;
