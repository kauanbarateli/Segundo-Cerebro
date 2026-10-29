-- OPERACAO SUPERVISIONADA: remove o agendamento do sweep de retencao do onboarding.
-- Reversao de onboarding-retention-schedule.sql. Nao remove a extensao pg_cron, o
-- sweep, o health nem o estado de retencao, e nao toca em dados de dominio.
begin;

do $preflight$
begin
 if current_user<>'postgres' then
  raise exception 'Operational role postgres required.' using errcode='42501';
 end if;
end $preflight$;

select cron.unschedule(jobid) from cron.job where jobname='sc-onboarding-retention-v1';

do $verify$
begin
 if exists(select 1 from cron.job where jobname='sc-onboarding-retention-v1') then
  raise exception 'Retention schedule still present.';
 end if;
end $verify$;

commit;
