# 09 — Administração separada

Data: 31/10/2026. Estado: **planejamento para validação, sem implementação**. Código-base examinado e reconferido sem alteração nesta auditoria: `main`, SHA `bd35288404c493d1b03f7a1a0208f808cc2079a2`. Auditoria estrutural Supabase concluída em leitura: [doc 16](16-auditoria-supabase.md).

## Objetivo e escopo confirmado

Planejar uma aplicação administrativa em **`adm.segundocerebroapp.com.br`**, separada do ambiente cotidiano do Segundo Cérebro. A resposta Q5 determina desativar a página e as APIs administrativas antigas depois de preparar a contingência. A ampliação de Q15 inclui usuários, sugestões/respostas, disponibilização de funcionalidades e métricas de uso/cadastro, com ficha e jornada de aquisição descritas no [doc 10](10-utm-metricas-e-jornada.md).

“Alunos”, no pedido, é tratado aqui como **usuários/contas do Segundo Cérebro**. Não existem requisitos de cursos, matrículas, aulas ou progresso educacional; não criar essas entidades.

O painel permite administrar metadados e operações explicitamente autorizadas. Não oferece impersonação, acesso a notas, tarefas, calendários, saldos, arquivos, segredos do Cofre ou tokens de integrações. A consulta individual de aquisição é uma nova permissão restrita, descrita no doc 10, e não abre conteúdo pessoal dos módulos.

## Diagnóstico da implementação

**OBSERVADO no código:**

- [Admin atual](https://github.com/kauanbarateli/Segundo-Cerebro/blob/bd35288404c493d1b03f7a1a0208f808cc2079a2/src/components/features/admin/admin-workspace.tsx) lista identidade, criação da conta, último login, sessões e estado. Há ações de criar usuário, bloquear/desbloquear, exigir troca de senha, alterar papel e veto administrativo.
- `src/core/admin/index.ts`, `src/adapters/db/admin-runtime.ts` e `src/app/api/admin/route.ts` executam uma saga com reserva, claim, etapas, reconciliação e proteção do último Master utilizável. O [ADR-0007](https://github.com/kauanbarateli/Segundo-Cerebro/blob/bd35288404c493d1b03f7a1a0208f808cc2079a2/docs/adr/0007-admin-auth-saga-fechada.md) proíbe liberar operações Auth de resultado incerto sem prova de término. Esse contrato deve ser reutilizado.
- `/api/calendar/admin-runs` é outra superfície administrativa a inventariar no corte. Diagnósticos operacionais não devem ficar expostos por esquecimento.
- `src/lib/auth/cookie-policy.ts` já define cookies `HttpOnly`, `Secure` conforme ambiente, `SameSite=Lax` e sem `Domain`; não existe ainda a aplicação separada nem sua sessão administrativa com MFA.
- `src/core/access/resolve-access.ts` mantém um catálogo estático de funcionalidades. O Plano Pessoal concede capacidades existentes salvo veto; preferências só alteram exibição. A liberação controlada de novas abas exige ampliar esse contrato, não apenas esconder itens no menu.
- Feedback de usuários, respostas administrativas, roadmap persistente e métricas DAU/WAU/MAU não foram encontrados no produto examinado. A palavra `feedback` em `connected-command-feedback` refere-se a confirmação de comandos, não a pedidos dos usuários.

**OBSERVADO no banco hospedado:** o acesso pelo MCP pessoal funcionou e a auditoria de leitura substitui a limitação inicial. As 67 tabelas de `public`/`app_private` coincidem com o catálogo esperado e têm RLS habilitado; foram inventariadas 357 funções, 33 policies e 98 triggers. A base administrativa existente está confirmada, incluindo `app_private.admin_operations`, `public.admin_audit_events`, roles, moderação, entitlements e contratos/grants da saga. Reutilizar essa base; não criar uma segunda administração de identidades por inferir que ela esteja ausente.

O catálogo executou 2.512 verificações com uma única divergência no pin de `public.onboarding_call(uuid,uuid,text,jsonb)`. A comparação complementar confirmou correspondência com a operação versionada de PT409 e finais de linha CRLF. Não reverter esse patch conhecido. O histórico remoto registra cinco migrations diante de 27 arquivos no repositório, apesar de estruturas posteriores já instaladas. **Reconciliar o histórico antes de DDL**, sem reaplicar automaticamente as 22 restantes, reparar o ledger pela contagem, duplicar tabelas ou executar reset. A trilha e os limites estão no [doc 16](16-auditoria-supabase.md).

**Deltas ainda novos:** não foram encontrados objetos dedicados a `admin_capabilities`, sessões específicas do novo ADM, disponibilidade de features, feedback/roadmap, UTM/atividade ou ClickUp no recorte e na consulta por termos do catálogo. A aplicação administrativa separada continua ausente no código examinado. A consulta não prova ausência de conteúdo em JSONB ou de implementação em serviço externo, nem demonstra que DNS/deploy/MFA estejam configurados. Os 36 avisos informativos de RLS sem policy incluem tabelas intencionalmente fechadas, como as de operação/auditoria Admin; não criar policies para silenciar o advisor nem ampliar acesso direto.

**Operação e limites:** o cron de retenção do onboarding está ativo a cada 15 minutos e registrou 96/96 sucessos nas 24 horas consultadas; isso não comprova funcionamento dos fluxos do novo ADM. Foram observados dois buckets privados de 25 MiB e nenhuma Edge Function listada, sem ensaio de upload ou inferência sobre rotas de servidor da aplicação. Permanecem **NÃO VERIFICADOS** provedores/configurações Auth, SMTP/DNS, MFA efetivo, deployment do subdomínio, schemas expostos pela Data API, backups/recuperação, QA e comportamento funcional em runtime. A auditoria não executou comandos de negócio nem alterou o banco; operações pendentes e contingência serão verificadas no contexto operacional autorizado, sem ler conteúdo pessoal para este inventário.

## Arquitetura proposta

**RECOMENDADO:** mesmo repositório, dois aplicativos/deploys e um núcleo compartilhado. O app do usuário mantém suas rotas atuais; o administrativo ganha entrada, build, variáveis e política de release próprios. Uma reorganização gradual para `apps/admin` e pacotes compartilhados pode ocorrer na etapa de extração, mas esses caminhos são propostas, não pastas já existentes.

1. Extrair contratos e casos de uso comuns sem dependências de Next/React para a fronteira compartilhada. Não duplicar a saga Admin ou modificar suas regras para viabilizar importações.
2. Manter DTOs administrativos mínimos e adapters server-only. O navegador chama o backend da própria aplicação administrativa.
3. Usar o mesmo projeto de identidade/dados quando tecnicamente adequado, sem copiar contas para um segundo Auth. Sessões são distintas por aplicação: o cookie do produto não autentica automaticamente o painel.
4. Não configurar `Domain=.segundocerebroapp.com.br`; nomes próprios, `Path=/`, `Secure` e `HttpOnly`, com preferência por prefixo `__Host-` onde compatível. O código atual usa arquitetura centrada no servidor; não misturar um SDK de sessão no navegador que dependa de ler cookies `HttpOnly` sem redesenhar explicitamente esse contrato.
5. Validar sessão, papel Master, moderação, veto administrativo, nível MFA e permissão da operação em **cada** leitura/escrita. Role enviada pelo navegador, `user_metadata`, hostname ou uma aba oculta não concedem autoridade.
6. Exigir MFA para operações administrativas; a consulta do nível de autenticação deve ser validada no servidor e nos contratos de banco correspondentes. O Supabase documenta os níveis AAL e a necessidade de aplicação da regra além da interface. [Fonte oficial](https://supabase.com/docs/guides/auth/auth-mfa).
7. Aplicar origem exata, proteção CSRF, JSON estrito, limites e idempotência nas mutações. Subdomínios irmãos podem ser “same-site”; `SameSite` sozinho não separa `app` de `adm`. Não permitir CORS genérico para todos os subdomínios. [Referência OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).
8. **RLS não é uma barreira por hostname.** As políticas e RPCs devem autorizar identidade/sessão/capacidade; o servidor adiciona a verificação da origem do canal. Uma requisição SQL não deve confiar em `Host` ou em um cabeçalho que o cliente possa escolher. Service key nunca vai para bundle, HTML ou armazenamento do navegador.

O domínio separado reduz acoplamento de navegação e publicação, mas não torna automaticamente o banco ou o papel Master mais seguros. Manter revalidação transacional nas RPCs, inclusive replays, e privilégio mínimo por caso de uso. MFA não substitui guarda de sessão/moderação nem resolve chamadas externas pendentes.

**Vínculo de sessão ao canal:** após login próprio e MFA, o servidor administrativo registra uma autorização restrita vinculada ao `session_id` verificado, operador, nível de autenticação e validade/revogação (registro privado proposto, por exemplo `admin_session_grants`). Canais e RPCs administrativas exigem esse vínculo além do papel. Sessão obtida no produto e reapresentada como bearer, mesmo de Master, não ganha vínculo por cabeçalho `Host`, `Origin` ou `channel`; somente o fluxo administrativo protegido pode emiti-lo. Logout/revogação/expiração invalidam o vínculo. Cookies host-only evitam envio automático entre hosts, mas não substituem essa defesa contra reapresentação manual. Incluir teste de bearer do produto contra endpoints e RPCs do ADM.

## Telas e fluxos

| Área | Conteúdo e ação principal | Limites |
|---|---|---|
| Visão geral | Cadastros, contas habilitadas, ativos por período, pedidos novos e saúde dos jobs; selecionar período | Dados definidos e datados; “sessão ativa” não significa pessoa online. Nada de métricas fictícias. |
| Usuários | Busca por identificação, filtros de estado, ficha com metadados, acesso, sessões e histórico administrativo | Paginação no servidor; e-mail e ID somente para operador autorizado. Sem abrir conteúdo dos módulos. |
| Ficha do usuário | Estado/isenção/beta, cadastro verificado, concessões/vetos, sessões, feedback próprio e jornada consentida | Jornada com permissão específica e indicação “não coletado”, “expirado” ou “retirado”, conforme doc 10. |
| Sugestões | Fila privada, categoria, estado interno, resposta ao autor, vínculo opcional a item de roadmap | Texto e categoria, retorno no app. Resposta publicada ao autor não equivale a nota interna. |
| Roadmap | Criar/editar item editorial, ordenar e mover entre as cinco colunas aprovadas | Somente autenticados veem o roadmap do produto. Reclamação/sugestão não vira publicação automaticamente. |
| Funcionalidades | Estado de disponibilidade, grupo piloto/usuários permitidos e prévia de impacto | Não criar rotas arbitrárias. Somente capacidades implementadas e cadastradas em código/versionamento podem ser liberadas. |
| Auditoria/operação | Metadados de mudanças, resultado confirmado/incerto, reconciliação e jobs | Sem segredo ou conteúdo pessoal. Não oferecer botão “forçar sucesso” para operação incerta. |

A direção visual é **Operate**: tabelas legíveis, resumo curto, filtros essenciais e ficha com seções. Reutilizar Geist, temas, foco, tokens e componentes do produto; manter menu administrativo inequívoco e sem elementos promocionais. Botões destrutivos mostram impacto e confirmação contextual. Estados vazio, erro, permissão insuficiente e resultado desconhecido devem permanecer visíveis mesmo com redução de textos.

Rotas propostas do deploy administrativo: `/usuarios`, `/feedback`, `/roadmap`, `/metricas`, `/funcionalidades` e `/auditoria`, além da entrada autenticada e ficha `/usuarios/[id]`. No produto, os canais correspondentes são `/criar-conta`, `/feedback` e `/atualizacoes`; o roadmap editorial e a gestão de pedidos não reutilizam uma rota administrativa no host público.

## Funcionalidades ainda não liberadas

**RECOMENDADO:** separar três verificações:

1. Capacidade implementada em catálogo versionado (`feature_key` conhecida).
2. Disponibilidade do lançamento (`closed`, `pilot`, `open`, nomes propostos), com regras no servidor e SQL quando houver acesso direto/RPC.
3. Direito da pessoa conforme plano/isenção/entitlement, seguido da preferência de exibição.

Novas capacidades nascem **fechadas**. As existentes recebem migração explícita para o estado equivalente ao acesso atual; não transformar todo o Plano Pessoal em deny-by-default sem mapear cada capacidade. `pilot` libera somente a lista de usuários autorizada, preservando vetos. `open` não anula bloqueios. Uma aba indisponível não aparece, e sua URL/API/RPC também recusa a execução. Mudar preferência nunca concede acesso.

Banco e caches precisam de revisão de versão para que uma revogação seja aplicada imediatamente em novas operações. Não confiar somente em JWT antigo. Não apagar dados ao fechar uma capacidade. Jobs devem respeitar a disponibilidade aplicável sem interromper operações de recuperação/limpeza que continuem necessárias.

## Dados, APIs e configuração

Estruturas abaixo são **propostas** a acrescentar à base confirmada no doc 16, após reconciliar o histórico de migrations e reconferir o catálogo no candidato de execução:

- Reutilizar `user_roles`, `user_moderation`, `user_entitlements`, sessões e tabelas privadas de operações/auditoria Admin.
- `admin_capabilities` ou equivalente: distingue gestão de contas, feedback, releases e leitura de jornada; inicialmente Master é o único operador, sem inventar equipe de suporte.
- `feature_releases` e `feature_release_members`: chave conhecida, modo, revisão, dono da alteração, instante e membros piloto. Evento/recibo na mesma transação de alterações.
- `feedback_requests`: usuário, categoria, texto, estado interno, criação/atualização/encerramento; RLS por dono no canal de produto.
- `feedback_updates`: resposta visível ao autor, operador, instante; notas internas separadas e nunca incluídas no DTO do usuário.
- `roadmap_items` e relação com pedidos: título/resumo editorial, status, ordenação, publicação. Publicação não transporta corpo original nem identidade do solicitante.
- Retenção de feedback confirmada: **12 meses após encerramento**, com tratamento separado para solicitações de eliminação; item editorial pode permanecer sem vínculo pessoal. Reabertura tem que conservar histórico e definir novo encerramento explícito, sem estender por mera visualização.

APIs propostas no deploy administrativo: consultas paginadas de usuários/ficha/métricas/pedidos; comandos restritos para gestão de conta, resposta, status/publicação e release. Reutilizar padrões atuais de validação, `client_id`, revisão esperada, origem, dono da sessão e `no-store`. Não aceitar SQL ou nome de tabela do cliente. Leitura de jornada recebe autorização/auditoria própria.

Variáveis existentes reutilizáveis no deploy correto: `APP_MODE`, `APP_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `AUTH_STATE_SECRET`, `AUTH_RATE_LIMIT_SECRET`, `ADMIN_COMMAND_SECRET`. Valores não pertencem ao pacote documental. Propostas: `ADMIN_APP_ORIGIN=https://adm.segundocerebroapp.com.br`, identificação explícita do canal administrativo e secret de sessão/CSRF próprio. Os nomes finais dependem da extração; não criar chaves fictícias nem copiar segredos entre ambientes por conveniência.

Configuração manual/operacional: domínio e DNS, TLS, projeto de deploy administrativo, callbacks exatos de autenticação, MFA/recovery dos operadores, variáveis por ambiente, rota de contingência e revisão de acesso. Recursos existentes não foram alterados nem custos aprovados por este plano.

## Sequência de implementação e corte

| Etapa | Entregável | Prioridade/esforço | Dependência |
|---|---|---|---|
| ADM-01 | Reconciliar histórico instalado; atualizar inventário de rotas/grants/RPCs; verificar operações pendentes e contingência | P0/M | Auditoria estrutural do doc 16; código atual; acesso operacional autorizado para etapas restantes |
| ADM-02 | Fronteira compartilhada e segundo deploy com login Master/MFA | P0/G | ADM-01; configuração domínio/auth |
| ADM-03 | Gestão de usuários e retomada da saga sem regressão | P0/G | ADM-02; testes da saga atual |
| ADM-04 | Releases de funcionalidades com migração que preserva acessos atuais | P1/G | ADM-03; catálogo/backend/RLS alinhados |
| ADM-05 | Gestão de feedback/respostas e roadmap autenticado | P1/G | Modelo de feedback; APIs do produto |
| ADM-06 | Métricas e ficha de aquisição consentida | P1/G | [Doc 10](10-utm-metricas-e-jornada.md) |
| ADM-07 | Corte do Admin antigo e validação de contingência | P0/M | ADM-02/03 operantes ou contingência equivalente ensaiada |

P/M/G indicam esforço relativo, não prazo. Publicar funções opcionais do novo painel de forma incremental; não condicionar a desativação das APIs antigas a todas as métricas estarem prontas se gestão/contingência segura já estiverem disponíveis.

**Corte objetivo:** remover navegação Admin, desativar `/admin`, `/api/admin` e o endpoint administrativo de calendário no deploy do produto; requisições diretas autenticadas e não autenticadas nesses endereços não executam handlers/efeitos nem retornam dados administrativos. Um redirecionamento informativo da página pode apontar para `adm`, mas APIs não encaminham cookies nem fazem proxy transparente. Reconfirmar bundles, rotas geradas e hosts alternativos de preview. Preservar núcleo, dados e RPCs necessários ao novo painel, sem queda de proteção.

Contingência documenta operador habilitado, destino, identidade, ação permitida, registro e reconciliação. Não consiste em página secreta ou chave compartilhada. Em falha do novo deploy, manter a contingência; reabrir APIs antigas exige decisão operacional explícita, não rollback automático que recoloque a superfície em produção.

## Testes e critérios de aceite

- Usuário comum, Master vetado/bloqueado, sessão revogada e Master sem MFA não acessam consultas/ações protegidas, inclusive chamadas diretas e RPCs.
- Host alternativo/cabeçalho falsificado não concede acesso; origem de outro subdomínio é rejeitada em mutações. Cookie administrativo não aparece em requisições ao produto.
- Alterar `user_metadata`, preferência ou payload de papel não concede Master/capacidade. Nenhuma service key no navegador, sourcemap, log ou HTML.
- Operações da saga passam duplicatas, concorrência, última conta Master, revogação e transporte incerto sem segundo efeito externo.
- Release fechada/piloto/aberta produz mesma autorização em navegação, API, SQL e jobs relevantes; contas históricas conservam acesso equivalente.
- Feedback de A não é lido por B; resposta interna não aparece ao solicitante; roadmap só mostra itens publicados a autenticados; retenção de 12 meses não remove por engano item aberto.
- Painel mantém teclado/foco, 320/390 px e desktop, claro/escuro, mensagens de falha e paginação; sem carregamento de todos os usuários de uma vez.
- Evidência do corte comprova ausência de dados e efeitos nas antigas APIs, após contingência testada. Uma UI sem link não é suficiente.

Riscos principais: ampliação indevida de privilégio, perda do único operador, auth/SDK e SQL sem transação compartilhada, concessão por preferência, divergência entre builds e abandono de operações incertas. Antes da entrega, revisão das fronteiras (`check:layers`), scanner de segredos, testes focados e prova hospedada do novo canal. Nenhum desses testes foi executado por este documento.

## Referências e limites

Código citado pertence ao SHA indicado; autorização de mudança vem do briefing e respostas atuais, não de comentários antigos de merge/deploy. [Supabase MFA](https://supabase.com/docs/guides/auth/auth-mfa), [SSR avançado](https://supabase.com/docs/guides/auth/server-side/advanced-guide) e [OWASP CSRF](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) foram consultados em 31/10/2026. A documentação SSR genérica inclui cenários de SDK no navegador; o desenho recomendado aqui preserva o canal server-only observado e exige teste próprio de refresh/logout/MFA. O índice `changelog.md` do Supabase não pôde ser lido pelo navegador por tipo de conteúdo; reconferir mudanças relevantes de Auth antes da implementação.
