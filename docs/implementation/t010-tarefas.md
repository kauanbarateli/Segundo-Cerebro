# T-010 — Tarefas na sessão demonstrativa

## Entrega e origem

`/tarefas` consome o universo único de `src/lib/demo/demo-provider.tsx`, dentro do filho permitido de `WorkspacePage`. Os componentes da feature não criam adapter, seed ou relógio próprio. A query só monta após a guarda de acesso; o provider mantém sua própria guarda adicional. Navegar entre módulos preserva a instância compartilhada da sessão.

A estrutura segue doc 13 T-010, doc 05 §§2–3 e a autoridade visual D-030/doc 14. O brief com proveniência está em `.impeccable/surfaces/tarefas.md`. As categorias e os projetos vêm da consulta; a tela não contém nomes fixos de categorias, IDs ou datas das fixtures.

## Comportamento implementado

- DataTable e cartões mobile consomem o mesmo recorte e o mesmo pipeline de busca sem acento, ordenação e paginação de T-006. Filtros distinguem abertas, concluídas, arquivadas e lixeira, além de categoria e prazo.
- Editor em Drawer, tela cheia no mobile, com todos os 12 campos editáveis de `CamposTarefa`: título, descrição, categoria, projeto, estado, prioridade, prazo, início, término, dia inteiro, estimativa e posição. O 13º atributo funcional, `source=manual`, aparece como proveniência somente leitura; não é um seletor fictício. Origem de captura é um link para o registro original.
- Datas entram por `instanteDe` e voltam por `paraCampoLocal`, no fuso único do app. Dia e hora ficam em estados separados nos três campos; alternar Dia inteiro conserva a hora lembrada durante a edição. Instantes intocados preservam segundos, offset e ocorrência histórica de DST.
- Edição envia patch esparso. Alterar título ou categoria de uma concluída não reabre a tarefa nem muda `completed_at`. Descrições longas herdadas de captura não são reenviadas/truncadas em edições de outros campos; alterar a descrição aplica o limite de 5.000 caracteres do domínio.
- Concluir, reabrir, arquivar, excluir e restaurar estão disponíveis em ambas as apresentações. Ações de item usam BottomSheet; exclusão usa ConfirmDialog, lixeira lógica e Toast com Desfazer. Formulário e ações reutilizam `client_id` após falha ambígua; outra intenção recebe outro ID.
- Vazio de busca/filtro é distinto de lista/estado vazio. Leitura falha apresenta erro e Tentar novamente; escrita falha preserva dados e permite repetir. A data demonstrativa vem de `app.today()` e é identificada como exemplo.
- Links `?task=<id>` localizam somente registros da consulta autorizada, ajustam o estado visível, limpam filtros, promovem o registro à primeira página e abrem o editor. Registros na lixeira abrem ações de restauração; registros desconhecidos mostram erro sem expor dados externos. Fechar não reabre a superfície após atualizar o snapshot. `?view=hoje` aplica abertas/hoje. Suspense permanece dentro da guarda de acesso.

## Arquivos e fronteiras

Feature: `src/components/features/tarefas/{tasks-workspace.tsx,task-editor.tsx,task-form.ts,tasks.css}`. Composição de rota: `src/app/(workspace)/tarefas/page.tsx`. `task-form.ts` contém a borda pura de campos, patches, datas e filtros, sem React, provider ou adapter. Núcleo, provider, fixtures, shell e primitivas compartilhadas não foram alterados por T-010.

O quadro com arrastar, vínculos gerais, autenticação e persistência entre dispositivos permanecem em seus tickets. Não há botão de operação inexistente. Recarregar a página reinicia o universo em memória, conforme o contrato da demonstração.

## Validação

- **16/16 testes focados** em `tests/features/task-form.test.ts` passaram no ambiente padrão e `TZ=UTC`: preservação de estado/timestamps e campos, fuso próximo da meia-noite, dia inteiro, precisão de instantes intocados, descrição herdada, validação, filtros e lixeira.
- Lint da feature, rota e testes e typecheck completo com `--incremental false` passaram.
- `tests/e2e/tasks.spec.ts` prepara oito jornadas: CRUD e ações em 320px/1280px, round-trip em navegadores UTC/Los Angeles, igualdade tabela/cartões/vazios e links diretos com preservação de estado/foco. A execução é responsabilidade da rodada integrada; a existência do arquivo não atesta aprovação.
- E2E, portões visuais T-005 e inspeção claro/escuro desktop/mobile aguardam o integrador. Nenhum build ou servidor foi iniciado por esta frente.
