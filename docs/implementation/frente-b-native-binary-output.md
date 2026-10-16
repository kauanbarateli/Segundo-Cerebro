# Transporte binário da saída nativa no Windows

Entrega separada da Frente B, em 16/10/2026. Este pacote de três arquivos não modifica `restore-migration-history-native.mjs` e não autoriza restore, consulta de alvo ou nova leitura privada. Root prepara um candidato de integração separado, que exige revisão e evidência próprias. Nenhum processo PowerShell ou PostgreSQL foi executado pelo agente implementador.

## Evidência e hipótese

Root encerrou uma inspeção autenticada cujo parser recusou o par fechado `preamble/banner_restrict`. Depois executou **uma vez** um controle inteiramente público, com cabeçalho artificial e TOC vazio: pg_restore 18 terminou com zero, produziu 578 bytes em stdout, zero em stderr, sem BOM e com 27 sequências CRLF; o banner inicial estava em CRLF. A captura privada não foi reaberta para inferir seu prefixo.

Isso é compatível com uma diferença de transporte no Windows, mas não prova sozinho que todos os bytes privados tenham essa causa. A implementação evita converter CRLF, decodificar SQL/COPY ou tornar o parser permissivo.

No source PostgreSQL `REL_18_4`, `SetOutput` usa `PG_BINARY_W`. Para um path de saída, o compressor sem compressão chama `fopen(path, mode)`; no Windows essa macro vale `wb`. A hipótese para a próxima contraprova pública é passar um named pipe local próprio em `--file=\\.\pipe\<nome>`, fazendo o produtor abrir um descritor binário novo. O módulo entrega esse path somente depois da criação e da conferência de segurança do servidor do pipe. Não chama `pg_restore` por conta própria. [Archiver](https://github.com/postgres/postgres/blob/REL_18_4/src/bin/pg_dump/pg_backup_archiver.c), [compress_none](https://github.com/postgres/postgres/blob/REL_18_4/src/bin/pg_dump/compress_none.c), [PG_BINARY_W](https://github.com/postgres/postgres/blob/REL_18_4/src/include/c.h).

## Arquivos e fronteira

- `scripts/operations/restore-native-binary-output.mjs`: helper fixo, lease e receipt opacos, coletor binário e guards.
- `tests/scripts/restore-native-binary-output.test.mjs`: fixtures de eventos/streams em RAM, sem PowerShell, PostgreSQL, sockets ou perfis.
- Este documento.

Este pacote não altera arquivo anterior, helper de ACL de arquivo, workflow, parser B3, NativeHistory ou migration. O candidato de integração de Root está fora dessa contagem. Não há novo executável, `Add-Type`, P/Invoke, bypass de política, `_setmode`, serviço externo ou arquivo temporário de SQL.

## Interface para Root

```js
const lease = startNativeBinaryOutput({
  systemRoot, powerShellExecutable,
  helperSha256: NATIVE_BINARY_OUTPUT_HELPER_SHA256,
  environment: { SystemRoot: systemRoot, PATH: system32 },
}, originalScope);
try {
  await awaitNativeBinaryOutputReady(lease);
  const outputPath = nativeBinaryOutputPath(lease); // Uma obtenção apenas.
  nativeBinaryOutputCheck(lease);
  // Root cria o PG original com --file=<outputPath> e observa seus eventos.
  // Root aguarda, separadamente, seus próprios stdin/stdout/stderr/exit/close.
  const receipt = await finishNativeBinaryOutput(lease);
  nativeBinaryOutputCheck(lease);
  const facts = nativeBinaryOutputFacts(receipt);
  // Rejeitar facts.transportMode !== "native" na integração real.
  // Somente DEPOIS de qualificar também os terminais originais PG:
  const bytes = copyNativeBinaryOutput(receipt); // Cópia dedicada, uma vez.
  // B3 extrai sua própria cópia/vínculo; reconferir os guards antes de aceitar.
} finally {
  discardNativeBinaryOutput(lease);
}
```

O exemplo descreve a ordem de integração; não é um executor. Root precisa cuidar de erros concorrentes com as duas leases e com o escopo original. O módulo não possui eventos nem facts do PG, não recebe um fake child para combinar os processos e não os projeta como um processo único.

| Função | Contrato |
| --- | --- |
| `startNativeBinaryOutput(options, scope, ports?)` | Retorna a lease opaca antes de atestação/spawn assíncronos; descarte antecipado impede spawn tardio. |
| `awaitNativeBinaryOutputReady(lease)` | Aguarda READY original e reconfere guard/scope; não é conclusão nem receipt. |
| `nativeBinaryOutputPath(lease)` | Disponível somente após READY, enquanto helper está vivo; obtido uma vez. Não registrar o path. |
| `nativeBinaryOutputCheck(lease)` | Reconferência síncrona do primeiro erro e do mesmo deadline; permanece ativa depois do receipt. |
| `finishNativeBinaryOutput(lease)` | Aguarda todos os terminais originais do helper, confere contagem e digest e cria receipt opaco. |
| `nativeBinaryOutputFacts(receipt)` | Metadados fechados do helper; nenhum path, SID, digest privado ou conteúdo SQL. |
| `copyNativeBinaryOutput(receipt)` | Uma `Uint8Array` dedicada; continua pertencendo ao lifetime da lease e é zerada por falha/descarte. |
| `discardNativeBinaryOutput(handle)` | Idempotente; zera RAM própria, invalida lease/receipt e pede cancelamento somente do helper próprio. |
| `nativeBinaryOutputDiagnostic(error)` | Metadados nominais da primeira recusa do módulo; clones e erros de fornecedor retornam `null`. |

Leases e receipts são objetos vazios, congelados, de protótipo nulo. Sua autoridade está nos `WeakMap` internos. JSON, clone, Proxy, relatório e objeto com `transportMode: "native"` não cunham autoridade.

## Segurança do pipe novo

O nome é gerado com 32 bytes de `crypto.randomBytes`, prefixado por `sc-binary-v1-`, nunca fornecido por usuário/configuração. O helper recebe esse nome e somente o orçamento restante, além de ambiente operacional reduzido. Não recebe senha, chave, token, texto SQL ou path de backup.

O helper é um texto PowerShell 5 fixo enviado por `-EncodedCommand`. Seu SHA-256 exportado precisa coincidir com a opção `helperSha256`. O executável aceito é exclusivamente `SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe`, com pin de 495.616 bytes e SHA-256 `60c9b29843624dd8af6b6a7b26147753be6aeef65098b9a503cc50850afe410f`. O provedor nativo confere arquivo regular, path real, tamanho e hash antes do spawn. Runtime nativo exige Windows x64 e Node `v24.19.0`.

O servidor usa `NamedPipeServerStream` com direção `In`, transmissão `Byte`, opção `Asynchronous`, uma instância e handle não herdável. O Reference Source do .NET Framework aplica `FILE_FLAG_FIRST_PIPE_INSTANCE` quando o máximo é 1; um servidor já existente com o mesmo nome não deve ser reutilizado. [Pipe.cs](https://github.com/microsoft/referencesource/blob/main/System.Core/System/IO/Pipes/Pipe.cs).

A DACL é exclusiva do **pipe novo**, com owner igual ao SID atual e herança protegida. Root aprovou exatamente duas ACEs explícitas:

1. Deny `NETWORK` (`S-1-5-2`) com `FullControl`.
2. Allow SID do usuário atual com `FullControl`.

Não há outros Allow. Depois de criar o pipe, `GetAccessControl()` confere owner, proteção, exatamente duas regras não herdadas e os SIDs, tipos e direitos completos esperados. A negação NETWORK reduz o acesso sem modificar ACL de arquivo existente. SID do usuário e prefixo local, isoladamente, não bastam para provar acesso somente local. [Segurança de named pipes](https://learn.microsoft.com/en-us/windows/win32/ipc/named-pipe-security-and-access-rights), [Named Pipes](https://learn.microsoft.com/en-us/windows/win32/ipc/named-pipes), [PipeSecurity](https://github.com/microsoft/referencesource/blob/main/System.Core/System/IO/Pipes/PipeSecurity.cs).

## Bytes, protocolo e conclusão

O helper lê `byte[]` do pipe e escreve no `Stream` de `Console.OpenStandardOutput()` com `WriteAsync`. Não há `StreamWriter`, text writer, normalização, BOM ou decodificação do payload. A conexão usa o par APM `BeginWaitForConnection`/`EndWaitForConnection`, compatível com Framework anterior à introdução de `WaitForConnectionAsync`. As sobrecargas de `ReadAsync`/`WriteAsync` com arrays e `Task.Wait(int)` são compatíveis com Framework 4.5. [Stream](https://github.com/microsoft/referencesource/blob/main/mscorlib/system/io/stream.cs), [Task.Wait](https://learn.microsoft.com/en-us/dotnet/api/system.threading.tasks.task.wait?view=netframework-4.8.1).

Stderr contém somente ASCII binário com LF e esta gramática fechada, no máximo 1 KiB:

```text
SC_BINARY_PIPE_READY_V1\n
SC_BINARY_PIPE_COMPLETE_V1:<decimal entre 1 e 20971520>:<sha256 hexadecimal minúsculo de 64 caracteres>\n
```

Uma recusa do helper usa somente `SC_BINARY_PIPE_REFUSED_V1\n`. Texto desconhecido, duplicatas, BOM, CRLF, linha parcial ou metadados fora do limite recusam. READY só é escrito após a prova da DACL. COMPLETE contém contagem/digest de todos os bytes lidos do pipe; estes dados ficam na RAM interna, sem exposição nos facts públicos.

Os retornos de `GetResult()` das tarefas de escrita são explicitamente descartados com `[void]`; o valor da leitura fica atribuído a `$count`. Os demais métodos usados somente por efeito e as chamadas a `Send-Control` também suprimem seu retorno. O stdout de payload tem uma única origem prevista: o stream binário de `Console.OpenStandardOutput()`, nunca resultados formatados pelo pipeline PowerShell.

O source Framework mostra que o caminho de escrita herdado pode retornar uma tarefa genérica de `VoidTaskResult`; seu awaiter genérico devolve esse valor. PowerShell envia resultados não consumidos ao pipeline. Essa possibilidade de emissão era um defeito comprovado do helper anterior, embora a causa exata dos bytes de uma execução permaneça uma hipótese até uma contraprova pública nova. [Stream.WriteAsync](https://github.com/microsoft/referencesource/blob/main/mscorlib/system/io/stream.cs), [Task genérica](https://github.com/microsoft/referencesource/blob/main/mscorlib/system/threading/Tasks/Future.cs), [TaskAwaiter](https://github.com/microsoft/referencesource/blob/main/mscorlib/system/runtime/compilerservices/TaskAwaiter.cs), [PowerShell 5.1 — saída de funções](https://github.com/MicrosoftDocs/PowerShell-Docs/blob/main/reference/5.1/Microsoft.PowerShell.Core/About/about_Functions.md).

O Framework pode tratar broken stdout pipe como sucesso em `ConsoleStream`; por isso um ACK de escrita ou exit zero não bastam. Node exige, em conjunto, READY e COMPLETE válidos, path já obtido, spawn original, EOF original de stdout e de stderr, exit original zero, close original zero e contagem/digest coincidentes com os bytes coletados. O payload tem limite de 20 MiB, no máximo 4.096 chunks dedicados e uma cópia exportada. [ConsoleStream](https://github.com/microsoft/referencesource/blob/main/mscorlib/system/io/__consolestream.cs).

Os listeners originais permanecem ativos após concluir. Erro tardio, terminal duplicado, dados depois de EOF ou fechamento sem EOF vetam o uso do receipt e zeram as cópias. Não se sintetiza evento e não se usa `kill`, `destroy`, ACK ou estado `killed` como EOF. O close do helper não demonstra qualquer terminal do PG. [Node 24 child_process](https://github.com/nodejs/node/blob/v24.19.0/doc/api/child_process.md), [Node 24 streams](https://github.com/nodejs/node/blob/v24.19.0/doc/api/stream.md).

## Escopo, erro e descarte

O chamador fornece exatamente seu escopo original `{ check, remaining, race, close }`, até 45 segundos. O módulo chama seus guards antes/depois das esperas e no acesso retido; nunca chama `close()` do escopo nem cria um novo deadline de 45 segundos. O helper usa um Stopwatch e apenas o orçamento restante entregue no spawn. Esse limite local é secundário; não substitui nem prolonga o deadline de Root.

`Task.Wait` expirada não cancela a operação. O helper fecha seus próprios handles em `finally`; Node pede cancelamento do helper próprio na primeira falha/descarte. Se faltarem terminais originais, a limpeza continua não qualificada. Nenhum sucesso é inferido de pedido de cancelamento.

Chunks originais de stdout/stderr são zerados em `finally` dos listeners, inclusive depois de uma recusa ou descarte. Retenção e cópia são buffers dedicados e também são zerados na primeira falha/descarte. Proxy, buffer compartilhado e store destacado recusados não são tratados como memória própria; stores transferidos para fora do controle não têm garantia de zeragem. Não é possível zerar strings internas gerenciadas pelo runtime; o payload não é convertido em string.

As portas injetadas `{spawn, randomBytes, attestExecutable}` são exclusivamente sintéticas. Só a fábrica interna que usa os provedores reais recebe modo `native`; metadados retornados por uma porta de teste não mudam esse modo. Isso prova origem da observação nesta API, **não** autenticação de backup nem identidade do escritor PG.

## Limites e próxima validação

O hash do executável lido antes do spawn não atesta a imagem executada diante de substituição concorrente/ataque de mesmo usuário. A integração operacional deve manter os pins e leases originais de arquivos públicos/executáveis que Root já usa. A DACL e o nonce não demonstram, sozinhos, que o cliente conectado é o processo `pg_restore` esperado; um processo com a mesma identidade e acesso ao nonce está no limite de confiança. Root deve continuar vinculando a observação aos seus processos originais, com guards separados e sem agregar eventos dos dois filhos.

Esse helper depende das APIs .NET/PowerShell e da política de execução permitida no computador. As provas de fonte e os testes sintéticos não demonstram funcionamento nativo. O primeiro uso precisa ser **um controle novo, público e de TOC vazio**, usando o mesmo pipe, executável e comandos fixos, com os terminais PG e helper observados separadamente. Só depois de aprovação de Root/peer e resultado LF íntegro será pertinente propor nova inspeção privada. Não se reabre nem repete a captura anterior.

## Validação desta entrega

Root encerrou o primeiro controle público pelo pipe, com fixture artificial de 83 bytes, sem entrada privada: `PUBLIC_CONTROL_REFUSED`; o diagnóstico observou READY/COMPLETE, spawn, os dois EOFs e exit/close zero do helper, com 668 bytes em stdout e 120 em stderr. Esse controle não é repetido nem promovido a sucesso. A revisão identificou os retornos de tarefas de escrita sem supressão; a regressão de fonte falhou contra o helper anterior antes da correção com `[void]`. Não foi aberto payload ou captura privada para esse diagnóstico.

Na versão corrigida passaram **25/25 testes RAM** em Node `v24.19.0`, com `--test-concurrency=1`, e lint dos dois `.mjs` com zero avisos. Os controles de integridade, limites e parser não foram afrouxados. Nenhum PowerShell, PG, perfil, archive ou serviço foi executado/acessado pelo agente implementador. Root/peer devem conferir os três pins, executar sua validação própria e definir um novo controle público; os testes sintéticos não qualificam o transporte nativo nem o candidato separado de integração.

```text
node --test --test-concurrency=1 tests/scripts/restore-native-binary-output.test.mjs
eslint --max-warnings=0 scripts/operations/restore-native-binary-output.mjs tests/scripts/restore-native-binary-output.test.mjs
```
