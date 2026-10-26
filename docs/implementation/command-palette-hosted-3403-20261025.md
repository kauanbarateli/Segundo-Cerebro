# Busca global conectada — 25/10/2026

**OBSERVADO** no Preview isolado `dpl_5SAkeYyRFkWYRSaStkfrQHJjL1N4`, Source `3403a5aa1901c166e6cfc1206848bfdc1c34957a`, árvore `7fdeb63d76d30058c260ba1579e55f94c6f1c2ca`. A sessão era do usuário QA comum já autenticado na homologação `twrydxsdemaykgvdlpyd`; somente registros fictícios existentes foram consultados.

Root abriu a paleta com Ctrl+K. A pesquisa por QA encontrou seis registros, separados em Tarefas, Páginas, Lançamentos, Projetos e Hábitos. Pelo teclado, abriu uma página de Conhecimento, uma Tarefa e um Lançamento. As três rotas preservaram o identificador do registro no link profundo e reabriram o mesmo conteúdo após recarga.

| Percurso | Resultado observado |
| --- | --- |
| Página | Ctrl+K → QA → seta abaixo → Enter abriu a primeira ideia QA em Conhecimento. O foco chegou ao conteúdo principal; título e texto fictício foram carregados. A recarga preservou a página selecionada. |
| Tarefa | Ctrl+K → separar prioridades → Enter abriu o editor da tarefa QA correta. O título recebeu foco. A recarga reabriu o mesmo editor, com projeto, estado e prioridade existentes. Nenhuma alteração foi salva. |
| Lançamento | Ctrl+K → insuficiencia → Enter abriu os detalhes da despesa QA de R$ 900. O heading do diálogo recebeu foco. A recarga reabriu o mesmo lançamento confirmado e sua conta QA. |
| Sem resultados | A consulta ZZZ QA ausente 340 mostrou zero registros/atalhos e orientação para tentar outro termo. Escape fechou a paleta e devolveu o foco à gestão financeira anteriormente ativa. |
| Ação | Ctrl+K → Enter, com consulta vazia, abriu Nova captura em `/capturar?capture=new`. O editor estava vazio, com zero notas na biblioteca. Nada foi escrito ou salvo. |

A espera por um locator Playwright de link nominal expirou durante a pesquisa da tarefa; Root leu o estado atualizado, que já mostrava o resultado, e continuou pelo teclado. Isso não é falha observada da aplicação nem evidência de um tempo de resposta contratado.

[Captura real da ação aberta](evidence/command-palette-3403/capture-action-open.jpg) · [Comprovante do recorte](evidence/command-palette-hosted-3403-20261025.json).

Este recorte satisfaz a jornada buscar → abrir em três módulos com a sessão observada. Não testa leitor de tela, aparelhos físicos, outra identidade/RLS, pesquisa de conteúdo sigiloso ou todos os tipos de registro. A referência a Drive na navegação é apenas a superfície contextual existente; nenhuma entrega desse módulo foi retomada. Não houve criação, atualização, exclusão, SQL, migration ou upload por esse roteiro. Merge e produção continuam bloqueados.
