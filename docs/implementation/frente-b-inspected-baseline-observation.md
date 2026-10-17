# Observação pura do baseline e de DDL público existente

O módulo `restore-inspected-baseline.mjs` implementa a API síncrona `observeInspectedManagedBaseline(sourcePlan, sourceToc, sourceHistory, targetInspectionToc, targetInspectionHistory)`. Recebe exatamente cinco handles nominais vivos, sem JSON, reader, scope, mode, getter, lista de nomes ou callback de consumidor. Não conecta a serviços, executa SQL, importa dados, altera um plano ou cria capacidade de restore.

O recorte corresponde à política de observação discutida em `proposta-baseline-combinado-inspecao.md`, preservando Source/B4 e a separação do namespace de inspeção. Root continua responsável por autenticidade completa do archive, conexão permitida, snapshot nativo, esvaziamento, ator, guardas de processo, prazo único e cleanup do orquestrador.

## Entradas e vínculo

Os handles Source são consultados exclusivamente pelos getters originais de plano, B2 e B3. O plano precisa corresponder aos hashes/bytes do binding do TOC e ao conjunto preservado. A história Source precisa guardar a mesma referência de binding do TOC Source. Os handles de alvo são consultados somente pelos getters B2/B3 de inspeção, cuja história precisa guardar a mesma referência do binding `side=target-inspection`.

Clones, proxies, handles de namespace incorreto, store descartado ou bytes alterados recusam. Não se troca o binding do handle de inspeção. Um DTO local com `side=target` existe somente durante a chamada síncrona ao comparador A2; não é cadastrado em store B4 nem retornado. Todos os getters são reconferidos depois das duas comparações, antes do retorno, sem await ou callback de caller nesse intervalo.

O módulo toma emprestadas vistas de ByteStrings com intrinsics capturados, recusando Proxy, SharedArrayBuffer e backing store destacado. Não consulta getters sombra de buffer/byteLength/iterator/toJSON e não copia o conteúdo de todos os TOCs. Limites são os mesmos do A2 por lado: 10.000 records, 100.000 dependências, 4 MiB por campo e 32 MiB cumulativos de ByteStrings; os tamanhos são conferidos antes de indexar/alocar os conjuntos derivados. Os stores nominais anteriores também continuam impondo seus próprios limites e hashes.

## Cobertura total do alvo

Cada record target precisa entrar exatamente uma vez em uma das três categorias abaixo. Qualquer record sem categoria recusa a operação inteira; não é descartado por um filtro de nomes.

- Baseline gerenciado/global: regras estruturais do B4 original, incluindo schemas e metadados de banco, DDL de Auth/Storage e somente as duas linhas TABLE DATA de histórico.
- Estado: ENCODING/STDSTRINGS/SEARCHPATH originais, SEQUENCE SET gerenciado e TABLE DATA não histórico de Auth/Storage. A classificação não compara o conteúdo desses dados nem prova vazio.
- Candidatos públicos: somente FUNCTION, ACL e DEFAULT ACL cujo namespace completo é `public`. Todas as entradas dessas três classes entram; não há nome esperado ou exceção para a função afetada pela migration 003.

As quatro customizações Source em Auth/Storage permanecem proibidas no alvo por esta política. TABLE/VIEW/POLICY públicos, app_private, outro namespace, DEFAULT ACL global ou metadados globais não reconhecidos recusam. O envelope de metadados DATABASE conserva os gates de owner, identidade e dependência do B4. O módulo não chama B4 com TOC filtrado nem produz um handle de baseline.

## Dois resultados A2

`managed` compara `Source.preserved` com o baseline gerenciado/global target. `existingApp` compara a união de `Source.preserved` e das contrapartes dos candidatos target com a união de baseline target e **todos** os candidatos target. As duas comparações recebem as histórias completas de Auth/Storage.

As contrapartes são procuradas no conjunto **total** de records autenticados Source. Identidade usa kind, namespace e tag completos, acrescentando owner para DEFAULT ACL. Um hash serve somente para localizar um bucket; a igualdade é decidida novamente sobre todos os bytes originais. Ambiguidade em qualquer identidade do SourceALL ou target recusa. Nenhuma contraparte é duplicada na união Source.

Um candidato extra target que não exista no Source permanece no DTO target e chega ao motivo A2 `identity_set_mismatch`. Um objeto Source que não foi observado no alvo permanece na seleção Source original e não é acrescentado silenciosamente ao target ou à união de candidatos observados. Por isso cardinalidade ou igualdade da união não prova cobertura de todos os objetos de produto Source. A política é de observação do que já existe no alvo, sem reclassificar o plano Source.

Os vetores de dependência permanecem inteiros, em ordem e multiplicidade originais. O módulo não busca fechamento adicional, remove arestas, inventa proxies ou inclui dados não históricos na comparação. Dependência fora da união continua `dependency_scope_unsupported`, conforme o contrato A2. NULL, vazio, ACL, owner, SQL, comentários, whitespace e CRLF mantêm sua distinção. A única exceção permanece `storage.migrations.executed_at`, já definida no comparador de históricos.

A contagem informada por Root de Storage 74 no alvo e 73 no archive não é ignorada por este módulo. Todas as linhas chegam aos dois resultados A2; qualquer diferença fora da exceção definida continua divergência. A migration 003 não recebe tolerância automática, nem se executa REVOKE/ALTER ou migration para obter igualdade.

## Saída e erros

A saída congelada é `{version, managed, existingApp, coverage, inspectionOnly, baselineQualified, restoreAccepted}`. Cada resultado A2 mantém seu schema e seus 15 motivos canônicos. `coverage` contém somente contagens de SourceALL/preservados, target total/baseline/estado/app, contrapartes Source e `coverageComplete=true` para a partição de metadados target. Não contém nome, SQL, owner, OID, ID, lista ou hash individual.

`inspectionOnly=true`, `baselineQualified=false` e `restoreAccepted=false` são fixos, mesmo quando os dois resultados têm `matches=true`. A saída não prova proveniência nativa, igualdade de dados não históricos, vazio, privilégios, estabilidade posterior ou autorização de importação. Não conclui issues automaticamente.

Erros próprios fechados: REQUIRED, BINDING_INVALID, SCOPE_UNSUPPORTED, LIMIT_EXCEEDED e AMBIGUOUS, sob o prefixo RESTORE_INSPECTED_BASELINE. Os três erros originais do A2 podem atravessar somente o catch de sua chamada direta confiável. Mensagens/cause/getters de caller não são usados para autorizar um erro; texto de provedor nunca é projetado.

## Fixture e validação

`tests/scripts/fixtures/restore-inspected-baseline-fixture.mjs` fornece a factory pública `createInspectedBaselineFixture(options={})`, sem import de node:test ou IO. Retorna Source/target com CUSTOM bytes, TOC, stdout COPY, plano, TOC/history handles, vetor congelado dos cinco handles e descarte. Permite overrides/extras/omissões públicos e históricos sintéticos para os testes deste módulo e do orquestrador de Root. O padrão possui Source 24 records e target 17, três candidatos públicos, renumeração target e objetos de produto Source que permanecem fora da união observada.

A QA nova usa somente esses handles nominais e byte vectors públicos. Cobre extras e ausências, diferença de ACL/corpo/owner, NULL/vazio, arestas e multiplicidade, ambiguidade, cobertura total, namespaces errados, binding por referência, tamper/descarte e getters sombra.

QA própria em Node 24, serial após liberação de Root: **26/26 PASS**, zero skips, `243,3964 ms`, na primeira rodada. O comparador A2 anterior também passou **63/63**, `461,9396 ms`; lint dos três `.mjs` passou sem warnings (`5,4006 s`). Nenhuma correção de runtime ou fixture foi necessária depois da execução. Esses controles não iniciaram processo externo, conexão ou serviço, nem abriram archive/perfil original.

Nenhum teste local será promovido a aceite conectado; a operação combinada depende da integração e revisão de Root.
