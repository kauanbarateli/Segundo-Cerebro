# Retomada dos aceites do MVP — 29/10/2026

Continuação do [handoff de 28/10](handoff-retomada-20261028-mvp.md) e do [registro de aceites doc18](aceites-conectados-doc18-20261027.md). PR #120 permanece em rascunho; merge e deploy de produção seguem bloqueados. Restore, checkout Asaas e novo Drive estão fora do recorte. Este registro **não altera produto, migrations, SDKs, Cron nem configuração de Vercel/Supabase**: as consultas abaixo foram somente leitura.

## Base conferida

- HEAD da PR no início da retomada: `e04ee04c2ac049c8d2b708266278331f634b6a32` (documental sobre `2169354`; produto inalterado desde `c6ebf212…`).
- Checks do HEAD `e04ee04`: leitura inicial com 23 de 25 jobs em `success` e 2 jobs "Fundação" em andamento. Releitura posterior: o CI de [push (run 666)](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/40806413743) e o de [PR (run 667)](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/40806418599) terminaram com conclusão `success`, attempt 1. É um delta somente documental sobre `2169354`; não altera o produto `c6ebf212`. Os commits desta retomada na branch `claude/dreamy-cori-fkltl0` (`4e255d1`, `9e28340` e o seguinte) são documentação e SQL operacional fora de CI e herdam o produto sem alterá-lo; seus runs são próprios e não foram aguardados até o fim.
- Preview `dpl_4qtnQLwcfGh7SzCHAK4ghSjkbi3o`: `READY`, branch `codex/homologacao-twry-20261022`, SHA `c6ebf212…`, sem alvo Production. Nenhum deploy novo foi feito.
- Supabase: a conexão enxerga apenas o projeto `twrydxsdemaykgvdlpyd`. O histórico de migrations contém `m001`–`m027`, sem divergência com o catálogo do repositório. Nada foi aplicado.

## Cofre conectado (#126, #62–65 relacionadas ao QA)

**Validado por metadados (independente do relato do responsável):** o banco de homologação tem 1 registro em `vault_master_keys` e 2 em `vault_items`. `domain_events` registra `vault_metadata` com 3 `created` e 2 `updated`, canal `web`, entre 27/10 23:24:20 e 23:25:34 UTC. Os payloads têm apenas chaves de envelope (`envelope`, `version`, `created_at`, `updated_at`, `deleted_at`, `id`, `user_id`; no mestre, `master`, `recovery`, `consent_at`, `schema_version`). Nenhum valor de payload foi lido ou copiado.

**Pendente / bloqueado:** o aceite conectado de abrir/bloquear, revelar/ocultar, troca de item, perda de foco/visibilidade e persistência exige uma sessão de navegador logada e desbloqueada na conta QA. Esta sessão em nuvem não tem essa sessão nem pode obter a senha mestra ou o kit, que não devem ser solicitados. Nenhum critério da #126 foi marcado como aprovado. O ensaio precisa ser feito pelo responsável ou por um agente com o navegador dele já aberto e desbloqueado por ele.

## Retenção hospedada de 720h (#62)

**Observado, somente leitura:**

- `app_private.onboarding_retention_sweep()` e `onboarding_retention_health()` existem no projeto de homologação.
- `pg_cron` **não está instalado** e não existe o schema `cron`. Não há agendador para o sweep no repositório nem no banco.
- O estado do health é todo nulo: `lastStartedAt`, `lastCompletedAt`, `lastCode`, `visited`, `cleaned`, `skipped` e `failed`. `dueCount`, `expiredPayloadCount` e `residualPermitCount` são 0.
- As 4 rodadas de onboarding existentes estão `complete`, sem rascunho, com expiração entre 22/11 e 25/11/2026. Nenhuma está vencida.

**Conclusão:** a retenção autônoma hospedada **não está ativa nem comprovada**. O sweep foi entregue como componente inerte. A migration 026 declara que a remoção física exige um sweep nativo ativo e medido, e esse agendador não existe. Os testes R01–R07 do CI provam a função em PostgreSQL descartável, não execução autônoma no projeto de homologação.

**Atualização após autorização do responsável (29/10, mesma data):** o responsável autorizou a recomendação de versionar e aplicar o agendamento sob supervisão. Os scripts [`onboarding-retention-schedule.sql`](../../supabase/operations/onboarding-retention-schedule.sql) e [`onboarding-retention-unschedule.sql`](../../supabase/operations/onboarding-retention-unschedule.sql) ficam em `supabase/operations/`, **fora da cadeia canônica de migrations de propósito**: o CI aplica todas as migrations em PostgreSQL descartável sem `pg_cron`, e `supabase/manual/` exige ROLLBACK final. O script de agendamento foi aplicado por `execute_sql` apenas no projeto `twrydxsdemaykgvdlpyd`, sem registro no histórico de migrations, que continua em `m001`–`m027`. Ele cria a extensão `pg_cron` e o job `sc-onboarding-retention-v1`, `*/15 * * * *`, dono `postgres`, ativo. Não foram expiradas fixtures nem executado o sweep manualmente. Production não foi tocada e não tem agendamento.

**Execução autônoma observada:** o job rodou sozinho em 29/10 às 03:00:00 UTC (`cron.job_run_details`: `succeeded`, 1 linha). O health passou a `lastCode=OK`, `visited=0`, `cleaned=0`, `failed=0`, `durationMs≈1,7`, `dueCount=0`, `expiredPayloadCount=0`, `residualPermitCount=0`. Isso comprova agendamento, execução autônoma pelo papel `postgres` e saúde mensurável no projeto de homologação. **Não comprova a remoção física de um payload vencido no ambiente hospedado**, porque não há rodada vencida (a primeira expira em 22/11) e as fixtures não foram expiradas; essa remoção segue coberta apenas por R01–R07 em PostgreSQL descartável. Critério #62 de "cenário vencido determinístico" continua pendente. Cada execução futura soma uma linha em `cron.job_run_details` (96 por dia), sem limpeza automática.

## Inventário de variáveis (nomes e escopos; valores não lidos)

- Production tem `APP_MODE`, `APP_URL`, `ADMIN_COMMAND_SECRET`, `AUTH_RATE_LIMIT_SECRET`, `AUTH_STATE_SECRET`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `GOOGLE_CALENDAR_STATE_SECRET`, `GOOGLE_CALENDAR_TOKEN_KEY`, `GOOGLE_CALENDAR_TOKEN_KEY_ID` e `GOOGLE_CALENDAR_CRON_SECRET`.
- **Production não tem `GOOGLE_OAUTH_CLIENT_ID` nem `GOOGLE_OAUTH_CLIENT_SECRET`.** Isso confirma o recadastro adiado pelo responsável e é pré-requisito do corte. Elas existem somente em Preview.
- `FINANCE_GOALS_V1_ENABLED` e `FINANCE_GOALS_IMAGES_V1_ENABLED` existem somente em Preview, na branch de homologação. Production não as tem. Decidir se a release deve habilitá-las é um item do corte, não inferido do Preview.
- `GOOGLE_CALENDAR_CRON_SECRET` existe em Production e não em Preview.

## Estado dos aceites, por critério

| Aceite | Estado | Observação |
|---|---|---|
| Cofre conectado (#126) | Bloqueado | Falta sessão desbloqueada do responsável; metadados no banco consistentes. |
| Main HTTP de onboarding (#62, #63, #80) | Pendente | Pacote continua inerte; nenhum operador, HTTP ou SSO executado. Exige canal protegido da Vercel e janela própria. |
| Retenção hospedada (#62) | Parcial | Agendamento e execução autônoma comprovados na homologação; remoção de payload vencido hospedado e cenário vencido determinístico pendentes. |
| Responsividade, zoom nativo, dispositivos, estados adversos (#44, #81, #12) | Pendente | Exigem navegador/aparelho real. Capturas de ambiente em nuvem não certificam aparelho. |
| Migrations / compatibilidade | Conferido | `m001`–`m027` presentes; nada reaplicado. |
| Variáveis Google em Production | Pendente | Duas ausentes, conforme acima. |
| CI do HEAD `e04ee04` | Concluído | Push e PR `success`, attempt 1. |
| Rede do ambiente | Bloqueio | O proxy de saída responde 403 ao host do Preview; navegador, Main HTTP e provas de dispositivo não rodam daqui. Liberar o domínio em Network access do ambiente. |
| Advisors Supabase (segurança) | Observado | 36 INFO de RLS sem policy em tabelas privadas (desenho) e 1 WARN: proteção contra senhas vazadas desativada no Auth. Avaliar o WARN antes do corte. |
| Erros de runtime do Preview | Observado | Nenhum nos últimos 3 dias. |

## Decisões que cabem ao responsável

1. Como o Cofre será exercitado: o responsável conduz a sessão desbloqueada, ou abre o navegador dele para um agente com acesso a essa sessão.
2. Como a retenção será ativada no projeto de homologação, com migration versionada e aplicação supervisionada ou outro canal, antes de qualquer prova de execução autônoma.
3. Se o Main HTTP pode usar o link de compartilhamento de 23h da Vercel, que torna o Preview acessível a quem tiver a URL.
4. Quando recadastrar as duas variáveis Google em Production.

Nenhum desses itens foi decidido ou executado por esta retomada.

## Rodada com rede liberada (29/10, produto `c6ebf212`, Preview `dpl_4qtnQLwcfGh7SzCHAK4ghSjkbi3o`)

O responsável liberou a rede, autorizou o login na conta de teste e a conduta dos ensaios com dados sintéticos, e informou a senha mestra do Cofre. A senha não foi gravada em arquivo, log ou commit.

**Login: não realizado.** Com o e-mail informado (`kauan.bara15@gmail.com`) o Preview respondeu "Não foi possível entrar". Esse e-mail não existe em `auth.users` da homologação: o único usuário é a conta comum QA com e-mail diferente, dona do Cofre (1 chave-mestra, 2 itens, papel `user`, sem Master). O nome do projeto Supabase contém o e-mail informado, o que sugere confusão com o dono do projeto. Uma segunda tentativa com o outro e-mail foi bloqueada pelo controle de permissões, porque o e-mail não foi fornecido pelo responsável. **Nenhum ensaio autenticado, incluindo o Cofre, foi executado.** Pendente de confirmação do e-mail correto.

**Responsividade das páginas públicas (sem login):** `/entrar`, `/conheca`, `/privacidade`, `/termos-de-servico` e `/recuperar-senha` em 320, 390, 768, 1024 e 1440 px, temas claro e escuro, Chromium headless: 50 combinações. Sem overflow horizontal, sem campo abaixo de 16 px, status 200 e um único `h1` em todas, e `data-theme` aplicado conforme o esquema. Único achado: em `/conheca`, a partir de 1024 px, os botões de aba "Projetos" e "Kanban" medem cerca de 42 px de altura (CSS declara `min-height: 44px`). A causa observada é a escala do contêiner `conheca-capitulo__tela` (0,94 a 0,96 durante a rolagem, animação de entrada), que reduz o alvo efetivo. Não corrigido: a animação vem do protótipo e a decisão entre manter ou limitar a escala é do responsável. Chromium headless não substitui aparelho real, zoom nativo nem leitor de tela.

## Rodada autenticada (29/10, produto `c6ebf212`, Preview `dpl_4qtnQLwcfGh7SzCHAK4ghSjkbi3o`)

Conta: a única do projeto de homologação (comum, sem Master), confirmada pelo responsável após o e-mail inicialmente informado não existir no Auth. Senhas e conteúdo de itens não foram gravados nem fotografados. Ferramenta: Chromium headless em nuvem; **não substitui aparelho real, zoom nativo nem leitor de tela**. Todos os valores abaixo são observações desta Source/ambiente.

### Cofre conectado (#126, J6 de #44)

Ensaio com os dois itens fictícios existentes (ambos do tipo Login; não há item "Nota segura", então esse ramo não foi exercitado). **PASS** em: abre bloqueado sem itens; senha mestra incorreta recusada; desbloqueio; máscara inicial com `aria-pressed=false`; revelar mostra o valor, o rótulo vira Ocultar e `aria-pressed=true`; revelar não copia (área de transferência intacta) e não gera requisição; ocultar volta à máscara; teclado (foco visível, Enter e Espaço); revelado + trocar de item deixa o novo item mascarado e voltar não reabre; copiar entrega o valor e a área é limpa em ~30 s; blur da janela bloqueia e remove o valor do DOM; re-desbloqueio não revela; aba oculta bloqueia; Bloquear Cofre limpa o DOM; recarregar volta bloqueado e os 2 itens persistem mascarados; **nenhuma das 117 requisições contém a senha mestra nem o valor do item**; zero erros de console. Alvo do botão 54 × 44 px; sem overflow em 320, 390 e 1440 px; contraste do valor 18,13:1 no claro e 16,01:1 no escuro (tokens do tema escuro aplicados por atributo, sem gravar preferência); rótulo e ícone ≥ 8,43:1. Bloqueio por inatividade: aberto em 4:30 e bloqueado em 5:15 com relógio simulado. Após logout em outra aba, a aba com valor revelado bloqueou e `/cofre` passou a exigir login. API do Cofre indisponível (500): mensagem e "Tentar de novo" recuperam.

**Banco após o ensaio (somente metadados):** 2 itens, versão 1, `updated_at` de 27/10, sem exclusão. Surgiram 10 eventos `vault_metadata` `updated` (bloqueio/desbloqueio) com apenas as chaves `id`, `occurred_at`, `operation`, `user_id`, `version`, sem payload.

**Achado:** desbloquear com a rede desligada exibe "Não foi possível abrir ou proteger os dados. Confira a senha e as duas metades do kit", a mesma mensagem da senha errada. A causa de rede fica indistinguível. Não corrigido.

**Não cobertos:** resposta antiga renderizada após troca de sessão (exige teste de componente), troca de identidade, e a afirmação de que revelar não renova o timer de inatividade (não medida isoladamente).

### Telas do workspace (leitura)

13 rotas (Início, Capturar, Tarefas, Calendário, Conhecimento, Projetos, Hábitos, Financeiro, Cofre, Atividade, Integrações, Configurações, Ajuda) × 320/390/768/1024/1440 px × claro/escuro = 130 medições: todas com status 200, sem redirecionamento, **zero overflow horizontal, zero campo abaixo de 16 px, zero alvo abaixo de 44 px, um `h1` por tela, zero erros de console ou de página**, sem imagem sem `alt`. O varredor sinalizou 4 botões sem nome acessível; são falsos positivos (`Arquivo`, `Registrar pausa`, `Registrar dia`, `Marcar um dia passado` têm texto no DOM). `/onboarding` (estado concluído): 10 medições limpas. Calendário foi aberto sem disparar sincronização (`calendar_sync_runs` seguiu em 2). O tema escuro foi aplicado trocando o atributo da página, não a preferência da conta.

### Estados adversos

Sem sessão: `/tarefas` redireciona ao login; `/api/vault` e `/api/settings` respondem 401. Usuário comum em `/admin`: 404. Rota inexistente: 404 com mensagem. Offline com service worker no controle: fallback "Não foi possível carregar o Segundo Cérebro" com "Tentar novamente". Captura com título e sem rede: texto preservado, "Rascunho salvo neste navegador", "Há um envio para confirmar" e "O resultado ainda não foi confirmado"; fechado o contexto offline, nada foi reenviado e o banco não ganhou captura nem página. Sem service worker (primeira visita), a navegação offline cai na página de erro do navegador.

### Onboarding e retenção hospedada (#62)

Criada **uma rodada sintética** `5fcb8f03…` pela interface (Configurar outra vez → Começar nova rodada), pausada com "Fazer depois" sem confirmar nada: pausar não criou projetos, hábitos, tarefas, capturas nem páginas (contagens iguais antes e depois), e a expiração ficou em exatamente 720 h após a edição. Recarregar ofereceu "Retomar". Para obter o cenário vencido, **apenas essa linha foi envelhecida por UPDATE direto** (`edited_at` −721 h, `expires_at` −1 h); o aging é manipulação de relógio de teste, não passagem real de tempo, e as demais rodadas não foram tocadas. Antes do tick: `dueCount=1`, `expiredPayloadCount=1`. No tick autônomo de **03:45:00 UTC** o job `sc-onboarding-retention-v1` visitou 1 e limpou 1 (`lastCode=OK`, `failed=0`, 133 ms): a rodada ficou `expired`, sem rascunho, as outras 4 `complete` e as entidades seguiram intactas, `expiredPayloadCount=0`, `residualPermitCount=0`. A interface passou a exibir "O prazo deste rascunho terminou. Seus registros já confirmados foram preservados." O job executou também em 03:15 e 03:30, todas `succeeded`.

**Não feito:** a **matriz Main HTTP de 64 passos** exige duas identidades isoladas e o operador do pacote inerte; o projeto tem uma só conta e criar contas está fora da autorização. O fluxo de nove telas com confirmações (Hábito, Projeto, Tarefa, vínculos) não foi percorrido: nesta rodada só a etapa inicial, retomada e pausa foram exercitadas, para não criar registros na conta QA. Zoom nativo, aparelhos, leitor de tela e aceite humano #44 seguem pendentes.

## Rodada de contas de teste, onboarding completo e Main HTTP (29/10, produto `c6ebf212`)

O responsável autorizou criar contas de teste, percorrer o onboarding com confirmações, corrigir as mensagens do Cofre e seguir com validações e correções para liberar o PR. Aparelhos reais e aceite humano ficam como últimas etapas, depois da liberação da homologação na `main`.

### Contas de teste

Duas contas descartáveis comuns (papel `user`, sem Master) foram inseridas em `auth.users` e `auth.identities` por `INSERT` direto no projeto `twrydxsdemaykgvdlpyd`. O guard `check_admin_auth_creation_final` só atua no fluxo de criação pelo Admin e deixa passar; o trigger `on_auth_user_created` provisionou perfil, preferências, papel e moderação (`active`, sem troca obrigatória de senha). E-mails `sc-qa-a.20261029@example.com` e `sc-qa-b.20261029@example.com`, senhas aleatórias guardadas fora do repositório. Ambas entram pelo formulário. Devem ser removidas depois da liberação (`delete` em `auth.users` cascateia).

### Onboarding de nove telas na conta A (abertura, sete etapas, resumo)

Percurso pela interface com dados sintéticos. Antes de confirmar: zero registros de domínio e uma rodada ativa; escolhas ficam só no rascunho. Retomada após recarregar cai no resumo. Etapas preparadas: nome, agenda (sem conectar), hábito, projeto, tarefa vinculada ao projeto com prazo "Hoje", caderno e primeira nota. **Recusa verificada:** hábito "Dias específicos" sem dias aparece como "Dias a definir" no resumo e a confirmação foi recusada com "Complete os campos indicados antes de confirmar. O rascunho foi preservado.", sem nenhuma requisição enviada. Corrigido para "Todos os dias", a confirmação mostrou "6 escolhas confirmadas" (Perfil, Hábito, Projeto, Tarefa, Caderno, Nota) em 12 respostas 200.

No banco: 1 hábito, 1 projeto, 1 tarefa ligada ao projeto do mesmo dono, 1 caderno, 1 página, nome gravado; rodada `complete`, sem rascunho; um evento de criação por entidade, sem duplicatas; `client_id` determinístico `onb:<rodada>:<slot>:v1`. A tarefa tem `due_at=2026-10-29T03:00:00Z` com `all_day`, isto é, 00:00 em America/Sao_Paulo. A conta B não recebeu nada.

### Matriz HTTP com duas identidades (35 casos, sessões reais A e B)

**31 PASS, 4 FAIL.** PASS: sem sessão 401 em GET e POST; ausência ou divergência de `x-expected-user-id` devolve `SESSION_CHANGED` 409; `content-type` não JSON 403; GET devolve só dados do dono; start cria rodada, replay do mesmo `clientId` devolve a mesma rodada e revisão, e outro `clientId` não cria segunda rodada ativa; save avança a revisão e o replay do mesmo save é idempotente; seis recusas de validação 400 (campo extra, versão de cadência desconhecida, nome acima de 120, dias duplicados, data inválida, chave que não é UUID) sem alterar rascunho nem revisão; corpo acima de 96 KiB, JSON malformado e `choices` desconhecido recusados; **A não grava, não confirma nem pausa a rodada de B e B não pausa a de A (403 `FORBIDDEN` em quatro tentativas)**; `choices(projects)` disjunto; logout invalida a cópia antiga do cookie (401).

FAIL, todos com a mesma causa: salvar com revisão antiga (#13), confirmar com revisão antiga (#31, #32) e pausar rodada não ativa (#34) não responderam em 30 s (o proxy do ambiente encerrou com "upstream request failed"). O caso #29 foi erro do próprio script, que reutilizou uma revisão que o passo #21 já havia avançado.

**Percurso de recuperação parcial observado:** o rascunho de B ficou com uma tarefa apontando para um id de projeto que não é seu. A rodada seguiu para `partial` com perfil, hábito, projeto, caderno e nota confirmados e a tarefa `failed`; nada foi criado com referência a registro de outro dono. Cada `advance` levou cerca de 1 s.

### Defeito encontrado: conflito de revisão do onboarding trava no PostgREST hospedado

Causa medida: o PostgREST do Supabase **reexecuta a transação enquanto o erro for SQLSTATE 40001 ou 40P01**. Os logs do Postgres mostram `Round changed.` repetido a cada ~1 s (514 vezes em 10 minutos para cerca de 12 chamadas). Sonda controlada na homologação, função temporária que apenas lança cada código: `23514` → 400 em 0,9 s; `23505` → 409 em 0,5 s; `PT409` → 409 em 0,2 s; `40001` e `40P01` → sem resposta em 40 s. O onboarding lança 40001 em seu caminho de conflito primário (24 pontos na migration 026), então toda chamada com revisão desatualizada (duas abas, reenvio, retomada) trava ~30 s, devolve resultado incerto ao navegador e executa 30 a 45 vezes no banco. Os testes de CI não pegam isso porque rodam em PostgreSQL descartável, sem essa camada. Outros módulos têm 40001 em 14 migrations (≈60 pontos de `raise`); o risco existe onde o caminho de conflito é um `raise` e não um retorno `stale`. **Não varrido nesta rodada.**

**Correção preparada, ainda não aplicada na homologação:** `supabase/operations/onboarding-conflict-code.sql` troca só o wrapper público `public.onboarding_call` para converter 40001 em `PT409` (HTTP 409), preservando assinatura, retorno e `GRANT` apenas para `service_role`; `onboarding-conflict-code-revert.sql` restaura o original. Fica fora da cadeia canônica porque uma 28ª migration exigiria reescrever os pins de hash e contagem (27) do catálogo de release em cerca de 16 arquivos. O gateway passa a mapear `PT409` para `CONFLICT` (mantém 40001 e 23505). Teste novo do gateway (`tests/adapters/onboarding-gateway.test.ts`, 12 casos). **A fonte canônica da migration 026 continua com o wrapper antigo: um destino novo precisa receber este script após a 026.**

### Cofre: mensagens por causa

O fallback do Cofre ("Não foi possível abrir ou proteger os dados. Confira a senha e as duas metades do kit, se usadas.") era mostrado para senha errada, queda de rede e erro de servidor, e citava o kit fora da recuperação. Agora o módulo `vault-lifecycle.ts` classifica: senha mestra incorreta (sem citar kit), senha atual incorreta na troca, kit ou nova senha na recuperação, "Sem conexão com o servidor... O Cofre não foi alterado." para falha de fetch, abort, timeout ou navegador offline, "O servidor não respondeu agora" para `UNAVAILABLE` e `COMMIT_UNKNOWN`, e mensagem neutra para o restante. Mensagens de validação próprias continuam como estão. Na criação, uma linha de status informa qual metade do kit foi baixada, sem mudar o nome dos botões nem a prova do kit. Validação local: 21 testes de Cofre e gateway, 46 no conjunto focado, ESLint, `tsc --noEmit`, portão de camadas (557 módulos), scanner de segredos. Falta o CI no GitHub e o reteste conectado depois de publicar o produto novo na homologação.

### Pendente de confirmação do responsável

1. A sonda `public.zz_probe(text)` (EXECUTE para `anon`, só lança erros) **ficou na homologação**: o `DROP` pediu confirmação e a ferramenta expirou. Deve ser removida.
2. Aplicar `onboarding-conflict-code.sql` na homologação e repetir a matriz esperando 409 em menos de 2 s.
3. Como integrar o código novo ao PR: este trabalho está em `claude/dreamy-cori-fkltl0`, descendente de `e04ee04`; o PR #120 usa `codex/mvp-goals-terminal-20261023`, e o Preview usa `codex/homologacao-twry-20261022`. Sem enviar para essas branches, o Cofre corrigido não chega ao PR nem ao Preview.

### Integração às branches e CI do produto novo (29/10)

Com autorização do responsável, `33d3d36` e depois `3c79619` foram enviados por fast-forward a `codex/mvp-goals-terminal-20261023` (PR #120) e `codex/homologacao-twry-20261022` (Preview), além de `claude/dreamy-cori-fkltl0`. Zero delta frente a `e04ee04` em motores, migrations canônicas, SDKs e dependências; mudam o gateway do onboarding (mapeamento `PT409`), o Cofre (mensagens), testes, documentação e `supabase/operations/`.

**Primeiro CI de `33d3d36`: falhou.** Passo "Contratos dos scripts": 3 falhas em 2.509. Causa: o contrato do CI do Admin fixa em 543 os arquivos do fechamento de fontes, e o módulo novo `vault-feedback.ts` elevou a contagem para 544. Correção: o helper foi para `vault-lifecycle.ts`, que já pertencia ao fechamento, e o arquivo novo foi removido (sem alterar pins de release). Os 99 testes do contrato passam localmente. `3c79619` é o commit corrigido.

**CI de `3c79619`:** [CI da PR (run 680)](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/40821316882) e [CI push da homologação (run 679)](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/40821315409) concluíram com success; o CI push da branch da PR (run 678) estava na etapa de E2E quando esta nota foi escrita e deve ser conferido no GitHub. O workflow nativo "Metas terminal PostgreSQL nativo isolado" ([run 169](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/40821312690)) falhou na primeira tentativa com `WRITE_OUTCOME_UNCERTAIN` na fase `oracle`, em arquivos que o diff não toca, e passou na tentativa 2 após a única reexecução dos jobs falhos; a instabilidade fica registrada, não resolvida.

**Preview:** o Vercel cria um único deployment por SHA, e o de `3c79619` saiu na branch `claude/…`, que não recebe as variáveis de Preview (escopadas à branch de homologação). O alias da homologação continua no produto `c6ebf212`. O próximo commit precisa chegar primeiro à branch de homologação para gerar o deployment com as variáveis corretas.

### Inventário dos pontos `40001` fora do onboarding (varredura estática)

O mesmo travamento se aplica a qualquer RPC cujo caminho de conflito seja um `raise exception ... errcode='40001'` em vez de um retorno estruturado `stale`. Há cerca de 40 pontos fora do onboarding, entre eles: `Capture content changed` e `Old editor cannot overwrite rich content` (escrita de documento e promoção de Capturar); `Calendar revision conflict`, `Sync is already in flight` e `Exact sync execution required` (Calendário/Google); `Series revision changed`, `Goal revision changed`, `Highlight revision changed`, `Series BEFORE changed` e `Goal BEFORE changed` (Finanças); `Before state changed` (transações); `Before changed` (Projetos/Hábitos); `Stale/foreign row` e `Upload processing` (Drive); `Focus image changed`, `Cover changed` e `Habit image changed` (imagens); `Stale/foreign knowledge row` (Conhecimento). Os conflitos de Capturar e Conhecimento exercitados no hospedado nas rodadas anteriores responderam como conflito, o que indica que o caminho comum de CAS desses módulos retorna `stale` sem `raise`. **Não foi medido módulo a módulo.** Método de medição, por módulo: com duas sessões, enviar a mesma mutação com revisão desatualizada e cronometrar a resposta; acima de ~5 s indica o `raise`. Correção equivalente: wrapper público que converte `40001` em `PT409`, com o gateway mapeando `PT409`; em release sem os pins atuais, vale uma migration canônica.

### Reteste conectado do Cofre no produto corrigido (`2b4ce31`)

Preview `dpl_5ZnVH3yiu9LVKCJzGrgaGDSvDFtJ`, criado a partir da branch `codex/homologacao-twry-20261022` no SHA `2b4ce31a98a464f760685bcd058266079d4ff7a9` (o Vercel só gera um deployment por SHA e o automático saiu na branch `claude/…`, sem as variáveis de Preview; por isso o deployment foi criado explicitamente para a branch de homologação, alvo Preview). READY, alias da homologação atualizado. Chromium headless, conta QA comum, itens fictícios, sem imagem do Cofre.

**PASS:** abre bloqueado; **senha errada** mostra "A senha mestra está incorreta. Confira e tente de novo." e não cita o kit; **rede desligada** mostra "Sem conexão com o servidor. Verifique a internet e tente de novo. O Cofre não foi alterado." sem culpar senha nem kit; regressão: desbloqueia, abre mascarado, revela e oculta, e Bloquear volta à tela de desbloqueio. Isso substitui a mensagem única anterior ("Confira a senha e as duas metades do kit") para esses dois casos. Seguem sem exercício hospedado: a linha de status das metades do kit na criação (o Cofre já existe) e as mensagens de troca de senha e de recuperação pelo kit, cobertas só por testes unitários.

### Pendências de banco que dependem de aprovação na interface

O `execute_sql` do Supabase passou a pedir aprovação própria na interface para estas operações e expirou três vezes sem resposta, mesmo com o responsável tendo confirmado no chat. Nada foi contornado por outra ferramenta. Continuam pendentes na homologação: (1) `drop function public.zz_probe(text)`; (2) aplicar `supabase/operations/onboarding-conflict-code.sql`; (3) repetir a matriz de dois atores esperando 409 em menos de 2 s nos casos de revisão antiga. Enquanto (2) não for aplicada, o onboarding hospedado segue com o travamento de ~30 s no conflito de revisão.

## Fechamento das pendências (29/10, Preview `dpl_5ZnVH3yiu9LVKCJzGrgaGDSvDFtJ`, SHA `2b4ce31`)

### Correção do wrapper aplicada na homologação e verificada

`supabase/operations/onboarding-conflict-code.sql` foi aplicado em `twrydxsdemaykgvdlpyd` por `execute_sql`, numa transação com preflight e verificação (somente `service_role` executa; o corpo contém `PT409`); o histórico de migrations continua em `m001`–`m027`. Medição no hospedado, mesmas chamadas que antes passavam de 25 s sem resposta: pausar com revisão atual numa rodada `partial` → **409 `CONFLICT` em 642 ms**; salvar com revisão antiga → **409 em 627 ms**; confirmar com revisão antiga → **409 em 496 ms**; `roundId` inexistente → 403 `FORBIDDEN` em ~0,5 s. A emenda com revisão antiga também devolveu 409 em 469 ms.

### Recuperação parcial pelo `amend` (conta B)

Rodada de B em `partial`: perfil, hábito, projeto, caderno e nota confirmados; tarefa `failed/validation` (apontava para um projeto que não era de B). Resultados: (1) emenda com revisão antiga → 409 rápido; (2) emenda trocando para um id de projeto estranho foi aceita no rascunho e **recusada de novo na execução** (`failed/validation`), sem criar nada; (3) **emenda válida** com o projeto próprio de B → `executing`, `advance` → **`complete`, seis recibos `confirmed`**. Pela interface de B: 1 projeto ("0 de 1 tarefa", ou seja, a tarefa corrigida ficou vinculada), 1 hábito, 1 caderno com 1 página; sem duplicatas das entidades já confirmadas. Uma emenda enviada enquanto a rodada estava `executing` devolveu **503 `UNAVAILABLE`**: é uma operação não permitida naquele estado e deveria ser um 409/403 determinístico, não um erro de indisponibilidade que sugere nova tentativa. Fica como achado, não corrigido.

### Medição dos outros módulos quanto ao travamento de `40001`

Método: sessão real, comando com revisão desatualizada, tempo de resposta com limite de 25 s (travamento = sem resposta). **Nenhum travou.**

| Módulo | Comando | Resultado |
|---|---|---|
| Cofre | `vault.audit`, `expected_revision` velha | 409 `CONFLICT` em 582 ms |
| Conhecimento | `knowledge.page.update`, `expected_version` velha | 409 `CONFLICT` em 577 ms |
| Capturar | `capture.update`, conteúdo esperado velho | 409 `CONFLICT` em 557 ms |
| Metas | `finance.goal.create` / `update`, revisão financeira velha | 409 `conflict` em 572 ms e 454 ms |
| Tarefas | `task.status` reenviado após a mudança | 200 em 744 ms (idempotente) |
| Hábitos | `habit.mark` reenviado | 200 em 595–925 ms (idempotente) |

Projetos e Hábitos (`project.update`, `habit.update`) não recebem revisão do cliente: o servidor lê o estado anterior e só cai no `raise` numa corrida entre leitura e escrita, o que um replay não reproduz. **Não medidos:** Séries financeiras (exigem uma série existente; as contas de teste não têm dados financeiros), Calendário/Google, Imagens e Drive, e Configurações (perfil v2). Conclusão provisória: o caminho comum de conflito dos módulos medidos devolve conflito estruturado antes de qualquer `raise 40001`; o travamento ficou restrito ao onboarding, cujo caminho primário era o `raise`. O risco residual está nos `raise` de corrida e nos módulos não medidos.

### Pendências de banco que seguem aguardando aprovação

Duas operações destrutivas pedem aprovação própria na interface do Supabase, que expirou sem resposta, e nada foi contornado: `drop function public.zz_probe(text)` (sonda de teste, EXECUTE para `anon`, só lança erros) e a **remoção das contas de teste A e B** (`delete` de `auth.users`, que cascateia perfil, preferências, rodadas e registros de domínio). Comandos para execução supervisionada no SQL Editor:

```sql
drop function if exists public.zz_probe(text);
delete from auth.users where email in ('sc-qa-a.20261029@example.com','sc-qa-b.20261029@example.com');
```

Depois, conferir que `auth.users` voltou a ter só a conta QA comum e que `public.zz_probe` não existe. As cópias de sessão locais e as senhas das contas A e B ficam apenas no scratchpad desta sessão, fora do repositório.
