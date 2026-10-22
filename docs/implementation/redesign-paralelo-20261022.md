# Integração paralela do redesign — 22/10/2026

Refs #71, #74, #75, #77 e #81. Este registro separa construção, revisão e aceite. Não é autorização para aplicar SQL ou promover um deployment sem os gates operacionais.

## Base confirmada

A [PR #99](https://github.com/kauanbarateli/Segundo-Cerebro/pull/99) foi incorporada à main `0b004ebe7536476dda9a6b6be4c97f2bd0f9fc99`, árvore `8e0078f5c21a1cabcd40660a5349ead787d470ac`, igual à base de autoria `53b8e5e6a7da293f6729c96eaa6f8dc1aea62a7b`. Seus oito originais próprios concluíram success na tentativa 1, incluindo o [CI 39719705361](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39719705361): 2.330 testes por fuso, 1.887 scripts sem falhas/cancelamentos/skip/todo e 338 E2Es. Os sete relatórios nativos foram revisados separadamente, com origem, casos e limpeza. Nenhum resultado é transferido automaticamente ao candidato seguinte.

Após esse aceite, a agenda Google foi restabelecida em `true`, com readback; seus dois arquivos de execução são iguais aos da produção c46 já validada. O primeiro disparo `schedule` ainda exige observação própria. A PR #85 foi encerrada por substituição pela #99, preservando branch/histórico e mantendo a #73 aberta para os aceites funcionais restantes.

## Frentes e limites

| Frente | Construção e revisão estática | Próxima prova necessária |
| --- | --- | --- |
| #74 Calendário | Lista paginada, contexto recente, participantes e preferência Lista; contrato mínimo de cache e SQL aditivo. [Entrega E3](calendar-e3-participants-20261022.md). | União dos testes atuais e novos, tipos oficiais, catálogo, renderização e sincronização conectada no candidato aprovado. |
| #75 Capturar/Conhecimento | Editor compartilhado, criação/edição rica e promoção por identidade com vínculos e imagens privadas; 43 arquivos conferidos e peer de SQL/Core. [Entrega E4](capture-e4-vertical-20261022.md). | QA do ACK, paridade dinâmica Core/SQL, isolamento, rollback, retenção de imagens, editor no navegador e aceites hospedados. |
| #77 Financeiro | Coluna de cartões, entrada rápida com revisão, três recentes e drawer Fatura/Compras/Configurações; metadados opcionais sem débito automático. [Entrega E6](t052-finance-composition-e6-20261022.md). | Testes econômicos preservados, novas negativas SQL, máscara em todas as tabs, tipos oficiais, catálogo e evidência visual do SHA integrado. |
| Root | Contratos compartilhados, reconciliação dos deltas, migrations, artefatos, revisão cruzada, GitHub e leitura dos originais de CI. | Publicar somente o candidato revisado, conferir seus próprios originais e separar integração de Git do corte de banco/produção. |

As autorias usam worktrees e branches independentes. Os pacotes são conferidos por bytes/hashes antes da cópia; arquivos compartilhados são reconciliados por hunk, preservando as outras frentes. A revisão cruzada já encontrou e corrigiu índices possivelmente ausentes nas tabs financeiras e a diferença UTF-16/codepoints nos participantes. Testes escritos, revisão estática e `git diff --check` não são PASS de TypeScript, SQL, navegador ou produção.

## Banco e aplicação

O destino pessoal permanece `rishenjoikgmfubmnfiu`, no catálogo 019 conferido. As candidatas 020–022 continuam sem aplicação. Os IDs seguintes foram reservados por Root em UTC, sem executar CLI/runtime local:

| Ordem | Arquivo reservado | Estado de aplicação |
| --- | --- | --- |
| 023 | `20261022042432_spec08_calendar_participants.sql` | Não aplicado; contrato e asserções preparados. |
| 024 | `20261022042500_spec08_finance_card_metadata.sql` | Não aplicado; contrato e asserções preparados. |
| 025 | `20261022042501_spec08_capture_knowledge_promotion.sql` | Contrato e asserções preparados após peer E4; não aplicado. |

Os drafts em `docs/implementation/drafts/` têm recusa explícita antes de DDL. A promoção para uma migration canônica é uma alteração de fonte revisada, não uma execução. As asserções ficam separadas e terminam em rollback; o loader descartável deve aplicar a cadeia numerada uma única vez. Não reaplicar 001–019, reescrever migrations históricas, inserir ledger artificial, executar reset/seeds ou aplicar schema por CI/build/deploy.

A preparação auxiliar no GitHub poderá gerar cópias SQL e metadados públicos de fonte/catálogo na fixture vazia. Esse artefato é candidato, não aceite; não contém corpos SQL privados, conteúdo de usuários, credenciais, perfis ou archives. Tipos oficiais exigem exportação real do CLI no PostgreSQL descartável e comparação independente. Não fabricar o snapshot nem remover controles para obter verde.

## Execução na máquina de 8 GiB

Nenhum Node, npm, compilador, teste, build, navegador, Docker ou PostgreSQL local é iniciado nesta rodada. Git, leitura/edição de arquivos e conferência nativa de bytes/hashes são permitidos. Os três agentes trabalham em código/documentação; a execução pesada ocorre no Actions. A publicação de uma fonte só é seguida por outra depois que seus originais terminarem; falhas não são canceladas, repetidas ou apagadas.

O candidato usa `codex/redesign-parallel-20261022`, sobre a main aceita. O `vercel.json` mantém o deployment automático dessa branch e da main desligado. Os workflows de aceite permanecem obrigatórios; a preparação auxiliar não substitui nenhum deles.

## Corte e pendências externas

A produção continua na fonte `c46acea0c2cc81f82c083e2ae67a3c6480a2df1e`. O novo lote não será implantado contra o catálogo 019. Antes da ativação: compatibilidade de clientes antigos/journal/PWA, tipos e catálogo da cadeia nova, backup e restore qualificados, janela atual sem escritas e aplicação supervisionada em ordem. A021 recusa escritores antigos; c46 não é rollback seguro depois dessa etapa. Bloquear deployments ou Cron não é cerca global contra SQL, JWTs, uploads já autorizados ou processos em voo.

Participantes, documentos e metadados de cartão têm retenção própria; a [atualização do inventário](inventario-retencao-transferencias-20261018.md) deve refletir o comportamento efetivo do candidato, sem prometer TTL ou limpeza não demonstrados. Links de imagem já emitidos conservam seu TTL; revogar acesso impede novas emissões, sem revogação retroativa presumida.

O restore continua com suas próprias pendências nas #41/#42. Uma frente adicional preparou a qualificação de recibos ricos no validador pós-restore: criação deve corresponder à intenção documental e revisão 1; edições mantêm o contexto histórico, sem comparar recibos antigos com a linha atual. A preparação não executa restore nem concede aceite operacional. O aceite visual/humano da #44 e a persistência hospedada permanecem separados. Drive fica fora; #78/#79 continuam congeladas, #36 é manutenção após o MVP e cobrança Asaas/onboarding continuam somente planejamento. Nenhuma issue funcional é encerrada apenas por merge ou CI de outra fonte.

## Prova visual e carregamento do editor

A VFS histórica continua usando os blobs B/P fixados e recusando imports desconhecidos ou dinâmicos. Somente C e o caminho neutro do editor podem importar as bibliotecas Tiptap já pinadas. O runner confere os quatro pacotes 3.31.4, registry/integridade e instalação; não existe fallback para código atual nas árvores históricas. A fixture C é conectada: sua expectativa mede o textbox real e uma âncora adicional, conservando a medição da textarea em B/P. As diferenças brutas continuam no relatório; esse ajuste não aprova o layout visual novo.

Na página Capturar, a importação estática do componente de cliente mantém a inicialização do editor após a hidratação com immediatelyRender:false, conforme a [orientação oficial Tiptap para Next.js](https://tiptap.dev/docs/editor/getting-started/install/nextjs). Não foi executado navegador ou build local; o candidato ainda exige os próprios resultados de CI.

## Primeira publicação de preparação

As três autorias e os deltas compartilhados tiveram revisão independente. O ACK de edição rica foi reforçado para conferir os vínculos derivados antes de liquidar o journal, mantendo os IDs históricos quando a intenção não fornece uma lista. A qualificação visual de C fixa o novo CSS de Capturar e recusa o anterior, sem alterar os hashes de B/P, cores ou tokens.

A primeira PR será rascunho de integração. As migrations canônicas já estão na fonte, mas os artefatos do SQL Editor, o snapshot oficial de tipos, os hashes de catálogo e as contagens das closures ainda precisam da preparação real no Actions e da reconciliação revisada. Esses controles continuam estritos; falhas de preparação não são contornadas com casts, contagens presumidas, alterações de teste para ocultar defeitos ou reruns. Nenhum merge/deploy ou aplicação remota acompanha essa publicação inicial.

### Resultado original de e368

A [PR #100](https://github.com/kauanbarateli/Segundo-Cerebro/pull/100) publicou o SHA `e3681ce7efe42082f59325c2e5bf084c44706927`. Seus 18 originais concluíram na tentativa 1: 17 falhas e uma qualificação sintética Chromium bem-sucedida. Isso não certifica o redesign. O CI recusou o SQL Editor antigo; a preparação auxiliar recusou a aplicação sintética da 025 por uma contagem incorreta de operandos no guard. As recusas dos inventários e do novo RPC sem tipo oficial continuam visíveis.

Os diagnósticos independentes também encontraram o select fora do Field, fixtures financeiras readonly e uma fixture negativa que invalidava lançamentos anteriores antes de chegar ao comando. Foram preparados ajustes estreitos sem mudar regras econômicas. A criação de Captura voltou a garantir rejeição via Promise, conservando os cinco negativos, zero escrita e reutilização do client_id depois da recusa. O ACK mantém replays antigos sem lista opcional quando não há referência tipada. As correções são novas fontes a validar, não reruns dos originais falhos.

Os logs originais e a prova de término foram guardados localmente com hash. O inventário dos 18 runs tem SHA-256 `b867ad4083881265f241f91cb0e9e34e026393398482beac67cd4557c7cae4dd`; o [auxiliar original 39725923452](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39725923452) tem log de 1.168.435 bytes, SHA-256 `40261f7a091a74c1b95c2756d7337f538127ef98ed3939e2a31a1eb58669c92b`. Nenhuma falha foi cancelada ou repetida para substituir evidência.

### Preparação independente dos tipos oficiais

Um workflow adicional de preparação, restrito à branch candidata e opt-in, usa o CLI 2.120.0 em runner separado. Os 25 arquivos canônicos são comparados com seus pins e com os blobs do próprio SHA antes de copiar; o stack começa com diretório de migrations e ledger vazios, sem seed/usuário de teste, e deve comprovar PostgreSQL 17, namespace/contêineres próprios, ledger 25 e segunda aplicação sem mudanças. Isso não altera os gates dos workflows originais.

`gen types --local --lang typescript --schema public` fornece os bytes oficiais. A saída exige UTF-8/EOF/limite e inspeção de AST; divergência do snapshot permanece um candidato `SNAPSHOT_DIFFER`, sem aceite de release, hospedagem ou catálogo. Somente após término dos processos, remoção confirmada do namespace e limpeza do diretório temporário podem sair `types.ts` e `metadata.json`, com SHA/hashes e `acceptance:false`. Root deve conferir esses artefatos antes de atualizar o snapshot e executar os gates originais no novo SHA. Os 19 controles preparados dessa frente não foram executados localmente.

### Resultado original de 113545f e reconciliação

Os 19 originais de `113545f2cd44573a99cb822d5489bfa1647c0e0a` terminaram na tentativa 1: 17 falhas e dois sucessos, incluindo a preparação oficial de tipos. A prova de término tem SHA-256 `f40dadc6637899cfa22b6b7ebd68c6a80a7395d74dac1c6fbdc62e9344d41e08`. Nenhum run foi repetido ou cancelado. Lint e scanner de segredos passaram no diagnóstico auxiliar; cada fuso teve 2.438 testes aprovados e uma falha no inventário visual ainda fixado em 22 migrations. Esses resultados não são aprovação completa da PR.

A preparação real produziu as 25 cópias do SQL Editor, conservando exatamente as primeiras 22. Seu artifact `12403074275` tem SHA-256 `b352d8246f42f20137e2ca600549153b01c1dba1557979f3fcffe691695ffe64`. O catálogo anterior observou 1.485 controles e nove desvios: sete corpos de funções alterados pela 025 e dois registros da allowlist do novo RPC. A reconciliação acrescenta contratos explícitos de funções e estruturas; por isso 1.485 não é apresentado como total da nova versão. As contagens estritas anteriores permanecem até observação própria, inclusive no PostgreSQL nativo.

As closures reais desse SHA contêm 65 fontes no Admin nativo, 428 no Admin de navegador, 232 na recuperação, 267 no controle legado de arquivos, 47 em Foundation e 62 em avatar. Esses inventários orientam a correção de limites e fixtures, sem ampliar dependências ou dispensar limpeza e vínculo ao SHA. A presença do controle legado não reintroduz Drive no MVP.

Os [tipos oficiais da cadeia 025](types-public-025-20261022.md) foram conferidos e importados, com o export bruto preservado. As duas asserções antigas de Captura foram reconciliadas: título e documento podem mudar juntos somente com a próxima revisão; identidade, lifecycle, cache e limites continuam negativos. O novo positivo exercita RPC e replay dentro de uma subtransação revertida, preservando os totais anteriores.

O próximo candidato precisa dos seus próprios originais. Não foram executados Node, SQL ou navegador no notebook, nem migrations ou testes de domínio no projeto hospedado. A produção, o restore e os aceites humanos continuam com os limites acima.

### Observações próprias de 630ac2c

A fonte `630ac2c6a2373e510e803c811a18274683aa7a94` foi publicada depois das revisões independentes. O [auxiliar original 39730337185](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39730337185) produziu o artifact `12404134510`, ZIP de 172.062 bytes, SHA-256 `c7d5262d3d1a735f17d572d3ad3c8be11560b2750bffbf7515c89628106fec33`. A fixture PGlite observou 1.531 verificações, `ok:true` e zero desvios. Isso é diferente da [observação nativa Foundation 39730336916](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39730336916): PostgreSQL 17 observou 1.534 verificações, também sem desvios. O log nativo de 49.486 bytes tem SHA-256 `97d30e73a0fa6ed405d02a4e6b302744158273e1c18edefdbea51b28ea274a17`.

O veto antigo de 1.428 permaneceu ativo e recusou Foundation; o relatório aceito não foi promovido a 1.534 automaticamente. Ele confirmou 25 migrations, segunda aplicação sem mudanças, 47 fontes, duas dependências, nenhum processo pendente, resultado de escrita conhecido e as quatro condições de limpeza. A reconciliação seguinte fixa separadamente 1.531 nos testes PGlite e 1.534 nos consumidores nativos, com negativos do total antigo, mantendo todos os demais vetos.

O CI principal recusou o manifesto SQL Editor porque três SQLs de validação foram alterados depois da exportação anterior. O novo manifesto foi gerado no runner, conferido e importado: 17.659 bytes, SHA-256 `301d0a19ddd6650c0fb27e5f856c48049db4a82484c6d8b71d61327ec1208afc`. Mudaram somente bytes/hashes de `capture-document-behavior.sql`, `capture-document-event-capacity.sql` e `release-catalog.sql`; todas as instalações 001–025 e o README são idênticos. Não houve geração local, DDL hospedado ou troca de migrations para contornar a recusa.

Em paralelo foi preparado um teste adicional da interface real de Capturar: perder a resposta após o commit canônico, recarregar o rascunho e journal, repetir o mesmo corpo/client_id e confirmar em duas abas do mesmo contexto, sem duplicar captura, evento, recibo ou commit. O teste conserva os seams HTTP/Auth declarados e não certifica Next, GoTrue, Storage ou produção. A execução desse novo caso e o aceite completo do próximo SHA permanecem pendentes.

Os 19 originais de 630 terminaram na tentativa 1, com quatro sucessos e 15 falhas; a prova de término tem SHA-256 `a5ac67492ca019023b51649c2ef636cecd3fb922d486d4cbb801281c7722fdff`. Os [originais Auth de push](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39730336894) e [PR](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39730339708) passaram logout global, isolamento pela Data API, eventos append-only, persistência de Captura/Tarefa e troca de senha, incluindo limpeza de casos, processos e stack. O checkout do push foi 630; o da PR foi o merge sintético `525198e052816f77ff375dd4a3d028544824e85d`. Esse aceite é próprio desses casos e não é transferido à próxima fonte.

No auxiliar, SQL focal passou 11/11; tipagem, lint, segredos, camadas, design e 2.439 unidades nos 147 arquivos em cada fuso passaram. Scripts tiveram 1.900 aprovações e 11 falhas, sem cancelamentos ou skips. O log original de 916.762 bytes tem SHA-256 `d5cd6f2731e8d73c30fa16b1adc2c624a1673eb5e6e7ee9037f0d189fbb7627b`. Cinco falhas usavam a contagem antiga; outra revelou que o rótulo `spec08_function` não respeitava o contrato alfabético do relatório. Ele foi renomeado para `spec_evolution_function`, sem ampliar o validador ou mudar os contratos conferidos. O manifesto importado foi depois ajustado somente no hash/bytes desse SQL canônico: versão derivada por conferência PowerShell, SHA-256 `89cfc498a1885e8005029eb38de83e6dfbc22a2388440e5e3b80960ebea8fb68`. Esse hash não é o artifact bruto do runner; a igualdade com o gerador permanece exigida pelo CI.

As cinco falhas operacionais restantes expuseram um `CASE` sem parênteses na expressão `IF` do verificador pós-restore. O [parser PL/pgSQL do PostgreSQL 17](https://github.com/postgres/postgres/blob/REL_17_STABLE/src/pl/plpgsql/src/pl_gram.y) lê até `THEN` fora de parênteses, cortando essa expressão antes de sua conclusão. O ajuste acrescenta apenas os dois parênteses, preservando comparação, revisão histórica e SQLSTATE de recusa. O controle preparado remove esse agrupamento dentro de savepoint, exige erro sintático 42601, desfaz a tentativa e exige sucesso do SQL original; os negativos de integridade continuam esperando 23514. Nenhum restore real foi executado por essa correção.

### Resultado próprio de 1974865

Os 19 originais de `1974865c4a745eeb6a3d12e5078cfa176cb04dcb` terminaram na tentativa 1: 15 sucessos e quatro falhas, exclusivamente CI e Captura Storage nos eventos push/PR. A prova de término tem SHA-256 `0e1cd458527613587e399541057e032963a433ebccf0f9041418589f35647507`. Nenhuma execução foi cancelada ou repetida.

O [auxiliar original 39732047652](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39732047652) passou SQL focal, tipos, lint, segredos, unidades nos dois fusos, camadas, design e os 1.911 testes de scripts sem falhas, cancelamentos, skips ou todo. Seus 2.439 testes por fuso e 164 pares de contraste passaram; o log de 901.520 bytes tem SHA-256 `28754b9ba97da2d7d68f74e1044fe2207b474de934ce04d01977f6c4ecdac848`. Isso inclui os controles sintáticos e de integridade do verificador de restore, sem executar restore real.

Foundation comprovou os próprios 47 arquivos, ledger25 sem reaplicação, catálogo1.534, tipos iguais e seis concorrentes com cinco decisões permitidas/uma negada; limpeza e resultado conhecido confirmados. Recovery conferiu os 232 arquivos, os casos de recuperação e limpeza; avatar conferiu os 62 arquivos, objetos e usuários descartáveis removidos. Esses relatórios são do runner descartável, não do projeto hospedado. Os dois originais Admin também terminaram success, com revisão individual dos relatórios preservada separadamente.

O CI verificou corretamente o pacote SQL Editor25/44 e depois recusou uma asserção antiga de Calendário que exigia definer de todo helper. A reconciliação mantém a função pura de participantes por OID exato, exige sua presença/autoridade e conserva definer nos demais helpers. A revisão encontrou também a classificação do RPC de leitura de imagens do Conhecimento: só as duas assinaturas de quatro UUIDs recebem o tratamento de endpoint de serviço; anon/auth e helpers continuam fechados. Os dois registros de integridade do manifesto acompanham esses SQLs, derivados por conferência de bytes/hash e ainda sujeitos ao gerador no CI.

Captura Storage terminou como `REPORT_REFUSED`, sem relatório que permita certificar caso ou limpeza. O inicializador ainda declarava 22 migrations enquanto o executor e o contrato exigiam25; foi preparado o ajuste desse valor factual, mantendo os vetos. A próxima execução deve expor o resultado real, sem presumir que a correção já aprovou o caso. Foi acrescentado ao auxiliar um diagnóstico econômico independente dos cartões com o script SQL original e fixture descartável, pois o CI principal parava antes dessas asserções. Ele não altera nem substitui os oito workflows originais, seus limites ou aceites.
