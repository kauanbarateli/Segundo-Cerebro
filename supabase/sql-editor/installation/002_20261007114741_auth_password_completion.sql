-- T014: executar manualmente depois de 20261007082811_identity_foundation.sql.
-- NAO APLICADA. Nao altera senhas Auth e nao envia email.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $$ begin
  if current_user <> 'postgres' or to_regclass('public.user_moderation') is null then
    raise exception 'Aplicar a identidade como postgres antes desta migration.';
  end if;
end $$;

alter table public.domain_events drop constraint if exists domain_events_entity_type_check;
alter table public.domain_events add constraint domain_events_entity_type_check
  check (entity_type in ('profile','preference','module_preference','role','moderation','entitlement','authentication'));

-- Somente o servidor chama esta rotina APOS Auth.updateUser(password) e
-- revogacao das demais sessoes confirmados. Auth e Postgres nao formam uma unica
-- transacao: a confirmacao externa e responsabilidade do fluxo T014 e seu retry.
-- Nao receber senha, hash de senha, token Auth ou campos livres nesta RPC.
create or replace function app_private.complete_password_change(p_user uuid,p_session uuid,p_client_id text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_request jsonb := jsonb_build_object('user_id',p_user,'session_id',p_session);
  v_replay jsonb;
  v_forced boolean;
  v_result jsonb := '{"completed":true}'::jsonb;
begin
  if not app_private.session_active(p_user,p_session) then
    raise exception 'Sessao indisponivel.' using errcode='42501';
  end if;
  v_replay := app_private.command_replay(p_user,'auth.password_changed',p_client_id,v_request);
  if v_replay is not null then return v_replay; end if;

  select must_change_password into strict v_forced from public.user_moderation
    where user_id=p_user for update;
  if not app_private.session_active(p_user,p_session) then
    raise exception 'Sessao indisponivel.' using errcode='42501';
  end if;
  update public.user_moderation set must_change_password=false,changed_at=now(),changed_by=p_user
    where user_id=p_user;
  perform app_private.append_event(p_user,'authentication',p_user,'updated','web',null,
    jsonb_build_object('operation','password_changed','forced',v_forced));
  insert into app_private.command_receipts(user_id,command,client_id,request,result)
    values(p_user,'auth.password_changed',p_client_id,v_request,v_result);
  return v_result;
end;
$$;

create or replace function public.complete_password_change(p_user uuid,p_session uuid,p_client_id text) returns jsonb
language sql security invoker set search_path = '' as $$
  select app_private.complete_password_change(p_user,p_session,p_client_id);
$$;

revoke all on function app_private.complete_password_change(uuid,uuid,text),public.complete_password_change(uuid,uuid,text)
  from public,anon,authenticated,service_role;
grant execute on function app_private.complete_password_change(uuid,uuid,text),public.complete_password_change(uuid,uuid,text)
  to service_role;
comment on function public.complete_password_change(uuid,uuid,text) is
  'Servidor somente apos atualizacao de senha Auth e revogacao de outras sessoes. Confirma flag/evento/recibo sem credenciais; nao muda senha Auth.';
commit;
