# Handoff de retomada — 12/10/2026

**Demanda pausada por pedido expresso do mantenedor às 12:53 em Fortaleza (15:53 UTC).** Retomar implementação somente após nova instrução humana. Os três agentes auxiliares concluíram seus trabalhos; nenhum agente permanece executando subtarefa. A pausa não desligou a rotina Google de produção, previamente validada e habilitada.

Atualização organizacional posterior em 12/10: o mantenedor definiu [duas frentes](handoff-duas-frentes-mvp-20261012.md), com construção offline em PR por outro agente e criação/validação conectadas pela raiz (OP-020). Este documento e seu snapshot conservam o estado histórico da pausa; usar o novo acordo para distribuir o trabalho.

## 1. Onde assumir

- Repositório principal: `kauanbarateli/Segundo-Cerebro`.
- Checkout: `C:\Users\Kauan Sousa Barateli\Documents\Codex\2026-10-07\inicie-a-constru-o-do-software-2\work\Segundo-Cerebro`.
- Branch: `main`; HEAD publicado: `b8bf4ced273c6507c04385db706b06c49d01f53c` — “Prepara cron pessoal e perfis privados de backup”.
- Worktree histórico: `work/session-schema-native`, branch `codex/own-sessions-schema`. Não assumir que contém as atualizações operacionais atuais; preferir o checkout principal.
- Produção: [Segundo Cérebro](https://segundo-cerebro-of.vercel.app).
- Supabase pessoal exclusivo: `rishenjoikgmfubmnfiu`, organização pessoal. **BlackSheep e Sistema VOE fora do escopo.**
- [Snapshot da pausa](evidence/handoff-retomada-20261012-snapshot.json), [pendências](entrega-mvp-pendencias.md), [evidência Google](google-producao-20261012.md) e [evidência SMTP](smtp-producao-20261012.md).

Leia primeiro `AGENTS.md`, `CONTEXT.md`, [decisões operacionais](decisoes-operacionais.md), ADRs pertinentes e critérios literais das issues. Para UI, leia a Impeccable local completa e referências DS 2.1/D-030; para Supabase, use a skill correspondente. Não confundir preparação, teste local, metadados de CI e aceite real.

A retirada de Drive permanece vigente (D-032/OP-018); #29 foi encerrada como `not_planned`. A nova lógica ainda será descrita. Capturar, Avatar, Storage privado e backup permanecem no MVP.

## 2. Estado de Git e alterações locais

Não houve novo commit/push ou escrita de issue para preparar esta pausa. O conteúdo abaixo está salvo **localmente, ainda não publicado**:

| Arquivo | Alteração |
| --- | --- |
| `docs/implementation/smtp-producao-20261012.md` | Novo registro da recuperação real concluída |
| `docs/implementation/google-producao-20261012.md` | Cron/Admin e rotina habilitada; limites reais |
| `docs/implementation/entrega-mvp-pendencias.md` | Avanço SMTP/Google e impedimento do runtime de backup |
| `docs/operations/google-calendar-scheduler.md` | Rodada confirmada, ativação e suspensão para backup |
| `docs/operations/configuracoes-pendentes-passo-a-passo.md` | Estado atual; usar workflow existente |
| `docs/operations/perfis-privados-backup.md` | Pooler, origem 17.11, CA e bloqueio Windows |
| `docs/operations/backup-restore-release.md` | Corrige preparação histórica; nenhum restore certificado |
| Este handoff e seu snapshot | Estado para retomada independente |

Os quatro handoffs/snapshots de **10/10 e 11/10** já estavam não rastreados: preservados, sem alteração/staging. Não usar `git add .`; escolher arquivos após revisão. Nenhum código do aplicativo, migration, teste ou workflow foi alterado nesta pausa. Scripts privados em `work/` são ferramentas de execução da rodada, não entregas para publicar.

Ao retomar, revisar estes diffs, conferir links/UTF-8/whitespace e executar verificações adequadas antes de commit/push sem coautoria. Depois atualizar issues com resultados comprovados, preservando seus históricos.

## 3. O que já foi comprovado

### Recuperação por e-mail — #21

O mantenedor autorizou criar uma conta comum confirmada para o ensaio. A senha inicial foi gerada em memória e descartada; não houve promoção nem alteração da master.

O primeiro e-mail chegou, mas o mantenedor abriu o link inicialmente em outro navegador. A recuperação exige o cookie do pedido e o verifier PKCE do contexto de origem. Esse dado explica a necessidade de novo pedido no mesmo contexto; não certificar causa exata do primeiro retorno só por essa informação.

Foi feito **um novo pedido** no navegador do Codex. O mantenedor abriu o link nesse mesmo contexto, preencheu/confirmou/enviou a senha e informou sucesso. A raiz observou o Início protegido e a identidade da conta comum em Configurações. Consulta Auth somente leitura confirmou novo login às **15:29:22.093709 UTC**, conferido às **15:31:29.651 UTC**.

Entrega e recuperação funcional de produção estão comprovadas. A conta permanece cadastrada; não excluir, reenviar recuperação ou repetir sua criação por suposição. Uso único, expiração, refresh, revogação global, senha antiga e aparelhos não foram certificados por essa rodada. Não fechar o critério conjunto ou a issue inteira sem os demais aceites. A senha antiga desta conta não está disponível, pois foi descartada; não alegar comparação.

Relatórios privados: `work/smtp-common-account-20261012.json` e `work/smtp-recovery-check-20261012.json`. Consultar somente metadados necessários, sem publicar identidade. Não executar novamente o helper de criação. A mudança de senha e sua submissão são feitas pelo humano, conforme [Computer Use](</C:/Users/Kauan Sousa Barateli/.codex/plugins/cache/openai-bundled/computer-use/26.1007.21434/skills/computer-use/SKILL.md>) e sua regra “Final step: submit change password”; não pedir senha/link/código no chat.

### Google Calendar — #32

- Duas contas reais conectadas, sync manual concluído e visões dia/semana/mês abertas.
- Semana apresentou 34 botões de eventos; mês móvel apresentou sua lista. Não contar DOM oculto como eventos únicos.
- Todos os calendários desmarcados: Calendário vazio e agenda do Início com zero itens. Cinco seleções restauradas exatamente.
- Um aviso real apareceu. Desmarcar somente sua fonte retirou o aviso e seus eventos, deixando dois eventos das outras fontes; seleção restaurada.
- Quatro execuções manuais concluídas no Admin às 11:21/11:23/11:31/11:36, contagens preservadas no registro próprio.
- [Run cron 38267560938](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/38267560938), job `114873463274`, SHA b8bf4ce, `workflow_dispatch` às 15:04:33 UTC: **HTTP 200, complete=2, failed=0, outcome=complete, code=OK**.
- Admin mostrou duas linhas **Agendada · Concluída às 12:04**, com 1/2 calendários e 0/894 eventos recebidos. São lotes, não eventos únicos visíveis.
- Mantenedor cadastrou `GOOGLE_CALENDAR_CRON_SECRET`. Root habilitou e reconferiu `SC_GOOGLE_CALENDAR_SCHEDULER_ENABLED=true`. Agenda **05:17 UTC / 02:17 Fortaleza**, sem SLA.

**Primeiro disparo automático diário ainda não observado.** O primeiro elegível seria 13/10, sujeito ao scheduler; não enviar novo dispatch manual para simular essa observação. Pausar a demanda não suspende esse workflow de produção.

Filtro Início/lembretes e cron autenticado/Admin têm evidência suficiente para seus **dois critérios literais**. Ainda não foram atualizados na issue nesta rodada. Preservar os outros três critérios: revogar/apagar, evento de três dias e expansão da janela sem recarregar. Terceira conexão foi desabilitada na UI, mas recusa direta no servidor, reconciliação incerta, paginação/410 e nota com provedor conservam seus limites; não transformá-los em novos gates artificiais.

A antiga mensagem genérica de recusa não prova limite de uma conta: duas conexões passaram sem patch/reset/claim release. Nenhum evento Google foi criado, editado ou removido; nenhuma conexão revogada. Nomes, endereços, títulos, IDs e tokens não devem ir para Git/issues.

### Preparação do backup — #35

Raiz privada: `C:\Users\Kauan Sousa Barateli\SegundoCerebro-Operations`, fora de Git/OneDrive. Pastas `profiles`, `archives`, `temp`, `reports`, `tools` e `certificates`; ACL somente identidade Windows atual, SYSTEM e administradores. A permissão de escrita adicional concedida ao agente valeu para a rodada: reconferir permissões ao retomar antes de escrever.

| Item | Estado |
| --- | --- |
| Origem | PostgreSQL **17.11**, `170011`, banco `postgres`, por SQL `READ ONLY`/rollback no painel |
| Session pooler | `aws-1-sa-east-1.pooler.supabase.com:5432` |
| Usuário PostgreSQL | `postgres.rishenjoikgmfubmnfiu`; não é senha/API key |
| Instalação existente | PostgreSQL 18.4 preservado; nenhum PATH/serviço/configuração VOE alterado |
| ZIP portátil 17.11-5 | Baixado e extraído em `tools/postgresql-17.11-5/pgsql`; hash oficial confirmado |
| Execução | Windows recusou iniciar `pg_dump.exe --version` pelo Controle de Aplicativos; não tratar bundle como runtime aprovado |
| CA | `certificates/prod-ca-2021.crt`, obtida pelo link do painel pessoal |
| TLS | Nome e cadeia validados em TLS 1.3 somente no processo, com CA Supabase, às 15:52:15 UTC |
| PostgreSQL autenticado | Ainda não; nenhum perfil real/password disponível |
| Backup / restore / tarefa | Nenhum executado |

ZIP SHA-256: `80379b2c04d51c30225532e0ae04509899141e9957ed096fe749d7fd9df8f82f`, [fonte EDB](https://github.com/EnterpriseDB/edb-installers/issues/731). Não houve hash divergente nem bypass Windows. O primeiro launcher encontrou também erro de redirecionamento PowerShell; o launcher .NET corrigido revelou o bloqueio real no início do processo. Não atribuir esse bloqueio ao banco.

CA SHA-256: `700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7`. Primeiro TLS usando trust Windows falhou `UntrustedRoot`; depois foi usada a CA pública do painel **só na política TLS do processo**, sem importá-la no trust store. Nenhuma credencial foi enviada. Isso não certifica o futuro `libpq verify-full`/login. Metadata privada: `SegundoCerebro-Operations/reports/pooler-tls-20261012.json`.

O helper [prepare-operator-profile.ps1](../../scripts/operations/prepare-operator-profile.ps1) já publicado prepara DPAPI em PowerShell 7; oito controles locais com dados artificiais passaram, mais 25 testes existentes de backup/cron. SHA do helper revisado: `101142f691d035e28871b86434a2ff92000de1ee2e3bf4ffef801097b3ae2df3`. Não pede `SC_BACKUP_QUIESCED`, `TEMP/TMP` ou variáveis do aceite Cofre. O Check pode ser preparado antes do Backup; prompts privados são preenchidos pelo responsável, sem transcript/valores em chat/argv.

Falta runtime de dump/restore permitido: não usar `Unblock-File`, desativar política, alterar VOE ou presumir que instalador assinado aprova binários internos. Alternativas pesquisadas: cliente17 PGDG em Linux/WSL já aprovado ou imagem oficial17 em Docker já aprovado. **Nenhum ambiente desses foi comprovado pronto**; somente o caminho `wsl.exe` foi localizado. Docker/Podman não estavam no PATH. Não instalar/migrar/adaptar wrapper DPAPI automaticamente. `psql`18 pode consultar servidor17 com SQL compatível, mas não foi revalidado nesta rodada; **dump18→restore17 não é garantido**.

Também faltam senha PostgreSQL em perfil privado, chave/custódia independente, segundo projeto pessoal novo/vazio e versão compatível, janela sem escritores, fixture/material original de Cofre e primeiro backup agendado. Não aplicar migrations no alvo antes de restore; dump inclui schema.

**Quiescência:** variável Google=false impede próximos jobs schedule, mas não dispatch manual nem execução remota já iniciada. Antes de declarar YES, impedir manuais, confirmar término conhecido e pausar app/Admin/imports/uploads/cleanup/Google. Cancelamento ou timeout não provam término; não liberar claims/repetir por suposição. Backup diário unattended ainda não está pronto; perfil DPAPI e horário sozinhos não pausam os escritores.

## 4. Banco e conexões

**001–019 já aplicadas no projeto pessoal; nenhuma migration pendente.** Não reaplicar chain, bootstrap, reset ou seeds. Conferência hospedada pós-019: 1.269 checks/zero desvios, de sua rodada histórica; não foi repetida nesta pausa. Asserções continuam readonly/rollback, CI/build/deploy sem schema remoto.

Export de tipos hospedado comparado/revisado: 35 tabelas/uma view/55 RPCs; 41 objetos/151 ocorrências divergentes preservadas. Não exigir outro export/MATCH como gate adicional nem editar baseline para esconder drift.

Supabase MCP permanece sem permissão e Vercel MCP retorna 403 para o escopo pessoal. Não repetir chamadas sem mudança de estado, extrair OAuth tokens ou pedir secrets no chat. O painel Supabase pessoal no IAB está autenticado. SDK Auth com a configuração local pessoal funcionou; isso não comprova todas as variáveis Vercel. As seis variáveis Google ausentes localmente não significam ausência em produção.

GitHub CLI: usar credencial de `kauanbarateli` **no processo**, sem auth switch/global. O keyring pode negar no sandbox e funcionar com execução escalada autorizada. Não imprimir tokens. SSH de push exclusivo: `C:/Users/Kauan Sousa Barateli/.ssh/id_ed25519_segundo_cerebro_principal_20261007`, `IdentitiesOnly=yes`; preservar demais chaves/configurações.

## 5. CI e issues que continuam abertas

Última contagem reconferida em **12/10 às 11:47 UTC**: 12 issues, oito executivas e quatro épicos. #21/#32/#35 foram consultadas nesta rodada e continuam OPEN; não houve escrita.

| Issue | Próximo trabalho |
| --- | --- |
| #12 PWA | Registrar instalação/uso em Android e iOS reais; revisão humana adiada |
| #21 Auth | Publicar evidência SMTP; critérios conjuntos de expiração/uso único/refresh/revogação/aparelhos e encerramento nativo pendentes |
| #24 Admin | Diagnóstico e conclusão BLOCK/FIRST com limpeza real; backend não substitui GUI |
| #32 Google | Registrar dois critérios literais comprovados; revogação, três dias e janela sem reload; observar primeiro diário |
| #34 Configurações | Tema entre desktop/celular e revisão humana; provas de senha/avatar conservam seus SHAs |
| #35 Release | Runtime permitido, perfil, custódia, janela, backup/verify/restore/Cofre, seis jornadas e audit Impeccable final |
| #36 Dependências | Manter mitigação lint e condições/limites do patch oficial; não repetir audit sem mudança relevante |
| #37 Sessões próprias | Concluir BLOCK/FIRST e limpeza, cinco aceites originais; sem gate adicional de SMTP/export |
| #2/#4/#6/#7 | Épicos: fechar somente após filhos e aceites próprios |

CI **do próprio b8bf4ce**, por metadados: **5/8 workflows push success**, três failure (Recovery `38267466547`, Admin navegador `38267466611`, Auth `38267466632`). Success: Captura `38267466715`, Avatar `38267466631`, Foundation `38267466633`, Admin backend `38267466649`, CI geral `38267466552`. O run Google manual success é separado, não um nono gate push. Relatórios integrais desses oito não foram capturados; causa dessas falhas não foi atribuída. Não herdar 6/8 de 553/5c nem contagens de 27 etapas como contagem de b8.

O diagnóstico nativo histórico mantém prazo absoluto 15s, primeira falha, resultado incerto e veto de limpeza. ACK/headers não são EOF. Fonte Playwright1.63 mostrou possibilidade em memória de ordem loadingFinished anterior à Request, **sem provar causalidade no CI**. Observador enum readonly não altera Maps/handlers, envia comando ou fornece terminal. Logs/reports históricos 553/5c/11e/7d/0b/b608 já fechados: não reabrir, reinterpretar ou usar como nova prova. Consultar os resumos/evidências existentes para seus recortes; captura de b8, se necessária, deve ter origem própria e processo revisado.

## 6. Retomada em quatro frentes, sem conflitos de edição

1. **Root / integração e revisão:** confirmar checkout/dirty state, validar estes registros, publicar arquivos escolhidos sem coautoria e atualizar issues. Coordenar operações pessoais, browser humano, quiescência e aceites; ser o único escritor Git/GitHub/remoto.
2. **Auth / Admin / sessões:** fonte e teste nativo de #21/#24/#37; separar causa observada de hipótese, manter limites de encerramento/limpeza. A recuperação real já passou: não pedir outra senha/email para refazer o aceite.
3. **Google / produto:** retomar os três critérios faltantes de #32 e os limites documentados. Planejar revogação supervisionada com conexão autorizada; não alterar eventos pessoais para improvisar fixture de três dias. Observar diário sem novo dispatch.
4. **Backup / release e experiência:** definir ambiente de ferramentas aprovado, perfil Check privado/CA/login readonly, depois Backup e alvo vazio compatível; coordenação com Root antes de escrituras. Auditoria/revisão UI/PWA/aparelhos e #34/#35 conforme disponibilidade humana.

A entrega dos agentes desta rodada foi revisada pela raiz; os pareceres de SMTP/CA anteriores às validações finais foram atualizados pelas evidências humanas/Root. Evitar anexar os pareceres antigos como estado vigente.

## 7. Navegador e próximos inputs humanos

A conta comum está conectada em `/configuracoes`; o painel pessoal Supabase está em Database Settings/SSL. Ambos ficam para retomada. Recarregar a documentação CUA antes de interagir após compactação; usar somente APIs suportadas, não cookies/runtime/fetch para simular o browser. Não imprimir links de recuperação/OAuth/segredos em snapshots.

Inputs futuros, sem cobrar durante a pausa:

- Perfil Check/Backup preenchido localmente e caminhos absolutos; senha somente em prompt privado.
- Confirmação de custódia independente da chave/ID, sem conteúdo.
- Ref e versão de alvo pessoal novo/vazio, confirmação de descarte permitido.
- Ambiente de ferramentas de backup permitido pelo sistema.
- Janela de pausa dos escritores, fixture e material original de Cofre/arquivos sob controle humano.
- Disponibilidade de aparelhos e revisão visual final, ainda adiadas.

A pausa não conclui o MVP e não elimina os critérios restantes. Não há migration nova para o mantenedor aplicar.

## 8. Verificação do material de retomada

Revisão documental independente concluída sem incorreções críticas; o manifest foi completado com os dois arquivos novos de handoff. Verificação local de nove arquivos: UTF-8/JSON válidos, 78 links locais existentes, sem problema de formato; `git diff --check` passou. Não foram iniciados novos testes de aplicativo, chamadas remotas ou execuções operacionais após o pedido de pausa.
