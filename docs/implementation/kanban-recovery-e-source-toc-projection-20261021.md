# Kanban e projeção do diagnóstico SourceTOC — 21/10/2026

Refs #73, #41 e #35. Base integrada: `e6ba6fa9c4068da189a2af3471bbb7ed80c78a04`, árvore `43eac026e4d952a07d4932b5625e34bae9e02805`. Os dois recortes abaixo são independentes; compartilhá-los nesta candidatura reduz rodadas completas de CI sem misturar suas autoridades ou critérios de aceite.

## Base já validada

A PR #98 incorporou a cadeia #91–94 e o observador passivo SourceTOC. Seu head `7abe9fa` aprovou 17 originais na tentativa 1. Os oito originais próprios da main e6 também passaram: 2.310 testes por fuso, 1.813 scripts, 335 E2Es, auditoria zero e sete relatórios nativos com origem e limpeza conferidas. O CI próprio é [39705924879](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39705924879).

Esses resultados pertencem à base. Não validam o delta deste documento. A produção continua no deployment c46 já conferido; a agenda do Calendário foi restabelecida depois do aceite da main, sem novo dispatch manual. O primeiro disparo diário original ainda exige observação própria.

## Tarefas: apresentação e recuperação

A fonte do Kanban é a PR #85, head `c18ffb86ecfc0f1890ac85b724a4f1e78929e512`. Foram aproveitados seus cinco arquivos de produto, dois testes unitários e os três cenários E2E. O layout, CSS e componentes existentes são preservados: Lista e Kanban usam o mesmo recorte, busca e ordenação; criar em uma coluna apenas preenche o estado inicial; seletor nativo permite mudar estado por teclado/toque e o arraste é complementar. Arquivo, lixeira, restauração, campos completos e links profundos continuam disponíveis. A preferência de apresentação é local e separada por usuário; não concede Entitlement.

A revisão encontrou um P2: depois de uma resposta incerta, confirmar pelo banner global resolvia o journal, mas o workspace conservava sua incerteza local. Um efeito que apenas lê o snapshot final também é insuficiente: o journal original pode emitir o terminal da intenção A e imediatamente publicar `pending` da intenção B.

`subscribeTaskActionSettlements` consome o terminal dentro da própria assinatura, antes de outro snapshot substituí-lo. O controlador só é liberado para `confirmed/rejected` do mesmo `client_id` e usuário, quando a intenção está incerta e seu owner local já não está em andamento. `idle`, sessão alterada, outro usuário/identificador e um owner ainda pendente não liberam a intenção. A leitura inicial cobre terminal já disponível; o disposer original é preservado. O callback atualiza estado e referências React; foco e rolagem ficam no efeito posterior à renderização.

O teste conectado prepara 12 casos com `createConnectedApplication` e `CommandJournal` originais: resultados globais, negativos de identidade/intenção, owner em replay, sessão alterada, leitura inicial/disposer e os dois resultados do burst A→B. O burst reabre uma aba que não recebeu notificações: outra aba finaliza A e inicia B sob o lock original; o consumidor deve liberar somente A, conservar B e não acrescentar POST local. Isso não equivale a ensaio de foco no DOM ou persistência hospedada.

## Gates reconciliados

Na primeira candidatura b5, o inventário Admin passou de 415 para 417 fontes: somente `task-board.ts` e `task-action-command.ts` entraram na composição; seus imports já eram alcançados. O coletor original confirmou 417 nessa rodada. O diagnóstico Auth posterior acrescenta o contrato puro de ciclo e deriva418, a conferir no novo SHA. As 61 dependências permanecem. Derivação estática e contagem observada conservam estados separados.

Os contratos JS/TS e o teste concordam; o negativo recusa a omissão individual dos dois helpers e preserva os controles de efeitos, decoder SSR e Git adulterado. O pin do contrato no probe active-close foi recalculado. Quiescência, limpeza, prazos internos e retries permanecem; a ampliação posterior do orçamento global CI é explicitada abaixo com a evidência do cancelamento original.

O CSS do Kanban, após o ajuste responsivo descrito abaixo, tem SHA256 `04027f2a365b5c4f84b7c91aa23681edf175e9ff4b904805e8fcde73a648ed36`. Só C aceita esse blob; os dois anteriores são explicitamente recusados. B/P conservam suas fontes históricas. C primeiro comprova o estado Todas e suas contagens, depois seleciona Abertas para a mesma cena histórica. Não se filtram registros, escondem diferenças brutas ou substituem fixtures para obter igualdade visual. A confirmação do resultado renderizado corrigido permanece necessária.

## SourceTOC: projeção pública inerte

O módulo `restore-source-toc-failure-projection.mjs` exporta somente `parseSourceTocFailure(bytes)`. Ele não importa inspector, Target, autoridade ou banco; não lê arquivos, ambiente, relógio ou rede e não inicia processo. Nenhum dispatcher ou preparo o chama automaticamente.

O recorte é deliberadamente estreito: falha combinada externa na fase `source`, diagnóstico interno em `native_toc`, autenticação completa declarada e os demais diagnósticos nulos. As 14 chaves externas, sete chaves do diagnóstico interno e todos os objetos do observador têm forma exata. Sucesso, falha mínima do operador, outra fase e formas desconhecidas recusam; não são silenciosamente truncados.

A entrada aceita somente uma vista de bytes genuína, sem Proxy, memória compartilhada, buffer destacado ou conversão por métodos do chamador. Há cópia própria, zerada no `finally`, teto de 64 KiB, UTF-8 estrito, documento único, profundidade e tokens limitados e recusa de chaves JSON duplicadas, inclusive escapadas. A saída é uma cópia recursivamente congelada. Erros de validação têm código fixo, sem texto do produtor.

As sequências ficam entre 1 e 64. Slots que já representam erro precisam estar entre `firstError` e `lastError`. Fatos novos na fotografia final precisam ser posteriores ao contador da primeira fotografia; empate em 64 é permitido somente com overflow final. Callback inicialmente bem-sucedido, repetições posteriores e códigos externos distintos da primeira recusa continuam representáveis. Essas regras recusam contradições explícitas; não atestam proveniência, causalidade nativa, término ou limpeza.

A QA pura prepara 28 testes, incluindo os oito controles adicionais da revisão temporal. Não há archive, perfil, PostgreSQL, HTTP ou preparo privado nessa QA. A inspeção SourceTOC continua com seus gates e exceção EPIPE anteriores. Todos os indicadores de comparação, qualificação, mutação e aceite de restore permanecem falsos no recorte aceito.

## Validação e limites desta candidatura

### Primeira rodada e correção visual

O head inicial `b5ba2919d2ff7b416bcc7d3e22020247cbf3c8c5`, árvore `ac40523f293b6db95cec9c763d5843c83c50be7f`, aprovou **17/17 originais**, tentativa 1, sem rerun/cancelamento. Os dois CIs próprios ([push](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39709569620), [PR](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39709576045)) confirmaram 2.330 unidades por fuso, 1.841 scripts, 338 E2Es, projeção 28/28 e os 12 casos conectados em ambos os fusos. Os 14 relatórios nativos confirmaram origem e limpeza; Admin observou 417 fontes e Recovery, 227. As 22 migrations/1.428 checks ocorreram somente nos bancos descartáveis dos runners.

A inspeção conjunta Root das capturas originais desse push encontrou um P2 em 320 px: os nomes Lista e Kanban quebravam no meio da palavra. A captura 1440 px escura conservava a composição aprovada. O artefato próprio é `12397276156`; PNGs 1440/320 com SHA256 `9dae8faa48ca094170e2ed42375f28198b5cc0dfe1a74708c1f7798163decbbf` e `7217c91846ade4acdbd1b86b45c0093b43b73ae651c11e7383ec4ac922da7ec5`, respectivamente. Nenhum dado pessoal ou navegador local participou.

A correção permite que a faixa distribua as ações em outra linha e conserva os rótulos inteiros, com os mesmos controles/tokens. Os E2Es existentes passam a medir as linhas reais do texto, alvos de 44 px e limites da viewport nos dois tamanhos. Para a confirmação, retiram o ponteiro dos avisos e aguardam sua expiração normal de cinco segundos, com limite explícito, depois de verificarem as interações; então retornam a rolagem interna ao início. Não escondem elementos ou alteram fixtures. O novo SHA exige todos os originais próprios e uma única rodada conjunta de confirmação das capturas. O verde de b5 não valida essa correção nem encerra o aceite visual/humano.

### Confirmação visual e bloqueios separados em 6819471

O head `68194718a20948b10ec08cf591c0b01d6eab1be5`, árvore `531d9e301bf586c5e333823ec547dcdf4208a398`, passou o [CI próprio do push](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39711883920): 2.330 unidades por fuso, 1.841 scripts e 338 E2Es. Root inspecionou em conjunto as novas capturas 320 claro e 1440 escuro: rótulos inteiros, quebra entre grupos quando necessária e composição desktop preservada. Essa é a única rodada de confirmação do ajuste; nenhum novo polimento é proposto. O ZIP do artefato `12397748371` conferiu com o digest oficial `0a10f38dab2089f8da4afe4f288cc7b7fe55a6de0ec37592bda4615a0c2f6702`; PNGs 320/1440 têm SHA256 `51b4d59b2e22582a127b2f94474117abd12278be41abcced9d3f38a391b5251c` e `f50ec9c6ea7e8c97a498e77ae36c5a33fa87fb748cb0a4c58f00618bf46b9960`.

Os 17 originais encerraram em **14 success, duas failure de Auth e um cancelled**, todos na tentativa 1. Os runs Auth [push39711883840](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39711883840) e [PR39711889277](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39711889277) recusaram o relatório do primeiro cenário: `BROWSER_REPORT_REFUSED`, `report:null`, namespace `namespace-start/COMMAND_FAILED`, casos seguintes NOT_RUN. O namespace/stack/diretórios tiveram limpeza confirmada, mas isso não certifica execução ou limpeza das fixtures do teste. `report:null` não prova arquivo ausente: leitura, JSON, schema ou fechamento também podem recusar. Auth/config/spec/runner são byte-idênticos em b5→681; a causa nativa permanece indeterminada.

O [CI PR39711889459](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39711889459) teve a annotation original `The job has exceeded the maximum execution time of 20m0s`. Instalação 302 s, auditoria 172 s, scripts 247 s; seus E2Es começaram em 02:48:33 UTC e foram interrompidos, sem sumário de 338. O resultado do push não lhes foi transferido. A correção candidata amplia somente o orçamento global desse job para 30 minutos, compatível com o preparo frio e os 8,9 minutos dos E2Es próprios do push. Prazos internos, workers, retries e demais workflows permanecem preservados.

O diagnóstico fechado adicional de Auth é descrito em [ci-auth-report-lifecycle-20261021.md](ci-auth-report-lifecycle-20261021.md). Não altera critérios de aceite nem converte os três resultados históricos em PASS. A PR continua em rascunho até nova rodada original completa aprovada; não houve merge ou promoção desse candidato.

O delta de diagnóstico `a2e1bb7` encerrou 17/17 originais em 13 success e quatro failure: lint em ambos CIs, pela constante `copy` sem uso, e recusa de Auth em cenários diferentes. Os inventários dos 12 relatórios nativos aprovados conferiram; os gates posteriores ao lint ficaram skipped. A remoção da constante e a observação fechada do estado final do Playwright seguem para nova revisão/rodada. Não houve alteração adicional de interface ou transferência de PASS entre fontes.

**Implementado:** porte do Kanban, correção da recuperação, ajuste responsivo, reconciliação dos gates e projeção pura. **Validado:** revisão estática Root/independente, bytes/hashes, diff e a confirmação visual delimitada acima; b5 e681 conservam seus resultados próprios. **Pendente:** checks originais do próximo SHA com o diagnóstico e orçamento global corrigidos, revisão de seus novos arquivos e os aceites hospedados/humanos. Nenhum resultado de outra fonte será herdado.

O CI existente deve executar unidade/contratos nos dois fusos, scripts Node, sintaxe/fixtures SQL descartáveis, tipos, lint, camadas, contraste, Impeccable, build e E2Es, além dos relatórios Auth/Admin/Storage próprios. Os cenários Kanban já produzem capturas sintéticas em 320 px claro e 1440 px escuro, com movimento reduzido, para inspeção conjunta. Essas capturas não comprovam toque em aparelho físico, produção ou foco da recuperação global no DOM.

Nenhum runtime de testes/build foi iniciado na máquina de 8 GiB. Não há mudança em Core, adapters, DTOs, dependências ou SQL neste delta. Main e a nova branch conservam `git.deploymentEnabled=false`.

As migrations020–022 da base continuam sem aplicação e exigem corte coordenado, drenagem de escritores antigos e requisitos de backup/restore antes da promoção. Esta candidatura não resolve esses gates. A projeção pública também não substitui um preparo operacional novo, com SHA/tree, hashes, closure e transporte original revisados; preparos CLOSED continuam encerrados. Nenhum archive, perfil ou chave foi aberto nesta entrega.

As issues #73/#41/#35 continuam abertas até seus próprios critérios. Não inclui Drive, as entregas congeladas #78/#79 ou execução de checkout/onboarding Asaas.
