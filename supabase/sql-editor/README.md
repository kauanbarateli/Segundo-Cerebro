# Pacote para aplicação manual no SQL Editor

Gerado por `node scripts/build-sql-editor.mjs`. Não editar cópias; altere as migrations canônicas e gere novamente.
Antes de usar: `node scripts/build-sql-editor.mjs --check`. Esse comando verifica arquivos/hashes; não consulta nem altera banco.

## Instalação

No projeto pessoal novo e dedicado, revisar e executar manualmente um arquivo completo por vez, na ordem abaixo. Conferir sucesso antes do próximo arquivo.
Cada arquivo preserva exatamente o SQL e as transações da migration original. Falha interrompe a sequência; não continuar após erro.

1. [installation/001_20261007082811_identity_foundation.sql](installation/001_20261007082811_identity_foundation.sql) — versão 20261007082811
2. [installation/002_20261007114741_auth_password_completion.sql](installation/002_20261007114741_auth_password_completion.sql) — versão 20261007114741

A migration inicial recusa reexecução e destinos com contas/objetos preexistentes por preflight. Este pacote não faz instalação incremental nem detecta migrations já aplicadas.
O operador registra externamente versão, hash, destino e resultado. O manifest é integridade local; não é histórico de aplicação do Supabase.

## Validação e bootstrap separados

Os arquivos abaixo não estão na instalação. Consultar os pré-requisitos em [supabase/README.md](../README.md) antes de qualquer execução manual.
Todos terminam com ROLLBACK explícito. O bootstrap fornecido é uma simulação; persistir o primeiro master exige decisão manual após conferir o UUID.

- [supabase/tests/auth-password-completion.sql](../tests/auth-password-completion.sql) — asserção manual
- [supabase/tests/identity-behavior.sql](../tests/identity-behavior.sql) — asserção manual
- [supabase/tests/identity-catalog.sql](../tests/identity-catalog.sql) — asserção manual
- [supabase/manual/bootstrap-master.sql](../manual/bootstrap-master.sql) — operação manual separada

Nenhum SQL foi aplicado por este gerador. RLS, Auth, concorrência, grants efetivos e demais validações de banco continuam pendentes até execução manual registrada.
