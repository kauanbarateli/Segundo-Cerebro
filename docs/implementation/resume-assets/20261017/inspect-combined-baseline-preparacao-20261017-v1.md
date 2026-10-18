# Preparo v1 — observação combinada autenticada de baseline

Este pacote prepara **uma nova inspeção somente de leitura**, no mesmo processo, da fonte autenticada e do alvo de ensaio. Não executa restore, import, migrations, alterações no alvo ou emissão da capacidade A1. Uma comparação concluída com divergências é um resultado de inspeção válido e conserva os motivos; não constitui aceite de restore.

Arquivos novos, separados de todos os preparos e operativos encerrados:

- `work/inspect-combined-baseline-preparacao-20261017-v1.ps1`: template inerte.
- `work/test-inspect-combined-baseline-preparacao-20261017-v1.ps1`: QA puro por seleção AST.
- Este documento: contrato e limites do preparo.

## Estado entregue e separação de responsabilidades

**Atualização de encerramento: CLOSED.** Root executou uma única operação real em Main `61d03c768071e6618136e648fc71c552e3db2043`. Ela terminou exit1: wrapper COMBINED_PREP_NATIVE_REFUSED, CLI INSPECTION_INPUT_FAILED, stage source e os três diagnósticos null; comparação não concluída, sem import. Não repetir esse preparo nem o operativo encerrado. As instruções de revisão abaixo documentam o contrato histórico da v1; não autorizam nova execução, cópia v2 ou reaproveitamento de capturas. O ajuste posterior para preservar o envelope nominal está documentado em `docs/implementation/frente-b-combined-first-refusal-context.md` e permanece candidato local para PR Draft.

O template contém os três gates iniciais `GateExecute=$false`, `ReviewedCommit=$null` e `ArchiveBinding=$null`. O ramo padrão termina antes de qualquer acesso a Git, executável, perfil, certificado, archive, processo ou serviço. Nenhum deles foi habilitado no arquivo entregue.

Root publicou a união de runtimes em `61d03c768071e6618136e648fc71c552e3db2043`. Os 19 pins do template correspondem às fontes públicas dessa entrega, incluindo inspector `D3A4E1F9…`, dispatcher `C87851A3…` e builder `5AD64F4B…`. O valor padrão de ReviewedCommit permanece nulo. Root deve revisar esse preparo, conferir o commit efetivo e produzir uma cópia operativa nova, com pins e metadados exatos; o próprio agente deste pacote não executou o corpo operativo nem produziu essa cópia.

Não reabrir capturas anteriores, não reaproveitar operativos já encerrados e não executar novamente uma inspeção passada para preencher uma evidência nova. Preparos History v1–v4 e Target Inventory v1 continuam preservados.

## Arquivo autorizado e vínculo

Metadados fornecidos por Root após criar e verificar o novo backup, sem leitura do arquivo por este pacote:

| Campo | Valor fixo |
| --- | --- |
| path | `C:\Users\Kauan Sousa Barateli\SegundoCerebro-Operations\archives\second-brain-2026-10-17T01-27-25-163Z-6b65e5f5.scbackup` |
| sha256 | `21c0e0eb0b60a123854ec4d10d2bdbf69e1cb922bc2ed2591c89ec422262088a` |
| cipherBytes | `951230` |
| plainBytes | `950017` |

ArchiveBinding aceita somente Hashtable ou OrderedDictionary builtin com exatamente esses quatro campos, tipos e valores. Recusa objeto de provedor, campo extra, ausência, null, hash/caminho trocado, tamanho diferente e conversões de string ou float para número. O template permanece com binding nulo. O pin de ciphertext por SHA/tamanho será conferido sob lease de leitura; plainBytes é metadado fixo de revisão, enquanto autenticação, integridade, manifesto e EOF permanecem responsabilidades do inspector.

## Perfil, chave e processos

Usa-se o perfil Target já preparado `profiles\restore-target-pg18-20261012-v2.xml`, com 3901 bytes e SHA-256 `E2CD837487821DD266D5F87223B5D65C56DD4CE0029CC52FE1DD71644EED740B`. Não há novo merge, nova chave ou leitura do perfil por este pacote. Root confirmou que o backup novo reutiliza a chave independente autorizada `SC-20261012-001`, já transferida ao perfil Target no procedimento anterior.

A operação conserva a materialização permitida do perfil completo pelo dispatcher. Não atesta ausência de outros campos nesse perfil. O template não executa Import-Clixml, Export-Clixml, substituição do perfil ou alteração de senha/chave. Os filhos PostgreSQL mantêm o ambiente selecionado pelos adapters pinados; os segredos não entram em argv ou saída.

Antes de abrir qualquer arquivo privado, o corpo operativo exige Windows/PS7, commit e self-hash válidos, caminho exato da cópia Main, seleção Git escalar do executável, HEAD exato, fontes rastreadas e limpas e todos os pins públicos. Abre leases `FileShare.Read`, que recusam escrita, substituição e exclusão durante a operação; rejeita caminho remoto/reparse e reconfere Git antes e depois do processo original.

Executáveis preservados: Node 24, PowerShell 7, pg_restore/pg_dump 18 e psql 17. O helper PowerShell 5 deriva exatamente de `C:\WINDOWS\System32\WindowsPowerShell\v1.0\powershell.exe`; SystemRoot também é vinculado e o executável é pinado. O certificado `certificates\prod-ca-2021.crt` conserva o pin anterior. Nenhum desses binários foi executado pelo QA deste pacote, exceto o host PS7 do próprio QA puro.

O launcher PS7 é sem shell, invisível, ArgumentList fixo, `-NoProfile` e `-NonInteractive`. Limpa o ambiente, conserva apenas a allowlist de diretórios do sistema/usuário/sincronização, fixa PATH no System32 e PATHEXT em `.EXE`. Não herda NODE_OPTIONS, NODE_PATH, credenciais PG ou tokens MCP. A única operação é `restore-inspect-baseline`, com ProfilePath, NodePath e Archive vinculados. Não oferece operação dinâmica, import, backup, restore ou SQL arbitrário.

## Ordem e prazos

O inspector combinado mantém **um único scope interno absoluto de 45 segundos** para a aquisição da fonte, do alvo e as duas extrações de histórias. A sequência é:

1. Fonte: cópia privada do ciphertext, autenticação AEAD completa, manifesto/footer/EOF, reconferência do ciphertext, TOC original, B2 e B3 nominais.
2. Alvo: snapshot RR somente de leitura, ator/RLS/catálogo/vazio qualificados pelo protocolo, dump nativo original, TOC e B2 inspection-only.
3. Duas histórias do alvo: transporte/EOF/parser B3 nativos e reconferência das contagens contra o snapshot original.
4. A2: builder puro observa todos os handles vivos e retorna os recortes managed e existingApp, com cobertura agregada. Não converte handle inspection-only em baseline qualificado.
5. Cleanup único: guards originais permanecem ativos durante limpeza; recheck antes de zeragem/descarte. Uma primeira falha tardia impede devolver comparação parcial.

O wrapper impõe 90 segundos externos desde seu início, incluindo validações, launcher e coleta. Esse limite só cancela a execução externa e **não amplia nem renova** o prazo interno de 45 segundos. Timeout/kill/ACK não são evidência de EOF, cleanup ou restore.

## Saída estrita

O wrapper acumula no máximo 64 KiB de stdout em RAM, decodifica UTF-8 estrito e requer ambos os EOF originais e saída do processo original. Stderr é drenado e zerado, sem repasse de texto. Uma interrupção, excesso, callback incompleto ou processo vivo não é promovido a sucesso.

Em sucesso, aceita somente a operação `managed_restore_combined_baseline_inspect`, modo `native`, flags de fonte autenticada/comparação concluída/alvo consultado e os objetos exatos source, target e comparison. Preserva:

- Formato CUSTOM 1.16-0/GZIP/4/8; TOCs somente em UTF8 e contagens/tamanhos limitados. Só o TOC source possui preservedEntries.
- Histórias: apenas authRows, storageRows, stdoutBytes, inputTerminal original e modo native. As histórias do alvo precisam coincidir com as contagens do snapshot; não se exige igualdade entre source e target para esconder divergências.
- Snapshot: flags de protocolo/RR/ator/RLS/ausência de demais dados, contagens limitadas e exatamente duas exceções de tabelas de história. nativeOrigin e restoreAccepted continuam false no DTO de protocolo.
- A2 managed e existingApp: versão, matches e até 15 motivos fechados em ordem canônica, sem duplicatas. matches é true somente com lista vazia. Qualquer motivo legítimo continua visível, inclusive diferenças de definição, owner, ACL por definição, dependências e histórias.
- Cobertura: totais source/target correlacionados aos TOCs, soma das partições target completa, limite dos counterparts e flag coverageComplete. Cobertura não substitui igualdade de A2.

Todos os recortes mantêm inspectionOnly=true, baselineQualified=false e restoreAccepted=false. O resultado superior mantém remoteMutation=false. baselineCompared=true significa apenas comparação concluída; não autoriza replay ou mint. Um matches=false continua resultado de inspeção bem formado, com os motivos preservados.

Em recusa, exige exit1, esquema fechado de contexto source/target/native e 94 códigos originais fixos. Não aceita prefixos de códigos, mensagens de provedor, cause, SQL, nomes, records, OIDs, owners, caminhos recebidos ou payloads. Diagnóstico B3 conserva somente nove códigos, versão e os 52 pares literais phase/rule já aprovados; parserError e parserDiagnostic precisam existir juntos ou ambos ser null. JSON com propriedades extras ou duplicadas, mesmo aninhadas, é recusado.

O inventário agregado original do diagnóstico source é intencionalmente omitido, conforme o preparo History v4: retorna apenas inventoryIncluded=false. Esse campo não é decodificado nem reenviado e não constitui inventário qualificado. Todo o restante do contexto exige schema fechado. Em erro, comparisonCompleted e baselineCompared são false; comparação parcial não é emitida.

## QA executado

Primeira execução, sem falhas: **310/310 PASS**, PS7, exit0, 3,14 segundos. A saída foi `nativeExecuted=false` e `privateOpened=false`. O teste leu somente os bytes do novo template público, conferiu hash/tamanho, selecionou 22 funções puras por AST e avaliou fixtures JSON/dicionários em RAM. Não executou o corpo operativo, nem Git, dispatcher, helper, PG, perfil, archive ou serviço.

Cobertura: gates antes de I/O; união de 19 fontes e pins de launcher/leases; binding exato e adversariais de tipo/tamanho; sucesso native e inputTerminal; ambos recortes A2 e 15 motivos individuais/canônicos; falses de autoridade; contagens/correlações de snapshot, histórias e cobertura; JSON extra/duplicado/ausente; 94 códigos originais; todos os 52 pares B3; contexto de primeira recusa; omissão do inventário source e canários privados recusados. Fixtures com contagens semelhantes ao inventário conhecido continuam sintéticas e não provam uma execução conectada.

Pin do template testado: 48798 bytes, SHA-256 `64E7B9E3FA2BBF684E28B9251CE1D6C951057980CC9B10E0B786FBD5AD1ED357`.

Não foram realizados Node, browser, SQL, native, conexão, captura ou leitura de arquivos privados neste pacote. O aceite real continua exclusivo da futura execução única por Root, após revisão própria, pins, gates e coleta dos originais.
