# Peer independente estático — N completo V3

24/10/2026. **Favorável para composição e CI próprio**, sem novo bloqueador objetivo. Não executei Node, testes, SQL, bundle, processo nativo, serviço, rede ou operação privada; não editei os payloads. A falha PROCESS_REFUSED original da PR continua sem causa terminal determinada. A correção do catálogo e o diagnóstico escrito não são PASS de execução.

## Identidade e preservação

Manifesto V3: 6.104 bytes/SHA-256 `5116d056d6209bc4792e01bc43350488f70167664e8d9670a927f739067710e4`. Conferidos os 11 after, os 11 beforeV2 contra o freeze V2 e os 11 arquivos do WT autor; todos os tamanhos/hashes coincidem. Conferidos os quatro artefatos patch/delta/proof/diffstat. Oito N permanecem byte a byte preservados, incluindo relatório operacional V2, sessão, SQL, entry, case e workflow. Somente runner, teste CI e documento mudaram.

Após remover em memória os helpers diagnósticos novos, reverter seu import/bloco e o expectedOldSource, a fonte integral do runner reproduz V2 exatamente. Essa comparação independente confirma que predicado de terminais, observers, limites, timers, grupos, bundle/grafo, fluxo de caso, Auth e cleanup não receberam outro delta. Sources Root7fb/BudgetEOF não pertencem ao transporte histórico e devem permanecer atuais.

## Associação do corpo histórico

`ADDITIVE_CATALOG.oldSource` consulta o prosrc de `app_private.fg_terminal_previous_commit(uuid,uuid,text,jsonb)`. M1 extrai o prosrc de `app_private.fg_commit` e o usa para criar esse executor histórico. A mudança esperada é, portanto, uma correção da associação do oracle ao corpo privado existente, não repin de corpo observado no banco.

Extraí independentemente os corpos do SQL público `proposals/finance-goals/04-commit.sql`, usando cabeçalho único e terminador $$; e normalizando apenas CRLF→LF: corpo privado8.914 bytes/SHA `86377bc8865a571c950eea05596531890225f19131c44f5a839c282e679c5ebf`; wrapper público71 bytes/SHA `498c676f3a28e20e597d4a8c0b62b37811b41a82844f59b32b389d6a31292c6e`. O novo teste exige ambos, sua diferença, o target do catálogo e as referências públicas da cópia M1. Não altera SQL, catálogo canônico, ACL, expected de outro objeto ou critério de comparação.

## Diagnóstico restrito

`runner:33–62` adiciona enum fechado de operação, projeção com descritores e writer failure-only. A classificação não devolve comando/argumentos/path e não faz coerção; valores com getters/proxies são recusados pelos utilitários puros existentes. O registro separado usa version1/scenario próprio; não acrescenta campos ao relatório operacional V2. Só admite contadores0–2, booleanos e códigos0–255/null; construção completa é limitada a1.024 bytes antes de uma escrita. Campos extras, raw error, SQL, output, env e credenciais não são serializados. Falha da projeção/writer retorna false sem imprimir a exceção.

`strictRun:85–88` emite apenas dentro da mesma condição de recusa original. Mantém stdout/stderr end, stdin finish, exit/close exatamente1, sinaisnull, códigos0 e groupConfirmedtrue; needInput é informativo e não dispensa finish. Os contadores saturados2 não apagam badTerminal. O diagnóstico não é recibo, prova de origem, ausência de backend ou autorização para outra ação. Não cura outcome incerto nem altera cleanup.

Foram acrescentados quatro controles escritos: três diagnósticos e um de associação de corpo; total33 declarações, ainda sem execução nesta revisão. Canários, getters, extras, limites e conservação do predicado original estão contemplados no texto. Nenhum resultado29/29 do SHA7f deve ser transferido para esta fonte V3.

## Resultados históricos e próximo gate

Preservar separadamente N PR7f/run40059892697/job120770914424: PROCESS_REFUSED/sources, Node24.21.0, sem fontes/PG/casos; e N PUSH7f/run40059889766/job120770906458: CATALOGUE_REFUSED/companions, fontes130/deps45/PG170011, zero casos. A associação incorreta é demonstrável estaticamente; os logs sozinhos não expõem cada campo do vetor aditivo nem a condição terminal que recusou a PR.

Requerir peer Root, transporte dos três deltas/11 N atuais sem Sources antigos e checks/originais do SHA novo. Aguardar fechamento dos19 originais7f antes do próximo push sujeito à concorrência. Não rerun/cancel/dispatch, alterar política, aumentar prazo, usar skip como PASS ou liberar merge/produção. O próximo diagnóstico deve explicar a recusa por observação própria; não presumir finish ausente ou outra hipótese sem o recibo original.