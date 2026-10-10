# Defaults de sequências — migration 016

Na conferência de 09/10/2026 em Fortaleza, o catálogo foi executado no SQL Editor do projeto pessoal `rishenjoikgmfubmnfiu`, em transação readonly com rollback. Retornou **1.246 checks e um desvio**, `default_acl_closed` / `public.S`. O check do corpo completo da função de limpeza da **015 passou**. Não reaplicar 001–015 ou bootstrap.

A consulta dos metadados confirmou 12 entradas no default de sequências de `postgres/public`: três privilégios para cada um dos papéis `postgres`, `anon`, `authenticated` e `service_role`. O [Supabase documenta esse default legado](https://supabase.com/docs/guides/deployment/branching/working-with-branches). As migrations do aplicativo usam UUIDs e não criam sequências; o resultado não demonstra acesso indevido a dados existentes.

## Correção versionada e aplicação informada

- Fonte: [20261010010955_close_public_sequence_defaults.sql](../../supabase/migrations/20261010010955_close_public_sequence_defaults.sql).
- Cópia SQL Editor: [016_20261010010955_close_public_sequence_defaults.sql](../../supabase/sql-editor/installation/016_20261010010955_close_public_sequence_defaults.sql).
- SHA-256: `add5b17ee8af3162ed893d1ac955c4fe5229707b7807d43a58b8c9124dc8e381`.
- O timestamp do arquivo usa UTC de 10/10; o evento ocorreu em 09/10 em Fortaleza.

A 016 revoga somente os defaults de **futuras sequências** de `postgres` no schema `public`, para `PUBLIC`, `anon`, `authenticated` e `service_role`. Preserva privilégios do dono, sequências existentes, demais owners/schemas, Auth/Storage, tabelas, funções e memberships. Nenhuma alteração de dados é necessária.

Defaults de schema se somam aos globais; uma revogação no schema não subtrai um grant global. A pós-condição recusa esse desvio distinto e provoca rollback, em vez de ampliar a correção para schemas gerenciados. Essa regra segue a [semântica do PostgreSQL](https://www.postgresql.org/docs/current/sql-alterdefaultprivileges.html).

O mantenedor informou a aplicação manual da **016**. Às **01:51:10.820 UTC de 10/10/2026 (22:51:10.820 de 09/10 em Fortaleza)**, o catálogo foi executado novamente no SQL Editor pessoal autenticado, em transação readonly com rollback: **`ok=true`, 1.246 checks e `deviations=[]`**. O desvio `public.S` deixou de ocorrer; o fingerprint da função da 015 também permaneceu aprovado. Isso confirma os contratos e permissões atuais, sem fabricar histórico ou hash de execução remoto.

**Não reaplicar 001–016 nem bootstrap.** Nenhuma migration, DDL ou fixture foi aplicada pelos agentes nesta conferência. Preservar fonte, cópia e manifest imutáveis. Asserções com fixtures continuam exclusivas da base descartável. O [catálogo readonly](../../supabase/tests/release-catalog.sql) hospedado está verde nesta observação; sua contagem depende dos objetos/defaults da plataforma, e a contagem local não deve ser imposta ao ambiente real. Tipos oficiais, jornadas conectadas e demais aceites continuam separados.

## Regressões locais

O [controle Node](../../tests/scripts/sequence-defaults.test.mjs) reproduz as 12 entradas: o catálogo recusa `public.S` antes da 016 e passa depois, conservando as três entradas do dono. Compara ACLs existentes, Auth/Storage, outros creators/schemas/defaults e prova rollback quando há grant global inesperado. Nenhum usuário ou objeto Storage real é usado.

A [asserção SQL descartável](../../supabase/tests/sequence-defaults.sql) cria uma única sequência sintética, prova `SELECT`, `nextval` e `setval` negados aos três papéis API e permitidos ao dono, e termina com rollback. Não executar essa asserção no projeto pessoal.

```sh
node --test tests/scripts/sequence-defaults.test.mjs
node scripts/test-local-sql.mjs supabase/tests/sequence-defaults.sql supabase/tests/release-catalog.sql
```

CI e deploy continuam sem conexão para aplicar SQL. A confirmação hosted da 015 e o fechamento do cadastro público não substituem os demais aceites de Auth, Storage, concorrência, Google, backup e aparelhos do [relatório de entrega](entrega-mvp-pendencias.md).
