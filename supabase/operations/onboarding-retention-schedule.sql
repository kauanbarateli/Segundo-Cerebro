-- OPERACAO SUPERVISIONADA: agenda o sweep de retencao de 720h do onboarding.
-- Fora da cadeia canonica de migrations de proposito: o CI aplica toda migration em
-- PostgreSQL descartavel sem pg_cron. Aplicar manualmente, uma vez, em cada destino
-- autorizado, conferindo o projeto antes. CI, build e deploy nunca executam este arquivo.
-- Homologacao pessoal: twrydxsdemaykgvdlpyd. Producao so apos decisao do responsavel.
-- Pre-requisito: migration 026 aplicada (sweep e health existem, ambos privados).
-- Reversao: onboarding-retention-unschedule.sql. Nao toca em dados de dominio.
begin;

do $preflight$
begin
 if current_user<>'postgres' then
  raise exception 'Operational role postgres required.' using errcode='42501';
 end if;
 if to_regprocedure('app_private.onboarding_retention_sweep()') is null
  or to_regprocedure('app_private.onboarding_retention_health()') is null then
  raise exception 'Migration 026 retention functions missing.';
 end if;
end $preflight$;

create extension if not exists pg_cron with schema pg_catalog;

-- cron.schedule com nome fixo e idempotente: reaplicar atualiza o mesmo job.
-- O job roda como o dono que o agenda (postgres), exigido pelo sweep. A cada 15
-- minutos o atraso fisico maximo e irrelevante frente aos 720h; o sweep e serial
-- (advisory lock) e devolve BUSY sem efeito se houver outra execucao.
select cron.schedule(
 'sc-onboarding-retention-v1',
 '*/15 * * * *',
 'select app_private.onboarding_retention_sweep()'
);

-- Conferencia dentro da mesma transacao: exatamente um job, ativo, com este comando.
do $verify$
declare n integer;
begin
 select count(*) into n from cron.job
  where jobname='sc-onboarding-retention-v1' and active
   and command='select app_private.onboarding_retention_sweep()' and username='postgres';
 if n<>1 then raise exception 'Retention schedule not installed exactly once.';end if;
end $verify$;

commit;

-- Observacao: pg_cron nao limpa cron.job_run_details sozinho. Acompanhar o
-- crescimento (96 linhas/dia) e limpar por rotina propria quando necessario.
