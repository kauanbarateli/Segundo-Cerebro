# Validação independente da finalização — 09/10/2026

Projetos/Hábitos, Configurações, Busca e Atividade ampliada passaram pelas oito asserções abaixo em PostgreSQL descartável PGlite 0.5.8. A cadeia carregou as cinco migrations históricas e as novas migrations até Cofre. As tabelas de Auth e Storage são fixtures explícitas do harness, sem serviço HTTP, autenticação real, objetos de Storage ou conexão remota. Cada asserção usa identidades aleatórias, termina em `ROLLBACK` e a verificação final encontrou zero contas sintéticas restantes.

| Asserção | Evidência local |
| --- | --- |
| `projects-habits-catalog.sql` | RPCs e helpers protegidos, RLS/grants, owner FKs, revisões das fontes, unicidade de marcações e guard de projeto vivo |
| `projects-habits-behavior.sql` | Snapshot/CAS, replay antes da revisão, conflito de recibo, rollback após falha injetada de Evento, criação contextual de caderno, vínculo de pastas/capturas com nome de 200 caracteres, apagar/restaurar projeto sem apagar origem, 120 marcações históricas, futuro/pausa, dono/sessão/veto/moderação |
| `settings-catalog.sql` | Configurações através de RPCs estreitas, `search_path` vazio, ausência de escrita direta, novas preferências e owner FK de avatar |
| `settings-behavior.sql` | DTO de perfil, preferências e módulos, campos fechados, idempotência, quota de escrita persistida, replay mesmo após esgotar o limite, rollback de dado/recibo/limite após falha de Evento, veto/dono/sessão/moderação |
| `global-search-catalog.sql` | Sete fontes com FTS e índice de substring GIN/`pg_trgm`, RLS e RPC protegida |
| `global-search-behavior.sql` | Sete tipos, acento/caixa/ranking, `%`/`_` literais, filtros de ativos e Drive, dono/veto/sessão/moderação, preferência oculta preservada, DTO sem valores financeiros ou corpos |
| `activity-expanded-catalog.sql` | Mapa dos 28 tipos, nomes atuais de campos, helpers puros, índice de todos os eventos, RLS ampliada e leitura direta limitada a sete colunas de metadados |
| `activity-expanded-behavior.sql` | 24 tipos instalados nesta rodada, quatro eventos seguros de provisionamento, paginação completa sem duplicações e com microssegundos, diff somente com nomes, títulos financeiros/Cofre nulos, arquivos Drive sem avatar/anexo, origem de contêiner respeitada, owner/veto/moderação/sessão e recusa de leitura direta de `before`/`after`/`capture_task_payload` |

A migration Calendar ainda estava em preparação durante esta rodada e foi omitida apenas no runner temporário local. A asserção de comportamento inclui automaticamente seus quatro tipos quando `calendar_accounts` existe; a rodada completa de 28 tipos deve ocorrer após sua estabilização. O catálogo já verifica o contrato dos 28 tipos. As asserções históricas de T016 registram o comportamento de 07/10, anterior à projeção ampliada; a rodada final desta ampliação usa os arquivos `activity-expanded-*`.

## Rodada integral final

A rodada final da raiz instalou todas as 14 migrations, incluindo Calendar, e executou as 29 asserções padrão com sucesso. Os 28 tipos de Evento foram exercitados; asserções históricas foram ajustadas ao contrato ampliado sem modificar nenhuma das cinco migrations aplicadas em 07/10. Não restaram contas sintéticas após rollback.

O catálogo readonly final passou **1.242 checks**, incluindo fingerprints de 33 predicados RLS, grants por coluna/papel, RPCs privadas/públicas, defaults, buckets e gates das fontes. O runner verifica `ok=true` e zero desvios do JSON; receber linhas do PostgreSQL por si só não é sucesso.

O runner versionado agora descobre por padrão todas as asserções, exceto a de performance optativa, e não permite migration vazia. Para reproduzir:

```sh
npm run test:local-sql
node scripts/test-local-sql.mjs supabase/tests/global-search-performance.sql
```

A raiz repetiu o ensaio de 50 mil metadados após o freeze SQL: máximos `%` 27 ms, `Ação planejamento 50000` 16 ms, `Documento pessoal` 28 ms, `ação` 29 ms, `planej` 29 ms e termo inexistente 12 ms. Esses números desta máquina não são SLA hospedado. O orçamento local recomendado de 500 ms é verificado no runner; ensaio remoto permanece manual.

O parsing final cobriu **59 arquivos**, sem erro; o manifest registrou 14 migrations e 31 scripts separados. Nenhum SQL remoto foi executado nesta conclusão. Auth/Storage continuam fixtures explícitas, e não houve transações realmente sobrepostas.

## Correções produzidas pela revisão

O snapshot de Projetos/Hábitos usava `result` tanto como variável PL/pgSQL quanto como coluna de recibos; a variável virou `v_snapshot`. A criação contextual de caderno passou a fornecer `id/user_id` físicos para o trigger de Conhecimento. O proxy de contêiner e a tabela de pastas aceitam nomes existentes de até 200 caracteres; a criação contextual pelo Núcleo continua limitada a 120 caracteres.

Configurações consome `identity_write` na mesma transação do comando, depois do replay e antes da mutação. Asserções confirmam que três escritas consomem três hits, falhas e replay não consomem hits, e um recibo exato funciona após os 30 hits do limite. Falha de Evento reverte a alteração, o recibo e o hit juntos. A camada HTTP foi ajustada pelo root para não duplicar essa cobrança e traduzir `PT429`.

A revisão de Atividade corrigiu os nomes persistidos `module_preference` e `finance_account.archived_at`. Também encontrou que a policy antiga de leitura direta de eventos só conferia veto de Capturas/Tarefas. O root ampliou o gate de origem e restringiu `authenticated` às sete colunas de metadados: o usuário não pode ler payloads privados diretamente, mesmo de seus próprios eventos. As assertions exercitam a policy efetiva por papel `authenticated` e esperam `42501` para as três colunas de payload.

## Busca com 50 mil arquivos

`global-search-performance.sql` cria 50 mil linhas sintéticas de metadados de Drive, mantém os triggers/índices e executa `ANALYZE`. Para cada termo há um aquecimento e três medições. Não há arquivo de Storage; fixtures e medições são descartadas pelo rollback. O orçamento de 500 ms é **RECOMENDADO** e não é uma promessa de latência hospedada ou condição artificial de aprovação do teste.

A primeira rodada encontrou máximo de 531 ms para `planej`. Drive/Hábito já armazenam o documento normalizado apenas com seu título; o ranking passou a reutilizá-lo em vez de normalizar novamente cada linha candidata até três vezes. A função de Atividade permaneceu independente desse ajuste.

| Termo | Média antes (ms) | Média depois (ms) | Máximo depois (ms) | Itens |
| --- | ---: | ---: | ---: | ---: |
| `%` | 396,00 | 33,00 | 41,00 | 10 |
| `Ação planejamento 50000` | 30,00 | 27,67 | 28,00 | 1 |
| `Documento pessoal` | 295,67 | 46,33 | 48,00 | 10 |
| `ação` | 363,67 | 42,67 | 49,00 | 10 |
| `planej` | 495,67 | 46,67 | 51,00 | 10 |
| `termo inexistente` | 21,00 | 13,67 | 18,00 | 0 |

Todos os máximos da segunda rodada ficaram abaixo de 500 ms neste harness local. Os números não medem rede, concorrência, planner/configuração do projeto hospedado, sete fontes simultaneamente com 50 mil linhas cada ou experiência de navegador. A validação conectada permanece necessária.

## Reprodução e limites de aceite

Depois de todas as novas migrations estarem estáveis, o runner `scripts/test-local-sql.mjs` aceita os oito arquivos de asserções explicitamente como argumentos. Para capturar os números, preservar os resultados do último `SELECT` de `global-search-performance.sql`; o runner padrão resume sucesso sem imprimir as linhas das medições. O runner temporário desta rodada apenas omitiu Calendar WIP e imprimiu seis colunas fechadas de métricas. Não leu variáveis de ambiente, segredos ou strings de conexão.

Permanecem externos: aplicação manual das novas migrations na ordem revisada, verificações com dois usuários/sessões reais, RLS/grants na instância hospedada, corrida entre revogação e comando em transações simultâneas, upload e limpeza com Storage real, medição hospedada da Busca, recarregamento e jornadas de navegador conectado. As validações locais serializadas e os doubles de Auth/Storage não encerram esses critérios. Esta revisão não iniciou build/servidor, abriu navegador, alterou Git, leu `.env` ou executou SQL remoto.
