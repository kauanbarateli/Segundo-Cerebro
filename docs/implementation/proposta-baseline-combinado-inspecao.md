# Proposta de comparação combinada da origem autenticada e do alvo inspecionado

Documento de desenho para revisão de Root. Não implementa o fluxo, não muda B4, não executa Node, SQL, conexão ou captura e não reaproveita operações encerradas. Considera as fontes públicas locais de Main/Review em16/10/2026: inspector, A2, B2, B3 e inventário nominal. Algumas interfaces abaixo são propostas, não exports disponíveis.

O próximo passo mínimo é uma operação de COMPARAÇÃO que conserva os recursos dos dois lados no mesmo processo e sob um único prazo original. Ela não é uma operação de restore. Mesmo que as comparações retornem matches=true, a saída pública conserva baselineQualified=false e restoreAccepted=false; a escolha do que preservar ou reproduzir continua decisão explícita posterior.

## 1. Por que não juntar os relatórios atuais

[inspectManagedBackupCore](../../scripts/operations/restore-managed-inspect.mjs) autentica o archive inteiro, reconfere o ciphertext e constrói plano/TOC/histórias, mas apaga buffers e descarta handles em seu finally. Os wrappers públicos devolvem somente agregados. O target core segue a mesma regra de ownership e encerra o snapshot/recursos antes de retornar. Compor inspectManagedBackupHistory() + inspectManagedTargetInventory() sequencialmente juntaria dois relatórios e dois prazos, não os dados nominais vivos exigidos por A2.

O inventário target não é B4. [managedTargetInspectionRequirements](../../scripts/operations/restore-managed-plan.mjs) e [customTargetInspectionTocFacts](../../scripts/operations/restore-custom-toc.mjs) usam WeakMaps diferentes e binding.side=target-inspection, retêm todas as entradas e não fornecem selected/preserved. Source/B4/B3/mint não aceitam esses handles. Essa separação deve permanecer.

Outro limite é a classificação Source: public/app_private integra core no planejador atual, enquanto a comparação de baseline v1 recebe preservados. Encontrar uma função pública igual no alvo não a remove de core nem a acrescenta automaticamente aos350 preservados. Um DTO para comparação não pode modificar o plano ou virar seleção de replay.

## 2. Operação, ownership e prazo propostos

Root implementaria no inspector um único ponto novo, por exemplo:

    inspectManagedCombinedBaseline(absoluteArchive, env, dependencies = {})

Os argumentos operativos continuam archive absoluto + configuração pessoal/target isolado já conferida. Não recebe SQL, nomes de objetos, listas de IDs, callbacks de consumidor, flags de origem, handles externos ou um scope do caller. Imports/help permanecem inertes. dependencies só conserva portas de QA já previstas; qualquer porta injetada mantém o ramo synthetic e não pode gerar conclusão native.

Uma closure privada da operação cria UMA context de45.000ms, com os mesmos métodos check/remaining/race/close, e owns todos os slots abaixo. Helpers apenas tomam emprestado o mesmo objeto; não criam timeout novo, não fecham esse scope e não renovam prazo ao trocar de etapa. Não se mint uma capacidade A1, não se estende a vida para90s e não há retry automático.

A mudança menor de estrutura é extrair fases privadas dos cores existentes. Elas recebem owner/scope criado internamente por Root, conservam os handles/buffers nos slots desse owner e não retornam esses recursos por um export público ou callback fornecido pelo caller. Os wrappers atuais continuam com seu ciclo independente e mesmo resultado/limpeza. A operação combinada não chama seus wrappers públicos para obter JSON e depois reconstruir proveniência.

| Recurso privado | Owner e vida útil | Qualificação e descarte |
| --- | --- | --- |
| Diretório novo, leases e cópia cifrada Source | Root, da abertura ao finally | DACL privada, arquivo exclusivo, somente ciphertext em disco; original preservado |
| Chave, chunks e dump Source | Root, após AEAD completo | Footer/manifest/EOF, hash/tamanho e ciphertext reconferidos; RAM zerada |
| Plano e TOC Source | Root | Getter nominal, cross-check TOTAL e integridade em cada reconferência |
| NativeSnapshot do target e cópia dedicada do dump | Módulo nativo + Root | Projeto fixado, RO/RR/RLS, snapshot único, psql e pg_dump originais separados; cópia zerada no final |
| Plano e TOC de inspeção target | Root | Mapa nominal de inspeção; nenhum getter B4/Source recebe o handle |
| Duas histórias de cada lado e transportes binários | Leitor nominal de cada ramo | Seleção fixa, stdout/EOFs/exit/close originais, counts/digest do helper separados de pg_restore |
| DTOs efêmeros de A2 | Root durante a chamada síncrona | ByteStrings emprestados de stores próprios vivos; não saem no relatório |

As etapas são sequenciais para limitar memória: Source completo; target snapshot/dump/TOC; B3 Source; B3 target; política de cobertura; A2. A ordem Source antes de target impede iniciar conexão quando a autenticação do archive falha. B3 target lê o CUSTOM já capturado, depois do COMMIT readonly; não abre outra transação de dados para buscar histórias. Seu conteúdo pertence ao mesmo snapshot exportado do dump.

Os tetos existentes continuam por lado, incluindo dump64MiB, TOC32MiB, campos4MiB,10.000 entradas e100.000 dependências. Há dois dumps e seus stores vivos; a contabilidade de RAM não pode ser escondida por filtros ou limites elevados. A2 já trabalha com vistas locais efêmeras, sem copiar todos os32MiB. Guardas não podem apagar uma cópia enquanto algum consumidor ainda precisa dela.

## 3. Guardas vivos e primeiro erro

Antes de iniciar qualquer próxima fase e depois de cada await, Root reconfere: scope, latch do primeiro erro, filhos de listagem, receipt NativeSnapshot, TOCs, histórias e helper binário já criados. Um evento original tardio, mudança de bytes, recusa desconhecida ou cleanup incompleto veta o resultado inteiro, inclusive depois de A2 ter calculado igualdade.

Importante: o callback originalFailure de context.check deve ler APENAS latches simples. Não deve chamar nativeTargetSnapshotFacts, pois esse getter chama o próprio scope.check; isso criaria recursão. Root usa assertAllLive separado, fora de context.check, para consultar os getters nominais antes/depois das fases e de cleanup. Os módulos continuam responsáveis por seus observadores persistentes e códigos fechados.

A combinação exige todos os ramos necessários em modo native para uma observação nativa. Forma válida de JSON, hash igual, nome de executável, PID, bool de origem ou teste synthetic não supre proveniência. Sem recibo original vivo, a operação recusa antes de comparar.

O único prazo não deve ser aumentado para acomodar um caso lento. Timeout é uma recusa. Solicitar kill/destroy/close não prova EOF, stdin finish, exit0, close0 ou rollback; processos/transportes sem terminal confirmado permanecem não confirmados. Uma operação recusada não pode ser promovida a sucesso porque a limpeza posterior conseguiu fechar recursos.

## 4. B3 target: entrada nominal nova, sem conversão de handle

Hoje o B3 puro usa customArchiveTocFacts e facts.preserved; o leitor nativo usa esse mesmo getter, a seleção B3 e o binding normal. Passar o handle de inspeção deve continuar recusando. Não se deve fabricar um objeto com preserved, cadastrar o handle no WeakMap antigo, mudar binding.side em seu estado ou escolher dois IDs por parâmetros externos.

O menor acréscimo é fornecer wrappers fixos de INSPEÇÃO nos dois módulos B3 existentes, reutilizando seus núcleos privados. Nomes sugeridos para congelar em revisão:

| Camada | APIs propostas | Fronteira |
| --- | --- | --- |
| B3 puro | inspectionMigrationHistoryCopySelection(inspectionToc); extractInspectionMigrationHistory(inspectionToc, stdout); inspectionMigrationHistoryFacts(handle); discardInspectionMigrationHistory(handle) | Getter de TOC fixo customTargetInspectionTocFacts; mapa próprio de histórias |
| B3 nativo | readNativeInspectionMigrationHistory(options, originalScope, testPorts?); nativeInspectionMigrationHistoryFacts(receipt); discardNativeInspectionMigrationHistory(receipt) | Entrada de inspeção fixa; receipts próprios; testPorts sempre synthetic |

O núcleo compartilhado recebe somente um perfil/constante INTERNA escolhido pelo wrapper. Não há argumento público reader/getFacts/parse/mode/map/callback. As APIs antigas continuam selecionando o perfil antigo e recusando todos os handles novos. Não se duplica parser, transporte de processo, código da named pipe ou formato de COPY.

A seleção nova percorre TODOS os records de um TOC de inspeção íntegro e exige exatamente um TABLE DATA auth.schema_migrations e um TABLE DATA storage.migrations. Confere identidades ByteString, ordinal, dumper, seção DATA, definition nula/vazia, relkind, tablespace/accessMethod e COPY/colunas pelo mesmo perfil já revisado. Duplicação, falta, COPY alternativo ou classe nova recusa. Isso não promove outras linhas TABLE DATA a baseline nem interpreta os seus dados.

Conservam-se os estados ENCODING/STDSTRINGS/SEARCHPATH originais, a ordem física das duas entradas, a extração selecionada nativa e o parser COPY B3 integral. A lista privada vem somente desses IDs, cruzados contra o TOC nativo original inteiro e o mesmo dump/hash. Nenhuma linha de dados é buscada por SELECT. Os ambientes de pg_restore/helpers contêm somente OS necessário, sem PG credentials ou chaves HTTP/backup.

O novo parser guarda histórias/binding no seu mapa próprio. O novo receipt nativo vincula identidade exata do inspectionToc/facts, hash/tamanho do dump, IDs/lista, transporte e guardas persistentes. Getter/seletores antigos não aceitam esse receipt ou o seu historyHandle. Binding side=target-inspection permanece nos estados nominais. A2 receberá apenas um DTO privado construído por Root, não um handle convertido.

O caminho Windows continua com pipe binário qualificado: READY não é conclusão; byte count/SHA/COMPLETE/EOFs/exit0/close0 do helper não substituem os terminais originais de pg_restore, e vice-versa. Usa-se o mesmo scope, lista privada e descarte já existentes, sem stdout textual/normalização CRLF, SQL em disco ou novo helper.

Ao concluir B3 target, Root confronta as quantidades de histórias decodificadas com nativeSnapshot.snapshot.authHistoryRows/storageHistoryRows. Isso reconfirma o vínculo com o snapshot, mas igualdade de contagens não substitui conteúdo completo, identidade nativa ou comparação das histórias.

## 5. Cobertura e política explícita para DDL público existente

A próxima operação pode observar e comparar, mas ainda não existe política aprovada para tolerar qualquer função pública no alvo. FUNCTION/app não identifica rls_auto_enable nem prova infraestrutura. Documentação, nome e search_path não são identidade nativa completa.

Source para a comparação de infraestrutura deve vir de customArchiveTocFacts(source).records, o conjunto TOTAL autenticado. Não limitar a busca aos350preserved: as funções públicas e respectivas ACLs do Source estão hoje em core. Target vem de customTargetInspectionTocFacts(target).records TOTAL, nunca de um filtro pelos nomes encontrados no Source.

Antes de chamar A2, Root precisa de uma política pequena, versionada e revisada que particione cada linha target exatamente uma vez entre: baseline managed/global já reconhecido; candidato DDL app/informação associada; estado/entrada de dados fora da comparação; ou escopo não suportado. A cobertura é sobre TODOS os records e suas classes, não só sobre a primeira recusa. Dados não históricos continuam fora do baseline e não são equiparados a zero pelo TOC. Um item sem classificação recusa; não desaparece de um filtro.

Para os candidatos app, incluir todas as definições e ACL/comment/defaultACL vinculadas, incluindo metadados globais quando a política os relacionar. Identidade completa da classe só estabelece a bijeção com um registro inequívoco do SourceALL; não qualifica sozinho. Um extra no target que não exista no Source, identidade ambígua ou representação ausente deve aparecer como recusa/divergência agregada. Nenhum filtro por nome previamente esperado dispensa enumerar extras.

A comparação de infraestrutura pode reutilizar A2 como uma observação separada, ou usar uma união explícita dos preservados e candidatos para comparação. Essa união NÃO altera o plano Source ou o B4. Root registra privadamente a cobertura e o conjunto da política para não transformar subsets vazios em equivalência. O binding DTO target, se exigido com side=target por A2, é construído a partir do NativeSnapshot original já validado; não se muda o binding do inspectionToc nem se cria um handle TargetBaseline.

Dependências precisam de fechamento nos DOIS lados sobre os registros completos, com correspondência por identidade, ordem e multiplicidade. O contrato A2 v1 ainda recusa aresta fora do conjunto que recebeu. Não inventar proxy de aresta, remover duplicata, comparar números iguais ou cortar o vetor. Se um fechamento adicional for proposto para um DTO de infraestrutura, ele precisa ser política explícita de comparação, reter todos os objetos/bytes acrescentados e ter contraparte inteira em cada lado. Se alcançar dados não históricos, customização sem representação, classe não suportada ou objeto sem contraparte, recusar; não modificar A2 para ignorá-lo.

A2 continua comparando integralmente namespace/tag/owner, definition, drop/copy statement, section/dumper, tablespace/accessMethod, relkind/withOids, identidades e vetores mapeados, além de ambas as histórias completas. DEFAULT ACL conserva o owner emissor na identidade. NULL/vazio e diferenças de SQL/whitespace/CRLF não são normalizados. Somente a exceção já definida para storage.migrations.executed_at permanece.

## 6. A diferença legítima introduzida pela migration003

A [migration003](../../supabase/migrations/20261007151904_restrict_rls_event_trigger_execution.sql) conserva corpo/OID/owner/search_path do helper observado na origem, mas revoga EXECUTE de PUBLIC, anon, authenticated e service_role. O [release-catalog](../../supabase/tests/release-catalog.sql) admite search_path=pg_catalog somente nessa exceção pública revisada. Isso prova o contrato do projeto e uma mudança de permissões; não prova a identidade ou as permissões de uma função no alvo.

Por isso um alvo fresh pode conter definição correspondente e ACL diferente. O resultado correto é a divergência integral de A2, não uma autorização de tratar a ACL como default de plataforma. Não remover ACL, defaultACL, owner, corpo ou dependências para obter PASS, nem reaplicar003 ou executar REVOKE/ALTER automaticamente nesta operação.

Root precisará escolher explicitamente o tratamento posterior: preservar somente infraestrutura demonstrada equivalente e revisar um novo plano qualificado; preparar o alvo para uma política desejada por mudança separada e documentada; ou continuar bloqueado diante da divergência. A política só entra em vigor depois de revisão de sua abrangência e efeitos. A comparação não realiza essa escolha e não reclassifica Sourcecore/preserved.

Também não presumir que a presença da função no dump inclui o event trigger ensure_rls. O dump usa --schema; objetos globais sem namespace seguem outra seleção no produtor. A ligação/owner/tags/estado do event trigger exige gate de catálogo próprio antes do restore. Não se afirma essa equivalência a partir do TOC da função ou de testes locais. [Seleção PG18.4](https://github.com/postgres/postgres/blob/REL_18_4/src/bin/pg_dump/pg_dump.c#L2155-L2175), [opção -n](https://www.postgresql.org/docs/18/app-pgdump.html), [exemplo oficial Supabase](https://supabase.com/docs/guides/database/postgres/event-triggers).

## 7. Relatório público e significado de sucesso

Root pode devolver somente um shape fixo, por exemplo version/operation/mode, authenticatedSource, targetQueried, comparisonCompleted e resultados A2 com seus15 motivos canônicos. A recusa de política tem um código fixo separado; não é acrescentada silenciosamente ao enum A2. Contagens eventualmente necessárias ficam limitadas e vinculadas ao mesmo resultado; nenhuma é prova de equivalência.

A projeção não mostra SQL, nomes, assinatura de função, owner, OID/ID, listas, caminhos privados, linhas de migration ou hash individual de DDL. Erros nativos preservam apenas seus códigos/diagnósticos nominais fechados; erro de caller com propriedade code não ganha autoridade. Não inventar causa a partir de stage ou contagem.

Mesmo que managed.matches e infrastructure.matches sejam true, o relatório é uma OBSERVAÇÃO DE COMPARAÇÃO. baselineQualified=false, restoreAccepted=false, remoteMutation=false e automaticIssueAcceptance=false continuam constantes. O escopo de infraestrutura ainda exige decisão de política, o banco pode mudar depois do snapshot e o consumidor de restore ainda deve reconferir vazio, ator, permissões, contexto do evento e demais gates. Nenhuma issue é concluída automaticamente por matches=true.

## 8. Limpeza e selo final

Na saída normal, conservar todos os guardas e stores enquanto ocorre a limpeza assíncrona dos recursos próprios — listas e cópia cifrada/diretórios. Só depois reconferir primeiro erro, scope e todos os getters nominais/receipts. Reconferir os fatos depois de awaits, não guardar uma cópia antecipada dos contadores para selar após a limpeza.

O último selo de decisão é síncrono após a última reconferência: nenhum await entre os fatos finais, predicados e selo. Em seguida descartar histórias/receipts de inspeção e Source, transportes binários, TOCs e NativeSnapshot, zerar dumps/cópias/chunks/chave e fechar o scope UMA vez. Descarte de tipos diferentes não pode funcionar como conversão. Uma recusa/erro de descarte ainda veta a saída; a primeira falha não é substituída por um erro menos específico de cleanup.

Na falha, sinalizar a recusa e impedir novas fases antes de pedir cancelamento. Aguardar a liquidação dos consumidores de bytes próprios conforme os contratos existentes antes de zerar memória ainda emprestada; cancelar não autoriza uma zeragem antecipada nem atesta término. Limpeza pendente ou não confirmada permanece declarada assim. O prazo de qualificação não é renovado pela limpeza.

Nenhum buffer de dados/TOC/histórias ou arquivo plaintext é exportado. A cópia cifrada temporária própria pode ser removida; archive e perfis originais ficam preservados. Strings imutáveis temporárias e cópias feitas pelo caller permanecem fora de garantia de apagamento físico. A operação não conserva uma capacidade reutilizável depois do relatório; futura autorização exige novos recursos/guardas próprios.

## 9. Divisão pequena de implementação e testes

Root fica responsável pelo owner/scope/orquestrador/CLI/preparo e por toda execução conectada. Um agente source-only pode preparar os wrappers B3 de inspeção e seus testes, sob as APIs congeladas; outro pode preparar o builder puro de cobertura/DTO, sem dados reais e sem criar comparador novo. Root revisa os deltas e valida em série, sem executar testes pesados simultâneos.

QA necessária antes da nova operação: não promover clone/JSON/Source/B4/inspection de outro tipo; selecionar somente as duas histórias nominais e validar COPY original; preservar o perfil B3 e todos os terminais separados; vetar erro tardio antes/durante/depois de A2 e cleanup; prazo único sem renewal; não iniciar target antes de AEAD completo/recheck; diferenças isoladas de owner/ACL/definition/dependências e extra app; cobertura integral sem subsets vazios; binding de cada lado; scope callback sem recursão; descarte/zeragem de cópias dedicadas; falha ou modo synthetic nunca projetados como Native/PASS.

Os exports antigos e o B4 restrito devem continuar passando sem alteração de aceitação. O novo preparo é outro arquivo, inerte por padrão e pinado aos novos bytes/commit. As operações anteriores continuam encerradas. Primeiro há revisão/QA/pins; depois Root decide se existe propósito suficiente para UMA operação conectada nova, acompanhada dos metadados próprios.

## Materiais de referência

- [Contrato A2](contrato-a2-inventario-restore.md), especialmente cobertura total, ByteString, arestas externas e histórias.
- [Comparador A2 implementado](frente-b-baseline-comparator.md).
- [Perfil B4 conservador](frente-b-target-baseline.md), que esta proposta não altera.
- [Inventário nominal de inspeção](frente-b-target-inspection.md).
- [Protocolo do snapshot readonly](frente-b-target-snapshot-protocol.md).
- [Inspector](../../scripts/operations/restore-managed-inspect.mjs), [B3 puro](../../scripts/operations/restore-migration-history.mjs) e [B3 nativo](../../scripts/operations/restore-migration-history-native.mjs).
- [A2 puro](../../scripts/operations/restore-managed-baseline.mjs) e [transporte binário](../../scripts/operations/restore-native-binary-output.mjs).

Este documento foi elaborado somente com código e documentação públicos locais e referências primárias já conferidas. Não lê captura/frame/TOC privado e não constitui aceite de infraestrutura, baseline, aplicação ou restore.
