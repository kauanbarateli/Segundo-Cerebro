# Recuperação019 e controle público do transporte Windows

Refs #35. Candidato de construção sobre a PR #102, fonte-base `43196bdbdf58a391656e5a30bbeb1e45f4d90c86`. Não integra a PR #100, não aplica schema e não oferece um CLI novo de restore. Produção e merge permanecem bloqueados; a homologação isolada autorizada tem outro destino e outro aceite.

## Problema e comportamento

A recuperação pré-corte precisa conferir o modelo019 dentro da transação que fará a importação. O adapter existente sempre usa o catálogo025. Escolher025 depois do corte não protege uma falha durante019→025. Além disso, o Windows apresentou um erro stdinEOF no processo original de listagem, antes de seus EOFs/terminais. São duas fronteiras independentes: seleção explícita de release e observação do transporte.

O incremento acrescenta um pack019 fechado e seu adapter, preservando o default025. Acrescenta também um controle nativo público Windows, com dados sintéticos, sem perfil/archive real, rede de banco, Supabase ou módulos de backup. Nenhum desses resultados sozinho qualifica um backup ou autoriza importá-lo.

## Pack019

- `restore-release-pack-019.mjs` contém apenas metadados frozen: fonte c46, árvore e19 pins canônicos. Sem I/O, seleção por ledger, SQL/path do caller ou fallback.
- `supabase/release-packs/019/release-catalog.sql` é o blob histórico `d04e3f7face7b9eb5764d1b0ac41ea9764f4e5d5`,23271 bytes/SHA256 `06b61763ec27661000b01f9a34add2a1e1634d8cbd861d16c5c670894ba5d73c`. Mantém BEGIN readonly/ROLLBACK. Fica fora do inventário estrito das asserções atuais; não se afrouxa o gerador SQL Editor nem se executa019 no loader025.
- `MANAGED_VALIDATION_019` liga o manifesto ao SQL interno. Conserva o CTE histórico22598 caracteres e o prefixo atual186/sufixo FK+envelope4656 caracteres. O SQL muda replication role para origin e confere catálogo/FKs antes do COMMIT do consumer; não controla a transação.
- `checkManagedBeforeCommit019` e `createManagedRestoreAdapters019` são exports explícitos sobre o motor privado original. Consumer próprio, nonce, write pendente, quotas,45s e limpeza continuam exigidos. Os exports anteriores usam025. Caller não fornece SQL, caminho ou string de pack à factory.
- Uma guarda somente de metadados recusa os8 campos/6 helpers conhecidos de020–025 antes do CTE019. Sua ausência é precondição negativa, **não prova de origem ou igualdade de schema**. A2 ainda deve conferir definições, owners, ACLs, dependências, extras e histórias integralmente.

A fixture019 aplica somente os19 arquivos pinados em banco descartável em RAM, com infraestrutura Auth/Storage declarativa pública. Os11 testes preparados cobrem SQL real019, cruzamento019×025, cada fronteira posterior vazia, body/owner/ACL/RLS, FK órfã/FULL/SIMPLE e ator não-bypass, consumer estrangeiro, nonce/truncamento/EOF, callback/write pendente e preservação de arquivo estranho na limpeza. O loader025 e seus testes não foram alterados. Não confundir PGlite com PostgreSQL hospedado nem publicar uma contagem de checks ainda não observada.

## Controle público Windows

O [pacote e seus limites](../../tests/fixtures/public-windows-pg18/README.md) usa Node24.19 e pg_restore18.4 por bytes/hashes, mais29DLLs públicas selecionadas. Baixa arquivos oficiais no runner, verifica todos os30 arquivos antes de executar qualquer binário e não envia a instalação local. O digest do ZIP é identidade observada, não assinatura/checksum oficial EDB. Qualquer diferença recusa, sem repin ou fallback.

Dois inputs públicos83B/83B+8MiB percorrem o controlador original do probe. Ele aguarda callback, ambos EOFs, três closes de stdio e exit/close originais; erro stdin não causa kill antecipado. Mantém45s por caso/90s por lote, primeira falha, quotas e cleanup separados. Um caso inconclusivo impede outro spawn; o segundo aparece NOT_EXECUTED sem fatos inventados. OBSERVED significa somente observação finita, nunca restore aceito. Exit code0 ainda exige exit/close0 sem sinal nos dois casos.

O peer identificou e corrigiu antes da publicação duas lacunas: foto anterior a stdin.close/erro tardio e segundo produtor iniciado após cleanup não confirmado. Os novos controles negativos exercitam esses ramos. Não houve mudança nos três predicados EPIPE do coletor privado.

O workflow só permite a branch própria `codex/public-windows-pg18-20261022`, contents:read e checkout sem credenciais persistidas. Executa QA puro antes dos dois casos nativos e publica somente JSON pequeno, nunca binários. Nenhum perfil, segredo, archive privado, SQL de banco ou serviço pessoal é acessado. A branch tem deployfalse e nenhuma etapa aplica migrations.

## Evidência anterior e validação deste candidato

A inspeção única readonly de22/10, fonte operacional678 e leitor v2 revisado, autenticou o archive e observou `stdinCallback:EOF` sequência4, sem EOF/exit/close anteriores. O destino não foi consultado. Exit0/close0 posteriores aos pedidos de destroy/kill pertencem à fotografia de limpeza e não provam conclusão natural. Resultado sanitizado fechado2512B/SHA256 `2dee3f492eaf9f4aaa166d8334deece30c1141afe53ffdd0100ec8e8ef6f32b0`. Não reclassificar a captura anterior `other`.

Implementado/revisado estaticamente: pack, defaults, bytes históricos, seletor fechado, fixture/oráculos, controle público e guardas de publicação. Validação **pendente no SHA desta PR**: lint/tipos/camadas/segredos/SQL Editor,11 testes019, toda a suíte original025, protocolo/QA público e observação Windows. Os resultados678/431 não são herdados. A revisão não executou Node/npm/build/browser/PG ou testes na máquina de8GB; CI permanece remoto.

Continuam faltando: owner da aquisição nativa/A2 e receitas privadas de ator/privilégio/freshness; qualificação antes do mintA1, handoff/stream próprio; Storage-only vinculado ao commit e inventário/redownload; compatibilidade real PG18→17; ensaios Auth/Cofre/dados. Não existe atomicidade entre commitDB e Storage. Falha parcial/unknown impede continuação automática.

Não aplicar020–025 por CI/build/deploy. Origem pessoal rishenjoikgmfubmnfiu; alvo de restore autorizado somente Ensaio_restore jvwduowyavpaxssogadn. Não usar legado/VOE/BlackSheep nem reaplicar001–019. Nova cópia de backup exige janela humana fresca; esta inspeção do archive existente não criou backup novo. Aceites conectados/mobile e decisão do banco de homologação continuam separados deste pacote.

## Revisão dos originais e próximo candidato

Os18 originais da fonte `1ab2faa60ad3b1357b491abc151ab7e433614ecf` terminaram:14 SUCCESS e4 FAILURE. Os dois CI gerais falharam no mesmo teste negativo019, durante sua preparação com `permission denied to create role`/42501; build e E2E posteriores não rodaram. Os outros14 originais de serviços/QA tiveram sucesso com evidências próprias, sem promover esse resultado a aceite hospedado ou de restore. Os dois controles Windows recusaram no provisionamento, antes das QA e dos casos nativos; seu código genérico não prova uma causa específica.

A correção preparada do teste mantém seu negativo42501 real, RLS ativa, replication origin, ator diferente e recusa do framing. Os dois atores sintéticos são criados sob a identidade privilegiada original antes da troca de sessão. A restauração usa explicitamente a identidade capturada e compara usuário de sessão, usuário corrente e privilégio antes/depois. Essa é a convenção já documentada em `restore-custom-ddl-probe.test.mjs`: PGlite não possui o backend de autenticação que permitiria confiar em RESET SESSION AUTHORIZATION nesse ensaio. Não se mudou SQL019, default025, migrations ou autoridade de produção.

O controle público V3 acrescenta projeção fechada de fase/motivo e coloca a QA PowerShell antes do provisionamento. A primeira falha é preservada antes da limpeza, sem mensagens de exceção livres; os validadores de download, todos os30 pins, o controlador Node, seus testes, o manifesto bruto e os prazos internos permanecem iguais. Ambos os incrementos receberam revisão estática independente, mas precisam de novos originais de CI no SHA que os contiver. Nenhum teste foi executado no notebook de8GB. Merge, produção, aplicação de migrations e restore continuam bloqueados por seus próprios aceites.
