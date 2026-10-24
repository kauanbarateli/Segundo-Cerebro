# Pré-corte supervisionado de migrations 020–025 — 22/10/2026

Refs #35, #41, #42, #44, #75, #81 e PR #100. Este documento registra a preparação e a conferência readonly; **não registra aplicação das migrations nem aceite de restore**.

## Estado observado

- Candidato revisado: `3d86cd8f7e1e97e89990513237a8d4ef792b3249`, árvore `7566fe2ee28c2199ad07252a758072aa239ea247`.19/19 originais próprios aprovados, tentativa 1; ambos os CIs gerais tiveram 361/361 E2Es, sem casos instáveis.
- A produção publicada continua em `c46acea`; merge e deploy da PR #100 estão bloqueados por orientação do mantenedor.
- O MCP dedicado confirmou o endpoint pessoal `rishenjoikgmfubmnfiu` e PostgreSQL 17.11. O conector geral recusou permissão; isso não impediu as consultas pela conexão dedicada.
- O catálogo 019 extraído do commit c46, SHA256 `06b61763ec27661000b01f9a34add2a1e1634d8cbd861d16c5c670894ba5d73c`, passou integralmente em READ ONLY/ROLLBACK: **1.269 checks, zero desvios**.
- Os seis helpers e oito campos novos examinados estavam ausentes. Marcadores são triagem e não prova de instalação integral. Foram preservados somente nomes/hashes de 43 constraints, sem conteúdo de domínio.
- O histórico interno registra cinco migrations antigas. As aplicações manuais históricas não serão inventadas nesse ledger e 001–019 não serão reaplicadas.
- Os seis arquivos canônicos coincidem byte a byte, por SHA256, com suas cópias numeradas do SQL Editor. A [evidência de pré-corte](evidence/hosted-preflight019-before-cutover-20261022.json) conserva hashes, metadata e limites. Nenhum DDL foi executado.

## Bloqueio concreto de compatibilidade

A autorização atual permite a aplicação supervisionada, mas o estado do sistema exige primeiro preparar o corte:

1. **021:** o writer de Hábitos de c46 não envia `frequency_history` nem `image_file_id`. O novo `projects_habits_commit` valida o histórico inicial e o par de metadata; a criação antiga é recusada. Mudança de cadência também exige o histórico esperado.
2. **023:** `calendar_snapshot` passa a emitir `attendees` e `attendees_omitted`. O parser de c46 tem allowlist fechada sem essas chaves, recusando os eventos retornados. Não é preciso criar um novo evento para atingir essa incompatibilidade.
3. **022/025 e novos modelos:** documentos ricos, vínculos, imagens e históricos não podem ser descartados para tornar um leitor antigo compatível. Após novas escritas, c46 não é rollback seguro.

Portanto, **não aplicar a cadeia e reabrir a versão antiga normalmente**. Reordenar arquivos apenas desloca o problema. Cada arquivo tem sua própria transação; falha posterior não desfaz os commits anteriores.

Foi solicitada ao mantenedor uma exceção exclusivamente de homologação isolada, sem merge nem promoção em produção. Esse ambiente ainda não foi criado/autorizado nesta preparação. Banco isolado exige contrato próprio de origem, callbacks, atores e limpeza: trocar ENV ou reutilizar flags privadas do runner Admin não é suficiente.

## Ordem congelada e revisão

- **020** — `20261021045700_spec08_private_entity_images.sql`, 17601bytes, SHA256 `385dff57a2d81fe8b7ba92f6bc95d16d25ee09f7c85106fa5f40711a03dedde2`.
- **021** — `20261021144650_spec08_habit_frequency_history.sql`, 23511bytes, SHA256 `90156cf1069e2934b38160099156086ac4d60d0e349932d96565b35d3312083e`.
- **022** — `20261021171416_spec08_capture_document_write.sql`, 32167bytes, SHA256 `431e7521306951d403aba861541805b350cf30523d0e52b7634825852f961b38`.
- **023** — `20261022042432_spec08_calendar_participants.sql`, 46113bytes, SHA256 `b7a0a3f893e1cf5ac5f95c3fe36d46a234fa372c24104df9af9535f350326b8c`.
- **024** — `20261022042500_spec08_finance_card_metadata.sql`, 8565bytes, SHA256 `8406c90596d1b5679827f3aa61b3fd229f7c17bee5d4f9ae46753bfd3fddd51c`.
- **025** — `20261022042501_spec08_capture_knowledge_promotion.sql`, 44266bytes, SHA256 `40b1366a110de7ac614387af3930a2332f2603f7d50af7a7a0037d7da9115b07`.

020–022 já estão na main; 023–025 são novas na PR #100. Todas as seis permanecem pendentes de aplicação hospedada neste registro. O comentário histórico da021 sobre a reserva antiga de Calendar não altera a ordem canônica023 efetiva.

Todas têm `BEGIN/COMMIT` próprios, `lock_timeout=5s` e `statement_timeout=60s`. Não há reset, seeds, `DROP TABLE` ou `TRUNCATE` na instalação. Isso não elimina custos de locks:022 revalida CHECKs de recibos/eventos e024 acrescenta duas colunas geradas armazenadas, com possível materialização/reescrita. Falha ou locktimeout exige interromper e diagnosticar, sem retirar constraints ou ampliar prazos para obter PASS.

## Sequência operacional recomendada

1. **Recuperação antes do corte:** preservar o backup 019 verificado e qualificar uma recuperação desse estado. O catálogo atual 025 não certifica um backup 019; um backup 025 produzido depois não protege uma falha durante o corte. PACK019 é uma alternativa ainda não implementada; qualquer outra recuperação precisa de evidência própria.
2. **Homologação:** definir ambiente permitido e acessível, sem contratação implícita. Revisar isolamento, origem do banco/Storage, cookies, callbacks, contas comuns descartáveis A/B e limpeza antes de enviar credenciais ao destino autorizado. Segredos nunca em chat, issues, commits, artifacts ou logs.
3. **Janela fresca:** preparar a cerca e só então confirmar uma janela humana sem escritores: app, PWA/abas antigas, Admin, imports, API/SQL, uploads, limpeza, sincronização Google e operações em voo. `SC_BACKUP_QUIESCED=YES` é uma declaração, não uma cerca implementada. Não reutilizar confirmações de 12/10 ou 17/10.
4. **Aplicação supervisionada:** conferir endpoint pessoal, fonte/hash e estado imediatamente antes da escrita; aplicar cada SQL completo na ordem020→025, registrar resultado e parar no primeiro erro. Usar a conexão pessoal já autorizada; não CI/build/deploy nem projetos empresariais.
5. **Pós-condições:** conferir objetos, owners/grants, RLS, constraints e corpos pertinentes por migration. Após 025, executar o catálogo completo atual em READ ONLY/ROLLBACK e preservar qualquer desvio. A referência de 1.534 checks pertence aos runners; a contagem hospedada deve ser observada, não presumida. Não confundir geração de tipos preparada com export oficial hospedado.
6. **Restore:** criar e verificar separadamente a nova cópia apenas dentro da janela confirmada; qualificar baseline e destino antes de importar. O alvo autorizado é somente Ensaio_restore `jvwduowyavpaxssogadn`; reconferir vazio/ator/permissões. Não instalar a cadeia nele antes do restore, pois o dump contém o schema.
7. **Aceites conectados:** validar criação/reload independente, CAS, conflito/replay, isolamento A/B nas duas ordens, imagem privada por Storage HTTP, revogação e limpeza. Depois, percorrer UI em endereço HTTPS aprovado e dispositivos reais. Uma conta pessoal/master não é fixture.
8. **Reabertura:** só servir candidato compatível após os gates e decisão correspondente. Merge/deploy da PR #100 permanecem bloqueados até a conclusão das validações. Um commit de rollback não equivale a rollback de schema/dados.

## Restore: construção e prova ainda separadas

A2, A1, autorizador, streaming e adaptadores existem, mas a inspeção combinada continua `inspectionOnly:true/baselineQualified:false/restoreAccepted:false`. Falta compor fatos nativos vinculados→qualificação→mint único de snapshot→consumidor, no mesmo processo e no lifetime aprovado de 90 s. JSON de uma inspeção salva não pode virar capacidade numa operação posterior.

O consumidor gerenciado atual opera banco, não a composição completa com Storage. Upload/redownload existe no caminho full-clean separado, cujo ownership foi recusado historicamente. O comando existente `restore` continua chamando esse caminho; não o apresentar como uma CLI gerenciada já pronta.

Um backup novo025 pode evitar PACK019 **para o ensaio futuro025**, sem resolver recuperação pré-corte nem diferenças dos baselines Auth/Storage, propriedades/owners/ACLs/dependências. A importação de dump emitido por PG18 em servidor PG17 precisa de prova real; não é garantida pelo fornecedor e não será contornada removendo ownership, grants ou editando SQL. [Manual oficial PG18](https://www.postgresql.org/docs/18/app-pgdump.html).

O próximo avanço é um **preparo novo readonly** do transporte Windows, com fonte e leitor pinados, sem reabrir capturas CLOSED, sem reset e sem executar importação após mero PASS sintético. Origem, prazo45 s/ACL 15 s, autenticação integral, EOF/close originais e limpeza permanecem gates.

## Validação mobile sem deploy

Um lote adicional usa o WorkspaceShell real e SQL sintético no GitHub, com origem dos dados explícita, para verificar foco, hit-testing e oclusão em viewport. Ele não certifica Auth/Storage hospedados nem teclado/PWA físico no iPhone/A35.

Registrar SHA/árvore, navegador, viewport, tema, estado, hashes de imagens e limites. Foco/clique/rolagem devem ser reais, sem `force` nem rolagem corretiva escondida no oráculo. Captura full-page isolada não demonstra inacessibilidade permanente, e 361 testes anteriores não cobriam o editor móvel dentro do shell.

O aceite global #81 inclui ainda #78/#79 e contratação/onboarding; não será encerrado integralmente pela validação parcial deste candidato.

## Previsão de trabalho

Estimativa inicial16–24h, substituída após decompor a composição de recuperação faltante: **24–48 horas técnicas**, aproximadamente 3–6 dias de trabalho, dependente do ensaio nativo, divergências de baseline e disponibilidade humana. Não é previsão para checkout/onboarding nem para todas as novas funcionalidades ainda abertas.

Implementado/validado: revisão, catálogo019 readonly, metadata e integridade dos SQLs; fatia sintética Shell executada com limites registrados. Em22/10 o mantenedor autorizou somente deployment de homologação com banco pessoal isolado, mantendo merge/produção bloqueados. A seleção do ambiente, o contrato explícito de origem e suas credenciais ainda precisam de conferência. Em construção: correções mobile e transporte readonly Windows. Pendente: recuperação pré-corte, aplicação020–025 supervisionada, composição/ensaio gerenciado, Storage/Auth/Cofre e aceites conectados/físicos. Nenhum desses itens recebe aceite pelo sucesso dos runners.
