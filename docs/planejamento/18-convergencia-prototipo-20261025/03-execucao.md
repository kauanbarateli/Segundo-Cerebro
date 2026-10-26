# Mapa de implementação e execução

**Execução autorizada em 26/10/2026 (D-084).** A retomada inicial distribuiu quatro frentes e corrigiu Typecheck/foco de Metas. O saldo abaixo orienta a validação final e as correções remanescentes, com merge/deploy bloqueados. Fonte da análise histórica: ad24a6b; base de retomada conferida: 6cd4442. O [registro de execução](../../implementation/retomada-doc18-20261026.md) acompanha alterações e evidências novas.

## Destinos e relações

Integração existente: `codex/mvp-goals-terminal-20261023` / PR120 → main. Homologação: `codex/homologacao-twry-20261022`, Preview3a READY no checkpoint abaixo. As distâncias de branches 3403/85b registradas na auditoria são históricas; Root deve reconferir os heads reais antes de atribuir qualquer nova fatia. Não desenvolver sobre main ou checkout antigo por suposição.

**Checkpoint atual:** o [saldo por superfície](README.md#estado-de-execução--checkpoint-de-2610) distingue implementação, prova e pendência. Preview3a validou links/foco e revelou perda do diálogo de conflito em duas abas. D00 passou no diagnóstico; o CI de PR eb008 aprovou o comparador corrigido, mas o push recusou a primeira OG e Recovery PR ficou NOT_RUN por erro pré-stack. O novo lote corrige a moldura e a política OG, exigindo seus próprios checks/Preview. Não reaplicar composições entregues nem promover prova nativa/demo a aceite hospedado.


| Trabalho / prioridade | Issue dona | Destino inicial e dependências | Pronto / falta |
|---|---|---|---|
| P0 Requalificar CI/Source; Typecheck e foco corrigidos | #81 | PR120, Root; antes de E2E/Gallery | Typecheck e foco de Metas corrigidos e exercitados; diagnóstico D00 passou. Requalificar CI do candidato final; não reinvestigar a causa já documentada. |
| P1 Capturar/Conhecimento/editor | [#122](https://github.com/kauanbarateli/Segundo-Cerebro/issues/122) | Fatia isolada sobre Root; integra PR120; coordenação editor compartilhado | Trilho, leitura, mobile e toolbar implementados; Preview3a confirma links/foco/save/reload. Restam os aceites específicos não cobertos, incluindo CAS real e mobile físico. |
| P1 Tarefas | [#123](https://github.com/kauanbarateli/Segundo-Cerebro/issues/123) | Fatia isolada sobre Root; não editar table-model global sem coordenação | Rank, seis abas e composição implementados; Hoje inclui abertas/concluídas e atalhos usam status=open. Requalificar a fonte final e regressões existentes. |
| P1 Financeiro | [#124](https://github.com/kauanbarateli/Segundo-Cerebro/issues/124) | Fatia isolada sobre Root; dono finance CSS/workspace/panels/editors | Abas, painel, tabela e formulários implementados preservando o motor. Metas tem prova nativa própria Source751; faltam aceites integrados/visuais remanescentes. |
| P1 Início/Configurações/navegação/Projeto contextual | [#125](https://github.com/kauanbarateli/Segundo-Cerebro/issues/125) | Fatia isolada sobre Root; não concorrer com editor compartilhado/CSS financeiro | Recentes reais, picker/painéis, navegação, Ajuda e ações de tarefas implementados. D081 preserva Projeto sem status/prazo próprios; validar os critérios remanescentes. |
| P1 Landing + visual onboarding | #80 | PR120; UI V2/Gallery incorporadas; onboarding coordenado com #63 | Nove telas/chips e landing curta implementados; Gallery17/Entrada8/Projetos4 qualificados e incorporados. OG3 e aceites finais permanecem; não reaplicar UI V2. |
| P1 Onboarding contratos/qualificação | #62–65 | Root/canal isolado; não depende #54 no MVP | Retenção nativa R01–R07 qualificada em be07. Restam MainHTTP e sweep/saúde autônomos hospedados, separados de UI e dos contratos nativos. |
| P1 Cofre — revelar/ocultar protegido | [#126](https://github.com/kauanbarateli/Segundo-Cerebro/issues/126) | Fatia isolada sobre Root; revisão de segurança antes de integrar | UI e testes de máscara/ocultação implementados; cinco testes de componente registrados. Aceites restantes #126 não autorizam acesso a segredo pessoal. |
| P1 Aceite integrado | #81 | Depende correções aplicadas e Source estável | D00 diagnóstico e CI de PR eb008 passaram; eb008 terminou21/23. Completar os checks da correção de moldura/OG e reconferir Recovery; comparar Preview e fonte exatos. |
| P1 Aceite humano/PWA | #44/#12 | Após pacote visual estável; critérios independentes | Instalação relatada; share target/zoom/mobile/matriz final conforme critérios. |
| P2 Operação/corte | #35/#7 | Após #81/#44; plano específico de corte | Inventário schema, Google Production, smoke/rollback operativo. Não é restore. |
| Pós-lançamento | #42/#121 | PR114/operação e manutenção separadas | Não bloqueiam o recorte por associação histórica. |
| Etapa comercial | #50–61/#66–68, PR83/84 | Preservar branches, sem integrar aqui | #62–65 reutilizam contratos sem ativar billing. |

As cinco correções novas detalham deltas visuais/funcionais; #80 conserva landing/onboarding, #81 valida integração e #44 recebe aceite humano. Nenhum gate vira depósito genérico de implementação. #72–79 continuam fechadas no escopo técnico já comprovado, com links para os complementos.

## Quatro frentes, sem sobrecarregar 8 GB

1. **Root / CI e integração:** requalificar o candidato final e seu port C, revisar deltas demonstrados e conduzir homologação/Main/retention. Typecheck/foco já corrigidos; Gallery já incorporada. Um processo local pesado por vez; preferir GitHub.
2. **Conteúdo e tarefas:** conferir os aceites restantes de Capturar/Conhecimento/editor e Tarefas. Corrigir somente divergências demonstradas, separando deltas e preservando o motor.
3. **Financeiro:** conferir os estados restantes de navegação/painel/tabela/cartões/planejamento/séries já implementados. Reusar componentes e não reabrir regras de reservas/faturas.
4. **Jornada e moldura:** validar saldos de Início/Configurações/shell/ações de Projeto, #80 e [#126](https://github.com/kauanbarateli/Segundo-Cerebro/issues/126), corrigindo apenas divergências demonstradas. A composição e os assets já incorporados não são tarefas novas; OG continua sob qualificação própria.

Agentes podem ler/revisar em paralelo. Não manter quatro builds, servidores Next, bancos PGlite e navegadores pesados locais. Usar uma instância de comparação e rodar suites no runner. Fixar dono por path no comentário da issue; nenhum agente edita o checkout humano com WIPs. Qualquer nova branch corretiva parte do Source que Root fixar após reconferir os heads. O inventário de branches da auditoria permanece histórico, sem representar automaticamente as refs atuais.

## Sequência de conclusão

1. Conferir heads da PR120 e os checks do Source exato. Link passou no comparador eb008; a moldura de conflito e a política OG agora exigem checks próprios. Não herdar diagnóstico D00 nem alterar B/P, goldens ou tolerâncias.
2. Reconciliar a implementação existente com os saldos por superfície. Trilho/Reader, abas, cards, chips e reveal já existem; corrigir apenas diferenças demonstradas, preservando regras e decisões D081–083.
3. Executar checks proporcionais aos deltas. E2E/SQL/nativos/builds ficam no GitHub; revisão de provas nativas mantém Source/árvore/casos próprios, sem promover PASS antigo para candidato novo.
4. Não reaplicar Gallery17/UI V2/Entrada8/Projetos4. Completar captura e qualificação OG3 no build que incorpora as entradas atuais, preservando proveniência e revisão de pixels.
5. Atualizar somente homologação autorizada após checks e conferência de destino. Reconciliar MainHTTP em cópia operacional nova; não editar frozen manifests, extrair cookies humanos ou usar a sessão QA como fixture de escrita indiscriminada.
6. Retenção nativa R01–R07 já tem prova be07. Completar separadamente a validação do sweep de720h e saúde/backlog autônomos no ambiente autorizado, com caso controlado, sem inferir job ativo de função ou prova nativa.
7. Capturar apenas comparações/estados ainda sem evidência equivalente: viewport/tema/teclado/zoom200%, reduced motion, erro/vazio/carregando/sucesso e Edge1024×600. Instalação relatada não substitui a matriz física nem aceite humano.
8. Atualizar critérios das issues e registrar #44/#12. Inventariar schema de produção e credenciais Google antes de propor corte. Merge e produção continuam bloqueados até revisão/validações; restore permanece pós-lançamento.

## Prompt de retomada por frente

Use o prefixo comum:

> Trabalhe no repositório kauanbarateli/Segundo-Cerebro. Leia AGENTS, CONTEXT, doc18 e a issue atribuída. O protótipo de 303 arquivos do doc17 é autoridade visual; preserve regras de domínio/segurança/acessibilidade. Root deve informar SHA/árvore da PR120 e dono de paths antes de editar. Use Impeccable local. Não use main antiga, não reaplique patches incorporados nem migrations históricas. Sem merge/deploy/serviços por conta própria. Entregue PR/fatia com implementado/validado/pendente, evidências do SHA e conflitos. No notebook de 8 GB, sem suites pesadas paralelas; preferir CI. Sem coautoria ou segredos.

**A — Conteúdo/Tarefas:** acrescente as issues [#122](https://github.com/kauanbarateli/Segundo-Cerebro/issues/122) e [#123](https://github.com/kauanbarateli/Segundo-Cerebro/issues/123), e a comparação das respectivas linhas. Preserve CAS, rascunho, promoção e ciclo de vida. Siga Hoje aprovado em D082; registre paginação/limpeza de formatação; não bloqueie rail/rank por essas escolhas.

**B — Financeiro:** acrescente [#124](https://github.com/kauanbarateli/Segundo-Cerebro/issues/124); quatro abas e hierarquia do protótipo, sem perder Contas/Categorias/transferências. Proteja reservas virtuais, horizonte finito, privacidade e respostas incertas. Não faça submit multientidade sem contrato.

**C — Jornada/moldura:** acrescente [#125](https://github.com/kauanbarateli/Segundo-Cerebro/issues/125)/#80. Reusar páginas recentes, theme picker e comandos de tarefa. Drive não volta. Landing curta/Gallery já estão incorporadas; qualificar OG e os estados finais, preservar login/legais/Edge/motion e acesso ainda fechado. Os chips de dias já seguem a referência com alvos de44px; preservar breakpoint380px e concluir apenas o aceite faltante. Cofre [#126](https://github.com/kauanbarateli/Segundo-Cerebro/issues/126) segue D083, com testes de máscara e ocultação, sem alterar cifra ou acessar segredo pessoal.

**Root — Validação:** acrescente #81/#62–65/#35. Requalifique os jobs do SHA novo e a declaração exata do port C; confira OG, Main e retenção autônoma. Typecheck/foco/Gallery e provas nativas anteriores permanecem datados, sem repetição desnecessária. Relacione códigos/capturas/Preview ao mesmo Source e publique o saldo por critério; restore #42 permanece posterior.

## Branches preservadas

O [inventário](inventario.md) cobre43 refs. As branches redesign-parallel/onboarding-landing-polish estão absorvidas; landing-mvp tem commits próprios, mas os arquivos de produto comparados são iguais — não mergear por contagem. PR83/84 são comerciais, PR114 restore. main tem três commits exclusivos no grafo, com dois documentos já equivalentes na candidata. Não apagar nenhuma branch nesta auditoria; eventual limpeza exige verificação de objetos/exclusividade e preservação das entregas.
