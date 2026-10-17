# #36 — manutenção após o MVP

**Decisão expressa do responsável em 16/10/2026 (Fortaleza), 17/10 UTC.**
A [#36 — Manutenção: resolver aviso transitivo na cadeia de lint](https://github.com/kauanbarateli/Segundo-Cerebro/issues/36)
deixa de bloquear o aceite do MVP e permanece **OPEN**, com rótulo `pos-mvp`
e sem o milestone M0. A conferência somente leitura do GitHub confirmou esse
estado em 17/10 UTC. O MVP conserva #12/#35 e os épicos #2/#7.

Não é encerramento, correção definitiva ou dispensa de segurança. Os critérios
originais e o histórico da issue continuam preservados e pendentes.

## Mitigação e auditoria preservadas

O alias existente substitui somente `fast-glob` dentro de
`@next/eslint-plugin-next` por `npm:tinyglobby@0.2.17`. A
[mitigação revisada](dependency-lint-mitigation-20261012.md), o lint e o
`npm audit` completo obrigatório em `.github/workflows/ci.yml` continuam
ativos. Esta decisão não modifica manifesto, lockfile, overrides, regras,
workflows ou comportamento dos gates; não cria waiver para alertas futuros.
Audits anteriores pertencem aos seus SHAs, sem alegar uma auditoria nova.

O [advisory primário GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm),
atualizado em 02/10 e reconferido por Root em 17/10 UTC, ainda informa
`braces <=3.0.3` afetado e **nenhuma versão corrigida**. A
[revisão de upstream](dependency-upstream-review-20261016.md) registra os
limites de compatibilidade Next/plugins/ESLint. Esperar uma publicação externa
não tem prazo de engenharia garantido; isso não justifica forçar peers,
rebaixar a stack ou desligar regras.

## Critérios originais para concluir a manutenção

- Reavaliar a correção oficial de braces e da cadeia de lint.
- Atualizar sem rebaixar a stack aprovada Next 15 ou desativar regras.
- Considerar ESLint suportado quando compatível com os plugins.
- Após alteração revisada, executar instalação limpa, audit completo, lint,
  typecheck, contratos, build e smoke.
- Remover overrides temporários somente quando a versão transitiva segura
  vier da dependência principal.

A execução pode seguir em branch própria, com revisão e evidência dos bytes
efetivamente testados. Somente o cumprimento dos critérios permite encerrar
a #36; a conclusão do MVP, isoladamente, não o permite. Esta atualização é
documental: não executa instalação, audit, testes ou serviços.
