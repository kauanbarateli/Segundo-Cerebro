# Extração pura E1 — peer independente

Favorável estático, sem bloqueador objetivo. Leitura dos três WIPs em Segundo-Cerebro-mvp-goals-terminal-20261023; nenhum arquivo do autor foi alterado.

| Path | Bytes | SHA256 lido |
| --- | ---: | --- |
| tests/helpers/finance-goals-images-candidate-source.ts | 1570 | 6252ee32a29051a620afe160e0bae429c5881b3dd25f41f3c1e2825a1c56d159 |
| tests/helpers/finance-goals-images-candidate-sql.ts | 938 | 8a5040778bcbe3bdc38e67f4db4d98a16538506b30501d6336cfd747b40ec530 |
| tests/scripts/finance-goals-images-source-extraction.test.mjs | 4241 | 0dbce9fe8844b46b642ada8b899fc3f9caf44b731ae467c95853bfe58bc9f8ad |

O novo Source importa apenas node:crypto, node:fs/promises e node:url. Não alcança factory, PGlite/WASM, Supabase SDK, ambiente ou transporte. O reader conserva ../../proposals/finance-goals-images/01-binding-and-lifecycle.sql e permanece na mesma profundidade tests/helpers. Importar o módulo não chama o reader nem o compiler. A futura integração no bundle nativo ainda deve provar o fecho real e a localização de import.meta.url; este peer não a antecipa.

A API anterior continua no helper SQL: os três exports de pins/reader/compiler são reexports nominais do Source, e createFinanceGoalsImagesCandidateSql permanece uma função local. Sua ordem é compilar/verificar antes de abrir a factory026, depois executar e fechar o banco no catch. Nenhuma função recebeu cópia concorrente ou nova autoridade.

## Prova mecânica independente, sem Git/runtime

Foi usado o helper público congelado de finance-goals-images-foundation-freeze-v1-20261023. A única substituição do antigo pin057d… pelo pin0d6ca… já revisado reproduz exatamente o módulo2131B/SHA9ce021ac0c9b0e29ec1ff519f9501cfe66c16e26768857bd0f5a170c2b54b158 registrado no manifesto público root-goals-images-publication-freeze-v5-20261023.json. Não foi inferida identidade de Git a partir dessa reconstrução.

As definições extraídas, normalizando somente CRLF→LF, coincidem integralmente: SHA40eba32678b259317048b586601f12bb89167902cec67a454da59c22ccc2d202. O corpo inteiro da factory coincide: SHA2753b81771879fb116ce866b4a6925aa1ae48b5363b99bba479f42b2a298c4ac. O SQL fonte conserva0d6ca0db3711d4c4899e794ba52ba34c6ed15e10ae834170ea9a5965efeadec9. A transformação literal das únicas fronteiras já revistas gera9257B/SHA48fd99fbd4e27a38938f93da3f73cd756a759a73836889355ad9135e986dc5b2. Isso foi comparação de texto/hash em PowerShell, sem chamar o compiler Node ou executar SQL.

## O que os quatro controles provam

Os testes têm observações reais: AST/imports fechados, hashes das definições/factory, reader do SQL real, saída completa pinada e equivalência CRLF. Os três negativos chegam ao veto de hash original; não provam isoladamente todos os ramos internos de validação de fronteiras. Também não testam WASM, PostgreSQL, carregamento no bundle ou instância nativa. Esses limites são compatíveis com o propósito mecânico. Os quatro PASS locais foram informados pelo Root; não foram reexecutados neste peer.

Plano de referência lido integralmente: review/plano-promocao-finance-goals-schema-20261024.md,27490B/SHA160a95f0812d3d790d772f6551080abebfaf23349fd81c47e4f45d0b26beebdf. A revisão não autoriza migration, conexão, schema, gate executável, merge ou produção. Skill Supabase foi lida; changelog/CLI/advisors permanecem para a implementação futura, pois esta tarefa é somente estática e sem rede.
