# Sessões próprias: conciliação dos cinco aceites — 13/10/2026

Root e dois peers independentes conciliaram os cinco critérios originais da #37. Eles não exigem o encerramento de uma jornada diferente de Admin, SMTP, Google ou backup como condição adicional. A entrega pode ser encerrada após a atualização dos cinco literais e a conferência do estado no GitHub; as falhas globais de Admin/Recovery continuam registradas separadamente.

## Ordenação, limite e datas

A migration 019 ordena a sessão atual primeiro, seguida por criação descendente com nulos ao final e ID para desempate. O probe de 101 linhas devolve até 100 e informa truncamento somente quando existe a linha adicional. As assertivas originais `own-sessions.sql` conferem a sessão atual mesmo com criação nula, nulos preservados, UTC de `refreshed_at` mesmo sob timezone Berlin e diferença entre exatamente 100 e 101 registros. Core e UI conservam o envelope reduzido e a mensagem factual de truncamento.

## Endpoint e mudança de identidade

O GET recusa query, body e URL original não canônica. Cache privado/no-store/no-cache é reaplicado em todos os resultados, inclusive depois de callbacks de refresh. O cliente publica somente `my_sessions()` sem argumentos; dono e SID vêm da identidade verificada e do JWT usado pelo banco. `X-Expected-User-ID` é uma guarda de consistência da página: não seleciona o dono ou altera a RPC. A mudança de dono/SID entre guarda e leitura recusa a projeção. Testes de rota, gateway e SDK instalado com HTTP em memória cobrem essas recusas e o mesmo cookie jar.

## Provas e limites

Root leu SQL, assertivas, Core, gateway, runtime, GET e testes pertinentes. Repetiu **60/60 controles** em cinco arquivos, sem serviços externos. A validação SQL descartável repetida concluiu 19 migrations, contratos de 35 tabelas/uma view/55 RPCs e todas as assertivas, incluindo `own-sessions.sql`; o catálogo local registrou **1.266 checks/zero desvios**. Essa contagem local não substitui os 1.269 checks hospedados/nativos. Nenhuma migration foi reaplicada remotamente.

A [captura nativa própria de Admin em 74907f9](evidence/adminbrowser-native-74907f9-20261013.json) confirmou o estágio `own-sessions-bound`, com duas RPCs e duas visões em Next/browser/GoTrue/PostgreSQL locais. O spec compara o endpoint privado, o corpo concluído e a projeção UI/datas com seu oracle SQL. O caso global falhou posteriormente com três requests pendentes; FIRST não executou e limpeza ficou zero. Nenhum PASS global, cleanup, corrida real ou truncamento de 100 sessões GoTrue é atribuído a esse recorte. Os casos adversariais de truncamento e mudança entre guarda/leitura conservam seu canal offline próprio.

A observação somente de leitura em produção apresentou a lista real de duas sessões e a marca atual. Ela não substitui as provas de isolamento concorrente ou os controles de UI de 320 px/temas. Os resultados históricos e os critérios originais permanecem preservados.

## SQL, tipos oficiais e jornada registrada

O quinto literal também está cumprido: a 019 foi revisada, versionada e aplicada separadamente no projeto pessoal; fonte e cópia SQL Editor são idênticas, 4.115 bytes/SHA-256 `0cab745bbb315ca700921db9addc13e113fb450eb08095fc37ec1e8ada1aae57`, com pin correto no manifest. O [registro da aplicação e catálogo](t013-own-sessions-schema-20261011.md) conserva os canais e resultados próprios.

Os [tipos oficiais locais pós-019](t013-local-types-019-20261011.md) foram gerados pela CLI oficial a partir da cadeia descartável, baixados com vínculo próprio ao run e incorporados em `aa1b526`. O arquivo tem 55 RPCs; `my_sessions` mantém Args sem parâmetros e retorno Json original. O runtime usa o cliente tipado existente e `rpc("my_sessions")`, sem cast/overlay para acrescentar a RPC. O Foundation próprio de `aa1b526` confirmou igualdade AST e banco nativo; a sua falha anterior não foi reclassificada.

O [novo export informado pelo mantenedor após a 019](hosted-types-public-comparison-20261012.md) foi obtido, comparado e revisado. As 41 diferenças/151 ocorrências e `SNAPSHOT_DIFFER` permanecem; o baseline oficial local foi preservado. A procedência/freshness hospedada e a versão do gerador do Dashboard conservam seus limites, sem MATCH ou equivalência inventados. Igualdade entre geradores não é uma condição adicional do literal.

Banco e jornada conectada estão registrados com seus limites: estágio próprio de `74907f9` acima, histórico FIRST de `503f00d` e catálogo/geração próprios. A aprovação deste literal não conclui FIRST, cleanup global, UI entre aparelhos ou release; 001–019 não foram reaplicadas remotamente nesta rodada.

## Isolamento e interface

O primeiro literal está coberto pelas assertivas canônicas repetidas pela raiz: duas contas sintéticas, sendo B master, recebem somente as próprias sessões; claims ausentes/malformados ou trocados, sessão atual expirada/removida, bloqueio e veto de Configurações recusam a leitura. A 019 guarda dono/SID e restringe a seleção a `s.user_id=v_user`. O canal dessas recusas é SQL PGlite descartável, distinto das leituras GoTrue/Next/browser reais e dos catálogos nativos/hospedados. Master não recebe acesso a sessões de terceiros.

O quarto literal tem prova própria de apresentação: Root leu a seção e a matriz completas e repetiu **15/15 cenários Chromium**, na integração Main. Cobrem 320/390/768/1440 px, temas claro/escuro, carregamento, falha, nova tentativa por Enter, foco, Space/Enter nos painéis e movimento reduzido. Os componentes/providers originais usam respostas HTTP artificiais; esse lote não executa Auth, SQL ou sessão pessoal. Os testes de troca de conta/desmontagem/settlement tardio conservam os controles de seção incluídos nos 60 testes focados repetidos; o render oculta o scope anterior antes dos efeitos, e cleanup aborta/ignora a leitura antiga.

A prova nativa histórica de [503f00d](evidence/frente-b-native-503f00d-20261012.json) registrou FIRST com duas RPCs/três visões/uma recarga própria e BLOCK integral com limpeza. FIRST falhou depois com quatro requests pendentes e limpeza zero. As fontes de SQL/Core/API/gateway/runtime permanecem iguais entre 503 e 749; continuidade de código não herda PASS ou contagens para a fonte atual. A #37 é conciliada pelo conjunto de seus cinco literais, sem converter as jornadas globais falhas ou as provas sintéticas em aceite hospedado/aparelhos.

## Fechamento confirmado

Depois da revisão Root/peers, os cinco critérios foram atualizados e o GitHub confirmou `CLOSED/COMPLETED` em **13/10/2026 às 17:20:27 UTC**. O [readback público](evidence/mvp-acceptance-readback-20261013.json) conserva o hash do corpo e a confirmação exata. O fecho dos runners globais continua em #35; o fechamento da #37 não remove requests, autoriza cleanup ou certifica aparelhos.
