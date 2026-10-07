# Mapa de execução

Publicado e verificado em 07/10/2026: 6 specs, 28 tickets, 28 sub-issues e 53 dependências nativas. O estado vivo está no GitHub; esta tabela registra a correspondência estável com o planejamento.

| Ticket | Issue | Parent | Bloqueado por |
| --- | --- | --- | --- |
| SPEC-01 | [#2](https://github.com/kauanbarateli/Segundo-Cerebro/issues/2) — SPEC-01 — Fundação visual e PWA |  |  |
| SPEC-02 | [#3](https://github.com/kauanbarateli/Segundo-Cerebro/issues/3) — SPEC-02 — Fundação funcional com mocks |  |  |
| SPEC-03 | [#4](https://github.com/kauanbarateli/Segundo-Cerebro/issues/4) — SPEC-03 — Identidade, segurança e primeiras persistências |  |  |
| SPEC-04 | [#5](https://github.com/kauanbarateli/Segundo-Cerebro/issues/5) — SPEC-04 — Financeiro fundido e persistente |  |  |
| SPEC-05 | [#6](https://github.com/kauanbarateli/Segundo-Cerebro/issues/6) — SPEC-05 — Conhecimento, arquivos e vida diária |  |  |
| SPEC-06 | [#7](https://github.com/kauanbarateli/Segundo-Cerebro/issues/7) — SPEC-06 — Fecho do MVP |  |  |
| T-001 | [#8](https://github.com/kauanbarateli/Segundo-Cerebro/issues/8) — T-001 — Repositório, esqueleto e portões mínimos | SPEC-01 |  |
| T-002 | [#9](https://github.com/kauanbarateli/Segundo-Cerebro/issues/9) — T-002 — Tokens DS 2.0 + tema em três estados | SPEC-01 | T-001 |
| T-003 | [#10](https://github.com/kauanbarateli/Segundo-Cerebro/issues/10) — T-003 — Primitivos nível 1 | SPEC-01 | T-002 |
| T-004 | [#11](https://github.com/kauanbarateli/Segundo-Cerebro/issues/11) — T-004 — Shell navegável (trilho + barra + cabeçalho) | SPEC-01 | T-003 |
| T-005 | [#12](https://github.com/kauanbarateli/Segundo-Cerebro/issues/12) — T-005 — PWA base + portões visuais de CI | SPEC-01 | T-004 |
| T-006 | [#13](https://github.com/kauanbarateli/Segundo-Cerebro/issues/13) — T-006 — Primitivos nível 2 (superfícies e dados) | SPEC-01 | T-003 |
| T-007 | [#14](https://github.com/kauanbarateli/Segundo-Cerebro/issues/14) — T-007 — Núcleo: regras puras portadas + contratos | SPEC-02 | T-001 |
| T-008 | [#15](https://github.com/kauanbarateli/Segundo-Cerebro/issues/15) — T-008 — Início bento com dados de exemplo | SPEC-02 | T-004, T-006, T-007 |
| T-009 | [#16](https://github.com/kauanbarateli/Segundo-Cerebro/issues/16) — T-009 — Capturar ponta a ponta (mock) | SPEC-02 | T-006, T-007 |
| T-010 | [#17](https://github.com/kauanbarateli/Segundo-Cerebro/issues/17) — T-010 — Tarefas ponta a ponta (mock) | SPEC-02 | T-006, T-007 |
| T-011 | [#18](https://github.com/kauanbarateli/Segundo-Cerebro/issues/18) — T-011 — Financeiro em cinco telas (mock) | SPEC-02 | T-006, T-007 |
| T-012 | [#19](https://github.com/kauanbarateli/Segundo-Cerebro/issues/19) — T-012 — Demais cascas navegáveis com estados dignos | SPEC-02 | T-004, T-006, T-007 |
| T-013 | [#20](https://github.com/kauanbarateli/Segundo-Cerebro/issues/20) — T-013 — Supabase novo + pipeline + esquema de identidade | SPEC-03 | T-001 |
| T-014 | [#21](https://github.com/kauanbarateli/Segundo-Cerebro/issues/21) — T-014 — Auth completa + CSP em bloqueio + rate-limit | SPEC-03 | T-013 |
| T-015 | [#22](https://github.com/kauanbarateli/Segundo-Cerebro/issues/22) — T-015 — Capturar + Tarefas persistentes (troca de adapter) | SPEC-03 | T-009, T-010, T-014 |
| T-016 | [#23](https://github.com/kauanbarateli/Segundo-Cerebro/issues/23) — T-016 — Início real + eventos de domínio | SPEC-03 | T-008, T-015 |
| T-017 | [#24](https://github.com/kauanbarateli/Segundo-Cerebro/issues/24) — T-017 — Admin básico com bloqueio correto | SPEC-03 | T-014 |
| T-018 | [#25](https://github.com/kauanbarateli/Segundo-Cerebro/issues/25) — T-018 — Esquema fundido + RPCs + massa de regressão | SPEC-04 | T-013 |
| T-019 | [#26](https://github.com/kauanbarateli/Segundo-Cerebro/issues/26) — T-019 — Contas, cartão e fatura reais | SPEC-04 | T-011, T-018 |
| T-020 | [#27](https://github.com/kauanbarateli/Segundo-Cerebro/issues/27) — T-020 — Lançamentos reais + transferências + Desfazer | SPEC-04 | T-019 |
| T-021 | [#28](https://github.com/kauanbarateli/Segundo-Cerebro/issues/28) — T-021 — Conhecimento real: editor + wiki-links + backlinks + lixeira | SPEC-05 | T-012, T-013 |
| T-022 | [#29](https://github.com/kauanbarateli/Segundo-Cerebro/issues/29) — T-022 — Drive real com uploads assinados | SPEC-05 | T-012, T-014 |
| T-023 | [#30](https://github.com/kauanbarateli/Segundo-Cerebro/issues/30) — T-023 — Projetos + Hábitos reais | SPEC-05 | T-012, T-015 |
| T-024 | [#31](https://github.com/kauanbarateli/Segundo-Cerebro/issues/31) — T-024 — Cofre E2E com as sete evoluções | SPEC-05 | T-012, T-014 |
| T-025 | [#32](https://github.com/kauanbarateli/Segundo-Cerebro/issues/32) — T-025 — Calendário Google real | SPEC-05 | T-012, T-014 |
| T-026 | [#33](https://github.com/kauanbarateli/Segundo-Cerebro/issues/33) — T-026 — Busca global + paleta de comandos | SPEC-06 | T-015, T-020, T-021 |
| T-027 | [#34](https://github.com/kauanbarateli/Segundo-Cerebro/issues/34) — T-027 — Configurações completas | SPEC-06 | T-014, T-022 |
| T-028 | [#35](https://github.com/kauanbarateli/Segundo-Cerebro/issues/35) — T-028 — Hardening de release 1 | SPEC-06 | T-016, T-017, T-020, T-023, T-024, T-025, T-026, T-027 |

Preparação operacional: [#1](https://github.com/kauanbarateli/Segundo-Cerebro/issues/1). Manutenção de dependência de lint: [#36](https://github.com/kauanbarateli/Segundo-Cerebro/issues/36).

A publicação não conclui tickets. Fechar somente após revisão e evidências de aceite. Migrations aguardam aplicação manual posterior.
