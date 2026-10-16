# Contrato A2 v1 — inventário de restore

**APROVADO POR ROOT PARA IMPLEMENTAÇÃO OFFLINE DO COMPARADOR — 16/10/2026.** Não implementa A2, extrator, autorização ou aceite nativo. A pesquisa usou os registros públicos fechados abaixo, sem abrir o archive. Os números não substituem a enumeração completa nem são fatos binários observados. Nenhuma versão interna, encoding, tamanho de inteiro, seção ou offset do archive foi presumido como validado. Os gates recomendados de extração continuam dependentes da observação e implementação nativa de Root.

## 0. Fatos públicos observados e hipótese de formato

A [quinta inspeção autenticada](evidence/restore-managed-inventory-native-20261016.json) registrou `headersValid=true`, 1.332 entradas, 24 classes conhecidas, zero classes desconhecidas e zero linhas malformadas. O inventário conta as categorias do namespace apresentadas pelo TOC; **app/managed/global não significam selected/preserved**. Todas as linhas tinham tail `valid`; categorias `other` e `unparsed` tiveram zero ocorrências. Essa inspeção recusou o plano e não certificou IDs, dependências, definições ou alvo.

| Classe | Total | app | managed | global |
| --- | ---: | ---: | ---: | ---: |
| ACL | 271 | 227 | 39 | 5 |
| COMMENT | 66 | 34 | 30 | 2 |
| CONSTRAINT | 141 | 93 | 48 | 0 |
| DATABASE | 1 | 0 | 0 | 1 |
| DATABASE PROPERTIES | 1 | 0 | 0 | 1 |
| DEFAULT | 1 | 0 | 1 | 0 |
| DEFAULT ACL | 12 | 6 | 6 | 0 |
| ENCODING | 1 | 0 | 0 | 1 |
| FK CONSTRAINT | 112 | 83 | 29 | 0 |
| FUNCTION | 211 | 188 | 23 | 0 |
| INDEX | 138 | 55 | 83 | 0 |
| POLICY | 33 | 31 | 2 | 0 |
| ROW SECURITY | 74 | 50 | 24 | 0 |
| SCHEMA | 4 | 0 | 0 | 4 |
| SEARCHPATH | 1 | 0 | 0 | 1 |
| SEQUENCE | 1 | 0 | 1 | 0 |
| SEQUENCE OWNED BY | 1 | 0 | 1 | 0 |
| SEQUENCE SET | 1 | 0 | 1 | 0 |
| STDSTRINGS | 1 | 0 | 0 | 1 |
| TABLE | 85 | 50 | 35 | 0 |
| TABLE DATA | 85 | 50 | 35 | 0 |
| TRIGGER | 80 | 71 | 9 | 0 |
| TYPE | 10 | 0 | 10 | 0 |
| VIEW | 1 | 1 | 0 | 0 |
| **Total** | **1.332** | **939** | **377** | **16** |

A [oitava inspeção de listagem](evidence/restore-managed-native-plan-passed-20261016.json), com os vetos revisados, autenticou o archive e aprovou o plano: **982 selecionadas, 350 preservadas e cinco segmentos**, sem consultar ou alterar o destino. O registro não discrimina as 350 por classe; este contrato também não o faz. Nenhuma dessas duas evidências certifica a igualdade do baseline nem autoriza importar.

**Hipótese ainda não observada:** o gate CUSTOM `1.16-0 / intSize=4 / offSize=8` da seção 1 é uma proposta para um parser limitado, não uma propriedade comprovada deste archive. Sua observação fica para uma próxima inspeção autorizada e com propósito próprio; não repetir a oitava inspeção para atribuir-lhe campos que não capturou.

## 1. Escolha concreta de representação

Usar um **leitor do TOC binário CUSTOM limitado a uma versão explicitamente qualificada**, executado sobre o mesmo `PGDMP` autenticado que originou o plano. O TOC guarda definição, drop/copy statements, namespace, tablespace, table access method, relkind, owner e dependências em campos separados. Extrair esses campos evita recortar SQL por comentários de apresentação. A2 compara os bytes completos desses campos, não somente hashes, counts, AST reimpresso ou SQL modificado.

Fonte normativa: PostgreSQL `REL_18_STABLE`, `pg_backup_archiver.c`, funções `ReadHead`, `WriteToc`, `ReadToc`, `ReadInt`, `ReadStr` e `ReadOffset`; `pg_backup_custom.c`, `InitArchiveFmt_Custom` e `_ReadExtraToc`. Links na seção 7. Esses detalhes são um formato interno versionado; não construir um leitor para todas as versões históricas.

**Gate inicial RECOMENDADO**, sujeito à observação de Root: CUSTOM 1.16-0, `intSize=4`, `offSize=8`. Antes de habilitar o leitor, Root deve conferir a tupla real no header interno e no header do `--list --verbose`. Outra tupla retorna erro fechado, sem tentativa de adivinhação. A confirmação não pode vir apenas do produtor ser PG18.

O TOC vem antes dos blocos de dados e é lido separadamente deles. O leitor não descompacta nem interpreta blocos de dados: registra o algoritmo de compressão conhecido e deixa a extração das duas histórias ao `pg_restore` nativo. A compressão precisa pertencer ao enum do C pinado e ser suportada pelo executável usado; um valor novo recusa.

## 2. Tipos e validações do extrator de Root

Interfaces abaixo são privadas em RAM. `ByteString` conserva **NULL, vazio e bytes não vazios como estados diferentes**. As vistas retidas precisam de armazenamento próprio: não podem apontar para o `database` do inspector que será zerado no `finally`.

```ts
type ByteString = null | Uint8Array;
type SectionCode = 1 | 2 | 3 | 4;
type CustomDataState = 1 | 2 | 3;
type RelationKindCode = 0 | 73 | 83 | 99 | 102 | 105 | 109 | 112 | 114 | 116 | 118;
type TocKind =
  | "DATABASE" | "DATABASE PROPERTIES" | "ACL" | "COMMENT"
  | "CONSTRAINT" | "DEFAULT" | "DEFAULT ACL" | "ENCODING"
  | "FK CONSTRAINT" | "FUNCTION" | "INDEX" | "POLICY"
  | "ROW SECURITY" | "SCHEMA" | "SEARCHPATH" | "SEQUENCE"
  | "SEQUENCE OWNED BY" | "SEQUENCE SET" | "STDSTRINGS"
  | "TABLE" | "TABLE DATA" | "TRIGGER" | "TYPE" | "VIEW";

type TocRecord = {
  ordinal: number; dumpId: number; hadDumper: boolean;
  catalogClassOid: number; catalogObjectOid: number;
  kind: TocKind; tag: ByteString; namespace: ByteString;
  sectionCode: SectionCode; definition: ByteString;
  dropStatement: ByteString; copyStatement: ByteString;
  tablespace: ByteString; tableAccessMethod: ByteString;
  relationKind: RelationKindCode; owner: ByteString; withOids: ByteString;
  dependencies: readonly number[];
  customDataState: CustomDataState; customDataOffset: bigint;
};

type BaselineBinding =
  | { side: "archive"; archiveSha256: string; databaseSha256: string;
      databaseBytes: number; tocSha256: string }
  | { side: "target"; projectRef: string; databaseName: "postgres";
      nativeDumpSha256: string; nativeDumpBytes: number; tocSha256: string };

type BaselineInputV1 = {
  version: 1; binding: BaselineBinding;
  preserved: readonly TocRecord[];
  histories: { auth: readonly { version: string }[];
    storage: readonly { id: number; name: string; hash: string;
                        executed_at: string | null }[] };
};
```

O extrator também guarda, fora de `BaselineInputV1`, a tupla de formato, algoritmo, campos originais do header, encoding qualificado, posição final do TOC e prova de origem. Campos de data do header e offsets físicos são proveniência, não uma definição de objeto a igualar entre archives distintos. Cada binding é validado contra a origem do próprio lado; hashes dos lados não devem ser iguais por comparação. O binding do alvo não reutiliza o hash do `.scbackup` cifrado nem se apresenta como prova de autenticação do source.

Enums públicos da linha PG18, sem atribuí-los ao archive privado: seções `1=NONE`, `2=PRE_DATA`, `3=DATA`, `4=POST_DATA`; offsets `1=POS_NOT_SET`, `2=POS_SET`, `3=NO_DATA`; formato CUSTOM `1`; compressão `0=NONE`, `1=GZIP`, `2=LZ4`, `3=ZSTD`. `RelationKindCode` conserva o inteiro original: zero para não informado, ou código ASCII de `I/S/c/f/i/m/p/r/t/v`, os RELKIND oficiais. Uma classe permitida não autoriza automaticamente toda combinação de section/relkind/offset: Root valida sua coerência com o produtor pinado. Não transformar um enum desconhecido em zero.

Validações obrigatórias:

1. Operar somente depois de AEAD completo, footer/manifest/EOF e reconferência do ciphertext; conferir tamanho/hash dos bytes contra o plano antes de extrair. Nenhum mint antecipado.
2. Ler o formato exato do C, inclusive sinal/tamanho dos inteiros e comprimentos das strings. Recusar truncamento, overflow, comprimento negativo diferente do sentinela NULL e campos que cruzem o limite do buffer. Não tratar NULL como string vazia.
3. Conferir flags, seção, relkind e estado de offset contra os enums da versão pinada. Offset conhecido deve caber no archive e apontar após o TOC; estado sem posição é legítimo em um dump produzido por stream e não pode ser convertido em posição inventada. Não fazer seek usando um estado sem posição.
4. Decodificação inicial admitida: UTF-8 estrito, **somente após** qualificar a entrada ENCODING original. Até lá, reter strings como bytes e reconhecer somente os tokens ASCII fixos de formato/classe necessários para localizar essa entrada. Bytes de definições continuam conservados. Nomes/classe/owner também precisam da gramática limitada já aceita pelo plano. Encoding diferente é recusa explícita, sem converter SQL.
5. Cruzar **todas** as entradas binárias por `dumpId` contra a união completa `requirements.selected + requirements.preserved` do plano nativo. IDs únicos, classes, namespace, tag, owner e cada dependência precisam corresponder; OIDs devem também corresponder ao TOC nativo privado quando expostos pelo adaptador de Root. Se o getter atual de requirements não expõe os OIDs, ampliar essa metadata privada em Root ou usar o registro completo do parser; não afirmar esse cross-check sem o implementar.
6. Para comparar com o texto nativo, aplicar apenas o mapeamento de apresentação exato de `sanitize_line`: namespace NULL/vazio aparece como `-`; owner NULL pode aparecer vazio. **Conservar o campo binário original**, inclusive a distinção NULL/vazio. Não aplicar esse mapeamento às definições SQL.
7. Dependências conservam ordem e multiplicidade, inclusive duplicatas. Cada ID deve ser positivo, conhecido e não ser o próprio; manter os vetos de ordenação das customizações. `ordinal` conserva a ordem original do TOC binário.
8. Selecionar os preservados exclusivamente pelos IDs do plano: cobertura completa, sem duplicatas, faltantes ou entradas extras. Os 350 informados por Root são um controle de tamanho deste snapshot, não um filtro por count.

Limites propostos de v1, **fixos para a implementação após aprovação de Root**, ainda não medidos no archive: database/dump até 64 MiB por lado; soma dos campos de TOC até 32 MiB por lado; até 10.000 registros por lado; cada ByteString até 4 MiB; até 100.000 referências de dependência cumulativas por lado; histórias até 4 MiB de strings UTF-8 e 10.000 linhas cumulativas por lado. A profundidade de containers fica limitada ao shape declarado, no máximo sete níveis; nenhum objeto recursivo é aceito. Cada limite é conferido antes de alocar/copiar ou percorrer campos volumosos. Valores numéricos são inteiros seguros, não negativos, salvo IDs/dependências que exigem valor positivo; OIDs cabem em uint32 e offsets físicos em uint64. Root pode restringir após observar o inventário, sem elevar limites por retry automático. Os subprocessos são sequenciais e compartilham orçamento explícito; nenhum fallback remove campos para caber.

O comparador puro valida novamente seus próprios inputs, sem confiar nos booleanos de um chamador: rejeitar Proxy, inclusive revogado, **antes** de consultar shape/descriptors; objetos e arrays precisam de propriedades próprias de dados, sem getters/setters, símbolos ou extras. Records têm exatamente as chaves declaradas; arrays são densos, sem buracos, com somente `length` e os índices próprios de dados esperados, dentro do limite antes da travessia. Usar os descriptors, nunca ler uma propriedade antes de provar que é um campo de dados. Não invocar `toJSON`, `valueOf`, iteradores ou métodos fornecidos pelo input.

`ByteString` é NULL ou uma Uint8Array genuína, nunca Proxy, DataView, array comum ou SharedArrayBuffer. Medir tamanho, obter backing store, ler/copiar/comparar bytes e testar detach com intrinsics capturados; não confiar em getters próprios de `byteLength`/`buffer` ou overrides de `set`/`fill`. Um buffer detached recusa; NULL e vazio legítimo continuam distintos. Não exigir `Object.freeze` de uma typed array não vazia: isso não congela seus bytes. A prova Root usa cópias dedicadas no mesmo processo, sem memória compartilhada; A2 é síncrono, não chama código de entrada e não devolve vistas/bytes. Root conserva ownership e limpa as cópias ao encerrar sua vida útil.

## 3. Contrato implementável da Frente A2

API pura proposta: `compareManagedBaseline(archive, target)`, com dois `BaselineInputV1` provenientes dos adaptadores de Root. Não inicia IO, processo, SQL, rede ou mint. O primeiro binding tem `side="archive"` e o segundo `side="target"`; valores invertidos recusam. Saída fechada: `{ version: 1, matches: boolean, reasons: readonly FixedReason[] }`; sem SQL, nomes, owners, IDs ou linhas. Shapes desconhecidos recusam.

Cada campo de digest usa SHA-256 hexadecimal canônico minúsculo de 64 caracteres; cada binding possui somente os digests declarados em seu próprio tipo. Tamanhos de database/dump exigem inteiro positivo dentro de 64 MiB; `projectRef` do target segue `[a-z0-9]{20}` e `databaseName` é literalmente `postgres`. A2 valida a forma; somente Root confere o projeto autorizado e o vínculo dos bytes originais. Esses campos não podem selecionar conexões ou caminhos.

```ts
type FixedReason =
  | "identity_set_mismatch"
  | "dependency_scope_unsupported"
  | "dependency_vector_mismatch"
  | "section_mismatch"
  | "dumper_mismatch"
  | "definition_mismatch"
  | "drop_statement_mismatch"
  | "copy_statement_mismatch"
  | "owner_mismatch"
  | "tablespace_mismatch"
  | "table_access_method_mismatch"
  | "relation_kind_mismatch"
  | "with_oids_mismatch"
  | "auth_history_mismatch"
  | "storage_history_mismatch";

type BaselineErrorCode =
  | "RESTORE_MANAGED_BASELINE_INPUT_INVALID"
  | "RESTORE_MANAGED_BASELINE_LIMIT_EXCEEDED"
  | "RESTORE_MANAGED_BASELINE_GRAPH_INVALID";
```

Ordem canônica dos motivos: a ordem literal acima. `matches=true` exige `reasons=[]`; `matches=false` exige entre um e 15 motivos únicos, nessa ordem, sem truncar uma lista maior arbitrária. O resultado e sua lista são frozen e não contêm outro campo. Comparar os campos completos de cada par inequívoco; nomes/tags/namespaces ausentes ou diferentes aparecem somente em `identity_set_mismatch`, não nos motivos como texto. Histórias válidas divergentes usam os dois motivos próprios. Falta de representação equivalente para aresta externa usa `dependency_scope_unsupported`; não se converte em igualdade por ignorar a aresta.

Entrada inválida lança `BackupError` com **um dos três códigos fixos** acima, sem anexar texto/causa/valor recebido. Shape, tipo, binding malformado, Proxy/SAB/detach, enum desconhecido e história inválida usam `INPUT_INVALID`; qualquer teto excedido usa `LIMIT_EXCEEDED`; IDs duplicados, identidade ambígua duplicada, dependência não positiva ou self-edge usam `GRAPH_INVALID`. Encoding é qualificado pelo extrator de Root, pois o header não pertence ao input semântico de A2. Referência fora dos preservados, mas autenticada/cross-checked por Root no grafo total, é o motivo fechado de escopo não suportado, não um ID inventado ou uma permissão para omitir dados. Validação estrutural precede comparação e não devolve um relatório de divergência para uma entrada inválida. Não aceitar `BackupError.code` criado pelo input como prova de erro próprio.

Root mantém em WeakMap a ligação dos fatos originais a plano/capacidade e a identidade do alvo/ator. Os campos `binding` são correlações, não prova autenticadora aceita de JSON. Antes/depois de comparar, Root verifica a capacidade viva; nenhuma comparação renova seus 90 s. A2 não consome a capacidade nem concede autoridade nativa por conta própria.

O lado alvo é um **novo snapshot nativo de `pg_dump` 18, com produtor e opções de dump conferidos**, coletado por Root no projeto de ensaio. Não se pode chamar o planejador de restore existente sobre o alvo vazio: ele exige as customizações da aplicação que ainda não existem ali. O adaptador de baseline usa a política de escopo revisada por Root e deve detectar entradas adicionais no baseline alvo, não apenas buscar as chaves que encontrou no source.

Regras de comparação:

- Bijeção por identidade da classe: sempre incluir `kind`, namespace e tag originais, distinguindo NULL/vazio em cada ByteString, inclusive nos registros globais SCHEMA/DATABASE/PROPERTIES. FUNCTION conserva a assinatura na tag; CONSTRAINT/FK/DEFAULT/TRIGGER/POLICY/ROW SECURITY/OWNED BY/ACL/COMMENT conservam a tag nativa completa. DEFAULT ACL inclui também o owner como identidade do emissor das permissões padrão. Não decodificar/normalizar esses bytes para construir uma chave que colapse identidades.
- A relação entre dump IDs dos dois snapshots vem dessa bijeção, nunca da igualdade numérica dos IDs ou OIDs entre bancos. Conservar IDs/OIDs originais como proveniência. **V1 recusa explicitamente qualquer aresta de um preservado cujo destino esteja fora do conjunto preservado de seu próprio lado**, mesmo que Root tenha comprovado que ela aponta para uma entrada selecionada legítima no grafo completo. Não presumir que o subgrafo dos 350 seja fechado nem criar uma representação equivalente externa nesta versão; o motivo é `dependency_scope_unsupported`, e a aresta não desaparece do vetor. Comparar a sequência das demais dependências mapeadas com multiplicidade intacta; ordem divergente recusa, sem deduplicação silenciosa.
- Comparar integralmente `sectionCode`, `hadDumper`, `definition`, `dropStatement`, `copyStatement`, namespace/tag/owner originais, tablespace, tableAccessMethod, relationKind e withOids. Definições byte a byte são deliberadamente conservadoras: diferenças apenas de formatação podem recusar, mas não podem ser apagadas para produzir PASS.
- O shape físico `customDataState/customDataOffset`, ordinal absoluto, IDs/OIDs e datas/versão/algoritmo do header **não são igualdade semântica entre dumps diferentes**; são validados, qualificados e vinculados na extração de cada lado. Comparar IDs/offsets/headers iguais jamais substitui comparar campos integrais de objeto. Sua diferença nunca autoriza omitir uma definição ou dado.
- DATABASE e DATABASE PROPERTIES mantêm definição/propriedades/owner/ACL completas. Diferença de configuração própria do projeto é um desvio para revisão de Root, não exceção automática nem comando ALTER DATABASE.
- TABLE DATA preservada corresponde **somente às duas histórias declaradas na seção 4**. Dados selecionados da aplicação/Auth/Storage continuam no replay; não compará-los a alvo vazio para depois omiti-los. A qualificação de vazio/ator/permissões do consumidor permanece separada.

Os tipos observados restantes têm papel explícito: ENCODING/STDSTRINGS/SEARCHPATH são estado original do archive; SEQUENCE SET é dado selecionado; tipos de DDL nas classes acima podem estar selecionados ou preservados conforme o plano. Não mudar essa classificação por conveniência do comparador. Uma classe nova, representação ausente ou identidade ambígua bloqueia o contrato e pede revisão.

## 4. Duas histórias COPY sem executar SQL

Usar uma única extração nativa sequencial da mesma RAM autenticada: `pg_restore --data-only --use-list=<lista privada dos dois IDs TABLE DATA> --file=- --restrict-key=SCBaselineV1`. Sem `-d`, sem credenciais PG no ambiente, sem psql, sem `--create`, sem conexão. Exigir EOF de stdout e close0, limite de bytes, prazo absoluto e descarte dos buffers. A lista vem dos IDs do plano, nunca de nomes aproximados ou filtro genérico.

Um autômato finito alterna entre **SQL de transporte**, **COPY text** e **fim**:

- Validar os meta comandos `\restrict`/`\unrestrict` somente fora de COPY e com a chave exata; nunca executar o script. Qualquer outro meta comando recusa nesse recorte.
- Reconhecer o header `COPY ... FROM stdin` por AST ou lexer limitado, conferir tabela/colunas/direção/opções contra `copyStatement` original do TOC. Aceitar somente COPY text do produtor conhecido. Não entregar o payload de dados ao parser SQL.
- Dentro de COPY, cada linha é dado até o terminador exato `\.`. Separar por tab não escapado; reconhecer NULL `\N` **antes** de interpretar escapes; aplicar a gramática de escapes de COPY text; manter bytes/linhas originais vinculados à entrada. Strings que pareçam SQL, comentários ou meta comandos continuam dados.
- `auth.schema_migrations`: exatamente a coluna `version`, string não vazia, sem versões duplicadas.
- `storage.migrations`: exatamente `id`, `name`, `hash`, `executed_at`, nas colunas conferidas; inteiro seguro não negativo, identidade/nome únicos, hash hexadecimal de 40 caracteres e timestamp string ou NULL conforme contrato já existente. Coluna nova recusa.
- Exigir os dois blocos exatamente uma vez, terminadores completos e apenas o epílogo permitido depois. Sem fallback para INSERT, CSV ou execução de conteúdo.

A2 reutiliza as regras de `compareManagedMigrationHistory`: comparar todas as versões/identidades/hashes; somente `storage.migrations.executed_at` já possui exceção declarada. Não introduzir outra remoção de timestamps. A ordem física de linhas é conferida na extração; igualdade de histórias continua segundo esse helper existente.

Se A2 reutilizar o helper do planner, qualquer recusa estrutural é convertida em seu código fixo `RESTORE_MANAGED_BASELINE_INPUT_INVALID`, sem inspecionar mensagens/causas do input. Histórias estruturalmente válidas e diferentes retornam os motivos próprios. A dependência deve permanecer A2 → helper puro; não fazer o planner importar A2 e criar um ciclo.

## 5. Por que AST não é a representação lossless

O pglast pinado `7.18` usa libpg_query da linha PostgreSQL 17. Sua AST não conserva comentários e delimitadores/whitespace como fonte original; igualdade de nós ignora posições. `RawStream` reimprime SQL e não serve como prova de bytes integrais. Um parser PG17 também não certifica todas as sintaxes emitidas por PG18.

É útil como validação/classificação **auxiliar** de statements conhecidos e headers COPY, conservando as fatias originais e cobrindo todos os bytes. `parse_sql_json` fornece offsets de UTF-8; `parse_sql`/`scan` convertem posições para índices de caracteres Python. Não misturar essas unidades ao recortar. Erro, nó novo ou statement sem associação única recusa; nada de `split(';')`, regex para apagar SQL ou equivalência pelo deparser. A implementação principal proposta não depende de AST para obter definições do TOC.

Fallback somente se Root rejeitar o leitor binário: emissão SQL nativa com `--file=- --create` e lista completa preservada. `--create` é necessário para DATABASE/PROPERTIES e ACL/COMMENT do banco; o script contém `\connect` e muda o envelope. `--no-toc-comments` **não é opção CLI**; o campo interno é usado no modo conectado. Separar envelopes por parser lexical consciente de strings/dollar quoting/COPY, conservando spans originais, seria trabalho adicional. Não interpretar comentários `-- TOC entry` por regex como fronteira confiável, pois texto igual pode existir no corpo de função. Esse caminho não está implementado ou aprovado.

## 6. Entregas, validações futuras e gaps

**Root:** leitor privado do TOC, produtor de snapshot alvo, extração COPY das histórias, prova de origem por identidade, deadline/cleanup e ligação antes do mint. **Frente A2:** somente comparador puro e fixtures sintéticas dos tipos aprovados. Não fornecer à A dados/SQL privados nem atribuir-lhe fatos binários ainda não coletados.

Fixtures futuras precisam perturbar separadamente cada campo/byte de definição, owner, ACL/propriedade, NULL/vazio, encoding, comprimento, seção, offsets, IDs/arestas, multiplicidade e linhas COPY; falta/extra/duplicação deve recusar. Incluir Proxy revogado, getters com contador zero, SAB/detach, teto antes de copiar, array esparso/extra e canário que nunca chegue ao código/motivo/saída. Motivos únicos/ordem/cotas e erro estrutural antes de comparação precisam de aceites próprios. O cross-check nativo precisa cobrir a enumeração inteira, e a integração precisa demonstrar que CLI diagnóstico não cunha capacidade. Nenhum desses testes foi executado por esta pesquisa.

Gaps explícitos antes de liberar execução: observar a tupla real do header interno; completar exposição privada de OIDs para cross-check; provar a política de escopo e ausência de extras no alvo; coletar ambas as histórias completas; medir limites/prazo e diferenças legítimas de propriedades/ACL. Este archive não contém um `catalog.json` nem globais de cluster como atributos e memberships históricos de roles. Esses fatos ausentes não podem ser reconstruídos por inferência ou por versão/count; os probes atuais de ator/permissões de Root têm escopo próprio.

## 7. Referências oficiais consultadas

- PostgreSQL 18, [pg_restore — opções e modo script](https://www.postgresql.org/docs/18/app-pgrestore.html).
- PostgreSQL `REL_18_STABLE`, [pg_backup_archiver.c](https://raw.githubusercontent.com/postgres/postgres/REL_18_STABLE/src/bin/pg_dump/pg_backup_archiver.c): ReadHead/ReadToc/WriteToc, seleção de DB, impressão e reconexão. Hash público conferido na tarefa anterior: `35fbeefc828799dc5c7b4960e558496bc93625b14a17daecf68cc1aeba578868`.
- PostgreSQL `REL_18_STABLE`, [pg_backup_custom.c](https://raw.githubusercontent.com/postgres/postgres/REL_18_STABLE/src/bin/pg_dump/pg_backup_custom.c): leitura do header/TOC antes dos dados e offsets extras.
- PostgreSQL `REL_18_STABLE`, [pg_backup_archiver.h](https://raw.githubusercontent.com/postgres/postgres/REL_18_STABLE/src/bin/pg_dump/pg_backup_archiver.h), [pg_backup.h](https://raw.githubusercontent.com/postgres/postgres/REL_18_STABLE/src/bin/pg_dump/pg_backup.h), [compression.h](https://raw.githubusercontent.com/postgres/postgres/REL_18_STABLE/src/include/common/compression.h) e [pg_class.h](https://raw.githubusercontent.com/postgres/postgres/REL_18_STABLE/src/include/catalog/pg_class.h): versão emitida/enums de offset, formato/seção, compressão e relkind.
- PostgreSQL `REL_18_STABLE`, [pg_restore.c](https://raw.githubusercontent.com/postgres/postgres/REL_18_STABLE/src/bin/pg_dump/pg_restore.c): opções CLI, `--restrict-key`, modo sem conexão.
- PostgreSQL 18, [COPY — formato text](https://www.postgresql.org/docs/18/sql-copy.html#SQL-COPY-FILE-FORMATS).
- pglast **v7.18**, [parser.pyx](https://raw.githubusercontent.com/lelit/pglast/v7.18/pglast/parser.pyx), [ast.py](https://raw.githubusercontent.com/lelit/pglast/v7.18/pglast/ast.py) e [CHANGES.rst](https://raw.githubusercontent.com/lelit/pglast/v7.18/CHANGES.rst): parser PG17, offsets/AST e limites de reimpressão.

Os links `REL_18_STABLE` identificam a linha pública PG18 e são mutáveis; antes de implementar o parser binário, Root deve congelar commit ou hash de **todos** os arquivos C/header usados, além do hash do executável nativo qualificado. A linha PG18 e o hash de um único arquivo não pinam sozinhos o formato inteiro. As referências explicam o formato e as APIs; não são evidência da estrutura privada deste backup ou de igualdade com o projeto alvo.
