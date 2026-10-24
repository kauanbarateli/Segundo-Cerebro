# Peer independente dos três ajustes E2E do Financeiro

Data: 2026-10-24. Parecer estático favorável, sem bloqueador objetivo no recorte. Não executei Node, browser, SQL, CI ou rede, nem alterei os três arquivos. Não atribuo PASS às oito falhas anteriores nem ao candidato futuro.

Comparei o diff público do WT Segundo-Cerebro-mvp-goals-terminal-20261023 contra 799b7426b088f88ae3e0aa04c8d256df21fe371d. O diff contém somente sete substituições de linha: dois mounts, três referências de rótulo em finance.spec.ts, uma lista CSS e um rótulo no spec SQL.

## Correlação com os originais

Log PUSH original: run 40075313066/job 120817278526, arquivo run-40075313066-job-120817278526-original.log, 1.176.444 bytes, SHA256 87afc094f5b7d2c4d27cba4b3cd226adb6c5f0c5aa71ce3aac81f07c7201400e. Consultei os trechos 14211–14647. A síntese desse original registra oito falhas, 499 aprovações e dois casos não executados; isso não é o encerramento de toda a coorte.

1. finance-goals-workspace.spec.ts:53 e :68 acrescentam apenas terminal:"normal". Os originais :52/:67 falharam porque o botão exato Encerrar esta tentativa não existia (toBeDisabled, 5 s; click, 30 s). Na fixture, a capacidade agrupada status/settle só é exposta quando options.terminal existe (:81); o presenter só oferece settle com essa capacidade e pending lógico (:31/:110 de goals-panel.tsx). O novo parâmetro habilita a configuração sintética que os cenários já exigiam, sem trocar o pending, mode no-receipt ou hostRefresh. A fixture usa capture/receive/consume nominais antes de retirar pending, mantendo sua limitação RAM explícita; não cria prova de HTTP, SQL ou durabilidade. Os asserts de exclusão, ausência de execute/stage/attempts/ack no primeiro caso, falhas de refresh e nova revisão humana no segundo permanecem iguais.

2. finance.spec.ts:41/:73/:83 substituem somente o nome acessível Orçamentos por Planejamento. As quatro falhas originais correspondem aos dois cenários instanciados em 320/1280 px, ambos esperando o link antigo no navigation Seções financeiras. TAB_LABELS.orcamentos é Planejamento na fonte atual; FINANCE_TABS e financeHref continuam usando orcamentos como chave de URL. Mantêm-se a edição e lixeira, alerta limite atingido, máscara, ausência de gráficos, privacidade da URL e foco. O timeout de 90 s no CRUD e os limites restantes não mudam.

3. issue26-27-finance-sql.spec.ts:34 declara o caminho literal src/components/features/financeiro/goals/goals.css no conjunto CSS existente. Os dois originais :325/:461 recusaram exatamente esse elemento extra em assert.deepEqual (:78); goals-panel importa esse CSS. A igualdade ordenada dos conjuntos, confinamento relativo dentro de src, ausência de imports dinâmicos/externos e demais guards continuam idênticos. Não há wildcard nem descoberta usada como autoridade da cascata. A substituição de rótulo :603 segue o mesmo TAB_LABELS real, preservando a chave orcamentos, máscara, contratos SQL/ledger e asserts. timezone UTC e retries:0 permanecem intactos.

## Bytes revisados

| Arquivo | Bytes | SHA256 |
| --- | ---: | --- |
| tests/e2e/finance-goals-workspace.spec.ts | 33694 | a83c3ed676cbcc70fbf0ce4e6a79d0bb23ee6071d453ad482bfb2317ba68460c |
| tests/e2e/finance.spec.ts | 40062 | 24ab3ed91d04d12173d10f3d8767190e8e3ef04316db35fa010c6acf5971d250 |
| tests/e2e/issue26-27-finance-sql.spec.ts | 64272 | b9faa5bfd18b84cd2f252be8dfe70e112e84dbd8f3f8b513d71abeee7378098a |

Todos os asserts, guardas, timeouts, retries e URLs permanecem fora do delta, exceto os sete ajustes literais descritos. Não revisei arquivos mutáveis de outras frentes. O resultado é elegibilidade estática para nova execução própria; render, integração e os casos ainda não alcançados pelo original continuam pendentes.
