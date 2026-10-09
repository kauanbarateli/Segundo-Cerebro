-- T016 versioned migration; supervised application only under OP-009.
-- Execution evidence belongs to the implementation report, not this file.
-- Created with Supabase CLI 2.117.0 migration new activity_page.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

do $$ begin
  if current_user<>'postgres'
    or to_regprocedure('app_private.capture_task_lock(uuid)') is null
    or to_regprocedure('app_private.require_actor(uuid,uuid)') is null
    or to_regclass('public.domain_events') is null then
    raise exception 'Apply reviewed T013/T014/T015 foundation as postgres first.';
  end if;
end $$;

-- This is a projection of existing atomic events, not a second event store.
-- Explicit Activity navigation belongs to Inicio. Preferences hide Home blocks;
-- they never revoke an otherwise permitted explicit Activity read.
create function app_private.activity_page(
  p_user uuid,p_session uuid,p_limit integer default 20,
  p_before_time timestamptz default null,p_before_id uuid default null
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_captures boolean; v_tasks boolean; v_result jsonb;
begin
  -- Preserve the writer's lock order. Auth deletion, moderation and Entitlement
  -- changes cannot invalidate this checked identity during the projection.
  perform 1 from auth.users where id=p_user for share;
  perform 1 from auth.sessions where id=p_session and user_id=p_user for share;
  perform app_private.capture_task_lock(p_user);
  perform app_private.require_actor(p_user,p_session);
  if exists(select 1 from public.user_entitlements where user_id=p_user and feature_key='inicio' and not allowed) then
    raise exception 'Functionality unavailable.' using errcode='42501';
  end if;
  if p_limit is null or p_limit<1 or p_limit>50
    or (p_before_time is null)<>(p_before_id is null) then
    raise exception 'Invalid activity page or cursor.' using errcode='22023';
  end if;
  if p_before_time is not null and (not isfinite(p_before_time)
    or p_before_time<'0001-01-01T00:00:00Z'::timestamptz
    or p_before_time>='10000-01-01T00:00:00Z'::timestamptz) then
    raise exception 'Invalid activity cursor timestamp.' using errcode='22023';
  end if;
  select not exists(select 1 from public.user_entitlements where user_id=p_user and feature_key='capturar' and not allowed),
    not exists(select 1 from public.user_entitlements where user_id=p_user and feature_key='tarefas' and not allowed)
    into v_captures,v_tasks;
  if not v_captures and not v_tasks then
    raise exception 'Functionality unavailable.' using errcode='42501';
  end if;

  -- One MVCC statement per page; subsequent requests recheck all access and do
  -- not share a historical snapshot. The partial T015 index supports this keyset.
  with candidates as materialized (
    select e.id,e.user_id,e.entity_type,e.entity_id,e.action,e.canal,e.occurred_at,e.before,e.after
    from public.domain_events e
    where e.user_id=p_user and e.entity_type in ('capture','task')
      and ((e.entity_type='capture' and v_captures) or (e.entity_type='task' and v_tasks))
      and (p_before_time is null or (e.occurred_at,e.id)<(p_before_time,p_before_id))
    order by e.occurred_at desc,e.id desc limit p_limit+1
  ), page as materialized (
    select * from candidates order by occurred_at desc,id desc limit p_limit
  )
  select jsonb_build_object(
    'items',coalesce((select jsonb_agg(jsonb_build_object(
      'id',e.id,'user_id',e.user_id,'entity_type',e.entity_type,'entity_id',e.entity_id,
      'action',e.action,'canal',e.canal,
      'occurred_at',to_char(e.occurred_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
      'title',coalesce(e.after->>'title',e.before->>'title'),
      'changed_fields',coalesce((select jsonb_agg(f.name order by f.position)
        from unnest(case e.entity_type when 'capture' then array[
          'title','content','type','status','category_id','project_id','converted_task_id',
          'organized_at','archived_at','deleted_at','linked_capture_ids','attachments']
        else array['title','description','status','priority','category_id','project_id','due_at',
          'scheduled_start_at','scheduled_end_at','all_day','estimated_minutes','board_position',
          'origin_capture_id','completed_at','archived_at','deleted_at'] end)
          with ordinality as f(name,position)
        where coalesce(e.before->f.name,'null'::jsonb) is distinct from coalesce(e.after->f.name,'null'::jsonb)),
        '[]'::jsonb)
      ) order by e.occurred_at desc,e.id desc) from page e),'[]'::jsonb),
    'next_cursor',case when (select count(*) from candidates)>p_limit then
      (select jsonb_build_object('occurred_at',to_char(occurred_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'id',id)
        from page order by occurred_at,id limit 1)
      else null end
  ) into v_result;
  return v_result;
end $$;

create function public.activity_page(
  p_user uuid,p_session uuid,p_limit integer default 20,
  p_before_time timestamptz default null,p_before_id uuid default null
) returns jsonb language sql security invoker set search_path='' as $$
  select app_private.activity_page(p_user,p_session,p_limit,p_before_time,p_before_id);
$$;

-- No new table privilege, browser RPC, direct write, feature or storage scope.
revoke all on function public.activity_page(uuid,uuid,integer,timestamptz,uuid) from public,anon,authenticated,service_role;
revoke all on function app_private.activity_page(uuid,uuid,integer,timestamptz,uuid) from public,anon,authenticated,service_role;
grant execute on function public.activity_page(uuid,uuid,integer,timestamptz,uuid) to service_role;
grant execute on function app_private.activity_page(uuid,uuid,integer,timestamptz,uuid) to service_role;
comment on function public.activity_page(uuid,uuid,integer,timestamptz,uuid) is
  'T016 internal service read: actor/session checked, current Inicio/capture/task entitlements, own metadata only; descending microsecond timestamp + UUID keyset, 20 default/50 maximum, no cross-page snapshot.';
commit;
