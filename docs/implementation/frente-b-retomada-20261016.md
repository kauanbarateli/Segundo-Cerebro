# Frente B — retomada de 16/10/2026

Retomada autorizada pelo responsável para concluir o diagnóstico do restore, investigar as falhas do CI e revisar/incorporar as PRs entregues pela Frente A. Este registro complementa o [handoff de 13/10](handoff-retomada-20261013-restore-auth.md); os resultados anteriores preservam seus próprios hashes e ambientes.

## Estado atual após integração e correção local

A [PR #40](https://github.com/kauanbarateli/Segundo-Cerebro/pull/40) foi incorporada em `97669692260074809bdd991fd4eac8b01988fe96`. A árvore resultante é exatamente a árvore que passou os 106 testes de integração em Node 24.19.0, incluindo o controle nativo de ACL. Os cinco WIPs continuam preservados. A [evidência de revisão](evidence/a1-review-merge-20261016.json) separa o pacote original, o HEAD revisado e o merge efetivo.

O defeito do coletor legado foi isolado: o import transitivo de `next-stop-relay.mjs` elevou a união de fontes Git de 230 para 231; o pin ainda exigia 230. A correção mantém 50 dependências instaladas e a comparação dos blobs binários, sem reativar a entrega de Drive. Root passou 18/18 testes do coletor, lint dos quatro paths e TypeScript sem emissão. A [evidência local](evidence/ci-legacy-collector-correction-20261016.json) não certifica o próximo run hospedado.

A [integração do consumidor do snapshot](restore-snapshot-consumidor-20261016.md) passou 85/85 testes próprios de Root e revisão independente. Exige a capacidade original, descarta e zera as cópias e confere prazo absoluto antes de spawn/COMMIT. O inspector ainda não cunha capacidade: precisa primeiro do extrator dos fatos completos do archive e do A2. O [diagnóstico fechado do relay](auth-next-stop-diagnostico-20261016.md) passou 165/165 testes próprios de Root, incluindo o coletor legado, lint e TypeScript. Não concede novo aceite de cleanup. A nona inspeção observou somente o formato autenticado, conforme o registro abaixo; não houve nova importação, consulta ao destino ou reaplicação de migrations.

## Estado reconferido na abertura desta retomada

- `main` local e remota: `41b30fd9330c05afe1ed5340f4673502d44085cb`.
- Nenhuma PR aberta na primeira conferência desta retomada.
- Permanecem abertas #35, #12, #36 e os épicos #2/#7. Não existe aceite global do MVP.
- Os cinco WIPs do responsável foram preservados. Os quatro arquivos de diagnóstico e as duas evidências próprias produzidas antes da interrupção continuam no checkout, sem nova importação.
- A conexão MCP Supabase disponível aponta para um projeto diferente dos dois destinos autorizados. Foi consultada somente sua URL de identificação; não foram consultadas tabelas, dados ou configurações desse projeto.
- Origem pessoal `rishenjoikgmfubmnfiu` e alvo isolado `jvwduowyavpaxssogadn` conservam os perfis nativos preparados. Revalidar pins e destinos antes de cada operação. 001–019 já aplicadas; nenhuma reaplicação, reset ou seed.

## Restore

O [leitor binário B2 e o modo explícito inspect-toc](restore-custom-toc-20261016.md) estão implementados, com matriz de coerência do produtor e 48/48 testes próprios de Root, lint4 e 22/22 controles do dispatcher. A [primeira observação confirmada do TOC binário](evidence/restore-custom-toc-native-20261016.json), no SHA `e542389`, autenticou o backup, cruzou todas as 1.332 entradas da listagem nativa e conservou 350 preservadas; UTF8, HEADER+TOC de 876.752 bytes. Sem query ao destino, mint ou importação.

Dois preparos anteriores desse novo modo permanecem distintos: v1 recusou a seleção Git em preflight público; v2 recusou o protocolo e seu resultado de inspeção é indeterminado. QA pública isolou a ausência de `PATHEXT` na cadeia PowerShell→Node. V3 acrescentou somente `.EXE`; autor e Root passaram 14 controles puros e seis controles reais de processo com dados artificiais, mais peer de fonte. A nova observação confirmada pertence à v3, sem reclassificar a v2 nem inferir ausência de execução anterior.

A [leitura pura das histórias COPY B3](frente-b-migration-history.md) passou 17/17 próprios de Root e lint2, após revisão independente. Extração nativa das histórias, comparação A2 e qualificação do alvo continuam pendentes. O [preparador nominal B4 de baseline alvo](frente-b-target-baseline.md) foi revisado por Root e peer: 130/130 testes da combinação no worktree de revisão, lint5 e cópia por hashes exatos para Main. Tem WeakMap separado, cobertura integral `preserved + other` e nenhuma autoridade de importação ou prova de vazio. Seus novos pins de planner/B2 invalidam o reaproveitamento dos preparos nativos anteriores.

Após incorporar os nove paths revisados de B4 e do delta do experimento, Root passou na Main **36/36** controles dos dois recortes, lint dos sete `.mjs` e scanner de **1.490 arquivos versionáveis**, em processos sequenciais. A combinação de 130 testes conserva o ambiente e o worktree de revisão declarados acima. Esses resultados locais não antecipam o novo CI, o próximo experimento hospedado ou o baseline real do destino.

A [nona inspeção de formato](restore-custom-header-20261016.md), posterior ao recorte A1/B1, confirmou CUSTOM 1.16-0/4/8/GZIP após autenticação e plano. Foi uma operação explícita de observação, sem query ao alvo ou importação. O [contrato A2](contrato-a2-inventario-restore.md) e o [retorno à Frente A](resposta-frente-a-a1-a2-20261016.md) estão publicados para iniciar o comparador offline. Extração nativa das histórias, qualificação/comparação do alvo e mint continuam pendentes.

O getter privado do plano agora conserva os dois OIDs originais para permitir o cruzamento do TOC binário com a listagem nativa; o plano público continua sem esses campos. Root passou 49/49 testes de plano/capacidade e lint dos dois paths em Node 24.19.0. O contrato corrige a apresentação de namespace NULL versus vazio conforme `sanitize_line` de PG18.4; os bytes originais nunca são normalizados. Isso prepara o extrator, sem declarar seu aceite nativo.

A [terceira inspeção](evidence/restore-managed-inspection-acl-corrected-20261013.json) autenticou integralmente o archive e alcançou o planejador após o TOC nativo. A [quarta inspeção](evidence/restore-managed-inspection-toc-diagnostic-20261013.json), com diagnóstico adicional revisado, distinguiu `unknown_descriptor`. Essas operações ocorreram antes da interrupção e não são novas execuções de 16/10. Ambas recusaram o plano; não consultaram o alvo nem importaram dados.

A [quinta inspeção](evidence/restore-managed-inventory-native-20261016.json) autenticou o archive e identificou 1.332 entradas em 24 classes públicas, sem classe desconhecida ou linha malformada. O parser não contemplava os descritores globais `DATABASE` e `DATABASE PROPERTIES` produzidos pelo PostgreSQL 18. O delta revisado classifica exclusivamente seus metadados, preserva os objetos gerenciados e não os inclui na importação.

A [sexta inspeção](evidence/restore-managed-database-metadata-native-20261016.json), executada após 60 testes locais aprovados e revisão independente, avançou até `RESTORE_TOC_INVALID`, sem razão específica naquele envelope. O delta seguinte separou 29 motivos fechados dos vetos existentes, mantendo seus códigos, critérios, ordem e seleção.

A [sétima inspeção de listagem](evidence/restore-managed-plan-diagnostic-native-20261016.json) identificou `dependency_ids_repeated` em `TABLE` gerenciada. A [fonte oficial PG18](https://github.com/postgres/postgres/blob/REL_18_STABLE/src/bin/pg_dump/common.c) permite dependências repetidas. A correção seguinte deve preservar sua multiplicidade e ordem, continuando a recusar IDs de entradas repetidos, autoarestas e referências ausentes. Nenhuma dessas inspeções consultou o alvo ou importou dados; sétima inspeção não significa sétima importação.

O pacote diagnóstico passou 47 contratos próprios e 47 do peer. A execução mais recente de Root passou 63/63, incluindo stream; uma execução local anterior teve 62/63 e detalhe de falha não retido pelo terminal. Ela não foi usada como aceite nem teve causa atribuída. O controle ACL nativo preexistente ficou explicitamente excluído; sintaxe/lint dos quatro paths passaram. Esses testes não aprovam release nem estabilidade geral do CI.

Nomes, owners, IDs, SQL e conteúdo do TOC permanecem fora da projeção pública. Inventariar não qualifica o baseline e não autoriza restore. A Frente A mantém A1/A2; Root fornecerá o inventário permitido e revisará o HEAD exato de cada PR antes da integração.

A correção mínima mantém todas as dependências repetidas em sua ordem original, sem deduplicar ou normalizar o TOC. Após revisão independente, 50 contratos do autor, cinco focados do peer e 66 de Root passaram. A [oitava inspeção de listagem](evidence/restore-managed-native-plan-passed-20261016.json) autenticou o archive e aprovou o planejamento: **982 entradas selecionadas, 350 preservadas, cinco segmentos**. Não consultou o destino nem executou restore. Baseline e aceites de Auth/Storage/Cofre permanecem pendentes.

## CI

O [experimento isolado do transporte Chromium](browser-transport-probe.md) passou inicialmente 20/20 próprios de Root e lint2, com revisão independente. Seu workflow é exclusivamente manual, sem Next, Supabase ou credenciais. A [primeira execução e captura originais](evidence/browser-transport-probe-first-native-20261016.json), do SHA `e542389`, observaram controle não qualificado: cinco respostas terminadas pelo servidor, mas quatro terminais públicos/CDP e uma pendência até 15 s. Nenhum caso retido ou variante executou. Essa projeção não identifica o recurso pendente nem comprova a causa de Admin/Recovery. A captura está encerrada; não reabrir seus arquivos privados.

O delta posterior consome explicitamente o corpo do fetch da fixture, sem aguardar a cadeia no trigger nem fabricar terminais. Ele mantém produtor, observador, cinco requests, headers, prazos e limpeza. A fonte exata Chromium sustenta a hipótese de corpo não drenado com `no-store`; a hipótese ainda precisa de observação própria. Autor e Root passaram 23/23 e lint2, com peer independente; a nova execução desse delta terá SHA e registro próprios. Nenhum critério dos workflows Auth foi alterado para obter PASS.

As [novas capturas próprias de 3b30461](auth-next-stop-resultados-3b30461-20261016.md) distinguiram o relay original: Admin worker INELIGIBLE/STATIC_AUTHORITY_MISSING; Recovery worker EMITTED/NONE com quatro pendências na primeira falha. Os snapshots parent, posteriores ao settlement do runner e anteriores ao finally, mostraram requested=false e resolvedTrue=true, respectivamente. Não são observações simultâneas. São diagnósticos distintos, sem aceite de EOF/limpeza. O próximo recorte é um reprodutor público mínimo do terminal original, sem ampliar autoridade por hipótese.

O CI geral de `9a7c217` ([38957484266](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/38957484266)) concluiu success, com 27 etapas success, às 19:56:08 UTC. O CI geral da combinação `3b30461` ([38959031479](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/38959031479)) também concluiu success, run atualizado às 20:13:25 UTC. São metadados próprios de cada fonte; Admin/Recovery continuam failure nesses SHAs e exigem diagnóstico próprio, sem herdar esse aceite.

O CI geral de `df5e727` ([38961054972](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/38961054972)), já com o observador de formato, concluiu success com 27/27 etapas success e zero etapas puladas; o job terminou às 20:27:08 UTC. Admin e Recovery desse SHA continuam failure por metadados; não receberam nova captura de logs nem herdaram o aceite geral.

O CI geral da combinação `e542389` ([38971298500](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/38971298500)), já com B2/B3 e o primeiro experimento manual, terminou success em 16/10 às 21:57:13 UTC: job `117210036242`, 27/27 etapas success e nenhuma pulada. Metadados reconferidos às 21:58:58 UTC; não houve leitura de seus logs. Admin e Recovery desse SHA permanecem failure por metadados. O aceite geral não certifica esses dois workflows nem a inspeção nativa do backup.

No HEAD histórico `41b30fd`, CI geral `38479570308`, Admin `38479570248` e Recovery `38479570202` falharam por metadados. Seus passos originais são, respectivamente, 15/8/8, com os intervalos registrados no handoff. Os resultados das fontes novas abaixo não atribuem retrospectivamente causa ou aceite a esses runs.

O preparo anterior com `gh run view --log` foi mantido inerte: o [código oficial do GitHub CLI](https://github.com/cli/cli/blob/trunk/pkg/cmd/run/view/view.go) usa cache em disco para os logs. A observação geral do SHA publicado foi recusada, sem causa específica demonstrada, e permanece encerrada. A [sondagem somente de headers](evidence/ci-step-channel-headers-20261016.json) confirmou 404 nos três endpoints por etapa; ela não leu logs nem explica sozinha a recusa anterior.

Um novo canal explícito usa o [endpoint oficial por job](https://docs.github.com/en/rest/actions/workflow-jobs#download-job-logs-for-a-workflow-run). A seleção de Admin/Recovery conserva apenas o interior do intervalo da etapa original, após duas conferências de run/tentativa/job/step/SHA. O endpoint por job não fornece rótulos de etapa; nenhuma rotulagem é fabricada. A observação geral já encerrada não será repetida: o próximo diagnóstico geral dependerá de um novo run publicado.

O redirect assinado permanece em RAM. O token GitHub é enviado somente à API original, nunca ao download redirecionado; não há uso do cache de logs do CLI. Tamanho, prazo absoluto, EOF e UTF-8 são conferidos. O diagnóstico geral emite somente títulos de testes já presentes no Git do SHA publicado e contagens de títulos desconhecidos. Admin/Recovery conservam seus validadores fechados e exigem destino NTFS privado antes de escrever os novos artefatos.

O Node 24 usa `spec` como reporter padrão fora de TTY. O preparo geral anterior reconhecia somente TAP, uma incompatibilidade confirmada do preparo, sem comprovação de que tenha causado a falha do CI. O workflow passa a solicitar TAP explicitamente para os mesmos testes; o novo projetor aceita TAP e `spec`, emitindo somente títulos presentes no Git do SHA correspondente. Essas mudanças não demonstram que os testes hospedados passaram.

A [sondagem por job](evidence/ci-job-channel-headers-20261016.json) conferiu duas vezes os metadados de cada fonte e recebeu API 302/destino HEAD 200 nos três casos, sem consumir corpos. Os 27 controles RAM do transporte/probe passaram na execução de Root após corrigir somente uma corrida de temporizadores na fixture. O prazo de produção permaneceu igual.

A [primeira captura de Admin desse SHA](evidence/ci-admin-native-41b30fd-20261016.json), com 352 fontes Git e 60 dependências declaradas conferidas, retornou `QUIESCENCE_HTTP_AUTH_RESPONSE_PENDING`: oito estágios funcionais observados passaram no caso `BLOCK_LIVE_BROWSER`, mas uma requisição de login ainda não tinha terminal depois de `after-blank`. Escrita incerta permanece verdadeira, limpeza não certificada e o caso seguinte não executado. A captura foi diagnóstica; não explica os runs históricos nem conclui a causa no código.

A [primeira captura de Recovery desse SHA](evidence/ci-recovery-native-41b30fd-20261016.json), com 196 fontes Git e 60 dependências declaradas conferidas, retornou `QUIESCENCE_HTTP_ASSET_NO_RESPONSE_PENDING`: sete estágios observados, incluindo alteração de credenciais, mas cinco requisições pendentes e nenhum aceite de limpeza. O relay permite somente requests estáticos canônicos; a classe ASSET/script não comprova sua elegibilidade nem demonstra que o stop foi solicitado naquele instante. O diagnóstico de outcome/estado do relay ainda precisa de delta próprio; não ampliar a autoridade do stop para Auth por hipótese.

No novo SHA publicado `f92749d`, o [CI geral 38952800123](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/38952800123) falhou no passo 15. Sua [primeira leitura de logs](evidence/ci-general-native-f92749d-20261016.json), por JOB e intervalo original, isolou um teste: `full collector compares ASCII blob IDs against raw local bytes and50 installed dependencies`. Root o reproduziu em Node 24.19.0 com `SOURCE_REFUSED`, sem serviços reais. A correção do coletor legado não reativa Drive. O preparo anterior desse reader recusou antes de claim/download porque run e tentativa tinham updated_at diferentes por um segundo; o v2 qualifica separadamente os dois timestamps originais.

Não reabrir capturas privadas antigas, repetir a mesma fonte/run ou promover fixtures e ACKs parciais a fecho/limpeza. Os logs brutos novos permanecem no destino NTFS privado fora do Git e do OneDrive; as evidências versionáveis contêm somente projeções permitidas.

## Divisão de execução

Três agentes internos da Frente B retomam, em paths isolados: inventário do TOC; transporte HTTPS de CI; readers e destino privado de Admin/Recovery. Root concentra revisão, integração, operações reais, evidências e GitHub. Essa divisão não transfere nem duplica os módulos A1/A2 da outra frente.

## Recebimento do A1

A entrega local da Frente A foi obtida em checkout próprio, sem alterar o clone no OneDrive: HEAD `eb1fa400791158e01db0922fa838f578d1a0a1b6`, árvore `a2e6de461ad51b659c8f198f6bc1e50894244431`, três novos paths e hashes anunciados conferidos. Root e peers revisaram módulo, testes e proposta de integração. Em Node 24.19.0 e processos sequenciais, Root passou 21/21 do A1 e 66/66 dos quatro módulos existentes, incluindo o controle nativo de ACL. Lint dos dois arquivos e scanner de 1.443 arquivos passaram.

A [PR #40](https://github.com/kauanbarateli/Segundo-Cerebro/pull/40), HEAD `783653ea6c4270548ab892b3db2b40bc185d0885`, acrescenta apenas correções de orientação e do título de um teste após o HEAD original; nenhuma assertiva ou código do módulo foi alterado. Os 21 testes foram reconferidos após esse ajuste. A PR foi publicada draft, disparou push/PR/preview e depois foi incorporada conforme o estado atual acima. Os resultados locais não certificam esses runs.

A integração autenticada permanece com Root: um ponto de mint após autenticação total e extração dos fatos, lifetime explícito inicial de 90 s (máximo 180 s), descarte no erro de cleanup e no consumidor, cópias dedicadas zeradas e autorização sem `archiveAuthenticated`. O A2 depende de representar os fatos completos das entradas preservadas com origem vinculada; contagens/classes ou JSON de terceiros não qualificam o baseline.

As evidências acima têm seus próprios pins e resultados. Restore aceito, qualificador nativo, release completo e novas migrations não foram declarados executados. Os deltas seguintes e os novos runs terão registros separados.
