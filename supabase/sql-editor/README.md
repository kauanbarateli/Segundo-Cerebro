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

A migration inicial recusa reexecução e destinos com contas/objetos preexistentes por preflight. Este pacote não faz instalação incremental nem detecta migrations já aplicadas.
O operador registra externamente versão, hash, destino e resultado. O manifest é integridade local; não é histórico de aplicação do Supabase.

## Validação e bootstrap separados

Os arquivos abaixo não estão na instalação. Consultar os pré-requisitos em [supabase/README.md](../README.md) antes de qualquer execução manual.
Todos terminam com ROLLBACK explícito. O bootstrap fornecido é uma simulação; persistir o primeiro master exige decisão manual após conferir o UUID.

- [supabase/tests/auth-password-completion.sql](../tests/auth-password-completion.sql) — asserção manual
- [supabase/tests/capture-task-behavior.sql](../tests/capture-task-behavior.sql) — asserção manual
- [supabase/tests/capture-task-catalog.sql](../tests/capture-task-catalog.sql) — asserção manual
- [supabase/tests/identity-behavior.sql](../tests/identity-behavior.sql) — asserção manual
- [supabase/tests/identity-catalog.sql](../tests/identity-catalog.sql) — asserção manual
- [supabase/manual/bootstrap-master.sql](../manual/bootstrap-master.sql) — operação manual separada

Nenhum SQL é aplicado por este gerador. RLS, Auth, concorrência e grants efetivos exigem evidência de execução autorizada e registrada; a integridade do pacote não atesta esses resultados. Consulte [o registro operacional](../../docs/implementation/decisoes-operacionais.md) para o estado vigente.
