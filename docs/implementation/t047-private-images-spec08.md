# T-047 / #72 — imagens privadas, avatar, Início e Projetos

Refs #72. Part of #71. Base: `ffc47c40629560ade9b39dfdfa91cf37641b9ae6` (pacote SPEC-08 aprovado). Início autorizado pelo mantenedor em 21/10/2026; esta entrega não reescreve a origem documental do planejamento. Branch de autoria: `codex/spec08-media-20261021`.

## Implementado

O pipeline existente de reserva, Storage privado, verificação/reprocessamento e finalização recebe quatro finalidades fechadas: `project_cover` → Projetos, `habit_image` → Hábitos, `finance_goal_image` → Financeiro e `home_focus_image` → Início. Avatar permanece na autoridade de Configurações. Cada finalidade usa seu próprio Entitlement; ocultar um módulo não concede direito, e Drive não autoriza imagens de outros módulos. Os consumidores de Hábitos e Metas pertencem às respectivas fatias.

O contrato de vínculo v1 atende apenas capa de Projeto e fundo do Início: `version`, `purpose`, `entity_id`, `file_id`, `expected_file_id`, `client_id`. Ator e sessão vêm do servidor. O vínculo aceita remoção com `file_id:null`, exige CAS com o vínculo anterior, arquivo finalizado da mesma conta/finalidade, reserva reconhecida, PNG/JPEG processado de até 8 MiB e 24 milhões de pixels. MIME declarado no navegador é apenas triagem: o pipeline existente inspeciona e reprocessa bytes, remove metadados e continua sendo a autoridade. Não se aceitam URL externa, segredo, bucket ou feature arbitrária no DTO.

`file.entity-image.set` conserva intenção, identificador e recibo no diário existente. SQL verifica autoridade antes de replay, rejeita reutilização do identificador com outra intenção e grava domínio, evento e recibo na mesma transação. ACK inválido, incompleto ou com arquivo diferente permanece incerto no servidor e no cliente; retry preserva o JSON original. UUIDs válidos são comparados na forma canônica, sem substituir o corpo conservado no diário. Upload já reservado é reutilizado para confirmar finalização; o sucesso dos dados do Projeto seguido por falha da capa é explicado e não cria outro Projeto no retry.

O avatar superior aprovado abre `/configuracoes#perfil`, com alvo de 44px e anel de foco. Topo e rodapé usam o mesmo componente e arquivo privado; falhas têm fallback de inicial. O popover do rodapé existente é preservado. Não se inventa retrato Google ou foto de conta demonstrativa.

Início reúne foco e ritmo do dia no banner e acrescenta até três Projetos reais em ordem de posição/id. As contagens usam as tarefas existentes, sem status ou progresso fictício. No mobile há composição própria do resumo e faixa horizontal de Projetos. Capas aparecem nos cards e no hero do Projeto. Escolha, prévia local, salvar, cancelar, desfazer e remoção estão disponíveis no editor; o fundo do Início também é descoberto em Configurações → Aparência, mesmo com Tarefas ocultas. Leitura autenticada usa `/api/files/read`; erros de imagem voltam a um estado neutro.

## Migration e integração reservada à Root

Nova migration local, criada por `supabase migration new`: `20261021045700_spec08_private_entity_images.sql`. Não foi aplicada em banco remoto nem descartável nesta autoria. Migrations 001–019 permanecem intactas.

Ela acrescenta `projects.cover_file_id` e `user_preferences.home_focus_file_id`, FKs compostas por usuário, finalidades fechadas e RPCs service-only `file_entity_image_get(uuid,uuid,text,uuid)` / `file_entity_image_set(uuid,uuid,jsonb)`, com gêmeas privadas e `search_path` fechado. As capas legadas são opcionais; o validador anterior conserva seu OID e contrato. Snapshot antigo preparado antes da capa perde o CAS, e um snapshot novo preserva o campo opcional. Capturar/Tarefas também aceitam o novo campo opcional no snapshot compartilhado de Projetos.

O cleanup conserva a seleção justa, lock, rechecagem e ACK da migration 015. Referências de perfil, captura, Projeto (inclusive lixeira, para restaurar) e fundo do Início protegem o arquivo tanto na seleção de candidatos quanto na rechecagem sob lock. O preparo normaliza somente CRLF para LF antes de comparar a definição; drift aborta a migration para revisão. Nenhum job ou prazo novo foi habilitado.

Permanecem com a Root, antes de integração/publicação desta migration: reconciliar o catálogo fechado de RPCs/ACL, digest da policy `files_owner_read`, hash do corpo do cleanup, geração oficial de tipos em banco descartável e espelhos SQL Editor/restauração pelo gerador. O adapter mantém extensão tipada local para as duas novas RPCs; não altera o arquivo canônico de tipos 019. Não se afrouxa inventário para obter verde. O backup existente inclui schemas/tabelas e inventário dos buckets, mas isso não é prova de restore das novas imagens. Exportação permanece no contrato futuro existente; nenhuma API fictícia foi criada.

## Validação e limites

Revisão estática independente encontrou e corrigiu rejeição de snapshot compartilhado com capa, ACK de escrita malformado e mensagem que afirmava preservação em resultado incerto. `git diff --check` passou no delta de autoria. Este documento não transfere nenhum PASS de outro SHA.

Os testes abaixo foram escritos/ampliados, mas **não executados localmente**, porque a RAM permaneceu abaixo de 1 GiB. Instalação, Vitest, SQL, lint, TypeScript, build e navegador ficam para CI ou lote supervisionado com recursos disponíveis. Comandos focais propostos, separados:

```sh
npx vitest run tests/core/entity-images.test.ts tests/adapters/entity-images-runtime.test.ts tests/adapters/files-route.test.ts tests/adapters/capture-task-gateway.test.ts tests/features/domain-command-journal.test.ts --maxWorkers=1
node --test --test-concurrency=1 tests/scripts/spec08-private-entity-images-sql.test.mjs
node docs/planejamento/17-evolucao-prototipo/scripts/verify-package.mjs
npm run typecheck
npm run check:layers
npm run check:design-system
npm run check:sql-editor
node scripts/check-secrets.mjs
```

O teste SQL é exclusivamente descartável, com usuários/sessões/metadados sintéticos e rollback. Exercita as quatro finalidades, vínculo de outro usuário/finalidade, CAS, replay/evento único, downgrade de snapshot, cleanup e veto posterior; não envia bytes a Storage nem cria conta real. As negativas HTTP cobrem visitante, troca de conta, troca obrigatória de senha, veto por finalidade, origem e injeção de proprietário/versão. O teste de diário cobre ACK divergente e UUID canônico com conservação da intenção.

Impeccable critique/audit e a revisão estática do protótipo orientaram o delta, preservando DS 2.1/Geist, temas e composição aprovada. A avaliação visual posterior, detector, contraste medido, teclado e capturas de produto **ainda estão pendentes**. Capturas do protótipo não são evidência do produto. Não há aceite conectado, CI verde ou deploy declarado nesta autoria.

Revisão estática posterior ao primeiro congelamento corrigiu a herança do número no resumo móvel, a faixa tablet com dois cards e terceiro em linha completa, alturas móveis da capa (196/160px), a edição do Nome após salvamento parcial e o fallback de prévia quebrada. Essa rodada usou o mesmo avaliador da primeira; não é a avaliação B isolada com detector/browser exigida para aceite.

## Roteiro exato de prova da Root

1. Em ambiente descartável sem dados pessoais, aplicar a cadeia revisada, executar os testes SQL e catálogo, gerar tipos/espelhos e conferir ACL/RLS A/B, atomicidade e preservação de clientes antigos. O destino pessoal exige OP-009 supervisionada separadamente.
2. Em duas identidades autorizadas, testar avatar e fundo/capa de Projeto com PNG/JPEG e entrada WebP/GIF processada: escolher, cancelar, salvar, recarregar, trocar, remover, corrompida e ausente. Confirmar ausência de URL pública/metadados e isolamento A/B; uma preferência ou imagem não libera um veto comercial. Negar novas leituras/emissões depois do veto; URLs já emitidas conservam a validade curta existente (60s), sem promessa de revogação instantânea.
3. Induzir falha antes/depois de reserva, perda da resposta de finalização e perda do ACK do vínculo. Repetir o mesmo envio e comprovar um vínculo/evento/recibo, sem segundo Projeto. Confirmar que seleção incompleta não aparece como capa salva e que duas abas com CAS antigo não sobrescrevem a capa.
4. Conferir J1/J2/J11/J12 em 320/390/768/1024/1440px, claro/escuro/Sistema, sidebar expandida/recolhida, zoom 200%, reduced-motion e teclado: foco restaurado, alvo 44px, campos 16px, sem overflow e contraste sobre foto medido. Incluir Projetos/Tarefas ocultos ou vetados, zero/1/3/4 Projetos e lixeira/restauração.
5. Vincular cada log/captura ao SHA executado e ambiente; só então atualizar validado/pendente. #53 comercial ainda é contrato aditivo até integração autorizada de #54; este lote não declara sua prova conectada.

## Próximos limites

Esta é uma fatia revisável, não o fechamento de #72/#71. Após revisão do contrato de imagem, os consumidores #76/#79 podem avançar com suas próprias regras/receipts sob o mesmo lock de domínio. Integração de #74 inclui sua opção Lista nas Configurações e seu guard de participantes no cliente; não fazem parte deste commit. Gate legal/comercial, #44/#68, migrations remotas, merge e deploy são coordenados pela Root. Na autoria não há servidor, navegador, PostgreSQL ou outro processo pesado ativo; slot local livre.

## Correção parcial de retry — 21/10/2026

Branch `codex/spec08-image-retry-20261021`, filha da fonte congelada `5b11f4f12c8e628e4b30a8c85284849c05d9ebab`. A fonte e seus dois patches anteriores permanecem preservados. Este delta não altera migration, baseline de tipos, catálogos, mirrors, SQL Editor, loaders, inventários ou workflows. Nenhum teste/runtime local foi executado; somente revisão de fonte e Git. A execução dos testes fica exclusivamente no GitHub, no SHA integrado pela Root.

**Implementado neste delta:** falha ou ausência de dados na leitura de staging, durante finalização de `project_cover`/`home_focus_image`, conserva `FilesCommitUnknown`. Ela não retorna `VALIDATION` como prova de recusa definitiva: o journal considera essa resposta definitiva inclusive após uma tentativa incerta. O contrato dos consumidores existentes de Captura/Avatar/Drive não muda. Isso é preservação conservadora da intenção; não prova ausência dos bytes nem implementa sua recuperação.

O teste SQL de late-link agora cria uma segunda `project_cover` finalizada/antiga, comprova vínculo e desvínculo com a mesma finalidade, confere seleção pelo cleanup e exclusão lógica, emite ACK **sintético SQL** e comprova `purged_at`. A tentativa tardia usa owner/finalidade/CAS corretos e precisa falhar com `23514`, sem novo evento/recibo nem troca da capa protegida. O ACK deste teste não prova remoção de bytes no Storage. A imagem de Hábito deixa de ser o controle de purge, pois antes falhava pela finalidade independentemente da inatividade.

**Pendente e bloqueando o aceite do retry:** os dois editores da fonte original ainda confundem reserva com PUT reconhecido e permitem perder IDs ao trocar/desfazer/fechar depois de erro. Não considerar esse P2 corrigido por este delta. A tentativa compartilhada, suas guardas e os 12 grupos de testes propostos precisam do contrato de observação abaixo; nenhum cliente deve reenviar bytes ou mudar IDs para contornar incerteza. Finalize e binding pendentes continuam sendo resolvidos pelo comando original/journal; uma leitura não liquida pending/receipt.

**Limite observado:** `file_upload_status` (migration011) retorna somente `{status,file}`. O guard interno valida ator/sessão/finalidade real, mas o retorno não permite ao observador conferir finalidade solicitada, expiração e lease. `file_upload_reserve` e `file_upload_claim` retornam reserva completa, mas escrevem estado, portanto não serão utilizadas como sondas somente leitura. Antes da recuperação completa, a Root precisa reservar um contrato aditivo de leitura que forneça os dados suficientes e mantenha autoridade atual antes do resultado; schema e integração continuam reservados à Root. Não se inventou RPC, campo ou lease neste delta.

**Pesquisa documental, sem prova conectada:** lockfile fixa `@supabase/storage-js`/`supabase-js` em `2.117.2`. Na [tag oficial do SDK](https://github.com/supabase/supabase-js/blob/v2.117.2/packages/core/storage-js/src/lib/common/errors.ts), `StorageApiError.code` representa o código do serviço; o [parser fixado](https://github.com/supabase/supabase-js/blob/v2.117.2/packages/core/storage-js/src/lib/common/fetch.ts) permite que `statusCode` contenha o próprio código, não apenas HTTP. [`info()` faz GET; `exists()` usa HEAD](https://github.com/supabase/supabase-js/blob/v2.117.2/packages/core/storage-js/src/packages/StorageFileApi.ts) e o booleano de ausência não distingue erro400/404. A [lista oficial](https://supabase.com/docs/guides/storage/debugging/error-codes) distingue `NoSuchKey` de `NoSuchBucket` e alerta para visibilidade/permissão. RECOMENDADO para o futuro observador: default `indeterminate`; só uma consulta nova pelo cliente privilegiado isolado, após validar reserva/autoridade, com `StorageApiError`, HTTP404 e `code === "NoSuchKey"`, poderia produzir ausência pontual. 404/503 genérico, `not_found`, erro sem código e falha de rede nunca autorizam reenvio. Mesmo essa observação não prova ausência física/término de PUT anterior: o [servidor atual de info](https://github.com/supabase/storage/blob/master/src/http/routes/object/getObjectInfo.ts) consulta metadados do catálogo. A versão hospedada não foi conferida. Não há rota de observação implementada nem PASS documental transferido para runtime.

Lote adicional preparado: `tests/adapters/files-runtime.test.ts`, `tests/features/domain-command-journal.test.ts` (perda de ACK, Storage indisponível no retry e posterior confirmação com corpo idêntico) e `tests/scripts/spec08-private-entity-images-sql.test.mjs`. Executar no GitHub junto dos contratos/journal/catálogo pertinentes quando a integração coerente estiver pronta; os resultados anteriores de outras PRs não validam este delta.

## Complemento atual — observação e tentativa retomável

Depois da parcial `4c6a941c7f93b5c50305511e015d011439097323`, a Root congelou o contrato de observação em 21/10/2026 e autorizou expressamente **somente duas funções e suas ACLs na draft020 já existente**. O complemento abaixo substitui o estado de implementação pendente descrito na seção histórica da parcial; não substitui a necessidade de CI ou aceite. Fonte original, parcial e manifestos anteriores permanecem preservados. Um único editor trabalhou; a Root ficou em leitura/revisão.

### Contrato SQL aditivo, sem aplicação

`app_private/public.file_entity_image_upload_observe(uuid,uuid,uuid,text,text)` recebe `p_user,p_session,p_upload,p_kind,p_client_id`. O ID é o da **reserva original**, preservado sem trim/normalização, não um ID alternativo de finalize. A função privada é definer com search_path vazio; wrapper invoker, execução só service_role nos dois. Rejeita nulos, finalidade fora das quatro imagens e identificador vazio/maior que200; executa `file_guard` antes da busca exata por owner/upload/kind/client_id. Usuário/sessão/Entitlement são reconferidos em cada chamada.

Envelope exato: `{version:1,user_id,upload_id,kind,status,observed_at,expires_at,processing,file}`. O relógio é capturado uma vez no servidor depois do guard e da reserva. Reserved com lease/file_id e processing sem lease estruturalmente válida ou com file_id falham fechados. Lease vencida conserva status processing; processing:false não prova worker parado. Final válido/ativo pode ser observado depois do vencimento da reserva; removido/purgado/incompatível não autoriza rePUT. Payload final fica limitado aos campos de Arquivo; nenhum path, lease, token ou URL é retornado.

É leitura de domínio com locks Auth/advisory/linha, volatilidade padrão compatível com relógio: **não** STABLE nem promessa de transação READ ONLY. Não faz DML, replay, receipt, evento, renovação, reserve/claim/release ou cleanup. `file_upload_status` e migrations001–019 continuam intactos. Sem coluna ou migration adicional. A extensão TypeScript local do adapter é estreita e explicitamente não gerada; baseline oficial, catálogo, mirrors, SQL Editor, cadeia e inventários ainda são integração exclusiva da Root.

### Canal e observação do Storage

GET `/api/files/uploads/observe` exige cookie/sessão do servidor, X-Expected-User-ID e query exata `version=1,purpose,upload,client_id`, sem duplicatas/chaves extras. Só atende project_cover/home_focus_image; o suporte SQL às outras duas finalidades não ativa consumidores futuros. O adapter usa cliente privilegiado novo/isolado e origem Storage resolvida pelo servidor. A RPC só tem ACL service_role; a sessão do navegador nunca é injetada no cliente Storage.

Resposta web fechada: `{version:1,user_id,upload_id,purpose,state,file}`. `state` é final/staging/missing-observed/indeterminate; file só existe em final. Bucket/path são construídos no servidor. Antes de consultar a chave, `getBucket` precisa confirmar id/nome exatos e public:false. `info` precisa retornar name igual à chave owner/upload e bucketId correto; o UUID interno do objeto Storage não é o uploadId. Só a instância oficial `StorageApiError` com HTTP404 e code NoSuchKey permite ausência **pontual**. statusCode isolado, NoSuchBucket, not_found, 403/503, erro sem código, exceção e namespace inconsistente ficam indeterminados. Depois do IO, uma segunda RPC reconfere autoridade/estado/expiração; finalização concorrente prevalece, e processing continua indeterminado mesmo com lease vencida. Não há renovação nem PUT pela consulta.

Essa qualificação usa o SDK fixado2.117.2 e o cliente privilegiado existente; não foi homologada no serviço hospedado. NoSuchKey/presença de metadados não prova bytes físicos, término de PUT anterior ou receipt. A observação nunca liquida o journal.

### Tentativa em memória e interface

`EntityImageAttempt` é compartilhada por EntityImageEditor e ProjectEditor; captura o mesmo File, dono, finalidade e IDs de reserva/finalize e binding. O uploadFile legado permanece intocado. Reserva sem ACK repete o mesmo body/ID. O começo do PUT é registrado antes de fetch; nenhum ID reservado é tratado como prova de bytes. PUT reconhecido não se repete. PUT recusado/incerto exige observação em cada retry explícito, inclusive depois de falha na renovação da capability. Presença/final observado conduz ao finalize original; ausência pontual permite somente o mesmo File/path/ID com URL novamente validada e x-upsert:false. Duplicata/PUT tardio voltam à observação em outra ação explícita, sem overwrite, loop ou ID novo.

Finalize ou binding incerto é retomado **primeiro pelo mesmo comando/journal/input/client_id**. A leitura não fornece atalho de sucesso. O binding retém seu CAS original mesmo que a prop de imagem atual mude; mudança de entidade é recusada. IDs não são descartados por escolher/remover/desfazer/fechar/cancelar enquanto houver incerteza. Os controles explicam a preservação na tela e a ausência de retomada do File após reload. Resposta definitiva reconhecida pelo journal permite descarte explícito. O Projeto já salvo conserva row/fields/receipt; nem ACK perdido de create nem falha posterior de capa cria outro Projeto no retry. Nome/descrição também ficam protegidos durante intenção pendente.

Um controle nativo compartilhado EntityImagePicker usa label/ID, hint associado e classes DS existentes; o Field compartilhado não foi ampliado para aceitar file (seu contrato é de texto). Geist, tokens, claro/escuro/sistema e CSS/composição das superfícies foram preservados. Nenhuma landing ou página legal foi editada. Leitura Impeccable/harden/craft e checklist React orientaram guardas/copy; isso não é avaliação visual executada, detector, medição de contraste ou avaliação B.

### Doze grupos preparados, sem PASS nesta autoria

| Grupo | Prova preparada |
|---|---|
|1. Reserva/PUT/ACK em ordem | Unidade da tentativa nas duas finalidades; E2E dos dois editores originais observa ordem, credenciais e contagem |
|2. Reserva sem resposta | Retry body/ID idêntico; nenhum finalize prematuro; controles não descartam a tentativa |
|3. PUT recusado/ausência qualificada | Reobservação e envio explícito dos mesmos bytes/path/ID; reserva idempotente e x-upsert:false |
|4. PUT armazenado/ACK perdido | Staging observado conduz a finalize, sem segundo PUT |
|5. PUT antigo chega tarde | Duplicata conserva identidade e exige nova observação; falha na renovação não apaga a obrigação de observar |
|6. Storage/namespace/resposta incertos | Matriz SDK/bucket/owner/query/formato/timestamps; indeterminado nunca autoriza reenvio |
|7. Finalize com ACK perdido | Mesmo journal/body/ID; sem nova reserva/PUT/observação na frente do pending |
|8. Storage falha durante finalize | Adapter+teste do journal da parcial preservam pending até confirmação posterior |
|9. Binding/CAS com ACK perdido | Mesma intenção/ID/CAS; novo CAS da prop não substitui o original; guardas de seleção/cancelamento/Escape |
|10. Projeto salvo parcialmente | E2E de perda do ACK de create e do binding posterior; um efeito sintético por etapa, sem recriar o Projeto |
|11. Troca de conta/revogação/veto | Guarda entre etapas; HTTP e SQL recusam actor/sessão/finalidade; rechecagem após Storage |
|12. Pipeline anterior e integração SQL | Uploader legado intocado; SQL canônico testa quatro finalidades, ACL, clocks/leases, snapshots sem DML e final ativo depois de expiry |

Novos focais: `tests/features/entity-image-attempt.test.ts`, `tests/adapters/image-upload-observation-runtime.test.ts`, `tests/adapters/image-upload-observation-route.test.ts`, `tests/scripts/spec08-image-upload-observation-sql.test.mjs`, `tests/e2e/spec08-image-retry.spec.ts` e sua fixture de browser. O teste SQL de late-link anterior também recusa a capa tombstonada **antes** do ACK, além da recusa depois do purge, conservando owner/finalidade/CAS e invariantes de capa/eventos/receipts.

SQL usa PGlite descartável, migrations reais e metadados sintéticos; snapshots incluem reservas inteiras (expiry/lease/cleaned_at), arquivos, eventos, receipts e revisões. Não existe Storage/Auth HTTP nesse teste. O browser compila os editores/provider/journal originais e usa seams HTTP sintéticos com rede fechada a origens/path específicos; os efeitos idempotentes do servidor são simulados, não prova SQL/Storage/Auth ou concorrência conectada. Há13 cenários preparados:11 de retry e2 de cancelar/reabrir antes do envio. Sua cascata CSS explícita de fixture não substitui a cascata Next de produção nem a validação responsiva/temas/contraste.

**Estado atual:** implementação e testes preparados, revisão estática independente/diff-check; nenhum Node/npm/compilador/lint/build/browser/SQL local executado. Nenhum novo PASS de GitHub, push, banco hospedado, merge ou deploy. A Root deve integrar catálogo/tipos/mirrors/pacote/inventários e executar os lotes no SHA exato antes de declarar validado. A prova real, retenção/cleanup físico, aceites44/68 e fechamento72/71/76/79/81 permanecem separados.
