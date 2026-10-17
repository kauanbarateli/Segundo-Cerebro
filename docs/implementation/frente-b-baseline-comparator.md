# Frente B — comparador puro do baseline gerenciado

Implementação de A2 por autorização do responsável, com escopo transferido a Root e este agente em 16/10/2026. O [contrato de inventário](contrato-a2-inventario-restore.md) permanece a referência integral; o módulo não contém extrator, adaptador nativo, consulta ao alvo, operação de restore, qualificador ou mint.

## Interface e autoridade

`scripts/operations/restore-managed-baseline.mjs` exporta `compareManagedBaseline(archive, target)` e três constantes congeladas: `MANAGED_BASELINE_ERROR_CODES`, `MANAGED_BASELINE_REASONS` e `MANAGED_BASELINE_LIMITS`. Os inputs são exatamente `BaselineInputV1`, com `BaselineBinding.side` archive no primeiro e target no segundo, e os 20 campos originais de `TocRecord`.

A chamada é síncrona e não oferece porta, callback, ambiente, processo, IO, SQL, rede, CLI ou capacidade nativa. Retorna somente `{version:1,matches,reasons}`, com objeto e array congelados. Os motivos são únicos e respeitam a ordem literal dos 15 motivos do contrato. Erros estruturais lançam `BackupError` original com um dos três códigos literais, sem causa, texto recebido ou payload. O catch externo reconhece seus erros por WeakSet; propriedades de erro entregues pelo chamador não são prova de origem.

Bindings são correlações validadas, nunca autenticação de JSON. Mesmo uma igualdade matemática válida de dois subsets vazios não demonstra cobertura do catálogo ou presença das duas histórias. Root confirma separadamente a enumeração integral B2, histórias nativas originais, cobertura dos preservados, organização/destino, ator, vazio e privilégios. Root verifica a capacidade viva antes/depois da comparação; esta chamada não a consome, renova ou cunha.

## Comparação sem perda

Identidades usam classe, tag e namespace original completos, inclusive SCHEMA/DATABASE/DATABASE PROPERTIES; a revisão independente exigiu conservar esse vetor literal também nas classes globais. DEFAULT ACL inclui ainda o owner do emissor na identidade. NULL/vazio divergentes produzem `identity_set_mismatch`, e dependências internas sem bijeção correspondente conservam seu motivo próprio de vetor.

SHA-256 somente acelera a seleção de buckets. Cada candidato no bucket passa por comparação dos bytes completos da identidade original. Dois registros com identidade ambígua do mesmo lado recusam; IDs numéricos iguais entre dumps nunca estabelecem correspondência. OIDs, ordinal, offset e estado físico são validados nos intervalos do contrato, mas não igualados. A coerência do produtor/TOC/header é responsabilidade do extrator original de Root; A2 não inventa um novo parser físico nem exige ordinal contíguo de um subset.

Cada par inequívoco compara seção, dumper, definição, drop/copy statement, owner, tablespace, table access method, relkind e withOids integralmente. Não altera SQL, whitespace, comentários, CRLF, owner, ACL ou propriedade de banco. NULL, array vazio e bytes não vazios permanecem estados distintos. Tag/namespace divergentes são expostos somente pelo motivo fechado de identidade; nenhum nome sai no resultado.

Dependências conservam ordem e multiplicidade. O vetor é comparado pela bijeção de identidades, incluindo sua aridade. Referência fora dos preservados de qualquer lado sempre produz `dependency_scope_unsupported`; não é ignorada para conceder igualdade nem equiparada por seu número. Posições internas continuam comparadas. Dump IDs duplicados, identidades ambíguas e arestas não positivas/self-edge usam `GRAPH_INVALID`; esta versão não acrescenta um requisito de DAG ausente do contrato.

TABLE DATA, quando presente nos preservados, só admite as identidades exatas auth.schema_migrations e storage.migrations. Outro dado preservado recusa como input inválido, em vez de ser filtrado. A definição e COPY desses registros continuam comparados; dados selecionados Auth/Storage/aplicação permanecem no replay de Root.

Histórias são validadas e copiadas para containers próprios, com strings primitivas, sem métodos ou protótipos do input. `compareManagedMigrationHistory` é reutilizado para comparar cada família: versões Auth e id/name/hash Storage com suas regras originais, independentes da ordem. Somente `storage.migrations.executed_at` permanece fora da igualdade; seu tipo e tamanho continuam validados. Nenhum timestamp adicional é removido. O comparador não interpreta SQL/COPY nem reabre os blocos nativos.

## Inputs hostis, limites e memória

Proxy, inclusive revogado, recusa antes de shape/descriptors. Records e arrays exigem propriedades próprias de dados, sem extras, símbolos ou getters. Arrays são densos; tamanho individual/cumulativo é conferido antes de enumerar seus índices. Não são chamados iteradores, toJSON ou valueOf fornecidos pelo input.

ByteString é NULL ou Uint8Array genuína. Intrinsics capturados obtêm tag, backing store, offset e tamanho; DataView testa detach inclusive para uma vista vazia. SharedArrayBuffer, proxies, outras views e impostores recusam. Shadows de buffer/byteLength/set/fill/iterator são ignorados, sem invocação; não enumeramos milhões de índices de uma typed array de 4 MiB para procurar shadows sem efeito. Essa decisão foi confirmada por Root e corresponde à estratégia do leitor B2.

Os limites fixos são 64 MiB do dump declarado, 32 MiB somados dos campos TOC por lado, 4 MiB por ByteString, 10.000 registros e 100.000 referências cumulativas, além de 10.000 linhas/4 MiB UTF-8 de histórias por lado. Repetições e views sobrepostas contam novamente no consumo lógico das cotas. Strings são medidas sem reencoding, recusando UTF-16 malformado antes do helper existente. Tetos excedidos não são convertidos em divergência semântica.

O módulo toma somente referências locais efêmeras a vistas novas sobre os buffers não compartilhados já validados. Não copia os 32 MiB de TOC, não retém esses bytes em mapas/erros/resultados e não devolve nenhuma vista. Como a execução é síncrona e não chama código do input, não existe ponto de callback entre validação e comparação. Root mantém ownership, bindings e zeragem dos buffers ao terminar sua vida útil. Strings de histórico e alocações internas do helper continuam sujeitas ao GC JavaScript; não se promete apagamento físico.

## Validação e próximos passos

A suíte nova utiliza somente registros e histórias artificiais em RAM. Cobre classes suportadas, mudanças isoladas de campo, definições/ACLs/propriedades integrais, distinção NULL/vazio, bijeção com IDs/OIDs distintos, dependências ordenadas/repetidas/externas, quinze motivos em ordem, histórias, inputs hostis e fronteiras das cotas. Não usa os dados privados observados por Root.

Primeira rodada própria em Node 24.19.0: **62/62 testes RAM passaram** em 505 ms com `node --test --test-concurrency=1 tests/scripts/restore-managed-baseline.test.mjs`. Depois, `eslint --max-warnings=0` nos dois `.mjs` passou sem avisos, em processo separado. Nenhum retry, teste nativo ou consulta remota foi feito. A execução coordenada usou somente este módulo e seus registros sintéticos; não certifica CI, comparação nativa, autorização ou restore. Root deverá realizar peer independente, validar a combinação e ligar os inputs originais ao comparador sem promover JSON, counts ou um boolean de matches a autoridade.

A revisão de Root exigiu posteriormente incluir sempre o namespace original na identidade, inclusive nas três classes globais. O delta remove somente a exceção anterior de identidade/bucket e acrescenta a regressão de tags iguais em namespaces diferentes, com NULL/vazio distintos. Os 62 resultados acima pertencem à fonte anterior. Na fonte final, a nova rodada própria passou **63/63 testes RAM**, sem skips/falhas, em 430 ms, seguida de lint dos dois `.mjs` sem avisos em processo separado. O semáforo foi devolvido após essa rodada; nenhum comando nativo foi executado.

Nenhuma migration, arquivo existente de Root, perfil, archive, captura privada, projeto remoto ou configuração do sistema foi alterado. Nenhum commit ou push foi feito por este agente.
