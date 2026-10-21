# T-048 / #73 — Kanban sobre as tarefas existentes

Entrega local de implementação em 21/10/2026. Base: `ffc47c40629560ade9b39dfdfa91cf37641b9ae6`, branch `codex/spec08-kanban-20261021`. Sem push, PR, deploy ou alteração de banco. **A revisão estática não equivale a testes executados, aceite visual ou homologação conectada.**

## Fontes e decisões

- [Issue #73](https://github.com/kauanbarateli/Segundo-Cerebro/issues/73) e comentários reconsultados; não havia comentários adicionais.
- Pacote 17: README, base/escopo, mapa, decisões/contratos, execução, referências, aceite, auditoria de interface e ticket T-048. Protótipo consultado: `kanban.js`, `kanban.css`, DESIGN e capturas `tarefas-1440-dark.png` / `tarefas-390-light.png`.
- AGENTS, CONTEXT, DESIGN/PRODUCT, decisões operacionais, ADRs 0001–0004, Impeccable local integral e referências de trabalho existente/Operate/craft-floor. `context` executado uma vez; brief de Tarefas lido diretamente. Checklist React aplicado à revisão das duas TSX.
- **OBSERVADO:** três colunas, cartões neutros com 16px de respiro e raio local de 14px, faixa móvel com parte da próxima coluna, seletor de estado e alça própria. Geist e cores vêm dos tokens existentes.
- **RECOMENDADO e autorizado na coordenação:** conservar o select “Mostrar tarefas” existente em vez de reproduzir literalmente as abas do snapshot; acrescentar Todas como abertura, projeto e prioridade. Os filtros completos ocupam mais linhas que a demonstração. Alça ampliada para 44px e campo de estado com 16px em todos os tamanhos.

## Implementado

`tasks-workspace.tsx` usa o mesmo snapshot, filtros e estado controlado de busca/ordem nas duas apresentações. A lista conserva sua paginação; o Kanban mostra a coleção filtrada inteira e deriva dela as contagens. Nenhum array de tarefas é persistido à parte. O quadro usa somente `todo`, `in_progress` e `done`; Arquivadas/Lixeira têm uma coluna e ações próprias, sem alça de arraste.

Cada cartão conserva prazo, prioridade, categoria, projeto e acesso à captura de origem. Título abre o editor completo e menu conserva edição, conclusão/reabertura, arquivo, exclusão lógica e restauração. Criar em cada coluna abre o mesmo `TaskEditor`, com estado e contexto iniciais; a prop nova só atua na criação. Edições continuam gerando os patches existentes, sem redefinir os demais campos.

Movimentos usam `app.commands.tasks.status`; criação/edição/exclusão/restauração mantêm os comandos existentes e seus eventos. `task-action-command.ts` serializa ações e conserva destino e `client_id` em falhas/reenvios, inclusive quando a consulta já mostra o commit de uma resposta perdida. Nenhum status é alterado otimisticamente na coleção: a apresentação aguarda a confirmação e preserva o estado anterior em falha. Resultado incerto bloqueia novas intenções e oferece “Confirmar o mesmo envio”.

O seletor nativo permanece disponível para teclado e toque. O arraste opcional parte somente da alça, sem abrir o editor. Após criação, edição ou movimento, o foco volta ao controle da mesma tarefa; quando o recorte a exclui, usa um cabeçalho alcançável. O quadro revela horizontalmente o foco e considera a topbar/barra móvel ao posicioná-lo. A rolagem horizontal pertence ao quadro; movimento reduzido remove suas transições.

A preferência de apresentação tem chave versionada por Usuário no navegador, independente de `?view=hoje`, `?task=` e `?new=1`. Falha de storage mantém a escolha na sessão e informa que ela não pôde ser lembrada. Não modifica Entitlement ou preferências de acesso.

## Arquivos

- `src/components/features/tarefas/tasks-workspace.tsx`, `tasks.css`, `task-editor.tsx`.
- Novos `src/components/features/tarefas/task-board.ts` e `task-action-command.ts`.
- Novos `tests/features/task-board.test.ts` e `task-action-command.test.ts`; ampliação de `tests/e2e/tasks.spec.ts`.
- Este registro. Nenhuma alteração em núcleo, contracts globais, adapters, provider, tokens, SQL, dependências ou workflows.

## Matriz de aceite

| Critério | Implementação / prova preparada | Validação realizada |
|---|---|---|
| Mesma coleção/filtros/ordem/contadores | Projeção comum e `buildTableView`; testes de projeto/categoria/prioridade/prazo, busca sem acento, estados reais e contagens | Revisão estática; testes pendentes |
| Criar em três colunas com editor completo | Valores iniciais só na criação; E2E preserva descrição, prazo, projeto/categoria e estimativa ao mover/reabrir editor | Revisão estática; E2E pendente |
| Mesmo envio incerto não duplica | Controlador conserva a intenção; testes preparados de commit com resposta perdida, refresh, replay, serialização e rejeição definitiva | Revisão estática; testes pendentes |
| Falha conserva UI e permite tentar novamente | Coleção sem mutação antecipada; teste preparado com falha no commit e retry do mesmo client_id | Revisão estática; teste pendente |
| Teclado/toque, foco e arraste opcional | Select nativo, foco após troca de coluna e após editor; E2E de teclado/arraste sem abertura de diálogo | Revisão estática; interação real pendente |
| Arquivadas/lixeira | Coluna única, restaurar/reabrir e menus; sem arraste de registros arquivados/excluídos | Revisão estática; E2E pendente |
| Mobile, temas e reduced motion | CSS tokenizado, trilho interno, estado 16px, alça 44px; E2E de 320 claro / 1440 escuro e reduced motion escrito | Apenas referências visuais consultadas; produto não renderizado |
| Início/Projeto/Atividade e acesso J11 | Mesmos comandos e snapshot, sem nova rota/comando/banco | Regressões e prova conectada pendentes |
| Deep links e preferência por Usuário | Chave separada, defaults de rota preservados; teste de isolamento da chave e E2E de recarga | Revisão estática; testes pendentes |

## Validação e pendências exatas

Executado: `git diff --check`, sem apontamentos; inspeção do diff e dos contratos reais de tarefa. Oito casos unitários e três cenários E2E novos foram preparados, **sem execução**.

A coordenação manteve o veto a instalações, Vitest, TypeScript, lint em lote, build, detector, navegador e servidor enquanto a RAM livre permanecia abaixo de 1 GiB e sem slot explícito. Nenhum desses processos foi iniciado por esta frente. Não há captura do produto implementado nem resultado de CI atribuído a este commit.

Após liberação do slot, com Node 24 e dependências disponíveis, executar sequencialmente com um worker:

1. `tests/features/task-board.test.ts`, `task-action-command.test.ts`, `task-form.test.ts`, `home-task-command.test.ts`, `home-projections.test.ts` e `demo-application.test.ts`.
2. `tests/contracts/real-capture-task-contract.test.ts` e `tests/adapters/capture-task-store.test.ts`, para regressão de origem, timestamps, idempotência e atomicidade já existentes.
3. Typecheck, lint dos arquivos alterados, fronteiras de camadas e design system; detector Impeccable uma vez sobre os três arquivos de UI alterados. Esses checks ainda não foram executados.
4. E2E `tasks.spec.ts`, regressão `home.spec.ts`, Projeto/Atividade e negativas de acesso da composição real. O teste histórico `issue22-visual-port-comparison.spec.ts` pressupõe abertura em active e resumo global; a mudança aprovada para Todas/contadores filtrados exige reconciliação dessa prova na integração, sem alterar sua evidência histórica nesta frente.
5. Inspeção visual e teclado em 320/390/768/1024/1440, claro/escuro/Sistema, zoom 200%, textos longos, vazio/carregamento/erro/retry e foco com barra móvel. Medir contraste nos fundos reais e alvos/campos; capturar equivalentes do produto e registrar rota/estado/SHA/viewport/tema/fixture. Nenhuma fidelidade pixel a pixel foi declarada.

O launcher Impeccable apontou drift pré-existente de configuração e atualização disponível da skill local; esses arquivos não foram alterados incidentalmente. O aceite final de #73 e das jornadas J3/J11 permanece pendente dessas execuções.
