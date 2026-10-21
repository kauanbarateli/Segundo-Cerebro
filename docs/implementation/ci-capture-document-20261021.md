# Integração da borda documental de Capturas — 21/10/2026

Refs #75, #71 e #81. Fatia parcial de persistência, sem encerramento da entrega do editor ou da promoção rica para Conhecimento.

## Procedência

Entrega autoral `728bd2f0695e260dcf9544d4746124db46e816ba`, árvore `2359d366ca2fbec8025354961e00df2c5bba7e09`, sobre `b5e7e8547abb0f81db9f99b53bb043cec4a85dc9`. A revisão independente da Root confirmou os 38 paths por OID Git, bytes e SHA256 contra o manifesto final, SHA256 `e3dd340b3b397f524a1dc0fb6837835d5534a31b6d52189009a0007836f580ba`; três commits sem coautoria. Esse resultado comprova procedência da fonte, não execução.

A integração usa a base Financeiro `dbf8d51fee31d67d9731591865df104287761bde`, preservando a correção de Hábitos e o diagnóstico passivo de Auth. Antes do próximo commit/publicação, Root conferiu os 18 runs originais de dbf8d51: todos terminaram success, sem rerun ou cancelamento. A evidência financeira não certifica o novo delta de Capturas.

Core, DTOs, adapters, journal/ACK e SQL foram revisados por leitores independentes. As duas correções posteriores da autoria fecham o CHECK físico de recibos para o envelope documental e a capacidade do par histórico de eventos. As especificações autorais distinguem os contratos, os testes preparados e seus limites:

- [Contrato documental neutro](t050-rich-document-contract-spec08.md).
- [Borda e compatibilidade](t050-capture-rich-content-spec08.md).
- [Escrita, recibos e ACK](t050-capture-rich-content-write.md).
- [Capacidade e pureza dos eventos históricos](t050-capture-event-capacity.md).

## Recorte de implementação

O update documental usa CAS explícito: texto legado literal ou revisão rica esperada. O servidor atribui a revisão, deriva o texto de busca e grava estado/evento/recibo atomicamente. Repetição do mesmo client_id devolve o resultado original antes de nova comparação; ACK incompatível conserva o journal como resultado incerto. Um cliente legado não pode sobrescrever documento rico silenciosamente.

Os limites maiores são exceções fechadas: body 768 KiB e fingerprint 2 MiB somente para update documental; par de evento até 2 MiB somente quando os dois estados e a transição rica são válidos. Os limites comuns de body 256 KiB, fingerprint/resultado 1 MiB e batch/snapshot 8 MiB permanecem. O CHECK histórico não consulta Captura, arquivo, Auth, sessão ou relógio atuais para conceder essa exceção.

O editor visual, criação rica e promoção rica ainda não são entregues por este bloco; promoção de origem rica é recusada explicitamente. A Atividade exibe nomes públicos de campos, incluindo documento/revisão, sem transportar valores do documento para o histórico resumido.

## Cadeia e artefatos

Migration candidata `20261021171416_spec08_capture_document_write.sql`, 32.167 bytes/SHA256 `431e7521306951d403aba861541805b350cf30523d0e52b7634825852f961b38`. A cadeia candidata é 001–020, Hábitos e Capturas: 22 migrations. O arquivo reservado de Calendar `20261021050931_spec08_calendar_list_participants.sql` continua ausente. Sua integração futura exige nova coordenação da ordem e validação; não tratá-lo como se já tivesse sido homologado nesta cadeia.

SQL Editor é gerado somente pelo gerador existente em runner descartável. A importação deve conferir o digest do artefato, SHA de origem, hashes de cada arquivo e preservação das cópias anteriores. Nenhum candidato gerado se torna aceite ou baseline automaticamente. Tipos public devem ser gerados pela CLI oficial no PostgreSQL 17 descartável e comparados por AST; helpers privados e novos membros de payload JSON não autorizam inventar colunas/tipos públicos.

Os derivadores originais devem observar os conjuntos de fontes novos antes de reconciliar suas igualdades. NativeAdmin e Avatar têm listas explícitas; os demais conjuntos são derivados de imports. Expectativas anteriores de catálogo (1.350 checks no PGlite e 1.353 no PostgreSQL 17) não serão aumentadas por suposição. Conservar recusas de cada SHA e exigir novos runs após qualquer reconciliação.

## Restore e ativação

O archive já inclui os payloads JSON e suas revisões; o export não deve projetar ou remover esses membros. Como a carga gerenciada usa replica, a validação fixa após retornar a origin precisa conferir documento/cache/revisão, eventos históricos e recibos restaurados, além do catálogo/FKs. Deve ocorrer dentro da mesma transação existente, sem novo commit, SQL fornecido pelo chamador ou autoridade adicional.

A verificação do catálogo inclui os corpos e contratos dos novos helpers, do validador legado v1 e de sua folha de timestamp, incluindo o default falso do segundo argumento. A validação de dados interrompe antes de chamar qualquer helper se o catálogo estiver desviado. Um teste com erro sentinela diferente foi preparado para distinguir essa interrupção da execução de um corpo adulterado; os testes de default comprovam que mudá-lo também é detectado quando o corpo permanece igual.

Revisões históricas podem diferir da Captura atual legitimamente. A validação não deve confundi-las com adulteração nem consultar arquivos atuais para validar o envelope histórico puro. Um estado rico criado por fixture/restore privilegiado não concede um novo comando público de criação.

Antes de aplicar no projeto pessoal: conferir SQL Editor/tipos/catálogo no SHA final, compatibilidade de leitores/escritores e ordem completa, depois executar a operação supervisionada prevista em OP-009. Após dados ricos existirem, um leitor antigo que recusa os novos membros não é rollback seguro. Nunca apagar formatação ou reduzir revisão para fazer um rollback passar.

## Validação e estado

Nesta máquina de 8 GiB foram usados somente Git, PowerShell/.NET, leitura, hashes e edição leve. Nenhum Node/npm, compilador, lint, teste, build, browser, SQL ou serviço local foi executado. Revisão estática e diff sem erros de espaço não recebem PASS dinâmico.

O lote focal usa os três SQLs de Captura no fixture canônico descartável, sequencialmente, seguido pelos gates originais e E2E pertinentes. Os NOTICEs de capacidade são números sintéticos; expectativas analíticas do documento autoral só se tornam observações quando executadas e vinculadas ao SHA. PGlite não certifica PostgreSQL 17 nativo, PostgREST, Auth hospedado, concorrência física ou editor visual.

Publicação prevista em PR de rascunho empilhada sobre Financeiro, com deploy automático da branch `codex/ci-capture-document-20261021` desativado. Sem merge, deploy, aplicação remota, reset, seed ou abertura comercial por esta integração. Implementado, validado e pendente devem continuar separados na PR e na issue.

## Rodada e1161e8 — observações e correções preparadas

A [PR94](https://github.com/kauanbarateli/Segundo-Cerebro/pull/94) foi publicada em rascunho no SHA `e1161e8164163e410a2d9e44f73f1cd800c5efaa`. As 18 execuções originais terminaram: 17 failure e 1 success, sem rerun ou cancelamento. O único success foi a qualificação Chromium. Nenhuma falha foi convertida em aceite pela revisão estática.

CI push 39657779422 e PR 39657835933 pararam no SQL Editor desatualizado, antes de tipagem, lint, build ou E2E. A sintaxe estática dos 84 arquivos SQL passou; isso não compila o SQL contido em uma string JavaScript. Recovery push 39657779456 parou nos controles de fontes: 118/119 pass, SOURCE_REFUSED, sem iniciar a recuperação real. Avatar/Fundação recusaram manifesto 21 contra requisito 22; o backend nativo e os tipos oficiais não receberam aceite.

O workflow adicional 39657779746 produziu o artefato 12372338054, ZIP SHA256 `bfe7037045e7d63db62cb24c7a270b9bce91aee00c0b3c42865bce116046176a`. Root conferiu digest, SHA de origem e os 24 arquivos. O gerador existente produziu 22 instalações: 001–021 foram comparadas por bytes/hashes e preservadas; somente 022, manifesto e README precisaram de importação. O catálogo PGlite observou 1.425 checks, ok e zero desvios. Isso não demonstra a contagem do PostgreSQL 17 nativo.

Os derivadores originais observaram AdminBrowser 415, Recovery 227, Drive 261 e Fundação 43. A comparação independente dos conjuntos mostrou somente a nova migration e, nos três grafos de aplicação, os módulos `rich-content-write.ts`, `rich-content.ts` e `contracts/rich-document.ts`: sem perdas, substituições ou duplicatas. NativeAdmin 61 e Avatar 58 continuam listas declaradas. As dependências 61/60/50/2 permanecem. Root preparou as igualdades correspondentes e o pin transitivo Admin de 19.354 bytes/SHA256 `323f1308d340466b62148d247c21a8599213e08904c6e271c6a6bccdbb70317e`.

O grafo CaptureNative reutilizado recusou os três módulos novos antes de completar o bundle. Sua allowlist/tuple agora os declara explicitamente; a expectativa 23 precisa ser comprovada pela igualdade com o inventário real do Rolldown. O grafo do processador de imagem passou e não foi ampliado. O backend visual também foi reconciliado para 22, mantendo os pins 018–021 e negativos de inventário/manifesto/cópia.

No diagnóstico adicional, unidades tiveram 2.307 pass/1 fail em cada fuso: apenas o inventário visual ainda fixado em 21. Scripts tiveram 1.686 pass/78 fail em 1.764 casos: 61 do grafo CaptureNative, seis de coletores, cinco do catálogo, cinco de sintaxe do SQL gerenciado e um de receipt físico. O CASE da condição ELSIF foi parentetizado como correção sintática mínima; ainda exige execução. As reconciliações não mudam os gates originais nem recebem PASS antecipado.

A falha de receipt é o primeiro INSERT positivo acima de 1 MiB, com request medido de 1.048.577 bytes. O CHECK recusou 23514/command_receipts_check, embora o caso esperasse aceite; negativos e modo UPDATE posteriores não foram alcançados. O positivo comum anterior, request/result de 1 MiB, passou. A mensagem externa não revela qual validação interna devolveu falso ou capturou exceção. Não atribuir a PGlite nem alterar a regra para fazer o teste passar sem diagnóstico.

O lote SQL focal registrou 5 pass/1 fail em seis testes; esse mesmo receipt reaparece no bloco de scripts e não deve ser somado como defeito independente. O arquivo de capacidade de eventos, seus 17 valores e snapshots/lifecycle ainda não foram alcançados. A próxima rodada de observação manterá o positivo e os negativos e emitirá somente tamanhos, booleanos e códigos fechados das etapas internas. A migration permanece com o mesmo hash, sem aplicação remota. Alterar o SQL de validação exige reconferir o manifesto pelo gerador no runner.

O diagnóstico adicional passa a executar tipagem e lint sequencialmente após exportar os candidatos, mesmo quando o lote focal falhar. Isso permite observar esses erros enquanto o manifesto gerado ainda bloqueia o CI geral. Os gates originais, o timeout e a política sem cancelamento/rerun permanecem; esses diagnósticos não substituem a execução original posterior.

## Rodada f1066f1 — observação nativa e reconciliação

Os 18 runs originais do SHA `f1066f1ad2fd8ef8d045a4ddddfff2630208c35c` terminaram, todos na tentativa 1, sem cancelamento ou rerun: três success e 15 failure. Auth passou tanto em push quanto em PR, além da qualificação Chromium. Os outros gates continuam pendentes; uma contagem corrigida não recebe aceite antes de nova execução.

O Auth push [39661327670](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39661327670) fez checkout do SHA f1066f1, aplicou 22 migrations no PostgreSQL 17 descartável e observou **1.428 checks nativos**. Seu relatório terminou PASSED, com logout, identidade/DataAPI e troca de senha aprovados, limpeza dos três namespaces confirmada e remoção dos diretórios privados. O vínculo ao SHA vem do run e do checkout; não existe campo interno `sourceSha` nesse relatório. Esse resultado não certifica o e-mail de recuperação nem o domínio público.

Essa observação permite reconciliar os consumidores nativos ainda fixados em 1.353 para 1.428, preservando igualdades e negativos. A contagem PGlite continua 1.425. São motores distintos, com observações próprias; não derivar uma contagem da outra.

O Storage push [39661327737](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39661327737) passou 91/92 controles puros. A construção completou os grafos permitidos e observou 31 módulos na união de CaptureNative e processador de imagem; só a expectativa anterior 28 falhou. O processador manteve sua allowlist e igualdade própria. A reconciliação muda apenas a expectativa dessa união, sem ampliar permissões. O fluxo Storage nativo não iniciou nessa execução.

O artefato adicional 12373478556, ZIP SHA256 `6e216eb2fb84e9e157aa1b57ef970e98c75d50d1058477705421aa040565e7e3`, foi conferido por digest, origem f1066f1 e hashes dos 24 arquivos. PGlite continuou 1.425/ok/zero desvios. A importação atualiza somente o manifesto com o hash do SQL de diagnóstico: as 22 instalações e o README permanecem idênticos. Nenhuma migration foi aplicada em projeto hospedado.

O run adicional [39661327455](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39661327455) passou tipagem, lint, as 2.308 unidades em cada fuso, camadas e os 164 pares de contraste. Scripts tiveram 1.760 pass/4 fail em 1.764 casos; o lote focal teve 5 pass/1 fail. A falha do recibo é a mesma nos dois lotes. As outras três falhas de scripts foram a união de módulos, um negativo de catálogo ainda esperando 1.354 quando observou 1.429 e o fluxo de validação pós-replica. Esse negativo adiciona um overload sintético e continua exigindo as quatro verificações extras e o desvio exato; sua expectativa foi reconciliada, sem aceitar o overload.

O diagnóstico fechado do recibo mostrou dez precondições verdadeiras, sete códigos de etapa permitidos e `intent=42725`; as outras seis etapas retornaram `00000`. O fluxo pós-replica também mostrou `42725`, com operador ambíguo entre dois valores unknown. A expressão `p_input->'patch'-'document'` agrupa a subtração antes da projeção. A correção mínima é `(p_input->'patch')-'document'`; o CHECK, os limites, o positivo de 1 MiB+1 e todos os negativos permanecem.

A revisão estática encontrou a mesma precedência no corpo clonado do schema de Knowledge: `m->'attrs'-array[...]`. Esse segundo ramo ainda é **INFERIDO**, pois a execução parou antes dele. A migration candidata corrige os parênteses somente na nova cópia de Capturas, exigindo uma ocorrência exata; não altera a migration 008 nem o validador/OID instalado de Knowledge. O positivo pequeno com link e o negativo com atributo extra exercitam a regra, e o teste de capacidade contém 243 links. Fonte primária da regra: [precedência de operadores no PostgreSQL 17](https://www.postgresql.org/docs/17/sql-syntax-lexical.html#SQL-PRECEDENCE).

O corpo corrigido do intent tem SHA256 `e619f7e71592d6a14b40d224b247aa6238724416f1bd1abb7dc9e15c1972d334`; o clone tem `f6b7212b63a8b0fca6317a07d326460bc33ed9a3961de20808d674ece19d48eb`. Root conferiu os corpos anteriores antes da transformação e atualizou seus pins no catálogo e no SQL gerenciado; os CTEs literais continuam idênticos. O pin transitivo Admin passa a `5f5325505d1d5a9ca688d145a7ab4f1253e6b740a2f21bed3dc1e70d8cf7ab8a`, com os mesmos 19.354 bytes.

A migration 022 continua sem aplicação hospedada; agora tem 32.137 bytes e o hash indicado em Cadeia e artefatos. A próxima execução precisa comprovar o delta e gerar novamente a cópia/manifesto do SQL Editor no runner. A cópia ainda vinculada ao artefato f1066f1 será recusada pelos gates de atualização até essa importação; não foi editada manualmente para aparentar equivalência. O sucesso anterior de Auth e das unidades pertence ao SHA anterior, não às correções ainda não executadas.

## Rodada ba0c467 — integridade e asserção remanescente

Os 18 runs originais de `ba0c4674aea94a214f33d7b3b504427be7838a12` terminaram na tentativa 1: 17 failure e um success, sem cancelamento ou rerun. O success foi Chromium. Os loaders de Auth recusaram corretamente a fonte 022 corrigida contra a cópia antiga, antes de executar os casos reais. No push, o checkout era ba0c467; a PR fez checkout do merge `563f87d93bfb1d9e3d13dda15144e322fada82f8`. Não atribuir os resultados do merge ao checkout direto nem inventar execução funcional após a recusa de integridade.

O artefato [12375752703](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39663994103/artifacts/12375752703) tem ZIP SHA256 `f111394354635443bc3900e6e89963cf5931c7c9dba596881f1c36545872e540`. Agente e Root conferiram digest, origem ba0c467, propósito somente candidato, 22 migrations e hashes/tamanhos dos 24 arquivos; PGlite observou 1.425/ok/zero desvios. Root importou somente a cópia 022 e o manifesto. Instalações 001–021 e README foram preservados por comparação bruta; nenhuma geração manual ou aplicação hospedada ocorreu.

O diagnóstico adicional [39663994103](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39663994103) passou tipagem, lint, as 2.308 unidades em cada fuso, camadas e contraste. Scripts passaram 1.763/1.764; focal 5/6. A validação de restore pós-replica e os negativos de catálogo passaram. O recibo agora mostrou sete etapas `00000`, dez precondições verdadeiras e intent/predicados pequeno/grande verdadeiros. O erro 42725 desapareceu desse run; permanece uma asserção genérica no SQL de comportamento. O arquivo de capacidade ainda não foi alcançado, portanto seus valores e lifecycle continuam sem aceite.

A próxima investigação acrescenta ao wrapper somente a localização fechada da exceção: SQLSTATE e nomes permitidos de funções com números de linha. Não publica `where`, SQL, dados, IDs ou contexto integral, não muda os oracles e relança o erro original. A migration e os SQLs não serão alterados por suposição. A correção da expressão no clone não resolve por si a fonte instalada de Knowledge: antes de liberar promoção rica, revisar esse ramo em migration nova própria e teste específico, preservando a 008 aplicada.

## Localização no CI original de 652c584

O CI push [39665666834](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39665666834) executou as 22 migrations e passou os contratos gerados: 35 tabelas, uma view, 58 RPCs, 329 colunas e 206 argumentos. O SQL de comportamento então falhou na linha 24 do bloco que consulta Atividade: o contexto identifica a asserção de oito chaves no item bruto retornado pela RPC.

O contrato ativo da RPC tem nove chaves, incluindo `user_id`. O gateway valida esse dono e o remove antes de entregar os oito campos ao Core/apresentação. Portanto o teste SQL estava comparando camadas diferentes; não é uma autorização para expor o dono no DTO público ou alterar a RPC. A correção preparada exige as nove chaves, recusa qualquer extra e compara `user_id` ao dono do fixture, mantendo `changed_fields` e a recusa de NULL. O schema e o comportamento de produção permanecem iguais.

Para observar os três arquivos mesmo quando um falhar, o wrapper passa a usar subtestes aguardados na ordem original, cada um com DB canônico descartável próprio e fechamento em `finally`. Todas as asserções, controles de resíduos e limites permanecem. Um filho com falha continua tornando o pai/global failure; os arquivos seguintes deixam de ficar ocultos por essa falha. Só um banco fica ativo por vez. Essa alteração de observação ainda precisa de sua execução original; não substitui o gate de SQL geral.

O extra original [39665666798](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39665666798) confirmou a mesma localização pelo diagnóstico fechado: comportamento, `P0001`, `assert_document:1` e `inline_code_block:24`. Não houve erro 42725 nem outra hipótese funcional demonstrada. Focal 5/6, scripts 1.763/1.764; tipagem, lint, unidades nos dois fusos, camadas e contraste passaram. A capacidade ainda não executou nesse wrapper anterior. Os [subtestes aguardados do Node](https://nodejs.org/docs/latest-v24.x/api/test.html#subtests) mantêm a falha do pai quando um filho falha; não há skip, TODO ou inversão de sucesso.

Fundação push [39665666850](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39665666850) passou as 13 etapas, com origem interna e checkout em 652c584: 22 migrations, segunda aplicação sem pendências, catálogo PostgreSQL 17 com 1.428 checks e zero desvios. A CLI 2.120.0 gerou os tipos públicos; AST SNAPSHOT_MATCH/zero diferenças e cinco controles negativos. Os seis workers observaram cinco concessões/uma recusa, backends distintos e barreira/janela confirmadas. Limpeza, remoção de namespace/diretórios e quietude de I/O foram confirmadas, sem processos pendentes nem resultado de escrita incerto.

O artefato oficial de tipos 12376397891 teve digest ZIP `83184cbc95871accb56b4ef87c906e64a6212c4fdf9fb1c9a583bef637af953d` conferido; conteúdo de 56.092 bytes/SHA256 `ae237b52b0b9a27b10a081299e527d88539714001ca989ceb09a48dd7fba565f`, igual ao relatório e vinculado ao SHA do run. O snapshot rastreado tem 56.342 bytes/SHA256 `ca33111158f42c65809359d6e3254ea5ca34d8b20ab05b48b5221a0a6323ca40`. Root confirmou que o corpo coincide ao remover apenas espaço de fim de linha e o cabeçalho de procedência; não importou o arquivo nem executou AST local. A prova estrutural pertence ao runner; a atualização do ambiente hospedado continua separada.

Auth push 39665666777 e PR 39665676268 passaram nos três casos e na limpeza. O push fez checkout exato de 652c584; a PR usou merge `a6a2fe7514d0cbfb4a9bf3806321193c8d209bf4`. Os demais cenários nativos também terminaram success. Esses aceites não encerram recuperação humana no domínio www, editor de Capturas ou aplicação hospedada.

## Rodada 8f3e767 — baseline dos eventos da fixture

Os 18 originais de `8f3e7679390ce146d26c591d58228c0c8f01d0ad` terminaram na tentativa 1: 15 success e três failure, sem rerun/cancelamento. Os cenários nativos e Chromium passaram; CI geral recusou o manifesto anterior ao ajuste do teste. O extra [39667373850](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39667373850) passou catálogo e comportamento, incluindo o contrato RPC de nove campos. O isolamento sequencial permitiu observar a capacidade mesmo com sua falha própria.

A capacidade parou em `P0001`, `inline_code_block:13`, linha 125 do SQL daquela fonte: “one upgrade event”. Upgrade exato e persistência da payload já tinham passado. O teste contava todos os eventos do usuário, incluindo os emitidos por `provision_user` ao criar a fixture Auth. Isso não demonstra duplicação de evento de Captura. Totais semelhantes de dois/quatro eventos ainda não tinham sido alcançados.

O ajuste preparado captura o baseline físico completo e ordenado por dono antes das escritas, exige zero eventos de Captura no setup e depois confere simultaneamente total=baseline+N, Capture=N e todos os demais eventos idênticos ao baseline. Não apaga registros nem fixa a quantidade do provisionamento. As contagens de recibos continuam exatas; o upgrade passa a conferir também ID/dono/entidade/estados/envelope. Negativos, limites, rollback, CAS, snapshots, replay e trigger/CHECK permanecem. O delta congelado de capacidade tem 44.513 bytes/SHA256 `423d6fbcbacaf176ca6f96d3170ef3d6271d505ab0b1f3e9b5a3a790a68699ea`; ainda exige execução.

Focal teve nove testes, sete pass/dois fail, e scripts 1.767 testes, 1.765 pass/dois fail. Nos dois casos, são o filho de capacidade e seu pai, não dois defeitos independentes. Tipagem, lint, 2.308 unidades por fuso, camadas e contraste passaram. As 17 métricas, snapshots e lifecycle ainda não foram emitidos; não recebem aceite antecipado.

O candidato 12378785117, ZIP SHA256 `cb8f8cfac02cc8ff840ba206de87cadb4b30026ce42258f44c80d7f357cc109a`, foi conferido nos 24 arquivos, origem 8f3e767 e 22 migrations. Só o manifesto difere do candidato anterior; cópias 001–022 preservadas, PGlite 1.425/ok/zero desvios. Foi mantido sem importação, pois o novo ajuste de capacidade exige regeneração de seu hash de validação. A próxima importação deve vir do novo SHA estável pelo mesmo gerador, sem edição manual do manifesto.

Separadamente, o mantenedor confirmou a recuperação de senha e o login em www; o registro próprio está em [domínio público](../operations/dominio-publico-20261021.md). Isso não substitui o aceite de capacidade nem autoriza aplicar a migration hospedada.

## Rodada 13e0ebf — qualificação da coluna de recibo

Os 18 originais de `13e0ebf82d945a6b38a7aa20a14d7728c2221803` terminaram na tentativa 1: 15 success e três failure, sem cancelamento ou rerun. Os 14 cenários nativos de push/PR e Chromium passaram. CI geral recusou o manifesto ainda anterior à mudança do teste; não recebeu aceite por herança dos outros gates.

O extra [39669657427](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39669657427) passou catálogo e comportamento. A capacidade avançou além do baseline e falhou em `42702`, `inline_code_block:46`, linha 166: a variável PL/pgSQL `request` conflita com a coluna de mesmo nome em `command_receipts`. O delta qualifica esse SELECT com o alias `r`, incluindo `request`, `result` e o filtro. A comparação exata e o limite de 1 MiB permanecem; não altera o comando, o recibo ou a migration. O arquivo corrigido tem SHA256 `22673024b833adc02099d59c48e74ff0a78df81d01ccf23b30505ce0f8660763` e ainda exige execução.

O candidato 12379735906, ZIP SHA256 `6edaaf0495e13a0c16f19c38fab3aec2dba41722cd0ddb97dbf9dfb6fbd9c343`, foi conferido nos 24 arquivos e na origem 13e0ebf: 22 cópias preservadas, somente manifesto diferente, PGlite 1.425/ok/zero desvios. Continua sem importação: a correção posterior do teste requer um candidato do novo SHA. Os snapshots, o lifecycle completo e o bloco final das métricas continuam sem aceite; nenhum teste local ou aplicação hospedada foi executado.

## Rodada e2a0ab5 — capacidade sintética aprovada e manifesto gerado

O extra original [39671012711](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39671012711), tentativa 1, origem `e2a0ab537dad9da8fee81a7059e52615fe94b9a0`, terminou success. Os três filhos SQL de Capturas passaram: catálogo, comportamento e capacidade. Focal 9/9 e scripts 1.767/1.767; tipagem, lint, 133 arquivos/2.308 unidades em cada fuso, camadas e contraste também passaram. Sem rerun, cancelamento ou execução local.

Os 18 originais desse SHA terminaram na tentativa 1: 16 success e dois failure. Os 14 cenários nativos e Chromium passaram. As falhas foram CI push [39671012628](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39671012628) e PR [39671024400](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39671024400); o log do push confirma `SQL Editor package is stale`/`Drift: manifest.json` antes dos gates posteriores. Root reconferiu os 18 estados terminais antes do próximo commit/publicação.

As observações fechadas de capacidade e recibo coincidem nas duas execuções independentes do mesmo run (focal e scripts). Os sete estágios do recibo retornaram `00000`, dez precondições verdadeiras e intent/predicados pequeno/grande verdadeiros. Request grande de 1.048.577 bytes foi aceito pela exceção documental, sem ampliar a regra comum.

| Métrica sintética | Valor observado |
| --- | ---: |
| Documento compacto, bytes | 524288 |
| Documento JSONB, bytes | 526727 |
| Cache, unidades UTF-16 | 9043 |
| Cache JSONB, bytes | 9045 |
| Metadados base, bytes | 452 |
| Payload 1, bytes | 536274 |
| Payload 2, bytes | 536274 |
| Estrutura residual, bytes | 502 |
| Par de upgrade, bytes | 536752 |
| Par de regravação, bytes | 1072548 |
| Envelope de upgrade, bytes | 2142189 |
| Envelope de regravação, bytes | 3213772 |
| Envelope do evento, bytes | 1072827 |
| Request do recibo de upgrade, bytes | 531801 |
| Request do recibo de regravação, bytes | 531793 |
| Resultado de upgrade, bytes | 536274 |
| Resultado de regravação, bytes | 536274 |

Snapshots observados em bytes: regravação 4.282.723, metadados 5.892.095 e continuação 5.894.723. As quatro etapas de lifecycle produziram 2.145.859, 3.755.213, 5.364.624 e 6.973.970 bytes. Todos cabem no limite preservado de 8 MiB. O par rico de 1.072.548 bytes comprova a necessidade da exceção estreita acima de 1 MiB nesse fixture; não certifica uso ilimitado ou uma carga real.

O artefato [12379502267](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39671012711/artifacts/12379502267), ZIP SHA256 `41459e70778552b020dfd2669873bb0e63ef7035f5bb29ebae9667b3dbb81329`, foi conferido por agente e Root: origem e2a0ab5, propósito somente candidato, 24 arquivos íntegros e 22 instalações idênticas às fontes e às cópias anteriores. PGlite observou 1.425 checks, ok e zero desvios. Root importou somente os bytes do manifesto gerado, 16.003 bytes/SHA256 `d1bfc14050e94f35113fda0b454a2b5c446f21afde2a6dd9064a411da77a094d`. Suas únicas diferenças são hash/tamanho dos testes de comportamento e capacidade; 001–022 e README preservados. Nenhuma geração manual ou aplicação hospedada.

O CI geral ainda precisa executar no próximo SHA que contém esse manifesto atualizado. A aprovação sintética não equivale a editor visual, PostgREST/Auth hospedados, benchmark nativo, restauração real ou compatibilidade de produção. A candidata 022 permanece sem aplicação; a coordenação de ordem, schema, leitores/escritores e rollback continua obrigatória antes do release.

## Rodada 5f8249a — regressão na classificação do comando legado

Os 18 originais de `5f8249a430d73e831a1edf9d7579d236109853fd` terminaram na tentativa 1: 16 success e dois failure, sem rerun/cancelamento. CI push [39672556996](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39672556996) fez checkout exato de 5f8249a. CI PR [39672566350](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39672566350) fez checkout do merge `7664f27f`, com pais dbf8d51/5f8249a e árvore igual à fonte; essa procedência não é confundida com checkout direto.

Ambos passaram a integridade do SQL Editor, 22 migrations, os contratos públicos e os três SQLs novos de Capturas. Em seguida, `capture-task-behavior.sql:110` recusou `Expected 23514, got 22023`: o negativo histórico muda o canal do evento para `api`. Build/E2E ficaram skipped. Os dois artefatos browser-evidence contêm somente `t005-visual-guards.md`, nenhum relatório, trace ou captura de navegador; upload success não recebe aceite visual. O extra [39672557011](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39672557011) terminou success, mas seu SQL focal não exercitava esse comando legado sem `patch`.

O fingerprint histórico contém apenas `id` e `client_id`. No helper novo, a ausência de `patch` produz SQL NULL; `not(false OR NULL)` também é NULL, portanto o IF não retornava false e caía na validação documental estrita, lançando 22023 antes da guarda histórica de canal. Isso é regressão de classificação, não contaminação do DB único nem razão para mudar o SQLSTATE esperado do teste antigo.

A correção torna a escolha da operação total com `IS DISTINCT FROM` e usa `coalesce(...,false)` apenas para detectar os marcadores documentais. Sem marcador, conserva o caminho legado. Com `expected_content` ou `patch.document`, mantém a validação estrita e as recusas; documento inválido continua responsabilidade do schema/RPC. O teste histórico permanece intacto, incluindo 23514, demais negativos, positivos legados e atomicidade.

Novas regressões focais cobrem input SQL NULL/JSON null, ausência de patch, patch vazio/nulo/de metadados, operação nula/diferente, intent legado/rico válido, limite ordinário e markers incompletos/mistos com 22023. A validação fixa após replica também passa a receber e preservar um recibo histórico sem patch, além dos recibos ricos anteriores. São provas preparadas, ainda sem execução da correção.

O wrapper focal também passa a executar o arquivo histórico `capture-task-behavior.sql` integral e inalterado, em DB canônico próprio antes dos três arquivos documentais. Isso permite observar no diagnóstico a compatibilidade que revelou o defeito, mesmo enquanto a integridade do pacote gerado ainda bloqueia o CI geral. Todos os subtestes são aguardados, fecham o DB em finally e propagam falhas; o lote SQL completo original continua obrigatório.

O novo corpo do intent tem 1.922 bytes/SHA256 `9f746429816755c4f44d81ca3217a92eb436a7f2b28306b64b5ece09dd519d0c`. Foram atualizados somente seu pin no catálogo e sua ocorrência no literal gerenciado, preservando os outros 16 helpers e a barreira antes das chamadas. Hash/tamanho da candidata 022 foram reconciliados nos dois consumidores ativos. As migrations anteriores permanecem intactas; a cópia 022 e o manifesto antigos serão recusados até nova geração conferida no runner. Nenhuma aplicação hospedada, edição manual do pacote gerado ou alteração de gate.
