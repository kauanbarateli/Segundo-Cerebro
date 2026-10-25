# Integração e higiene do repositório — 24/10/2026

O mantenedor autorizou limpar branches sem uso, mesclar PRs prontas, fechar entregas substituídas e manter issues/documentos alinhados. O candidato operacional continua sendo a [PR #120](https://github.com/kauanbarateli/Segundo-Cerebro/pull/120). Um check verde isolado não qualifica a união nem substitui os critérios do ticket.

## Ações executadas

**OBSERVADO:** a consulta inicial encontrou25PRs em rascunho:14com todos os checks aprovados, três com skip e oito com falha. Cinco foram fechadas por substituição, reduzindo a fila para20. Cada head foi reconferido na API e provado ancestral integral de `a4fabf7a6df7b652584fb55441ecf6a2cc1acd30`, com zero commits exclusivos. Os comentários preservam a rastreabilidade:

| PR fechada | Entrega consolidada | Registro |
| --- | --- | --- |
| #100 | Base do redesign | [Comentário](https://github.com/kauanbarateli/Segundo-Cerebro/pull/100#issuecomment-6392459409) |
| #105 | Homologação e onboarding | [Comentário](https://github.com/kauanbarateli/Segundo-Cerebro/pull/105#issuecomment-6392458602) |
| #117 | Composição do MVP | [Comentário](https://github.com/kauanbarateli/Segundo-Cerebro/pull/117#issuecomment-6392457850) |
| #118 | Canais de Metas | [Comentário](https://github.com/kauanbarateli/Segundo-Cerebro/pull/118#issuecomment-6392457247) |
| #119 | Imagens de Metas | [Comentário](https://github.com/kauanbarateli/Segundo-Cerebro/pull/119#issuecomment-6392456564) |

Não houve merge dessas PRs. Suas branches/worktrees foram preservadas: há checkouts registrados, dependências históricas e a homologação em uso.

Sete outras branches remotas foram excluídas atomicamente, com dry-run, leases dos heads exatos e conferência posterior de ausência. Todos os commits permanecem na Main `336e1b7c2a2f5efba871eb0ad461b04bba065c41`; nenhuma tinha PR consumidor, worktree ou alias ativo. A lista remota passou de50para43heads:

- `codex/calendar-canonical-origin-20261021`
- `codex/ci-finance-period-20261021`
- `codex/ci-habits-vertical-20261021`
- `codex/ci-private-images-20261021`
- `codex/kanban-e-diagnostico-20261021`
- `codex/restore-first-failure-context-20261021`
- `codex/spec08-main-reconcile-20261021`

A conferência Vercel foi somente leitura:17aliases, paginação completa, todos vinculados aos deployments consultados;13refs protegidas e nenhuma implantação pendente observada. Preservaram-se produção/main, homologação e referências de protótipos ainda publicadas. Não foram apagados deployments, arquivos, branches locais, worktrees ou dados. O [recibo público](evidence/repository-hygiene-20261024.json) fixa heads e ações.

## Fila que permanece

As PRs divergentes não foram declaradas integralmente absorvidas por porcentagem de arquivos iguais. #106é candidata à substituição:seis dos sete paths finais coincidem; a configuração Vercel foi composta. #108/#109/#111/#115/#116têm implementação evoluída no candidato e exigem confronto dos deltas, sem reaplicar versões antigas. #101conserva critérios de mobile/corte separados.

A pilha de restore #102/#103/#107/#110/#112/#114contém diagnósticos e fixtures que não estão integralmente em Root. #45/#47são referências históricas; #89/#90são propostas financeiras anteriores. #83/#84contêm contratos comerciais fora da execução vigente. Preservar esses materiais até classificar seu destino, sem mesclar apenas para reduzir a contagem.

As issues #7e#80receberam os aceites parciais comprovados de [Auth](auth-api-current27-20261024.md) e [onboarding](onboarding-hosted-feedback-a8e-20261024.md). Não foram encerradas: critérios remanescentes continuam explícitos. O CI do a4 conserva21/22checks aprovados e a falha de captura; a próxima instrumentação exige execução própria. A #120eprodução permanecem bloqueadas até as validações aplicáveis.

## Regra para as próximas entregas

Reutilizar a PR de integração para correções do mesmo candidato. Abrir outra PR quando houver escopo independente e delta revisável. Antes de fechar por substituição, registrar destino, Source e diferenças; antes de excluir uma branch, conferir head atual, contenção dos commits, PRs, worktrees e deployments. Fechar issues somente com todos os critérios comprovados, separando implementado, validado e pendente. Nunca excluir WIPs ou referências ativas como parte de uma limpeza automática.
