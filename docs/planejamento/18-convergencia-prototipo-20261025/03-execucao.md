# Mapa de implementação e execução

**Execução autorizada em 26/10/2026 (D-084).** A nova solicitação do mantenedor retoma quatro frentes, começando pelo Typecheck e foco de Metas, com merge/deploy bloqueados. Fonte da análise histórica: ad24a6b; base de retomada conferida: 6cd4442. O [registro de execução](../../implementation/retomada-doc18-20261026.md) acompanha alterações e evidências novas.

## Destinos e relações

Integração existente: `codex/mvp-goals-terminal-20261023` / PR120 → main. Homologação: `codex/homologacao-twry-20261022`; remoto 3403 é ancestral a três commits, mas checkout local pode estar em 85b e 52 commits atrás. Não desenvolver sobre main ou esse checkout antigo.

| Trabalho / prioridade | Issue dona | Destino inicial e dependências | Pronto / falta |
|---|---|---|---|
| P0 Typecheck e investigação foco Metas; qualificar Source | #81 | PR120, Root; antes de E2E/Gallery | TS2345 demonstrado; foco histórico separado, causa não confirmada. |
| P1 Capturar/Conhecimento/editor | [#122](https://github.com/kauanbarateli/Segundo-Cerebro/issues/122) | Fatia isolada sobre Root; integra PR120; coordenação editor compartilhado | Contratos reais prontos; rail/leitura/mobile/toolbar faltam. |
| P1 Tarefas | [#123](https://github.com/kauanbarateli/Segundo-Cerebro/issues/123) | Fatia isolada sobre Root; não editar table-model global sem coordenação | Rank/composição; Hoje definido em D082. |
| P1 Financeiro | [#124](https://github.com/kauanbarateli/Segundo-Cerebro/issues/124) | Fatia isolada sobre Root; dono finance CSS/workspace/panels/editors | Motor pronto; abas/painel/tabela/forms faltam. |
| P1 Início/Configurações/navegação/Projeto contextual | [#125](https://github.com/kauanbarateli/Segundo-Cerebro/issues/125) | Fatia isolada sobre Root; não concorrer com editor compartilhado/CSS financeiro | Reusar readers/commands/picker; D081 mantém Projeto sem status/prazo próprios. |
| P1 Landing + visual onboarding | #80 | UI V2 depois de Gallery17; arquivos onboarding coordenados com #63 | Nove telas presentes; landing curta e chips faltam. |
| P1 Onboarding contratos/qualificação | #62–65 | Root/canal isolado; não depende #54 no MVP | Main HTTP, retenção, CI/negativas/aceites restantes. |
| P1 Cofre — revelar/ocultar protegido | [#126](https://github.com/kauanbarateli/Segundo-Cerebro/issues/126) | Fatia isolada sobre Root; revisão de segurança antes de integrar | D083 aprovada; UI e testes de ocultação pendentes. |
| P1 Aceite integrado | #81 | Depende correções aplicadas e Source estável | Sem PASS herdado; comparar Preview e fonte exatos. |
| P1 Aceite humano/PWA | #44/#12 | Após pacote visual estável; critérios independentes | Instalação relatada; share target/zoom/mobile/matriz final conforme critérios. |
| P2 Operação/corte | #35/#7 | Após #81/#44; plano específico de corte | Inventário schema, Google Production, smoke/rollback operativo. Não é restore. |
| Pós-lançamento | #42/#121 | PR114/operação e manutenção separadas | Não bloqueiam o recorte por associação histórica. |
| Etapa comercial | #50–61/#66–68, PR83/84 | Preservar branches, sem integrar aqui | #62–65 reutilizam contratos sem ativar billing. |

As cinco correções novas detalham deltas visuais/funcionais; #80 conserva landing/onboarding, #81 valida integração e #44 recebe aceite humano. Nenhum gate vira depósito genérico de implementação. #72–79 continuam fechadas no escopo técnico já comprovado, com links para os complementos.

## Quatro frentes, sem sobrecarregar 8 GB

1. **Root / CI e integração:** typecheck → foco Metas → suites pertinentes → Gallery; coordena SHA, conflitos, homologação e Main/retention. Um processo local pesado por vez; preferir GitHub.
2. **Conteúdo e tarefas:** primeiro Capturar/Conhecimento/editor compartilhado, depois Tarefas. Separar commits e não mexer no motor por composição visual.
3. **Financeiro:** navegação/painel/tabela; depois cartões/planejamento/séries. Reusar componentes; não reabrir regras de reservas/faturas.
4. **Jornada e moldura:** Início/Configurações/shell/ações Projeto; depois #80 e [#126](https://github.com/kauanbarateli/Segundo-Cerebro/issues/126) em sequência, com revisão de segurança. Landing pode preparar estrutura sem importar assets inexistentes; merge da estrutura só após Gallery.

Agentes podem ler/revisar em paralelo. Não manter quatro builds, servidores Next, bancos PGlite e navegadores pesados locais. Usar uma instância de comparação e rodar suites no runner. Fixar dono por path no comentário da issue; nenhum agente edita o checkout humano com WIPs. Branches corretivas curtas serão criadas **na retomada**, a partir do Source que Root fixar; não são branches existentes neste inventário.

## Sequência de conclusão

1. Conferir PR120/heads/ci; corrigir TS2345 preservando negativas. Reexercitar foco de upload e diagnosticar causa real, sem ampliar retries para esconder defeito.
2. Implementar correções por superfícies, reaproveitando o que está pronto. Resolver perguntas de produto antes dos subitens dependentes; avançar nos independentes.
3. Rodar checks proporcionais ao delta: typecheck/lint, testes focados, layers/tokens, regressão de domínio quando necessário. No GitHub executar E2E/SQL/nativos afetados, sem alterar asserts para obter PASS.
4. Produzir Gallery17 no código aprovado; inspecionar cada pixel/sidecar/recibo; aplicar UI V2 reconciliada. Não reaplicar patches históricos já incorporados.
5. Atualizar só homologação autorizada após checks. Reconciliar Main HTTP em cópia nova; não editar frozen manifests nem usar cookies do navegador humano. Ensaios com identidades descartáveis próprias, preservando a QA preenchida.
6. Comprovar sweep de 720 h/saúde por procedimento autorizado e caso vencido controlado; não esperar 30 dias nem inferir job ativo da existência de função.
7. Capturar comparações equivalentes em 320/390/768/1024/1440, dois temas, teclado, zoom de 200%, reduced motion, erro/vazio/carregando/sucesso. Edge 1024×600 para animação. Relatório por delta, não percentual de telas “prontas”.
8. Atualizar critérios das issues; aceite humano #44 e físico #12. Inventariar schema de produção e credenciais Google antes de propor corte. Merge/deploy exigem validações e revisão; esta entrega não os executa.

## Prompt de retomada por frente

Use o prefixo comum:

> Trabalhe no repositório kauanbarateli/Segundo-Cerebro. Leia AGENTS, CONTEXT, doc18 e a issue atribuída. O protótipo de 303 arquivos do doc17 é autoridade visual; preserve regras de domínio/segurança/acessibilidade. Root deve informar SHA/árvore da PR120 e dono de paths antes de editar. Use Impeccable local. Não use main antiga, não reaplique patches incorporados nem migrations históricas. Sem merge/deploy/serviços por conta própria. Entregue PR/fatia com implementado/validado/pendente, evidências do SHA e conflitos. No notebook de 8 GB, sem suites pesadas paralelas; preferir CI. Sem coautoria ou segredos.

**A — Conteúdo/Tarefas:** acrescente as issues [#122](https://github.com/kauanbarateli/Segundo-Cerebro/issues/122) e [#123](https://github.com/kauanbarateli/Segundo-Cerebro/issues/123), e a comparação das respectivas linhas. Preserve CAS, rascunho, promoção e ciclo de vida. Siga Hoje aprovado em D082; registre paginação/limpeza de formatação; não bloqueie rail/rank por essas escolhas.

**B — Financeiro:** acrescente [#124](https://github.com/kauanbarateli/Segundo-Cerebro/issues/124); quatro abas e hierarquia do protótipo, sem perder Contas/Categorias/transferências. Proteja reservas virtuais, horizonte finito, privacidade e respostas incertas. Não faça submit multientidade sem contrato.

**C — Jornada/moldura:** acrescente [#125](https://github.com/kauanbarateli/Segundo-Cerebro/issues/125)/#80. Reusar páginas recentes, theme picker e comandos de tarefa. Drive não volta. Landing curta depende de Gallery real; preservar login/legais/Edge/motion e acesso ainda fechado. Dias de onboarding devem seguir referência sem encolher alvos. Cofre [#126](https://github.com/kauanbarateli/Segundo-Cerebro/issues/126) segue D083, com testes de máscara e ocultação, sem alterar cifra ou acessar segredo pessoal.

**Root — Validação:** acrescente #81/#62–65/#35. Comece Typecheck, depois foco Metas. Leia jobs do SHA novo, qualifique Gallery, reconcilie Main e retenção. Relacione códigos/capturas/Preview ao mesmo Source e publique o saldo por critério; restore #42 permanece posterior.

## Branches preservadas

O [inventário](inventario.md) cobre43 refs. As branches redesign-parallel/onboarding-landing-polish estão absorvidas; landing-mvp tem commits próprios, mas os arquivos de produto comparados são iguais — não mergear por contagem. PR83/84 são comerciais, PR114 restore. main tem três commits exclusivos no grafo, com dois documentos já equivalentes na candidata. Não apagar nenhuma branch nesta auditoria; eventual limpeza exige verificação de objetos/exclusividade e preservação das entregas.
