# Contratos de cadastro, origem simples e métricas

## Escopo e precedência

Contrato de implementação publicado neste planejamento; nenhum produto ou serviço foi alterado nesta tarefa. Base `bd35288404c493d1b03f7a1a0208f808cc2079a2`. Foram lidos AGENTS, CONTEXT, a skill local `.agents/skills/to-tickets/SKILL.md`, convenções do tracker, ADRs 0003/0007/0010, código Auth/onboarding e auditoria do doc 16.

O pedido atual reduz a fase 1: **cadastro por e-mail e senha, acesso gratuito, cinco UTMs opcionais por cadastro, métricas agregadas de cadastros para Master, feedback privado e atualizações para usuários autenticados**. Sem login Google agora, cobrança, checkout, first/last touch, jornada, visitas, DAU/WAU/MAU, ficha individual UTM ou novo ADM separado. A integração Calendar somente de leitura já existente não é login social e não precisa ser removida por esse adiamento. Calendar editável, ClickUp, ADM separado e lixeira com purga ficam na fase 2.

Registrar essa precedência no pacote: as restrições comerciais históricas dos ADRs 0009/0010 não impedem a entrada gratuita agora explicitamente solicitada. Preservar seus invariantes de isolamento, isenções, moderação e efeitos recuperáveis. Não implementar um modelo de cobrança para viabilizar o cadastro gratuito. Nesta fase, não apresentar contador de sete dias nem criar prazo de expiração; acesso gratuito durante o beta, sem cartão.

## Evidências que alteram o desenho

| Observado | Consequência |
|---|---|
| `src/lib/auth/service.ts` oferece signIn, recovery e troca de senha; não há signUp | Nova entrada precisa de contrato próprio; não basta expor um formulário. |
| `src/app/auth/callback/route.ts` chama somente exchangeRecovery; `flow-state.ts` vincula recovery a cookie/nonce | Não reutilizar esse callback como confirmação de cadastro. Preservar integralmente recovery; confirmação em outro dispositivo precisa funcionar sem o cookie do navegador de origem. |
| `src/lib/auth/runtime.ts:28` usa getUser/getClaims e my_access_state | Manter a comprovação de identidade/sessão no servidor. Contexto de confirmação pendente não pode ser confundido com identidade autorizada a ler módulos. |
| `identity_foundation.sql:175` provisiona perfil/preferências/role/moderação; `has_feature` permite quando não há veto | Cadastro direto no endpoint Supabase precisa ser tratado. Não confiar que todos passaram pelo formulário, nem usar ausência de entitlement como prova de aceite/registro do beta. |
| `20261011071500_admin_auth_creation_order.sql` e ADR-0007 protegem criações Admin | Cadastro público não chama saga Admin, não simula Master e não modifica esse caminho para acomodar signUp. |
| `20261023061901_onboarding_foundation.sql:18–21` exige `onboarding_entries.source_operation` não nulo com FK para admin_operations | Cadastro público não pode inventar uma operação Admin. Expandir a origem do enrollment com discriminante e constraints para admitir origem pública comprovada, preservando a relação administrativa existente. |
| Auditoria: 67 tabelas, 27 arquivos de migration, cinco registros no ledger; 2.512 checks/uma divergência PT409 explicada | Reconciliação é gate compartilhado antes de novas migrations remotas. Não reaplicar as 22 migrations sem registro. |

Os caminhos nesta nota servem como evidência. Os tickets devem apontar para o contrato documentado e descrever comportamento, evitando congelar caminhos de implementação.

## Contrato mínimo recomendado

### 1. Solicitar e confirmar cadastro

1. Formulário curto: e-mail e senha com opção de revelar; não exigir nome, telefone, cartão ou segundo campo de senha nesta entrada; nome pode continuar no onboarding. Reutilizar regra atual de senha (mínimo de 12 caracteres, máximo de 72 bytes UTF-8, sem caracteres de controle), feedback acessível e botões com estados claros. Ciência da versão dos termos/privacidade separada do consentimento facultativo de origem.
2. Canal servidor valida origem exata, tamanho, e-mail normalizado, senha, campos permitidos e versões legais. Rate limit de solicitação/reenvio/verificação com HMAC do identificador, sem logar e-mail/senha/token/UTMs. Não usar IP bruto como cadastro ou aquisição. Confirmar SMTP, redirects e confirmação de e-mail no ambiente antes de abrir a entrada; a auditoria não comprovou essas configurações.
3. Criar intenção privada de cadastro com ID opaco, prazo e recibo; nunca senha, confirmação token ou JWT persistidos. A intenção contém somente o necessário para legalidade, vinculação e, após aceite específico, a origem opcional. Um nonce aleatório pode ser enviado pelo servidor ao Auth como ponteiro; sua validade vem do registro privado, não de confiar em `user_metadata`.
4. Usar o fluxo regular Auth de cadastro/confirm e não `admin.createUser(email_confirm:true)`. Resultado HTTP de signUp não comprova que a identidade foi criada: a vinculação nasce do ID real observado no evento/trigger de criação ou de conciliação protegida da intenção exata. Não associar uma tentativa a conta existente apenas por e-mail ou pelo objeto de usuário devolvido ao cliente.
5. Confirmação tem finalidade própria e tipo permitido fixado pelo servidor. Recomenda-se página intermediária e POST explícito para verificar token/OTP; GET de scanner não conclui cadastro. URL externa/redirect arbitrário são rejeitados. Usar `no-store`, `no-referrer`, retirar segredo da URL assim que houver estado seguro e não incluir scripts de métricas nessa tela.
6. Em outro dispositivo, o token/OTP comprova a identidade no servidor e recupera a intenção vinculada ao **Auth ID**, não ao cookie antigo. Não transportar as cinco UTMs no link de e-mail. Sem contexto do navegador original, pedir confirmação explícita das escolhas legais e de origem, com origem desmarcada por padrão; recusar segue normalmente. A senha não é enviada no e-mail.

### 2. Admissão de acesso e bypass de signUp

**Recomendado:** registro privado e único de admissão por usuário, distinto de role, moderação, entitlement e atribuição. Estados mínimos: pendente e concluído; origem legada/administrativa/pública comprovada, versão legal e instante de conclusão. Não criar assinatura, trial comercial ou grants individuais para todas as funcionalidades.

- Backfill explícito dos usuários anteriores ao corte preserva seus direitos atuais e não muda bloqueios, `must_change_password`, papel ou vetos. “Legado” não significa inventar aceite de uma política nova ou data de cadastro verificado histórica.
- Novas identidades sem admissão concluída não acessam módulos, snapshots, RPCs ou Storage somente por possuírem JWT. Compor o gate no contrato central de sessão/acesso SQL e servidor usado pelos módulos; preferência de menu não é barreira. **Preferir esse estado separado a reutilizar `user_moderation.status` como estado de cadastro**, evitando desbloquear um veto do Master por engano.
- Conclusão é uma RPC/porta estreita: contexto de Auth confirmado, sessão real pertencente ao alvo, finalidade de confirmação comprovada, ciência legal válida e vínculo de intenção. Não aceita `user_id`, role, allowed, free ou prazo arbitrários do navegador. Revalida ban/moderação e grava admissão + evento mínimo + oferta de onboarding na mesma transação local. Pode repetir sem emitir segundo cadastro.
- O canal de confirmação pode ler somente o estado mínimo necessário a completar a própria admissão. Não relaxar `require_actor` dos módulos para tratar usuário pendente. Adaptar a obtenção de contexto provisório explicitamente; o runtime atual retorna null quando my_access_state nega acesso.
- Cadastro direto via chave publicável sem intenção emitida no servidor continua pendente. Pode ser recusado por hook de criação, se esse mecanismo for escolhido e homologado, ou receber uma retomada legítima de admissão após nova prova de posse e escolhas legais. Em nenhum caso gera Master, remove ban/veto, registra aceite de origem inventado ou abre dados por metadata. O hook é defesa adicional, não substitui o gate de negócio.
- Criações administrativas concluídas continuam passando pelo ADR-0007 e recebem origem administrativa legítima; não passar a exigir consentimento UTM ou confirmação pública para usuários legados/Admin. Estados comerciais futuros são separados; acesso gratuito nesta fase não deve apagar gratuidades existentes nem criar promessa irreversível sobre cobrança futura.
- Expandir enrollment do onboarding preservando origem Admin e adicionando origem pública comprovada, sem apagar rounds/rascunhos ou oferecer onboarding novamente aos antigos. Pular onboarding libera o dashboard; o acesso não depende de cadastrar hábitos/projetos.

### 3. Duplicatas, resultado incerto e posse do e-mail

- Resposta pública neutra para e-mail já cadastrado; não mostrar se a conta é Master, bloqueada, gratuita ou confirmada. Oferecer entrar/recuperar/reenvio sem confirmar existência. Não sobrescrever senha, perfil, atribuição ou consentimento de conta admitida por nova chamada ao formulário.
- Reenvio, timeout ou clique duplo reutilizam a intenção; estado externo desconhecido não autoriza criar outra conta/operação. Não persistir senha para retry: se for necessário novo envio do segredo, a pessoa o informa novamente. O cliente não recebe segredo de conciliação nem lista de usuários.
- Tratar **conta não confirmada preexistente** como caso próprio: não assumir que a senha inicial foi escolhida pelo titular que acaba de abrir o e-mail. A finalização deve exigir continuação comprovada da tentativa original ou confirmação da senha conhecida pelo titular dentro da sessão de confirmação; sem isso, conduzir à definição/recuperação segura da senha antes da admissão, sem ativar silenciosamente a credencial de outra tentativa. Um login posterior com senha conhecida por terceiro não substitui a prova de confirmação exigida para concluir a admissão.
- Token usado/expirado não confirma novamente; apresentar estado seguro e opção de nova prova. Falha após confirmação Auth e antes do commit local é retomável pela conta/intent exatos, sem second signUp, sem segundo evento e sem reiniciar onboarding.
- Recovery existente não pode se tornar callback de cadastro nem criar admissão por acidente. Para uma conta pendente que precisa recuperar a senha, criar transição limitada de recuperação de acesso, com prova de posse e conclusão explícita; preservar validação de usuário/sessão, revogação e checkpoints atuais.

Esses são critérios de segurança, não ordem de criar uma saga comercial geral. Na implementação, escolher o mecanismo mais simples que satisfaça os casos conectados, documentando testes de duplicata e confirmação em outro dispositivo.

### 4. Origem única e consentida — somente cinco campos

Allowlist exata: `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`; cada um opcional. **Sem referrer**, first/last, histórico de páginas, visitante persistente, fingerprint, IDs de anúncio, abandono ou campanha reaplicada em login. Mesmo domínio de origem previsto no doc 16 antigo fica fora deste recorte simples.

- Antes de aceitar: não gravar campanhas em cookie, localStorage, sessão de servidor ou tabela. A URL corrente pode conter os parâmetros, mas leitura para atribuição e persistência só ocorre após a escolha positiva. O caminho entre landing e cadastro pode transportar apenas os parâmetros permitidos em links internos, sem criar registro de visitas; a pessoa que não aceita conclui sem atribuição. Não reconstruir visitas anteriores.
- O servidor faz trim, normalização limitada e limite técnico recomendado de 200 caracteres por campo/1 KiB total. Rejeitar controle/HTML e ignorar valores inválidos sem impedir cadastro. Tratar conteúdo como texto não confiável; não usar campanha como origem autorizada, redirect, role ou SQL.
- Ao aceitar e enviar o cadastro, salvar um pacote imutável na intenção privada. O trigger/registro protegido vincula aquela intenção à identidade realmente criada. Na admissão confirmada, transferir uma única vez para registro por Auth ID se o aceite continua válido. Sem correspondência comprovada, guardar ausência de origem; não escolher “último cadastro deste e-mail”.
- Em confirmação em outro dispositivo, revalidar escolha sem reatribuir campanha a partir da URL atual. Recusa/retirada elimina o pacote pendente. Já admitido não recebe atualização de campanha por retry, recovery, login, alteração de e-mail ou novo formulário.
- Consentimento guarda versão da finalidade e instantes do servidor; ciência legal não o concede. UTMs não entram em logs/eventos append-only/recibos legíveis duplicados. Evento pode indicar somente mudança de estado do consentimento, sem valores de campanha.
- Prazo técnico recomendado: pacote pendente vence com a intenção de confirmação, no máximo 24h; registro vinculado vence em 12 meses desde conclusão do cadastro, ou antes por retirada. Esse marco adapta a proposta anterior: não é “12 meses desde pagamento”, pois não há pagamento. Expiração não bloqueia conta e não reinicia por uso. Após expiração/retirada, reenvio antigo não recria campanha. Rotina mínima de eliminação desses novos dados pertence à entrega de origem; a purga ampla da lixeira adiada à fase 2 é outro domínio.
- Configurações oferece estado claro e retirada da atribuição, sem expor jornadas. Não prometer apagar imediatamente backups imutáveis; registrar o contrato de reaplicação de exclusões após restore, sem ativar o projeto de restore nesta fase.


### 5. Métricas de cadastro para o Master

Rota proposta `/metricas` dentro do produto atual, sem criar aplicação ADM. Autorização central Master + estado de sessão/moderação no servidor e RPC, não apenas menu oculto. Nova funcionalidade continua distinguindo permissão de preferência.

| Indicador | Definição e limite |
|---|---|
| Contas existentes | Estoque de identidades com perfil válido no instante da consulta, separadas por origem legada/administrativa/pública quando o dado é comprovável. Não é série histórica de ativações. |
| Cadastros públicos concluídos | Uma admissão pública confirmada por Auth ID, no período. Reenvio, login, recovery e retry não aumentam a contagem. |
| Confirmações pendentes | Quantidade atual de intenções/identidades pendentes ainda válidas; não inferir que cada intenção corresponde a pessoa única. Pode ser omitida se a semântica não for confiável. |
| Origem informada | Agrupamentos pelos cinco campos UTM consentidos e ainda retidos; ausentes como Não informada. Não concluir que ausência significa tráfego direto. |
| Série temporal | Cadastros concluídos por dia/semana/mês, com intervalo limitado e fuso explícito. Persistência UTC; apresentação America/Fortaleza como padrão do relatório. |

Período inclui início e exclui início do dia seguinte ao fim, convertido no servidor do fuso acordado para UTC. Limite recomendado de 366 dias por consulta, paginação de agrupamentos de alta cardinalidade e teto de resultados. Contador e gráfico usam a mesma população; retries e trocas rápidas de período não apresentam resposta obsoleta. Receita, usuários ativos, presença online, DAU/MAU e conversão de visita não são inferidos de cadastros.

Agregação no banco com retorno allowlist e cache privado/no-store. Agrupar cada dimensão separadamente, sem cruzamento arbitrário de term/content e períodos para isolar pessoas; coalescer grupos com menos de cinco cadastros em Outros, preservando total geral e explicação do agrupamento. Agregado não equivale a anonimização garantida. Não baixar `admin_snapshot` com nomes/e-mails para contar no browser. Não expor valores de campanha no payload do usuário comum, nem implementar exportação de usuários ou drill-down individual nesta fase. A origem é informação declarada na URL, manipulável, útil para atribuição operacional, nunca identidade confiável ou prova causal.

As distribuições UTM dependem do ticket de origem. Contagem pode ser desenvolvida antes, mas o ticket de métricas só fecha com ambas as dimensões verificadas. Total de cadastros não diminui porque o consentimento da origem foi retirado; distribuições deixam de usar a origem removida e explicam a janela de retenção. Exclusão de conta segue o contrato de privacidade vigente, sem tombstone identificável inventado.

### 6. Feedback mínimo e atualizações editoriais

**Feedback fase 1:** usuário autenticado envia categoria (sugestão, reclamação, problema, melhoria, outro) e texto; recebe confirmação real e consulta apenas o próprio histórico. Texto entre 10 e 5.000 caracteres, plain text renderizado com escape, sem anexos; limites são proposta técnica, não nova decisão de produto. Uma intenção idempotente evita duplicação após resposta perdida. Autor vem da sessão. RLS/RPC não permitem ler, editar ou trocar o dono do feedback de outra conta. Status inicial Recebido, data do servidor, retry que conserva o texto e erros úteis. O usuário não altera status administrativo.

Usar um modelo que possa receber respostas depois sem reescrever o histórico, mas **não construir fila de operador, resposta ou encerramento nesta fase**. Mostrar que a mensagem foi recebida e o canal de suporte existente, sem afirmar resposta enviada ou prometer prazo. Pedidos de exclusão continuam pelo procedimento operacional vigente. Retenção de 12 meses após encerramento será ativada com o ciclo de triagem/resposta do ADM; não expirar feedback aberto em 12 meses por engano. Não há evento público automático a partir do texto privado.

**Atualizações fase 1:** rota autenticada, quadro editorial com Planejado, Em análise, Em andamento, Em fase de testes, Lançado. Conteúdo estático versionado no servidor, pequeno e validado: ID estável, título, resumo, estado, ordem/data de atualização e visibilidade publicada. Sem novo banco, editor administrativo ou formulário de escrita. Apenas itens publicáveis entram no bundle/repositório; rascunhos sigilosos não podem ser enviados ao cliente nem guardados como conteúdo público no Git. Não há arrastar para usuário mudar o status. Desktop com colunas; mobile com seletor/abas e navegação por teclado, sem exigir drag ou rolagem global.

Um card de planejamento não é lançamento. Estado Lançado exige referência factual a entrega existente. Quadro vazio oferece explicação curta e Enviar sugestão apenas quando Feedback estiver disponível. Link indisponível fica ausente; leitura do quadro não depende de backend de feedback. Publicar textos via PR permite esta entrega sem ADM. Posteriormente, importar IDs estáveis para a fonte administrável sem manter duas fontes ativas.

## Contratos propostos de dados e portas

São nomes descritivos, não migrations existentes nem scripts prontos para rodar. O implementador escolhe nomes finais seguindo convenções do projeto e atualiza tipos, catálogo e testes juntos.

| Conceito | Campos/garantias mínimas | Quem escreve/lê |
|---|---|---|
| Intenção de cadastro | ID opaco, fingerprint protegido do identificador necessário, estado, expiração, versões legais, ponteiro Auth comprovado; nunca senha/token de confirmação | Porta server estreita; cliente recebe somente recibo opaco e estado seguro |
| Admissão | Auth ID único, origem pública/admin/legado, estado, data de conclusão e ciência legal factual | Finalização segura/fluxo administrativo legítimo; usuário lê somente mínimo próprio |
| Origem de cadastro | Auth ID único, cinco UTMs opcionais, versão/instante de consentimento, expiração; nenhuma URL inteira | Finalização e retirada próprias; Master recebe agregados, não tabela inteira |
| Feedback | ID, autor, categoria, texto, status recebido, created_at, chave idempotente por autor | Criar/consultar próprios; sem acesso a outros autores |
| Atualização editorial | ID estável, título/resumo, estado, ordem/data; somente conteúdo publicável | Código versionado e leitura autenticada; sem API de escrita nesta fase |

Novas estruturas privadas não ganham grants amplos para `anon`/`authenticated`. RPCs autenticadas validam ator, sessão, moderação e alvo, com `search_path` controlado e privilégios mínimos. Portas pré-Auth de intenção/reenvio ainda não têm usuário: autoridade técnica estreita, finalidade fixa, validação, rate limit e recibo opaco, sem simular ator ou Master. Preservar eventos atômicos, padrões de resultado incerto e fronteiras core/adapters/channels. A rotina de descarte das intenções/atribuições novas é pequena e pertence a esse domínio; não é licença para antecipar a purga da lixeira do produto.

## ADR, configuração e sequência de banco

1. Registrar complemento de ADR para admissão pública gratuita, mantendo as garantias de ADR-0003/0007/0010 e deixando claro o adiamento comercial. Não alterar o sentido de isenção, veto ou Master.
2. G0 confere ledger/catalog/patch PT409 e produz procedimento seguro; 22 entradas ausentes no ledger não autorizam reaplicar 22 migrations. Evolução deve ser aditiva, testada no QA correto e rastreável.
3. Primeiro expandir dados/gates/origem do onboarding com backfill preservador de legados; manter cadastro fechado. Provar administração, login/recovery e isolamento após expansão.
4. Homologar confirmação/reenvio/retomada e SMTP, depois ativar cadastro. Kill switch server fecha novas admissões sem revogar contas admitidas. Rollback da aplicação não remove dados criados nem reabre o bypass de Auth direto; compatibilidade deve ser comprovada.
5. Em sequência, adicionar origem opcional, métricas e feedback. Atualizações versionadas pode avançar sem migration. A liberação completa depende do aceite integrado da fase 1.

Configuração existente a conferir por **nomes**, sem imprimir valores: URL/chaves Supabase, origem canônica, SMTP e redirects permitidos, confirmação de e-mail, segredo dos controles existentes de sessão/rate limit. Capacidade de cadastro público é proposta server-only, desligada por padrão até homologação. Nenhum client secret/chave privilegiada entra no bundle. Não inventar nova variável que substitua uma equivalente já presente.

## Fontes oficiais para reconferência

- [Supabase signUp](https://supabase.com/docs/reference/javascript/auth-signup): confirmação e duplicatas.
- [Templates Auth](https://supabase.com/docs/guides/auth/auth-email-templates): TokenHash/OTP, pré-leitura de links e fluxo próprio.
- [SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client): sessão e servidor.
- [SMTP](https://supabase.com/docs/guides/auth/auth-smtp): envio real e limites.
- [Before User Created](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook): defesa adicional opcional, nunca substituto do gate de negócio.

Os contratos acima são propostas técnicas ligadas à inspeção do código. A auditoria estrutural não comprova configuração Auth/SMTP, comportamento end-to-end, QA ou liberação remota. Conferir a versão instalada e fontes oficiais ao implementar; não anunciar testes ainda não executados.
