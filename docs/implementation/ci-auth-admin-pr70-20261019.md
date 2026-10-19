# Auth/Admin da PR #70 — correção de integridade das fontes

Autorização: D-076, em 19/10/2026. Base diagnosticada: `eb2fa91b40df6028cf8a2b7d9fe4b2cdc4cc18cf`, branch `codex/paginas-legais-e-checklist-20261018`, [PR draft #70](https://github.com/kauanbarateli/Segundo-Cerebro/pull/70). D-075 continua vigente: Hobby, deploy adiado, sem merge em main. `vercel.json` não é alterado.

## Causas comprovadas

No [Recovery 39193011771](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39193011771), cinco dos 70 controles puros falharam com `SOURCE_REFUSED`. O [Admin navegador 39192967799](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39192967799) também falhou em controles puros, incluindo `369 !== 366`. A [Fundação 39193011575](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39193011575) repetiu esses bloqueios. Os cenários reais de navegador desses dois workflows não chegaram a executar; não atribuir essa falha a SMTP, credenciais, banco pessoal ou ao plano de hospedagem.

1. **Pin do middleware anterior às páginas legais:** o relay exigia 1.809 bytes/SHA-256 `f57cf49d860aa695cac1e16d29a3ec8db8eb7b87c57bc8f5471f68b495ad9c66`. A inclusão de `/privacidade` e `/termos-de-servico` em `e76f323` resulta em 1.847 bytes/SHA-256 `156e39172b77003b3ac9b6f08803b64ed39a126d31d44c6ffe40d761f9f6dd3c`. Comparação do delta confirmou que o matcher de exclusão de assets e as demais regras permanecem iguais. A recusa pelo pin antigo era correta.
2. **Manifesto Admin incompleto:** a seção legal de Configurações acrescentou três imports ao fechamento finito: `src/components/features/configuracoes/settings-legal-section.tsx`, `src/components/ui/legal-links.tsx` e `src/components/ui/legal-links.css`. A derivação real passou de 366 a 369 fontes Git, preservando 60 dependências. A declaração TypeScript ainda dizia 352; ela também precisava concordar com o contrato real. Recovery permanece com 201 fontes Git/60 dependências.

## Correção revisada

- Atualizar somente o pin exato do middleware, preservando os hashes das dependências Next e todas as qualificações fechadas.
- Provar a qualificação pelo acesso real e limitado aos arquivos públicos, manter o matcher estático literal e recusar páginas legais, Auth e API como autoridade de asset.
- Corrigir tamanho das fixtures negativas de tipo de arquivo/symlink para que exercitem seu predicado alvo, em vez de falhar prematuramente por tamanho antigo.
- Atualizar manifesto/declaracão Admin para 369/60; exigir os três imports conhecidos e recusar o universo antigo incompleto, preservando recusa a duplicatas, hashes/paths inválidos e fontes ausentes.

Não houve alteração do middleware, da aplicação, da allowlist de requisições, dos deadlines, dos specs de navegador, do protocolo de cleanup ou dos workflows. Não se limpou mapa de pendências, fabricou terminal, ignorou erro ou substituiu confirmação individual por descarte da infraestrutura. Os testes continuam exigindo os efeitos e settlements originais. Nenhum serviço pessoal ou perfil privado foi acessado.

## Validação

Root revisou os dois deltas independentes e ocupa um único processo pesado por vez, em Node 24. O relatório de fechamento da PR identifica o SHA corrigido e os runs novos; não transfere o PASS de outro commit ou confunde controles sintéticos com a stack real descartável do CI. As falhas históricas da #43 permanecem até os aceites completos da issue serem demonstrados.

O primeiro lote local executou 233 controles: 232 passaram e a asserção restante ainda fixava 366 no teste binário do coletor. Ela foi corrigida para 369; essa tentativa não é registrada como PASS. O teste do relay passou 25/25. A conferência posterior e o CI devem ser registrados com seus resultados próprios, mantendo falhas visíveis.

Revisões cruzadas independentes, somente leitura, confirmaram o delta de três imports, a identidade exata do middleware e a preservação dos gates. O coletor mantém caminhos canônicos, limites, Git blob, SHA-256, versões pinadas e 60 dependências únicas; a atualização não substitui eventos terminais nem autoriza apagar pendências. O portão TypeScript específico `tests/scripts/admin-browser.types.mts` passou. O teste binário corrigido passou 1/1 isolado antes da repetição do lote integrado.

**Lote final local: 258/258 controles PASS**, zero falhas/skips, arquivos de relay, Admin suporte/CI e Recovery, com `--test-concurrency=1`. Lint dos cinco arquivos de código/declaracão alterados passou com zero warnings. Artefato TAP ignorado: `work/ci-auth-admin-pr70-20261019/pure-controls.tap`. Nenhum build ou teste conectado pessoal foi necessário para a mudança de manifesto; os cenários reais Linux/Supabase descartável permanecem nos workflows originais para conferência do novo SHA. Nenhum resultado hospedado é antecipado por este PASS local.

## Resultado real de `b3b5c85` e próxima correção

Os controles puros de ambos os workflows passaram. O SHA do head é `b3b5c85089da87c132e0cfbe53e3b056de422984`; os relatórios do evento `pull_request` identificam corretamente o merge sintético `bef73869a37e53bf76c6a5612f00e16850a6ea88`, conferido nos metadados da PR. Isso não representa merge na branch base.

- [Recovery 39194385354 / job 117873863425](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39194385354): os sete estágios funcionais chegaram a `credentials-changed`. A falha real foi `QUIESCENCE_HTTP_ASSET_NO_RESPONSE_PENDING`, fase `full`, com três requisições originais pendentes e zero inspeções pendentes. O diagnóstico do relay foi `EMITTED / NONE`; o settlement posterior do parent não prova término dessas requisições. O caso manteve `writeOutcomeUncertain=false`, mas o agregado ficou `true`, sem certificado de limpeza.
- [Admin 39194385412 / job 117873863861](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39194385412): `BLOCK_LIVE_BROWSER` chegou a `actor-intact` e falhou com `QUIESCENCE_HTTP_DETAILS_MIXED_PENDING`, fase `after-blank`, duas requisições originais pendentes e zero inspeções pendentes. Origem `fixtures`, classes/recursos mistos. O relay recusou a autoridade estática: `INELIGIBLE / STATIC_AUTHORITY_MISSING`. O segundo caso não executou. Escrita incerta e ausência de certificado de limpeza permanecem.

Nos dois casos, as observações fechadas mostraram `exact-server-request`, `no-terminal-observed`, `publicTerminal=not-observed`, `managerEntry=same-request`, `sessionRegistered=registered` e `Fetch.continueRequest` resolvido. ACK de transporte não é terminal. Nenhuma ausência de cleanup foi reinterpretada como PASS.

**Hipótese em investigação:** os specs usam `domcontentloaded` e a presença do formulário como prontidão para novas navegações/ações; isso não prova que as leituras finitas do documento anterior terminaram. A origem inicial das pendências é compatível com abandono precoce, mas não comprova essa causa. A correção proposta aguarda `load` com o mesmo timeout de navegação e terminais originais das leituras finitas antes de trocar de documento, sem `networkidle`, novas requisições, descarte de entradas ou alteração do deadline final de 15 segundos. O HMR exato só é separado nessa prontidão transitória; a quiescência final continua incluindo-o.

**Alternativa não promovida a correção:** fechar ativamente o contexto antes do drain. A revisão do código instalado Playwright 1.63.0 mostrou que `context.close()`/`page.close()` podem remover sessões sem emitir os terminais necessários. A evidência histórica do probe não executou esse fator e não demonstra eficácia. Não aceitar a resolução do close como substituto dos eventos originais nem importar o probe diagnóstico nos specs para forçar sucesso.

Auth local, Admin backend, Fundação Supabase, Captura e Avatar passaram nos eventos `push` e `pull_request` desse head. O CI geral passou os contratos, typecheck, lint e build; os E2E terminaram com **291 PASS / 3 FAIL** no [run 39194385633](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39194385633). A regra de bloqueio Vercel da branch continua preservada.

### Expectativas antigas do CI geral

As três falhas adicionais são expectativas anteriores às entregas aprovadas, corrigidas nos próprios testes, sem alteração de interface:

1. `/conheca` exigia zero links fora das âncoras. D-065 aprovou os links legais; o teste passa a exigir exatamente `/privacidade`, `/termos-de-servico` e `/configuracoes`, preservando a proibição de checkout/formulários e destinos comerciais nesta entrega.
2. A navegação mobile de Configurações exigia apenas seis itens. O teste inclui `Privacidade e termos` como seção estática adicional, exercita sua âncora por teclado e os dois destinos legais, sem inventar comportamento recolhível. Os seis painéis anteriores e a conferência de ausência de escritas continuam.
3. O comparador visual recusou `PRODUCT.md`, atualizado em `15df12d` pelo planejamento D-034/D-064. A revisão confirmou somente três alterações de texto de produto; o blob Git tem 5.583 bytes/SHA-256 `de22bc82a696ff491b34463abac104b42708621bcc49c0ada668c0d73d021939`. Uma qualificação explícita `planning` permite exclusivamente esse documento/hash na árvore corrente C. B/P, CSS, tokens, capturas, medições e limiares permanecem inalterados. Negativos recusam esse hash em B/P, outro path ou formato/hash alterado. Isso destrava o ensaio; não antecipa aceite das 36 cenas visuais.

### Prontidão transitória implementada e revisão

Admin e Recovery aguardam `load` nas navegações reais, com os mesmos 30 segundos (`reload` de Recovery mantém 15 segundos). Antes de navegações/ações e depois dos oráculos correspondentes, a prontidão lê os mapas de Requests e handlers originais. Não conta sua própria Promise ou um waiter de resposta já armado como uma leitura pendente. O preflight da visão de sessões ocorre antes de armar seu waiter de 20 segundos.

Cada espera tem limite absoluto próprio de até 15 segundos, relógio monotônico e reconferência do mapa após o poll retornar. Um GET/handler novo nessa continuação recusa a transição; um terminal no limite ou depois dele não aprova. O HMR canônico permanece no mapa e é omitido somente dessa projeção transitória. POSTs/efeitos desconhecidos vetam a transição; os GETs de verificação/callback de Recovery continuam sendo leituras finitas obrigatórias, com tratamento de incerteza após efeito observado. Falhas posteriores a POST ou verificação observados preservam o primeiro erro e a incerteza aplicável.

Os initializers de fechamento final não foram alterados. Continuam com o deadline original de 15 segundos, toda a IO original, observadores vivos e cleanup condicionado às provas individuais. Nenhum `close`, ACK, terminal fabricado, exclusão manual de Request ou destruição da stack concede sucesso. Source counts permanecem Admin 369/60 e Recovery 201/60, sem novo módulo no fechamento finito. Revisão independente dos oito arquivos de código/teste não encontrou bloqueador no delta; isso não é evidência nativa de navegador.

### Verificações locais da prontidão e dos contratos

Node 24.19.0, processos sequenciais:

- **274/274 controles PASS**, zero falhas/skips: relay, Admin suporte/CI e Recovery. TAP ignorado em `work/ci-auth-admin-pr70-20261019/controls-final.tap`. Inclui 16 controles novos (sete Admin e nove Recovery), que compilam os helpers/listeners reais por AST e usam portas RAM explícitas.
- Lote focal de transições/fechamento: 35/35 PASS. Reconferência focal posterior de Recovery: 8/8 PASS. São subconjuntos sobrepostos; não somá-los ao total de 274.
- Qualificação visual: 26/26 testes unitários PASS no arquivo `visual-ref-css-order.test.ts`. A primeira tentativa não iniciou testes por `EPERM` ao renomear cache no TEMP do sandbox; a repetição usou TEMP/TMP em pasta ignorada do workspace e passou. Nenhum baseline foi atualizado.
- Typecheck integral, ESLint dos oito arquivos alterados com zero warnings, `git diff --check` e scanner de 1.663 arquivos versionáveis PASS. Nenhum valor secreto foi impresso.

Os três E2E gerais corrigidos e os cenários reais Auth/Admin precisam do novo run Linux para seu próprio SHA. Este lote local não certifica Supabase hospedado, SMTP pessoal, Vercel ou cleanup real do navegador. Publicação continua somente para revisão na mesma PR draft, sem merge, deploy ou alteração do Hobby.

## Resultado intermediário de `40e726f`: POST inicial recusado

O [Recovery da PR, run 39195746792 / job 117878029318](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39195746792), executou o merge sintético `0bdc4eae8fa45080d11018dd7c9454e11a5d0c48` do head `40e726fdbd8680f22fcb800ef3bc0dff6177b71d`. O [evento push, run 39195743831 / job 117878020445](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39195743831), reproduziu o mesmo resultado no SHA do head.

Ambos recusaram `AUTH_POST_REQUEST_FAILED`, somente com o estágio `fixture`, 14 requisições de navegador e um POST de login contado. Recovery/reset não começaram. A pendência final ficou em zero, mas a escrita é incerta e os contadores de exclusão/ausência/revogação continuam zero. `ioQuiet`, remoção da infraestrutura e dos diretórios não certificam limpeza individual da fixture nem compensam o POST recusado.

Esses contadores não identificam qual POST falhou: o listener também observa o endpoint permitido de monitoramento. Sem classe de recurso, resposta e falha original, não é possível atribuir o resultado a hidratação, HMR ou `ERR_ABORTED`. O próximo diagnóstico é uma projeção opcional fechada do primeiro evento de falha, sem URL, mensagem de erro, corpo, credenciais ou cabeçalhos crus. Ele não autoriza retry, exceção para aborto ou limpeza. O login recusado pode escrever no limitador e limpar estados de Auth; por isso não herda o recibo exclusivo de reset de senha.

[Admin 39195746901 / job 117878029644](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39195746901) também falhou no primeiro login: `TRANSPORT_FAILED`, somente `fixtures`, 21 requisições de navegador, um POST de login, zero pendências e escrita incerta. Nenhum comando Admin ou cleanup individual foi certificado; o segundo caso não executou.

O [CI geral 39195746817](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39195746817) passou contratos, typecheck, lint e build e terminou com **293/294 E2E PASS**. Landing e ensaio visual executaram; o erro restante foi a lista finita da fixture de navegação de Configurações, que ainda recusava `#privacidade-e-termos` e gerava `BROWSER_ERROR`. A fixture passa a aceitar somente essa âncora adicional, mantendo origem/path/search e todas as outras recusas. Não se ignoram erros de navegador e não se amplia a navegação para as páginas legais nessa fixture; o teste confere os destinos estáticos sem navegar a elas.

### Observação fechada do POST

`authPostFailure` é opcional para compatibilidade com relatórios anteriores. Quando presente como objeto, contém exclusivamente cinco enums: operação (`login/recovery/reset/other`), recurso (`document/fetch/xhr/other/unavailable`), falha (`aborted/failed/other/unavailable`), resposta (`unobserved/200/303/other`) e tipo de conteúdo (`unobserved/flight/html/other`). Só é permitido em `failed / AUTH_POST_REQUEST_FAILED / writeOutcomeUncertain=true`; `null` não contém observação e não concede aceite.

A classe da operação/recurso é capturada no evento original de Request aceito, incluindo monitoramento como `other`. O primeiro evento de Response aceito daquele mesmo objeto fornece somente as classes de status e `content-type`; o valor bruto não fica no WeakMap nem no relatório. A falha usa comparação literal do erro nativo, armazenando apenas seu enum. A primeira snapshot é copiada e congelada antes da recusa; resposta tardia, outro Request ou outro erro não a completam nem substituem. Não são lidos corpos ou headers de requisição. A classificação de um header de resposta não é registro de headers crus.

Seis novos controles por AST/RAM verificam os WeakMaps originais no mesmo escopo, identidade da resposta, observação de monitoramento, ausência de backfill, preservação da primeira falha, legado, enums/canários/getters e falhas na leitura diagnóstica. Revisão independente não encontrou bloqueador. Isso permanece observação inerte: nenhum fator de hidratação/show-hide foi introduzido junto dela e nenhum aborto novo é aprovado.

Validação própria deste delta, em Node 24 e sequência: **280/280 controles PASS**, zero falhas/skips, no lote integrado de relay/Admin/Recovery (`work/ci-auth-admin-pr70-20261019/diagnostic-controls.tap`, ignorado). Typecheck integral, lint dos cinco arquivos de código/declaracão alterados, scanner de 1.663 arquivos e `git diff --check` passaram. A função `bounded` e seu Set real, extraídos da fixture por AST, aceitaram as oito âncoras declaradas e recusaram seis combinações de outra âncora, path, origem ou query. Esses controles não certificam o novo evento nativo nem os E2E remotos.

## Diagnóstico nativo de `f113d22` e efeito de cookies

[Recovery 39196870992 / job 117881426765](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39196870992), merge sintético `c4a792c934ad161dd2608209c325e45d3d3370dd` do head `f113d2279532bfcf9de839ef3363ed96f7b2626a`, recusou novamente `AUTH_POST_REQUEST_FAILED`. A observação original foi `operation=login`, `resource=fetch`, `failure=aborted`, `response=200`, `contentType=flight`. Houve 31 requisições e dois POSTs de login contados, somente `fixture`; zero pendências, escrita incerta, zero exclusões individuais certificadas. A contagem não identifica qual dos dois contextos/logins falhou.

Isso comprova aborto de um fetch com resposta 200 Flight observada. Não comprova EOF, efeito final, causa de navegação ou participação de HMR. A hipótese de falta total de handler de submit perde força; não introduzir o probe de revelar senha junto da próxima mudança. A observação continua inerte e a recusa original é preservada.

**Efeito desnecessário comprovado por leitura de código:** `signIn` chama dois `flows.clear` antes da tentativa. O adapter atual sempre grava cookie expirado, mesmo sem o nome no jar. No Next instalado 15.5.27, essa mutação marca `pathWasRevalidated` e provoca árvore Flight adicional. O vínculo causal entre essa revalidação e o aborto permanece hipótese, separada do fato sobre a escrita.

O próximo fator isolado evita a gravação somente quando o nome exato não existe no jar atual. Preserva a recusa `writable=false` antes da leitura, expiração segura de qualquer cookie presente (inclusive vazio, inválido ou expirado), o fluxo `put → clear`, outros cookies, SDK, `clearSessionCookies`, regras do Núcleo e critérios dos testes. Login bem-sucedido e demais mutações de cookies continuam exigindo as provas próprias. Nenhuma exceção de aborto ou retry de POST é concedida por essa otimização.

O [Admin 39196870979 / job 117881427653](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39196870979), no mesmo merge sintético, recusou `TRANSPORT_FAILED`, somente `fixtures`: 44 requisições, dois POSTs de login, três contextos, zero comandos Admin e nenhuma limpeza individual certificada. O diagnóstico ainda não identificava o recurso ou a resposta desse POST. A instrumentação seguinte acrescenta somente cinco enums opcionais ao primeiro erro original, com o mesmo vínculo por Request e sem mudar o comportamento de recusa.

O [CI geral 39196870970 / job 117881427167](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39196870970) passou integralmente, incluindo **294/294 E2E**. Auth local, Admin backend, Fundação Supabase, Captura e Avatar também passaram no evento PR desse head. Esses resultados não substituem os dois cenários reais de navegador ainda recusados.

Validação local do ajuste de cookies: **103 testes Auth PASS**, com todos os clientes SDK mockados, e controle do adapter nativo Next em RAM confirmando zero cookies modificados/revalidação na ausência, preservando ambos na expiração real e no controle anterior incondicional. Lote de relay/Admin/Recovery anterior à instrumentação Admin: **280/280 PASS**. Typecheck, lint, scanner de segredos, `git diff --check` e portão de camadas (392 módulos/1.497 dependências, nenhuma violação) passaram. O novo SHA precisa de resultados hospedados próprios; isso não comprova a causa do aborto.

### Diagnóstico Admin revisado

O campo opcional `authPostFailure` aceita ausência legada ou `null`. Um objeto exige exclusivamente cinco enums e o contexto `failed / TRANSPORT_FAILED / writeOutcomeUncertain=true`. WeakMaps privados de cada contexto vinculam operação/recurso e primeira resposta aceita ao Request original. Somente a transição para a primeira falha `TRANSPORT_FAILED` anexa uma cópia congelada; resposta tardia e outro Request não completam a snapshot. São projetados apenas status e tipo de conteúdo classificados; corpo, URL, mensagem e headers crus não são exportados. Erros dos leitores de metadados preservam enums fechados e a falha original.

Cinco controles novos executam os listeners reais por AST/RAM, incluindo identidade, primeira falha/resposta, fallback, canários e relatórios de sucesso/not-run previamente válidos. A primeira tentativa integrada terminou **283/284**, com um erro da fixture que tentava troca de senha no caso BLOCK (budget zero). A correção usa FIRST_FORCED nesse vetor, sem alterar budgets ou gates. Repetição focal: **5/5 PASS**. Revisão independente dos cinco arquivos não encontrou bloqueador. O probe manual histórico e seus pins não foram alterados nem executados; seu resultado anterior não certifica este delta.

Repetição integrada final: **285/285 PASS**, zero falhas/skips, em Node 24 e processo único (`work/ci-auth-admin-pr70-20261019/admin-diagnostic-final.tap`, ignorado). Typecheck integral e portão específico `admin-browser.types.mts` passaram. Lint de todos os sete arquivos de código/declaracão alterados, scanner e `git diff --check` passaram. O fechamento final continua com os mesmos 15 segundos e suas provas originais; nenhuma escrita desconhecida, aborto ou destruição da infraestrutura foi aceita como sucesso.

## Resultado intermediário de `336cca1`: ambos os logins negativos passaram

O [Recovery 39198456095 / job 117886214728](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39198456095), merge sintético `905ca9ccae30ae8d313d0c1fd6a1c04c057cfa01` do head `336cca1b3e1dc57b2a0fe80261e90262a1f82ada`, chegou a `generic-login`: os dois logins negativos concluíram seus oráculos. Não registrou aborto POST (`authPostFailure=null`). Isso mostra progresso nesse run, sem comprovar que todo aborto possível foi resolvido.

A falha seguinte foi `QUIESCENCE_HTTP_DETAILS_MIXED_PENDING`, 52 requisições de navegador, três Requests originais pendentes e zero inspeções pendentes, antes de qualquer POST de recuperação. O caso preservou `writeOutcomeUncertain=false`; o agregado permaneceu `true`, com IO não quiescente e sem remoção certificada da infraestrutura ou limpeza individual. A origem/fase ficaram nulas porque a primeira recusa ocorreu em `finiteReadsReady`, cujo ramo não anexava os trackers disponíveis. O fechamento posterior não pode complementar uma primeira falha sticky.

A próxima observação deve registrar essa mesma primeira recusa com fase `finite-readiness` e a origem/protocolo já capturados, sem autoridade NextStop, navegação adicional, limpeza de mapas ou mudança de prazo/critério. Não atribuir as três leituras a HMR, prefetch, fixture, rota ou asset sem a evidência original.

O [Recovery push 39198453199 / job 117886205450](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39198453199), no próprio head `336cca1`, também passou `generic-login`, com as mesmas contagens funcionais, mas terminou com um Request `AUTH / NO_RESPONSE` pendente. A diferença para as três pendências mistas da PR impede atribuir uma lista fixa de Requests sem observação.

O [Admin 39198456045 / job 117886214685](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39198456045), no mesmo merge sintético da PR, recusou `TRANSPORT_FAILED` no primeiro login: `login / fetch / aborted / 303 / flight`. Somente `fixtures`, 21 requisições, um login, dois SDKs próprios, zero comandos Admin; escrita incerta, zero pendências e nenhuma limpeza individual certificada. A remoção posterior de containers/diretórios não prova exclusão/revogação da fixture. O segundo cenário não executou.

**Falha de coordenação comprovada no SDK instalado:** `Response.finished()` aguarda `_finishedPromise` ou o fechamento do alvo. `_onRequestFailed` emite a falha original, mas não resolve essa Promise; `_onRequestFinished` a resolve depois de emitir o terminal público. O helper Admin só fechava o contexto após aguardar `finished()`. O delta arma o waiter do Request exato antes da ação, com os 20 segundos existentes, aguarda os três ramos originais em `allSettled` e só então valida identidade, status e `finished()`. Não concede exceção ao aborto 303 nem infere sucesso pelo redirect. A confirmação de efeitos de login continua exigindo suas próprias provas.

O [CI geral 39198456084 / job 117886214646](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39198456084) passou integralmente, **294/294 E2E**; os outros cinco workflows especializados da PR também passaram. Recovery/Admin navegador permanecem pendentes. O head continuou draft, sem merge e sem deployment GitHub registrado na conferência.

### Próximo delta de observação e espera

- Recovery registra a primeira recusa HTTP/UI de prontidão como `finite-readiness`, com a origem/protocolo dos mesmos Requests originais. HTTP exige origem fechada; NextStop é proibido nessa fase. As três fases de cleanup permanecem separadas e o deadline final não é alterado.
- Admin aguarda o terminal exato antes de `Response.finished()`. O pós-drain usa o checkpoint existente com observação do POST: falha após efeito observado conserva escrita incerta e o primeiro código; falha no preflight antes de POST não inventa escrita.
- A repetição integrada intermediária passou **292/292**. O primeiro focal do waiter falhou antes de executar os cinco casos por import ausente na fixture; o import foi corrigido e a repetição passou **5/5**. Os dois controles posteriores de pós-drain/preflight, junto aos anteriores, passaram **8/8** no lote focal. Recovery prontidão passou **9/9**; os subconjuntos se sobrepõem e não devem ser somados como total único. Revisão independente verificou origem, identidade, campos fechados e ausência de flexibilização.

Validação final própria: **294/294 controles PASS**, zero falhas/skips, Node 24, processo único (`work/ci-auth-admin-pr70-20261019/finite-observation-terminal-final.tap`, ignorado). Typecheck integral e específico Admin, lint dos seis arquivos alterados, scanner de 1.663 arquivos e diff-check passaram. A revisão posterior aprovou também a preservação de incerteza no pós-drain. Esses controles não certificam a stack real do próximo SHA; o 303 abortado continua recusado e não libera fixture.

## Resultado de `4989fab` e confirmação restrita de login

Head `4989fab3f3b2bf1669b4c5e7bb32a2f7e48c9eb0`; merge sintético PR `a2f6bca0591e2e37929ad56fc2dbaa6a3572ea4f`.

- [Recovery 39199751181 / job 117890076145](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39199751181): primeira recusa `finite-readiness / QUIESCENCE_HTTP_DETAILS_MIXED_PENDING`, após `generic-login`. Duas leituras originais pendentes, recurso `fetch`, introduzidas em `generic-login`, `continue-ack`; identidade exata no manager original, sessão registrada, comando Fetch resolvido e nenhum terminal público/protocolo observado. Cinquenta requisições, dois logins, zero recovery/reset; caso sem escrita incerta, agregado incerto e nenhuma limpeza individual. A evidência não identifica path/família nem prova HMR.
- [Admin 39199751136 / job 117890076768](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39199751136): mesmo primeiro login `fetch / aborted / 303 / flight`, recusado `TRANSPORT_FAILED`; somente fixtures, zero comandos Admin e nenhuma exclusão individual certificada. O segundo cenário não executou. A espera passou a ter o terminal exato delimitado; o aborto continua sem aceite de efeito.
- [CI geral 39199751170 / job 117890076008](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39199751170): aprovado integralmente, incluindo os E2E. Os cinco workflows especializados restantes da PR também passaram. Nenhum desses resultados substitui os dois casos de navegador.

### Próximo fator Admin e observação Recovery

O protocolo puro ganha operações distintas `login-help` e `login-forced`, com origem/path/search brutos exatos, destinos push separados e recibos de uso único. Um aborto literal só pode ser candidato com resposta original 303 e redirecionamento literal correspondente; aborto 200, falha anterior, outro Request/frame, duplicação ou resposta tardia continuam recusados. Os caminhos antigos de offline, Drive histórico, reset e login negativo não recebem essa ampliação.

No Admin, o latch é armado antes do clique. A confirmação exige: destino e UI reais; getUser, claims e acesso exatos; SID ausente do inventário capturado antes do POST; GET/reload protegido 200/no-store com o mesmo SID/token. O caso forced exige ainda GET do módulo previsto respondendo 403 com JSON fechado. O recibo é consumido uma única vez ao iniciar a confirmação; somente após o último oráculo o latch específico sai. Nenhum `state.unknown()` genérico é apagado. Falha, descarte ou prova incompleta conservam o latch, bloqueiam NextStop/fechamento/cleanup e permanecem no relatório.

Para evitar expiração artificial antes do clique, a leitura finita ocorre antes de armar a observação. Depois disso, uma reconferência síncrona dos mesmos trackers recusa GET/handler novo antes de enviar POST, sem nova espera ou renovação do prazo. Negativos e troca de senha conservam o caminho de terminal completo.

O único probe adicional é o GET 403 do login forçado: FIRST apiProbes 27→28 e nextProbeRequests 33→34. A closure Admin deriva exatamente **372 fontes Git/60 dependências**, adicionando os três paths explícitos do helper, declaração e seus testes; omitir qualquer um continua recusado. Nenhuma expectativa foi reduzida.

Recovery acrescenta somente `readFamilies` opcional: até nove enums únicos e ordenados, capturados no primeiro GET aceito do Request original. Não publica URL, query, header ou corpo. Distinguir família RSC/static/hot-update não prova o iniciador nem autoriza ignorar a leitura. Não houve prewarm, cancelamento novo, renovação de deadline ou alteração dos critérios de cleanup.

Controles focais: **42/42** no helper compartilhado (incluindo tipagem compile-only), **23/23** nos controles Admin sobre prontidão/POST/oráculos e **4/4** nos coletores/famílias. As execuções se sobrepõem ao lote integrado e não devem ser somadas como total distinto. O primeiro integrado terminou **328/347**: as 19 falhas estavam nas fixtures AST antigas de Admin sem o novo Set de efeito pendente. Elas foram corrigidas para compartilhar o mesmo Set/WeakMap entre callbacks, readGate, fechamento e snapshot, mantendo asserções, relógios e prazos. Revisão independente aprovou o helper, integração, famílias, manifestos e essa correção; isso permanece validação estática/local, sem aceite nativo antecipado.

**Repetição final: 347/347 PASS**, zero falhas/skips, Node 24 e sequência única (`work/ci-auth-admin-pr70-20261019/login-effects-family-final.tap`, ignorado). Typecheck integral e específico Admin, lint dos 13 arquivos de código/declaracão alterados, scanner e diff-check passaram. A prova de 372/60 inclui o hash binário do JPEG preservado e recusa de cada seed ausente. Falta observar os próprios runs do novo SHA; o efeito real dos logins e a resolução das pendências HTTP ainda não foram certificados.
