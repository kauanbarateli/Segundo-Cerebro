# Contraste público de close ativo

Quatro paths novos, sem alterar Auth, relay, SDK, CLI, migrations ou produtores/capturas anteriores. Dois casos: controle finito e GET direto retido com `context.close` ativo. Import e help são inertes. O implementador não executa navegador, HTTP, workflow ou captura.

## Composição

Reutiliza `createRedirectRequestLedger`, suas chaves de contadores e o qualificador de ambiente do produtor Redirect; reutiliza o fence, binding e os quatro pins públicos de runtime. Acrescenta pins exatos dos três módulos públicos importados diretamente: Redirect, Fence e contrato do observador. A nova fábrica mantém só a fixture GET e o ciclo de fechamento necessários ao fator novo; não replica o ledger ou o observador CDP.

Runtime idêntico: Linux x64, Node 24.19.0, Playwright 1.63.0, Chromium 153.0.8010.12 revisão 1243. Ambiente original é recusado por chaves/getters fora da allowlist antes de adaptar o nome do gate para o qualificador compartilhado. Nenhuma chave é escondida pela adaptação. Recusa `.env` além do exemplo e confere bytes/hash/arquivos reais dos sete pins antes de iniciar serviços.

## Fases e propriedade

Cada caso possui servidor, browser e contexto novos. A fixture só permite GETs locais fixos e não expõe endpoints do produto. Service Worker é bloqueado, contexto permanece online e o interceptor original segue instalado. O mesmo Request original da leitura final é guardado pelo ledger compartilhado; paths escolhem a função pública, não identidade.

O prazo de 15.000 ms começa antes do startup. Aguardar o GET original continuado/recebido e seus handlers, armar o fence e estacionar não renova esse prazo. O controle recebe e consome seu corpo finito, exige terminais originais e depois fecha sua fonte. O candidato executa stop/blank, comprova o fechamento do servidor e sockets originais e copia seu snapshot pré-close. Somente então solicita close ativo, sem aguardar o prazo inteiro pelo drain anterior.

`context.once("close")` é instalado na aquisição, antes de qualquer chamada. Um único proprietário solicita close e guarda a promessa exata retornada por `context.close`. A mesma promessa é devolvida ao runner e retida para cleanup; seus callbacks observam resolução/rejeição sem substituir o resultado. O estado `{requests,events,promise}` é separado das operações funcionais/handlers. Não há retry de close. Evento de outro ciclo/close espontâneo, rejeição ou promessa pendente não certificam o fechamento solicitado.

O observador original permanece inscrito até a decisão. Nenhuma sessão primária é disposta manualmente. A sessão CDP manual de stop é distinta; seu evento original de desconexão é observado para cleanup. Close do contexto pode remover a sessão primária naturalmente, mas isso não fornece terminal. O candidato só qualifica com terminais público/CDP reais e correspondentes, a identidade exata e a entrada original ausente. Membership de sessão `removed` é admissível apenas junto desses terminais, pois o fator ativo fecha o contexto; `removed` isolado não qualifica nada.

Uma leitura que já terminou antes do close fica `INCONCLUSIVE/ORIGINAL_TERMINALS_BEFORE_CLOSE`; o fator novo não é usado para atribuir uma conclusão anterior. Close resolvido/evento observado sem terminais reais fica inconclusivo, mesmo que o cleanup consiga encerrar tudo. Não há outcome `PENDING` aceito como sucesso neste contraste.

## Relatório e decisão

Relatório fechado com dois casos, snapshots independentes `beforeClose` e `final`, flags `ioZeroBeforeClose`/`ioZeroAfterClose`, estado de close, tempos relativos e cleanup. Nunca escreve zero antes do close retroativamente. A cópia final, o relógio e a decisão compartilham o mesmo turno síncrono depois dos checkpoints; veto tardio e primeira falha permanecem. Um callback antecipado aos 14.999 ms fica `INCONCLUSIVE/CASE_TIMEOUT`, sem renovação e sem promoção a DRAINED.

O controle precisa de resposta finita, terminal finished correspondente e fonte fechada. O candidato precisa da leitura original ainda pendente antes do close, close próprio resolvido/evento, zero completo posterior, fonte comprovada e prazo válido. Se não houver terminal, ou só existir terminal público sem CDP correspondente, o resultado é inconclusivo. ACK, manager ausente, listener removido, `isClosed`, fim de servidor, fim de promise ou cleanup não são terminais.

Somente contadores, enums, SHA de fonte e tempos/flags; sem URL, porta, ID de protocolo, body, headers, cookies ou erro de fornecedor. Limites: 16 para contadores/ações, 16 KiB para o relatório. Ports injetados sempre produzem `mode=synthetic` e `sourceSha=null`. A fábrica interna é a única que marca `native`; validar JSON não cria uma capacidade. `diagnosticOnly=true` e `applicationAccepted=false` são fixos.

Cleanup só começa após a decisão selada, com seus cinco segundos separados. A fonte pode encerrar em paralelo, mas o browser só recebe seu close depois do settlement do close próprio do contexto e da disposição da sessão manual, se a desconexão original ainda não foi observada. Não reemite close já solicitado. Um helper compartilhado com QA em RAM fixa essa ordem; seu booleano não é certificado de recurso e qualquer rejeição permanece cleanup incompleto, mesmo quando etapas posteriores de limpeza conseguem executar. Uma promessa de contexto que não termina não recebe sucesso pelo timeout. Eventos/terminais de teardown não alteram a cópia anterior. Exige close real dos recursos, startup/ações/handlers concluídos e sockets fechados; cleanup incompleto do controle impede o candidato. O workflow só tem dispatch manual e nenhum secret/artifact; sucesso exige controle e candidato DRAINED e ambos os cleanups completos. Uma inconclusão legítima produz failure diagnóstico.

## Validação e próximo passo

QA final própria serial em Node 24.19.0, somente RAM, após estreitar a ordem de cleanup solicitada por Root: **27/27 PASS**, zero skips, `290,0749 ms`; lint dos dois `.mjs`: PASS, zero warnings. Os vetores cobrem promessa/evento/terminal separados, ordens de settlement, duplicação recusada, sessão removida sem terminal, resolução/rejeição/hang, prazo consumido e callback aos 14.999 ms, relógio regressivo, fonte sem prova, terminais anteriores/tardios, microtasks, handlers/ações, cleanup de cinco segundos, posse/ordem dos closes e erro de cleanup sem promoção, schema fechado e ports sempre sintéticos. Não iniciam listener, browser ou transporte nativo.

Root deve conferir os quatro pins finais e executar sua própria QA antes de publicar. A execução real e a captura única terão fonte, binding, paths e leitor novos, com revisão prévia de Root. Nenhum resultado deste experimento altera o aceite de Auth ou autoriza cleanup de banco/fixtures. Nenhum workflow foi disparado pelo implementador.
