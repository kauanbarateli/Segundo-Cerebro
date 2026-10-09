# T023 — Projetos e Hábitos persistentes

Projetos ganha criar, editar, excluir e restaurar. Excluir modifica somente o projeto: tarefas, capturas, cadernos e pastas conservam conteúdo e vínculo. A página permite criar uma captura, um caderno ou uma pasta no contexto atual, vincular um item existente e desvinculá-lo. Cada vínculo novo exige origem e projeto vivos do mesmo usuário; o veto da feature de origem também é conferido na API e no SQL.

Hábitos ganha criar, editar, arquivar e restaurar nas três cadências: diário, dias da semana e meta semanal. Marcações ficam esparsas e únicas por hábito/dia. O teto para marcar ou remover uma marcação é hoje em `America/Sao_Paulo`. Pausas gerais e individuais podem ser passadas, futuras ou abertas; remover uma pausa recalcula o acompanhamento sem alterar marcações. Arquivar mantém todo o histórico. A data inicial é imutável, e a cadência atual recalcula a sequência sobre o histórico completo. O mapa de 182 dias é uma janela independente: o reader não corta a entrada do cálculo.

## Contratos e integração

Os módulos expõem ports estreitos, compatíveis estruturalmente com a UnitOfWork central. A UI importa seu próprio módulo e os contratos compartilhados; não importa outra feature. O adapter trabalha sobre um snapshot completo e fechado, expira os ports ao sair do callback, confere correspondência exata entre mudanças/eventos/recibo e tenta novamente em conflito de revisão. Resultado desconhecido é reconciliado pelo mesmo recibo, sem trocar o `client_id`.

`GET /api/projects-habits?domain=projects` entrega `{items, containers}`. `domain=habits` entrega `{items, entries, pauses}` com todo o histórico. Revisão, eventos e recibos ficam no servidor. O POST recebe `{command,input}`; dono, sessão, canal, ids de eventos e relógio são derivados no servidor. São recusados origem externa, corpo acima de 64 KiB, campos desconhecidos e identidade ou lote fornecidos pelo cliente. Respostas usam cache privado desabilitado.

| Comando | Input além de `client_id` | Resultado |
| --- | --- | --- |
| `project.create` | `name, description, color_key, position` | Projeto |
| `project.update` | `id, patch` desses campos | Projeto |
| `project.delete`, `project.restore` | `id` | Projeto |
| `project.container.create` | `kind: capture/notebook/folder, name, project_id, parent_id?` | Metadados ProjectContainer |
| `project.container.link` | `id, project_id` | Metadados ProjectContainer |
| `project.container.unlink` | `id` | Metadados ProjectContainer |
| `habit.create` | `name, schedule_kind, weekdays, weekly_target, started_on, color_key, icon_key, position` | Hábito |
| `habit.update` | `id, patch` desses campos; início não muda | Hábito |
| `habit.archive`, `habit.restore` | `id` | Hábito |
| `habit.mark` | `habit_id, done_on, done` | Marcação ou null |
| `habit.pause.create` | `habit_id: string/null, starts_on, ends_on: string/null, reason: string/null` | Pausa |
| `habit.pause.delete` | `id` | null |

Os RPCs `projects_habits_snapshot`, `projects_habits_commit` e `projects_habits_receipt` recebem dono, sessão e operação verificados pelo gateway. A migration versionada é `20261009152200_projects_habits.sql`. Ela cria Hábitos, marcações, pausas e o contrato de pastas reutilizado por Drive, além de owner FKs, RLS e funções protegidas. O guard bloqueia primeiro os pais de Auth, depois usa `capture_task_lock`, e revalida o ator. A revisão cobre também fontes dos contêineres. O CHECK de eventos preserva tipos anteriores, incluindo Financeiro e Conhecimento. Mutação, evento e recibo são atômicos; replay precede CAS, porém sucede a autenticação. Operações sem alteração também têm resultado conferido contra o registro atual.

## Validação e aceite

Testes focados de domínio, adapter, gateway e HTTP passaram localmente. Cobrem soft delete/restauração sem cascata, três cadências, 230 dias de sequência contra janela visual de 182, pausas gerais/individuais, São Paulo perto da meia-noite UTC, idempotência concorrente, CAS, rollback, resposta perdida, ports expirados, veto atualizado, isolamento e DTOs privados. O transporte atômico injetado é evidência de contrato, sem pretender comprovar PostgreSQL.

O parser estático validou 38 instruções, 15 funções e 3 blocos da migration, sem executar SQL. O root conduz a validação local PGlite da cadeia e os portões integrados. As oito jornadas em `tests/e2e/projects-habits.spec.ts` estão preparadas para foco, CRUD, vínculos, restauração, cadências e pausas em desktop/mobile; sua execução e inspeção visual aguardam o root. Os briefs de Projetos/Hábitos registram continuidade de DS 2.1, alvos de 44px, campos de 16px e foco dos Drawers.

A aplicação/validação manual da migration em Supabase, os testes com dois usuários e sessões reais, corrida entre revogação e comando, RLS/grants no ambiente real e persistência após recarregar em modo conectado continuam pendentes externos. Esta frente não iniciou servidor, não abriu browser, não leu `.env` e não executou SQL remoto. Demonstração continua identificada como exemplo e não comprova persistência conectada.

Revisão independente em 09/10/2026 executou `projects-habits-catalog.sql` e `projects-habits-behavior.sql` no PostgreSQL descartável PGlite, com Auth e Storage explicitamente simulados e ROLLBACK. O teste encontrou e corrigiu a variável `result` ambígua no snapshot; criação contextual de caderno agora fornece `id/user_id` físicos ao trigger de Conhecimento. Nomes existentes de pastas e capturas com 200 caracteres podem ser vinculados/desvinculados pelo proxy sem reescrever conteúdo; o formulário contextual de criação mantém seu limite de 120. Assertions passaram para grants/RLS, snapshot/CAS/recibo antes da revisão, rollback sem Evento, create-here caderno, preservação de vínculos após apagar/restaurar projeto, histórico completo de 120 marcações, futuro/pausa e veto/owner. Nenhuma evidência desses doubles substitui sessões e transações concorrentes do projeto hospedado.
## Integração final da raiz — 09/10/2026

Os resultados e restrições de execução descritos acima pertencem ao checkpoint individual do agente deste módulo. A raiz estava autorizada a compilar e testar e concluiu a integração: 1.427 testes em UTC e São Paulo, 57 testes Node, 14 migrations e 29 asserções em PostgreSQL descartável, catálogo1242 e **168 E2E Chromium**. O portão Impeccable passou com zero registros. Detalhes, auditoria visual e limites estão na [validação final](t028-validacao-final.md).

Asserções de comportamento/fixtures são somente para **base dedicada vazia**, com rollback e verificação de resíduos; não executar sobre contas reais. No projeto pessoal, a revisão estrutural usa o catálogo readonly. Nenhuma migration nova foi aplicada remotamente. Banco/Storage/Google/SMTP, concorrência real, aparelhos e backup/restore seguem na [entrega e pendências](entrega-mvp-pendencias.md). Teste de demonstração não comprova o módulo conectado.
