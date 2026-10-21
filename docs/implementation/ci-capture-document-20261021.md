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

Migration candidata `20261021171416_spec08_capture_document_write.sql`, SHA256 `4ce6eb6a7b0162365cae610564447bacb6d0904f18cef8be50a369f073bef877`. A cadeia candidata é 001–020, Hábitos e Capturas: 22 migrations. O arquivo reservado de Calendar `20261021050931_spec08_calendar_list_participants.sql` continua ausente. Sua integração futura exige nova coordenação da ordem e validação; não tratá-lo como se já tivesse sido homologado nesta cadeia.

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
