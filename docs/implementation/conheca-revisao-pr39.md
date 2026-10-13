# Revisão da apresentação pública — PR #39

Esta revisão mantém o layout apresentado pelo agente, conforme a orientação do mantenedor. A [PR #39](https://github.com/kauanbarateli/Segundo-Cerebro/pull/39) foi examinada no HEAD `021541ea937b3fbeab3bcdbf803dfa6a22383afd`, contra a base `3e8633655b598a696af9b4edaf0b5dd096f89e79`. Os resultados abaixo pertencem ao delta local de sete arquivos identificado pelos hashes da [evidência fechada](evidence/conheca-revisao-pr39-20261013.json); não representam uma publicação desse delta.

## Correções e limites

- O [cabeçalho](../../src/components/features/conheca/landing-header.tsx) agora coloca o botão móvel antes do painel no DOM. Tab entra em “Perguntas” depois de abrir por Enter, e Escape devolve o foco ao botão. A ordem CSS conserva a disposição visual.
- As três variantes de [ProductShot](../../src/components/features/conheca/product-shot.tsx) permanecem no servidor, com as mesmas capturas, proporções e fontes responsivas. Todas saem como lazy/auto. O novo [componente de prioridade](../../src/components/features/conheca/hero-image-priority.tsx) recebe os pictures como children Server e, após hidratar, aplica eager/high somente à variante visível segundo o tema resolvido no documento, inclusive quando a preferência persistida difere do sistema.
- A prioridade alta começa na hidratação; não há preload de uma variante oculta. Sem JavaScript, o quadro sistema continua usando o media query e carregamento lazy.
- O [texto publicado](../../src/components/features/conheca/content.ts) limita a busca aos conteúdos enumerados e a garantia administrativa ao painel. A cifra no cliente é uma propriedade do Cofre, sem promessa de impossibilidade de acesso operacional ao PostgreSQL para os outros conteúdos.
- A [documentação da página](conheca-apresentacao.md) esclarece que o middleware não executa refresh de sessão em `/conheca`; o layout raiz conserva sua leitura opcional da apresentação da conta.

Capturas, geometria, tipografia, espaçamento, tokens e coreografia foram preservados por este delta. Os CTAs continuam locais, sem formulário, gateway de pagamento ou condição comercial. A rota mantém a CSP e os headers de segurança do middleware, com `noindex, nofollow`.

## Verificação fechada pela Root

O teste de teclado foi corrigido para verificar o foco real e apresentou RED. O caso de prioridade também apresentou RED: a imagem visível permanecia lazy/auto. Após as correções, a Root registrou **26 testes aprovados: 15 da apresentação e 11 guards selecionados**. Os 15 incluem o fallback sem JavaScript. Quatro testes unitários, layers, scanner de segredos, build e verificação de Auth no cliente também passaram. A conferência do design system registrou 164 pares de contraste.

Na inspeção de UI em desktop de 1440px e celular de 390px, a Root confirmou o layout preservado, Enter seguido de Tab chegando a “Perguntas”, o hero escuro visível eager/high e as variantes ocultas lazy/auto. As duas inspeções de UI e três rasters representativos não constituem inspeção de todos os pixels das 31 imagens. Os **31 rasters têm bytes idênticos ao HEAD examinado**; nenhuma imagem conceitual nova foi produzida para estas correções. A revisão independente do agente confirmou fontes, hashes e preservação dos assets, sem executar browser ou build.

O contexto e o detector do engine Impeccable não concluíram no ambiente da Root: a execução reportada saiu com código 127 por permissão no cache. Foram usados o contexto e as referências locais, revisão manual e peer independente. Este registro **não declara aprovação do detector**.

## CI e publicação

O CI geral do HEAD original `021541e` falhou no preflight com `VISUAL_STABLE_SOURCE_CHANGED`, associado às novas entradas de `tokens.json` e `DESIGN.md`. Esse resultado não é uma falha dos testes visuais e continua registrado como falha de CI. A revisão do portão está em uma frente separada; esta evidência não antecipa sua aprovação.

Não há declaração de CI integralmente verde, merge ou validação em produção. Aparelhos físicos iOS e Android não foram verificados nesta revisão. A indexação e a integração comercial continuam com os limites descritos na [apresentação pública](conheca-apresentacao.md).

## Qualificação local do guard de CI

A Root revisou a extensão estrita do [helper visual](../../tests/e2e/helpers/issue22-visual-port.ts) e seus [controles](../../tests/adapters/visual-ref-css-order.test.ts). Os seis pins históricos de B/P permanecem inalterados. Somente C admite os dois hashes exatos aprovados de `tokens.json` e `DESIGN.md`. Antes de interpretar o JSON, o helper autentica os bytes históricos dos tokens em B pelo SHA-256 `9e75b6a70d442a0e78199c10cddac0e3b2e7bb9535766a479f9b2b3e6f516ded`; a projeção remove apenas `meta.classification.persuasion`, `typography.scale.vitrine` e `typography.scale.chamada`, com os valores exatos aprovados, e exige igualdade integral com esse baseline. O caller calcula o hash do blob Git real, e o manifest conserva os arquivos e digests reais usados.

Os 18 controles anteriores e seis novos totalizam 24 testes do guard. A Root registrou **28 testes Vitest aprovados: 24 do guard e quatro de conteúdo**, typecheck com saída 0 e lint dos dois arquivos do guard com saída 0. A primeira tentativa de Vitest foi recusada por `EPERM` no cache, sem executar testes; uma repetição local escalada autorizada aprovou os 28. Não houve rejeição de revisão automática nessa repetição. A revisão independente do guard ainda está pendente neste registro. Essa qualificação local não altera a falha histórica do CI no HEAD original nem declara CI verde, merge ou produção.
