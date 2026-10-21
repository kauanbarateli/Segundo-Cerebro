# Admin: dreno de APIs entre comandos de fechamento — 21/10/2026

Relacionado à [issue #43](https://github.com/kauanbarateli/Segundo-Cerebro/issues/43#issuecomment-6327490151) e à [PR #95](https://github.com/kauanbarateli/Segundo-Cerebro/pull/95). Estado: correção preparada e revisão estática; execução própria ainda pendente.

## Evidência que motivou o delta

**OBSERVADO:** no HEAD `08803f65f75cbf49162f0c899902347d7917de68`, o [Admin PR39681592528](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39681592528), tentativa1/job119505140913, executou o merge `cb97f84efde1b31dd0ddffe9ed7c8b9cc4a66ad7` em b67. BLOCK passou com limpeza individual. FIRST passou até `actor-intact`, mas falhou `QUIESCENCE_HTTP_API_NO_RESPONSE_PENDING` em `after-blank`: uma API fetch/main, sem resposta nem terminal público/CDP original, e zero inspeções pendentes. O abort teve ACK público e rejeição do comando nativo. FIRST não iniciou limpeza; escrita incerta, `ioQuiet/namespaceRemoved/directoriesRemoved=false`. NextStop recusou `STATIC_AUTHORITY_MISSING`.

**OBSERVADO:** o [Admin push39682955241](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39682955241) passou em checkout exato `19e98489efe383846e79b06aed964301eb7e17ca`, incluindo os dois casos e limpeza. É outra fonte: cadeia de22 migrations e diagnóstico passivo. Esse resultado não é execução desta correção nem prova causal da falha de088.

**OBSERVADO por leitura:** o owner de fechamento de088 drena APIs/handlers uma vez e depois faz awaits de attach, stop e navegação. Não reconfere esse dreno entre os comandos. O spec de19e difere de088 somente pela opção passiva `fetchErrorTypes` nesse arquivo. A base desta implementação continua legal/Cron, com19 migrations; nenhum contrato/contador da cadeia Capture foi importado.

**INFERIDO:** uma API que entra durante esses awaits pode alcançar uma navegação seguinte antes do terminal/settlement. Isso é uma lacuna de ordenação real do código; os relatórios não demonstram em qual intervalo nasceu a API de088 nem qual endpoint era. Não se atribui a ela uma causa definitiva.

## Correção preparada

`closeContexts` reutiliza a projeção original de APIs e `routeOperations` em uma função local. Ela é chamada no ponto inicial existente, após cada attach, após cada `Page.stopLoading` e antes de **cada** navegação `about:blank`. A fase factual usa os valores já aceitos: `before-stop`, `after-stop` ou `after-blank` quando outra página já navegou.

Todas as esperas recebem o deadline absoluto original de15s. O relógio e a barreira de efeitos são reconferidos antes/depois; cada chamada não ganha um novo prazo. Documentos e observadores primários permanecem vivos enquanto o dreno aguarda o terminal original e o handler. O dreno final completo e o settlement de detach/close continuam obrigatórios.

Não há novo comando de navegador, retry, troca de Request, remoção/limpeza de Map, terminal sintético ou autorização para encerrar Next em API. Fence, NextStop estático, primeira falha, incerteza e veto de cleanup permanecem. Se a leitura não termina, a recusa apenas ocorre antes do próximo comando destrutivo; isso não autoriza excluir fixtures.

## Testes preparados e plano remoto

Os novos controles executam as closures originais de `makeContext` e `closeContexts`, com os listeners e fence originais. Eventos/contextos/relógio são portas de RAM; não há servidor ou navegador nesses testes. Uma API nova entra durante attach, stop ou entre duas navegações, conservando a própria identidade no Map original.

Cobertura preparada:

- Terminais originais `requestfinished` e `requestfailed` precisam anteceder o próximo comando.
- Um terminal não resolve a promessa original do handler; ela também precisa terminar.
- ACK ou resposta sem terminal, handler sem settlement e abort rejeitado mantêm o veto.
- POST novo, origem estrangeira, resultado desconhecido e primeira falha persistem.
- O mesmo deadline é observado em todas as esperas; terminal exatamente no limite e relógio regressivo são recusados.
- Um terminal posterior ao timeout não converte a falha em sucesso ou libera cleanup.
- Os negativos anteriores de Auth/estáticos/HMR, deadline, NextStop e privacidade permanecem.

Somente no runner Node24: executar `node --test tests/scripts/admin-browser-local-ci.test.mjs`, lint/typecheck e os demais portões originais aplicáveis ao novo SHA. O diagnóstico passivo de995 permanece separado e só será portado se necessário, com revisão própria de contratos/pins; não é pré-requisito deste dreno. A Root deve registrar os originais de push/PR e exigir BLOCK/FIRST completos, zero pendências/incerteza e exclusão/ausência individual das fixtures. Um PASS puro ou de outra branch não substitui esse aceite.

Se houver nova falha, conservar o primeiro relatório factual e a fase original. `after-stop` permite distinguir uma recusa antes da navegação; não se abrirá uma sequência de capturas genéricas ou qualquer captura CLOSED para aparentar conclusão. Nenhuma execução local Node/npm/PostgreSQL/browser, mudança de segredo, SQL remoto, sincronização, merge ou deploy foi realizada nesta preparação.

Fonte primária consultada: no [Playwright1.63](https://github.com/microsoft/playwright/blob/v1.63.0/packages/playwright-core/src/server/chromium/crNetworkManager.ts#L654), o adapter pode tolerar rejeições do comando de abort; o terminal de rede possui caminho próprio. Isso explica por que um ACK não é prova de terminal, sem identificar a causa particular de088.

## Nova observação de bef e diagnóstico passivo separado

**OBSERVADO:** o [Admin push39689062936](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39689062936), job119530404348, produziu relatório fechado com `sourceSha=bef3e71bee801c699ff207f99d0457b1de2c222e`. BLOCK chegou a `actor-intact` e recusou `QUIESCENCE_HTTP_API_NO_RESPONSE_PENDING`, fase `after-blank`: uma API `other-authorized/fetch/main`, introduzida em `actor-intact`, sem resposta ou terminal público/CDP observado. O relato conservou `abort-ack`, `fetchCommand=abort`, `fetchOutcome=rejected`, `managerEntry=same-request` e `sessionRegistered=registered`; `stopAck` permaneceu `unobserved`. Havia uma requisição e zero inspeções pendentes, escrita incerta e zero cleanup/exclusões/leituras de ausência. FIRST não executou. O relatório aplicou19 migrations e observou catálogo1269; não certificou limpeza. A Root informou o conjunto dessa rodada terminal e o Admin da PR39689068816 bem-sucedido; resultados de origens distintas não são combinados como uma única execução.

Essa falha ocorreu depois da correção de ordenação. Portanto, o dreno adicional não bastou para fechar o aceite real; o novo resultado não prova que a ordenação foi a causa de088 nem que deixou de ser uma lacuna válida. A próxima execução precisa distinguir a rejeição original, conservando a própria recusa quando faltar terminal.

**IMPLEMENTADO, ainda sem execução deste delta:** porte finito do diagnóstico passivo de `995368e772371d2c73c596bc84d660a15a910971`, habilitado somente no spec Admin por `fetchErrorTypes:true` junto a `fetchCommands:true`. Recovery e os probes não recebem esse opt-in: mantêm suas formas anteriores de oito ou seis campos. O validador compartilhado continua aceitando exatamente quatro, seis e oito campos e admite a forma de nove apenas com `fetchErrorType` e combinações coerentes com `fetchOutcome`. Os pins dos três probes são recalculados sobre as fontes desta branch, sem importar contagens ou pins da cadeia Capture. Permanecem379 fontes Admin,19 migrations e catálogo1269 como contratos existentes, a confirmar pelos originais do próximo SHA.

O observador lê somente os descritores próprios de dados `type` e `method` da rejeição original do comando e exige o mesmo método enviado. Recusa Proxy, accessor, propriedade herdada ou método divergente, sem executar getters. Publica somente `not-rejected`, `error`, `closed`, `crashed`, `other`, `unavailable` ou `mixed`; não lê mensagem, stack, causa, logs, código, URL ou identificadores. O `send` original continua chamado uma única vez, com o mesmo `this`, argumentos, Promise e rejeição. A observação não cria terminal, settlement, prazo, exceção de cleanup ou autoridade NextStop.

**OBSERVADO por fonte primária:** no [CRSession do Playwright1.63](https://github.com/microsoft/playwright/blob/v1.63.0/packages/playwright-core/src/server/chromium/crConnection.ts#L124), uma resposta de erro pode rejeitar o callback com tipo `error`; o fechamento/crash pode alterar o tipo de callbacks em voo para `closed`/`crashed`. Uma recusa anterior ao envio pode não carregar `method` e, por isso, será `unavailable` neste contrato estrito. O [adapter de abort](https://github.com/microsoft/playwright/blob/v1.63.0/packages/playwright-core/src/server/chromium/crNetworkManager.ts#L654) tolera classes de rejeição, enquanto [os terminais de rede](https://github.com/microsoft/playwright/blob/v1.63.0/packages/playwright-core/src/server/chromium/crNetworkManager.ts#L435) seguem caminhos próprios. Isso sustenta hipóteses distintas para o ACK sem terminal; os oito campos observados em bef não escolhem entre elas. Não se exportará texto de erro para tentar inferir uma mensagem específica.

**PENDENTE:** revisão independente dos dez paths/pins e desta seção; QA puro, tipos, lint e scanner nos portões originais do GitHub, depois Admin push/PR do SHA publicado. Os controles portados exercitam enum/shape, Proxy/accessors/canários, identidade de Promise/rejeição, ACK do `RouteImpl` instalado para as três classes sem autoridade terminal, restauração do descritor e primeira falha imutável. Nenhum PASS local ou de outra fonte é atribuído a este porte. Esta preparação não executou Node/npm/browser/PostgreSQL local, operação remota, captura nova ou reabertura de captura CLOSED.
