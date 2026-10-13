# Restore: tentativas supervisionadas de 13/10

A [quarta tentativa nativa](evidence/restore-observed-attempt4-20261013.json) foi executada uma vez com observer V3 revisado e runner original `503f00df7a60e2330f28ebef80faab3c76a61a3a`. Os 25 controles Node e 13 PowerShell passaram na revisão Root e no peer independente; os cinco arquivos congelados coincidiram com seus hashes. Essa QA sintética valida o observador, não o restore.

O runner retornou saída 1 e `PG_RESTORE_FAILED`. O processo nativo selecionado fechou com saída 1; foram observados 166 bytes de stderr, sem truncamento, classificados como `UNCLASSIFIED`. O primeiro cabeçalho completo teve prefixo reconhecido, estrutura `QUERY_EXECUTION` e severidade `ERROR`; não foi observado marcador de comando, e `reasonKnown` permaneceu `UNKNOWN`. Esses enums descrevem a estrutura observada e não identificam SQL, objeto ou causa. O texto bruto foi descartado e não foi reaberto nem publicado.

As causas da [primeira](evidence/restore-trial-native-20261013.json), [segunda](evidence/restore-observed-attempt2-20261013.json), [terceira](evidence/restore-observed-attempt3-20261013.json), quarta, quinta e sexta tentativas continuam desconhecidas. Não há atribuição a owners, DDL gerenciado ou versão, nem comprovação de compatibilidade de importação 18→17. Nenhum replay automático foi realizado.

A [quinta tentativa](evidence/restore-observed-attempt5-20261013.json) usou o mesmo runner, archive, perfil V2 e argumentos originais, após revisão integral do observer V4 pela raiz e por peer independente. Os 34 testes Node e 14 PowerShell passaram em ambas as revisões; controles adversariais adicionais também passaram. A cobertura passou a admitir um/dois espaços ASCII e templates portugueses públicos selecionados, sem atribuir esse formato às falhas anteriores. A execução única retornou `PG_RESTORE_FAILED`/saída 1; o child nativo fechou em 1, com 166 bytes não truncados, primeiro header `QUERY_EXECUTION`/`ERROR` e razão `UNKNOWN`. O observador conservou `UNCLASSIFIED`; não houve correção causal nem aceite.

As leituras distintas 7 antes e 8 depois da quinta tentativa passaram com PostgreSQL 17.11, TLS `verify-full`, Storage HTTP 200, quatro contagens selecionadas e buckets em zero. Mantêm os mesmos limites das reconferências anteriores, sem provar rollback global ou reservar o alvo. A próxima etapa é diagnóstico de fonte pública capaz de identificar um template canônico sem publicar placeholders; não repetir a importação enquanto esse protocolo não estiver revisado.

Duas reconferências readonly distintas, episódios 5 antes e 6 depois da quarta importação, passaram no alvo `jvwduowyavpaxssogadn`: saídas do wrapper, Node, metadados PostgreSQL e guard de vazio em zero; PostgreSQL 17.11, TLS `verify-full` e Storage HTTP 200. Usuários Auth, objetos, buckets e tabelas de aplicação foram zero nos checks selecionados de ambas. O perfil Restore V2 e o archive referenciados foram preservados. Essas leituras não reservam o alvo, não comprovam seu estado completo e não provam rollback global.

## Sexta tentativa e limite do diagnóstico

A [sexta tentativa](evidence/restore-observed-attempt6-20261013.json) usou o observer V5 e o protótipo V2 após leitura integral/diff da raiz e revisão independente: **71 controles do protótipo + 52 Node + 24 PowerShell**, repetidos em ambas as revisões, passaram. A correção pré-operacional admite um único CR terminador antes do LF sem alterar bytes ou a gramática do campo. Os três catálogos públicos completos foram qualificados por tamanho/hash; definição/perfil conservaram seus limites próprios. V1/V4, os nove pins da fonte original, os cinco argumentos, owners/grants e a transação permaneceram preservados.

A execução única fechou com `PG_RESTORE_FAILED`/saída 1, child nativo em 1, 166 bytes não truncados e header `QUERY_EXECUTION`/`ERROR`. O matching público retornou **AMBIGUOUS**, com ID nulo; a classificação continua `UNCLASSIFIED` e a razão `UNKNOWN`. Não foi extraído texto, SQL ou placeholder. Um encaixe gramatical não comprova a origem de uma mensagem e não será convertido em causa; as cinco tentativas anteriores não foram reinterpretadas.

As reconferências readonly distintas antes/depois passaram com PostgreSQL 17.11, TLS `verify-full`, Storage HTTP 200 e as quatro contagens selecionadas/buckets em zero. Não certificam estado completo, rollback global ou reserva do alvo. A análise pública posterior encontrou ambiguidades também em entradas artificiais; retirar formatadores genéricos não resolveria todas elas. Nenhuma sétima importação ou novo wrapper será executado sem uma proposta de diagnóstico ou correção revisável que acrescente informação útil.

O restore permanece sem aceite. A comparação de owners/grants e os aceites de Auth, arquivos e Cofre restaurados continuam pendentes; este episódio não valida agendamento ou custódia externa. Não houve operação adicional para redigir este registro, mudança de migration ou artefatos anteriores.

## Comparação posterior somente de catálogo

Após revisão integral Root/peer e **120 controles offline aprovados em cada revisão**, um adaptador separado executou duas consultas fixas `REPEATABLE READ READ ONLY`/`ROLLBACK`, com TLS `verify-full`, na origem pessoal e no Ensaio_restore. A [projeção pública](evidence/managed-schema-readonly-20261013.json) mostrou igualdade das duas schemas, 35 tabelas e 344 colunas selecionadas, com zero diferenças de nomes/kind, descritores de colunas e categorias de owner. Ambos tinham dois owners agrupados como `OTHER`. Só quantidades e booleanos saíram; não houve HTTP, abertura do archive ou nova importação.

Esse resultado afasta somente diferenças na projeção de metadados atual. `OTHER` não identifica o owner, e a comparação não cobre constraints, defaults, nulos, RLS, ACL, privilégios ou versões dos serviços. A origem atual também não é o snapshot do archive. A causa das seis falhas continua desconhecida e nenhum aceite ou autorização de replay foi inferido.

## Pré-condição adicional no operador canônico

A [revisão de ownership](restore-ownership-preflight-20261013.md) acrescentou uma consulta fixa readonly antes de iniciar o restore: ator de sessão inalterado e disponibilidade imediata dos owners atuais de schemas/tabelas gerenciadas. Root leu os dois arquivos completos e repetiu **59/59** controles de operações/transporte/backup/aceites, lint/sintaxe/diff. O agente repetiu 17/17; o peer revisou fonte/diff, oito controles adicionais em RAM e o caso SQL original 1/1 em PGlite. Esses resultados são offline; não certificam privilégios Supabase, todo o DDL do archive ou importação 18→17.

Os argumentos nativos, owners/ACLs, UUIDs e transação única permanecem originais. Não houve sétima importação, leitura de perfis ou reabertura das capturas privadas anteriores nesta incorporação. A causa das seis falhas permanece desconhecida. A próxima estratégia deve qualificar o alvo e o DDL antes de outro ensaio; owners/grants, Auth, arquivos, Cofre e agendamento conservam seus aceites separados. Não há migration nova ou pendente.

## Conferência real do modo atual, sem nova importação

O [preflight readonly canônico](restore-readiness-20261013.md), revisado por Root/peer e executado uma vez, confirmou vazio no guard selecionado e PostgreSQL 17.11. O operador não tinha ownership imediato de nenhum dos dois schemas ou das 35 tabelas gerenciadas; retornou `RESTORE_MANAGED_OWNER_PRIVILEGES_REQUIRED`. Isso demonstra a inviabilidade **atual** do modo full-clean sem troca de papel nesse operador/alvo, sem atribuir a causa às seis tentativas históricas. Nenhum archive, HTTP, escrita ou sétima importação foi executado.

A próxima correção preservará o baseline gerenciado e qualificará seleção/privilégios a partir do mesmo snapshot autenticado antes da execução. O novo núcleo está em implementação isolada com testes herméticos; ainda não é um modo de restore aprovado. A chave externa já foi copiada sem senha conforme OP-024; essa mudança não aprova restore, agendamento ou guarda física.
