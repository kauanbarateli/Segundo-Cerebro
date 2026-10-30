# Peer estático independente — M2-N completo

OBSERVADO por leitura em 24/10/2026. Não executei Node, lint, testes, SQL, processos nativos, serviço, rede ou operação com dados privados. Não editei as fontes dos autores. Parecer favorável para a composição explícita e para CI, condicionado ao ajuste finito abaixo; não é aceite nativo nem autorização de ativação.

## Identidade

Manifesto `finance-goals-terminal-native-complete-freeze-v1-20261024/manifest.json`: SHA-256 `c1e7383632ddb917f741ff13f3728c1467058f6536da95b6daff87e8ac0e942b`. Os 11 arquivos after, seus tamanhos e SHA-256 foram conferidos contra o manifesto e o WT `Segundo-Cerebro-goals-terminal-browser-20261023`, base histórica `01ae6a7c62b8d2dbe9e295b7702d329f64ec5313`. Conferi também os quatro artefatos do freeze (patch, delta, proof e diffstat).

| Path | SHA-256 after |
| --- | --- |
| `tests/e2e-auth-local/finance-goals-terminal-native-contract.mjs` | `a077c7168b4837003c6f5f5848451b633f486abbe9dd18701d77da3c8883ca97` |
| `tests/e2e-auth-local/finance-goals-terminal-native-session.mjs` | `70a9a76fd6c44ce7f87ec62dcc48252a0c4a0e54d3acbed745070fcecd846759` |
| `tests/e2e-auth-local/finance-goals-terminal-native-sql.mjs` | `8a2a77b6b486dc34a75afce5da255c9b89f846dc06929b33c68cff487674eefa` |
| `tests/e2e-auth-local/finance-goals-terminal-native.entry.ts` | `29a6a8bf49c9929c93cee3f37646f3e68f75d7973f798de86b14d40efe714c7d` |
| `tests/scripts/finance-goals-terminal-native-contract.test.mjs` | `76501a192e4f4a68ce368a2982ea28b71e615b31663c6aa75ae82ec7a4246d66` |
| `tests/scripts/finance-goals-terminal-native-session.test.mjs` | `44d5e067f4dfb3cab5f6a961c210a1ed7d5314bcc5dda07b3ded1667fbdf43e9` |
| `tests/scripts/finance-goals-terminal-native-ci.test.mjs` | `c459988c273a80c7c48db903936a8a05b9181506047de95ee2217b130879a4bc` |
| `docs/implementation/t054-finance-goals-terminal-native-races-20261024.md` | `42adc2ec8daec81e27f90a64e310e42f5beb77ab052bdea4b6692b91d45df134` |
| `tests/e2e-auth-local/finance-goals-terminal-native-case.mjs` | `80cf720e621a891b139656a5cc68aa59d5a95157441a6904da24f70da236ea1b` |
| `scripts/verification/finance-goals-terminal-native-ci.mjs` | `8789cc225a153a3133dd5064059add20dca0d9de4fa532ef29fdc80c717202a4` |
| `.github/workflows/finance-goals-terminal-native-ci.yml` | `ff02ec884fc778a88761d3ade352e913bcaef7fa9b658bbb022cedb678c4a6b7` |

## Achado acionável antes de executar sobre70c

P2 — declarar o contrato puro extraído na allowlist do bundle. Em `scripts/verification/finance-goals-terminal-native-ci.mjs:22–26`, `GOAL_NATIVE_ENTRY_SOURCES` não contém `src/lib/finance-goals-terminal-contract.ts`. O canonical atual da Root70c (`70c5dd5d4d13d419941567c4b33d17df21990e5e`) importa/reexporta esse módulo nas linhas6–7. O coletor AST o inventaria, porém `moduleParsed` na linha105 o recusará com `GRAPH_REFUSED`, antes da stack. A correção mínima é uma entrada explícita para esse módulo puro, cujas dependências de valor já estão no conjunto (base/use-cases/validation; goal-types é type-only). Root confirmou esse delta separado. Não copiar o canonical histórico nem ampliar a HTTP, UI, journal ou factories WASM.

Esse achado é de composição com a base atual, não demonstra um PASS ou uma falha de execução do freeze histórico. Preservar Sources atuais da Root, incluindo os ajustes7fb/EOF e o LF revisado de Budget; o pacote não autoriza sobrescrevê-los ou obter pins a partir do banco. Os controles de extração dos construtores continuam exigindo reconferência textual na composição, sem alterar predicados para tolerar diferenças.

## Conferências estáticas relevantes

Não identifiquei outro bloqueador objetivo nesta leitura dos 11 paths e das dependências públicas necessárias.

- O inventário do runner é derivado por AST/blobs e limitado, sem afirmar contagem executada. O conjunto do bundle é separado e fechado por `moduleParsed`, módulo obrigatório, hash e exports; o limite de500 fontes derivadas e512 reportadas não torna a contagem dinâmica em um aceite. Uma expansão real fora desses limites deve recusar. O resultado e o número efetivamente observados só podem vir do CI próprio.
- O catálogo canônico1720/zero desvios antecede Budget→B2→Goals→M1 (`runner:145–146`). O catálogo aditivo confere OID de commit preservado, cópia histórica, grants/RLS/policies e triggers por relação/tgfoid/tgtype/tgenabled, sem reaproveitar como inalterado o catálogo canônico. As projeções usadas no case correspondem às funções `fg_account_totals`, `fg_goal_totals`, `fg_release_totals` e ao formato real de receipt/disposition. Não encontrei repin baseado em observação.
- O planejamento usa gateway/Core/store reais e captura o commit candidato, devolvendo stale; a aceitação depende do RPC nativo posterior (`case:65–72`). O OLD_EXECUTOR reconstrói batch coerente após o fence dentro da transação winner e exige23505/NAMESPACE_CLOSED no executor histórico; stale não passa (`case:91–102`). A barreira exige PID distinto, conjunto exato de bloqueadores, advisory ExclusiveLock e espera Lock, com watchdog5s (`sql:76–81`, `case:97–99`).
- Material completo de A/B, linhas não afetadas, payload/evento/receipt ou disposition, revisão derivada dos triggers, quota e totais BigInt são conferidos (`case:11–54`). Replay/status exige resultado e material idênticos (`case:103–105`). A assinatura financeira é produzida pelo canonical original; o ticket SQL somente codifica os dados, não define nova autoridade.
- O setup é local, SDK original, dois usuários comuns, três sessões verificadas por getUser/my_access_state e auth.sessions, sem Master. As permissões SDK são por chamada fechada; timeout/erro conserva unknown/pending. A limpeza usa só os IDs próprios e marcador, com ausência integral posterior (`runner:117–129`, `sql:62–75`). Não há destino hospedado, broad delete ou dado financeiro/Auth no relatório.
- Sessões exigem callback de stdin antes do ACK, um comando por vez, frames limitados, EOFs e exit/close únicos, estado sticky e confirmação positiva do grupo (`session:58–98,130–163`). COMMIT/ROLLBACK sem ACK após escrita permanece incerto. Os limites15s/120s/5s não foram elevados. Erro/kill não é recibo nem prova de ausência do backend.
- O final exige quiescência, controle independente de backends, cleanup SDK, cascatas, término do control, stop exclusivo/no-backup, inventário de labels vazio e remoção exata do bundle/temp. Falha ou incerteza não vira PASS por destruir a stack (`case:107–113`, `runner:149–165`).
- O workflow é job Ubuntu24/PG17/CLI2.120.0 com env mínimo, permissões somente leitura e sem secrets/artifacts/fallback/skip permissivo. Os26 controles puros são testes escritos e as12 famílias são confrontos escritos; isso não prova execução nem cada hipótese adversarial enumerada no plano.

## Limites e próximo gate

Recomendo Root compor somente o delta N sobre Sources atuais, acrescentar a entrada pura identificada e revisar o diff resultante; depois executar seus checks e os originais do novo SHA no GitHub. Uma recusa de grafo/catálogo/processo não autoriza ampliar limites, repinar corpos ou marcar skip como PASS. Exigir12confrontos, terminais, material e cleanup próprios do mesmo SHA. Não executar contra twry/produção nem usar esse relatório como aceite de browser, imagens, restore, rollout ou produção.