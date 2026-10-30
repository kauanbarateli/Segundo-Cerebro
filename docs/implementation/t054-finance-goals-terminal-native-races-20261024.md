# M2-N — gate nativo descartável

Estado: código candidato completo para revisão, sem execução de Node, testes, compilador, PostgreSQL, container, conexão ou workflow nesta autoria. Não há aceite nativo, promoção, flag habilitada ou instalação hospedada. Fonte inicial `01ae6a7c62b8d2dbe9e295b7702d329f64ec5313` e os nove WIPs M2-B foram preservados por hashes. Os pacotes das fases 1 V1 e V2 permanecem imutáveis.

## Fase 1 entregue para revisão

- Contrato fechado de doze confrontos: create/contribute/release × commit-first/settle-first/executor-antigo/dois-settles. Relatório não transforma dados sintéticos em prova de origem; o futuro runner deverá fornecer instância/graph/barreiras/material verdadeiros.
- Tickets SQL nominais, vinculados a namespace/SHA/system_identifier. A cópia pública de um ticket não autoriza SQL. Os RPCs são enum fixo; valores são dados JSON codificados, sem SQL de URL/env/usuário.
- Sessão `psql` persistente com stdin próprio, uma ação por vez, nonce/seq/frame/bytes limitados, correlação de role/RPC/PIDs, deadline e aborto. Uma linha intermediária não prova encerramento. O terminal requer stdout/stderr EOF, exit/close originais e confirmação de grupo. SQL23505 exato é diagnóstico de recusa, nunca recibo nem prova de ausência de backend. Ausência e material permanecem dever do observador nativo.
- Extração mecânica dos cinco módulos de fontes/compilação sem imports WASM. Os wrappers anteriores reexportam a API e conservam os corpos dos construtores. Pins históricos permanecem, inclusive M1 `d1bcb221…`; o ajuste de quatro parênteses/pin `7fb8c48…` é delta Root separado a reconciliar na união.
- Entry de teste Node contendo Core, Store/Gateway e captura nominal originais, SDK oficial e Sources puros. Não contém construtor PGlite nem consumidor HTTP/UI.
- Controles escritos para diagnóstico de falha, sessões sintéticas, fechamento de tickets e compatibilidade da extração. Nenhum foi executado pelo autor.

Revisão estática independente da fase 1 encontrou três bloqueadores no V1, preservado: coerção de primitivas falsas em SQL/nonce; terminais contraditórios/duplicados e admissão depois de um terminal físico; erro após COMMIT/ROLLBACK antes do ACK interpretado como recusa conhecida. O V2 exige strings primitivas, conserva os primeiros terminais com contadores e recusa sticky, cerca ações novas desde qualquer terminal físico e classifica controle sem ACK após escrita como WRITE_OUTCOME_UNCERTAIN. A recusa de um RPC ainda exige estado/causa exatos e oracle nativo; SQL23514 genérico jamais satisfaz a prova do fence. Novos controles foram escritos, sem execução. O consumidor deverá conferir o snapshot terminal e a metadata atual imediatamente antes de aceitar quiescência; nenhum DTO de terminal é recibo de domínio.

## Composição escrita após o peer da fase 1

O runner dedicado, o caso dos doze confrontos, a derivação AST e a barreira de módulos de Rolldown, os templates finitos de bootstrap/fixture/material/ausência e o workflow foram escritos no mesmo pacote. Não há placeholder que finja resultado. O workflow só deve ser publicado por Root depois do peer do pacote completo; ele executa um job Ubuntu isolado real, sem skip permissivo ou reaproveitamento de aceite anterior.

Os Sources resolvem o checkout por `../../` a partir de `tests/helpers`. O bundle fica no mesmo nível em `tests/e2e-auth-local`, em arquivo exclusivo privado, com cwd/realpath e hash antes/depois; Data URL e diretório de outra profundidade não são usados pelo N. O máximo declarado de módulos do entry é fechado, com SDK oficial e módulos críticos obrigatórios. O inventário de fontes de apoio é derivado por AST e conferido com blobs Git; inclui os wrappers históricos apenas como evidência lida. Eles não entram no bundle nativo. Dois loaders dinâmicos têm expressões exatas declaradas: o loader Admin histórico, que não é chamado, e a URL exclusiva do bundle N. Nenhum import dinâmico fica no bundle resultante. O conjunto efetivamente observado de módulos e as contagens só existirão depois da execução; não se alega grafo qualificado agora.

O runner reutiliza as primitivas de lifecycle públicas de Auth e nunca chama seu runner ou Chromium. CLI 2.120.0, cliente/backend PostgreSQL 17, Auth real local, env mínimo e cadeia 001–026 são conferidos. Catálogo canônico exige exatamente 1720 verificações/zero desvios antes dos companions. Budget → B2 → Goals → M1 usam os compiladores originais; o gate aditivo posterior confere OID preservado, cópia histórica, RLS/grants/wrappers/triggers e fontes relevantes, sem fingir que o catálogo canônico não mudou. O workflow tem 35 minutos; o orçamento do runner reserva margem antes de iniciar cada caso. Os limites de 15 s por ação, 120 s por sessão e 5 s de barreira não foram aumentados.

A ordenação depende de PIDs distintos, conjunto de bloqueadores exatamente igual ao winner e advisory ExclusiveLock correspondente; nenhum sleep decide a ordem. O watchdog da barreira recusa observação tardia. O corpo antigo com CAS stale não prova o receipt guard: o caso OLD_EXECUTOR obtém snapshot pós-fence na transação winner, captura batch válido por Core/Store e exige 23505/NAMESPACE_CLOSED na cópia histórica da outra conexão, com rollback/material integral. O seam de planejamento devolve stale para capturar o argumento de commit e não declara escrita aplicada; o resultado só vem do RPC real/decoder/oracle.

O material inclui linhas completas ordenadas de ambos os Usuários, payloads, IDs, created_at, eventos, recibos, disposições, contas, ledger, revisões e rate-limits. Linhas não alteradas devem permanecer idênticas; a nova linha/evento deve corresponder ao batch. Os totais são recalculados da base inteira sintética, com BigInt, e confrontados com os agregados atuais. O delta de revisão é derivado dos gatilhos conferidos, sem assumir incremento de um para toda escrita. O replay/status deve preservar o material inteiro e o mesmo resultado/disposição. Nenhum dado financeiro/Auth bruto entra no relatório público.

Dois Usuários sintéticos e três sessões são criados/verificados pelo SDK oficial local; getUser e my_access_state antecedem a conferência de auth.sessions na fixture nativa. JWT decodificado é somente pista. O transporte de setup/cleanup tem URL/método/corpo/headers fechados, EOF e deadline, com pending/unknown registrados antes da primeira operação. Não há usuário remoto, seed histórico ou credencial pessoal.

Depois dos confrontos, os três processos de operação encerram com terminais originais e ausência dos grupos. O control permanece ocioso somente para a verificação de zero outros backends, revogação/remoção SDK dos atores e ausência integral das linhas; depois também encerra. Uma consulta independente confirma zero backends do namespace. Cleanup lógico não ocorre depois de uma escrita incerta. A stack própria só pode ser destruída após quiescência física, sem promover o resultado incerto; stop --no-backup, inventário de container/volume/network e remoção exata do temp/bundle exigem confirmações positivas. Kill ou simples Exists false não certificam ausência. Se há trabalho pendente, o relatório não certifica nenhum cleanup global parcial.

## Validado e pendente

Validado nesta autoria: somente inspeção textual e os checks Git documentados no freeze. Os 26 controles puros históricos, mais três controles acrescentados na retomada V2, e os doze confrontos estão escritos, não executados. Não houve lint/AST Node, compilação, SQL, container, Auth ou dispatch. A peer favorável da fase 1 V2 não é aprovação automática do runner novo.

Antes da execução Root deve compor sobre os Sources revisados atuais: a extração histórica conserva d1b; o fix M1 7fb e o ajuste de um LF no Source Budget pertencem a deltas Root já separados. Não repinar pela observação do banco. Faltam peer do pacote completo, lint/checagens, derivação runtime real, originais próprios no GitHub e confirmação dos doze confrontos/cleanup. Native em CI não aceita browser, imagem, banco hospedado, restore ou produção; skip não é PASS.

## Retomada V2 — dois bloqueios estáticos corrigidos

OBSERVADO: `.nvmrc` seleciona o major `24` (blob Git da fonte70c `a45fd52cc5891570d6299fab38643103c3955474`); não é uma versão completa. A comparação direta com `process.versions.node` foi substituída por uma validação pura: a seleção deve ser a string `24` após trim e o runtime deve ser uma string integral estável `24.x.y`, sem prerelease, build metadata, zeros à esquerda ou coerção. Nenhum arquivo de configuração, pin ou versão de ferramenta foi alterado.

DECIDIDO pela Root: o contrato do relatório sobe de1 para2 e acrescenta somente `nodeVersion:string|null`. O runner grava a versão real integral somente depois dessa validação; uma recusa anterior conserva null. O validador fechado exige a versão integral para fontes conhecidas, casos executados e PASS. O relatório V1 e seus controles anteriores ficam preservados no freeze V1; aceitar um DTO sintético válido não prova observação de um runtime ou processo real.

A lista fechada do bundle acrescenta exatamente `src/lib/finance-goals-terminal-contract.ts`, requerido pelo canonical atual. As dependências de valor desse módulo puro já estavam presentes. Nenhum canonical antigo foi copiado. A guarda pura compartilhada pelo plugin e pelos controles recusa módulo desconhecido, import dinâmico, HTTP, browser, journal, runtime de servidor e construtor WASM; o plugin continua exigindo realpath e hash dos bytes capturados do grafo original. Passar a guarda pura não substitui essas provas.

Foram escritos três controles novos: seleção Node versus runtime completo, invariantes V2/ausência ou adulteração da evidência Node e fechamento do grafo (incluindo presença única do novo contrato e preservação das verificações de origem/hash). Permanecem os negativos anteriores, os12 confrontos, OLD_EXECUTOR forte, EOFs, catálogo1720, limites, Auth e limpeza. Nenhum caso, sessão, template SQL, workflow, SDK, Source ou pin foi alterado por esta V2.

Estado: V2 preparada e congelada para revisão, sem execução de Node, lint, testes, bundle, SQL, rede ou serviço pelo autor. A Root precisa compor os11 arquivos sobre os Sources7fb/EOF atuais e executar os checks/originais próprios do novo SHA. Não habilita destino hospedado, migration, rollout ou produção.

## Diagnóstico público fechado da primeira execução

OBSERVADO no original da PR de7f14507353d211737b0ee22395673fb4968df785: run40059892697/job120770914424/attempt1 aprovou29/29 controles puros e recusou o gate com PROCESS_REFUSED na fase sources, Node24.21.0. Fonte/árvore ainda nulas, zero fontes e serverVersion nulo; os12 casos não foram executados, pending0 e writeOutcomeUncertain=false. Isso não identifica qual comando ou observação terminal causou a recusa. O log original público preservado tem53640B/SHA25622dbff136cbc2e732a5488d811abfdd6066444749b5026c8412c26f9da03f50a. Não houve rerun, correção de resultado ou hipótese promovida a causa.

A Root autorizou somente diagnóstico failure-only. O relatório operacional continua fechado na versão2 sem novos campos; a linha separada de stderr usa sua própria versão1/cenário finance-goals-terminal-native-process-failure. Ela só nasce dentro da mesma recusa original de strictRun e contém: operação enum git-head/git-tree/git-status/git-blob/supabase/docker/psql/unknown; contadores stdoutEnd/stderrEnd/stdinFinish/exit/close saturados em2 (duas ou mais ocorrências); badTerminal; códigos0–255 ou null; presença de sinais em boolean; needInput e groupConfirmed. O registro tem no máximo1024 bytes com o LF. Nenhum argumento, caminho, output do filho, SQL, env, credencial ou erro bruto é serializado.

A classificação devolve somente o enum. A projeção é fechada e inspeciona descritores, recusando getters, proxies, campos desconhecidos e valores fora dos limites; o writer constrói a linha inteira antes de emitir e não imprime uma exceção da própria projeção/escrita. O diagnóstico não certifica recibo, origem, limpeza ou aprovação. Em particular, needInput=false não dispensa stdin finish. Os mesmos cinco contadores devem continuar exatamente1, badTerminal=false, códigos0, sinaisnull e groupConfirmed=true. Todos os limites, timers e caminhos de cleanup permanecem originais.

Foram escritos três controles adicionais, totalizando32 declarações: classificação sem vazamento/coerção, projeção fechada/bounds e writer limitado com canários/getters/args/erro bruto, incluindo conservação do predicado original e do relatórioV2. Nenhum desses três controles foi executado pelo autor, e29/29 do SHA anterior não são PASS deste delta. O próximo original deve revelar a falha sem relaxar qualquer condição; publicação/execução dependem da revisão Root e do fechamento dos originais atuais. Não iniciar stack local, banco hospedado ou restore por causa desse diagnóstico.

## Associação do catálogo ao executor privado

NOVO FATO original separado: o push7f14507353d211737b0ee22395673fb4968df785/run40059889766/job120770906458 recusou CATALOGUE_REFUSED em companions, após PG170011, inventário130fontes/45dependências e o catálogo1720 anterior; os12 confrontos não rodaram. Esse resultado não substitui o PROCESS_REFUSED da PR nem identifica a observação terminal ausente naquele original.

A leitura pública revelou um erro de associação no N: ADDITIVE_CATALOG.oldSource consulta o prosrc de app_private.fg_terminal_previous_commit, mas o expected comparava498c676f3a28e20e597d4a8c0b62b37811b41a82844f59b32b389d6a31292c6e, pertencente ao wrapper public.finance_goals_commit. A M1 copia o corpo PRIVADO app_private.fg_commit para esse executor histórico. Extração literal de proposals/finance-goals/04-commit.sql, normalizando somente CRLF para LF, fornece8914bytes/SHA25686377bc8865a571c950eea05596531890225f19131c44f5a839c282e679c5ebf; o wrapper tem71bytes/hash498c. Ambos já constam no SOURCE_GATE público da M1.

A Root autorizou corrigir somente expectedoldSource no runner para o hash privado86377. Não se alterou consulta SQL, proposta, corpo de função, migração, pin de Source, grant ou outro predicado. Não é ajuste por observação de banco: a prova vem das fontes públicas pinadas. Foi escrito um controle adicional que extrai os dois corpos, exige tamanhos/hashes fixos e diferentes, confere o expected exato do N, o alvo da consulta e a seleção/cópia de old_body da M1. Ele recusa a associação ao wrapper, em vez de calcular um novo pin para aceitar qualquer corpo.

O pacote agora tem33 declarações puras (29anteriores+3diagnóstico+1associação) e12 confrontos escritos. Os quatro controles novos não foram executados nesta autoria. Outros estados do catálogo aditivo continuam dependendo de observação própria; corrigir essa associação não garante PASS futuro, não relaxa OLD_EXECUTOR/EOF/cleanup e não autoriza banco hospedado, restore, merge ou produção.


## DRAFT — fronteira CURRENT27 / execução HIST026

Este adendo e o script correspondente foram preparados externamente sobre os dois blobs da base 891bf4a95badc6e93bff1c69b22254d2f08fa7dc. Nenhum código foi copiado ao checkout Root e nenhum Node, teste, SQL, CLI, container, conexão ou workflow foi executado nesta autoria.

Dependências de integração: readerV2 canonical-release-source.mjs/.d.mts; delegadores Auth que separam loadCanonicalMigrations (CURRENT27) e loadHistorical026Migrations (prefixo 26 somente após qualificar o27 inteiro); pacote de cinco consumidores financeiros que faz readFinance026Sources usar o mesmo leitor histórico; promoção posterior dos bytes/cópias/manifestoCURRENT27 por Root. A dependência não é substituída por fallback. O DRAFT não deve ser executado diretamente sobre a base 891 ainda de26 arquivos.

| Material | Qualificação/captura | Execução deste job |
| --- | --- | --- |
| CURRENT27 canônico | Leitor fechado27 e nomes exatos; todos os 27 blobs Git antes de bundle/serviço | Não executa027 |
| SQL Editor installation copies | Mais 27 seeds explícitos, derivados do índice 1..27 e dos nomes já validados; igualdade de cópias também no reader | Nenhuma cópia executada |
| CatálogoCURRENT27 | Continua seed capturado Git/hash antes e relido no fechamento | Nunca usado como catálogo026 |
| HIST026 canônico | Prefixo exato26 comparado byte/file com CURRENT27 e depois com readFinance026Sources do bundle real | Executa somente001–026 |
| CatálogoHIST026 | tests/fixtures/schema-release-026/release-catalog.sql;82143 B / SHA4557741f008d48ea60ad8a3e2d5a41667630543c3bf2ab0682ec2b33ad97e297; confere também o registro capturado | Hash/largura conferidos imediatamente antes de query; exige version 1 / ok true / checks 1720 / deviations vazio |
| ManifestoHIST026 e declaração do reader | Seeds literais fechados, blobs Git e rehash final | Não são SQL nem prova de instalação |

O fluxo preserva a seleção de companions original: Budget→B2→Goals→M1 em N12V2; no modoI8V1, E1-A fica entre Goals e M1. O 027 inteiro é fonte capturada, não uma migração executada antes de reaplicar os companions. readFinance026Sources agora também qualificaCURRENT27 por sua dependência real; o runner compara seu retorno de 26 com o prefixo histórico já conferido.

A única admissão nova de módulo de entry é o literal tests/helpers/canonical-release-source.mjs. Além de estar na allowlist máxima, ele precisa aparecer de fato no conjunto moduleParsed. Realpath, containment, hash contra captura Git e recusa de import dinâmico continuam iguais. Nenhum SDK, fábrica WASM ou módulo -candidate-sql entra por essa expansão. A saída do bundle permanece no mesmo nível de diretório para preservar import.meta.url dos Sources.

Não há gate de “140 fontes”. O conjunto de apoio continua derivado pela mesma função sourceClosure; os27 seeds adicionais de cópias são explícitos e serão linhas reais dessa captura. Não se afirma uma contagem observada nesta autoria. Os limites existentes de512 registros e2 MiB por arquivo, os budgets de processo/sessão e todos os protocolos/reporters ficam intactos. Se algum limite for atingido, o candidato deve recusar e informar a lacuna, não ampliar o limite para passar.

## Negativos necessários para a integração, não executados

1. Remover/alterar027 ou acrescentar migração/cópia SQL: leitorCURRENT27 deve recusar antes de serviço ou aplicação.
2. Divergir nome/byte entre o prefixo 26 histórico, CURRENT27 e o retorno do reader do bundle: recusa antes de qualquer instalação; não aceitar só comprimento26.
3. Omitir ou adulterar uma das27 cópias no Git/captura: falha do reader ou da prova Git, sem completar o relatório.
4. Alterar um byte do catálogoHIST026, inclusive newline, ou devolver bytes diferentes da captura: CATALOGUE_REFUSED antes de query.
5. CatálogoHIST026 retornar count diferente de 1720 ou desvio: recusa exata; não tentar o catálogoCURRENT27 como alternativa.
6. Espionar as chamadas apply/query: nenhum byte027/catálogoCURRENT27 deve ser executado; a sequência é26 históricas e os companions originais.
7. Sharedreader ausente, outro arquivo, symlink/realpath alheio, hash divergente ou import dinâmico: GRAPH_REFUSED pelos mesmos validadores.
8. Defaults de flags/env, HTTP pendente, unknown, terminal/EOF/ACK/grupo ou cleanup não confirmado: os negativos originais N/I continuam; a seleção histórica não autoriza mascará-los.
9. Mutação de qualquer fonte capturada após as raças: o rehash final original inclui agora migrations 27, copies 27, ambos os catálogos, manifesto e declaração; nenhum PASSED por shape.
10. Falta de reader/delegador/Source financeiro novo: falhar sem loaderlegacy/seed/override alternativo.

O teste do runner é propriedade do pacote de consumidores de outra frente e não foi substituído neste delta. Root coordena seus ajustes, a derivação real do grafo e os próprios CI. O histórico de N12/I8 anterior é evidência separada; não há aceite novo para esta fronteira, release027, hospedado ou restore.

## V2 — contrato legado Auth preservado

A revisão de fonte confirmou que loadCanonicalMigrations/loadHistorical026Migrations retornam somente {source:Buffer}; file não pertence à APIlegada. O erro da V1 era do autor deste boundary, não dos delegadoresRoot. V1 permanece imutável e não foi executada.

Esta V2 usa migrationNames físicos ordenados do mesmo ROOT, após a qualificação integral CURRENT27 do reader, para capturar Git das27migrations/cópias. PrefixoLegacy compara somente26Buffers; as linhas nomeadas do Source financeiro do bundle comparam file contra esses nomes físicos já qualificados e source contra o prefixo. Não há alteração de AuthAPI, reader, SDK, report, caso, limite ou protocolo. O controle de compatibilidade nas suítesAdmin usa a APIpura quando precisa file e confere que o delegadoLegacy continua sem esse campo.
