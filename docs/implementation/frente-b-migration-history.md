# Frente B3 — extração limitada das histórias COPY

Implementação pura revisada por Root, em 16/10/2026. Root passou 17/17 testes próprios em Node 24.19.0 (402 ms) e lint2; dois peers revisaram a fonte e o pequeno delta de classificação sem bloqueador. Não constitui aceite do restore, comparação A2, prova de origem nativa nem autorização para importar. Nenhum conteúdo real do archive foi utilizado no desenvolvimento. Um envelope real diferente deste perfil é recusado explicitamente; não há fallback.

## API e ligação original

`migrationHistoryCopySelection(tocHandle)` retorna um array frozen dos dois IDs originais, na ordem de `ordinal` do TOC. Exige o handle nominal do B2 e exatamente duas entradas preservadas `TABLE DATA`: `auth.schema_migrations` e `storage.migrations`. Não escolhe IDs a partir dos comentários SQL. A seleção é privada, destinada à lista nativa conferida por Root.

`extractMigrationHistory(tocHandle, stdoutBytes)` é síncrona e devolve somente um handle nominal frozen `{}`. Não aceita um objeto JSON como TOC, callback, leitor, configuração, booleano de origem, resultado de processo ou autoridade. Não inicia IO, processo, rede, SQL, decompressor, comparador de alvo ou mint.

`migrationHistoryFacts(handle)` devolve fatos **privados em RAM**: binding original do B2, hash/tamanho do stdout, total do envelope e das strings decodificadas, cópia própria dos bytes, histórias e blocos com referências nominais aos registros originais, colunas na ordem original e spans de headers/payload/terminadores/linhas/campos. Os spans usam offsets de bytes no stdout inteiro; as linhas físicas contam LF desde 1, inclusive LF escapado dentro de um registro lógico. Não são relatório público.

Toda consulta revalida o digest dos bytes próprios e a identidade/integridade do handle B2 original. Descartar, alterar ou transferir o TOC original invalida a história; alterar/transferir os bytes próprios também a recusa. A validação final e os getters são síncronos, sem `await` ou chamadas fornecidas pelo input.

`discardMigrationHistory(handle)` é total e idempotente. Apaga o único store próprio do stdout e invalida o handle, sem apagar o stdout do chamador ou o TOC B2. O scratch de decodificação é apagado em sucesso e erro. Isso **não promete apagar strings JS, cópias, fatos já retidos ou backing stores transferidos externamente**. Root não deve clonar, transferir, serializar nem registrar os fatos privados; deve consultar o getter novamente imediatamente antes de qualquer comparação/consumo e descartar os dois handles ao encerrar.

## Perfil do produtor e envelope

O consumidor futuro de Root deve executar uma única extração sequencial com o `pg_restore` 18.4 qualificado, `--data-only --use-list=<dois IDs originais na ordem retornada> --file=- --restrict-key=SCBaselineV1`, sem outras opções, conexão ou credenciais PG no ambiente. Root conserva prova do mesmo archive autenticado, argv/lista original, limite/prazo absoluto, EOF e close0. Hashes e envelopes semelhantes, isoladamente, **não certificam essa origem**.

O perfil aceito tem LF, sem normalizar CRLF. Consome todos os bytes nesta ordem:

1. Banner nativo inicial, `restrict` com a chave exata, comentários de versão presentes somente quando os campos originais do header B2 não são NULL, e uma linha vazia.
2. A sequência nativa fixa de parâmetros de PG18.4. `client_encoding` é UTF8; `standard_conforming_strings` vem da entrada original STDSTRINGS. A variante `off` exige também o parâmetro nativo de avisos de escape. SEARCHPATH é obrigatório e confrontado integralmente com a definição original.
3. Exatamente dois comentários nativos não verbosos e dois headers COPY originais, cada qual seguido de payload text e terminador completo. Owner segue somente a apresentação nativa do comentário (NULL vira hífen; CR/LF vira espaço); os bytes originais continuam no TOC. Comentários são conferência de envelope, não autoridade ou identificação por dumpId.
4. O epílogo nativo completo, `unrestrict` com a mesma chave e EOF imediato. Não aceita bytes extras, comentários arbitrários, verbose, metacomandos adicionais, transações, INSERT ou outros statements.

O lexer de SEARCHPATH permite somente uma chamada `pg_catalog.set_config` com primeiro argumento literal fixo, segundo argumento um único literal comum/E e terceiro argumento `false`. Reconhece delimitadores/dobras/escapes necessários para não sair prematuramente do literal, sem executar nem normalizar seu conteúdo. Concatenação, expressão, dollar quoting, casts ou statement adicional recusam. Sua fatia completa precisa coincidir com a definição nominal.

As entradas TABLE DATA deste recorte precisam ter dumper e seção DATA; definição ausente/vazia e tablespace/tableAccessMethod ausentes, sem relkind. Outra variante exige revisão do perfil. Os dois COPYs têm qualificação explícita, colunas explícitas e somente `FROM stdin`, no formato text padrão. Cada header é confrontado byte a byte com `copyStatement` original após o lexer limitado confirmar tabela e conjunto exato de colunas, sem duplicatas. Identificadores entre aspas são reconhecidos. Não aceita CSV, BINARY, opções, direções ou tabelas diferentes.

Auth exige somente `version`. Storage exige o conjunto `id,name,hash,executed_at`; admite a **ordem original** desse conjunto e mapeia cada campo por ela. Não reordena o header nem as linhas e não força uma ordem canônica fictícia.

## Dados COPY e limites

O payload não passa por lexer SQL. Tab sem escape separa campos; `NULL` é reconhecido pelo marcador raw antes de desescapar. Um marcador escapado continua string. Octal de um a três dígitos, hex de um a dois, escapes de controle e demais caracteres escapados seguem o leitor text PG18.4. Bytes decodificados precisam formar UTF8 estrito, sem NUL; não há replacement, remoção de BOM ou normalização. LF/CR físicos escapados permanecem dentro do registro; CR não escapado recusa este perfil LF. Somente o marcador completo, sozinho e terminado por LF encerra COPY.

Uma barra não duplicada seguida de ponto fora da linha exclusiva do terminador recusa, como no scanner PG18.4. Para um valor literal que contenha barra e ponto, o produtor COPY TO duplica a barra; essa forma é preservada pelo extrator.

Linhas, campos, bytes e sua ordem física ficam retidos. Auth exige versões não vazias e únicas. Storage exige IDs decimais canônicos, seguros e não negativos, nomes não vazios e únicos, hash hexadecimal de 40 caracteres e `executed_at` string/NULL. A validação reaproveita `compareManagedMigrationHistory(history, history)` sem delegar-lhe a extração ou a ordem. A exceção semântica existente para `executed_at` pertence à comparação posterior, e o extrator conserva seu valor.

Tetos fixos independentes: stdout de 20 MiB; strings UTF8 decodificadas de 4 MiB cumulativos; 10.000 linhas cumulativas; envelope de 64 KiB; cada COPY original de 1 KiB. A checagem ocorre antes de alocar/copiar a região limitada. Nada aumenta os limites por retry. Scratch é no máximo 4 MiB e não é exposto.

Os nove códigos públicos fechados têm prefixo `RESTORE_MIGRATION_HISTORY_`: `INPUT_INVALID`, `TOC_REQUIRED`, `BINDING_INVALID`, `FORMAT_UNSUPPORTED`, `TRUNCATED`, `LIMIT_EXCEEDED`, `INVALID`, `REQUIRED`, `DISCARDED`. Nenhum erro anexa causa, SQL, linha, provider, token, IDs ou valores recebidos. Um erro com código fornecido pelo input não é reconhecido como erro próprio.

## Fontes oficiais e validação

Referência fixa do produtor: PostgreSQL `REL_18_4`.

- [pg_backup_archiver.c](https://raw.githubusercontent.com/postgres/postgres/REL_18_4/src/bin/pg_dump/pg_backup_archiver.c): envelope, parâmetros, impressão original de COPY e comentários. SHA256 público já conferido: `F8C83F07D574428B7A064B9FBC509A1FE3B3D10E962EF7B07B462DA35664677F`.
- [pg_dump.c](https://raw.githubusercontent.com/postgres/postgres/REL_18_4/src/bin/pg_dump/pg_dump.c): header COPY, SEARCHPATH e terminador armazenado. SHA256 público já conferido: `73A7EE753841346C81FEE87BDCD095BCEFBA7D3CE7B7BEB2A0ED461D76CD27A6`.
- [copyfromparse.c](https://raw.githubusercontent.com/postgres/postgres/REL_18_4/src/backend/commands/copyfromparse.c): scanner de linhas, NULL, delimitadores e de-escaping. O peer B2 conferiu os 58.845 bytes originais do stream HTTP em RAM, sem normalização: SHA256 `46B9B2499D35617BF5573AC8A25E1D34340D0E2E4FC5270F1C5977D4B7C6DD84`.
- [COPY text](https://www.postgresql.org/docs/18/sql-copy.html#SQL-COPY-FILE-FORMATS) e [pg_restore](https://www.postgresql.org/docs/18/app-pgrestore.html): documentação primária das opções e do transporte.

Fixtures são exclusivamente literais/vetores artificiais e incluem envelope, IDs nominais distintos de comentários, escapes, limites, integridade/descartes, tipos hostis e canário de privacidade. Com o semáforo de Root, a primeira execução Node24.19 teve 15/17 PASS: duas expectativas distinguiam um frame curto errado de um prefixo nativo realmente truncado. A correção compara primeiro os bytes disponíveis; só um prefixo correto sem bytes suficientes usa `TRUNCATED`. Os bytes aceitos permanecem iguais. Após esse delta: **17/17 PASS em 313 ms; lint dos dois arquivos PASS, zero warnings**. O peer independente anterior não encontrou bloqueador estático. **Nenhuma extração real ou validação do alvo foi executada por B3.**
