# Entrega do MVP e pendências externas — 09/10/2026

A implementação local do MVP está entregue, com Núcleo, interfaces, adapters, canais autenticados, migrations versionadas e testes dos módulos. Em 09/10, o mantenedor informou a aplicação das nove migrations e o cadastro das variáveis de produção na Vercel; a introspecção REST pessoal confirmou objetos dos módulos e dois buckets privados. **A liberação ainda depende do novo deploy, do catálogo/tipos reais e dos aceites externos deste arquivo.** A [verificação da implantação](verificacao-implantacao-20261009.md) registra evidências e limites. Não se reaplicou SQL nem fez bootstrap nesta conferência.

Este documento atualiza o estado do código, conservando os relatórios anteriores como evidência de seus próprios recortes. Não declara o MVP implantado nem as issues encerradas por implementação local. O resultado do CI pertence à revisão publicada, conforme registro na issue #35.

## Implementação entregue

| Área | Comportamento implementado | Referência |
| --- | --- | --- |
| Identidade/Auth | Cookies de servidor, guards de sessão/moderação/troca obrigatória, recuperação preparada, rate limit persistente e CSP em bloqueio | [Auth](t014-auth-backend.md), [ensaio histórico real](t014-auth-real.md) |
| Capturar/Tarefas | Persistência por dono, conversões/referências, CRUD/lixeira, CAS, Evento e recibo atômicos; journal reconcilia resultado incerto; anexos usam IDs verificados | [Persistência](t015-persistencia.md), [journal](t015-journal.md), [anexos](t022-drive-storage.md) |
| Início/Atividade | Projeções dos módulos permitidos/visíveis, ações do dia e histórico paginado; 28 tipos de Evento com projeção sem conteúdo privado ou valores financeiros | [Atividade](t016-atividade.md), [validação ampliada](validacao-sql-finalizacao.md) |
| Administração | Papéis/vetos, criação com senha provisória, bloqueio/desbloqueio, troca forçada e revogação; saga preserva fence/claim em resposta Auth incerta e protege último master utilizável | [Admin/reconciliação](t017-admin.md), [ADR-0007](../adr/0007-admin-auth-saga-fechada.md) |
| Financeiro | Contas/cartões, categorias/etiquetas, lançamentos, transferências, pagamento de fatura/encargos, séries finitas, arquivamento, lixeira e Desfazer | [T018–T020](t018-t020-financeiro.md), [ADR-0006](../adr/0006-financeiro-series-finitas.md) |
| Conhecimento/vínculos | Cadernos/páginas, TipTap sob demanda, documento validado, wiki-links/backlinks por ID, Relacionados e restauração por lote; promoção conserva origem arquivada sem segunda cópia editável | [Conhecimento](t021-conhecimento.md) |
| Drive/anexos/avatar | Árvore, mover/destacar/lixeira/restaurar, quota; staging privado, bytes reais, validação de formato/re-encode, publicação imutável e limpeza idempotente | [Drive/Storage](t022-drive-storage.md) |
| Projetos/Hábitos | Contexto por tarefa/captura/caderno/pasta, criar/vincular/desvincular sem copiar conteúdo; hábitos, marcações, pausas e histórico | [Projetos/Hábitos](t023-projetos-habitos.md) |
| Cofre | AES-256-GCM no cliente, Argon2id em worker, chave não extraível, kit de duas partes com prova, recuperação/rewrap, versionamento/AAD e descarte imediato no logout | [Cofre](t024-cofre-cifrado.md), [hardening](revisao-hardening-cofre-monitoramento.md) |
| Calendário Google | Leitura de até duas contas, fontes selecionadas, dia/semana/mês, paginação/cursor/410, nota vinculada, lembrete dentro do app; OAuth PKCE/estado e tokens cifrados no servidor | [Calendário/runbook](t025-calendario-google.md), [ADR-0008](../adr/0008-google-calendar-readonly.md) |
| Busca/Configurações | Paleta dos sete tipos, acento/ranking, navegação/ações; perfil, avatar, tema, ordem/visibilidade dos módulos, agenda/lembrete e senha; Preferência separada de Entitlement | [Busca/Configurações](t026-t027-busca-configuracoes.md), [Validação SQL](validacao-sql-finalizacao.md), [avatar](t022-drive-storage.md) |
| Hardening/operação | Sentry por allowlist, scanners de segredos/bundle, PWA sem cache de dados privados, backup cifrado/restore isolado e catálogo readonly | [Revisão](revisao-hardening-cofre-monitoramento.md), [PWA](t005-pwa.md), [backup/release](../operations/backup-restore-release.md) |

`demo` continua disponível sem credenciais, com ports em memória. O Cofre demo executa criptografia real e perde seus envelopes ao recarregar. `supabase` usa canais conectados e recusa configuração ausente; não apresenta exemplos como dados persistidos. Credenciais, tokens, URLs assinadas, senha mestra e kit não entram no journal de comandos. O journal de reconciliação não equivale à outbox/sincronização offline completa da Fase 2.

## Evidência local e limites

Checkpoint revisável recebido do integrador em 09/10/2026. Contagens anteriores ficam identificadas para não confundir rodada parcial com aceite final.

| Portão | Evidência disponível | Limite/estado |
| --- | --- | --- |
| Instalação SQL local | As 14 migrations instalaram em PGlite descartável; todas as 29 asserções padrão passaram | Auth/Storage são fixtures; sem Supabase remoto ou concorrência real |
| Catálogo de release | 1.242 verificações readonly, zero desvios, na cadeia local completa | Catálogo no projeto pessoal pendente |
| Integridade SQL Editor | Manifest com 14 migrations e 31 arquivos separados; cinco hashes históricos preservados; SQL novo em LF | Integridade local não registra aplicação remota |
| TypeScript/lint | Verificação integral aprovada no checkpoint atual | Revalidar após gerar tipos reais e consolidar alterações finais |
| Vitest nos dois fusos | 93 arquivos, 1.427 testes aprovados em UTC e em America/Sao_Paulo | Sem credenciais ou integrações remotas |
| Scripts/arquitetura | 57 testes Node aprovados; camadas: 318 módulos/1.284 dependências | Fixtures e contratos locais |
| Design system/Impeccable | 164 contrastes verificados; zero registros no portão Impeccable | Não substitui auditoria visual/aparelho/leitor real |
| Parser SQL | 59 arquivos, zero erros | Sintaxe não prova execução remota |
| Build/scanners | Build local aprovado; scanner público: 78 bundles; scanner de segredos: 935 arquivos no checkpoint informado | Build integrado aprovado; não é inspeção do deploy nem garantia de detectar todo segredo sem assinatura |
| Busca com massa grande | Rodada final local: 50 mil metadados Drive, seis termos, máximo 29 ms | Orçamento de 500 ms RECOMENDADO; medição hospedada pendente. [Ensaio independente anterior/método](validacao-sql-finalizacao.md) |
| E2E integrado | Confirmação final: 168/168 E2E aprovados em Chromium, incluindo regressão de avisos em sequência e capturas atuais | Demonstração local e crypto real no cliente; sem navegador conectado. [Auditoria e jornadas](t028-validacao-final.md) |
| CI/commit desta entrega | Consolidação pela tarefa raiz | Conferir a execução do SHA publicado em Actions e consultar o registro na [issue #35](https://github.com/kauanbarateli/Segundo-Cerebro/issues/35) |

As provas reais de 07/10 para Auth/Capturar/Tarefas estão em [Auth real](t014-auth-real.md) e [persistência](t015-persistencia.md). Não certificam os nove arquivos novos, Storage/Google ou telas ampliadas. Doubles, React local e SQL serializado não comprovam SMTP, HTTPS/cookies no deploy, RLS hospedada, corridas de revogação, iPhone ou leitor de tela real.

## Aplicação manual das migrations

Destino autorizado: **projeto pessoal `rishenjoikgmfubmnfiu`**. BlackSheep/Sistema VOE não são destinos, fontes de credenciais ou fallback. CI/build/deploy/integração GitHub não executam SQL nem bootstrap. O [manifest](../../supabase/sql-editor/manifest.json) registra bytes canônicos LF; o [pacote SQL Editor](../../supabase/sql-editor/README.md) contém uma cópia por arquivo, sem executor automático.

**001–005 já foram aplicadas em 07/10/2026 e são imutáveis. Não reaplicar nenhuma delas e não repetir `bootstrap-master.sql`.** A primeira conta master já foi provisionada; UUID/e-mail/credenciais não fazem parte deste relatório.

| Já aplicada | Migration histórica |
| --- | --- |
| 001 | `20261007151834_identity_foundation.sql` |
| 002 | `20261007151850_auth_password_completion.sql` |
| 003 | `20261007151904_restrict_rls_event_trigger_execution.sql` |
| 004 | `20261007210519_capture_task_transactions.sql` |
| 005 | `20261007223710_activity_page.sql` |

**As nove migrations abaixo foram informadas como aplicadas manualmente pelo mantenedor em 09/10.** Tabelas/RPCs correspondentes foram observadas por REST; catálogo SQL, hashes/registro de execução e tipos oficiais ainda aguardam conferência. A tabela preserva ordem/bytes para rastreabilidade, **não é uma instrução para reaplicar**.

| Ordem informada como aplicada | Arquivo | SHA-256 dos bytes canônicos |
| --- | --- | --- |
| 006 | [Financeiro](../../supabase/sql-editor/installation/006_20261009144343_financial_transactions.sql) | `af3f102412f78e83f5f612666761c8b65b07239ee72bbf3ea81c56f9dd1c3557` |
| 007 | [Conhecimento/vínculos](../../supabase/sql-editor/installation/007_20261009144350_knowledge_pages_links.sql) | `a9da2bb78314f2eb2b0f773fa5b200496b8a963e5103a25ebe13198e0fa37b2c` |
| 008 | [Admin](../../supabase/sql-editor/installation/008_20261009150122_identity_admin_settings.sql) | `461708ac47abb50465bd71bd5a70f76fadba7dee599d6f114a82f8c22aee7862` |
| 009 | [Preferências](../../supabase/sql-editor/installation/009_20261009151557_account_preferences.sql) | `d183f660303227d21ceb11dd84a676d3ebeefb233d3a76802b2d0b380c58806c` |
| 010 | [Projetos/Hábitos](../../supabase/sql-editor/installation/010_20261009152200_projects_habits.sql) | `c57c54245926c66b5cbe87baaceee101d8d0d9cc0b0537c22040d6d423d3abe6` |
| 011 | [Storage/Drive](../../supabase/sql-editor/installation/011_20261009152822_private_storage_drive.sql) | `a1a66fcd601d46e905f6db5a890a4799d9b3409b3331bb832e6e74301184f8b9` |
| 012 | [Busca/Atividade](../../supabase/sql-editor/installation/012_20261009154609_global_search_activity.sql) | `b91f2acbf62794811bd906e2592fb86b48205d5366e1446e6de7c9bfbd3a58e7` |
| 013 | [Cofre](../../supabase/sql-editor/installation/013_20261009160151_encrypted_vault.sql) | `3f1af61dbe5954e2e5354441e47e411463eb6314f0ae7471edfbc8cae7aa35ff` |
| 014 | [Calendário Google](../../supabase/sql-editor/installation/014_20261009160158_google_calendar.sql) | `621bc732a818da2627e245a1614264b5e3a70b8f330510d1fae06bef524ed0e3` |

Continuidade após a aplicação informada:

1. Conferir organização/ref pessoal, registro de execução e hashes/versões, sem reaplicar migrations ou bootstrap.
2. Executar o catálogo readonly e exigir zero desvios; gerar os tipos reais e confrontar os contratos dos adapters. O MCP atual ainda recusa acesso ao projeto pessoal.
3. Validar o novo deployment com as variáveis de Production. A leitura inicial do alias ainda mostrou demo/login indisponível; não equivale a falha das migrations.
4. Fechar cadastro público: leitura atual de Auth settings retornou disable_signup=false. Prosseguir com SMTP, Google/cron, Storage, jornadas conectadas, concorrência, backups e aparelhos conforme tabela abaixo.
5. Fixtures SQL são somente para base dedicada vazia com rollback; não executar no projeto com contas reais. Ensaios Auth usam opt-ins e limpeza por IDs/marcadores exatos.

Detalhes: [verificação da implantação](verificacao-implantacao-20261009.md). O manifest prova integridade dos arquivos locais, não registra execução remota. Restore permanece em outro projeto pessoal vazio, com procedimento próprio.
## Configurações externas pendentes

Os nomes de servidor estão em [.env.example](../../.env.example); os valores pertencem ao ambiente privado do hosting, sem `NEXT_PUBLIC_`. Cada integração valida sua configuração quando usada. Usar valores independentes; não publicar segredos em docs, URLs de cron, argumentos, logs, screenshots ou relatórios.

| Configuração | Ação posterior e prova necessária |
| --- | --- |
| Aplicação/Supabase | Variáveis de Production e `APP_MODE=supabase` informados como configurados pelo mantenedor. Validar novo deployment, `APP_URL` HTTPS e destino pessoal; conferir URLs Auth/proxy/CDN/HTTPS, cookies HttpOnly/Secure/SameSite, cache privado e CSP real. Conferir `app_private` fora dos schemas expostos. |
| Auth | Conferir `AUTH_STATE_SECRET` e `AUTH_RATE_LIMIT_SECRET` independentes, ≥32 bytes. Fechar cadastro público no Dashboard **e verificar a API**; leitura atual de 09/10: `disable_signup=false`. Revisar alerta histórico de proteção contra senhas vazadas no Security Advisor e registrar estado escolhido. |
| SMTP/recuperação | Configurar provedor pessoal, remetente/domínio, templates e redirects; testar entrega, link expirado/uso único, PKCE, adulteração e troca de senha com revogação. OP-010 adiou estes ensaios; não estão concluídos. |
| Admin | `ADMIN_COMMAND_SECRET` ≥32 bytes, distinto de Auth/cron/chaves. Validar efeitos Auth e revogação reais. Não expirar/roubar claim incerta; seguir [reconciliação](t017-admin.md#procedimento-futuro-para-auth-incerto) após provar término de todas as chamadas anteriores. |
| Storage | Buckets `second-brain-staging`/`second-brain-files` privados confirmados por API em 09/10; policies efetivas ainda exigem catálogo/ensaios. CSP permite somente origem pessoal exata necessária ao upload. Conferir `DRIVE_QUOTA_BYTES`/`DRIVE_MAX_FILE_BYTES`; defaults RECOMENDADOS: 1 GiB/dono e 25 MiB/arquivo Drive; imagens/anexos/avatar até 8 MiB. Confirmar re-encode/bytes/quota hospedados. |
| Limpeza de arquivos | `CRON_SECRET` independente ≥32 bytes; agendar POST `/api/files/cleanup` com Bearer no header, sem segredo na URL. Observar retry/órfãos/disputa com vínculos; logs somente horário/contagens. |
| Google OAuth | Habilitar Calendar API, consentimento e cliente Web; redirect URI exata: `APP_URL` + `/api/calendar/oauth/callback`. Definir `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_CALENDAR_STATE_SECRET` ≥32 bytes, `GOOGLE_CALENDAR_TOKEN_KEY` base64 canônico de 32 bytes aleatórios e `GOOGLE_CALENDAR_TOKEN_KEY_ID`. Rotação opcional: `GOOGLE_CALENDAR_TOKEN_KEYS`. Conferir test users/publicação/verificação de escopos; [configuração completa](t025-calendario-google.md#configuração-manual-posterior). |
| Google cron/recuperação | `GOOGLE_CALENDAR_CRON_SECRET` independente ≥32 bytes; agendar `/api/cron/google-calendar` diariamente com Bearer no header. Rever capacidade de 200 contas elegíveis. Validar paginação/410/consentimento/desconexão reais. Claims de sync sem TTL só são liberadas após prova de término; [runbook](t025-calendario-google.md#recuperação-operacional). |
| Backup/restore | Obter pg_dump/pg_restore/psql compatíveis; destino/relatórios externos privados fora de sync/serving, ACL NTFS e perfil DPAPI/chave independente. Estabelecer quiescência em cada execução, verificar backup e observar agendamento. Restore em outro projeto pessoal vazio precisa provar UUIDs Auth, hashes Storage e **Cofre aberto com senha/kit originais em sessão limpa**. [Runbook](../operations/backup-restore-release.md). |
| Sentry opcional | `SENTRY_DSN` somente servidor, projeto pessoal. Se ativado, verificar envelope real de evento **e transação** contra allowlist, sem corpo/usuário/URLs/stacks/valores/ciphertext/tokens/kit; não habilitar Replay/logs/tracing automático. Se desativado, registrar essa escolha sem alegar envio aprovado. |
| PWA/aparelhos | Publicar HTTPS e validar instalação/update/offline no iPhone real; páginas/APIs/imagens privadas não ficam no service worker/cache após sair. Lembrete dentro do app não é push nem execução garantida com navegador fechado. |

## Aceites que mantêm as issues abertas

O snapshot consultado mantém abertas **#12, #20–35, #36 e os épicos #2, #4–7**. #3 (SPEC-02) já estava fechada e continua como histórico. Esta entrega mantém os aceites externos abertos; a tarefa raiz registra os avanços nas issues após publicar o código. Implementação e aceites operacionais são registros distintos.

| Issues | Evidência que falta no ambiente real |
| --- | --- |
| #12 — PWA/visuais | Instalação/update iPhone, offline controlado, temas/capturas atuais; Tab/leitor real/reduced motion e revisão visual final |
| #20 — identidade/pipeline | Aplicação 006–014 informada e objetos corroborados por REST; faltam hashes/registro executado, tipos oficiais, catálogo hospedado e novo deployment conectado. Pipeline permanece sem SQL automático |
| #21 — Auth | Cadastro fechado pela API, SMTP/PKCE, HTTPS/cookies/refresh, senha atual obrigatória e sessões antigas revogadas em dois aparelhos |
| #22–23 — Capturar/Tarefas/Início | Anexos reais, persistência após reload, resposta perdida/replay, projeções/ações; veto/ocultação e conteúdo limpo no logout |
| #24 — Admin | Dois contextos/aparelhos, bloqueio/veto/role em leitura/escrita, último master concorrente, conta provisória antes da troca e Auth incerto protegido |
| #25–27 — Financeiro | RPCs/grants hospedados, transações simultâneas, rollback/replay de transferência/fatura/série, massa de regressão e UI conectada/privacidade/Desfazer |
| #28 — Conhecimento | Editor→wiki-link→backlink conectado, promoção sem duplicação editável, restauração exata, queries em lote e Entitlement atual; teclado/leitor |
| #29 — Drive | Upload/download, quota em dois envios, nome/MIME/bytes falsos, re-encode/EXIF, revogação após reserva, falha objeto→commit e limpeza/vínculo concorrentes |
| #30 — Projetos/Hábitos | Contexto conectado sem cópia, refs do mesmo dono, histórico/pausa/dias no fuso e restauração preservando fontes |
| #31 — Cofre | Persistência/reload/dois usuários, recuperação em navegador limpo, rewrap/kit anterior, revogação concorrente, Argon2id/worker/clipboard em aparelho real e descarte no lock/logout |
| #32 — Calendário | OAuth duas contas/terceira recusada, estado/expiração/replay/troca de sessão, fontes/períodos/páginas/410, nota/vínculo, cron e revogação incerta segura |
| #33 — Busca | Item correto nos sete tipos, E2E em pelo menos três, ranking/literais, orçamento hospedado com massa descartável, leitor anunciando contagem e privacidade em option/aria |
| #34 — Configurações | Tema/ordem desktop→celular, essenciais protegidos, avatar/remover, agenda/lembrete atualizados e troca de senha revogando sessões |
| #35 — release | Backup agendado/restore documentado, catálogo produção sem desvio, telemetria se ativada, seis jornadas desktop/iPhone e auditoria Impeccable final |
| #36 — lint | Reavaliar correção oficial, atualizar com stack compatível e repetir instalação limpa/audit/lint/typecheck/build/smoke; registro de 07/10 não é consulta atual de vulnerabilidades |
| #2, #4–7 — épicos | Anexar provas dos filhos e critérios de saída antes de fechar |

Corridas precisam de conexões/transações realmente sobrepostas: login/rate limit, CAS/replay, revogação contra comando, dois masters, quota, limpeza contra vínculo e disconnect contra sync. SQL local serializado não encerra estes critérios. Usar contas sintéticas identificadas e limpar somente IDs/marcadores/hashes exatos depois de todas as chamadas terminarem; master existente não é fixture.

Registrar as seis [jornadas-âncora](../planejamento/05-arquitetura-de-produto.md#3-jornadas-âncora-critério-de-aceite-do-produto-inteiro) em desktop/iPhone: capturar/organizar, agir no Início, lançar/pagar, buscar/vínculos, reunião com nota/tarefa e Cofre copiar/bloquear. Inspecionar 390/1440, claro/escuro, títulos longos, vazio/erro/carregamento, foco inicial/devolvido, Tab/Shift+Tab/setas/Enter/Esc, leitor real e reduced motion. Evidências usam dados sintéticos sem segredos/tokens/valores pessoais/kit em traces ou screenshots.

## Fase 2+ e limites do MVP

Permanecem fora desta entrega, conforme [doc 12](../planejamento/12-roadmap.md) e [doc 13](../planejamento/13-tickets.md): outbox/sincronização offline completa, push/Google watch, grafo visual persistente, orçamentos/plano do mês completos na UI, métricas agregadas de Admin, ClickUp/Gmail/API externa, exportação/exclusão completa de conta e TOTP. Prévia de arquivos/templates, multi-moeda, subcategorias, anexos/importação financeira e realtime também ficam para fases futuras. Tabelas/metadados preparados não declaram essas interfaces prontas.

IA dentro do app, colaboração/compartilhamento multiusuário, billing e escrita no Google continuam excluídos do corte aprovado. Preferência organiza a interface; Entitlement autoriza no servidor/banco. Lembrete funciona com app visível. O Cofre protege conteúdo persistido, mas não promete resistência a código hostil já executando no navegador desbloqueado nem apagamento físico garantido de strings JavaScript.

A liberação exige anexar rodada local/CI final, aplicação/tipos reais, configurações e provas externas acima. Até lá: **implementação local concluída; implantação e aceite operacional pendentes**.
