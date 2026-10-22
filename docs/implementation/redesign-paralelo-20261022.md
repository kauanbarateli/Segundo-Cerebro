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
