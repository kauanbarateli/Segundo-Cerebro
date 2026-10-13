# Restore: quarta tentativa supervisionada

A [quarta tentativa nativa](evidence/restore-observed-attempt4-20261013.json) foi executada uma vez com observer V3 revisado e runner original `503f00df7a60e2330f28ebef80faab3c76a61a3a`. Os 25 controles Node e 13 PowerShell passaram na revisão Root e no peer independente; os cinco arquivos congelados coincidiram com seus hashes. Essa QA sintética valida o observador, não o restore.

O runner retornou saída 1 e `PG_RESTORE_FAILED`. O processo nativo selecionado fechou com saída 1; foram observados 166 bytes de stderr, sem truncamento, classificados como `UNCLASSIFIED`. O primeiro cabeçalho completo teve prefixo reconhecido, estrutura `QUERY_EXECUTION` e severidade `ERROR`; não foi observado marcador de comando, e `reasonKnown` permaneceu `UNKNOWN`. Esses enums descrevem a estrutura observada e não identificam SQL, objeto ou causa. O texto bruto foi descartado e não foi reaberto nem publicado.

As causas da [primeira](evidence/restore-trial-native-20261013.json), [segunda](evidence/restore-observed-attempt2-20261013.json), [terceira](evidence/restore-observed-attempt3-20261013.json) e quarta tentativas continuam desconhecidas. Não há atribuição a owners, DDL gerenciado ou versão, nem comprovação de compatibilidade de importação 18→17. Nenhum replay automático foi realizado.

Duas reconferências readonly distintas, episódios 5 antes e 6 depois da quarta importação, passaram no alvo `jvwduowyavpaxssogadn`: saídas do wrapper, Node, metadados PostgreSQL e guard de vazio em zero; PostgreSQL 17.11, TLS `verify-full` e Storage HTTP 200. Usuários Auth, objetos, buckets e tabelas de aplicação foram zero nos checks selecionados de ambas. O perfil Restore V2 e o archive referenciados foram preservados. Essas leituras não reservam o alvo, não comprovam seu estado completo e não provam rollback global.

O restore permanece sem aceite. A comparação de owners/grants e os aceites de Auth, arquivos e Cofre restaurados continuam pendentes; este episódio não valida agendamento ou custódia externa. Não houve operação adicional para redigir este registro, leitura de entradas privadas ou mudança de código, migration ou artefatos anteriores.
