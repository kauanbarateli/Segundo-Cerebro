# #78 — integração isolada do planejador mensal

Refs #78. Part of #71. Revisão sobre a fonte congelada `d64d56e14767c46effd15fbc61c27d0545110d95`, filha direta do planejamento `ffc47c40629560ade9b39dfdfa91cf37641b9ae6`. A integração usa a base de CI `eab708f35dfc8ef47962a904b09b602c51b2373c`, sem importar funcionalidades das outras PRs nem alterar main.

## Implementado

Os quatro blobs da entrega foram conferidos por bytes brutos de Git e SHA-256 contra o manifesto `2512f1d9de5b76da914a86cefae96d13bdf67e54c54774a5ff312901579b5ac4` e permanecem idênticos. Duas revisões estáticas independentes e a leitura própria da Root não encontraram bloqueador no contrato fechado, no calendário civil, no horizonte completo ou nas chaves determinísticas.

O novo módulo é alcançado pelo export de `financeiro/index.ts`; suas três dependências já pertencem aos grafos existentes. A única adição à árvore de imports é `src/core/financeiro/monthly-plan-copy.ts`. As contagens finitas passam de 379/61 para **380/61** em Admin, de 209/60 para **210/60** em Recovery e de 242/50 para **243/50** no coletor legado. Cada coletor verifica a presença nominal; os negativos preservam a recusa de omissão ou identidade Git inválida. Dependências, seeds, limites, comparação de hashes e oráculos de aceite permanecem. O coletor legado não reintroduz Drive no MVP nem habilita sua execução.

Foram reaproveitadas somente as três correções compartilhadas já revisadas: orçamento global de 20 minutos do job geral, relógio sintético fixo em um controle de autoridade e diagnóstico fechado do exit code de Admin. Os deadlines dos cenários, as condições de falha e o programa real não mudam. A guarda `git.deploymentEnabled` desta branch é `false` antes do primeiro push.

## Validado

Revisão estática, hashes dos quatro blobs, ancestralidade, diff-check e inspeção da fronteira de imports. Nenhum Node/npm, teste, compilação, build, navegador ou banco foi executado nesta máquina de 8 GiB. Teste preparado não é PASS.

## Pendente

Executar os workflows originais no GitHub para o SHA publicado: unidade em UTC e São Paulo, TypeScript, lint, scripts e coletores, camadas, scanners, build, E2E e provas nativas descartáveis. Registrar os resultados e o SHA efetivamente executado na PR e na issue; preservar falhas e não transferir resultados de outra árvore.

Não há executor, consumidor, escrita, CAS, recibo, evento, migration, aplicação remota, recorrência ou interface nesta fatia. O planejador não demonstra atomicidade ou idempotência de persistência. A #78 completa, a dependência #77 e os aceites #71/#81 continuam pendentes. Sem merge, deploy ou alteração de plano.
