# Reconciliação do banco — evidência inicial da issue #134

Base de código: `bd35288404c493d1b03f7a1a0208f808cc2079a2`. Esta evidência é parcial: **não autoriza novas migrations remotas nem fecha a issue**.

## Reproduzido localmente

Em banco PGlite descartável e sem conexão remota, `node scripts/test-local-sql.mjs` aplicou as 27 migrations canônicas e executou as asserções locais. O catálogo canônico retornou **2.512 verificações, zero desvios**. O próprio script explicita que usa fixture de Auth e não reproduz o serviço real de Auth/Storage ou concorrência remota. O resultado não é evidência de equivalência completa com produção nem de comportamento do patch operacional.

## Referência de produção observada anteriormente

A [auditoria de leitura da Frente B](https://github.com/kauanbarateli/Segundo-Cerebro/blob/codex/plano-entrega-inicial-20261031/docs/planejamento/20-entrega-inicial-20261031/base-planejamento-completo/16-auditoria-supabase.md) identificou cinco entradas no ledger para 27 arquivos, com estruturas posteriores no catálogo. Seu resultado bruto de catálogo tem uma divergência: o wrapper de onboarding está na variante operacional PT409, enquanto a cadeia canônica local contém o wrapper original. Não foi feita nova leitura remota nesta execução; números e estado são da auditoria de 31/10, não uma verificação atual.

Não reaplicar as 22 migrations não registradas, não reparar ledger em lote e não reverter o PT409 para satisfazer o catálogo antigo. Preservar assinatura, grants e erro HTTP 409 do patch.

## Restante para conclusão

1. Reconfirmar projeto, ledger, catálogo e backup/recuperação por leitura autorizada, sem consultar dados pessoais.
2. Comparar por objeto a cadeia reproduzida e as substituições posteriores com o catálogo atual e os registros operacionais; produzir procedimento revisado por migration, sem presumir proveniência.
3. Atualizar formalmente a expectativa de release para distinguir a versão canônica do wrapper e o patch PT409 instalado, com as verificações de corpo e privilégios preservadas. Adaptar também os consumidores derivados do catálogo e testes de regressão.
4. Ensaiar caminho aditivo em QA autorizado e provar o conflito HTTP 409, os fluxos Admin/onboarding e isolamento, com recuperação e reversão documentadas.
5. Só considerar reconciliado quando houver evidência suficiente de ledger e objetos, QA e procedimento revisado. O teste local desta página não equivale a esses aceites.

Nenhuma alteração de banco, ledger, dados, Auth ou Storage foi realizada para esta evidência.
