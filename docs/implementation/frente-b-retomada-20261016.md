# Frente B — retomada de 16/10/2026

Retomada autorizada pelo responsável para concluir o diagnóstico do restore, investigar as falhas do CI e revisar/incorporar as PRs entregues pela Frente A. Este registro complementa o [handoff de 13/10](handoff-retomada-20261013-restore-auth.md); os resultados anteriores preservam seus próprios hashes e ambientes.

## Estado reconferido

- `main` local e remota: `41b30fd9330c05afe1ed5340f4673502d44085cb`.
- Nenhuma PR aberta na primeira conferência desta retomada.
- Permanecem abertas #35, #12, #36 e os épicos #2/#7. Não existe aceite global do MVP.
- Os cinco WIPs do responsável foram preservados. Os quatro arquivos de diagnóstico e as duas evidências próprias produzidas antes da interrupção continuam no checkout, sem nova importação.
- A conexão MCP Supabase disponível aponta para um projeto diferente dos dois destinos autorizados. Foi consultada somente sua URL de identificação; não foram consultadas tabelas, dados ou configurações desse projeto.
- Origem pessoal `rishenjoikgmfubmnfiu` e alvo isolado `jvwduowyavpaxssogadn` conservam os perfis nativos preparados. Revalidar pins e destinos antes de cada operação. 001–019 já aplicadas; nenhuma reaplicação, reset ou seed.

## Restore

A [terceira inspeção](evidence/restore-managed-inspection-acl-corrected-20261013.json) autenticou integralmente o archive e alcançou o planejador após o TOC nativo. A [quarta inspeção](evidence/restore-managed-inspection-toc-diagnostic-20261013.json), com diagnóstico adicional revisado, distinguiu `unknown_descriptor`. Essas operações ocorreram antes da interrupção e não são novas execuções de 16/10. Ambas recusaram o plano; não consultaram o alvo nem importaram dados.

A [quinta inspeção](evidence/restore-managed-inventory-native-20261016.json) autenticou o archive e identificou 1.332 entradas em 24 classes públicas, sem classe desconhecida ou linha malformada. O parser não contemplava os descritores globais `DATABASE` e `DATABASE PROPERTIES` produzidos pelo PostgreSQL 18. O delta revisado classifica exclusivamente seus metadados, preserva os objetos gerenciados e não os inclui na importação.

A [sexta inspeção](evidence/restore-managed-database-metadata-native-20261016.json), executada após 60 testes locais aprovados e revisão independente, avançou até `RESTORE_TOC_INVALID`, sem razão específica naquele envelope. O delta seguinte separou 29 motivos fechados dos vetos existentes, mantendo seus códigos, critérios, ordem e seleção.

A [sétima inspeção de listagem](evidence/restore-managed-plan-diagnostic-native-20261016.json) identificou `dependency_ids_repeated` em `TABLE` gerenciada. A [fonte oficial PG18](https://github.com/postgres/postgres/blob/REL_18_STABLE/src/bin/pg_dump/common.c) permite dependências repetidas. A correção seguinte deve preservar sua multiplicidade e ordem, continuando a recusar IDs de entradas repetidos, autoarestas e referências ausentes. Nenhuma dessas inspeções consultou o alvo ou importou dados; sétima inspeção não significa sétima importação.

O pacote diagnóstico passou 47 contratos próprios e 47 do peer. A execução mais recente de Root passou 63/63, incluindo stream; uma execução local anterior teve 62/63 e detalhe de falha não retido pelo terminal. Ela não foi usada como aceite nem teve causa atribuída. O controle ACL nativo preexistente ficou explicitamente excluído; sintaxe/lint dos quatro paths passaram. Esses testes não aprovam release nem estabilidade geral do CI.

Nomes, owners, IDs, SQL e conteúdo do TOC permanecem fora da projeção pública. Inventariar não qualifica o baseline e não autoriza restore. A Frente A mantém A1/A2; Root fornecerá o inventário permitido e revisará o HEAD exato de cada PR antes da integração.

## CI

No HEAD publicado, CI geral `38479570308`, Admin `38479570248` e Recovery `38479570202` falharam por metadados. A causa ainda não foi demonstrada. Seus passos originais são, respectivamente, 15/8/8, com os intervalos registrados no handoff.

O preparo anterior com `gh run view --log` foi mantido inerte: o [código oficial do GitHub CLI](https://github.com/cli/cli/blob/trunk/pkg/cmd/run/view/view.go) usa cache em disco para os logs. A observação geral do SHA publicado foi recusada, sem causa específica demonstrada, e permanece encerrada. A [sondagem somente de headers](evidence/ci-step-channel-headers-20261016.json) confirmou 404 nos três endpoints por etapa; ela não leu logs nem explica sozinha a recusa anterior.

Um novo canal explícito usa o [endpoint oficial por job](https://docs.github.com/en/rest/actions/workflow-jobs#download-job-logs-for-a-workflow-run). A seleção de Admin/Recovery conserva apenas o interior do intervalo da etapa original, após duas conferências de run/tentativa/job/step/SHA. O endpoint por job não fornece rótulos de etapa; nenhuma rotulagem é fabricada. A observação geral já encerrada não será repetida: o próximo diagnóstico geral dependerá de um novo run publicado.

O redirect assinado permanece em RAM. O token GitHub é enviado somente à API original, nunca ao download redirecionado; não há uso do cache de logs do CLI. Tamanho, prazo absoluto, EOF e UTF-8 são conferidos. O diagnóstico geral emite somente títulos de testes já presentes no Git do SHA publicado e contagens de títulos desconhecidos. Admin/Recovery conservam seus validadores fechados e exigem destino NTFS privado antes de escrever os novos artefatos.

O Node 24 usa `spec` como reporter padrão fora de TTY. O preparo geral anterior reconhecia somente TAP, uma incompatibilidade confirmada do preparo, sem comprovação de que tenha causado a falha do CI. O workflow passa a solicitar TAP explicitamente para os mesmos testes; o novo projetor aceita TAP e `spec`, emitindo somente títulos presentes no Git do SHA correspondente. Essas mudanças não demonstram que os testes hospedados passaram.

A [sondagem por job](evidence/ci-job-channel-headers-20261016.json) conferiu duas vezes os metadados de cada fonte e recebeu API 302/destino HEAD 200 nos três casos, sem consumir corpos. Os 27 controles RAM do transporte/probe passaram na execução de Root após corrigir somente uma corrida de temporizadores na fixture. O prazo de produção permaneceu igual.

A [primeira captura de Admin desse SHA](evidence/ci-admin-native-41b30fd-20261016.json), com 352 fontes Git e 60 dependências declaradas conferidas, retornou `QUIESCENCE_HTTP_AUTH_RESPONSE_PENDING`: oito estágios funcionais observados passaram no caso `BLOCK_LIVE_BROWSER`, mas uma requisição de login ainda não tinha terminal depois de `after-blank`. Escrita incerta permanece verdadeira, limpeza não certificada e o caso seguinte não executado. A captura foi diagnóstica; não explica os runs históricos nem conclui a causa no código. Recovery está em sua primeira captura própria.

Não reabrir capturas privadas antigas, repetir a mesma fonte/run ou promover fixtures e ACKs parciais a fecho/limpeza. Os logs brutos novos permanecem no destino NTFS privado fora do Git e do OneDrive; as evidências versionáveis contêm somente projeções permitidas.

## Divisão de execução

Três agentes internos da Frente B retomam, em paths isolados: inventário do TOC; transporte HTTPS de CI; readers e destino privado de Admin/Recovery. Root concentra revisão, integração, operações reais, evidências e GitHub. Essa divisão não transfere nem duplica os módulos A1/A2 da outra frente.

As evidências acima têm seus próprios pins e resultados. Restore aceito, qualificador nativo, release completo e novas migrations não foram declarados executados. A próxima correção do parser, as demais capturas e os novos runs terão registros separados.
