# Controle público da barreira de quiescência online

Estado: implementação separada para revisão de Root. Nenhuma execução Chromium, HTTP ou conectada foi realizada pelo agente que preparou estes arquivos. A execução e a evidência hospedada precisam de SHA e run próprios. `applicationAccepted` permanece `false`, inclusive se todos os casos terminarem.

## Pergunta e escopo

O experimento anterior observou diferença entre o cancelamento de um fetch já recebido pelo servidor com o contexto offline e o mesmo cenário online. Isso é evidência de uma fixture isolada; não determina a causa dos fluxos Admin ou Recovery.

Este controle verifica outra hipótese: uma barreira armada no handler de rota já existente pode impedir novas leituras autorizadas e permitir a observação dos terminais originais enquanto o contexto permanece online? A matriz também separa o efeito de remover esse handler e o de encerrar o servidor HTTP de origem.

O produtor tem contrato próprio. Ele não altera `browser-transport-probe.mjs`, seu validator ou seus resultados. O contrato antigo que exige fonte fechada não serve para qualificar os casos novos com fonte aberta.

Os três arquivos da entrega são:

- `scripts/verification/browser-quiescence-fence-probe.mjs`: controlador puro, ledger de eventos originais, orquestrador e adaptador nativo isolado.
- `tests/scripts/browser-quiescence-fence-probe.test.mjs`: testes em RAM, sem servidor, browser, Next ou Supabase.
- Este documento.

Não há mudanças em workflow, specs Auth, relay, STOP_NEXT, Drive, schema ou configuração de produção.

## Sequência experimental

Cada caso possui servidor novo em porta efêmera de `127.0.0.1`, navegador novo e contexto novo. Todos permanecem online, com `fetchCommands=true`. Não se reutilizam abas, cookies, usuários, perfis ou dados da aplicação.

| Ordem | Caso | Handler no instante da decisão | Fonte no instante da decisão | Resposta do fetch |
| --- | --- | --- | --- | --- |
| 1 | `control` | Retido e barreira armada | Listener vivo | Liberada; corpo consumido |
| 2 | `retained-open` | Retido e barreira armada | Listener vivo | Headers e corpo retidos |
| 3 | `retained-closed` | Retido e barreira armada | Fechamento observado | Headers e corpo retidos |
| 4 | `removed-open` | Remoção aguardada após armar a barreira | Listener vivo | Headers e corpo retidos |
| 5 | `removed-closed` | Remoção aguardada após armar a barreira | Fechamento observado | Headers e corpo retidos |

A navegação inicial serve somente uma página HTML pública e fixa. Ela inicia exatamente um `fetch("/held-fetch")`. O callback consome o corpo com `arrayBuffer()` quando houver uma resposta; os casos retidos não aguardam headers no cliente antes de começar o fechamento.

Antes de armar a barreira, o produtor exige simultaneamente:

1. Uma requisição original observada, continuada pelo handler e recebida pelo servidor.
2. Nenhuma resposta finalizada, nenhum terminal público ou CDP e uma requisição pendente.
3. Associação exata com a requisição no manager do Playwright e sessão do observador ainda registrada.
4. Nenhum handler de rota pendente ou tráfego desconhecido.

Só então a barreira é armada no mesmo handler instalado antes da navegação. O controle libera a resposta e exige o término original de seu download. Nos outros quatro casos, a sequência é `Page.stopLoading`, navegação para `about:blank`, remoção opcional das rotas com `behavior: "wait"` e fechamento opcional da fonte. O handler retido continua instalado até a decisão e só é removido pelo fechamento posterior do contexto.

Não há `setOffline(true)`. `setOffline(false)` é aguardado durante a criação do contexto e não é usado como prova de término de requisição. O experimento também não trata `about:blank`, `unrouteAll`, `route.abort`, detach, fechamento de socket, contexto ou browser como evento terminal do fetch.

## Autoridade da barreira e handlers

`createQuiescenceFence` recebe duas decisões fornecidas pelo chamador: a autorização já existente e a classificação existente de leitura cancelável. O helper não cria autorização. Antes da barreira, somente a autorização existente permite `continue`. Depois dela:

- Um GET já autorizado e já classificado como leitura cancelável recebe `abort`.
- POST, GET não cancelável, callback, verificação de Auth, logout e pedido desconhecido são classificados como desconhecidos e recusam o caso, mesmo que o aborto depois receba ACK.
- `/auth/callback`, `/auth/v1/verify` e `/sair` ficam excluídos explicitamente da classificação cancelável.

Na fixture nativa, a autorização permite somente GET no origin efêmero e nos três paths fixos `/fence.html`, `/favicon.ico` e `/held-fetch`, sem credenciais na URL, query ou fragmento. A classificação cancelável usa essa mesma autorização reduzida. Não há leitura de corpo, cookie, header de autorização ou mensagem de fornecedor.

Cada invocação do handler entra em um `Set` antes de chamar as operações assíncronas de rota. Ela só sai quando sua própria promise termina. `handlersStarted = handlersSettled + handlersPending` é uma invariante do relatório; zero requisições HTTP não compensa um handler pendente. O limite é de 16 handlers por caso.

O ledger mantém a identidade do fetch original. Somente os listeners originais de `requestfinished` e `requestfailed` podem removê-lo do conjunto pendente. O ACK de `continue` apenas conta que o handler devolveu o comando; o ACK de `abort` apenas conta o término dessa operação de rota. O observador CDP original fornece separadamente seu terminal, a entrada do manager e o estado da sessão. Um terminal público não é projetado como terminal CDP.

Os testes em RAM exercitam o helper e o ledger reais usados pelo adaptador, incluindo GET autorizado tardio, POST/callback desconhecido, handler esperando ACK, ACK sem evento original e terminais duplicados. Esses testes não simulam uma aprovação dos fluxos Auth.

## Prazo e decisão

O prazo de cada caso é absoluto: **15.000 ms**, armado antes de criar/iniciar a lease. Startup, requisição inicial, barreira, comandos de estacionamento, fechamento opcional e drain compartilham o mesmo prazo. Não existe renovação de 15 segundos por etapa.

No instante da decisão, os contadores e fatos de fonte são copiados antes de cancelar ou limpar recursos. Um terminal que só aparece no cleanup não pode mudar `PENDING` para `DRAINED`. O fechamento da fonte durante cleanup não pode transformar um caso aberto em caso fechado na evidência da decisão.

O veto também é reconferido depois do drain final e depois da cópia dos fatos/tempo, com checkpoints de microtask antes de selar a decisão. Uma recusa enfileirada pelo snapshot não é anulada por contadores que pareçam concluídos. Depois desses checkpoints há uma última cópia de contadores e fatos da fonte; o veto, prazo, fatores da matriz e predicado original são reconferidos e a decisão é selada no mesmo trecho síncrono, sem novo `await`. Um handler iniciado durante os checkpoints, mesmo autorizado e sem recusa, impede sucesso se seu ACK continuar pendente. Perder o listener também impede qualificar fonte aberta. O timer original continua armado até esse limite; nenhuma etapa ganha um prazo novo. Depois de começar o cleanup, a decisão fica irreversível.

Para fonte aberta, o produtor exige positivamente o evento de `listening`, `server.listening === true`, ausência do evento de fechamento e `sourceListenerAlive === true`. Também exige `sourceClosedBeforeDecision === false` e `sourceClosedMs === null`. A ausência de um ACK de fechamento, isoladamente, não satisfaz esse requisito.

Para fonte fechada, exige evento de fechamento próprio, listener inativo, instante observado anterior ao prazo e zero sockets vivos. São fatos de transporte; não são terminais HTTP.

O cleanup tem orçamento independente de **5.000 ms** por caso. Ele encerra apenas recursos próprios, mantém a ordem detach da sessão → contexto → browser e encerra separadamente servidor e sockets próprios. Fatos de cleanup não confirmados bloqueiam os casos seguintes. Nem kill, timeout externo ou ACK de fechamento substituem EOF ou o evento terminal original.

## Contrato de saída

A raiz contém somente `schemaVersion`, `scenario`, `mode`, `sourceSha`, `diagnosticOnly`, `applicationAccepted`, `controlQualified` e cinco `cases`. O scenario é `browser-quiescence-fence-probe`. Portas sintéticas jamais ganham modo nativo por fornecerem um SHA: o branding é interno por `WeakSet`.

Cada caso registra o fator planejado, o estado observado da barreira e da fonte, contadores limitados, tempos relativos e fatos de cleanup. Não registra porta, URL acessada, headers, request IDs, conteúdo de resposta ou erros arbitrários. O tamanho máximo serializado é 16 KiB.

| Resultado | Requisito |
| --- | --- |
| `CONTROL_PASSED` | Um download original concluído nos canais público e CDP; manager sem a requisição; sessão registrada; listener vivo; barreira retida; prazo respeitado. |
| `DRAINED` | Um terminal original em cada canal, manager sem a requisição, nenhum handler pendente e fatores de fonte/rota comprovados antes do prazo. |
| `PENDING` | Aos 15.000 ms, fetch original ainda pendente, sem terminais nos dois canais, com manager e sessão originais presentes; fatores da matriz comprovados e nenhum handler pendente. |
| `INCONCLUSIVE` | O prazo expirou sem satisfazer um contrato fechado de conclusão ou pendência; por exemplo, terminal público sem terminal CDP. |
| `REFUSED` | Fonte, autoridade, clock, limites ou protocolo recusados. Só sai um código enumerado, nunca mensagem/stack do fornecedor. |
| `NOT_RUN` | Controle não qualificado ou cleanup anterior não confirmado. |

O código de processo zero indica apenas que o experimento produziu uma matriz qualificada e limpa, podendo conter `PENDING`. Não significa aceite da aplicação. Um eventual leitor/CI desta fixture deve conservar essa distinção e validar o novo contrato integralmente; não deve adaptar um PASS antigo.

## Gates nativos e execução futura

Importar o módulo ou passar somente `--help` não lê arquivos nem ambiente e não cria serviço/processo. A execução nativa só é acessível por `--execute` e exige:

- Linux x64, Node `v24.19.0`, Playwright `1.63.0` e Chromium `153.0.8010.12`/revision `1243`.
- `CI=true`, `GITHUB_ACTIONS=true`, `SC_BROWSER_QUIESCENCE_FENCE_PROBE_RUN=1` e `GITHUB_SHA` exato de 40 caracteres hexadecimais minúsculos.
- Ambiente reduzido a esses quatro nomes e `PATH`, `HOME`, `TMPDIR`, `LANG`, `LC_ALL`, `TZ`. Nomes extras, inclusive a opt-in antiga, recusam a execução. O browser recebe somente os nomes operacionais selecionados, com `TZ=UTC`.
- Nenhum `.env` real no root do checkout. A listagem de nomes não lê o conteúdo desses arquivos; `.env.example` não é aberto.
- Bytes e SHA-256 dos quatro arquivos públicos em `FENCE_PUBLIC_PINS`: package, catálogo de browsers, coreBundle e observador original. Arquivo não regular, symlink, path real diferente ou pin divergente recusa antes do import de Playwright/observador.

Não há workflow novo nesta entrega. Root deve revisar, fixar o SHA e definir uma execução pública isolada própria antes de qualquer captura. O agente implementador não está autorizado a iniciar Chromium, servidor ou controle real. Não copiar `.env`, secrets do GitHub, perfis, cookies ou dados de produção para satisfazer os gates.

Validação local autorizável em separado, uma execução Node por vez:

```text
node --test --test-concurrency=1 tests/scripts/browser-quiescence-fence-probe.test.mjs
eslint --max-warnings=0 scripts/verification/browser-quiescence-fence-probe.mjs tests/scripts/browser-quiescence-fence-probe.test.mjs
```

Validação do agente preparador em 16/10/2026: a primeira rodada teve **22/22 testes RAM** e lint sem avisos, mas a revisão encontrou uma janela de veto tardio. As duas regressões novas falharam contra essa versão, reproduzindo `CONTROL_PASSED`/`DRAINED` após uma recusa em microtask com contadores inalterados. A correção seguinte teve **25/25 testes RAM** e lint limpo; nova revisão identificou que fatos copiados antes dos checkpoints podiam omitir um handler iniciado sem veto. Na versão com recaptura final síncrona passaram **27/27 testes RAM** em Node `v24.19.0`, com `--test-concurrency=1`, e lint dos dois `.mjs` com zero avisos. As novas regressões usam o controlador de barreira real para iniciar GET autorizado, manter seu aborto pendente até cleanup e verificar a decisão anterior; cobrem também perda do listener sem veto, no controle e na matriz. Nenhuma rodada iniciou Chromium/HTTP, captura ou aceite hospedado. Root deve revisar e validar os novos pins/SHA; resultados anteriores não qualificam esta versão.

## Limites de interpretação e próximo passo

Este experimento cobre um fetch HTTP público já recebido pelo servidor e os handlers envolvidos no seu estacionamento. Não modela escritas de Admin/Recovery, callbacks OAuth, cookies PKCE, relay, HMR/WebSocket ou gravação em Supabase. Rotas HTTP também não constituem uma barreira geral para WebSocket.

Mesmo um `DRAINED` em todos os casos apenas qualifica a hipótese para uma proposta posterior. Para mudar os specs Auth, Root ainda precisa revisar o menor delta: barreira no handler existente, contexto online durante o drain, contagem dos handlers, rotas retidas até a decisão e a mesma autoridade existente para cancelar GET. Reexecutar os aceites Auth com metadados próprios continuará necessário. O prazo de 15 segundos, os mapas originais, a autoridade do relay e STOP_NEXT permanecem preservados.

Referências primárias versionadas:

- [Playwright 1.63 — Chromium network manager](https://github.com/microsoft/playwright/blob/v1.63.0/packages/playwright-core/src/server/chromium/crNetworkManager.ts): emulação de rede e interceptação são comandos diferentes dos eventos originais de conclusão/falha.
- [Playwright 1.63 — BrowserContext cliente](https://github.com/microsoft/playwright/blob/v1.63.0/packages/playwright-core/src/client/browserContext.ts) e [Network cliente](https://github.com/microsoft/playwright/blob/v1.63.0/packages/playwright-core/src/client/network.ts): remover rotas pode aguardar handlers sem provar o término do download original.
- [Chromium 153.0.8010.12 — Page protocol](https://chromium.googlesource.com/chromium/src/+/refs/tags/153.0.8010.12/third_party/blink/public/devtools_protocol/domains/Page.pdl) e [Network protocol](https://chromium.googlesource.com/chromium/src/+/refs/tags/153.0.8010.12/third_party/blink/public/devtools_protocol/domains/Network.pdl): comandos de estacionamento e eventos de transporte são observações distintas.
