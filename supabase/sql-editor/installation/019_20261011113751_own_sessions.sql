--019 own registered sessions. Application requires separate supervised review.
-- Original SPEC-06 story 3: view only the caller's registered Auth sessions.
-- No Auth table/grant/policy changes, writes, events, secrets or user arguments.
begin;
do $$
begin
 if current_user<>'postgres'
  or to_regclass('auth.sessions') is null
  or to_regclass('public.user_roles') is null
  or to_regprocedure('app_private.session_active(uuid,uuid)') is null
  or to_regprocedure('app_private.current_user_active()') is null
  or to_regprocedure('app_private.has_feature(text)') is null
  or not exists(select 1 from pg_class where oid=to_regclass('auth.sessions') and relrowsecurity)
  or exists(select 1 from (values
   ('id','uuid'::regtype),('user_id','uuid'::regtype),
   ('created_at','timestamp with time zone'::regtype),
   ('refreshed_at','timestamp without time zone'::regtype),
   ('not_after','timestamp with time zone'::regtype)
  ) required(name,type) where not exists(select 1 from pg_attribute a
   where a.attrelid=to_regclass('auth.sessions') and a.attname=required.name
    and a.atttypid=required.type and a.attnum>0 and not a.attisdropped)) then
  raise exception 'Reviewed identity and GoTrue session column types required.';
 end if;
 if to_regprocedure('public.my_sessions()') is not null
  or to_regprocedure('app_private.my_sessions()') is not null then
  raise exception 'Own-session projection is already present.';
 end if;
end $$;

create function app_private.my_sessions() returns jsonb
language plpgsql stable security definer set search_path='' as $sc_sessions$
declare v_user uuid; v_session uuid; v_result jsonb;
begin
 -- The definer owner must not erase the authenticated caller's role fence.
 if current_setting('role',true) is distinct from 'authenticated'
  or auth.jwt()->>'role' is distinct from 'authenticated' then
  raise exception 'Sessao indisponivel.' using errcode='42501';
 end if;
 begin
  v_user:=auth.uid();
  v_session:=nullif(auth.jwt()->>'session_id','')::uuid;
 exception when invalid_text_representation then
  raise exception 'Sessao indisponivel.' using errcode='42501';
 end;
 if v_user is null or v_session is null
  or app_private.session_active(v_user,v_session) is not true
  or app_private.current_user_active() is not true
  or not exists(select 1 from public.user_roles where user_id=v_user and role in ('user','master'))
  or app_private.has_feature('configuracoes') is not true then
  raise exception 'Sessao indisponivel.' using errcode='42501';
 end if;
 -- These are registered sessions, not a guarantee of GoTrue validity.
 -- refreshed_at is UTC stored without zone, not the user's last page visit.
 with bounded as materialized (
  select s.id,s.id=v_session as is_current,s.created_at,
   s.refreshed_at at time zone 'UTC' as refreshed_at,s.not_after
  from auth.sessions s where s.user_id=v_user
  order by (s.id=v_session) desc,s.created_at desc nulls last,s.id
  limit 101
 ), shown as (
  select * from bounded
  order by is_current desc,created_at desc nulls last,id limit 100
 )
 select jsonb_build_object(
  'sessions',coalesce((select jsonb_agg(jsonb_build_object(
   'id',id,'is_current',is_current,'created_at',created_at,
   'refreshed_at',refreshed_at,'not_after',not_after)
   order by is_current desc,created_at desc nulls last,id) from shown),'[]'::jsonb),
  'has_more',(select count(*)>100 from bounded)) into v_result;
 return v_result;
end
$sc_sessions$;

create function public.my_sessions() returns jsonb
language plpgsql stable security invoker set search_path='' as $sc_sessions_public$
begin
 if current_user<>'authenticated' then
  raise exception 'Sessao indisponivel.' using errcode='42501';
 end if;
 return app_private.my_sessions();
end
$sc_sessions_public$;

revoke all on function public.my_sessions(),app_private.my_sessions() from public,anon,authenticated,service_role;
grant execute on function public.my_sessions(),app_private.my_sessions() to authenticated;
comment on function public.my_sessions() is
 'Own registered session metadata only. Timestamps do not certify last use or complete Auth validity.';
commit;
