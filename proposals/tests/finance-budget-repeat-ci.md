# Gate SQL descartável — Financeiro #78-A V2

Pacote separado do onboarding026 e do freeze financeiro. Não é migration, não instala banco hospedado e não altera o helper original `local-canonical-sql.ts`.

Root deve copiar os dois novos TypeScript para o checkout de revisão Financeiro que contenha os 15 paths do freeze V2, manifesto `48d2a1c7ee6a9f9b016ac21ae0aa14546f642d2dec7ddb4ff08d2fea361b98d4`. A cadeia canônica deve conter exatamente001–025, terminando em `20261022042501_spec08_capture_knowledge_promotion.sql`. Uma026 já promovida é recusada: este gate prova o delta Financeiro isolado, antes de integrar migrations posteriores.

O helper confere os hashes SHA-256 dos dois SQL V2 com normalização exclusiva CRLF→LF; remove apenas cada aborto DRAFT literal e único. Preserva o pin original `eac90c…245c`, os dois anchors exatos, a transação BEGIN/COMMIT do patch e BEGIN/ROLLBACK dos asserts. Nenhuma definição observada em PGlite é usada para repinar o banco.

Execução proposta exclusivamente no GitHub, um processo por vez e Node24:

```text
npx vitest run tests/adapters/finance-budget-repeat-sql.test.ts --maxWorkers=1
npx eslint --max-warnings=0 tests/helpers/finance-budget-candidate-sql.ts tests/adapters/finance-budget-repeat-sql.test.ts
npm run typecheck
```

Os asserts SQL reais conferem 12 limites em competências consecutivas, 12 eventos e um recibo; replay e stale sem alteração; ataques coerentes movendo os BEFOREs para outra categoria ou intervalo; rollback após linhas parciais e após todas as linhas/eventos antes do recibo. O teste TypeScript confere positivamente o estado posterior ao ROLLBACK: zero usuários, sessões, perfis, roles, budgets, categorias, transações, eventos, recibos, revisões, funções temporárias e triggers da fixture; também confere owner/SECURITY DEFINER/search_path e ACL pública preservados. O transporte HTTP não possui fallback de rede.

Isso é prova serial do contrato SQL em PostgreSQL WASM. Não prova duas sessões PostgreSQL nativas, execução por PostgREST/GoTrue, Core/UI, homologação conectada ou mobile. A fixture operacional é executada como `postgres`; a conferência das ACLs não representa uma requisição real com credencial de serviço. Preservar esses limites no relatório. Não há execução local/SQL/PGlite já realizada pelo autor deste pacote.
