# T-016 — eventos de todos os comandos de Capturas/Tarefas

Entrega revisada do SHA `39c38802d1c322065ef3fa1d9f20c75578442b47`. A [Foundation própria 38064949967](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/38064949967) passou **1.560 testes em cada fuso, 350 scripts e dois controles separados de scanner, 188 E2E/zero flaky, 17 migrations/35 arquivos de asserções e catálogo 1.243**. Os E2E continuam sendo 187 demo mais um de composição com HTTP sintético. O [Auth próprio 38064949955](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/38064949955) aprovou seus três casos, o agregado schema4 e as limpezas. A [evidência fechada](evidence/all-capture-task-writes-ci-passed-20261010.json) vincula as duas fontes próprias; não herda o PASS de `854d905`.

## Critério da issue #23

O [teste de orquestrador](../../tests/adapters/capture-task-orchestrator-events.test.ts) executa os decoders, comandos Core, gateways e stores reais, com as 17 migrations canônicas em PGlite descartável. O [loader comum](../../tests/helpers/local-canonical-sql.ts) extrai o bootstrap literal do runner SQL existente, sem avaliar JavaScript nem duplicar o schema. O catálogo Auth é fixture local e o transporte RPC HTTP é injetado; cada chamada executa a função SQL real com dono, sessão e operação vinculados.

A matriz exige igualdade com o catálogo dos **13 nomes de comando**: criar, organizar, editar, arquivar, desarquivar, excluir, restaurar e converter Captura; criar, editar, mudar status, excluir e restaurar Tarefa. Cada ação compara snapshots SQL independentes antes/depois, exige a correspondência entre entidades alteradas e eventos, confere `user_id`, tipo/ID, ação, canal `web`, instante e payloads `before`/`after`. Eventos anteriores permanecem literalmente intactos. A conversão altera Captura e cria Tarefa com origens recíprocas; a matriz produz **14 eventos**.

A promoção para Conhecimento usa também Core/gateway/store/SQL reais e conserva o conteúdo da Captura arquivada e a origem da nova Página; acrescenta dois eventos, totalizando **16** no recorte, sem contar a criação do Caderno usada como preparação. Replay do comando Core, replay explícito do lote RPC original antes da checagem de CAS e restauração no-op não alteram os dados nem acrescentam eventos. Um lote com alteração duplicada recebe `23514`, desfaz tudo e não deixa recibo. Uma transação sem evento obrigatório recebe `EVENT_REQUIRED` antes de qualquer commit. Contexto ou dono injetados no payload são recusados.

Checks próprios antes do push: os dois testes focais de orquestração/Drive passaram; TypeScript global, lint, scanner e diff passaram. A revisão independente conferiu os oráculos persistidos, o catálogo completo e os negativos. Os dois fusos do CI próprio passaram o novo teste; nenhuma migration, dependência ou configuração externa foi alterada.

## Limites e próximos aceites

Esse recorte conclui o critério literal “Toda escrita de Capturar/Tarefas gera evento com canal `web` e diff coerente (teste de orquestrador)” para os nomes de comandos existentes. Não testa todas as variantes de payload, concorrência, factory de runtime, SDK Supabase, PostgREST hospedado, layout Next ou navegador autenticado de produção. A suíte M1 completa contra o adapter real continua separada, assim como Início com banco/fuso e paginação de Atividade na interface conectada.

O [recorte nativo de Auth/persistência](t015-capture-task-persistence-local-ci.md) e a [composição de preferências/Drive/client_id](t016-t022-contract-composition-20261010.md) conservam suas fontes e limites. A aplicação/conferência manual da 017 e o export oficial pós-017 continuam no [guia de pendências](pendencias-atuais-20261010.md). Nada foi executado no banco pessoal por este teste.
