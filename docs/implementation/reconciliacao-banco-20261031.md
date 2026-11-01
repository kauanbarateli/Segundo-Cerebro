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

O [mapa por migration](reconciliacao-migrations-mapa-20261031.md) relaciona cada arquivo e hash local à versão observada em QA e ao registro disponível em produção. Os efeitos cobertos pelo catálogo foram comparados em conjunto, inclusive substituições posteriores; não se infere que o catálogo ateste efeitos transitórios ou recibos históricos ausentes.

## Comparação atual em QA

Após autenticação da conexão dedicada, a URL retornada identificou `twrydxsdemaykgvdlpyd`. O ledger de QA contém 27 entradas com nomes `m001` a `m027` e versões atribuídas no momento da instalação; os mapeamentos históricos estão em [homologacao-twry-20261022.md](homologacao-twry-20261022.md). Não confundir esses números de versão com os nomes de arquivo canônicos.

Em leitura, o mesmo catálogo canônico retornou 2.512 verificações e a mesma divergência única do wrapper. O classificador independente do PT409 retornou `ok=true` também em QA. Assim, os resultados atuais dos checks de catálogo coincidem nos dois ambientes, com a exceção operacional reconhecida; isso **não demonstra proveniência das 22 migrations ausentes no ledger de produção**, equivalência de dados, backup nem comportamento HTTP. Nenhuma migration ou fixture foi aplicada a QA nesta verificação.

Após a reconfirmação do endpoint QA, o ensaio isolado [qa-additive-probe-134.sql](../../supabase/operations/qa-additive-probe-134.sql) criou uma tabela de teste dentro de transação revertida, ativou RLS e retirou grants públicos. O resultado foi `rls=true`, `anon_read=false`, `authenticated_read=false` e `existing_onboarding=true`. Uma consulta posterior confirmou a ausência da tabela; o ledger manteve as mesmas 27 entradas. Este ensaio não aplica uma migration real e não substitui o teste da futura alteração, a prova de HTTP ou o backup.

Posteriormente, a migration candidata de feedback do [PR #160](https://github.com/kauanbarateli/Segundo-Cerebro/pull/160), arquivo `20261101013633_feedback_requests.sql`, SHA-256 `d89444fc9fefaec926568312953d655555709039b12e6b8934847ec3b0bac125`, foi ensaiada no mesmo QA em transação revertida: os `BEGIN`/`COMMIT` do arquivo foram substituídos pelo invólucro de teste com `ROLLBACK`. Durante a transação a tabela existia com RLS, sem SELECT para `anon`/`authenticated`; a RPC era inacessível a `authenticated` e executável por `service_role`. Consulta posterior confirmou ausência da tabela e da RPC, e o ledger permaneceu idêntico com 27 entradas. Não houve dados pessoais nem instalação persistente. O resultado cobre apenas essa versão exata e seus checks de catálogo/grants, não o fluxo HTTP ou a aprovação da migration.

O [registro conectado anterior em QA](retomada-aceites-20261029.md) documenta o mesmo patch PT409 instalado e respostas HTTP `409 CONFLICT` em operações de onboarding com revisão antiga, em 496–642 ms. As contas de teste foram posteriormente removidas. É evidência histórica no mesmo ambiente, e não uma nova execução ou prova da futura implementação de cadastro; a confirmação atual do fingerprint do patch liga apenas o corpo e os privilégios àquele contrato.

O comando operacional `node scripts/operations/release-checks.mjs diagnose-patch` executa as duas consultas somente de leitura e acrescenta a classificação ao relatório de metadados. São consultas em transações separadas: a classificação é diagnóstico, não prova de instantâneo atômico. Mesmo quando o patch é reconhecido, o resultado bruto e o código de saída do catálogo permanecem falhos; outros desvios não são aceitos por esse diagnóstico. O comando `check` conserva seu contrato anterior.

## Restante para conclusão

1. Projeto, ledger e catálogo foram reconfirmados nos dois ambientes por leitura. Em 31/10/2026 o mantenedor decidiu que backup e recuperação não bloqueiam esta etapa; a pendência não foi validada e está na [#158](https://github.com/kauanbarateli/Segundo-Cerebro/issues/158), vinculada à #42.
2. O catálogo comparou os objetos cobertos e os registros acima explicam o canal histórico; o mapa registra cada migration e preserva a incerteza dos recibos antigos. Para cada candidato futuro, revisar dependências e efeitos não cobertos pelo catálogo antes de qualquer aplicação; não preencher o ledger histórico artificialmente.
3. A classificação separada do patch está disponível e foi conferida em leitura. Em PGlite, `node --test tests/scripts/onboarding-conflict-verifier.test.mjs` confirmou o patch, a tradução de SQLSTATE `40001` para `PT409` sem expor a mensagem interna e a recusa do wrapper canônico, corpo alterado e grant indevido. O comando `diagnose-patch` mantém o catálogo bruto e sua saída de falha; validar também os consumidores derivados e o HTTP em QA.
4. O mecanismo aditivo e a versão identificada acima da migration candidata foram ensaiados em QA; existe prova histórica de HTTP 409. Ainda é necessário revalidar os fluxos Admin/onboarding, isolamento e comportamento HTTP do novo candidato antes de liberá-lo. Backup e recuperação foram adiados na #158 por decisão do mantenedor.
5. Só considerar reconciliado quando houver evidência suficiente de ledger e objetos, QA e procedimento revisado. O teste local desta página não equivale a esses aceites.

Após a introdução do diagnóstico separado, a execução local das suítes `release-catalog`, `release-default-acl-count`, `release-patch-classification` e `onboarding-conflict-verifier` aprovou 11 testes. Os consumidores de restore e a validação conectada do candidato futuro mantêm seus aceites próprios.

### SQL Editor e tipos de QA

`npm run check:sql-editor` passou com 27 migrations e 45 arquivos separados após manter a sonda operacional fora do diretório de asserções automaticamente empacotadas. A sonda não integra a instalação nem é executada por CI.

Uma exportação de tipos do MCP de QA retornou 62.626 bytes, SHA-256 `485db981cae7e1d5da429ef28d077768f43bc6f37fb9f3c95951547946338ee8`, igual ao export histórico registrado para QA. O arquivo versionado possui 59.546 bytes e SHA-256 `09af79f6075576ea656d59f54023dde606d8f604e3c36de34deefb0cf7e678a7`. A comparação AST existente retornou `SNAPSHOT_DIFFER`: 35 tabelas e uma view com diferenças, cinco RPCs diferentes, sem nomes adicionados ou removidos. Há diferenças de geração visíveis, incluindo `ComputedFields` e metadados do PostgREST; ainda não se concluiu se todas as diferenças são somente de representação. Não sobrescrever os tipos, desabilitar o comparador nem declarar compatibilidade sem investigar os contratos e a origem do gerador.

Uma inspeção diagnóstica em memória retirou somente `ComputedFields: never` da cópia local para identificar o restante, sem alterar arquivos ou o comparador: persistiram 19 tabelas e cinco RPCs divergentes. Entre os exemplos estão `NonNullable<Json>` versus `Json`, campos cuja projeção de escrita difere entre `never` e união com `null`, e argumentos sem parâmetros como `Record<PropertyKey, never>` versus `never`. Essas diferenças podem alterar a checagem de TypeScript e não podem ser descartadas como formatação. A análise é parcial; não autoriza atualizar tipos ou aceitar schema por esse experimento.

Uma segunda exportação, obtida pelo MCP do projeto pessoal de produção, é byte a byte idêntica à exportação MCP de QA: ambos têm 62.626 bytes e SHA-256 `485db981cae7e1d5da429ef28d077768f43bc6f37fb9f3c95951547946338ee8`. O comparador AST estrito confirmou `SNAPSHOT_MATCH` entre os dois exports; o comparador offline não comprova por si só origem ou atualidade. As duas origens foram verificadas separadamente pelos endpoints MCP.

O [registro de homologação](homologacao-twry-20261022.md#próximos-gates) já descrevia as diferenças entre os geradores MCP e CLI: omissão de `ComputedFields`, ampliação de `NonNullable<Json>`, colunas geradas descritas como graváveis e `Args: never` nas cinco funções sem parâmetros. O hash do export MCP após 027 é exatamente o mesmo observado agora. São diferenças de contrato TypeScript, não apenas formatação; adotar o export MCP apagaria proteções deliberadas. O snapshot versionado permanece a fonte do aplicativo, enquanto os exports MCP coincidentes e os resultados brutos do catálogo são evidências independentes de ambiente. O resultado `SNAPSHOT_DIFFER` do comparador estrito permanece explícito e não foi transformado em PASS.

Para migrations futuras, exportar tipos com a mesma versão e fluxo CLI do snapshot, comparar AST e revisar as diferenças funcionais. O hash histórico MCP não é autorização para ignorar novos campos ou novos exports divergentes; antes de aplicar qualquer candidato, atualizar tipos e catálogo a partir do próprio candidato e revalidar os dois ambientes.

Nenhuma alteração de banco, ledger, dados, Auth ou Storage foi realizada para esta evidência.
