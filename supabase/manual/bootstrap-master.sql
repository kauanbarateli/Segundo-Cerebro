-- T013: MODELO DE BOOTSTRAP MANUAL. NAO EXECUTADO.
-- Nao faz parte da migration nem de seed automatico. Sem email/senha hardcoded.
-- Pre-requisitos: nova organizacao/projeto confirmados, migration aplicada,
-- conta criada pelo canal Auth autorizado e UUID conferido pelo mantenedor.
-- Antes de usar, configurar nesta sessao SQL:
--   SET app.bootstrap_master_user_id = '<UUID DA CONTA CONFERIDA>';
-- A ausencia do parametro ou UUID invalido falha; nao existe fallback.
begin;
select public.bootstrap_master(current_setting('app.bootstrap_master_user_id')::uuid);
-- Validar o resultado antes de optar por COMMIT. Este modelo sempre desfaz.
select user_id,role,granted_at from public.user_roles
  where user_id=current_setting('app.bootstrap_master_user_id')::uuid;
rollback;
