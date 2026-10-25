# Integração e higiene do repositório — 24/10/2026

## Atualização de 25/10 — candidato a045

A [coorte própria a045](ci-a045-20261025.md) terminou com gerais e recaptura aprovados, duas falhas financeiras e dois jobs I8 SKIPPED. A #120 segue em rascunho; as correções do verificador e de foco exigem CI próprio antes de integração. Nenhuma PR foi mesclada, issue encerrada ou branch adicional removida por essa observação. Os estados e atos abaixo conservam sua data e Source; o [índice corrente](mvp-status-atual-20261025.md) orienta a retomada.

## Histórico de 25/10 — issues e candidato fa4

A higiene de PRs/branches descrita abaixo permanece: **20 PRs encerradas sem merge, cinco abertas e sete branches remotas/locais removidas**. Os snapshots/heads antigos não são promovidos a novas consultas. A última coorte auditada é fa4, com 19/20 runs e 21/22 jobs SUCCESS; seu resultado geral permanece FAIL pela captura REQUEST_FAILED/READINESS/FETCH, com causa desconhecida e sinais RSC/prefetch observados. O lote seguinte não herda esse resultado. Os 16 nativos próprios foram qualificados. [Estado atual](mvp-status-atual-20261025.md) e [evidência da #104](issue104-security-fa4-20261025.md).

A única issue encerrada nesta continuação é a [#36](https://github.com/kauanbarateli/Segundo-Cerebro/issues/36#issuecomment-6393068768), pelo aviso de segurança oficialmente retirado, com disposição explícita dos critérios originais sem marcá-los todos artificialmente. Isso não afirma atualização de toda a cadeia de lint. A [#121](https://github.com/kauanbarateli/Segundo-Cerebro/issues/121) foi **criada separadamente**, para manutenção pós-MVP de ESLint suportado/compatibilidade Next e revisão/remoção do alias tinyglobby quando segura. Nenhuma outra issue foi encerrada; os novos positivos de Metas e os aceites de Auth/onboarding continuam parciais.

O corpo histórico abaixo, inclusive a referência ao CI0785, permanece preservado por Source. Encerrar PR substituída não significa merge nem aceite de sua issue. [Recibo atualizado](evidence/repository-hygiene-20261024.json).

---

O mantenedor autorizou limpar branches sem uso, mesclar PRs prontas, fechar entregas substituídas e manter issues/documentos alinhados. O candidato operacional continua sendo a [PR #120](https://github.com/kauanbarateli/Segundo-Cerebro/pull/120). Um check verde isolado não qualifica a união nem substitui os critérios do ticket.

## Ações executadas

**OBSERVADO:** a consulta inicial encontrou25PRs em rascunho:14com todos os checks aprovados, três com skip e oito com falha. Após revisão individual,20foram encerradas sem merge e a fila passou para cinco. As primeiras cinco abaixo são ancestrais integrais de `a4fabf7a6df7b652584fb55441ecf6a2cc1acd30`, com zero commits exclusivos. Cada head foi reconferido na API; os comentários preservam a rastreabilidade:

| PR fechada | Entrega consolidada | Registro |
| --- | --- | --- |
| #100 | Base do redesign | [Comentário](https://github.com/kauanbarateli/Segundo-Cerebro/pull/100#issuecomment-6392459409) |
| #105 | Homologação e onboarding | [Comentário](https://github.com/kauanbarateli/Segundo-Cerebro/pull/105#issuecomment-6392458602) |
| #117 | Composição do MVP | [Comentário](https://github.com/kauanbarateli/Segundo-Cerebro/pull/117#issuecomment-6392457850) |
| #118 | Canais de Metas | [Comentário](https://github.com/kauanbarateli/Segundo-Cerebro/pull/118#issuecomment-6392457247) |
| #119 | Imagens de Metas | [Comentário](https://github.com/kauanbarateli/Segundo-Cerebro/pull/119#issuecomment-6392456564) |

Não houve merge dessas PRs. Suas branches/worktrees foram preservadas: há checkouts registrados, dependências históricas e a homologação em uso.

A #106foi encerrada como landing substituída:seis dos sete paths são exatos no candidato0785; Vercel foi composto. A #47foi encerrada como planejamento reconciliado e a #45como handoff histórico superado. A #45não está integralmente absorvida:37paths permanecem consultáveis no head original. #89/#90foram arquivadas como propostas financeiras v0 substituídas por CURRENT27; seus calculadores/testes/documentos únicos e as notas históricas continuam nos heads originais, sem alegar equivalência integral.

Nove degraus adicionais foram reagrupados por contenção Git exata, com zero commits exclusivos fora dos respectivos topos:

| Degraus encerrados | Topo preservado | Uso atual |
| --- | --- | --- |
| #102/#103/#107/#110/#112 | #114, head057ec5b | Referência de restore para reconciliar o delta com a #120. |
| #108/#109/#111/#115 | #116, head044432e | Referência financeira para reconciliar o delta com a #120. |

Isso não prova absorção em Root ou prontidão para Main. Os corpos dos dois topos registram os Sources, comparações e issues pendentes. Bases, branches e worktrees foram preservados; nenhum head antigo foi mesclado para recuperar código já evoluído.

A #101também foi encerrada como preparação histórica sucedida pela #120:19/28blobs preservados, nove evoluídos e nenhum ausente. Não há declaração de ancestralidade ou igualdade integral. Aceites móveis, humanos e de segurança continuam nas #12/#44/#104; fechar o baseline preparatório não os concede.

Sete outras branches remotas foram excluídas atomicamente, com dry-run, leases dos heads exatos e conferência posterior de ausência. Todos os commits permanecem na Main `336e1b7c2a2f5efba871eb0ad461b04bba065c41`; nenhuma tinha PR consumidor, worktree ou alias ativo. A lista remota passou de50para43heads:

- `codex/calendar-canonical-origin-20261021`
- `codex/ci-finance-period-20261021`
- `codex/ci-habits-vertical-20261021`
- `codex/ci-private-images-20261021`
- `codex/kanban-e-diagnostico-20261021`
- `codex/restore-first-failure-context-20261021`
- `codex/spec08-main-reconcile-20261021`

A conferência Vercel foi somente leitura:17aliases, paginação completa, todos vinculados aos deployments consultados;13refs protegidas e nenhuma implantação pendente observada. Preservaram-se produção/main, homologação e referências de protótipos ainda publicadas. Posteriormente, os sete refs locais correspondentes também foram removidos com `git branch -d`, após conferir head exato, ausência de worktree e contenção em Root. Não foram apagados deployments, arquivos, worktrees ou dados. O [recibo público](evidence/repository-hygiene-20261024.json) fixa heads e ações.

## Fila que permanece

Restam #120(candidato de integração), #114(referência de restore), #116(referência financeira) e #83/#84(contratos comerciais fora da execução vigente). As diferenças dos topos legados exigem confronto por Source; não foram declaradas absorvidas por porcentagem de arquivos iguais. Os materiais históricos fechados continuam acessíveis por SHA e pelos comentários.

As issues #7e#80receberam os aceites parciais comprovados de [Auth](auth-api-current27-20261024.md) e [onboarding](onboarding-hosted-feedback-a8e-20261024.md). Não foram encerradas: critérios remanescentes continuam explícitos. O CI do0785encerrou19/20runs e21/22jobs SUCCESS, com533E2E aprovados e TypeError na captura. [Diagnóstico e próximas verificações](capture-origin-a8e-20261024.md). A #120eprodução permanecem bloqueadas até as validações aplicáveis.

## Regra para as próximas entregas

Reutilizar a PR de integração para correções do mesmo candidato. Abrir outra PR quando houver escopo independente e delta revisável. Antes de fechar por substituição, registrar destino, Source e diferenças; antes de excluir uma branch, conferir head atual, contenção dos commits, PRs, worktrees e deployments. Fechar issues somente com todos os critérios comprovados, separando implementado, validado e pendente. Nunca excluir WIPs ou referências ativas como parte de uma limpeza automática.
