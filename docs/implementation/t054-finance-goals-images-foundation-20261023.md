# #79 / T-054 — fundação de imagens privadas de Metas, E1-A

**Implementado localmente; validação de execução pendente. SQL inerte. Sem UI, migração canônica, rollout ou encerramento da issue.** Base `fffa3782e38d0ee5d3f6d8f0b6016c3c11951805`; esta fatia segue o plano público E1 de SHA55539e74…023c454 e a autorização restrita Root de23/10. Fonte funcional: doc17/03,17–23 e44–48; J9/J11 de doc17/06; ADR0011. Drive permanece excluído.

## Implementado

A finalidade finance_goal_image já estava na migration020, nos buckets privados, no mapeamento para Entitlement financeiro e na reserva/finalização/observação SQL. Não foram criados bucket, finalidade, serviço, segredo, novo endpoint ou permissão Drive.

Cinco deltas TS separam `EntityImageUploadPurpose` (inclui Goal) de `EntityImagePurpose`/`decodeEntityImage` (setter genérico continua aceitando somente Project/Home/Habit). Observação de Goal usa o mesmo owner/session/clientId/purpose, feature financeiro, DTO fechado e reconferência após IO. Erros de download sem prova na finalização de Goal mantêm FilesCommitUnknown, igual às outras capas; Storage404/403/5xx/ausência não viram validação definitiva. O contrato histórico de Capturar permanece preservado.

O novo `proposals/finance-goals-images/01-binding-and-lifecycle.sql` aborta com DRAFT_ONLY e termina ROLLBACK. Seu conteúdo é uma única composição atômica proposta:

1. Gates exigem as bases privadas de Goals/Storage, RLS e ausência de grants API em Metas/helpers. Quatro pins de prosrc derivados do Git conferem o lookup null original, fg_project original, require_entity_image e holder final da023. A revisão Root acrescenta identidade da função, estado ativo, eventos completos, ausência de filtro/argumentos e ordem dos gatilhos, antes e depois da composição. O candidate/recheck/ACK de limpeza devem continuar chamando o holder compartilhado. Fonte desconhecida aborta.
2. Não faz backfill nem escrita de domínio durante instalação. Se houver Meta com referência antiga não nula, aborta para revisão explícita. A referência anterior não pode ser presumida válida só por parecer UUID.
3. Coluna image_file_id privada espelha o payload, com CHECK de igualdade, FK composta owner+file (deferrable, sem SETNULL) e índice parcial para lookup/limpeza. Trigger novo `goal_z_image_binding` roda depois de `goal_project`; não substitui nem altera o corpo histórico deste último. Validação/projeção/lock do dono antecedem a prova. Inserção/troca não nula exige prova real; metadata sem troca não inventa nova exigência de referência atual, conforme Core.
4. Copia o holder023 para helper privado pinado e acrescenta Meta própria, inclusive arquivada. Todos os holders anteriores, inclusive Habits/Knowledge/Capture/Avatar/Home/Project, permanecem na cadeia. Candidate/recheck/ACK usam a mesma função atualizada; fairness/expiry/lease/ACK existentes não são alterados.
5. Somente no mesmo bloco, após FK/projeção/holder, substitui fg_image por prova fechada: owner/id/purpose exatos, reserva própria finalizada e id/file_id iguais, arquivo não apagado/purgado, foldernull, MIME final PNG/JPEG, bytes1..8MiB, dimensões positivas e até24m pixels. Reusa require_entity_image e devolve só o GoalImage já aceito pelo Core. Helpers novos/alterados têm zero grants diretos inclusive service_role; nenhum wrapper público novo.

O lock é o existente `capture-task:<owner>`, usado por Finance, file_guard e limpeza. Commit financeiro revalida a imagem sob esse lock; snapshot remoto anterior não é autoridade suficiente. Imagem aceita antes da limpeza fica referenciada; limpeza que ganhou antes marca o arquivo e o vínculo tardio é negado. Corrida nativa real ainda precisa demonstrar os dois lados. O replay legítimo continua Auth-before-receipt e receipt-before-current-CAS/image pelo Core/oracle original, que não foi alterado.

Imagem é metadata: não altera ledger, reservas, liberações, saldos ou patrimônio. Finalize emite o evento/recibo de arquivo existentes; criação/edição da Meta emite seu evento financeiro e recibo na mesma transação. Remover imagem será patch explícito null pelo comando Meta, nunca file.entity-image.set. UI E1-B ainda não entregue.

## Testes escritos, não executados

- Core/observação: upload Goal permitido com DTO clonado e limites; setter genérico Goal continua recusado; finalidade errada, dono, arquivo inativo, dimensões/bytes, extras/duplicados/version2 e finalidade desconhecida negados. A única substituição de negativo é finance_goal_image na rota de observação, que ganha positivo explícito; unknown_image conserva a recusa.
- Adapter/rota: feature financeiro independente de Drive/Settings/Projects/Habits; veto bloqueia. Prova finalizada sem Storage/capacidade; proprietário trocado negado; IO incerto e revogação após IO continuam protegidos. O negativo existente de finalize sem bytes agora inclui Goal, preservando todos os formatos de falha anteriores.
- Helper novo confere SHA exato e remove barreiras somente em SQL-in-WASM descartável. Reutiliza o helper026 intacto:001–026 exatas → Budget → Series → Goals → E1-A. Nenhuma conexão/credencial/fallback HTTP e nenhuma alteração dos helpers históricos25/026 ou cinco SQL Goals.
- Nova suíte canônica Core→gateway/store→SQL: arquivo próprio finalizado, arquivo estrangeiro/wrong-purpose/reserved/purged/missing, FK/projeção/índice/grants, CAS, remoção sem mover dinheiro, replay depois de troca, clientId com corpo diferente, setter genérico negado, Meta arquivada protegida, holder Project preservado, candidate/ACK e vínculo tardio recusado, leitura estrangeira/veto, grants privados.
- Teste adicional Root injeta gatilho desativado, função substituída e cobertura parcial de eventos. A instalação deve recusar antes de criar coluna/helper ou alterar o holder; o banco descartável é fechado ao final. Execução ainda pendente no CI.
- Baseline material completo de Goals/reservas/liberações/destaque/arquivos/uploads/eventos/recibos/ledger/contas/revisões/ratelimit é comparado nas recusas e no replay. Há injeção focal de erro23514 no evento **depois** da projeção, exigindo rollback de efeito/FK/evento/recibo/revisão/rate-limit. Não se afirma rollback de todos os erros possíveis nem concorrência nativa.

Nenhum teste, parser, lint, typecheck, Node, Postgres, browser, rede ou serviço foi executado nesta autoria. Os testes acima são código escrito; ainda não são PASS. A leitura das skills Supabase/Postgres foi aplicada ao desenho de RLS, fonte/grants, FK/index e lock transacional. Atualização de documentação externa e consultas/advisors ficam para a validação permitida por Root; a restrição desta fatia proíbe rede/SQL.

## Gates e sequência de integração

Root deve revisar os13 paths e o manifesto, depois executar checks no SHA combinado. Comandos propostos: typecheck; lint focal max-warnings0; layers; secrets; suítes entity-images, observation-route/runtime e files-runtime; novo teste finance-goals-images-canonical-sql; regressões SPEC08 SQL de imagens/observação e Core/SQL de Goals. Testes SQL pesados devem usar GitHub/execução serial acordada, não competir pela RAM8GB.

Antes de transformar em migration: conferir source gates no candidato consolidado, catálogo de constraints/grants/triggers, 026/types oficiais, aplicação indivisível e rollback; numerar somente depois da fila real definida por Root. CI/build/deploy não aplicam schema. Não ativar fg_image sozinho nem copiar um holder histórico sobre023. Nenhuma aplicação remota está autorizada por este documento.

Pendentes de E1: consumidor fiel ao protótipo com picker/preview/cancelamento e mesma intenção; durabilidade protegida de upload versus journal financeiro/settlement; temas/mobile/teclado/foco/máscara; bytes reais/reencode/EXIF, quotas e Storage/RLS hospedados; duas conexões nativas bind versus cleanup; recuperação/export/backup/restore da referência e imagem. A leitura privada existente emite URL assinada de60s: um veto nega novas URLs, sem promessa de invalidar retroativamente as já entregues.

Nenhum dado privado, arquivo de ambiente, operador de restore, PIN operacional, flag, schema canônico, arquivo gerado, workflow, Vercel ou outro path Root foi alterado. Os cinco SQL Goals congelados e o Core financeiro original permanecem byte a byte na base.

## Revisão e composição Root

Os13 arquivos da autoria foram transportados por hashes para um checkout de revisão sobrebafc9f6, sem tocar no pacote congelado. O peer independente não encontrou bloqueador estático e recomendou conferir a identidade/ativação dos gatilhos; essa checagem foi acrescentada à proposta, junto do teste de instalação recusada. O hash fixado no helper acompanha o novo SQL integral.

Root conferiu os26 arquivos canônicos e os cinco SQL originais de Metas, todos preservados, e executou lint dos12 TypeScript desta composição com zero erros/avisos. Acrescentou capturas públicas da lista, editor e detalhe em320/390/1440px e claro/escuro ao teste existente. Os PNGs serão produzidos pelo CI; ainda não são evidência visual disponível nem aceite da integração hospedada. A branch recebeu sua própria guarda de deploy desligada, preservando as anteriores.

O detalhe também ganhou a saída Cancelar visível do protótipo, reutilizando o fechamento já protegido do Dialog. Fechar conserva qualquer intenção pendente no canal; não a encerra nem autoriza novo UUID. O teste de teclado/capturas passa a conferir retorno de foco e ausência de prepare/execute nesse fechamento. A capa e a coluna da foto continuam pendentes do consumidor E1-B; não são declaradas prontas por esse botão.

A reconferência da composição histórica encontrou um erro no reforço inicial do gate: `goal_project` também cobre DELETE para o cascade da identidade, logo seu tipo é31; o novo gatilho de imagem cobre INSERT/UPDATE e tem tipo23. A proposta e a restauração do teste agora exigem os tipos próprios, preservando DELETE e a ordem relativa para INSERT/UPDATE. O parecer estático anterior permanece no histórico, superado nesse ponto; a proposta ainda não havia sido publicada ou aplicada quando a diferença foi encontrada.

Não houve execução local de Vitest/SQL ou alteração de serviços por essa composição. A aprovação estática e o lint não substituem o CI próprio do SHA publicado. O gate terminal de Metas e o consumidor real de imagens permanecem entregas separadas. Merge e deploy de produção continuam bloqueados.

## Primeiro CI e correção do teste

O SHA ddd16aafcdfdc6aa043e2cb8c9a402b676eaa73c foi publicado na PR #119, em rascunho. Seus16 runs originais encerraram com14 aprovados e dois gerais recusados no Typecheck: quatro TS2339 na projeção do baseline do teste SQL. Os gerais não chegaram a executar unidades, SQL-in-WASM, build ou E2E; não há capturas de Metas desse SHA. Os dois Admin Browser aprovaram com o contrato de471 fontes. Não houve rerun, cancelamento ou skip.

A correção acrescenta somente a interface dos12 aliases como unknown e o parâmetro genérico de PGlite.query. O SQL, o baseline material, os asserts e os negativos permanecem byteiguais após retirar essa tipagem; um peer independente confirmou a reversão ao hash anterior. O lint focal passou com zero erros/avisos. Isso ainda não é Typecheck ou execução SQL aprovados: o novo commit precisa de seu próprio CI. A proposta de schema continua inerte.
