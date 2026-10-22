# Preparo V2 — SourceTOC EOF, somente inspeção readonly

**PREPARADO / NÃO EXECUTADO / NÃO AUTORIZA RESTORE.** Refs #41/#42/#35 e PR102. Este pacote ignored é novo; nenhuma referência, captura ou arquivo V1 foi alterado. Root deve revisar, obter peer e concluir os originais da fonte antes de publicar cópias públicas byte-exatas e executar QA remota. Não há retry ou inspeção implícitos.

## Fonte operacional fixa

- Commit **6784b9e8f5b27abb664ec0b4f17b96bbffe31b1d**, árvore **db5540fa35ddcb344a364f675fcc9a404391863b**, PR102 sobre a cadeia100.
- Checkout operacional DETACHED: `C:\Users\Kauan Sousa Barateli\Documents\Codex\2026-10-07\inicie-a-constru-o-do-software-2\work\Segundo-Cerebro-restore-eof-source-6784b9e`.
- HEAD/tree e ausência de WIP foram conferidos por Git. Os **19 pins** foram reconferidos por bytes/hash em blobs Git e arquivos de disco; a closure possui **45 arestas relativas**, sem import fora da lista. Apenas o inspector muda em relação à V1:53685B/SHA `9aed1c8f138c96407864f27de4905e0a1588ba061eeb2a398c3fac08919d3ed7`. Os18 restantes foram efetivamente reconferidos.
- `source-pins-verification.json` registra essas provas. O ZIP ao lado da pasta contém somente as19 fontes públicas exportadas por Git, não entradas de operação.
- A fonte678 é fixa. O commit futuro que publicar os fixtures/QA pode ser diferente: isso não altera o SHA que a inspeção revisada deve executar.

Base pública utilizada: os3 arquivos V1 de `C:\Users\Kauan Sousa Barateli\Documents\Codex\2026-10-07\inicie-a-constru-o-do-software-2\work\Segundo-Cerebro-mobile-acceptance-20261022\tests\fixtures\restore-readonly`, HEADf571ccf, preservados. PreparoV1:59923B/SHA652739f3…; QAV1:38456B/SHA9d018048…; READMEV1:7746B/SHA25288a6b…. Os arquivos V1 descrevem a fonte3d, e seus resultados anteriores não certificam V2.

## Delta restrito

1. Preparo V2 muda somente as2 listas diagnósticas de `Read-CombinedPrepSourceTocSnapshot` para conhecer o literal `EOF`, mais comentário/bindings de source SHA/tree, checkout operacional, SelfPath novo e o pin do inspector.
2. A QA aponta para o novo preparo e seu hash exato, atualiza os guards de SHA/tree, acrescenta EOF ao enum e um vetor de callback/firstError/lastError. Ele exige `INSPECTION_INPUT_FAILED`, flags de autoridade falsas e nenhuma invenção de EOF/exit/closezero; o fechamento de cleanup anterior permanece apenas `unavailable`.
3. O restante do leitor integral, seus26 corpos puros selecionados por AST, os negativos anteriores e os guards operacionais ficam preservados. O parser JavaScript estreito não é importado nem usado para aceitar todos os envelopes.

EOF em `error.code` não é `stdoutEOF`. O código678 continua recusando EOF na entrada: seus3 predicados funcionais conservam a exceção exclusiva EPIPE. Nenhuma equivalência EOF/EPIPE, terminação ou causalidade da captura anterior é afirmada.

## Gates, coleta e entradas

Defaults **GateExecute=false / ReviewedCommit=null / ArchiveBinding=null / SelfSha256 vazio**. Gatefalse retorna antes de qualquer I/O operativo. O preparo não foi executado nem nesse default.

SelfPath operativo é o arquivo ignored `inspect-combined-baseline-preparacao-20261022-v2.ps1` desta pasta; QA pública lê sua cópia irmã por caminho relativo, sem executar o corpo operativo. Root fornecerá reviewedCommit/SelfHash somente após revisão/QA e decisão explícita de uma nova observação. Copiar para fixtures não autoriza usar outro caminho operativo.

Preservados: leases FileShare.Read, guards de path/reparse/identidade, executáveis absolutos/versões e pins públicos históricos, perfilDPAPI/certificado/archive previamente declarados, ambiente selecionado sem tokens/PG herdados, PS7NoProfileNonInteractive, operação fixa restore-inspect-baseline, stdout<=64KiB/UTF8 estrito/JSON único/duplicatas recusadas, stderr drenado e descartado, doisEOFs e saída original do child.

**Nenhum executável, perfil, certificado ou archive foi aberto, explorado ou hashado nesta preparação V2.** Os pins dessas entradas são apenas os metadados herdados dos templates públicos. Não foram lidos seus conteúdos ou reconferido estado remoto. O único archive permitido permanece o binding histórico17/10 do template; ArchiveBinding=null impede uso implícito. Não escolher “mais recente”, alterar backup ou inferir schema pelo ledger.

O teto externo **90s** conserva conferência após parse somente para sucesso e veto de sucesso tardio após liberação dos recursos; uma primeira recusa não é substituída. Inspector **45s**, ACL **15s** dentro do mesmo escopo, sem aumento/renovação. Kill/ACK não certificam EOF, encerramento ou limpeza.

Origem pessoal rishenjoikgmfubmnfiu; destino autorizado Ensaio_restore jvwduowyavpaxssogadn. Sem banco de produção como alvo, VOE/BlackSheep/legado, SQL/migration, backup novo, importação ou mint. A inspeção conserva inspectionOnly=true, baselineQualified=false, remoteMutation=false e restoreAccepted=false, inclusive em seu envelope de sucesso.

## QA e próximos gates

O QA novo lê somente o preparo público irmão, confere seu pin exato e extrai26 funções ORIGINAIS exclusivas via AST; não executa dispatcher, coleta nativa, filesystem privado, serviços, SQL ou corpo operativo. Continua portável para PS7/Linux. Vetores em RAM preservam sucesso/falhas combinadas e OPERATOR_SETUP_FAILED, correlações A2/TOC/histórias/snapshot, códigos/ordem/primeira recusa/cleanup, UTF8/quota/duplicatas, ausência de autoridade e dados-canário.

Controles EOF acrescentados são diagnóstico de reader; não são observação Windows. Nenhuma contagem de PASS futura foi inferida. Este trabalho fez apenas autoria, leitura pública, hashes Git/disco e parse AST estático para erros de sintaxe; **não executou QA, Node, PG, operador ou inspeção**.

Ordem seguinte: Root+peer revisam este freeze; aguardam todos16 originais678 terminais; Root publica somente cópias públicas byte-exatas/QA/workflow na PR102 com fonte operacional678 preservada; QA própria remota precisa passar; somente depois Root decide uma observação nova explícita única. Sem publicação, execução ou alteração de workflow por este pacote.
