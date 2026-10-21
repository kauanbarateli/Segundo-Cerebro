# #79 — integração isolada da apuração de reservas

Refs #79. Part of #71. Fonte congelada `c74fc5774435ac0863dcf9f929c3fdaaca71f7c3`, filha direta do planejamento `ffc47c40629560ade9b39dfdfa91cf37641b9ae6`. Integração na base de CI `eab708f35dfc8ef47962a904b09b602c51b2373c`, preservando as outras PRs, main e os saldos existentes.

## Implementado

Os quatro blobs da entrega foram conferidos por bytes brutos Git e SHA-256 contra o manifesto `f34152721cb2f2da6f76c359d58971e1918dcdd90055137a52187e1e928a2c8d` e permanecem idênticos. A apuração aceita apenas o conjunto declarado de aportes/liberações: valida vínculos internos e devolve restantes e subtotais líquidos, inclusive zero. Não comprova autenticação, propriedade real de Conta/Meta, completude, elegibilidade ou disponibilidade.

O único novo módulo de produção é `src/core/financeiro/goal-reserves.ts`, alcançado pelo barrel existente. As dependências `contracts/base` e `financeiro/arithmetic` já pertencem aos grafos. Inventários finitos e mirrors TypeScript passam de 379/61 para **380/61** em Admin, de 209/60 para **210/60** em Recovery e de 242/50 para **243/50** no coletor legado. Testes exigem o path nominal e recusam omissão ou identidade Git inválida. Seeds, dependências, limites, comparação de hashes e oráculos permanecem. O coletor legado não reintroduz Drive nem habilita seu ensaio.

Somente três correções compartilhadas já revisadas acompanham a fatia: orçamento global de 20 minutos do job geral, relógio contextual de um teste sintético de autoridade e diagnóstico fechado do exit code de Admin. Nenhum deadline de cenário, regra de quiescência, cleanup ou condição de aceite foi flexibilizado. A guarda de deployment da branch é `false` antes do primeiro push; a base da PR deve ser a branch isolada `codex/ci-spec08-base-20261021`, não main.

## Validação

Revisão estática própria e independente, ancestralidade, quatro hashes de blobs e diff-check. Nenhum Node/npm, teste, compilação, lint, build, navegador ou banco executado nesta máquina de 8 GiB. Teste preparado não é PASS; os resultados de outras PRs não são transferidos.

O SHA publicado requer os workflows originais no GitHub: unidade UTC/São Paulo, tipos, lint, camadas, scanners, scripts/coletores, build, E2E e provas nativas descartáveis. Os resultados e os SHAs efetivamente executados devem constar na PR e na issue. Falhas, cancelamentos ou limites da prova permanecem registrados.

## Pendente

Disponível para uso, catálogo/persistência de Metas, autorização e lock do conjunto completo, aportes/liberações com eventos e recibos atômicos, concorrência e replay, imagens, UI e retenção/export/backup/restore continuam fora desta apuração. Dependências completas #72/#77 e aceites #79/#71/#81 permanecem abertos. Sem saldo, patrimônio, consumidor, executor, CAS, migration, aplicação remota, merge, deploy ou alteração de plano.
