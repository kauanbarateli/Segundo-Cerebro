# Planejamento — Novo Segundo Cérebro

**Entrada vigente26/10/2026:** [doc18 — convergência ao protótipo](18-convergencia-prototipo-20261025/README.md). Consolida código/Preview/CI/issues/branches e substitui o backlog histórico abaixo onde houver divergência. Snapshot303doc17 é a autoridade visual; D-077/D-078/D-080–083 delimitam execução e exceções. Implementação permanece pausada, investigação/issues autorizadas.

**Planejamento aprovado em 23/09/2026; protótipo atualizado em 29/09/2026.** Duas rodadas de decisão respondidas (D-001…D-027), diagnóstico + documentos de proposta + roadmap + 28 tickets executáveis em 6 specs. D-028/D-029 registram o protótipo anterior; D-030/D-031 registram esta revisão e a instalação da skill. A execução de produção começa pelos pré-requisitos do [doc 12](12-roadmap.md) §"Antes do primeiro ticket" e pelo **T-001** do [doc 13](13-tickets.md).

**Corte vigente — 12/10/2026, D-032:** toda entrega da aba Drive foi retirada do MVP. T-022 conserva seu ID como retirado, sem aceites ou bloqueios de entrega; a nova lógica será definida pelo mantenedor depois. Capturar, Avatar e a infraestrutura privada compartilhada permanecem no escopo. Os documentos de diagnóstico, decisões anteriores, protótipo e evidências preservam os fatos de suas datas; não representam uma entrega Drive vigente.

**Atualização visual — 17/10/2026, D-033:** o [doc 15 — Aplicação do layout Codex](15-aplicacao-layout-codex/README.md) reúne o snapshot final, referências, mapa de integração e critérios de aceite para transportar a composição ao produto. As cores seguem o JSON autoral DS 2.1; regras de produto e corte D-032 permanecem. Publicação deste planejamento não significa implementação concluída.

**Interface anterior (29/09/2026):** o [doc 14 — Protótipo e interações](14-prototipo-interacoes.md) descreve fielmente Capturar, grafo, busca, perfil, Home, medidas responsivas, dados e limites da simulação. Suas regras observadas prevalecem para recriar o HTML; os docs anteriores continuam especificando o produto de produção. O grafo persistente permanece na fase 2 (D-027). Validação e evidências desta revisão ficam no doc 14 §11.

Pasta confirmada pelo Kauan: `...\Maestri\Pessoal\Novo  -- Segundo Cerebro\docs\planejamento\`
Metodologia: compreender → questionar → propor → validar → plano de execução (fluxo cumprido). Nenhum código de aplicação foi produzido nesta etapa. O repositório `segundo_cerebro` foi tratado como **somente leitura** do início ao fim.

---

## Estado dos documentos

| # | Documento | Seção | Estado |
|---|---|---|---|
| 00 | [Índice](00-indice.md) | — | ✅ este arquivo |
| 01 | [Diagnóstico do projeto atual](01-diagnostico-projeto-atual.md) | A | ✅ |
| 02 | [Arquitetura proposta](02-arquitetura-proposta.md) | B | ✅ confirmada — D-018/D-019 |
| 03 | [Comparação tecnológica](03-comparacao-tecnologica.md) | C | ✅ proposta (recomendação: Supabase novo) |
| 04 | [Novo Design System](04-design-system.md) | D | ✅ Geist confirmada; revisão observada DS 2.1 no doc 14 |
| 05 | [Arquitetura de produto](05-arquitetura-de-produto.md) | E | ✅ taxonomia D-016 com retirada Drive em D-032 |
| 06 | [Arquitetura de dados (ER)](06-arquitetura-de-dados.md) | F | ✅ proposta (Financeiro fundido) |
| 07 | [Estratégia Web + App](07-estrategia-web-app.md) | G | ✅ proposta |
| 08 | [Responsividade](08-responsividade.md) | H | ✅ proposta |
| 09 | [Segurança](09-seguranca.md) | I | ✅ Cofre aprovado — D-021 |
| 10 | [Área administrativa](10-area-administrativa.md) | J | ✅ coleta aprovada — D-022 |
| 11 | [Estratégia de MVP](11-estrategia-mvp.md) | K | ✅ corte D-023 atualizado por D-032 |
| 12 | [Roadmap — planejamento futuro completo](12-roadmap.md) | L | ✅ (pedido da R7) |
| 13 | [Specs e tickets executáveis](13-tickets.md) | M | ✅ 6 specs · 28 IDs preservados, T-022 retirado · M0–M4 |
| 14 | [Protótipo e interações](14-prototipo-interacoes.md) | N | ✅ especificação vigente da demonstração de 29/09/2026; evidências no §11 |
| 15 | [Aplicação do layout Codex](15-aplicacao-layout-codex/README.md) | O | Planejamento de implementação; snapshot final e evidências, DS 2.1 preservado |
| 16 | [Checkout Asaas e onboarding](16-checkout-asaas-onboarding/README.md) | P | Consolidado e 18 tickets aprovados (D-064); publicação documental, sem implementação |
| — | [Registro de decisões](registro-de-decisoes.md) | — | Decisões históricas e escolhas comerciais/onboarding da entrevista vigente; síntese no doc 16 |
| — | [Questões em aberto](questoes-em-aberto.md) | — | Rodadas históricas 1 e 2 respondidas; a ampliação comercial tem pendências no doc 16 |
| — | [Referências visuais](referencias/referencias-visuais.md) | — | ✅ |
| — | [Anexo A — análise do `novo-segundo-cerebro`](anexo-a-analise-novo-segundo-cerebro.md) | — | ✅ (Q4 = a) |
| — | [Anexo B — metodologia "Match-SPOC" (Matt Pocock)](anexo-b-metodologia-match-spoc.md) | — | ✅ (Q11) |
| — | Protótipo histórico D-030 — `prototipo/prototipo-segundo-cerebro.html`, 14 telas, sem backend; arquivo não presente neste checkout. [Pacote visual atual](15-aplicacao-layout-codex/README.md) | — | A [publicação anterior](https://claude.ai/artifact/Cb3wdhPXBnrUzM8utNDx2w) é histórica (D-028/D-029), sem atualização remota declarada; onboarding complementar usa o SHA do PR #47 registrado no doc 16 |

---

## Fontes da investigação

| Fonte                                     | Onde                                                                                                                   | Papel                                                          |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Repositório `segundo_cerebro`             | `...\Maestri\Pessoal\segundo-cerebro` (working copy local = remote `git@github.com:kauanbarateli/segundo_cerebro.git`) | Projeto primário, somente leitura                              |
| Branch `main`                             | 52 commits, 02/08/2026 → 21/09/2026                                                                                    | Estado "oficial"                                               |
| Branch `origin/v2-interface-e-financeiro` | +13 commits sobre a main                                                                                               | **Estado mais avançado** (Financeiro V2 + responsividade)      |
| Clone de trabalho                         | scratchpad da sessão (`sc-clone`, com worktree `sc-main`)                                                              | Onde a Impeccable foi instalada e o detect rodou               |
| Skill Impeccable v4.1.0                   | clonada + instalada no clone                                                                                           | Diagnóstico visual (61 regras + lentes critique/audit)         |
| Projeto `novo-segundo-cerebro`            | `...\Maestri\Pessoal\Novo - Segundo Cerebro` (remote `kauanbarateli/novo-segundo-cerebro`)                             | Incorporado como fonte — D-009/D-019/D-026 |

As fontes e resultados de investigação acima pertencem à etapa de 23/09. A revisão de 29/09 usa os arquivos do protótipo, as três imagens disponíveis e IMPECCABLE 4.4.0 (D-031); não reaproveita resultados antigos de detector como validação atual.

## Avisos importantes

1. **As branches divergem de verdade — nenhuma contém a outra.** A `main` tem `0023_pagamento_parcial.sql` + `0024_serie_tipo.sql` (pagamento parcial, recorrência por coluna, horizontes de dívida); a v2 tem `0023_financeiro_v2.sql` (status, exclusão lógica, plano do mês) e o merge final dela **descartou o conteúdo do último commit da main** (árvore de `a9422bc` = árvore de `8a9f209`). Qual modelo vale — ou se os dois se fundem — é a questão Q1; qual migration está no banco real é a Q2.
2. O requisito do Financeiro V2 (`PLANEJAMENTO-FINANCEIRO-V2.md`, "REQ-FIN") é referenciado pelos docs da v2 mas **não está no repositório nem foi encontrado no disco** (Q5).
3. Nada foi escrito no repositório `segundo_cerebro`, no Supabase ou em qualquer branch remota durante esta investigação.
4. ⚠️ **Alerta operacional (agir independentemente do planejamento):** os segredos de servidor do `.env.local` (service role, chave de cifra dos tokens, client secret do Google, cron secret) estão em pasta sincronizada pelo OneDrive — ver §6.1 do [Diagnóstico](01-diagnostico-projeto-atual.md). Recomendada rotação + mover para fora da sincronização. (Checado por nomes de variáveis apenas: a senha mestra do Cofre NÃO está no `.env.local` desta máquina, ao contrário do que os planos locais do ClickUp afirmam.)

## Evolução integral do protótipo — 21/10/2026

O [doc17](17-evolucao-prototipo/README.md) compara main após PR48 com o protótipo mais recente e reúne referência navegável, imagens, capturas, contratos, decisões confirmadas, tickets e prompt de execução. Complementa o doc15; comercial/onboarding reutilizam o pacote16 do PR69 e fontes legais do PR70, ainda não incorporados à main neste corte. O índice histórico acima não significa ausência dessas propostas publicadas. ADR0011/0012 registram reservas virtuais e vigência de hábitos. Planejamento não atesta implementação, homologação ou deploy.
