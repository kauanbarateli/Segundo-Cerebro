# T015 — preparação da persistência Capturar/Tarefas no CI local

Estado: **implementação do ensaio revisada localmente; ainda sem execução nativa própria aprovada**. O [Auth de `20378ef`](t014-auth-local-ci.md) conserva seu PASS anterior de login/logout/identidade/senha no agregado schema3; não executou este novo componente. A preparação amplia o caso `identity-data-api`, mantendo três cenários e passando o agregado a schema4. Não modifica telas, runtimes de produto, migrations ou banco hospedado.

O recorte apoia dois critérios originais da [issue #22](https://github.com/kauanbarateli/Segundo-Cerebro/issues/22), preservados no [doc 13 — T-015](../planejamento/13-tickets.md#t-015--capturar--tarefas-persistentes-troca-de-adapter--m2): contrato contra persistência real e conversão idempotente com `client_id` por usuário. É um subconjunto backend do contrato; não conclui a suíte completa de M1 nem “Capturar no celular e ver no desktop”, upload real ou erro RLS visível na tela. Mesmo os critérios backend exigem o resultado futuro da execução nativa própria antes de receber PASS.

## Caminho exercitado e oráculos

O [helper](../../tests/e2e-auth-local/capture-task-persistence-support.mjs) carrega a [entry fixa](../../tests/e2e-auth-local/capture-task-persistence.entry.ts) e os arquivos reais de Core, decoder, gateway e store. Rolldown usa a condição oficial `react-server` do pacote `server-only` 0.0.1; não substitui esse módulo nem cria alias de runtime. Um inventário fechado de 20 módulos e oito exports recusa imports externos/dinâmicos, paths desconhecidos ou aliases. O bundle permanece em Node/RAM, sem arquivo ou source map.

Os 11 estágios são `BASELINE`, `CREATE`, `UPDATE`, `CONVERT`, `CORE_REPLAY`, `RPC_REPLAY`, `TASK_DELETE`, `TASK_RESTORE`, `CAPTURE_DELETE`, `CAPTURE_RESTORE`, `FINAL`. O protocolo exige 12 checks e os seguintes totais exatos no PASS:

| Contagem planejada | Valor |
| --- | --- |
| HTTP / RPC / leituras públicas | 45 / 29 / 16 |
| Comandos Core / tentativas de commit | 8 / 9 |
| ACKs committed / replayed | 7 / 2 |
| Eventos / recibos próprios | 8 / 7 |

Há sete escritas legítimas: criar/editar/converter Captura, excluir/restaurar Tarefa e excluir/restaurar Captura. A conversão produz duas entidades vinculadas e dois eventos. O replay pelo Core usa o mesmo `client_id`, sem changes/events novos; o replay da RPC reenvia o batch original completo, com revisão anterior. Ambos precisam devolver `replayed`, conservar resultado/snapshot/revisão/cardinalidade e manter um único recibo. São ensaios explícitos de idempotência, sem retry automático; o store usa `maxAttempts:1`.

Após cada escrita, comparar os eventos completos e recibos persistidos por bijeção, incluindo dono, canal `web`, estados antes/depois e fingerprint/result. Leituras próprias devem recuperar a Captura/Tarefa exatas, conservando origem/conversão e vínculos na lixeira/restauração. Leituras estrangeiras vazias são acompanhadas de baselines próprios não vazios e leituras legítimas do dono. A ordenação de chaves JSONB não é usada como critério de igualdade.

## Autoridade e integração

O [spec de identidade](../../tests/e2e-auth-local/identity-data-api-local.spec.ts) reaproveita somente suas duas fixtures ordinárias A/B e três contextos. Antes deste componente, GUI, `getUser` com marcador próprio e `my_access_state` já verificaram as sessões; A e B continuam ativas, antes do logout global de A. O helper grava os dados de B; A consulta os IDs conhecidos de B como negativa estrangeira. Decodificar JWT confere binding/expiração, sem substituir verificação Auth.

A chave de servidor local fica numa closure Node e alcança somente quatro RPCs existentes de domínio: `capture_task_snapshot`, `capture_task_revision`, `capture_task_receipt`, `capture_task_commit`. Essas portas já são exclusivas de `service_role` e recebem dono/sessão B vinculados, verificados também pelo SQL. O helper não concede privilégios à fixture nem altera papel, Entitlement ou moderação. As leituras públicas usam publishable e JWT próprio de A/B. Não são chamadas à API Next nem ao factory pinado ao projeto pessoal.

O transporte é obrigatório, com API loopback fixa, redirect recusado, até 15 segundos incluindo leitura do corpo, limite de 1MiB e teto de 64 chamadas. A [configuração Playwright](../../playwright.auth-local.config.ts) passa ao processo Chromium somente sete nomes de ambiente do sistema: `PATH`, `LANG`, `LC_ALL`, `TZ`, `HOME`, `XDG_CONFIG_HOME`, `XDG_CACHE_HOME`. Chaves Auth/servidor permanecem em Node/Next; não são variáveis do processo Chromium. Isso não remove os cookies HttpOnly necessários ao fluxo Auth.

## Reports e limpeza

O [packet independente](../../tests/e2e-auth-local/capture-task-persistence-contract.mjs), schema1/`identity-data-api`, contém report próprio `capture-task-persistence` ou `null` para dependência não executada. Seu arquivo literal é `auth-local-ci-capture-task-report.json`, quarto arquivo do caso. O [writer](../../tests/e2e-auth-local/identity-data-api-report-writer.mjs) valida os quatro componentes antes do primeiro arquivo; aplica limite individual de 16KiB e escrita exclusiva 0600 num diretório canônico 0700. IO parcial, colisão, campo bruto, cenário cruzado ou getter/trap recusado permanece falha; arquivos anteriores não são sobrescritos.

Auth principal conserva schema3 e 12 estágios/11 checks; acrescenta somente `CAPTURE_TASK_PERSISTENCE` aos pontos de identidade, agora 35. Mínimo v1/31 pontos e senha v2/48 pontos permanecem separados. No agregado schema4, o caso de identidade tem nove campos: `scenario,status,code,report,namespace,identityRls,events,captureTask,captureTaskFixturesAbsent`. Os quatro componentes precisam de PASS próprio, sem escrita incerta, além de limpeza SDK e namespace naturais confirmados. Os outros dois casos mantêm cinco campos; a ordem permanece logout→identidade→senha.

Incerteza de commit é sticky, inclusive quando o store encontra depois um recibo compatível; essa releitura não libera a limpeza do ensaio. Antes da limpeza SDK, o spec captura o latch do helper e o combina por OR com Auth/RLS/eventos, depois descarta o helper. Incerteza impede certificar exclusões. Com resultado conhecido, a limpeza exige fixture/marcador exatos, revogação das sessões aplicáveis, ACK e ausência404 antes de contabilizar cada exclusão.

Somente depois dos quatro componentes completos, limpeza SDK e saída natural/remoção do namespace, o orquestrador executa uma consulta local **READ ONLY/ROLLBACK** sobre `auth.users` e dez relações: Capturas, Tarefas, Categorias, Projetos, capture_links, capture_file_links, links, domain_events, command_receipts e capture_task_revisions. A prova exige owner/banco `postgres`, PG17, Auth vazio e as dez relações vazias; só então `captureTaskFixturesAbsent=true`. A consulta não exclui dados e não resgata uma escrita incerta. Falha impede iniciar senha; provas anteriores permanecem separadas. Descarte da stack sozinho nunca concede PASS.

## Validação local e limites

A revisão independente executou consumidor, contrato e writer: **94 controles, 90 aprovados, zero falhas e quatro skips de filesystem POSIX no Windows**. Os controles incluem paridade com o produtor, tipos compile-only, reports cruzados/ausentes, latches, schemas preservados, campos extras recusados, perda de resposta e detecção de linhas em cada uma das dez relações. Docker/transporte são falsos; PGlite/PG18 verifica somente semântica SQL e é recusado pelo guard nativo PG17. Essa rodada não iniciou Supabase/Docker/Next neste host e não certifica os 45 HTTP reais planejados. O workflow prepara esses controles antes de iniciar a stack descartável; o aceite nativo precisa de SHA/run/status/report/limpeza próprios.

O recorte não prova API Next/factory, GUI de Capturar/Tarefas, journal/reload, mobile, uploads/Storage, concorrência entre transações, banco hospedado ou RLS de todos os módulos. A 017 manual e seu novo export oficial conservam pendência própria; não reaplicar 001–016 ou bootstrap. Traces, HAR, screenshots, vídeo e logs brutos continuam desligados. Tokens, chave de servidor, UUIDs, conteúdo, batches e respostas persistidas ficam em RAM; reports têm somente enums, booleans e contagens.
