# Catálogo: contagem semântica dos defaults do bootstrap — 23/10/2026

Estado: **implementado e validado em PGlite; pendente de CI nativo PG17 e revisão de integração**. Nenhuma migration ou operação remota foi executada nesta fatia. O aceite de produção permanece bloqueado.

## Evidência e limite do diagnóstico

**OBSERVADO:** o Foundation do PUSH original `394910b94a3f6075b50d37297b7c2f7323101cd0` emitiu `foundation-catalogue-observation` com `checks:1723`, `ok:true` e `deviationCount:0`. O PR, cujo checkout era `110c49bdb15550f584200c800cf86a2cd75793c8`, observou o mesmo resultado. A recusa seguinte foi o portão exato de 1.720; o valor zero no recibo final de falha não demonstra que o SQL do catálogo estava malformado. Os logs preservam o resultado intermediário anterior à recusa.

| Evidência original preservada | Bytes | SHA-256 |
| --- | ---: | --- |
| `run-39991613915-job-120544490070-original.log`, linha 488 | 50.144 | `10e1c05857a4b72208de237ea3af4a86f72583bc208b9cb369027e5c7bf814b3` |
| `run-39991622443-job-120544518047-original.log`, linha 497 | 50.386 | `08bbf19c4d0633de7a58e3d95805162e4cfa75e52b30f7953056fd3bd6bc6480` |
| `original-final-envelope-projections.json` | 8.677 | `1efd330c049f89ce347a68f55a686e34087291fa909585890b50ce623e245cc5` |

Esses arquivos públicos de execução estão no diretório operacional ignorado `work/ci-capture-write-20261021/20261023-ci-review/394910b-own-originals/` do checkout principal. O SQL original registrado no PUSH tinha SHA-256 `e884dd21e93a9fae8b1984b05816a0ade50cb8a9c4494068c16a7fb32ffa8326`.

**INFERIDO:** os três candidatos são os defaults de objetos `public.r`, `public.f` e `public.S` pertencentes a `postgres`, contendo somente entradas cujo concedente e destinatário são o próprio `postgres`. O bootstrap público do Supabase concede defaults para tabelas, funções e sequências. As migrations históricas 001/016 retiram os destinatários públicos/API; podem permanecer entradas do dono. PGlite começa sem essas três linhas. `default_acl_closed` produz um check por linha, portanto essa diferença explica exatamente três checks a mais.

Os logs originais não contêm o inventário das identidades: **não provam individualmente quais eram as três linhas**. O bootstrap consultado é a fonte pública atual, não uma atestação da imagem de CI. Esta alteração não depende de aceitar cegamente a hipótese ou o número 1.723. Uma consulta somente leitura da homologação também não forneceu inventário: a conexão recusou o refresh OAuth antes de executar SQL. Nenhum resultado hospedado foi obtido ou usado como substituto do CI.

## Contrato aprovado

O conjunto de checks e seus predicados continuam completos. `bool_and(ok is true)` e a lista de desvios recebem **todas** as linhas originais. Somente o campo numérico `checks` deixa de contar uma linha `default_acl_closed` quando, simultaneamente:

1. o check original está aprovado;
2. `defaclrole` é o OID de `postgres`, e `defaclnamespace` é o OID de `public`;
3. `defaclobjtype` é exatamente `r`, `f` ou `S`;
4. a ACL não é vazia e `aclexplode` encontra entradas;
5. **todos** os OIDs de concedente e destinatário são o OID do dono `postgres`.

O catálogo do PostgreSQL tem identidade única por dono, namespace e tipo. Consequentemente, a classe fechada contém no máximo três linhas. A comparação usa OIDs; um nome arbitrário não é interpretado como destinatário permitido.

Uma ACL vazia não satisfaz a classe: o `CASE` testa a cardinalidade antes de chamar `aclexplode`. Uma ACL inválida ou de formato inesperado não é convertida em aprovação. Este delta não altera o predicado histórico `default_acl_closed` nem amplia suas regras.

Entradas com PUBLIC, `anon`, `authenticated` ou `service_role` continuam contadas e geram os mesmos desvios. Outro dono, concedente, destinatário, namespace ou tipo continua contado. Um destinatário desconhecido que já era aceito pelo predicado histórico continua sem ser rotulado falsamente como API: seu check adicional reprova o portão exato de 1.720. Não existe aceitação `1720|1723`, tolerância de contagem, filtro de desvios, alteração de permissões ou repin de corpos de função.

Esta normalização trata uma variação delimitada do bootstrap. Não afirma que qualquer default do dono ou qualquer ACL global tenha semântica intercambiável; defaults por schema e defaults globais possuem regras próprias no PostgreSQL.

## Paths e integração restrita

- `supabase/tests/release-catalog.sql`: acrescenta uma CTE de classificação e um `FILTER` somente no `count(*)` final. O relatório mantém versão 1 e seus quatro campos. Nenhum check é retirado de `checks`.
- `supabase/tests/release-default-acl-observation.sql`: diagnóstico opcional, somente leitura, com rollback. Retorna somente enums de schema/tipo, contagens, candidato booleano e digest da ACL; não inclui nomes arbitrários de destinatários, conteúdo de funções, dados pessoais ou escrita. O diagnóstico não participa do aceite.
- `tests/scripts/release-default-acl-count.test.mjs`: controles do próprio predicado SQL e do catálogo real em WASM, usando o helper canônico existente. Não acrescenta imports ou fontes ao runner Foundation.
- este documento: parecer, contrato, evidência e limites.

**RECOMENDADO:** incorporar o SQL por patch contextual dos dois hunks, nunca copiando o arquivo inteiro deste checkout. A base de autoria é `394910b…`, que contém o pin antigo da 026 (`a7531d…`). A frente principal já validou a 026 de retenção `e62727f4aa3a2f56948bf3a3c2f4ec24b1a8278ac3bef07591424b1ba422e697`; esse pin e os demais deltas posteriores precisam permanecer intactos. Depois do patch, conferir o diff e reconciliar os testes com a fonte 026 atual antes de publicar.

Os portões de 1.720 em `foundation-local-ci.mjs`, `capture-image-storage-local-ci.mjs` e `avatar-storage-local-ci.mjs` permanecem intocados. As regras e versões dos recibos também permanecem intactas. A próxima execução nativa deve usar o SHA efetivamente publicado; os resultados deste checkout não certificam esse SHA futuro.

## Validação executada

**OBSERVADO:** Node 24.19.0, um processo de cada vez, heap de 256 MiB, testes sem isolamento de processo e sem concorrência; PGlite local, sem rede, serviços, segredos, contas reais ou PostgreSQL remoto.

Dois testes passaram em **21.133 ms**:

- o predicado extraído diretamente do SQL aceita apenas os três tipos na classe fechada; recusa ACL vazia, dono/concedente/destinatário diferente, PUBLIC/API, schema global/privado e tipo adicional;
- o catálogo completo começa com 1.720 checks, zero desvios; com os três defaults reais de dono continua em 1.720. A mesma consulta com contagem bruta observa 1.723, demonstrando que os checks continuam presentes;
- 12 controles de permissões (três tipos × PUBLIC/anon/authenticated/service_role) voltam a contar a linha inválida, emitem desvio e reprovam o portão; após cada restauração, o relatório original é reconferido integralmente;
- destinatário desconhecido, tipo adicional e schema privado mantêm a contagem extra e reprovam o portão exato. O diagnóstico tem DTO fechado e não expõe o nome do destinatário de teste;
- ao final, `auth.users`, `domain_events` e `command_receipts` têm zero resíduos.

O log final ignorado `catalogue-count-controls-v4-20261023.log` tem 388 bytes e SHA-256 `33227199e908c62b07b54f92c851d55e0979062174534481082249a42107ee99`. Os logs anteriores foram preservados: v1 recusou o esquema de URL do loader antes de carregar testes; v2 revelou um alias no teste isolado; v3 revelou a necessidade do `CASE` para ACL vazia. Essas ocorrências foram corrigidas sem diminuir os negativos nem transformar falhas anteriores em PASS.

Com dependências instaladas normalmente, executar no checkout revisado:

```powershell
node --max-old-space-size=256 --test --test-isolation=none --test-concurrency=1 tests/scripts/release-default-acl-count.test.mjs
```

O ensaio nesta máquina usou um bridge ignorado com resolução exata para as três dependências PGlite do helper, porque o worktree não possui `node_modules`. O bridge não é dependência de produção nem do CI e bloqueia `fetch`. A verificação sintática do MJS passou em Node 24.19 (heap 128 MiB). Lint, catálogo atual com 026 reconciliada, Foundation em PG17, recibos originais do novo SHA e revisão independente continuam sendo gates próprios da integração. Nenhum teste local equivale a aceite hospedado.

## Fontes primárias

- [PostgreSQL 17 — pg_default_acl](https://www.postgresql.org/docs/17/catalog-pg-default-acl.html): identidade do catálogo, tipos e defaults globais/por schema.
- [Supabase Postgres — bootstrap initial-schema.sql](https://github.com/supabase/postgres/blob/develop/migrations/db/init-scripts/00000000000000-initial-schema.sql): três concessões iniciais por tipo de objeto; fonte atual usada para a hipótese, sem afirmar pin da imagem de CI.
- Repositório no SHA `394910b…`: migrations 001/016, `supabase/tests/release-catalog.sql` e portões existentes em `scripts/verification/`.
