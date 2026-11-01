# Reconciliação do banco — evidência inicial da issue #134

Base de código: `bd35288404c493d1b03f7a1a0208f808cc2079a2`. Esta evidência é parcial: **não autoriza novas migrations remotas nem fecha a issue**.

## Reproduzido localmente

Em banco PGlite descartável e sem conexão remota, `node scripts/test-local-sql.mjs` aplicou as 27 migrations canônicas e executou as asserções locais. O catálogo canônico retornou **2.512 verificações, zero desvios**. O próprio script explicita que usa fixture de Auth e não reproduz o serviço real de Auth/Storage ou concorrência remota. O resultado não é evidência de equivalência completa com produção nem de comportamento do patch operacional.

## Referência de produção observada anteriormente

A [auditoria de leitura da Frente B](https://github.com/kauanbarateli/Segundo-Cerebro/blob/codex/plano-entrega-inicial-20261031/docs/planejamento/20-entrega-inicial-20261031/base-planejamento-completo/16-auditoria-supabase.md) identificou cinco entradas no ledger para 27 arquivos, com estruturas posteriores no catálogo. Uma nova leitura do MCP pessoal confirmou a URL `rishenjoikgmfubmnfiu.supabase.co`, as mesmas cinco entradas e o catálogo bruto com **2.512 verificações, uma divergência** em `public.onboarding_call`. A consulta de classificação [verify-onboarding-conflict-code.sql](../../supabase/operations/verify-onboarding-conflict-code.sql) retornou `ok=true` no mesmo projeto: corpo PT409 normalizado, metadados e grants correspondem ao patch versionado. A cadeia canônica local mantém o wrapper original.

Não reaplicar as 22 migrations não registradas, não reparar ledger em lote e não reverter o PT409 para satisfazer o catálogo antigo. Preservar assinatura, grants e erro HTTP 409 do patch.

### Proveniência encontrada nos registros do repositório

- **001–005:** aplicações supervisionadas pelo MCP e correspondência no ledger atual, documentadas em [T-013](t013-aplicacao-supabase.md), [T-015](t015-transacoes.md) e [atividade](t015-t016-validacao.md).
- **006–019:** a [OP-009](decisoes-operacionais.md) e o [pré-corte 020–025](corte-migrations020-025-20261022.md) registram aplicações manuais históricas sem entradas no ledger do MCP. O [catálogo pré-corte](evidence/hosted-preflight019-before-cutover-20261022.json) e a conferência atual sustentam o estado final observado, mas não provam o recibo individual de cada arquivo histórico.
- **020–027:** o [registro de 30/10](retomada-aceites-20261029.md#aplicação-em-produção-rishenjoikgmfubmnfiu-30102026) documenta aplicação pelo mantenedor no SQL Editor, na ordem, seguida de catálogo com 2.512 checks sem desvios antes do patch. Registra as variantes com normalização de fim de linha em 025–027 e a aplicação separada do PT409. Esse canal explica por que elas não aparecem no ledger do MCP; o registro não substitui recibos nativos por arquivo.

As evidências explicam o mecanismo da diferença e sustentam o catálogo final para os objetos verificados. Não constituem prova criptográfica de todos os bytes executados em 006–027. A tabela de hashes da auditoria preserva a identidade das fontes locais, não inventa hashes de execução remota.

Na conferência complementar, os SHA-256 das 27 fontes canônicas, com normalização CRLF/LF, coincidiram com os 27 hashes da tabela histórica da auditoria. A correspondência comprova a estabilidade das fontes locais entre as duas análises; não transforma os hashes locais em recibos de execução no servidor.

## Comparação atual em QA

Após autenticação da conexão dedicada, a URL retornada identificou `twrydxsdemaykgvdlpyd`. O ledger de QA contém 27 entradas com nomes `m001` a `m027` e versões atribuídas no momento da instalação; os mapeamentos históricos estão em [homologacao-twry-20261022.md](homologacao-twry-20261022.md). Não confundir esses números de versão com os nomes de arquivo canônicos.

Em leitura, o mesmo catálogo canônico retornou 2.512 verificações e a mesma divergência única do wrapper. O classificador independente do PT409 retornou `ok=true` também em QA. Assim, os resultados atuais dos checks de catálogo coincidem nos dois ambientes, com a exceção operacional reconhecida; isso **não demonstra proveniência das 22 migrations ausentes no ledger de produção**, equivalência de dados, backup nem comportamento HTTP. Nenhuma migration ou fixture foi aplicada a QA nesta verificação.

O comando operacional `node scripts/operations/release-checks.mjs diagnose-patch` executa as duas consultas somente de leitura e acrescenta a classificação ao relatório de metadados. São consultas em transações separadas: a classificação é diagnóstico, não prova de instantâneo atômico. Mesmo quando o patch é reconhecido, o resultado bruto e o código de saída do catálogo permanecem falhos; outros desvios não são aceitos por esse diagnóstico. O comando `check` conserva seu contrato anterior.

## Restante para conclusão

1. Projeto, ledger e catálogo foram reconfirmados nos dois ambientes por leitura; ainda falta confirmar backup/recuperação sem consultar dados pessoais.
2. O catálogo comparou os objetos cobertos e os registros acima explicam o canal histórico; documentar por migration as dependências não cobertas pelo catálogo e produzir procedimento revisado que preserve a incerteza de recibos antigos.
3. A classificação separada do patch está disponível e foi conferida em leitura. Em PGlite, `node --test tests/scripts/onboarding-conflict-verifier.test.mjs` confirmou o patch, a tradução de SQLSTATE `40001` para `PT409` sem expor a mensagem interna e a recusa do wrapper canônico, corpo alterado e grant indevido. O comando `diagnose-patch` mantém o catálogo bruto e sua saída de falha; validar também os consumidores derivados e o HTTP em QA.
4. Ensaiar caminho aditivo em QA autorizado e provar o conflito HTTP 409, os fluxos Admin/onboarding e isolamento, com recuperação e reversão documentadas.
5. Só considerar reconciliado quando houver evidência suficiente de ledger e objetos, QA e procedimento revisado. O teste local desta página não equivale a esses aceites.

Nenhuma alteração de banco, ledger, dados, Auth ou Storage foi realizada para esta evidência.
