# Proposta de encerramento ativo de leituras Auth

## Decisão proposta

A menor candidata é mover o fechamento dos contextos próprios para uma **fase ativa do drain**, depois dos gates de efeitos e do estacionamento, antes de gastar o prazo inteiro aguardando zero. O fechamento só qualifica o drain se os **mesmos Requests originais** emitirem seus terminais reais e o contexto próprio encerrar, tudo dentro dos 15.000 ms originais. `context.close()` sozinho não prova zero, e o novo nome da fase não autoriza remoção de entradas.

Recomendo primeiro um contraste público pequeno desse fator, com runtime idêntico, sem Auth/Next/Supabase. A fonte Playwright não garante que todo request pendente receba terminal durante `close`. Portanto esta é uma proposta condicional de correção, ainda sem aceite nativo, alteração de spec ou autorização de cleanup. Nenhum arquivo além deste documento foi alterado neste recorte; nenhum Node, navegador, conexão ou captura foi executado.

## Evidência permitida

Root forneceu o resumo fechado da captura pública única do run `38988053599`, fonte `a159db9e858563896e45e540b60a5718fe6d881e`. Nenhum raw, report ou output da captura foi reaberto.

| Caso | Observação original comunicada por Root | Limite da conclusão |
| --- | --- | --- |
| Controle finito | PASS e terminal `finished` original | O canal finito funcionou nessa execução. |
| GET direto | `PENDING` aos 15.000 ms; identidade exata, nenhum terminal público/CDP, `Fetch.continueRequest` resolvido, mesma entrada do manager; fonte fechada aos 162 ms; 1 socket criado/fechado, 2/2 handlers concluídos, 1 request pendente | O padrão de ausência de terminal também ocorre sem redirect, mesmo após fechamento da fonte própria. Não prova causa específica em Auth. |
| GET com 303 | `INCONCLUSIVE/PROTOCOL_UNAVAILABLE` aos 14.999 ms; 2 Requests, 1 vínculo original; root callback/ACK 1/1, target 0/0; fonte fechada aos 151 ms, socket fechado, 1 pendente | Reutilização/ambiguidade do protocolo permanece inconclusiva. O timer antecipado não vira `PENDING`. |

Todos os cleanups públicos foram comunicados como confirmados. Eles ocorreram depois da decisão e não alteram os resultados acima. O caso direto reduz a hipótese de que redirect seja condição necessária; não identifica se a ausência de terminal está no Chromium, na ponte Playwright ou no ciclo de navegação. Também não permite inferir método POST a partir de uma classificação `login` dos relatórios Auth 801b.

## Dependência circular nos specs atuais

Em `tests/e2e-auth-local/admin-browser-local.spec.ts`, `closeContexts` arma o fence após `actor-intact`, cria um deadline único, faz stop/blank e chama `waitForAdminBrowserIoQuiet` antes de fechar página/contexto. A primeira falha fica registrada antes do `finally`. O fechamento só ocorre depois, e `contextsClosed` exige `quietBeforeClose=true`.

Em `tests/e2e-auth-local/auth-recovery-local.spec.ts`, `close` repete a sequência depois de `credentials-changed`. Também espera zero até o deadline antes de fechar, mantém a falha anterior e exige `quietBeforeClose` para liberar `harness.cleanup()`.

Assim, se uma leitura só pudesse terminar durante o fechamento, a implementação atual nunca poderia qualificá-la: o deadline e o primeiro erro já teriam sido consumidos. Reclassificar o resultado no `finally` seria incorreto. A alteração candidata deve ocorrer antes dessa decisão irreversível, dentro do fluxo ativo; falhas anteriores continuam falhas.

Os handlers atuais de `requestfinished`/`requestfailed` já são os únicos responsáveis por retirar Requests dos mapas. `createBrowserProtocolObserver` observa os objetos originais e preserva a promessa de comando CDP. `Page.stopLoading`, blank, ACK de route e encerramento da fonte não são seus substitutos.

## Contrato mínimo para a fase ativa

1. **Pré-condições completas.** Exigir o estágio funcional atual aprovado, `state.active()`, nenhum efeito incerto, UI funcional/SDK/SQL em zero, nenhum POST/non-read pendente, nenhum handler de route em andamento. No Recovery, exigir também `recoveryEffectPending=false` e o ledger de alteração de senha já confirmado. Continuam valendo os checkpoints reais de Auth, sessão, ator e efeitos; não basta a URL ou o aspecto da tela.
2. **Autoridade restrita por objeto.** Cada Request remanescente precisa ser o mesmo objeto já observado, de um contexto próprio, permitido pela allowlist existente e por `isAdminBrowserReadCancellationRequest` com método real `GET`. Callback/verificação/logout continuam excluídos. HMR canônico e assets não desaparecem dos mapas. `resourceType`, `pathClass`, ausência de response ou ACK não criam autoridade nova.
3. **Fence e observadores vivos.** Manter contexto online, Service Worker bloqueado, interceptor original instalado e armado. Qualquer POST ou request desconhecido durante a fase continua recusado/abortado pela autoridade atual e marca a falha/resultado incerto conforme os handlers existentes. Não chamar unroute, offline, dispose do observador, limpeza de maps ou remoção da sessão primária antes de decidir.
4. **Um prazo original.** Registrar o deadline antes de stop/blank, como hoje. Não esperar 15 segundos para só então iniciar close. Depois de stop/blank e da reconferência do gate, iniciar o fechamento ativo imediatamente se só restarem leituras autorizadas. O orçamento restante governa close, observação dos terminais e decisão; nenhum timeout novo de 15 segundos. Relógio regressivo/não finito e deadline vencido vetam, inclusive entre callbacks/checkpoints.
5. **Close próprio e uma tentativa.** Registrar o listener original de `context.close` antes da chamada e possuir sua promessa até o settlement. Usar a identidade original do contexto; `isClosed()` isolado não substitui o evento. O promise de `BrowserContext.close()` da versão fixada espera o evento de close, mas a conclusão dele ainda não é um terminal de request. Exigir ambos: promessa resolvida e close observado. Não transformar uma rejeição tardia em sucesso porque o evento chegou.
6. **Não criar um veto sobre o próprio close.** O `remaining()` atual exige mapa zerado quando `routeSealed=true`. Não ativar esse ramo enquanto as leituras originais estão sendo drenadas. Separar a propriedade da operação de close das ações UI funcionais, mantendo ambos os conjuntos no resultado final. Um conjunto próprio `closingContexts` permite esperar a operação sem subtrair ações UI reais ou ignorar suas falhas. O gate de writes continua integral. Se for adotado um cutoff que veta toda request nova, usar flag distinta da selagem final atual e preservar o registro/recusa do novo objeto.
7. **Terminais originais e zero completo.** Após iniciar close, aguardar as promessas próprias e todos os `requestfinished/requestfailed` dos objetos originais, ainda sob o mesmo deadline. Reconferir UI, routes/handlers, SDK, SQL, non-read, efeito incerto e todos os Requests, sem projeções pre-park. Não basta `close`, manager ausente, sessão removida, Promise.allSettled, timer ou request não aparecer em `pages()`.
8. **Selar a verdade final.** Só depois de zero observado, close próprio e checkpoints sem veto, marcar a condição equivalente a `contextsClosed`. Substituir a dependência de `quietBeforeClose` por um nome fiel, como `originalIoQuietAfterOwnedClose`; nunca escrever `quietBeforeClose=true` retroativamente. O primeiro erro permanece prioritário. Cleanup SDK e remoção do namespace continuam posteriores e usam seus gates atuais.

O fechamento do cliente não é prova nova de quietude no backend. Não amplia a autoridade do relay Next, não autoriza matar Next com Auth pendente, não certifica qualquer POST perdido e não dispensa as conferências de efeitos/SQL/SDK ou a revogação de sessões antes de excluir usuários. Se houver trabalho de servidor não contabilizado ou efeito incerto, os gates atuais devem recusar; é necessária evidência própria desse trabalho, não uma inferência a partir de close do navegador.

No caminho de falha, fechamento tardio pode continuar como cleanup próprio, com orçamento de teardown separado, sem promover a decisão anterior. Registrar quais contextos já tiveram tentativa evita repetir `close` no `finally`; os ainda não iniciados podem receber a tentativa de limpeza apropriada. A promessa pendente permanece possuída até settlement/teardown, sem `Promise.allSettled` ilimitado mascarando o deadline ativo. Nenhuma exclusão de fixtures é liberada por esse ramo.

## Limite importante de Playwright 1.63

A documentação pública define close do contexto e os eventos de conclusão de request separadamente; não oferece uma garantia de flush de rede no close. Na fonte exata instalada, `CRPage.didClose()` dispõe as sessões; `FrameSession.dispose()` chama `CRNetworkManager.removeSession()`. Essa remoção retira listeners de rede e membership de sessão. Esses métodos não fornecem, por si mesmos, um `Network.loadingFailed` para cada request retido. Os handlers originais `_onLoadingFinished/_onLoadingFailed` são outro caminho e é por eles que a ponte relata conclusão real.

Consequentemente, a disposição pode eliminar o produtor de eventos antes de um terminal chegar. Manter o observador de teste inscrito é necessário, mas não recria uma fonte interna já disposta. Sessão removida ou contexto fechado não deve ser contado como `failed`. Se o contraste público não observar terminais reais, mover close nos specs não é uma correção demonstrada e deve continuar recusando.

Não proponho `Fetch.failRequest` depois de `continue` como atestado. Não há nova posse de um interception pausado original após o continue; erro de comando ou ACK não estabelece terminal. Também não proponho mutar o manager Playwright, emitir eventos artificiais, usar erro textual de fornecedor para apagar entradas ou excluir GETs pendentes do resultado final.

## Contraste público recomendado antes de editar Auth

Preservar a execução a159 encerrada e seus arquivos. Um candidato novo deve conservar Node 24.19.0 / Playwright 1.63.0 / Chromium 153.0.8010.12 revisão 1243, runtime/pins exatos, GET direto retido, online, fence original, source close comprovado e deadline único. O fator novo é **context.close ativo após stop/blank e fechamento da fonte, antes do wait final**. Um controle finito continua obrigatório. Não precisa de redirect neste primeiro contraste, pois o caso direto já reproduziu a ausência de terminal sem a ambiguidade de hops.

Registrar só contadores/enums públicos: close solicitado, close próprio observado, promessa resolvida/rejeitada/pendente, terminais público/CDP originais por objeto, sessão ainda registrada/removida, zero de handlers e relógio relativo da decisão. Conservar no relatório a diferença entre zero antes e depois do close. Um close resolvido com request sem terminal deve ser `INCONCLUSIVE` ou recusa fechada, mesmo que o teardown consiga encerrar todos os recursos. Eventos posteriores à decisão não podem preenchê-la retroativamente.

Se houver terminal público original e nenhum CDP correspondente, registrar a divergência; não normalizá-la para igualdade. A decisão de mudar qualquer gate de observabilidade exigiria outro contrato e revisão. Se não houver terminais, uma segunda hipótese específica é a transição para blank ter disposto/desassociado o produtor anterior. Um contraste posterior de close antes de blank pode separar esse fator, mas não deve ser misturado ao primeiro nem disparado automaticamente. Trocar versão de Chromium/Playwright é uma alternativa maior, com nova qualificação/pins e sem aproveitamento automático dos resultados anteriores.

## Alterações e QA caso a candidata se qualifique

O delta funcional ficaria primeiro nos dois blocos de fechamento dos specs; um helper pequeno de protocolo/posse, com ports em RAM, evita implementar duas máquinas de estado diferentes. Os tipos/contratos de relatório só precisam mudar se surgir um campo ou fase pública nova. As fases já permitidas `after-close` continuam adequadas para falha final; não modificar os aceites funcionais, os adapters Auth, o SQL de limpeza, o relay estático ou os SDKs do produto.

QA necessária antes de publicar:

- Controle sem pendência e GET autorizado que só emite terminal original durante close: pode qualificar com close/evento e zero completos dentro do prazo.
- Close resolve/emite evento, mas request original permanece sem terminal; e terminal público sem CDP correspondente no contraste: não qualifica.
- Terminal chega antes/depois do evento de close; rejeição tardia após evento, contexto errado, close duplicado e contexto que nunca fecha: sem certificado falso.
- POST/unknown, callback/verify/logout, SDK/SQL/UI/non-read ativo, efeito Recovery pendente e ator/estágio não aprovado: recusam antes do close ativo; request novo durante a fase mantém o veto e o registro original.
- Budget parcialmente consumido por stop/blank; deadline já vencido; callback aos 14.999 ms; relógio regressivo/não finito; erro ou handler introduzido em microtask antes da selagem: sem renovação de prazo nem promoção tardia.
- Close ou terminais que só chegam no teardown, falha de cleanup e primeira falha anterior: não alteram a decisão ativa nem liberam `harness.cleanup`/remoção do namespace.
- Identity dos Requests, observers e listeners originais retida; nenhum unroute/offline/map.delete fora do terminal/evento original; execução integral das suites de protocolo, Auth checkpoints e tipos/lint apropriados.

Depois disso, Root revisa o SHA final, publica uma única nova execução Auth por cenário necessário e prepara novos bindings/readers se a fonte mudar. QA RAM e o contraste público não fecham issues, não comprovam limpeza no Supabase pessoal e não constituem aceite hospedado dos fluxos de autenticação.

## Referências primárias

- [BrowserContext.close e evento close](https://playwright.dev/docs/api/class-browsercontext#browser-context-close): fechamento do contexto e das páginas; sem certificado de requests concluídos.
- [Eventos de Request](https://playwright.dev/docs/api/class-request): `requestfinished`/`requestfailed` e Requests distintos em redirecionamentos.
- [Fonte Chromium de Playwright v1.63.0](https://github.com/microsoft/playwright/blob/v1.63.0/packages/playwright-core/src/server/chromium/crNetworkManager.ts): remoção de sessão e handlers de terminal separados. A análise local usou apenas o bundle público fixado pelo runtime, sem ler memória de execução.
- Skill Supabase e [orientações de segurança de Auth](https://supabase.com/docs/guides/security/product-security): os gates de sessão, revogação e exclusão permanecem preservados; nenhuma API, configuração, migration ou política Supabase é alterada por esta proposta.
