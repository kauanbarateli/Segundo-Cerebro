-- T013: MIGRATION VERSIONADA, NAO APLICADA. SOMENTE APLICACAO MANUAL POSTERIOR.
-- Destino futuro: projeto NOVO e dedicado, jamais um banco existente do VOE.
-- OP-002: aplicacao manual posterior; nenhum comando de CI/deploy aplica este arquivo.
-- PostgreSQL 15+ / Supabase Auth. Execute somente apos revisar README e precondicoes.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Fail closed: um IF NOT EXISTS nao atesta compatibilidade de schema existente.
-- Aplicar uma vez e registrar a versao. Repeticao direta ou drift exige revisao.
do $$ begin
  if current_user<>'postgres' then raise exception 'A migration exige owner postgres; revisar grants antes de trocar o owner.'; end if;
  if exists(select 1 from auth.users) then raise exception 'T013 exige projeto novo sem contas Auth; destino recusado.'; end if;
  if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where (n.nspname='public' and c.relname=any(array['profiles','user_preferences','user_modules','user_roles','user_moderation','user_entitlements','domain_events']))
       or n.nspname='app_private') then raise exception 'Destino nao esta vazio para T013; revisar antes de aplicar.'; end if;
  if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='app_private' or (n.nspname='public' and p.proname=any(array['update_identity','my_access_state','bootstrap_master','consume_rate_limit','prune_operational_data']))) then
    raise exception 'Rotinas de identidade ja existem; revisar antes de aplicar.';
  end if;
  if not exists(select 1 from information_schema.columns where table_schema='auth' and table_name='sessions' and column_name='not_after') or
     not exists(select 1 from information_schema.columns where table_schema='auth' and table_name='users' and column_name='is_anonymous') or
     not exists(select 1 from information_schema.columns where table_schema='auth' and table_name='users' and column_name='deleted_at') then
    raise exception 'Versao do schema Auth nao corresponde ao contrato revisado.';
  end if;
end $$;

create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated, service_role;
grant usage on schema app_private to authenticated, service_role;
-- Deve permanecer FORA dos exposed schemas do PostgREST.
-- Defaults globais do owner desta migration (postgres), porque REVOKE por schema
-- nao subtrai um grant global de PUBLIC. Outros owners exigem seus proprios defaults.
alter default privileges revoke all on tables from public, anon, authenticated, service_role;
alter default privileges revoke execute on functions from public, anon, authenticated, service_role;
alter default privileges in schema public revoke all on tables from public, anon, authenticated, service_role;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated, service_role;
alter default privileges in schema app_private revoke all on tables from public, anon, authenticated, service_role;
alter default privileges in schema app_private revoke execute on functions from public, anon, authenticated, service_role;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (display_name is null or char_length(btrim(display_name)) between 1 and 120),
  avatar_url text check (avatar_url is null or char_length(avatar_url) <= 2048 and avatar_url ~ '^https://'),
  timezone text not null default 'America/Sao_Paulo' check (timezone = 'America/Sao_Paulo'),
  locale text not null default 'pt-BR' check (locale = 'pt-BR'),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'system' check (theme in ('system','light','dark')),
  week_starts_on smallint not null default 1 check (week_starts_on = 1),
  default_calendar_view text not null default 'week' check (default_calendar_view in ('day','week','month')),
  values_hidden boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.user_modules (
  user_id uuid not null references auth.users(id) on delete cascade,
  module_key text not null check (module_key in ('inicio','capturar','tarefas','calendario','conhecimento','drive','projetos','habitos','financeiro','cofre','configuracoes','integracoes','admin')),
  visible boolean not null default true, sort_order smallint not null default 0 check (sort_order between 0 and 1000),
  check (visible or module_key not in ('inicio','capturar','configuracoes')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key(user_id,module_key)
);
create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user' check (role in ('user','master')),
  granted_by uuid references auth.users(id) on delete set null, granted_at timestamptz not null default now()
);
create table if not exists public.user_moderation (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active','blocked')),
  reason text check (reason is null or char_length(reason) between 1 and 500),
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now(), must_change_password boolean not null default false
);
create table if not exists public.user_entitlements (
  user_id uuid not null references auth.users(id) on delete cascade,
  feature_key text not null check (feature_key in ('inicio','capturar','tarefas','calendario','conhecimento','drive','projetos','habitos','financeiro','cofre','configuracoes','integracoes','admin')),
  allowed boolean not null, granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(), primary key(user_id,feature_key)
);
create table if not exists public.domain_events (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null check (entity_type in ('profile','preference','module_preference','role','moderation','entitlement')),
  entity_id uuid not null,
  action text not null check (action in ('created','updated','deleted','restored','status_changed')),
  canal text not null check (canal in ('web','api','cron')),
  occurred_at timestamptz not null default now(),
  before jsonb, after jsonb,
  check (before is not null or after is not null),
  check (before is null or jsonb_typeof(before) = 'object'),
  check (after is null or jsonb_typeof(after) = 'object'),
  check (coalesce(octet_length(before::text),0) + coalesce(octet_length(after::text),0) <= 1048576)
);
create table if not exists app_private.command_receipts (
  user_id uuid not null references auth.users(id) on delete cascade,
  command text not null check (char_length(command) between 1 and 100),
  client_id text not null check (char_length(btrim(client_id)) between 1 and 200),
  request jsonb not null, result jsonb not null,
  created_at timestamptz not null default now(), primary key(user_id,command,client_id),
  check (octet_length(request::text) <= 1048576 and octet_length(result::text) <= 1048576)
);
create table if not exists app_private.rate_limits (
  scope text not null check (scope in ('login','identity_write')),
  subject_hash text not null check (subject_hash ~ '^[a-f0-9]{64}$'),
  user_id uuid references auth.users(id) on delete cascade,
  hits timestamptz[] not null default '{}', updated_at timestamptz not null default now(),
  primary key(scope,subject_hash), check (cardinality(hits) <= 30),
  check ((scope = 'login' and user_id is null) or (scope <> 'login' and user_id is not null))
);
create index if not exists domain_events_user_time_idx on public.domain_events(user_id,occurred_at desc,id desc);
create index if not exists domain_events_retention_idx on public.domain_events(occurred_at);
create index if not exists user_roles_granted_by_idx on public.user_roles(granted_by) where granted_by is not null;
create index if not exists user_moderation_changed_by_idx on public.user_moderation(changed_by) where changed_by is not null;
create index if not exists user_entitlements_granted_by_idx on public.user_entitlements(granted_by) where granted_by is not null;
create index if not exists rate_limits_user_idx on app_private.rate_limits(user_id) where user_id is not null;
create index if not exists rate_limits_expiry_idx on app_private.rate_limits(updated_at);

-- Nunca infere papel, veto ou moderacao de raw_user_meta_data/app_metadata.
create or replace function app_private.session_active(p_user uuid,p_session uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_user is not null and p_session is not null and exists (
    select 1 from auth.sessions s
    join auth.users u on u.id=s.user_id
    join public.user_moderation m on m.user_id=u.id
    where s.id=p_session and s.user_id=p_user and m.status='active'
      and not u.is_anonymous and u.deleted_at is null and (u.banned_until is null or u.banned_until <= now())
      and (s.not_after is null or s.not_after > now())
  );
$$;
create or replace function app_private.current_user_active() returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare v_session uuid;
begin
  if auth.uid() is null then return false; end if;
  begin v_session := nullif(auth.jwt()->>'session_id','')::uuid;
  exception when invalid_text_representation then return false; end;
  return app_private.session_active(auth.uid(),v_session) and not exists(select 1 from public.user_moderation where user_id=auth.uid() and must_change_password);
end;
$$;
create or replace function app_private.require_actor(p_user uuid,p_session uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not app_private.session_active(p_user,p_session) or exists(select 1 from public.user_moderation where user_id=p_user and must_change_password) then
    raise exception 'Sessao indisponivel ou troca de senha obrigatoria.' using errcode='42501';
  end if;

end;
$$;
-- Helpers nao expostos: recibo e evento pertencem a mesma transacao do chamador.
create or replace function app_private.command_replay(p_user uuid,p_command text,p_client text,p_request jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_receipt app_private.command_receipts;
begin
  if p_client is null or char_length(btrim(p_client)) not between 1 and 200 then raise exception 'client_id invalido.' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user::text || ':' || p_command || ':' || p_client,0));
  select * into v_receipt from app_private.command_receipts where user_id=p_user and command=p_command and client_id=p_client;
  if found then
    if v_receipt.request is distinct from p_request then raise exception 'client_id reutilizado com outro conteudo.' using errcode='23505'; end if;
    return v_receipt.result;
  end if;
  return null;
end;
$$;
create or replace function app_private.append_event(p_user uuid,p_entity text,p_id uuid,p_action text,p_canal text,p_before jsonb,p_after jsonb) returns void
language sql security definer set search_path = '' as $$
  insert into public.domain_events(user_id,entity_type,entity_id,action,canal,before,after)
    values(p_user,p_entity,p_id,p_action,p_canal,p_before,p_after);
$$;

-- Provisionamento Auth e uma excecao de infraestrutura ao orquestrador do Nucleo.
-- Nao copia email, avatar ou privilegio de metadata editavel. Novas categorias sao T015.
create or replace function app_private.provision_user(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_after jsonb;
begin
  insert into public.profiles(user_id) values(p_user) on conflict do nothing returning to_jsonb(profiles.*) into v_after;
  if v_after is not null then perform app_private.append_event(p_user,'profile',p_user,'created','api',null,v_after); end if;
  v_after:=null;
  insert into public.user_preferences(user_id) values(p_user) on conflict do nothing returning to_jsonb(user_preferences.*) into v_after;
  if v_after is not null then perform app_private.append_event(p_user,'preference',p_user,'created','api',null,v_after); end if;
  v_after:=null;
  insert into public.user_roles(user_id) values(p_user) on conflict do nothing returning to_jsonb(user_roles.*) into v_after;
  if v_after is not null then perform app_private.append_event(p_user,'role',p_user,'created','api',null,v_after); end if;
  v_after:=null;
  insert into public.user_moderation(user_id) values(p_user) on conflict do nothing returning jsonb_build_object('user_id',user_id,'status',status,'must_change_password',must_change_password,'changed_by',changed_by,'changed_at',changed_at) into v_after;
  if v_after is not null then perform app_private.append_event(p_user,'moderation',p_user,'created','api',null,v_after); end if;
end;
$$;
create or replace function app_private.on_auth_user_created() returns trigger
language plpgsql security definer set search_path = '' as $$
begin perform app_private.provision_user(new.id); return new; end;
$$;
drop trigger if exists second_brain_identity_created on auth.users;
create trigger second_brain_identity_created after insert on auth.users for each row execute function app_private.on_auth_user_created();

-- PATCH fechado; tabelas nao concedem DML a authenticated. O ator vem do JWT da RPC.
create or replace function app_private.update_identity(p_resource text,p_patch jsonb,p_client_id text,p_canal text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_user uuid:=auth.uid(); v_before jsonb; v_after jsonb; v_replay jsonb; v_module text; v_command text:='identity.'||p_resource;
begin
  if not app_private.current_user_active() then raise exception 'Sessao indisponivel.' using errcode='42501'; end if;
  perform app_private.require_actor(v_user,(auth.jwt()->>'session_id')::uuid);
  if not app_private.has_feature('configuracoes') then raise exception 'Funcionalidade indisponivel.' using errcode='42501'; end if;
  if p_canal not in ('web','api') or p_canal is null or jsonb_typeof(p_patch) is distinct from 'object' then raise exception 'Entrada invalida.' using errcode='22023'; end if;
  -- A permissao atual precede o replay: um recibo antigo nao reabre modulo vetado.
  if p_resource='module_preference' then
    if p_patch - array['module_key','visible','sort_order'] <> '{}'::jsonb or not p_patch ?& array['module_key','visible','sort_order'] or jsonb_typeof(p_patch->'visible') <> 'boolean' or jsonb_typeof(p_patch->'sort_order') <> 'number' or (p_patch->>'sort_order') !~ '^[0-9]+$' then raise exception 'Modulo invalido.' using errcode='22023'; end if;
    v_module:=p_patch->>'module_key';
    if not app_private.has_feature(v_module) then raise exception 'Preferencia exige funcionalidade permitida.' using errcode='42501'; end if;
    if v_module in ('inicio','capturar','configuracoes') and p_patch->'visible'='false'::jsonb then raise exception 'Modulo essencial nao pode ser ocultado.' using errcode='23514'; end if;
  end if;
  v_replay:=app_private.command_replay(v_user,v_command,p_client_id,jsonb_build_object('patch',p_patch,'canal',p_canal));
  if v_replay is not null then return v_replay; end if;
  -- O dono nao escolhe chave nem limite. Replays nao consomem outra tentativa.
  -- Hash do UUID nao contem email/IP; chaves pre-auth usam HMAC no servidor.
  if not (app_private.consume_rate_limit_at('identity_write',encode(sha256(convert_to(v_user::text,'UTF8')),'hex'),v_user,null)->>'allowed')::boolean then
    raise exception 'Limite de escritas excedido.' using errcode='P0001';
  end if;
  if p_resource='profile' then
    if p_patch - array['display_name','avatar_url'] <> '{}'::jsonb then raise exception 'Campo de perfil invalido.' using errcode='22023'; end if;
    if (p_patch ? 'display_name' and jsonb_typeof(p_patch->'display_name') not in ('string','null')) or
       (p_patch ? 'avatar_url' and jsonb_typeof(p_patch->'avatar_url') not in ('string','null')) then raise exception 'Texto de perfil invalido.' using errcode='22023'; end if;
    select to_jsonb(t.*) into strict v_before from public.profiles t where user_id=v_user for update;
    update public.profiles set display_name=case when p_patch ? 'display_name' then nullif(btrim(p_patch->>'display_name'),'') else display_name end,
      avatar_url=case when p_patch ? 'avatar_url' then p_patch->>'avatar_url' else avatar_url end, updated_at=now() where user_id=v_user returning to_jsonb(profiles.*) into v_after;
  elsif p_resource='preference' then
    if p_patch - array['theme','default_calendar_view','values_hidden'] <> '{}'::jsonb then raise exception 'Preferencia invalida.' using errcode='22023'; end if;
    if p_patch ? 'values_hidden' and jsonb_typeof(p_patch->'values_hidden') <> 'boolean' then raise exception 'Visibilidade invalida.' using errcode='22023'; end if;
    select to_jsonb(t.*) into strict v_before from public.user_preferences t where user_id=v_user for update;
    update public.user_preferences set theme=case when p_patch ? 'theme' then p_patch->>'theme' else theme end,
      default_calendar_view=case when p_patch ? 'default_calendar_view' then p_patch->>'default_calendar_view' else default_calendar_view end,
      values_hidden=case when p_patch ? 'values_hidden' then (p_patch->>'values_hidden')::boolean else values_hidden end, updated_at=now()
      where user_id=v_user returning to_jsonb(user_preferences.*) into v_after;
  elsif p_resource='module_preference' then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text || ':module:' || v_module,0));
    select to_jsonb(t.*) into v_before from public.user_modules t where user_id=v_user and module_key=v_module for update;
    insert into public.user_modules(user_id,module_key,visible,sort_order) values(v_user,v_module,(p_patch->>'visible')::boolean,(p_patch->>'sort_order')::smallint)
      on conflict(user_id,module_key) do update set visible=excluded.visible,sort_order=excluded.sort_order,updated_at=now() returning to_jsonb(user_modules.*) into v_after;
  else raise exception 'Recurso invalido.' using errcode='22023'; end if;
  perform app_private.append_event(v_user,p_resource,v_user,case when v_before is null then 'created' else 'updated' end,p_canal,v_before,v_after);
  insert into app_private.command_receipts(user_id,command,client_id,request,result) values(v_user,v_command,p_client_id,jsonb_build_object('patch',p_patch,'canal',p_canal),v_after);
  return v_after;
end;
$$;
create or replace function public.update_identity(p_resource text,p_patch jsonb,p_client_id text,p_canal text default 'web') returns jsonb
language sql security invoker set search_path = '' as $$ select app_private.update_identity(p_resource,p_patch,p_client_id,p_canal); $$;

-- Plano Pessoal implicito; preferencias nao participam da autorizacao.
create or replace function app_private.has_feature(p_feature text) returns boolean
language sql stable security definer set search_path = '' as $$
  select app_private.current_user_active()
    and p_feature=any(array['inicio','capturar','tarefas','calendario','conhecimento','drive','projetos','habitos','financeiro','cofre','configuracoes','integracoes','admin'])
    and not exists(select 1 from public.user_moderation where user_id=auth.uid() and must_change_password)
    and coalesce((select allowed from public.user_entitlements where user_id=auth.uid() and feature_key=p_feature),true)
    and (p_feature <> 'admin' or exists(select 1 from public.user_roles where user_id=auth.uid() and role='master'));
$$;
create or replace function app_private.my_access_state() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_session uuid;
begin
  begin v_session:=nullif(auth.jwt()->>'session_id','')::uuid;
  exception when invalid_text_representation then raise exception 'Sessao indisponivel.' using errcode='42501'; end;
  if not app_private.session_active(auth.uid(),v_session) then raise exception 'Sessao indisponivel.' using errcode='42501'; end if;
  if exists(select 1 from public.user_moderation where user_id=auth.uid() and must_change_password) then
    return jsonb_build_object('user_id',auth.uid(),'must_change_password',true);
  end if;
  return jsonb_build_object('user_id',auth.uid(),'role',coalesce((select role from public.user_roles where user_id=auth.uid()),'user'),
    'must_change_password',(select must_change_password from public.user_moderation where user_id=auth.uid()),
    'entitlements',coalesce((select jsonb_object_agg(feature_key,allowed) from public.user_entitlements where user_id=auth.uid()),'{}'::jsonb));
end;
$$;
create or replace function public.my_access_state() returns jsonb
language sql security invoker set search_path = '' as $$ select app_private.my_access_state(); $$;

-- Bootstrap manual separado da migration. UUID obrigatorio, nunca email fixo.
-- Funcao idempotente somente enquanto este mesmo usuario for o unico master.
create or replace function app_private.bootstrap_master(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_before jsonb; v_after jsonb;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('second-brain:master-set',0));
  if not exists(select 1 from auth.users where id=p_user and not is_anonymous and deleted_at is null and (banned_until is null or banned_until<=now())) then raise exception 'Conta inicial inexistente ou indisponivel.' using errcode='22023'; end if;
  if exists(select 1 from public.user_roles where role='master' and user_id<>p_user) then raise exception 'Bootstrap encerrado: ja existe outro master.' using errcode='42501'; end if;
  perform app_private.provision_user(p_user);
  if exists(select 1 from public.user_moderation where user_id=p_user and (status<>'active' or must_change_password)) then raise exception 'Conta inicial nao esta ativa.' using errcode='42501'; end if;
  select to_jsonb(t.*) into strict v_before from public.user_roles t where user_id=p_user for update;
  if v_before->>'role'='master' then return; end if;
  update public.user_roles set role='master',granted_by=null,granted_at=now() where user_id=p_user returning to_jsonb(user_roles.*) into v_after;
  perform app_private.append_event(p_user,'role',p_user,'updated','api',v_before,v_after);
end;
$$;
create or replace function public.bootstrap_master(p_user uuid) returns void
language sql security invoker set search_path = '' as $$ select app_private.bootstrap_master(p_user); $$;

-- Janela deslizante exata. Somente permitidas entram no vetor, evitando bloqueio
-- infinito por tentativas negadas. Relogio injetavel SOMENTE no helper nao concedido.
create or replace function app_private.consume_rate_limit_at(p_scope text,p_subject_hash text,p_user uuid,p_now timestamptz) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_limit integer; v_hits timestamptz[]; v_saved_user uuid; v_wait integer;
begin
  v_limit:=case p_scope when 'login' then 5 when 'identity_write' then 30 end;
  if v_limit is null or p_subject_hash is null or p_subject_hash !~ '^[a-f0-9]{64}$' then raise exception 'Chave de limite invalida.' using errcode='22023'; end if;
  insert into app_private.rate_limits(scope,subject_hash,user_id) values(p_scope,p_subject_hash,p_user) on conflict do nothing;
  select hits,user_id into strict v_hits,v_saved_user from app_private.rate_limits where scope=p_scope and subject_hash=p_subject_hash for update;
  -- Relogio real so e capturado depois de obter o lock; testes podem injeta-lo.
  p_now:=coalesce(p_now,clock_timestamp());
  if v_saved_user is distinct from p_user then raise exception 'Escopo de limite incompatível.' using errcode='22023'; end if;
  select coalesce(array_agg(hit order by hit),'{}'::timestamptz[]) into v_hits from unnest(v_hits) hit where hit > p_now - interval '1 minute';
  if cardinality(v_hits)>=v_limit then
    v_wait:=greatest(1,ceil(extract(epoch from (v_hits[1]+interval '1 minute'-p_now))*1000)::integer);
    update app_private.rate_limits set hits=v_hits,updated_at=p_now where scope=p_scope and subject_hash=p_subject_hash;
    return jsonb_build_object('allowed',false,'remaining',0,'retry_after_ms',v_wait);
  end if;
  v_hits:=array_append(v_hits,p_now);
  update app_private.rate_limits set hits=v_hits,updated_at=p_now where scope=p_scope and subject_hash=p_subject_hash;
  return jsonb_build_object('allowed',true,'remaining',v_limit-cardinality(v_hits),'retry_after_ms',0);
end;
$$;
create or replace function app_private.consume_rate_limit(p_scope text,p_subject_hash text,p_user uuid,p_session uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if p_scope='login' then
    if p_user is not null or p_session is not null then raise exception 'Login exige chave pre-auth.' using errcode='22023'; end if;
  elsif not app_private.session_active(p_user,p_session) then raise exception 'Sessao indisponivel.' using errcode='42501'; end if;
  return app_private.consume_rate_limit_at(p_scope,p_subject_hash,p_user,null);
end;
$$;
create or replace function public.consume_rate_limit(p_scope text,p_subject_hash text,p_user uuid default null,p_session uuid default null) returns jsonb
language sql security invoker set search_path = '' as $$ select app_private.consume_rate_limit(p_scope,p_subject_hash,p_user,p_session); $$;

-- Nenhum agendamento e instalado. Retencao roda somente por invocacao operacional
-- autorizada; recibos nao expiram para nao duplicar replays tardios de comandos.
create or replace function app_private.prune_operational_data() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_events integer; v_limits integer;
begin
  delete from public.domain_events where occurred_at < now()-interval '90 days'; get diagnostics v_events=row_count;
  delete from app_private.rate_limits where updated_at < now()-interval '1 day'; get diagnostics v_limits=row_count;
  return jsonb_build_object('events',v_events,'rate_limits',v_limits);
end;
$$;
create or replace function public.prune_operational_data() returns jsonb
language sql security invoker set search_path = '' as $$ select app_private.prune_operational_data(); $$;

-- Defesa em profundidade nas tabelas privadas tambem; nenhuma policy de escrita.
do $$ declare v_table text; begin
  foreach v_table in array array['profiles','user_preferences','user_modules','user_roles','user_moderation','user_entitlements','domain_events'] loop
    execute format('alter table public.%I enable row level security',v_table);
    execute format('revoke all on public.%I from public,anon,authenticated,service_role',v_table);
    if v_table <> 'user_moderation' then
      execute format('drop policy if exists own_read on public.%I',v_table);
      execute format('create policy own_read on public.%I for select to authenticated using ((select auth.uid())=user_id and (select app_private.current_user_active()))',v_table);
      execute format('grant select on public.%I to authenticated',v_table);
    end if;
  end loop;
end $$;
alter table app_private.command_receipts enable row level security;
alter table app_private.rate_limits enable row level security;
revoke all on app_private.command_receipts,app_private.rate_limits from public,anon,authenticated,service_role;
-- service_role nao recebe escrita/UPDATE/DELETE direto de eventos, nem conteudo de eventos.
grant select on public.profiles,public.user_roles,public.user_moderation,public.user_entitlements to service_role;

-- Revoke explicito tambem contra grants diretos do template Supabase.
revoke execute on all functions in schema app_private from public,anon,authenticated,service_role;
grant execute on function app_private.current_user_active(),app_private.has_feature(text),app_private.my_access_state(),app_private.update_identity(text,jsonb,text,text) to authenticated;
grant execute on function app_private.bootstrap_master(uuid),app_private.consume_rate_limit(text,text,uuid,uuid),app_private.prune_operational_data() to service_role;
revoke all on function public.update_identity(text,jsonb,text,text),public.my_access_state(),public.bootstrap_master(uuid),public.consume_rate_limit(text,text,uuid,uuid),public.prune_operational_data() from public,anon,authenticated,service_role;
grant execute on function public.update_identity(text,jsonb,text,text),public.my_access_state() to authenticated;
grant execute on function public.bootstrap_master(uuid),public.consume_rate_limit(text,text,uuid,uuid),public.prune_operational_data() to service_role;

comment on table public.user_modules is 'Preferencia; ausencia significa visivel e ordem do catalogo em codigo. Nunca autoriza acesso.';
comment on table public.user_entitlements is 'Plano Pessoal implicito: ausencia permite; false veta. Atualizavel somente por canal administrativo.';
comment on table public.user_moderation is 'Estado atual privado de moderacao. Sem policy/grant de authenticated. Motivo nunca entra em domain_events.';
comment on table public.domain_events is 'Append-only para aplicacao; limpeza privilegiada de 90 dias. Admin nao recebe conteudo de outros usuarios.';
comment on table app_private.rate_limits is 'Estado operacional: login usa HMAC-SHA256 server-only; escrita usa SHA256 do UUID. Nunca email/IP/senha em claro. Login pre-auth nao possui user_id.';
comment on table app_private.command_receipts is 'Escopo usuario+comando+client_id; request estrutural e result gravados com dado+evento. Sem expiracao automatica.';

-- Verificacao estrutural minima; assercoes completas estao em ../tests/identity-catalog.sql.
do $$ begin
  if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','app_private') and c.relname in ('profiles','user_preferences','user_modules','user_roles','user_moderation','user_entitlements','domain_events','command_receipts','rate_limits') and not c.relrowsecurity) then raise exception 'RLS ausente.'; end if;
end $$;
commit;
