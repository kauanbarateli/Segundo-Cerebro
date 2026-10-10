# Pacote para aplicação manual no SQL Editor

Gerado por `node scripts/build-sql-editor.mjs`. Não editar cópias; altere as migrations canônicas e gere novamente.
Antes de usar: `node scripts/build-sql-editor.mjs --check`. Esse comando verifica arquivos/hashes; não consulta nem altera banco.
Este pacote é a alternativa manual à aplicação supervisionada autorizada na [OP-009](../../docs/implementation/decisoes-operacionais.md#op-009--conexão-pessoal-e-aplicação-supervisionada). Conferir o histórico e o estado do destino antes de selecionar arquivos pendentes; não reaplicar migrations já confirmadas.

## Instalação

No projeto pessoal novo e dedicado, revisar e executar manualmente um arquivo completo por vez, na ordem abaixo. Conferir sucesso antes do próximo arquivo.
Cada arquivo preserva exatamente o SQL e as transações da migration original. Falha interrompe a sequência; não continuar após erro.

1. [installation/001_20261007151834_identity_foundation.sql](installation/001_20261007151834_identity_foundation.sql) — versão 20261007151834
2. [installation/002_20261007151850_auth_password_completion.sql](installation/002_20261007151850_auth_password_completion.sql) — versão 20261007151850
3. [installation/003_20261007151904_restrict_rls_event_trigger_execution.sql](installation/003_20261007151904_restrict_rls_event_trigger_execution.sql) — versão 20261007151904
4. [installation/004_20261007210519_capture_task_transactions.sql](installation/004_20261007210519_capture_task_transactions.sql) — versão 20261007210519
5. [installation/005_20261007223710_activity_page.sql](installation/005_20261007223710_activity_page.sql) — versão 20261007223710
6. [installation/006_20261009144343_financial_transactions.sql](installation/006_20261009144343_financial_transactions.sql) — versão 20261009144343
7. [installation/007_20261009144350_knowledge_pages_links.sql](installation/007_20261009144350_knowledge_pages_links.sql) — versão 20261009144350
8. [installation/008_20261009150122_identity_admin_settings.sql](installation/008_20261009150122_identity_admin_settings.sql) — versão 20261009150122
9. [installation/009_20261009151557_account_preferences.sql](installation/009_20261009151557_account_preferences.sql) — versão 20261009151557
10. [installation/010_20261009152200_projects_habits.sql](installation/010_20261009152200_projects_habits.sql) — versão 20261009152200
11. [installation/011_20261009152822_private_storage_drive.sql](installation/011_20261009152822_private_storage_drive.sql) — versão 20261009152822
12. [installation/012_20261009154609_global_search_activity.sql](installation/012_20261009154609_global_search_activity.sql) — versão 20261009154609
13. [installation/013_20261009160151_encrypted_vault.sql](installation/013_20261009160151_encrypted_vault.sql) — versão 20261009160151
14. [installation/014_20261009160158_google_calendar.sql](installation/014_20261009160158_google_calendar.sql) — versão 20261009160158
15. [installation/015_20261009231338_file_cleanup_fairness.sql](installation/015_20261009231338_file_cleanup_fairness.sql) — versão 20261009231338
16. [installation/016_20261010010955_close_public_sequence_defaults.sql](installation/016_20261010010955_close_public_sequence_defaults.sql) — versão 20261010010955
17. [installation/017_20261010044217_finance_monthly_plan.sql](installation/017_20261010044217_finance_monthly_plan.sql) — versão 20261010044217

A migration inicial recusa reexecução e destinos com contas/objetos preexistentes por preflight. Este pacote não faz instalação incremental nem detecta migrations já aplicadas.
O operador registra externamente versão, hash, destino e resultado. O manifest é integridade local; não é histórico de aplicação do Supabase.

## Validação e bootstrap separados

Os arquivos abaixo não estão na instalação. Consultar os pré-requisitos em [supabase/README.md](../README.md) antes de qualquer execução manual.
Todos terminam com ROLLBACK explícito. O bootstrap fornecido é uma simulação; persistir o primeiro master exige decisão manual após conferir o UUID.

- [supabase/tests/activity-behavior.sql](../tests/activity-behavior.sql) — asserção manual
- [supabase/tests/activity-catalog.sql](../tests/activity-catalog.sql) — asserção manual
- [supabase/tests/activity-expanded-behavior.sql](../tests/activity-expanded-behavior.sql) — asserção manual
- [supabase/tests/activity-expanded-catalog.sql](../tests/activity-expanded-catalog.sql) — asserção manual
- [supabase/tests/admin-behavior.sql](../tests/admin-behavior.sql) — asserção manual
- [supabase/tests/admin-catalog.sql](../tests/admin-catalog.sql) — asserção manual
- [supabase/tests/auth-password-completion.sql](../tests/auth-password-completion.sql) — asserção manual
- [supabase/tests/calendar-behavior.sql](../tests/calendar-behavior.sql) — asserção manual
- [supabase/tests/calendar-catalog.sql](../tests/calendar-catalog.sql) — asserção manual
- [supabase/tests/capture-task-behavior.sql](../tests/capture-task-behavior.sql) — asserção manual
- [supabase/tests/capture-task-catalog.sql](../tests/capture-task-catalog.sql) — asserção manual
- [supabase/tests/drive-attachments-cleanup.sql](../tests/drive-attachments-cleanup.sql) — asserção manual
- [supabase/tests/drive-cleanup-fairness.sql](../tests/drive-cleanup-fairness.sql) — asserção manual
- [supabase/tests/drive-storage-behavior.sql](../tests/drive-storage-behavior.sql) — asserção manual
- [supabase/tests/drive-storage-catalog.sql](../tests/drive-storage-catalog.sql) — asserção manual
- [supabase/tests/finance-behavior.sql](../tests/finance-behavior.sql) — asserção manual
- [supabase/tests/finance-catalog.sql](../tests/finance-catalog.sql) — asserção manual
- [supabase/tests/finance-legacy-v2-installed.sql](../tests/finance-legacy-v2-installed.sql) — asserção manual
- [supabase/tests/finance-monthly-plan-behavior.sql](../tests/finance-monthly-plan-behavior.sql) — asserção manual
- [supabase/tests/finance-monthly-plan-catalog.sql](../tests/finance-monthly-plan-catalog.sql) — asserção manual
- [supabase/tests/finance-regression-installed.sql](../tests/finance-regression-installed.sql) — asserção manual
- [supabase/tests/global-search-behavior.sql](../tests/global-search-behavior.sql) — asserção manual
- [supabase/tests/global-search-catalog.sql](../tests/global-search-catalog.sql) — asserção manual
- [supabase/tests/global-search-performance.sql](../tests/global-search-performance.sql) — asserção manual
- [supabase/tests/identity-behavior.sql](../tests/identity-behavior.sql) — asserção manual
- [supabase/tests/identity-catalog.sql](../tests/identity-catalog.sql) — asserção manual
- [supabase/tests/knowledge-behavior.sql](../tests/knowledge-behavior.sql) — asserção manual
- [supabase/tests/knowledge-catalog.sql](../tests/knowledge-catalog.sql) — asserção manual
- [supabase/tests/projects-habits-behavior.sql](../tests/projects-habits-behavior.sql) — asserção manual
- [supabase/tests/projects-habits-catalog.sql](../tests/projects-habits-catalog.sql) — asserção manual
- [supabase/tests/release-catalog.sql](../tests/release-catalog.sql) — asserção manual
- [supabase/tests/sequence-defaults.sql](../tests/sequence-defaults.sql) — asserção manual
- [supabase/tests/settings-behavior.sql](../tests/settings-behavior.sql) — asserção manual
- [supabase/tests/settings-catalog.sql](../tests/settings-catalog.sql) — asserção manual
- [supabase/tests/vault-behavior.sql](../tests/vault-behavior.sql) — asserção manual
- [supabase/tests/vault-catalog.sql](../tests/vault-catalog.sql) — asserção manual
- [supabase/manual/bootstrap-master.sql](../manual/bootstrap-master.sql) — operação manual separada

Nenhum SQL é aplicado por este gerador. RLS, Auth, concorrência e grants efetivos exigem evidência de execução autorizada e registrada; a integridade do pacote não atesta esses resultados. Consulte [o registro operacional](../../docs/implementation/decisoes-operacionais.md) para o estado vigente.
