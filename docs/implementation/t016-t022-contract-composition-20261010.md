# T-016/T-022 — composição de preferências, uso e escopo de client_id

Entrega de 10/10/2026 do SHA `854d905e3551c6a0cab5e47a0cb42be4986bf97c`, com revisão independente. A [Foundation própria 38063121938](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/38063121938) concluiu com success: **1.559 testes em cada fuso, 350 scripts + dois controles separados de scanner, 188 E2E, 17 migrations/35 arquivos de asserções e catálogo 1.243**. São 187 E2E demo + um de composição com HTTP sintético, sem flaky/falhas.

O [Auth próprio 38063121943](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/38063121943), do mesmo SHA, concluiu com success. O report fechado schema4 aprovou os três casos, os componentes de identidade/RLS/eventos/Capturas-Tarefas, ausência das fixtures de domínio e limpezas. A [evidência integrada](evidence/contract-composition-ci-passed-20261010.json) conserva as duas origens próprias. Essa captura não herda o PASS anterior de `df601ff` e não comprova produção.

## Preferência da conta → Início (#23)

O [E2E de preferências](../../tests/e2e/home-account-preferences.spec.ts) lê um `AccountSettings` sintético válido, aplica `settingsPreferences` e monta os providers reais de acesso/aplicação, `HomeView`, `SettingsConnectedWorkspace` e o adapter conectado. Não substitui hooks ou providers centrais. As [fixtures de composição](../../tests/e2e/fixtures/home-preferences-browser.tsx) e [roteamento](../../tests/e2e/fixtures/home-preferences-navigation.tsx) substituem somente a fronteira Next de navegação/CSS; HTTP e identidade são sintéticos.

O spy exige zero GETs de Tarefas na ocultação inicial e no refresh. Salvar módulos na tela real reativa a preferência; uma Tarefa não vazia deve aparecer e o refresh consultar novamente. Ocultar após o cache e reiniciar a composição deve conservar a ausência de consultas. `allowed=true` permanece em todas essas etapas: preferência não revoga Entitlement.

Checks locais próprios: TypeScript global e lint focal aprovados; Playwright descobriu um teste; bundle real gerou um chunk de 817.988 bytes. A revisão corrigiu o status da fixture para `in_progress` e os checks foram repetidos. Nenhum servidor ou navegador Windows foi iniciado. O novo E2E passou na execução Linux própria acima.

## SQL de uso → DTO → Drive/ARIA (#29)

O [teste composto do Drive](../../tests/adapters/storage-usage-composition.test.tsx) aplica as migrations canônicas em PGlite descartável e executa `drive_snapshot`. O SDK/runtime/store, GET, cliente, `ConnectedDriveWorkspace` e `ProgressBar` reais transportam a soma até o markup. O oráculo independente é **15.360 bytes**: Drive ativo 1 KiB + lixeira 2 KiB + imagem de Captura 4 KiB + avatar 8 KiB; arquivo estrangeiro 32 KiB e purgado 64 KiB são excluídos.

Exige o mesmo total no snapshot/DTO, texto “15 KB de 64 KB”, ARIA min/max/now/text e proporção 0,234375, tanto na vista ativa quanto na lixeira. Metadados privados de imagem/avatar e dados estrangeiros/purgados não podem sair no DTO ou markup. Uma execução focal independente em 10/10 às 12:21:43 Fortaleza aprovou **um teste/um arquivo**, sem falhas/skips, por `vitest run tests/adapters/storage-usage-composition.test.tsx --reporter verbose`.

Auth/HTTP são seams explícitas. O estado do componente pai é preparado por helper de hooks; seus efeitos não são executados e os filhos usam React SSR real. A prova não representa navegador montado, upload, bytes no Storage, purge confirmado, PostgREST hospedado ou autenticação real.

## Colisão e escopo de client_id (#22)

O novo bloco de [capture-task-behavior.sql](../../supabase/tests/capture-task-behavior.sql), após `SET CONSTRAINTS ALL IMMEDIATE`, usa somente os dois donos e helpers existentes. Acrescenta oito asserções e três recusas obrigatórias `23505`: duplicação de Captura/Tarefa no mesmo dono/tabela e duplicação da tríade de recibo. Preserva cardinalidade/revisão nas recusas; permite o mesmo valor entre tabelas, entre donos e entre comandos de recibo. Quatro registros e três tríades exatas são conferidos.

O runner dedicado `node scripts/test-local-sql.mjs supabase/tests/capture-task-behavior.sql` passou: 17 migrations locais, contratos 35 tabelas/1 view/54 RPCs/326 colunas/194 Args, arquivo aprovado e zero usuários após rollback. As asserções anteriores, exclusões exatas e `ROLLBACK` foram preservados. Inserts de owner são probes das constraints reais em PGlite; não são escritas legítimas de produto com eventos.

Essa prova complementa o replay nativo separado do Auth próprio acima; o [relatório de persistência](t015-capture-task-persistence-local-ci.md) conserva as fontes e os limites dos replays. Não inventa unicidade global de client_id, não certifica todos os comandos/eventos, concorrência ou banco hospedado. Nenhuma migration nova foi criada, nem SQL remoto executado. A 017 manual/export e os demais aceites do [guia de pendências](pendencias-atuais-20261010.md) conservam seu estado próprio.
