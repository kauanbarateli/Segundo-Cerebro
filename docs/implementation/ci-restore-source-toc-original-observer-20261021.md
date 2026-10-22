# SourceTOC original: observação passiva da primeira recusa

Refs #41, #35 e #42. Base: `69b18e8f6858f0aa2394b980cde84bfebb6c5c97`.

## Problema e alcance

A recusa anterior `INSPECTION_INPUT_FAILED` não determina qual erro nativo de entrada ocorreu. A PR #97 preserva o contexto nominal da primeira recusa, mas não observa o transporte original do SourceTOC. Este delta prepara essa observação; não demonstra a causa anterior e não autoriza repetir uma captura encerrada, consultar um perfil ou executar uma inspeção real.

Somente o filho original de `pg_restore --list --verbose` da origem recebe o observador. ACL, TargetTOC, SourceALL/DATA e TargetALL/DATA não recebem esse registro. Associações de filho, proprietário combinado e erro sanitizado permanecem em `WeakMap`s privados. Nenhum handle, comando novo, módulo de autoridade ou workflow é criado.

## Contrato do diagnóstico

A falha de `inspect-baseline` acrescenta `sourceTocDiagnostic`, nulo se o SourceTOC ainda não foi solicitado. Os resultados de sucesso e os demais envelopes de CLI conservam seus campos existentes. Quando presente, o diagnóstico tem apenas:

- `version: 1` e `observer: source_toc_original`;
- `firstRefusal`: código fechado da primeira recusa e fotografia congelada dos fatos que já estavam observados naquele ponto, ou nulo se o SourceTOC não recusou;
- `finalCleanup`: fotografia congelada no fim do `finally` proprietário. O nome indica o ponto da observação, não que o processo terminou ou confirmou cancelamento.

Cada fotografia contém `sequence` saturada em 64, `overflow`, `firstError`, `lastError` e o mapa fechado `events`. Não existe lista crescente de eventos. Cada posição do mapa conserva a primeira ocorrência; nulo significa **não observado**, nunca sucesso implícito. `lastError` permite distinguir um EPIPE inicial de outro erro posterior no mesmo canal, inclusive na fotografia da primeira recusa. Antes da saturação, as sequências permitem comparar a ordem observada pelo JavaScript; com `overflow: true`, não se infere ordem estrita entre ocorrências saturadas.

Eventos permitidos: pedido de spawn; spawn efetivo; exceção síncrona do spawn; pedido de `stdin.end`; callback de `end`; `stdin.finish`; erro de stdin; exceção síncrona de `end`; erro do filho/stdout/stderr; EOF e close de stdout/stderr; exit e close do filho; pedidos locais de destroy de cada stream, kill e unref. O observador não adiciona consumo de stdout nem lê stderr.

O callback tem resultado `ok` ou `error`, independente de `finish`. Códigos de erro são apenas `EPIPE`, `ERR_STREAM_DESTROYED`, `other` e `unavailable`; callback sem erro usa `none`. A classificação lê somente descritor próprio de dado de `code`. Accessor, Proxy, propriedade herdada e valor não textual ficam `unavailable`; nenhuma mensagem, stack, cause ou método do provedor é consultado pelo observador. O qualificador antigo de stdin conserva sua leitura e sua política; o diagnóstico não acrescenta leitura de getter a ele.

Exit/close têm somente classe `zero`, `nonzero` ou `unavailable` e sinal `none`, `SIGKILL`, `SIGTERM`, `SIGINT` ou `other`. Não são registrados código numérico do processo, PID, caminho, horário, duração, tamanho, bytes, argumento, SQL, conteúdo do dump ou texto de erro. Pedidos locais são marcados antes dos efeitos e não substituem eventos terminais.

`firstError` é a primeira observação de erro de transporte; não equivale à primeira recusa. Um EPIPE permitido pode preceder outro erro que recuse. Erros posteriores e efeitos de limpeza podem aparecer em `finalCleanup`, sem alterar `firstRefusal`, seu código, o envelope nominal da origem ou a prioridade do latch original. Fotografias já publicadas não recebem eventos tardios.

## Regras preservadas

O SourceTOC continua exigindo EOF real de stdout e close0, sem erro de entrada fora da exceção EPIPE original. A exceção permanece exclusiva do TOC da cópia já autenticada. O diagnóstico de `ERR_STREAM_DESTROYED` não o torna aceitável. Callback, finish, spawn, stderr EOF e exit ausentes continuam registrados como ausentes; não importamos os gates mais fortes do transporte DATA para esta etapa.

O orçamento absoluto de 45 segundos, o limite ACL de 15 segundos dentro dele, a prioridade da primeira falha, a autenticação/reconferência do ciphertext, o plano, a comparação A2, o descarte e a limpeza não mudam. Diagnóstico não concede `baselineQualified`, snapshot, mint, importação, escrita remota ou aceite de restore. Falha continua sem comparação parcial; os indicadores de autoridade permanecem falsos.

## QA preparada e validação pendente

Os controles usam o `runManagedInspect` original, o writer AES-GCM original, vetores CUSTOM/COPY públicos sintéticos e filhos em RAM, sem PostgreSQL, SQL, HTTP ou arquivo privado. As novas regressões cobrem:

- callback antes/depois do evento, códigos discordantes, EPIPE antes de uma recusa e preservação do primeiro código;
- exceções síncronas de spawn e `stdin.end`, distinguindo ausência de filho/callback de eventos efetivos;
- limpeza com erro de entrada e exit/close induzidos, pedidos antes dos efeitos e fotografia inicial imutável;
- callback/finish/spawn/stderr EOF/exit ausentes sem gate novo; close0 sem stdout EOF continua recusado;
- EPIPE em erro de filho/stdout/stderr continua recusado; a exceção não se espalha;
- getters, Proxy, propriedade herdada, canários e ausência de leituras adicionais no qualificador existente;
- saturação da sequência, forma exata/frozen, ausência de dados privados e ausência de resultado adicional após evento tardio.

**Implementado:** código, regressões preparadas e esta documentação. **Validado localmente:** somente revisão estática e integridade do diff. **Pendente:** execução original hospedada no SHA publicado e conferência de todos os gates. A máquina de 8 GB não executou Node, npm, navegador, SQL, processo PostgreSQL ou inspeção real para este delta.

O workflow existente `CI` já inclui `node --test --test-reporter=tap tests/scripts/*.test.mjs`, incluindo o combinado e os controles existentes de inspector/Target. Typecheck, lint, segredos e demais gates permanecem exigidos. Um PASS sintético futuro não é evidência nativa Windows nem resolve a #41 por si só. Qualquer próxima inspeção depende do protocolo atualizado, fonte exata revisada, destino confirmado e decisão separada de Root; capturas CLOSED permanecem encerradas.
