# Imagens, Calendário e Hábitos — aceite técnico 3403 — 25/10/2026

As issues [#72](https://github.com/kauanbarateli/Segundo-Cerebro/issues/72#issuecomment-6405420279), [#74](https://github.com/kauanbarateli/Segundo-Cerebro/issues/74#issuecomment-6405420747) e [#76](https://github.com/kauanbarateli/Segundo-Cerebro/issues/76#issuecomment-6405421199) foram encerradas tecnicamente, com quatro critérios próprios cada. Os épicos #7/#71 e a integração #81 continuam abertos; esses fechamentos não são aceite de produção.

A Source executada é `3403a5aa1901c166e6cfc1206848bfdc1c34957a`, árvore `7fdeb63d76d30058c260ba1579e55f94c6f1c2ca`. O commit documental f39 não altera produto, scripts, testes, migrations, workflows ou manifests dessa Source. A coorte Root passou 22/22 runs e 24/24 jobs.

A correspondência semântica abaixo usa o original Fundação push run40234742944/job121293777449: checkout 3403 na linha 192, 1.252.055 bytes, SHA256 `20c7b19882bc53ea7d1c2476c496aadcbe9c42e0d68b1e4531a27e8ac4e2ca56`. Foram conferidos 41 arquivos/grupos PASS: 38 por path completo delimitado e três títulos SQL TAP exatos e únicos. A [projeção pública](evidence/images-calendar-habits-technical-acceptance-3403-20261025.json) conserva os 12 critérios, as linhas e os 62 blobs selecionados; não alega inventário de closure completo. [Prova geral da Fundação](evidence/foundation3403-technical-qualification-20261025.json).

| Critério encerrado | Comportamento verificado e fontes principais |
| --- | --- |
| 72.1 — ciclo da imagem e fallback | Upload, troca, remoção, cancelamento, reload, imagem anterior até o commit e retry da mesma intenção: `entity-images.test.ts`, `entity-image-attempt.test.ts`, `spec08-image-retry.spec.ts` e grupo SQL de imagens. O fallback de miniatura é vinculado também à leitura de `private-image.tsx`. |
| 72.2 — dono, sessão e processamento | Rotas e finalização vinculadas ao dono/finalidade, staging, troca de sessão e vetos; MIME/bytes, pixels e EXIF/orientação: `files-route.test.ts`, `files-runtime.test.ts`, `files-processor.test.ts` e os dois grupos SQL de imagens/observação. |
| 72.3 — Início e Projetos | Mesmo avatar no topo/rodapé, cover persistida, três projetos ordenados e progresso real; exclusão/restauração preserva contextos: `home-projections.test.ts`, `home.spec.ts`, `issue30-projects-sql.spec.ts` e componentes originais. |
| 72.4 — responsividade, foco e foto | Topo a 320/390 px, alvos de 44 px, teclado, temas e falhas independentes: `navigation.spec.ts`, `theme.spec.ts`, `home.spec.ts` e rotas. O limite de contraste sobre foto decorre do cálculo CSS explicado abaixo. |
| 74.1 — lista e datas | Casos 0/1/5/6+, paginação/reset por data ou fonte, andamento sem duplicação, all-day exclusivo, meia-noite, mês, DST e fuso: `calendar-list.test.tsx`, `calendar-projections.test.ts`, `calendar-layout.spec.ts` e `calendar-workspace-browser.spec.ts`. |
| 74.2 — convidados | Ausentes, desconhecidos, omitidos, Unicode/nomes longos, mais de quatro e salas; iniciais/+N sem foto fictícia: `calendar-participants.test.ts`, `calendar-participants-sql.test.ts`, lista e browser. |
| 74.3 — notas, fontes e cache | Resync/cancelamento preserva nota/link; fontes ocultas não entram nas projeções e cache parcial não vira vazio confirmado: SQL de participantes, `calendar-connected.test.tsx`, projeções e browser. |
| 74.4 — Google e preferência de lista | Scopes somente leitura, sem escrita de evento/People/busca de foto por email; RPC e decoder persistem `default_calendar_view=list`; teclado/temas/viewports: `calendar-security-provider.test.ts`, `calendar-oauth-sql.test.ts`, SQL de participantes e browser. |
| 76.1 — cadência e histórico | Vigência histórica, marca desfeita e A→B→A no mesmo dia sem injeção de história: `habit-frequency-history.test.ts`, `habit-frequency-state.test.ts`, grupo SQL de frequência e `issue30-habits-sql.spec.ts`. |
| 76.2 — métricas | Práticas/oportunidades por vigência e período, semana/mês parcial, pausas, fuso/início/zero e preservação do histórico, sem média de percentuais ou mistura de unidades: `habit-performance-history.test.ts`, `habits.test.ts`, histórico, projeções e SQL/browser. |
| 76.3 — recusas e atomicidade | Futuro/pré-início/dia fora da cadência, replay/concorrência sem evento extra, outro dono, estado divergente e rollback do ledger: `habit-commands.test.ts`, `habit-frequency-state.test.ts`, `projects-habits-store.test.ts` e SQL de frequência. |
| 76.4 — imagem e UI de Hábitos | Mesmo image_file_id no módulo/Início; swap/remove/reload, filtro, arquivo/restauração, pausa e 230 dias de história; temas, 320–1440 px e teclado: grupo SQL de imagens, retry browser, `issue30-habits-sql.spec.ts`, `habit-connected-history.test.ts` e componentes originais. |

Os nomes curtos da tabela servem à leitura; o JSON usa paths completos e blobs da Source. SQL canônico descartável/PGlite com identidades sintéticas e E2E com seus seams declarados são os canais das respectivas provas. O aceite técnico não exige repetir manualmente cada permutação coberta por essas suites. Isso não se apresenta como teste de dois usuários hospedados, aparelho físico, restore ou matriz global de #44.

## Contraste sobre foto: inferência do CSS, não medição de pixels

Em `src/components/features/inicio/home.css`, o modo `.has-focus-image` força texto `#f6f5f1` nos dois temas e põe um véu uniforme `#161613` a 70% sobre toda a foto. A imagem está em z -2, o véu inset 0 em z -1 e o texto acima, dentro de um contexto isolado com recorte. Os tokens são de `design-system/tokens/tokens.css`; os controles Card inverse conservam seus pares opacos de hover/foco. Capas de Projeto e Avatar não recebem texto solto sobre a foto.

Para qualquer canal sRGB da foto entre 0 e 255, a composição é C = 0,7 × véu + 0,3 × pixel. O branco produz RGB 91,9/91,9/89,8 e o preto 15,4/15,4/13,3. Aplicando a linearização e luminância WCAG, a monotonicidade torna o branco o pior pixel para esse texto claro: 6,1532:1. Arredondando conservadoramente o fundo para 92/92/90, o limite é **6,1431:1 (≥ 6,14:1)**, acima de 4,5:1. No extremo preto é 17,5385:1; o par opaco inverse é 16,6192:1.

O cálculo depende de CSS/tokens 3403 sem override, suporte a `color-mix(in srgb,...)` e composição alfa sRGB normal, cobertura uniforme do véu e todo texto visível herdando ou forçando as tintas examinadas. Os blocos auxiliares com outras tintas estão ocultos. Não é amostragem de screenshot, medição do DOM, auditoria de todo estado arbitrário ou aceite físico.

## Escopo e rastreio

D-077 e a autorização de 23/10 incluem MVP operacional, redesign, onboarding de nove telas e landing; excluem checkout/cobrança Asaas e Drive. Esse recorte já foi publicado em #71/#80/#81, preservando os corpos históricos e o rastreio comercial na SPEC-07 #50. #54/#68 não são bloqueios automáticos do MVP. Os contratos de onboarding #62–65 e as regras de Auth, isolamento, Entitlements e veto permanecem incluídos.

A prova original foi preservada: parecer SHA256 `7d8732dd932085c46d546cf316c1b0b7b2947888e06fbe96f3d241ed85ca8fb9` e matriz `554cc591e589d65c0451d6ad166ff6f5f38bf135bbdf6f4f90c3004dff3166bf`. Esta publicação documental registra fechamentos já efetuados pelo Root; não cria novo ensaio ou gate. Restore #35/#42, onboarding conectado, aceites humanos e corte mantêm seus critérios pendentes. Merge e deploy de produção continuam bloqueados.
