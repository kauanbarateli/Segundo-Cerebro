-- T013: MODELO DE BOOTSTRAP MANUAL. NAO EXECUTADO.
-- Nao faz parte da migration nem de seed automatico. Sem email/senha hardcoded.
-- Pre-requisitos: nova organizacao/projeto confirmados, migration aplicada,
-- conta criada pelo canal Auth autorizado e UUID conferido pelo mantenedor.
-- Substituir o placeholder abaixo pelo UUID conferido e executar o batch inteiro.
-- SET LOCAL e chamada ficam na mesma transacao; nao dependem de outra sessao.
-- Placeholder/UUID invalido falha; nao existe fallback nem alteracao de Auth.role.
begin;
set local app.bootstrap_master_user_id = '<UUID_DA_CONTA_CONFERIDA>';
select public.bootstrap_master(current_setting('app.bootstrap_master_user_id')::uuid);
-- Conferir o UUID e o papel retornados. Este modelo sempre desfaz a promocao.
select user_id,role,granted_at from public.user_roles
  where user_id=current_setting('app.bootstrap_master_user_id')::uuid;
-- Para persistir depois da conferência: repetir TODO este batch com o mesmo UUID,
-- trocando somente o ROLLBACK final por COMMIT. COMMIT isolado apos esta simulacao
-- nao promove nada, pois a transacao anterior ja foi desfeita.
rollback;
