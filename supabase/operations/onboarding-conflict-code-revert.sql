-- OPERACAO SUPERVISIONADA: restaura o wrapper publico original da migration 026.
-- Reversao de onboarding-conflict-code.sql. Nao toca em dados nem na funcao privada.
begin;

do $preflight$
begin
 if current_user<>'postgres' then
  raise exception 'Operational role postgres required.' using errcode='42501';
 end if;
end $preflight$;

create or replace function public.onboarding_call(p_user uuid,p_session uuid,p_operation text,p_request jsonb) returns jsonb
language sql security invoker set search_path='' as $$ select app_private.onboarding_call(p_user,p_session,p_operation,p_request);$$;

do $verify$
begin
 if position('PT409' in pg_get_functiondef('public.onboarding_call(uuid,uuid,text,jsonb)'::regprocedure))<>0
  or not has_function_privilege('service_role','public.onboarding_call(uuid,uuid,text,jsonb)','execute') then
  raise exception 'Original wrapper not restored.';
 end if;
end $verify$;

commit;
