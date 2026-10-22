# Integrações validadas e catálogo pessoal — 21/10/2026

Refs #35, #41, #42, #43, #71, #81 e #96. Datas de execução em UTC; em Fortaleza os resultados iniciais ocorreram em 21/10.

[Evidência de metadados](evidence/release-main-e-catalogo-20261021.json), sem conteúdo pessoal ou segredos. As observações pertencem às consultas e à janela indicadas; não constituem monitoramento contínuo.

## Base incorporada

A PR #95 foi incorporada em `c46acea0c2cc81f82c083e2ae67a3c6480a2df1e`, preservando a árvore `5319afc5bab91727ae9d869cbfc456904a71e733` do head revisado `0bf6c77392a33ac21e9b212c9ca21902826d7e28`. Foram aprovados os 17 runs originais da branch e os oito originais da main, todos na tentativa 1. As falhas anteriores e o cancelamento original por orçamento global de job continuam registrados; não receberam PASS por repetição.

A correção reúne o transporte fixado dos binários do CI, o encerramento de APIs/handlers originais no Admin e a validação do ambiente real. O orçamento global do CI passou de 15 para 20 minutos após um cancelamento confirmado pelo runner; os prazos internos, retries e controles de quiescência foram preservados. As issues #43 e #96 foram encerradas com seus critérios próprios.

A PR #97 foi incorporada em `69b18e8f6858f0aa2394b980cde84bfebb6c5c97`, árvore `1a77d51731f6c934cd8085713dffd7eb7b4f5a39`. O head `5bda30ee4291ad6d5f53e6b6a7363afd613ea8ef` teve 16/16 originais aprovados, tentativa 1. Nos dois CIs: auditoria sem vulnerabilidades, 1.818 testes por fuso, 1.784 scripts e 294 E2Es. Os dois novos controles de contexto nominal/EPIPE passaram nominalmente e os 14 relatórios nativos tiveram origem e limpeza conferidas. Isso não comprova transporte nativo Windows ou restore real.

Os oito runs originais da main69 concluíram **success, tentativa 1**, com evidência própria. O [CI 39700479594](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39700479594) aprovou auditoria zero, 1.818 testes por fuso, 1.784 scripts e 294 E2Es; os dois controles focais de restore passaram nominalmente. Os sete relatórios nativos confirmaram origem e limpeza. Nenhum rerun ou cancelamento foi usado nesta rodada.

## Produção da aplicação

O deployment selecionado é `dpl_79iRhLzr6LmNQvGPkGJLts2aSHWe`, Production/READY, fonte main `c46acea`, na equipe/projeto pessoais conferidos. Foi construído sem mover os três aliases públicos, depois promovido pelo ID exato; os aliases foram reconferidos no destino selecionado.

Após a promoção, HTTP sem cookies e sem seguir redirects confirmou:

- `/conheca`, `/entrar`, `/privacidade` e `/termos-de-servico`: 200 e o identificador do build selecionado.
- `/api/calendar`: 401 JSON com código público `UNAUTHENTICATED`.
- Apex `segundocerebroapp.com.br/conheca`: 308 para `https://www.segundocerebroapp.com.br/conheca`.

A correção da PR97 não modifica `src/`, dependências ou migrations; ela não foi usada para alegar novo deploy ou jornada autenticada. Os aceites humanos anteriores de login, recuperação e leitura do Calendário em www permanecem ligados às suas próprias observações.

## Cron do Calendário

A execução manual única [39699210377](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39699210377), fonte c46, tentativa 1, concluiu em 22/10 às 00:22 UTC. O relatório fechado foi HTTP 200, complete=2, failed=0. O responsável confirmou duas entradas Agendada/Concluída no Admin.

Com a nova conexão pessoal, uma consulta READ ONLY/ROLLBACK confirmou exatamente duas linhas agregadas `channel=cron/status=complete` entre 00:21 e 00:23 UTC. Não foram lidos títulos, IDs, tokens ou conteúdo dos compromissos.

A variável `SC_GOOGLE_CALENDAR_SCHEDULER_ENABLED` foi reativada com readback após os dois aceites. Durante a integração posterior da PR97 foi novamente pausada, com ausência de runs ativos conferida, para acompanhar os originais da main. Depois dos oito resultados success, foi restabelecida em true e conferida em 22/10 às 00:46:46 UTC; workflow ativo, sem novo dispatch manual. O próximo disparo `schedule` original continua com observação própria pendente. Não houve cancelamento, retry automático ou nova automação de agente.

## Catálogo hospedado e histórico

A conexão `mcp__supabase_segundo_cerebro` confirmou a URL do projeto pessoal `rishenjoikgmfubmnfiu`. PostgreSQL 17.11; transação `transaction_read_only=on`; 35 tabelas públicas, todas com RLS habilitada. Nenhum DDL, seed, reset ou escrita de domínio foi realizado nesta reconferência.

A cópia byte a byte da asserção canônica019 teve SHA256 `06b61763ec27661000b01f9a34add2a1e1634d8cbd861d16c5c670894ba5d73c`. Executada integralmente em READ ONLY/ROLLBACK, retornou **ok=true, 1.269 checks e zero desvios**. Ela verifica o recorte de tabelas, políticas, grants, funções, corpos selecionados, triggers e buckets constantes descrito no SQL; não certifica comportamento completo, concorrência, conteúdo restaurado ou jornadas hospedadas.

O histórico interno lista somente cinco migrations antigas. Os demais arquivos tiveram aplicações manuais históricas: ausência no ledger não autoriza reaplicação, inserção artificial no histórico ou reset. A conferência de catálogo é distinta dessa listagem.

A triagem de metadados, SQL SHA256 `c9959df775dca00a1cb3db673b3bba279f02e11a92d6b057a044430180bfbde9`, encontrou os dois helpers019 com os corpos esperados; as três colunas e vinte funções candidatas020–022 examinadas estavam ausentes, assim como os dois triggers examinados. Esses marcadores são coerentes com candidatas ainda não instaladas, mas isoladamente não demonstram todos os bytes de uma migration.

O Advisor retornou 19 ocorrências INFO de RLS sem políticas em relações deliberadamente fechadas e um WARN de proteção contra senhas vazadas desabilitada. O catálogo confere os vetos de acesso dessas relações; não foram adicionadas políticas para silenciar o INFO. A [documentação oficial](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) informa que a proteção contra senhas vazadas exige Supabase Pro ou superior, plano distinto do Vercel Pro. O plano Supabase não foi confirmado nesta leitura; não houve contratação nem alteração da configuração Auth.

## Próxima cadeia de funcionalidades

A reconciliação preparada parte de `19e98489efe383846e79b06aed964301eb7e17ca`, que contém a cadeia autoral das PRs #91–94, e incorpora a main69. Produto, UI, SQL canônico, tipos e dependências dessa ponta permanecem preservados. CI, probes/pins e instruções recebem a reconciliação revisada, sem herdar PASS dos dois lados.

A nova branch precisa de guarda explícita de Preview e de todos os checks originais no novo SHA. O workflow focal adicional das branches antigas não dispara automaticamente na branch nova; sua ausência não é PASS, e os gates gerais/nativos originais continuam obrigatórios.

A cadeia contém as candidatas:

1. 020 — `20261021045700_spec08_private_entity_images.sql`.
2. 021 — `20261021144650_spec08_habit_frequency_history.sql`.
3. 022 — `20261021171416_spec08_capture_document_write.sql`.

Calendar `20261021050931_spec08_calendar_list_participants.sql` permanece fora desta cadeia. Sem fonte congelada, não se declara aplicação/ausência por substring. A issue #74 conserva a entrega; sua versão efetiva e ordem exigem coordenação própria, sem inserir silenciosamente uma versão anterior na cadeia homologada.

Antes de SQL/produção, revisar os artefatos do SHA final, a ordem e a compatibilidade. A021 recusa writers antigos mesmo sem novos registros; sua aplicação e a promoção do código compatível precisam de janela coordenada sem escritas. Após capas, imagens ou documentos ricos existirem, os leitores antigos também podem recusar novos payloads. O deployment c46 não é rollback seguro para esses modelos; não apagar dados, formatação ou histórico para fazer rollback passar.

CI/build/deploy não aplicam schema. A aplicação é supervisionada somente no projeto pessoal, em ordem e com registro de cada resultado; 001–019 não serão reaplicadas. Os aceites de persistência, isolamento, imagens/Storage, Hábitos e Capturas precisam ser demonstrados nos canais próprios após o corte. A borda documental atual não substitui o editor e a promoção rica ainda pendentes.

## Limites e continuidade

O lote seguinte incorpora, em commit próprio nesta reconciliação, o [observador passivo do SourceTOC original](ci-restore-source-toc-original-observer-20261021.md). Os três arquivos foram conferidos por bytes/hashes e revisão Root/independente antes do porte. A primeira recusa e o fim da limpeza têm fotografias separadas, com códigos/forma fechados e sequência limitada a 64; nenhum desses fatos concede autoridade ou altera o qualificador. Todos os 17 originais de d754549 concluíram success na tentativa 1 antes da publicação deste lote. Nos dois CIs: 2.310 testes por fuso, 1.803 scripts e 335 E2Es; os 14 relatórios nativos confirmaram 22 migrations/1.428 checks e seus controles de origem/limpeza. O novo SHA precisa de rodada original completa própria: o PASS de d754549 não certifica o código acrescentado. Não se executa uma nova inspeção real nesta integração.

O diagnóstico original do SourceTOC (#41), o qualificador/restore/rotina de backup (#42) e o aceite visual/humano (#44) continuam abertos. Nenhum preparo CLOSED, archive ou perfil privado foi reativado ou enviado ao GitHub por estas operações. Não houve runtime local na máquina de 8 GiB; execução dos checks ocorreu em runners descartáveis.

Cobrança/onboarding permanecem somente planejados nesta frente. Drive permanece retirado do MVP e #36 segue manutenção pós-MVP. A conexão pessoal recuperada não autoriza uso de BlackSheep, VOE ou legado.
