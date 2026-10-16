# Inspeção explícita dos históricos de migrations — 16/10/2026

## Entrega e limites

O inspector oferece `inspect-history ABSOLUTE_ARCHIVE` e o dispatcher oferece `restore-inspect-history`. A operação autentica todos os registros, footer, manifest e EOF do backup, reconfere o ciphertext, obtém a listagem nativa e seu encerramento, planeja a seleção e cruza o TOC binário com a listagem antes de iniciar a extração dos dois históricos preservados.

`restore-migration-history-native.mjs` seleciona somente as duas linhas originais correspondentes a `auth.schema_migrations` e `storage.migrations`. Executa `pg_restore --data-only --use-list=... --file=- --restrict-key=SCBaselineV1`, sem conexão de banco ou cliente SQL. A saída completa passa pelo parser B3. Definições, nomes, rows, SQL, bytes e handles permanecem em RAM privada; a CLI publica somente contagens, tamanho da saída e enums de transporte. Portas de teste produzem `transportMode=synthetic`, que não é promovido a observação nativa.

O arquivo de seleção pertence a um subdiretório novo do diretório exclusivo e protegido do inspector. A extração herda seu prazo absoluto de 45 segundos, sem nova janela para leitura ou limpeza. O receipt nominal e seu guard de primeira falha continuam vivos durante a limpeza assíncrona externa do inspector. O getter é reconferido após essa limpeza; somente depois são descartados o histórico e o TOC. Um erro original tardio, falha de limpeza ou expiração impede a publicação do resultado.

`selected_tail_unconsumed` só é permitido na leitura dos históricos, com evento EPIPE original e callback EPIPE original, sem finish contraditório, EOF das duas saídas, close0, dois COPYs completos, bindings íntegros e limpeza concluída. Isso não prova consumo integral do dump. A política de EPIPE da importação de DATA permanece inalterada.

O erro do modo novo inclui `nativeHistoryDiagnostic`, obtido somente da primeira recusa original do reader. `parserError` é nulo ou um código fechado B3 capturado em chamada direta confiável; não são lidos message, cause ou getters de provedores. Os schemas dos modos anteriores permanecem preservados.

## Validação própria de Root

- Node 24.19.0, um processo e `--test-concurrency=1`: **58/58** em `restore-managed-inspect.test.mjs` e `restore-migration-history-native.test.mjs`, duração 14.003 s. O controle ACL nativo preexistente foi explicitamente excluído pelo padrão `fixed native ACL helper protects`; nenhum teste de PostgreSQL real ou perfil privado foi executado nessa rodada. O total inclui os 25 testes do reader, os cinco novos controles de integração e as regressões do inspector.
- Controles novos executam AEAD real em ciphertext artificial, B2/B3 nominais e filhos/arquivos de seleção simulados em RAM. Cobrem ordem das pré-condições, somente agregados, cópias zeradas, EPIPE restrito, recusa B3, erro original após entrega do reader durante a limpeza do inspector, falha de limpeza e prazo herdado.
- Dispatcher PowerShell: **24/24**, incluindo 12 chamadas ao Node apenas para eco de argumentos artificiais; `profilesRead=false` e `remoteExecuted=false`.
- ESLint dos quatro arquivos MJS de runtime/QA: exit 0, sem avisos.

Uma revisão posterior identificou o mesmo limite de Promise já resolvida na listagem nativa anterior. O inspector passou a reter sua recusa original e consultá-la no scope herdado, no catch e após a limpeza. Um erro não-EPIPE posterior ao EOF/close0 não é ignorado, inclusive se resultar do `stdin.destroy()` preexistente; a política EPIPE não foi ampliada. A nova rodada própria passou **34/34** testes do inspector em 13.243 s, novamente com o ACL nativo explicitamente excluído, seguida de lint2. Pins desse delta: inspector `E502CF2F59E4B3E84E251C522AC0657DBA566BC2731472F0E4CD7C99AB5091A6`, QA `8E254CE71EE0559CB1A7369190E6AEA0250BE669BC9FA68044E9D29913F29776`. Os 58 resultados anteriores permanecem vinculados ao delta anterior; não são apresentados como uma rodada combinada da fonte alterada.

Pins do reader revisado: runtime `BA2798C241021AFFE6160B689FA15A9DD04B7934C3DC5AA2DAEC9191C3501B37`; QA `28038273169BFD732C4D681D8CD38F4C45849721EE96291370FA7C6F8EC76AED`; documento `538126E8A54FFF22BD63A1FA9A048D4CC762F0625B5D0B5254A5092984425E61`. A rodada própria pertence a esses arquivos e ao delta de integração local; não certifica automaticamente outro SHA publicado ou execução hospedada.

## Próxima validação conectada

A revisão independente de fonte aprovou o reader final, o dispatcher e o inspector com guard de listagem. Limite diagnóstico: a recusa retida da listagem tem prioridade fixa no catch e na conclusão externos. Se outro produtor falhar primeiro e a listagem recusar antes da captura externa, a CLI pode escolher o erro de listagem e não expor o diagnóstico do reader. Isso recusa a operação; não certifica ordem cronológica global entre produtores. O guard interno do reader conserva seu próprio primeiro snapshot. O documento do pacote do autor permanece congelado no estágio anterior à ligação; esta nota registra a integração posterior por Root.

Preparar um launcher novo com gate inicialmente fechado, pins da união transitiva das fontes e projeção estrita; revisar e testar antes de uma única inspeção dos históricos do archive autorizado. Não reutilizar o preparo TOC anterior, cujos pins e operação são históricos. Nenhuma inspeção real dos históricos está atestada por este documento.

Não há consulta ao alvo, comparação A2, mint de snapshot, autorização de importação, sétima importação, aplicação de migrations ou aceite global do restore/MVP nesta entrega. O baseline real do alvo e o comparador A2 continuam necessários antes de habilitar o consumidor de restore.
