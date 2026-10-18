# Auth 801b: diagnóstico estático e próxima contraprova pública

Análise de fonte em 17/10/2026 UTC, sem Node, navegador, novo workflow, captura ou leitura de raw/report privado. Os fatos abaixo foram comunicados por Root depois das duas capturas únicas encerradas do SHA `801b6a84d536574dd3c8d0cebb9b77e645806d45`; não foram reabertos nem reconferidos a partir dos arquivos privados por este revisor.

## O que já foi observado

| Item | Admin | Recovery |
| --- | --- | --- |
| Manifest declarado conferido por Root | 353 Git + 60 dependências | 197 Git + 60 dependências |
| Progresso funcional comunicado | Oito stages aprovados | Sete stages, incluindo credenciais alteradas |
| Primeira pendência | `QUIESCENCE_HTTP_AUTH_NO_RESPONSE_PENDING`, após blank | `ASSET_NO_RESPONSE`, quatro requests |
| Apresentação | login / fetch / frame principal; introduzido em fixtures | origem mixed / script |
| Continuação e terminais | continue-ack; Fetch continue resolvido; nenhum terminal original | continue-ack; mesmo quadro de ausência de terminais |
| Identidade observada | Request original exato, mesma entrada do manager e sessão registrada | Mesmo tipo de identidade/registro original |
| Relay worker | INELIGIBLE / STATIC_AUTHORITY_MISSING | EMITTED / NONE |
| Parent | requested=false | requested/settled/resolvedTrue=true, após settlement |
| Limpeza/aceite | Não comprovados | Não comprovados |

O relatório não contém o método HTTP como campo de diagnóstico. `pathClass=login` não demonstra POST. Na fonte Admin 801b, `observeRead` só preenche essa apresentação depois de `allowed && method === "GET"`; classificar o caso como leitura é uma inferência vinculada a essa fonte qualificada, não um novo fato observado de método no JSON. Não acrescentar um POST pendente por associação ao nome da rota.

O diagnóstico do parent tem fase literal `after-worker-run-settlement-before-finally`. Ele não prova que o servidor/grupo já estava fechado antes de o worker selar a primeira falha. Recovery EMITTED e parent posteriormente resolvido não são prova de ordem ou de limpeza no instante da pendência.

## Por que o fence retido não resolve sozinho

Nos dois specs, antes do estacionamento, o handler chama `route.continue()` com a autoridade original. O modo `parkingPages` e o fence só são armados depois da barreira que exige operações UI/SDK/SQL conhecidas, nenhuma request não cancelável pendente e nenhum resultado de escrita desconhecido.

Depois da barreira, **novos callbacks de route** passam pelo fence e só podem abortar as leituras já autorizadas. Esse ramo não redespacha Requests que já foram continuados em fixtures. Não existe nesse código uma operação legítima que reapresente a rota anterior, transforme seu continue em abort ou remova a request do ledger. Portanto a permanência de requests antigas sem terminal é compatível com a presença do fence retido. A correção do fence reduz novos envios; não promete concluir os anteriores.

`route.continue`, o ACK original `Fetch.continueRequest`, `Page.stopLoading`, a navegação para blank e o encerramento de contexto são fatos distintos. Os specs removem entradas somente em `requestfinished`/`requestfailed`. O coletor CDP também conserva a diferença entre comando e `Network.loadingFinished/loadingFailed`. Essa exigência precisa continuar intacta. [Eventos Request](https://playwright.dev/docs/api/class-request), [routing de contexto](https://playwright.dev/docs/api/class-browsercontext#browser-context-route).

No código público fixado de Playwright 1.63, `_onLoadingFinished` e `_onLoadingFailed` removem a entrada do manager e publicam os respectivos eventos. `_handleRequestRedirect` encerra o Request anterior e liga o seguinte; `_onRequest` pode continuar o hop redirecionado sem entregar um novo route ao usuário. Manter um handler instalado não significa que ele vá abortar um hop futuro que já pertence a uma continuação/redirecionamento em andamento. Isso é uma possibilidade estrutural, **não** prova de que houve redirect no caso privado 801b. [CRNetworkManager 1.63](https://github.com/microsoft/playwright/blob/v1.63.0/packages/playwright-core/src/server/chromium/crNetworkManager.ts).

O observador atual usa uma trace por chave de request CDP e recusa duplicatas/ambiguidades. Não se deve reutilizá-lo inadvertidamente para certificar uma cadeia com múltiplos hops e IDs reutilizados: uma nova fixture de redirect precisa registrar a linhagem por Requests originais e reconhecer a ambiguidade. Um `unavailable` nesse controle continua inconclusivo; não autoriza relaxar o observador dos specs Auth.

## O que não está demonstrado

Não há contagem comunicada de recebimento/conclusão do servidor por request Auth; continue resolvido não substitui essa contagem. Assim, os fatos não distinguem ainda entre uma leitura que o runtime servidor continua mantendo, um ciclo de redirect/interceptação ou comportamento de cancelamento do Chromium. Também não há prova de que o endpoint funcional tenha falhado: os stages aprovados e a ausência posterior de terminais de outras leituras são questões separadas.

O bundle de `AuthForm` usa Server Actions e `next/link`, mas isso não identifica a origem da request antiga nem demonstra que prefetch seja sua causa. Não remover navegação, prefetch, proteção de sessão ou ações do produto com base somente no nome login/fetch. Nada nesta análise justifica aumentar os 15 segundos ou presumir que mais espera produziria um terminal.

O veto Admin ao stop é esperado: a autoridade do relay é somente GET canônico em `/_next/static/`. `/entrar` não se torna estático por ser uma leitura. Aumentar essa autoridade para incluir Auth, callback ou logout não é uma correção permitida pela evidência.

## Próximo experimento público mínimo proposto

Preparar um produtor novo, separado dos executores Auth e dos protocolos já encerrados. Nenhuma captura antiga deve ser repetida. Usar Node 24/Playwright/Chromium exatos, servidor HTTP próprio em loopback, contexto novo, SW bloqueado, sem aplicação, Supabase, cookies, e-mail, credenciais, SQL ou endpoints reais do projeto.

O contraste inicial mais estreito é **GET fetch direto versus um único redirect 303 inteiramente público**. Ambos terminam no mesmo endpoint artificial que reconhece o recebimento e segura headers/body. O browser deve iniciar os reads antes de armar o fence, consumir `response.arrayBuffer()` quando houver resposta e não aguardar o fetch para acionar o estacionamento. Cada caso tem seu próprio servidor/contexto e um único orçamento absoluto de 15 segundos, incluindo startup e estacionamento. O cleanup próprio tem seu limite separado e não prolonga nem altera a decisão. Um controle de resposta finita precisa passar antes dos casos retidos.

Manter em ambos: online, route original retido, barreira sem escritas, `Page.stopLoading` e blank. Na fonte pública, observar e fechar explicitamente a conexão/listener antes do drain, conservando a prova de fechamento separada de ACKs do browser. A fonte fechada torna verificável uma informação que falta no relatório Auth: se os bytes/conexões originais já terminaram quando o browser ainda retém a request.

Registrar somente contadores e enums: método observado GET, recurso, número de hops, `redirectedFrom` presente/ausente com vínculo dos objetos originais, callbacks de route por hop, recebimentos de cada endpoint público, headers enviados, respostas concluídas, sockets abertos/fechados, ACKs, terminais públicos/CDP e registro do manager/sessão. Não expor URL dinâmica, IDs CDP ou conteúdo. A identificação do redirect deve usar `Request.redirectedFrom()/redirectedTo()` e eventos originais; não casar por URL ou tempo. [Linhagem de Requests](https://playwright.dev/docs/api/class-request#request-redirected-from).

Esse par pode revelar se a rota do hop seguinte foi entregue ao handler e se o estacionamento difere quando a cadeia já foi continuada. Mesmo se reproduzir, isso só demonstra o mecanismo da fixture. Se não reproduzir, não repetir variantes de forma aberta: o próximo recorte seria o runtime Next em uma aplicação pública mínima, com a mesma instrumentação de servidor. A variante script/quatro assets só deve ser acrescentada se o primeiro par responder uma pergunta útil e houver motivo para aproximar a contagem Recovery.

Critérios obrigatórios: source/versões fixados, testes RAM dos contadores/linhagem/janela, peer antes de dispatch, um run público novo, binding e captura originais novos por Root. Um terminal que aparecer apenas no cleanup não muda a decisão anterior. Ausência de terminal é resultado válido do experimento, jamais aceite de Auth ou autorização de limpeza.

## Alternativa se Root priorizar mais precisão sem nova fixture

Uma alteração apenas de observação poderia acrescentar campos fechados de método categorizado, navegação e existência de `redirectedFrom` no instante original do request, além de timing monotônico da emissão do relay e do recebimento/fechamento real no parent. Não ler headers, bodies, cookies ou query values. Isso exigiria novo schema/source freeze, QA e nova execução Auth; não se encaixa retroativamente nos relatórios 801b. Não propor esse custo antes de verificar se o contraste público mais barato já responde a dúvida.

Nenhuma correção de produto ou afrouxamento de gate foi implementado por esta análise. Root pode trabalhar em paralelo no alvo de restore sem depender desse experimento; o aceite de autenticação/limpeza permanece aberto.
