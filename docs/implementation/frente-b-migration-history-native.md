# Frente B — transporte nativo das duas histórias

Proposta para revisão de Root em 16/10/2026. Os três arquivos deste pacote são novos. Nenhum dispatcher, inspector, perfil, archive, migration, comparador A2, autorização, mint ou fluxo de importação foi alterado. Não houve execução nativa ou uso de dados privados na construção. A conexão com o inspector e uma futura observação real pertencem exclusivamente a Root.

## API e fronteira nominal

```js
const receipt = await readNativeMigrationHistory({
  tocHandle, database, nativeTocText, pgRestore, environment, listOptions,
}, originalInspectionScope, testPorts /* somente QA, opcional */);
const { historyHandle, nativeFacts } = nativeMigrationHistoryFacts(receipt);
// Somente dentro da operação original, com os dois handles ainda íntegros.
const history = migrationHistoryFacts(historyHandle);
discardNativeMigrationHistory(receipt);
```

`originalInspectionScope` é o mesmo objeto interno `{check, remaining, race, close}` que o inspector criou **antes** de AEAD. O módulo chama somente `check`, `remaining` e `race`; nunca chama `close`, nunca cria uma nova janela de 45 segundos e não aceita um timeout novo como opção pública. A construção do materializador, lista, processo, parsing e limpeza estão sujeitos ao prazo original. O tempo restante passado à fábrica pode apenas encurtar o limite relativo interno do materializador; o scope externo continua sendo o veto absoluto.

`options` tem exatamente seis propriedades próprias enumeráveis de dados. `listOptions` tem exatamente `privateRoot`, `powerShellExecutable`, `systemRoot`, `forbiddenRoots` e `syncRoots`; arrays também têm somente slots próprios de dados. Extras, símbolos, proxies, accessors e caminhos relativos/UNC/com caracteres de controle ou `~` recusam. O ambiente aceita somente as propriedades de dados `PATH`, `SystemRoot`, `TEMP` e `TMP`. Credenciais PG, variáveis Node, HOME e tokens recusam; não são filtrados silenciosamente.

O `privateRoot` da integração será o diretório exclusivo já protegido do inspector. A fábrica existente cria e remove somente seu próprio filho `managed-toc-*`; este módulo não altera ACL nem remove o diretório pai, snapshot cifrado ou arquivo original. Não há escrita de SQL ou de dump plaintext em disco: apenas duas linhas originais da listagem ficam em arquivo privado.

O módulo usa o materializador e o helper ACL fixo de `restore-managed-native-adapters.mjs`. A literal JS do helper foi decodificada estaticamente: os argumentos de `WriteLine` são JSON válido, sem barras literais antes das aspas. O controle RAM existente desse adapter aceita o fake child legítimo `{ok:true}` e recusa propriedades adicionais; nenhuma prova ACL real foi obtida por este pacote.

## Inputs vinculados e comando único

O TOC precisa ser um handle B2 genuíno. B3 seleciona exatamente os IDs preservados de `auth.schema_migrations` e `storage.migrations`, na ordem ordinal original. O digest da listagem original precisa coincidir com `binding.tocSha256`. A lista materializada contém as duas **linhas originais** correspondentes, na ordem B3; não reconstrói owners, nomes ou IDs a partir dos comentários COPY.

O dump em RAM exige Uint8Array/Buffer genuíno, não compartilhado, não destacado e não Proxy. Seu tamanho/digest são confrontados com o binding B2. O lado `archive` usa `databaseSha256/databaseBytes`; o lado `target` usa `nativeDumpSha256/nativeDumpBytes`. Há uma cópia dedicada em `Uint8Array(new ArrayBuffer(length))`; o stdin nunca recebe o store do chamador. A integridade da cópia e o handle original são reconferidos antes do processo e após os awaits pertinentes. O store original não é apagado pelo adapter.

Uma única invocação, sem retry ou fallback:

```text
pg_restore --data-only --use-list=<lista privada das duas linhas> --file=- --restrict-key=SCBaselineV1
```

Não há `psql`, `-d`, `--dbname`, conexão, credencial PG, SQL executado, consulta ao target ou opção fornecida livremente pelo input. `shell:false`, `windowsHide:true` e três pipes são fixos. Root ainda deve qualificar e manter vinculados o executável/versão/hash original, suas opções, o projeto autorizado e a prova completa AEAD do archive. Um caminho absoluto, hash semelhante ou receipt de transporte isolado não comprova essas condições.

## Terminais originais e cauda não consumida

O coletor exige criação original observada por `spawn`, EOF original de stdout, EOF original de stderr e `close(0)` do mesmo processo. `exit(0)` isolado, fechamento prematuro de pipe, destruição, pedido de kill, resolução de metadata ou timeout nunca substituem esses eventos. Stderr é descartado sem texto, com teto cumulativo próprio. O parser B3 só recebe stdout após a conclusão desses eventos e do estado original de stdin.

Há exatamente dois estados aceitos de stdin:

| `inputTerminal` | Condições adicionais obrigatórias |
| --- | --- |
| `finish` | Evento original `finish`, callback original de `end` concluído sem erro e ausência de erro de stdin. |
| `selected_tail_unconsumed` | Erro original de stdin `EPIPE`, callback original concluído também com `EPIPE`, ausência de `finish`, mais stdout/stderr EOF e close0, parsing B3 completo dos dois blocos, integridade do binding/cópia e scope ainda válidos. |

O segundo caso é uma decisão explícita de Root para **extração parcial de duas histórias**. O produtor PostgreSQL 18 pode concluir a seleção antes de consumir a cauda de outros blocos. Não afirma `fullSourceConsumed`, não inventa finish e registra `tailUnconsumed:true`. EPIPE sem callback, callback sem evento EPIPE, outro erro, saída parcial, callback pendente, falta de EOF, close diferente de zero ou parsing recusado falham. Nenhum destroy/kill ACK concede essa qualificação.

Este módulo não altera `restore-managed-stream.mjs`: o importador DATA continua com suas exigências próprias. A exceção deste leitor não é transferível para uma operação de importação.

Fontes primárias do produtor, referência fixa `REL_18_4`:

- [pg_backup_custom.c](https://raw.githubusercontent.com/postgres/postgres/REL_18_4/src/bin/pg_dump/pg_backup_custom.c), SHA256 previamente qualificado `CAEE43B923FB541C57D57389B984D8655B70995B9509BC1BED02ACDB96A51CD8`: `_PrintTocData` procura e imprime o bloco selecionado; `_CloseArchive` fecha o input sem drain final da cauda.
- [pg_backup_archiver.c](https://raw.githubusercontent.com/postgres/postgres/REL_18_4/src/bin/pg_dump/pg_backup_archiver.c), SHA256 previamente qualificado `F8C83F07D574428B7A064B9FBC509A1FE3B3D10E962EF7B07B462DA35664677F`: o loop serial ignora entradas não selecionadas e emite o epílogo após as selecionadas. Esses fatos sustentam a possibilidade de input não consumido; não demonstram EPIPE em um archive privado específico.

## Stores, limpeza e receipt

Tetos fixos: dump 64 MiB, stdout 20 MiB, stderr cumulativo 64 KiB, listagem 4 MiB e lista selecionada 64 KiB. Os limites B3 permanecem adicionais e inalterados: envelope, strings, linhas e COPY. Nenhum teto aumenta por retry.

Os chunks recebidos são apagados depois de copiados e os chunks tardios após recusa também são apagados. O stdout de trabalho é apagado no `finally`; B3 conserva somente seu próprio store nominal até descarte. A cópia de stdin só é apagada depois do callback original ter concluído. Se houver timeout com callback pendente, o cancelamento solicita parada e o callback tardio fica responsável pelo wipe; não se espera fora do prazo nem se afirma que a cópia já foi apagada. Se o callback nunca concluir, não há garantia de wipe desse store ainda emprestado. Não se promete apagar buffers do SO, strings JS, clones externos ou backing stores transferidos.

`removeLists` é chamado uma vez e sua conclusão original deve ocorrer dentro do scope para existir receipt. Uma falha de limpeza depois do parsing descarta B3 e recusa. Uma recusa anterior permanece a primeira, mesmo se cleanup falhar. Um resultado tardio da fábrica só inicia cleanup observado e jamais inicia `pg_restore` ou produz receipt.

O handle público é `{}` frozen em WeakMap. `nativeMigrationHistoryFacts` retorna somente fatos privados: o handle B3 e metadata nominal do transporte, incluindo seleção, hashes/tamanhos, `inputTerminal`, terminais originais e limpeza. Cada acesso revalida B3 e a identidade/integridade do TOC original. Descartar B3 ou B2 invalida o receipt. `discardNativeMigrationHistory` é total/idempotente e apaga B3 sem apagar o TOC do chamador.

O guard privado da primeira falha continua ativo depois de a Promise de coleta resolver. Os observadores originais de processo, pipes, stdin e callback permanecem ligados; o mesmo guard é consultado antes/depois do parser, depois dos awaits de IO/cleanup, imediatamente antes do registro do receipt e em cada getter. Erro original tardio ou callback duplicado descarta B3 imediatamente. O getter invalida o receipt e propaga a primeira recusa original, preservando seu diagnóstico; uma falha posterior de limpeza não a substitui. Uma Promise já resolvida, isoladamente, não concede ausência de erros posteriores.

Somente portas default internas recebem `mode:"native"`. Qualquer objeto explícito de portas `{createLists,spawn}` recebe `mode:"synthetic"`, ainda que emita metadata idêntica. JSON, clone, herança, Proxy, flags ou callbacks do input não viram handles. Esse modo comprova apenas o transporte executado pelo adapter; não autentica por si só o archive, o executável ou uma conexão.

## Diagnóstico privado de primeira recusa

`nativeMigrationHistoryDiagnostic(error)` consulta somente o WeakMap do **erro original**. Não lê propriedades, getters ou códigos fornecidos pelo chamador. Retorna `null` para clones/JSON/erros externos, e um snapshot frozen da primeira recusa para a operação original.

O snapshot tem somente versão, fase fechada (`input`, `list`, `spawn`, `collect`, `parse`, `cleanup`, `retained`), contagens limitadas de stdout/stderr e estados originais fechados de spawn, stdin, callback, EOFs, exit, close e cleanup. `retained` distingue um erro original observado depois do retorno do receipt. Cancelamento ou callback tardio não reescrevem um snapshot já registrado. Não contém texto de processo, paths, SQL, dados, nomes, dump IDs ou conteúdo das histórias. Root poderá projetar esses enums/contagens para diagnosticar uma futura observação sem reabrir outputs privados.

`parserError` é `null` ou um dos nove códigos fechados de `MIGRATION_HISTORY_ERROR_CODES`. Sua atribuição ocorre somente no catch da chamada direta confiável a `migrationHistoryCopySelection` ou `extractMigrationHistory`: exige um `BackupError` não Proxy e descriptor próprio de dados `code` pertencente à allowlist B3. Não consulta `message`, `cause` ou getters. Um erro de provider, mesmo forjado com um código B3 permitido, nunca preenche o campo. COPY original incompatível pode recusar antes de IO com o código externo `RESTORE_MIGRATION_HISTORY_NATIVE_TOC_REFUSED`; stdout truncado/envelope/COPY recusado conserva `RESTORE_MIGRATION_HISTORY_NATIVE_PARSER_REFUSED`. O código B3 complementar fica somente no diagnóstico nominal da primeira recusa, imutável mesmo se cleanup ou eventos posteriores também falharem.

Os erros próprios possuem somente os códigos fechados de `NATIVE_HISTORY_ERROR_CODES`, sem causa ou dados anexados. O módulo não possui CLI de execução: import e `--help` são inertes; outros argumentos informam `ROOT_IN_PROCESS_ONLY`.

## Ligação e validação pendentes

Root deve adicionar um modo explícito no inspector depois de AEAD completo, reconferência do ciphertext, plano e cruzamento binário de TOC; passar os inputs originais e o scope emprestado; consumir as contagens enquanto os handles estão vivos; descartar o receipt antes do TOC e do dump; atualizar dispatcher/envelope/error allowlist/pins; revisar e testar esse delta separadamente. O `finally` atual do inspector invalida o TOC, portanto nenhum handle de história pode ser devolvido para uma etapa posterior fora dessa operação. A2/qualificador/mint futuros precisam consumir os fatos dentro do mesmo fluxo privado original.

QA deste pacote usa exclusivamente wire fixtures, streams e children artificiais em RAM. Cobre pares de terminais originais, EPIPE condicional, parser completo, limites, inputs hostis, deadline/cleanup, primeira recusa, callback/chunk tardio, ownership, descarte e diagnóstico nominal.

Com o semáforo de Root, a primeira execução em Node 24.19.0, `--test-concurrency=1`, passou 19/19 em 420 ms e lint2 passou. Esse recorte não cobria eventos originais posteriores à resolução de collect e **não foi aceite final**. O peer confirmou uma regressão: um `stdin/error ECONNRESET` disparado durante cleanup ficava somente na closure de uma Promise já resolvida e o receipt ainda podia passar. A correção acrescenta o guard persistente descrito acima, sem alterar os terminais exigidos ou o contrato de EPIPE.

Após a correção, a primeira execução ampliada passou **21/21**, zero falhas/skips, em 369 ms; lint2 posterior passou com zero warnings. As duas novas matrizes cobrem cinco eventos em cleanup e após receipt: stdin/error, child/error, stdout/error, stderr/error e callback duplicado. Conferem veto, descarte imediato de B3, propagação do primeiro erro, diagnóstico congelado e prioridade sobre uma falha posterior de cleanup. Nenhum processo externo, helper PowerShell, arquivo privado, conexão, extração real ou restore foi executado. A revisão independente, a integração do inspector e a futura observação nativa continuam sob responsabilidade de Root. **Esses resultados sintéticos não constituem aceite hospedado, prova de origem ou autorização de restore.**

A rodada de 21 testes ainda exercitava o transporte somente com um TOC source. O complemento final constrói um plano B4 target genuíno e seu `extractCustomTargetToc`, com o mesmo COPY artificial. Confere os dois estados de stdin, identidade do binding target no receipt e em B3, `projectRef/nativeDumpSha256/nativeDumpBytes`, ausência de `archiveSha256`, recusa antes de IO de swaps incompatíveis com bytes/listagem/handle source, revalidação e descarte independente. Não afirma que o target real esteja vazio ou autorizado.

O complemento de diagnóstico distingue B3 `TRUNCATED` de COPY estrangeiro `FORMAT_UNSUPPORTED`, registra COPY original incompatível antes do primeiro IO e recusa spoof/erros de provider sem acessar seus getters. Na primeira execução da rodada final: **25/25 PASS**, zero falhas/skips, em 371,77 ms, Node 24.19.0 com `--test-concurrency=1`; lint2 sequencial passou com zero warnings. Os recortes de 19 e 21 testes acima permanecem como histórico, não como aceite final da versão ampliada. Nenhuma operação real ou arquivo existente foi alterado por esses complementos.
