# T028 — allowlist de eventos e transações — 10/10/2026

O critério original da [issue #35](https://github.com/kauanbarateli/Segundo-Cerebro/issues/35), preservado no [doc 13 — T-028](../planejamento/13-tickets.md#t-028--hardening-de-release-1--m4), é: “Teste de vazamento cobre eventos E transações; nenhum campo fora da allowlist sai”. **Esse critério de teste está comprovado**, sem depender de DSN ativa. O relatório não encerra a issue nem os outros critérios de release.

Os seis controles de [security-monitoring.test.ts](../../tests/security-monitoring.test.ts) plantam um canário em conteúdo, identificadores, request, headers, nomes, valores financeiros e estruturas privadas. O [Núcleo](../../src/core/observabilidade/index.ts) reconstrói os objetos por allowlist; o [adapter](../../src/adapters/observability/sentry.ts) instala os hooks e filtra novamente o envelope final. `@sentry/node` e `@sentry/core` 11.6.0 são as bibliotecas reais instaladas. O envio é substituído por um spy local: os testes observam o envelope entregue ao transporte, sem abrir conexão com Sentry ou usar credencial pessoal.

| Controle existente | Oráculo observado |
| --- | --- |
| Evento | Chaves finais enumeradas e ausência do canário |
| Transação | Nome fixo, spans vazios, conteúdo/valores privados removidos; trace inválido recusado |
| Envelope final | Anexos, logs, sessões e sampling headers descartados; header fechado e canário ausente |
| SDK real — evento | `NodeClient.captureEvent` passa pelo hook e filtro antes do spy de envio |
| SDK real — transação | Hook de transação estática e filtro final executados; canário ausente no envio |
| Coleta automática | Categorias privadas desativadas e ciclo `static` conferido |

Em 10/10 às **11:16:58 em Fortaleza / 14:16:58 UTC**, a execução focal `node node_modules/vitest/vitest.mjs run tests/security-monitoring.test.ts --reporter verbose` aprovou **seis testes em um arquivo, zero falhas/skips, exit 0**. A primeira tentativa foi recusada por `EPERM` na criação do cache temporário antes de importar a suíte; não executou testes. A repetição executou os controles com acesso ao cache temporário e manteve seu transporte local.

A [Foundation própria 38045796599](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/38045796599), no SHA `20378ef4d8f1eab8a550c2dda3d02f9da8ad17bc`, já havia executado este arquivo: o log confirmou `tests/security-monitoring.test.ts (6 tests)` aprovado em `TZ=UTC` às 10:43:02.6058586 UTC e em `TZ=America/Sao_Paulo` às 10:43:30.1681698 UTC. Cada suíte completa aprovou 1.558 testes. Os três arquivos de teste/Núcleo/adapter conferidos na execução focal não têm diff contra esse SHA. A [evidência pública da Foundation](evidence/foundation-ci-auth-effects-20261010.json) conserva status e contagens próprios; o report padrão do CI identifica arquivo/quantidade, enquanto a execução focal verbose confirmou os seis nomes individuais. Nenhum CI é atribuído à publicação posterior deste documento.

Não foi alterado código, pacote, lockfile, configuração, migration ou estado do GitHub neste recorte. A prova cobre o critério literal de testes no caminho revisado, sem afirmar ausência universal de qualquer vazamento. Se Sentry for ativado, conferir a operação e os payloads no destino é um aceite operacional separado; não é requisito para este teste. Backup agendado/restore com Cofre, catálogo de produção atualizado, jornadas desktop/iPhone e auditoria Impeccable final continuam com suas evidências e pendências próprias. A revisão humana de produção permanece adiada por escolha do mantenedor.
