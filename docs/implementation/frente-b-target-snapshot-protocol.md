# Frente B — protocolo puro do snapshot de alvo

Preparado em 16/10/2026 para revisão de Root. Este pacote contém apenas SQL constante e validadores de frames em RAM. Não conecta, executa SQL, inicia processos, lê ambiente/perfil/archive, cria arquivo, compara A2, autentica origem ou autoriza restore. O adapter nativo de Root é uma entrega separada.

## API congelada

```js
beginTargetSnapshotSql(nonce32hex);             // string SQL constante + nonce
endTargetSnapshotSql(nonce32hex);               // guard RO, COMMIT, JSON, \\quit
parseTargetSnapshotStartFrame(bytes, nonce);    // frozen { snapshotId, facts }
parseTargetSnapshotEndFrame(bytes, nonce);      // frozen ACK validado
targetSnapshotPublicFacts(parsedStart);         // o mesmo facts frozen
TARGET_SNAPSHOT_PROTOCOL_LIMITS;
TARGET_SNAPSHOT_PROTOCOL_ERROR_CODES;
```

O nonce exige exatamente 32 caracteres hexadecimais minúsculos. É a única parte fornecida pelo caller que entra no SQL. Não há argumento para SQL, papel, identificador, banco, schema, caminho, snapshot ou configuração. Importar o módulo não possui efeitos de IO. O grafo de imports é somente `node:crypto`, `node:util` e `backup-format.mjs`; não há ciclos com planner, B2/B3/B4 ou comparador A2.

`parseStart` devolve exatamente `{ snapshotId, facts }`. `facts` contém apenas números e booleanos: versão, `protocolOnly=true`, `nativeOrigin=false`, modo readonly/repeatable-read, ator/RLS validados, três schemas presentes, número de relações/tabelas verificadas, tabelas não históricas vazias, contagens das duas histórias, `allOtherTableDataEmpty=true` e `restoreAccepted=false`. Não contém nome, OID, nonce, snapshot ID, SQL, digest ou linha de dados. O getter aceita apenas o resultado original do parser; isso identifica uma observação validada pelo parser, **sem atestar origem nativa**.

O ACK de fim conserva os campos fechados de identidade/nonce/COMMIT e o digest SHA-256 do frame original. Ele permanece privado em RAM. Seu sucesso isolado nunca substitui os eventos originais de stdin, stdout/stderr EOF, exit e close do `psql`. O digest dos bytes de início também fica em estado privado, somente como correlação; JSON válido, nonce ou hash não provam qual processo o produziu.

## SQL de início e escopo

O comando inicia `REPEATABLE READ READ ONLY`, aplica `search_path=pg_catalog`, `row_security=off`, `statement_timeout=10s` e `lock_timeout=3s`. A sessão deve estar em `postgres` com `current_user=session_user=postgres` e `rolsuper` ou `rolbypassrls`. Caso contrário, a query não executa as contagens nem exporta um snapshot aceitável. O parser recusa a identidade/modo/RLS incorretos. Esses timeouts de statements não renovam o prazo absoluto de 45 s mantido externamente por Root.

O censo tem quatro posições fixas: `auth`, `storage`, `public` presentes e `app_private` obrigatoriamente ausente. Cada relação do `pg_class` nesses schemas aparece no catálogo, incluindo índices, sequências, views e tipos compostos; não é feita uma busca apenas pelas identidades do source. Namespace/OID, ordem crescente de OID, identidades `(schema,name)`, flags e limite são conferidos. O SQL coleta no máximo 1.001 relações como sentinela; acima de 1.000, não conta tabelas nem monta um array ilimitado, e o parser recusa.

Perfil inicial conservador:

- `r` admite tabela ordinária. As duas exceções são exatamente `auth.schema_migrations` e `storage.migrations`, obrigatórias, únicas e sem associação a extension. Suas contagens precisam ser inteiros seguros, de zero a 10.000. Todas as demais tabelas precisam ter zero linhas, inclusive membros de extension.
- `S`, `v`, `i`, `c` e `t` são somente metadados; precisam de `rows=null`. Seus dados pessoais não são consultados. A qualificação posterior do TOC B4/B2 continua necessária.
- `p`, `f`, `m`, índice particionado, qualquer classe desconhecida, partição, herança ou configuração de extension recusam o escopo. Não existe fallback para ler uma foreign table, aceitar perfil novo ou excluir silenciosamente o objeto.
- Tabela de aplicação não pertencente a extension em `public` ou `app_private` recusa mesmo que vazia. Um schema `app_private` presente também recusa. Não altera o contrato do B4 para encaixar um alvo diferente.
- RLS ativo recusa. `row_security=off` com role inadequada não pode produzir um zero filtrado aceito.

As contagens usam somente `query_to_xml(format('SELECT count(*) AS count FROM ONLY %I.%I', schemaDoCatalogo, nomeDoCatalogo), false, false, '')`, e extraem o único valor COUNT via XPath. Não são selecionadas colunas de Auth/Storage, não se usa `SELECT *`, não se monta SQL a partir de texto do caller e não se exporta o XML ao cliente. A avaliação é protegida por um `CASE`: só ocorre para tabelas `r` depois dos gates de ator e catálogo; foreign/matview/configuração/escopo não qualificado não iniciam esse caminho.

Somente depois de todas as outras tabelas terem zero linhas, a mesma query executa `pg_export_snapshot()`. Um resultado sem qualificação conserva `snapshotId=null` e não pode ser aceito pelo parser. A saída é uma única linha JSON com nonce, identidade, modo, schemas, censo e contagens. Esse frame privado não pode ir a logs públicos.

## Wire e recusas

Cada parser recebe somente bytes `Uint8Array`/Buffer, até 1 MiB. Proxy, SharedArrayBuffer, buffer destacado e outros tipos recusam sem consultar getters do caller. A cópia interna de bytes é zerada ao terminar; os bytes emprestados não mudam. Como nos módulos existentes, strings imutáveis temporárias de JavaScript não possuem garantia de sobrescrita física.

Exige-se exatamente uma linha JSON completa, terminada por LF ou CRLF. A aceitação de CRLF é somente framing: o digest conserva os bytes recebidos e não existe normalização de SQL/COPY. UTF-8 inválido, BOM, bytes extras, linha dupla, truncamento, campos extras/ausentes, tipos errados e chaves JSON duplicadas — inclusive equivalentes por escapes — recusam. O scanner de duplicações tem teto de 12 níveis e 65.536 valores, antes do `JSON.parse` que apagaria a duplicação.

As classes de erro são fixas em `TARGET_SNAPSHOT_PROTOCOL_ERROR_CODES`: INPUT/FRAME/LIMIT/IDENTITY/ACTOR/MODE/RLS/SCOPE/CATALOGUE/TARGET_NOT_EMPTY/HISTORY_REQUIRED/END/START. Nenhuma inclui nome, tabela, OID, count recebido, SQL, nonce, snapshot ou causa. Root só deve capturar o código de um erro recebido diretamente da função confiável; uma propriedade `.code` fornecida por terceiros não constitui prova de erro próprio.

## Encerramento e responsabilidades do adapter

`endTargetSnapshotSql` reconfere banco, ator e modo RO/RR/RLS por um bloco `DO` fixo; depois faz `COMMIT`, emite exatamente o frame de confirmação com o mesmo nonce e termina com o comando psql literal `\quit`. Não há caractere de controle escondido. O adapter precisa usar `--no-psqlrc`, `ON_ERROR_STOP=1`, saída quiet/tuples-only/no-align e stdin aberto até o momento correto. Sem ON_ERROR_STOP, um COMMIT/frame poderia seguir um statement anterior recusado.

Root deve manter o `psql` exportador vivo enquanto **um** `pg_dump` importa aquele snapshot por `--snapshot`. O dump CUSTOM precisa conservar DDL, owners, ACLs, dependências e as duas histórias completas, sem alterar owners/ACLs para obter igualdade. As demais tabelas são vazias naquele snapshot; não basta uma contagem feita antes em outra transação. Pg_dump CUSTOM tem stdout binário próprio no Windows; não é necessário ampliar o helper B3 de 20 MiB.

O consumidor nativo precisa manter separados os fatos originais dos dois processos; frame/READY/kill/close ACK não são EOF. Um único prazo herdado cobre começo, dump, fim e cleanup. O adapter precisa recusar stderr/saída fora do contrato, limites, timeout, falha tardia ou produtor que não confirmou seus terminais. Guards devem permanecer depois da aparente conclusão; nenhuma contagem ou parser cria um receipt nativo.

DDL concorrente ainda pode causar erro ou mudar a visão de funções especializadas do backend: PG18 documenta essa janela. As leituras COUNT ordinárias conservam os locks de leitura adquiridos até o fim da transação, mas isso não é uma trava global de DDL. Usar janela própria do alvo isolado e recusar inconsistências, sem retry automático. Depois de fechar o snapshot, essa observação não prova que o banco continuará vazio; o consumidor de importação exige sua própria reconferência transacional de vazio/ator/permissões. Não há autorização para importar neste pacote.

## Validação e limites

QA somente RAM e fonte pública: comandos/nonce, shape, digest/framing, byte ownership, UTF-8/duplicações, tetos antes de parse volumoso, actor/RLS/modos, census completo/IDs/nomes, duas histórias obrigatórias, nenhuma outra tabela com dados, extensions, classes e ACK final. Há canários nos vetores recusados.

Com semáforo de Root, o autor executou Node 24.19.0/concurrency1. A primeira execução teve 22/23 PASS: um teste ainda consultava `.relations` do retorno anterior à API enxuta. Ajustada somente essa asserção para confirmar a ausência do catálogo no retorno e os facts validados, a suíte passou **23/23**, zero skips/falhas, em 138 ms. ESLint dos dois `.mjs` passou com zero warnings. O módulo de produção não foi alterado para satisfazer esse failure da fixture. Esses resultados são próprios do autor e não comprovam SQL real, origem nativa ou CI hospedado; Root/peer mantêm sua revisão independente.

Não foi executado psql, PostgreSQL, banco remoto, snapshot exportado, dump, comparação A2, importação ou SQL real por esta entrega. Os materiais `contrato-a2-inventario-restore.md`, `frente-b-target-baseline.md` e handoff seção 4 continuam vigentes.

## Referências primárias

- [PostgreSQL 18 — pg_dump, opções e snapshot](https://www.postgresql.org/docs/18/app-pgdump.html): vínculo ao snapshot, opções de schema, owners/ACLs e modo CUSTOM.
- [PostgreSQL 18 — sincronização de snapshots](https://www.postgresql.org/docs/18/functions-admin.html#FUNCTIONS-SNAPSHOT-SYNCHRONIZATION): disponibilidade do ID somente enquanto a transação exportadora permanecer aberta.
- [PostgreSQL 18 — SET TRANSACTION](https://www.postgresql.org/docs/18/sql-set-transaction.html): snapshot importado no início de transação RR/serializable e restrições READ ONLY.
- [PostgreSQL 18 — XML](https://www.postgresql.org/docs/18/functions-xml.html#FUNCTIONS-XML-MAPPING): `query_to_xml`, formato `table/row` com tableforest=false e namespace vazio.
- [PostgreSQL 18 — LOCK](https://www.postgresql.org/docs/18/sql-lock.html): locks de tabela duram até o fim da transação.
- [PG18.4 — pg_dump.c](https://github.com/postgres/postgres/blob/REL_18_4/src/bin/pg_dump/pg_dump.c): RR/RO, importação de snapshot, risco de DDL concorrente e tratamento de extension configuration tables.
- [PG18.4 — pg_backup_archiver.c](https://github.com/postgres/postgres/blob/REL_18_4/src/bin/pg_dump/pg_backup_archiver.c): `_allocAH` configura stdout binário para formato de archive no Windows.
