# SourceTOC Windows: diagnóstico literal EOF, sem mudança de aceite

Refs #35 e PR #100. Este incremento não executa backup, restore, migrations, merge ou deploy. A fonte operacional anterior permanece preservada em `3d86cd8f7e1e97e89990513237a8d4ef792b3249`; a nova fonte deve ter seus próprios resultados de CI e preparo antes de qualquer nova inspeção.

## Fato observado

Na inspeção readonly de22/10, a autenticação integral do archive terminou e o processo original de listagem do TOC iniciou. A primeira recusa foi `INSPECTION_INPUT_FAILED`, no callback de stdin, sequência4, com código sanitizado `other`. Não houve EOF/exit/close antes dessa recusa. SIGKILL posterior pertence à limpeza solicitada, não identifica a causa original. O destino não chegou a ser consultado; comparação, qualificação, mutação e aceite permaneceram falsos.

Captura nova fechada:2544 bytes, SHA256 `db28a1fdbc43ba2acf3ad68284e527a0f762e5ae488735844fde8ae321bcadce`. Não reclassificar `other` retrospectivamente como EOF nem repetir a captura para adivinhar o código.

## Alteração restrita

- O observer original reconhece mais um literal de diagnóstico: `EOF`. Mantém descritor próprio de dados, veto a Proxy/getter, `other` e `unavailable`, primeira recusa, saturação64 e fotografia final.
- A projeção fechada de falha reconhece o mesmo literal. Não aceita códigos livres, mensagens, stderr, SQL, paths ou aliases. `EOF` não é código externo de recusa, terminal do processo ou o evento `stdoutEOF`.
- Os três predicados `inputError !== "EPIPE"` permanecem intactos. Callback/error EOF continua recusando a entrada, inclusive quando stdoutEOF/exit0/close0 já foram observados. Nenhuma capacidade, mint, autorização, importação, timeout ou limpeza muda.
- Os testes conservam a ordem callback/evento, primeira recusa, ausência de consulta ao alvo e proibição de autoridade. Acrescentam EOF nas duas ordens e um negativo com terminais originais anteriores à recusa; o parser rejeita EOF externo, aliases e canários.

Esses controles são sintéticos. Não demonstram qual código o Windows apresentou na inspeção nem qualificam o backup.

## Fonte primária da hipótese

O executável Node público pinado declara24.19.0 por metadados PE, sem execução nesta pesquisa. O tag oficial foi vinculado ao commit `cdc1b38d40cb567b7ad0b39c86addf830a0af0ae`; o libuv vendorizado é1.52.1.

- [Callback assíncrono de pipe Windows](https://github.com/nodejs/node/blob/cdc1b38d40cb567b7ad0b39c86addf830a0af0ae/deps/uv/src/win/pipe.c#L2023-L2054): entrega a tradução genérica do erro.
- [Tradução de erros](https://github.com/nodejs/node/blob/cdc1b38d40cb567b7ad0b39c86addf830a0af0ae/deps/uv/src/win/error.c#L152-L175): `ERROR_BROKEN_PIPE` pode resultar em UV_EOF nesse caminho. Existe um tradutor de escrita diferente; não presumir que todos os caminhos usam a mesma função.
- [Node entrega ErrnoException ao callback](https://github.com/nodejs/node/blob/cdc1b38d40cb567b7ad0b39c86addf830a0af0ae/lib/internal/stream_base_commons.js#L75-L86) e [grava code como propriedade própria](https://github.com/nodejs/node/blob/cdc1b38d40cb567b7ad0b39c86addf830a0af0ae/lib/internal/errors.js#L679-L699).

Isso justifica distinguir o literal no diagnóstico. Não justifica aceitar EOF como EPIPE nem afirmar que foi a causa desta inspeção.

## Preparo operacional posterior

O preparo v1 e seus372 controles públicos pertencem à fonte3d e à rodada420, permanecendo byte-preservados. Eles não certificam um leitor EOF novo. Não usar a nova fonte com o leitor integral antigo nem modificar um preparo já executado.

Antes de uma nova inspeção: concluir revisão e CI próprios; criar preparo v2 com novo caminho/self-hash, SHA/árvore conhecidos e reconferência dos19 pins públicos; estender somente as listas diagnósticas do leitor integral; publicar cópias públicas byte-exatas e executar seu QA sem arquivos privados. Defaults false/null, leases, UTF8/duplicatas/quota64KiB, prazo externo90s/interno45s/ACL15s e preservação da primeira recusa não mudam. Nova observação explícita única somente após esses gates, sem retry automático.

## Limite de recuperação e corte

Mesmo depois do diagnóstico, a composição completa ainda falta: pack019 explícito e catálogo pre-COMMIT adequado; owner interno da aquisição nativa→A2→qualificação→mintA1→stream; integração Storage-only com recibo privado de commit e conferência por redownload/inventário; ensaios Auth/Cofre/dados. O CLI legado full-clean e relatórios JSON não fornecem esse handoff.

Um backup025 posterior não protege uma falha durante o corte019→025. A produção c46 é incompatível com os novos writers/retornos das migrations021/023. O [pré-corte preparado na PR101](https://github.com/kauanbarateli/Segundo-Cerebro/blob/f571ccf165097d8b774439d96377d92fd544a135/docs/implementation/corte-migrations020-025-20261022.md) continua sem DDL, e homologação/aceites conectados dependem da decisão de ambiente. Origem pessoal `rishenjoikgmfubmnfiu`; alvo autorizado de restore somente Ensaio_restore `jvwduowyavpaxssogadn`. Sem VOE, BlackSheep, legado, resets ou reaplicação001–019.

A estimativa inicial16–24h foi preliminar. Após decompor a composição faltante, a faixa de planejamento para este lote de recuperação/corte/aceites é **24–48 horas técnicas**, cerca de3–6 dias de trabalho, com paralelismo e sem contar espera humana. Divergências nativas/baseline podem ampliar esse prazo. Isso não é previsão para todas as issues do MVP ou contratação/onboarding.

## Estado desta entrega

Implementado: enum passivo, projeção, controles negativos e guarda de deploy da branch. Revisado estaticamente: patch e fontes primárias. Pendente: CI próprio, preparo v2, nova observação, recuperação integral, aplicação020–025 e aceites conectados/físicos. Nada desses itens pendentes recebe PASS pelo desenho ou pelo resultado de outro SHA. Merge e deploy da PR100 e deste incremento permanecem bloqueados.
