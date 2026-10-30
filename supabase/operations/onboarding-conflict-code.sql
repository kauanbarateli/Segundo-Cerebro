-- OPERACAO SUPERVISIONADA: conflitos do onboarding deixam de usar SQLSTATE 40001 na borda HTTP.
-- Motivo: o PostgREST hospedado reexecuta a transacao enquanto o erro for 40001 ou 40P01
-- (medido na homologacao: 40001/40P01 sem resposta em mais de 40 s; 23505, 23514 e PT409
-- respondem em menos de 1 s). Um conflito de revisao do onboarding e logico, nao uma falha
-- de serializacao, entao ficava reexecutando uma vez por segundo ate estourar o tempo.
-- Mudanca: apenas o wrapper publico. A funcao privada e todos os raise 40001 permanecem como
-- estao; o wrapper converte 40001 em PT409 (HTTP 409). Assinatura, retorno e GRANT preservados.
-- Fora da cadeia canonica de proposito: a 28a migration exigiria reescrever os pins de hash e
-- de contagem do catalogo de release. Aplicar manualmente em cada destino autorizado, depois
-- da migration 026. CI, build e deploy nunca executam este arquivo. Reversao:
-- onboarding-conflict-code-revert.sql.
begin;

do $preflight$
begin
 if current_user<>'postgres' then
  raise exception 'Operational role postgres required.' using errcode='42501';
 end if;
 if to_regprocedure('public.onboarding_call(uuid,uuid,text,jsonb)') is null
  or to_regprocedure('app_private.onboarding_call(uuid,uuid,text,jsonb)') is null then
  raise exception 'Migration 026 onboarding functions missing.';
 end if;
end $preflight$;

create or replace function public.onboarding_call(p_user uuid,p_session uuid,p_operation text,p_request jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
begin
 return app_private.onboarding_call(p_user,p_session,p_operation,p_request);
exception when serialization_failure then
 raise exception 'Onboarding state changed.' using errcode='PT409';
end $$;

-- Conferencia na mesma transacao: executavel apenas por service_role e com o corpo novo.
do $verify$
begin
 if has_function_privilege('anon','public.onboarding_call(uuid,uuid,text,jsonb)','execute')
  or has_function_privilege('authenticated','public.onboarding_call(uuid,uuid,text,jsonb)','execute')
  or not has_function_privilege('service_role','public.onboarding_call(uuid,uuid,text,jsonb)','execute') then
  raise exception 'Unexpected EXECUTE grants on public.onboarding_call.';
 end if;
 if position('PT409' in pg_get_functiondef('public.onboarding_call(uuid,uuid,text,jsonb)'::regprocedure))=0 then
  raise exception 'Conflict mapping not installed.';
 end if;
end $verify$;

commit;
