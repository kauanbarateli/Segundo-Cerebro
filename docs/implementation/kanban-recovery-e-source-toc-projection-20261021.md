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

O inventário Admin candidato passa de 415 para 417 fontes: somente `task-board.ts` e `task-action-command.ts` entram na composição; seus imports já eram alcançados. As 61 dependências permanecem. Essa é uma derivação estática a confirmar pelo coletor original, não uma contagem observada em runtime.

Os contratos JS/TS e o teste concordam; o negativo recusa a omissão individual dos dois helpers e preserva os controles de efeitos, decoder SSR e Git adulterado. O pin do contrato no probe active-close foi recalculado. Nenhum prazo, regra de quiescência, política de limpeza ou workflow foi relaxado.

O CSS do Kanban tem SHA256 `8c41974b318c3d94f618dc8ae08982f7fef5217f642fec7ed30a158b93da3816`. Só C aceita esse blob; o anterior é explicitamente recusado. B/P conservam suas fontes históricas. C primeiro comprova o estado Todas e suas contagens, depois seleciona Abertas para a mesma cena histórica. Não se filtram registros, escondem diferenças brutas ou substituem fixtures para obter igualdade visual. A revisão do resultado renderizado permanece necessária.

## SourceTOC: projeção pública inerte

O módulo `restore-source-toc-failure-projection.mjs` exporta somente `parseSourceTocFailure(bytes)`. Ele não importa inspector, Target, autoridade ou banco; não lê arquivos, ambiente, relógio ou rede e não inicia processo. Nenhum dispatcher ou preparo o chama automaticamente.

O recorte é deliberadamente estreito: falha combinada externa na fase `source`, diagnóstico interno em `native_toc`, autenticação completa declarada e os demais diagnósticos nulos. As 14 chaves externas, sete chaves do diagnóstico interno e todos os objetos do observador têm forma exata. Sucesso, falha mínima do operador, outra fase e formas desconhecidas recusam; não são silenciosamente truncados.

A entrada aceita somente uma vista de bytes genuína, sem Proxy, memória compartilhada, buffer destacado ou conversão por métodos do chamador. Há cópia própria, zerada no `finally`, teto de 64 KiB, UTF-8 estrito, documento único, profundidade e tokens limitados e recusa de chaves JSON duplicadas, inclusive escapadas. A saída é uma cópia recursivamente congelada. Erros de validação têm código fixo, sem texto do produtor.

As sequências ficam entre 1 e 64. Slots que já representam erro precisam estar entre `firstError` e `lastError`. Fatos novos na fotografia final precisam ser posteriores ao contador da primeira fotografia; empate em 64 é permitido somente com overflow final. Callback inicialmente bem-sucedido, repetições posteriores e códigos externos distintos da primeira recusa continuam representáveis. Essas regras recusam contradições explícitas; não atestam proveniência, causalidade nativa, término ou limpeza.

A QA pura prepara 28 testes, incluindo os oito controles adicionais da revisão temporal. Não há archive, perfil, PostgreSQL, HTTP ou preparo privado nessa QA. A inspeção SourceTOC continua com seus gates e exceção EPIPE anteriores. Todos os indicadores de comparação, qualificação, mutação e aceite de restore permanecem falsos no recorte aceito.

## Validação e limites desta candidatura

**Implementado:** porte do Kanban, correção da recuperação, regressões preparadas, reconciliação dos gates e projeção pura do diagnóstico. **Validado:** revisão estática Root e independente, bytes/hashes dos portes e `git diff --check`. **Pendente:** todos os checks originais do SHA que publicar este delta; os resultados da #85 ou da main e6 não serão herdados.

O CI existente deve executar unidade/contratos nos dois fusos, scripts Node, sintaxe/fixtures SQL descartáveis, tipos, lint, camadas, contraste, Impeccable, build e E2Es, além dos relatórios Auth/Admin/Storage próprios. Os cenários Kanban já produzem capturas sintéticas em 320 px claro e 1440 px escuro, com movimento reduzido, para inspeção conjunta. Essas capturas não comprovam toque em aparelho físico, produção ou foco da recuperação global no DOM.

Nenhum runtime de testes/build foi iniciado na máquina de 8 GiB. Não há mudança em Core, adapters, DTOs, dependências ou SQL neste delta. Main e a nova branch conservam `git.deploymentEnabled=false`.

As migrations020–022 da base continuam sem aplicação e exigem corte coordenado, drenagem de escritores antigos e requisitos de backup/restore antes da promoção. Esta candidatura não resolve esses gates. A projeção pública também não substitui um preparo operacional novo, com SHA/tree, hashes, closure e transporte original revisados; preparos CLOSED continuam encerrados. Nenhum archive, perfil ou chave foi aberto nesta entrega.

As issues #73/#41/#35 continuam abertas até seus próprios critérios. Não inclui Drive, as entregas congeladas #78/#79 ou execução de checkout/onboarding Asaas.
