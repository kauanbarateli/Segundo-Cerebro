-- Separate INERT supervised operations proposal; NOT a CI/build/deploy hook.
-- Root verified only availability1.6.4, not installation. Never uninstall pg_cron.
begin;
do $draft_only$ begin raise exception 'DRAFT_ONLY: inspect existing Cron jobs and approve before registration.';end $draft_only$;
do $$ begin if current_user<>'postgres' or current_database()<>'postgres' then raise exception 'Operational database/role required.';end if;end $$;
create extension if not exists pg_cron;
do $register$
declare existing record;new_id bigint;job_name constant text:='sc-onboarding-retention-v1';
 job_command constant text:='SET statement_timeout = ''15s''; SET lock_timeout = ''250ms''; SELECT app_private.onboarding_retention_sweep();';begin
 if to_regprocedure('app_private.onboarding_retention_sweep()') is null then raise exception 'Reviewed retention function missing.';end if;
 if (select count(*) from cron.job where jobname=job_name)>1 then raise exception 'Ambiguous Cron name; jobs preserved unchanged.' using errcode='23514';end if;
 -- schedule(name,...) replaces a same-name job. NEVER use it to overwrite an
 -- unknown job/owner/command, or mutate cron.job directly.
 select * into existing from cron.job where jobname=job_name;
 if found then
  if existing.username<>current_user or existing.database<>current_database() or existing.command<>job_command or existing.schedule<>'* * * * *' then
   raise exception 'Cron job collision; preserved unchanged.' using errcode='23514';end if;
  if existing.active then raise exception 'Existing active job requires separate review; preserved unchanged.' using errcode='23514';end if;
 else
  new_id:=cron.schedule(job_name,'* * * * *',job_command);
  -- This transaction registers INACTIVE, so it cannot run before tests finish.
  perform cron.alter_job(new_id,active:=false);
 end if;
end $register$;
-- Activation is a separate supervised step AFTER remote gates/health test:
-- cron.alter_job(the_verified_job_id, active := true).
-- Root must monitor actual executions, oldest deadline/backlog, payload absence
-- and no residual permits. Registration alone is never retention acceptance.
-- Job history needs its own bounded cleanup for this verified job ID only.
rollback;
