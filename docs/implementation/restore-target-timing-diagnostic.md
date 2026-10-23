# Diagnóstico público do transporte do snapshot de destino

Proposta para revisão, derivada de `7002bf2d47931bbec8b9be8a4051b802969840e1`.
Não autoriza uma inspeção operacional, restore, comparação, mint ou mutação.

## Problema observado

A inspeção de 23/10 recusou `RESTORE_TARGET_SNAPSHOT_NATIVE_TIMEOUT` na fase
`dump`. Havia bytes originais de psql e pg_dump, mas faltavam EOFs e terminais
completos no instante capturado. Isso não identifica sozinho a causa do atraso.
O prazo absoluto do inspector começa antes da aquisição da origem: o destino
recebe o restante, não um novo prazo de 45 segundos.

## Delta fechado

Somente a saída de **falha** de `nativeTargetSnapshotDiagnostic` passa à versão 2.
Os fatos positivos de `nativeTargetSnapshotFacts` continuam na versão 1 e com
as mesmas chaves. Códigos, callbacks, frames, EOF, exit, close, ACK, limites,
permissões, descarte e critérios de qualificação permanecem os existentes.

O diagnóstico acrescenta:

- `scopeRefusal`: `null`, `deadline_code`, `other` ou `invalid_remaining`.
  `deadline_code` exige erro nominal `BackupError` com o código fechado
  `INSPECTION_TIMEOUT`. Isso observa a causa exposta pelo scope; não constitui
  prova independente do relógio. Causas desconhecidas continuam desconhecidas;
  não são convertidas em erro de protocolo nem expostas como texto.
- `timing.remainingAtEntryMs`: valor da chamada `remaining()` que já existia,
  aceito somente entre 1 e 45000. Não se faz outra chamada para diagnóstico.
- `timing.targetElapsedMs`, `phaseElapsedMs` e `lastDumpChunkAgeMs`: intervalos
  monotônicos até a primeira recusa. São inteiros limitados a 45001; o teto
  significa saturação. Ficam `null` sem amostras válidas. A fase tem a semântica
  original; a última amostra de chunk só muda após aceitar uma cópia limitada.
- `timing.remainingEstimateMs`: estimativa local, entre zero e o restante de
  entrada, obtida por subtração desses relógios. O arredondamento pode deixá-la
  até um milissegundo acima do restante real. **Não é uma consulta atual ao
  scope, nem uma autoridade para esperar, continuar, renovar ou qualificar.**
- Em cada produtor existente, os booleanos `exitObserved`, `closeObserved`,
  `stdoutCloseObserved`, `stderrCloseObserved` e `stdinCloseObserved`, separados
  dos fatos existentes `producerExitZero`/`producerCloseZero`. Ausência e
  terminais malsucedidos deixam de ser confundidos apenas por um `false`.

Todas as amostras são observacionais e permanecem congeladas antes do `finally`.
Eventos posteriores não reescrevem o resultado. Nenhum PID, erro nativo, stack,
SQL, URL, snapshot ID, conteúdo, caminho ou credencial entra nesse envelope.
O relógio não participa das decisões e não há novo timer ou espera.

## Como interpretar

`phase: dump` implica que o frame inicial já foi validado. Nesse ponto o psql
deve permanecer aberto; um callback e ausência de finish não são, por si só,
falha. O pg_dump só termina quando todos os fatos originais exigidos chegam.
Bytes, tempo desde o último chunk e exit isolado nunca substituem essa prova.

Um restante pequeno na entrada evidencia orçamento herdado pequeno. Um
`deadline_code` evidencia a causa nominal retornada pelo scope. Nenhum deles
autoriza atribuir a causa a rede, Windows, PostgreSQL ou travamento. O resultado
continua recusado, e a limpeza pedida no `finally` continua sem certificado de
terminação. Não há `cleanupCompleted` nem reaproveitamento de dump parcial.

## Cinco controles sintéticos novos

1. Dump parcial com budget de entrada de 321 ms: recusa, uma única leitura do
   restante, nenhum COMMIT, nenhum receipt e buffers recebidos zerados.
2. Matriz de EOFs ausentes/parciais, exit isolado e close sem EOF: os fatos
   observados são distintos, mas nenhum conjunto incompleto concede sucesso.
3. EOF/exit/close tardios e erro posterior: primeira recusa congelada, nenhum
   resgate tardio, cópias tardias recebidas zeradas e nenhum handle emitido.
4. Causas nominais, erros arbitrários, Proxy/getter/protótipo hostil e restante
   inválido: envelope fechado, sem execução de getters e sem mudar os códigos
   de recusa existentes. Protocolo inválido continua sendo protocolo inválido.
5. Scope já expirado: zero spawn e zero renovação. Sucesso sintético continua
   expondo exatamente as chaves públicas da versão 1.

Os doze testes nativos anteriores e os 23 testes do protocolo são preservados.
Esses controles usam somente RAM e portas de processos artificiais; não abrem
banco, perfis, arquivos privados, executáveis ou rede. PASS sintético não é
aceite operacional, concorrência nativa nem validação de um backup real.

## Próxima ação permitida após revisão

Publicar e validar o novo SHA em CI, revisar a composição e todos os pins das
fontes alcançáveis. Um eventual preparador operacional precisará de **nova
versão** para aceitar somente o envelope v2 e o novo binding de código. Os
preparadores V1–V4, marcadores `started`, recibos, backups e perfis antigos
permanecem intactos; o leitor antigo deve recusar esse envelope novo.

Nenhuma execução operacional está incluída. Não há mudança dos prazos de
45/90 segundos, nem teste target-only autorizado por este documento. As
diferenças de Storage/TOC/baseline ainda dependem de comparação integral
concluída; produzir backup novo não prova que todas foram resolvidas.
