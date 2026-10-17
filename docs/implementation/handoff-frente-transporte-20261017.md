# Frente A — handoff do transporte e diagnóstico de restore

Estado: candidato local para PR Draft; sem commit, push ou integração Main por este agente. Main publicado permanece `61d03c768071e6618136e648fc71c552e3db2043`. O diretório Review tem índice antigo: muitos arquivos já publicados continuam untracked nele. Não publicar um diff integral do índice Review; isso produziria exclusões falsas de fontes já existentes na Main.

## Entrega nova pronta para revisão

| Path Review | Estado |
| --- | --- |
| scripts/operations/restore-managed-inspect.mjs | Sanitização combinada preserva código da primeira falha e contexto WeakMap do envelope do core. |
| tests/scripts/restore-combined-baseline-inspect.test.mjs | 12 controles sintéticos; novos eventos/callbacks stdin e EPIPE original. |
| docs/implementation/frente-b-combined-first-refusal-context.md | Problema, contrato, primeira falha de QA, validação final e resultado real encerrado. |
| work/inspect-combined-baseline-preparacao-20261017-v1.md | Contrato histórico da v1 com aviso CLOSED. Template e QA v1 já são idênticos aos exemplares Main/work. |

QA final próprio: 12/12 PASS, zero skips, Node24/concurrency1, 838,09ms; lint2 PASS, max-warnings=0, 6,08s. Primeira rodada 11/12 falhou em assertion que exigia zeragem de stdout ainda pertencente ao fake produtor, emitido após a recusa. Corrigiu-se somente a assertion para as cópias realmente emprestadas e manteve-se cleanup/código/contexto. Uma invocação não iniciou devido a typo no workdir; corrigido antes da execução final. Não foram executados PG, SQL, serviço, perfil, archive original ou preparo real.

## Operação real encerrada

Root informou a execução única em Main61d03: exit1, wrapper COMBINED_PREP_NATIVE_REFUSED; CLI INSPECTION_INPUT_FAILED, stage source; sourceDiagnostic, targetDiagnostic e nativeHistoryDiagnostic null. comparisonCompleted/baselineCompared false; nenhum import. **Preparo combinado v1 e operativo estão CLOSED. Não repetir, não ativar v2 e não reabrir capturas.**

O código anterior perdia o contexto nominal ao substituir o erro sanitizado SourceCore pelo latch original. O fix local mantém primeiro código e busca o contexto no erro envolvente confiável. Isso não identifica se o erro real ocorreu no callback, no evento stdin ou em outro detalhe do produtor. Os vetores sintéticos não demonstram a causa do resultado conectado.

## Próxima ação da frente, após retomada autorizada

1. Revisar e incorporar o delta mínimo da PR Draft, com peer independente e QA do SHA exato; preservar os demais WIPs. Não tratar PASS sintético como aceite conectado.
2. Por fonte/fixtures públicas, determinar quais fatos originais do transporte Source TOC ainda faltam para explicar INSPECTION_INPUT_FAILED. Se necessário, desenhar diagnóstico nominal fechado do próprio primeiro erro: fase, callback original pendente/settled, erro stdin/callback em enum none/EPIPE/other, spawn/EOF/exit/close originais e contagens limitadas. Não copiar mensagens, paths, SQL, bytes do archive ou stderr. Nenhum getter/JSON externo pode preencher essa autoridade.
3. Exercitar os terminais em RAM, primeira recusa imutável e falhas tardias no cleanup; manter o prazo absoluto de 45s, a exceção TOC-only EPIPE atual e os gates de fonte autenticada antes de alvo. Não ampliar exceções do restore DATA.
4. Somente Root, depois de revisar/publicar o delta e definir novo preparo/QA/pins, poderá decidir se uma nova operação somente de leitura é necessária e autorizada. A operação já encerrada não é reutilizável.
5. A2 só pode ser interpretado quando os dois lados e as histórias forem adquiridos no mesmo processo/scope. Divergências de histórico, ACL, definição ou dependências continuam motivos fechados de recusa; não ignorar diferenças para obter um PASS. Mint/import/restore e os aceites posteriores continuam pendentes.

## Inventário de publicação

`docs/implementation/frente-c-restore-review-inventory-20261017.json` registra os paths físicos divergentes da união Git diff + untracked, com tamanho/hash de fontes públicas, e três paths work deste agente. Ausência no Review significa arquivo já existente na Main, não pedido de exclusão. Arquivos com mesmo SHA foram separados dos deltas reais; o JSON derivado não inclui a si próprio.

Quatro paths Drive no Review são cópias antigas frente à Main e devem preservar a versão Main: scripts/verification/drive-browser-local-ci.mjs, tests/e2e-auth-local/drive-browser-contract.d.mts, tests/e2e-auth-local/drive-browser-contract.mjs e tests/scripts/drive-browser-local-ci.test.mjs. Não reintroduzir Drive no MVP.

As versões Main dos documentos contrato-a2-inventario-restore, frente-b-retomada, frente-b-target-baseline e preparacao-novo-backup incluem atualizações de Root ausentes no Review. Não substituí-las integralmente. Os deltas Active Close pertencem ao agente CI; anexar a evidência dele na PR. Os dois documentos Auth somente Review são propostas históricas e precisam de classificação, sem promover seus resultados a aceite hospedado.
