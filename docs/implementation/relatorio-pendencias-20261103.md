# Relatório de pendências — 03/11/2026

Levantamento das PRs abertas e das issues disponíveis em `kauanbarateli/Segundo-Cerebro`, feito em 03/11/2026 sobre a `main` em `3d167ad1`. O relatório separa o que foi organizado hoje do que continua pendente, em ordem de prioridade.

## Resumo

| Item | Antes | Depois |
| --- | --- | --- |
| Issues abertas | 54 | 45 |
| PRs abertas | 12 | 11 |
| Branches remotas | 117 | 117 (66 prontas para remoção, ver abaixo) |

### O que foi organizado hoje

- **Issues encerradas como concluídas (9):** #62, #63, #64, #65, #80, #122, #123, #124 e #125. A condição para fechá-las tinha sido registrada pelo mantenedor [em 30/10 na #81](https://github.com/kauanbarateli/Segundo-Cerebro/issues/81#issuecomment-6512309679): merge da PR #120 e conferência do banco depois da aplicação. As duas condições foram cumpridas:
  - a #120 está na `main` (`bd352884`) e em produção;
  - as migrations 020–027 foram aplicadas em produção em 30/10, com catálogo de 2.512 verificações sem desvios.

  Cada issue recebeu um comentário com essa justificativa.
- **PR encerrada (1):** #223, o planejamento da dock desktop (doc21). A #224 implementou o plano, que já está em produção. A branch `codex/plano-dock-desktop-20261102` foi mantida, porque o registro da implementação aponta para ela.
- **#126 (Cofre revelar/ocultar) mantida aberta** com comentário. Tudo foi validado, exceto o ramo **Nota segura**, que não foi exercitado em homologação.
- **Documentação e código corrigidos** na PR desta organização (ver a seção "Correções na documentação e no código").

### O que não foi possível fazer

- **Remover branches mescladas.** O proxy de Git desta sessão recusa a exclusão de branches (HTTP 403, política do ambiente), e as ferramentas do GitHub disponíveis não têm a ação de excluir branch. A lista e o comando estão no fim deste relatório, para você executar.

## PRs abertas (11)

Todas têm conteúdo que ainda não está na `main`.

### Frente B — cadastro, feedback e retirada da origem

| PR | O que é | Base | Pendente |
| --- | --- | --- | --- |
| [#228](https://github.com/kauanbarateli/Segundo-Cerebro/pull/228) | Liberação controlada do feedback em produção. A interface já está publicada, mas o envio fica fechado porque o gate só aceita homologação. | `main` | As tabelas e funções de feedback não existem em produção. Faltam qualificar o catálogo e as ACLs, revisar os SQL candidatos (hoje com travas fatais) e aplicá-los em produção sob supervisão. |
| [#229](https://github.com/kauanbarateli/Segundo-Cerebro/pull/229) | Cópia executável para revisar a instalação do feedback. Empilhada sobre a #228. | #228 | Controle de concorrência, qualificação do ledger e do transporte, teste autenticado conectado, recuperação após commit e decisão sobre retenção. |
| [#221](https://github.com/kauanbarateli/Segundo-Cerebro/pull/221) | Revisão protegida da migration de retirada da origem (issue #218). | `main` | O arquivo está como `.sql.txt` com travas; ainda não é uma migration aplicável. Depende da decisão e da implementação da #218. |
| [#214](https://github.com/kauanbarateli/Segundo-Cerebro/pull/214) | Ensaio isolado do cadastro em QA, sem deploy automático. | `codex/front-b-cadastro-mesmo-navegador` | Ensaio em QA. Não deve ser mesclada na branch de produto. |
| [#213](https://github.com/kauanbarateli/Segundo-Cerebro/pull/213) | Protocolo guardado de corte do cadastro no QA. | #204 | Revisão do protocolo. Não autoriza aplicação nem abertura do cadastro. |
| [#204](https://github.com/kauanbarateli/Segundo-Cerebro/pull/204) | Observação de concorrência do cadastro em PostgreSQL 17 descartável. | `codex/front-b-atualizacoes-foco` | Evidência sem aceite hospedado (`acceptance=false`). |
| [#179](https://github.com/kauanbarateli/Segundo-Cerebro/pull/179) | Observação isolada das candidatas da Frente B em PG17. | `codex/frente-b-migrations-locais` | Concluir a observação ou encerrar, se as #204/#213 já cobrem o que ela propunha. |

**Sugestão:** a cadeia #179 → #204 → #213 → #214 é de evidência e ensaio, não de produto. Depois que o cadastro (#135/#215) for homologado, vale decidir quais registros entram na `main` como documentação e encerrar o resto.

### Planejamento e fora do recorte atual

| PR | O que é | Pendente |
| --- | --- | --- |
| [#127](https://github.com/kauanbarateli/Segundo-Cerebro/pull/127) | Doc 19: aplicativo (PWA), instalação, offline e distribuição. Só documentação. | Revisar e mesclar, ou encerrar. Usa a branch `claude/dreamy-cori-fkltl0`, que não deve ser reaproveitada para outro trabalho enquanto estiver aberta. |
| [#114](https://github.com/kauanbarateli/Segundo-Cerebro/pull/114) | Diagnóstico das diferenças de baseline do restore. | Restore é pós-lançamento (D-078); segue a #42/#158. |
| [#83](https://github.com/kauanbarateli/Segundo-Cerebro/pull/83) | Contrato de comprovação de e-mail pré-Auth (checkout Asaas). | Fora do recorte atual (SPEC-07 #50/#52). |
| [#84](https://github.com/kauanbarateli/Segundo-Cerebro/pull/84) | Projeção do acesso comercial. | Fora do recorte atual (SPEC-07 #50/#53). |

## Issues abertas (45)

### 1. Prioridade agora: MVP publicado — aceites restantes

| Issue | Pendente |
| --- | --- |
| [#44](https://github.com/kauanbarateli/Segundo-Cerebro/issues/44) Frente D — aceite visual, acessibilidade e jornadas | Aceite humano final em aparelhos reais (iPhone/Android), zoom de 200%, leitor de tela e jornadas completas sobre o produto publicado. Concentra os aceites que as issues encerradas hoje deixaram para cá. |
| [#126](https://github.com/kauanbarateli/Segundo-Cerebro/issues/126) T-061 — Revelar/ocultar no Cofre | Exercitar o ramo **Nota segura** com os mesmos critérios já aprovados para itens de Login. |
| [#81](https://github.com/kauanbarateli/Segundo-Cerebro/issues/81) T-056 — validar integração do MVP | Fecha quando a #44 e a #126 forem aceitas. Integração, merge e produção já foram feitos. |
| [#12](https://github.com/kauanbarateli/Segundo-Cerebro/issues/12) T-005 — PWA e portões visuais | Aceite em aparelhos físicos (instalação Android/iOS). |
| [#2](https://github.com/kauanbarateli/Segundo-Cerebro/issues/2) SPEC-01, [#7](https://github.com/kauanbarateli/Segundo-Cerebro/issues/7) SPEC-06, [#71](https://github.com/kauanbarateli/Segundo-Cerebro/issues/71) SPEC-08 | Épicos. Fecham quando as filhas acima fecharem (#12, #44, #81, #126). |
| [#35](https://github.com/kauanbarateli/Segundo-Cerebro/issues/35) T-028 — hardening de release 1 | Itens de hardening próprios. A parte de restore foi para a #42. |

### 2. Frente B — entrega inicial (cadastro gratuito, origem, métricas e feedback)

| Issue | Pendente |
| --- | --- |
| [#135](https://github.com/kauanbarateli/Segundo-Cerebro/issues/135) T-069 — criar conta por e-mail e senha | O cadastro público está desativado. Depende da confirmação de e-mail (#215) e do procedimento de retirada (#218). |
| [#215](https://github.com/kauanbarateli/Segundo-Cerebro/issues/215) Confirmação de e-mail no cadastro | SMTP de QA desligado e tabela de versões legais vazia na última verificação. Falta homologar envio, confirmação e redirects. |
| [#218](https://github.com/kauanbarateli/Segundo-Cerebro/issues/218) Retirada autenticada da origem pelo titular | Página própria, com sessão do titular, usando a API existente. Bloqueia a abertura do cadastro enquanto a política indicar essa via. PR relacionada: #221. |
| [#136](https://github.com/kauanbarateli/Segundo-Cerebro/issues/136) T-070 — origem UTM | Captação e armazenamento feitos. A consulta individual fica para o ADM futuro, e a retirada depende da #218. |
| [#137](https://github.com/kauanbarateli/Segundo-Cerebro/issues/137) T-071 — métricas do Master | Totais e série publicados. As distribuições de UTM ficam para o ADM futuro (decisão de 02/11). |
| [#138](https://github.com/kauanbarateli/Segundo-Cerebro/issues/138) T-072 — feedback e histórico | A interface está em produção, mas o envio está fechado. Depende de #228/#229 e da instalação supervisionada do SQL em produção. |
| [#140](https://github.com/kauanbarateli/Segundo-Cerebro/issues/140) T-074 — validar a entrega integrada | Percurso landing → cadastro → confirmação → onboarding → dashboard em QA. Depende das acima. |

### 3. Banco, backup e restore (pós-lançamento)

| Issue | Pendente |
| --- | --- |
| [#158](https://github.com/kauanbarateli/Segundo-Cerebro/issues/158) T-087 — conferir backups | Plano, cobertura e último backup utilizável; recuperação do candidato atual em destino autorizado. |
| [#42](https://github.com/kauanbarateli/Segundo-Cerebro/issues/42) Restore e rotina de backup | Qualificar o baseline e concluir o ensaio de restore (D-078). PR relacionada: #114. |

### 4. Cobrança Asaas e onboarding comercial (SPEC-07, ainda não iniciado)

A etapa comercial vem depois e não foi iniciada:
- [#50](https://github.com/kauanbarateli/Segundo-Cerebro/issues/50) SPEC-07;
- [#51](https://github.com/kauanbarateli/Segundo-Cerebro/issues/51) a [#61](https://github.com/kauanbarateli/Segundo-Cerebro/issues/61) (T-029 a T-039): homologação Asaas, contratação, Pix, boleto, cartão, renovação, cancelamento, reembolso, isenção e origem;
- [#66](https://github.com/kauanbarateli/Segundo-Cerebro/issues/66) a [#68](https://github.com/kauanbarateli/Segundo-Cerebro/issues/68): retenções, operação da cobrança e validação integrada.

Têm contratos parciais nas PRs #83 e #84. Nada aqui deve começar sem autorização expressa, que não existe hoje.

### 5. Fase 2 — triagem pendente (`needs-triage`, `pos-mvp`)

Nenhuma foi iniciada. Precisam de priorização antes de qualquer trabalho:

| Grupo | Issues |
| --- | --- |
| Login social | [#141](https://github.com/kauanbarateli/Segundo-Cerebro/issues/141) Google no acesso e no cadastro |
| Google Calendar com escrita | [#142](https://github.com/kauanbarateli/Segundo-Cerebro/issues/142) detalhes e permissões, [#143](https://github.com/kauanbarateli/Segundo-Cerebro/issues/143) criar, editar e cancelar eventos |
| ClickUp | [#144](https://github.com/kauanbarateli/Segundo-Cerebro/issues/144) consultar, [#145](https://github.com/kauanbarateli/Segundo-Cerebro/issues/145) atualizar e comentar, [#146](https://github.com/kauanbarateli/Segundo-Cerebro/issues/146) sincronização em segundo plano |
| ADM separado | [#147](https://github.com/kauanbarateli/Segundo-Cerebro/issues/147) login com MFA, [#148](https://github.com/kauanbarateli/Segundo-Cerebro/issues/148) transferir a operação, [#149](https://github.com/kauanbarateli/Segundo-Cerebro/issues/149) respostas e roadmap, [#150](https://github.com/kauanbarateli/Segundo-Cerebro/issues/150) liberação de funcionalidades. É aqui que entra a "outra visualização" do Admin, que saiu da navegação em 02/11 (#226). |
| Lixeira | [#151](https://github.com/kauanbarateli/Segundo-Cerebro/issues/151) exclusão definitiva, [#152](https://github.com/kauanbarateli/Segundo-Cerebro/issues/152) retenção de sete dias |
| Manutenção | [#121](https://github.com/kauanbarateli/Segundo-Cerebro/issues/121) ESLint mantido e alias tinyglobby |

## Pendências técnicas observadas (sem issue própria)

- **Workflow nativo de Metas instável.** O job "Oito grupos de imagens e terminal em PostgreSQL 17" falha às vezes com `WRITE_OUTCOME_UNCERTAIN` e passa ao reexecutar. Aconteceu na #120 (29/10) e na #226 (02/11), sem mudança no motor financeiro e sem causa atribuída. Vale abrir uma issue para investigar.
- **Domínio `www` não acompanha o deploy de produção.** Nos deploys de 02/11, o `www.segundocerebroapp.com.br` ficou no deploy anterior e precisou ser apontado à mão. Vale conferir a configuração de domínios do projeto na Vercel.
- **Texto de acesso negado fala em "demonstração" também na conta conectada.** A mensagem e o link "Rever opções de demonstração" em `workspace-page.tsx` foram escritos para o modo demo. Ajustar exige mudar as E2E que verificam esse texto.

## Correções na documentação e no código (PR desta organização)

- `AGENTS.md`, `CONTEXT.md`, `DESIGN.md` e `PRODUCT.md` diziam que "merge e deploy continuam bloqueados". Agora registram que o MVP foi incorporado e publicado em 30/10 (PR #120) e que novos merges e deploys dependem de pedido explícito do mantenedor.
- `README.md` dizia que o MVP estava "em validação" e que não se sabia a versão do banco de produção. Agora aponta a publicação de 30/10 e a aplicação de 020–027 com catálogo sem desvios.
- `docs/implementation/dock-desktop-20261102/README.md` dizia que merge e deploy estavam bloqueados; agora registra a #224 e o deploy de produção.
- `src/app/layout.tsx`: o título padrão era "Segundo Cérebro · Em construção" e a descrição dizia "Acompanhe a construção"; agora são "Segundo Cérebro" e a descrição do produto.
- `src/lib/navigation/routes.ts` e `src/components/layout/workspace-page.tsx`: saíram os textos de estado vazio de cada módulo ("ainda em construção", "ainda não disponível", "será implementado"). Nenhuma página os exibia mais, porque todos os módulos têm conteúdo próprio, e eles descreviam funcionalidades que já existem.
- As descrições de Configurações e Admin usadas na busca não falam mais em "demonstração".

## Branches

### Prontas para remover (66, já contidas na `main`)

Nenhuma é base de PR aberta nem é citada por issues ou documentos. Foram mantidas na lista de exceções:
- as bases de PRs abertas;
- `codex/plano-entrega-inicial-20261031`, `codex/planejamento-prototipo-integral-20261021`, `codex/mvp-goals-terminal-20261023` e `claude/segundo-cerebro-layout-final-ays1kz`, citadas por mais de 300 links em issues e documentos.

Para remover, rode a partir de um clone com permissão de escrita:

```bash
git push origin --delete ccr-41720489-cekj7x claude/frente-a-a01-landing-login claude/frente-a-a02-tema-header-paineis claude/frente-a-a03-editores claude/frente-a-a04-captura-rapida claude/frente-a-a05-config-projetos claude/frente-a-a06-calendario-lista claude/frente-a-integracao codex/admin-fora-da-navegacao-20261102 codex/b01-admissao-contrato codex/b02-origem-integracao codex/b03-metricas-integracao codex/b06-integracao-20261031 codex/b07-retencao-origem codex/b08-integracao-frentes codex/ci-capture-document-20261021 codex/dock-desktop-opt-in codex/fix-auditoria-173 codex/frente-a-snapshot-v1 codex/front-b-137-pg17-observation codex/front-b-218-pendente codex/front-b-218-retirada-duravel codex/front-b-atualizacoes-browser codex/front-b-atualizacoes-editoriais codex/front-b-atualizacoes-main codex/front-b-atualizacoes-retencao codex/front-b-atualizacoes-utf8 codex/front-b-cadastro-fence-integracao codex/front-b-cadastro-reserva codex/front-b-contratos-transporte codex/front-b-diagnosticos-ci codex/front-b-feedback-browser codex/front-b-feedback-confirmacao codex/front-b-feedback-entrega codex/front-b-feedback-navegacao codex/front-b-feedback-paginacao codex/front-b-feedback-reconciliacao codex/front-b-feedback-reconciliacao-duravel codex/front-b-feedback-sessao codex/front-b-foco-real codex/front-b-focus-modes codex/front-b-fontes-financeiras codex/front-b-historico-fontes codex/front-b-integracao-consolidada codex/front-b-main-migrations codex/front-b-metricas-contrato codex/front-b-metricas-protecao codex/front-b-privacidade-retirada codex/front-b-restore-fixture30 codex/front-b-restore-historico codex/front-b-retencao-qualificacao codex/front-b-sequencia-fixture30 codex/front-b-sequencias-historicas codex/front-b-utm-interfaces codex/impeccable-480-20261031 codex/landing-page codex/mvp-compose-20261023 codex/mvp-goals-channel-20261023 codex/mvp-goals-images-20261023 codex/onboarding-landing-polish-20261023 codex/paginas-legais-e-checklist-20261018 codex/planejamento-asaas-onboarding-20261018 codex/projetos-detalhe-harmonico-20261102 codex/reconciliacao-banco-20261031 codex/redesign-parallel-20261022 codex/retomada-frente-b-20261102
```

Outra opção é ativar em GitHub → Settings → General a opção "Automatically delete head branches", que remove a branch quando a PR é mesclada.

### Não mescladas e sem PR aberta (29) — decidir

Estas branches têm commits fora da `main`. A maioria é de outubro e foi substituída por entregas posteriores. Não foram tocadas. Se não houver nada a recuperar, podem ser removidas.

- **Frente B:** `codex/b02-origem-validacao`, `codex/b03-metricas-contrato`, `codex/b04-feedback-core`, `codex/b05-atualizacoes-20261031`, `codex/front-b-feedback-sql-diagnostico`, `codex/front-b-utm-privacy`.
- **CI e Financeiro de 21–23/10:** `codex/ci-capture-rich-content-20261021`, `codex/ci-finance-monthly-analysis-20261021`, `codex/ci-goal-reserves-20261021`, `codex/ci-habit-frequency-history-20261021`, `codex/ci-monthly-plan-copy-20261021`, `codex/finance-budget-review-20261023`, `codex/finance-goals-review-20261023`, `codex/finance-goals-ui-20261023`, `codex/finance-series-browser-20261023`, `codex/finance-series-core-review-20261023`, `codex/spec08-kanban-20261021`.
- **Restore e diagnósticos:** `codex/restore-eof-diagnostic-20261022`, `codex/restore-target-diagnostic-20261023`, `codex/restore-toc-eof-20261023`, `codex/public-windows-pg18-20261022`.
- **Outras:** `codex/handoff-mvp-20261017` (citada em 2 links), `codex/homologacao-twry-20261022` (branch de homologação ativa, que deve ser mantida), `codex/landing-mvp-20261023`, `codex/mobile-acceptance-20261022`, `codex/mvp-construcao-offline`, `codex/own-sessions-schema`, `codex/planejamento-layout-ds21`, `test/t001-ci-guard`.
