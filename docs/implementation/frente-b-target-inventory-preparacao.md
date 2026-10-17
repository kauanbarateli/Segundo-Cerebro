# Preparo inerte da inspeção de inventário do alvo

Este recorte acrescenta somente `work/inspect-target-inventory-preparacao-20261016-v1.ps1` e sua QA pura. Foi derivado do preparo de baseline v3, que permanece preservado. Nenhum preparo anterior, captura encerrada, perfil ou archive foi aberto ou alterado durante a implementação.

O template mantém `GateExecute=false` e `ReviewedCommit=null`. A saída inerte ocorre antes de funções, validação de plataforma, seleção de executável, pins, Git ou acesso a arquivos privados. A revisão de código, a QA sintética ou o preenchimento de um SHA não constituem autorização automática para uma operação real. Root cria a cópia operativa somente depois da revisão e publicação do código exato; o implementador não executa gate verdadeiro.

## Operação fixa e limites

O launcher permanece PowerShell 7 → dispatcher → Node 24 e seleciona exclusivamente `restore-inspect-target-inventory`. A operação não aceita `Archive` nem solicita `encryptionSettings` ou chave de backup. O dispatcher conserva a materialização permitida do perfil DPAPI completo; esse contrato não atesta ausência de outros campos, inclusive de chave de backup, no perfil. Não foi aberto o perfil para conferir seu conteúdo. Os filhos PostgreSQL continuam recebendo somente o ambiente selecionado pelo adapter.

O launcher mantém o ambiente mínimo com `PATHEXT=.EXE`, os binários PostgreSQL já qualificados, o certificado e o perfil de alvo previamente autorizado. Os valores privados não são projetados na saída.

São conferidos os 17 arquivos públicos da união transitiva do inspector, além do próprio preparo, executáveis e metadados fixos do perfil/certificado. Os pins candidatos atualizam dispatcher, inspector, planner e B2; os demais caminhos permanecem na união porque ainda são imports transitivos, embora a operação de inventário não execute B3 ou A2. As leases mantêm compartilhamento somente de leitura, recusando escrita, troca e exclusão enquanto a execução está ativa. A seleção Git permanece escalar e exige o commit revisado e os arquivos rastreados sem alterações.

O wrapper mantém o limite externo de 60 segundos, stdout até 64 KiB em RAM, UTF-8 estrito e ambos os EOFs e término original do processo antes de aceitar a saída. O inspector mantém seu prazo absoluto interno de até 45 segundos. Cancelamento, kill ou ACK não substituem EOF ou sucesso original. Erros do provedor, stderr, paths, stack e payload não são impressos.

## Projeção fechada

O sucesso exige a operação exata, modo nativo, formato custom/gzip fixado, snapshot somente leitura permitido e `customToc` contendo somente `entries`, `encoding` e `tocBytes`. `preservedEntries`, conjuntos privados e `migrationHistory` são recusados. As contagens de linhas do snapshot não provam o conteúdo dos históricos.

`inventory` é validado integralmente, sem filtrar classes. A validação exige headers válidos, totais iguais ao número de entradas do B2, contagem desconhecida e malformada zero, e o conjunto literal de 24 classes suportadas pelo planner/B2 desta inspeção. Classes e escopos precisam ser únicos e na ordem canônica. Contagens são inteiras positivas limitadas; as somas das classes correspondem ao total, e as somas dos escopos e da cauda correspondem a cada classe. Escopos são apenas `app`, `managed`, `global` ou `other`; a única cauda válida é `valid`. Nenhum token de entrada vira enum.

Todos os objetos têm schema exato, e chaves JSON duplicadas são recusadas antes da projeção. Campos de nome, owner, OID, DDL ou texto privado são recusados mesmo em objetos aninhados. Flags fixas: `inspectionOnly=true`, `baselineQualified=false`, `baselineCompared=false`, `restoreAccepted=false`, `remoteMutation=false`. O envelope de falha da inspeção exige as mesmas flags e `nativeHistoryDiagnostic=null`; estágio ou código B3 não é aceito. Diagnósticos de snapshot/TOC conservam os schemas públicos fechados anteriores. Uma falha do dispatcher só admite seu envelope mínimo fixo.

## QA e próxima etapa

A QA seleciona exclusivamente uma lista nominal de funções puras por AST, vinculada ao hash/bytes do novo preparo. Ela não executa o corpo operativo, não carrega perfil, não abre archive, não inicia processo PostgreSQL e não conecta a nenhum serviço. Os vetores preparados incluem todas as 24 classes, distribuição completa de escopos, enums desconhecidos, campos extras, duplicatas, ordem, somas incoerentes, limites, flags, presença indevida de B3 e diagnósticos fechados do snapshot.

QA própria pura em PowerShell 7, executada serialmente após liberação do semáforo: **140 PASS**, `nativeExecuted=false` e `privateOpened=false`; processo encerrado com código zero em `2,9348 s`. O template permaneceu com `GateExecute=false` e `ReviewedCommit=null`; seu corpo operativo não foi executado.

A primeira rodada foi interrompida após um aviso de profundidade de serialização: o nome da variável de um vetor coincidia com o parâmetro `$Operation` do helper de teste, fazendo o próprio scriptblock público entrar no JSON artificial. A rodada seguinte recusou no controle 39 por colisão equivalente com `$Name`. O helper passou a usar nomes específicos de QA, e a rodada final passou nos 140 controles. Foram correções exclusivas da QA; o template e seus pins não mudaram nessas rodadas. Nenhum conteúdo privado foi aberto ou impresso.

A próxima etapa é revisão e conferência próprias de Root, seguida de publicação e nova decisão operacional. Nenhum PASS de testes em RAM será tratado como aceite nativo ou autorização de restore.
