# Históricos B3 exclusivos da inspeção target

Implementação do recorte da seção 4 de `proposta-baseline-combinado-inspecao.md`. Acrescenta wrappers fixos nos dois módulos B3, um arquivo de QA e este documento. Não altera inspector, dispatcher, B2, preparos encerrados, política de comparação, migrations ou dados remotos.

## APIs e namespace

As quatro APIs puras novas são `inspectionMigrationHistoryCopySelection`, `extractInspectionMigrationHistory`, `inspectionMigrationHistoryFacts` e `discardInspectionMigrationHistory`. Recebem os mesmos argumentos funcionais dos wrappers antigos, mas aceitam somente o TOC nominal de inspeção por `customTargetInspectionTocFacts`. As histórias ficam em WeakMap próprio. Nenhum handle é convertido, cadastrado no store antigo ou reconstruído por JSON.

As três APIs nativas novas são `readNativeInspectionMigrationHistory(options, originalScope, testPorts?)`, `nativeInspectionMigrationHistoryFacts` e `discardNativeInspectionMigrationHistory`. Os receipts ficam em WeakMap próprio, e o núcleo privado usa exclusivamente os quatro wrappers puros de inspeção e o getter B2 de inspeção. O binding permanece `side=target-inspection`, com `nativeDumpSha256/nativeDumpBytes`, sem `archiveSha256`.

Os handles e facts de inspeção conservam `inspectionOnly=true` e `baselineQualified=false`. Esses fatos privados não são um relatório público: contêm ByteStrings e linhas somente para o consumidor Root no mesmo processo. A integração deve projetar apenas os agregados permitidos. Os wrappers de Source/B4/B3 antigos continuam recusando handles e receipts de inspeção; os novos também recusam os antigos. Descarte por namespace incorreto retorna false e não afeta o store correto.

Dois perfis internos congelados escolhem o getter/store de cada núcleo compartilhado. Nenhuma API pública recebe mode, getter, parser, map, seleção de IDs ou callback de consumidor. Não foi acrescentado código de erro: permanecem os nove códigos puros e 14 nativos anteriores. `REQUIRED` continua significando ausência do handle no store nominal consultado. As quatro APIs puras são a única ampliação deliberada da expectativa de exports no teste de superfície antigo.

## Seleção e parser

A seleção de inspeção percorre **todos** os records do TOC íntegro e seleciona somente TABLE DATA com identidade ByteString exatamente `auth.schema_migrations` ou `storage.migrations`. Compara as identidades com literais ASCII, sem decodificar nomes arbitrários das outras linhas. Exige exatamente duas entradas, uma de cada identidade, sem duplicação. As demais linhas DATA continuam opacas, inclusive seus COPYs e payloads.

Para as duas entradas selecionadas, permanecem os gates originais de dumper, seção DATA, tablespace/accessMethod nulos, relkind, definition nula/vazia, COPY original e colunas. A inspeção confere ainda ordinal seguro, dentro do conjunto completo e associado ao próprio record original. A ordem física dos dois records é preservada; IDs não são ordenados numericamente ou escolhidos por parâmetro externo.

O perfil original de ENCODING/STDSTRINGS/SEARCHPATH e o parser de COPY completo são compartilhados. A gramática LF, os separadores, o banner/footer e a recusa de CRLF/truncamento/COPY alternativo não foram ampliados. Permanecem os 52 pares fase/regra em nove fases e os diagnósticos nominais originais, sem nomes, SQL, payload, offsets ou texto de erro do provedor.

Nenhuma linha legítima de histórico é removida ou normalizada. A diferença informada por Root entre Storage 74 no alvo e 73 no archive permanece dado a comparar; estes wrappers não calculam igualdade nem aceitam ignorar a diferença. Somente o comparador e sua política revisada podem interpretar o conteúdo completo posteriormente.

## Transporte e ownership

O leitor nativo usa o mesmo núcleo e o mesmo transporte binário de named pipe já qualificado. O helper não foi alterado. A lista privada vem exclusivamente dos dois IDs originais, cruzados com a listagem inteira pelo hash do TOC e com o mesmo dump por hash/bytes. Não existe SELECT para buscar dados de histórico, SQL em disco ou nova conexão.

Somente `testPorts===undefined` seleciona as portas padrão nativas; qualquer objeto injetado produz `mode=synthetic`, mesmo que as facts artificiais do helper declarem modo nativo. O ambiente e argv de `pg_restore` permanecem fechados, sem credenciais PostgreSQL, chaves HTTP ou de backup. O helper recebe somente seus dois valores OS derivados. O scope de até 45 segundos é tomado emprestado, não é renovado e nunca é fechado pelo leitor.

Terminais originais de `pg_restore` e do helper continuam separados. READY, pipe path, COMPLETE, digest ou EOF do helper não substituem spawn/stdin/EOF/exit/close originais do produtor. O ramo condicional de EPIPE continua exclusivo da extração selecionada: exige evento e callback originais de EPIPE, ambos os EOFs, exit/close zero e parser completo dos dois blocos. Não afirma consumo integral da cauda nem altera os gates do stream de importação DATA.

O guard persistente conserva a primeira recusa e descarta o B3 do namespace correto quando um evento original tardio ocorre durante cleanup ou depois do receipt. Os getters reconferem guard, TOC e owned bytes. Cópias dedicadas e stdout coletado são zerados; a cópia de stdin só é zerada depois de liquidado o callback original ou pela liquidação tardia já prevista. Kill/destroy não fabrica essa liquidação. Root mantém os handles e scope vivos até seu próprio selo e cleanup final.

## Validação

QA nova preparada em `tests/scripts/restore-inspection-migration-history.test.mjs`, exclusivamente com byte vectors, EventEmitter/streams e portas de lista/pipe artificiais em RAM. Inclui namespaces nos dois sentidos, identidades duplicadas/ausentes, COPY inválido, dados alheios opacos, ordem física, preservação de linha adicional, troca de dump/listagem, tamper, descarte, fontes antigas, terminais ausentes, EPIPE, erros tardios, primeira falha e ramo Windows binário sem processos reais.

QA própria em Node 24, um processo por vez após liberação de Root: **23/23 PASS** no arquivo novo (`324,3112 ms`), **32/32 PASS** no leitor nativo anterior (`382,4434 ms`) e **22/22 PASS** no parser anterior (`372,0334 ms`), todas sem skips e aprovadas na primeira rodada. O teste de superfície antigo foi atualizado por Root somente para os 11 exports explícitos. Os controles de nove/14 códigos e 52 pares/nove fases continuam passando. Lint dos três arquivos `.mjs` passou sem warnings (`7,126 s`).

Root revisará o delta e integrará o consumidor separado. Nenhuma inspeção real ou importação foi executada pelo implementador; testes sintéticos não qualificam Auth, Storage, baseline ou restore.
