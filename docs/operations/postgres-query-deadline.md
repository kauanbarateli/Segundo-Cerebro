# Prazo das consultas operacionais PostgreSQL

`scripts/operations/postgres-process.mjs` atende ao catálogo de release e às consultas fixas de preflight e catálogo do restore. Antes desta correção, aguardava o fim de stdout antes de observar o resultado do subprocesso, sem prazo global. Um processo sem saída/fim podia impedir o CLI de retornar. A reprodução somente em memória manteve a consulta pendente até a destruição externa do stream; não houve conexão, processo PostgreSQL nativo ou leitura de credenciais.

## Contrato

Cada chamada tem **45 segundos de prazo local total**, iniciado antes de `spawn`, para coletar stdout e observar o encerramento. Uma falha de processo é observada em paralelo à coleta; stdout aberto não adia a falha. `exit` não zero ou por sinal rejeita imediatamente, mesmo que um pipe retido adie `close`. `exit` zero sozinho nunca aprova: o sucesso exige `close` zero e coleta completa. Além do timer, verificações monotônicas por iteração e antes do retorno impedem que chunks vazios continuamente resolvidos monopolizem microtasks e adiem a detecção do prazo. JavaScript não interrompe código síncrono bloqueado dentro de um double; um `spawn` que retornar depois do prazo é recusado assim que devolver o controle. O quinto argumento da função permite somente encurtar esse prazo em doubles locais, entre 1 e 45.000 ms. Não existe configuração de CLI/perfil para desabilitar ou estender o teto.

O subprocesso recebe `PGCONNECT_TIMEOUT=8` e `PGCLIENTENCODING=UTF8`, fixos, sem modificar o ambiente do chamador. O primeiro limita a etapa de conexão do libpq; não substitui o prazo que cobre coleta e encerramento. Credenciais continuam somente no ambiente do processo. `--no-password` impede prompt interativo; `--no-psqlrc`, `shell:false`, `windowsHide:true` e `ON_ERROR_STOP=1` permanecem ativos. Nenhum detalhe de stderr, SQL, ambiente ou exceção original é devolvido no erro.

A saída tem teto de **1.048.576 bytes**, medido antes de copiar cada chunk. Deve ser UTF-8 válido e exatamente um objeto JSON, além de exigir encerramento com código zero. UTF-8 fragmentado entre chunks é aceito; bytes inválidos, BOM, documento truncado, múltiplos documentos, arrays, `null` e escalares são recusados. O consumidor ainda valida o DTO específico de release ou preflight: um objeto JSON não equivale a um catálogo aprovado.

| Código fechado | Significado local |
| --- | --- |
| `PSQL_UNAVAILABLE` | Falha de criação/processo ou transporte indisponível |
| `PSQL_FAILED` | Encerramento com código diferente de zero, inclusive sinal |
| `PSQL_TIMEOUT` | Prazo total esgotado antes de concluir coleta e encerramento |
| `PSQL_OUTPUT_LIMIT` | Saída acima do teto de bytes |
| `PSQL_INVALID_REPORT` | Falha de leitura/formato, UTF-8 ou objeto JSON inválido |

Falhas removem os listeners operacionais, cancelam o timer, tentam destruir os pipes, solicitar o retorno do iterator e enviar `SIGKILL`. Essas tentativas não são aguardadas: um iterator que ignora cancelamento ou um processo sem evento `close` não pode prender o retorno. Exceções de `destroy`, `return`, `kill` e `unref` não substituem o código original. Guardas estáticos absorvem erros tardios do processo/stderr, e as tarefas que perdem a corrida têm observadores de rejeição. Os buffers copiados são zerados após a chamada; os buffers de origem não são alterados.

## Quando a consulta falhar

O erro é uma constatação **local**. Enviar um sinal, destruir os pipes ou retirar a referência do processo do event loop **não comprova término remoto, cancelamento no PostgreSQL, rollback ou ausência de efeitos anteriores do restore**. Não há retry automático, segunda criação de subprocesso ou substituição de destino.

No preflight do restore, a falha impede iniciar a importação. No catálogo final, banco e objetos podem já ter sido restaurados; timeout não desfaz essas etapas. Preserve o resultado como não confirmado, resolva operacionalmente a situação do processo/conexão e confira o alvo por canais readonly antes de decidir repetir qualquer operação. Não reexecute um restore para obter um catálogo, não use BlackSheep/VOE e não interprete um erro local como autorização para limpar ou recriar o alvo.

Esta mudança limita somente as chamadas de `queryPostgres`. Não acrescenta deadline ao dump, à importação nativa, aos uploads Storage ou à consulta privada de aceite, nem valida backup/restore hospedado. Os timeouts SQL dos arquivos fixos continuam separados; não houve alteração de schema, migrations, grants, Auth ou pins do aplicativo.

## Evidência local

```powershell
node --test tests/scripts/postgres-process.test.mjs tests/scripts/operations.test.mjs tests/scripts/backup.test.mjs
```

Resultado: **40/40 testes**, incluindo 19 regressões novas. Os doubles demonstram `exit` falho/por sinal sem `close` com stdout pendente, `exit` zero aguardando coleta e `close`, falha de close/error com stdout pendente, stdout válido sem `close`, exit zero sem fim de stdout, iterator/retorno/kill que não cooperam, chunks vazios sem pausa, spawn que retorna após o prazo, exceções síncronas, races, erros tardios sem rejeição não observada, remoção de listeners/timer, teto exato de bytes, excesso, UTF-8 fragmentado/inválido e JSON fechado. Os testes existentes mantêm o contrato dos consumidores de release/restore e arquivos cifrados sintéticos; nenhum PostgreSQL nativo, Supabase hospedado, segredo ou dado pessoal foi utilizado.

Referências de comportamento: [PGCONNECT_TIMEOUT e PGCLIENTENCODING no PostgreSQL 17](https://www.postgresql.org/docs/17/libpq-envars.html), [eventos e cancelamento de ChildProcess no Node 22](https://nodejs.org/docs/latest-v22.x/api/child_process.html), [TextDecoder fatal no Node 22](https://nodejs.org/docs/latest-v22.x/api/util.html#new-textdecoderencoding-options). As APIs do Supabase não foram alteradas nesta entrega.
