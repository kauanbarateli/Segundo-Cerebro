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
