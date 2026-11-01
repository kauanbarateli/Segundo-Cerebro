-- Draft local: do not apply remotely until #134 and security review are complete.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

create table app_private.feedback_requests (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 client_id uuid not null,
 category text not null check (category in ('suggestion','complaint','problem','improvement','other')),
 message text not null check (char_length(btrim(message)) between 10 and 5000),
 created_at timestamptz not null default now(),
 unique (user_id,client_id)
);
alter table app_private.feedback_requests enable row level security;
revoke all on app_private.feedback_requests from public,anon,authenticated,service_role;
create index feedback_requests_owner_created on app_private.feedback_requests(user_id,created_at desc,id desc);

do $$ declare expression text; begin
 select pg_get_expr(conbin,conrelid) into strict expression from pg_constraint
  where conrelid='public.domain_events'::regclass and conname='domain_events_entity_type_check';
 alter table public.domain_events drop constraint domain_events_entity_type_check;
 execute format('alter table public.domain_events add constraint domain_events_entity_type_check check ((%s) or entity_type = ''feedback_request'')',expression);
end $$;

create function app_private.feedback_submit(p_user uuid,p_session uuid,p_client uuid,p_category text,p_message text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_row app_private.feedback_requests;
begin
 perform app_private.require_actor(p_user,p_session);
 if p_client is null or p_category is null or p_category not in ('suggestion','complaint','problem','improvement','other')
  or p_message is null or char_length(btrim(p_message)) not between 10 and 5000
  or p_message ~ '[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]' then
  raise exception 'Invalid feedback.' using errcode='22023';
 end if;
 insert into app_private.feedback_requests(user_id,client_id,category,message)
 values(p_user,p_client,p_category,btrim(p_message)) on conflict(user_id,client_id) do nothing returning * into v_row;
 if found then
  perform app_private.append_event(p_user,'feedback_request',v_row.id,'created','web',null,
   jsonb_build_object('id',v_row.id,'category',v_row.category,'status','received'));
 else
  select * into strict v_row from app_private.feedback_requests where user_id=p_user and client_id=p_client;
  if v_row.category<>p_category or v_row.message<>btrim(p_message) then
   raise exception 'Conflicting request.' using errcode='23505';
  end if;
 end if;
 return jsonb_build_object('id',v_row.id,'category',v_row.category,'text',v_row.message,'status','received','createdAt',v_row.created_at);
end $$;

create function app_private.feedback_list(p_user uuid,p_session uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform app_private.require_actor(p_user,p_session);
 return coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'category',f.category,'text',f.message,'status','received','createdAt',f.created_at) order by f.created_at desc,f.id desc)
  from (select * from app_private.feedback_requests where user_id=p_user order by created_at desc,id desc limit 100) f),'[]'::jsonb);
end $$;

create function public.feedback_submit(p_user uuid,p_session uuid,p_client uuid,p_category text,p_message text) returns jsonb
language sql security invoker set search_path='' as $$ select app_private.feedback_submit(p_user,p_session,p_client,p_category,p_message) $$;
create function public.feedback_list(p_user uuid,p_session uuid) returns jsonb
language sql security invoker set search_path='' as $$ select app_private.feedback_list(p_user,p_session) $$;
revoke all on function app_private.feedback_submit(uuid,uuid,uuid,text,text), app_private.feedback_list(uuid,uuid), public.feedback_submit(uuid,uuid,uuid,text,text), public.feedback_list(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function app_private.feedback_submit(uuid,uuid,uuid,text,text), app_private.feedback_list(uuid,uuid), public.feedback_submit(uuid,uuid,uuid,text,text), public.feedback_list(uuid,uuid) to service_role;
commit;
