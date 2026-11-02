-- INERT operations proposal. Not a migration, CI, build or deploy hook.
-- Registration, activation and monitoring each require the reviewed remote gate.
begin;
do $draft_only$ begin raise exception 'DRAFT_ONLY: review destination, function and cron before registration.'; end $draft_only$;
do $register$
declare existing record; new_id bigint;
 job_name constant text:='sc-signup-origin-retention-v1';
 job_schedule constant text:='*/5 * * * *';
 job_command constant text:='SET statement_timeout = ''20s''; SET lock_timeout = ''250ms''; SELECT app_private.signup_prune();';
begin
 if current_user<>'postgres' or current_database()<>'postgres' then raise exception 'Operational database and role required.' using errcode='42501'; end if;
 if to_regprocedure('app_private.signup_prune()') is null or to_regprocedure('cron.schedule(text,text,text)') is null or to_regprocedure('cron.alter_job(bigint,text,text,text,text,boolean)') is null then
  raise exception 'Reviewed retention function and pg_cron required.';
 end if;
 if (select count(*) from cron.job where jobname=job_name)>1 then raise exception 'Ambiguous job name; preserved unchanged.' using errcode='23514'; end if;
 select * into existing from cron.job where jobname=job_name;
 if found then
  if existing.username<>current_user or existing.database<>current_database() or existing.command<>job_command or existing.schedule<>job_schedule then
   raise exception 'Job collision; preserved unchanged.' using errcode='23514'; end if;
  if existing.active then raise exception 'Existing active job requires separate review.' using errcode='23514'; end if;
 else
  new_id:=cron.schedule(job_name,job_schedule,job_command);
  perform cron.alter_job(new_id,active:=false);
 end if;
end $register$;
-- After verifying destination, function, owner and schedule, activate separately.
-- Monitor job failures and oldest eligible record; each sweep handles <=500 per kind.
-- This proposal does not install pg_cron, activate a job or clean job history.
rollback;
