# Preparação do leitor Active Close 8084

Três arquivos novos no Review/work: módulo, QA em RAM e este documento. `PREPARED_BINDING=null` e `EXECUTE_READY=false`; a primeira operação de captura valida esses literais antes de tocar em argumentos, ports, arquivos privados ou rede. Não foi criado operativo, não houve leitura de logs/capturas anteriores e nenhuma captura ou workflow foi executado pelo implementador.

## Fonte e metadados

Fonte fixa: `8084c3988b34f8973c72178aab446bdaecffa014`, repositório `kauanbarateli/Segundo-Cerebro`, evento `workflow_dispatch`, tentativa `1`, workflow `387273502`, path `.github/workflows/browser-active-close-probe.yml`. Job `browser-active-close-probe`; step `Close ativo e drain em fixture publica`.

A consulta própria inicial do run `38990606937` e da tentativa confirmou job `117271957935`, em andamento no step 6 de instalação do Chromium; etapas 1–5 passaram, step 7 ainda pendente. Run/tentativa tinham `created_at=2026-10-17T01:22:54Z`, `updated_at=2026-10-17T01:22:59Z`; job iniciou `01:22:58Z`. Isso ainda não é binding terminal nem fornece qualquer causa de falha ou aceite. Os 24 campos originais devem ser reconferidos após encerrar. O índice de step é preservado da lista original, inclusive quando há lacunas entre os números; datas de run e attempt continuam independentes.

A segunda consulta própria, já terminal, confirmou run, tentativa, job e step selecionado em `completed/failure`. Run e tentativa, obtidos separadamente, têm `created_at=2026-10-17T01:22:54Z` e `updated_at=2026-10-17T01:24:01Z`; job `117271957935` ocorreu de `01:22:58Z` a `01:24:00Z`. O step original número `7`, índice `6` na lista de dez steps, ocorreu de `01:23:52Z` a `01:23:58Z`, com janela interior `[2026-10-17T01:23:53Z, 2026-10-17T01:23:58Z)`. Steps 1–6 passaram. São somente metadados: não permitem atribuir causa nem antecipar o conteúdo do relatório. Nenhum log, raw ou report foi aberto; a consulta terminal não deve ser repetida por este implementador.

Sete pins críticos conferidos diretamente no Main 8084; a captura futura exigirá bytes/hash iguais nas fontes Git e local:

| Path | Bytes | SHA-256 |
| --- | ---: | --- |
| `.github/workflows/browser-active-close-probe.yml` | 1440 | `62680fd584a939b4451b3b8641fea65fdea6c79ad68c5cbc635cc4269dd602dc` |
| `scripts/verification/browser-active-close-probe.mjs` | 31380 | `f573f1fb4efbcdbce75361c5adebf818a28e463bf32c08c532b65cae86e4fc6f` |
| `scripts/verification/browser-quiescence-fence-probe.mjs` | 36475 | `580720c195ae79e09ec2ee39f19990d82998d48889ee15ed54464d69713130da` |
| `scripts/verification/browser-redirect-drain-probe.mjs` | 30674 | `925cea876490f0977c91a85e8dca01042a100ec662b72c3684b8618e5529d5b7` |
| `tests/e2e-auth-local/admin-browser-support.mjs` | 68394 | `794d5c5fe5e16e431a3506b36c0893cad82dd8bf0f03d5876da0a9947884e436` |
| `tests/e2e-auth-local/admin-browser-contract.mjs` | 16995 | `adfa26f4e214187abde22b615caf44a0d925c411a7bbc83109e4421b5a9f2841` |
| `package-lock.json` | 325125 | `f35dd10194b2b7c3ead7f79b811638f9f36b4c92ea4ce041c4b0e8e94468c38a` |

São fontes públicas; não há inventário de banco, profile, archive ou dados pessoais. Os dois helpers originais de REST/DACL permanecem inalterados e byte exatos, com os mesmos pins do template anterior. Nenhum helper privado foi reaberto. O produtor conserva seus próprios sete pins de runtime/módulos e seus qualificadores exatos; o leitor não os relaxa.

## Casca de captura preservada

Reutiliza a casca Redirect revisada, sem mudar transportes ou DACL: REST do job original, leitura máxima 4 MiB/45 s, cinco paths novos e exclusivos, `wx`/0600, parent privado e exclusões de fonte/OneDrive/system root. Prefixo novo: `sc-browser-active-close-probe-<sha7>-<run>-a1-20261017-`. Não usa `gh run view`, cache, artifacts, reconstrução de linhas ou fallback.

Antes da primeira claim, os sete pins precisam coincidir em Git e local e duas consultas originais de run/attempt/jobs precisam coincidir com os 24 campos revisados, terminais completed. Após uma única leitura do job REST e preservação do raw, uma terceira consulta original deve permanecer igual antes de escrever report/summary. Mudança/rerun veta a projeção, mantém claim/raw já criados e não autoriza repetir download. O buffer raw é zerado no finally.

Seleciona exatamente um JSON canônico de `browser-active-close-probe` na janela `[startedAt+1000 ms, completedAt)`. Timestamp original de REST, UTF-8 válido, sem NUL/labels sintetizados, frame até 16 KiB. O raw é preservado como veio; não se deduplicam frames nem se inserem campos.

## Contrato específico de Active Close

O módulo importa `validateActiveCloseReport` do produtor no Main. Full report precisa dos oito campos superiores originais, `mode=native`, SHA 8084 e dois casos na ordem control/direct-active-close. Os snapshots antes/final, estado requests/events/promise do close, actionsPending, zeros distintos, timings e cleanup são validados pelo contrato fechado atual. Nenhuma ausência de terminal é convertida em terminal ou zero.

Também admite a recusa curta literal de cinco campos do main: schemaVersion/scenario/code/diagnosticOnly/applicationAccepted, com enum fechado, diagnosticOnly verdadeiro e applicationAccepted falso. Ela só pode corresponder a step failure. Texto de fornecedor, ajuda NO_SERVICE_STARTED, outcome de sucesso ou campos extras não são recusas válidas.

A regra de conclusão coincide com o exit do main: exige controlQualified e ambos os outcomes em CONTROL_PASSED/DRAINED. Cada cleanup exige os **oito** campos: server/context/browser/session em absent/close_observed e socketsClosed/startupSettled/**actionsSettled**/handlersSettled verdadeiros. Um campo não confirmado produz failure; campo ausente/inválido é recusado pelo validador.

INCONCLUSIVE, REFUSED e NOT_RUN sempre correspondem a failure diagnóstico. PENDING não é outcome aceito nesse esquema. Um timeout antecipado aos 14.999 ms continua inconclusivo mesmo com contadores aparentemente completos. Close/evento/promise sem terminais público/CDP originais, terminais que antecedem o fator ou terminais vindos só de cleanup não são reinterpretados como sucesso. O reader não estabelece causalidade nem revê decisões do produtor.

Summary/report mantêm diagnosticOnly=true, applicationAccepted=false; summary mantém automaticIssueAcceptance=false. Nenhuma projeção aceita Auth, encerra issue, cria autoridade de cleanup, autoriza restore ou comprova origem autenticada de backup.

## QA e próxima operação

QA própria executada após a liberação do semáforo de Root: **28/28 testes em RAM passaram**, zero skips/falhas, duração `169.5792 ms`, em Node `24.19.0`; ESLint dos dois `.mjs`, com `--no-ignore --max-warnings=0`, passou. Não houve delta de runtime ou testes após a revisão estática independente de Probe. Os testes usam metadados e bytes públicos sintéticos, ports em RAM e writes em arrays; não criam pasta privada, processo nativo ou conexão. JSONs com mode native servem somente para testar a validação da projeção e nunca constituem execução nativa/capacidade.

Após QA própria, Root fará revisão e QA independente. Somente Root poderá preparar outro arquivo operativo com binding terminal e gate true, conferir a reversão byte exata ao template e efetuar a captura única. Este implementador encerra na preparação inerte: não cria operativo, não executa captura e não reabre outputs antigos. A execução pública já despachada não deve ser repetida.
