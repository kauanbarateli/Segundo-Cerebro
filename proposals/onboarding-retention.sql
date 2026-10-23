-- INERT companion, promoted only with reviewed026. No HTTP/secret/Google key.
begin;
do $draft_only$ begin raise exception 'DRAFT_ONLY: retention requires supervised installation and load/race tests.';end $draft_only$;
create table app_private.onboarding_retention_state (
 singleton boolean primary key default true check(singleton),cursor_expires timestamptz,cursor_round uuid,
 last_started_at timestamptz,last_completed_at timestamptz,last_code text check(last_code in ('OK','PARTIAL')),
 visited integer not null default 0,cleaned integer not null default 0,skipped integer not null default 0,failed integer not null default 0,
 check((cursor_expires is null)=(cursor_round is null))
);
alter table app_private.onboarding_retention_state enable row level security;
revoke all on app_private.onboarding_retention_state from public,anon,authenticated,service_role;
create function app_private.onboarding_retention_sweep() returns jsonb
language plpgsql security invoker set search_path='' as $$
<<sweep>>
declare cursor_expires timestamptz;cursor_round uuid;candidate record;locked_round app_private.onboarding_rounds;
 visited integer:=0;cleaned integer:=0;skipped integer:=0;failed integer:=0;begin
 if current_user<>'postgres' then raise exception 'Operational role required.' using errcode='42501';end if;
 if not pg_try_advisory_xact_lock(hashtextextended('sc-onboarding-retention-v1',0)) then return jsonb_build_object('code','BUSY');end if;
 insert into app_private.onboarding_retention_state(singleton) values(true) on conflict do nothing;
 select s.cursor_expires,s.cursor_round into strict cursor_expires,cursor_round from app_private.onboarding_retention_state s where s.singleton for update;
 update app_private.onboarding_retention_state set last_started_at=clock_timestamp() where singleton;
 -- Metadata keyset cursor advances even over skipped users; a locked first page
 -- cannot indefinitely starve later deadlines. Next empty page wraps fairly.
 for candidate in select id,user_id,expires_at from app_private.onboarding_rounds
  where status<>'expired' and expires_at<=clock_timestamp()
   and (sweep.cursor_expires is null or (expires_at,id)>(sweep.cursor_expires,sweep.cursor_round))
  order by expires_at,id limit 100 loop
  visited:=visited+1;
  cursor_expires:=candidate.expires_at;cursor_round:=candidate.id;
  begin
   perform 1 from auth.users where id=candidate.user_id for share skip locked;
   if not found then skipped:=skipped+1;continue;end if;
   -- EXACT same advisory as capture_task_lock; no session/account entitlement
   -- prerequisite can make a blocked user's personal draft immortal.
   if not pg_try_advisory_xact_lock(hashtextextended('capture-task:'||candidate.user_id::text,0)) then skipped:=skipped+1;continue;end if;
   select * into locked_round from app_private.onboarding_rounds where user_id=candidate.user_id and id=candidate.id for update skip locked;
   if not found then skipped:=skipped+1;continue;end if;
   if app_private.onboarding_expire_round(candidate.user_id,candidate.id) then cleaned:=cleaned+1;end if;
  exception when others then
   -- SQLERRM, SQL text, draft, identity and provider payload are never logged.
   failed:=failed+1;
  end;
 end loop;
 if visited=0 then cursor_expires:=null;cursor_round:=null;end if;
 update app_private.onboarding_retention_state set cursor_expires=sweep.cursor_expires,cursor_round=sweep.cursor_round,
  last_completed_at=clock_timestamp(),last_code=case when sweep.failed=0 then 'OK' else 'PARTIAL' end,
  visited=sweep.visited,cleaned=sweep.cleaned,skipped=sweep.skipped,failed=sweep.failed where singleton;
 return jsonb_build_object('code',case when failed=0 then 'OK' else 'PARTIAL' end,'visited',visited,'cleaned',cleaned,'skipped',skipped,'failed',failed);
end $$;
create function app_private.onboarding_retention_health() returns jsonb
language sql security invoker set search_path='' as $$
 select jsonb_build_object('lastStartedAt',s.last_started_at,'lastCompletedAt',s.last_completed_at,'lastCode',s.last_code,
  'durationMs',case when s.last_completed_at>=s.last_started_at then extract(epoch from(s.last_completed_at-s.last_started_at))*1000 else null end,
  'visited',s.visited,'cleaned',s.cleaned,'skipped',s.skipped,'failed',s.failed,
  'dueCount',(select count(*) from app_private.onboarding_rounds where status<>'expired' and expires_at<=clock_timestamp()),
  'oldestDueAt',(select min(expires_at) from app_private.onboarding_rounds where status<>'expired' and expires_at<=clock_timestamp()),
  'expiredPayloadCount',(select count(*) from app_private.onboarding_rounds r where r.expires_at<=clock_timestamp() and (r.draft is not null or exists(
   select 1 from app_private.onboarding_intents i where i.round_id=r.id and i.user_id=r.user_id and (i.input is not null or i.bound_input is not null or i.choice is not null or i.extras<>'{}' or i.bindings<>'[]')))),
  'residualPermitCount',(select count(*) from app_private.onboarding_write_permits)+(select count(*) from app_private.onboarding_oauth where permit_backend_pid is not null or permit_xact_id is not null))
 from (values(true)) seed(singleton) left join app_private.onboarding_retention_state s using(singleton);
$$;
revoke all on function app_private.onboarding_retention_sweep(),app_private.onboarding_retention_health() from public,anon,authenticated,service_role;
-- No public/service-role wrapper. Existing operational postgres owns these.
rollback;
